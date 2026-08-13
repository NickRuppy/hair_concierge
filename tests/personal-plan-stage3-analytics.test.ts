import assert from "node:assert/strict"
import test from "node:test"

import { postHogDestination } from "../src/lib/analytics/destinations/posthog"
import type { AppEventMap, AppEventName } from "../src/lib/analytics/events"
import { eventRoutes } from "../src/lib/analytics/routes"
import { posthog } from "../src/lib/analytics/runtime/posthog"
import { developmentStage3Analytics } from "../src/lib/personal-plan/products/stage3-development-analytics"
import {
  createConsentAwareStage3BaselineAnalytics,
  type Stage3AnalyticsPort,
} from "../src/lib/personal-plan/products/stage3-analytics"

const verboseStage3EventNames = [
  "personal_plan_stage3_flow_viewed",
  "personal_plan_stage3_search_interacted",
  "personal_plan_stage3_fallback_opened",
  "personal_plan_stage3_decision_selected",
  "personal_plan_stage3_save_outcome",
  "personal_plan_stage3_recovery_outcome",
  "personal_plan_stage3_handoff",
] as const

const baselineStage3EventNames = [
  "personal_plan_stage3_journey_started",
  "personal_plan_stage3_routine_opened",
] as const

const reviewStage3EventNames = [
  "personal_plan_stage3_review_viewed",
  "personal_plan_stage3_review_back",
  "personal_plan_stage3_review_completed",
  "personal_plan_stage3_review_action",
] as const

const stage3EventNames = [
  ...baselineStage3EventNames,
  ...reviewStage3EventNames,
  ...verboseStage3EventNames,
] as const

test("Stage 3 structural analytics is PostHog-only", () => {
  for (const eventName of stage3EventNames) {
    assert.deepEqual(eventRoutes[eventName], { customerio: false, meta: false, posthog: true })
  }
})

test("Stage 3 baseline analytics is consent-aware and suppresses verbose events", () => {
  const calls: Array<{ eventName: string; payload: object }> = []
  const analytics = createConsentAwareStage3BaselineAnalytics({
    loadConsent: () => ({ essential: true, analytics: false, marketing: false, ts: 0 }),
    trackAppEvent: ((eventName: string, payload: object) =>
      calls.push({ eventName, payload })) as Stage3AnalyticsPort["track"],
  })

  analytics.track("personal_plan_stage3_journey_started", {})
  assert.equal(calls.length, 0)

  const consentedAnalytics = createConsentAwareStage3BaselineAnalytics({
    loadConsent: () => ({ essential: true, analytics: true, marketing: false, ts: 0 }),
    trackAppEvent: ((eventName: string, payload: object) =>
      calls.push({ eventName, payload })) as Stage3AnalyticsPort["track"],
  })
  consentedAnalytics.track("personal_plan_stage3_journey_started", {})
  consentedAnalytics.track("personal_plan_stage3_routine_opened", {})
  consentedAnalytics.track("personal_plan_stage3_review_viewed", {
    category: "conditioner",
    verdict: "ideal",
    position: 1,
    count: 1,
  })
  consentedAnalytics.track("personal_plan_stage3_flow_viewed", {
    pass: "product_capture",
    stepKey: "product_search",
  })

  assert.deepEqual(calls, [
    { eventName: "personal_plan_stage3_journey_started", payload: {} },
    { eventName: "personal_plan_stage3_routine_opened", payload: {} },
    {
      eventName: "personal_plan_stage3_review_viewed",
      payload: { category: "conditioner", verdict: "ideal", position: 1, count: 1 },
    },
  ])
})

test("Stage 3 handoff outcomes keep pending products and gaps non-blocking", () => {
  const outcomes: AppEventMap["personal_plan_stage3_handoff"]["outcome"][] = [
    "ready_for_routine",
    "ready_with_pending",
    "ready_with_gap",
  ]

  assert.deepEqual(outcomes, ["ready_for_routine", "ready_with_pending", "ready_with_gap"])
})

