import assert from "node:assert/strict"
import test from "node:test"

import {
  normalizeRecoveryTarget,
  parsePayPalExpiredOrderResetArgs,
  parseOneTimeRecoveryArgs,
  readOneTimeRecoveryReceipt,
  runPayPalExpiredOrderResetCommand,
  runOneTimeRecoveryCommand,
  type OneTimeRecoveryDependencies,
  type ReconciliationReceipt,
  type RecoveryVerification,
} from "../scripts/billing/one-time-recover"

const sensitive = {
  stripeSession: "cs_live_secret",
  paypalToken: "paypal-token-secret",
  paypalOrder: "ORDER-SECRET",
  paypalCapture: "CAPTURE-SECRET",
  paymentIntent: "pi_secret",
  userId: "user-secret",
  leadId: "lead-secret",
  consentId: "consent-secret",
  email: "buyer@example.com",
}

const baseReceipt: ReconciliationReceipt = {
  purchasePersisted: true,
  purchaseBoundToUser: true,
  consentBoundToUser: true,
  confirmationAccepted: true,
  planDeliveryRecorded: true,
  firstAccessRecorded: false,
  accessState: "active",
  fulfillmentJobCount: 1,
  canonicalOutboxCount: 1,
  analyticsDeliveryCounts: {
    total: 3,
    pending: 1,
    processing: 0,
    delivered: 2,
    failed: 0,
    failedPermanent: 0,
  },
}

function stripeVerification(): RecoveryVerification {
  return {
    canonicalConsentMatch: true,
    payment: {
      provider: "stripe",
      providerTransactionId: sensitive.paymentIntent,
      providerOrderId: sensitive.stripeSession,
      providerCustomerId: "cus_secret",
      consentId: sensitive.consentId,
      email: sensitive.email,
      amountMinor: 2999,
      currency: "eur",
      paidAt: "2026-07-31T12:00:00.000Z",
    },
  }
}

function paypalVerification(): RecoveryVerification {
  return {
    canonicalConsentMatch: true,
    existingPurchaseFound: true,
    payment: {
      provider: "paypal",
      providerTransactionId: sensitive.paypalCapture,
      providerOrderId: sensitive.paypalOrder,
      providerCustomerId: null,
      consentId: sensitive.consentId,
      email: sensitive.email,
      amountMinor: 2999,
      currency: "eur",
      paidAt: "2026-07-31T12:00:00.000Z",
    },
    raw: {
      intent: {
        token: sensitive.paypalToken,
        email: sensitive.email,
      },
    },
  }
}

function fakeDeps(
  input: {
    stripeVerification?: RecoveryVerification
    paypalVerification?: RecoveryVerification
    receipt?: ReconciliationReceipt
  } = {},
) {
  const calls: string[] = []
  const deps: OneTimeRecoveryDependencies = {
    verifyStripe: async (target) => {
      calls.push(`verifyStripe:${target.kind}`)
      return input.stripeVerification ?? stripeVerification()
    },
    activateStripe: async (target) => {
      calls.push(`activateStripe:${target.kind}`)
      return { ok: true }
    },
    verifyPayPal: async (target) => {
      calls.push(`verifyPayPal:${target.kind}`)
      return input.paypalVerification ?? paypalVerification()
    },
    activatePayPal: async (target) => {
      calls.push(`activatePayPal:${target.kind}`)
      return { ok: true }
    },
    readReceipt: async () => {
      calls.push("readReceipt")
      return input.receipt ?? baseReceipt
    },
  }
  return { deps, calls }
}

test("defaults to dry-run and performs no activation writes", async () => {
  const { deps, calls } = fakeDeps()
  const receipt = await runOneTimeRecoveryCommand(
    parseOneTimeRecoveryArgs(["--provider=stripe", `--stripe-session=${sensitive.stripeSession}`]),
    deps,
  )

  assert.equal(receipt.mode, "dry-run")
  assert.equal(receipt.applyGuardSatisfied, false)
  assert.deepEqual(calls, ["verifyStripe:stripe_checkout_session", "readReceipt"])
})

