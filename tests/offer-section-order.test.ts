import assert from "node:assert/strict"
import test from "node:test"

import { resolveOfferSectionIndex } from "../src/lib/analytics/offer-section-order"

test("retired legacy variants use the organic presentation order", () => {
  for (const variant of [
    "default",
    "app-value-stack",
    "guided-story",
    "guided-story-locked",
    "guided-story-founder-letter",
    "guided-story-potential",
  ]) {
    assert.equal(
      resolveOfferSectionIndex(variant, "pricing"),
      resolveOfferSectionIndex("organic-plan-v1", "pricing"),
    )
  }
})

test("organic order matches every rendered tracked section", () => {
  const organicOrder = [
    "hero",
    "personal_plan_diagnosis",
    "personal_plan_complete_plan",
    "pricing",
    "personal_plan_method",
    "personal_plan_before_after",
    "personal_plan_survey",
    "testimonials",
    "guarantee",
    "faq",
    "final_cta",
  ] as const

  for (const [index, sectionId] of organicOrder.entries()) {
    assert.equal(resolveOfferSectionIndex("organic-plan-v1", sectionId), index)
  }
})

test("personal-plan keeps the v4 visual order with testimonials directly after pricing", () => {
  const personalPlanOrder = [
    "hero",
    "personal_plan_diagnosis",
    "pricing",
    "testimonials",
    "personal_plan_complete_plan",
    "personal_plan_method",
    "personal_plan_before_after",
    "personal_plan_survey",
    "guarantee",
    "faq",
    "final_cta",
  ] as const

  for (const [index, sectionId] of personalPlanOrder.entries()) {
    assert.equal(resolveOfferSectionIndex("personal-plan-v1", sectionId), index)
  }
})

test("personal-plan pricing treatment arms keep the same section order", () => {
  for (const variant of ["personal-plan-membership-v1", "personal-plan-one-time-v1"]) {
    assert.equal(resolveOfferSectionIndex(variant, "hero"), 0)
    assert.equal(resolveOfferSectionIndex(variant, "pricing"), 2)
    assert.equal(resolveOfferSectionIndex(variant, "testimonials"), 3)
    assert.equal(resolveOfferSectionIndex(variant, "final_cta"), 10)
  }
})

test("unknown section combinations sort after a variant's declared sections", () => {
  assert.equal(resolveOfferSectionIndex("organic-plan-v1", "product_story_chat_answer"), 11)
})
