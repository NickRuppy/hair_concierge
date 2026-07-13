import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { ResultPageClient } from "../src/app/result/[leadId]/result-client"
import type { QuizAnswers } from "../src/lib/quiz/types"

const quizAnswers: QuizAnswers = {
  structure: "wavy",
  thickness: "normal",
  fingertest: "leicht_uneben",
  pulltest: "stretches_bounces",
  concerns: ["dryness"],
  goals: ["shine"],
}

test("result page client sends manually granted users to onboarding instead of the paid offer", () => {
  const html = renderToStaticMarkup(
    <ResultPageClient
      leadId="11111111-1111-4111-8111-111111111111"
      name="Lea"
      quizAnswers={quizAnswers}
      focusRoutine={false}
      hasAccess
    />,
  )

  assert.match(html, /SO KOMMEN WIR DEINEM HAARZIEL NÄHER/i)
  assert.match(html, /href="\/onboarding\?lead=11111111-1111-4111-8111-111111111111"/)
  assert.doesNotMatch(html, /Angebot:/i)
})

test("result page client passes persisted quiz answers into the default product-led offer", () => {
  const html = renderToStaticMarkup(
    <ResultPageClient
      leadId="11111111-1111-4111-8111-111111111111"
      name="Lea"
      quizAnswers={{ ...quizAnswers, density: "medium", scalp_type: "ausgeglichen" }}
      focusRoutine={false}
      focusTarget="unlock-plan"
      hasAccess={false}
    />,
  )

  assert.match(html, /Deine Analyse ist der Anfang/i)
  assert.match(html, /Shampoo · Beispiel/i)
  assert.match(html, /Conditioner · Beispiel/i)
  assert.match(html, /id="unlock-plan"/i)
  assert.match(html, /id="pricing"/i)
})
