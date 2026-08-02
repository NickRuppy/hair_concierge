export const DEFAULT_PAYMENT_INTEGRITY_LOOKBACK_MS = 72 * 60 * 60 * 1000
export const DEFAULT_PAYMENT_INTEGRITY_SETTLEMENT_GRACE_MS = 60 * 60 * 1000
export const DEFAULT_PAYMENT_INTEGRITY_CANDIDATE_CAP = 100
export const DEFAULT_PAYMENT_INTEGRITY_MAX_CONCURRENCY = 4
export const DEFAULT_PAYMENT_INTEGRITY_MAX_FINDINGS = 50
export const DEFAULT_PAYMENT_INTEGRITY_MAX_MONITOR_FAILURES = 20

export type PaymentIntegrityProvider = "stripe" | "paypal"
export type PaymentIntegrityCommerceKind = "subscription" | "one_time"
export type PaymentIntegrityOutcome = "succeeded" | "failed" | "pending"
export type PaymentIntegrityBoundary = "billing" | "entitlement" | "reconciliation"
export type PaymentIntegrityErrorFamily =
  | "billing_state"
  | "entitlement_state"
  | "provider_unavailable"
  | "timeout"
  | "unknown"
export type PaymentIntegrityMethod = "card" | "apple_pay" | "google_pay" | "paypal" | "unknown"

export interface PaymentIntegrityCandidate {
  provider: PaymentIntegrityProvider
  commerceKind: PaymentIntegrityCommerceKind
  outcome: PaymentIntegrityOutcome
  occurredAt: Date | string
  checkoutAttemptId?: string | null
  providerReferenceDigest?: string | null
  method?: PaymentIntegrityMethod
  live?: boolean
  isInternalTest?: boolean
  userId?: string | null
  leadId?: string | null
}

export interface PaymentIntegrityCandidateList {
  candidates: PaymentIntegrityCandidate[]
  hasMore?: boolean
  incomplete?: boolean
}

export interface PaymentIntegrityListWindow {
  lookbackStartedAt: Date
  settlementGraceStartedAt: Date
  now: Date
  deadlineAt: Date
  limit: number
}

export interface PaymentIntegrityProviderAdapter {
  provider: PaymentIntegrityProvider
  listCandidates(window: PaymentIntegrityListWindow): Promise<PaymentIntegrityCandidateList>
}

export interface PaymentIntegrityLocalState {
  billingSucceeded?: boolean
  activeEntitlement?: boolean
  paidOneTimePurchase?: boolean
  isInternalTest?: boolean
}

export interface PaymentIntegrityLocalAdapter {
  getState(candidate: PaymentIntegrityCandidate): Promise<PaymentIntegrityLocalState>
}

export type PaymentIntegrityInvariant =
  | "provider_success_without_billing_success"
  | "provider_success_without_active_entitlement"
  | "provider_success_without_paid_one_time_purchase"
  | "provider_failure_conflicts_with_local_subscription_success"
  | "provider_failure_conflicts_with_local_one_time_success"

export interface PaymentIntegrityFinding {
  signal: "payment_integrity_mismatch"
  provider: PaymentIntegrityProvider
  commerceKind: PaymentIntegrityCommerceKind
  boundary: Exclude<PaymentIntegrityBoundary, "reconciliation">
  errorFamily: Extract<PaymentIntegrityErrorFamily, "billing_state" | "entitlement_state">
  invariant: PaymentIntegrityInvariant
  checkoutAttemptId?: string
  providerReferenceDigest?: string
  method: PaymentIntegrityMethod
  truth: PaymentIntegrityOutcome
  live: boolean
  isInternalTest: boolean
  userId?: string
  leadId?: string
}

export type PaymentIntegrityMonitorFailureReason =
  | "provider_error"
  | "local_lookup_error"
  | "incomplete_pagination"
  | "candidate_cap"
  | "deadline_exhausted"
  | "missing_identity"
  | "invalid_candidate"
  | "telemetry_delivery_failed"

