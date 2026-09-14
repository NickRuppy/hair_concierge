import assert from "node:assert/strict"
import test from "node:test"
import { createDurableStripeTrialCheckout } from "../src/lib/stripe/trial-checkout"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"

const actor = "00000000-0000-4000-8000-000000000001"
const attemptId = "00000000-0000-4000-8000-000000000002"
const enrollmentId = "00000000-0000-4000-8000-000000000003"
const now = new Date("2026-09-14T12:00:00Z")

function fixture() {
  const runtime: any = {
    stripeAccountId: "acct_trial",
    livemode: false,
    identityKeys: [{ version: 1, secret: new Uint8Array(32).fill(7) }],
    catalog: {
      monthPriceId: "price_month",
      yearPriceId: "price_year",
      annualCouponId: "coupon_intro",
    },
    enrollmentMode: "restricted",
    allowedEmails: ["owner@example.com"],
  }
  const calls: any[] = []
  let managementCatalog: any = null
  let row: any = null
  let session: any = null
  let loseResponse = false
  const deps: any = {
    runtime,
    supabase: {},
    now: () => now,
    store: {
      loadManagementCatalog: async () => managementCatalog,
      freezeManagementCatalog: async (_client: unknown, input: any) => {
        calls.push(["freeze_management_catalog", structuredClone(input.catalog)])
        managementCatalog = structuredClone(input.catalog)
      },
      create: async (_client: unknown, input: any) => {
        calls.push(["create_attempt"])
        row ??= {
          id: attemptId,
          enrollmentId,
          scope: input.scope,
          clientAttemptId: input.clientAttemptId,
          offer: input.offer,
          status: "reserved",
          stripeAccountId: null,
          stripeLivemode: null,
          stripeParams: null,
          expiresAt: null,
          providerReference: null,
        }
        return structuredClone(row)
      },
      freeze: async (_client: unknown, input: any) => {
        calls.push(["freeze"])
        Object.assign(row, {
          stripeParams: structuredClone(input.params),
          stripeAccountId: input.stripeAccountId,
          stripeLivemode: input.livemode,
          expiresAt: input.expiresAt,
          status: "frozen",
        })
        return structuredClone(row)
      },
      bind: async (_client: unknown, input: any) => {
        calls.push(["bind", input.providerReference])
        row.providerReference = input.providerReference
        row.status = "provider_created"
        return structuredClone(row)
      },
      reserve: async () => {
        calls.push(["reserve_claims"])
        return "reserved"
      },
      release: async () => {
        calls.push(["release_claims"])
        return true
      },
    },
    attest: async (input: any) => {
      calls.push(["attest", input.offer.interval])
      return { accountId: "acct_trial" }
    },
    stripe: {
      accounts: { retrieve: async () => ({ id: "acct_trial" }) },
      checkout: {
        sessions: {
          create: async (params: any, options: any) => {
            calls.push(["provider_create", structuredClone(params), options])
            session ??= {
              id: "cs_trial",
              status: "open",
              mode: "subscription",
              livemode: false,
              metadata: params.metadata,
              customer_email: params.customer_email,
              client_secret: "secret_trial",
              expires_at: params.expires_at,
            }
            if (loseResponse) {
              loseResponse = false
              throw new Error("response lost")
            }
            return session
          },
          retrieve: async (id: string) => {
            calls.push(["retrieve", id])
            return session
          },
        },
      },
    },
  }
  const input: any = {
    scope: { kind: "user", id: actor },
    clientAttemptId: "00000000-0000-4000-8000-000000000004",
    interval: "year",
    serverVerifiedEmail: "owner@example.com",
    claims: [{ kind: "account", namespace: "chaarlie", keyVersion: 1, value: "a".repeat(64) }],
    checkout: {
      origin: "https://example.com",
      customerEmail: "owner@example.com",
      leadId: actor,
      presentation: "elements",
    },
  }
  return {
    deps,
    input,
    calls,
    runtime,
    row: () => row,
    session: () => session,
    loseResponse: () => {
      loseResponse = true
    },
    setRow: (value: any) => {
      row = value
    },
  }
}

test("freezes accepted trial terms before Stripe and binds the verified session", async () => {
  const f = fixture()
  const result = await createDurableStripeTrialCheckout(f.input, f.deps)
  assert.equal(result.session.id, "cs_trial")
  assert.equal(result.offer.firstAmountMinor, 6999)
  const create = f.calls.find((call) => call[0] === "provider_create")
  assert.equal(create[1].metadata.trial_enrollment_id, enrollmentId)
  assert.equal(create[1].subscription_data.metadata.trial_enrollment_id, enrollmentId)
  assert.equal(create[1].subscription_data.trial_period_days, 7)
  assert.deepEqual(create[1].discounts, [{ coupon: "coupon_intro" }])
  assert.ok(
    f.calls.findIndex((c) => c[0] === "freeze") <
      f.calls.findIndex((c) => c[0] === "provider_create"),
  )
  assert.ok(
    f.calls.findIndex((c) => c[0] === "reserve_claims") <
      f.calls.findIndex((c) => c[0] === "provider_create"),
  )
  assert.equal(f.row().providerReference, "cs_trial")
  const frozen = f.calls.find((c) => c[0] === "freeze_management_catalog")
  assert.equal(frozen[1].month.stripePriceId, "price_month")
  assert.equal(frozen[1].year.stripeCouponId, "coupon_intro")
  assert.deepEqual(
    f.calls.filter((c) => c[0] === "attest").map((c) => c[1]),
    ["month", "year"],
  )
  assert.ok(f.calls.indexOf(frozen) < f.calls.findIndex((c) => c[0] === "provider_create"))
})

