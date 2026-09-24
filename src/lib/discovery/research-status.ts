import { validateEanInput } from "@/lib/scan/identifier-lookup"

import type { DiscoveryIntakeItem } from "./refined-routine"

/**
 * The research half of the discovery read model, pure.
 *
 * A product the participant captured that the catalog did not know carries a
 * `product_submission_id` and no `product_id`. Two readers need to know what became of it:
 *
 *  - the reconcile CLI, which WRITES an approved product back onto the intake row, and
 *  - the cockpit, which (since batch 4) treats an approved, eligible product as the item's
 *    product at read time — without writing anything — and names every other research
 *    state in the „Eingetragene Produkte" list.
 *
 * Both go through `resolveDiscoveryResearchProduct`, so the CLI and the cockpit can never
 * disagree about which research counts as done. Everything here is pure; the reads live in
 * `research.ts`.
 */

/**
 * The only two `product_submissions.status` values that mean the review genuinely
 * RESOLVED onto a catalog product. The vocabulary is the migration's own
 * (`product_submissions_status_check` in
 * `supabase/migrations/20260612130000_product_intake_submissions.sql`): `pending_review`,
 * `researching`, `ready_for_review`, `needs_more_info`, `matched_existing`, `approved`,
 * `rejected`, `cancelled_by_user`.
 *
 * `approved_product_id` on its own is NOT that verdict: a submission that was approved and
 * then moved back to `needs_more_info`, or `rejected` outright, still carries the id it was
 * approved onto (the table's success check only runs one way).
 */
export const DISCOVERY_RESOLVED_SUBMISSION_STATUSES = ["approved", "matched_existing"] as const

export function isResolvedDiscoverySubmissionStatus(status: string | null | undefined): boolean {
  return (DISCOVERY_RESOLVED_SUBMISSION_STATUSES as readonly string[]).includes(status ?? "")
}

export type DiscoverySubmissionOutcome = {
  status: string | null
  approvedProductId: string | null
}

/**
 * - `resolved` — resolved status AND the product passes scan eligibility: usable.
 * - `pending` — no approved product yet (or no submission row at all).
 * - `not_approved` — an id is on the row, but the status no longer says approved.
 * - `ineligible` — approved onto a product that is deactivated or quarantined since.
 */
export type DiscoveryResearchResolution =
  | { outcome: "resolved"; productId: string }
  | { outcome: "pending"; productId: null }
  | { outcome: "not_approved"; productId: string }
  | { outcome: "ineligible"; productId: string }

export function resolveDiscoveryResearchProduct(
  submission: DiscoverySubmissionOutcome | null | undefined,
  eligible: ReadonlySet<string>,
): DiscoveryResearchResolution {
  const productId = submission?.approvedProductId ?? null
  if (!productId) return { outcome: "pending", productId: null }
  if (!isResolvedDiscoverySubmissionStatus(submission?.status)) {
    return { outcome: "not_approved", productId }
  }
  return eligible.has(productId)
    ? { outcome: "resolved", productId }
    : { outcome: "ineligible", productId }
}

/** The products worth an eligibility lookup: only resolved submissions' ids. */
export function discoveryResearchCandidateIds(
  submissions: ReadonlyMap<string, DiscoverySubmissionOutcome>,
): string[] {
  return [
    ...new Set(
      [...submissions.values()]
        .filter((submission) => isResolvedDiscoverySubmissionStatus(submission.status))
        .map((submission) => submission.approvedProductId)
        .filter((id): id is string => id !== null),
    ),
  ].sort()
}

/**
 * The latest research job of one submission. The attempt counters matter because the
 * claim RPC (`product_intake_claim_research_jobs`) only takes jobs with
 * `attempt_count < max_attempts`, and neither enqueue nor retry resets the count.
 */
export type DiscoveryResearchJob = {
  id: string
  status: string
  attemptCount: number
  maxAttempts: number
}

/** Everything the research read returned for one intake. */
export type DiscoveryResearchState = {
  /** By submission id. A submission id missing here had no row. */
  submissions: ReadonlyMap<string, DiscoverySubmissionOutcome>
  /** The newest job per submission id. */
  latestJobs: ReadonlyMap<string, DiscoveryResearchJob>
  /** Which of `discoveryResearchCandidateIds` pass scan eligibility. */
  eligible: ReadonlySet<string>
}

