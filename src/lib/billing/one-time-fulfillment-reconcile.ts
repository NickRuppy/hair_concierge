import * as Sentry from "@sentry/nextjs"

import type { OneTimeActivationResult } from "./personal-plan-one-time-activation"
import { claimDuePersonalPlanOneTimeFulfillmentJobs } from "./personal-plan-one-time-activation"
import type {
  BillingProvider,
  PersonalPlanOneTimeFulfillmentJobRow,
  SupabaseBillingAnalyticsClient,
} from "./types"

export const PERSONAL_PLAN_ONE_TIME_FULFILLMENT_RECONCILE_LIMIT = 5

type ProviderKey = BillingProvider | "unknown"
type ReconcileStage =
  | "claim"
  | "purchase_provider_lookup"
  | "provider_dispatch"
  | "retry_exhausted"
  | "permanent_mismatch"

export interface ProviderCounter {
  total: number
  stripe: number
  paypal: number
  unknown: number
}

export interface PersonalPlanOneTimeFulfillmentRetryStats {
  claimed: number
  active: ProviderCounter
  paidPending: ProviderCounter
  failedRetryable: ProviderCounter
  failedPermanent: ProviderCounter
}

export type PersonalPlanOneTimeFulfillmentDispatcher = (
  job: PersonalPlanOneTimeFulfillmentJobRow,
) => Promise<OneTimeActivationResult>

export type PersonalPlanOneTimeFulfillmentDispatchers = Partial<
  Record<BillingProvider, PersonalPlanOneTimeFulfillmentDispatcher>
>

export type PersonalPlanOneTimeFulfillmentReconcileDeps = {
  supabase: SupabaseBillingAnalyticsClient
  claimDueJobs?: typeof claimDuePersonalPlanOneTimeFulfillmentJobs
  dispatchers: PersonalPlanOneTimeFulfillmentDispatchers
  captureException?: typeof captureOneTimeFulfillmentReconcileException
}

export interface OneTimeFulfillmentReconcileSentryDetails {
  provider: ProviderKey
  stage: ReconcileStage
  jobStatus?: PersonalPlanOneTimeFulfillmentJobRow["status"] | null
  attempts?: number | null
  reason?: string | null
}

export interface OneTimeFulfillmentReconcileSentryPayload {
  fingerprint: string[]
  tags: Record<string, string>
  context: Record<string, unknown>
}

interface SentryScopeLike {
  setContext(name: string, context: Record<string, unknown>): void
  setFingerprint(value: string[]): void
  setLevel(level: "error"): void
  setTag(key: string, value: string): void
}

interface SentrySinkLike {
  captureException(error: unknown): void
  withScope(callback: (scope: SentryScopeLike) => void): void
}

export async function reconcilePersonalPlanOneTimeFulfillmentRetries(
  deps: PersonalPlanOneTimeFulfillmentReconcileDeps,
): Promise<PersonalPlanOneTimeFulfillmentRetryStats> {
  const stats = createRetryStats()
  const captureException = deps.captureException ?? captureOneTimeFulfillmentReconcileException
  let jobs: PersonalPlanOneTimeFulfillmentJobRow[]

  try {
    jobs = await (deps.claimDueJobs ?? claimDuePersonalPlanOneTimeFulfillmentJobs)(deps.supabase, {
      limit: PERSONAL_PLAN_ONE_TIME_FULFILLMENT_RECONCILE_LIMIT,
    })
  } catch (error) {
    captureException(error, {
      provider: "unknown",
      stage: "claim",
      reason: errorReason(error),
    })
    throw error
  }

  stats.claimed = jobs.length

  for (const job of jobs) {
    await processClaimedJob(job, deps, stats, captureException)
  }

  return stats
}

