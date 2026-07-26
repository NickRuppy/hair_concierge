import assert from "node:assert/strict"
import test from "node:test"

import {
  GUIDED_STORY_OFFER_EXPERIMENT,
  assignGuidedStoryExperimentVariant,
  isGuidedStoryExperimentVariant,
  isGuidedStoryFamilyVariant,
} from "../src/lib/funnel/offer-experiment"
import { isGuidedStoryOfferExperimentEnabled } from "../src/lib/funnel/flags"
import { resolveGuidedStoryOfferExperiment } from "../src/lib/funnel/server"

test("guided-story experiment assignment is deterministic and uses only the stable identity", () => {
  const first = assignGuidedStoryExperimentVariant("session-a")
  assert.equal(first, assignGuidedStoryExperimentVariant("session-a"))
  assert.ok(GUIDED_STORY_OFFER_EXPERIMENT.variants.includes(first))

  const allocations = new Set(
    Array.from({ length: 200 }, (_, index) =>
      assignGuidedStoryExperimentVariant(`session-${index}`),
    ),
  )
  assert.deepEqual(allocations, new Set(GUIDED_STORY_OFFER_EXPERIMENT.variants))

  const counts = new Map(GUIDED_STORY_OFFER_EXPERIMENT.variants.map((variant) => [variant, 0]))
  for (let index = 0; index < 10_000; index += 1) {
    const variant = assignGuidedStoryExperimentVariant(`fixed-session-${index}`)
    counts.set(variant, (counts.get(variant) ?? 0) + 1)
  }
  for (const count of counts.values()) {
    assert.ok(count >= 3_100 && count <= 3_550, `unexpected bucket count ${count}`)
  }
})

test("guided-story family is finite and includes rollback plus each experiment arm", () => {
  assert.equal(isGuidedStoryFamilyVariant("guided-story"), true)
  for (const variant of GUIDED_STORY_OFFER_EXPERIMENT.variants) {
    assert.equal(isGuidedStoryFamilyVariant(variant), true)
    assert.equal(isGuidedStoryExperimentVariant(variant), true)
  }
  assert.equal(isGuidedStoryFamilyVariant("default"), false)
  assert.equal(isGuidedStoryExperimentVariant("guided-story"), false)
})

test("experiment flag is disabled unless it is exactly true", () => {
  const previous = process.env.GUIDED_STORY_OFFER_EXPERIMENT_ENABLED
  try {
    delete process.env.GUIDED_STORY_OFFER_EXPERIMENT_ENABLED
    assert.equal(isGuidedStoryOfferExperimentEnabled(), false)
    process.env.GUIDED_STORY_OFFER_EXPERIMENT_ENABLED = "TRUE"
    assert.equal(isGuidedStoryOfferExperimentEnabled(), false)
    process.env.GUIDED_STORY_OFFER_EXPERIMENT_ENABLED = "true"
    assert.equal(isGuidedStoryOfferExperimentEnabled(), true)
  } finally {
    if (previous === undefined) delete process.env.GUIDED_STORY_OFFER_EXPERIMENT_ENABLED
    else process.env.GUIDED_STORY_OFFER_EXPERIMENT_ENABLED = previous
  }
})

test("stored arms stay sticky while enabled and the disabled switch renders rollback", async () => {
  const experimentVariant = await resolveGuidedStoryOfferExperiment({
    leadId: "lead-1",
    enabled: true,
    session: {
      sessionId: "session-1",
      packageKey: "default_organic",
      offerVariant: "guided-story-potential",
      offerViewedAt: "2026-07-26T10:00:00.000Z",
    },
  })
  assert.equal(experimentVariant, "guided-story-potential")

  const disabledRollback = await resolveGuidedStoryOfferExperiment({
    leadId: "lead-1",
    enabled: false,
    session: {
      sessionId: "session-1",
      packageKey: "default_organic",
      offerVariant: "guided-story-potential",
      offerViewedAt: "2026-07-26T10:00:00.000Z",
    },
  })
  assert.equal(disabledRollback, "guided-story")
})

test("the experiment resolver preserves non-guided package offers while disabled", async () => {
  const resolved = await resolveGuidedStoryOfferExperiment({
    leadId: "lead-1",
    enabled: false,
    session: {
      sessionId: "session-1",
      packageKey: "scalp_check_placeholder",
      offerVariant: "default",
      offerViewedAt: null,
    },
  })

  assert.equal(resolved, "default")
})

test("viewed guided-story sessions remain rollback while the experiment is enabled", async () => {
  const rollback = await resolveGuidedStoryOfferExperiment({
    leadId: "lead-1",
    enabled: true,
    session: {
      sessionId: "session-1",
      packageKey: "default_organic",
      offerVariant: "guided-story",
      offerViewedAt: "2026-07-26T10:00:00.000Z",
    },
  })
  assert.equal(rollback, "guided-story")
})

test("missing-session fallback is stable for the lead without persistence", async () => {
  const first = await resolveGuidedStoryOfferExperiment({
    leadId: "lead-without-session",
    enabled: true,
    session: null,
  })
  const second = await resolveGuidedStoryOfferExperiment({
    leadId: "lead-without-session",
    enabled: true,
    session: null,
  })
  assert.equal(first, second)
  assert.equal(isGuidedStoryExperimentVariant(first), true)
})
