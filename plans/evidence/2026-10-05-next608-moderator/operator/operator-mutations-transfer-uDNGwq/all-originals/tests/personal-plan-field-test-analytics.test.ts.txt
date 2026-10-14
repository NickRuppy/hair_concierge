import assert from "node:assert/strict"
import test from "node:test"

import { metaDestination } from "../src/lib/analytics/destinations/meta"
import { customerIoDestination } from "../src/lib/analytics/destinations/customerio"
import { postHogDestination } from "../src/lib/analytics/destinations/posthog"
import { posthog } from "../src/lib/analytics/runtime/posthog"
import { buildPersonalPlanCustomerIoTraits } from "../src/lib/personal-plan-quiz/customerio"

const offerEvent = {
  entryContext: "quiz_completion",
  focusRoutine: false,
  leadId: "lead",
  offerRevision: "personal_plan_v1",
  offerVariant: "personal-plan-v1",
  offerViewId: "view",
  sectionId: "pricing",
  sectionIndex: 1,
  testKind: "field_test",
} as const

test("field-test offer analytics stay in PostHog with test_kind and are rejected by Meta", () => {
  assert.equal(metaDestination.track("offer_section_viewed", offerEvent), false)

  const original = posthog.capture
  const calls: unknown[][] = []
  posthog.capture = ((...args: unknown[]) => {
    calls.push(args)
    return true
  }) as typeof posthog.capture
  try {
    postHogDestination.track("offer_section_viewed", offerEvent)
  } finally {
    posthog.capture = original
  }
  assert.equal((calls[0][1] as Record<string, unknown>).test_kind, "field_test")
})

test("all non-commercial journey kinds are rejected by Meta", () => {
  for (const testKind of ["field_test", "partner"] as const) {
    assert.equal(metaDestination.track("offer_section_viewed", { ...offerEvent, testKind }), false)
  }
})

test("Customer.io keeps established field-test routing and suppresses only partner events", () => {
  assert.notEqual(
    customerIoDestination.track("quiz_started", {
      stepName: "hair_texture",
      stepNumber: 1,
      testKind: "field_test",
    }),
    false,
  )
  assert.equal(
    customerIoDestination.track("quiz_started", {
      stepName: "hair_texture",
      stepNumber: 1,
      testKind: "partner",
    }),
    false,
  )
})

test("Customer.io traits mark a field test as ineligible for commercial automation", () => {
  const traits = buildPersonalPlanCustomerIoTraits({
    createdAt: "2026-08-10T10:00:00Z",
    email: "participant@example.com",
    leadId: "lead",
    marketingConsent: true,
    quizAnswers: {
      kind: "personal_plan",
      version: 3,
      answers: {
        texture: "wavy",
        thickness: "normal",
        density: "medium",
        hairLength: "medium",
        hairSurface: "smooth",
        elasticResponse: "stretches_bounces",
        scalpOiliness: "balanced",
        scalpConcerns: [],
        chemicalTreatments: ["natural"],
        currentConcerns: ["dry_lengths"],
        concernRecurrence: { concernId: "dry_lengths", frequency: "sometimes" },
        goals: ["moisture"],
        routineStyle: "simple_reliable",
        routineClarity: "partial",
      },
    },
    testKind: "field_test",
  })
  assert.equal(traits.test_kind, "field_test")
  assert.equal(traits.commercial_automation_eligible, false)
  assert.equal(traits.marketing_consent, true)
})

test("Customer.io traits mark partner journeys as ineligible for commercial automation", () => {
  const traits = buildPersonalPlanCustomerIoTraits({
    createdAt: "2026-09-01T10:00:00Z",
    email: "creator@example.com",
    leadId: "lead",
    marketingConsent: true,
    quizAnswers: {
      kind: "personal_plan",
      version: 3,
      answers: {
        texture: "wavy",
        thickness: "normal",
        density: "medium",
        hairLength: "medium",
        hairSurface: "smooth",
        elasticResponse: "stretches_bounces",
        scalpOiliness: "balanced",
        scalpConcerns: [],
        chemicalTreatments: ["natural"],
        currentConcerns: ["dry_lengths"],
        concernRecurrence: { concernId: "dry_lengths", frequency: "sometimes" },
        goals: ["moisture"],
        routineStyle: "simple_reliable",
        routineClarity: "partial",
      },
    },
    testKind: "partner",
  })
  assert.equal(traits.test_kind, "partner")
  assert.equal(traits.commercial_automation_eligible, false)
})
