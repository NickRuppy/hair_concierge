import assert from "node:assert/strict"
import test from "node:test"

import {
  buildOfferExperimentSentryPayload,
  captureOfferExperimentAssignmentFailure,
} from "../src/lib/observability/offer-experiment"

test("experiment assignment observability has a stable fingerprint and no journey identifiers", () => {
  const payload = buildOfferExperimentSentryPayload({
    experimentId: "guided_story_offer_v2",
    revision: 1,
    intendedVariant: "guided-story-locked",
    fallbackVariant: "guided-story",
    packageKey: "default_organic",
  })

  assert.deepEqual(payload.fingerprint, ["offer-experiment-assignment-persistence-failed"])
  assert.equal(JSON.stringify(payload).includes("lead_id"), false)
  assert.equal(JSON.stringify(payload).includes("session_id"), false)
})

test("experiment assignment failures are captured through an injected sink", () => {
  const calls: unknown[] = []
  captureOfferExperimentAssignmentFailure(
    new Error("database unavailable"),
    {
      experimentId: "guided_story_offer_v2",
      revision: 1,
      intendedVariant: "guided-story-potential",
      fallbackVariant: "guided-story",
      packageKey: "default_organic",
    },
    {
      withScope(callback) {
        callback({
          setContext: () => {},
          setFingerprint: (value) => calls.push(value),
          setLevel: () => {},
          setTag: () => {},
        })
      },
      captureException: (error) => calls.push(error),
    },
  )
  assert.equal(calls.length, 2)
})
