import { createHash } from "node:crypto"
import { expect, test } from "@playwright/test"
import type { HandlerDeps } from "../src/lib/stripe/webhook-handlers"
import {
  ensureCheckoutAccount,
  verifyCheckoutSessionForActivation,
} from "../src/lib/stripe/checkout-activation"
import { MODERATOR_RESET_CUTOFF_KEY } from "../src/lib/billing/moderator-reset-cutoff"

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

function claimedPreparationMetadata(overrides: Record<string, string> = {}) {
  return {
    checkout_preparation_id: "c2a89c81-7e93-4d81-98d1-c7cfd7047721",
    checkout_preparation_status: "claimed",
    checkout_attempt_id: "65b32f4a-6f32-4c0d-b311-84beab8e0fc3",
    checkout_funnel_event_id: "6f6cf50f-51e4-4318-a17e-c13a1eb669c4",
    ...overrides,
  }
}

function sessionHash(sessionId: string) {
  return createHash("sha256").update(sessionId).digest("hex")
}

function stripeForCheckoutActivation(options: {
  session?: Record<string, unknown>
  default_payment_method?: unknown
}) {
  return {
    checkout: {
      sessions: {
        async retrieve(id: string) {
          return checkoutSession({
            id,
            payment_status: "unpaid",
            ...options.session,
          })
        },
      },
    },
    subscriptions: {
      async retrieve(id: string) {
        return {
          id,
          status: "active",
          default_payment_method: options.default_payment_method,
          items: {
            data: [
              {
                price: { recurring: { interval: "month", interval_count: 1 } },
                current_period_end: 1_800_000_000,
              },
            ],
          },
        }
      },
    },
  } as any
}

