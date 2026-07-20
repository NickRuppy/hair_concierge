import assert from "node:assert/strict"
import test from "node:test"

import { isOfferPageLabEnabled } from "../src/lib/labs/offer-page-access"

test("offer-page review lab is available locally and on Vercel Preview", () => {
  assert.equal(isOfferPageLabEnabled({ NODE_ENV: "development" }), true)
  assert.equal(isOfferPageLabEnabled({ NODE_ENV: "production", VERCEL_ENV: "preview" }), true)
})

test("offer-page review lab stays unavailable in production", () => {
  assert.equal(isOfferPageLabEnabled({ NODE_ENV: "production", VERCEL_ENV: "production" }), false)
  assert.equal(isOfferPageLabEnabled({ NODE_ENV: "production" }), false)
})
