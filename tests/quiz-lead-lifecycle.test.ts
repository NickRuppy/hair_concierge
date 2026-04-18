import assert from "node:assert/strict"
import test from "node:test"

import { findReusableLead, getLeadStatusAfterAnalyze } from "../src/lib/quiz/lead-lifecycle"

test("dedupe reuses a recent lead when normalized answers match", () => {
  const reusableLead = findReusableLead(
    [
      {
        id: "lead-1",
        quiz_answers: {
          structure: "curly",
          thickness: "normal",
          fingertest: "rau",
          pulltest: "ueberdehnt",
          scalp_condition: "keine",
          scalp_type: "fettig",
          concerns: ["frizz", "breakage"],
          treatment: ["blondiert", "gefaerbt"],
        },
      },
    ],
    {
      structure: "curly",
      thickness: "normal",
      fingertest: "rau",
      pulltest: "stretches_stays",
      scalp_type: "fettig",
      has_scalp_issue: false,
      concerns: ["breakage", "frizz"],
      treatment: ["gefaerbt", "blondiert"],
    },
  )

  assert.equal(reusableLead?.id, "lead-1")
})

test("dedupe still reuses a legacy lead missing the new scalp gate and concern fields", () => {
  const reusableLead = findReusableLead(
    [
      {
        id: "lead-legacy",
        quiz_answers: {
          structure: "curly",
          thickness: "normal",
          fingertest: "rau",
          pulltest: "ueberdehnt",
          scalp_type: "fettig",
          treatment: ["blondiert", "gefaerbt"],
        },
      },
    ],
    {
      structure: "curly",
      thickness: "normal",
      fingertest: "rau",
      pulltest: "stretches_stays",
      scalp_type: "fettig",
      has_scalp_issue: false,
      concerns: [],
      treatment: ["gefaerbt", "blondiert"],
    },
  )

  assert.equal(reusableLead?.id, "lead-legacy")
})

test("analyze status transitions to analyzed before linking and linked afterwards", () => {
  assert.equal(getLeadStatusAfterAnalyze(null), "analyzed")
  assert.equal(getLeadStatusAfterAnalyze("user-123"), "linked")
})
