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

test("incumbent variants preserve their existing DOM-order section indices", () => {
  assert.equal(resolveOfferSectionIndex("app-value-stack", "product_story_routine"), 5)
  assert.equal(resolveOfferSectionIndex("app-value-stack", "product_story_chat"), 6)
  assert.equal(resolveOfferSectionIndex("app-value-stack", "pricing"), 9)
  assert.equal(resolveOfferSectionIndex("app-value-stack", "final_cta"), 11)

  assert.equal(resolveOfferSectionIndex("default", "product_story_chat"), 4)
  assert.equal(resolveOfferSectionIndex("default", "pricing"), 8)
  assert.equal(resolveOfferSectionIndex("default", "final_cta"), 11)
})

test("unknown section combinations sort after a variant's declared sections", () => {
  assert.equal(resolveOfferSectionIndex("guided-story", "final_cta"), 9)
  assert.equal(resolveOfferSectionIndex("app-value-stack", "guarantee"), 12)
})
