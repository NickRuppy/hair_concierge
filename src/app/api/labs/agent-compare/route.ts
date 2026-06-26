import { DEFAULT_AGENT_COMPARE_TOOL_LOOP_VARIANT } from "@/lib/agent/compare/tool-loop-variants"
import type {
  AgentCompareUserOption,
  AgentCompareUserRequest,
  AgentCompareUserSnapshot,
  CompareRunResult,
  CompareSystem,
} from "@/lib/agent/compare/types"
import { NextResponse } from "next/server"
import { z } from "zod"

const requestSchema = z
  .object({
    userId: z.string().min(1),
    prompt: z.string().min(1).optional(),
    turns: z.array(z.string().min(1)).min(1).optional(),
    blinded: z.boolean().optional(),
    toolLoopVariant: z
      .enum(["baseline", "inline_context", "guidance_tool", "composer_context"])
      .optional(),
    systems: z
      .array(
        z.enum(["classic", "tool_loop", "agent_v2", "agent_v2_care_balance", "current", "agent"]),
      )
      .optional(),
  })
  .refine((value) => Boolean(value.prompt || value.turns?.length), {
    message: "Prompt oder Turns erforderlich",
  })

interface AgentCompareRouteDeps {
  listEligibleCompareUsers: () => Promise<AgentCompareUserOption[]>
  loadCompareUserSnapshot: (userId: string) => Promise<AgentCompareUserSnapshot>
  runCurrentComparisonForUser: (request: AgentCompareUserRequest) => Promise<CompareRunResult>
  runShadowComparisonForUser: (request: AgentCompareUserRequest) => Promise<CompareRunResult>
  runAgentV2ComparisonForUser?: (request: AgentCompareUserRequest) => Promise<CompareRunResult>
  runAgentV2CareBalanceComparisonForUser?: (
    request: AgentCompareUserRequest,
  ) => Promise<CompareRunResult>
}

const defaultRouteDeps: AgentCompareRouteDeps = {
  listEligibleCompareUsers: async () => {
    const loadedModule = await import("@/lib/agent/compare/test-users")
    return loadedModule.listEligibleCompareUsers()
  },
  loadCompareUserSnapshot: async (userId) => {
    const loadedModule = await import("@/lib/agent/compare/test-users")
    return loadedModule.loadCompareUserSnapshot(userId)
  },
  runCurrentComparisonForUser: async (request) => {
    const loadedModule = await import("@/lib/agent/compare/run-shadow-agent")
    return loadedModule.runClassicAgentComparisonForUser(request)
  },
  runShadowComparisonForUser: async (request) => {
    const loadedModule = await import("@/lib/agent/compare/run-agentic-tool-loop")
    return loadedModule.runToolLoopComparisonForUser(request)
  },
  runAgentV2ComparisonForUser: runAgentV2ComparisonForUser,
  runAgentV2CareBalanceComparisonForUser: async (request) => {
    const loadedModule = await import("@/lib/agent-v2/compare/run-agent-v2")
    return loadedModule.runAgentV2ComparisonForUser(request, { includeCareBalanceContext: true })
  },
}

async function runAgentV2ComparisonForUser(request: AgentCompareUserRequest) {
  const loadedModule = await import("@/lib/agent-v2/compare/run-agent-v2")
  return loadedModule.runAgentV2ComparisonForUser(request)
}

function createDevOnlyResponse() {
  return NextResponse.json({ error: "Nur lokal in development verfuegbar." }, { status: 404 })
}

function normalizeFailure(
  system: CompareSystem,
  displayLabel: string,
  error: unknown,
): CompareRunResult {
  return {
    system,
    display_label: displayLabel,
    answer: "",
    latency_ms: null,
    debug_lines: [],
    matched_products: [],
    product_trace: null,
    route_trace: null,
    error: error instanceof Error ? error.message : "Unknown compare error",
  }
}

function normalizeTurns(value: { prompt?: string; turns?: string[] }): string[] {
  const turns = value.turns?.map((turn) => turn.trim()).filter((turn) => turn.length > 0) ?? []
  if (turns.length > 0) return turns

  const prompt = value.prompt?.trim() ?? ""
  return prompt.length > 0 ? [prompt] : []
}

function normalizeCompareSystem(system: CompareSystem | "current" | "agent"): CompareSystem {
  if (system === "current") return "classic"
  if (system === "agent") return "tool_loop"
  return system
}

function normalizeCompareRunResult(
  result: CompareRunResult,
  displayLabel?: string,
): CompareRunResult {
  return {
    ...result,
    system: normalizeCompareSystem(result.system),
    display_label: displayLabel ?? result.display_label,
  }
}

