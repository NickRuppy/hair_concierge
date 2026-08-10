import assert from "node:assert/strict"
import test from "node:test"

import {
  isActivePersonalPlanFieldTestOwner,
  isPersonalPlanAppV1AllowedForUser,
} from "../src/lib/personal-plan/rollout-access"

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
    assert.equal(await isPersonalPlanAppV1AllowedForUser("nick-1", internal.client as never), true)
    assert.equal(
      await isPersonalPlanAppV1AllowedForUser("customer-1", customer.client as never),
      false,
    )
    assert.equal(
      await isPersonalPlanAppV1AllowedForUser("fresh-1", freshTestAccount.client as never),
      true,
    )
    assert.equal(
      await isPersonalPlanAppV1AllowedForUser(
        "unconfirmed-1",
        unconfirmedTestAccount.client as never,
      ),
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

test("an active tester grant admits a field-test owner without an email allowlist", async () => {
  const client = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    async maybeSingle() {
                      return {
                        data: {
                          id: "enrollment-1",
                          user_id: "guest-1",
                          status: "active",
                          expires_at: "2026-08-17T12:00:00.000Z",
                          revoked_at: null,
                          manual_access_grant_id: "grant-1",
                          manual_access_grants: {
                            id: "grant-1",
                            user_id: "guest-1",
                            reason: "tester",
                            expires_at: "2026-08-17T12:00:00.000Z",
                            revoked_at: null,
                          },
                        },
                        error: null,
                      }
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  }

  assert.equal(
    await isActivePersonalPlanFieldTestOwner(
      "guest-1",
      client as never,
      new Date("2026-08-10T12:00:00.000Z"),
    ),
    true,
  )
})

test("an unapplied field-test relation is not an internal-owner signal", async () => {
  const client = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    async maybeSingle() {
                      return {
                        data: null,
                        error: {
                          code: "42P01",
                          message: 'relation "personal_plan_test_enrollments" does not exist',
                        },
                      }
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  }

  assert.equal(await isActivePersonalPlanFieldTestOwner("user-1", client as never), false)
})

test("field-test owner reads still fail closed on unrelated database errors", async () => {
  const client = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    async maybeSingle() {
                      return {
                        data: null,
                        error: { code: "XX000", message: "database unavailable" },
                      }
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  }

  await assert.rejects(
    isActivePersonalPlanFieldTestOwner("user-1", client as never),
    (error: unknown) =>
      typeof error === "object" && error !== null && "code" in error && error.code === "XX000",
  )
})
