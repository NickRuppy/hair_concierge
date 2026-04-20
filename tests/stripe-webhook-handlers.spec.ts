import { expect, test } from "@playwright/test"
import {
  handleCheckoutSessionCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed,
  type HandlerDeps,
} from "../src/lib/stripe/webhook-handlers"

function stubDeps() {
  const calls: any[] = []
  const users: Record<string, { id: string; email: string }> = {}
  const profiles: Record<string, any> = {}

  const deps: HandlerDeps = {
    supabase: {
      auth: {
        admin: {
          async createUser({ email }: { email: string }) {
            calls.push(["createUser", email])
            const id = `user-${Object.keys(users).length + 1}`
            users[email] = { id, email }
            profiles[id] = { id, email, subscription_status: null }
            return { data: { user: users[email] }, error: null }
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
            const row =
              table === "profiles"
                ? Object.values(profiles).find((p: any) => p[col] === val)
                : Object.values(users).find((u: any) => u[col] === val)
            return { maybeSingle: async () => ({ data: row ?? null, error: null }) }
          },
          update(patch: any) {
            return {
              eq(col: string, val: string) {
                calls.push([`update-${table}`, val, patch])
                const row = Object.values(profiles).find((p: any) => p[col] === val)
                if (row) Object.assign(row, patch)
                return Promise.resolve({ error: null })
              },
            }
          },
        }
      },
    } as any,
    stripe: {
      subscriptions: {
        async retrieve(_id: string) {
          return {
            id: "sub_1",
            items: {
              data: [
                {
                  price: { interval: "month", interval_count: 1 },
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

  return { calls, users, profiles, deps }
}

test("checkout.session.completed creates a new Supabase user and activates the sub", async () => {
  const { deps, calls, profiles } = stubDeps()
  const session = {
    id: "cs_1",
    customer: "cus_1",
    customer_details: { email: "new@example.com" },
    subscription: "sub_1",
  } as any

  await handleCheckoutSessionCompleted(session, deps)

  expect(calls.some(([op]) => op === "createUser")).toBe(true)
  const p = Object.values(profiles)[0] as any
  expect(p.email).toBe("new@example.com")
  expect(p.subscription_status).toBe("active")
  expect(p.subscription_interval).toBe("month")
  expect(p.stripe_customer_id).toBe("cus_1")
  expect(p.stripe_subscription_id).toBe("sub_1")
  expect(p.subscription_tier_id).toBe("tier-premium")
  expect(p.current_period_end).toBeTruthy()
})

test("checkout.session.completed on existing email reuses the user", async () => {
  const { deps, calls, profiles, users } = stubDeps()
  users["ret@example.com"] = { id: "user-existing", email: "ret@example.com" }
  profiles["user-existing"] = {
    id: "user-existing",
    email: "ret@example.com",
    subscription_status: null,
  }

  const session = {
    id: "cs_2",
    customer: "cus_2",
    customer_details: { email: "ret@example.com" },
    subscription: "sub_2",
  } as any
  await handleCheckoutSessionCompleted(session, deps)

  expect(calls.some(([op]) => op === "createUser")).toBe(false)
  expect((profiles["user-existing"] as any).subscription_status).toBe("active")
})

test("subscription.updated keeps status=active when cancel_at_period_end flips", async () => {
  const { deps, profiles } = stubDeps()
  profiles["u"] = {
    id: "u",
    email: "x@y",
    stripe_customer_id: "cus_X",
    subscription_status: "active",
    subscription_interval: "year",
  }
  const sub = {
    id: "sub_X",
    customer: "cus_X",
    status: "active",
    cancel_at_period_end: true,
    items: {
      data: [
        {
          price: { interval: "year", interval_count: 1 },
          current_period_end: 1_900_000_000,
        },
      ],
    },
  } as any
  await handleSubscriptionUpdated(sub, deps)
  expect((profiles["u"] as any).subscription_status).toBe("active")
  expect((profiles["u"] as any).current_period_end).toBeTruthy()
})

test("subscription.deleted flips profile to canceled + Free tier", async () => {
  const { deps, profiles } = stubDeps()
  profiles["u"] = {
    id: "u",
    stripe_customer_id: "cus_D",
    subscription_status: "active",
    subscription_tier_id: "tier-premium",
  }
  const sub = { id: "sub_D", customer: "cus_D", status: "canceled" } as any
  await handleSubscriptionDeleted(sub, { ...deps, freeTierId: "tier-free" } as any)
  expect((profiles["u"] as any).subscription_status).toBe("canceled")
  expect((profiles["u"] as any).subscription_tier_id).toBe("tier-free")
})

test("invoice.payment_failed logs and returns (no throw)", async () => {
  const invoice = { id: "in_1", customer: "cus_1", attempt_count: 2 } as any
  await handleInvoicePaymentFailed(invoice)
  // no assertion beyond no-throw; log-only for MVP
})

test("checkout.session.completed with metadata.lead_id calls linkQuizToProfile with that id", async () => {
  const { deps } = stubDeps()
  const calls: Array<[string, string | undefined, string | undefined]> = []
  deps.linkQuizToProfile = async (userId, email, leadId) => {
    calls.push([userId, email, leadId])
  }

  const session = {
    id: "cs_lead",
    customer: "cus_lead",
    customer_details: { email: "lead@example.com" },
    subscription: "sub_lead",
    metadata: { lead_id: "lead-xyz" },
  } as any

  await handleCheckoutSessionCompleted(session, deps)

  expect(calls).toHaveLength(1)
  const [calledUserId, calledEmail, calledLeadId] = calls[0]
  expect(calledEmail).toBe("lead@example.com")
  expect(calledLeadId).toBe("lead-xyz")
  expect(typeof calledUserId).toBe("string")
  expect(calledUserId.length).toBeGreaterThan(0)
})

test("checkout.session.completed without metadata calls linkQuizToProfile with undefined leadId", async () => {
  const { deps } = stubDeps()
  const calls: Array<[string, string | undefined, string | undefined]> = []
  deps.linkQuizToProfile = async (userId, email, leadId) => {
    calls.push([userId, email, leadId])
  }

  const session = {
    id: "cs_nolead",
    customer: "cus_nolead",
    customer_details: { email: "nolead@example.com" },
    subscription: "sub_nolead",
    // no metadata
  } as any

  await handleCheckoutSessionCompleted(session, deps)

  expect(calls).toHaveLength(1)
  const [, calledEmail, calledLeadId] = calls[0]
  expect(calledEmail).toBe("nolead@example.com")
  expect(calledLeadId).toBeUndefined()
})

test("checkout.session.completed does not throw when linkQuizToProfile rejects", async () => {
  const { deps, profiles } = stubDeps()
  deps.linkQuizToProfile = async () => {
    throw new Error("lead lookup failed")
  }

  const session = {
    id: "cs_err",
    customer: "cus_err",
    customer_details: { email: "err@example.com" },
    subscription: "sub_err",
    metadata: { lead_id: "lead-err" },
  } as any

  // Should resolve normally despite linkQuizToProfile throwing
  await expect(handleCheckoutSessionCompleted(session, deps)).resolves.toBeUndefined()

  // Profile update still happened
  const p = Object.values(profiles).find((x: any) => x.email === "err@example.com") as any
  expect(p?.subscription_status).toBe("active")
})

test("checkout.session.completed falls back to root current_period_end when item has none", async () => {
  const { deps, profiles } = stubDeps()
  // override stripe.subscriptions.retrieve for this test
  deps.stripe.subscriptions = {
    async retrieve() {
      return {
        id: "sub_root",
        current_period_end: 1_800_000_000,
        items: { data: [{ price: { interval: "month", interval_count: 1 } }] },
      } as any
    },
  } as any
  const session = {
    id: "cs_root",
    customer: "cus_root",
    customer_details: { email: "root@example.com" },
    subscription: "sub_root",
  } as any
  await handleCheckoutSessionCompleted(session, deps)
  const p = Object.values(profiles).find((x: any) => x.email === "root@example.com") as any
  expect(p.current_period_end).toBeTruthy()
  expect(p.subscription_status).toBe("active")
})