test("expired PayPal reset is dry-run by default and reads the provider before local eligibility", async () => {
  const calls: string[] = []
  const receipt = await runPayPalExpiredOrderResetCommand(
    parsePayPalExpiredOrderResetArgs([
      "--reset-expired-paypal-order",
      `--paypal-order=${sensitive.paypalOrder}`,
    ]),
    {
      expectedMerchantId: "MERCHANT-1",
      retrieveOrder: async () => {
        calls.push("provider-get")
        return {
          id: sensitive.paypalOrder,
          status: "VOIDED",
          purchase_units: [{ payee: { merchant_id: "MERCHANT-1" }, payments: { captures: [] } }],
        }
      },
      inspectEligibility: async () => {
        calls.push("local-eligibility")
        return { eligible: true }
      },
      applyReset: async () => {
        calls.push("apply")
      },
    },
  )

  assert.deepEqual(calls, ["provider-get", "local-eligibility"])
  assert.deepEqual(receipt, {
    ok: true,
    mode: "dry-run",
    reset: "paypal_expired_uncaptured_order",
    providerState: "voided",
    applyGuardSatisfied: false,
  })
  assert.doesNotMatch(JSON.stringify(receipt), /ORDER-SECRET|paypal-token-secret/)
})

test("expired PayPal reset requires an exact order confirmation before any provider lookup", async () => {
  const calls: string[] = []
  await assert.rejects(
    runPayPalExpiredOrderResetCommand(
      parsePayPalExpiredOrderResetArgs([
        "--reset-expired-paypal-order",
        `--paypal-order=${sensitive.paypalOrder}`,
        "--apply",
        "--confirm-paypal-order=other-order",
      ]),
      {
        expectedMerchantId: "MERCHANT-1",
        retrieveOrder: async () => {
          calls.push("provider-get")
          return {
            id: sensitive.paypalOrder,
            status: "VOIDED",
            purchase_units: [{ payee: { merchant_id: "MERCHANT-1" }, payments: { captures: [] } }],
          }
        },
        inspectEligibility: async () => ({ eligible: true }),
        applyReset: async () => undefined,
      },
    ),
    (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "apply_confirmation_mismatch",
  )
  assert.deepEqual(calls, [])
})

test("expired PayPal reset rejects any provider state or capture other than voided with no captures", async () => {
  for (const order of [
    { id: sensitive.paypalOrder, status: "CREATED", purchase_units: [] },
    {
      id: sensitive.paypalOrder,
      status: "VOIDED",
      purchase_units: [{ payments: { captures: [{ id: "capture" }] } }],
    },
    { id: "another-order", status: "VOIDED", purchase_units: [{ payments: { captures: [] } }] },
    { id: sensitive.paypalOrder, status: "VOIDED" },
  ]) {
    await assert.rejects(
      runPayPalExpiredOrderResetCommand(
        parsePayPalExpiredOrderResetArgs([
          "--reset-expired-paypal-order",
          `--paypal-order=${sensitive.paypalOrder}`,
        ]),
        {
          expectedMerchantId: "MERCHANT-1",
          retrieveOrder: async () => order,
          inspectEligibility: async () => ({ eligible: true }),
          applyReset: async () => undefined,
        },
      ),
      (error: unknown) =>
        error instanceof Error &&
        "code" in error &&
        error.code === "paypal_order_not_provably_voided",
    )
  }
})

test("expired PayPal reset rejects 404 before local eligibility because provider environment is unproven", async () => {
  const calls: string[] = []
  await assert.rejects(
    runPayPalExpiredOrderResetCommand(
      parsePayPalExpiredOrderResetArgs([
        "--reset-expired-paypal-order",
        `--paypal-order=${sensitive.paypalOrder}`,
        "--apply",
        `--confirm-paypal-order=${sensitive.paypalOrder}`,
      ]),
      {
        expectedMerchantId: "MERCHANT-1",
        retrieveOrder: async () => {
          calls.push("provider-get")
          const error = new Error("not found") as Error & { status?: number }
          error.status = 404
          throw error
        },
        inspectEligibility: async () => {
          calls.push("local-eligibility")
          return { eligible: true }
        },
        applyReset: async () => {
          calls.push("apply")
        },
      },
    ),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "paypal_order_not_found_unverified_environment",
  )
  assert.deepEqual(calls, ["provider-get"])
})

test("refuses all recovery modes before provider or database seams while the experiment is enabled", async () => {
  const original = process.env.PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED
  process.env.PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED = "true"
  try {
    const { deps, calls } = fakeDeps()
    await assert.rejects(
      runOneTimeRecoveryCommand(
        parseOneTimeRecoveryArgs(["--provider=paypal", `--paypal-token=${sensitive.paypalToken}`]),
        deps,
      ),
      (error: unknown) =>
        error instanceof Error &&
        "code" in error &&
        error.code === "personal_plan_pricing_experiment_enabled",
    )
    assert.deepEqual(calls, [])
  } finally {
    if (original === undefined) delete process.env.PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED
    else process.env.PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED = original
  }
})

test("receipt preserves the verifier's computed canonical-consent proof", async () => {
  const { deps } = fakeDeps({
    stripeVerification: { ...stripeVerification(), canonicalConsentMatch: false },
  })
  const receipt = await runOneTimeRecoveryCommand(
    parseOneTimeRecoveryArgs(["--provider=stripe", `--stripe-session=${sensitive.stripeSession}`]),
    deps,
  )
  assert.equal(receipt.canonicalConsentMatch, false)
})

test("requires both --apply and exact --confirm-session before applying", async () => {
  const { deps } = fakeDeps()
  await assert.rejects(
    runOneTimeRecoveryCommand(
      parseOneTimeRecoveryArgs([
        "--provider=stripe",
        `--stripe-session=${sensitive.stripeSession}`,
        "--apply",
      ]),
      deps,
    ),
    /Apply requires --confirm-session/,
  )

  await assert.rejects(
    runOneTimeRecoveryCommand(
      parseOneTimeRecoveryArgs([
        "--provider=stripe",
        `--stripe-session=${sensitive.stripeSession}`,
        "--apply",
        "--confirm-session=other-session",
      ]),
      deps,
    ),
    /Apply requires --confirm-session/,
  )
})

test("applies only when confirmation exactly matches the target", async () => {
  const { deps, calls } = fakeDeps()
  const receipt = await runOneTimeRecoveryCommand(
    parseOneTimeRecoveryArgs([
      "--provider=stripe",
      `--stripe-session=${sensitive.stripeSession}`,
      "--apply",
      `--confirm-session=${sensitive.stripeSession}`,
    ]),
    deps,
  )

  assert.equal(receipt.mode, "apply")
  assert.equal(receipt.applyGuardSatisfied, true)
  assert.deepEqual(calls, [
    "verifyStripe:stripe_checkout_session",
    "activateStripe:stripe_checkout_session",
    "readReceipt",
  ])
})

test("delegates PayPal token verification to provider seam without activating on dry-run", async () => {
  const { deps, calls } = fakeDeps()
  const receipt = await runOneTimeRecoveryCommand(
    parseOneTimeRecoveryArgs(["--provider=paypal", `--paypal-token=${sensitive.paypalToken}`]),
    deps,
  )

  assert.equal(receipt.provider, "paypal")
  assert.equal(receipt.targetKind, "paypal_token")
  assert.equal(receipt.existingPurchaseFound, true)
  assert.deepEqual(calls, ["verifyPayPal:paypal_token", "readReceipt"])
})

test("keeps apply idempotent by delegating repeated apply to canonical activation", async () => {
  const { deps, calls } = fakeDeps()
  const request = parseOneTimeRecoveryArgs([
    "--provider=paypal",
    `--paypal-order=${sensitive.paypalOrder}`,
    `--paypal-capture=${sensitive.paypalCapture}`,
    "--apply",
    `--confirm-session=${sensitive.paypalOrder}:${sensitive.paypalCapture}`,
  ])

  const first = await runOneTimeRecoveryCommand(request, deps)
  const second = await runOneTimeRecoveryCommand(request, deps)

  assert.deepEqual(first, second)
  assert.equal(calls.filter((call) => call === "activatePayPal:paypal_order_capture").length, 2)
})

test("PayPal apply persists a verified capture before canonical activation", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../scripts/billing/one-time-recover.ts", import.meta.url), "utf8"),
  )
  const apply = source.slice(source.indexOf("activatePayPal: async"))
  assert.ok(
    apply.indexOf("tryMarkPayPalOrderIntentCaptured") <
      apply.indexOf("activateVerifiedPayPalOrderIntent"),
  )
})

