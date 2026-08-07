import { createHmac, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"

import type {
  PaymentIntegrityCounters,
  PaymentIntegrityMonitorFailure,
  PaymentIntegrityResult,
} from "@/lib/billing/payment-integrity"
import {
  monitorPaidOneTimeAccess,
  type PaidAccessMonitorFailure,
  type PaidAccessMonitorFinding,
  type PaidAccessMonitorResult,
} from "@/lib/billing/paid-access-monitor"
import { resolvePaymentRuntime } from "@/lib/billing/payment-runtime-config"
import {
  captureServerPaymentCheckIn,
  captureServerPaymentFailure,
  flushServerPaymentTelemetry,
} from "@/lib/observability/payment-server"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const maxDuration = 60

const PAYMENT_MONITOR_DEADLINE_MS = 40_000
const PAYMENT_MONITOR_RATE_LIMIT = {
  limit: 3,
  windowMs: 60_000,
}
const MAX_RATE_LIMIT_KEYS = 1_000
const PAYMENT_INTEGRITY_RUNTIME_MODULE = "@/lib/billing/payment-integrity-runtime"

export type RunPaymentIntegrityInput = {
  now: Date
  deadlineAt: Date
}

export type RunPaymentIntegrity = (
  input: RunPaymentIntegrityInput,
) => Promise<PaymentIntegrityResult>
export type RunPaidAccessMonitor = (input: { now: Date }) => Promise<PaidAccessMonitorResult>

type RateLimitResult = { allowed: boolean; error?: string }

type PaymentIntegrityCheckIn =
  | { monitorSlug: string; status: "in_progress" }
  | { monitorSlug: string; status: "ok" | "error"; checkInId?: string; duration?: number }

type PaymentMonitorDeps = {
  triggerSecret?: string
  runPaymentIntegrity: RunPaymentIntegrity
  checkRateLimit?: (identifier: string) => Promise<RateLimitResult> | RateLimitResult
  captureCheckIn?: (checkIn: PaymentIntegrityCheckIn) => unknown
  requireCheckInReceipt?: boolean
  flushTelemetry?: () => Promise<unknown>
  reportMonitorFailure?: (failure: PaymentIntegrityMonitorFailure) => unknown
  runPaidAccessMonitor?: RunPaidAccessMonitor
  reportPaidAccessFinding?: (finding: PaidAccessMonitorFinding) => unknown
  reportPaidAccessMonitorFailure?: (failure: PaidAccessMonitorFailure) => unknown
  now?: () => Date
  clock?: () => number
}

type PaymentIntegritySummary = {
  status: PaymentIntegrityResult["status"] | "error"
  counters: PaymentIntegrityCounters
  failures?: Array<Pick<PaymentIntegrityMonitorFailure, "provider" | "reason" | "errorFamily">>
}
type PaidAccessSummary = {
  status: PaidAccessMonitorResult["status"] | "error"
  counters: PaidAccessMonitorResult["counters"]
  findings?: Array<Pick<PaidAccessMonitorFinding, "provider" | "reason">>
  failures?: Array<Pick<PaidAccessMonitorFailure, "provider" | "reason" | "errorFamily">>
}

type PaymentMonitorRouteResult = {
  status: number
  body:
    | { paymentIntegrity: PaymentIntegritySummary; paidAccess?: PaidAccessSummary }
    | { error: string }
}

type PaymentIntegrityRuntimeModule = {
  createPaymentIntegrityRunner?: () => RunPaymentIntegrity | Promise<RunPaymentIntegrity>
}

const rateLimitBuckets = new Map<string, { windowStartedAt: number; count: number }>()

export async function POST(request: Request) {
  return toNextResponse(
    await handlePaymentMonitor(request, {
      triggerSecret: process.env.PAYMENT_MONITOR_TRIGGER_SECRET,
      runPaymentIntegrity: async (input) => {
        const runner = await loadPaymentIntegrityRunner()
        return runner(input)
      },
      runPaidAccessMonitor: ({ now }) =>
        monitorPaidOneTimeAccess({
          supabase: createAdminClient(),
          now,
        }),
      reportPaidAccessFinding,
      reportPaidAccessMonitorFailure,
      requireCheckInReceipt: true,
    }),
  )
}

export async function handlePaymentMonitor(
  request: Request,
  deps: PaymentMonitorDeps,
): Promise<PaymentMonitorRouteResult> {
  if (!safeBearerTokenMatches(request.headers.get("authorization"), deps.triggerSecret)) {
    return { status: 401, body: { error: "unauthorized" } }
  }

  const rateLimit = await (deps.checkRateLimit ?? checkPaymentMonitorRateLimit)(requestIp(request))
  if (!rateLimit.allowed) {
    return {
      status: rateLimit.error ? 503 : 429,
      body: { error: rateLimit.error ?? "rate_limited" },
    }
  }

  const now = deps.now?.() ?? new Date()
  const [branch, paidAccessBranch] = await Promise.all([
    runPaymentIntegrityBranch({
      monitorSlug: "payment-integrity-local",
      deadlineMs: PAYMENT_MONITOR_DEADLINE_MS,
      runPaymentIntegrity: deps.runPaymentIntegrity,
      captureCheckIn: deps.captureCheckIn ?? captureServerPaymentCheckIn,
      requireCheckInReceipt: deps.requireCheckInReceipt === true,
      flushTelemetry: deps.flushTelemetry ?? flushPaymentMonitorTelemetry,
      reportMonitorFailure: deps.reportMonitorFailure,
      now: () => now,
      clock: deps.clock,
    }),
    deps.runPaidAccessMonitor
      ? runPaidAccessMonitorBranch({
          runPaidAccessMonitor: deps.runPaidAccessMonitor,
          flushTelemetry: deps.flushTelemetry ?? flushPaymentMonitorTelemetry,
          reportFinding: deps.reportPaidAccessFinding,
          reportMonitorFailure: deps.reportPaidAccessMonitorFailure,
          now,
        })
      : Promise.resolve(null),
  ])

  const paidAccessOk = !paidAccessBranch || paidAccessBranch.ok

  return {
    status: branch.ok && branch.summary.status === "completed" && paidAccessOk ? 200 : 500,
    body: {
      paymentIntegrity: branch.summary,
      ...(paidAccessBranch ? { paidAccess: paidAccessBranch.summary } : {}),
    },
  }
}

export function safeBearerTokenMatches(
  authorization: string | null,
  expectedSecret: string | undefined,
  compare: (left: Buffer, right: Buffer) => boolean = timingSafeEqual,
): boolean {
  if (!expectedSecret) return false

  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : ""
  const actualDigest = authDigest(token)
  const expectedDigest = authDigest(expectedSecret)

  try {
    return compare(actualDigest, expectedDigest)
  } catch {
    return false
  }
}

export async function runPaymentIntegrityBranch(options: {
  monitorSlug: string
  deadlineMs: number
  runPaymentIntegrity: RunPaymentIntegrity
  captureCheckIn: (checkIn: PaymentIntegrityCheckIn) => unknown
  requireCheckInReceipt?: boolean
  flushTelemetry?: () => Promise<unknown>
  reportMonitorFailure?: (failure: PaymentIntegrityMonitorFailure) => unknown
  now?: () => Date
  clock?: () => number
}): Promise<{ ok: boolean; summary: PaymentIntegritySummary }> {
  const clock = options.clock ?? Date.now
  const startedAt = clock()
  const now = options.now?.() ?? new Date()
  const checkInId = safeCaptureCheckIn(options.captureCheckIn, {
    monitorSlug: options.monitorSlug,
    status: "in_progress",
  })

  try {
    const result = await options.runPaymentIntegrity({
      now,
      deadlineAt: new Date(now.getTime() + options.deadlineMs),
    })
    const eventTelemetryOk = await confirmTelemetryDelivery(result, options.flushTelemetry)
    const finalCheckInId = safeCaptureCheckIn(options.captureCheckIn, {
      monitorSlug: options.monitorSlug,
      status: result.status === "completed" && eventTelemetryOk ? "ok" : "error",
      checkInId,
      duration: Math.max(0, (clock() - startedAt) / 1_000),
    })
    const checkInTelemetryOk = await confirmCheckInDelivery({
      checkInId,
      finalCheckInId,
      flush: options.flushTelemetry,
      required: options.requireCheckInReceipt === true,
    })
    const telemetryOk = eventTelemetryOk && checkInTelemetryOk
    const summary = telemetryOk
      ? summarizePaymentIntegrity(result)
      : withTelemetryDeliveryFailure(summarizePaymentIntegrity(result))
    const ok = result.status === "completed" && telemetryOk
    return { ok, summary }
  } catch {
    const failure: PaymentIntegrityMonitorFailure = {
      signal: "payment_monitor_failed",
      provider: "unknown",
      reason: "provider_error",
      errorFamily: "unknown",
    }
    const eventId = await safeReportMonitorFailure(
      options.reportMonitorFailure ?? reportPaymentMonitorFailure,
      { ...failure },
    )
    const telemetryOk =
      Boolean(eventId) &&
      Boolean(options.flushTelemetry && (await flushTelemetryWithRetry(options.flushTelemetry)))
    const finalCheckInId = safeCaptureCheckIn(options.captureCheckIn, {
      monitorSlug: options.monitorSlug,
      status: "error",
      checkInId,
      duration: Math.max(0, (clock() - startedAt) / 1_000),
    })
    if (options.requireCheckInReceipt === true) {
      await confirmCheckInDelivery({
        checkInId,
        finalCheckInId,
        flush: options.flushTelemetry,
        required: true,
      })
    }
    const summary: PaymentIntegritySummary = {
      status: "error",
      counters: emptyPaymentIntegrityCounters(),
      failures: summarizeMonitorFailures([failure]),
    }
    return {
      ok: false,
      summary: telemetryOk ? summary : withTelemetryDeliveryFailure(summary),
    }
  }
}

export async function runPaidAccessMonitorBranch(options: {
  runPaidAccessMonitor: RunPaidAccessMonitor
  flushTelemetry?: () => Promise<unknown>
  reportFinding?: (finding: PaidAccessMonitorFinding) => unknown
  reportMonitorFailure?: (failure: PaidAccessMonitorFailure) => unknown
  now: Date
}): Promise<{ ok: boolean; summary: PaidAccessSummary }> {
  try {
    const result = await options.runPaidAccessMonitor({ now: options.now })
    const resultWithBranchReceipts = await reportPaidAccessResultFindings(result, {
      reportFinding: options.reportFinding,
      reportMonitorFailure: options.reportMonitorFailure,
    })
    const telemetryOk = await confirmPaidAccessTelemetryDelivery(
      resultWithBranchReceipts,
      options.flushTelemetry,
    )
    const summary = telemetryOk
      ? summarizePaidAccess(resultWithBranchReceipts)
      : withPaidAccessTelemetryDeliveryFailure(summarizePaidAccess(resultWithBranchReceipts))
    return { ok: resultWithBranchReceipts.status === "completed" && telemetryOk, summary }
  } catch {
    const failure: PaidAccessMonitorFailure = {
      signal: "payment_monitor_failed",
      provider: "unknown",
      reason: "local_lookup_error",
      errorFamily: "unknown",
    }
    const eventId = await safeReportPaidAccessMonitorFailure(options.reportMonitorFailure, failure)
    const telemetryOk =
      Boolean(eventId) &&
      Boolean(options.flushTelemetry && (await flushTelemetryWithRetry(options.flushTelemetry)))
    const summary: PaidAccessSummary = {
      status: "error",
      counters: {
        purchasesListed: 0,
        purchasesChecked: 0,
        skippedInternalTest: 0,
        active: 0,
        findings: 0,
        monitorFailures: 1,
      },
      failures: summarizePaidAccessFailures([failure]),
    }
    return {
      ok: false,
      summary: telemetryOk ? summary : withPaidAccessTelemetryDeliveryFailure(summary),
    }
  }
}

async function reportPaidAccessResultFindings(
  result: PaidAccessMonitorResult,
  reporters: {
    reportFinding?: (finding: PaidAccessMonitorFinding) => unknown
    reportMonitorFailure?: (failure: PaidAccessMonitorFailure) => unknown
  },
): Promise<PaidAccessMonitorResult> {
  const expectedReceipts = result.counters.findings + result.counters.monitorFailures
  if (expectedReceipts === 0) return result
  if (result.telemetryEventIds !== undefined) return result

  const branchReceipts: string[] = []
  if (reporters.reportFinding) {
    for (const finding of result.findings) {
      const eventId = await safeReportPaidAccessFinding(reporters.reportFinding, finding)
      if (eventId) branchReceipts.push(eventId)
    }
  }
  if (reporters.reportMonitorFailure) {
    for (const failure of result.monitorFailures) {
      const eventId = await safeReportPaidAccessMonitorFailure(
        reporters.reportMonitorFailure,
        failure,
      )
      if (eventId) branchReceipts.push(eventId)
    }
  }
  if (branchReceipts.length === 0) return result

  return {
    ...result,
    telemetryEventIds: [...(result.telemetryEventIds ?? []), ...branchReceipts],
  }
}

async function confirmTelemetryDelivery(
  result: PaymentIntegrityResult,
  flush: (() => Promise<unknown>) | undefined,
): Promise<boolean> {
  const expectedReceipts = result.counters.findings + result.counters.monitorFailures
  if (expectedReceipts === 0) return true
  const receipts = (result.telemetryEventIds ?? []).filter(isSentryEventId)
  if (receipts.length < expectedReceipts || !flush) return false
  return flushTelemetryWithRetry(flush)
}

async function confirmPaidAccessTelemetryDelivery(
  result: PaidAccessMonitorResult,
  flush: (() => Promise<unknown>) | undefined,
): Promise<boolean> {
  const expectedReceipts = result.counters.findings + result.counters.monitorFailures
  if (expectedReceipts === 0) return true
  const receipts = (result.telemetryEventIds ?? []).filter(isSentryEventId)
  if (receipts.length < expectedReceipts || !flush) return false
  return flushTelemetryWithRetry(flush)
}

async function confirmCheckInDelivery(input: {
  checkInId?: string
  finalCheckInId?: string
  flush: (() => Promise<unknown>) | undefined
  required: boolean
}): Promise<boolean> {
  if (!input.required) return true
  if (!input.checkInId || !input.finalCheckInId || !input.flush) return false
  return flushTelemetryWithRetry(input.flush)
}

async function flushTelemetryWithRetry(flush: () => Promise<unknown>): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      if ((await flush()) === true) return true
    } catch {
      // Retry once within the route budget.
    }
  }
  return false
}

