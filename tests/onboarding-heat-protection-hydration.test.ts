import assert from "node:assert/strict"
import test from "node:test"
import { shouldHydrateStoredHeatProtection } from "../src/lib/onboarding/heat-protection-hydration"

test("does not hydrate false heat protection from the database default during fresh onboarding", () => {
  assert.equal(
    shouldHydrateStoredHeatProtection({
      storedValue: false,
      initialStep: "welcome",
      onboardingCompleted: false,
      editScope: null,
      singleStepEdit: false,
    }),
    false,
  )

  assert.equal(
    shouldHydrateStoredHeatProtection({
      storedValue: false,
      initialStep: "heat_protection",
      onboardingCompleted: false,
      editScope: null,
      singleStepEdit: false,
    }),
    false,
  )
})

test("hydrates explicit or already-answered heat protection values", () => {
  assert.equal(
    shouldHydrateStoredHeatProtection({
      storedValue: true,
      initialStep: "welcome",
      onboardingCompleted: false,
      editScope: null,
      singleStepEdit: false,
    }),
    true,
  )

  assert.equal(
    shouldHydrateStoredHeatProtection({
      storedValue: false,
      initialStep: "interstitial",
      onboardingCompleted: false,
      editScope: null,
      singleStepEdit: false,
    }),
    true,
  )

  assert.equal(
    shouldHydrateStoredHeatProtection({
      storedValue: false,
      initialStep: "heat_tools",
      onboardingCompleted: true,
      editScope: "styling",
      singleStepEdit: false,
    }),
    true,
  )
})
