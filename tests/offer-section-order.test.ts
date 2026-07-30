import assert from "node:assert/strict"
import test from "node:test"

import { resolveOfferSectionIndex } from "../src/lib/analytics/offer-section-order"

test("guided-story keeps stable contiguous indices across gated reveals", () => {
  assert.equal(resolveOfferSectionIndex("guided-story", "personalized_analysis"), 0)
  assert.equal(resolveOfferSectionIndex("guided-story", "product_story_chat"), 3)
  assert.equal(resolveOfferSectionIndex("guided-story", "pricing"), 6)
  assert.equal(resolveOfferSectionIndex("guided-story", "faq"), 7)
  assert.equal(resolveOfferSectionIndex("guided-story", "product_story_chat_answer"), 8)
})

test("every guided-story experiment arm shares the guided behavior and founder letter has its slot", () => {
  assert.equal(resolveOfferSectionIndex("guided-story-locked", "pricing"), 6)
  assert.equal(resolveOfferSectionIndex("guided-story-potential", "faq"), 7)
  assert.equal(resolveOfferSectionIndex("guided-story-founder-letter", "founder_letter"), 1)
  assert.equal(resolveOfferSectionIndex("guided-story-founder-letter", "mini_routine"), 2)
})

test("incumbent variants preserve their existing DOM-order section indices", () => {
  assert.equal(resolveOfferSectionIndex("app-value-stack", "product_story_routine"), 5)
  assert.equal(resolveOfferSectionIndex("app-value-stack", "product_story_chat"), 6)
  assert.equal(resolveOfferSectionIndex("app-value-stack", "pricing"), 9)
  assert.equal(resolveOfferSectionIndex("app-value-stack", "final_cta"), 11)

  assert.equal(resolveOfferSectionIndex("default", "product_story_chat"), 4)
  assert.equal(resolveOfferSectionIndex("default", "pricing"), 8)
  assert.equal(resolveOfferSectionIndex("default", "final_cta"), 11)
})

test("personal-plan keeps the v2 visual order with before/after before pricing", () => {
  const personalPlanOrder = [
    "hero",
    "personal_plan_diagnosis",
    "personal_plan_complete_plan",
    "personal_plan_method",
    "personal_plan_before_after",
    "pricing",
    "personal_plan_survey",
    "testimonials",
    "guarantee",
    "faq",
    "final_cta",
  ] as const

  for (const [index, sectionId] of personalPlanOrder.entries()) {
    assert.equal(resolveOfferSectionIndex("personal-plan-v1", sectionId), index)
  }
})

test("unknown section combinations sort after a variant's declared sections", () => {
  assert.equal(resolveOfferSectionIndex("guided-story", "final_cta"), 9)
  assert.equal(resolveOfferSectionIndex("app-value-stack", "guarantee"), 12)
})
