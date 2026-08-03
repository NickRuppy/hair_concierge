import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("offer provider claims sections and FAQs without duplicate events", () => {
  const source = readFileSync(
    new URL("../src/components/quiz/offer-tracking-provider.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /viewedSectionsRef\.current\.has\(sectionId\)/)
  assert.match(source, /openedFaqsRef\.current\.has\(faqId\)/)
  assert.match(source, /resolveOfferSectionIndex\(offerVariant, sectionId\)/)
  assert.match(source, /resolveOfferFaqOpenClaim/)
  assert.match(source, /faqOpenIndexRef\.current = faqOpenClaim\.nextOpenIndex/)
  assert.match(source, /openIndex: faqOpenClaim\.openIndex/)
})

test("organic offer reports its own revision while preserving the stored offer identity", () => {
  const source = readFileSync(
    new URL("../src/components/organic-plan-offer/organic-plan-offer.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /ORGANIC_PLAN_OFFER_REVISION = "organic_plan_v1"/)
  assert.match(source, /offerRevision=\{ORGANIC_PLAN_OFFER_REVISION\}/)
  assert.match(source, /offerVariant=\{offerVariant\}/)
  assert.match(source, /needLane: null/)
  assert.match(source, /suggestedCategory: null/)
  assert.doesNotMatch(source, /revealedThrough=|revealGeneration=/)
})
