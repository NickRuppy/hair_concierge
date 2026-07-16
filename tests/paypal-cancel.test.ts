import assert from "node:assert/strict"
import test from "node:test"
import { handleCancelPayPalSubscription } from "../src/app/api/paypal/cancel-subscription/route"
import {
  findVisibleBillingSubscriptionForUser,
  findCurrentBillingSubscriptionForUser,
} from "../src/lib/billing/subscriptions"
import type { BillingSubscriptionRow } from "../src/lib/billing/types"

function futureIso() {
  return new Date(Date.now() + 86_400_000).toISOString()
}

function pastIso() {
  return new Date(Date.now() - 86_400_000).toISOString()
}

function createSupabaseStub(options: {
  user?: { id: string } | null
  billing?: Partial<BillingSubscriptionRow>[]
  profiles?: Record<string, Record<string, unknown>>
}) {
  const calls: Array<Record<string, unknown>> = []
  const profiles = options.profiles ?? {}
  const billing: BillingSubscriptionRow[] = (options.billing ?? []).map((row, index) => ({
    id: row.id ?? `billing-${index + 1}`,
    user_id: row.user_id ?? "user-1",
    provider: row.provider ?? "paypal",
    provider_customer_id: row.provider_customer_id ?? "payer-1",
    provider_subscriber_email: row.provider_subscriber_email ?? null,
    provider_subscription_id: row.provider_subscription_id ?? `I-${index + 1}`,
    provider_status: row.provider_status ?? "ACTIVE",
    entitlement_status: row.entitlement_status ?? "active",
    interval: row.interval ?? "month",
    current_period_end: row.current_period_end ?? futureIso(),
    cancel_at_period_end: row.cancel_at_period_end ?? false,
    cancel_scheduled_at: row.cancel_scheduled_at ?? null,
    cancelled_at: row.cancelled_at ?? null,
    metadata: row.metadata ?? {},
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  }))

  function makeQuery(table: string) {
    const state: {
      op?: "update"
      patch?: Record<string, unknown>
      filters: Array<{ column: string; value: unknown; op: "eq" | "in" }>
      order?: { column: string; ascending: boolean }
      limit?: number
    } = { filters: [] }

    function rows() {
      if (table === "billing_subscriptions") return billing
      if (table === "profiles") return Object.values(profiles)
      if (table === "subscription_tiers") {
        return [
          { id: "tier-premium", slug: "premium" },
          { id: "tier-free", slug: "free" },
        ]
      }
      return []
    }

    function applyFilters(input: Record<string, unknown>[]) {
      return input.filter((row) =>
        state.filters.every((filter) => {
          if (filter.op === "eq") return row[filter.column] === filter.value
          if (filter.op === "in") return (filter.value as unknown[]).includes(row[filter.column])
          return false
        }),
      )
    }

    function sorted(input: Record<string, unknown>[]) {
      if (!state.order) return input
      return [...input].sort((left, right) => {
        const leftValue = String(left[state.order!.column] ?? "")
        const rightValue = String(right[state.order!.column] ?? "")
        if (leftValue === rightValue) return 0
        return leftValue > rightValue === state.order!.ascending ? 1 : -1
      })
    }

    async function resolveRows() {
      let result = sorted(applyFilters(rows() as Record<string, unknown>[]))
      if (typeof state.limit === "number") result = result.slice(0, state.limit)
      return { data: result, error: null }
    }

    const builder = {
      select() {
        return builder
      },
      eq(column: string, value: unknown) {
        state.filters.push({ column, value, op: "eq" })
        if (state.op === "update") {
          const matched = applyFilters(rows() as Record<string, unknown>[])
          for (const row of matched) Object.assign(row, state.patch)
          calls.push({ table, op: "update", patch: state.patch, filters: state.filters })
          return Promise.resolve({ data: matched, error: null })
        }
        return builder
      },
      in(column: string, value: unknown[]) {
        state.filters.push({ column, value, op: "in" })
        return builder
      },
      order(column: string, options: { ascending?: boolean } = {}) {
        state.order = { column, ascending: options.ascending !== false }
        return builder
      },
      limit(count: number) {
        state.limit = count
        return builder
      },
      maybeSingle: async () => {
        const { data } = await resolveRows()
        return { data: data[0] ?? null, error: null }
      },
      upsert(row: Record<string, unknown>) {
        calls.push({ table, op: "upsert", row })
        const existing = billing.find(
          (candidate) =>
            candidate.provider === row.provider &&
            candidate.provider_subscription_id === row.provider_subscription_id,
        )
        if (existing) Object.assign(existing, row)
        return {
          error: null,
          select: () => ({
            single: async () => ({ data: existing ?? row, error: null }),
          }),
        }
      },
      update(patch: Record<string, unknown>) {
        state.op = "update"
        state.patch = patch
        return builder
      },
      then(resolve: (value: unknown) => void, reject: (error: unknown) => void) {
        resolveRows().then(resolve, reject)
      },
    }

    return builder
  }

  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: options.user ?? null }, error: null }),
    },
    from: makeQuery,
  } as any

  return { calls, billing, profiles, supabase }
}

