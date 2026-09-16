import assert from "node:assert/strict"
import test from "node:test"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import { createClient } from "@supabase/supabase-js"
import {
  findPayPalTrialCheckoutAttempt,
  confirmPayPalTrialActivation,
  PayPalTrialConfirmationUnavailableError,
} from "../src/lib/paypal/trial-checkout-attempt"
import {
  frozenPayPalTrialStart,
  paypalTrialProviderStart,
} from "../src/lib/paypal/trial-collection-start"

const id = "11111111-1111-4111-8111-111111111111"
const at = "2026-09-16T12:00:00Z"
function row() {
  const expiry = "2026-09-19T12:00:00Z"
  const end = frozenPayPalTrialStart(expiry)
  return {
    id,
    enrollment_id: id,
    intent_token: "token",
    scope_kind: "user",
    scope_id: id,
    client_attempt_id: id,
    status: "provider_created",
    request_id: `paypal-trial:${id}:v2`,
    accepted_offer: createTrialOfferSnapshot("month", {
      monthPriceId: "m",
      yearPriceId: "y",
      annualCouponId: "c",
    }),
    request_expires_at: expiry,
    trial_end_at: end,
    provider_start_time: paypalTrialProviderStart(end),
    authorization_succeeded_at: null as string | null,
    activation_event_id: null as string | null,
  }
}
function read(value: object) {
  return findPayPalTrialCheckoutAttempt(
    { rpc: async () => ({ data: value, error: null }) } as never,
    "token",
  )
}

test("proof parser preserves API server confirmation separately from real webhook evidence", async () => {
  const result = await read({
    ...row(),
    authorization_proof_kind: "api_confirmation",
    authorization_succeeded_at: at,
    api_confirmed_at: at,
    api_confirmation_id: id,
  })
  assert.equal((result as any)?.authorizationProofKind, "api_confirmation")
  assert.equal((result as any)?.apiConfirmedAt, at)
  assert.equal(result?.activationEventId, null)
})

test("legacy rows infer webhook provenance only from a complete finite original event pair", async () => {
  const result = await read({
    ...row(),
    authorization_succeeded_at: at,
    activation_event_id: "WH-real",
  })
  assert.equal((result as any)?.authorizationProofKind, "webhook")
  assert.equal(((await read(row())) as any)?.authorizationProofKind, null)
})

test("ambiguous, fabricated or malformed admission proof shapes fail closed", async () => {
  for (const invalid of [
    { authorization_succeeded_at: at },
    { activation_event_id: "WH-real" },
    { authorization_succeeded_at: "invalid", activation_event_id: "WH-real" },
    { authorization_succeeded_at: at, activation_event_id: " " },
    {
      authorization_proof_kind: "future",
      authorization_succeeded_at: at,
      activation_event_id: "WH-real",
    },
    {
      authorization_proof_kind: null,
      authorization_succeeded_at: at,
      activation_event_id: "WH-real",
    },
    {
      authorization_proof_kind: "webhook",
      authorization_succeeded_at: at,
      activation_event_id: "WH-real",
      api_confirmation_id: id,
    },
    {
      authorization_proof_kind: "api_confirmation",
      authorization_succeeded_at: at,
      api_confirmed_at: at,
      api_confirmation_id: "not-uuid",
    },
    {
      authorization_proof_kind: "api_confirmation",
      authorization_succeeded_at: at,
      api_confirmed_at: "2026-09-16T12:00:01Z",
      api_confirmation_id: id,
    },
    {
      authorization_proof_kind: "api_confirmation",
      authorization_succeeded_at: at,
      api_confirmed_at: at,
      api_confirmation_id: id,
      activation_event_id: "WH-invented",
    },
    { api_confirmation_id: id, api_confirmed_at: at },
  ])
    await assert.rejects(() => read({ ...row(), ...invalid }), /proof|authorization/)
})

const confirmation = {
  token: "token",
  agreementId: "I-owned",
  confirmationId: id,
  appId: "APP-owned",
  planId: "P-month",
  providerStartTime: "2026-09-25T12:00:00Z",
  nextBillingTime: "2026-09-25T18:00:00Z",
}
function transportClient(fetch: typeof globalThis.fetch) {
  return createClient("http://127.0.0.1:1", "test-service-role-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  })
}

test("real PostgREST transport errors and uncoded gateway failures permit pending fallback", async () => {
  for (const fetch of [
    async () => {
      throw new TypeError("fetch failed")
    },
    async () => new Response("upstream unavailable", { status: 503 }),
    async () => new Response("too many requests", { status: 429 }),
    async () =>
      new Response(JSON.stringify({ message: "gateway timeout", code: "" }), { status: 504 }),
  ]) {
    let requests = 0
    const client = transportClient(async (...args) => {
      requests++
      return (fetch as typeof globalThis.fetch)(...args)
    })
    await assert.rejects(
      () => confirmPayPalTrialActivation(client, confirmation),
      PayPalTrialConfirmationUnavailableError,
    )
    assert.equal(requests, 1)
  }
})

test("structured SQL and permission failures never become temporary fallback even with a gateway status", async () => {
  for (const [status, code] of [
    [503, "23505"],
    [503, "P0001"],
    [503, "42501"],
    [503, "PGRST301"],
    [401, ""],
    [403, ""],
  ] as const) {
    const client = transportClient(
      async () =>
        new Response(JSON.stringify({ message: "binding or permission failure", code }), {
          status,
        }),
    )
    await assert.rejects(
      () => confirmPayPalTrialActivation(client, confirmation),
      (error: unknown) =>
        error instanceof Error &&
        !(error instanceof PayPalTrialConfirmationUnavailableError) &&
        error.message === "PayPal trial API confirmation failed",
    )
  }
})