export function flushPaymentMonitorTelemetry(): Promise<boolean> {
  return flushServerPaymentTelemetry(2_000)
}

async function safeReportMonitorFailure(
  reporter: (failure: PaymentIntegrityMonitorFailure) => unknown,
  failure: PaymentIntegrityMonitorFailure,
): Promise<string | undefined> {
  try {
    const result = reporter(failure)
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      const resolved = await Promise.resolve(result).catch(() => undefined)
      return isSentryEventId(resolved) ? resolved : undefined
    }
    return isSentryEventId(result) ? result : undefined
  } catch {
    // Monitor reporting must not replace the aggregate failure response.
    return undefined
  }
}

async function safeReportPaidAccessMonitorFailure(
  reporter: ((failure: PaidAccessMonitorFailure) => unknown) | undefined,
  failure: PaidAccessMonitorFailure,
): Promise<string | undefined> {
  if (!reporter) return undefined
  try {
    const result = reporter(failure)
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      const resolved = await Promise.resolve(result).catch(() => undefined)
      return isSentryEventId(resolved) ? resolved : undefined
    }
    return isSentryEventId(result) ? result : undefined
  } catch {
    return undefined
  }
}

async function safeReportPaidAccessFinding(
  reporter: ((finding: PaidAccessMonitorFinding) => unknown) | undefined,
  finding: PaidAccessMonitorFinding,
): Promise<string | undefined> {
  if (!reporter) return undefined
  try {
    const result = reporter(finding)
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      const resolved = await Promise.resolve(result).catch(() => undefined)
      return isSentryEventId(resolved) ? resolved : undefined
    }
    return isSentryEventId(result) ? result : undefined
  } catch {
    return undefined
  }
}

