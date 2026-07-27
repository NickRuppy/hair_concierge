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

test("stored viewed arms stay sticky after the assignment switch is disabled", async () => {
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

  const disabledVariant = await resolveGuidedStoryOfferExperiment({
    leadId: "lead-1",
    enabled: false,
    session: {
      sessionId: "session-1",
      packageKey: "default_organic",
      offerVariant: "guided-story-potential",
      offerViewedAt: "2026-07-26T10:00:00.000Z",
    },
  })
  assert.equal(disabledVariant, "guided-story-potential")
})

test("the disabled switch atomically resets an unviewed stored arm before rollback", async () => {
  let updateValue: unknown = null
  let offerViewedAtGuard: unknown = "unset"
  let storedVariantGuard: unknown = null
  const client = {
    from: () => ({
      update: (values: Record<string, unknown>) => ({
        eq: () => ({
          is: (column: string, value: null) => {
            offerViewedAtGuard = column === "offer_viewed_at" ? value : "wrong-column"
            return {
              eq: (guardColumn: string, guardValue: string) => {
                updateValue = values.offer_variant
                storedVariantGuard = guardColumn === "offer_variant" ? guardValue : "wrong-column"
                return {
                  select: () => ({
                    maybeSingle: async () => ({
                      data: { offer_variant: values.offer_variant },
                      error: null,
                    }),
                  }),
                }
              },
            }
          },
        }),
      }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
  }

  const variant = await resolveGuidedStoryOfferExperiment({
    leadId: "lead-1",
    enabled: false,
    client: client as never,
    session: {
      sessionId: "session-1",
      packageKey: "default_organic",
      offerVariant: "guided-story-potential",
      offerViewedAt: null,
    },
  })

  assert.equal(variant, "guided-story")
  assert.equal(updateValue, "guided-story")
  assert.equal(offerViewedAtGuard, null)
  assert.equal(storedVariantGuard, "guided-story-potential")
})

test("the disabled switch preserves a concurrent experiment winner after the guarded reset loses", async () => {
  let readBack = false
  const client = {
    from: () => ({
      update: () => ({
        eq: () => ({
          is: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            readBack = true
            return {
              data: { offer_variant: "guided-story-founder-letter" },
              error: null,
            }
          },
        }),
      }),
    }),
  }

  const variant = await resolveGuidedStoryOfferExperiment({
    leadId: "lead-1",
    enabled: false,
    client: client as never,
    session: {
      sessionId: "session-1",
      packageKey: "default_organic",
      offerVariant: "guided-story-potential",
      offerViewedAt: null,
    },
  })

  assert.equal(variant, "guided-story-founder-letter")
  assert.equal(readBack, true)
})

test("the disabled switch preserves the stored arm when rollback persistence fails", async () => {
  let captured = 0
  const client = {
    from: () => ({
      update: () => ({
        eq: () => ({
          is: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({
                  data: null,
                  error: new Error("database unavailable"),
                }),
              }),
            }),
          }),
        }),
      }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
  }

  const variant = await resolveGuidedStoryOfferExperiment({
    leadId: "lead-1",
    enabled: false,
    client: client as never,
    captureFailure: () => {
      captured += 1
    },
    session: {
      sessionId: "session-1",
      packageKey: "default_organic",
      offerVariant: "guided-story-potential",
      offerViewedAt: null,
    },
  })

  assert.equal(variant, "guided-story-potential")
  assert.equal(captured, 1)
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
