import assert from "node:assert/strict"
import test from "node:test"

import {
  activateVerifiedOneTimePayment,
  claimDuePersonalPlanOneTimeFulfillmentJobs,
  claimPersonalPlanOneTimeFulfillmentJob,
  OneTimeActivationError,
  processPersonalPlanOneTimeFulfillmentJob,
  type VerifiedOneTimePayment,
} from "../src/lib/billing/personal-plan-one-time-activation"
import type {
  BillingAnalyticsDeliveryRow,
  BillingAnalyticsOutboxRow,
  BillingOneTimePurchaseRow,
  PersonalPlanOneTimeFulfillmentJobRow,
} from "../src/lib/billing/types"
import type { PersonalPlanOneTimeCheckoutConsentRow } from "../src/lib/billing/personal-plan-one-time-consents"

test("account failure after capture keeps purchase and fulfillment job for cron replay", async () => {
  const db = createActivationDb()
  const first = await activateVerifiedOneTimePayment(verifiedPayment(), {
    supabase: db.supabase as never,
    ensureAccount: async () => {
      throw new Error("account creation unavailable")
    },
    now: fixedNow,
  })

  assert.equal(first.state, "paid_pending")
  assert.equal(db.purchases.length, 1)
  assert.equal(db.purchases[0]?.user_id, null)
  assert.equal(db.purchases[0]?.consent_id, "consent-1")
  assert.equal(db.jobs.length, 1)
  assert.equal(db.jobs[0]?.status, "failed")
  assert.equal(db.outbox.length, 0)

  const replay = await processPersonalPlanOneTimeFulfillmentJob(
    claimFulfillmentJobForTest(db.jobs[0]!),
    {
      supabase: db.supabase as never,
      resolveVerifiedPaymentForRetry: async () => verifiedPayment(),
      ensureAccount: async () => ({ userId: "user-1" }),
      sendConfirmation: async () => ({ confirmationReference: "customerio:message:stripe:pi_123" }),
      finalizeLockedPlan: async () => ({
        lockedPlan: { routine: "fixed" },
        deliveryProvider: "customerio",
        deliveryReference: "customerio:delivery:1",
      }),
      now: fixedNow,
    },
  )

  assert.equal(replay.state, "active")
  assert.equal(db.purchases.length, 1)
  assert.equal(db.purchases[0]?.user_id, "user-1")
  assert.equal(db.jobs.length, 1)
  assert.equal(db.jobs[0]?.status, "completed")
  assert.equal(db.outbox.length, 1)
})

test("post-purchase hook runs after purchase persistence and before fulfillment", async () => {
  const db = createActivationDb()
  const calls: string[] = []

  const result = await activateVerifiedOneTimePayment(verifiedPayment(), {
    supabase: db.supabase as never,
    postPurchasePersisted: async ({ purchase, consent }) => {
      calls.push("post_purchase")
      assert.equal(purchase.id, db.purchases[0]?.id)
      assert.equal(purchase.user_id, null)
      assert.equal(consent.id, "consent-1")
      assert.equal(db.jobs.length, 1)
      assert.equal(db.jobs[0]?.status, "pending")
      return consent
    },
    ensureAccount: async () => {
      calls.push("account")
      return { userId: "user-1" }
    },
    sendConfirmation: async () => {
      calls.push("confirmation")
      return { confirmationReference: "customerio:message:stripe:pi_123" }
    },
    finalizeLockedPlan: async () => {
      calls.push("finalize")
      return {
        lockedPlan: { routine: "fixed" },
        deliveryProvider: "customerio",
        deliveryReference: "customerio:delivery:1",
      }
    },
    now: fixedNow,
  })

  assert.equal(result.state, "active")
  assert.deepEqual(calls, ["post_purchase", "account", "confirmation", "finalize"])
})

test("post-purchase hook failure leaves durable paid-pending purchase and replay retries the hook", async () => {
  const db = createActivationDb()
  const payment = verifiedPayment({
    provider: "paypal",
    providerTransactionId: "CAPTURE-1",
    providerOrderId: "ORDER-1",
  })
  let hookAttempts = 0
  let accountCalls = 0

  const first = await activateVerifiedOneTimePayment(payment, {
    supabase: db.supabase as never,
    postPurchasePersisted: async () => {
      hookAttempts += 1
      throw new Error("provider reference bind unavailable")
    },
    ensureAccount: async () => {
      accountCalls += 1
      return { userId: "user-1" }
    },
    now: fixedNow,
  })

  assert.equal(first.state, "paid_pending")
  assert.equal(db.purchases.length, 1)
  assert.equal(db.purchases[0]?.provider_transaction_id, "CAPTURE-1")
  assert.equal(db.purchases[0]?.user_id, null)
  assert.equal(db.jobs.length, 1)
  assert.equal(db.jobs[0]?.status, "pending")
  assert.equal(accountCalls, 0)

  const replay = await activateVerifiedOneTimePayment(payment, {
    supabase: db.supabase as never,
    postPurchasePersisted: async ({ consent }) => {
      hookAttempts += 1
      consent.paypal_order_id = "ORDER-1"
      consent.paypal_capture_id = "CAPTURE-1"
      return consent
    },
    ensureAccount: async () => {
      accountCalls += 1
      return { userId: "user-1" }
    },
    sendConfirmation: async () => ({
      confirmationReference: "customerio:message:paypal:CAPTURE-1",
    }),
    finalizeLockedPlan: async () => ({
      lockedPlan: { routine: "fixed" },
      deliveryProvider: "customerio",
      deliveryReference: "customerio:delivery:paypal",
    }),
    now: fixedNow,
  })

  assert.equal(replay.state, "active")
  assert.equal(hookAttempts, 2)
  assert.equal(accountCalls, 1)
  assert.equal(db.purchases.length, 1)
  assert.equal(db.jobs.length, 1)
  assert.equal(db.consents[0]?.paypal_capture_id, "CAPTURE-1")
})