test("Stripe receipt uses the Checkout Session canonical event key and counts deliveries", async () => {
  const { supabase, queries } = receiptSupabaseWithDeliveries([
    { status: "delivered" },
    { status: "processing" },
  ])

  const receipt = await readOneTimeRecoveryReceipt(supabase as never, stripeVerification().payment)

  assert.deepEqual(outboxEventKeys(queries), [
    `stripe:purchase_completed:${sensitive.stripeSession}`,
  ])
  assert.deepEqual(receipt.analyticsDeliveryCounts, {
    total: 2,
    pending: 0,
    processing: 1,
    delivered: 1,
    failed: 0,
    failedPermanent: 0,
  })
})

test("PayPal receipt uses the capture canonical event key and counts deliveries", async () => {
  const { supabase, queries } = receiptSupabaseWithDeliveries([
    { status: "pending" },
    { status: "failed_permanent" },
  ])

  const receipt = await readOneTimeRecoveryReceipt(supabase as never, paypalVerification().payment)

  assert.deepEqual(outboxEventKeys(queries), [
    `paypal:purchase_completed:${sensitive.paypalCapture}`,
  ])
  assert.deepEqual(receipt.analyticsDeliveryCounts, {
    total: 2,
    pending: 1,
    processing: 0,
    delivered: 0,
    failed: 0,
    failedPermanent: 1,
  })
})