test("Stage 3 structural analytics maps only its bounded privacy-safe contract", () => {
  const payloads: { [E in (typeof verboseStage3EventNames)[number]]: AppEventMap[E] } = {
    personal_plan_stage3_decision_selected: { decisionType: "override", stepKey: "fit_decision" },
    personal_plan_stage3_fallback_opened: { stepKey: "product_search" },
    personal_plan_stage3_flow_viewed: { pass: "product_capture", stepKey: "product_search" },
    personal_plan_stage3_handoff: { outcome: "ready_for_routine" },
    personal_plan_stage3_save_outcome: { outcome: "retry" },
    personal_plan_stage3_recovery_outcome: {
      operation: "decision",
      outcome: "canonical_satisfied",
      failurePhase: "response",
    },
    personal_plan_stage3_search_interacted: {
      interaction: "candidate_selected",
      resultCountBand: "4_8",
      selectedCandidatePosition: 3,
    },
  }
  const originalCapture = posthog.capture
  const calls: unknown[][] = []
  posthog.capture = ((...args: unknown[]) => {
    calls.push(args)
    return true
  }) as typeof posthog.capture

  try {
    for (const eventName of verboseStage3EventNames) {
      postHogDestination.track(eventName, payloads[eventName])
    }
  } finally {
    posthog.capture = originalCapture
  }

  assert.deepEqual(calls, [
    ["personal_plan_stage3_flow_viewed", { pass: "product_capture", step_key: "product_search" }],
    [
      "personal_plan_stage3_search_interacted",
      {
        interaction: "candidate_selected",
        result_count_band: "4_8",
        selected_candidate_position: 3,
      },
    ],
    ["personal_plan_stage3_fallback_opened", { step_key: "product_search" }],
    [
      "personal_plan_stage3_decision_selected",
      { decision_type: "override", step_key: "fit_decision" },
    ],
    ["personal_plan_stage3_save_outcome", { outcome: "retry" }],
    [
      "personal_plan_stage3_recovery_outcome",
      {
        operation: "decision",
        outcome: "canonical_satisfied",
        failure_phase: "response",
      },
    ],
    ["personal_plan_stage3_handoff", { outcome: "ready_for_routine" }],
  ])

  const mappedPropertyKeys = calls.flatMap(([, properties]) => Object.keys(properties as object))
  for (const forbiddenField of ["query", "product", "image", "free_text", "criteria", "profile"]) {
    assert.equal(mappedPropertyKeys.includes(forbiddenField), false, forbiddenField)
  }
})

test("Stage 3 baseline events map to PostHog with empty payloads", () => {
  const originalCapture = posthog.capture
  const calls: unknown[][] = []
  posthog.capture = ((...args: unknown[]) => {
    calls.push(args)
    return true
  }) as typeof posthog.capture

  try {
    for (const eventName of baselineStage3EventNames) postHogDestination.track(eventName, {})
  } finally {
    posthog.capture = originalCapture
  }

  assert.deepEqual(calls, [
    ["personal_plan_stage3_journey_started", {}],
    ["personal_plan_stage3_routine_opened", {}],
  ])
})

test("Stage 3 review events map their bounded payloads to PostHog", () => {
  const originalCapture = posthog.capture
  const calls: unknown[][] = []
  posthog.capture = ((...args: unknown[]) => {
    calls.push(args)
    return true
  }) as typeof posthog.capture

  try {
    postHogDestination.track("personal_plan_stage3_review_viewed", {
      category: "conditioner",
      verdict: "mismatch",
      position: 2,
      count: 4,
    })
    postHogDestination.track("personal_plan_stage3_review_action", {
      category: "conditioner",
      verdict: "mismatch",
      action: "select_replacement",
      position: 2,
      count: 4,
    })
    postHogDestination.track("personal_plan_stage3_review_back", {
      category: "conditioner",
      destination: "previous_review",
      position: 2,
      count: 4,
    })
    postHogDestination.track("personal_plan_stage3_review_completed", { count: 4 })
  } finally {
    posthog.capture = originalCapture
  }

  assert.deepEqual(calls, [
    [
      "personal_plan_stage3_review_viewed",
      { category: "conditioner", verdict: "mismatch", position: 2, count: 4 },
    ],
    [
      "personal_plan_stage3_review_action",
      {
        category: "conditioner",
        verdict: "mismatch",
        action: "select_replacement",
        position: 2,
        count: 4,
      },
    ],
    [
      "personal_plan_stage3_review_back",
      {
        category: "conditioner",
        destination: "previous_review",
        position: 2,
        count: 4,
      },
    ],
    ["personal_plan_stage3_review_completed", { count: 4 }],
  ])
})

test("Stage 3 Labs adapter preserves the typed PostHog route", () => {
  const originalTrack = postHogDestination.track
  const calls: Array<{ eventName: AppEventName; payload: AppEventMap[AppEventName] }> = []
  postHogDestination.track = ((eventName, payload) => {
    calls.push({ eventName, payload })
    return true
  }) as typeof postHogDestination.track

  try {
    developmentStage3Analytics.track("personal_plan_stage3_flow_viewed", {
      pass: "product_decisions",
      stepKey: "fit_orientation",
    })
  } finally {
    postHogDestination.track = originalTrack
  }

  assert.deepEqual(calls, [
    {
      eventName: "personal_plan_stage3_flow_viewed",
      payload: { pass: "product_decisions", stepKey: "fit_orientation" },
    },
  ])
})
