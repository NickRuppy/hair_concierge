import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import {
  PersonalPlanQuizFrame,
  PersonalPlanQuizTextureQuestion,
} from "../src/components/personal-plan-quiz/personal-plan-quiz-first-screen"

test("fresh quiz shell renders the approved first screen without a loading placeholder", () => {
  const html = renderToStaticMarkup(
    <PersonalPlanQuizFrame
      canGoBack={false}
      clientReady={false}
      currentSectionIndex={0}
      fieldTest={false}
      onBack={() => {}}
      progress={4}
      settledSectionIndices={new Set()}
    >
      <PersonalPlanQuizTextureQuestion onSelect={() => {}} />
    </PersonalPlanQuizFrame>,
  )

  assert.match(html, /Welche Haarstruktur hast du\?/)
  assert.match(html, /Glattes Haar/)
  assert.match(html, /Welliges Haar/)
  assert.match(html, /Lockiges Haar/)
  assert.match(html, /Krauses Haar/)
  assert.match(html, /fetchPriority="high"/)
  assert.doesNotMatch(html, /Einen Moment|Erneut versuchen|Laden/)
})

test("delayed continuation keeps the selection and communicates automatic recovery only", () => {
  const html = renderToStaticMarkup(
    <PersonalPlanQuizTextureQuestion onSelect={() => {}} recoveryVisible selected="curly" />,
  )

  assert.match(html, /aria-pressed="true"[^>]*>[\s\S]*Lockig/)
  assert.match(html, /Einen Moment – wir laden automatisch weiter\./)
  assert.match(html, /Deine Auswahl bleibt erhalten\./)
  assert.doesNotMatch(html, /Erneut versuchen|retry|type="submit"/i)
})
