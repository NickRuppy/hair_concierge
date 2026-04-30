import { AGENT_COMPARE_SCENARIOS } from "./scenarios"
import { runCurrentChatComparison } from "./current-disabled"
import { runShadowAgentComparison } from "./run-shadow-agent"
import type {
  AgentCompareRequest,
  AgentCompareResponse,
  AgentCompareScenario,
  CompareRunResult,
} from "./types"

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

export async function runCompareWithAdapters(params: {
  scenario: AgentCompareScenario
  prompt: string
  baseUrl?: string | null
  runCurrent: (params: {
    scenario: AgentCompareScenario
    prompt: string
    baseUrl?: string | null
  }) => Promise<CompareRunResult>
  runAgent: (params: {
    scenario: AgentCompareScenario
    prompt: string
    baseUrl?: string | null
  }) => Promise<CompareRunResult>
}): Promise<AgentCompareResponse> {
  const [current, agent] = await Promise.all([
    params
      .runCurrent({
        scenario: params.scenario,
        prompt: params.prompt,
        baseUrl: params.baseUrl,
      })
      .catch((error) => normalizeFailure("current", error)),
    params
      .runAgent({
        scenario: params.scenario,
        prompt: params.prompt,
        baseUrl: params.baseUrl,
      })
      .catch((error) => normalizeFailure("agent", error)),
  ])

  return {
    scenario: params.scenario,
    prompt: params.prompt,
    results: [current, agent],
  }
}

export async function runCompare(request: AgentCompareRequest): Promise<AgentCompareResponse> {
  const scenario = AGENT_COMPARE_SCENARIOS.find((entry) => entry.id === request.scenarioId)

  if (!scenario) {
    throw new Error(`Unknown scenario: ${request.scenarioId}`)
  }

  return runCompareWithAdapters({
    scenario,
    prompt: request.prompt,
    baseUrl: request.baseUrl,
    runCurrent: runCurrentChatComparison,
    runAgent: runShadowAgentComparison,
  })
}
