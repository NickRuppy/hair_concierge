import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  getPreparationAccessCheckKey,
  getPreparationRecoverySubStep,
  getPreparationResultPath,
  isPreparationReady,
  PREPARATION_ACCESS_TIMEOUT_MS,
  schedulePreparationAccessCheck,
  shouldTriggerPreparationResultArtifact,
} from "../src/components/quiz/quiz-preparation"

const preparationSource = readFileSync(
  new URL("../src/components/quiz/quiz-preparation.tsx", import.meta.url),
  "utf8",
)

test("preparation does not prefetch the result route before the reveal action", () => {
  assert.doesNotMatch(preparationSource, /router\.prefetch\(/)
})

test("preparation waits for a lead and the client auth session", () => {
  assert.equal(
    isPreparationReady({
      authLoading: false,
      checkedAccessKey: null,
      leadId: null,
      profileHasAccess: false,
      userId: null,
    }),
    false,
  )
  assert.equal(
    isPreparationReady({
      authLoading: true,
      checkedAccessKey: null,
      leadId: "lead-1",
      profileHasAccess: false,
      userId: null,
    }),
    false,
  )
})

test("anonymous and already-entitled sessions are ready without an extra access request", () => {
  assert.equal(
    isPreparationReady({
      authLoading: false,
      checkedAccessKey: null,
      leadId: "lead-1",
      profileHasAccess: false,
      userId: null,
    }),
    true,
  )
  assert.equal(
    isPreparationReady({
      authLoading: false,
      checkedAccessKey: null,
      leadId: "lead-1",
      profileHasAccess: true,
      userId: "user-1",
    }),
    true,
  )
})

test("signed-in sessions without profile access wait for the matching server check", () => {
  const input = {
    authLoading: false,
    checkedAccessKey: null,
    leadId: "lead-1",
    profileHasAccess: false,
    userId: "user-1",
  }

  assert.equal(getPreparationAccessCheckKey(input), "user-1:lead-1")
  assert.equal(isPreparationReady(input), false)
  assert.equal(isPreparationReady({ ...input, checkedAccessKey: "user-1:other" }), false)
  assert.equal(isPreparationReady({ ...input, checkedAccessKey: "user-1:lead-1" }), true)
})

test("a stalled access check settles after a bounded timeout", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] })
  const accessSignal = { current: null as AbortSignal | null }
  let settledCalls = 0

  schedulePreparationAccessCheck({
    fetchAccess: (signal) => {
      accessSignal.current = signal
      return new Promise(() => {})
    },
    onSettled: () => {
      settledCalls += 1
    },
  })

  context.mock.timers.tick(PREPARATION_ACCESS_TIMEOUT_MS - 1)
  assert.equal(accessSignal.current?.aborted, false)
  assert.equal(settledCalls, 0)

  context.mock.timers.tick(1)
  assert.equal(accessSignal.current?.aborted, true)
  assert.equal(settledCalls, 1)
})

test("access-check cleanup aborts work without marking it settled", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] })
  const accessSignal = { current: null as AbortSignal | null }
  let settledCalls = 0

  const cleanup = schedulePreparationAccessCheck({
    fetchAccess: (signal) => {
      accessSignal.current = signal
      return new Promise(() => {})
    },
    onSettled: () => {
      settledCalls += 1
    },
  })

  cleanup()
  context.mock.timers.tick(PREPARATION_ACCESS_TIMEOUT_MS)

  assert.equal(accessSignal.current?.aborted, true)
  assert.equal(settledCalls, 0)
})

test("result artifact delivery starts once after preparation settles", () => {
  assert.equal(
    shouldTriggerPreparationResultArtifact({
      accessSettled: false,
      leadId: "lead-1",
      previouslyTriggeredLeadId: null,
    }),
    false,
  )
  assert.equal(
    shouldTriggerPreparationResultArtifact({
      accessSettled: true,
      leadId: "lead-1",
      previouslyTriggeredLeadId: null,
    }),
    true,
  )
  assert.equal(
    shouldTriggerPreparationResultArtifact({
      accessSettled: true,
      leadId: "lead-1",
      previouslyTriggeredLeadId: "lead-1",
    }),
    false,
  )
})

test("missing-lead recovery returns to the earliest incomplete lead field", () => {
  assert.equal(getPreparationRecoverySubStep(""), "name")
  assert.equal(getPreparationRecoverySubStep("Lena"), "email")
})

test("preparation threads retake mode and return destination into the canonical result", () => {
  assert.equal(
    getPreparationResultPath({
      leadId: "lead/1",
      mode: "retake",
      returnTo: "/profile?section=routine",
    }),
    "/result/lead%2F1?entry=quiz_completion&mode=retake&returnTo=%2Fprofile%3Fsection%3Droutine",
  )
  assert.equal(
    getPreparationResultPath({
      leadId: null,
      mode: "retake",
      returnTo: "/profile",
    }),
    null,
  )
})
