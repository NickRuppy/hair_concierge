import assert from "node:assert/strict"
import test from "node:test"

import {
  buildOneTimeFulfillmentReconcileSentryPayload,
  captureOneTimeFulfillmentReconcileException,
  PERSONAL_PLAN_ONE_TIME_FULFILLMENT_RECONCILE_LIMIT,
  reconcilePersonalPlanOneTimeFulfillmentRetries,
} from "../src/lib/billing/one-time-fulfillment-reconcile"
import type { OneTimeActivationResult } from "../src/lib/billing/personal-plan-one-time-activation"
import type {
  BillingProvider,
  PersonalPlanOneTimeFulfillmentJobRow,
} from "../src/lib/billing/types"

test("one-time fulfillment retry claims at most five due jobs and dispatches by stored provider", async () => {
  const jobs = [
    fulfillmentJob({ id: "job-active", purchase_id: "purchase-stripe-active" }),
    fulfillmentJob({ id: "job-pending", purchase_id: "purchase-paypal-pending" }),
    fulfillmentJob({ id: "job-failed", purchase_id: "purchase-stripe-failed" }),
  ]
  const calls: Array<{ provider: BillingProvider; jobId: string }> = []
  let claimedLimit = 0

  const stats = await reconcilePersonalPlanOneTimeFulfillmentRetries({
    supabase: supabaseWithProviders({
      "purchase-stripe-active": "stripe",
      "purchase-paypal-pending": "paypal",
      "purchase-stripe-failed": "stripe",
    }) as never,
    claimDueJobs: async (_supabase, options = {}) => {
      claimedLimit = options.limit ?? 0
      return jobs
    },
    dispatchers: {
      stripe: async (job) => {
        calls.push({ provider: "stripe", jobId: job.id })
        return activationResult(
          job.purchase_id === "purchase-stripe-failed" ? "failed" : "active",
          {
            provider: "stripe",
            job,
          },
        )
      },
      paypal: async (job) => {
        calls.push({ provider: "paypal", jobId: job.id })
        return activationResult("paid_pending", { provider: "paypal", job })
      },
    },
  })

  assert.equal(claimedLimit, PERSONAL_PLAN_ONE_TIME_FULFILLMENT_RECONCILE_LIMIT)
  assert.deepEqual(calls, [
    { provider: "stripe", jobId: "job-active" },
    { provider: "paypal", jobId: "job-pending" },
    { provider: "stripe", jobId: "job-failed" },
  ])
  assert.deepEqual(stats, {
    claimed: 3,
    active: { total: 1, stripe: 1, paypal: 0, unknown: 0 },
    paidPending: { total: 1, stripe: 0, paypal: 1, unknown: 0 },
    failedRetryable: { total: 1, stripe: 1, paypal: 0, unknown: 0 },
    failedPermanent: { total: 0, stripe: 0, paypal: 0, unknown: 0 },
  })
})

test("a returned failed job is counted and reported before an otherwise active result", async () => {
  const job = fulfillmentJob({ id: "job-after-delivery", purchase_id: "purchase-after-delivery" })
  const captured: Array<{ error: unknown; details: unknown }> = []

  const stats = await reconcilePersonalPlanOneTimeFulfillmentRetries({
    supabase: supabaseWithProviders({ "purchase-after-delivery": "stripe" }) as never,
    claimDueJobs: async () => [job],
    dispatchers: {
      stripe: async () =>
        activationResult("active", {
          provider: "stripe",
          job: fulfillmentJob({ status: "failed", attempts: 2 }),
        }),
    },
    captureException: (error, details) => captured.push({ error, details }),
  })

  assert.deepEqual(stats.active, { total: 0, stripe: 0, paypal: 0, unknown: 0 })
  assert.deepEqual(stats.failedRetryable, { total: 1, stripe: 1, paypal: 0, unknown: 0 })
  assert.equal(captured.length, 1)
  assert.deepEqual(captured[0]?.details, {
    provider: "stripe",
    stage: "provider_dispatch",
    jobStatus: "failed",
    attempts: 2,
    reason: "failed",
  })
  assert.doesNotMatch(JSON.stringify(captured), /job-after-delivery|purchase-after-delivery/)
})

