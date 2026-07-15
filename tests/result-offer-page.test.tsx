import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { OfferPreviewRoutine } from "../src/components/quiz/offer-preview-routine"
import { QuizResultOfferPageShell } from "../src/components/quiz/quiz-result-offer-page"
import { buildQuizOfferPreview } from "../src/lib/quiz/offer-preview"
import { buildQuizResultNarrative } from "../src/lib/quiz/result-narrative"
import type { QuizAnswers } from "../src/lib/quiz/types"

const quizAnswers: QuizAnswers = {
  structure: "wavy",
  thickness: "normal",
  density: "medium",
  fingertest: "leicht_uneben",
  pulltest: "stretches_stays",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  concerns: ["breakage"],
  treatment: ["natur"],
  goals: ["strengthen"],
}

test("result offer page renders the product-led hierarchy, routine preview, and existing pricing", () => {
  const narrative = buildQuizResultNarrative(quizAnswers)
  const html = renderToStaticMarkup(
    <QuizResultOfferPageShell name="Sarah" narrative={narrative} quizAnswers={quizAnswers} />,
  )

  assert.match(html, /Sarah, wir kennen jetzt die Bedürfnisse deiner Haare/i)
  assert.match(html, /Deine Analyse ist der Anfang\. Chaarlie macht sie anwendbar\./i)
  assert.match(html, /Das wissen wir schon aus deinem Quiz/i)
  assert.match(html, /Daraus ergibt sich deine Mini-Routine/i)
  assert.match(html, /Shampoo · Beispiel/i)
  assert.match(html, /Conditioner · Beispiel/i)
  assert.match(html, /Dein nächster Pflegeschritt/i)
  assert.match(html, /Protein-Maske/i)
  assert.equal((html.match(/data-testid="locked-routine-placeholder"/g) ?? []).length, 2)
  assert.doesNotMatch(html, /Neqi Peptide Power|Alle 2–3 Haarwäschen/i)
  assert.match(html, /noch nicht deine finalen Produktempfehlungen/i)
  assert.match(html, /id="unlock-plan"/i)
  assert.match(html, /Chaarlie finalisiert deinen persönlichen Plan/i)
  assert.match(html, /Das kaufst du – nicht nur ein Quiz-Ergebnis/i)
  assert.match(html, /Antworten, wenn die nächste Frage kommt/i)
  assert.match(html, /Was, wann und in welcher Reihenfolge/i)
  assert.match(html, /Warum Chaarlie ein Abo ist/i)
  assert.match(html, /500\+/i)
  assert.match(html, /erfasste Produkte/i)
  assert.match(html, /keine eigene Produktlinie/i)
  assert.match(html, /id="pricing"/i)
  assert.match(html, /Monatlich/i)
  assert.match(html, /€14,99/i)
  assert.match(html, /Quartal/i)
  assert.match(html, /€34,99/i)
  assert.match(html, /Beliebteste Wahl/i)
  assert.match(html, /Jährlich/i)
  assert.match(html, /€99,99/i)
  assert.match(html, /14 Tage Geld-zurück-Garantie/i)
  assert.match(html, /Was passiert direkt nach der Zahlung/i)
  assert.match(html, /Sind die Produkte auf dieser Seite schon meine finalen Empfehlungen/i)
  assert.doesNotMatch(html, /Angebot läuft ab|Danach zum regulären Preis|In 4 Wochen|30-Tage-Plan/i)
  assert.doesNotMatch(html, /Kopfhautserum|Dry.Shampoo|Haarmony|>Tom</i)

  const sectionIds = Array.from(html.matchAll(/data-offer-section="([^"]+)"/g), (match) => match[1])
  assert.deepEqual(sectionIds, [
    "personalized_analysis",
    "mini_routine",
    "locked_routine",
    "unlock_explanation",
    "product_story_chat",
    "product_story_routine",
    "product_story_products",
    "subscription_explanation",
    "pricing",
    "guarantee",
    "faq",
    "final_cta",
  ])
  assert.deepEqual(
    new Set(Array.from(html.matchAll(/data-offer-cta="([^"]+)"/g), (match) => match[1])),
    new Set(["sticky_header", "locked_plan", "final"]),
  )
  assert.equal((html.match(/data-offer-faq=/g) ?? []).length, 6)
})

test("result offer page preserves legacy routine-return context and both fixed-header anchors", () => {
  const narrative = buildQuizResultNarrative(quizAnswers)
  const html = renderToStaticMarkup(
    <QuizResultOfferPageShell
      name="Sarah"
      narrative={narrative}
      quizAnswers={quizAnswers}
      focusRoutine
    />,
  )

  assert.match(html, /Weiter mit deiner vollständigen Routine/i)
  assert.match(html, /Weiter mit deiner Routine/i)
  assert.match(html, /id="unlock-plan"[^>]*scroll-mt-\[76px\]/i)
  assert.match(html, /id="pricing"[^>]*scroll-mt-\[76px\]/i)
  assert.doesNotMatch(html, /Angebot:/i)
})

test("routine preview keeps a generic locked continuation when no third category is justified", () => {
  const preview = buildQuizOfferPreview({
    ...quizAnswers,
    concerns: [],
    fingertest: "glatt",
    goals: [],
    pulltest: "stretches_bounces",
  })
  const html = renderToStaticMarkup(<OfferPreviewRoutine preview={preview} />)

  assert.equal(preview.lane, "base")
  assert.equal(preview.needs.extra, null)
  assert.match(html, /data-offer-section="locked_routine"/)
  assert.match(html, /Dein vollständiger Plan/i)
  assert.match(html, /Deine weiteren Pflegeschritte/i)
  assert.equal((html.match(/data-testid="locked-routine-placeholder"/g) ?? []).length, 2)
  assert.match(html, /Shampoo · Beispiel/i)
  assert.match(html, /Conditioner · Beispiel/i)
  assert.doesNotMatch(html, /Dein nächster Pflegeschritt/i)
  assert.doesNotMatch(html, /Protein-Maske|Feuchtigkeitsmaske|Leave-in|Haaröl|Bondbuilder/i)
})
