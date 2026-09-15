import assert from "node:assert/strict"
import test from "node:test"
import {
  frozenPayPalTrialStart,
  paypalTrialCollectionStart,
  paypalTrialCollectionWindowEnd,
  paypalTrialNextBillingMatches,
  trialFirstCollectionWindowEnd,
} from "../src/lib/paypal/trial-collection-start"

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

test("collection start is the next UTC midnight after a second-exact (legacy) trial end", () => {
  assert.equal(paypalTrialCollectionStart("2026-09-22T12:47:35Z"), "2026-09-23T00:00:00.000Z")
  assert.equal(paypalTrialCollectionStart("2026-09-22T23:59:59Z"), "2026-09-23T00:00:00.000Z")
  assert.equal(paypalTrialCollectionStart("2026-09-22T00:00:00.001Z"), "2026-09-23T00:00:00.000Z")
})

test("a trial end that already sits on a UTC midnight is its own collection start", () => {
  // Frozen PayPal trial ends are UTC midnights: the trial ends and the first
  // collection is due on the same disclosed date.
  assert.equal(paypalTrialCollectionStart("2026-09-23T00:00:00Z"), "2026-09-23T00:00:00.000Z")
  assert.equal(paypalTrialCollectionStart("2026-09-23T00:00:00.000Z"), "2026-09-23T00:00:00.000Z")
})

test("collection start never precedes the trial end and never exceeds it by a day", () => {
  for (const end of [
    "2026-09-15T10:48:09Z",
    "2026-12-31T23:30:00Z",
    "2026-10-24T22:30:00Z",
    "2027-02-28T05:00:00Z",
    "2026-09-24T00:00:00Z",
  ]) {
    const start = Date.parse(paypalTrialCollectionStart(end))
    assert.ok(start >= Date.parse(end))
    assert.ok(start - Date.parse(end) < DAY)
  }
})

test("the collection window covers the provider's daily batch on the collection date or the next", () => {
  const start = paypalTrialCollectionStart("2026-09-22T12:47:35Z")
  const windowEnd = paypalTrialCollectionWindowEnd(start)
  assert.equal(windowEnd, "2026-09-25T00:00:00.000Z")
  const batch = Date.parse("2026-09-23T10:00:00Z")
  assert.ok(batch >= Date.parse(start) && batch < Date.parse(windowEnd))
  // Aligned trial end: the window closes two days after the disclosed date.
  assert.equal(
    paypalTrialCollectionWindowEnd(paypalTrialCollectionStart("2026-09-24T00:00:00Z")),
    "2026-09-26T00:00:00.000Z",
  )
})

test("frozen trial start is the next UTC midnight strictly after freeze + 8 days", () => {
  // request_expires_at = freeze + 72h, so freeze 2026-09-15T14:00Z ⇒ expiry 2026-09-18T14:00Z.
  assert.equal(frozenPayPalTrialStart("2026-09-18T14:00:00.000Z"), "2026-09-24T00:00:00.000Z")
  // Freeze one second before midnight still lands on the same midnight as the rest of that UTC day.
  assert.equal(frozenPayPalTrialStart("2026-09-18T23:59:59.000Z"), "2026-09-24T00:00:00.000Z")
  // Freeze exactly at midnight moves to the following midnight (strictly after freeze + 8d).
  assert.equal(frozenPayPalTrialStart("2026-09-19T00:00:00.000Z"), "2026-09-25T00:00:00.000Z")
  // Sub-second freeze timestamps are irrelevant: the result is always a whole midnight.
  assert.equal(frozenPayPalTrialStart("2026-09-18T14:00:00.837Z"), "2026-09-24T00:00:00.000Z")
})

test("every approval inside the 24-hour intent window ends its 7-day trial before the frozen start", () => {
  for (const freeze of [
    "2026-09-15T00:00:00Z",
    "2026-09-15T00:00:01Z",
    "2026-09-15T13:37:00Z",
    "2026-09-15T23:59:59Z",
    "2026-10-24T22:30:00Z",
    "2026-12-31T23:59:59Z",
  ]) {
    const f = Date.parse(freeze)
    const start = Date.parse(frozenPayPalTrialStart(new Date(f + 72 * HOUR).toISOString()))
    for (const offset of [0, 1000, 3 * HOUR, 23 * HOUR + 59 * 60 * 1000, 24 * HOUR]) {
      const approval = f + offset
      assert.ok(approval + 7 * DAY <= start, `${freeze} +${offset}ms`)
    }
    // Never more than nine days of free access from freeze, and never less than eight.
    assert.ok(start - f > 8 * DAY && start - f <= 9 * DAY, freeze)
    assert.equal(start % DAY, 0)
    assert.equal(
      paypalTrialCollectionStart(new Date(start).toISOString()),
      new Date(start).toISOString(),
    )
  }
})

test("next billing matches when it sits at or after an aligned frozen start inside the window", () => {
  const start = "2026-09-24T00:00:00.000Z"
  assert.equal(paypalTrialNextBillingMatches(start, start), true)
  assert.equal(paypalTrialNextBillingMatches(start, "2026-09-24T10:00:00Z"), true)
  assert.equal(paypalTrialNextBillingMatches(start, "2026-09-25T10:00:00Z"), true)
  assert.equal(paypalTrialNextBillingMatches(start, "2026-09-26T00:00:00Z"), false)
  assert.equal(paypalTrialNextBillingMatches(start, "2026-09-23T10:00:00Z"), false)
  assert.equal(paypalTrialNextBillingMatches(start, null), false)
})

test("invalid input fails closed", () => {
  assert.throws(() => paypalTrialCollectionStart("not-a-timestamp"))
  assert.throws(() => frozenPayPalTrialStart("not-a-timestamp"))
  assert.throws(() => frozenPayPalTrialStart(null))
})

test("the access bridge keeps exact-seven-day contracts on their original window and closes frozen ends two days out", () => {
  // Stripe / legacy PayPal: authorization + 7 days, second-exact → next midnight + 2 days.
  assert.equal(
    trialFirstCollectionWindowEnd("2026-09-15T10:00:00Z", "2026-09-22T10:00:00Z"),
    "2026-09-25T00:00:00.000Z",
  )
  // Stripe authorized exactly at midnight: still the original window (unchanged behaviour).
  assert.equal(
    trialFirstCollectionWindowEnd("2026-09-15T00:00:00Z", "2026-09-22T00:00:00Z"),
    "2026-09-25T00:00:00.000Z",
  )
  // Frozen PayPal end: more than seven days out, on a midnight → end + 2 days.
  assert.equal(
    trialFirstCollectionWindowEnd("2026-09-15T14:00:00Z", "2026-09-24T00:00:00Z"),
    "2026-09-26T00:00:00.000Z",
  )
  assert.throws(() => trialFirstCollectionWindowEnd("nope", "2026-09-24T00:00:00Z"))
})
