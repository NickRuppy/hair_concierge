import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_PAYMENT_INTEGRITY_CANDIDATE_CAP,
  DEFAULT_PAYMENT_INTEGRITY_MAX_CONCURRENCY,
  reconcilePaymentIntegrity,
  type PaymentIntegrityCandidate,
  type PaymentIntegrityLocalState,
} from "../src/lib/billing/payment-integrity"

const now = new Date("2026-08-01T12:00:00.000Z")
const deadlineAt = new Date(Date.now() + 40_000)

function hoursAgo(hours: number): Date {
  return new Date(now.getTime() - hours * 60 * 60 * 1000)
}

function candidate(
  id: string,
  overrides: Partial<PaymentIntegrityCandidate> = {},
): PaymentIntegrityCandidate {
  return {
    provider: "stripe",
    commerceKind: "subscription",
    outcome: "succeeded",
    occurredAt: hoursAgo(2),
    checkoutAttemptId: id,
    providerReferenceDigest: `digest-${id}`,
    method: "card",
    live: true,
    isInternalTest: false,
    ...overrides,
  }
}

function localState(overrides: PaymentIntegrityLocalState = {}): PaymentIntegrityLocalState {
  return {
    billingSucceeded: true,
    activeEntitlement: true,
    paidOneTimePurchase: false,
    ...overrides,
  }
}

test("settlement grace skips recent provider success without local lookup", async () => {
  let localLookups = 0
  const result = await reconcilePaymentIntegrity({
    now,
    deadlineAt,
    providers: [
      {
        provider: "stripe",
        listCandidates: async () => ({
          candidates: [
            candidate("recent", { occurredAt: new Date(now.getTime() - 59 * 60 * 1000) }),
          ],
        }),
      },
    ],
    local: {
      getState: async () => {
        localLookups += 1
        return localState({ billingSucceeded: false, activeEntitlement: false })
      },
    },
  })

  assert.equal(localLookups, 0)
  assert.equal(result.counters.skippedInSettlementGrace, 1)
  assert.equal(result.counters.findings, 0)
})

test("subscription provider success requires billing success and active entitlement", async () => {
  const result = await reconcilePaymentIntegrity({
    now,
    deadlineAt,
    providers: [
      {
        provider: "stripe",
        listCandidates: async () => ({
          candidates: [
            candidate("missing-billing"),
            candidate("missing-entitlement"),
            candidate("healthy"),
          ],
        }),
      },
    ],
    local: {
      getState: async (payment) => {
        if (payment.checkoutAttemptId === "missing-billing") {
          return localState({ billingSucceeded: false, activeEntitlement: false })
        }
        if (payment.checkoutAttemptId === "missing-entitlement") {
          return localState({ billingSucceeded: true, activeEntitlement: false })
        }
        return localState()
      },
    },
  })

  assert.deepEqual(
    result.findings.map((finding) => [finding.invariant, finding.boundary, finding.errorFamily]),
    [
      ["provider_success_without_billing_success", "billing", "billing_state"],
      ["provider_success_without_active_entitlement", "entitlement", "entitlement_state"],
    ],
  )
  assert.equal(result.counters.findings, 2)
})

test("duplicate provider representations produce one finding per subscription invariant", async () => {
  const sharedDigest = "d".repeat(64)
  const reported: string[] = []
  const result = await reconcilePaymentIntegrity({
    now,
    deadlineAt,
    providers: [
      {
        provider: "stripe",
        listCandidates: async () => ({
          candidates: [
            candidate("checkout-representation", { providerReferenceDigest: sharedDigest }),
            candidate("invoice-representation", {
              checkoutAttemptId: null,
              providerReferenceDigest: sharedDigest,
            }),
          ],
        }),
      },
    ],
    local: {
      getState: async () => localState({ billingSucceeded: true, activeEntitlement: false }),
    },
    reporter: {
      reportFinding: (finding) => {
        reported.push(finding.providerReferenceDigest ?? "missing")
      },
    },
  })

  assert.equal(result.counters.candidatesChecked, 2)
  assert.equal(result.counters.findings, 1)
  assert.equal(result.findings.length, 1)
  assert.equal(result.findings[0]?.providerReferenceDigest, sharedDigest)
  assert.deepEqual(reported, [sharedDigest])
})

test("local funnel classification promotes historical provider findings to internal tests", async () => {
  const result = await reconcilePaymentIntegrity({
    now,
    deadlineAt,
    providers: [
      {
        provider: "stripe",
        listCandidates: async () => ({ candidates: [candidate("historical-qa")] }),
      },
    ],
    local: {
      getState: async () =>
        localState({ billingSucceeded: false, activeEntitlement: false, isInternalTest: true }),
    },
  })

  assert.equal(result.findings.length, 1)
  assert.equal(result.findings[0]?.isInternalTest, true)
})

