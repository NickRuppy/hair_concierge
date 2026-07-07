import assert from "node:assert/strict"
import test from "node:test"

import { INVENTORY_CATEGORIES } from "../src/lib/recommendation-engine/contracts"
import { createRoutineApiHandlers } from "../src/lib/routines/api-handlers"

function createHandlers(dismissed: string[]) {
  return createRoutineApiHandlers({
    createClient: async () =>
      ({
        auth: {
          async getUser() {
            return { data: { user: { id: "user-1" } }, error: null }
          },
        },
        from() {
          throw new Error("unexpected table access in category validation test")
        },
      }) as never,
    createAdminClient: () => ({}) as never,
    loadRoutineArtifactData: async () => {
      throw new Error("unexpected load in category validation test")
    },
    shapeRoutineForUi: () => ({}) as never,
    createDismissal: async ({ category }) => {
      dismissed.push(category)
      return { category }
    },
  })
}

test("every category CareBalance can emit is accepted by the routine API validators", async () => {
  const dismissed: string[] = []
  const handlers = createHandlers(dismissed)

  for (const category of INVENTORY_CATEGORIES) {
    const result = await handlers.dismissSuggestion(category)
    assert.equal(
      result.status,
      200,
      `${category} must be a valid routine category (got ${result.status}: ${JSON.stringify(result.body)})`,
    )
  }

  assert.deepEqual(dismissed, [...INVENTORY_CATEGORIES])
})

test("unknown categories are still rejected", async () => {
  const handlers = createHandlers([])
  const result = await handlers.dismissSuggestion("nagellack")
  assert.equal(result.status, 400)
})
