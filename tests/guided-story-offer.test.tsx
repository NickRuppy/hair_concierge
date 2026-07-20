import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import GuidedStoryOfferVariant from "../src/funnels/offers/guided-story"
import type { FunnelOfferVariantProps } from "../src/funnels/types"
import { buildQuizResultNarrative } from "../src/lib/quiz/result-narrative"
import type { QuizAnswers } from "../src/lib/quiz/types"

const quizAnswers: QuizAnswers = {
  structure: "wavy",
  thickness: "normal",
  density: "medium",
  hair_length: "long",
  scalp_type: "trocken",
  fingertest: "rau",
  pulltest: "snaps",
  concerns: ["breakage", "dryness", "frizz"],
  treatment: ["blondiert"],
  goals: ["anti_breakage", "moisture", "less_frizz"],
}

const props: FunnelOfferVariantProps = {
  name: "Lena Beispiel",
  narrative: buildQuizResultNarrative(quizAnswers),
  quizAnswers,
  pricingSlot: <div data-testid="pricing-slot">Pricing</div>,
  entryContext: "quiz_completion",
  leadId: "lead-guided-story",
  offerVariant: "guided-story",
}

test("normal entry hard-gates the journey at Chapter 1 without a pricing escape hatch", () => {
  const html = renderToStaticMarkup(<GuidedStoryOfferVariant {...props} />)

  assert.match(html, /Hey Lena, das ist deine persönliche Haaranalyse/)
  assert.doesNotMatch(html, /id="unlock-plan"/)
  assert.doesNotMatch(html, /id="guided-story-support"/)
  assert.doesNotMatch(html, /id="pricing"/)
  assert.doesNotMatch(html, /href="#pricing"/)
})

test("result-email focus reveals through Chapter 2 before the initial scroll", () => {
  const html = renderToStaticMarkup(
    <GuidedStoryOfferVariant {...props} entryContext="result_email" focusTarget="unlock-plan" />,
  )

  assert.match(html, /id="unlock-plan"/)
  assert.match(html, /So setzt deine Routine bei deinen drei wichtigsten Themen an/)
  assert.doesNotMatch(html, /id="guided-story-support"/)
  assert.doesNotMatch(html, /id="pricing"/)
})

test("routine return reveals the full story, pricing, and four approved FAQs", () => {
  const html = renderToStaticMarkup(
    <GuidedStoryOfferVariant {...props} entryContext="routine_return" focusRoutine />,
  )

  assert.match(html, /id="unlock-plan"/)
  assert.match(html, /id="guided-story-support"/)
  assert.match(html, /id="pricing"/)
  assert.match(html, /Weiter mit deiner Routine/)
  assert.match(html, /data-testid="pricing-slot"/)
  assert.equal((html.match(/data-offer-faq=/g) ?? []).length, 4)
  assert.doesNotMatch(html, /data-offer-section="final_cta"/)
})