function shouldSwapBlindedResults(turns: string[]): boolean {
  const seed = turns.join("\n")
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }

  return hash % 2 === 1
}

function formatBlindedVariantLabel(index: number): string {
  return `Variante ${String.fromCharCode(65 + index)}`
}

export async function handleAgentCompareGetRequest(
  requestUrl: URL,
  deps: AgentCompareRouteDeps = defaultRouteDeps,
) {
  if (process.env.NODE_ENV !== "development") {
    return createDevOnlyResponse()
  }

  try {
    const [users, selectedUser] = await Promise.all([
      deps.listEligibleCompareUsers(),
      (async () => {
        const userId = requestUrl.searchParams.get("userId")?.trim()
        return userId ? deps.loadCompareUserSnapshot(userId) : null
      })(),
    ])

    return NextResponse.json({ users, selectedUser })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Compare bootstrap failed" },
      { status: 500 },
    )
  }
}

export async function handleAgentCompareRequest(
  body: unknown,
  deps: AgentCompareRouteDeps = defaultRouteDeps,
) {
  if (process.env.NODE_ENV !== "development") {
    return createDevOnlyResponse()
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungueltige Compare-Anfrage", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const turns = normalizeTurns(parsed.data)
    if (turns.length === 0) {
      return NextResponse.json(
        {
          error: "Ungueltige Compare-Anfrage",
          details: {
            formErrors: ["Prompt oder Turns erforderlich"],
            fieldErrors: {},
          },
        },
        { status: 400 },
      )
    }

    const prompt = turns.at(-1) ?? ""
    const blinded = parsed.data.blinded === true
    const toolLoopVariant = parsed.data.toolLoopVariant ?? DEFAULT_AGENT_COMPARE_TOOL_LOOP_VARIANT
    const systems = parsed.data.systems?.length
      ? parsed.data.systems.map(normalizeCompareSystem)
      : (["agent_v2_care_balance"] as const)
    const runners: Record<CompareSystem, () => Promise<CompareRunResult>> = {
      classic: () =>
        deps.runCurrentComparisonForUser({ ...parsed.data, prompt, turns, toolLoopVariant }),
      tool_loop: () =>
        deps.runShadowComparisonForUser({ ...parsed.data, prompt, turns, toolLoopVariant }),
      agent_v2: () => {
        if (!deps.runAgentV2ComparisonForUser) {
          throw new Error("AgentV2 runner is not configured.")
        }
        return deps.runAgentV2ComparisonForUser({ ...parsed.data, prompt, turns, toolLoopVariant })
      },
      agent_v2_care_balance: () => {
        if (!deps.runAgentV2CareBalanceComparisonForUser) {
          throw new Error("AgentV2 CareBalance runner is not configured.")
        }
        return deps.runAgentV2CareBalanceComparisonForUser({
          ...parsed.data,
          prompt,
          turns,
          toolLoopVariant,
        })
      },
    }
    const results = await Promise.all(
      systems.map((system) =>
        runners[system]()
          .then((result) => normalizeCompareRunResult(result))
          .catch((error) =>
            normalizeFailure(
              system,
              system === "classic"
                ? "Classic"
                : system === "tool_loop"
                  ? "Legacy Tool-Loop"
                  : system === "agent_v2_care_balance"
                    ? "AgentV2 GPT-5.4-mini + CareBalance"
                    : "AgentV2 GPT-5.4-mini",
              error,
            ),
          ),
      ),
    )
    const orderedResults =
      blinded && results.length === 2 && shouldSwapBlindedResults(turns)
        ? [results[1], results[0]]
        : results
    const labeledResults = orderedResults.map((entry, index) =>
      normalizeCompareRunResult(
        entry,
        blinded
          ? formatBlindedVariantLabel(index)
          : entry.system === "classic"
            ? "Classic"
            : entry.system === "tool_loop"
              ? "Legacy Tool-Loop"
              : entry.system === "agent_v2_care_balance"
                ? "AgentV2 GPT-5.4-mini + CareBalance"
                : "AgentV2 GPT-5.4-mini",
      ),
    )

    return NextResponse.json({
      userId: parsed.data.userId,
      prompt,
      turns: turns.length > 1 ? turns : undefined,
      blinded: blinded || undefined,
      toolLoopVariant,
      results: labeledResults,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Compare failed" },
      { status: 500 },
    )
  }
}

export async function GET(request: Request) {
  return handleAgentCompareGetRequest(new URL(request.url))
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Ungueltige Compare-Anfrage" }, { status: 400 })
  }

  return handleAgentCompareRequest(body)
}
