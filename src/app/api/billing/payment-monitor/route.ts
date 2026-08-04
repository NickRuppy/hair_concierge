import { createHmac, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"

import type {
  PaymentIntegrityCounters,
  PaymentIntegrityMonitorFailure,
  PaymentIntegrityResult,
} from "@/lib/billing/payment-integrity"
import { resolvePaymentRuntime } from "@/lib/billing/payment-runtime-config"
import {
  captureServerPaymentCheckIn,
  captureServerPaymentFailure,
  flushServerPaymentTelemetry,
} from "@/lib/observability/payment-server"

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
  now?: () => Date
  clock?: () => number
}

type PaymentIntegritySummary = {
  status: PaymentIntegrityResult["status"] | "error"
  counters: PaymentIntegrityCounters
  failures?: Array<Pick<PaymentIntegrityMonitorFailure, "provider" | "reason" | "errorFamily">>
}

type PaymentMonitorRouteResult = {
  status: number
  body: { paymentIntegrity: PaymentIntegritySummary } | { error: string }
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

  const branch = await runPaymentIntegrityBranch({
    monitorSlug: "payment-integrity-local",
    deadlineMs: PAYMENT_MONITOR_DEADLINE_MS,
    runPaymentIntegrity: deps.runPaymentIntegrity,
    captureCheckIn: deps.captureCheckIn ?? captureServerPaymentCheckIn,
    requireCheckInReceipt: deps.requireCheckInReceipt === true,
    flushTelemetry: deps.flushTelemetry ?? flushPaymentMonitorTelemetry,
    reportMonitorFailure: deps.reportMonitorFailure,
    now: deps.now,
    clock: deps.clock,
  })

  return {
    status: branch.ok && branch.summary.status === "completed" ? 200 : 500,
    body: { paymentIntegrity: branch.summary },
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

export function summarizePaymentIntegrity(result: PaymentIntegrityResult): PaymentIntegritySummary {
  const failures = summarizeMonitorFailures(result.monitorFailures)
  return {
    status: result.status,
    counters: result.counters,
    ...(failures.length > 0 ? { failures } : {}),
  }
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
