import { existsSync, readFileSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import {
  runAgentV2Comparison,
  summarizeAgentV2TraceTiming,
  type AgentV2TraceTimingSummary,
} from "@/lib/agent-v2/compare/run-agent-v2"
import type { AgentCompareScenario, CompareRunResult } from "@/lib/agent/compare/types"
import type { AgentV2CompareTrace } from "@/lib/agent/compare/types"
import type { HairProfileOverrides } from "../eval-chat/types"

type GuidanceMigrationRegressionCase = {
  id: string
  user_label_hint?: string
  prompt?: string
  turns?: string[]
  profile_context_key?: string
  safety_mode?: "normal" | "restricted" | "hard_short_circuit"
  expected_tools: string[]
  expected_guidance: string[]
  expected_answer_mode?: string
  expected_gate_status?: string
  expect_no_products?: boolean
  expect_no_routine_mutation?: boolean
  must_not_contain: string[]
  quality_criteria: string[]
}

type GuidanceMigrationRegressionFixture = {
  default_profile_context_key: string
  incomplete_profile_context_keys?: string[]
  profiles: Record<string, HairProfileOverrides>
  cases: GuidanceMigrationRegressionCase[]
  edge_cases?: GuidanceMigrationRegressionCase[]
}

type GuidanceMigrationReportCase = {
  id: string
  user_label_hint: string | null
  prompt_or_turns: string[]
  heuristic_result: "pass" | "review" | "fail"
  runtime_error: string | null
  final_response: string
  output_summary: string
  actual_tools: string[]
  expected_tools: string[]
  missing_tools: string[]
  actual_guidance: string[]
  expected_guidance: string[]
  missing_guidance: string[]
  actual_answer_modes: string[]
  actual_gate_statuses: string[]
  expectation_failures: string[]
  validation_errors: string[]
  validation_warnings: string[]
  forbidden_text_hits: string[]
  quality_criteria: string[]
  latency_ms: number | null
  timing: {
    total_latency_ms: number | null
  } & AgentV2TraceTimingSummary
}

type GuidanceMigrationReport = {
  generated_at: string
  fixture_path: string
  summary: {
    total: number
    pass: number
    review: number
    fail: number
  }
  cases: GuidanceMigrationReportCase[]
}

const FIXTURE_PATH = "data/agent-v2/evals/guidance-migration-regression.json"
const ALLOW_FAILURES_FLAG = "--allow-failures"
const DEFAULT_ROUTINE_INVENTORY = [
  { category: "shampoo", product_name: "Mildes Shampoo", frequency_range: "3_4x" },
  { category: "conditioner", product_name: "Leichte Spuelung", frequency_range: "3_4x" },
] as const

function loadLocalEnv() {
  const envPath = ".env.local"
  if (!existsSync(envPath)) return

  for (const line of readFileSync(envPath, "utf8").replace(/\r/g, "").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim().replace(/^"(.*)"$/, "$1")
    }
  }
}

function normalizeTurns(entry: GuidanceMigrationRegressionCase): string[] {
  const turns = entry.turns?.map((turn) => turn.trim()).filter(Boolean) ?? []
  if (turns.length > 0) return turns

  const prompt = entry.prompt?.trim()
  return prompt ? [prompt] : []
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort()
}

function collectTraces(result: CompareRunResult): AgentV2CompareTrace[] {
  const turnTraces =
    result.turns?.flatMap((turn) => (turn.agent_v2_trace ? [turn.agent_v2_trace] : [])) ?? []
  const traces =
    turnTraces.length > 0 ? turnTraces : result.agent_v2_trace ? [result.agent_v2_trace] : []

  return traces.length > 0 ? traces : []
}

function collectTools(traces: readonly AgentV2CompareTrace[]): string[] {
  return unique(traces.flatMap((trace) => trace.tool_calls.map((call) => call.name)))
}

function collectGuidance(traces: readonly AgentV2CompareTrace[]): string[] {
  return unique(traces.flatMap((trace) => trace.loaded_guidance_package_ids))
}

function collectAnswerModes(traces: readonly AgentV2CompareTrace[]): string[] {
  return unique(traces.flatMap((trace) => (trace.answer_mode ? [trace.answer_mode] : [])))
}

