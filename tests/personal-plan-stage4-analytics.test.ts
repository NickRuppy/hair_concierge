import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { postHogDestination } from "../src/lib/analytics/destinations/posthog"
import { posthog } from "../src/lib/analytics/runtime/posthog"
import { eventRoutes } from "../src/lib/analytics/routes"
import {
  createConsentAwareRoutineAnalytics,
  routineAnalytics,
  type RoutineAnalyticsPort,
  type RoutineAnalyticsEventName,
} from "../src/lib/personal-plan/routine/analytics"
import type { CookieConsent } from "../src/lib/cookie-consent"

const routineEvents = [
  "personal_plan_stage4_routine_viewed",
  "personal_plan_stage4_proposal_interacted",
  "personal_plan_stage4_editor_interacted",
  "personal_plan_stage4_item_interacted",
  "personal_plan_stage4_outcome",
] as const satisfies readonly RoutineAnalyticsEventName[]

test("Stage 4 routine analytics are PostHog-only", () => {
  for (const eventName of routineEvents) {
    assert.deepEqual(eventRoutes[eventName], { customerio: false, meta: false, posthog: true })
  }
})

test("Stage 4 routine events map only structural, bounded properties", () => {
  const originalCapture = posthog.capture
  const captures: unknown[][] = []
  posthog.capture = ((...args: unknown[]) => {
    captures.push(args)
    return true
  }) as typeof posthog.capture

  try {
    postHogDestination.track("personal_plan_stage4_routine_viewed", {
      surface: "routine_page",
      variant: "active",
    })
    postHogDestination.track("personal_plan_stage4_proposal_interacted", {
      changeCountBand: "2_4",
      interaction: "displayed",
      origin: "routine_page",
    })
    postHogDestination.track("personal_plan_stage4_editor_interacted", {
      changeCountBand: "5_plus",
      interaction: "submitted",
      origin: "routine_page",
    })
    postHogDestination.track("personal_plan_stage4_item_interacted", {
      interaction: "shop_link_opened",
      surface: "routine_card",
    })
    postHogDestination.track("personal_plan_stage4_outcome", {
      origin: "editor",
      outcome: "conflict",
    })
  } finally {
    posthog.capture = originalCapture
  }

  assert.deepEqual(captures, [
    ["personal_plan_stage4_routine_viewed", { surface: "routine_page", variant: "active" }],
    [
      "personal_plan_stage4_proposal_interacted",
      { change_count_band: "2_4", interaction: "displayed", origin: "routine_page" },
    ],
    [
      "personal_plan_stage4_editor_interacted",
      { change_count_band: "5_plus", interaction: "submitted", origin: "routine_page" },
    ],
    [
      "personal_plan_stage4_item_interacted",
      { interaction: "shop_link_opened", surface: "routine_card" },
    ],
    ["personal_plan_stage4_outcome", { origin: "editor", outcome: "conflict" }],
  ])
})

test("routine client port exposes only the Stage 4 structural event family", () => {
  const calls: Array<{ eventName: RoutineAnalyticsEventName; payload: unknown }> = []
  const analytics: RoutineAnalyticsPort = {
    track(eventName, payload) {
      calls.push({ eventName, payload })
    },
  }

  analytics.track("personal_plan_stage4_item_interacted", {
    interaction: "acquisition_declared",
    surface: "routine_detail",
  })

  assert.deepEqual(calls, [
    {
      eventName: "personal_plan_stage4_item_interacted",
      payload: { interaction: "acquisition_declared", surface: "routine_detail" },
    },
  ])
  assert.equal(typeof routineAnalytics.track, "function")
})

test("Routine analytics checks current consent for every event and never replays denied events", () => {
  let consent: CookieConsent | null = null
  const calls: Array<{ eventName: RoutineAnalyticsEventName; payload: unknown }> = []
  const analytics = createConsentAwareRoutineAnalytics({
    loadConsent: () => consent,
    trackAppEvent(eventName, payload) {
      calls.push({ eventName, payload })
    },
  })

  analytics.track("personal_plan_stage4_routine_viewed", {
    surface: "routine_page",
    variant: "proposal",
  })
  consent = { essential: true, analytics: false, marketing: false, ts: 1 }
  analytics.track("personal_plan_stage4_outcome", { origin: "sync", outcome: "error" })

  consent = { essential: true, analytics: true, marketing: false, ts: 2 }
  analytics.track("personal_plan_stage4_proposal_interacted", {
    interaction: "accepted",
    origin: "routine_page",
    changeCountBand: "1",
  })

  consent = { essential: true, analytics: false, marketing: false, ts: 3 }
  analytics.track("personal_plan_stage4_item_interacted", {
    interaction: "product_detail_opened",
    surface: "routine_card",
  })

  assert.deepEqual(calls, [
    {
      eventName: "personal_plan_stage4_proposal_interacted",
      payload: {
        interaction: "accepted",
        origin: "routine_page",
        changeCountBand: "1",
      },
    },
  ])
})

test("Stage 4 event contracts forbid identity and sensitive routine fields", () => {
  const forbidden = [
    "productId",
    "productName",
    "proposalId",
    "personalPlanId",
    "userId",
    "url",
    "price",
    "profile",
    "freeText",
  ]
  const eventSource = readFileSync(
    new URL("../src/lib/analytics/events.ts", import.meta.url),
    "utf8",
  ) as string
  const routineContract = eventSource.slice(
    eventSource.indexOf("export type PersonalPlanStage4"),
    eventSource.indexOf("export function claimCheckoutFailure"),
  )

  for (const field of forbidden) {
    assert.equal(routineContract.includes(field), false, `must not include ${field}`)
  }
})