test("rejects missing, mismatched, and ambiguous target identifiers", () => {
  assert.throws(
    () => normalizeRecoveryTarget({ provider: "stripe", apply: false }),
    /Stripe recovery requires --stripe-session/,
  )
  assert.throws(
    () =>
      normalizeRecoveryTarget({
        provider: "paypal",
        apply: false,
        paypalOrderId: sensitive.paypalOrder,
      }),
    /PayPal recovery requires/,
  )
  assert.throws(
    () =>
      normalizeRecoveryTarget({
        provider: "paypal",
        apply: false,
        paypalToken: sensitive.paypalToken,
        paypalOrderId: sensitive.paypalOrder,
        paypalCaptureId: sensitive.paypalCapture,
      }),
    /either token or order plus capture/,
  )
  assert.throws(
    () =>
      normalizeRecoveryTarget({
        provider: "stripe",
        apply: false,
        stripeSessionId: sensitive.stripeSession,
        paypalToken: sensitive.paypalToken,
      }),
    /cannot include PayPal/,
  )
})

test("redacts provider, user, lead, consent, token, session, and email values from output", async () => {
  const { deps } = fakeDeps()
  const receipt = await runOneTimeRecoveryCommand(
    parseOneTimeRecoveryArgs([
      "--provider=stripe",
      `--stripe-session=${sensitive.stripeSession}`,
      "--apply",
      `--confirm-session=${sensitive.stripeSession}`,
    ]),
    deps,
  )
  const output = JSON.stringify(receipt)

  for (const value of Object.values(sensitive)) {
    assert.equal(output.includes(value), false, `leaked ${value}`)
  }
  assert.equal(output.includes("29.99"), true)
  assert.equal(output.includes("EUR"), true)
})

type ReceiptQuery = {
  table: string
  filters: Array<[string, unknown]>
}

function receiptSupabaseWithDeliveries(deliveries: Array<{ status: string }>) {
  const queries: ReceiptQuery[] = []
  const supabase = {
    from(table: string) {
      return {
        select() {
          const query: ReceiptQuery = { table, filters: [] }
          queries.push(query)
          const response = () => {
            if (table === "billing_analytics_outbox")
              return { data: [{ id: "outbox-1" }], error: null }
            if (table === "billing_analytics_deliveries") return { data: deliveries, error: null }
            return { data: [], error: null }
          }
          return {
            eq(column: string, value: unknown) {
              query.filters.push([column, value])
              return this
            },
            async maybeSingle() {
              return { data: null, error: null }
            },
            then<TResult1 = ReturnType<typeof response>, TResult2 = never>(
              onfulfilled?:
                | ((value: ReturnType<typeof response>) => TResult1 | PromiseLike<TResult1>)
                | null,
              onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
            ): Promise<TResult1 | TResult2> {
              return Promise.resolve(response()).then(onfulfilled, onrejected)
            },
          }
        },
      }
    },
  }
  return { supabase, queries }
}

function outboxEventKeys(queries: ReceiptQuery[]): unknown[] {
  return queries
    .filter((query) => query.table === "billing_analytics_outbox")
    .flatMap((query) => query.filters)
    .filter(([column]) => column === "event_key")
    .map(([, value]) => value)
}
