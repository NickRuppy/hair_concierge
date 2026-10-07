import assert from "node:assert/strict"
import test from "node:test"
import {
  verifyPayPalPriorPaidMembership,
  recordLegacyPayPalPaidMembershipHistory,
} from "../src/lib/paypal/prior-paid-history"
const user = "11111111-1111-4111-8111-111111111111",
  now = Date.now(),
  at = new Date(now - 3600000).toISOString()
function fixture() {
  const input = {
    subscriptionId: "I-owned",
    expectedPayerId: "payer",
    expectedAppId: "app",
    from: new Date(now - 86400000).toISOString(),
    to: new Date(now - 1000).toISOString(),
  }
  const tx: any[] = [
    {
      id: "sale",
      time: at,
      status: "COMPLETED",
      amount_with_breakdown: { gross_amount: { value: "9.99", currency_code: "EUR" } },
    },
  ]
  const billing: any = {
    user_id: user,
    provider_customer_id: "payer",
    provider_subscription_id: "I-owned",
    metadata: {},
  }
  const calls: any[] = []
  const deps: any = {
    attestApp: async () => "app",
    retrieve: async () => ({
      id: "I-owned",
      subscriber: { payer_id: "payer" },
      create_time: new Date(now - 90 * 86400000).toISOString(),
    }),
    transactions: async () => tx,
    runtime: {
      appId: "app",
      trial: { livemode: true, identityKeys: [{ version: 1, secret: Buffer.alloc(32, 1) }] },
    },
    supabase: {
      from: () => {
        const q: any = {
          select: () => q,
          eq: () => q,
          maybeSingle: async () => ({ data: billing, error: null }),
        }
        return q
      },
      auth: {
        admin: {
          getUserById: async () => ({
            data: { user: { id: user, email: "owner@example.com", email_confirmed_at: at } },
            error: null,
          }),
        },
      },
      rpc: async (name: string, args: any) => {
        calls.push({ name, args })
        return { data: 3, error: null }
      },
    },
  }
  return { input, deps, tx, calls, billing }
}
test("bounded historical window preserves all verified nonzero payments and authoritative creation time", async () => {
  const f = fixture()
  f.tx.push(
    { ...f.tx[0], id: "sale-two" },
    {
      ...f.tx[0],
      id: "zero",
      amount_with_breakdown: { gross_amount: { value: "0.00", currency_code: "EUR" } },
    },
  )
  const p = await verifyPayPalPriorPaidMembership(f.input, f.deps)
  assert.equal(p.payments.length, 2)
  assert.equal(p.complete, true)
  assert.equal(p.providerCustomerId, "payer")
  assert.ok(Date.parse(p.subscriptionCreatedAt) < Date.parse(f.input.from))
  assert.equal(f.calls.length, 0)
})
test("history refuses wrong app/owner and oversized or invalid windows", async () => {
  for (const variant of ["app", "owner", "window"]) {
    const f = fixture()
    if (variant === "app") f.deps.attestApp = async () => "foreign"
    if (variant === "owner") f.input.expectedPayerId = "foreign"
    if (variant === "window") f.input.from = new Date(now - 32 * 86400000).toISOString()
    await assert.rejects(verifyPayPalPriorPaidMembership(f.input, f.deps))
    assert.equal(f.calls.length, 0)
  }
})
test("legacy sale hook writes shared rights-aware agreement source and HMAC claims after Auth owner and provider proof", async () => {
  const f = fixture()
  await recordLegacyPayPalPaidMembershipHistory(
    {
      subscriptionId: "I-owned",
      userId: user,
      expectedPayerId: "payer",
      saleId: "sale",
      saleAt: at,
    },
    f.deps,
  )
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].args.p_provider, "paypal")
  assert.equal(f.calls[0].args.p_agreement_id, "I-owned")
  assert.equal(f.calls[0].args.p_claims.length, 3)
  assert.equal(JSON.stringify(f.calls[0]).includes("owner@example.com"), false)
})
test("legacy hook never attaches foreign Auth owner or pending provider payment to eligibility history", async () => {
  for (const variant of ["auth", "pending"]) {
    const f = fixture()
    if (variant === "auth")
      f.deps.supabase.auth.admin.getUserById = async () => ({
        data: { user: { id: "foreign" } },
        error: null,
      })
    else f.tx[0].status = "PENDING"
    await assert.rejects(
      recordLegacyPayPalPaidMembershipHistory(
        {
          subscriptionId: "I-owned",
          userId: user,
          expectedPayerId: "payer",
          saleId: "sale",
          saleAt: at,
        },
        f.deps,
      ),
    )
    assert.equal(f.calls.length, 0)
  }
})

test("legacy hook excludes explicit canonical QA metadata before Auth, provider or history writes", async () => {
  for (const metadata of [{ qa_seed: false }, { source: "chat_eval_ci" }, { local_test: true }]) {
    const f = fixture()
    f.billing.metadata = metadata
    const unexpected = async () => {
      throw new Error("excluded QA must not reach external proof")
    }
    f.deps.supabase.auth.admin.getUserById = unexpected
    f.deps.attestApp = unexpected
    f.deps.transactions = unexpected
    await recordLegacyPayPalPaidMembershipHistory(
      {
        subscriptionId: "I-owned",
        userId: user,
        expectedPayerId: "payer",
        saleId: "sale",
        saleAt: at,
      },
      f.deps,
    )
    assert.equal(f.calls.length, 0)
  }
})
test("profile-backfilled real customer remains eligible for verified prior-paid history", async () => {
  const f = fixture()
  f.billing.metadata = { backfilled_from_profiles: true }
  await recordLegacyPayPalPaidMembershipHistory(
    {
      subscriptionId: "I-owned",
      userId: user,
      expectedPayerId: "payer",
      saleId: "sale",
      saleAt: at,
    },
    f.deps,
  )
  assert.equal(f.calls.length, 1)
})
test("legacy hook rejects mismatched canonical billing ownership before attaching history", async () => {
  for (const key of ["user_id", "provider_customer_id"]) {
    const f = fixture()
    f.billing[key] = "foreign"
    await assert.rejects(
      recordLegacyPayPalPaidMembershipHistory(
        {
          subscriptionId: "I-owned",
          userId: user,
          expectedPayerId: "payer",
          saleId: "sale",
          saleAt: at,
        },
        f.deps,
      ),
      /canonical owner mismatch/,
    )
    assert.equal(f.calls.length, 0)
  }
})
