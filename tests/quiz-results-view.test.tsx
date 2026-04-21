import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { QuizResultsView } from "../src/components/quiz/quiz-results-view"
import { buildQuizResultNarrative } from "../src/lib/quiz/result-narrative"

test("shared results view renders the new narrative result experience instead of the legacy diagnosis copy", () => {
  const narrative = buildQuizResultNarrative({
    structure: "wavy",
    thickness: "normal",
    fingertest: "leicht_uneben",
    pulltest: "stretches_bounces",
    concerns: ["dryness"],
    goals: ["shine"],
  })

  const html = renderToStaticMarkup(
    <QuizResultsView
      name="Lea"
      narrative={narrative}
      primaryAction={{ label: "QUIZ STARTEN", href: "/quiz" }}
      secondaryAction={{ label: "ERGEBNIS TEILEN", href: "/result/demo" }}
    />,
  )

  assert.match(html, /SO KOMMEN WIR DEINEM HAARZIEL NÄHER/i)
  assert.match(html, /WAS DEIN HAAR JETZT BRAUCHT/i)
  assert.match(html, /ERGEBNIS TEILEN/i)
  assert.doesNotMatch(html, /<a[^>]*>\s*<button/i)
  assert.doesNotMatch(html, /DEINE HAAR-DIAGNOSE|Teile deine Diagnose|ALS BILD SPEICHERN|WHATSAPP/i)
})