export function buildOneTimeFulfillmentReconcileSentryPayload(
  details: OneTimeFulfillmentReconcileSentryDetails,
): OneTimeFulfillmentReconcileSentryPayload {
  const fingerprint = [`one-time-fulfillment-${details.stage}`]
  const tags: Record<string, string> = {
    "one_time_fulfillment.provider": details.provider,
    "one_time_fulfillment.stage": details.stage,
  }
  const context: Record<string, unknown> = {
    provider: details.provider,
    stage: details.stage,
  }

  addOptional(tags, context, "job_status", details.jobStatus)
  addOptional(tags, context, "attempts", details.attempts)
  addOptional(tags, context, "reason", details.reason)

  return { fingerprint, tags, context }
}

export function captureOneTimeFulfillmentReconcileException(
  error: unknown,
  details: OneTimeFulfillmentReconcileSentryDetails,
  sink: SentrySinkLike = Sentry,
) {
  const payload = buildOneTimeFulfillmentReconcileSentryPayload(details)
  sink.withScope((scope) => {
    for (const [key, value] of Object.entries(payload.tags)) scope.setTag(key, value)
    scope.setFingerprint(payload.fingerprint)
    scope.setContext("one_time_fulfillment_reconcile", payload.context)
    scope.setLevel("error")
    sink.captureException(sentrySafeError(error))
  })
}

async function processClaimedJob(
  job: PersonalPlanOneTimeFulfillmentJobRow,
  deps: PersonalPlanOneTimeFulfillmentReconcileDeps,
  stats: PersonalPlanOneTimeFulfillmentRetryStats,
  captureException: typeof captureOneTimeFulfillmentReconcileException,
) {
  let provider: ProviderKey = "unknown"
  try {
    provider = await loadPurchaseProvider(deps.supabase, job.purchase_id)
    if (provider === "unknown") {
      throw new OneTimeFulfillmentReconcileError(
        "one_time_fulfillment_purchase_provider_missing",
        "missing purchase provider for one-time fulfillment job",
        "purchase_provider_lookup",
      )
    }

    const dispatcher = deps.dispatchers[provider]
    if (!dispatcher) {
      throw new OneTimeFulfillmentReconcileError(
        "one_time_fulfillment_provider_dispatcher_missing",
        "missing provider dispatcher for one-time fulfillment job",
        "provider_dispatch",
      )
    }

    const result = await dispatcher(job)
    recordResult(stats, provider, result, captureException)
  } catch (error) {
    const stage =
      error instanceof OneTimeFulfillmentReconcileError ? error.stage : errorStage(error)
    const releasedJob = await releaseClaimedJobAfterError(deps.supabase, job, error, stage).catch(
      () => null,
    )
    const permanent = releasedJob
      ? releasedJob.status === "failed_permanent"
      : isPermanentStage(stage)
    increment(permanent ? stats.failedPermanent : stats.failedRetryable, provider)
    captureException(error, {
      provider,
      stage,
      jobStatus: releasedJob?.status ?? job.status,
      attempts: releasedJob?.attempts ?? job.attempts,
      reason: releasedJob?.last_error ?? errorReason(error),
    })
  }
}

