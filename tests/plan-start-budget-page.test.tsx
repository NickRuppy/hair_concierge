import assert from "node:assert/strict"
import test from "node:test"

import { resolvePlanStartPageState, type PlanStartPageDeps } from "../src/app/plan-start/page"

/*
 * Journey 5: the plan-start page projects whether the Idealplan CTA must ask the budget first.
 * Read only when direct acceptance is offered, emitted only when true, failure-tolerant.
 */

function deps(overrides: Partial<PlanStartPageDeps> = {}): PlanStartPageDeps {
  return {
    enabled: () => true,
    stage2Enabled: () => true,
    stage3Enabled: () => true,
    stage4Enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => ({
      kind: "personal_plan_start",
      frontier: "stage1",
      nextHref: "/plan-start",
      allowed: { stage1: true, stage2: false, stage3: false, stage4: false, stage5: false },
    }),
    loadExistingRefinementSession: async () => null,
    ...overrides,
  }
}

test("a missing budget is projected onto the direct-acceptance journey", async () => {
  assert.deepEqual(
    await resolvePlanStartPageState(deps({ loadShoppingBudgetRequired: async () => true })),
    {
      state: "production",
      initialJourney: {
        stage: "stage1",
        directAcceptanceAvailable: true,
        shoppingBudgetRequired: true,
      },
    },
  )
})

test("a saved budget, an unwired loader or an unreadable one change nothing", async () => {
  for (const loadShoppingBudgetRequired of [
    async () => false,
    undefined,
    async () => {
      throw new Error("down")
    },
  ]) {
    assert.deepEqual(
      await resolvePlanStartPageState(
        deps(loadShoppingBudgetRequired ? { loadShoppingBudgetRequired } : {}),
      ),
      { state: "production", initialJourney: { stage: "stage1", directAcceptanceAvailable: true } },
    )
  }
})

test("without direct acceptance the budget is never read", async () => {
  let reads = 0
  const state = await resolvePlanStartPageState(
    deps({
      stage4Enabled: () => false,
      loadShoppingBudgetRequired: async () => {
        reads += 1
        return true
      },
    }),
  )
  assert.equal(reads, 0)
  assert.deepEqual(state, { state: "production", initialJourney: { stage: "stage1" } })
})

test("an already-accepted plan is never projected as budget-first", async () => {
  let reads = 0
  const state = await resolvePlanStartPageState(
    deps({
      loadJourneyAccess: async () =>
        ({
          kind: "personal_plan",
          personalPlanId: "plan-1",
          activeRoutineVersionId: "routine-1",
          frontier: "stage1",
          nextHref: "/plan-start",
          allowed: { stage1: true, stage2: false, stage3: false, stage4: true, stage5: true },
        }) as never,
      loadShoppingBudgetRequired: async () => {
        reads += 1
        return true
      },
    }),
  )
  assert.equal(reads, 0)
  assert.deepEqual(state, {
    state: "production",
    initialJourney: { stage: "stage1", directAcceptanceAvailable: true },
  })
})