function collectGateStatuses(traces: readonly AgentV2CompareTrace[]): string[] {
  return unique(
    traces.flatMap((trace) => {
      const turnGate = (trace as { turn_gate?: unknown }).turn_gate
      if (!turnGate || typeof turnGate !== "object" || Array.isArray(turnGate)) return []
      const authorized = (turnGate as { authorized?: unknown }).authorized
      if (!authorized || typeof authorized !== "object" || Array.isArray(authorized)) return []
      const gateStatus = (authorized as { gate_status?: unknown }).gate_status
      return typeof gateStatus === "string" ? [gateStatus] : []
    }),
  )
}

function collectFinalProductIds(traces: readonly AgentV2CompareTrace[]): string[] {
  return unique(traces.flatMap((trace) => trace.final_product_ids ?? []))
}

function collectValidationIds(
  traces: readonly AgentV2CompareTrace[],
  field: "validation_errors" | "validation_warnings",
): string[] {
  return unique(
    traces.flatMap((trace) =>
      trace[field].map((error) => error.validator_id || error.message || "validation_issue"),
    ),
  )
}

function collectForbiddenHits(answer: string, forbidden: readonly string[]): string[] {
  const normalizedAnswer = answer.toLocaleLowerCase("de-DE")
  return forbidden.filter((text) => {
    const normalizedText = text.toLocaleLowerCase("de-DE")
    let start = normalizedAnswer.indexOf(normalizedText)

    while (start >= 0) {
      const end = start + normalizedText.length
      if (!isNegatedForbiddenPhrase(normalizedAnswer, start, end)) return true
      start = normalizedAnswer.indexOf(normalizedText, end)
    }

    return false
  })
}

function isNegatedForbiddenPhrase(answer: string, start: number, end: number): boolean {
  const before = answer.slice(Math.max(0, start - 24), start)
  const after = answer.slice(end, Math.min(answer.length, end + 24))

  return (
    /\b(?:nicht|kein|keine|keinen|ohne)\b/.test(before) ||
    /\b(?:nicht|kein|keine|keinen)\b/.test(after)
  )
}

function classifyResult(params: {
  runtimeError: string | null
  validationErrors: readonly string[]
  missingTools: readonly string[]
  missingGuidance: readonly string[]
  forbiddenTextHits: readonly string[]
  expectationFailures: readonly string[]
  qualityCriteria: readonly string[]
}): GuidanceMigrationReportCase["heuristic_result"] {
  if (
    params.runtimeError ||
    params.validationErrors.length > 0 ||
    params.missingTools.length > 0 ||
    params.missingGuidance.length > 0 ||
    params.forbiddenTextHits.length > 0 ||
    params.expectationFailures.length > 0
  ) {
    return "fail"
  }

  return params.qualityCriteria.length > 0 ? "review" : "pass"
}

function parseFixture(rawFixture: string): GuidanceMigrationRegressionFixture {
  const parsed = JSON.parse(rawFixture) as
    | GuidanceMigrationRegressionFixture
    | GuidanceMigrationRegressionCase[]
  if (!Array.isArray(parsed)) return parsed

  return {
    default_profile_context_key: "fine_wavy_colored_dry_frizz",
    profiles: {
      fine_wavy_colored_dry_frizz: {
        hair_texture: "wavy",
        thickness: "fine",
        density: "medium",
        scalp_type: "balanced",
        scalp_condition: null,
        concerns: ["dryness", "frizz"],
        goals: ["less_frizz", "shine", "moisture"],
        chemical_treatment: ["colored"],
        wash_frequency: "every_2_3_days",
        drying_method: "air_dry",
        heat_styling: "rarely",
        protein_moisture_balance: "stretches_bounces",
        onboarding_completed: true,
      },
    },
    cases: parsed,
    edge_cases: [],
  }
}

