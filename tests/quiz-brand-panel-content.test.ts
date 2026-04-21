import assert from "node:assert/strict"
import test from "node:test"

import { getQuizBrandPanelContent } from "../src/lib/quiz/brand-panel-content"

test("question seven keeps the desktop rail with concise concerns copy", () => {
  const content = getQuizBrandPanelContent(8, "name")

  assert.equal(content.eyebrow, "FRAGE 7 VON 8")
  assert.equal(content.description, "Was dich gerade ausbremst.")
  assert.equal(content.progressCurrent, 7)
  assert.equal(content.progressComplete, false)
})

test("goals step becomes question eight in the desktop rail", () => {
  const content = getQuizBrandPanelContent(12, "name")

  assert.equal(content.eyebrow, "FRAGE 8 VON 8")
  assert.equal(content.description, "Worauf wir hinarbeiten.")
  assert.equal(content.progressCurrent, 8)
  assert.equal(content.progressComplete, false)
})

test("lead capture uses a short finalization message with completed progress", () => {
  const content = getQuizBrandPanelContent(9, "email")

  assert.equal(content.eyebrow, "FAST GESCHAFFT")
  assert.equal(content.description, "Gleich zeigen wir dir dein Profil.")
  assert.equal(content.progressCurrent, 8)
  assert.equal(content.progressComplete, true)
})

test("analysis keeps the same desktop rail shell with concise processing copy", () => {
  const content = getQuizBrandPanelContent(10, "consent")

  assert.equal(content.eyebrow, "ANALYSE")
  assert.equal(content.description, "Wir setzen alles zusammen.")
  assert.equal(content.progressCurrent, 8)
  assert.equal(content.progressComplete, true)
})
