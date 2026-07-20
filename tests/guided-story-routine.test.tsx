import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import { renderToStaticMarkup } from "react-dom/server"

import { GuidedStoryRoutine } from "../src/components/quiz/guided-story-routine"
import { buildQuizGuidedStoryPreview } from "../src/lib/quiz/guided-story-preview"
import type { QuizAnswers } from "../src/lib/quiz/types"

const baseAnswers: QuizAnswers = {
  structure: "straight",
  thickness: "normal",
  density: "medium",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  concerns: [],
  treatment: ["natur"],
  goals: [],
}

function renderRoutine(answers: QuizAnswers = baseAnswers): string {
  return renderToStaticMarkup(
    <GuidedStoryRoutine
      preview={buildQuizGuidedStoryPreview(answers)}
      onContinue={() => {}}
      onStart={() => {}}
    />,
  )
}

function occurrences(html: string, value: string): number {
  return html.split(value).length - 1
}

test("renders the three-card routine with basis, targeted section, locked teasers, and handoff", () => {
  const html = renderRoutine({
    ...baseAnswers,
    structure: "wavy",
    fingertest: "rau",
    pulltest: "snaps",
    concerns: ["breakage", "dryness", "frizz"],
    treatment: ["blondiert"],
    goals: ["anti_breakage", "moisture", "less_frizz"],
  })

  assert.match(
    html,
    /<h2[^>]*>So setzt deine Routine bei deinen drei wichtigsten Themen an\.<\/h2>/,
  )
  assert.match(html, /<h3[^>]*>Deine Basis<\/h3>/)
  assert.match(html, /Deine Basis/)
  assert.match(html, /plus der Schritt, der gezielt bei deinen wichtigsten Themen ansetzt/)
  assert.match(html, /Gezielte Ergänzung/)
  assert.equal(occurrences(html, 'data-testid="guided-story-product-card"'), 3)
  assert.match(html, /Shampoo · Beispiel/)
  assert.match(html, /Conditioner · Beispiel/)
  assert.match(html, /Bond-Pflege · Vorschlag/)
  assert.doesNotMatch(html, /Bondbuilder · Vorschlag/)
  assert.match(html, /Weitere Pflege/)
  assert.match(html, /Tools/)
  assert.equal(occurrences(html, 'data-testid="guided-story-locked-teaser"'), 2)
  assert.match(html, /Bereit zu sehen, wie Chaarlie dich bei deiner Routine unterstützt\?/)
  assert.match(html, /Ja, zeig mir Chaarlie/)
})

test("renders the sparse two-card fallback without a targeted placeholder", () => {
  const html = renderRoutine()

  assert.equal(occurrences(html, 'data-testid="guided-story-product-card"'), 2)
  assert.match(html, /Fast jede Routine beginnt mit Shampoo und Conditioner/)
  assert.doesNotMatch(html, /plus der Schritt/)
  assert.doesNotMatch(html, /Gezielte Ergänzung/)
  assert.equal(occurrences(html, 'data-testid="guided-story-locked-teaser"'), 2)
})

test("uses semantic native buttons and no nested interactive product wrappers", () => {
  const html = renderRoutine({
    ...baseAnswers,
    concerns: ["frizz"],
    fingertest: "rau",
  })

  assert.equal(occurrences(html, "<button"), 6)
  assert.equal(occurrences(html, 'aria-haspopup="dialog"'), 5)
  assert.equal(occurrences(html, 'aria-expanded="false"'), 5)
  assert.doesNotMatch(html, /<article[^>]*>\s*<button/i)
  assert.doesNotMatch(html, /<a\s/i)
})

test("keeps the subscription CTA out of the initial visible product-card surface", () => {
  const html = renderRoutine({
    ...baseAnswers,
    concerns: ["frizz"],
    fingertest: "rau",
  })

  assert.doesNotMatch(html, /Mit Chaarlie starten/)
  assert.match(html, /Ja, zeig mir Chaarlie/)
})

test("keeps popover behavior local with Escape, outside-dismiss, and focus restoration hooks", async () => {
  const source = await readFile(
    new URL("../src/components/quiz/guided-story-routine.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /role="dialog"/)
  assert.match(source, /event\.key === "Escape"/)
  assert.match(source, /document\.addEventListener\("pointerdown"/)
  assert.match(source, /focus\(\)/)
  assert.match(source, /calc\(100vw-2rem\)/)
  assert.equal(occurrences(source, "closePopover({ restoreFocus: false })"), 3)
  assert.equal(occurrences(source, "Mit Chaarlie starten"), 0)
  assert.match(source, /copy\.lockedCtaLabel/)
})
