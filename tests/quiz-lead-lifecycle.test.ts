import assert from "node:assert/strict"
import test from "node:test"

import {
  findReusableLead,
  getLeadStatusAfterAnalyze,
} from "../src/lib/quiz/lead-lifecycle"

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
          scalp: "fettig_schuppen",
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
      scalp_condition: "schuppen",
      treatment: ["gefaerbt", "blondiert"],
    }
  )

  assert.equal(reusableLead?.id, "lead-1")
})

test("analyze status transitions to analyzed before linking and linked afterwards", () => {
  assert.equal(getLeadStatusAfterAnalyze(null), "analyzed")
  assert.equal(getLeadStatusAfterAnalyze("user-123"), "linked")
})
