// tests/quiz-results-view.test.tsx
import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { QuizResultsView } from "../src/components/quiz/quiz-results-view"
import { buildQuizResultNarrative } from "../src/lib/quiz/result-narrative"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

test("shared results view renders transformation card + structured lever rows", () => {
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
    />,
  )

  // Headline + lever section still present
  assert.match(html, /SO KOMMEN WIR DEINEM HAARZIEL NÄHER/i)
  assert.match(html, /WAS DEIN HAAR JETZT BRAUCHT/i)
  assert.doesNotMatch(html, /ERGEBNIS TEILEN/i)

  // New transformation card structure
  assert.match(html, /Heute/)
  assert.match(html, /In 4 Wochen/)

  for (const row of narrative.rows) {
    assert.ok(html.includes(escapeHtml(row.before)), row.before)
    assert.ok(html.includes(escapeHtml(row.after)), row.after)
  }
  assert.match(html, /aria-label="Transformation"/)
  assert.doesNotMatch(html, /linear-gradient\(90deg,#E47474/)
  assert.doesNotMatch(html, /currentPosition|targetPosition/)

  // Lever rows
  assert.match(html, /Primärer Hebel/)
  assert.match(html, /Sekundärer Hebel/)
  assert.match(html, /Conditioner/)
  assert.match(html, /Stabilisiert die Oberfläche der Längen\./)
  assert.match(html, /Leave-in/)
  assert.match(html, /Hält die Wirkung zwischen den Wäschen\./)
  assert.match(html, /aria-label="Primärer Hebel"/)
  assert.match(html, /aria-label="Sekundärer Hebel"/)

  // Old visuals removed
  assert.doesNotMatch(html, /linear-gradient\(90deg,#E35858/)
  assert.doesNotMatch(html, /Worauf wir hinarbeiten/i) // per-row label chips gone
  assert.doesNotMatch(html, /<a[^>]*>\s*<button/i)
  assert.doesNotMatch(html, /DEINE HAAR-DIAGNOSE|Teile deine Diagnose|ALS BILD SPEICHERN|WHATSAPP/i)
})
