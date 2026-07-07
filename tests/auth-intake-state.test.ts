import assert from "node:assert/strict"
import test from "node:test"

import {
  getAuthenticatedAppRedirect,
  hasQuizDiagnostics,
  resolveIntakeState,
} from "../src/lib/auth/intake-state"

const completeQuizProfile = {
  hair_texture: "wavy",
  thickness: "normal",
  density: "medium",
  cuticle_condition: "slightly_rough",
  protein_moisture_balance: "stretches_stays",
  scalp_type: "dry",
  scalp_condition: "dry_flakes",
  chemical_treatment: ["colored"],
  concerns: ["dryness"],
}

test("hasQuizDiagnostics returns false when hair profile is missing", () => {
  assert.equal(hasQuizDiagnostics(null), false)
})

test("hasQuizDiagnostics accepts a completed no-issue scalp answer", () => {
  assert.equal(hasQuizDiagnostics({ ...completeQuizProfile, scalp_condition: null }), true)
})

test("hasQuizDiagnostics requires every other quiz-written field", () => {
  const missingDensityProfile: Partial<typeof completeQuizProfile> = { ...completeQuizProfile }
  delete missingDensityProfile.density

  assert.equal(hasQuizDiagnostics(missingDensityProfile), false)
  assert.equal(hasQuizDiagnostics({ ...completeQuizProfile, density: null }), false)
  assert.equal(hasQuizDiagnostics({ ...completeQuizProfile, chemical_treatment: [] }), false)
  assert.equal(hasQuizDiagnostics({ ...completeQuizProfile, concerns: null }), false)
  assert.equal(hasQuizDiagnostics({ ...completeQuizProfile, concerns: undefined }), false)
})

test("resolveIntakeState returns ready when onboarding is already completed", () => {
  assert.equal(resolveIntakeState({ onboarding_completed: true }, null), "ready")
})

test("resolveIntakeState returns needs_onboarding for quiz-complete users", () => {
  assert.equal(
    resolveIntakeState({ onboarding_completed: false }, completeQuizProfile),
    "needs_onboarding",
  )
})

test("resolveIntakeState returns needs_quiz for quizless users", () => {
  assert.equal(resolveIntakeState({ onboarding_completed: false }, null), "needs_quiz")
})

test("getAuthenticatedAppRedirect maps entry routes from intake state", () => {
  assert.equal(getAuthenticatedAppRedirect("/auth", "needs_quiz"), "/quiz")
  assert.equal(getAuthenticatedAppRedirect("/auth", "needs_onboarding"), "/onboarding")
  assert.equal(getAuthenticatedAppRedirect("/auth", "ready"), "/chat")
  assert.equal(getAuthenticatedAppRedirect("/chat", "needs_quiz"), "/quiz")
  assert.equal(getAuthenticatedAppRedirect("/chat", "needs_onboarding"), "/onboarding")
  assert.equal(getAuthenticatedAppRedirect("/chat", "ready"), null)
  assert.equal(getAuthenticatedAppRedirect("/routine", "needs_quiz"), "/quiz")
  assert.equal(getAuthenticatedAppRedirect("/routine", "needs_onboarding"), "/onboarding")
  assert.equal(getAuthenticatedAppRedirect("/routine", "ready"), null)
  assert.equal(getAuthenticatedAppRedirect("/routine/current", "needs_quiz"), "/quiz")
  assert.equal(getAuthenticatedAppRedirect("/routine/current", "needs_onboarding"), "/onboarding")
  assert.equal(getAuthenticatedAppRedirect("/routine/current", "ready"), null)
  assert.equal(getAuthenticatedAppRedirect("/quiz", "needs_quiz"), null)
  assert.equal(getAuthenticatedAppRedirect("/quiz", "needs_onboarding"), "/onboarding")
  assert.equal(getAuthenticatedAppRedirect("/quiz", "ready"), "/chat")
  // `/` is now the marketing landing — middleware no longer routes it
  // through this function. Verify the function returns null for `/` so
  // any future stray caller is a no-op rather than a redirect.
  assert.equal(getAuthenticatedAppRedirect("/", "needs_quiz"), null)
  assert.equal(getAuthenticatedAppRedirect("/", "needs_onboarding"), null)
  assert.equal(getAuthenticatedAppRedirect("/", "ready"), null)
})

test("getAuthenticatedAppRedirect preserves quiz retake access", () => {
  assert.equal(getAuthenticatedAppRedirect("/quiz", "ready", { isQuizRetake: true }), null)
})
