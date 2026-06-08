import assert from "node:assert/strict"
import test from "node:test"

import { shouldTriggerResultArtifactEmail } from "../src/components/quiz/quiz-results"

test("result artifact email trigger waits for a completed lead", () => {
  assert.equal(
    shouldTriggerResultArtifactEmail({
      leadId: null,
      previouslyTriggeredLeadId: null,
    }),
    false,
  )
})

test("result artifact email trigger sends once a lead is available", () => {
  assert.equal(
    shouldTriggerResultArtifactEmail({
      leadId: "lead-1",
      previouslyTriggeredLeadId: null,
    }),
    true,
  )
})

test("result artifact email trigger does not resend for the same lead", () => {
  assert.equal(
    shouldTriggerResultArtifactEmail({
      leadId: "lead-1",
      previouslyTriggeredLeadId: "lead-1",
    }),
    false,
  )
})
