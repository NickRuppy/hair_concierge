import assert from "node:assert/strict"
import test from "node:test"

import { isPersonalPlanAppV1AllowedForUser } from "../src/lib/personal-plan/rollout-access"

function profileClient(
  isAdmin: boolean,
  email = "customer@example.com",
  emailConfirmedAt: string | null = "2026-08-09T00:00:00Z",
) {
  const calls: string[] = []
  const client = {
    auth: {
      admin: {
        async getUserById(userId: string) {
          calls.push(`auth:${userId}`)
          return {
            data: { user: { email, email_confirmed_at: emailConfirmedAt } },
            error: null,
          }
        },
      },
    },
    from(table: string) {
      calls.push(`from:${table}`)
      if (table === "personal_plan_test_enrollments") {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      async maybeSingle() {
                        return { data: null, error: null }
                      },
                    }
                  },
                }
              },
            }
          },
        }
      }
      return {
        select(columns: "is_admin") {
          calls.push(`select:${columns}`)
          return {
            eq(column: "id", value: string) {
              calls.push(`eq:${column}:${value}`)
              return {
                async maybeSingle() {
                  return { data: { is_admin: isAdmin }, error: null }
                },
              }
            },
          }
        },
      }
    },
  }
  return { client, calls }
}

test("released Personal Plan access no longer reads internal rollout state", async () => {
  const customer = profileClient(false)
  assert.equal(
    await isPersonalPlanAppV1AllowedForUser("customer-1", customer.client as never),
    true,
  )
  assert.deepEqual(customer.calls, [])
})
