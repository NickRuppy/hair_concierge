import assert from "node:assert/strict"
import test from "node:test"

import { createPersonalPlanRoutineAcquireRouteHandlers } from "../src/app/api/personal-plan/routine/planned-items/[itemKey]/acquire/route"
import { createRoutineAcquisitionService } from "../src/lib/personal-plan/routine/acquisition"

test("acquisition records the exact planned identity, then stages source reconciliation without activation", async () => {
  const calls: string[] = []
  const service = createRoutineAcquisitionService({
    repository: {
      async loadPlannedItem() {
        calls.push("load")
        return { personalPlanId: "plan-a", category: "oil", productId: "product-oil" }
      },
      async recordOwned(input) {
        calls.push(`owned:${input.personalPlanId}:${input.category}:${input.productId}`)
        return { userProductId: "user-product-oil" }
      },
      async sync() {
        calls.push("sync")
        return { status: "processed", proposalStaged: true }
      },
    },
  })

  const result = await service.acquire({ userId: "owner-a", itemKey: "planned-oil" })
  assert.deepEqual(result, { status: "recorded", proposalStaged: true, needsRetry: false })
  assert.deepEqual(calls, ["load", "owned:plan-a:oil:product-oil", "sync"])
})

test("a source-sync failure never rolls back or disguises the explicit ownership fact", async () => {
  const service = createRoutineAcquisitionService({
    repository: {
      async loadPlannedItem() {
        return { personalPlanId: "plan-a", category: "oil", productId: "product-oil" }
      },
      async recordOwned() {
        return { userProductId: "user-product-oil" }
      },
      async sync() {
        return { status: "conflict", proposalStaged: false }
      },
    },
  })
  assert.deepEqual(await service.acquire({ userId: "owner-a", itemKey: "planned-oil" }), {
    status: "recorded",
    proposalStaged: false,
    needsRetry: true,
  })
})

test("reused exact identity still synchronizes an explicit acquisition source event", async () => {
  let syncs = 0
  const result = await createRoutineAcquisitionService({
    repository: {
      async loadPlannedItem() {
        return { personalPlanId: "plan-a", category: "oil", productId: "product-oil" }
      },
      async recordOwned() {
        // The repository uses the same user_products identity; it must still
        // enqueue a revision before this sync call.
        return { userProductId: "existing-user-product-oil" }
      },
      async sync() {
        syncs += 1
        return { status: "processed", proposalStaged: true }
      },
    },
  }).acquire({ userId: "owner-a", itemKey: "planned-oil" })
  assert.deepEqual(result, { status: "recorded", proposalStaged: true, needsRetry: false })
  assert.equal(syncs, 1)
})

test("acquisition route authenticates before admin service construction and rejects disabled access", async () => {
  let constructed = false
  let response = await createPersonalPlanRoutineAcquireRouteHandlers({
    enabled: () => true,
    getUserId: async () => null,
    service: () => {
      constructed = true
      return {} as never
    },
  }).POST(new Request("http://local", { method: "POST" }), {
    params: Promise.resolve({ itemKey: "planned-oil" }),
  })
  assert.equal(response.status, 401)
  assert.equal(constructed, false)

  response = await createPersonalPlanRoutineAcquireRouteHandlers({
    enabled: () => false,
    getUserId: async () => "owner-a",
    service: () => ({ acquire: async () => ({ status: "not_found" }) }) as never,
  }).POST(new Request("http://local", { method: "POST" }), {
    params: Promise.resolve({ itemKey: "planned-oil" }),
  })
  assert.deepEqual(
    [response.status, await response.json()],
    [404, { error: "personal_plan_not_available" }],
  )
})
