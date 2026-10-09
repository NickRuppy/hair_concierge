import assert from "node:assert/strict"
import test from "node:test"
import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { TrialRuntime } from "../src/lib/billing/trial-runtime"
import {
  parseTrialHistoryBackfillArguments,
  runTrialHistoryBackfill,
} from "../scripts/billing/trial-history-backfill"
import { StripePaidHistoryReviewRequired } from "../src/lib/stripe/trial-prior-paid-history"
import { verifyPayPalPriorPaidMembership } from "../src/lib/paypal/prior-paid-history"
const runtime = {
  stripeAccountId: "acct_owner",
  livemode: true,
  identityKeys: [{ version: 1, secret: Buffer.alloc(32, 9) }],
} as unknown as TrialRuntime
const USER = "11111111-1111-4111-8111-111111111111"
function stripePage() {
  let args: unknown
  const stripe = {
    accounts: { retrieve: async () => ({ id: "acct_owner" }) },
    invoices: {
      list: async (input: unknown) => {
        args = input
        return {
          has_more: true,
          data: [
            { id: "in_one", livemode: true },
            { id: "in_two", livemode: true },
          ],
        }
      },
    },
  } as unknown as Stripe
  return { stripe, args: () => args, supabase: {} as SupabaseClient, runtime }
}
test("Stripe CLI defaults to read-only bounded provider page and returns resume cursor, not identities", async () => {
  const f = stripePage()
  const calls: unknown[] = []
  const result = await runTrialHistoryBackfill(
    ["--provider=stripe", "--limit=2", "--after=in_previous"],
    {
      ...f,
      reconcile: async (input) => {
        calls.push(input)
        return { status: "verified", payments: 1, cardPayments: 1 }
      },
    },
  )
  assert.deepEqual(f.args(), { status: "paid", limit: 2, starting_after: "in_previous" })
  assert.equal(result.nextCursor, "in_two")
  assert.equal(result.mode, "dry-run")
  assert.deepEqual(calls, [
    { invoiceId: "in_one", apply: false },
    { invoiceId: "in_two", apply: false },
  ])
  assert.equal(JSON.stringify(result).includes("owner@example"), false)
})
test("explicit apply is routed; ambiguous verification prevents completion while provider errors issue no checkpoint", async () => {
  const f = stripePage()
  const result = await runTrialHistoryBackfill(["--provider=stripe", "--limit=2", "--apply"], {
    ...f,
    reconcile: async (input) => {
      assert.equal(input.apply, true)
      throw new StripePaidHistoryReviewRequired("ownership")
    },
  })
  assert.equal(result.pageComplete, false)
  assert.deepEqual("review" in result ? result.review : null, [
    { invoiceId: "in_one", reason: "ownership" },
    { invoiceId: "in_two", reason: "ownership" },
  ])
  await assert.rejects(
    runTrialHistoryBackfill(["--provider=stripe"], {
      ...f,
      reconcile: async () => {
        throw new Error("provider timeout")
      },
    }),
    /provider timeout/,
  )
  for (const args of [
    ["--provider=stripe", "--apply", "--apply"],
    ["--provider=stripe", "--limit=1000"],
    ["--provider=stripe", "--user=anything"],
  ])
    assert.throws(() => parseTrialHistoryBackfillArguments(args))
})
function paypalFixture() {
  const payer = "payer-private",
    email = "owner-private@example.com"
  const billing = {
    user_id: USER,
    provider_customer_id: payer,
    provider_subscription_id: "I-LEGACY",
    metadata: {} as Record<string, unknown>,
  }
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: billing, error: null }) }) }),
      }),
    }),
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: { id: USER, email, email_confirmed_at: "2020-01-01Z" } },
          error: null,
        }),
      },
    },
  } as unknown as SupabaseClient
  const input = {
    subscriptionId: "I-LEGACY",
    expectedPayerId: payer,
    expectedAppId: "APP-owner",
    from: "2020-01-01T00:00:00Z",
    to: "2020-01-31T00:00:00Z",
  }
  const transaction = {
    id: "payment-one",
    status: "COMPLETED",
    time: "2020-01-05T00:00:00Z",
    amount_with_breakdown: { gross_amount: { value: "9.99", currency_code: "EUR" } },
  }
  const verifierDeps = {
    attestApp: async () => "APP-owner",
    retrieve: async () => ({
      id: "I-LEGACY",
      create_time: "2020-01-01T00:00:00Z",
      subscriber: { payer_id: payer },
    }),
    transactions: async () => [transaction],
  }
  return { input, transaction, verifierDeps, supabase, payer, email, billing }
}
test("PayPal proof uses complete bounded actual transactions and rejects payer/app/window/duplicate/payment errors", async () => {
  const f = paypalFixture()
  const verified = await verifyPayPalPriorPaidMembership(f.input, f.verifierDeps)
  assert.equal(verified.payments[0]!.amountMinor, 999)
  for (const deps of [
    { ...f.verifierDeps, attestApp: async () => "APP-other" },
    {
      ...f.verifierDeps,
      retrieve: async () => ({ id: "I-LEGACY", subscriber: { payer_id: "different" } }),
    },
    { ...f.verifierDeps, transactions: async () => [f.transaction, f.transaction] },
    {
      ...f.verifierDeps,
      transactions: async () => [{ ...f.transaction, time: "2021-01-01T00:00:00Z" }],
    },
  ])
    await assert.rejects(verifyPayPalPriorPaidMembership(f.input, deps))
  await assert.rejects(
    verifyPayPalPriorPaidMembership({ ...f.input, to: "2020-03-01T00:00:00Z" }, f.verifierDeps),
    /bounded/,
  )
})
test("PayPal backfill binds canonical verified owner, dry runs then applies same HMAC namespace without emitting raw identities", async () => {
  const f = paypalFixture()
  const writes: Record<string, unknown>[] = []
  const args = [
    "--provider=paypal",
    "--subscription=I-LEGACY",
    `--from=${f.input.from}`,
    `--to=${f.input.to}`,
  ]
  const deps = {
    supabase: f.supabase,
    runtime,
    paypalRuntime: {
      trial: runtime,
      appId: "APP-owner",
      productId: "product",
      monthPlanId: "month",
      yearPlanId: "year",
    },
    verifyPayPal: async (input: Parameters<typeof verifyPayPalPriorPaidMembership>[0]) => {
      assert.equal(input.expectedPayerId, f.payer)
      return verifyPayPalPriorPaidMembership(input, f.verifierDeps)
    },
    recordHistory: async (_client: unknown, input: Record<string, unknown>) => {
      writes.push(input)
    },
  }
  await runTrialHistoryBackfill(args, deps)
  assert.equal(writes.length, 0)
  const result = await runTrialHistoryBackfill([...args, "--apply"], deps)
  assert.equal(result.pageComplete, true)
  assert.equal(writes.length, 1)
  assert.equal(writes[0]!.verifiedEmail, f.email)
  assert.deepEqual(writes[0]!.paymentIdentity, {
    kind: "paypal_payer",
    namespace: "APP-owner:live",
    value: f.payer,
  })
  for (const privateValue of [USER, f.payer, f.email])
    assert.equal(JSON.stringify(result).includes(privateValue), false)
})