test("a returned permanent failure is not counted active after delivery", async () => {
  const job = fulfillmentJob({ id: "job-terminal", purchase_id: "purchase-terminal" })
  const captured: Array<{ error: unknown; details: unknown }> = []

  const stats = await reconcilePersonalPlanOneTimeFulfillmentRetries({
    supabase: supabaseWithProviders({ "purchase-terminal": "paypal" }) as never,
    claimDueJobs: async () => [job],
    dispatchers: {
      paypal: async () =>
        activationResult("active", {
          provider: "paypal",
          job: fulfillmentJob({ status: "failed_permanent", attempts: 5 }),
        }),
    },
    captureException: (error, details) => captured.push({ error, details }),
  })

  assert.deepEqual(stats.active, { total: 0, stripe: 0, paypal: 0, unknown: 0 })
  assert.deepEqual(stats.failedPermanent, { total: 1, stripe: 0, paypal: 1, unknown: 0 })
  assert.deepEqual(captured[0]?.details, {
    provider: "paypal",
    stage: "retry_exhausted",
    jobStatus: "failed_permanent",
    attempts: 5,
    reason: "failed_permanent",
  })
})

test("one-time fulfillment retry isolates provider failures and reports count-only stats", async () => {
  const captured: unknown[] = []
  const job = fulfillmentJob({
    id: "job-secret",
    purchase_id: "purchase-secret",
    consent_id: "consent-secret",
    status: "processing",
  })

  const stats = await reconcilePersonalPlanOneTimeFulfillmentRetries({
    supabase: supabaseWithProviders({ "purchase-secret": "stripe" }, { jobs: [job] }) as never,
    claimDueJobs: async () => [job],
    dispatchers: {
      stripe: async () => {
        const error = new Error("failed for buyer@example.com and pi_secret_123")
        const codedError = error as Error & { code: string }
        codedError.code = "checkout_one_time_invalid"
        throw error
      },
    },
    captureException: (error, details) => {
      captured.push({ error, details })
    },
  })

  assert.deepEqual(stats, {
    claimed: 1,
    active: { total: 0, stripe: 0, paypal: 0, unknown: 0 },
    paidPending: { total: 0, stripe: 0, paypal: 0, unknown: 0 },
    failedRetryable: { total: 0, stripe: 0, paypal: 0, unknown: 0 },
    failedPermanent: { total: 1, stripe: 1, paypal: 0, unknown: 0 },
  })
  assert.equal(captured.length, 1)
  assert.equal(typeof (captured[0] as { error?: unknown }).error, "object")
  assert.deepEqual((captured[0] as { details?: unknown }).details, {
    provider: "stripe",
    stage: "permanent_mismatch",
    jobStatus: "failed_permanent",
    attempts: 1,
    reason: "checkout_one_time_invalid",
  })
  assert.doesNotMatch(JSON.stringify(stats), /secret|buyer@example\.com|pi_secret_123/)
  assert.doesNotMatch(JSON.stringify(captured[0]), /buyer@example\.com|pi_secret_123/)
})

test("one-time fulfillment retry records provider-vs-database gaps without dispatching", async () => {
  let dispatched = false
  const sentryDetails: unknown[] = []
  const job = fulfillmentJob({ purchase_id: "missing-purchase", status: "processing" })

  const stats = await reconcilePersonalPlanOneTimeFulfillmentRetries({
    supabase: supabaseWithProviders({}, { jobs: [job] }) as never,
    claimDueJobs: async () => [job],
    dispatchers: {
      stripe: async () => {
        dispatched = true
        throw new Error("should not dispatch")
      },
    },
    captureException: (_error, details) => {
      sentryDetails.push(details)
    },
  })

  assert.equal(dispatched, false)
  assert.deepEqual(stats.failedPermanent, { total: 1, stripe: 0, paypal: 0, unknown: 1 })
  assert.deepEqual(sentryDetails, [
    {
      provider: "unknown",
      stage: "purchase_provider_lookup",
      jobStatus: "failed_permanent",
      attempts: 1,
      reason: "one_time_fulfillment_purchase_provider_missing",
    },
  ])
})