test("confirmation failure leaves paid-pending state and replay finalizes without duplicate rows", async () => {
  const db = createActivationDb()
  let sendAttempts = 0

  const first = await activateVerifiedOneTimePayment(verifiedPayment(), {
    supabase: db.supabase as never,
    ensureAccount: async () => ({ userId: "user-1" }),
    sendConfirmation: async () => {
      sendAttempts += 1
      throw new Error("Customer.io 503 for buyer@example.com")
    },
    finalizeLockedPlan: async () => assert.fail("must not finalize before confirmation"),
    now: fixedNow,
  })

  assert.equal(first.state, "paid_pending")
  assert.equal(db.purchases.length, 1)
  assert.equal(db.purchases[0]?.user_id, "user-1")
  assert.equal(db.jobs.length, 1)
  assert.equal(db.jobs[0]?.status, "failed")
  assert.equal(db.jobs[0]?.last_error?.includes("buyer@example.com"), false)
  assert.equal(db.outbox.length, 0)
  db.jobs[0]!.next_attempt_at = null

  const second = await activateVerifiedOneTimePayment(verifiedPayment(), {
    supabase: db.supabase as never,
    ensureAccount: async () => ({ userId: "user-1" }),
    sendConfirmation: async () => {
      sendAttempts += 1
      return { confirmationReference: "customerio:message:stripe:pi_123" }
    },
    finalizeLockedPlan: async () => ({
      lockedPlan: { steps: ["wash", "condition"], version: 1 },
      deliveryProvider: "customerio",
      deliveryReference: "customerio:delivery:1",
      deliveredAt: "2026-07-31T10:03:00.000Z",
    }),
    now: fixedNow,
  })

  assert.equal(second.state, "active")
  assert.equal(sendAttempts, 2)
  assert.equal(db.purchases.length, 1)
  assert.equal(db.jobs.length, 1)
  assert.equal(db.jobs[0]?.status, "completed")
  assert.equal(db.outbox.length, 1)
  assert.equal(db.deliveries.length, 3)
  assert.equal(db.consents[0]?.generated_content_sha256?.length, 64)
})

test("concurrent activation replays respect the fulfillment lease", async () => {
  const db = createActivationDb()
  let sendAttempts = 0
  let finalizeAttempts = 0
  let releaseSend: () => void = () => {
    assert.fail("confirmation send was not started")
  }
  const sendStarted = new Promise<void>((resolve) => {
    void resolve
  })
  let markSendStarted: (() => void) | null = null
  const sendStartedSignal = new Promise<void>((resolve) => {
    markSendStarted = resolve
  })

  const first = activateVerifiedOneTimePayment(verifiedPayment(), {
    supabase: db.supabase as never,
    ensureAccount: async () => ({ userId: "user-1" }),
    sendConfirmation: async () => {
      sendAttempts += 1
      markSendStarted?.()
      await new Promise<void>((resolve) => {
        releaseSend = resolve
      })
      return { confirmationReference: "customerio:message:stripe:pi_123" }
    },
    finalizeLockedPlan: async () => {
      finalizeAttempts += 1
      return {
        lockedPlan: { routine: "fixed" },
        deliveryProvider: "customerio",
        deliveryReference: "customerio:delivery:1",
      }
    },
    now: fixedNow,
  })

  await sendStartedSignal
  assert.equal(db.jobs[0]?.status, "processing")

  const second = await activateVerifiedOneTimePayment(verifiedPayment(), {
    supabase: db.supabase as never,
    ensureAccount: async () => ({ userId: "user-1" }),
    sendConfirmation: async () => {
      throw new Error("second replay must not send")
    },
    finalizeLockedPlan: async () => {
      throw new Error("second replay must not finalize")
    },
    now: fixedNow,
  })

  assert.equal(second.state, "paid_pending")
  releaseSend()
  const firstResult = await first

  assert.equal(firstResult.state, "active")
  assert.equal(sendAttempts, 1)
  assert.equal(finalizeAttempts, 1)
  assert.equal(db.outbox.length, 1)
  assert.equal(db.jobs[0]?.status, "completed")
  void sendStarted
})

test("inline activation respects fulfillment retry backoff", async () => {
  const purchase = paidPurchase({ user_id: null })
  const db = createActivationDb({
    purchases: [purchase],
    jobs: [
      fulfillmentJob({
        purchase_id: purchase.id,
        status: "failed",
        attempts: 1,
        next_attempt_at: "2026-07-31T11:00:00.000Z",
      }),
    ],
  })

  const result = await activateVerifiedOneTimePayment(verifiedPayment(), {
    supabase: db.supabase as never,
    ensureAccount: async () => {
      throw new Error("backoff should prevent account resolution")
    },
    now: fixedNow,
  })

  assert.equal(result.state, "paid_pending")
  assert.equal(db.jobs[0]?.status, "failed")
  assert.equal(db.outbox.length, 0)
})

test("activation links quiz/profile through an explicit callback after user binding", async () => {
  const db = createActivationDb()
  const calls: Array<{ userId: string; consentId: string; purchaseUserId: string | null }> = []
  let finalizerPurchaseUserId: string | null | undefined

  await activateVerifiedOneTimePayment(verifiedPayment(), {
    supabase: db.supabase as never,
    ensureAccount: async () => ({ userId: "user-1" }),
    linkQuizToProfile: async ({ userId, consent, purchase }) => {
      calls.push({ userId, consentId: consent.id, purchaseUserId: purchase.user_id })
    },
    sendConfirmation: async () => ({ confirmationReference: "customerio:message:stripe:pi_123" }),
    finalizeLockedPlan: async ({ purchase }) => {
      finalizerPurchaseUserId = purchase.user_id
      return {
        lockedPlan: { routine: "fixed" },
        deliveryProvider: "customerio",
        deliveryReference: "customerio:delivery:1",
      }
    },
    now: fixedNow,
  })

  assert.deepEqual(calls, [{ userId: "user-1", consentId: "consent-1", purchaseUserId: "user-1" }])
  assert.equal(finalizerPurchaseUserId, "user-1")
})

