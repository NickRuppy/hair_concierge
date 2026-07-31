import assert from "node:assert/strict"
import test from "node:test"

import {
  PERSONAL_PLAN_RESULT_REVEAL_MESSAGE_MS,
  PERSONAL_PLAN_RESULT_REVEAL_TOTAL_MS,
  buildPersonalPlanResultRevealCompletion,
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
  assert.equal(PERSONAL_PLAN_RESULT_REVEAL_MESSAGE_MS, 2_040)
  assert.equal(PERSONAL_PLAN_RESULT_REVEAL_TOTAL_MS, 6_120)

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
    [2_040, 4_080, 6_120],
  )
  tasks.forEach(({ callback }) => callback())
  assert.deepEqual(viewedSteps, [1, 2])
  assert.equal(completions, 1)
  cleanup()
  assert.deepEqual(cancelled, [1, 2, 3])
})

test("result reveal completion records exact trigger and configured timing", () => {
  assert.deepEqual(
    buildPersonalPlanResultRevealCompletion({
      completionTrigger: "skip_button",
      elapsedMs: 2_039.6,
      leadId: "10000000-0000-4000-8000-000000000092",
      scheduledDurationMs: PERSONAL_PLAN_RESULT_REVEAL_TOTAL_MS,
      stepCount: 3,
      visibleStep: 1,
    }),
    {
      completionTrigger: "skip_button",
      elapsedMs: 2_040,
      leadId: "10000000-0000-4000-8000-000000000092",
      scheduledDurationMs: 6_120,
      stepCount: 3,
      visibleStep: 1,
    },
  )

  assert.deepEqual(
    buildPersonalPlanResultRevealCompletion({
      completionTrigger: "timer",
      elapsedMs: 6_121.2,
      leadId: "10000000-0000-4000-8000-000000000092",
      scheduledDurationMs: PERSONAL_PLAN_RESULT_REVEAL_TOTAL_MS,
      stepCount: 3,
      visibleStep: 3,
    }),
    {
      completionTrigger: "timer",
      elapsedMs: 6_121,
      leadId: "10000000-0000-4000-8000-000000000092",
      scheduledDurationMs: 6_120,
      stepCount: 3,
      visibleStep: 3,
    },
  )
})

test("result reveal completion normalizes numeric boundaries", () => {
  assert.deepEqual(
    buildPersonalPlanResultRevealCompletion({
      completionTrigger: "skip_button",
      elapsedMs: -10,
      leadId: "10000000-0000-4000-8000-000000000092",
      scheduledDurationMs: 6_119.7,
      stepCount: 3.4,
      visibleStep: 99,
    }),
    {
      completionTrigger: "skip_button",
      elapsedMs: 0,
      leadId: "10000000-0000-4000-8000-000000000092",
      scheduledDurationMs: 6_120,
      stepCount: 3,
      visibleStep: 3,
    },
  )

  assert.deepEqual(
    buildPersonalPlanResultRevealCompletion({
      completionTrigger: "timer",
      elapsedMs: Number.NaN,
      leadId: "10000000-0000-4000-8000-000000000092",
      scheduledDurationMs: Number.POSITIVE_INFINITY,
      stepCount: Number.NaN,
      visibleStep: Number.NaN,
    }),
    {
      completionTrigger: "timer",
      elapsedMs: 0,
      leadId: "10000000-0000-4000-8000-000000000092",
      scheduledDurationMs: 0,
      stepCount: 1,
      visibleStep: 1,
    },
  )

  assert.throws(
    () =>
      buildPersonalPlanResultRevealCompletion({
        completionTrigger: "skip_button",
        elapsedMs: 0,
        leadId: " ",
        scheduledDurationMs: PERSONAL_PLAN_RESULT_REVEAL_TOTAL_MS,
        stepCount: 3,
        visibleStep: 1,
      }),
    /requires a lead ID/,
  )
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