test("PayPal cancellation returns 401 for unauthenticated users", async () => {
  const { supabase } = createSupabaseStub({ user: null })

  const response = await handleCancelPayPalSubscription({
    authSupabase: supabase,
    billingSupabase: supabase,
    cancelPayPalSubscription: async () => {},
    getTierIds: async () => ({ premiumTierId: "tier-premium", freeTierId: "tier-free" }),
  })

  assert.equal(response.status, 401)
})

test("PayPal cancellation rejects Stripe subscriptions", async () => {
  const { supabase } = createSupabaseStub({
    user: { id: "user-1" },
    billing: [{ user_id: "user-1", provider: "stripe", provider_subscription_id: "sub-1" }],
  })

  const response = await handleCancelPayPalSubscription({
    authSupabase: supabase,
    billingSupabase: supabase,
    cancelPayPalSubscription: async () => {
      throw new Error("should not call PayPal")
    },
    getTierIds: async () => ({ premiumTierId: "tier-premium", freeTierId: "tier-free" }),
  })

  assert.equal(response.status, 409)
  assert.deepEqual(response.body, { error: "not_paypal_subscription" })
})

test("PayPal cancellation calls PayPal and keeps future paid-through access active", async () => {
  const periodEnd = futureIso()
  const cancelled: string[] = []
  const { supabase, billing, profiles } = createSupabaseStub({
    user: { id: "user-1" },
    billing: [
      { user_id: "user-1", provider_subscription_id: "I-cancel", current_period_end: periodEnd },
    ],
    profiles: { "user-1": { id: "user-1", subscription_status: "active" } },
  })

  const response = await handleCancelPayPalSubscription({
    authSupabase: supabase,
    billingSupabase: supabase,
    cancelPayPalSubscription: async (subscriptionId, reason) => {
      cancelled.push(`${subscriptionId}:${reason}`)
    },
    getTierIds: async () => ({ premiumTierId: "tier-premium", freeTierId: "tier-free" }),
    now: () => new Date("2026-05-27T10:00:00.000Z"),
  })

  assert.equal(response.status, 200)
  assert.equal(cancelled[0], "I-cancel:User requested cancellation in Chaarlie")
  assert.equal(billing[0].provider_status, "CANCELLED")
  assert.equal(billing[0].entitlement_status, "canceled")
  assert.equal(billing[0].cancel_at_period_end, true)
  assert.equal(billing[0].cancel_scheduled_at, periodEnd)
  assert.equal(billing[0].cancelled_at, "2026-05-27T10:00:00.000Z")
  assert.equal(profiles["user-1"].subscription_status, "active")
  assert.equal(profiles["user-1"].subscription_tier_id, "tier-premium")
})

test("expired paid-through PayPal cancellation downgrades to Free", async () => {
  const { supabase, profiles } = createSupabaseStub({
    user: { id: "user-1" },
    billing: [
      { user_id: "user-1", provider_subscription_id: "I-expired", current_period_end: pastIso() },
    ],
    profiles: { "user-1": { id: "user-1", subscription_status: "active" } },
  })

  const response = await handleCancelPayPalSubscription({
    authSupabase: supabase,
    billingSupabase: supabase,
    cancelPayPalSubscription: async () => {},
    getTierIds: async () => ({ premiumTierId: "tier-premium", freeTierId: "tier-free" }),
  })

  assert.equal(response.status, 200)
  assert.equal(profiles["user-1"].subscription_status, "canceled")
  assert.equal(profiles["user-1"].subscription_tier_id, "tier-free")
})

test("profile provider query returns the visible provider subscription", async () => {
  const { supabase } = createSupabaseStub({
    user: { id: "user-1" },
    billing: [
      {
        user_id: "user-1",
        provider: "paypal",
        provider_subscription_id: "I-current",
        entitlement_status: "canceled",
        current_period_end: futureIso(),
        cancel_at_period_end: true,
      },
      {
        user_id: "user-1",
        provider: "stripe",
        provider_subscription_id: "sub-old",
        entitlement_status: "incomplete",
        current_period_end: futureIso(),
      },
    ],
  })

  const visible = await findVisibleBillingSubscriptionForUser(supabase, "user-1")
  const current = await findCurrentBillingSubscriptionForUser(supabase, "user-1")

  assert.equal(visible?.provider, "paypal")
  assert.equal(current?.provider, "paypal")
})

test("profile provider query ignores expired canceled billing rows", async () => {
  const { supabase } = createSupabaseStub({
    user: { id: "user-1" },
    billing: [
      {
        user_id: "user-1",
        provider: "paypal",
        provider_subscription_id: "I-expired",
        entitlement_status: "canceled",
        current_period_end: pastIso(),
        cancel_at_period_end: true,
      },
    ],
  })

  const visible = await findVisibleBillingSubscriptionForUser(supabase, "user-1")

  assert.equal(visible, null)
})
