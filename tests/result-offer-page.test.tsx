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
  assert.match(html, /Sarah, dein Ergebnis/i)
  assert.match(html, /Dein Haar braucht mehr Protein als Feuchtigkeit\./i)
  assert.match(html, /Haargefühl/i)
  assert.match(html, /Was dein Haar jetzt braucht/i)
  assert.match(html, /Dein 30-Tage-Plan ist fertig/i)
  assert.match(html, /Tom/i)
  assert.match(html, /Was Haarmony für dich tut/i)
  assert.match(html, /KI Haar-Berater/i)
  assert.match(html, /Produktempfehlungen/i)
  assert.match(html, /Haarpflege Planer/i)
  assert.match(html, /Ohne vs\. mit Haarmony/i)
  assert.match(html, />Ohne</i)
  assert.match(html, />Haarmony</i)
  assert.match(html, /Monatlich/i)
  assert.match(html, /€14,99/i)
  assert.match(html, /Quartal/i)
  assert.match(html, /€34,99/i)
  assert.match(html, /Beliebteste Wahl/i)
  assert.match(html, /Jährlich/i)
  assert.match(html, /€99,99/i)
  assert.match(html, /Jetzt starten — €34,99 im Quartal/i)
  assert.match(html, /14 Tage Geld-zurück-Garantie/i)
  assert.match(html, /Mein Angebot sichern/i)
  assert.doesNotMatch(html, /ERGEBNIS TEILEN|WHATSAPP|ALS BILD SPEICHERN/i)
})
