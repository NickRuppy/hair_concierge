import assert from "node:assert/strict"
import test from "node:test"

import { findPersonalPlanLead } from "../src/app/plan-bereit/readiness"

test("plan-bereit accepts only the exact active field-test enrollment when the guest email is synthetic", async () => {
  const supabase = {
    from(table: string) {
      const predicates: Array<[string, unknown]> = []
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          predicates.push([column, value])
          return builder
        },
        maybeSingle: async () => {
          if (table === "leads") {
            return {
              data: {
                id: "lead-1",
                email: "participant@example.com",
                quiz_kind: "personal_plan",
                user_id: null,
              },
              error: null,
            }
          }
          if (
            predicates.some(([column, value]) => column === "user_id" && value === "guest-1") &&
            predicates.some(([column, value]) => column === "lead_id" && value === "lead-1")
          ) {
            return {
              data: {
                id: "enrollment-1",
                user_id: "guest-1",
                lead_id: "lead-1",
                status: "active",
                expires_at: "2099-08-17T12:00:00.000Z",
                revoked_at: null,
                manual_access_grant_id: "grant-1",
                manual_access_grants: {
                  id: "grant-1",
                  user_id: "guest-1",
                  reason: "tester",
                  expires_at: "2099-08-17T12:00:00.000Z",
                  revoked_at: null,
                },
              },
              error: null,
            }
          }
          return { data: null, error: null }
        },
      }
      return builder
    },
  }

  const lead = await findPersonalPlanLead(
    supabase as never,
    "guest-1",
    "guest@field-test.invalid",
    "lead-1",
  )
  assert.equal(lead?.id, "lead-1")

  const wrongLead = await findPersonalPlanLead(
    supabase as never,
    "guest-1",
    "guest@field-test.invalid",
    "lead-2",
  )
  assert.equal(wrongLead, null)
})
