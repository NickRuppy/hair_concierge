import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import GuidedStoryOfferVariant from "../src/funnels/offers/guided-story"
import GuidedStoryFounderLetterOfferVariant from "../src/funnels/offers/guided-story-founder-letter"
import GuidedStoryLockedOfferVariant from "../src/funnels/offers/guided-story-locked"
import GuidedStoryPotentialOfferVariant from "../src/funnels/offers/guided-story-potential"
import type { FunnelOfferVariantProps } from "../src/funnels/types"
import { buildQuizGuidedStoryPreview } from "../src/lib/quiz/guided-story-preview"
import { buildQuizResultNarrative } from "../src/lib/quiz/result-narrative"
import type { QuizAnswers } from "../src/lib/quiz/types"

const quizAnswers: QuizAnswers = {
  structure: "wavy",
  thickness: "normal",
  density: "medium",
  hair_length: "long",
  scalp_type: "trocken",
  has_scalp_issue: false,
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

test("locked variant personalizes the baseline and does not leak the targeted recommendation", () => {
  const preview = buildQuizGuidedStoryPreview(quizAnswers)
  const targetedProduct = preview.products.find((product) => product.suggested)
  assert.ok(targetedProduct)

  const html = renderToStaticMarkup(
    <GuidedStoryLockedOfferVariant
      {...props}
      focusTarget="unlock-plan"
      offerVariant="guided-story-locked"
    />,
  )

  assert.match(html, /<h2[^>]*>Lenas Routine<\/h2>/)
  assert.match(html, /Deine gezielte Ergänzung/)
  assert.match(html, /Deine persönliche Empfehlung/)
  assert.match(html, /Produkt &amp; Anwendung mit Chaarlie ansehen/)
  assert.doesNotMatch(html, new RegExp(targetedProduct.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  assert.doesNotMatch(
    html,
    /Bond-Pflege · Vorschlag|Proteinmaske · Vorschlag|Feuchtigkeitsmaske · Vorschlag|Leave-in · Vorschlag|Haaröl · Vorschlag/,
  )
})

test("founder-letter variant reveals the letter before the routine with no extra gate", () => {
  const html = renderToStaticMarkup(
    <GuidedStoryFounderLetterOfferVariant
      {...props}
      focusTarget="unlock-plan"
      name="Lea Beispiel"
      offerVariant="guided-story-founder-letter"
    />,
  )

  const letterIndex = html.indexOf('data-offer-section="founder_letter"')
  const routineIndex = html.indexOf('data-offer-section="mini_routine"')
  assert.ok(letterIndex > -1)
  assert.ok(routineIndex > letterIndex)
  assert.match(html, /id="unlock-plan"/)
  assert.match(html, /id="guided-story-chapter-2-heading"[^>]*>Liebe Lea,/)
  assert.match(html, /300 bis 470 Euro im Jahr/)
  assert.match(html, /Nick &amp; Jonas/)
  assert.match(html, /<h2[^>]*>Leas Routine<\/h2>/)
  assert.equal((html.match(/Ja, zeig mir Chaarlie/g) ?? []).length, 1)
})

test("potential variant renders the approved summary and percentage marker labels", () => {
  const html = renderToStaticMarkup(
    <GuidedStoryPotentialOfferVariant {...props} offerVariant="guided-story-potential" />,
  )

  assert.match(html, /Dein Haarpotenzial/)
  assert.match(html, /Was dein Haar erreichen kann/)
  assert.match(html, /% erreicht/)
  assert.match(html, /Stabilität/)
  assert.match(html, /Feuchtigkeit/)
  assert.match(html, /Oberfläche/)
  assert.doesNotMatch(html, /Basis<\/button>|Pflege<\/button>|Routine<\/button>/)
})
