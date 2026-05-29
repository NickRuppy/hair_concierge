import { AGENT_COMPARE_SCENARIOS } from "./scenarios"
import { runToolLoopComparison } from "./run-agentic-tool-loop"
import { runClassicAgentComparison } from "./run-shadow-agent"
import { runAgentV2Comparison } from "@/lib/agent-v2/compare/run-agent-v2"
import { resolveAgentCompareToolLoopVariant } from "./tool-loop-variants"
import type {
  AgentCompareRequest,
  AgentCompareResponse,
  AgentCompareScenario,
  CompareRunResult,
  CompareSystem,
  CompareSystemInput,
} from "./types"

export function normalizeCompareSystem(system: CompareSystemInput): CompareSystem {
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

function formatBlindedVariantLabel(index: number): string {
  return `Variante ${String.fromCharCode(65 + index)}`
}

function normalizeFailure(system: CompareSystem, error: unknown): CompareRunResult {
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
  systems?: CompareSystemInput[]
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
  runAgentV2?: (params: {
    scenario: AgentCompareScenario
    prompt?: string
    turns?: string[]
    baseUrl?: string | null
    toolLoopVariant?: AgentCompareRequest["toolLoopVariant"]
  }) => Promise<CompareRunResult>
  runAgentV2CareBalance?: (params: {
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
  const requestedSystems: CompareSystemInput[] = params.systems?.length
    ? params.systems
    : ["agent_v2_care_balance"]
  const systems = requestedSystems.map(normalizeCompareSystem)

  const runners: Record<CompareSystem, () => Promise<CompareRunResult>> = {
    classic: () =>
      params.runCurrent({
        scenario: params.scenario,
        prompt,
        turns,
        baseUrl: params.baseUrl,
        toolLoopVariant,
      }),
    tool_loop: () =>
      params.runAgent({
        scenario: params.scenario,
        prompt,
        turns,
        baseUrl: params.baseUrl,
        toolLoopVariant,
      }),
    agent_v2: () => {
      if (!params.runAgentV2) {
        throw new Error("AgentV2 runner is not configured.")
      }
      return params.runAgentV2({
        scenario: params.scenario,
        prompt,
        turns,
        baseUrl: params.baseUrl,
        toolLoopVariant,
      })
    },
    agent_v2_care_balance: () => {
      if (!params.runAgentV2CareBalance) {
        throw new Error("AgentV2 CareBalance runner is not configured.")
      }
      return params.runAgentV2CareBalance({
        scenario: params.scenario,
        prompt,
        turns,
        baseUrl: params.baseUrl,
        toolLoopVariant,
      })
    },
  }

  const results = await Promise.all(
    systems.map((system) =>
      runners[system]()
        .then((result) => normalizeCompareRunResult(result))
        .catch((error) => normalizeFailure(system, error)),
    ),
  )

  const orderedResults =
    params.blinded && results.length === 2 && shouldSwapBlindedResults(turns)
      ? [results[1], results[0]]
      : results
  const labeledResults = orderedResults.map((entry, index) =>
    normalizeCompareRunResult(
      entry,
      params.blinded
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
    systems: request.systems,
    runCurrent: ({ scenario, prompt, turns, baseUrl }) =>
      runClassicAgentComparison({
        scenario,
        prompt: prompt ?? turns?.at(-1) ?? scenario.message,
        turns,
        baseUrl,
      }),
    runAgent: runToolLoopComparison,
    runAgentV2: runAgentV2Comparison,
    runAgentV2CareBalance: (params) =>
      runAgentV2Comparison({ ...params, includeCareBalanceContext: true }),
  })
}