test("one-time provider success depends only on its paid purchase record", async () => {
  const result = await reconcilePaymentIntegrity({
    now,
    deadlineAt,
    candidateCapPerProvider: DEFAULT_PAYMENT_INTEGRITY_CANDIDATE_CAP + 50,
    providers: [
      {
        provider: "paypal",
        listCandidates: async () => ({
          candidates: [
            candidate("missing-purchase", {
              provider: "paypal",
              commerceKind: "one_time",
              method: "paypal",
            }),
            candidate("one-time-healthy", {
              provider: "paypal",
              commerceKind: "one_time",
              method: "paypal",
            }),
          ],
        }),
      },
    ],
    local: {
      getState: async (payment) => {
        if (payment.checkoutAttemptId === "missing-purchase") {
          return localState({
            paidOneTimePurchase: false,
          })
        }
        return localState({
          paidOneTimePurchase: true,
          activeEntitlement: true,
        })
      },
    },
  })

  assert.deepEqual(
    result.findings.map((finding) => [finding.invariant, finding.provider, finding.boundary]),
    [["provider_success_without_paid_one_time_purchase", "paypal", "billing"]],
  )
})

test("provider failure conflicts only with same-commerce billing success, not retained access", async () => {
  const result = await reconcilePaymentIntegrity({
    now,
    deadlineAt,
    providers: [
      {
        provider: "stripe",
        listCandidates: async () => ({
          candidates: [
            candidate("clean-failure", { outcome: "failed" }),
            candidate("retained-access", { outcome: "failed" }),
            candidate("conflicting-failure", { outcome: "failed" }),
          ],
        }),
      },
    ],
    local: {
      getState: async (payment) => {
        if (payment.checkoutAttemptId === "conflicting-failure") {
          return localState({ billingSucceeded: true, activeEntitlement: true })
        }
        if (payment.checkoutAttemptId === "retained-access") {
          return localState({ billingSucceeded: false, activeEntitlement: true })
        }
        return localState({ billingSucceeded: false, activeEntitlement: false })
      },
    },
  })

  assert.equal(result.counters.providerFailures, 3)
  assert.deepEqual(
    result.findings.map((finding) => finding.invariant),
    ["provider_failure_conflicts_with_local_subscription_success"],
  )
})

test("provider lookup errors become monitor failures, not payment findings", async () => {
  const result = await reconcilePaymentIntegrity({
    now,
    deadlineAt,
    providers: [
      {
        provider: "stripe",
        listCandidates: async () => {
          throw new Error("Stripe outage: cs_live_secret")
        },
      },
    ],
    local: {
      getState: async () => localState(),
    },
  })

  assert.equal(result.counters.providerErrors, 1)
  assert.equal(result.counters.monitorFailures, 1)
  assert.equal(result.counters.findings, 0)
  assert.deepEqual(result.monitorFailures[0], {
    signal: "payment_monitor_failed",
    provider: "stripe",
    reason: "provider_error",
    errorFamily: "provider_unavailable",
  })
  assert.equal(JSON.stringify(result).includes("cs_live_secret"), false)
})

test("incomplete pagination and cap overflow are monitor failures and only the hard cap is checked", async () => {
  const candidates = Array.from(
    { length: DEFAULT_PAYMENT_INTEGRITY_CANDIDATE_CAP + 5 },
    (_, index) => candidate(`attempt-${index}`, { provider: "paypal", method: "paypal" }),
  )
  let checked = 0

  const result = await reconcilePaymentIntegrity({
    now,
    deadlineAt,
    providers: [
      {
        provider: "paypal",
        listCandidates: async () => ({ candidates, hasMore: true, incomplete: true }),
      },
    ],
    local: {
      getState: async () => {
        checked += 1
        return localState()
      },
    },
  })

  assert.equal(checked, DEFAULT_PAYMENT_INTEGRITY_CANDIDATE_CAP)
  assert.equal(result.counters.candidatesChecked, DEFAULT_PAYMENT_INTEGRITY_CANDIDATE_CAP)
  assert.equal(result.counters.cappedProviders, 1)
  assert.equal(result.counters.incompleteProviders, 1)
  assert.equal(result.counters.monitorFailures, 2)
  assert.equal(result.counters.findings, 0)
})