export interface PaymentIntegrityMonitorFailure {
  signal: "payment_monitor_failed"
  provider: PaymentIntegrityProvider | "unknown"
  reason: PaymentIntegrityMonitorFailureReason
  errorFamily: Extract<PaymentIntegrityErrorFamily, "provider_unavailable" | "timeout" | "unknown">
}

export interface PaymentIntegrityReporter {
  reportFinding?(finding: PaymentIntegrityFinding): unknown
  reportMonitorFailure?(failure: PaymentIntegrityMonitorFailure): unknown
}

export interface PaymentIntegrityCounters {
  providersScanned: number
  candidatesListed: number
  candidatesChecked: number
  skippedOutsideLookback: number
  skippedInSettlementGrace: number
  skippedPending: number
  providerFailures: number
  findings: number
  monitorFailures: number
  providerErrors: number
  localLookupErrors: number
  incompleteProviders: number
  cappedProviders: number
  deadlineExhausted: number
  missingIdentity: number
  invalidCandidates: number
}

export interface PaymentIntegrityResult {
  status: "completed" | "monitor_failed"
  counters: PaymentIntegrityCounters
  findings: PaymentIntegrityFinding[]
  monitorFailures: PaymentIntegrityMonitorFailure[]
  telemetryEventIds?: string[]
}

export interface PaymentIntegrityOptions {
  now: Date
  deadlineAt: Date
  providers: PaymentIntegrityProviderAdapter[]
  local: PaymentIntegrityLocalAdapter
  reporter?: PaymentIntegrityReporter
  lookbackMs?: number
  settlementGraceMs?: number
  candidateCapPerProvider?: number
  maxConcurrency?: number
  maxFindings?: number
  maxMonitorFailures?: number
  clock?: () => number
}