test("a throwing provider dispatcher releases a genuinely unhandled processing claim for retry", async () => {
  const job = fulfillmentJob({
    id: "job-retryable",
    purchase_id: "purchase-stripe-retryable",
    status: "processing",
    processing_started_at: "2026-07-31T10:00:00.000Z",
  })
  const captured: unknown[] = []
  const stats = await reconcilePersonalPlanOneTimeFulfillmentRetries({
    supabase: supabaseWithProviders(
      { "purchase-stripe-retryable": "stripe" },
      { jobs: [job] },
    ) as never,
    claimDueJobs: async () => [job],
    dispatchers: {
      stripe: async () => {
        throw new Error("provider GET timed out")
      },
    },
    captureException: (_error, details) => {
      captured.push(details)
    },
  })

  assert.deepEqual(stats.failedRetryable, { total: 1, stripe: 1, paypal: 0, unknown: 0 })
  assert.equal(job.status, "failed")
  assert.equal(job.attempts, 1)
  assert.equal(job.processing_started_at, null)
  assert.ok(job.next_attempt_at)
  assert.deepEqual(captured, [
    {
      provider: "stripe",
      stage: "provider_dispatch",
      jobStatus: "failed",
      attempts: 1,
      reason: "Error",
    },
  ])
})

test("a stale outer dispatcher release does not overwrite a newer processing lease", async () => {
  const claimedJob = fulfillmentJob({
    id: "job-stale-release",
    purchase_id: "purchase-stale-release",
    status: "processing",
    processing_started_at: "2026-07-31T10:00:00.000Z",
  })
  const renewedJob = fulfillmentJob({
    ...claimedJob,
    processing_started_at: "2026-07-31T10:15:00.000Z",
  })
  const captured: unknown[] = []

  const stats = await reconcilePersonalPlanOneTimeFulfillmentRetries({
    supabase: supabaseWithProviders(
      { "purchase-stale-release": "stripe" },
      { jobs: [renewedJob] },
    ) as never,
    claimDueJobs: async () => [claimedJob],
    dispatchers: {
      stripe: async () => {
        throw new Error("worker A timed out after worker B renewed the lease")
      },
    },
    captureException: (_error, details) => captured.push(details),
  })

  assert.deepEqual(stats.failedRetryable, { total: 1, stripe: 1, paypal: 0, unknown: 0 })
  assert.equal(renewedJob.status, "processing")
  assert.equal(renewedJob.attempts, 0)
  assert.equal(renewedJob.processing_started_at, "2026-07-31T10:15:00.000Z")
  assert.equal(renewedJob.next_attempt_at, null)
  assert.deepEqual(captured, [
    {
      provider: "stripe",
      stage: "provider_dispatch",
      jobStatus: "processing",
      attempts: 0,
      reason: "Error",
    },
  ])
})

test("a processor-persisted permanent failure survives an outer dispatcher error", async () => {
  const claimedJob = fulfillmentJob({
    id: "job-processor-terminal",
    purchase_id: "purchase-processor-terminal",
    status: "processing",
    attempts: 1,
    processing_started_at: "2026-07-31T10:00:00.000Z",
  })
  const persistedJob = fulfillmentJob({ ...claimedJob })
  const captured: unknown[] = []

  const stats = await reconcilePersonalPlanOneTimeFulfillmentRetries({
    supabase: supabaseWithProviders(
      { "purchase-processor-terminal": "stripe" },
      { jobs: [persistedJob] },
    ) as never,
    claimDueJobs: async () => [claimedJob],
    dispatchers: {
      stripe: async () => {
        Object.assign(persistedJob, {
          status: "failed_permanent",
          attempts: 2,
          processing_started_at: null,
          next_attempt_at: null,
          last_error: "one_time_fulfillment_consent_missing",
        })
        throw new Error("processor rethrew after persisting its terminal verdict")
      },
    },
    captureException: (_error, details) => captured.push(details),
  })

  assert.deepEqual(stats.failedPermanent, { total: 1, stripe: 1, paypal: 0, unknown: 0 })
  assert.equal(persistedJob.status, "failed_permanent")
  assert.equal(persistedJob.attempts, 2)
  assert.equal(persistedJob.last_error, "one_time_fulfillment_consent_missing")
  assert.deepEqual(captured, [
    {
      provider: "stripe",
      stage: "provider_dispatch",
      jobStatus: "failed_permanent",
      attempts: 2,
      reason: "one_time_fulfillment_consent_missing",
    },
  ])
})

