import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { QuizResultOfferPageShell } from "../src/components/quiz/quiz-result-offer-page"
import { buildQuizResultNarrative } from "../src/lib/quiz/result-narrative"

test("result offer page shell renders the unified diagnostic offer sections and live pricing copy", () => {
  const narrative = buildQuizResultNarrative({
    structure: "wavy",
    thickness: "normal",
    fingertest: "rau",
    pulltest: "stretches_stays",
    concerns: ["breakage"],
    goals: ["strengthen"],
  })

  const html = renderToStaticMarkup(<QuizResultOfferPageShell name="Sarah" narrative={narrative} />)

  assert.match(html, /Angebot:/i)
  assert.match(html, /Sarah, hier findest du dein Ergebnis/i)
  // New fixed hero
  assert.match(html, /So können sich deine Haare in 4 Wochen anfühlen\./i)
  // Transformation card
  assert.match(html, /Heute/)
  assert.match(html, /In 4 Wochen/)
  // Lever block
  assert.match(html, /Was dein Haar jetzt braucht/i)
  assert.match(html, /Primärer Hebel/)
  assert.match(html, /Sekundärer Hebel/)
  // Old per-row label chips gone
  assert.doesNotMatch(html, /Haargefühl/i)
  assert.doesNotMatch(html, /Worauf wir hinarbeiten/i)
  assert.match(html, /Dein vollständiger 30-Tage-Plan ist fertig/i)
  assert.match(html, /id="unlock-plan"/i)
  assert.match(html, /Ausgearbeitet von Chaarlie\./i)
  assert.match(html, /Warum diese Empfehlung\?/i)
  assert.match(html, /Chaarlie bewertet erst dein Haar, dann die Produkte\./i)
  assert.doesNotMatch(html, /Tom/i)
  assert.match(html, /Was Chaarlie für dich tut/i)
  assert.match(html, /KI Haar-Berater/i)
  assert.match(html, /Produktempfehlungen/i)
  assert.match(html, /Haarpflege Planer/i)
  assert.match(html, /Ohne vs\. mit Chaarlie/i)
  assert.match(html, />Ohne</i)
  assert.match(html, />Chaarlie</i)
  // No residual Haarmony brand mentions
  assert.doesNotMatch(html, /Haarmony/i)
  assert.match(html, /Monatlich/i)
  assert.match(html, /€14,99/i)
  assert.match(html, /Quartal/i)
  assert.match(html, /€34,99/i)
  assert.match(html, /Beliebteste Wahl/i)
  assert.match(html, /Jährlich/i)
  assert.match(html, /€99,99/i)
  assert.doesNotMatch(html, /€7,49|€17,49|€49,99/i)
  assert.match(html, /Jetzt starten — €34,99 im Quartal/i)
  assert.match(html, /14 Tage Geld-zurück-Garantie/i)
  assert.match(html, /Mein Angebot sichern/i)
  assert.doesNotMatch(html, /ERGEBNIS TEILEN|WHATSAPP|ALS BILD SPEICHERN/i)
})

test("result offer page shell gates routine-return copy behind focusRoutine", () => {
  const narrative = buildQuizResultNarrative({
    structure: "wavy",
    thickness: "normal",
    fingertest: "rau",
    pulltest: "stretches_stays",
    concerns: ["breakage"],
    goals: ["strengthen"],
  })

  const html = renderToStaticMarkup(
    <QuizResultOfferPageShell name="Sarah" narrative={narrative} focusRoutine />,
  )

  assert.match(html, /Weiter mit deiner Routine/i)
  assert.match(html, /Der nächste Schritt: deine aktuelle Routine/i)
  assert.match(html, /was du aktuell verwendest/i)
  assert.match(html, /Mach mit deiner Routine weiter\./i)
  assert.doesNotMatch(html, /Dein vollständiger 30-Tage-Plan ist fertig/i)
})
