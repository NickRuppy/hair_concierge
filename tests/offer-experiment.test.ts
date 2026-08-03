import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const flagsSource = readFileSync(new URL("../src/lib/funnel/flags.ts", import.meta.url), "utf8")
const serverSource = readFileSync(new URL("../src/lib/funnel/server.ts", import.meta.url), "utf8")

test("the retired guided-story experiment has no active assignment or runtime flag", () => {
  assert.doesNotMatch(flagsSource, /GUIDED_STORY_OFFER_EXPERIMENT_ENABLED/)
  assert.doesNotMatch(serverSource, /resolveGuidedStoryOfferExperiment/)
  assert.doesNotMatch(serverSource, /assignGuidedStoryExperimentVariant/)
})
