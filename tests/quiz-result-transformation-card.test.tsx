// tests/quiz-result-transformation-card.test.tsx
import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { QuizResultTransformationCard } from "../src/components/quiz/quiz-result-transformation-card"
import { buildQuizResultNarrative } from "../src/lib/quiz/result-narrative"

// React's renderToStaticMarkup escapes HTML-significant characters (e.g. `&` → `&amp;`),
// so we compare assertions against the escaped form of the narrative strings.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

test("transformation card renders Heute / In 4 Wochen columns with each row's before and after copy", () => {
  const narrative = buildQuizResultNarrative({
    structure: "wavy",
    thickness: "normal",
    fingertest: "rau",
    pulltest: "stretches_bounces",
    concerns: ["dryness"],
    goals: ["less_frizz", "shine"],
  })

  const html = renderToStaticMarkup(<QuizResultTransformationCard rows={narrative.rows} />)

  assert.match(html, /Heute/)
  assert.match(html, /In 4 Wochen/)

  for (const row of narrative.rows) {
    assert.ok(
      html.includes(escapeHtml(row.before)),
      `expected Heute column to contain row.before "${row.before}"`,
    )
    assert.ok(
      html.includes(escapeHtml(row.after)),
      `expected Ziel column to contain row.after "${row.after}"`,
    )
  }

  // Old slider visuals gone
  assert.doesNotMatch(html, /linear-gradient\(90deg,#E47474/)
  assert.doesNotMatch(html, /linear-gradient\(90deg,#E35858/)
  assert.doesNotMatch(html, /currentPosition|targetPosition/)
})

test("transformation card renders the green arrow connector", () => {
  const narrative = buildQuizResultNarrative({
    structure: "straight",
    thickness: "normal",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    concerns: ["frizz"],
    goals: ["less_frizz"],
  })

  const html = renderToStaticMarkup(<QuizResultTransformationCard rows={narrative.rows} />)

  assert.match(html, /aria-label="Transformation"/i)
})
