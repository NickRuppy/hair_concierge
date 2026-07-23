import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("gated sections and FAQs rebind on reveal without duplicate events", () => {
  const source = readFileSync(
    new URL("../src/components/quiz/offer-tracking-provider.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /revealGeneration = 0/)
  assert.match(source, /viewedSectionsRef\.current\.has\(sectionId\)/)
  assert.match(source, /openedFaqsRef\.current\.has\(faqId\)/)
  assert.match(source, /\[context, offerVariant, revealGeneration, trackOfferEngagement\]/)
  assert.match(source, /\[context, revealGeneration, trackOfferEngagement\]/)
  assert.match(source, /resolveOfferSectionIndex\(offerVariant, sectionId\)/)
})

test("guided-story reports its displayed identity and dedicated revision", () => {
  const source = readFileSync(
    new URL("../src/funnels/offers/guided-story.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /offerRevision=\{GUIDED_STORY_OFFER_REVISION\}/)
  assert.match(source, /preview\.analytics\.needLane/)
  assert.match(source, /preview\.analytics\.shampooModuleId/)
  assert.match(source, /preview\.analytics\.conditionerModuleId/)
  assert.match(source, /preview\.analytics\.suggestedCategory/)
  assert.match(source, /revealGeneration=\{flow\.revealGeneration\}/)
})

test("legacy offer callers keep their legacy preview identity through the narrow provider seam", () => {
  for (const file of [
    "../src/funnels/offers/app-value-stack.tsx",
    "../src/components/quiz/quiz-result-offer-page.tsx",
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8")
    assert.match(source, /trackingIdentity=\{\{/)
    assert.match(source, /needLane: preview\.lane/)
  }
})
