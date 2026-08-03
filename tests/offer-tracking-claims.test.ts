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

test("the organic offer and retired aliases remain once-per-ID without an open index", () => {
  for (const variant of ["organic-plan-v1", "guided-story", "guided-story-potential"]) {
    assert.deepEqual(resolveOfferFaqOpenClaim(variant, false, 0), {
      nextOpenIndex: 0,
      openIndex: undefined,
    })
  }
  assert.deepEqual(resolveOfferFaqOpenClaim("default", false, 0), {
    nextOpenIndex: 0,
    openIndex: undefined,
  })
  assert.equal(resolveOfferFaqOpenClaim("guided-story", true, 0), null)
})

test("the guided-story chat answer does not count toward engagement depth", () => {
  assert.equal(isOfferEngagementDepthSection("product_story_chat_answer"), false)
  assert.equal(isOfferEngagementDepthSection("pricing"), true)
})
