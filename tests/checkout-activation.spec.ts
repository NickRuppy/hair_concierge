import { createHash } from "node:crypto"
import { expect, test } from "@playwright/test"
import type { HandlerDeps } from "../src/lib/stripe/webhook-handlers"
import {
  ensureCheckoutAccount,
  verifyCheckoutSessionForActivation,
} from "../src/lib/stripe/checkout-activation"

function checkoutSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_test_123",
    status: "complete",
    payment_status: "paid",
    customer: "cus_test_123",
    customer_details: { email: "new@example.com" },
    subscription: "sub_test_123",
    metadata: {},
    ...overrides,
  } as any
}

function sessionHash(sessionId: string) {
  return createHash("sha256").update(sessionId).digest("hex")
}

function stubDeps() {
  const calls: any[] = []
  const users: Record<
    string,
    { id: string; email: string; app_metadata?: Record<string, unknown> }
  > = {}
  const profiles: Record<string, any> = {}
  const duplicateEmails = new Set<string>()

  const deps: HandlerDeps = {
    supabase: {
      auth: {
        admin: {
          async createUser(args: {
            email: string
            email_confirm: boolean
            app_metadata?: Record<string, unknown>
          }) {
            calls.push(["createUser", args])
            const emailKey = args.email.toLowerCase()
            if (duplicateEmails.has(emailKey)) {
              const existingUser = users[emailKey]
              const id = existingUser?.id ?? "user-race"
              profiles[id] = {
                id,
                email: args.email,
                subscription_status: null,
              }
              return {
                data: { user: null },
                error: { message: "User already registered", status: 422, code: "email_exists" },
              }
            }

            const id = `user-${Object.keys(users).length + 1}`
            users[emailKey] = { id, email: args.email, app_metadata: args.app_metadata }
            profiles[id] = { id, email: args.email, subscription_status: null }
            return { data: { user: users[emailKey] }, error: null }
          },
          async getUserById(userId: string) {
            calls.push(["getUserById", userId])
            const user = Object.values(users).find((candidate) => candidate.id === userId)
            return { data: { user: user ?? null }, error: null }
          },
        },
      },
      from(table: string) {
        return {
          select() {
            return this
          },
          eq(col: string, val: string) {
            calls.push([`select-${table}-${col}`, val])
            const rows = table === "profiles" ? Object.values(profiles) : Object.values(users)
            const row = rows.find((candidate: any) => candidate[col] === val)
            return { maybeSingle: async () => ({ data: row ?? null, error: null }) }
          },
          update(patch: any) {
            return {
              eq(col: string, val: string) {
                calls.push([`update-${table}`, val, patch])
                const row = Object.values(profiles).find((candidate: any) => candidate[col] === val)
                if (row) Object.assign(row, patch)
                return Promise.resolve({ error: null })
              },
            }
          },
          upsert(row: any) {
            calls.push([`upsert-${table}`, row])
            if (table === "profiles") {
              profiles[row.id] = {
                ...(profiles[row.id] ?? {}),
                ...row,
              }
            }
            return Promise.resolve({ error: null })
          },
        }
      },
    } as any,
    stripe: {
      subscriptions: {
        async retrieve(id: string) {
          return {
            id,
            items: {
              data: [
                {
                  price: { recurring: { interval: "month", interval_count: 1 } },
                  current_period_end: 1_800_000_000,
                },
              ],
            },
          } as any
        },
      },
    } as any,
    premiumTierId: "tier-premium",
  }

  return { calls, users, profiles, duplicateEmails, deps }
}

test("ensureCheckoutAccount creates a fresh paid user with hashed checkout activation metadata", async () => {
  const { deps, calls, profiles } = stubDeps()
  const session = checkoutSession()

  const result = await ensureCheckoutAccount(session, deps)

  expect(result).toEqual({
    userId: "user-1",
    email: "new@example.com",
    canSetInitialPassword: true,
  })

  const createUserCall = calls.find(([op]) => op === "createUser")
  expect(createUserCall?.[1]).toMatchObject({
    email: "new@example.com",
    email_confirm: true,
    app_metadata: {
      checkout_activation_session_hash: sessionHash("cs_test_123"),
    },
  })
  expect(JSON.stringify(createUserCall?.[1])).not.toContain("cs_test_123")
  expect(createUserCall?.[1].app_metadata).not.toHaveProperty("password_initialized_at")

  expect(profiles["user-1"]).toMatchObject({
    email: "new@example.com",
    stripe_customer_id: "cus_test_123",
    stripe_subscription_id: "sub_test_123",
    subscription_status: "active",
    subscription_interval: "month",
    subscription_tier_id: "tier-premium",
  })
})