function reportPaymentMonitorFailure(failure: PaymentIntegrityMonitorFailure) {
  const paymentRuntime = resolvePaymentRuntime({
    VERCEL_ENV: process.env.VERCEL_ENV,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    PAYPAL_ENVIRONMENT: process.env.PAYPAL_ENVIRONMENT,
  })
  return captureServerPaymentFailure({
    signal: failure.signal,
    provider: failure.provider,
    boundary: "reconciliation",
    errorFamily: failure.errorFamily,
    commerceKind: "unknown",
    origin: "reconciliation",
    method: "unknown",
    truth: "unknown",
    live: paymentRuntime.stripeLive || paymentRuntime.paypalLive,
    isInternalTest: false,
    retryable: "true",
    status: failure.reason,
    providerReferencePresent: false,
  })
}

export function reportPaidAccessFinding(finding: PaidAccessMonitorFinding) {
  const paymentRuntime = resolvePaymentRuntime({
    VERCEL_ENV: process.env.VERCEL_ENV,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    PAYPAL_ENVIRONMENT: process.env.PAYPAL_ENVIRONMENT,
  })
  return captureServerPaymentFailure({
    signal: "paid_but_entitlement_not_active",
    provider: finding.provider,
    boundary: "entitlement",
    errorFamily: "entitlement_state",
    commerceKind: "one_time",
    origin: "reconciliation",
    method: finding.provider === "paypal" ? "paypal" : "unknown",
    truth: "succeeded",
    live: resolvePaidAccessFindingLive(finding.provider, paymentRuntime),
    isInternalTest: false,
    retryable: "true",
    status: finding.reason,
    invariant: finding.reason,
    purchaseId: finding.purchaseId,
    userId: finding.userId,
    leadId: finding.leadId,
    plan: "personal_plan_once",
    providerReferencePresent: false,
  })
}

