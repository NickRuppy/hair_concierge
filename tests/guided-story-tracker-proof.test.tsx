import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { GuidedStoryTrackerProof } from "../src/components/quiz/guided-story-tracker-proof"
import { buildQuizGuidedStoryPreview } from "../src/lib/quiz/guided-story-preview"
import type { QuizAnswers } from "../src/lib/quiz/types"

const baseAnswers: QuizAnswers = {
  structure: "wavy",
  thickness: "normal",
  density: "medium",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  fingertest: "rau",
  pulltest: "snaps",
  concerns: ["breakage", "dryness", "frizz"],
  treatment: ["blondiert"],
  goals: ["anti_breakage", "moisture", "less_frizz"],
}

function occurrences(html: string, value: string): number {
  return html.split(value).length - 1
}

test("renders a static tracker screenshot shell with comparable routine copy and real product names", () => {
  const preview = buildQuizGuidedStoryPreview(baseAnswers)
  const html = renderToStaticMarkup(<GuidedStoryTrackerProof preview={preview} />)

  assert.match(html, /Deine Routine im Blick/)
  assert.match(html, /Tagebuch/)
  assert.match(html, /Beispielroutine/)
  assert.match(html, /Beispielwoche/)
  assert.match(html, /Feste Vorschau/)
  assert.doesNotMatch(html, /Letzte 8 Tage/)
  assert.match(html, /aria-label="Beispieltag 8, Haarwäsche eingetragen"/)
  assert.doesNotMatch(html, /aria-label="Montag, 20\. Juli/)
  assert.match(html, /Intensive Pflege/)
  assert.match(html, /vergleichbare Beispielroutine/)
  assert.match(html, /kein echter Tagebuchverlauf/)
  assert.match(html, /kein echter Tagebuchverlauf/)
  assert.match(html, /OLAPLEX No\.3PLUS Complete Repair Treatment/)
  assert.match(html, /Neqi Moisture Mystery|Balea|Pantene|Monday|Wahre Schätze|Hask|Cantu/)
  assert.match(html, /Manuell eingetragen/)
  assert.match(html, /Du bist in deinem Rhythmus/)
  assert.equal(occurrences(html, 'data-testid="guided-story-tracker-product"'), 3)
})

test("keeps the proof independent from chat, tracker writes, and live tracker data", async () => {
  const source = await readFile(
    new URL("../src/components/quiz/guided-story-tracker-proof.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /WeekStrip/)
  assert.match(source, /readOnly/)
  assert.match(source, /RhythmBand/)
  assert.doesNotMatch(source, /fetch\(/)
  assert.doesNotMatch(source, /\/api\/tracker/)
  assert.doesNotMatch(source, /\/api\/chat/)
  assert.doesNotMatch(source, /Routine eintragen/)
  assert.doesNotMatch(source, /Bearbeiten/)
})

test("renders the basis fallback without implying the user's real diary history", () => {
  const preview = buildQuizGuidedStoryPreview({
    structure: "straight",
    thickness: "normal",
    density: "medium",
    scalp_type: "ausgeglichen",
    has_scalp_issue: false,
    concerns: [],
    treatment: ["natur"],
    goals: [],
  })
  const html = renderToStaticMarkup(<GuidedStoryTrackerProof preview={preview} />)

  assert.match(html, /Basiswäsche/)
  assert.doesNotMatch(html, /deine echten Einträge/i)
  assert.doesNotMatch(html, /automatisch protokolliert/i)
  assert.equal(occurrences(html, 'data-testid="guided-story-tracker-product"'), 2)
})
