import { runCurrentChatComparisonForUser } from "@/lib/agent/compare/run-current-chat"
import { runShadowAgentComparisonForUser } from "@/lib/agent/compare/run-shadow-agent"
import { loadCompareUserSnapshot, listEligibleCompareUsers } from "@/lib/agent/compare/test-users"
import type {
  AgentCompareUserOption,
  AgentCompareUserRequest,
  AgentCompareUserSnapshot,
  CompareRunResult,
} from "@/lib/agent/compare/types"
import { NextResponse } from "next/server"
import { z } from "zod"

const requestSchema = z.object({
  userId: z.string().min(1),
  prompt: z.string().min(1),
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
  runCurrentComparisonForUser: runCurrentChatComparisonForUser,
  runShadowComparisonForUser: runShadowAgentComparisonForUser,
}

function createDevOnlyResponse() {
  return NextResponse.json({ error: "Nur lokal in development verfuegbar." }, { status: 404 })
}

function normalizeFailure(system: "current" | "agent", error: unknown): CompareRunResult {
  return {
    system,
    answer: "",
    latency_ms: null,
    debug_lines: [],
    matched_products: [],
    product_trace: null,
    route_trace: null,
    error: error instanceof Error ? error.message : "Unknown compare error",
  }
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
    const [current, agent] = await Promise.all([
      deps
        .runCurrentComparisonForUser(parsed.data)
        .catch((error) => normalizeFailure("current", error)),
      deps
        .runShadowComparisonForUser(parsed.data)
        .catch((error) => normalizeFailure("agent", error)),
    ])

    return NextResponse.json({
      userId: parsed.data.userId,
      prompt: parsed.data.prompt,
      results: [current, agent],
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