export function resolvePaidAccessFindingLive(
  provider: PaidAccessMonitorFinding["provider"],
  paymentRuntime: { stripeLive: boolean; paypalLive: boolean },
): boolean {
  return provider === "stripe" ? paymentRuntime.stripeLive : paymentRuntime.paypalLive
}

export function reportPaidAccessMonitorFailure(failure: PaidAccessMonitorFailure) {
  const paymentRuntime = resolvePaymentRuntime({
    VERCEL_ENV: process.env.VERCEL_ENV,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    PAYPAL_ENVIRONMENT: process.env.PAYPAL_ENVIRONMENT,
  })
  return captureServerPaymentFailure({
    signal: failure.signal,
    provider: failure.provider,
    boundary: "reconciliation",
    errorFamily: failure.errorFamily,
    commerceKind: "one_time",
    origin: "reconciliation",
    method: "unknown",
    truth: "unknown",
    live: paymentRuntime.stripeLive || paymentRuntime.paypalLive,
    isInternalTest: false,
    retryable: "true",
    status: failure.reason,
    purchaseId: failure.purchaseId,
    providerReferencePresent: false,
  })
}

export function summarizePaymentIntegrity(result: PaymentIntegrityResult): PaymentIntegritySummary {
  const failures = summarizeMonitorFailures(result.monitorFailures)
  return {
    status: result.status,
    counters: result.counters,
    ...(failures.length > 0 ? { failures } : {}),
  }
}