test("a processor-persisted retryable verification failure stays retryable", async () => {
  const claimedJob = fulfillmentJob({
    id: "job-processor-retryable",
    purchase_id: "purchase-processor-retryable",
    status: "processing",
    attempts: 1,
  })
  const persistedJob = fulfillmentJob({ ...claimedJob })

  const stats = await reconcilePersonalPlanOneTimeFulfillmentRetries({
    supabase: supabaseWithProviders(
      { "purchase-processor-retryable": "stripe" },
      { jobs: [persistedJob] },
    ) as never,
    claimDueJobs: async () => [claimedJob],
    dispatchers: {
      stripe: async () => {
        Object.assign(persistedJob, {
          status: "failed",
          attempts: 2,
          processing_started_at: null,
          last_error: "checkout_session_incomplete",
        })
        throw Object.assign(new Error("checkout session is not complete"), {
          code: "checkout_session_incomplete",
        })
      },
    },
    captureException: () => {},
  })

  assert.deepEqual(stats.failedRetryable, { total: 1, stripe: 1, paypal: 0, unknown: 0 })
  assert.deepEqual(stats.failedPermanent, { total: 0, stripe: 0, paypal: 0, unknown: 0 })
  assert.equal(persistedJob.status, "failed")
})

test("a throwing purchase lookup immediately releases the claim for retry", async () => {
  const job = fulfillmentJob({
    id: "job-lookup",
    purchase_id: "purchase-lookup",
    status: "processing",
    processing_started_at: "2026-07-31T10:00:00.000Z",
  })
  const captured: unknown[] = []
  const stats = await reconcilePersonalPlanOneTimeFulfillmentRetries({
    supabase: supabaseWithProviders(
      {},
      { jobs: [job], lookupError: new Error("database down") },
    ) as never,
    claimDueJobs: async () => [job],
    dispatchers: {},
    captureException: (_error, details) => {
      captured.push(details)
    },
  })

  assert.deepEqual(stats.failedRetryable, { total: 1, stripe: 0, paypal: 0, unknown: 1 })
  assert.equal(job.status, "failed")
  assert.equal(job.attempts, 1)
  assert.equal(job.processing_started_at, null)
  assert.ok(job.next_attempt_at)
  assert.deepEqual(captured, [
    {
      provider: "unknown",
      stage: "provider_dispatch",
      jobStatus: "failed",
      attempts: 1,
      reason: "Error",
    },
  ])
})

test("one-time fulfillment retry Sentry payload has stable fingerprints and no raw identifiers", () => {
  const payload = buildOneTimeFulfillmentReconcileSentryPayload({
    provider: "paypal",
    stage: "retry_exhausted",
    jobStatus: "failed_permanent",
    attempts: 5,
    reason: "failed_permanent",
  })

  assert.deepEqual(payload.fingerprint, ["one-time-fulfillment-retry_exhausted"])
  assert.equal(payload.tags["one_time_fulfillment.provider"], "paypal")
  assert.equal(payload.tags["one_time_fulfillment.stage"], "retry_exhausted")
  assert.doesNotMatch(JSON.stringify(payload), /job-|purchase-|consent-|@|pi_|cs_|token/)
})