export async function reconcilePaymentIntegrity(
  options: PaymentIntegrityOptions,
): Promise<PaymentIntegrityResult> {
  const nowMs = options.now.getTime()
  const deadlineMs = options.deadlineAt.getTime()
  const clock = options.clock ?? Date.now
  const lookbackMs = options.lookbackMs ?? DEFAULT_PAYMENT_INTEGRITY_LOOKBACK_MS
  const settlementGraceMs =
    options.settlementGraceMs ?? DEFAULT_PAYMENT_INTEGRITY_SETTLEMENT_GRACE_MS
  const candidateCap = Math.min(
    positiveInteger(options.candidateCapPerProvider, DEFAULT_PAYMENT_INTEGRITY_CANDIDATE_CAP),
    DEFAULT_PAYMENT_INTEGRITY_CANDIDATE_CAP,
  )
  const maxConcurrency = Math.min(
    positiveInteger(options.maxConcurrency, DEFAULT_PAYMENT_INTEGRITY_MAX_CONCURRENCY),
    DEFAULT_PAYMENT_INTEGRITY_MAX_CONCURRENCY,
  )
  const maxFindings = nonNegativeInteger(
    options.maxFindings,
    DEFAULT_PAYMENT_INTEGRITY_MAX_FINDINGS,
  )
  const maxMonitorFailures = nonNegativeInteger(
    options.maxMonitorFailures,
    DEFAULT_PAYMENT_INTEGRITY_MAX_MONITOR_FAILURES,
  )
  const counters = createCounters()
  const findings: PaymentIntegrityFinding[] = []
  const monitorFailures: PaymentIntegrityMonitorFailure[] = []
  const telemetryEventIds: string[] = []
  const lookbackStartedAt = new Date(nowMs - lookbackMs)
  const settlementGraceStartedAt = new Date(nowMs - settlementGraceMs)

  const recordFinding = async (finding: PaymentIntegrityFinding): Promise<void> => {
    counters.findings += 1
    if (findings.length < maxFindings) findings.push(finding)
    recordTelemetryReceipt(
      telemetryEventIds,
      await safeCall(() => options.reporter?.reportFinding?.(finding)),
    )
  }

  const recordMonitorFailure = async (failure: PaymentIntegrityMonitorFailure): Promise<void> => {
    counters.monitorFailures += 1
    if (monitorFailures.length < maxMonitorFailures) monitorFailures.push(failure)
    recordTelemetryReceipt(
      telemetryEventIds,
      await safeCall(() => options.reporter?.reportMonitorFailure?.(failure)),
    )
  }

  const reportDeadlineExhausted = async (): Promise<void> => {
    counters.deadlineExhausted += 1
    await recordMonitorFailure({
      signal: "payment_monitor_failed",
      provider: "unknown",
      reason: "deadline_exhausted",
      errorFamily: "timeout",
    })
  }

  if (clock() >= deadlineMs) {
    await reportDeadlineExhausted()
    return buildResult(counters, findings, monitorFailures, telemetryEventIds)
  }

  for (const adapter of options.providers) {
    if (clock() >= deadlineMs) {
      await reportDeadlineExhausted()
      break
    }

    let listed: PaymentIntegrityCandidateList
    try {
      listed = await adapter.listCandidates({
        lookbackStartedAt,
        settlementGraceStartedAt,
        now: new Date(nowMs),
        deadlineAt: new Date(deadlineMs),
        limit: candidateCap,
      })
      counters.providersScanned += 1
    } catch {
      counters.providerErrors += 1
      await recordMonitorFailure({
        signal: "payment_monitor_failed",
        provider: adapter.provider,
        reason: "provider_error",
        errorFamily: "provider_unavailable",
      })
      continue
    }

    if (listed.hasMore || listed.incomplete) {
      counters.incompleteProviders += 1
      await recordMonitorFailure({
        signal: "payment_monitor_failed",
        provider: adapter.provider,
        reason: "incomplete_pagination",
        errorFamily: "unknown",
      })
    }

    if (listed.candidates.length > candidateCap) {
      counters.cappedProviders += 1
      await recordMonitorFailure({
        signal: "payment_monitor_failed",
        provider: adapter.provider,
        reason: "candidate_cap",
        errorFamily: "unknown",
      })
    }

    const candidates = listed.candidates.slice(0, candidateCap)
    counters.candidatesListed += candidates.length

    await mapWithConcurrency(
      candidates,
      maxConcurrency,
      clock,
      deadlineMs,
      reportDeadlineExhausted,
      async (candidate) => {
        const normalized = normalizeCandidate(
          candidate,
          adapter.provider,
          nowMs,
          lookbackStartedAt.getTime(),
        )
        if (normalized.kind === "invalid") {
          counters.invalidCandidates += 1
          await recordMonitorFailure({
            signal: "payment_monitor_failed",
            provider: adapter.provider,
            reason: "invalid_candidate",
            errorFamily: "unknown",
          })
          return
        }

        if (normalized.kind === "outside_lookback") {
          counters.skippedOutsideLookback += 1
          return
        }

        if (normalized.candidate.outcome === "pending") {
          counters.skippedPending += 1
          return
        }

        if (
          normalized.candidate.outcome === "succeeded" &&
          normalized.occurredAtMs > nowMs - settlementGraceMs
        ) {
          counters.skippedInSettlementGrace += 1
          return
        }

        if (!findingIdentity(normalized.candidate)) {
          counters.missingIdentity += 1
          await recordMonitorFailure({
            signal: "payment_monitor_failed",
            provider: normalized.candidate.provider,
            reason: "missing_identity",
            errorFamily: "unknown",
          })
          return
        }

        let localState: PaymentIntegrityLocalState
        try {
          localState = await options.local.getState(normalized.candidate)
        } catch {
          counters.localLookupErrors += 1
          await recordMonitorFailure({
            signal: "payment_monitor_failed",
            provider: normalized.candidate.provider,
            reason: "local_lookup_error",
            errorFamily: "unknown",
          })
          return
        }

        const evaluatedCandidate = localState.isInternalTest
          ? { ...normalized.candidate, isInternalTest: true }
          : normalized.candidate

        counters.candidatesChecked += 1
        if (evaluatedCandidate.outcome === "failed") counters.providerFailures += 1

        for (const finding of evaluateCandidate(evaluatedCandidate, localState)) {
          await recordFinding(finding)
        }
      },
    )
  }

  return buildResult(counters, findings, monitorFailures, telemetryEventIds)
}

