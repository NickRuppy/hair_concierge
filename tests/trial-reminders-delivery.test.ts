import assert from "node:assert/strict"
import test from "node:test"
import { dispatchTrialReminders } from "../src/lib/billing/trial-reminders-delivery"
import {
  CustomerIoAmbiguousDeliveryError,
  CustomerIoHttpError,
} from "../src/lib/customerio/transactional"

const snapshot = {
  version: "trial_required_notices_v1",
  contractId: "11111111-1111-4111-8111-111111111111",
  provider: "stripe",
  termsVersion: "trial_launch_v1",
  interval: "year",
  currency: "EUR",
  firstAmountMinor: 6999,
  renewalAmountMinor: 9999,
  authorizedAt: "2026-09-14T10:00:00Z",
  trialEndAt: "2026-09-21T10:00:00Z",
  taxBehavior: "inclusive",
}
const claim = {
  reminder_id: snapshot.contractId,
  attempt_id: "22222222-2222-4222-8222-222222222222",
  user_id: "33333333-3333-4333-8333-333333333333",
  snapshot,
}
function fixture() {
  const calls: string[] = []
  const outcomes: unknown[] = []
  return {
    calls,
    outcomes,
    deps: {
      enabled: true,
      rolloutAt: "2026-09-14T00:00:00Z",
      apiKeyPresent: true,
      messageId: "chaarlie_trial_ending_reminder_v1",
      sender: "Chaarlie <info@chaarlie.de>",
      enqueue: async (cutoff: string) => {
        assert.equal(cutoff, "2026-09-14T00:00:00.000Z")
        calls.push("enqueue")
      },
      claim: async () => {
        calls.push("claim")
        return [claim]
      },
      recipient: async (id: string) => {
        assert.equal(id, claim.user_id)
        calls.push("recipient")
        return "owner@example.test"
      },
      prepare: async () => {
        calls.push("prepare")
        return claim
      },
      send: async (input: { email: string }) => {
        assert.equal(input.email, "owner@example.test")
        calls.push("send")
        return { deliveryId: "delivery1", queuedAt: "2026-09-19T10:00:00Z" }
      },
      settle: async (_claim: unknown, outcome: unknown) => {
        calls.push("settle")
        outcomes.push(outcome)
      },
    },
  }
}
test("enabled reminder enqueues cutoff and revalidates just before sending once to verified owner", async () => {
  const f = fixture()
  const result = await dispatchTrialReminders(f.deps)
  assert.deepEqual(f.calls, ["enqueue", "claim", "recipient", "prepare", "send", "settle"])
  assert.equal(result.queued, 1)
  assert.deepEqual(f.outcomes, [
    { status: "queued", deliveryId: "delivery1", queuedAt: "2026-09-19T10:00:00.000Z" },
  ])
})
test("off switch and missing configuration cannot enqueue, claim or send", async () => {
  for (const bad of [
    { enabled: false },
    { rolloutAt: undefined },
    { rolloutAt: "yesterday" },
    { rolloutAt: "2026-02-30T00:00:00Z" },
    { apiKeyPresent: false },
    { messageId: "" },
    { sender: "x\r\nBCC: x@example.test" },
  ]) {
    const f = fixture()
    const result = await dispatchTrialReminders({ ...f.deps, ...bad })
    assert.deepEqual(f.calls, [])
    assert.ok(result.disabled || result.blocked)
  }
})
test("cancellation or expiry after claim suppresses send at the fresh database gate", async () => {
  const f = fixture()
  const result = await dispatchTrialReminders({ ...f.deps, prepare: async () => null })
  assert.equal(result.skipped, 1)
  assert.ok(!f.calls.includes("send"))
  assert.ok(!f.calls.includes("settle"))
})
test("fresh current terms are rendered, not stale terms claimed earlier", async () => {
  const f = fixture()
  let sends = 0
  const result = await dispatchTrialReminders({
    ...f.deps,
    prepare: async () => ({
      ...claim,
      snapshot: { ...snapshot, interval: "month", firstAmountMinor: 999, renewalAmountMinor: 999 },
    }),
    send: async (input: { message: { receipt_text: string } }) => {
      sends++
      assert.match(input.message.receipt_text, /9,99/)
      assert.doesNotMatch(input.message.receipt_text, /69,99/)
      return { deliveryId: "d", queuedAt: 1789812000 }
    },
  })
  assert.equal(sends, 1)
  assert.equal(result.queued, 1)
})
test("missing verified owner and malformed or swapped fresh claims send nothing", async () => {
  for (const overrides of [
    { recipient: async () => null },
    { prepare: async () => ({ ...claim, snapshot: {} }) },
    { prepare: async () => ({ ...claim, user_id: "44444444-4444-4444-8444-444444444444" }) },
  ]) {
    const f = fixture()
    const result = await dispatchTrialReminders({ ...f.deps, ...overrides })
    assert.equal(result.supportRequired, 1)
    assert.ok(!f.calls.includes("send"))
  }
})
test("ambiguous delivery, malformed ACK and HTTP rejection park with no retry", async () => {
  for (const error of [
    new CustomerIoAmbiguousDeliveryError("timeout"),
    new CustomerIoHttpError(503),
    new Error("unknown"),
  ]) {
    const f = fixture()
    let sends = 0
    const result = await dispatchTrialReminders({
      ...f.deps,
      send: async () => {
        sends++
        throw error
      },
    })
    assert.equal(sends, 1)
    assert.equal(result.supportRequired, 1)
  }
  for (const ack of [
    { deliveryId: "", queuedAt: 0 },
    { deliveryId: "d", queuedAt: "bad-date" },
  ]) {
    const f = fixture()
    const result = await dispatchTrialReminders({ ...f.deps, send: async () => ack })
    assert.equal(result.supportRequired, 1)
  }
})
test("post-send settlement failure propagates and never repeats provider send", async () => {
  const f = fixture()
  await assert.rejects(
    dispatchTrialReminders({
      ...f.deps,
      settle: async () => {
        throw new Error("storage failed")
      },
    }),
    /storage failed/,
  )
  assert.equal(f.calls.filter((c) => c === "send").length, 1)
})
