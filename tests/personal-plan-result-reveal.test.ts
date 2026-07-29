import assert from "node:assert/strict"
import test from "node:test"

import {
  PERSONAL_PLAN_RESULT_REVEAL_MESSAGE_MS,
  PERSONAL_PLAN_RESULT_REVEAL_TOTAL_MS,
  buildPersonalPlanResultRevealMessages,
  claimPersonalPlanResultRevealCompletion,
  schedulePersonalPlanResultReveal,
} from "../src/lib/quiz/personal-plan-result-reveal"
import { shouldTrackAnalyticsPageView } from "../src/lib/analytics/page-url"

test("result reveal uses dynamic one-week and four-week dates with certain outcome copy", () => {
  assert.deepEqual(buildPersonalPlanResultRevealMessages("2026-07-29"), [
    {
      after: " startest du mit deinem persönlichen Haarplan.",
      before: "",
      daysFromStart: 0,
      highlight: "Heute",
    },
    {
      after: " kennst du deine Routine ganz genau.",
      before: "Ab ",
      daysFromStart: 7,
      highlight: "5. August",
    },
    {
      after: " wird dein Haar gesünder und schöner aussehen.",
      before: "Bis ",
      daysFromStart: 28,
      highlight: "26. August",
    },
  ])
})

test("result reveal exposes all three messages before navigating", () => {
  assert.equal(PERSONAL_PLAN_RESULT_REVEAL_MESSAGE_MS, 1_500)
  assert.equal(PERSONAL_PLAN_RESULT_REVEAL_TOTAL_MS, 4_500)

  const tasks: Array<{ callback: () => void; delayMs: number; handle: number }> = []
  const cancelled: number[] = []
  const viewedSteps: number[] = []
  let completions = 0
  const cleanup = schedulePersonalPlanResultReveal({
    messageCount: 3,
    onComplete: () => {
      completions += 1
    },
    onStep: (index) => viewedSteps.push(index),
    timer: {
      cancel: (handle) => cancelled.push(handle),
      schedule: (callback, delayMs) => {
        const handle = tasks.length + 1
        tasks.push({ callback, delayMs, handle })
        return handle
      },
    },
  })

  assert.deepEqual(
    tasks.map(({ delayMs }) => delayMs),
    [1_500, 3_000, 4_500],
  )
  tasks.forEach(({ callback }) => callback())
  assert.deepEqual(viewedSteps, [1, 2])
  assert.equal(completions, 1)
  cleanup()
  assert.deepEqual(cancelled, [1, 2, 3])
})

test("result reveal completion can only be claimed once", () => {
  const state = { current: false }
  assert.equal(claimPersonalPlanResultRevealCompletion(state), true)
  assert.equal(claimPersonalPlanResultRevealCompletion(state), false)
})

test("result reveal does not emit a generic page view before the actual offer", () => {
  assert.equal(
    shouldTrackAnalyticsPageView("/result/11111111-1111-4111-8111-111111111111/reveal"),
    false,
  )
  assert.equal(shouldTrackAnalyticsPageView("/result/11111111-1111-4111-8111-111111111111"), true)
})