test("backfill counts explicit Stripe test exclusions separately from skipped invoices", async () => {
  const f = stripePage()
  const result = await runTrialHistoryBackfill(["--provider=stripe", "--limit=2", "--apply"], {
    ...f,
    reconcile: async () => ({ status: "excluded_test", payments: 0, cardPayments: 0 }),
  })
  assert.equal("excludedTest" in result ? result.excludedTest : null, 2)
  assert.equal("verified" in result ? result.verified : null, 0)
  assert.equal(result.pageComplete, true)
})
test("PayPal CLI excludes canonical QA before provider/owner processing but processes real profile backfill", async () => {
  const f = paypalFixture()
  const writes: unknown[] = []
  let verifies = 0
  const args = [
    "--provider=paypal",
    "--subscription=I-LEGACY",
    `--from=${f.input.from}`,
    `--to=${f.input.to}`,
    "--apply",
  ]
  const deps = {
    supabase: f.supabase,
    runtime,
    paypalRuntime: {
      trial: runtime,
      appId: "APP-owner",
      productId: "product",
      monthPlanId: "month",
      yearPlanId: "year",
    },
    verifyPayPal: async (input: Parameters<typeof verifyPayPalPriorPaidMembership>[0]) => {
      verifies++
      return verifyPayPalPriorPaidMembership(input, f.verifierDeps)
    },
    recordHistory: async (_client: unknown, input: unknown) => {
      writes.push(input)
    },
  }
  f.billing.metadata = { is_internal_test: true }
  const excluded = await runTrialHistoryBackfill(args, deps)
  assert.equal("excludedTest" in excluded ? excluded.excludedTest : null, 1)
  assert.equal(verifies, 0)
  assert.equal(writes.length, 0)
  f.billing.metadata = { backfilled_from_profiles: true }
  const real = await runTrialHistoryBackfill(args, deps)
  assert.equal("excludedTest" in real ? real.excludedTest : null, 0)
  assert.equal(verifies, 1)
  assert.equal(writes.length, 1)
})
