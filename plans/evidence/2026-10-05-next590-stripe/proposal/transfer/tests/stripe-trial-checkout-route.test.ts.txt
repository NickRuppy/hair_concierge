import assert from "node:assert/strict"
import test from "node:test"
import {
  returningCheckoutFixture,
  ATTEMPT_ID,
  LEAD_ID,
  USER_ID,
} from "./helpers/returning-checkout-route-fixture"

const body = {
  trial: true,
  interval: "year",
  source: "quiz_result_offer",
  leadId: LEAD_ID,
  checkoutContext: undefined,
  returnDestination: undefined,
  checkoutAttemptId: ATTEMPT_ID,
  checkoutSessionAttemptId: LEAD_ID,
}

test("explicit trial intent dispatches the frozen trial service using server-resolved identity", async () => {
  const f = returningCheckoutFixture({ trialMode: "restricted" })
  const result = await f.post("stripe", body)
  assert.equal(result.status, 200)
  assert.equal(result.body.client_secret, "trial_secret")
  assert.equal(f.state.calls.length, 0)
  const input = f.state.trialCalls[0][0]
  assert.equal(input.interval, "year")
  assert.equal(input.scope.kind, "user")
  assert.equal(input.scope.id, USER_ID)
  assert.equal(input.serverVerifiedEmail, "login@example.test")
  assert.equal(input.claims.length, 2)
  assert.equal(input.claims[0].kind, "account")
  assert.equal(input.claims[1].kind, "verified_email")
})

test("disabled or unverified restricted trial requests never create a legacy paid checkout", async () => {
  for (const options of [
    {},
    { trialMode: "disabled" as const },
    { trialMode: "restricted" as const, unverifiedEmail: true },
    { trialMode: "restricted" as const, signedOut: true },
  ]) {
    const f = returningCheckoutFixture(options)
    const result = await f.post("stripe", body)
    assert.equal(result.status, 404)
    assert.equal(f.state.calls.length, 0)
    assert.equal(f.state.trialCalls.length, 0)
  }
})

test("anonymous public trial keeps the lead flow without treating its email as verified", async () => {
  const f = returningCheckoutFixture({ trialMode: "public", signedOut: true })
  const result = await f.post("stripe", body)
  assert.equal(result.status, 200)
  const input = f.state.trialCalls[0][0]
  assert.equal(input.scope.kind, "lead")
  assert.equal(input.scope.id, LEAD_ID)
  assert.equal(input.serverVerifiedEmail, "")
  assert.equal(input.claims.length, 0)
  assert.equal(f.state.calls.length, 0)
})

test("trial checkout preserves acquisition context and records zero current revenue", async () => {
  const f = returningCheckoutFixture({ trialMode: "restricted", attributedTrial: true })
  const result = await f.post("stripe", { ...body, funnelSessionId: ATTEMPT_ID })
  assert.equal(result.status, 200)
  assert.equal(f.state.trialCalls[0][0].checkout.funnelSessionId, ATTEMPT_ID)
  assert.equal(f.state.trialCalls[0][0].checkout.metadata.is_internal_test, "true")
  assert.equal(f.state.funnelEvents.length, 1)
  assert.equal(f.state.funnelEvents[0].milestone, "checkout_started")
  assert.equal(f.state.funnelEvents[0].properties.value, 0)
  assert.equal(f.state.funnelEvents[0].checkoutReference, "cs_trial")
})

test("trial intent rejects unsupported protocols and propagates trial failures without paid fallback", async () => {
  for (const changed of [
    { interval: "quarter" },
    { action: "prepare" },
    { source: "premium_sheet" },
    { checkoutContext: "membership_reactivation" },
    { purchaseKind: "personal_plan_once" },
  ]) {
    const f = returningCheckoutFixture({ trialMode: "restricted" })
    const result = await f.post("stripe", { ...body, ...changed })
    assert.equal(result.status, 400)
    assert.equal(f.state.trialCalls.length, 0)
    assert.equal(f.state.calls.length, 0)
  }
  const f = returningCheckoutFixture({
    trialMode: "restricted",
    trialCheckoutError: "Trial checkout eligibility denied",
  })
  const result = await f.post("stripe", body)
  assert.equal(result.status, 503)
  assert.equal(f.state.trialCalls.length, 1)
  assert.equal(f.state.calls.length, 0)
})