export type DiscoveryResearchItem = Pick<
  DiscoveryIntakeItem,
  | "id"
  | "category"
  | "source"
  | "brandText"
  | "productNameText"
  | "barcodeIdentifier"
  | "productId"
  | "productSubmissionId"
>

/** Does this item's research decide anything? Only an open row with a submission. */
export function discoveryItemAwaitsResearch(item: DiscoveryResearchItem): boolean {
  return item.source !== "none" && item.productId === null && item.productSubmissionId !== null
}

/**
 * Auto-link (read-only): item id → the approved, eligible product the cockpit treats as the
 * item's product. Rows that already carry a `product_id` are her own answer and are never
 * overridden, exactly as the reconcile CLI never overwrites them.
 */
export function discoveryResearchLinks(
  items: readonly DiscoveryResearchItem[],
  state: DiscoveryResearchState,
): Map<string, string> {
  const links = new Map<string, string>()
  for (const item of items) {
    if (!discoveryItemAwaitsResearch(item)) continue
    const resolution = resolveDiscoveryResearchProduct(
      state.submissions.get(item.productSubmissionId!),
      state.eligible,
    )
    if (resolution.outcome === "resolved") links.set(item.id, resolution.productId)
  }
  return links
}

/**
 * The items with their linked products filled in — same shape, no new field, because the
 * item objects are part of the routine's `sourceHash`: a new key would mark every
 * finalised document as drifted. The effective `productId` itself IS hashed, so research
 * approved after finalising shows up as drift, which is the point.
 */
export function withDiscoveryResearchLinks<T extends { id: string; productId: string | null }>(
  items: readonly T[],
  links: ReadonlyMap<string, string>,
): T[] {
  return items.map((item) => {
    const linked = links.get(item.id)
    return linked && item.productId === null ? { ...item, productId: linked } : item
  })
}

// --- starting research ------------------------------------------------------

/**
 * The input a new research submission gets, mirroring `POST /api/scan/submit`'s two lanes:
 * a valid EAN (brand and name are optional prefill), or — without one — brand AND name.
 * `null` when neither lane has enough to go on.
 */
export type DiscoveryResearchSubmissionInput = {
  category: DiscoveryIntakeItem["category"]
  identifier: string | null
  brandText: string | null
  productNameText: string | null
}

export function discoveryResearchSubmissionInput(
  item: DiscoveryResearchItem,
): DiscoveryResearchSubmissionInput | null {
  if (item.source === "none") return null
  const brandText = item.brandText?.trim() || null
  const productNameText = item.productNameText?.trim() || null
  const ean = item.barcodeIdentifier ? validateEanInput(item.barcodeIdentifier) : null
  if (ean?.ok) {
    return { category: item.category, identifier: ean.value, brandText, productNameText }
  }
  if (brandText && productNameText) {
    return { category: item.category, identifier: null, brandText, productNameText }
  }
  return null
}

// --- status -----------------------------------------------------------------

export type DiscoveryResearchStatusKind =
  | "in_catalog"
  | "research_linked"
  | "research_approved_ineligible"
  | "research_rejected"
  | "research_withdrawn"
  | "research_queued"
  | "research_running"
  | "research_review"
  | "research_rework"
  | "research_publishing"
  | "research_needs_info"
  | "research_failed"
  | "research_blocked"
  | "research_exhausted"
  | "research_not_started"
  | "research_unknown"
  | "barcode_only"
  | "no_research"
  | "not_researchable"
  | "status_unavailable"

/** Internal, short, Nick's register — this list is read during the call, not by her. */
export const DISCOVERY_RESEARCH_STATUS_COPY: Record<DiscoveryResearchStatusKind, string> = {
  in_catalog: "Im Katalog",
  research_linked: "Freigegeben",
  research_approved_ineligible: "Freigegeben – im Katalog gesperrt",
  research_rejected: "Abgelehnt",
  research_withdrawn: "Zurückgezogen",
  research_queued: "In Recherche – wartet",
  research_running: "In Recherche – läuft",
  research_review: "In Recherche – wartet auf Freigabe",
  research_rework: "In Recherche – Nacharbeit",
  research_publishing: "In Recherche – wird veröffentlicht",
  research_needs_info: "Rückfrage",
  research_failed: "Recherche fehlgeschlagen",
  research_blocked: "Recherche blockiert",
  research_exhausted: "Recherche ausgeschöpft – im Review-Center neu anstoßen",
  research_not_started: "Recherche nicht gestartet",
  research_unknown: "Recherche-Status unbekannt",
  barcode_only: "Nur Barcode – keine Recherche",
  no_research: "Keine Recherche",
  not_researchable: "Zu wenig Angaben für eine Recherche",
  status_unavailable: "Status gerade nicht lesbar",
}

