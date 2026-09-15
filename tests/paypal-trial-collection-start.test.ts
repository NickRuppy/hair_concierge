import assert from "node:assert/strict"
import test from "node:test"
import {
  paypalTrialCollectionStart,
  paypalTrialCollectionWindowEnd,
} from "../src/lib/paypal/trial-collection-start"

test("collection start is the next UTC midnight strictly after the trial end", () => {
  assert.equal(paypalTrialCollectionStart("2026-09-22T12:47:35Z"), "2026-09-23T00:00:00.000Z")
  assert.equal(paypalTrialCollectionStart("2026-09-22T23:59:59Z"), "2026-09-23T00:00:00.000Z")
  assert.equal(paypalTrialCollectionStart("2026-09-22T00:00:00.001Z"), "2026-09-23T00:00:00.000Z")
})

test("a trial ending exactly at UTC midnight still moves collection a full day later", () => {
  assert.equal(paypalTrialCollectionStart("2026-09-23T00:00:00Z"), "2026-09-24T00:00:00.000Z")
})

test("collection start is always strictly after the trial end", () => {
  for (const end of [
    "2026-09-15T10:48:09Z",
    "2026-12-31T23:30:00Z",
    "2026-10-24T22:30:00Z",
    "2027-02-28T05:00:00Z",
  ]) {
    const start = Date.parse(paypalTrialCollectionStart(end))
    assert.ok(start > Date.parse(end))
    assert.ok(start - Date.parse(end) <= 24 * 60 * 60 * 1000)
  }
})

test("the collection window covers the provider's daily batch on the collection date or the next", () => {
  const start = paypalTrialCollectionStart("2026-09-22T12:47:35Z")
  const windowEnd = paypalTrialCollectionWindowEnd(start)
  assert.equal(windowEnd, "2026-09-25T00:00:00.000Z")
  const batch = Date.parse("2026-09-23T10:00:00Z")
  assert.ok(batch >= Date.parse(start) && batch < Date.parse(windowEnd))
})

test("invalid input fails closed", () => {
  assert.throws(() => paypalTrialCollectionStart("not-a-timestamp"))
})
