import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  GUIDED_STORY_CHAPTER_TARGETS,
  guidedStoryScrollBehavior,
  resolveInitialGuidedStoryChapter,
  resolveInitialGuidedStoryFocusChapter,
} from "../src/lib/quiz/guided-story-flow"

test("normal entry reveals only Chapter 1 and has no initial focus target", () => {
  assert.equal(resolveInitialGuidedStoryChapter({ focusRoutine: false, focusTarget: null }), 1)
  assert.equal(
    resolveInitialGuidedStoryFocusChapter({ focusRoutine: false, focusTarget: null }),
    null,
  )
})

test("result-email compatibility reveals through Chapter 2 before focusing unlock-plan", () => {
  assert.equal(
    resolveInitialGuidedStoryChapter({ focusRoutine: false, focusTarget: "unlock-plan" }),
    2,
  )
  assert.equal(
    resolveInitialGuidedStoryFocusChapter({ focusRoutine: false, focusTarget: "unlock-plan" }),
    2,
  )
  assert.equal(GUIDED_STORY_CHAPTER_TARGETS[2].anchorId, "unlock-plan")
})

test("pricing and routine-return entries reveal the complete story before focusing pricing", () => {
  assert.equal(resolveInitialGuidedStoryChapter({ focusRoutine: false, focusTarget: "pricing" }), 4)
  assert.equal(resolveInitialGuidedStoryChapter({ focusRoutine: true, focusTarget: null }), 4)
  assert.equal(resolveInitialGuidedStoryFocusChapter({ focusRoutine: true, focusTarget: null }), 4)
  assert.equal(GUIDED_STORY_CHAPTER_TARGETS[4].anchorId, "pricing")
})

test("reduced motion removes animated scrolling", () => {
  assert.equal(guidedStoryScrollBehavior(true), "auto")
  assert.equal(guidedStoryScrollBehavior(false), "smooth")
})

test("the hook reveals before scheduling scroll and moves focus to the chapter heading", () => {
  const source = readFileSync(
    new URL("../src/components/quiz/use-guided-story-flow.ts", import.meta.url),
    "utf8",
  )
  const revealIndex = source.indexOf("setRevealedThrough(chapter)")
  const scrollIndex = source.indexOf("scrollIntoView")

  assert.ok(revealIndex >= 0 && scrollIndex > revealIndex)
  assert.match(source, /requestAnimationFrame/)
  assert.match(source, /heading\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(source, /if \(chapter <= revealedThroughRef\.current\) return/)
})