function selectFixtureCases(
  fixture: GuidanceMigrationRegressionFixture,
): GuidanceMigrationRegressionCase[] {
  const cases = process.argv.includes("--include-edge-cases")
    ? [...fixture.cases, ...(fixture.edge_cases ?? [])]
    : fixture.cases
  const selectedCases = parseSelectedCaseIds(process.argv)

  if (selectedCases.length === 0) return cases

  const validIds = new Set(cases.map((entry) => entry.id))
  const unknownIds = selectedCases.filter((id) => !validIds.has(id))
  if (unknownIds.length > 0) {
    throw new Error(
      `Unknown --case id(s): ${unknownIds.join(", ")}. Valid ids: ${cases
        .map((entry) => entry.id)
        .join(", ")}`,
    )
  }

  const selected = new Set(selectedCases)
  return cases.filter((entry) => selected.has(entry.id))
}

function parseSelectedCaseIds(argv: readonly string[]): string[] {
  const selectedCases: string[] = []

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--case") {
      const value = argv[index + 1]
      if (!value || value.startsWith("--")) {
        throw new Error("--case requires a non-empty case id.")
      }
      selectedCases.push(value)
      index += 1
      continue
    }

    if (arg.startsWith("--case=")) {
      const value = arg.slice("--case=".length)
      if (!value) {
        throw new Error("--case requires a non-empty case id.")
      }
      selectedCases.push(value)
    }
  }

  return selectedCases
}

export function shouldFailGuidanceRegressionProcess(params: {
  failCount: number
  argv?: readonly string[]
}): boolean {
  return params.failCount > 0 && !(params.argv ?? process.argv).includes(ALLOW_FAILURES_FLAG)
}

function resolveProfileContext(
  fixture: GuidanceMigrationRegressionFixture,
  entry: GuidanceMigrationRegressionCase,
): HairProfileOverrides {
  const profileKey = entry.profile_context_key ?? fixture.default_profile_context_key
  const profile = fixture.profiles[profileKey]
  if (!profile) {
    throw new Error(`Regression case ${entry.id} references unknown profile context: ${profileKey}`)
  }

  return profile
}

function buildScenario(
  fixture: GuidanceMigrationRegressionFixture,
  entry: GuidanceMigrationRegressionCase,
  turns: readonly string[],
): AgentCompareScenario {
  return {
    id: `agent-v2-guidance-${entry.id}`,
    label: entry.user_label_hint ?? "AgentV2 Guidance Regression",
    message: turns.at(-1) ?? "",
    hair_profile: resolveProfileContext(fixture, entry),
    routine_inventory: [...DEFAULT_ROUTINE_INVENTORY],
  }
}

function summarize(answer: string): string {
  const compact = answer.replace(/\s+/g, " ").trim()
  return compact.length > 260 ? `${compact.slice(0, 257)}...` : compact
}

