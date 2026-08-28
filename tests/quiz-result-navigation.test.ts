import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  buildQuizResultPath,
  getQuizResultSearchParamValue,
  resolveQuizResultRetakeReturnTo,
} from "../src/lib/quiz/result-navigation"

const resultPageSource = readFileSync(
  new URL("../src/app/result/[leadId]/page.tsx", import.meta.url),
  "utf8",
)

test("ordinary quiz completion keeps the canonical result path unchanged", () => {
  assert.equal(
    buildQuizResultPath({
      leadId: "lead/with spaces",
      returnTo: "/routine",
    }),
    "/result/lead%2Fwith%20spaces?entry=quiz_completion",
  )
})

test("result query parsing consistently uses the first repeated value", () => {
  assert.equal(
    getQuizResultSearchParamValue(["quiz_completion", "saved_result"]),
    "quiz_completion",
  )
  assert.equal(getQuizResultSearchParamValue([]), null)
  assert.equal(getQuizResultSearchParamValue(undefined), null)
})

test("retake result paths preserve a safe local return destination", () => {
  assert.equal(
    buildQuizResultPath({
      leadId: "lead-1",
      mode: "retake",
      returnTo: "/profile?section=routine",
    }),
    "/result/lead-1?entry=quiz_completion&mode=retake&returnTo=%2Fprofile%3Fsection%3Droutine",
  )
  assert.equal(
    resolveQuizResultRetakeReturnTo("retake", "/profile?section=routine"),
    "/profile?section=routine",
  )
})

test("retake result paths default unsafe or missing destinations to profile", () => {
  const unsafeDestinations = [
    undefined,
    "",
    "//evil.example",
    "/\\evil.example",
    "/profile\\settings",
    " /profile",
    "/profile ",
    "/profile\nsettings",
    "https://evil.example",
    "javascript:alert(1)",
  ]

  for (const returnTo of unsafeDestinations) {
    assert.equal(resolveQuizResultRetakeReturnTo("retake", returnTo), "/profile")
    assert.equal(
      buildQuizResultPath({ leadId: "lead-1", mode: "retake", returnTo }),
      "/result/lead-1?entry=quiz_completion&mode=retake&returnTo=%2Fprofile",
    )
  }
})

test("non-retake result paths discard return destinations", () => {
  assert.equal(resolveQuizResultRetakeReturnTo(undefined, "/profile"), null)
  assert.equal(resolveQuizResultRetakeReturnTo("ordinary", "/profile"), null)
})

test("no builder for the retired onboarding path survives", () => {
  // Every paid action now lands on `/routine` (Codex review blocker 1), so the
  // builder that produced `/onboarding?lead=…&returnTo=…` has no caller left.
  // Keeping it around is an invitation to reintroduce the retired flow.
  const source = readFileSync(
    new URL("../src/lib/quiz/result-navigation.ts", import.meta.url),
    "utf8",
  )
  assert.doesNotMatch(source, /buildQuizResultOnboardingPath/)
  assert.doesNotMatch(source, /onboarding/)
})

test("result page resolves retake context before passing it to the client", () => {
  assert.match(resultPageSource, /mode\?: string \| string\[\]/)
  assert.match(resultPageSource, /returnTo\?: string \| string\[\]/)
  assert.match(
    resultPageSource,
    /const returnTo = resolveQuizResultRetakeReturnTo\(sp\.mode, sp\.returnTo\)/,
  )
  assert.match(resultPageSource, /returnTo=\{returnTo\}/)
})