test("one-time fulfillment retry captures sanitized Sentry errors", () => {
  const captured: unknown[] = []
  const fingerprints: unknown[] = []
  captureOneTimeFulfillmentReconcileException(
    Object.assign(new Error("buyer@example.com pi_secret_raw"), {
      code: "checkout_one_time_invalid",
    }),
    { provider: "stripe", stage: "permanent_mismatch", reason: "checkout_one_time_invalid" },
    {
      captureException(error) {
        captured.push(error)
      },
      withScope(callback) {
        callback({
          setContext() {},
          setFingerprint(value) {
            fingerprints.push(value)
          },
          setLevel() {},
          setTag() {},
        })
      },
    },
  )

  assert.deepEqual(fingerprints, [["one-time-fulfillment-permanent_mismatch"]])
  assert.match(String((captured[0] as Error).message), /checkout_one_time_invalid/)
  assert.doesNotMatch(JSON.stringify(captured), /buyer@example\.com|pi_secret_raw/)
})

function supabaseWithProviders(
  providers: Record<string, BillingProvider>,
  options: { jobs?: PersonalPlanOneTimeFulfillmentJobRow[]; lookupError?: Error } = {},
) {
  return {
    from(table: string) {
      if (table === "billing_one_time_purchases") {
        return {
          select(columns: string) {
            assert.equal(columns, "provider")
            return {
              eq(column: string, value: string) {
                assert.equal(column, "id")
                return {
                  async maybeSingle() {
                    if (options.lookupError) return { data: null, error: options.lookupError }
                    const provider = providers[value]
                    return { data: provider ? { provider } : null, error: null }
                  },
                }
              },
            }
          },
        }
      }

      assert.equal(table, "personal_plan_one_time_fulfillment_jobs")
      return {
        select(columns: string) {
          assert.equal(columns, "*")
          return {
            eq(column: string, value: string) {
              assert.equal(column, "id")
              return {
                async single() {
                  const job = options.jobs?.find((candidate) => candidate.id === value) ?? null
                  return { data: job, error: null }
                },
              }
            },
          }
        },
        update(patch: Record<string, unknown>) {
          return {
            eq(column: string, value: string) {
              assert.equal(column, "id")
              return {
                eq(statusColumn: string, status: string) {
                  assert.equal(statusColumn, "status")
                  return {
                    eq(leaseColumn: string, leaseStartedAt: string | null) {
                      assert.equal(leaseColumn, "processing_started_at")
                      return {
                        select() {
                          return {
                            async maybeSingle() {
                              const job =
                                options.jobs?.find((candidate) => candidate.id === value) ?? null
                              if (
                                !job ||
                                job.status !== status ||
                                job.processing_started_at !== leaseStartedAt
                              ) {
                                return { data: null, error: null }
                              }
                              Object.assign(job, patch)
                              return { data: job, error: null }
                            },
                          }
                        },
                      }
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  }
}

function fulfillmentJob(
  overrides: Partial<PersonalPlanOneTimeFulfillmentJobRow> = {},
): PersonalPlanOneTimeFulfillmentJobRow {
  const job: PersonalPlanOneTimeFulfillmentJobRow = {
    id: "job-1",
    purchase_id: "purchase-1",
    consent_id: "consent-1",
    status: "pending",
    attempts: 0,
    next_attempt_at: null,
    processing_started_at: null,
    last_error: null,
    delivery_provider: null,
    delivery_reference: null,
    canonical_content_sha256: null,
    delivered_at: null,
    created_at: "2026-07-31T10:00:00.000Z",
    updated_at: "2026-07-31T10:00:00.000Z",
    ...overrides,
  }
  return job.status === "processing" && !job.processing_started_at
    ? { ...job, processing_started_at: "2026-07-31T10:00:00.000Z" }
    : job
}

function activationResult(
  state: OneTimeActivationResult["state"] | "failed",
  input: {
    provider: BillingProvider
    job: PersonalPlanOneTimeFulfillmentJobRow
  },
): OneTimeActivationResult {
  const job =
    state === "failed"
      ? { ...input.job, status: "failed" as const, attempts: input.job.attempts + 1 }
      : input.job
  return {
    state: state === "failed" ? "paid_pending" : state,
    purchase: { id: input.job.purchase_id, provider: input.provider } as never,
    consent: { id: input.job.consent_id } as never,
    job,
  }
}