test("finalization failure keeps sent confirmation evidence and retry processor can complete it", async () => {
  const db = createActivationDb()

  const first = await activateVerifiedOneTimePayment(verifiedPayment(), {
    supabase: db.supabase as never,
    ensureAccount: async () => ({ userId: "user-1" }),
    sendConfirmation: async () => ({ confirmationReference: "customerio:message:stripe:pi_123" }),
    finalizeLockedPlan: async () => {
      throw new Error("artifact store unavailable")
    },
    now: fixedNow,
  })

  assert.equal(first.state, "paid_pending")
  assert.equal(first.consent.confirmation_status, "sent")
  assert.equal(db.consents[0]?.confirmation_status, "sent")
  assert.equal(db.jobs[0]?.status, "failed")

  const processed = await processPersonalPlanOneTimeFulfillmentJob(
    claimFulfillmentJobForTest(db.jobs[0]!),
    {
      supabase: db.supabase as never,
      resolveVerifiedPaymentForRetry: async () => verifiedPayment(),
      ensureAccount: async () => assert.fail("bound purchases must not create another account"),
      finalizeLockedPlan: async () => ({
        lockedPlan: { routine: "retry fixed" },
        deliveryProvider: "customerio",
        deliveryReference: "customerio:delivery:retry",
      }),
      now: fixedNow,
    },
  )

  assert.equal(processed.state, "active")
  assert.equal(db.outbox.length, 1)
  assert.equal(db.jobs[0]?.status, "completed")
})

test("outbox insertion failure is retryable and does not block fulfillment access", async () => {
  const db = createActivationDb({ failOutboxInserts: 1 })
  const first = await activateVerifiedOneTimePayment(verifiedPayment(), {
    supabase: db.supabase as never,
    ensureAccount: async () => ({ userId: "user-1" }),
    sendConfirmation: async () => ({ confirmationReference: "customerio:message:stripe:pi_123" }),
    finalizeLockedPlan: async () => ({
      lockedPlan: { routine: "fixed" },
      deliveryProvider: "customerio",
      deliveryReference: "customerio:delivery:1",
    }),
    now: fixedNow,
  })

  assert.equal(first.state, "active")
  assert.equal(db.outbox.length, 0)
  assert.equal(db.jobs[0]?.status, "failed")
  assert.equal(db.consents[0]?.delivered_at != null, true)

  const replay = await processPersonalPlanOneTimeFulfillmentJob(
    claimFulfillmentJobForTest(db.jobs[0]!),
    {
      supabase: db.supabase as never,
      resolveVerifiedPaymentForRetry: async () => verifiedPayment(),
      ensureAccount: async () => assert.fail("bound purchases must not create another account"),
      now: fixedNow,
    },
  )

  assert.equal(replay.state, "active")
  assert.equal(db.outbox.length, 1)
  assert.equal(db.jobs[0]?.status, "completed")
})

