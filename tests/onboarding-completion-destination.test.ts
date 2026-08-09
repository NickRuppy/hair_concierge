import assert from "node:assert/strict"
import test from "node:test"

import {
  resolveOnboardingCompletionCtaLabel,
  resolveOnboardingCompletionDestination,
} from "../src/lib/onboarding/completion-destination"

test("default onboarding completion focuses the Routine page", () => {
  assert.equal(resolveOnboardingCompletionDestination(null), "/routine")
  assert.equal(resolveOnboardingCompletionCtaLabel(null), "ZU MEINER ROUTINE")
})

test("explicit onboarding return destinations keep their current behavior", () => {
  assert.equal(resolveOnboardingCompletionDestination("/profile"), "/profile")
  assert.equal(resolveOnboardingCompletionCtaLabel("/profile"), "ZUM CHAT")
})