test("lost provider response retries identical frozen request after offer and caller changes", async () => {
  const f = fixture()
  f.loseResponse()
  await assert.rejects(createDurableStripeTrialCheckout(f.input, f.deps), /response lost/)
  f.runtime.catalog.annualCouponId = null
  f.input.checkout.customerEmail = "changed@example.com"
  await createDurableStripeTrialCheckout(f.input, f.deps)
  const creates = f.calls.filter((c) => c[0] === "provider_create")
  assert.deepEqual(creates[0], creates[1])
  assert.equal(f.calls.filter((c) => c[0] === "attest").length, 2)
  await createDurableStripeTrialCheckout(f.input, f.deps)
  assert.equal(f.calls.filter((c) => c[0] === "provider_create").length, 2)
  assert.ok(f.calls.some((c) => c[0] === "retrieve"))
})

test("rollout and eligibility failures cannot fall through to paid checkout", async () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => {
      f.runtime.enrollmentMode = "disabled"
    },
    (f: ReturnType<typeof fixture>) => {
      f.input.serverVerifiedEmail = ""
    },
    (f: ReturnType<typeof fixture>) => {
      f.input.interval = "quarter"
    },
    (f: ReturnType<typeof fixture>) => {
      f.deps.store.reserve = async () => "trial_used"
    },
    (f: ReturnType<typeof fixture>) => {
      f.deps.attest = async () => {
        throw new Error("catalog mismatch")
      }
    },
  ]) {
    const f = fixture()
    mutate(f)
    await assert.rejects(createDurableStripeTrialCheckout(f.input, f.deps))
    assert.ok(!f.calls.some((c) => c[0] === "provider_create"))
  }
})

test("expired ambiguous attempts and foreign provider bindings do not create or expose another session", async () => {
  for (const fault of ["expired", "account", "metadata", "mode"]) {
    const f = fixture()
    await createDurableStripeTrialCheckout(f.input, f.deps)
    if (fault === "expired") {
      f.row().providerReference = null
      f.row().expiresAt = new Date(now.getTime() - 1).toISOString()
    } else if (fault === "account") f.row().stripeAccountId = "acct_foreign"
    else if (fault === "metadata") f.session().metadata.trial_enrollment_id = actor
    else f.session().livemode = true
    await assert.rejects(createDurableStripeTrialCheckout(f.input, f.deps))
    assert.equal(f.calls.filter((c) => c[0] === "provider_create").length, 1)
  }
})

test("a retry may keep an old coupon but cannot silently select a different interval or owner", async () => {
  for (const fault of ["interval", "scope"]) {
    const f = fixture()
    const offer = createTrialOfferSnapshot("month", f.runtime.catalog)
    f.setRow({
      id: attemptId,
      enrollmentId,
      scope: f.input.scope,
      clientAttemptId: f.input.clientAttemptId,
      offer,
      status: "reserved",
      stripeAccountId: null,
      stripeLivemode: null,
      stripeParams: null,
      expiresAt: null,
      providerReference: null,
    })
    if (fault === "scope") {
      f.row().offer = createTrialOfferSnapshot("year", f.runtime.catalog)
      f.row().scope = { kind: "lead", id: actor }
    }
    await assert.rejects(createDurableStripeTrialCheckout(f.input, f.deps))
    assert.ok(!f.calls.some((c) => c[0] === "provider_create"))
  }
})

test("a completed bound session resumes without attempting to reserve an already consumed trial again", async () => {
  const f = fixture()
  await createDurableStripeTrialCheckout(f.input, f.deps)
  f.session().status = "complete"
  f.deps.store.reserve = async () => "invalid_state"
  const result = await createDurableStripeTrialCheckout(f.input, f.deps)
  assert.equal(result.session.status, "complete")
  assert.equal(f.calls.filter((c) => c[0] === "provider_create").length, 1)
})

test("a failed durable binding cannot expose a client secret", async () => {
  const f = fixture()
  f.deps.store.bind = async () => ({
    ...f.row(),
    status: "reconciliation_required",
    providerReference: null,
  })
  await assert.rejects(createDurableStripeTrialCheckout(f.input, f.deps), /reconciliation/)
})

test("confirmed uncompleted session expiry frees the reserved trial without consuming eligibility", async () => {
  const f = fixture()
  await createDurableStripeTrialCheckout(f.input, f.deps)
  Object.assign(f.session(), { status: "expired", subscription: null, payment_intent: null })
  const result = await createDurableStripeTrialCheckout(f.input, f.deps)
  assert.equal(result.session.status, "expired")
  assert.ok(f.calls.some((c) => c[0] === "release_claims"))
  f.session().subscription = "sub_unresolved"
  await assert.rejects(createDurableStripeTrialCheckout(f.input, f.deps), /reconciliation/)
})

test("frozen management offers survive runtime price and coupon changes before a request freeze retry", async () => {
  const f = fixture()
  const freeze = f.deps.store.freeze
  f.deps.store.freeze = async () => {
    throw new Error("freeze transport lost")
  }
  await assert.rejects(createDurableStripeTrialCheckout(f.input, f.deps), /freeze transport lost/)
  f.runtime.catalog.monthPriceId = "price_new_month"
  f.runtime.catalog.yearPriceId = "price_new_year"
  f.runtime.catalog.annualCouponId = null
  f.deps.store.freeze = freeze
  const result = await createDurableStripeTrialCheckout(f.input, f.deps)
  assert.equal(result.offer.stripeCouponId, "coupon_intro")
  assert.equal(f.calls.filter((c) => c[0] === "attest").length, 2)
  assert.equal(f.calls.filter((c) => c[0] === "freeze_management_catalog").length, 1)
})
