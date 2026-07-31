import assert from "node:assert/strict"
import test from "node:test"

import {
  PERSONAL_PLAN_ONE_TIME_CONFIRMATION_MESSAGE_ID,
  PERSONAL_PLAN_ONE_TIME_CONFIRMATION_MESSAGE_ID_ENV,
  buildPersonalPlanOneTimeConfirmationPayload,
  getPersonalPlanOneTimeConfirmationMessageId,
  sendPersonalPlanOneTimeConfirmation,
} from "../src/lib/customerio/personal-plan-one-time-confirmation"

const input = {
  email: "  lea@example.com ",
  consent: {
    text: "Ich verlange ausdrücklich die sofortige Erstellung meines Haarplans.",
    version: "2026-07-31",
    acceptedAt: "2026-07-31T10:15:00.000Z",
  },
  payment: { provider: "stripe" as const, reference: "  cs_test_123  " },
  supportUrl: "https://chaarlie.example/kontakt",
  withdrawalUrl: "https://chaarlie.example/widerruf",
  resultUrl: "https://chaarlie.example/result/lead-123",
}

test("builds the one-time confirmation payload with consent and access details only", () => {
  const exactConsentText = `${input.consent.text}\n`
  const payload = buildPersonalPlanOneTimeConfirmationPayload({
    ...input,
    consent: { ...input.consent, text: exactConsentText },
  })

  assert.equal(payload.to, "lea@example.com")
  assert.equal(payload.transactionalMessageId, PERSONAL_PLAN_ONE_TIME_CONFIRMATION_MESSAGE_ID)
  assert.deepEqual(payload.messageData, {
    product_name: "Persönlicher Haarplan",
    amount_eur: "29.99",
    currency: "EUR",
    is_subscription: false,
    subscription_text: "Kein Abo. Es handelt sich um eine einmalige Zahlung.",
    consent_text: exactConsentText,
    consent_version: "2026-07-31",
    consent_accepted_at: "2026-07-31T10:15:00.000Z",
    payment_provider: "Stripe",
    payment_reference: "cs_test_123",
    support_contact_url: input.supportUrl,
    withdrawal_url: input.withdrawalUrl,
    result_url: input.resultUrl,
  })
  assert.equal("quiz_answers" in payload.messageData, false)
  assert.equal("diagnostics" in payload.messageData, false)
})

test("uses the configured transactional message ID and trims it", () => {
  assert.equal(
    getPersonalPlanOneTimeConfirmationMessageId({
      [PERSONAL_PLAN_ONE_TIME_CONFIRMATION_MESSAGE_ID_ENV]: " 42 ",
    }),
    42,
  )
  assert.equal(
    getPersonalPlanOneTimeConfirmationMessageId({
      [PERSONAL_PLAN_ONE_TIME_CONFIRMATION_MESSAGE_ID_ENV]: " personal_plan_paid ",
    }),
    "personal_plan_paid",
  )
  assert.equal(
    getPersonalPlanOneTimeConfirmationMessageId({}),
    PERSONAL_PLAN_ONE_TIME_CONFIRMATION_MESSAGE_ID,
  )
})

test("fails closed for malformed confirmation input", () => {
  assert.throws(
    () => buildPersonalPlanOneTimeConfirmationPayload({ ...input, email: "not-an-email" }),
    /email/,
  )
  assert.throws(
    () =>
      buildPersonalPlanOneTimeConfirmationPayload({
        ...input,
        payment: { provider: "stripe", reference: "   " },
      }),
    /Too small/,
  )
})

test("returns a stable sent reference only after Customer.io accepts the request", async () => {
  const sent = [] as unknown[]
  const result = await sendPersonalPlanOneTimeConfirmation(input, {
    send: async (payload) => {
      sent.push(payload)
    },
  })

  assert.equal(sent.length, 1)
  assert.equal(
    result.confirmationReference,
    "customerio:personal_plan_one_time_confirmation:stripe:cs_test_123",
  )
})

test("propagates Customer.io failures without returning a sent reference", async () => {
  await assert.rejects(
    sendPersonalPlanOneTimeConfirmation(input, {
      send: async () => {
        throw new Error("Customer.io unavailable")
      },
    }),
    /Customer.io unavailable/,
  )
})
