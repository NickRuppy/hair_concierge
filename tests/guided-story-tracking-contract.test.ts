import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("gated sections, chapter reveals, and FAQs rebind on reveal without duplicate events", () => {
  const source = readFileSync(
    new URL("../src/components/quiz/offer-tracking-provider.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /revealGeneration = 0/)
  assert.match(source, /viewedSectionsRef\.current\.has\(sectionId\)/)
  assert.match(source, /openedFaqsRef\.current\.has\(faqId\)/)
  assert.match(source, /claimOfferChapterReveals/)
  assert.match(source, /offer_chapter_revealed/)
  assert.match(source, /revealedThrough\?: 1 \| 2 \| 3 \| 4/)
  assert.match(source, /\[observeOfferSection, revealGeneration\]/)
  assert.match(source, /\[context, offerVariant, revealGeneration, trackOfferEngagement\]/)
  assert.match(source, /resolveOfferSectionIndex\(offerVariant, sectionId\)/)
  assert.match(source, /resolveOfferFaqOpenClaim/)
  assert.match(source, /faqOpenIndexRef\.current = faqOpenClaim\.nextOpenIndex/)
  assert.match(source, /openIndex: faqOpenClaim\.openIndex/)
})

test("provider shares its section claim path with the dynamic chat answer and excludes it from depth", () => {
  const provider = readFileSync(
    new URL("../src/components/quiz/offer-tracking-provider.tsx", import.meta.url),
    "utf8",
  )
  const chat = readFileSync(
    new URL("../src/components/quiz/guided-story-chat-demo.tsx", import.meta.url),
    "utf8",
  )
  const support = readFileSync(
    new URL("../src/components/quiz/guided-story-support.tsx", import.meta.url),
    "utf8",
  )

  assert.match(provider, /observeOfferSection: \(sectionId: OfferSectionId, element: HTMLElement\)/)
  assert.match(provider, /isOfferEngagementDepthSection\(sectionId\)/)
  assert.match(provider, /filter\(isOfferEngagementDepthSection\)/)
  assert.match(chat, /observeOfferSection\("product_story_chat_answer", answer\)/)
  assert.match(chat, /ref=\{answerRef\}/)
  assert.doesNotMatch(chat, /data-offer-section/)
  assert.match(support, /data-offer-section="product_story_chat"/)
})

test("guided-story details carry explicit click identity while preserving transition order", () => {
  const analysis = readFileSync(
    new URL("../src/components/quiz/guided-story-analysis.tsx", import.meta.url),
    "utf8",
  )
  const routine = readFileSync(
    new URL("../src/components/quiz/guided-story-routine.tsx", import.meta.url),
    "utf8",
  )

  assert.match(analysis, /setSelectedIndex\(index\)[\s\S]*trackDetailOpened/)
  assert.match(analysis, /detailId: `priority_\$\{index \+ 1\}`/)
  assert.match(
    routine,
    /setActivePopover\(\{ type: "product", key: product\.key \}\)[\s\S]*trackDetailOpened/,
  )
  assert.match(routine, /detailId: product\.category/)
  assert.match(routine, /candidate\.key === product\.key/)
  assert.match(routine, /further_care/)
  assert.match(routine, /<div data-offer-section="mini_routine">/)
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
  assert.match(source, /revealedThrough=\{flow\.revealedThrough\}/)
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