/**
 * What „Recherche starten" does for an item:
 *
 *  - `enqueue` — an open submission without a live job: the enqueue RPC queues one.
 *  - `retry` — the latest job failed or is blocked. The enqueue RPC would hand that very
 *    job back unchanged (it counts both as non-terminal), so the retry RPC re-queues it.
 *  - `create_submission` — no submission yet: open one through the scan lane.
 */
export type DiscoveryResearchAction =
  | { type: "enqueue"; submissionId: string }
  | { type: "retry"; jobId: string }
  | { type: "create_submission" }

export type DiscoveryResearchStatus = {
  kind: DiscoveryResearchStatusKind
  action: DiscoveryResearchAction | null
}

const ACTIVE_JOB_KINDS: Record<string, DiscoveryResearchStatusKind> = {
  queued: "research_queued",
  running: "research_running",
  waiting_for_review: "research_review",
  waiting_for_rework: "research_rework",
  publish_preflight: "research_publishing",
  publishing: "research_publishing",
}

/**
 * Job states the claim RPC picks up — or that retry would turn into one. A job in any of
 * them with no attempts left will never be claimed again: the retry RPC re-queues it WITHOUT
 * resetting `attempt_count`. The only reset lives in the review app's rework path
 * (`product_intake_request_rework_job`), which is a reviewer's „Änderungen neu
 * recherchieren" with feedback — not something the cockpit may trigger on its own.
 */
const CLAIMABLE_OR_RETRYABLE_JOB_STATUSES = new Set([
  "queued",
  "waiting_for_rework",
  "failed",
  "blocked",
])

export function isDiscoveryResearchJobExhausted(job: DiscoveryResearchJob): boolean {
  return CLAIMABLE_OR_RETRYABLE_JOB_STATUSES.has(job.status) && job.attemptCount >= job.maxAttempts
}

const OPEN_SUBMISSION_STATUSES = new Set([
  "pending_review",
  "researching",
  "ready_for_review",
  "needs_more_info",
])

/**
 * One item's research state, and what (if anything) starting research would do.
 * `state` is null when the research read failed: nothing is guessed then.
 */
export function discoveryResearchStatus(
  item: DiscoveryResearchItem,
  state: DiscoveryResearchState | null,
): DiscoveryResearchStatus {
  if (item.productId !== null) return { kind: "in_catalog", action: null }

  if (item.productSubmissionId === null) {
    const input = discoveryResearchSubmissionInput(item)
    if (!input) return { kind: "not_researchable", action: null }
    const kind = input.productNameText ? "no_research" : "barcode_only"
    return { kind, action: { type: "create_submission" } }
  }

  if (!state) return { kind: "status_unavailable", action: null }
  const submissionId = item.productSubmissionId
  const submission = state.submissions.get(submissionId)
  if (!submission) return { kind: "research_unknown", action: null }

  const resolution = resolveDiscoveryResearchProduct(submission, state.eligible)
  if (resolution.outcome === "resolved") return { kind: "research_linked", action: null }
  if (resolution.outcome === "ineligible") {
    return { kind: "research_approved_ineligible", action: null }
  }
  if (submission.status === "rejected") return { kind: "research_rejected", action: null }
  if (submission.status === "cancelled_by_user") {
    return { kind: "research_withdrawn", action: null }
  }
  if (!OPEN_SUBMISSION_STATUSES.has(submission.status ?? "")) {
    return { kind: "research_unknown", action: null }
  }

  const job = state.latestJobs.get(submissionId) ?? null
  if (job && isDiscoveryResearchJobExhausted(job)) {
    return { kind: "research_exhausted", action: null }
  }
  const active = job ? ACTIVE_JOB_KINDS[job.status] : undefined
  if (active) return { kind: active, action: null }
  if (job?.status === "failed" || job?.status === "blocked") {
    return {
      kind: job.status === "failed" ? "research_failed" : "research_blocked",
      action: { type: "retry", jobId: job.id },
    }
  }
  if (submission.status === "ready_for_review") return { kind: "research_review", action: null }
  const enqueue: DiscoveryResearchAction = { type: "enqueue", submissionId }
  if (submission.status === "needs_more_info") {
    return { kind: "research_needs_info", action: enqueue }
  }
  return { kind: "research_not_started", action: enqueue }
}
