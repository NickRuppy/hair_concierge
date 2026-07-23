import assert from "node:assert/strict"
import test from "node:test"

import {
  getOfferStripePromise,
  resetOfferStripePromiseForTests,
} from "../src/lib/stripe/offer-client-loader"

const originalKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

test.afterEach(() => {
  if (originalKey === undefined) delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  else process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = originalKey
  resetOfferStripePromiseForTests()
})

test("returns a stable unloaded promise when Stripe is not configured", async () => {
  delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  let calls = 0
  const loader = async () => {
    calls += 1
    return null
  }

  const first = getOfferStripePromise(loader)
  const second = getOfferStripePromise(loader)
  assert.equal(first, second)
  assert.equal(await first, null)
  assert.equal(calls, 0)
})

test("shares one configured loader promise between warm-up and checkout", async () => {
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_guided_story"
  let calls = 0
  const loader = async (key: string) => {
    calls += 1
    assert.equal(key, "pk_test_guided_story")
    return null
  }

  const first = getOfferStripePromise(loader)
  const second = getOfferStripePromise(loader)
  assert.equal(first, second)
  await first
  assert.equal(calls, 1)
})

test("clears a failed load so checkout can retry", async () => {
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_guided_story"
  let calls = 0
  const loader = async () => {
    calls += 1
    if (calls === 1) throw new Error("temporary")
    return null
  }

  await assert.rejects(getOfferStripePromise(loader), /temporary/)
  assert.equal(await getOfferStripePromise(loader), null)
  assert.equal(calls, 2)
})
