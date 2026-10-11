import assert from "node:assert/strict"
import test from "node:test"

import { postHogDestination } from "../src/lib/analytics/destinations/posthog"
import { eventRoutes } from "../src/lib/analytics/routes"
import { posthog } from "../src/lib/analytics/runtime/posthog"
import { createConsentAwareToolAnalytics } from "../src/lib/personal-plan/tools/analytics"
import {
  buildToolCheckpointGroups,
  toolCheckpointAnalyticsCounts,
  toolInventoryCompletedCounts,
} from "../src/lib/personal-plan/tools/checkpoint"

/**
 * Hair Tools port, Task 12: the checkpoint event and the optional tool counts on the Stage-3
 * handoff. Bounded counts only — the flag-off payloads stay exactly what they were.
 */

function capture(run: () => void): unknown[][] {
  const originalCapture = posthog.capture
  const calls: unknown[][] = []
  posthog.capture = ((...args: unknown[]) => {
    calls.push(args)
    return true
  }) as typeof posthog.capture
  try {
    run()
  } finally {
    posthog.capture = originalCapture
  }
  return calls
}

test("the checkpoint event is routed to PostHog only", () => {
  assert.deepEqual(eventRoutes.personal_plan_tools_checkpoint_viewed, {
    customerio: false,
    meta: false,
    posthog: true,
  })
})

test("the checkpoint event maps its four counts to snake_case", () => {
  const calls = capture(() =>
    postHogDestination.track("personal_plan_tools_checkpoint_viewed", {
      routeCount: 5,
      ownedCount: 7,
      gapCount: 2,
      unknownCount: 1,
    }),
  )
  assert.deepEqual(calls, [
    [
      "personal_plan_tools_checkpoint_viewed",
      { route_count: 5, owned_count: 7, gap_count: 2, unknown_count: 1 },
    ],
  ])
})

test("the tool port forwards the checkpoint event only with analytics consent", () => {
  const tracked: string[] = []
  const payload = { routeCount: 1, ownedCount: 1, gapCount: 0, unknownCount: 0 }
  const withConsent = createConsentAwareToolAnalytics({
    loadConsent: () =>
      ({ analytics: true }) as ReturnType<typeof import("../src/lib/cookie-consent").loadConsent>,
    trackAppEvent: (eventName) => void tracked.push(eventName),
  })
  const withoutConsent = createConsentAwareToolAnalytics({
    loadConsent: () => null,
    trackAppEvent: (eventName) => void tracked.push(`LEAK:${eventName}`),
  })
  withConsent.track("personal_plan_tools_checkpoint_viewed", payload)
  withoutConsent.track("personal_plan_tools_checkpoint_viewed", payload)
  assert.deepEqual(tracked, ["personal_plan_tools_checkpoint_viewed"])
})

test("the checkpoint counts are bounded numbers and carry no tool identity", () => {
  const inventory = {
    drying_textiles: ["microfiber_towel"],
    brushes_combs: ["wide_tooth_comb", "round_brush"],
    airflow: ["hair_dryer", "hot_air_brush"],
    heated_styling: ["flat_iron"],
    heatless_styling: [],
    securing_sectioning: [],
    night_protection: ["pillowcase"],
  } as const
  const groups = buildToolCheckpointGroups(inventory as never)
  const counts = toolCheckpointAnalyticsCounts(inventory as never, groups)
  // five groups shown, seven owned tools, two „Nichts davon" families, wash_application unreported
  assert.deepEqual(counts, { routeCount: 5, ownedCount: 7, gapCount: 2, unknownCount: 1 })
  assert.ok(Object.values(counts).every((value) => typeof value === "number"))
})

test("a fingers-only brush answer counts as a gap, not an owned tool", () => {
  const inventory = { brushes_combs: ["fingers"], drying_textiles: null } as never
  const counts = toolCheckpointAnalyticsCounts(inventory, buildToolCheckpointGroups(inventory))
  assert.equal(counts.ownedCount, 0)
  assert.equal(counts.gapCount, 1)
  assert.equal(counts.unknownCount, 7)
})

test("the inventory-completed counts separate reported families from „Nichts davon“ ones", () => {
  assert.deepEqual(
    toolInventoryCompletedCounts({
      drying_textiles: ["microfiber_towel"],
      airflow: ["hair_dryer", "hot_air_brush"],
      heated_styling: [],
      night_protection: [],
      brushes_combs: null,
    } as never),
    { reportedFamilyCount: 2, explicitNoneFamilyCount: 2 },
  )
  assert.deepEqual(toolInventoryCompletedCounts({}), {
    reportedFamilyCount: 0,
    explicitNoneFamilyCount: 0,
  })
})

test("both inventory events map their counts and are PostHog-only", () => {
  assert.deepEqual(eventRoutes.personal_plan_tools_inventory_entered, {
    customerio: false,
    meta: false,
    posthog: true,
  })
  const calls = capture(() => {
    postHogDestination.track("personal_plan_tools_inventory_entered", { sectionCount: 4 })
    postHogDestination.track("personal_plan_tools_inventory_completed", {
      reportedFamilyCount: 2,
      explicitNoneFamilyCount: 3,
    })
  })
  assert.deepEqual(calls, [
    ["personal_plan_tools_inventory_entered", { section_count: 4 }],
    [
      "personal_plan_tools_inventory_completed",
      { reported_family_count: 2, explicit_none_family_count: 3 },
    ],
  ])
})
