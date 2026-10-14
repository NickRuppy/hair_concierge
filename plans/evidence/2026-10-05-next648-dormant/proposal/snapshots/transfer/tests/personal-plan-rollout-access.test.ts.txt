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

test("released Personal Plan access no longer reads internal rollout state", async () => {
  const customer = profileClient(false)
  assert.equal(
    await isPersonalPlanAppV1AllowedForUser("customer-1", customer.client as never),
    true,
  )
  assert.deepEqual(customer.calls, [])
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

test("an active regular-quiz tester grant is also an internal field-test owner", async () => {
  const queriedTables: string[] = []
  const enrollment = {
    id: "regular-enrollment-1",
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
  }
  const client = {
    from(table: string) {
      queriedTables.push(table)
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    async maybeSingle() {
                      return {
                        data: table === "regular_quiz_test_enrollments" ? enrollment : null,
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
  assert.deepEqual(queriedTables, [
    "personal_plan_test_enrollments",
    "regular_quiz_test_enrollments",
  ])
})

test("an unapplied field-test relation is not an internal-owner signal", async () => {
  const client = {
    from(table: string) {
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
                          message: `relation "${table}" does not exist`,
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
