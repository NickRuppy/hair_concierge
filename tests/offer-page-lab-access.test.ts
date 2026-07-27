import assert from "node:assert/strict"
import test from "node:test"

import { isOfferPageLabEnabled } from "../src/lib/labs/offer-page-access"

test("offer-page review lab is available locally and on Vercel Preview", () => {
  assert.equal(isOfferPageLabEnabled({ NODE_ENV: "development" }), true)
  assert.equal(isOfferPageLabEnabled({ NODE_ENV: "production", VERCEL_ENV: "preview" }), true)
})

test("offer-page review lab can be enabled only by the dedicated CI smoke flag", () => {
  assert.equal(
    isOfferPageLabEnabled({
      CI: "true",
      CI_OFFER_PAGE_LAB_ENABLED: "true",
      NODE_ENV: "production",
    }),
    true,
  )
  assert.equal(
    isOfferPageLabEnabled({
      CI_OFFER_PAGE_LAB_ENABLED: "true",
      NODE_ENV: "production",
    }),
    false,
  )
  assert.equal(isOfferPageLabEnabled({ CI: "true", NODE_ENV: "production" }), false)
})

test("offer-page review lab stays unavailable in production", () => {
  assert.equal(isOfferPageLabEnabled({ NODE_ENV: "production", VERCEL_ENV: "production" }), false)
  assert.equal(isOfferPageLabEnabled({ NODE_ENV: "production" }), false)
})