async function runCase(
  fixture: GuidanceMigrationRegressionFixture,
  entry: GuidanceMigrationRegressionCase,
): Promise<GuidanceMigrationReportCase> {
  const turns = normalizeTurns(entry)
  const expectedTools = entry.expected_tools ?? []
  const expectedGuidance = entry.expected_guidance ?? []
  const qualityCriteria = entry.quality_criteria ?? []

  let runtimeError: string | null = null
  let finalResponse = ""
  let latencyMs: number | null = null
  let actualTools: string[] = []
  let actualGuidance: string[] = []
  let actualAnswerModes: string[] = []
  let actualGateStatuses: string[] = []
  let actualFinalProductIds: string[] = []
  let validationErrors: string[] = []
  let validationWarnings: string[] = []
  let timingSummary: AgentV2TraceTimingSummary = summarizeAgentV2TraceTiming([])

  try {
    if (turns.length === 0) throw new Error("Regression case has no prompt or turns.")

    const result = await runAgentV2Comparison({
      scenario: buildScenario(fixture, entry, turns),
      prompt: turns.length === 1 ? turns[0] : undefined,
      turns: turns.length > 1 ? [...turns] : undefined,
    })
    const traces = collectTraces(result)

    finalResponse = result.answer
    latencyMs = result.latency_ms
    actualTools = collectTools(traces)
    actualGuidance = collectGuidance(traces)
    actualAnswerModes = collectAnswerModes(traces)
    actualGateStatuses = collectGateStatuses(traces)
    actualFinalProductIds = collectFinalProductIds(traces)
    validationErrors = collectValidationIds(traces, "validation_errors")
    validationWarnings = collectValidationIds(traces, "validation_warnings")
    timingSummary = summarizeAgentV2TraceTiming(traces)
  } catch (error) {
    runtimeError = error instanceof Error ? error.message : String(error)
  }

  const missingTools = expectedTools.filter((tool) => !actualTools.includes(tool))
  const missingGuidance = expectedGuidance.filter((id) => !actualGuidance.includes(id))
  const forbiddenTextHits = collectForbiddenHits(finalResponse, entry.must_not_contain ?? [])
  const expectationFailures = [
    entry.expected_answer_mode && !actualAnswerModes.includes(entry.expected_answer_mode)
      ? `missing_answer_mode:${entry.expected_answer_mode}`
      : null,
    entry.expected_gate_status && !actualGateStatuses.includes(entry.expected_gate_status)
      ? `missing_gate_status:${entry.expected_gate_status}`
      : null,
    entry.expect_no_products === true && actualFinalProductIds.length > 0
      ? `unexpected_products:${actualFinalProductIds.join(",")}`
      : null,
    entry.expect_no_products === true && actualTools.includes("select_products")
      ? "unexpected_product_tool:select_products"
      : null,
    entry.expect_no_routine_mutation === true && actualTools.includes("build_or_fix_routine")
      ? "unexpected_routine_mutation_tool"
      : null,
  ].filter((value): value is string => Boolean(value))
  const heuristicResult = classifyResult({
    runtimeError,
    validationErrors,
    missingTools,
    missingGuidance,
    forbiddenTextHits,
    expectationFailures,
    qualityCriteria,
  })

  return {
    id: entry.id,
    user_label_hint: entry.user_label_hint ?? null,
    prompt_or_turns: turns,
    heuristic_result: heuristicResult,
    runtime_error: runtimeError,
    final_response: finalResponse,
    output_summary: summarize(finalResponse || runtimeError || "No output."),
    actual_tools: actualTools,
    expected_tools: expectedTools,
    missing_tools: missingTools,
    actual_guidance: actualGuidance,
    expected_guidance: expectedGuidance,
    missing_guidance: missingGuidance,
    actual_answer_modes: actualAnswerModes,
    actual_gate_statuses: actualGateStatuses,
    expectation_failures: expectationFailures,
    validation_errors: validationErrors,
    validation_warnings: validationWarnings,
    forbidden_text_hits: forbiddenTextHits,
    quality_criteria: qualityCriteria,
    latency_ms: latencyMs,
    timing: {
      total_latency_ms: latencyMs,
      ...timingSummary,
    },
  }
}

