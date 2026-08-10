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
    from(table: "profiles") {
      calls.push(`from:${table}`)
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

test("internal rollout resolves eligibility from the server-owned admin profile signal", async () => {
  const previousEnabled = process.env.PERSONAL_PLAN_APP_V1_ENABLED
  const previousRollout = process.env.PERSONAL_PLAN_APP_V1_ROLLOUT
  const previousEmails = process.env.PERSONAL_PLAN_APP_V1_INTERNAL_EMAILS
  process.env.PERSONAL_PLAN_APP_V1_ENABLED = "true"
  process.env.PERSONAL_PLAN_APP_V1_ROLLOUT = "internal"
  process.env.PERSONAL_PLAN_APP_V1_INTERNAL_EMAILS = "fresh-plan-test@example.com"

  try {
    const internal = profileClient(true)
    const customer = profileClient(false)
    const freshTestAccount = profileClient(false, "FRESH-PLAN-TEST@EXAMPLE.COM")
    const unconfirmedTestAccount = profileClient(false, "fresh-plan-test@example.com", null)
    assert.equal(await isPersonalPlanAppV1AllowedForUser("nick-1", internal.client), true)
    assert.equal(await isPersonalPlanAppV1AllowedForUser("customer-1", customer.client), false)
    assert.equal(await isPersonalPlanAppV1AllowedForUser("fresh-1", freshTestAccount.client), true)
    assert.equal(
      await isPersonalPlanAppV1AllowedForUser("unconfirmed-1", unconfirmedTestAccount.client),
      false,
    )
    assert.deepEqual(internal.calls, ["from:profiles", "select:is_admin", "eq:id:nick-1"])
  } finally {
    if (previousEnabled === undefined) delete process.env.PERSONAL_PLAN_APP_V1_ENABLED
    else process.env.PERSONAL_PLAN_APP_V1_ENABLED = previousEnabled
    if (previousRollout === undefined) delete process.env.PERSONAL_PLAN_APP_V1_ROLLOUT
    else process.env.PERSONAL_PLAN_APP_V1_ROLLOUT = previousRollout
    if (previousEmails === undefined) delete process.env.PERSONAL_PLAN_APP_V1_INTERNAL_EMAILS
    else process.env.PERSONAL_PLAN_APP_V1_INTERNAL_EMAILS = previousEmails
  }
})
