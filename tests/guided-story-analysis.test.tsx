import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { GuidedStoryAnalysis } from "../src/components/quiz/guided-story-analysis"
import { buildQuizGuidedStoryPreview } from "../src/lib/quiz/guided-story-preview"
import type { QuizAnswers } from "../src/lib/quiz/types"

test("renders the personalized opening, portrait, default central insight, and handoff", () => {
  const quizAnswers: QuizAnswers = {
    structure: "wavy",
    thickness: "normal",
    density: "medium",
    hair_length: "long",
    fingertest: "rau",
    pulltest: "snaps",
    scalp_type: "trocken",
    has_scalp_issue: false,
    concerns: ["breakage", "dryness", "frizz"],
    treatment: ["blondiert"],
    goals: ["anti_breakage", "moisture", "less_frizz"],
  }
  const preview = buildQuizGuidedStoryPreview(quizAnswers)
  const html = renderToStaticMarkup(
    <GuidedStoryAnalysis
      name="Lena Beispiel"
      preview={preview}
      quizAnswers={quizAnswers}
      onContinue={() => {}}
    />,
  )

  assert.match(html, /Hey Lena, das ist deine persönliche Haaranalyse\./)
  assert.match(html, /Dein Haar zu verstehen, ist der erste Schritt zu gesundem, schönem Haar\./)
  assert.equal((html.match(/data-analysis-block=/g) ?? []).length, 3)
  assert.match(
    html,
    new RegExp(preview.priorities[0]!.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  )
  assert.match(html, /Bereit, mit Chaarlie die passenden Produkte in deine Routine einzubauen\?/)
  assert.match(html, /Ja, lass uns loslegen/)
  assert.match(html, /data-portrait-marker=/)
})

test("uses the approved generic fallback without inventing a name or trait", () => {
  const preview = buildQuizGuidedStoryPreview({})
  const html = renderToStaticMarkup(
    <GuidedStoryAnalysis name="  " preview={preview} quizAnswers={{}} onContinue={() => {}} />,
  )

  assert.match(html, /Hey, das ist deine persönliche Haaranalyse\./)
  assert.match(html, /Symbolische Darstellung auf Basis der verfügbaren Antworten/)
  assert.doesNotMatch(html, /mittellanges|welliges Haar|hoher Dichte/)
  assert.equal((html.match(/data-analysis-block=/g) ?? []).length, 2)
})