async function releaseClaimedJobAfterError(
  supabase: SupabaseBillingAnalyticsClient,
  job: PersonalPlanOneTimeFulfillmentJobRow,
  error: unknown,
  stage: ReconcileStage,
): Promise<PersonalPlanOneTimeFulfillmentJobRow> {
  const attempts = job.attempts + 1
  const permanent = isPermanentStage(stage) || attempts >= 5
  const now = new Date()
  const { data, error: updateError } = await supabase
    .from("personal_plan_one_time_fulfillment_jobs")
    .update({
      status: permanent ? "failed_permanent" : "failed",
      attempts,
      processing_started_at: null,
      next_attempt_at: permanent ? null : nextFulfillmentAttemptAt(now, attempts),
      last_error: errorReason(error),
      updated_at: now.toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "processing")
    .eq("processing_started_at", job.processing_started_at)
    .select("*")
    .maybeSingle()

  if (updateError) throw updateError
  if (data) return data as PersonalPlanOneTimeFulfillmentJobRow

  return loadFulfillmentJob(supabase, job.id)
}

async function loadFulfillmentJob(
  supabase: SupabaseBillingAnalyticsClient,
  jobId: string,
): Promise<PersonalPlanOneTimeFulfillmentJobRow> {
  const { data, error } = await supabase
    .from("personal_plan_one_time_fulfillment_jobs")
    .select("*")
    .eq("id", jobId)
    .single()
  if (error) throw error
  return data as PersonalPlanOneTimeFulfillmentJobRow
}

function isPermanentStage(stage: ReconcileStage) {
  return stage === "purchase_provider_lookup" || stage === "permanent_mismatch"
}

function nextFulfillmentAttemptAt(now: Date, attempts: number) {
  return new Date(now.getTime() + Math.min(60, 2 ** attempts) * 60_000).toISOString()
}

async function loadPurchaseProvider(
  supabase: SupabaseBillingAnalyticsClient,
  purchaseId: string,
): Promise<ProviderKey> {
  const { data, error } = await supabase
    .from("billing_one_time_purchases")
    .select("provider")
    .eq("id", purchaseId)
    .maybeSingle()

  if (error) throw error
  const provider = (data as { provider?: unknown } | null)?.provider
  return provider === "stripe" || provider === "paypal" ? provider : "unknown"
}

function recordResult(
  stats: PersonalPlanOneTimeFulfillmentRetryStats,
  provider: BillingProvider,
  result: OneTimeActivationResult,
  captureException: typeof captureOneTimeFulfillmentReconcileException,
) {
  if (result.job?.status === "failed_permanent") {
    increment(stats.failedPermanent, provider)
    captureException(new Error("one-time fulfillment retry reached a permanent failure state"), {
      provider,
      stage: result.job.attempts >= 5 ? "retry_exhausted" : "permanent_mismatch",
      jobStatus: result.job.status,
      attempts: result.job.attempts,
      reason: "failed_permanent",
    })
    return
  }

  if (result.job?.status === "failed") {
    increment(stats.failedRetryable, provider)
    captureException(new Error("one-time fulfillment retry remains in a retryable failure state"), {
      provider,
      stage: "provider_dispatch",
      jobStatus: result.job.status,
      attempts: result.job.attempts,
      reason: "failed",
    })
    return
  }

  if (result.state === "active") {
    increment(stats.active, provider)
    return
  }

  increment(stats.paidPending, provider)
}

function createRetryStats(): PersonalPlanOneTimeFulfillmentRetryStats {
  return {
    claimed: 0,
    active: createProviderCounter(),
    paidPending: createProviderCounter(),
    failedRetryable: createProviderCounter(),
    failedPermanent: createProviderCounter(),
  }
}

function createProviderCounter(): ProviderCounter {
  return { total: 0, stripe: 0, paypal: 0, unknown: 0 }
}

function increment(counter: ProviderCounter, provider: ProviderKey) {
  counter.total += 1
  counter[provider] += 1
}

function errorStage(error: unknown): ReconcileStage {
  const code = errorCode(error)
  if (code.includes("mismatch") || code.includes("invalid") || code.includes("incomplete")) {
    return "permanent_mismatch"
  }
  return "provider_dispatch"
}

function errorCode(error: unknown): string {
  if (!error || typeof error !== "object") return ""
  const code = (error as { code?: unknown }).code
  return typeof code === "string" ? code : ""
}

function errorReason(error: unknown): string {
  const code = errorCode(error)
  if (code) return code.slice(0, 80)
  return error instanceof Error ? error.name.slice(0, 80) : "unknown"
}

function sentrySafeError(error: unknown): Error {
  const safe = new Error(errorReason(error))
  safe.name = error instanceof Error ? error.name : "OneTimeFulfillmentReconcileError"
  return safe
}

function addOptional(
  tags: Record<string, string>,
  context: Record<string, unknown>,
  key: string,
  value: unknown,
) {
  if (value == null || value === "") return
  const tagKey = `one_time_fulfillment.${key}`
  tags[tagKey] = String(value).slice(0, 80)
  context[key] = value
}

class OneTimeFulfillmentReconcileError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly stage: ReconcileStage,
  ) {
    super(message)
    this.name = "OneTimeFulfillmentReconcileError"
  }
}
