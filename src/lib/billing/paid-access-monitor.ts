import type { SupabaseClient } from "@supabase/supabase-js"

import {
  findPersonalPlanOneTimeConsentById,
  type PersonalPlanOneTimeCheckoutConsentRow,
} from "./personal-plan-one-time-consents"
import {
  PERSONAL_PLAN_ONCE_PRODUCT_KIND,
  resolveOneTimeAccessStateForUser,
  resolveOneTimePurchaseAccessState,
} from "./purchases"
import type {
  BillingOneTimePurchaseRow,
  OneTimeAccessState,
  PersonalPlanOneTimeFulfillmentJobRow,
} from "./types"

export const DEFAULT_PAID_ACCESS_MONITOR_GRACE_MS = 60 * 60 * 1000
export const DEFAULT_PAID_ACCESS_MONITOR_LIMIT = 50
export const DEFAULT_PAID_ACCESS_MONITOR_LOOKBACK_MS = 72 * 60 * 60 * 1000
export const DEFAULT_PAID_ACCESS_MONITOR_SCAN_PAGE_SIZE = 50
export const DEFAULT_PAID_ACCESS_MONITOR_SCAN_PAGE_MULTIPLIER = 4
export const DEFAULT_PAID_ACCESS_MONITOR_STALE_PROCESSING_MS = 15 * 60 * 1000
export const PAID_ACCESS_MONITOR_WORKER_COUNT = 4

export type PaidAccessMonitorReason =
  | "binding_missing"
  | "confirmation_pending"
  | "delivery_evidence_missing"
  | "fulfillment_failed_permanent"
  | "fulfillment_retry_stalled"

export type PaidAccessMonitorFinding = {
  signal: "paid_but_entitlement_not_active"
  provider: BillingOneTimePurchaseRow["provider"]
  purchaseId: string
  reason: PaidAccessMonitorReason
  userId?: string
  leadId?: string
  paidAt: string
  isInternalTest: false
}

export type PaidAccessMonitorFailure = {
  signal: "payment_monitor_failed"
  provider: BillingOneTimePurchaseRow["provider"] | "unknown"
  reason: "local_lookup_error" | "candidate_cap" | "canonical_access_conflict"
  errorFamily: "unknown"
  purchaseId?: string
}

export type PaidAccessMonitorCounters = {
  purchasesListed: number
  purchasesChecked: number
  skippedInternalTest: number
  active: number
  findings: number
  monitorFailures: number
}

export type PaidAccessMonitorResult = {
  status: "completed" | "monitor_failed"
  counters: PaidAccessMonitorCounters
  findings: PaidAccessMonitorFinding[]
  monitorFailures: PaidAccessMonitorFailure[]
  telemetryEventIds?: string[]
}

type PurchaseScanResult = {
  purchasesChecked: number
  skippedInternalTest: number
  active: number
  finding?: PaidAccessMonitorFinding
  monitorFailure?: PaidAccessMonitorFailure
}

type CanonicalAccessMemo = Map<string, Promise<OneTimeAccessState>>

