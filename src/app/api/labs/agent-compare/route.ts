import {
  normalizeCompareRunResult,
  shouldSwapBlindedResults,
} from "@/lib/agent/compare/run-compare"
import { runToolLoopComparisonForUser } from "@/lib/agent/compare/run-agentic-tool-loop"
import { runClassicAgentComparisonForUser } from "@/lib/agent/compare/run-shadow-agent"
import { loadCompareUserSnapshot, listEligibleCompareUsers } from "@/lib/agent/compare/test-users"
import { DEFAULT_AGENT_COMPARE_TOOL_LOOP_VARIANT } from "@/lib/agent/compare/tool-loop-variants"
import type {
  AgentCompareUserOption,
  AgentCompareUserRequest,
  AgentCompareUserSnapshot,
  CompareRunResult,
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
  })
  .refine((value) => Boolean(value.prompt || value.turns?.length), {
    message: "Prompt oder Turns erforderlich",
  })

interface AgentCompareRouteDeps {
  listEligibleCompareUsers: () => Promise<AgentCompareUserOption[]>
  loadCompareUserSnapshot: (userId: string) => Promise<AgentCompareUserSnapshot>
  runCurrentComparisonForUser: (request: AgentCompareUserRequest) => Promise<CompareRunResult>
  runShadowComparisonForUser: (request: AgentCompareUserRequest) => Promise<CompareRunResult>
}

const defaultRouteDeps: AgentCompareRouteDeps = {
  listEligibleCompareUsers,
  loadCompareUserSnapshot,
  runCurrentComparisonForUser: runClassicAgentComparisonForUser,
  runShadowComparisonForUser: runToolLoopComparisonForUser,
}

function createDevOnlyResponse() {
  return NextResponse.json({ error: "Nur lokal in development verfuegbar." }, { status: 404 })
}

function normalizeFailure(
  system: "classic" | "tool_loop",
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
    const prompt = turns.at(-1) ?? ""
    const blinded = parsed.data.blinded === true
    const toolLoopVariant = parsed.data.toolLoopVariant ?? DEFAULT_AGENT_COMPARE_TOOL_LOOP_VARIANT
    const [current, agent] = await Promise.all([
      deps
        .runCurrentComparisonForUser({ ...parsed.data, prompt, turns, toolLoopVariant })
        .then((result) => normalizeCompareRunResult(result))
        .catch((error) => normalizeFailure("classic", "Classic", error)),
      deps
        .runShadowComparisonForUser({ ...parsed.data, prompt, turns, toolLoopVariant })
        .then((result) => normalizeCompareRunResult(result))
        .catch((error) => normalizeFailure("tool_loop", "Tool Loop", error)),
    ])
    const orderedResults =
      blinded && shouldSwapBlindedResults(turns) ? [agent, current] : [current, agent]
    const labeledResults = orderedResults.map((entry, index) =>
      normalizeCompareRunResult(
        entry,
        blinded
          ? `Variante ${index === 0 ? "A" : "B"}`
          : entry.system === "classic"
            ? "Classic"
            : "Tool Loop",
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
