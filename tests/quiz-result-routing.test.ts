import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { getQuizResultRedirectPath } from "../src/components/quiz/quiz-results"

const resultPageSource = readFileSync(
  new URL("../src/app/result/[leadId]/page.tsx", import.meta.url),
  "utf8",
)

test("no-access quiz results redirect to the canonical result route", () => {
  assert.equal(
    getQuizResultRedirectPath({
      leadId: "lead/with spaces",
      authLoading: false,
      isCheckingSignedInSubscription: false,
      canGoStraightToRoutine: false,
    }),
    "/result/lead%2Fwith%20spaces?entry=quiz_completion",
  )
})

test("result redirect waits for a lead and completed access checks", () => {
  assert.equal(
    getQuizResultRedirectPath({
      leadId: null,
      authLoading: false,
      isCheckingSignedInSubscription: false,
      canGoStraightToRoutine: false,
    }),
    null,
  )
  assert.equal(
    getQuizResultRedirectPath({
      leadId: "lead-1",
      authLoading: true,
      isCheckingSignedInSubscription: false,
      canGoStraightToRoutine: false,
    }),
    null,
  )
  assert.equal(
    getQuizResultRedirectPath({
      leadId: "lead-1",
      authLoading: false,
      isCheckingSignedInSubscription: true,
      canGoStraightToRoutine: false,
    }),
    null,
  )
})

test("active subscribers keep the direct routine path", () => {
  assert.equal(
    getQuizResultRedirectPath({
      leadId: "lead-1",
      authLoading: false,
      isCheckingSignedInSubscription: false,
      canGoStraightToRoutine: true,
    }),
    null,
  )
})

test("result email links retain unlock focus and receive a dedicated offer entry context", () => {
  assert.match(resultPageSource, /sp\.focus === "unlock-plan" \? "unlock-plan"/)
  assert.match(resultPageSource, /sp\.entry === "result_email"\s*\? "result_email"/)
})
