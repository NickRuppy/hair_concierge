import assert from "node:assert/strict"
import test from "node:test"

import { loadPersonalPlanActiveRoutineVersion } from "../src/lib/personal-plan/routine/load-view"
import type { PersonalPlanRoutineReadClient } from "../src/lib/personal-plan/routine/repository"

const ids = {
  plan: "11111111-1111-4111-8111-111111111111",
  routine: "22222222-2222-4222-8222-222222222222",
  refined: "33333333-3333-4333-8333-333333333333",
}

test("Anwendung fails closed when its active Routine mismatches its immutable refined order", async () => {
  const client = {
    from(table: string) {
      const query = {
        select() {
          return query
        },
        eq() {
          return query
        },
        async maybeSingle() {
          if (table === "personal_plan_routine_versions") {
            return {
              data: {
                id: ids.routine,
                payload: {
                  schemaVersion: 1,
                  planId: ids.plan,
                  versionId: ids.routine,
                  parentVersionId: null,
                  source: {
                    refinedVersionId: ids.refined,
                    productPortfolioVersionId: "portfolio-1",
                    sourceFingerprint: "a".repeat(64),
                    compilerVersion: "v1",
                    authorityVersions: {},
                  },
                  intent: {
                    schemaVersion: 1,
                    categories: [
                      { category: "shampoo", inclusion: "included", inclusionSource: "stage3", assignments: [] },
                    ],
                  },
                  sections: [
                    { key: "basis", itemKeys: [] },
                    { key: "optional", itemKeys: [] },
                  ],
                  items: [],
                  createdAt: "2026-08-13T00:00:00.000Z",
                },
              },
              error: null,
            }
          }
          if (table === "personal_plan_need_versions") {
            return {
              data: { id: ids.refined, output_snapshot: { renderedOrder: ["conditioner", "shampoo"] } },
              error: null,
            }
          }
          return { data: null, error: null }
        },
      }
      return query
    },
  }

  const active = await loadPersonalPlanActiveRoutineVersion({
    client: client as unknown as PersonalPlanRoutineReadClient,
    userId: "owner-1",
    planId: ids.plan,
    activeRoutineVersionId: ids.routine,
  })

  assert.equal(active, null)
})