export function summarizePaidAccess(result: PaidAccessMonitorResult): PaidAccessSummary {
  const failures = summarizePaidAccessFailures(result.monitorFailures)
  const findings = summarizePaidAccessFindings(result.findings)
  return {
    status: result.status,
    counters: result.counters,
    ...(findings.length > 0 ? { findings } : {}),
    ...(failures.length > 0 ? { failures } : {}),
  }
}

function summarizePaidAccessFindings(findings: PaidAccessMonitorFinding[]) {
  const providers = new Set(["stripe", "paypal"])
  const reasons = new Set([
    "binding_missing",
    "confirmation_pending",
    "delivery_evidence_missing",
    "fulfillment_failed_permanent",
    "fulfillment_retry_stalled",
  ])
  return findings.flatMap(({ provider, reason }) => {
    if (!providers.has(provider) || !reasons.has(reason)) return []
    return [{ provider, reason }]
  })
}

function summarizePaidAccessFailures(failures: PaidAccessMonitorFailure[]) {
  return failures.flatMap(({ provider, reason, errorFamily }) => {
    if (errorFamily !== "unknown") return []
    if (reason === "canonical_access_conflict") {
      if (provider !== "stripe" && provider !== "paypal") return []
    } else if (
      provider !== "unknown" ||
      (reason !== "local_lookup_error" && reason !== "candidate_cap")
    ) {
      return []
    }
    return [{ provider, reason, errorFamily }]
  })
}