export async function monitorPaidOneTimeAccess(options: {
  supabase: SupabaseClient
  now: Date
  graceMs?: number
  lookbackMs?: number
  limit?: number
  staleProcessingMs?: number
}): Promise<PaidAccessMonitorResult> {
  const counters = emptyPaidAccessMonitorCounters()
  const findings: PaidAccessMonitorFinding[] = []
  const monitorFailures: PaidAccessMonitorFailure[] = []
  const cutoff = new Date(
    options.now.getTime() - (options.graceMs ?? DEFAULT_PAID_ACCESS_MONITOR_GRACE_MS),
  )
  const lookbackStartedAt = new Date(
    options.now.getTime() - (options.lookbackMs ?? DEFAULT_PAID_ACCESS_MONITOR_LOOKBACK_MS),
  )
  const limit = Math.max(1, options.limit ?? DEFAULT_PAID_ACCESS_MONITOR_LIMIT)

  let purchases: BillingOneTimePurchaseRow[]
  try {
    const listed = await listPaidAccessMonitorCandidates({
      supabase: options.supabase,
      lookbackStartedAt,
      cutoff,
      limit,
    })
    counters.skippedInternalTest += listed.skippedInternalTest
    if (listed.incomplete) {
      recordMonitorFailure({
        counters,
        monitorFailures,
        reason: "candidate_cap",
      })
    }
    purchases = listed.purchases
  } catch {
    recordMonitorFailure({
      counters,
      monitorFailures,
    })
    return buildResult(counters, findings, monitorFailures)
  }

  counters.purchasesListed = purchases.length
  const seen = new Set<string>()
  let findingCapExceeded = false
  const canonicalAccessByUser: CanonicalAccessMemo = new Map()
  const scanResults = await boundedMap(
    purchases,
    PAID_ACCESS_MONITOR_WORKER_COUNT,
    async (purchase) =>
      scanPaidAccessCandidate({
        purchase,
        supabase: options.supabase,
        now: options.now,
        graceMs: options.graceMs ?? DEFAULT_PAID_ACCESS_MONITOR_GRACE_MS,
        staleProcessingMs:
          options.staleProcessingMs ?? DEFAULT_PAID_ACCESS_MONITOR_STALE_PROCESSING_MS,
        canonicalAccessByUser,
      }),
  )

  for (const result of scanResults) {
    counters.purchasesChecked += result.purchasesChecked
    counters.skippedInternalTest += result.skippedInternalTest
    counters.active += result.active
    if (result.monitorFailure) {
      counters.monitorFailures += 1
      monitorFailures.push(result.monitorFailure)
    }
    if (!result.finding) continue
    const dedupeKey = `${result.finding.purchaseId}:${result.finding.reason}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    if (findings.length >= limit) {
      findingCapExceeded = true
      continue
    }
    counters.findings += 1
    findings.push(result.finding)
  }
  if (findingCapExceeded) {
    recordMonitorFailure({
      counters,
      monitorFailures,
      reason: "candidate_cap",
    })
  }

  return buildResult(counters, findings, monitorFailures)
}

async function listPaidAccessMonitorCandidates(input: {
  supabase: SupabaseClient
  lookbackStartedAt: Date
  cutoff: Date
  limit: number
}): Promise<{
  purchases: BillingOneTimePurchaseRow[]
  skippedInternalTest: number
  incomplete: boolean
}> {
  const scanBudget = Math.max(
    input.limit,
    input.limit * DEFAULT_PAID_ACCESS_MONITOR_SCAN_PAGE_MULTIPLIER,
  )
  const pageSize = Math.min(DEFAULT_PAID_ACCESS_MONITOR_SCAN_PAGE_SIZE, scanBudget)
  const purchases: BillingOneTimePurchaseRow[] = []
  let skippedInternalTest = 0
  let rowsRead = 0
  let exhausted = false

  while (rowsRead < scanBudget) {
    const from = rowsRead
    const to = Math.min(rowsRead + pageSize, scanBudget) - 1
    const { data, error } = await input.supabase
      .from("billing_one_time_purchases")
      .select("*")
      .eq("product_kind", PERSONAL_PLAN_ONCE_PRODUCT_KIND)
      .eq("status", "paid")
      .gte("paid_at", input.lookbackStartedAt.toISOString())
      .lte("paid_at", input.cutoff.toISOString())
      .order("paid_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
    if (error) throw error

    const rows = (data as BillingOneTimePurchaseRow[] | null) ?? []
    rowsRead += rows.length
    if (rows.length === 0 || rows.length < to - from + 1) exhausted = true

    for (const purchase of rows) {
      if (isInternalTestMetadata(purchase.metadata)) {
        skippedInternalTest += 1
        continue
      }
      purchases.push(purchase)
    }

    if (exhausted) break
  }

  let incomplete = false
  if (!exhausted && rowsRead >= scanBudget) {
    // One bounded look-ahead distinguishes an actually partial scan from an
    // exact-budget result set, avoiding a permanent false alarm at the
    // capacity boundary.
    const { data, error } = await input.supabase
      .from("billing_one_time_purchases")
      .select("id")
      .eq("product_kind", PERSONAL_PLAN_ONCE_PRODUCT_KIND)
      .eq("status", "paid")
      .gte("paid_at", input.lookbackStartedAt.toISOString())
      .lte("paid_at", input.cutoff.toISOString())
      .order("paid_at", { ascending: true })
      .order("id", { ascending: true })
      .range(scanBudget, scanBudget)
    if (error) throw error
    incomplete = ((data as Array<{ id: string }> | null) ?? []).length > 0
  }

  return {
    purchases,
    skippedInternalTest,
    incomplete,
  }
}

async function scanPaidAccessCandidate(input: {
  purchase: BillingOneTimePurchaseRow
  supabase: SupabaseClient
  now: Date
  graceMs: number
  staleProcessingMs: number
  canonicalAccessByUser: CanonicalAccessMemo
}): Promise<PurchaseScanResult> {
  const empty: PurchaseScanResult = {
    purchasesChecked: 0,
    skippedInternalTest: 0,
    active: 0,
  }
  if (isInternalTestMetadata(input.purchase.metadata)) {
    return { ...empty, skippedInternalTest: 1 }
  }

  let consent: PersonalPlanOneTimeCheckoutConsentRow | null = null
  let job: PersonalPlanOneTimeFulfillmentJobRow | null = null
  try {
    consent = input.purchase.consent_id
      ? await findPersonalPlanOneTimeConsentById(input.supabase, input.purchase.consent_id)
      : null
    if (await isInternalFunnelSession(input.supabase, consent)) {
      return { ...empty, skippedInternalTest: 1 }
    }
    job = await findFulfillmentJob(input.supabase, input.purchase)
  } catch {
    return { ...empty, monitorFailure: paidAccessMonitorFailure() }
  }

  const base: PurchaseScanResult = { ...empty, purchasesChecked: 1 }
  const finding = evaluatePaidOneTimePurchaseAccess({
    purchase: input.purchase,
    consent,
    fulfillmentJob: job,
    now: input.now,
    graceMs: input.graceMs,
    staleProcessingMs: input.staleProcessingMs,
    isInternalTest: false,
  })
  if (!finding) {
    return {
      ...base,
      active:
        resolveOneTimePurchaseAccessState({ purchase: input.purchase, consent }) === "active"
          ? 1
          : 0,
    }
  }

  if (input.purchase.user_id) {
    let canonicalAccess: OneTimeAccessState
    try {
      canonicalAccess = await resolveCanonicalOneTimeAccessState(
        input.supabase,
        input.purchase.user_id,
        input.canonicalAccessByUser,
      )
    } catch {
      return { ...base, monitorFailure: paidAccessMonitorFailure() }
    }
    if (canonicalAccess === "active") return { ...base, active: 1 }
    if (canonicalAccess !== "paid_pending") {
      // A paid local row cannot truthfully disappear into canonical none/revoked.
      // Retain the purchase-scoped finding so the generic monitor failure is
      // actionable and a transient refund race can be reconciled on the next run.
      return {
        ...base,
        finding,
        monitorFailure: paidAccessMonitorFailure("canonical_access_conflict", input.purchase),
      }
    }
  }

  return { ...base, finding }
}

function resolveCanonicalOneTimeAccessState(
  supabase: SupabaseClient,
  userId: string,
  canonicalAccessByUser: CanonicalAccessMemo,
): Promise<OneTimeAccessState> {
  let access = canonicalAccessByUser.get(userId)
  if (!access) {
    access = resolveOneTimeAccessStateForUser(supabase, userId)
    canonicalAccessByUser.set(userId, access)
  }
  return access
}

async function boundedMap<T, R>(
  items: T[],
  workerCount: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(workerCount, items.length) }, async () => {
    for (;;) {
      const index = nextIndex
      nextIndex += 1
      if (index >= items.length) return
      results[index] = await mapper(items[index]!, index)
    }
  })
  await Promise.all(workers)
  return results
}

export function evaluatePaidOneTimePurchaseAccess(input: {
  purchase: BillingOneTimePurchaseRow
  consent: PersonalPlanOneTimeCheckoutConsentRow | null
  fulfillmentJob?: PersonalPlanOneTimeFulfillmentJobRow | null
  now: Date
  graceMs?: number
  staleProcessingMs?: number
  isInternalTest?: boolean
}): PaidAccessMonitorFinding | null {
  const graceMs = input.graceMs ?? DEFAULT_PAID_ACCESS_MONITOR_GRACE_MS
  const paidAtMs = Date.parse(input.purchase.paid_at)
  if (
    input.isInternalTest === true ||
    input.purchase.product_kind !== PERSONAL_PLAN_ONCE_PRODUCT_KIND ||
    input.purchase.status !== "paid" ||
    !Number.isFinite(paidAtMs) ||
    paidAtMs > input.now.getTime() - graceMs
  ) {
    return null
  }

  if (
    resolveOneTimePurchaseAccessState({ purchase: input.purchase, consent: input.consent }) !==
    "paid_pending"
  ) {
    return null
  }

  return {
    signal: "paid_but_entitlement_not_active",
    provider: input.purchase.provider,
    purchaseId: input.purchase.id,
    reason: paidPendingReason(input.purchase, input.consent, input.fulfillmentJob, {
      now: input.now,
      staleProcessingMs: input.staleProcessingMs ?? DEFAULT_PAID_ACCESS_MONITOR_STALE_PROCESSING_MS,
    }),
    ...(input.purchase.user_id ? { userId: input.purchase.user_id } : {}),
    ...(input.consent?.lead_id ? { leadId: input.consent.lead_id } : {}),
    paidAt: input.purchase.paid_at,
    isInternalTest: false,
  }
}

export function emptyPaidAccessMonitorCounters(): PaidAccessMonitorCounters {
  return {
    purchasesListed: 0,
    purchasesChecked: 0,
    skippedInternalTest: 0,
    active: 0,
    findings: 0,
    monitorFailures: 0,
  }
}

function paidPendingReason(
  purchase: BillingOneTimePurchaseRow,
  consent: PersonalPlanOneTimeCheckoutConsentRow | null,
  job: PersonalPlanOneTimeFulfillmentJobRow | null | undefined,
  options: { now: Date; staleProcessingMs: number },
): PaidAccessMonitorReason {
  if (!consent || purchase.consent_id !== consent.id || !purchase.user_id || !consent.user_id) {
    return "binding_missing"
  }
  if (
    purchase.user_id !== consent.user_id ||
    consent.product_kind !== PERSONAL_PLAN_ONCE_PRODUCT_KIND
  ) {
    return "binding_missing"
  }
  if (job?.status === "failed_permanent") return "fulfillment_failed_permanent"
  if (isFulfillmentRetryStalled(job, options)) return "fulfillment_retry_stalled"
  if (consent.confirmation_status !== "sent" && consent.confirmation_status !== "delivered") {
    return "confirmation_pending"
  }
  return "delivery_evidence_missing"
}

function isFulfillmentRetryStalled(
  job: PersonalPlanOneTimeFulfillmentJobRow | null | undefined,
  options: { now: Date; staleProcessingMs: number },
): boolean {
  if (!job || job.status === "completed" || job.status === "failed_permanent") return false
  if (job.status === "pending") {
    if (!job.next_attempt_at) return true
    const nextAttemptAtMs = Date.parse(job.next_attempt_at)
    return Number.isFinite(nextAttemptAtMs) && nextAttemptAtMs <= options.now.getTime()
  }
  if (job.status === "processing") {
    const processingStartedAtMs = job.processing_started_at
      ? Date.parse(job.processing_started_at)
      : Number.NaN
    return (
      Number.isFinite(processingStartedAtMs) &&
      processingStartedAtMs <= options.now.getTime() - options.staleProcessingMs
    )
  }
  if (!job.next_attempt_at) return job.status === "failed"
  const nextAttemptAtMs = Date.parse(job.next_attempt_at)
  return Number.isFinite(nextAttemptAtMs) && nextAttemptAtMs <= options.now.getTime()
}

async function findFulfillmentJob(
  supabase: SupabaseClient,
  purchase: BillingOneTimePurchaseRow,
): Promise<PersonalPlanOneTimeFulfillmentJobRow | null> {
  const { data, error } = await supabase
    .from("personal_plan_one_time_fulfillment_jobs")
    .select("*")
    .eq("purchase_id", purchase.id)
    .maybeSingle()
  if (error) throw error
  return (data as PersonalPlanOneTimeFulfillmentJobRow | null) ?? null
}

async function isInternalFunnelSession(
  supabase: SupabaseClient,
  consent: PersonalPlanOneTimeCheckoutConsentRow | null,
): Promise<boolean> {
  if (!consent?.funnel_session_id) return false
  const { data, error } = await supabase
    .from("funnel_sessions")
    .select("is_internal_test")
    .eq("id", consent.funnel_session_id)
    .maybeSingle()
  if (error) throw error
  return (data as { is_internal_test?: unknown } | null)?.is_internal_test === true
}

function isInternalTestMetadata(metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata) return false
  return ["is_internal_test", "internal_test", "production_qa", "qa_test"].some((key) =>
    booleanLike(metadata[key]),
  )
}

function booleanLike(value: unknown): boolean {
  return value === true || value === "true" || value === "1" || value === 1 || value === "yes"
}

function recordMonitorFailure(input: {
  counters: PaidAccessMonitorCounters
  monitorFailures: PaidAccessMonitorFailure[]
  reason?: PaidAccessMonitorFailure["reason"]
}) {
  const failure = paidAccessMonitorFailure(input.reason)
  input.counters.monitorFailures += 1
  input.monitorFailures.push(failure)
}

function paidAccessMonitorFailure(
  reason: PaidAccessMonitorFailure["reason"] = "local_lookup_error",
  purchase?: BillingOneTimePurchaseRow,
): PaidAccessMonitorFailure {
  return {
    signal: "payment_monitor_failed",
    provider: purchase?.provider ?? "unknown",
    reason,
    errorFamily: "unknown",
    ...(purchase ? { purchaseId: purchase.id } : {}),
  }
}

function buildResult(
  counters: PaidAccessMonitorCounters,
  findings: PaidAccessMonitorFinding[],
  monitorFailures: PaidAccessMonitorFailure[],
): PaidAccessMonitorResult {
  return {
    status: monitorFailures.length > 0 ? "monitor_failed" : "completed",
    counters,
    findings,
    monitorFailures,
  }
}