test("ensureCheckoutAccount reuses an existing email and denies initial password setup", async () => {
  const { deps, calls, profiles, users } = stubDeps()
  users["ret@example.com"] = {
    id: "user-existing",
    email: "ret@example.com",
    app_metadata: { checkout_activation_session_hash: sessionHash("cs_other") },
  }
  profiles["user-existing"] = {
    id: "user-existing",
    email: "ret@example.com",
    subscription_status: null,
  }

  const result = await ensureCheckoutAccount(
    checkoutSession({
      id: "cs_existing",
      customer: "cus_existing",
      customer_details: { email: "ret@example.com" },
      subscription: "sub_existing",
    }),
    deps,
  )

  expect(result).toEqual({
    userId: "user-existing",
    email: "ret@example.com",
    canSetInitialPassword: false,
  })
  expect(calls.some(([op]) => op === "createUser")).toBe(false)
  expect(profiles["user-existing"]).toMatchObject({
    stripe_customer_id: "cus_existing",
    stripe_subscription_id: "sub_existing",
    subscription_status: "active",
  })
})

test("ensureCheckoutAccount allows password setup for an existing checkout-created user with matching activation metadata", async () => {
  const { deps, calls, profiles, users } = stubDeps()
  users["checkout@example.com"] = {
    id: "user-checkout",
    email: "checkout@example.com",
    app_metadata: {
      checkout_activation_session_hash: sessionHash("cs_checkout"),
    },
  }
  profiles["user-checkout"] = {
    id: "user-checkout",
    email: "checkout@example.com",
    subscription_status: null,
  }

  const result = await ensureCheckoutAccount(
    checkoutSession({
      id: "cs_checkout",
      customer: "cus_checkout",
      customer_details: { email: "checkout@example.com" },
      subscription: "sub_checkout",
    }),
    deps,
  )

  expect(result).toEqual({
    userId: "user-checkout",
    email: "checkout@example.com",
    canSetInitialPassword: true,
  })
  expect(calls.some(([op]) => op === "createUser")).toBe(false)
  expect(JSON.stringify(users["checkout@example.com"].app_metadata)).not.toContain("cs_checkout")
})

test("ensureCheckoutAccount denies password setup when the matching activation marker is consumed", async () => {
  const { deps, profiles, users } = stubDeps()
  users["used@example.com"] = {
    id: "user-used",
    email: "used@example.com",
    app_metadata: {
      checkout_activation_session_hash: sessionHash("cs_used"),
      password_initialized_at: "2026-05-04T10:00:00.000Z",
    },
  }
  profiles["user-used"] = {
    id: "user-used",
    email: "used@example.com",
    subscription_status: null,
  }

  const result = await ensureCheckoutAccount(
    checkoutSession({
      id: "cs_used",
      customer: "cus_used",
      customer_details: { email: "used@example.com" },
      subscription: "sub_used",
    }),
    deps,
  )

  expect(result).toEqual({
    userId: "user-used",
    email: "used@example.com",
    canSetInitialPassword: false,
  })
})

test("ensureCheckoutAccount reuses an existing Stripe customer and does not create duplicates", async () => {
  const { deps, calls, profiles, users } = stubDeps()
  users["customer@example.com"] = {
    id: "user-by-customer",
    email: "customer@example.com",
    app_metadata: {},
  }
  profiles["user-by-customer"] = {
    id: "user-by-customer",
    email: "customer@example.com",
    stripe_customer_id: "cus_existing",
    subscription_status: null,
  }

  const result = await ensureCheckoutAccount(
    checkoutSession({
      id: "cs_customer",
      customer: "cus_existing",
      customer_details: { email: "newer@example.com" },
      subscription: "sub_customer",
    }),
    deps,
  )

  expect(result).toEqual({
    userId: "user-by-customer",
    email: "newer@example.com",
    canSetInitialPassword: false,
  })
  expect(calls.some(([op]) => op === "createUser")).toBe(false)
  expect(profiles["user-by-customer"].stripe_subscription_id).toBe("sub_customer")
})

test("ensureCheckoutAccount is idempotent on repeated fulfillment", async () => {
  const { deps, calls, profiles } = stubDeps()
  const session = checkoutSession()

  const first = await ensureCheckoutAccount(session, deps)
  const second = await ensureCheckoutAccount(session, deps)

  expect(first.canSetInitialPassword).toBe(true)
  expect(second.canSetInitialPassword).toBe(true)
  expect(calls.filter(([op]) => op === "createUser")).toHaveLength(1)
  expect(Object.values(profiles).filter((p: any) => p.email === "new@example.com")).toHaveLength(1)
})

test("ensureCheckoutAccount treats duplicate createUser races as an existing account", async () => {
  const { deps, duplicateEmails, profiles } = stubDeps()
  duplicateEmails.add("race@example.com")

  const result = await ensureCheckoutAccount(
    checkoutSession({
      id: "cs_race",
      customer: "cus_race",
      customer_details: { email: "race@example.com" },
      subscription: "sub_race",
    }),
    deps,
  )

  expect(result).toEqual({
    userId: "user-race",
    email: "race@example.com",
    canSetInitialPassword: false,
  })
  expect(profiles["user-race"].subscription_status).toBe("active")
})

