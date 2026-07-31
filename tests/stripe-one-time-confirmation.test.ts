import assert from "node:assert/strict"
import test from "node:test"

import {
  CheckoutActivationError,
  ensureOneTimeCheckoutAccount,
} from "../src/lib/stripe/checkout-activation"

const originalPrice = process.env.STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE
process.env.STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE = "price_once"

function fixture() {
  const calls: string[] = []
  const consent: any = {
    id: "consent-1",
    stripe_checkout_session_id: "cs_once",
    consent_text: "Sofort erstellen",
    copy_version: "2026-07-31",
    accepted_at: "2026-07-31T00:00:00.000Z",
    confirmation_status: "pending",
  }
  const purchases: any[] = []
  const profiles: any[] = []
  const table = (name: string) => {
    const rows =
      name === "personal_plan_one_time_checkout_consents"
        ? [consent]
        : name === "billing_one_time_purchases"
          ? purchases
          : profiles
    const filters: Array<[string, unknown]> = []
    const api: any = {
      select: () => api,
      eq: (key: string, value: unknown) => (filters.push([key, value]), api),
      maybeSingle: async () => ({
        data: rows.find((row) => filters.every(([k, v]) => row[k] === v)) ?? null,
        error: null,
      }),
      upsert: (row: any) => {
        calls.push(`upsert:${name}`)
        if (name === "profiles") profiles.push(row)
        else purchases.push(row)
        return { select: () => ({ single: async () => ({ data: row, error: null }) }) }
      },
      update: (patch: any) => {
        calls.push(`update:${name}:${patch.confirmation_status}`)
        Object.assign(consent, patch)
        return {
          eq: () => ({ select: () => ({ single: async () => ({ data: consent, error: null }) }) }),
        }
      },
    }
    return api
  }
  const session: any = {
    id: "cs_once",
    created: 1_753_923_200,
    status: "complete",
    mode: "payment",
    payment_status: "paid",
    amount_total: 2999,
    currency: "eur",
    customer: "cus_1",
    customer_details: { email: "paid@example.com" },
    payment_intent: { id: "pi_1", latest_charge: { id: "ch_1" } },
    line_items: { data: [{ price: { id: "price_once" } }] },
    metadata: { product_kind: "personal_plan_once", lead_id: "lead-1" },
  }
  const deps: any = {
    supabase: {
      from: table,
      auth: {
        admin: { createUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
      },
    },
    stripe: { checkout: { sessions: { retrieve: async () => session } } },
    premiumTierId: "",
  }
  return { calls, consent, purchases, deps, session }
}

test("sends and records confirmation before one-time entitlement", async () => {
  const state = fixture()
  state.deps.sendOneTimeConfirmation = async () => {
    state.calls.push("send")
    return { confirmationReference: "ref-1" }
  }
  await ensureOneTimeCheckoutAccount(state.session, state.deps)
  assert.ok(
    state.calls.indexOf("send") <
      state.calls.indexOf("update:personal_plan_one_time_checkout_consents:sent"),
  )
  assert.ok(
    state.calls.indexOf("update:personal_plan_one_time_checkout_consents:sent") <
      state.calls.indexOf("upsert:billing_one_time_purchases"),
  )
  assert.equal(state.consent.confirmation_status, "sent")
})

test("confirmation failure blocks one-time entitlement and records failed", async () => {
  const state = fixture()
  state.deps.sendOneTimeConfirmation = async () => {
    throw new Error("down")
  }
  await assert.rejects(
    () => ensureOneTimeCheckoutAccount(state.session, state.deps),
    (error: unknown) =>
      error instanceof CheckoutActivationError &&
      error.code === "checkout_one_time_confirmation_failed",
  )
  assert.equal(state.purchases.length, 0)
  assert.equal(state.consent.confirmation_status, "failed")
})

test("a sent confirmation is not sent again during activation retry", async () => {
  const state = fixture()
  state.consent.confirmation_status = "sent"
  state.deps.sendOneTimeConfirmation = async () => {
    throw new Error("must not send")
  }
  await ensureOneTimeCheckoutAccount(state.session, state.deps)
  assert.equal(state.purchases.length, 1)
})

test.after(() => {
  process.env.STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE = originalPrice
})