test("deadline exhaustion stops remaining checks and reports monitor failure", async () => {
  const times = [now.getTime(), now.getTime(), now.getTime(), deadlineAt.getTime() + 1]
  const checked: string[] = []

  const result = await reconcilePaymentIntegrity({
    now,
    deadlineAt,
    clock: () => times.shift() ?? deadlineAt.getTime() + 1,
    maxConcurrency: 1,
    providers: [
      {
        provider: "stripe",
        listCandidates: async () => ({
          candidates: [candidate("first-attempt"), candidate("second-attempt")],
        }),
      },
    ],
    local: {
      getState: async (payment) => {
        checked.push(payment.checkoutAttemptId ?? "missing")
        return localState()
      },
    },
  })

  assert.deepEqual(checked, ["first-attempt"])
  assert.equal(result.counters.deadlineExhausted, 1)
  assert.equal(result.counters.monitorFailures, 1)
  assert.equal(result.counters.findings, 0)
})

test("candidate checks are bounded to concurrency four by default", async () => {
  let active = 0
  let observedMax = 0
  let autoRelease = false
  const release: Array<() => void> = []

  const run = reconcilePaymentIntegrity({
    now,
    deadlineAt,
    maxConcurrency: DEFAULT_PAYMENT_INTEGRITY_MAX_CONCURRENCY + 10,
    providers: [
      {
        provider: "stripe",
        listCandidates: async () => ({
          candidates: Array.from({ length: 10 }, (_, index) => candidate(`attempt-${index}`)),
        }),
      },
    ],
    local: {
      getState: async () => {
        active += 1
        observedMax = Math.max(observedMax, active)
        if (!autoRelease) {
          await new Promise<void>((resolve) => release.push(resolve))
        }
        active -= 1
        return localState()
      },
    },
  })

  while (release.length < DEFAULT_PAYMENT_INTEGRITY_MAX_CONCURRENCY) {
    await new Promise((resolve) => setImmediate(resolve))
  }
  assert.equal(observedMax, DEFAULT_PAYMENT_INTEGRITY_MAX_CONCURRENCY)
  autoRelease = true
  while (release.length > 0) release.shift()?.()
  await run
  assert.equal(observedMax, DEFAULT_PAYMENT_INTEGRITY_MAX_CONCURRENCY)
})

test("reporter throws are contained and do not abort the scan", async () => {
  const reported: string[] = []
  const result = await reconcilePaymentIntegrity({
    now,
    deadlineAt,
    providers: [
      {
        provider: "stripe",
        listCandidates: async () => ({
          candidates: [candidate("missing-billing"), candidate("healthy-attempt")],
        }),
      },
    ],
    local: {
      getState: async (payment) =>
        payment.checkoutAttemptId === "missing-billing"
          ? localState({ billingSucceeded: false, activeEntitlement: false })
          : localState(),
    },
    reporter: {
      reportFinding: async (finding) => {
        reported.push(finding.checkoutAttemptId ?? "missing")
        throw new Error("sink failed")
      },
      reportMonitorFailure: async () => {
        throw new Error("sink failed")
      },
    },
  })

  assert.deepEqual(reported, ["missing-billing"])
  assert.equal(result.counters.findings, 1)
  assert.equal(result.counters.candidatesChecked, 2)
})

test("result and reporter payloads expose only aggregates and bounded opaque descriptors", async () => {
  const reported: unknown[] = []
  const rawCandidate = {
    ...candidate("attempt-raw", {
      checkoutAttemptId: null,
      providerReferenceDigest: "a".repeat(64),
    }),
    rawProviderReference: "pi_secret_raw_reference",
    providerObject: { id: "cs_raw_secret" },
  } as PaymentIntegrityCandidate

  const result = await reconcilePaymentIntegrity({
    now,
    deadlineAt,
    maxFindings: 1,
    providers: [
      {
        provider: "stripe",
        listCandidates: async () => ({
          candidates: [
            rawCandidate,
            candidate("attempt-two", { providerReferenceDigest: "b".repeat(64) }),
          ],
        }),
      },
    ],
    local: {
      getState: async () => localState({ billingSucceeded: false, activeEntitlement: false }),
    },
    reporter: {
      reportFinding: async (finding) => reported.push(finding),
      reportMonitorFailure: async (failure) => reported.push(failure),
    },
  })

  assert.equal(result.counters.findings, 2)
  assert.equal(result.findings.length, 1)
  assert.equal(result.findings[0]?.providerReferenceDigest, "a".repeat(64))
  assert.equal(result.findings[0]?.checkoutAttemptId, undefined)
  const serialized = JSON.stringify({ result, reported })
  assert.equal(serialized.includes("pi_secret_raw_reference"), false)
  assert.equal(serialized.includes("cs_raw_secret"), false)
})
