import assert from "node:assert/strict"
import test from "node:test"

import { postHogDestination } from "../src/lib/analytics/destinations/posthog"
import type { AppEventMap, AppEventName } from "../src/lib/analytics/events"
import { eventRoutes } from "../src/lib/analytics/routes"
import { posthog } from "../src/lib/analytics/runtime/posthog"
import { trackAppEvent } from "../src/lib/analytics/track-app-event"

const stage3EventNames = [
  "personal_plan_stage3_flow_viewed",
  "personal_plan_stage3_search_interacted",
  "personal_plan_stage3_fallback_opened",
  "personal_plan_stage3_decision_selected",
  "personal_plan_stage3_save_outcome",
  "personal_plan_stage3_handoff",
] as const

test("Stage 3 structural analytics is PostHog-only", () => {
  for (const eventName of stage3EventNames) {
    assert.deepEqual(eventRoutes[eventName], { customerio: false, meta: false, posthog: true })
  }
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
  const payloads: { [E in (typeof stage3EventNames)[number]]: AppEventMap[E] } = {
    personal_plan_stage3_decision_selected: { decisionType: "override", stepKey: "fit_decision" },
    personal_plan_stage3_fallback_opened: { stepKey: "product_search" },
    personal_plan_stage3_flow_viewed: { pass: "product_capture", stepKey: "product_search" },
    personal_plan_stage3_handoff: { outcome: "ready_for_routine" },
    personal_plan_stage3_save_outcome: { outcome: "retry" },
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
    for (const eventName of stage3EventNames) {
      postHogDestination.track(eventName, payloads[eventName])
    }
  } finally {
    posthog.capture = originalCapture
  }

  assert.deepEqual(calls, [
    ["personal_plan_stage3_flow_viewed", { pass: "product_capture", step_key: "product_search" }],
    [
      "personal_plan_stage3_search_interacted",
      { interaction: "candidate_selected", result_count_band: "4_8", selected_candidate_position: 3 },
    ],
    ["personal_plan_stage3_fallback_opened", { step_key: "product_search" }],
    ["personal_plan_stage3_decision_selected", { decision_type: "override", step_key: "fit_decision" }],
    ["personal_plan_stage3_save_outcome", { outcome: "retry" }],
    ["personal_plan_stage3_handoff", { outcome: "ready_for_routine" }],
  ])

  const mappedPropertyKeys = calls.flatMap(([, properties]) => Object.keys(properties as object))
  for (const forbiddenField of [
    "query",
    "product",
    "image",
    "free_text",
    "criteria",
    "profile",
  ]) {
    assert.equal(mappedPropertyKeys.includes(forbiddenField), false, forbiddenField)
  }
})

test("Stage 3 flow events dispatch only through the typed PostHog route", () => {
  const originalTrack = postHogDestination.track
  const calls: Array<{ eventName: AppEventName; payload: AppEventMap[AppEventName] }> = []
  postHogDestination.track = ((eventName, payload) => {
    calls.push({ eventName, payload })
    return true
  }) as typeof postHogDestination.track

  try {
    trackAppEvent("personal_plan_stage3_flow_viewed", {
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