test("deferred purchase analytics persists rows before vendor delivery and keeps active access on failure", async () => {
  const keys = [
    "CUSTOMERIO_SERVER_WRITE_KEY",
    "META_CAPI_ACCESS_TOKEN",
    "META_PIXEL_ID",
    "NEXT_PUBLIC_META_PIXEL_ID",
    "POSTHOG_PROJECT_API_KEY",
    "NEXT_PUBLIC_POSTHOG_KEY",
  ] as const
  const previous = new Map(keys.map((key) => [key, process.env[key]]))
  for (const key of keys) delete process.env[key]

  try {
    const db = createActivationDb()
    const deferred: Array<() => void | Promise<void>> = []
    const result = await activateVerifiedOneTimePayment(verifiedPayment(), {
      supabase: db.supabase as never,
      ensureAccount: async () => ({ userId: "user-1" }),
      sendConfirmation: async () => ({ confirmationReference: "customerio:message:stripe:pi_123" }),
      finalizeLockedPlan: async () => ({
        lockedPlan: { routine: "fixed" },
        deliveryProvider: "customerio",
        deliveryReference: "customerio:delivery:1",
      }),
      defer: (work) => deferred.push(work),
      now: fixedNow,
    })

    assert.equal(result.state, "active")
    assert.equal(db.outbox.length, 1)
    assert.equal(db.deliveries.length, 3)
    assert.equal(deferred.length, 1)
    assert.deepEqual(
      db.deliveries.map((delivery) => ({ status: delivery.status, attempts: delivery.attempts })),
      [
        { status: "pending", attempts: 0 },
        { status: "pending", attempts: 0 },
        { status: "pending", attempts: 0 },
      ],
    )
    await deferred[0]!()
    assert.equal(result.state, "active")
    assert.equal(
      db.deliveries.every((delivery) => delivery.next_attempt_at != null),
      true,
    )
  } finally {
    for (const key of keys) {
      const value = previous.get(key)
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test("delivery evidence timestamps surround locked-plan finalization", async () => {
  const db = createActivationDb()
  const timestamps = [
    "2026-07-31T10:00:00.000Z",
    "2026-07-31T10:00:01.000Z",
    "2026-07-31T10:00:02.000Z",
    "2026-07-31T10:00:03.000Z",
  ]
  let cursor = 0

  const result = await activateVerifiedOneTimePayment(verifiedPayment(), {
    supabase: db.supabase as never,
    ensureAccount: async () => ({ userId: "user-1" }),
    sendConfirmation: async () => ({ confirmationReference: "customerio:message:stripe:pi_123" }),
    finalizeLockedPlan: async () => ({
      lockedPlan: { routine: "fixed" },
      deliveryProvider: "customerio",
      deliveryReference: "customerio:delivery:1",
    }),
    now: () => new Date(timestamps[cursor++]!),
  })

  assert.equal(result.state, "active")
  assert.equal(db.consents[0]?.generation_started_at, timestamps[1])
  assert.equal(db.consents[0]?.generation_completed_at, timestamps[2])
  assert.equal(db.consents[0]?.delivered_at, timestamps[3])
})

test("activation rejects provider transaction replay against a different consent", async () => {
  const db = createActivationDb({
    purchases: [paidPurchase({ consent_id: "other-consent" })],
  })

  await assert.rejects(
    () =>
      activateVerifiedOneTimePayment(verifiedPayment(), {
        supabase: db.supabase as never,
        ensureAccount: async () => ({ userId: "user-1" }),
      }),
    /different consent/,
  )
})

test("activation rejects a second transaction already bound to the same consent without side effects", async () => {
  const existing = paidPurchase({
    provider_transaction_id: "pi_first",
    provider_order_id: "cs_first",
    consent_id: "consent-1",
  })
  const db = createActivationDb({ purchases: [existing] })
  let fulfillmentCalls = 0

  await assert.rejects(
    () =>
      activateVerifiedOneTimePayment(
        verifiedPayment({ providerTransactionId: "pi_second", providerOrderId: "cs_second" }),
        {
          supabase: db.supabase as never,
          ensureAccount: async () => {
            fulfillmentCalls += 1
            return { userId: "user-2" }
          },
          sendConfirmation: async () => {
            fulfillmentCalls += 1
            return { confirmationReference: "unexpected" }
          },
          finalizeLockedPlan: async () => {
            fulfillmentCalls += 1
            return {
              lockedPlan: {},
              deliveryProvider: "unexpected",
              deliveryReference: "unexpected",
            }
          },
        },
      ),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "one_time_payment_duplicate_consent_charge" &&
      "retryable" in error &&
      error.retryable === false,
  )

  assert.equal(fulfillmentCalls, 0)
  assert.deepEqual(db.purchases, [existing])
  assert.equal(db.jobs.length, 0)
  assert.equal(db.outbox.length, 0)
})

test("a concurrent consent uniqueness race is normalized to the duplicate-charge error", async () => {
  const concurrentPurchase = paidPurchase({
    id: "purchase-concurrent",
    provider_transaction_id: "pi_first",
    provider_order_id: "cs_first",
    consent_id: "consent-1",
  })
  const db = createActivationDb({ raceConsentPurchase: concurrentPurchase })
  let fulfillmentCalls = 0

  await assert.rejects(
    () =>
      activateVerifiedOneTimePayment(
        verifiedPayment({ providerTransactionId: "pi_second", providerOrderId: "cs_second" }),
        {
          supabase: db.supabase as never,
          ensureAccount: async () => {
            fulfillmentCalls += 1
            return { userId: "user-2" }
          },
          sendConfirmation: async () => {
            fulfillmentCalls += 1
            return { confirmationReference: "unexpected" }
          },
          finalizeLockedPlan: async () => {
            fulfillmentCalls += 1
            return {
              lockedPlan: {},
              deliveryProvider: "unexpected",
              deliveryReference: "unexpected",
            }
          },
        },
      ),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "one_time_payment_duplicate_consent_charge",
  )

  assert.equal(fulfillmentCalls, 0)
  assert.deepEqual(db.purchases, [concurrentPurchase])
  assert.equal(db.jobs.length, 0)
  assert.equal(db.outbox.length, 0)
})

test("a refunded purchase race returns revoked without entering fulfillment", async () => {
  const db = createActivationDb({
    purchases: [paidPurchase({ status: "refunded", refunded_at: "2026-07-31T10:01:00.000Z" })],
  })
  let sideEffects = 0

  const result = await activateVerifiedOneTimePayment(verifiedPayment(), {
    supabase: db.supabase as never,
    ensureAccount: async () => {
      sideEffects += 1
      return { userId: "user-1" }
    },
    linkQuizToProfile: async () => {
      sideEffects += 1
    },
    sendConfirmation: async () => {
      sideEffects += 1
      return { confirmationReference: "unexpected" }
    },
    finalizeLockedPlan: async () => {
      sideEffects += 1
      return { lockedPlan: {}, deliveryProvider: "unexpected", deliveryReference: "unexpected" }
    },
    now: fixedNow,
  })

  assert.equal(result.state, "revoked")
  assert.equal(result.job, null)
  assert.equal(sideEffects, 0)
  assert.equal(db.jobs.length, 0)
  assert.equal(db.outbox.length, 0)
})

test("retry terminally refuses a reversed purchase without provider or fulfillment side effects", async () => {
  const purchase = paidPurchase({ status: "reversed", user_id: null })
  const job = fulfillmentJob({ purchase_id: purchase.id, status: "processing" })
  const db = createActivationDb({ purchases: [purchase], jobs: [job] })
  let resolverCalls = 0
  let sideEffects = 0

  const result = await processPersonalPlanOneTimeFulfillmentJob(job, {
    supabase: db.supabase as never,
    resolveVerifiedPaymentForRetry: async () => {
      resolverCalls += 1
      return verifiedPayment()
    },
    ensureAccount: async () => {
      sideEffects += 1
      return { userId: "user-1" }
    },
    linkQuizToProfile: async () => {
      sideEffects += 1
    },
    sendConfirmation: async () => {
      sideEffects += 1
      return { confirmationReference: "unexpected" }
    },
    finalizeLockedPlan: async () => {
      sideEffects += 1
      return { lockedPlan: {}, deliveryProvider: "unexpected", deliveryReference: "unexpected" }
    },
    now: fixedNow,
  })

  assert.equal(result.state, "revoked")
  assert.equal(result.job?.status, "failed_permanent")
  assert.equal(resolverCalls, 0)
  assert.equal(sideEffects, 0)
  assert.equal(db.outbox.length, 0)
})

test("retryable provider verification failure releases the lease with capped backoff", async () => {
  const purchase = paidPurchase({ user_id: null })
  const job = fulfillmentJob({ purchase_id: purchase.id, status: "processing" })
  const db = createActivationDb({ purchases: [purchase], jobs: [job] })

  const result = await processPersonalPlanOneTimeFulfillmentJob(job, {
    supabase: db.supabase as never,
    resolveVerifiedPaymentForRetry: async () => {
      throw new Error("provider network unavailable")
    },
    ensureAccount: async () => assert.fail("provider verification must run before fulfillment"),
    now: fixedNow,
  })

  assert.equal(result.state, "paid_pending")
  assert.equal(result.job?.status, "failed")
  assert.equal(result.job?.attempts, 1)
  assert.equal(result.job?.processing_started_at, null)
  assert.equal(result.job?.next_attempt_at, "2026-07-31T10:04:00.000Z")
})

test("permanent provider validation failure terminally releases the retry lease", async () => {
  const purchase = paidPurchase({ user_id: null })
  const job = fulfillmentJob({ purchase_id: purchase.id, status: "processing" })
  const db = createActivationDb({ purchases: [purchase], jobs: [job] })

  const result = await processPersonalPlanOneTimeFulfillmentJob(job, {
    supabase: db.supabase as never,
    resolveVerifiedPaymentForRetry: async () => {
      throw new OneTimeActivationError(
        "one_time_retry_provider_validation_failed",
        "Provider evidence was not valid",
        false,
      )
    },
    ensureAccount: async () => assert.fail("provider verification must run before fulfillment"),
    now: fixedNow,
  })

  assert.equal(result.state, "paid_pending")
  assert.equal(result.job?.status, "failed_permanent")
  assert.equal(result.job?.attempts, 1)
  assert.equal(result.job?.next_attempt_at, null)
})

test("a stale fulfillment worker cannot mark a newer completed lease as failed", async () => {
  const purchase = paidPurchase()
  const staleJob = fulfillmentJob({
    purchase_id: purchase.id,
    status: "processing",
    processing_started_at: "2026-07-31T10:00:00.000Z",
  })
  const completedByNewerWorker = fulfillmentJob({
    purchase_id: purchase.id,
    status: "completed",
    attempts: 2,
    processing_started_at: null,
    delivery_reference: "customerio:delivery:newer-worker",
  })
  const db = createActivationDb({ purchases: [purchase], jobs: [completedByNewerWorker] })

  const result = await processPersonalPlanOneTimeFulfillmentJob(staleJob, {
    supabase: db.supabase as never,
    resolveVerifiedPaymentForRetry: async () => {
      throw new Error("stale worker failed after its lease was reclaimed")
    },
    ensureAccount: async () => assert.fail("provider verification must run before fulfillment"),
    now: fixedNow,
  })

  assert.equal(result.job?.status, "completed")
  assert.equal(result.job?.attempts, 2)
  assert.equal(result.job?.delivery_reference, "customerio:delivery:newer-worker")
  assert.equal(db.jobs[0]?.status, "completed")
  assert.equal(db.jobs[0]?.attempts, 2)
  assert.equal(db.jobs[0]?.delivery_reference, "customerio:delivery:newer-worker")
})

test("a stale fulfillment worker cannot complete a newer completed lease", async () => {
  const purchase = paidPurchase()
  const staleJob = fulfillmentJob({
    purchase_id: purchase.id,
    status: "processing",
    processing_started_at: "2026-07-31T10:00:00.000Z",
  })
  const completedByNewerWorker = fulfillmentJob({
    purchase_id: purchase.id,
    status: "completed",
    attempts: 2,
    processing_started_at: null,
    delivery_reference: "customerio:delivery:newer-worker",
  })
  const db = createActivationDb({
    consents: [
      consent({
        confirmation_status: "sent",
        delivered_at: "2026-07-31T10:01:00.000Z",
        delivery_provider: "customerio",
        delivery_reference: "customerio:delivery:newer-worker",
        generated_content_sha256: "b".repeat(64),
      }),
    ],
    purchases: [purchase],
    jobs: [completedByNewerWorker],
  })

  const result = await processPersonalPlanOneTimeFulfillmentJob(staleJob, {
    supabase: db.supabase as never,
    resolveVerifiedPaymentForRetry: async () => verifiedPayment(),
    ensureAccount: async () => assert.fail("bound purchases must not create another account"),
    now: fixedNow,
  })

  assert.equal(result.job?.status, "completed")
  assert.equal(result.job?.attempts, 2)
  assert.equal(result.job?.delivery_reference, "customerio:delivery:newer-worker")
  assert.equal(db.jobs[0]?.status, "completed")
  assert.equal(db.jobs[0]?.attempts, 2)
  assert.equal(db.jobs[0]?.delivery_reference, "customerio:delivery:newer-worker")
})

test("activation stores no email or raw provider payload in purchase or outbox payloads", async () => {
  const db = createActivationDb()
  await activateVerifiedOneTimePayment(
    verifiedPayment({
      providerEvidence: {
        status: "paid",
        customer_email: "buyer@example.com",
        raw_payload: { secret: true },
        payment_method_card: "4242",
      },
    }),
    {
      supabase: db.supabase as never,
      ensureAccount: async () => ({ userId: "user-1" }),
      sendConfirmation: async () => ({ confirmationReference: "customerio:message:stripe:pi_123" }),
      finalizeLockedPlan: async () => ({
        lockedPlan: { routine: "fixed" },
        deliveryProvider: "customerio",
        deliveryReference: "customerio:delivery:1",
      }),
      now: fixedNow,
    },
  )

  const serializedPurchase = JSON.stringify(db.purchases[0]?.metadata)
  const serializedOutbox = JSON.stringify(db.outbox[0]?.payload)
  assert.doesNotMatch(serializedPurchase, /buyer@example\.com|raw_payload|payment_method_card/)
  assert.doesNotMatch(serializedOutbox, /buyer@example\.com|raw_payload|payment_method_card/)
})

test("canonical purchase outbox enqueues funnel only when attribution and delivery flags are enabled", async () => {
  const previousAttribution = process.env.FUNNEL_ATTRIBUTION_ENABLED
  const previousDelivery = process.env.BILLING_FUNNEL_DELIVERY_ENABLED

  async function run(attribution: boolean, delivery: boolean) {
    process.env.FUNNEL_ATTRIBUTION_ENABLED = String(attribution)
    process.env.BILLING_FUNNEL_DELIVERY_ENABLED = String(delivery)
    const db = createActivationDb()
    await activateVerifiedOneTimePayment(verifiedPayment(), {
      supabase: db.supabase as never,
      ensureAccount: async () => ({ userId: "user-1" }),
      sendConfirmation: async () => ({
        confirmationReference: "customerio:message:stripe:pi_123",
      }),
      finalizeLockedPlan: async () => ({
        lockedPlan: { routine: "fixed" },
        deliveryProvider: "customerio",
        deliveryReference: "customerio:delivery:1",
      }),
      now: fixedNow,
    })
    return {
      funnelDeliveries: db.deliveries.filter((row) => row.destination === "funnel"),
      payload: db.outbox[0]?.payload as Record<string, unknown>,
    }
  }

  try {
    assert.equal((await run(true, false)).funnelDeliveries.length, 0)
    assert.equal((await run(false, true)).funnelDeliveries.length, 0)
    const enabled = await run(true, true)
    assert.equal(enabled.funnelDeliveries.length, 1)
    assert.equal(enabled.payload.funnel_session_id, "session-1")
    assert.equal(enabled.payload.funnel_package_key, "meta_personal_plan_v1")
    assert.equal(enabled.payload.checkout_reference, "cs_123")
    assert.equal(enabled.payload.meta_event_id, "cs_123")
    assert.equal(enabled.payload.value, 29.99)
    assert.equal(enabled.payload.currency, "EUR")
    assert.equal(enabled.payload.interval, "one_time")
    assert.equal(enabled.payload.plan_id, "personal_plan_once")
    assert.equal(enabled.payload.has_paid_access, true)
  } finally {
    if (previousAttribution === undefined) delete process.env.FUNNEL_ATTRIBUTION_ENABLED
    else process.env.FUNNEL_ATTRIBUTION_ENABLED = previousAttribution
    if (previousDelivery === undefined) delete process.env.BILLING_FUNNEL_DELIVERY_ENABLED
    else process.env.BILLING_FUNNEL_DELIVERY_ENABLED = previousDelivery
  }
})

test("canonical purchase outbox preserves the provider-native idempotency anchor", async () => {
  async function activate(payment: VerifiedOneTimePayment) {
    const db = createActivationDb()
    await activateVerifiedOneTimePayment(payment, {
      supabase: db.supabase as never,
      ensureAccount: async () => ({ userId: "user-1" }),
      sendConfirmation: async () => ({ confirmationReference: "customerio:message:one-time" }),
      finalizeLockedPlan: async () => ({
        lockedPlan: { routine: "fixed" },
        deliveryProvider: "customerio",
        deliveryReference: "customerio:delivery:one-time",
      }),
      now: fixedNow,
    })
    return db.outbox[0]
  }

  const stripe = await activate(
    verifiedPayment({ providerTransactionId: "pi_new", providerOrderId: "cs_predeploy_anchor" }),
  )
  const paypal = await activate(
    verifiedPayment({
      provider: "paypal",
      providerTransactionId: "capture_predeploy_anchor",
      providerOrderId: "order_new",
    }),
  )

  assert.equal(stripe?.event_key, "stripe:purchase_completed:cs_predeploy_anchor")
  assert.equal(paypal?.event_key, "paypal:purchase_completed:capture_predeploy_anchor")
})

test("due fulfillment jobs are claimed through the service-role skip-locked RPC", async () => {
  const db = createActivationDb()
  db.jobs.push(fulfillmentJob({ id: "job-1", status: "pending" }))

  const jobs = await claimDuePersonalPlanOneTimeFulfillmentJobs(db.supabase as never, {
    limit: 1,
    staleAfterMinutes: 5,
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0]?.status, "processing")
  assert.deepEqual(db.rpcCalls[0], {
    fn: "claim_personal_plan_one_time_fulfillment_jobs",
    args: { p_limit: 1, p_stale_after_minutes: 5 },
  })
})

test("single fulfillment claim normalizes an all-null composite RPC row to null", async () => {
  const db = createActivationDb({ singleClaimResponse: { id: null, status: null } })

  const claimed = await claimPersonalPlanOneTimeFulfillmentJob(db.supabase as never, "job-missing")

  assert.equal(claimed, null)
})

function verifiedPayment(overrides: Partial<VerifiedOneTimePayment> = {}): VerifiedOneTimePayment {
  return {
    provider: "stripe",
    providerTransactionId: "pi_123",
    providerOrderId: "cs_123",
    providerCustomerId: null,
    consentId: "consent-1",
    email: "buyer@example.com",
    amountMinor: 2999,
    currency: "eur",
    paidAt: "2026-07-31T10:00:00.000Z",
    providerEvidence: { status: "paid" },
    ...overrides,
  }
}

function fixedNow() {
  return new Date("2026-07-31T10:02:00.000Z")
}

function createActivationDb(
  overrides: {
    consents?: PersonalPlanOneTimeCheckoutConsentRow[]
    purchases?: BillingOneTimePurchaseRow[]
    jobs?: PersonalPlanOneTimeFulfillmentJobRow[]
    failOutboxInserts?: number
    singleClaimResponse?: unknown
    raceConsentPurchase?: BillingOneTimePurchaseRow
  } = {},
) {
  const consents = overrides.consents ?? [consent()]
  const purchases = overrides.purchases ?? []
  const jobs: PersonalPlanOneTimeFulfillmentJobRow[] = overrides.jobs ?? []
  const outbox: BillingAnalyticsOutboxRow[] = []
  const deliveries: BillingAnalyticsDeliveryRow[] = []
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const options = {
    failOutboxInserts: overrides.failOutboxInserts ?? 0,
    raceConsentPurchase: overrides.raceConsentPurchase,
  }

  const tables: Record<string, Record<string, unknown>[]> = {
    personal_plan_one_time_checkout_consents: consents as unknown as Record<string, unknown>[],
    billing_one_time_purchases: purchases as unknown as Record<string, unknown>[],
    personal_plan_one_time_fulfillment_jobs: jobs as unknown as Record<string, unknown>[],
    billing_analytics_outbox: outbox as unknown as Record<string, unknown>[],
    billing_analytics_deliveries: deliveries as unknown as Record<string, unknown>[],
    funnel_sessions: [
      {
        id: "session-1",
        package_key: "meta_personal_plan_v1",
      },
    ],
  }

  const supabase = {
    from(table: string) {
      return tableQuery(table, tables, options)
    },
    async rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args })
      if (fn === "bind_personal_plan_one_time_purchase_user") {
        const purchase = purchases.find((row) => row.id === args.p_purchase_id)
        const matchingConsent = consents.find((row) => row.id === args.p_consent_id)
        if (!purchase || !matchingConsent) return { data: null, error: new Error("missing row") }
        purchase.user_id = String(args.p_user_id)
        matchingConsent.user_id = String(args.p_user_id)
        return { data: purchase, error: null }
      }
      if (fn === "claim_personal_plan_one_time_fulfillment_jobs") {
        const due = jobs
          .filter((job) => job.status === "pending" || job.status === "failed")
          .slice(0, Number(args.p_limit))
        for (const job of due) {
          job.status = "processing"
          job.processing_started_at = new Date().toISOString()
        }
        return { data: due, error: null }
      }
      if (fn === "claim_personal_plan_one_time_fulfillment_job") {
        if ("singleClaimResponse" in overrides) {
          return { data: overrides.singleClaimResponse, error: null }
        }
        const job = jobs.find((candidate) => candidate.id === args.p_job_id)
        if (!job || !isJobDue(job)) return { data: null, error: null }
        job.status = "processing"
        job.processing_started_at = new Date().toISOString()
        return { data: job, error: null }
      }
      return { data: null, error: new Error(`unexpected rpc ${fn}`) }
    },
  }

  return { consents, purchases, jobs, outbox, deliveries, rpcCalls, supabase }
}

function isJobDue(job: PersonalPlanOneTimeFulfillmentJobRow) {
  if (job.attempts >= 5) return false
  if (job.status === "pending") return true
  if (job.status === "failed") {
    return !job.next_attempt_at || job.next_attempt_at <= "2026-07-31T10:02:00.000Z"
  }
  if (job.status === "processing") return false
  return false
}

function tableQuery(
  table: string,
  tables: Record<string, Record<string, unknown>[]>,
  options: { failOutboxInserts: number; raceConsentPurchase?: BillingOneTimePurchaseRow },
) {
  const rows = tables[table] ?? []
  const filters: Array<(row: Record<string, unknown>) => boolean> = []

  const applyFilters = () => rows.filter((row) => filters.every((filter) => filter(row)))
  const makeSelectResult = (row: Record<string, unknown> | Record<string, unknown>[] | null) => ({
    single: async () => ({ data: Array.isArray(row) ? row[0] : row, error: null }),
    maybeSingle: async () => ({ data: Array.isArray(row) ? (row[0] ?? null) : row, error: null }),
  })

  const builder = {
    select() {
      return builder
    },
    eq(column: string, value: unknown) {
      filters.push((row) => row[column] === value)
      return builder
    },
    in(column: string, values: unknown[]) {
      filters.push((row) => values.includes(row[column]))
      return builder
    },
    insert(row: Record<string, unknown>) {
      if (table === "billing_analytics_outbox" && options.failOutboxInserts > 0) {
        options.failOutboxInserts -= 1
        return makeErrorSelect({ code: "XX000", message: "analytics database unavailable" })
      }
      if (
        table === "billing_analytics_outbox" &&
        rows.some((existing) => existing.event_key === row.event_key)
      ) {
        return makeErrorSelect({ code: "23505", message: "duplicate outbox event" })
      }
      if (
        table === "personal_plan_one_time_fulfillment_jobs" &&
        rows.some((existing) => existing.purchase_id === row.purchase_id)
      ) {
        return makeErrorSelect({ code: "23505", message: "duplicate fulfillment job" })
      }
      const inserted = addDefaults(table, row, rows.length + 1)
      rows.push(inserted)
      return { select: () => makeSelectResult(inserted) }
    },
    upsert(rowOrRows: Record<string, unknown> | Array<Record<string, unknown>>) {
      const incoming = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
      for (const row of incoming) {
        if (table === "billing_one_time_purchases") {
          if (options.raceConsentPurchase) {
            rows.push(options.raceConsentPurchase as unknown as Record<string, unknown>)
            options.raceConsentPurchase = undefined
            return makeErrorSelect({ code: "23505", message: "duplicate key" })
          }
          const existing = rows.find(
            (candidate) =>
              candidate.provider === row.provider &&
              candidate.provider_transaction_id === row.provider_transaction_id,
          )
          if (existing) Object.assign(existing, row)
          else rows.push(addDefaults(table, row, rows.length + 1))
          continue
        }
        if (table === "billing_analytics_deliveries") {
          const existing = rows.find(
            (candidate) =>
              candidate.outbox_id === row.outbox_id && candidate.destination === row.destination,
          )
          if (!existing) rows.push(addDefaults(table, row, rows.length + 1))
        }
      }
      const selected = Array.isArray(rowOrRows)
        ? incoming.map((row) => rows.find((candidate) => candidate === row) ?? row)
        : rows[rows.length - 1]
      return { select: () => makeSelectResult(selected) }
    },
    update(patch: Record<string, unknown>) {
      const updateFilters: Array<(row: Record<string, unknown>) => boolean> = []
      const applyUpdate = () => {
        const updated = rows.filter((row) => updateFilters.every((filter) => filter(row)))
        for (const row of updated) Object.assign(row, patch)
        return updated
      }
      const updateBuilder = {
        eq(column: string, value: unknown) {
          updateFilters.push((row) => row[column] === value)
          return updateBuilder
        },
        in(column: string, values: unknown[]) {
          updateFilters.push((row) => values.includes(row[column]))
          return updateBuilder
        },
        select() {
          return makeSelectResult(applyUpdate())
        },
        then(resolve: (result: { data: Record<string, unknown>[]; error: null }) => void) {
          resolve({ data: applyUpdate(), error: null })
        },
      }
      return updateBuilder
    },
    async maybeSingle() {
      return { data: applyFilters()[0] ?? null, error: null }
    },
    async single() {
      return { data: applyFilters()[0] ?? null, error: null }
    },
    then(resolve: (result: { data: Record<string, unknown>[]; error: null }) => void) {
      resolve({ data: applyFilters(), error: null })
    },
  }

  return builder
}

function makeErrorSelect(error: unknown) {
  return {
    select: () => ({
      single: async () => ({ data: null, error }),
    }),
  }
}

function addDefaults(table: string, row: Record<string, unknown>, index: number) {
  const now = "2026-07-31T10:02:00.000Z"
  if (table === "billing_one_time_purchases") {
    return { id: `purchase-${index}`, created_at: now, updated_at: now, ...row }
  }
  if (table === "personal_plan_one_time_fulfillment_jobs") {
    return {
      id: `job-${index}`,
      attempts: 0,
      next_attempt_at: null,
      processing_started_at: null,
      last_error: null,
      delivery_provider: null,
      delivery_reference: null,
      canonical_content_sha256: null,
      delivered_at: null,
      created_at: now,
      updated_at: now,
      ...row,
    }
  }
  if (table === "billing_analytics_outbox") {
    return { id: `outbox-${index}`, created_at: now, updated_at: now, ...row }
  }
  if (table === "billing_analytics_deliveries") {
    return {
      id: `delivery-${index}`,
      status: "pending",
      attempts: 0,
      processing_started_at: null,
      next_attempt_at: null,
      delivered_at: null,
      last_error: null,
      provider_request_id: null,
      created_at: now,
      updated_at: now,
      ...row,
    }
  }
  return { id: `${table}-${index}`, created_at: now, updated_at: now, ...row }
}

function consent(
  overrides: Partial<PersonalPlanOneTimeCheckoutConsentRow> = {},
): PersonalPlanOneTimeCheckoutConsentRow {
  return {
    id: "consent-1",
    lead_id: "lead-1",
    funnel_session_id: "session-1",
    user_id: null,
    product_kind: "personal_plan_once",
    offer_variant: "personal-plan-once",
    copy_version: "2026-07-31",
    consent_text: "consent",
    consent_text_sha256: "a".repeat(64),
    accepted_at: "2026-07-31T09:59:00.000Z",
    stripe_checkout_session_id: "cs_123",
    paypal_order_id: null,
    paypal_capture_id: null,
    confirmation_provider: null,
    confirmation_status: "pending",
    confirmation_reference: null,
    confirmation_sent_at: null,
    confirmation_delivered_at: null,
    generation_started_at: null,
    generation_completed_at: null,
    generated_content_sha256: null,
    delivery_provider: null,
    delivery_reference: null,
    delivered_at: null,
    first_accessed_at: null,
    created_at: "2026-07-31T09:59:00.000Z",
    updated_at: "2026-07-31T09:59:00.000Z",
    ...overrides,
  }
}

function paidPurchase(
  overrides: Partial<BillingOneTimePurchaseRow> = {},
): BillingOneTimePurchaseRow {
  return {
    id: "purchase-1",
    user_id: "user-1",
    consent_id: "consent-1",
    provider: "stripe",
    product_kind: "personal_plan_once",
    provider_transaction_id: "pi_123",
    provider_customer_id: null,
    provider_order_id: "cs_123",
    amount_minor: 2999,
    currency: "eur",
    refunded_amount_minor: 0,
    status: "paid",
    paid_at: "2026-07-31T10:00:00.000Z",
    refunded_at: null,
    metadata: {},
    created_at: "2026-07-31T10:00:00.000Z",
    updated_at: "2026-07-31T10:00:00.000Z",
    ...overrides,
  }
}

function fulfillmentJob(
  overrides: Partial<PersonalPlanOneTimeFulfillmentJobRow> = {},
): PersonalPlanOneTimeFulfillmentJobRow {
  const processingStartedAt =
    overrides.processing_started_at ??
    (overrides.status === "processing" ? "2026-07-31T10:00:00.000Z" : null)
  return {
    id: "job-1",
    purchase_id: "purchase-1",
    consent_id: "consent-1",
    status: "pending",
    attempts: 0,
    next_attempt_at: null,
    processing_started_at: processingStartedAt,
    last_error: null,
    delivery_provider: null,
    delivery_reference: null,
    canonical_content_sha256: null,
    delivered_at: null,
    created_at: "2026-07-31T10:00:00.000Z",
    updated_at: "2026-07-31T10:00:00.000Z",
    ...overrides,
  }
}

function claimFulfillmentJobForTest(
  job: PersonalPlanOneTimeFulfillmentJobRow,
): PersonalPlanOneTimeFulfillmentJobRow {
  job.status = "processing"
  job.processing_started_at = "2026-07-31T10:02:00.000Z"
  return job
}