function stubDeps() {
  const calls: any[] = []
  const users: Record<
    string,
    { id: string; email: string; app_metadata?: Record<string, unknown> }
  > = {}
  const profiles: Record<string, any> = {}
  const billing: any[] = []
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
        const filters: Array<[string, string]> = []
        const rows = () => {
          if (table === "profiles") return Object.values(profiles)
          if (table === "billing_subscriptions") return billing
          return Object.values(users)
        }
        const builder = {
          select() {
            return builder
          },
          eq(col: string, val: string) {
            calls.push([`select-${table}-${col}`, val])
            filters.push([col, val])
            return builder
          },
          async maybeSingle() {
            const row = rows().find((candidate: any) =>
              filters.every(([col, val]) => candidate[col] === val),
            )
            return { data: row ?? null, error: null }
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
            } else if (table === "billing_subscriptions") {
              const existing = billing.find(
                (candidate) =>
                  candidate.provider === row.provider &&
                  candidate.provider_subscription_id === row.provider_subscription_id,
              )
              if (existing) Object.assign(existing, row)
              else billing.push(row)
            }
            return {
              error: null,
              select: () => ({
                single: async () => ({
                  data:
                    table === "billing_subscriptions"
                      ? billing.find(
                          (candidate) =>
                            candidate.provider === row.provider &&
                            candidate.provider_subscription_id === row.provider_subscription_id,
                        )
                      : row,
                  error: null,
                }),
              }),
            }
          },
          insert(row: any) {
            calls.push([`insert-${table}`, row])
            if (table === "billing_subscriptions") billing.push(row)
            return Promise.resolve({ error: null })
          },
        }
        return builder
      },
    } as any,
    stripe: {
      subscriptions: {
        async retrieve(id: string) {
          return {
            id,
            status: "active",
            default_payment_method: { id: "pm_card", type: "card" },
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

  return { calls, users, profiles, billing, duplicateEmails, deps }
}

test("ensureCheckoutAccount creates a fresh paid user with hashed checkout activation metadata", async () => {
  const { deps, calls, profiles } = stubDeps()
  const session = checkoutSession()

  const result = await ensureCheckoutAccount(session, deps)

  expect(result).toMatchObject({
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

  expect(result).toMatchObject({
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

  expect(result).toMatchObject({
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

  expect(result).toMatchObject({
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

  expect(result).toMatchObject({
    userId: "user-by-customer",
    email: "newer@example.com",
    canSetInitialPassword: false,
  })
  expect(calls.some(([op]) => op === "createUser")).toBe(false)
  expect(profiles["user-by-customer"].stripe_subscription_id).toBe("sub_customer")
})

test("ensureCheckoutAccount rejects conflicting email and Stripe customer profiles before writes", async () => {
  const { deps, calls, profiles } = stubDeps()
  profiles["user-email"] = { id: "user-email", email: "email@example.com" }
  profiles["user-customer"] = {
    id: "user-customer",
    email: "customer@example.com",
    stripe_customer_id: "cus_conflict",
  }

  await expect(
    ensureCheckoutAccount(
      checkoutSession({
        customer: "cus_conflict",
        customer_details: { email: "email@example.com" },
      }),
      deps,
    ),
  ).rejects.toMatchObject({ code: "checkout_ownership_conflict" })
  expect(calls.some(([operation]) => /^(createUser|upsert-|update-)/.test(operation))).toBe(false)
})

test("ensureCheckoutAccount pins an existing Stripe subscription to its billing owner", async () => {
  const { deps, calls, profiles, billing } = stubDeps()
  profiles["user-owner"] = {
    id: "user-owner",
    email: "owner@example.com",
    stripe_customer_id: "cus_owner",
  }
  profiles["user-email"] = { id: "user-email", email: "email@example.com" }
  billing.push({
    id: "billing-owner",
    provider: "stripe",
    provider_subscription_id: "sub_test_123",
    user_id: "user-owner",
  })

  await expect(
    ensureCheckoutAccount(
      checkoutSession({ customer: "cus_owner", customer_details: { email: "email@example.com" } }),
      deps,
    ),
  ).rejects.toMatchObject({ code: "checkout_ownership_conflict" })
  expect(calls.some(([operation]) => /^(createUser|upsert-|update-)/.test(operation))).toBe(false)
})

test("ensureCheckoutAccount rejects marked owner callbacks at or before the reset cutoff", async () => {
  const { deps, calls, profiles, users } = stubDeps()
  users["marked@example.com"] = {
    id: "user-marked",
    email: "marked@example.com",
    app_metadata: { [MODERATOR_RESET_CUTOFF_KEY]: "2026-08-27T12:00:00.000Z" },
  }
  profiles["user-marked"] = {
    id: "user-marked",
    email: "marked@example.com",
    stripe_customer_id: "cus_marked",
  }
  deps.stripe.subscriptions.retrieve = async (id: string) =>
    ({
      id,
      created: 1787832000,
      status: "active",
      items: {
        data: [
          {
            price: { recurring: { interval: "month", interval_count: 1 } },
            current_period_end: 1_800_000_000,
          },
        ],
      },
    }) as any

  await expect(
    ensureCheckoutAccount(
      checkoutSession({
        customer: "cus_marked",
        customer_details: { email: "marked@example.com" },
        created: 1787832000,
      }),
      deps,
    ),
  ).rejects.toMatchObject({ code: "checkout_moderator_reset_cutoff" })
  expect(calls.some(([operation]) => /^(upsert-|update-)/.test(operation))).toBe(false)
})

test("ensureCheckoutAccount permits a marked owner only for fresh session and subscription timestamps", async () => {
  const { deps, profiles, users } = stubDeps()
  users["fresh@example.com"] = {
    id: "user-fresh",
    email: "fresh@example.com",
    app_metadata: { [MODERATOR_RESET_CUTOFF_KEY]: "2026-08-27T12:00:00.000Z" },
  }
  profiles["user-fresh"] = {
    id: "user-fresh",
    email: "fresh@example.com",
    stripe_customer_id: "cus_fresh",
  }
  deps.stripe.subscriptions.retrieve = async (id: string) =>
    ({
      id,
      created: 1787832001,
      status: "active",
      items: {
        data: [
          {
            price: { recurring: { interval: "month", interval_count: 1 } },
            current_period_end: 1_800_000_000,
          },
        ],
      },
    }) as any

  await expect(
    ensureCheckoutAccount(
      checkoutSession({
        customer: "cus_fresh",
        customer_details: { email: "fresh@example.com" },
        created: 1787832001,
      }),
      deps,
    ),
  ).resolves.toMatchObject({ userId: "user-fresh" })
  expect(profiles["user-fresh"].subscription_status).toBe("active")
})

test("ensureCheckoutAccount fails closed for marked owners with missing Stripe creation timestamps", async () => {
  const { deps, calls, profiles, users } = stubDeps()
  users["missing-time@example.com"] = {
    id: "user-missing-time",
    email: "missing-time@example.com",
    app_metadata: { [MODERATOR_RESET_CUTOFF_KEY]: "2026-08-27T12:00:00.000Z" },
  }
  profiles["user-missing-time"] = {
    id: "user-missing-time",
    email: "missing-time@example.com",
    stripe_customer_id: "cus_missing_time",
  }

  await expect(
    ensureCheckoutAccount(
      checkoutSession({
        customer: "cus_missing_time",
        customer_details: { email: "missing-time@example.com" },
        created: 1787832001,
      }),
      deps,
    ),
  ).rejects.toMatchObject({ code: "checkout_moderator_reset_cutoff" })
  expect(calls.some(([operation]) => /^(upsert-|update-)/.test(operation))).toBe(false)
})

test("ensureCheckoutAccount fails closed when current Auth metadata cannot be read", async () => {
  const { deps, calls, profiles, users } = stubDeps()
  users["auth-error@example.com"] = {
    id: "user-auth-error",
    email: "auth-error@example.com",
    app_metadata: {},
  }
  profiles["user-auth-error"] = { id: "user-auth-error", email: "auth-error@example.com" }
  deps.supabase.auth.admin.getUserById = async () =>
    ({
      data: { user: null },
      error: { message: "temporary auth failure" },
    }) as any

  await expect(
    ensureCheckoutAccount(
      checkoutSession({ customer_details: { email: "auth-error@example.com" } }),
      deps,
    ),
  ).rejects.toThrow(/getUserById failed/)
  expect(calls.some(([operation]) => /^(upsert-|update-)/.test(operation))).toBe(false)
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
  const { deps, duplicateEmails, profiles, users } = stubDeps()
  duplicateEmails.add("race@example.com")
  users["race@example.com"] = {
    id: "user-race",
    email: "race@example.com",
    app_metadata: {},
  }

  const result = await ensureCheckoutAccount(
    checkoutSession({
      id: "cs_race",
      customer: "cus_race",
      customer_details: { email: "race@example.com" },
      subscription: "sub_race",
    }),
    deps,
  )

  expect(result).toMatchObject({
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

  expect(result).toMatchObject({
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

  expect(result).toMatchObject({
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

test("ensureCheckoutAccount can defer quiz profile linking until after the account is active", async () => {
  const { deps, profiles } = stubDeps()
  const linkCalls: Array<[string, string | undefined, string | undefined]> = []
  const deferred: { work?: () => void | Promise<void> } = {}

  deps.linkQuizToProfile = async (userId, email, leadId) => {
    linkCalls.push([userId, email, leadId])
  }
  deps.profileLinkMode = "defer"
  deps.defer = (work) => {
    deferred.work = work
  }

  const result = await ensureCheckoutAccount(
    checkoutSession({ metadata: { lead_id: "lead-deferred" } }),
    deps,
  )

  expect(result).toMatchObject({ userId: "user-1", canSetInitialPassword: true })
  expect(profiles["user-1"].subscription_status).toBe("active")
  expect(linkCalls).toHaveLength(0)

  expect(deferred.work).toBeDefined()
  await deferred.work?.()
  expect(linkCalls).toEqual([["user-1", "new@example.com", "lead-deferred"]])
})

test("ensureCheckoutAccount rejects inactive checkout subscriptions", async () => {
  const { deps, profiles } = stubDeps()
  deps.stripe.subscriptions.retrieve = async (id: string) =>
    ({
      id,
      status: "canceled",
      items: {
        data: [
          {
            price: { recurring: { interval: "month", interval_count: 1 } },
            current_period_end: 1_800_000_000,
          },
        ],
      },
    }) as any

  await expect(ensureCheckoutAccount(checkoutSession(), deps)).rejects.toMatchObject({
    code: "checkout_subscription_inactive",
  })
  expect(Object.values(profiles)).toHaveLength(0)
})

test("ensureCheckoutAccount rejects expired checkout subscriptions", async () => {
  const { deps, profiles } = stubDeps()
  deps.now = () => new Date("2026-05-05T10:00:00.000Z")
  deps.stripe.subscriptions.retrieve = async (id: string) =>
    ({
      id,
      status: "active",
      items: {
        data: [
          {
            price: { recurring: { interval: "month", interval_count: 1 } },
            current_period_end: 1_700_000_000,
          },
        ],
      },
    }) as any

  await expect(ensureCheckoutAccount(checkoutSession(), deps)).rejects.toMatchObject({
    code: "checkout_subscription_expired",
  })
  expect(Object.values(profiles)).toHaveLength(0)
})

test("@ci ensureCheckoutAccount rejects an unclaimed prepared checkout before activation", async () => {
  const { deps, calls, profiles } = stubDeps()

  await expect(
    ensureCheckoutAccount(
      checkoutSession({
        metadata: {
          ...claimedPreparationMetadata(),
          checkout_preparation_status: "prepared",
        },
      }),
      deps,
    ),
  ).rejects.toMatchObject({ code: "checkout_preparation_unclaimed" })

  expect(calls).toHaveLength(0)
  expect(Object.values(profiles)).toHaveLength(0)
})

test("@ci ensureCheckoutAccount activates a claimed prepared checkout with valid identifiers", async () => {
  const { deps, profiles } = stubDeps()

  await expect(
    ensureCheckoutAccount(checkoutSession({ metadata: claimedPreparationMetadata() }), deps),
  ).resolves.toMatchObject({ userId: "user-1", canSetInitialPassword: true })

  expect(profiles["user-1"].subscription_status).toBe("active")
})

test("@ci ensureCheckoutAccount rejects a claimed prepared checkout with an invalid identifier", async () => {
  const { deps } = stubDeps()

  await expect(
    ensureCheckoutAccount(
      checkoutSession({
        metadata: claimedPreparationMetadata({ checkout_attempt_id: "attempt-not-a-uuid" }),
      }),
      deps,
    ),
  ).rejects.toMatchObject({ code: "checkout_preparation_unclaimed" })
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

test("verifyCheckoutSessionForActivation accepts a server-retrieved paid one-time session without a Stripe customer", async () => {
  const previousPrice = process.env.STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE
  process.env.STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE = "price_once"
  const session = {
    id: "cs_once_customerless",
    status: "complete",
    mode: "payment",
    payment_status: "paid",
    amount_total: 2999,
    currency: "eur",
    customer: null,
    customer_details: { email: "paid-once@example.com" },
    payment_intent: {
      id: "pi_once_customerless",
      created: 1_754_000_000,
      latest_charge: { id: "ch_once_customerless", created: 1_754_000_123 },
    },
    line_items: { data: [{ price: { id: "price_once" } }] },
    metadata: {
      product_kind: "personal_plan_once",
      personal_plan_once_consent_id: "0f762541-b540-4d26-8328-28d79737d39c",
      lead_id: "11111111-1111-4111-8111-111111111111",
      funnel_session_id: "22222222-2222-4222-8222-222222222222",
      checkout_preparation_id: "c2a89c81-7e93-4d81-98d1-c7cfd7047721",
      checkout_preparation_status: "claimed",
      checkout_attempt_id: "65b32f4a-6f32-4c0d-b311-84beab8e0fc3",
      checkout_funnel_event_id: "6f6cf50f-51e4-4318-a17e-c13a1eb669c4",
    },
  }
  const stripe = {
    checkout: { sessions: { retrieve: async () => session } },
  } as any

  try {
    await expect(
      verifyCheckoutSessionForActivation("cs_once_customerless", stripe),
    ).resolves.toMatchObject({
      id: "cs_once_customerless",
      customer: null,
      payment_status: "paid",
    })
  } finally {
    if (previousPrice === undefined) delete process.env.STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE
    else process.env.STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE = previousPrice
  }
})

test("@ci verifyCheckoutSessionForActivation rejects an unclaimed prepared checkout", async () => {
  const stripe = {
    checkout: {
      sessions: {
        async retrieve(id: string) {
          return checkoutSession({
            id,
            metadata: {
              ...claimedPreparationMetadata(),
              checkout_preparation_status: "prepared",
            },
          })
        },
      },
    },
  } as any

  await expect(
    verifyCheckoutSessionForActivation("cs_unclaimed_prepared", stripe),
  ).rejects.toMatchObject({ code: "checkout_preparation_unclaimed" })
})

test("verifyCheckoutSessionForActivation accepts complete sessions with no payment required", async () => {
  const stripe = {
    checkout: {
      sessions: {
        async retrieve(id: string) {
          return checkoutSession({
            id,
            payment_status: "no_payment_required",
          })
        },
      },
    },
  } as any

  await expect(verifyCheckoutSessionForActivation("cs_free", stripe)).resolves.toMatchObject({
    id: "cs_free",
    payment_status: "no_payment_required",
  })
})

test("verifyCheckoutSessionForActivation rejects incomplete sessions", async () => {
  const stripe = {
    checkout: {
      sessions: {
        async retrieve(id: string) {
          return checkoutSession({ id, status: "open" })
        },
      },
    },
  } as any

  await expect(verifyCheckoutSessionForActivation("cs_open", stripe)).rejects.toMatchObject({
    code: "checkout_session_incomplete",
  })
})

test("verifyCheckoutSessionForActivation rejects complete unpaid sessions even if subscription default payment method is SEPA", async () => {
  const stripe = stripeForCheckoutActivation({
    default_payment_method: { id: "pm_sepa", type: "sepa_debit" },
  })

  await expect(verifyCheckoutSessionForActivation("cs_unpaid_sepa", stripe)).rejects.toMatchObject({
    code: "checkout_session_unpaid",
  })
})

test("verifyCheckoutSessionForActivation rejects complete unpaid sessions even if subscription default payment method is card", async () => {
  const stripe = stripeForCheckoutActivation({
    default_payment_method: { id: "pm_card", type: "card" },
  })

  await expect(verifyCheckoutSessionForActivation("cs_unpaid_card", stripe)).rejects.toMatchObject({
    code: "checkout_session_unpaid",
  })
})

test("verifyCheckoutSessionForActivation rejects complete unpaid sessions even if SEPA was offered", async () => {
  const stripe = stripeForCheckoutActivation({
    session: { payment_method_types: ["card", "sepa_debit"] },
    default_payment_method: { id: "pm_card", type: "card" },
  })

  await expect(
    verifyCheckoutSessionForActivation("cs_unpaid_offered_sepa", stripe),
  ).rejects.toMatchObject({
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
