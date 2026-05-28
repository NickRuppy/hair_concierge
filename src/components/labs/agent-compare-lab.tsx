"use client"

import type {
  AgentCompareAnalysisSnapshot,
  AgentCompareCareBalanceTrace,
  AgentCompareJudgmentDraft,
  AgentCompareJudgmentRecord,
  AgentCompareResponse,
  AgentCompareTurnResult,
  AgentCompareToolLoopVariant,
  AgentCompareUserOption,
  AgentCompareUserSnapshot,
  CanonicalCompareSystem,
  CompareRunResult,
  CompareSystemInput,
} from "@/lib/agent/compare/types"
import {
  AGENT_COMPARE_MULTI_TURN_CHAINS,
  AGENT_COMPARE_PROMPT_TEMPLATES,
} from "@/lib/agent/compare/prompt-packs"
import {
  AGENT_COMPARE_TOOL_LOOP_VARIANT_OPTIONS,
  DEFAULT_AGENT_COMPARE_TOOL_LOOP_VARIANT,
} from "@/lib/agent/compare/tool-loop-variants"
import type { KeyboardEvent } from "react"
import { useEffect, useRef, useState, useTransition } from "react"

type JudgmentHistoryEntry = AgentCompareJudgmentDraft & {
  userId: string
  userLabel: string
  prompt: string
  createdAt: string
}

type BootstrapResponse = {
  users: AgentCompareUserOption[]
  selectedUser: AgentCompareUserSnapshot | null
}

type AgentCompareRunMode = "agent_v2_only" | "agent_v2_vs_care_balance" | "classic_vs_tool_loop"

const RUN_MODE_OPTIONS: Array<{ value: AgentCompareRunMode; label: string }> = [
  { value: "agent_v2_only", label: "Nur AgentV2" },
  { value: "agent_v2_vs_care_balance", label: "AgentV2 vs AgentV2 + CareBalance" },
  { value: "classic_vs_tool_loop", label: "Classic vs Legacy Tool-Loop" },
]

function resolveCompareSystemsForMode(mode: AgentCompareRunMode): CompareSystemInput[] {
  if (mode === "agent_v2_only") return ["agent_v2"]
  if (mode === "agent_v2_vs_care_balance") return ["agent_v2", "agent_v2_care_balance"]
  return ["classic", "tool_loop"]
}

function formatCompareSystemLabel(system: CompareSystemInput): string {
  if (system === "classic" || system === "current") return "Classic"
  if (system === "tool_loop" || system === "agent") return "Legacy Tool-Loop"
  if (system === "agent_v2_care_balance") return "AgentV2 GPT-5.4-mini + CareBalance"
  return "AgentV2 GPT-5.4-mini"
}

const REASON_OPTIONS: Array<AgentCompareJudgmentDraft["primary_reason"]> = [
  "natuerlicher",
  "nuetzlicher",
  "vorsichtiger",
  "personalisierter",
  "anderes",
]

const FAILURE_BUCKET_OPTIONS: Array<NonNullable<AgentCompareJudgmentDraft["failure_bucket"]>> = [
  "none",
  "semantic_state_conflict",
  "tool_not_called",
  "unsupported_claim",
  "invented_product",
  "latency",
  "other",
]

function TraceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm leading-6 text-foreground">{value}</p>
    </div>
  )
}

function formatTracePrice(price: number, currency: string | null): string {
  return `${price.toFixed(2).replace(".", ",")} ${currency ?? "EUR"}`
}