function renderMarkdown(report: GuidanceMigrationReport): string {
  const slowestCases = [...report.cases]
    .filter((item) => item.timing.total_latency_ms !== null)
    .sort(
      (left, right) => (right.timing.total_latency_ms ?? 0) - (left.timing.total_latency_ms ?? 0),
    )
    .slice(0, 5)
  const lines = [
    "# AgentV2 Guidance Regression Report",
    "",
    `Generated: ${report.generated_at}`,
    `Fixture: \`${report.fixture_path}\``,
    "",
    "## Summary",
    "",
    `- Total: ${report.summary.total}`,
    `- Pass: ${report.summary.pass}`,
    `- Review: ${report.summary.review}`,
    `- Fail: ${report.summary.fail}`,
    "",
    "## Slowest Cases",
    "",
    ...(slowestCases.length > 0
      ? slowestCases.map(
          (item) =>
            `- ${item.id}: ${formatLatency(item.timing.total_latency_ms)} total; model ${formatLatency(
              item.timing.model_latency_ms,
            )}; tools ${formatLatency(item.timing.tool_latency_ms)}`,
        )
      : ["- none"]),
    "",
  ]

  for (const item of report.cases) {
    lines.push(
      `## ${item.id}`,
      "",
      `- Result: ${item.heuristic_result}`,
      `- User hint: ${item.user_label_hint ?? "none"}`,
      `- Latency: ${formatLatency(item.timing.total_latency_ms)} total; model ${formatLatency(
        item.timing.model_latency_ms,
      )}; tools ${formatLatency(item.timing.tool_latency_ms)}; observed trace ${formatLatency(
        item.timing.observed_trace_latency_ms,
      )}`,
      `- Timing shape: ${item.timing.model_steps} model step(s), ${item.timing.tool_calls} tool call(s); slowest model ${formatLatency(
        item.timing.slowest_model_step_ms,
      )}; slowest tool ${formatLatency(item.timing.slowest_tool_call_ms)}`,
      `- Output summary: ${item.output_summary || "none"}`,
      `- Expected tools: ${item.expected_tools.join(", ") || "none"}`,
      `- Actual tools: ${item.actual_tools.join(", ") || "none"}`,
      `- Missing tools: ${item.missing_tools.join(", ") || "none"}`,
      `- Expected guidance: ${item.expected_guidance.join(", ") || "none"}`,
      `- Actual guidance: ${item.actual_guidance.join(", ") || "none"}`,
      `- Missing guidance: ${item.missing_guidance.join(", ") || "none"}`,
      `- Actual answer modes: ${item.actual_answer_modes.join(", ") || "none"}`,
      `- Actual gate statuses: ${item.actual_gate_statuses.join(", ") || "none"}`,
      `- Expectation failures: ${item.expectation_failures.join(", ") || "none"}`,
      `- Validation errors: ${item.validation_errors.join(", ") || "none"}`,
      `- Validation warnings: ${item.validation_warnings.join(", ") || "none"}`,
      `- Forbidden text hits: ${item.forbidden_text_hits.join(", ") || "none"}`,
      `- Runtime error: ${item.runtime_error ?? "none"}`,
      "",
      "Prompt / Turns:",
      "",
      ...item.prompt_or_turns.map((turn, index) => `${index + 1}. ${turn}`),
      "",
      "Quality criteria:",
      "",
      ...item.quality_criteria.map((criterion) => `- ${criterion}`),
      "",
      "Final response:",
      "",
      item.final_response || "_No final response._",
      "",
    )
  }

  return `${lines.join("\n")}\n`
}

function formatLatency(value: number | null): string {
  return value === null ? "n/a" : `${value} ms`
}

async function main() {
  loadLocalEnv()

  const rawFixture = await readFile(FIXTURE_PATH, "utf8")
  const fixture = parseFixture(rawFixture)
  const selectedFixtureCases = selectFixtureCases(fixture)
  if (
    selectedFixtureCases.some((entry) => entry.expected_gate_status) &&
    process.env.AGENT_V2_TURN_GATE_ENABLED === undefined
  ) {
    process.env.AGENT_V2_TURN_GATE_ENABLED = "true"
  }
  const generatedAt = new Date().toISOString()
  const cases: GuidanceMigrationReportCase[] = []

  for (const entry of selectedFixtureCases) {
    process.stdout.write(`Running ${entry.id}...\n`)
    cases.push(await runCase(fixture, entry))
  }

  const report: GuidanceMigrationReport = {
    generated_at: generatedAt,
    fixture_path: FIXTURE_PATH,
    summary: {
      total: cases.length,
      pass: cases.filter((item) => item.heuristic_result === "pass").length,
      review: cases.filter((item) => item.heuristic_result === "review").length,
      fail: cases.filter((item) => item.heuristic_result === "fail").length,
    },
    cases,
  }
  const stamp = generatedAt.replace(/[:.]/g, "-")
  const jsonPath = `tmp/agent-v2-guidance-regression-${stamp}.json`
  const markdownPath = `tmp/agent-v2-guidance-regression-${stamp}.md`

  await mkdir(dirname(jsonPath), { recursive: true })
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(markdownPath, renderMarkdown(report))

  process.stdout.write(`\nWrote ${jsonPath}\n`)
  process.stdout.write(`Wrote ${markdownPath}\n`)
  process.stdout.write(
    `Summary: ${report.summary.pass} pass, ${report.summary.review} review, ${report.summary.fail} fail\n`,
  )

  if (shouldFailGuidanceRegressionProcess({ failCount: report.summary.fail })) {
    process.stdout.write(
      `Regression report contains failures; exiting nonzero. Re-run with ${ALLOW_FAILURES_FLAG} only for exploratory reporting.\n`,
    )
    process.exitCode = 1
  }
}

if (process.argv[1]?.endsWith("run-guidance-regression.ts")) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
