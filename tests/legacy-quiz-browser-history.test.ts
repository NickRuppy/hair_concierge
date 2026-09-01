import assert from "node:assert/strict"
import test from "node:test"

import {
  ensureLegacyQuizBrowserHistoryState,
  getLegacyQuizBrowserHistoryDepth,
  getLegacyQuizScreenPosition,
  pushLegacyQuizBrowserHistoryState,
  seedLegacyQuizBrowserHistoryToDepth,
  shouldHandleLegacyQuizPopState,
} from "../src/lib/quiz/browser-history"

function createWindowLike(initialState: unknown = null) {
  const entries: unknown[] = [initialState]

  return {
    entries,
    history: {
      get state() {
        return entries.at(-1) ?? null
      },
      pushState(state: unknown) {
        entries.push(state)
      },
      replaceState(state: unknown) {
        entries[entries.length - 1] = state
      },
    },
    location: { href: "https://chaarlie.de/quiz" },
  }
}

test("legacy quiz screen positions include each lead-capture substep", () => {
  assert.ok(getLegacyQuizScreenPosition(3, "name") > getLegacyQuizScreenPosition(2, "name"))
  assert.ok(getLegacyQuizScreenPosition(9, "email") > getLegacyQuizScreenPosition(9, "name"))
  assert.ok(getLegacyQuizScreenPosition(9, "consent") > getLegacyQuizScreenPosition(9, "email"))
  assert.ok(getLegacyQuizScreenPosition(10, "consent") > getLegacyQuizScreenPosition(9, "consent"))
})

test("creator quiz history collapses hidden identity screens without changing regular positions", () => {
  const finalQuestionPosition = getLegacyQuizScreenPosition(12, "name")
  const regularConsentPosition = getLegacyQuizScreenPosition(9, "consent")
  const creatorConsentPosition = getLegacyQuizScreenPosition(9, "consent", "partner")

  assert.equal(creatorConsentPosition, finalQuestionPosition + 1)
  assert.ok(regularConsentPosition > creatorConsentPosition)
  assert.equal(getLegacyQuizScreenPosition(10, "consent", "partner"), creatorConsentPosition + 1)
})

test("legacy quiz browser history preserves unrelated state while incrementing depth", () => {
  const win = createWindowLike({ campaign: "creator" })

  ensureLegacyQuizBrowserHistoryState(win)
  assert.deepEqual(win.history.state, { campaign: "creator", legacyQuizDepth: 0 })

  assert.equal(pushLegacyQuizBrowserHistoryState(win), 1)
  assert.deepEqual(win.history.state, { campaign: "creator", legacyQuizDepth: 1 })
  assert.equal(win.entries.length, 2)
})

test("resume seeding only adds the missing browser-history depth", () => {
  const win = createWindowLike({ legacyQuizDepth: 1 })

  assert.equal(seedLegacyQuizBrowserHistoryToDepth(4, win), 4)
  assert.equal(win.entries.length, 4)
  assert.equal(getLegacyQuizBrowserHistoryDepth(win.history.state), 4)

  assert.equal(seedLegacyQuizBrowserHistoryToDepth(2, win), 4)
  assert.equal(win.entries.length, 4)
})

test("popstate handling is limited to quiz-owned history entries", () => {
  assert.equal(shouldHandleLegacyQuizPopState({ legacyQuizDepth: 2 }), true)
  assert.equal(shouldHandleLegacyQuizPopState({ legacyQuizDepth: -1 }), false)
  assert.equal(shouldHandleLegacyQuizPopState({ other: true }), false)
  assert.equal(shouldHandleLegacyQuizPopState(null), false)
})
