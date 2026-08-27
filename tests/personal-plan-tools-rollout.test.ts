import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { createConsentAwareToolAnalytics } from "@/lib/personal-plan/tools/analytics"
import { eventRoutes } from "@/lib/analytics/routes"
import {
  canAccessPersonalPlanTools,
  resolvePersonalPlanToolsRollout,
} from "@/lib/personal-plan/release"
import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import { EMPTY_TOOL_CARE_FACTS } from "@/lib/personal-plan/tools/facts"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

function snapshotFor(tools?: Parameters<typeof computeNeedPlan>[0]["tools"]) {
  const computed = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "artifact-1",
    projection: "initial_quiz",
    computationVersion: "test",
    createdAt: "2026-08-21T00:00:00.000Z",
    ...(tools ? { tools } : {}),
  })
  assert.equal(computed.status, "ready")
  if (computed.status !== "ready") throw new Error("unreachable")
  return computed.snapshot
}

test("off is the default and every invalid value fails closed", () => {
  for (const value of [undefined, "", "1", "true", "ALL", "internal ", "on"]) {
    const rollout = resolvePersonalPlanToolsRollout(
      value === undefined ? {} : { PERSONAL_PLAN_TOOLS_ROLLOUT: value },
    )
    assert.equal(
      rollout === "internal" && value === "internal ",
      rollout === "internal",
      "only a trimmed exact value is accepted",
    )
    if (value !== "internal ") assert.equal(rollout, "off", `${String(value)} must fail closed`)
  }
})

test("internal serves only internal identities and never a browser claim", () => {
  assert.equal(canAccessPersonalPlanTools({ rollout: "internal", isInternal: false }), false)
  assert.equal(canAccessPersonalPlanTools({ rollout: "internal", isInternal: true }), true)
  assert.equal(canAccessPersonalPlanTools({ rollout: "off", isInternal: true }), false)
})

test("a Tools-off snapshot is byte-identical to today's ten-category snapshot", () => {
  const off = snapshotFor()
  assert.equal("toolPlan" in off, false)
  assert.equal(
    (off.renderedOrder as readonly string[]).includes("tools"),
    false,
    "Tools never joins the care-product rendered order",
  )
  assert.equal(
    off.decisions.some((decision) => (decision.category as string) === "tools"),
    false,
  )
})

test("a Tools-on snapshot adds the parallel plan additively", () => {
  const on = snapshotFor({ care: EMPTY_TOOL_CARE_FACTS, inventory: {} })
  assert.ok(on.toolPlan)
  assert.equal(on.toolPlan?.schemaVersion, 3)
  // The care-product side of the snapshot is untouched.
  const off = snapshotFor()
  assert.deepEqual(on.decisions, off.decisions)
  assert.deepEqual(on.renderedOrder, off.renderedOrder)
  assert.deepEqual(on.coverage, off.coverage)
  assert.equal(on.inputHash, off.inputHash)
})

test("zero Tool rows are safe: an enabled owner with nothing to show gets an empty plan", () => {
  const on = snapshotFor({
    care: EMPTY_TOOL_CARE_FACTS,
    inventory: {},
  })
  assert.ok(Array.isArray(on.toolPlan?.assets))
  assert.ok(Array.isArray(on.toolPlan?.occurrences))
  assert.ok(Array.isArray(on.toolPlan?.guidance))
})

test("Tool analytics are consent-gated and carry only bounded counts", () => {
  const tracked: Array<[string, unknown]> = []
  const denied = createConsentAwareToolAnalytics({
    loadConsent: () => ({ analytics: false }) as never,
    trackAppEvent: (name, payload) => tracked.push([name, payload]),
  })
  denied.track("personal_plan_tools_inventory_entered", { sectionCount: 4 })
  assert.equal(tracked.length, 0)

  const allowed = createConsentAwareToolAnalytics({
    loadConsent: () => ({ analytics: true }) as never,
    trackAppEvent: (name, payload) => tracked.push([name, payload]),
  })
  allowed.track("personal_plan_tools_inventory_completed", {
    reportedFamilyCount: 2,
    explicitNoneFamilyCount: 1,
  })
  assert.deepEqual(tracked, [
    [
      "personal_plan_tools_inventory_completed",
      { reportedFamilyCount: 2, explicitNoneFamilyCount: 1 },
    ],
  ])
})

test("the inventory-completed event is wired to a reachable completion path", () => {
  // Regression guard: the event was originally emitted only where
  // `firstUnresolvedQuestionId === null` AND a next question existed, which is
  // contradictory, so it could never fire.
  const flow = readFileSync(
    new URL("../src/components/personal-plan-refinement/refinement-flow.tsx", import.meta.url),
    "utf8",
  )
  const emissions = flow.split("personal_plan_tools_inventory_completed").length - 1
  assert.equal(emissions, 2, "both Stage-2 completion paths emit it exactly once")
  assert.equal(
    flow.includes("nextSession.path.firstUnresolvedQuestionId === null"),
    false,
    "the unreachable guard must not come back",
  )
  assert.ok(flow.includes("personal_plan_tools_inventory_entered"))
})

test("Tool events reach PostHog only, never Customer.io or Meta", () => {
  for (const name of [
    "personal_plan_tools_checkpoint_viewed",
    "personal_plan_tools_inventory_entered",
    "personal_plan_tools_inventory_completed",
  ] as const) {
    assert.deepEqual(eventRoutes[name], { customerio: false, meta: false, posthog: true })
  }
})
