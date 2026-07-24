import assert from "node:assert/strict"
import test from "node:test"

import {
  claimOfferChapterReveals,
  isOfferEngagementDepthSection,
  resolveOfferFaqOpenClaim,
} from "../src/lib/analytics/offer-tracking-claims"
import type { OfferChapterId } from "../src/lib/analytics/events"

test("chapter claims include each newly revealed chapter once and in chapter order", () => {
  assert.deepEqual(claimOfferChapterReveals(new Set(["analysis"]), 3, 2), [
    { chapterId: "routine", chapterIndex: 2, revealGeneration: 2 },
    { chapterId: "support", chapterIndex: 3, revealGeneration: 2 },
  ])
})

test("chapter claims do not mutate the prior claim set or repeat earlier chapters", () => {
  const previouslyClaimed = new Set<OfferChapterId>(["analysis", "routine", "support", "pricing"])

  assert.deepEqual(claimOfferChapterReveals(previouslyClaimed, 4, 9), [])
  assert.deepEqual([...previouslyClaimed], ["analysis", "routine", "support", "pricing"])
})

test("guided-story assigns a one-based index to every FAQ open", () => {
  assert.deepEqual(resolveOfferFaqOpenClaim("guided-story", false, 0), {
    nextOpenIndex: 1,
    openIndex: 1,
  })
  assert.deepEqual(resolveOfferFaqOpenClaim("guided-story", true, 1), {
    nextOpenIndex: 2,
    openIndex: 2,
  })
})

test("other variants remain once-per-ID without adding an open index", () => {
  assert.deepEqual(resolveOfferFaqOpenClaim("default", false, 0), {
    nextOpenIndex: 0,
    openIndex: undefined,
  })
  assert.equal(resolveOfferFaqOpenClaim("default", true, 0), null)
})

test("the guided-story chat answer does not count toward engagement depth", () => {
  assert.equal(isOfferEngagementDepthSection("product_story_chat_answer"), false)
  assert.equal(isOfferEngagementDepthSection("pricing"), true)
})
