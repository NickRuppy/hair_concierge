import { expect, test } from "@playwright/test"
import { handleCheckoutSessionCompleted } from "../src/lib/stripe/webhook-handlers"

function stubDeps() {
  const calls: any[] = []
  const users: Record<string, { id: string; email: string }> = {}
  const profiles: Record<string, any> = {}

  return {
    calls,
    users,
    profiles,
    deps: {
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
              current_period_end: 1_800_000_000,
              items: { data: [{ price: { interval: "month", interval_count: 1 } }] },
            } as any
          },
        },
      } as any,
      premiumTierId: "tier-premium",
    },
  }
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
