import { AGENT_COMPARE_SCENARIOS } from "./scenarios"
import { runToolLoopComparison } from "./run-agentic-tool-loop"
import { runClassicAgentComparison } from "./run-shadow-agent"
import { resolveAgentCompareToolLoopVariant } from "./tool-loop-variants"
import type {
  AgentCompareRequest,
  AgentCompareResponse,
  AgentCompareScenario,
  CompareRunResult,
  CompareSystemInput,
} from "./types"

export function normalizeCompareSystem(system: CompareSystemInput): "classic" | "tool_loop" {
  if (system === "current") return "classic"
  if (system === "agent") return "tool_loop"
  return system
}

export function normalizeCompareRunResult(
  result: CompareRunResult,
  displayLabel?: string,
): CompareRunResult {
  return {
    ...result,
    system: normalizeCompareSystem(result.system),
    display_label: displayLabel ?? result.display_label,
  }
}

export function shouldSwapBlindedResults(turns: string[]): boolean {
  const seed = turns.join("\n")
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }

  return hash % 2 === 1
}

function normalizeFailure(system: "classic" | "tool_loop", error: unknown): CompareRunResult {
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

function normalizeTurns(params: { prompt?: string; turns?: string[] }): string[] {
  const turns = params.turns?.map((turn) => turn.trim()).filter((turn) => turn.length > 0) ?? []
  if (turns.length > 0) return turns

  const prompt = params.prompt?.trim() ?? ""
  return prompt.length > 0 ? [prompt] : []
}

export async function runCompareWithAdapters(params: {
  scenario: AgentCompareScenario
  prompt?: string
  turns?: string[]
  baseUrl?: string | null
  blinded?: boolean
  toolLoopVariant?: AgentCompareRequest["toolLoopVariant"]
  runCurrent: (params: {
    scenario: AgentCompareScenario
    prompt?: string
    turns?: string[]
    baseUrl?: string | null
    toolLoopVariant?: AgentCompareRequest["toolLoopVariant"]
  }) => Promise<CompareRunResult>
  runAgent: (params: {
    scenario: AgentCompareScenario
    prompt?: string
    turns?: string[]
    baseUrl?: string | null
    toolLoopVariant?: AgentCompareRequest["toolLoopVariant"]
  }) => Promise<CompareRunResult>
}): Promise<AgentCompareResponse> {
  const turns = normalizeTurns(params)
  const prompt = turns.at(-1) ?? ""
  if (turns.length === 0) {
    throw new Error("Compare requires a prompt or at least one turn.")
  }
  const toolLoopVariant = resolveAgentCompareToolLoopVariant(params.toolLoopVariant)

  const [current, agent] = await Promise.all([
    params
      .runCurrent({
        scenario: params.scenario,
        prompt,
        turns,
        baseUrl: params.baseUrl,
        toolLoopVariant,
      })
      .then((result) => normalizeCompareRunResult(result))
      .catch((error) => normalizeFailure("classic", error)),
    params
      .runAgent({
        scenario: params.scenario,
        prompt,
        turns,
        baseUrl: params.baseUrl,
        toolLoopVariant,
      })
      .then((result) => normalizeCompareRunResult(result))
      .catch((error) => normalizeFailure("tool_loop", error)),
  ])

  const orderedResults =
    params.blinded && shouldSwapBlindedResults(turns) ? [agent, current] : [current, agent]
  const labeledResults = orderedResults.map((entry, index) =>
    normalizeCompareRunResult(
      entry,
      params.blinded
        ? `Variante ${index === 0 ? "A" : "B"}`
        : entry.system === "classic"
          ? "Classic"
          : "Tool Loop",
    ),
  )

  return {
    scenario: params.scenario,
    prompt,
    turns: turns.length > 1 ? turns : undefined,
    blinded: params.blinded || undefined,
    toolLoopVariant,
    results: labeledResults,
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
    turns: request.turns,
    baseUrl: request.baseUrl,
    blinded: request.blinded,
    toolLoopVariant: request.toolLoopVariant,
    runCurrent: ({ scenario, prompt, turns, baseUrl }) =>
      runClassicAgentComparison({
        scenario,
        prompt: prompt ?? turns?.at(-1) ?? scenario.message,
        turns,
        baseUrl,
      }),
    runAgent: runToolLoopComparison,
  })
}