type NormalizedCandidateResult =
  | { kind: "candidate"; candidate: PaymentIntegrityCandidate; occurredAtMs: number }
  | { kind: "outside_lookback" }
  | { kind: "invalid" }

function normalizeCandidate(
  candidate: PaymentIntegrityCandidate,
  provider: PaymentIntegrityProvider,
  nowMs: number,
  lookbackStartedAtMs: number,
): NormalizedCandidateResult {
  const occurredAtMs =
    candidate.occurredAt instanceof Date
      ? candidate.occurredAt.getTime()
      : new Date(candidate.occurredAt).getTime()

  if (
    candidate.provider !== provider ||
    !Number.isFinite(occurredAtMs) ||
    occurredAtMs > nowMs + 60 * 1000
  ) {
    return { kind: "invalid" }
  }

  if (occurredAtMs < lookbackStartedAtMs) return { kind: "outside_lookback" }

  return {
    kind: "candidate",
    occurredAtMs,
    candidate: {
      provider: candidate.provider,
      commerceKind: candidate.commerceKind,
      outcome: candidate.outcome,
      occurredAt: new Date(occurredAtMs),
      checkoutAttemptId: safeInternalIdentifier(candidate.checkoutAttemptId),
      providerReferenceDigest: safeOpaqueDigest(candidate.providerReferenceDigest),
      method: candidate.method ?? "unknown",
      live: candidate.live ?? false,
      isInternalTest: candidate.isInternalTest ?? false,
      userId: safeInternalIdentifier(candidate.userId),
      leadId: safeInternalIdentifier(candidate.leadId),
    },
  }
}

function evaluateCandidate(
  candidate: PaymentIntegrityCandidate,
  localState: PaymentIntegrityLocalState,
): PaymentIntegrityFinding[] {
  if (candidate.outcome === "succeeded") {
    if (candidate.commerceKind === "subscription") {
      if (!localState.billingSucceeded) {
        return [
          buildFinding(candidate, {
            boundary: "billing",
            errorFamily: "billing_state",
            invariant: "provider_success_without_billing_success",
          }),
        ]
      }
      if (!localState.activeEntitlement) {
        return [
          buildFinding(candidate, {
            boundary: "entitlement",
            errorFamily: "entitlement_state",
            invariant: "provider_success_without_active_entitlement",
          }),
        ]
      }
      return []
    }

    if (!localState.paidOneTimePurchase) {
      return [
        buildFinding(candidate, {
          boundary: "billing",
          errorFamily: "billing_state",
          invariant: "provider_success_without_paid_one_time_purchase",
        }),
      ]
    }
    return []
  }

  if (candidate.outcome !== "failed") return []

  if (candidate.commerceKind === "subscription" && localState.billingSucceeded) {
    return [
      buildFinding(candidate, {
        boundary: "billing",
        errorFamily: "billing_state",
        invariant: "provider_failure_conflicts_with_local_subscription_success",
      }),
    ]
  }

  if (candidate.commerceKind === "one_time" && localState.paidOneTimePurchase) {
    return [
      buildFinding(candidate, {
        boundary: "billing",
        errorFamily: "billing_state",
        invariant: "provider_failure_conflicts_with_local_one_time_success",
      }),
    ]
  }

  return []
}

function buildFinding(
  candidate: PaymentIntegrityCandidate,
  details: Pick<PaymentIntegrityFinding, "boundary" | "errorFamily" | "invariant">,
): PaymentIntegrityFinding {
  const identity = findingIdentity(candidate)
  return {
    signal: "payment_integrity_mismatch",
    provider: candidate.provider,
    commerceKind: candidate.commerceKind,
    boundary: details.boundary,
    errorFamily: details.errorFamily,
    invariant: details.invariant,
    ...(identity?.checkoutAttemptId ? { checkoutAttemptId: identity.checkoutAttemptId } : {}),
    ...(identity?.providerReferenceDigest
      ? { providerReferenceDigest: identity.providerReferenceDigest }
      : {}),
    method: candidate.method ?? "unknown",
    truth: candidate.outcome,
    live: candidate.live ?? false,
    isInternalTest: candidate.isInternalTest ?? false,
    ...(candidate.userId ? { userId: candidate.userId } : {}),
    ...(candidate.leadId ? { leadId: candidate.leadId } : {}),
  }
}