function ProductTracePanel({ result }: { result: CompareRunResult }) {
  const trace = result.product_trace
  if (!trace) return null
  const careBalanceDisplay = trace.care_balance_context
    ? buildCareBalanceTraceDisplayData(trace.care_balance_context)
    : null

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="type-label text-muted-foreground">Produktentscheidung</p>
        <span className="rounded-full border bg-background px-2 py-0.5 text-xs text-foreground">
          {trace.decision}
        </span>
        {trace.category ? (
          <span className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
            {trace.category}
          </span>
        ) : null}
      </div>

      {trace.profile_basis.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Profilbasis</p>
          <ul className="space-y-1 text-sm text-foreground">
            {trace.profile_basis.map((basis) => (
              <li key={basis}>{basis}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Kategorie-Logik</p>
        <p className="text-sm leading-6 text-foreground">{trace.category_guidance}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <TraceRow label="Product policy" value={trace.product_response_policy ?? "none"} />
        <TraceRow label="Policy reason" value={trace.policy_reason ?? "none"} />
      </div>

      {trace.missing_info.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Fehlende Blocker</p>
          <ul className="space-y-1 text-sm text-foreground">
            {trace.missing_info.map((item) => (
              <li key={item.key}>
                {item.label}: {item.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {trace.unsupported_requested_signals.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Nicht belegte Anfrage</p>
          <ul className="space-y-1 text-sm text-foreground">
            {trace.unsupported_requested_signals.map((signal) => (
              <li key={`${signal.field}-${signal.value}-${signal.reason}`}>
                {signal.field}={signal.value}: {signal.user_message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {careBalanceDisplay ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">CareBalance</p>
          {careBalanceDisplay.comparison ? (
            <p className="text-xs text-muted-foreground">{careBalanceDisplay.comparison}</p>
          ) : null}
          {careBalanceDisplay.rows.length > 0 ? (
            <ul className="space-y-1 text-xs leading-5 text-foreground">
              {careBalanceDisplay.rows.map((row) => (
                <li key={row} className="rounded-md border bg-background p-2">
                  {row}
                </li>
              ))}
            </ul>
          ) : null}
          {careBalanceDisplay.currentTurnFacts.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Current-Turn: {careBalanceDisplay.currentTurnFacts.join(" · ")}
            </p>
          ) : null}
          {careBalanceDisplay.conflicts.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Konflikte: {careBalanceDisplay.conflicts.join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {trace.products.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Tool-Produkte</p>
          <ul className="space-y-2 text-sm text-foreground">
            {trace.products.map((product) => (
              <li key={product.product_id} className="rounded-md border bg-background p-2">
                <div className="font-medium">
                  {product.rank}. {product.name}
                  {product.brand ? (
                    <span className="font-normal text-muted-foreground"> · {product.brand}</span>
                  ) : null}
                  {typeof product.price_eur === "number" ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {formatTracePrice(product.price_eur, product.currency)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-muted-foreground">{product.fit_reason}</p>
                {product.caveat ? (
                  <p className="mt-1 text-muted-foreground">Caveat: {product.caveat}</p>
                ) : null}
                {product.supported_claims.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sichere Angaben:{" "}
                    {product.supported_claims.map((claim) => claim.label).join(" · ")}
                  </p>
                ) : null}
                {product.unsupported_requested_signals.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Keine sichere Angabe:{" "}
                    {product.unsupported_requested_signals
                      .map((signal) => `${signal.field}=${signal.value}`)
                      .join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function RouteTracePanel({ result }: { result: CompareRunResult }) {
  const trace = result.route_trace
  if (!trace) return null

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="type-label text-muted-foreground">Route</p>
        <span className="rounded-full border bg-background px-2 py-0.5 text-xs text-foreground">
          {trace.user_job}
        </span>
        {trace.product_category ? (
          <span className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
            {trace.product_category}
          </span>
        ) : null}
        <span className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
          {Math.round(trace.confidence * 100)}%
        </span>
      </div>

      <div className="grid gap-3 text-sm md:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Playbook</p>
          <p className="text-foreground">{trace.required_playbook_id ?? "none"}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Toolplan</p>
          <p className="text-foreground">
            {trace.tool_plan.length > 0 ? trace.tool_plan.join(" -> ") : "kein Tool"}
          </p>
        </div>
      </div>

      {trace.guidance_ids.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Guidance</p>
          <p className="text-sm leading-6 text-foreground">{trace.guidance_ids.join(", ")}</p>
        </div>
      ) : null}

      {trace.concerns.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Concerns</p>
          <p className="text-sm text-foreground">{trace.concerns.join(", ")}</p>
        </div>
      ) : null}

      {trace.active_profile_signals.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Aktive Signale</p>
          <p className="text-sm text-foreground">
            {trace.active_profile_signals
              .map((signal) => `${signal.field}=${signal.value} (${signal.selection_effect})`)
              .join(", ")}
          </p>
        </div>
      ) : null}

      {trace.validation_warnings.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Warnings</p>
          <ul className="space-y-1 text-sm text-foreground">
            {trace.validation_warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function formatTraceValue(value: unknown): string {
  if (value === null || value === undefined) return "keine"
  if (typeof value === "string") return value

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return "Trace konnte nicht formatiert werden."
  }
}

function getTraceArrayLength(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object") return null
  const maybeArray = (value as Record<string, unknown>)[key]
  return Array.isArray(maybeArray) ? maybeArray.length : null
}

function normalizeCompareSystemForMetrics(system: CompareSystemInput): CanonicalCompareSystem {
  if (system === "current") return "classic"
  if (system === "agent") return "tool_loop"
  return system
}

function getTraceMetricForSystem(
  result: CompareRunResult,
  system: CanonicalCompareSystem,
  key: string,
): number | null {
  if (system === "agent_v2" || system === "agent_v2_care_balance") {
    return getTraceArrayLength(result.agent_v2_trace, key)
  }

  if (system === "tool_loop") {
    return getTraceArrayLength(result.tool_loop_trace, key)
  }

  return null
}

export function buildAgentV2TraceDisplayData(
  trace: NonNullable<CompareRunResult["agent_v2_trace"]>,
): {
  interpretationSummary: string | null
  warnings: string[]
  validationErrors: string[]
} {
  return {
    interpretationSummary: trace.request_interpretation_summary ?? null,
    warnings: (trace.validation_warnings ?? []).map((warning) => warning.message),
    validationErrors: trace.validation_errors
      .filter((error) => error.severity !== "warn")
      .map((error) => error.validator_id),
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function getNestedRecord(value: unknown, key: string): Record<string, unknown> | null {
  return asRecord(asRecord(value)?.[key])
}

function formatCareBalanceTraceScalar(value: unknown): string {
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return "unformattable"
  }
}

function getComparisonDifferenceCount(trace: AgentCompareCareBalanceTrace): number | null {
  const comparison = asRecord(trace.comparison)
  if (!comparison) return null

  const differences = comparison.differences
  return Array.isArray(differences) ? differences.length : 0
}

export function buildCareBalanceTraceDisplayData(trace: AgentCompareCareBalanceTrace): {
  rows: string[]
  comparison: string | null
  currentTurnFacts: string[]
  conflicts: string[]
} {
  const differenceCount = getComparisonDifferenceCount(trace)

  return {
    rows: trace.rows.map((row) => {
      const reasons = row.reason_codes.length > 0 ? row.reason_codes.join(",") : "none"
      const hints =
        row.selection_hint_codes.length > 0 ? row.selection_hint_codes.join(",") : "none"

      return `${row.category}: ${row.action} | status=${row.status} | current=${row.current_frequency ?? "none"} | reasons=${reasons} | hints=${hints}`
    }),
    comparison: differenceCount === null ? null : `old_vs_new: ${differenceCount} Unterschiede`,
    currentTurnFacts: trace.current_turn_facts.map(
      (fact) => `${fact.kind}: ${fact.evidence_quote}`,
    ),
    conflicts: trace.conflicts.map(
      (conflict) =>
        `${conflict.field_path}: saved=${formatCareBalanceTraceScalar(
          conflict.saved_value,
        )} -> current=${formatCareBalanceTraceScalar(conflict.current_turn_value)} (${
          conflict.evidence_quote
        })`,
    ),
  }
}

function buildCareBalanceAnalysisLines(
  trace: AgentCompareCareBalanceTrace | null | undefined,
): string[] {
  if (!trace) return []

  const display = buildCareBalanceTraceDisplayData(trace)

  return [
    `rows=${display.rows.length}`,
    ...display.rows,
    ...(display.comparison ? [display.comparison] : []),
    ...display.currentTurnFacts.map((fact) => `fact: ${fact}`),
    ...display.conflicts.map((conflict) => `conflict: ${conflict}`),
  ]
}

function getResultCareBalanceTrace(
  result: CompareRunResult | AgentCompareTurnResult,
): AgentCompareCareBalanceTrace | null {
  return result.care_balance_trace ?? result.product_trace?.care_balance_context ?? null
}

function CareBalanceTracePanel({ result }: { result: CompareRunResult }) {
  const trace = getResultCareBalanceTrace(result)
  if (!trace || result.product_trace?.care_balance_context) return null

  const display = buildCareBalanceTraceDisplayData(trace)

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <p className="type-label text-muted-foreground">CareBalance</p>
      {display.comparison ? (
        <p className="text-xs text-muted-foreground">{display.comparison}</p>
      ) : null}
      {display.rows.length > 0 ? (
        <ul className="space-y-1 text-xs leading-5 text-foreground">
          {display.rows.map((row) => (
            <li key={row} className="rounded-md border bg-background p-2">
              {row}
            </li>
          ))}
        </ul>
      ) : null}
      {display.currentTurnFacts.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Current-Turn: {display.currentTurnFacts.join(" · ")}
        </p>
      ) : null}
      {display.conflicts.length > 0 ? (
        <p className="text-xs text-muted-foreground">Konflikte: {display.conflicts.join(" · ")}</p>
      ) : null}
    </div>
  )
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)))
}

function extractToolCallNames(trace: unknown): string[] {
  const root = asRecord(trace)
  const toolCalls = root?.tool_calls
  if (!Array.isArray(toolCalls)) return []

  return uniqueStrings(
    toolCalls.flatMap((call) => {
      const record = asRecord(call)
      const name = record?.name ?? record?.tool_name ?? record?.tool
      return typeof name === "string" ? [name] : []
    }),
  )
}

function extractResultToolCallNames(result: CompareRunResult | AgentCompareTurnResult): string[] {
  return uniqueStrings([
    ...extractToolCallNames(result.tool_loop_trace),
    ...extractToolCallNames(result.agent_v2_trace),
  ])
}

function extractStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : []
}

function extractGuidanceIdsFromSummary(summary: string): string[] {
  const match = summary.match(/guidance_ids=([^;]+)/)
  if (!match) return []

  return match[1].split(",").map((id) => id.trim())
}

function extractGuidanceIds(result: CompareRunResult | AgentCompareTurnResult): string[] {
  const toolLoopTrace = asRecord(result.tool_loop_trace)
  const agentV2Trace = asRecord(result.agent_v2_trace)
  const advisorGuidance = asRecord(toolLoopTrace?.advisor_guidance)
  const consultationBrief = asRecord(toolLoopTrace?.consultation_brief)
  const candidateGuidance = consultationBrief?.candidate_guidance
  const candidateIds = Array.isArray(candidateGuidance)
    ? candidateGuidance.flatMap((entry) => {
        const id = asRecord(entry)?.id
        return typeof id === "string" ? [id] : []
      })
    : []

  const agentV2ToolCalls = agentV2Trace?.tool_calls
  const agentV2ToolOutputIds = Array.isArray(agentV2ToolCalls)
    ? agentV2ToolCalls.flatMap((call) => {
        const summary = asRecord(call)?.output_summary
        return typeof summary === "string" ? extractGuidanceIdsFromSummary(summary) : []
      })
    : []

  const debugIds =
    result.debug_lines?.flatMap((line: string) => {
      const [, rawIds] = line.split("advisor_guidance:")
      return rawIds ? rawIds.split(",").map((id: string) => id.trim()) : []
    }) ?? []

  return uniqueStrings([
    ...extractStringArray(result.route_trace?.guidance_ids),
    ...extractStringArray(advisorGuidance?.loaded_guidance_ids),
    ...candidateIds,
    ...extractStringArray(agentV2Trace?.loaded_guidance_ids),
    ...extractStringArray(agentV2Trace?.loaded_guidance_package_ids),
    ...agentV2ToolOutputIds,
    ...debugIds,
  ])
}

function extractStateSummary(value: unknown): string[] {
  const root = asRecord(value)
  if (!root) return []

  const nextState = getNestedRecord(root, "next_state") ?? getNestedRecord(root, "state")
  const source = nextState ?? root
  const keys = [
    "active_topic",
    "routine_layer",
    "last_product_category",
    "last_assistant_action",
    "topic_relation",
    "reason",
  ]

  return keys.flatMap((key) => {
    const value = source[key]
    return typeof value === "string" && value.length > 0 ? [`${key}: ${value}`] : []
  })
}

function buildResultAnalysisSnapshot(params: {
  result: CompareRunResult
  label: string
  includeSystem: boolean
}): AgentCompareAnalysisSnapshot["results"][number] {
  return {
    label: params.label,
    system: params.includeSystem ? params.result.system : params.label,
    latency_ms: params.result.latency_ms,
    answer_chars: params.result.answer.length,
    debug_lines: params.result.debug_lines,
    tool_calls: extractResultToolCallNames(params.result),
    guidance_ids: extractGuidanceIds(params.result),
    product_policy: params.result.product_trace?.product_response_policy ?? null,
    product_category: params.result.product_trace?.category ?? null,
    care_balance: buildCareBalanceAnalysisLines(getResultCareBalanceTrace(params.result)),
    selected_products: params.result.matched_products.map((product) =>
      product.category ? `${product.name} (${product.category})` : product.name,
    ),
    state_summary: extractStateSummary(params.result.state_transition),
    turns:
      params.result.turns?.map((turn) => ({
        turn: turn.turn,
        answer_chars: turn.answer.length,
        tool_calls: extractResultToolCallNames(turn),
        guidance_ids: extractGuidanceIds(turn),
        product_policy: turn.product_trace?.product_response_policy ?? null,
        care_balance: buildCareBalanceAnalysisLines(getResultCareBalanceTrace(turn)),
        selected_products: turn.matched_products.map((product) =>
          product.category ? `${product.name} (${product.category})` : product.name,
        ),
      })) ?? [],
  }
}

export function buildCompareAnalysisSnapshot(params: {
  result: AgentCompareResponse
  userLabel: string
  includeSystem: boolean
}): AgentCompareAnalysisSnapshot {
  const prompts = params.result.turns ?? [params.result.prompt]

  return {
    setup: {
      mode: prompts.length > 1 ? "multi_turn" : "single_turn",
      turn_count: prompts.length,
      blinded: params.result.blinded === true,
      tool_loop_variant: params.result.toolLoopVariant ?? null,
      user_label: params.userLabel,
    },
    prompts,
    results: params.result.results.map((entry) =>
      buildResultAnalysisSnapshot({
        result: entry,
        label: entry.display_label ?? entry.system,
        includeSystem: params.includeSystem,
      }),
    ),
  }
}

function CompareAnalysisPanel({
  snapshot,
  isHidden,
  onCopy,
  copyLabel,
}: {
  snapshot: AgentCompareAnalysisSnapshot | null
  isHidden: boolean
  onCopy: () => void
  copyLabel: string
}) {
  if (!snapshot) return null

  if (isHidden) {
    return (
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="type-label text-muted-foreground">Analyse-Snapshot</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Nach dem Aufloesen sichtbar, damit die Blindbewertung sauber bleibt.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="type-label text-muted-foreground">Analyse-Snapshot</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Kompakte Spur fuer spaetere Auswertung und Debugging.
          </p>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          {copyLabel}
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {snapshot.results.map((entry) => (
          <div
            key={`${entry.label}-${entry.system}`}
            className="rounded-lg border bg-background p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                {entry.label} · {entry.system}
              </p>
              <span className="text-xs text-muted-foreground">
                {entry.latency_ms ?? "?"} ms · {entry.answer_chars} Zeichen
              </span>
            </div>

            <dl className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
              <div>
                <dt className="font-medium text-foreground">Tools</dt>
                <dd>{entry.tool_calls.length > 0 ? entry.tool_calls.join(" -> ") : "kein Tool"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Guidance</dt>
                <dd>{entry.guidance_ids.length > 0 ? entry.guidance_ids.join(", ") : "keine"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Produktpolitik</dt>
                <dd>{entry.product_policy ?? "keine"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">CareBalance</dt>
                <dd>{entry.care_balance.length > 0 ? entry.care_balance.join(" · ") : "keine"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Produkte</dt>
                <dd>
                  {entry.selected_products.length > 0
                    ? entry.selected_products.join(", ")
                    : "keine"}
                </dd>
              </div>
            </dl>

            {entry.state_summary.length > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                State: {entry.state_summary.join(" · ")}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}

function ToolLoopTracePanel({ result }: { result: CompareRunResult }) {
  if (!result.tool_loop_trace && !result.state_transition) return null

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <p className="type-label text-muted-foreground">Tool-Spur</p>

      {result.tool_loop_trace ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Trace</p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-background p-2 text-xs leading-5 text-foreground">
            {formatTraceValue(result.tool_loop_trace)}
          </pre>
        </div>
      ) : null}

      {result.state_transition ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">State</p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-background p-2 text-xs leading-5 text-foreground">
            {formatTraceValue(result.state_transition)}
          </pre>
        </div>
      ) : null}
    </div>
  )
}

function AgentV2TracePanel({ result }: { result: CompareRunResult }) {
  const trace = result.agent_v2_trace
  if (!trace) return null
  const display = buildAgentV2TraceDisplayData(trace)

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <p className="type-label text-muted-foreground">AgentV2-Spur</p>
      {display.interpretationSummary ? (
        <div className="rounded-md border bg-background p-2 text-sm text-foreground">
          {display.interpretationSummary}
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <TraceRow label="Antwortmodus" value={trace.answer_mode ?? "keiner"} />
        <TraceRow label="Routine-Ebene" value={trace.routine_layer ?? "keine"} />
        <TraceRow
          label="Produkt-IDs"
          value={trace.final_product_ids.length > 0 ? trace.final_product_ids.join(", ") : "keine"}
        />
        <TraceRow
          label="Guidance"
          value={
            trace.loaded_guidance_package_ids.length > 0
              ? trace.loaded_guidance_package_ids.join(", ")
              : "keine"
          }
        />
      </div>
      <TraceRow
        label="Tools"
        value={
          trace.tool_calls.length > 0
            ? trace.tool_calls.map((call) => call.name).join(", ")
            : "keine"
        }
      />
      {display.warnings.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-950">
          <p className="text-xs font-medium uppercase tracking-wide">Warnungen</p>
          <ul className="mt-1 space-y-1">
            {display.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {display.validationErrors.length > 0 ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">
          <p className="text-xs font-medium uppercase tracking-wide">Validierung</p>
          <p className="mt-1">{display.validationErrors.join(", ")}</p>
        </div>
      ) : null}
      {trace.repair_attempts.length > 0 ? (
        <TraceRow label="Reparaturen" value={`${trace.repair_attempts.length}`} />
      ) : null}
      {trace.bounded_repair_kind ? (
        <TraceRow label="Reparaturart" value={trace.bounded_repair_kind} />
      ) : null}
    </div>
  )
}

function ResultCard({
  title,
  result,
  showDiagnostics,
}: {
  title: string
  result: CompareRunResult | null
  showDiagnostics: boolean
}) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
          {result?.latency_ms !== null && result?.latency_ms !== undefined
            ? `${result.latency_ms} ms`
            : "—"}
        </span>
      </div>

      {!result ? (
        <p className="text-sm text-muted-foreground">Noch kein Ergebnis.</p>
      ) : result.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {result.error}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="whitespace-pre-wrap text-sm leading-6 text-foreground">
            {result.answer || "Keine Antwort erhalten."}
          </div>

          {showDiagnostics && result.debug_lines.length > 0 ? (
            <div className="space-y-2">
              <p className="type-label text-muted-foreground">Debug</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {result.debug_lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {showDiagnostics ? <RouteTracePanel result={result} /> : null}

          {showDiagnostics ? <ToolLoopTracePanel result={result} /> : null}

          {showDiagnostics ? <AgentV2TracePanel result={result} /> : null}

          {showDiagnostics ? <CareBalanceTracePanel result={result} /> : null}

          {showDiagnostics ? <ProductTracePanel result={result} /> : null}

          {result.turns && result.turns.length > 1 ? (
            <div className="space-y-2">
              <p className="type-label text-muted-foreground">Mehrturn-Test</p>
              <ol className="space-y-2 text-sm text-foreground">
                {result.turns.map((turn) => (
                  <li
                    key={`${turn.turn}-${turn.prompt}`}
                    className="rounded-md border bg-background p-2"
                  >
                    <p className="font-medium">
                      {turn.turn}. {turn.prompt}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{turn.answer}</p>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {showDiagnostics && result.matched_products.length > 0 ? (
            <div className="space-y-2">
              <p className="type-label text-muted-foreground">Produkte</p>
              <ul className="space-y-1 text-sm text-foreground">
                {result.matched_products.map((product) => (
                  <li key={`${product.name}-${product.category ?? "none"}`}>
                    {product.name}
                    {product.category ? (
                      <span className="text-muted-foreground"> · {product.category}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}

async function fetchBootstrap(userId?: string): Promise<BootstrapResponse> {
  const search = userId ? `?userId=${encodeURIComponent(userId)}` : ""
  const response = await fetch(`/api/labs/agent-compare${search}`)
  const data = (await response.json()) as BootstrapResponse | { error?: string }

  if (!response.ok) {
    throw new Error(
      "error" in data && typeof data.error === "string"
        ? data.error
        : "Compare-Lab konnte nicht geladen werden",
    )
  }

  return data as BootstrapResponse
}

export function canSaveAgentCompareJudgment(params: {
  result: AgentCompareResponse | null
  selectedUser: AgentCompareUserSnapshot | null
  selectedUserOption: AgentCompareUserOption | null
  currentResult: CompareRunResult | null
  agentResult: CompareRunResult | null
}): boolean {
  if (!params.result || !params.selectedUser || !params.selectedUserOption || !params.agentResult) {
    return false
  }

  return (
    params.result.userId === params.selectedUserOption.id &&
    params.selectedUser.user_id === params.selectedUserOption.id
  )
}

export function AgentCompareLab() {
  const [users, setUsers] = useState<AgentCompareUserOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [selectedUser, setSelectedUser] = useState<AgentCompareUserSnapshot | null>(null)
  const [templateId, setTemplateId] = useState("")
  const [prompt, setPrompt] = useState("")
  const [turnsText, setTurnsText] = useState("")
  const [isMultiTurn, setIsMultiTurn] = useState(false)
  const [isBlinded, setIsBlinded] = useState(true)
  const [toolLoopVariant, setToolLoopVariant] = useState<AgentCompareToolLoopVariant>(
    DEFAULT_AGENT_COMPARE_TOOL_LOOP_VARIANT,
  )
  const [runMode, setRunMode] = useState<AgentCompareRunMode>("agent_v2_vs_care_balance")
  const [isRevealed, setIsRevealed] = useState(false)
  const [result, setResult] = useState<AgentCompareResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [winner, setWinner] = useState<AgentCompareJudgmentDraft["winner"]>("tie")
  const [primaryReason, setPrimaryReason] =
    useState<AgentCompareJudgmentDraft["primary_reason"]>("natuerlicher")
  const [note, setNote] = useState("")
  const [failureBucket, setFailureBucket] =
    useState<NonNullable<AgentCompareJudgmentDraft["failure_bucket"]>>("none")
  const [criticalProductClaimFailure, setCriticalProductClaimFailure] = useState(false)
  const [history, setHistory] = useState<JudgmentHistoryEntry[]>([])
  const [analysisCopyLabel, setAnalysisCopyLabel] = useState("Snapshot kopieren")
  const [isPending, startTransition] = useTransition()
  const [isLoadingUser, startLoadingUser] = useTransition()
  const [isSavingJudgment, startSavingJudgment] = useTransition()
  const userLoadRequestId = useRef(0)
  const compareRequestId = useRef(0)

  const resultEntries = result?.results ?? []
  const currentResult = resultEntries.length > 1 ? (resultEntries[0] ?? null) : null
  const agentResult =
    resultEntries.length > 1 ? (resultEntries[1] ?? null) : (resultEntries[0] ?? null)
  const selectedUserOption = users.find((user) => user.id === selectedUserId) ?? null
  const compareSystems = resolveCompareSystemsForMode(runMode)
  const effectiveBlinded = runMode !== "agent_v2_only" && isBlinded
  const comparesLegacyToolLoop = compareSystems.includes("tool_loop")
  const comparesAgentV2CareBalance = compareSystems.includes("agent_v2_care_balance")
  const activeInput = isMultiTurn ? turnsText : prompt
  const activeTurns = turnsText
    .split("\n")
    .map((turn) => turn.trim())
    .filter((turn) => turn.length > 0)
  const currentTitle = !currentResult
    ? "Kein Vergleich"
    : result?.blinded && !isRevealed
      ? (currentResult?.display_label ?? "Variante A")
      : formatCompareSystemLabel(currentResult.system)
  const agentTitle =
    result?.blinded && !isRevealed
      ? (agentResult?.display_label ?? "Variante B")
      : agentResult
        ? formatCompareSystemLabel(agentResult.system)
        : "Agent"
  const displayResults = resultEntries
  const showDiagnostics = !result?.blinded || isRevealed
  const currentJudgmentLabel = currentTitle
  const agentJudgmentLabel = agentTitle
  const canSaveJudgment = canSaveAgentCompareJudgment({
    result,
    selectedUser,
    selectedUserOption,
    currentResult,
    agentResult,
  })
  const analysisSnapshot = result
    ? buildCompareAnalysisSnapshot({
        result,
        userLabel: selectedUserOption?.label ?? selectedUserId,
        includeSystem: showDiagnostics,
      })
    : null
  const savedAnalysisSnapshot = result
    ? buildCompareAnalysisSnapshot({
        result,
        userLabel: selectedUserOption?.label ?? selectedUserId,
        includeSystem: true,
      })
    : null

  useEffect(() => {
    startLoadingUser(async () => {
      try {
        const bootstrap = await fetchBootstrap()
        setUsers(bootstrap.users)
        setSelectedUserId((current) => current || bootstrap.users[0]?.id || "")
      } catch (bootstrapError) {
        setError(
          bootstrapError instanceof Error
            ? bootstrapError.message
            : "Compare-Lab konnte nicht geladen werden",
        )
      }
    })
  }, [])

  useEffect(() => {
    const requestId = (userLoadRequestId.current += 1)

    if (!selectedUserId) {
      setSelectedUser(null)
      return
    }

    startLoadingUser(async () => {
      try {
        const bootstrap = await fetchBootstrap(selectedUserId)
        if (userLoadRequestId.current !== requestId) return

        setUsers(bootstrap.users)
        if (bootstrap.selectedUser?.user_id !== selectedUserId) {
          setSelectedUser(null)
          setError("Geladener Testnutzer passt nicht zur Auswahl.")
          return
        }

        setSelectedUser(bootstrap.selectedUser)
      } catch (bootstrapError) {
        if (userLoadRequestId.current !== requestId) return

        setSelectedUser(null)
        setError(
          bootstrapError instanceof Error
            ? bootstrapError.message
            : "Testnutzer konnte nicht geladen werden",
        )
      }
    })
  }, [selectedUserId])

  async function handleRunCompare() {
    if (!selectedUserId || activeInput.trim().length === 0) return

    const requestId = (compareRequestId.current += 1)
    const submittedUserId = selectedUserId

    setError(null)
    setIsRevealed(false)
    startTransition(async () => {
      try {
        const response = await fetch("/api/labs/agent-compare", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            userId: selectedUserId,
            ...(isMultiTurn ? { turns: activeTurns } : { prompt }),
            blinded: effectiveBlinded,
            toolLoopVariant,
            systems: compareSystems,
          }),
        })

        const data = (await response.json()) as AgentCompareResponse | { error?: string }
        if (compareRequestId.current !== requestId) return

        if (!response.ok) {
          setResult(null)
          setError(
            "error" in data && typeof data.error === "string"
              ? data.error
              : "Compare fehlgeschlagen",
          )
          return
        }

        const compareResult = data as AgentCompareResponse
        if (compareResult.userId !== submittedUserId) {
          setResult(null)
          setError("Compare-Ergebnis passt nicht zum gewaehlten Testnutzer.")
          return
        }

        setResult(compareResult)
      } catch (runError) {
        if (compareRequestId.current !== requestId) return

        setResult(null)
        setError(runError instanceof Error ? runError.message : "Compare fehlgeschlagen")
      }
    })
  }

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (isMultiTurn || event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey) {
      return
    }

    event.preventDefault()
    void handleRunCompare()
  }

  async function handleCopyAnalysisSnapshot() {
    if (!analysisSnapshot) return

    try {
      await navigator.clipboard.writeText(JSON.stringify(analysisSnapshot, null, 2))
      setAnalysisCopyLabel("Kopiert")
      window.setTimeout(() => setAnalysisCopyLabel("Snapshot kopieren"), 1400)
    } catch {
      setAnalysisCopyLabel("Nicht kopiert")
      window.setTimeout(() => setAnalysisCopyLabel("Snapshot kopieren"), 1400)
    }
  }

  function handleUserChange(nextUserId: string) {
    compareRequestId.current += 1
    setSelectedUserId(nextUserId)
    setSelectedUser(null)
    setResult(null)
    setIsRevealed(false)
    setError(null)
  }

  function handleTemplateChange(nextTemplateId: string) {
    setTemplateId(nextTemplateId)
    const template = AGENT_COMPARE_PROMPT_TEMPLATES.find((entry) => entry.id === nextTemplateId)
    if (template) {
      setIsMultiTurn(false)
      setPrompt(template.prompt)
      setTurnsText("")
      return
    }

    const chain = AGENT_COMPARE_MULTI_TURN_CHAINS.find((entry) => entry.id === nextTemplateId)
    if (chain) {
      setIsMultiTurn(true)
      setTurnsText(chain.turns.join("\n"))
      setPrompt("")
    }
  }

  function handleSaveJudgment() {
    if (!canSaveJudgment || !result || !selectedUser || !selectedUserOption || !agentResult) {
      return
    }

    const createdAt = new Date().toISOString()
    const currentSystem = currentResult
      ? normalizeCompareSystemForMetrics(currentResult.system)
      : null
    const agentSystem = normalizeCompareSystemForMetrics(agentResult.system)
    const blindedWinner =
      winner === "current" && currentSystem
        ? currentSystem
        : winner === "agent"
          ? agentSystem
          : "tie"
    const latencyBySystem: Partial<Record<CanonicalCompareSystem, number | null>> = {
      [agentSystem]: agentResult.latency_ms,
    }
    if (currentResult && currentSystem) {
      latencyBySystem[currentSystem] = currentResult.latency_ms
    }
    const historyEntry: JudgmentHistoryEntry = {
      userId: selectedUserOption.id,
      userLabel: selectedUserOption.label,
      prompt: result.turns?.join("\n") ?? result.prompt,
      winner,
      primary_reason: primaryReason,
      note,
      createdAt,
    }

    const record: AgentCompareJudgmentRecord = {
      createdAt,
      user: selectedUserOption,
      prompt: result.turns?.join("\n") ?? result.prompt,
      toolLoopVariant: result.toolLoopVariant,
      context: selectedUser,
      results: {
        ...(currentResult ? { current: currentResult } : {}),
        agent: agentResult,
      },
      judgment: {
        winner,
        primary_reason: primaryReason,
        note,
        failure_bucket: failureBucket,
        critical_product_claim_failure: criticalProductClaimFailure,
      },
      rollout_metrics: {
        blinded_winner: blindedWinner,
        failure_bucket: failureBucket,
        critical_product_claim_failure: criticalProductClaimFailure,
        latency_ms: latencyBySystem,
        tool_loop_model_steps:
          currentResult && currentSystem === "tool_loop"
            ? getTraceMetricForSystem(currentResult, currentSystem, "model_steps")
            : agentSystem === "tool_loop"
              ? getTraceMetricForSystem(agentResult, agentSystem, "model_steps")
              : null,
        tool_loop_tool_calls:
          currentResult && currentSystem === "tool_loop"
            ? getTraceMetricForSystem(currentResult, currentSystem, "tool_calls")
            : agentSystem === "tool_loop"
              ? getTraceMetricForSystem(agentResult, agentSystem, "tool_calls")
              : null,
        agent_v2_model_steps:
          currentResult &&
          (currentSystem === "agent_v2" || currentSystem === "agent_v2_care_balance")
            ? getTraceMetricForSystem(currentResult, currentSystem, "model_steps")
            : agentSystem === "agent_v2" || agentSystem === "agent_v2_care_balance"
              ? getTraceMetricForSystem(agentResult, agentSystem, "model_steps")
              : null,
        agent_v2_tool_calls:
          currentResult &&
          (currentSystem === "agent_v2" || currentSystem === "agent_v2_care_balance")
            ? getTraceMetricForSystem(currentResult, currentSystem, "tool_calls")
            : agentSystem === "agent_v2" || agentSystem === "agent_v2_care_balance"
              ? getTraceMetricForSystem(agentResult, agentSystem, "tool_calls")
              : null,
      },
      analysis_snapshot: savedAnalysisSnapshot ?? undefined,
    }

    startSavingJudgment(async () => {
      try {
        const response = await fetch("/api/labs/agent-compare/judgments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(record),
        })

        const data = (await response.json()) as { ok?: boolean; error?: string }
        if (!response.ok) {
          throw new Error(data.error ?? "Urteil konnte nicht gespeichert werden")
        }

        setHistory((current) => [historyEntry, ...current])
        setNote("")
        setFailureBucket("none")
        setCriticalProductClaimFailure(false)
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Urteil konnte nicht gespeichert werden",
        )
      }
    })
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[260px,220px,1fr]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="agent-compare-user">
              Testnutzer
            </label>
            <select
              id="agent-compare-user"
              value={selectedUserId}
              onChange={(event) => handleUserChange(event.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="">Bitte waehlen</option>
              <optgroup label={`Gespeicherte Testnutzer (${users.length})`}>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.label}
                  </option>
                ))}
              </optgroup>
            </select>
            <p className="text-xs text-muted-foreground">
              Geladen werden echte gespeicherte Testnutzer mit Profil, aktueller Routine und
              relevanter Memory.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="agent-compare-template">
              Prompt-Vorlage
            </label>
            <select
              id="agent-compare-template"
              value={templateId}
              onChange={(event) => handleTemplateChange(event.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="">Keine Vorlage</option>
              <optgroup label="Einzelturns">
                {AGENT_COMPARE_PROMPT_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Multi-Turn Parity">
                {AGENT_COMPARE_MULTI_TURN_CHAINS.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.label}
                  </option>
                ))}
              </optgroup>
            </select>
            <p className="text-xs text-muted-foreground">
              Fuellt Einzelturns oder Multi-Turn-Ketten. Der Testnutzer bleibt derselbe.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="agent-compare-prompt">
              {isMultiTurn ? "Turns" : "Prompt"}
            </label>
            <textarea
              id="agent-compare-prompt"
              value={isMultiTurn ? turnsText : prompt}
              onChange={(event) =>
                isMultiTurn ? setTurnsText(event.target.value) : setPrompt(event.target.value)
              }
              onKeyDown={handlePromptKeyDown}
              placeholder={
                isMultiTurn
                  ? "Ein Turn pro Zeile."
                  : "Enter startet den Vergleich. Shift+Enter fuegt eine neue Zeile ein."
              }
              rows={5}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              Modus
              <select
                value={runMode}
                onChange={(event) => setRunMode(event.target.value as AgentCompareRunMode)}
                className="rounded-lg border bg-background px-3 py-2 text-sm"
              >
                {RUN_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={isMultiTurn}
                onChange={(event) => setIsMultiTurn(event.target.checked)}
                className="h-4 w-4 rounded border"
              />
              Mehrturn-Test
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={isBlinded}
                onChange={(event) => setIsBlinded(event.target.checked)}
                disabled={runMode === "agent_v2_only"}
                className="h-4 w-4 rounded border"
              />
              Geblendet
            </label>

            {comparesLegacyToolLoop ? (
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                Legacy-Kontext
                <select
                  value={toolLoopVariant}
                  onChange={(event) =>
                    setToolLoopVariant(event.target.value as AgentCompareToolLoopVariant)
                  }
                  className="rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  {AGENT_COMPARE_TOOL_LOOP_VARIANT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">
            {comparesAgentV2CareBalance
              ? "Vergleicht denselben AgentV2 GPT-5.4-mini-Pfad einmal ohne und einmal mit modell-sichtbarer CareBalance-Evidenz."
              : comparesLegacyToolLoop
                ? "Legacy-Modus: vergleicht Classic mit dem aelteren Tool-Loop-Runner."
                : "Nur AgentV2 testet den aktuellen Antwortpfad ohne CareBalance-Variante."}
          </p>
          <button
            type="button"
            onClick={handleRunCompare}
            disabled={
              isPending || isLoadingUser || !selectedUserId || activeInput.trim().length === 0
            }
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Vergleiche..." : "Vergleich starten"}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <p className="type-label text-muted-foreground">Geladener Kontext</p>

        {!selectedUser ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {isLoadingUser ? "Lade Testnutzer..." : "Noch kein Testnutzer geladen."}
          </p>
        ) : (
          <div className="mt-4 grid gap-5 lg:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Profil-Signale</p>
              {selectedUser.derived_signals.length > 0 ? (
                <ul className="space-y-1 text-sm text-foreground">
                  {selectedUser.derived_signals.map((signal) => (
                    <li key={signal}>{signal}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Keine sichtbaren Signale.</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Aktuelle Routine</p>
              {selectedUser.routine_inventory.length > 0 ? (
                <ul className="space-y-1 text-sm text-foreground">
                  {selectedUser.routine_inventory.map((item) => (
                    <li key={`${item.category}-${item.product_name ?? "none"}`}>
                      {item.category}
                      {item.product_name ? ` · ${item.product_name}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Keine gespeicherte Routine.</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Relevante Memory</p>
              {selectedUser.relevant_memory.length > 0 ? (
                <ul className="space-y-1 text-sm text-foreground">
                  {selectedUser.relevant_memory.map((entry) => (
                    <li key={entry.id}>{entry.content}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Keine relevanten Memory-Eintraege.</p>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="space-y-3">
        {result?.blinded ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsRevealed(true)}
              disabled={isRevealed}
              className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Aufloesen
            </button>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-2">
          {analysisSnapshot ? (
            <div className="xl:col-span-2">
              <CompareAnalysisPanel
                snapshot={analysisSnapshot}
                isHidden={result?.blinded === true && !isRevealed}
                onCopy={handleCopyAnalysisSnapshot}
                copyLabel={analysisCopyLabel}
              />
            </div>
          ) : null}

          {displayResults.length > 0 ? (
            displayResults.map((entry) => (
              <ResultCard
                key={entry.display_label ?? entry.system}
                title={
                  result?.blinded && !isRevealed
                    ? (entry.display_label ?? "Variante")
                    : formatCompareSystemLabel(entry.system)
                }
                result={entry}
                showDiagnostics={showDiagnostics}
              />
            ))
          ) : (
            <>
              <ResultCard title="Variante A" result={null} showDiagnostics={showDiagnostics} />
              <ResultCard title="Variante B" result={null} showDiagnostics={showDiagnostics} />
            </>
          )}
        </div>
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[180px,220px,190px,1fr,auto]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="agent-compare-winner">
              Gewinner
            </label>
            <select
              id="agent-compare-winner"
              value={winner}
              onChange={(event) =>
                setWinner(event.target.value as AgentCompareJudgmentDraft["winner"])
              }
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="tie">Unentschieden</option>
              <option value="current" disabled={!currentResult}>
                {currentJudgmentLabel}
              </option>
              <option value="agent">{agentJudgmentLabel}</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="agent-compare-reason">
              Hauptgrund
            </label>
            <select
              id="agent-compare-reason"
              value={primaryReason}
              onChange={(event) =>
                setPrimaryReason(event.target.value as AgentCompareJudgmentDraft["primary_reason"])
              }
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              {REASON_OPTIONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="agent-compare-failure">
              Failure Bucket
            </label>
            <select
              id="agent-compare-failure"
              value={failureBucket}
              onChange={(event) =>
                setFailureBucket(
                  event.target.value as NonNullable<AgentCompareJudgmentDraft["failure_bucket"]>,
                )
              }
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              {FAILURE_BUCKET_OPTIONS.map((bucket) => (
                <option key={bucket} value={bucket}>
                  {bucket}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="agent-compare-note">
              Notiz
            </label>
            <input
              id="agent-compare-note"
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Kurz festhalten, warum."
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleSaveJudgment}
              disabled={!canSaveJudgment || isSavingJudgment}
              className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingJudgment ? "Speichere..." : "Urteil speichern"}
            </button>
          </div>
        </div>

        <label className="mt-4 inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={criticalProductClaimFailure}
            onChange={(event) => setCriticalProductClaimFailure(event.target.checked)}
            className="h-4 w-4 rounded border"
          />
          Kritischer Produktclaim-Fehler
        </label>

        <div className="mt-5 space-y-3">
          <p className="type-label text-muted-foreground">Session-Verlauf</p>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Urteile in dieser Browser-Session gespeichert.
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <div
                  key={`${entry.createdAt}-${entry.userId}-${entry.winner}`}
                  className="rounded-lg border bg-background p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                    <span>{entry.userLabel}</span>
                    <span>·</span>
                    <span>{entry.winner}</span>
                    <span>·</span>
                    <span>{entry.primary_reason}</span>
                  </div>
                  <p className="mt-2 text-foreground">{entry.note || "Keine Notiz."}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{entry.prompt}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
