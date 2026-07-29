import assert from "node:assert/strict"
import test from "node:test"

import {
  PERSONAL_PLAN_READY_MESSAGES,
  PERSONAL_PLAN_READY_MIN_STORY_MS,
  PERSONAL_PLAN_READY_POLL_INTERVAL_MS,
  PERSONAL_PLAN_READY_POLL_LIMIT,
  personalPlanStoryIndexAt,
} from "../src/app/plan-bereit/transition"

test("the future-pacing story uses the three reviewed German messages", () => {
  assert.deepEqual(PERSONAL_PLAN_READY_MESSAGES, [
    "Heute startest du mit deinem persönlichen Haarplan.",
    "In einer Woche kennst du deine Routine ganz genau.",
    "In vier Wochen sieht dein Haar sichtbar schöner und gesünder aus.",
  ])
})

test("the story lasts about seven seconds and readiness polling lasts thirty seconds", () => {
  assert.equal(PERSONAL_PLAN_READY_MIN_STORY_MS, 6_600)
  assert.equal(PERSONAL_PLAN_READY_POLL_INTERVAL_MS, 1_500)
  assert.equal(PERSONAL_PLAN_READY_POLL_LIMIT, 20)
  assert.equal(PERSONAL_PLAN_READY_POLL_INTERVAL_MS * PERSONAL_PLAN_READY_POLL_LIMIT, 30_000)
})

test("story progression exposes each message before completion", () => {
  assert.equal(personalPlanStoryIndexAt(0), 0)
  assert.equal(personalPlanStoryIndexAt(2_199), 0)
  assert.equal(personalPlanStoryIndexAt(2_200), 1)
  assert.equal(personalPlanStoryIndexAt(4_400), 2)
  assert.equal(personalPlanStoryIndexAt(6_600), 2)
})
