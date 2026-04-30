import type { AgentCompareScenario, AgentCompareUserRequest, CompareRunResult } from "./types"

const DISABLED_REASON =
  "Legacy current RAG comparison is disabled while Agent v1 is the production front door."

interface CurrentDebugLineInput {
  sources: unknown[]
  matchedProducts: unknown[]
  routerDecision: {
    retrieval_mode: string
    response_mode: string
  }
}

export function buildCurrentDebugLines(
  result: CurrentDebugLineInput,
  options: { ephemeral?: boolean } = {},
): string[] {
  const lines = [
    `sources: ${result.sources.length}`,
    `products: ${result.matchedProducts.length}`,
    `retrieval: ${result.routerDecision.retrieval_mode}`,
    `response: ${result.routerDecision.response_mode}`,
    `clarify: ${result.routerDecision.response_mode === "clarify_only" ? "yes" : "no"}`,
  ]

  if (options.ephemeral) {
    lines.push("ephemeral: yes")
  }

  return lines
}

function disabledCurrentResult(options: { ephemeral?: boolean } = {}): CompareRunResult {
  return {
    system: "current",
    answer: "",
    latency_ms: null,
    debug_lines: options.ephemeral ? ["ephemeral: yes", DISABLED_REASON] : [DISABLED_REASON],
    matched_products: [],
    product_trace: null,
    route_trace: null,
    error: DISABLED_REASON,
  }
}

export async function runCurrentChatComparison(params: {
  scenario: AgentCompareScenario
  prompt: string
  baseUrl?: string | null
}): Promise<CompareRunResult> {
  void params
  return disabledCurrentResult()
}

export async function runCurrentChatComparisonForUser(
  params: AgentCompareUserRequest,
): Promise<CompareRunResult> {
  void params
  return disabledCurrentResult({ ephemeral: true })
}