function findingIdentity(
  candidate: PaymentIntegrityCandidate,
): { checkoutAttemptId?: string; providerReferenceDigest?: string } | null {
  const checkoutAttemptId = safeInternalIdentifier(candidate.checkoutAttemptId)
  if (checkoutAttemptId) return { checkoutAttemptId }
  const providerReferenceDigest = safeOpaqueDigest(candidate.providerReferenceDigest)
  if (providerReferenceDigest) return { providerReferenceDigest }
  return null
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  clock: () => number,
  deadlineMs: number,
  onDeadline: () => Promise<void>,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0
  let active = 0
  let stopped = false
  let deadlineReported = false

  await new Promise<void>((resolve) => {
    const pump = () => {
      if ((nextIndex >= items.length || stopped) && active === 0) {
        resolve()
        return
      }

      while (!stopped && active < concurrency && nextIndex < items.length) {
        if (clock() >= deadlineMs) {
          stopped = true
          if (!deadlineReported) {
            deadlineReported = true
            active += 1
            void onDeadline().finally(() => {
              active -= 1
              pump()
            })
          }
          break
        }

        const item = items[nextIndex]
        nextIndex += 1
        active += 1
        void worker(item).finally(() => {
          active -= 1
          pump()
        })
      }

      if ((nextIndex >= items.length || stopped) && active === 0) resolve()
    }

    pump()
  })
}

function buildResult(
  counters: PaymentIntegrityCounters,
  findings: PaymentIntegrityFinding[],
  monitorFailures: PaymentIntegrityMonitorFailure[],
  telemetryEventIds: string[],
): PaymentIntegrityResult {
  return {
    status: counters.monitorFailures > 0 ? "monitor_failed" : "completed",
    counters,
    findings,
    monitorFailures,
    ...(telemetryEventIds.length > 0 ? { telemetryEventIds } : {}),
  }
}

function createCounters(): PaymentIntegrityCounters {
  return {
    providersScanned: 0,
    candidatesListed: 0,
    candidatesChecked: 0,
    skippedOutsideLookback: 0,
    skippedInSettlementGrace: 0,
    skippedPending: 0,
    providerFailures: 0,
    findings: 0,
    monitorFailures: 0,
    providerErrors: 0,
    localLookupErrors: 0,
    incompleteProviders: 0,
    cappedProviders: 0,
    deadlineExhausted: 0,
    missingIdentity: 0,
    invalidCandidates: 0,
  }
}

async function safeCall(callback: () => unknown): Promise<unknown> {
  try {
    const result = callback()
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      return await Promise.resolve(result).catch(() => undefined)
    }
    return result
  } catch {
    // Monitoring must not change reconciliation outcomes.
    return undefined
  }
}

function recordTelemetryReceipt(receipts: string[], value: unknown): void {
  if (typeof value === "string" && /^[a-f0-9]{32}$/.test(value)) receipts.push(value)
}

function safeInternalIdentifier(value: string | null | undefined): string | undefined {
  if (value == null) return undefined
  const trimmed = value.trim()
  return /^[a-zA-Z0-9_-]{8,128}$/.test(trimmed) ? trimmed : undefined
}

function safeOpaqueDigest(value: string | null | undefined): string | undefined {
  if (value == null) return undefined
  const trimmed = value.trim()
  return /^(?:[a-f0-9]{64}|[a-zA-Z0-9_-]{43})$/.test(trimmed) ? trimmed : undefined
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value) || value < 1) return fallback
  return Math.floor(value)
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value) || value < 0) return fallback
  return Math.floor(value)
}
