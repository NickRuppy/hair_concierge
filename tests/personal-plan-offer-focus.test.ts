import assert from "node:assert/strict"
import test from "node:test"

import {
  PERSONAL_PLAN_OFFER_HIGHLIGHTS_FOCUS,
  resolvePersonalPlanOfferFocusTarget,
} from "../src/lib/personal-plan-quiz/offer-focus"

test("resolves only the supported personal-plan email focus", () => {
  assert.equal(
    resolvePersonalPlanOfferFocusTarget(PERSONAL_PLAN_OFFER_HIGHLIGHTS_FOCUS),
    "personal_plan_complete_plan",
  )
  assert.equal(resolvePersonalPlanOfferFocusTarget("pricing"), null)
  assert.equal(resolvePersonalPlanOfferFocusTarget(null), null)
})
