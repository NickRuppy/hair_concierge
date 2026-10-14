import assert from "node:assert/strict"
import test from "node:test"

import { shouldTriggerResultArtifactEmail } from "../src/components/quiz/quiz-results"

test("result artifact email trigger waits for a completed lead and access check", () => {
  assert.equal(
    shouldTriggerResultArtifactEmail({
      leadId: null,
      isCheckingAccess: false,
      previouslyTriggeredLeadId: null,
      canGoStraightToRoutine: false,
    }),
    false,
  )
  assert.equal(
    shouldTriggerResultArtifactEmail({
      leadId: "lead-1",
      isCheckingAccess: true,
      previouslyTriggeredLeadId: null,
      canGoStraightToRoutine: false,
    }),
    false,
  )
})

test("result artifact email trigger sends for active subscriber routine path", () => {
  assert.equal(
    shouldTriggerResultArtifactEmail({
      leadId: "lead-1",
      isCheckingAccess: false,
      previouslyTriggeredLeadId: null,
      canGoStraightToRoutine: true,
    }),
    true,
  )
})

test("result artifact email trigger does not resend for the same lead", () => {
  assert.equal(
    shouldTriggerResultArtifactEmail({
      leadId: "lead-1",
      isCheckingAccess: false,
      previouslyTriggeredLeadId: "lead-1",
      canGoStraightToRoutine: true,
    }),
    false,
  )
})
