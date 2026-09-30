import type { AuditDecision, PriceAuditCandidate, RetailerObservation } from "./contracts"
import { adapterHostFor } from "./adapters"
import { orderAuditCandidates } from "./select"

/**
 * Pure helpers of the runner and the probe script: host grouping, run-summary
 * assembly, probe-sample evaluation, and the systemic-failure rule that turns
 * a quietly broken cron into a visible non-zero exit.
 */

export function groupCandidatesByHost(
  candidates: readonly PriceAuditCandidate[],
): Map<string, PriceAuditCandidate[]> {
  const groups = new Map<string, PriceAuditCandidate[]>()
  for (const candidate of candidates) {
    const host = adapterHostFor(candidate) ?? "(no-host)"
    const group = groups.get(host)
    if (group) group.push(candidate)
    else groups.set(host, [candidate])
  }
  return groups
}

export type AuditResult = {
  candidate: PriceAuditCandidate
  host: string | null
  observation: RetailerObservation
  decision: AuditDecision
  applied: boolean
}

export type RunSummary = {
  startedAt: string
  finishedAt: string
  apply: boolean
  total: number
  byAction: Record<AuditDecision["action"], number>
  byHost: Record<string, Record<AuditDecision["action"], number>>
  reasons: Record<string, number>
}

export function buildRunSummary(
  results: readonly AuditResult[],
  options: { startedAt: string; finishedAt: string; apply: boolean },
): RunSummary {
  const byAction = { auto_write: 0, review_proposal: 0, recheck_failed: 0 }
  const byHost: RunSummary["byHost"] = {}
  const reasons: Record<string, number> = {}
  for (const result of results) {
    byAction[result.decision.action] += 1
    const host = result.host ?? "(no-host)"
    byHost[host] ??= { auto_write: 0, review_proposal: 0, recheck_failed: 0 }
    byHost[host][result.decision.action] += 1
    if (result.decision.action !== "auto_write") {
      reasons[result.decision.reason] = (reasons[result.decision.reason] ?? 0) + 1
    }
  }
  return { ...options, total: results.length, byAction, byHost, reasons }
}

/**
 * A run "systemically failed" when it could not actually re-check most rows —
 * more than half `recheck_failed` on a non-trivial run. Review proposals and
 * mismatches are healthy outcomes and never fail the run.
 */
export function isSystemicFailure(summary: RunSummary): boolean {
  if (summary.total === 0) return false
  return summary.byAction.recheck_failed / summary.total > 0.5
}

export type ProbeSample = {
  productId: string
  storedPriceEur: number | null
  observation: RetailerObservation
}

/**
 * A host earns auto-write authority only when every probe sample confirmed
 * identity and read a price. One bad sample keeps the host in the review lane.
 */
export function evaluateProbeSamples(samples: readonly ProbeSample[]): boolean {
  if (samples.length === 0) return false
  return samples.every((sample) => sample.observation.kind === "confirmed")
}

/**
 * A CSV cell that a spreadsheet could execute (leading =, +, -, @, tab) gets a
 * leading apostrophe. Review CSVs carry LLM- and page-derived text, which is
 * untrusted; every cell of the audit artifacts goes through this.
 */
export function neutralizeCsvCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

/**
 * Picks which unconfirmed results get GPT research, in the same global
 * priority as the audit itself (recommendation-surfaced first, oldest checks
 * first) — never in host-group completion order.
 */
export function selectLlmEscalations(
  results: readonly AuditResult[],
  budget: number,
): AuditResult[] {
  if (budget <= 0) return []
  const unconfirmed = results.filter((result) => result.observation.kind !== "confirmed")
  const byId = new Map(unconfirmed.map((result) => [result.candidate.id, result]))
  return orderAuditCandidates(unconfirmed.map((result) => result.candidate))
    .slice(0, budget)
    .map((candidate) => byId.get(candidate.id))
    .filter((result): result is AuditResult => result !== undefined)
}
