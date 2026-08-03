import assert from "node:assert/strict"
import test from "node:test"

import { resolveOfferPresentationVariant } from "../src/lib/funnel/offer-presentation"

test("retired legacy IDs select the organic renderer without changing their identity", () => {
  for (const variant of [
    "default",
    "app-value-stack",
    "guided-story",
    "guided-story-locked",
    "guided-story-founder-letter",
    "guided-story-potential",
  ]) {
    assert.equal(resolveOfferPresentationVariant(variant), "organic-plan-v1")
  }
  assert.equal(
    resolveOfferPresentationVariant("personal-plan-one-time-v1"),
    "personal-plan-one-time-v1",
  )
})