test("ensureCheckoutAccount creates a missing profile for duplicate auth users", async () => {
  const { deps, duplicateEmails, profiles, users } = stubDeps()
  duplicateEmails.add("auth-only@example.com")
  users["auth-only@example.com"] = {
    id: "user-auth-only",
    email: "auth-only@example.com",
    app_metadata: {},
  }

  const result = await ensureCheckoutAccount(
    checkoutSession({
      id: "cs_auth_only",
      customer: "cus_auth_only",
      customer_details: { email: "auth-only@example.com" },
      subscription: "sub_auth_only",
    }),
    deps,
  )

  expect(result).toEqual({
    userId: "user-auth-only",
    email: "auth-only@example.com",
    canSetInitialPassword: false,
  })
  expect(profiles["user-auth-only"]).toMatchObject({
    id: "user-auth-only",
    email: "auth-only@example.com",
    stripe_customer_id: "cus_auth_only",
    stripe_subscription_id: "sub_auth_only",
    subscription_status: "active",
  })
})

test("ensureCheckoutAccount denies password setup for duplicate createUser races even with matching activation metadata", async () => {
  const { deps, duplicateEmails, profiles, users } = stubDeps()
  duplicateEmails.add("race-match@example.com")
  users["race-match@example.com"] = {
    id: "user-race-match",
    email: "race-match@example.com",
    app_metadata: {
      checkout_activation_session_hash: sessionHash("cs_race_match"),
    },
  }

  const result = await ensureCheckoutAccount(
    checkoutSession({
      id: "cs_race_match",
      customer: "cus_race_match",
      customer_details: { email: "race-match@example.com" },
      subscription: "sub_race_match",
    }),
    deps,
  )

  expect(result).toEqual({
    userId: "user-race-match",
    email: "race-match@example.com",
    canSetInitialPassword: false,
  })
  expect(profiles["user-race-match"].subscription_status).toBe("active")
})

test("ensureCheckoutAccount still resolves when linkQuizToProfile rejects", async () => {
  const { deps, profiles } = stubDeps()
  deps.linkQuizToProfile = async () => {
    throw new Error("lead lookup failed")
  }

  await expect(
    ensureCheckoutAccount(checkoutSession({ metadata: { lead_id: "lead-1" } }), deps),
  ).resolves.toMatchObject({ userId: "user-1", canSetInitialPassword: true })

  expect(profiles["user-1"].subscription_status).toBe("active")
})

test("verifyCheckoutSessionForActivation returns complete paid sessions", async () => {
  const stripe = {
    checkout: {
      sessions: {
        async retrieve(id: string) {
          return checkoutSession({ id })
        },
      },
    },
  } as any

  await expect(verifyCheckoutSessionForActivation("cs_valid", stripe)).resolves.toMatchObject({
    id: "cs_valid",
    customer_details: { email: "new@example.com" },
  })
})

test("verifyCheckoutSessionForActivation rejects incomplete and unpaid sessions", async () => {
  const stripe = {
    checkout: {
      sessions: {
        async retrieve(id: string) {
          return id === "cs_unpaid"
            ? checkoutSession({ id, payment_status: "unpaid" })
            : checkoutSession({ id, status: "open" })
        },
      },
    },
  } as any

  await expect(verifyCheckoutSessionForActivation("cs_open", stripe)).rejects.toMatchObject({
    code: "checkout_session_incomplete",
  })
  await expect(verifyCheckoutSessionForActivation("cs_unpaid", stripe)).rejects.toMatchObject({
    code: "checkout_session_unpaid",
  })
})

test("verifyCheckoutSessionForActivation rejects missing session id input", async () => {
  await expect(verifyCheckoutSessionForActivation("")).rejects.toMatchObject({
    code: "checkout_session_id_missing",
  })
})

test("verifyCheckoutSessionForActivation rejects returned sessions missing required fields", async () => {
  const sessionsById: Record<string, any> = {
    cs_missing_id: checkoutSession({ id: undefined }),
    cs_missing_email: checkoutSession({ id: "cs_missing_email", customer_details: {} }),
    cs_missing_customer: checkoutSession({ id: "cs_missing_customer", customer: null }),
    cs_missing_subscription: checkoutSession({ id: "cs_missing_subscription", subscription: null }),
  }
  const stripe = {
    checkout: {
      sessions: {
        async retrieve(id: string) {
          return sessionsById[id]
        },
      },
    },
  } as any

  await expect(verifyCheckoutSessionForActivation("cs_missing_id", stripe)).rejects.toMatchObject({
    code: "checkout_session_missing_id",
  })
  await expect(
    verifyCheckoutSessionForActivation("cs_missing_email", stripe),
  ).rejects.toMatchObject({
    code: "checkout_session_email_missing",
  })
  await expect(
    verifyCheckoutSessionForActivation("cs_missing_customer", stripe),
  ).rejects.toMatchObject({
    code: "checkout_session_customer_missing",
  })
  await expect(
    verifyCheckoutSessionForActivation("cs_missing_subscription", stripe),
  ).rejects.toMatchObject({
    code: "checkout_session_subscription_missing",
  })
})