function summarizeMonitorFailures(failures: PaymentIntegrityMonitorFailure[]) {
  const providers = new Set(["stripe", "paypal", "unknown"])
  const reasons = new Set([
    "provider_error",
    "local_lookup_error",
    "incomplete_pagination",
    "candidate_cap",
    "deadline_exhausted",
    "missing_identity",
    "invalid_candidate",
    "telemetry_delivery_failed",
  ])
  const errorFamilies = new Set(["provider_unavailable", "timeout", "unknown"])

  return failures.flatMap(({ provider, reason, errorFamily }) => {
    if (!providers.has(provider) || !reasons.has(reason) || !errorFamilies.has(errorFamily))
      return []
    return [{ provider, reason, errorFamily }]
  })
}

function withTelemetryDeliveryFailure(summary: PaymentIntegritySummary): PaymentIntegritySummary {
  const failure: PaymentIntegrityMonitorFailure = {
    signal: "payment_monitor_failed",
    provider: "unknown",
    reason: "telemetry_delivery_failed",
    errorFamily: "unknown",
  }
  return {
    ...summary,
    status: summary.status === "error" ? "error" : "monitor_failed",
    counters: {
      ...summary.counters,
      monitorFailures: summary.counters.monitorFailures + 1,
    },
    failures: [...(summary.failures ?? []), ...summarizeMonitorFailures([failure])],
  }
}

function withPaidAccessTelemetryDeliveryFailure(summary: PaidAccessSummary): PaidAccessSummary {
  const failure: PaidAccessMonitorFailure = {
    signal: "payment_monitor_failed",
    provider: "unknown",
    reason: "local_lookup_error",
    errorFamily: "unknown",
  }
  return {
    ...summary,
    status: summary.status === "error" ? "error" : "monitor_failed",
    counters: {
      ...summary.counters,
      monitorFailures: summary.counters.monitorFailures + 1,
    },
    failures: [...(summary.failures ?? []), ...summarizePaidAccessFailures([failure])],
  }
}

function isSentryEventId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{32}$/.test(value)
}

export function emptyPaymentIntegrityCounters(): PaymentIntegrityCounters {
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

async function loadPaymentIntegrityRunner(): Promise<RunPaymentIntegrity> {
  const runtimeModule = (await import(
    PAYMENT_INTEGRITY_RUNTIME_MODULE
  )) as PaymentIntegrityRuntimeModule
  const createRunner = runtimeModule.createPaymentIntegrityRunner
  if (typeof createRunner !== "function") throw new Error("payment_integrity_runtime_missing")
  return createRunner()
}

function authDigest(value: string): Buffer {
  return createHmac("sha256", "payment-monitor-route-auth-v1").update(value).digest()
}

function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}

function checkPaymentMonitorRateLimit(identifier: string): RateLimitResult {
  const now = Date.now()
  const existing = rateLimitBuckets.get(identifier)
  if (!existing || now - existing.windowStartedAt >= PAYMENT_MONITOR_RATE_LIMIT.windowMs) {
    pruneRateLimitBuckets(now)
    rateLimitBuckets.set(identifier, { windowStartedAt: now, count: 1 })
    return { allowed: true }
  }

  existing.count += 1
  return { allowed: existing.count <= PAYMENT_MONITOR_RATE_LIMIT.limit }
}

function pruneRateLimitBuckets(now: number) {
  for (const [identifier, bucket] of rateLimitBuckets) {
    if (
      now - bucket.windowStartedAt >= PAYMENT_MONITOR_RATE_LIMIT.windowMs ||
      rateLimitBuckets.size > MAX_RATE_LIMIT_KEYS
    ) {
      rateLimitBuckets.delete(identifier)
    }
  }
}

function safeCaptureCheckIn(
  captureCheckIn: (checkIn: PaymentIntegrityCheckIn) => unknown,
  checkIn: PaymentIntegrityCheckIn,
): string | undefined {
  try {
    const result = captureCheckIn(checkIn)
    return typeof result === "string" ? result : undefined
  } catch {
    return undefined
  }
}

function toNextResponse(result: PaymentMonitorRouteResult) {
  return NextResponse.json(result.body, { status: result.status })
}
