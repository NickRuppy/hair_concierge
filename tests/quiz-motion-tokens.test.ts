import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

/**
 * Batch 8 motion spec (plans/discovery-b8-motion-days/plan.md): ONE settle delay after a
 * single-tap answer across the quiz, and the step transition on the shared tokens. The
 * delays are inline `setTimeout`s inside hook callbacks, so the pin is on the source.
 */

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

const SINGLE_TAP_FILES = [
  "src/components/quiz/quiz-question.tsx",
  "src/components/quiz/quiz-scalp-question.tsx",
  "src/components/personal-plan-quiz/personal-plan-quiz.tsx",
  "src/components/quiz/quiz-main-problem-sheet.tsx",
]

for (const path of SINGLE_TAP_FILES) {
  test(`${path}: single-tap advance uses MOTION_MS.settle, no private delay`, () => {
    const source = read(path)
    assert.match(source, /MOTION_MS\.settle/)
    assert.doesNotMatch(source, /AUTO_ADVANCE_MS = \d/)
    assert.doesNotMatch(source, /\}, (220|260|300|400)\)/)
  })
}

test("both quiz shells keep the outgoing step until the incoming one has entered", () => {
  for (const path of [
    "src/app/quiz/quiz-shell.tsx",
    "src/components/personal-plan-quiz/personal-plan-quiz.tsx",
  ]) {
    assert.match(read(path), /const SCREEN_EXIT_MS = MOTION_MS\.stepIn/, path)
  }
})

test("the quiz step classes run on the motion tokens", () => {
  const css = read("src/app/globals.css")
  for (const direction of ["forward", "back"]) {
    const enter = css.match(
      new RegExp(
        `\\.personal-plan-screen-enter\\[data-personal-plan-transition-direction="${direction}"\\] \\{\\s*animation: ([^;]+);`,
      ),
    )
    const exit = css.match(
      new RegExp(
        `\\.personal-plan-screen-exit\\[data-personal-plan-transition-direction="${direction}"\\] \\{\\s*animation: ([^;]+);`,
      ),
    )
    assert.match(enter?.[1] ?? "", /var\(--motion-step-in\) var\(--motion-ease-enter\)/)
    assert.match(exit?.[1] ?? "", /var\(--motion-step-out\) var\(--motion-ease-exit\)/)
  }
})
