import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"
import {
  assertCanStartCheckout,
  assertCanStartCheckoutForEmail,
  findCurrentManualAccessGrant,
  findCurrentBillingSubscriptionForUser,
  hasCurrentAppAccess,
  hasCurrentManualAccess,
  upsertBillingSubscription,
} from "../src/lib/billing/subscriptions"
import type { SupabaseBillingClient } from "../src/lib/billing/types"
import {
  mirrorBillingSubscriptionToProfile,
  reconcileExpiredBillingEntitlements,
} from "../src/lib/billing/entitlements"
import { claimWebhookEvent } from "../src/lib/billing/webhook-events"
import type { BillingSubscriptionRow } from "../src/lib/billing/types"
import { ensureCheckoutAccount } from "../src/lib/stripe/checkout-activation"
import {
  ensurePayPalCheckoutAccount,
  ensurePayPalCheckoutAccountForToken,
  paypalCheckoutActivationId,
  paypalCheckoutActivationHash,
} from "../src/lib/paypal/checkout-activation"
import {
  bindPayPalCheckoutIntentToSubscription,
  createPayPalCheckoutIntent,
  markPayPalCheckoutIntentDuplicate,
  PayPalCheckoutIntentBindingError,
} from "../src/lib/paypal/checkout-intents"
import {
  cancelAndMarkPayPalDuplicate,
  findPayPalCheckoutDuplicateReason,
} from "../src/lib/paypal/duplicate-guard"
import {
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from "../src/lib/stripe/webhook-handlers"
import {
  POST as createStripeCheckoutSession,
  createStripeCheckoutAccessConflictResponse,
  createStripeCheckoutEmailAccessConflictResponse,
} from "../src/app/api/stripe/create-checkout-session/route"
import { handleBillingReconcile } from "../src/app/api/billing/reconcile/route"
import { EXPECTED_PAYPAL_PLAN_SHAPES, getPayPalPlanId } from "../src/lib/paypal/plans"
import {
  mapPayPalSubscriptionStatus,
  toBillingSubscriptionInputFromPayPal,
  validatePayPalPlanShape,
} from "../src/lib/paypal/subscription-shapes"

function futureIso() {
  return new Date(Date.now() + 86_400_000).toISOString()
}

function pastIso() {
  return new Date(Date.now() - 86_400_000).toISOString()
}

function sqlLikePatternToRegExp(pattern: string) {
  let source = "^"
  for (const char of pattern) {
    if (char === "%") {
      source += ".*"
    } else if (char === "_") {
      source += "."
    } else {
      source += char.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")
    }
  }
  source += "$"
  return new RegExp(source, "i")
}

function createSupabaseStub(seed?: {
  billing?: Partial<BillingSubscriptionRow>[]
  manualGrants?: Array<Record<string, unknown>>
  tableErrors?: Record<string, { code?: string; message: string }>
  profiles?: Record<string, Record<string, unknown>>
  authUsers?: Record<string, { id: string; email: string; app_metadata?: Record<string, unknown> }>
  paypalIntents?: Array<Record<string, unknown>>
}) {
  const calls: Array<Record<string, unknown>> = []
  const tableErrors = seed?.tableErrors ?? {}
  const billing: BillingSubscriptionRow[] = (seed?.billing ?? []).map((row, index) => ({
    id: row.id ?? `billing-${index + 1}`,
    user_id: row.user_id ?? "user-1",
    provider: row.provider ?? "stripe",
    provider_customer_id: row.provider_customer_id ?? null,
    provider_subscriber_email: row.provider_subscriber_email ?? null,
    provider_subscription_id: row.provider_subscription_id ?? `sub-${index + 1}`,
    provider_status: row.provider_status ?? "active",
    entitlement_status: row.entitlement_status ?? "active",
    interval: row.interval ?? "month",
    current_period_end: row.current_period_end ?? futureIso(),
    cancel_at_period_end: row.cancel_at_period_end ?? false,
    cancelled_at: row.cancelled_at ?? null,
    metadata: row.metadata ?? {},
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  }))
  const manualGrants = seed?.manualGrants ?? []
  const profiles = seed?.profiles ?? {}
  const authUsers = seed?.authUsers ?? {}
  const paypalIntents = seed?.paypalIntents ?? []
  const webhookEvents = new Set<string>()

  function makeQuery(table: string) {
    const state: {
      op?: "select" | "upsert" | "update" | "insert"
      select?: string
      patch?: Record<string, unknown>
      order?: { column: string; ascending: boolean }[]
      limit?: number
      filters: Array<{
        column: string
        value: unknown
        op: "eq" | "ilike" | "in" | "lte" | "lt" | "gt" | "is"
      }>
    } = { filters: [] }

    function rows() {
      if (table === "billing_subscriptions") return billing
      if (table === "manual_access_grants") return manualGrants
      if (table === "profiles") return Object.values(profiles)
      if (table === "paypal_checkout_intents") return paypalIntents
      return []
    }

    function applyFilters(input: Record<string, unknown>[]) {
      return input.filter((row) =>
        state.filters.every((filter) => {
          if (filter.op === "eq") return row[filter.column] === filter.value
          if (filter.op === "is") return row[filter.column] === filter.value
          if (filter.op === "ilike") {
            return sqlLikePatternToRegExp(String(filter.value)).test(
              String(row[filter.column] ?? ""),
            )
          }
          if (filter.op === "in") return (filter.value as unknown[]).includes(row[filter.column])
          if (filter.op === "lte") {
            const value = row[filter.column]
            return typeof value === "string" && value <= String(filter.value)
          }
          if (filter.op === "lt") {
            const value = row[filter.column]
            return typeof value === "string" && value < String(filter.value)
          }
          if (filter.op === "gt") {
            const value = row[filter.column]
            return typeof value === "string" && value > String(filter.value)
          }
          return false
        }),
      )
    }

    function sorted(input: Record<string, unknown>[]) {
      return [...input].sort((a, b) => {
        for (const order of state.order ?? []) {
          const left = String(a[order.column] ?? "")
          const right = String(b[order.column] ?? "")
          if (left === right) continue
          const direction = order.ascending ? 1 : -1
          return left > right ? direction : -direction
        }
        return 0
      })
    }

    async function resolveRows() {
      const tableError = tableErrors[table]
      if (tableError) return { data: null, error: tableError }

      let updatedRows: Record<string, unknown>[] | null = null
      if (state.op === "update" && state.patch) {
        const matched = applyFilters(rows() as Record<string, unknown>[])
        updatedRows = [...matched]
        for (const row of matched) Object.assign(row, state.patch)
        calls.push({ table, op: "update", patch: state.patch, filters: state.filters })
      }
      let result = sorted(updatedRows ?? applyFilters(rows() as Record<string, unknown>[]))
      if (typeof state.limit === "number") result = result.slice(0, state.limit)
      return { data: result, error: null }
    }

    const builder = {
      select(columns = "*") {
        if (state.op !== "update") state.op = "select"
        state.select = columns
        return builder
      },
      upsert(row: Record<string, unknown>) {
        calls.push({ table, op: "upsert", row })
        if (table === "billing_subscriptions") {
          const existing = billing.find(
            (candidate) =>
              candidate.provider === row.provider &&
              candidate.provider_subscription_id === row.provider_subscription_id,
          )
          if (existing) {
            Object.assign(existing, row, { updated_at: row.updated_at ?? existing.updated_at })
          } else {
            const subscriptionRow = row as unknown as BillingSubscriptionRow
            billing.push({
              ...subscriptionRow,
              id: subscriptionRow.id ?? `billing-${billing.length + 1}`,
              created_at: subscriptionRow.created_at ?? new Date().toISOString(),
              updated_at: subscriptionRow.updated_at ?? new Date().toISOString(),
            })
          }
        } else if (table === "profiles") {
          const id = String(row.id)
          profiles[id] = {
            ...(profiles[id] ?? {}),
            ...row,
          }
        }
        return {
          error: null,
          select: () => ({
            single: async () => ({
              data: billing.find(
                (candidate) =>
                  candidate.provider === row.provider &&
                  candidate.provider_subscription_id === row.provider_subscription_id,
              ),
              error: null,
            }),
          }),
        }
      },
      insert(row: Record<string, unknown>) {
        calls.push({ table, op: "insert", row })
        if (table === "billing_webhook_events") {
          const key = `${row.provider}:${row.provider_event_id}`
          if (webhookEvents.has(key)) {
            return Promise.resolve({
              data: null,
              error: { code: "23505", message: "duplicate key value violates unique constraint" },
            })
          }
          webhookEvents.add(key)
          return Promise.resolve({ data: row, error: null })
        }
        if (table === "paypal_checkout_intents") {
          const inserted = {
            id: row.id ?? `intent-${paypalIntents.length + 1}`,
            status: row.status ?? "created",
            provider_subscription_id: row.provider_subscription_id ?? null,
            duplicate_reason: row.duplicate_reason ?? null,
            created_at: row.created_at ?? new Date().toISOString(),
            updated_at: row.updated_at ?? new Date().toISOString(),
            ...row,
          }
          paypalIntents.push(inserted)
          return {
            select: () => ({
              single: async () => ({ data: inserted, error: null }),
            }),
          }
        }
        return Promise.resolve({ data: row, error: null })
      },
      update(patch: Record<string, unknown>) {
        state.op = "update"
        state.patch = patch
        return builder
      },
      eq(column: string, value: unknown) {
        state.filters.push({ column, value, op: "eq" })
        return builder
      },
      is(column: string, value: unknown) {
        state.filters.push({ column, value, op: "is" })
        return builder
      },
      ilike(column: string, value: unknown) {
        state.filters.push({ column, value, op: "ilike" })
        return builder
      },
      in(column: string, value: unknown[]) {
        state.filters.push({ column, value, op: "in" })
        return builder
      },
      lte(column: string, value: string) {
        state.filters.push({ column, value, op: "lte" })
        return builder
      },
      lt(column: string, value: string) {
        state.filters.push({ column, value, op: "lt" })
        return builder
      },
      gt(column: string, value: string) {
        state.filters.push({ column, value, op: "gt" })
        return builder
      },
      order(column: string, options: { ascending?: boolean } = {}) {
        state.order = [...(state.order ?? []), { column, ascending: options.ascending !== false }]
        return builder
      },
      limit(count: number) {
        state.limit = count
        return builder
      },
      maybeSingle: async () => {
        const { data, error } = await resolveRows()
        if (error) return { data: null, error }
        return { data: data[0] ?? null, error: null }
      },
      single: async () => {
        const { data, error } = await resolveRows()
        if (error) return { data: null, error }
        return { data: data[0] ?? null, error: null }
      },
      then(resolve: (value: unknown) => void, reject: (error: unknown) => void) {
        resolveRows().then(resolve, reject)
      },
    }

    return builder
  }

  return {
    calls,
    billing,
    manualGrants,
    profiles,
    authUsers,
    paypalIntents,
    supabase: {
      from: makeQuery,
      auth: {
        admin: {
          createUser: async (payload: {
            email: string
            email_confirm?: boolean
            app_metadata?: Record<string, unknown>
          }) => {
            const existing = Object.values(authUsers).find(
              (user) => user.email.toLowerCase() === payload.email.toLowerCase(),
            )
            if (existing) {
              return {
                data: { user: null },
                error: { message: "User already registered", status: 422 },
              }
            }
            const id = `user-${Object.keys(authUsers).length + 1}`
            authUsers[id] = {
              id,
              email: payload.email,
              app_metadata: payload.app_metadata ?? {},
            }
            return { data: { user: authUsers[id] }, error: null }
          },
          getUserById: async (id: string) => ({
            data: { user: authUsers[id] ?? null },
            error: null,
          }),
          listUsers: async () => ({
            data: { users: Object.values(authUsers) },
            error: null,
          }),
        },
      },
    } as any,
  }
}

test("upsertBillingSubscription scopes uniqueness by provider and provider subscription id", async () => {
  const { supabase, billing } = createSupabaseStub()

  await upsertBillingSubscription(supabase, {
    user_id: "user-1",
    provider: "stripe",
    provider_subscription_id: "shared-sub",
    provider_status: "active",
    entitlement_status: "active",
  })
  await upsertBillingSubscription(supabase, {
    user_id: "user-2",
    provider: "paypal",
    provider_subscription_id: "shared-sub",
    provider_status: "ACTIVE",
    entitlement_status: "active",
  })

  assert.equal(billing.length, 2)
  assert.deepEqual(billing.map((row) => `${row.provider}:${row.provider_subscription_id}`).sort(), [
    "paypal:shared-sub",
    "stripe:shared-sub",
  ])
})

test("upsertBillingSubscription preserves optional fields during partial status updates", async () => {
  const periodEnd = futureIso()
  const { supabase, billing } = createSupabaseStub({
    billing: [
      {
        user_id: "user-1",
        provider: "paypal",
        provider_customer_id: "payer-1",
        provider_subscription_id: "I-123",
        provider_status: "ACTIVE",
        entitlement_status: "active",
        interval: "quarter",
        current_period_end: periodEnd,
        cancel_at_period_end: false,
        metadata: { plan_id: "P-quarter" },
      },
    ],
  })

  await upsertBillingSubscription(supabase, {
    user_id: "user-1",
    provider: "paypal",
    provider_subscription_id: "I-123",
    provider_status: "SUSPENDED",
    entitlement_status: "past_due",
  })

  assert.equal(billing.length, 1)
  assert.equal(billing[0].provider_status, "SUSPENDED")
  assert.equal(billing[0].entitlement_status, "past_due")
  assert.equal(billing[0].provider_customer_id, "payer-1")
  assert.equal(billing[0].interval, "quarter")
  assert.equal(billing[0].current_period_end, periodEnd)
  assert.deepEqual(billing[0].metadata, { plan_id: "P-quarter" })
})

test("hasCurrentManualAccess only allows unrevoked and unexpired grants", () => {
  const now = new Date("2026-06-02T10:00:00.000Z")

  assert.equal(hasCurrentManualAccess({ expires_at: null, revoked_at: null }, now), true)
  assert.equal(
    hasCurrentManualAccess({ expires_at: "2026-06-03T10:00:00.000Z", revoked_at: null }, now),
    true,
  )
  assert.equal(
    hasCurrentManualAccess({ expires_at: "2026-06-01T10:00:00.000Z", revoked_at: null }, now),
    false,
  )
  assert.equal(
    hasCurrentManualAccess(
      {
        expires_at: "2026-06-03T10:00:00.000Z",
        revoked_at: "2026-06-02T09:00:00.000Z",
      },
      now,
    ),
    false,
  )
})

test("findCurrentManualAccessGrant finds user and email grants case-insensitively", async () => {
  const now = new Date("2026-06-02T10:00:00.000Z")
  const { supabase } = createSupabaseStub({
    manualGrants: [
      {
        id: "expired",
        user_id: "user-1",
        email: "expired@example.com",
        expires_at: "2026-06-01T10:00:00.000Z",
        revoked_at: null,
      },
      {
        id: "email-grant",
        user_id: null,
        email: "friend@example.com",
        expires_at: null,
        revoked_at: null,
      },
    ],
  })

  assert.equal(await findCurrentManualAccessGrant(supabase, { userId: "user-1" }, now), null)
  assert.deepEqual(
    await findCurrentManualAccessGrant(supabase, { email: "Friend@Example.com" }, now),
    {
      id: "email-grant",
      user_id: null,
      email: "friend@example.com",
      expires_at: null,
      revoked_at: null,
    },
  )
})

test("findCurrentManualAccessGrant treats grant emails as exact values, not LIKE patterns", async () => {
  const { supabase } = createSupabaseStub({
    manualGrants: [
      {
        id: "underscore-grant",
        user_id: null,
        email: "axb@example.com",
        expires_at: null,
        revoked_at: null,
      },
    ],
  })

  assert.equal(await findCurrentManualAccessGrant(supabase, { email: "a_b@example.com" }), null)
})

test("findCurrentBillingSubscriptionForUser prefers active before past_due before future paid-through canceled", async () => {
  const { supabase } = createSupabaseStub({
    billing: [
      {
        id: "canceled",
        user_id: "user-1",
        entitlement_status: "canceled",
        current_period_end: futureIso(),
        cancel_at_period_end: true,
      },
      {
        id: "past-due",
        user_id: "user-1",
        entitlement_status: "past_due",
        current_period_end: futureIso(),
      },
      {
        id: "active",
        user_id: "user-1",
        entitlement_status: "active",
        current_period_end: futureIso(),
      },
    ],
  })

  const row = await findCurrentBillingSubscriptionForUser(supabase, "user-1")

  assert.equal(row?.id, "active")
})

test("findCurrentBillingSubscriptionForUser ignores incomplete rows", async () => {
  const { supabase } = createSupabaseStub({
    billing: [{ id: "pending", user_id: "user-1", entitlement_status: "incomplete" }],
  })

  const row = await findCurrentBillingSubscriptionForUser(supabase, "user-1")

  assert.equal(row, null)
})

test("findVisibleBillingSubscriptionForUser skips expired canceled rows before choosing visible billing", async () => {
  const { findVisibleBillingSubscriptionForUser } = await import("../src/lib/billing/subscriptions")
  const { supabase } = createSupabaseStub({
    billing: [
      {
        id: "expired-canceled",
        user_id: "user-1",
        entitlement_status: "canceled",
        current_period_end: "2099-12-31T00:00:00.000Z",
        cancel_at_period_end: false,
      },
      {
        id: "active",
        user_id: "user-1",
        entitlement_status: "active",
        current_period_end: futureIso(),
      },
    ],
  })

  const row = await findVisibleBillingSubscriptionForUser(supabase, "user-1")

  assert.equal(row?.id, "active")
})

test("assertCanStartCheckout throws for active, past-due, or future paid-through profile access", async () => {
  const active = createSupabaseStub({
    billing: [{ user_id: "user-1", entitlement_status: "active" }],
    profiles: { "user-1": { id: "user-1", subscription_status: null } },
  })
  await assert.rejects(
    () => assertCanStartCheckout(active.supabase, "user-1"),
    /already has access/,
  )

  const pastDue = createSupabaseStub({
    billing: [{ user_id: "user-2", entitlement_status: "past_due" }],
    profiles: { "user-2": { id: "user-2", subscription_status: null } },
  })
  await assert.rejects(
    () => assertCanStartCheckout(pastDue.supabase, "user-2"),
    /already has access/,
  )

  const paidThroughProfile = createSupabaseStub({
    profiles: {
      "user-3": {
        id: "user-3",
        subscription_status: "canceled",
        current_period_end: futureIso(),
      },
    },
  })
  await assert.rejects(
    () => assertCanStartCheckout(paidThroughProfile.supabase, "user-3"),
    /already has access/,
  )

  const activeProfile = createSupabaseStub({
    profiles: {
      "user-4": { id: "user-4", subscription_status: "active", current_period_end: null },
    },
  })
  await assert.rejects(
    () => assertCanStartCheckout(activeProfile.supabase, "user-4"),
    /already has access/,
  )

  const pastDueProfile = createSupabaseStub({
    profiles: {
      "user-5": { id: "user-5", subscription_status: "past_due", current_period_end: null },
    },
  })
  await assert.rejects(
    () => assertCanStartCheckout(pastDueProfile.supabase, "user-5"),
    /already has access/,
  )
})

test("assertCanStartCheckout allows incomplete rows so users can retry checkout", async () => {
  const { supabase } = createSupabaseStub({
    billing: [{ user_id: "user-1", entitlement_status: "incomplete" }],
    profiles: { "user-1": { id: "user-1", subscription_status: null } },
  })

  await assert.doesNotReject(() => assertCanStartCheckout(supabase, "user-1"))
})

test("assertCanStartCheckout blocks users with active manual grants", async () => {
  const { supabase } = createSupabaseStub({
    profiles: { "user-1": { id: "user-1", subscription_status: null } },
    manualGrants: [
      {
        id: "grant-1",
        user_id: "user-1",
        email: "friend@example.com",
        expires_at: null,
        revoked_at: null,
      },
    ],
  })

  await assert.rejects(() => assertCanStartCheckout(supabase, "user-1"), /already has access/)
})

test("assertCanStartCheckoutForEmail blocks lead checkout for an already subscribed profile", async () => {
  const { supabase } = createSupabaseStub({
    billing: [{ user_id: "user-1", entitlement_status: "active" }],
    profiles: {
      "user-1": { id: "user-1", email: "paid@example.com", subscription_status: null },
    },
  })

  await assert.rejects(
    () => assertCanStartCheckoutForEmail(supabase, "paid@example.com"),
    /already has access/,
  )
})

test("assertCanStartCheckoutForEmail blocks active manual grants before a profile exists", async () => {
  const { supabase } = createSupabaseStub({
    manualGrants: [
      {
        id: "grant-1",
        user_id: null,
        email: "friend@example.com",
        expires_at: null,
        revoked_at: null,
      },
    ],
  })

  await assert.rejects(
    () => assertCanStartCheckoutForEmail(supabase, "Friend@Example.com"),
    /already has access/,
  )
})

test("hasCurrentAppAccess accepts paid, legacy, and manual access sources", async () => {
  const paid = createSupabaseStub({
    billing: [{ user_id: "paid-user", entitlement_status: "active" }],
    profiles: { "paid-user": { id: "paid-user", subscription_status: null } },
  })
  assert.equal(await hasCurrentAppAccess(paid.supabase, { userId: "paid-user" }), true)

  const legacy = createSupabaseStub({
    profiles: { "legacy-user": { id: "legacy-user", subscription_status: "past_due" } },
  })
  assert.equal(await hasCurrentAppAccess(legacy.supabase, { userId: "legacy-user" }), true)

  const manual = createSupabaseStub({
    profiles: { "manual-user": { id: "manual-user", subscription_status: null } },
    manualGrants: [
      {
        id: "grant-1",
        user_id: null,
        email: "friend@example.com",
        expires_at: null,
        revoked_at: null,
      },
    ],
  })
  assert.equal(
    await hasCurrentAppAccess(manual.supabase, {
      userId: "manual-user",
      email: "Friend@Example.com",
    }),
    true,
  )
})

test("assertCanStartCheckoutForEmail matches profile emails case-insensitively", async () => {
  const { supabase } = createSupabaseStub({
    billing: [{ user_id: "user-1", entitlement_status: "active" }],
    profiles: {
      "user-1": { id: "user-1", email: "paid@example.com", subscription_status: null },
    },
  })

  await assert.rejects(
    () => assertCanStartCheckoutForEmail(supabase, "Paid@Example.com"),
    /already has access/,
  )
})

test("PayPal checkout intents create short-lived app tokens and bind provider subscriptions", async () => {
  const { supabase, paypalIntents } = createSupabaseStub()

  const intent = await createPayPalCheckoutIntent(supabase, {
    interval: "quarter",
    source: "quiz_result_offer",
    leadId: "3a900c3d-f66a-4b4d-ae52-bc1f6b41a8f6",
    email: "Buyer@Example.com",
    userId: "user-1",
    expiresAt: new Date("2026-05-28T12:00:00.000Z"),
  })

  assert.equal(intent.interval, "quarter")
  assert.equal(intent.source, "quiz_result_offer")
  assert.equal(intent.email, "buyer@example.com")
  assert.equal(intent.expires_at, "2026-05-28T12:00:00.000Z")
  assert.ok(intent.token.length >= 24)

  const bound = await bindPayPalCheckoutIntentToSubscription(
    supabase,
    intent.token,
    "I-bound",
    "Provider@Example.com",
  )
  assert.equal(bound.provider_subscription_id, "I-bound")
  assert.equal(bound.email, "provider@example.com")
  assert.equal(bound.status, "approved")

  await markPayPalCheckoutIntentDuplicate(supabase, intent.token, "email_already_has_access")
  assert.equal(paypalIntents[0].status, "duplicate")
  assert.equal(paypalIntents[0].duplicate_reason, "email_already_has_access")
})

test("PayPal checkout intent binding is immutable after the first provider subscription claim", async () => {
  const { supabase, paypalIntents } = createSupabaseStub({
    paypalIntents: [
      {
        id: "intent-1",
        token: "token-immutable",
        interval: "month",
        source: "pricing_page",
        status: "created",
        provider_subscription_id: null,
        expires_at: futureIso(),
      },
    ],
  })

  const first = await bindPayPalCheckoutIntentToSubscription(
    supabase,
    "token-immutable",
    "I-first",
    "first@example.com",
  )
  assert.equal(first.provider_subscription_id, "I-first")

  const idempotent = await bindPayPalCheckoutIntentToSubscription(
    supabase,
    "token-immutable",
    "I-first",
    "first@example.com",
  )
  assert.equal(idempotent.provider_subscription_id, "I-first")

  await assert.rejects(
    () =>
      bindPayPalCheckoutIntentToSubscription(
        supabase,
        "token-immutable",
        "I-second",
        "second@example.com",
      ),
    PayPalCheckoutIntentBindingError,
  )
  assert.equal(paypalIntents[0].provider_subscription_id, "I-first")
  assert.equal(paypalIntents[0].email, "first@example.com")
})

test("PayPal duplicate guard checks Chaarlie user and email, not PayPal subscriber email", async () => {
  const { supabase } = createSupabaseStub({
    billing: [{ user_id: "user-1", entitlement_status: "active" }],
    profiles: {
      "user-1": { id: "user-1", email: "lead@example.com", subscription_status: null },
    },
  })

  assert.equal(
    await findPayPalCheckoutDuplicateReason(
      supabase,
      { user_id: "user-1", email: "other@example.com" },
      { subscriber: { email_address: "paypal@example.com" } },
    ),
    "user_already_has_access",
  )
  assert.equal(
    await findPayPalCheckoutDuplicateReason(
      supabase,
      { user_id: null, email: "Lead@Example.com" },
      { subscriber: { email_address: "paypal@example.com" } },
    ),
    "intent_email_already_has_access",
  )
  assert.equal(
    await findPayPalCheckoutDuplicateReason(
      supabase,
      { user_id: null, email: "other@example.com" },
      { subscriber: { email_address: "Lead@Example.com" } },
    ),
    null,
  )
})

test("PayPal duplicate marker is written only after duplicate cancellation succeeds", async () => {
  const { supabase, paypalIntents } = createSupabaseStub({
    paypalIntents: [
      {
        id: "intent-1",
        token: "token-1",
        interval: "month",
        source: "pricing_page",
        status: "approved",
        expires_at: futureIso(),
      },
    ],
  })

  await assert.rejects(
    () =>
      cancelAndMarkPayPalDuplicate({
        cancelPayPalSubscription: async () => {
          throw new Error("PayPal outage")
        },
        reason: "intent_email_already_has_access",
        subscriptionId: "I-duplicate",
        supabase,
        token: "token-1",
      }),
    /could not be cancelled/,
  )
  assert.equal(paypalIntents[0].status, "approved")

  await assert.rejects(
    () =>
      cancelAndMarkPayPalDuplicate({
        cancelPayPalSubscription: async () => {
          throw new Error("SUBSCRIPTION_STATUS_INVALID")
        },
        reason: "intent_email_already_has_access",
        retrievePayPalSubscription: async () => ({ status: "ACTIVE" }),
        subscriptionId: "I-duplicate",
        supabase,
        token: "token-1",
      }),
    /could not be cancelled/,
  )
  assert.equal(paypalIntents[0].status, "approved")

  await cancelAndMarkPayPalDuplicate({
    cancelPayPalSubscription: async () => {
      throw new Error("already cancelled")
    },
    reason: "intent_email_already_has_access",
    retrievePayPalSubscription: async () => ({ status: "CANCELLED" }),
    subscriptionId: "I-duplicate",
    supabase,
    token: "token-1",
  })
  assert.equal(paypalIntents[0].status, "duplicate")
  assert.equal(paypalIntents[0].duplicate_reason, "intent_email_already_has_access")

  paypalIntents[0].status = "approved"
  paypalIntents[0].duplicate_reason = null

  await cancelAndMarkPayPalDuplicate({
    cancelPayPalSubscription: async () => {},
    reason: "intent_email_already_has_access",
    subscriptionId: "I-duplicate",
    supabase,
    token: "token-1",
  })
  assert.equal(paypalIntents[0].status, "duplicate")
  assert.equal(paypalIntents[0].duplicate_reason, "intent_email_already_has_access")
})

test("mirrorBillingSubscriptionToProfile keeps future paid-through PayPal cancellations active", async () => {
  const { supabase, profiles } = createSupabaseStub({
    profiles: { "user-1": { id: "user-1", subscription_status: null } },
  })

  await mirrorBillingSubscriptionToProfile(
    supabase,
    {
      user_id: "user-1",
      provider: "paypal",
      provider_subscription_id: "I-123",
      provider_status: "CANCELLED",
      entitlement_status: "canceled",
      interval: "month",
      current_period_end: futureIso(),
      cancel_at_period_end: true,
    },
    "tier-premium",
  )

  assert.equal(profiles["user-1"].subscription_status, "active")
  assert.equal(profiles["user-1"].subscription_tier_id, "tier-premium")
})

test("mirrorBillingSubscriptionToProfile clears Premium for immediate or expired cancellations", async () => {
  const { supabase, profiles } = createSupabaseStub({
    profiles: {
      "user-1": {
        id: "user-1",
        subscription_status: "active",
        subscription_tier_id: "tier-premium",
      },
    },
  })

  await mirrorBillingSubscriptionToProfile(
    supabase,
    {
      user_id: "user-1",
      provider: "paypal",
      provider_subscription_id: "I-123",
      provider_status: "CANCELLED",
      entitlement_status: "canceled",
      interval: "month",
      current_period_end: null,
    },
    "tier-premium",
    { freeTierId: "tier-free" },
  )

  assert.equal(profiles["user-1"].subscription_status, "canceled")
  assert.equal(profiles["user-1"].subscription_tier_id, "tier-free")
})

test("mirrorBillingSubscriptionToProfile does not grant Premium for incomplete subscriptions", async () => {
  const { supabase, profiles } = createSupabaseStub({
    profiles: {
      "user-1": {
        id: "user-1",
        subscription_status: null,
        subscription_tier_id: null,
      },
    },
  })

  await mirrorBillingSubscriptionToProfile(
    supabase,
    {
      user_id: "user-1",
      provider: "paypal",
      provider_subscription_id: "I-pending",
      provider_status: "APPROVAL_PENDING",
      entitlement_status: "incomplete",
      interval: "month",
      current_period_end: null,
    },
    "tier-premium",
  )

  assert.equal(profiles["user-1"].subscription_status, "incomplete")
  assert.equal(profiles["user-1"].subscription_tier_id, null)
})

test("reconcileExpiredBillingEntitlements downgrades expired paid-through rows and leaves future rows active", async () => {
  const { supabase, billing, profiles } = createSupabaseStub({
    billing: [
      {
        id: "expired",
        user_id: "expired-user",
        entitlement_status: "canceled",
        current_period_end: pastIso(),
      },
      {
        id: "future",
        user_id: "future-user",
        entitlement_status: "canceled",
        current_period_end: futureIso(),
        cancel_at_period_end: true,
      },
    ],
    profiles: {
      "expired-user": {
        id: "expired-user",
        subscription_status: "active",
        subscription_tier_id: "tier-premium",
      },
      "future-user": {
        id: "future-user",
        subscription_status: "active",
        subscription_tier_id: "tier-premium",
      },
    },
  })

  const result = await reconcileExpiredBillingEntitlements(supabase, {
    freeTierId: "tier-free",
    now: new Date(),
  })

  assert.equal(result.downgraded, 1)
  assert.equal(profiles["expired-user"].subscription_status, "canceled")
  assert.equal(profiles["expired-user"].subscription_tier_id, "tier-free")
  assert.equal(profiles["future-user"].subscription_status, "active")
  assert.equal(billing.find((row) => row.id === "future")?.entitlement_status, "canceled")
})

test("reconcileExpiredBillingEntitlements skips expired rows when the user has another current subscription", async () => {
  const { supabase, profiles } = createSupabaseStub({
    billing: [
      {
        id: "expired",
        user_id: "user-1",
        entitlement_status: "canceled",
        current_period_end: pastIso(),
      },
      {
        id: "newer-active",
        user_id: "user-1",
        entitlement_status: "active",
        current_period_end: futureIso(),
      },
    ],
    profiles: {
      "user-1": {
        id: "user-1",
        subscription_status: "active",
        subscription_tier_id: "tier-premium",
      },
    },
  })

  const result = await reconcileExpiredBillingEntitlements(supabase, {
    freeTierId: "tier-free",
    now: new Date(),
  })

  assert.equal(result.downgraded, 0)
  assert.equal(profiles["user-1"].subscription_status, "active")
  assert.equal(profiles["user-1"].subscription_tier_id, "tier-premium")
})

test("billing reconcile route requires CRON_SECRET authorization", async () => {
  const { supabase } = createSupabaseStub()

  const response = await handleBillingReconcile(
    new Request("https://example.com/api/billing/reconcile", {
      headers: { authorization: "Bearer wrong" },
    }),
    {
      supabase,
      cronSecret: "secret",
      getFreeTierId: async () => "tier-free",
    },
  )

  assert.equal(response.status, 401)
  assert.deepEqual(response.body, { error: "unauthorized" })
})

test("billing reconcile route downgrades expired canceled rows and keeps future paid-through rows", async () => {
  const { supabase, profiles } = createSupabaseStub({
    billing: [
      {
        id: "expired-paypal",
        user_id: "expired-paypal-user",
        provider: "paypal",
        provider_subscription_id: "I-expired",
        entitlement_status: "canceled",
        current_period_end: pastIso(),
        cancel_at_period_end: true,
      },
      {
        id: "future-paypal",
        user_id: "future-paypal-user",
        provider: "paypal",
        provider_subscription_id: "I-future",
        entitlement_status: "canceled",
        current_period_end: futureIso(),
        cancel_at_period_end: true,
      },
    ],
    profiles: {
      "expired-paypal-user": {
        id: "expired-paypal-user",
        subscription_status: "active",
        subscription_tier_id: "tier-premium",
      },
      "future-paypal-user": {
        id: "future-paypal-user",
        subscription_status: "active",
        subscription_tier_id: "tier-premium",
      },
    },
  })

  const response = await handleBillingReconcile(
    new Request("https://example.com/api/billing/reconcile", {
      headers: { authorization: "Bearer secret" },
    }),
    {
      supabase,
      cronSecret: "secret",
      getFreeTierId: async () => "tier-free",
      now: new Date(),
    },
  )

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, { downgraded: 1 })
  assert.equal(profiles["expired-paypal-user"].subscription_status, "canceled")
  assert.equal(profiles["expired-paypal-user"].subscription_tier_id, "tier-free")
  assert.equal(profiles["future-paypal-user"].subscription_status, "active")
  assert.equal(profiles["future-paypal-user"].subscription_tier_id, "tier-premium")
})

test("billing reconcile includes backfilled Stripe billing rows", async () => {
  const { supabase, profiles } = createSupabaseStub({
    billing: [
      {
        id: "expired-stripe",
        user_id: "stripe-user",
        provider: "stripe",
        provider_subscription_id: "sub-expired",
        entitlement_status: "canceled",
        current_period_end: pastIso(),
        cancel_at_period_end: true,
        metadata: { backfilled_from_profiles: true },
      },
    ],
    profiles: {
      "stripe-user": {
        id: "stripe-user",
        subscription_status: "active",
        subscription_tier_id: "tier-premium",
      },
    },
  })

  const response = await handleBillingReconcile(
    new Request("https://example.com/api/billing/reconcile", {
      headers: { authorization: "Bearer secret" },
    }),
    {
      supabase,
      cronSecret: "secret",
      getFreeTierId: async () => "tier-free",
      now: new Date(),
    },
  )

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, { downgraded: 1 })
  assert.equal(profiles["stripe-user"].subscription_status, "canceled")
  assert.equal(profiles["stripe-user"].subscription_tier_id, "tier-free")
})

test("claimWebhookEvent returns true on first insert and false on duplicate provider event id", async () => {
  const { supabase } = createSupabaseStub()

  assert.equal(
    await claimWebhookEvent(supabase, "paypal", "WH-1", "BILLING.SUBSCRIPTION.ACTIVATED"),
    true,
  )
  assert.equal(
    await claimWebhookEvent(supabase, "paypal", "WH-1", "BILLING.SUBSCRIPTION.ACTIVATED"),
    false,
  )
  assert.equal(
    await claimWebhookEvent(supabase, "stripe", "WH-1", "customer.subscription.updated"),
    true,
  )
})

test("checkout.session.completed keeps profile writes and upserts a Stripe billing row", async () => {
  const periodEnd = Math.floor((Date.now() + 86_400_000) / 1000)
  const { supabase, profiles, billing } = createSupabaseStub({
    profiles: {
      "user-1": {
        id: "user-1",
        email: "stripe@example.com",
        subscription_status: null,
      },
    },
  })
  const stripe = {
    subscriptions: {
      retrieve: async () => ({
        id: "sub_stripe_1",
        status: "active",
        items: {
          data: [
            {
              current_period_end: periodEnd,
              price: { recurring: { interval: "month", interval_count: 1 } },
            },
          ],
        },
      }),
    },
  }

  await ensureCheckoutAccount(
    {
      id: "cs_stripe_1",
      status: "complete",
      payment_status: "paid",
      customer: "cus_stripe_1",
      customer_details: { email: "stripe@example.com" },
      subscription: "sub_stripe_1",
    } as any,
    {
      supabase: {
        ...supabase,
        auth: { admin: {} },
      } as any,
      stripe: stripe as any,
      premiumTierId: "tier-premium",
    },
  )

  assert.equal(profiles["user-1"].subscription_status, "active")
  assert.equal(profiles["user-1"].subscription_interval, "month")
  assert.equal(profiles["user-1"].stripe_customer_id, "cus_stripe_1")
  assert.equal(profiles["user-1"].stripe_subscription_id, "sub_stripe_1")
  assert.equal(profiles["user-1"].subscription_tier_id, "tier-premium")
  assert.equal(profiles["user-1"].current_period_end, new Date(periodEnd * 1000).toISOString())

  assert.equal(billing.length, 1)
  assert.equal(billing[0].provider, "stripe")
  assert.equal(billing[0].user_id, "user-1")
  assert.equal(billing[0].provider_customer_id, "cus_stripe_1")
  assert.equal(billing[0].provider_subscription_id, "sub_stripe_1")
  assert.equal(billing[0].provider_status, "active")
  assert.equal(billing[0].entitlement_status, "active")
  assert.equal(billing[0].interval, "month")
  assert.equal(billing[0].current_period_end, new Date(periodEnd * 1000).toISOString())
})

test("Stripe unpaid SEPA checkout does not grant access on direct activation", async () => {
  const periodEnd = Math.floor((Date.now() + 172_800_000) / 1000)
  const { supabase, billing, profiles } = createSupabaseStub()
  const stripe = {
    subscriptions: {
      retrieve: async () => ({
        id: "sub_sepa",
        status: "active",
        default_payment_method: { id: "pm_sepa", type: "sepa_debit" },
        items: {
          data: [
            {
              current_period_end: periodEnd,
              price: { recurring: { interval: "month", interval_count: 1 } },
            },
          ],
        },
      }),
    },
  }
  const linked: unknown[][] = []

  await assert.rejects(
    () =>
      ensureCheckoutAccount(
        {
          id: "cs_sepa",
          status: "complete",
          payment_status: "unpaid",
          customer: "cus_sepa",
          customer_details: { email: "sepa@example.com" },
          subscription: "sub_sepa",
          metadata: { lead_id: "lead-sepa" },
        } as any,
        {
          supabase: supabase as any,
          stripe: stripe as any,
          premiumTierId: "tier-premium",
          linkQuizToProfile: async (...args) => {
            linked.push(args)
          },
        },
      ),
    /checkout session payment is not paid/,
  )

  assert.equal(Object.keys(profiles).length, 0)
  assert.equal(billing.length, 0)
  assert.deepEqual(linked, [])
})

test("Stripe unpaid non-SEPA checkout does not grant access on direct activation", async () => {
  const periodEnd = Math.floor((Date.now() + 172_800_000) / 1000)
  const { supabase, billing, profiles } = createSupabaseStub()
  const stripe = {
    subscriptions: {
      retrieve: async () => ({
        id: "sub_card_unpaid",
        status: "active",
        default_payment_method: { id: "pm_card", type: "card" },
        items: {
          data: [
            {
              current_period_end: periodEnd,
              price: { recurring: { interval: "month", interval_count: 1 } },
            },
          ],
        },
      }),
    },
  }

  await assert.rejects(
    () =>
      ensureCheckoutAccount(
        {
          id: "cs_card_unpaid",
          status: "complete",
          payment_status: "unpaid",
          customer: "cus_card_unpaid",
          customer_details: { email: "card-unpaid@example.com" },
          subscription: "sub_card_unpaid",
        } as any,
        {
          supabase: supabase as any,
          stripe: stripe as any,
          premiumTierId: "tier-premium",
        },
      ),
    /checkout session payment is not paid/,
  )

  assert.equal(Object.keys(profiles).length, 0)
  assert.equal(billing.length, 0)
})

test("PayPal ACTIVE activation creates a user from provider-verified email and grants Premium", async () => {
  const periodEnd = futureIso()
  const { supabase, profiles, billing, authUsers } = createSupabaseStub()
  const linked: unknown[][] = []

  const result = await ensurePayPalCheckoutAccount(
    {
      id: "I-active",
      status: "ACTIVE",
      plan_id: "P-month",
      subscriber: {
        payer_id: "payer-1",
        email_address: "provider@example.com",
      },
      billing_info: { next_billing_time: periodEnd },
      custom_id: "lead-123",
    },
    {
      supabase,
      premiumTierId: "tier-premium",
      interval: "month",
      linkQuizToProfile: async (...args) => {
        linked.push(args)
      },
    },
  )

  assert.equal(result.status, "active")
  if (result.status !== "active") throw new Error("expected active PayPal activation result")
  assert.equal(result.email, "provider@example.com")
  assert.equal(result.canSetInitialPassword, true)
  assert.equal(Object.values(authUsers)[0].email, "provider@example.com")
  assert.equal(
    Object.values(authUsers)[0].app_metadata?.checkout_activation_session_hash,
    paypalCheckoutActivationHash("I-active"),
  )
  assert.equal(profiles[result.userId].email, "provider@example.com")
  assert.equal(profiles[result.userId].subscription_status, "active")
  assert.equal(profiles[result.userId].subscription_tier_id, "tier-premium")
  assert.equal(profiles[result.userId].current_period_end, periodEnd)
  assert.equal(billing.length, 1)
  assert.equal(billing[0].provider, "paypal")
  assert.equal(billing[0].provider_subscription_id, "I-active")
  assert.equal(billing[0].provider_customer_id, "payer-1")
  assert.equal(billing[0].entitlement_status, "active")
  assert.equal(billing[0].interval, "month")
  assert.deepEqual(linked, [[result.userId, "provider@example.com", "lead-123"]])
})

test("PayPal activation ignores client-submitted email by only accepting provider data", async () => {
  const { supabase, profiles } = createSupabaseStub()

  const result = await ensurePayPalCheckoutAccount(
    {
      id: "I-email-source",
      status: "ACTIVE",
      plan_id: "P-month",
      subscriber: {
        payer_id: "payer-1",
        email_address: "provider@example.com",
      },
      billing_info: { next_billing_time: futureIso() },
    },
    {
      supabase,
      premiumTierId: "tier-premium",
      interval: "month",
    },
  )

  assert.equal(result.status, "active")
  if (result.status !== "active") throw new Error("expected active PayPal activation result")
  assert.equal(result.email, "provider@example.com")
  assert.equal(profiles[result.userId].email, "provider@example.com")
})

test("PayPal activation reuses an existing profile with the provider email", async () => {
  const { supabase, profiles } = createSupabaseStub({
    profiles: {
      "existing-user": {
        id: "existing-user",
        email: "provider@example.com",
        subscription_status: null,
      },
    },
    authUsers: {
      "existing-user": {
        id: "existing-user",
        email: "provider@example.com",
        app_metadata: {
          checkout_activation_session_hash: paypalCheckoutActivationHash("I-reuse"),
        },
      },
    },
  })

  const result = await ensurePayPalCheckoutAccount(
    {
      id: "I-reuse",
      status: "ACTIVE",
      plan_id: "P-month",
      subscriber: {
        payer_id: "payer-1",
        email_address: "provider@example.com",
      },
      billing_info: { next_billing_time: futureIso() },
    },
    {
      supabase,
      premiumTierId: "tier-premium",
      interval: "month",
    },
  )

  assert.equal(result.status, "active")
  assert.equal(result.userId, "existing-user")
  assert.equal(result.canSetInitialPassword, true)
  assert.equal(profiles["existing-user"].subscription_status, "active")
})

test("PayPal activation does not treat wildcard characters as profile email matches", async () => {
  const { supabase, profiles, authUsers } = createSupabaseStub({
    profiles: {
      "existing-user": {
        id: "existing-user",
        email: "axb@example.com",
        subscription_status: null,
      },
    },
    authUsers: {
      "existing-user": {
        id: "existing-user",
        email: "axb@example.com",
        app_metadata: {},
      },
    },
  })

  const result = await ensurePayPalCheckoutAccount(
    {
      id: "I-wildcard-email",
      status: "ACTIVE",
      plan_id: "P-month",
      subscriber: {
        payer_id: "payer-1",
        email_address: "a_b@example.com",
      },
      billing_info: { next_billing_time: futureIso() },
    },
    {
      supabase,
      premiumTierId: "tier-premium",
      interval: "month",
    },
  )

  assert.equal(result.status, "active")
  if (result.status !== "active") throw new Error("expected active PayPal activation result")
  assert.notEqual(result.userId, "existing-user")
  assert.equal(profiles["existing-user"].subscription_status, null)
  assert.equal(profiles[result.userId].email, "a_b@example.com")
  assert.equal(
    Object.values(authUsers).some((user) => user.email === "a_b@example.com"),
    true,
  )
})

test("PayPal activation refuses to attach a second current subscription to the same email", async () => {
  const { supabase, profiles, authUsers } = createSupabaseStub({
    billing: [
      {
        user_id: "existing-user",
        provider: "stripe",
        provider_subscription_id: "sub-existing",
        entitlement_status: "active",
      },
    ],
    profiles: {
      "existing-user": {
        id: "existing-user",
        email: "provider@example.com",
        subscription_status: "active",
      },
    },
    authUsers: {
      "existing-user": {
        id: "existing-user",
        email: "provider@example.com",
        app_metadata: {},
      },
    },
  })

  await assert.rejects(
    () =>
      ensurePayPalCheckoutAccount(
        {
          id: "I-new",
          status: "ACTIVE",
          plan_id: "P-quarter",
          subscriber: {
            payer_id: "payer-1",
            email_address: "provider@example.com",
          },
          billing_info: { next_billing_time: futureIso() },
        },
        {
          supabase,
          premiumTierId: "tier-premium",
          interval: "quarter",
        },
      ),
    /Chaarlie account already has current subscription access/,
  )
  assert.equal(Object.keys(authUsers).length, 1)
  assert.equal(profiles["existing-user"].subscription_status, "active")
})

test("PayPal APPROVAL_PENDING activation stays pending and does not mirror Premium", async () => {
  const { supabase, profiles, billing } = createSupabaseStub()

  const result = await ensurePayPalCheckoutAccount(
    {
      id: "I-pending",
      status: "APPROVAL_PENDING",
      plan_id: "P-month",
      subscriber: {
        payer_id: "payer-1",
        email_address: "provider@example.com",
      },
    },
    {
      supabase,
      premiumTierId: "tier-premium",
      interval: "month",
    },
  )

  assert.deepEqual(result, { status: "pending" })
  assert.deepEqual(profiles, {})
  assert.equal(billing.length, 0)
})

test("PayPal activation hash is provider-aware and Stripe checkout hash remains session-only", () => {
  assert.equal(paypalCheckoutActivationId("I-123"), "paypal:I-123")
  assert.equal(
    paypalCheckoutActivationHash("I-123"),
    createHash("sha256").update("paypal:I-123").digest("hex"),
  )
  assert.equal(
    createHash("sha256").update("cs_stripe_1").digest("hex"),
    createHash("sha256").update("cs_stripe_1").digest("hex"),
  )
  assert.notEqual(
    paypalCheckoutActivationHash("I-123"),
    createHash("sha256").update("I-123").digest("hex"),
  )
})

test("Stripe subscription.updated upserts the billing row when profile resolves by customer id", async () => {
  const periodEnd = Math.floor((Date.now() + 172_800_000) / 1000)
  const { supabase, billing } = createSupabaseStub({
    profiles: {
      "user-1": {
        id: "user-1",
        stripe_customer_id: "cus_update",
        stripe_subscription_id: "sub_update",
        subscription_status: "active",
      },
    },
  })

  await handleSubscriptionUpdated(
    {
      id: "sub_update",
      customer: "cus_update",
      status: "past_due",
      cancel_at_period_end: false,
      items: {
        data: [
          {
            current_period_end: periodEnd,
            price: { recurring: { interval: "year", interval_count: 1 } },
          },
        ],
      },
    } as any,
    { supabase: supabase as any },
  )

  assert.equal(billing.length, 1)
  assert.equal(billing[0].provider, "stripe")
  assert.equal(billing[0].user_id, "user-1")
  assert.equal(billing[0].provider_customer_id, "cus_update")
  assert.equal(billing[0].provider_subscription_id, "sub_update")
  assert.equal(billing[0].provider_status, "past_due")
  assert.equal(billing[0].entitlement_status, "past_due")
  assert.equal(billing[0].interval, "year")
  assert.equal(billing[0].current_period_end, new Date(periodEnd * 1000).toISOString())
})

test("Stripe unpaid subscription updates do not create open billing access", async () => {
  const periodEnd = Math.floor((Date.now() + 172_800_000) / 1000)
  const { supabase, billing } = createSupabaseStub({
    profiles: {
      "user-1": {
        id: "user-1",
        stripe_customer_id: "cus_unpaid",
        subscription_status: "active",
      },
    },
  })

  await handleSubscriptionUpdated(
    {
      id: "sub_unpaid",
      customer: "cus_unpaid",
      status: "unpaid",
      cancel_at_period_end: false,
      items: {
        data: [
          {
            current_period_end: periodEnd,
            price: { recurring: { interval: "month", interval_count: 1 } },
          },
        ],
      },
    } as any,
    { supabase: supabase as any },
  )

  assert.equal(billing[0].provider_status, "unpaid")
  assert.equal(billing[0].entitlement_status, "canceled")
  assert.equal(await findCurrentBillingSubscriptionForUser(supabase, "user-1"), null)
})

test("Stripe active non-current subscription updates do not create open billing access", async () => {
  const periodEnd = Math.floor((Date.now() + 172_800_000) / 1000)
  const { supabase, billing } = createSupabaseStub({
    profiles: {
      "user-1": {
        id: "user-1",
        stripe_customer_id: "cus_non_current",
        stripe_subscription_id: "sub_current",
        subscription_status: "active",
      },
    },
  })

  await handleSubscriptionUpdated(
    {
      id: "sub_old_sepa",
      customer: "cus_non_current",
      status: "active",
      cancel_at_period_end: false,
      items: {
        data: [
          {
            current_period_end: periodEnd,
            price: { recurring: { interval: "month", interval_count: 1 } },
          },
        ],
      },
    } as any,
    { supabase: supabase as any },
  )

  assert.equal(billing[0].provider_status, "active")
  assert.equal(billing[0].entitlement_status, "canceled")
  assert.equal(await findCurrentBillingSubscriptionForUser(supabase, "user-1"), null)
})

test("Stripe subscription.deleted downgrades profile and marks billing row canceled", async () => {
  const periodEnd = futureIso()
  const { supabase, billing, profiles } = createSupabaseStub({
    profiles: {
      "user-1": {
        id: "user-1",
        stripe_customer_id: "cus_delete",
        stripe_subscription_id: "sub_delete",
        subscription_status: "active",
        subscription_tier_id: "tier-premium",
      },
    },
    billing: [
      {
        user_id: "user-1",
        provider: "stripe",
        provider_customer_id: "cus_delete",
        provider_subscription_id: "sub_delete",
        provider_status: "active",
        entitlement_status: "active",
        current_period_end: periodEnd,
      },
    ],
  })

  await handleSubscriptionDeleted(
    { id: "sub_delete", customer: "cus_delete", status: "canceled" } as any,
    { supabase: supabase as any, freeTierId: "tier-free" },
  )

  assert.equal(profiles["user-1"].subscription_status, "canceled")
  assert.equal(profiles["user-1"].subscription_tier_id, "tier-free")
  assert.equal(billing.length, 1)
  assert.equal(billing[0].provider_status, "canceled")
  assert.equal(billing[0].entitlement_status, "canceled")
  assert.equal(billing[0].cancelled_at !== null, true)
  assert.equal(billing[0].current_period_end, periodEnd)
})

test("Stripe checkout route returns a stable conflict key and known email when checkout access already exists", async () => {
  const active = createSupabaseStub({
    billing: [{ user_id: "user-1", entitlement_status: "active" }],
    profiles: { "user-1": { id: "user-1", subscription_status: null } },
  })

  const response = await createStripeCheckoutAccessConflictResponse(
    active.supabase,
    "user-1",
    "paid@example.com",
  )
  if (!response) throw new Error("expected checkout conflict response")
  const body = await response.json()

  assert.equal(response.status, 409)
  assert.deepEqual(body, { error: "checkout_access_already_exists", email: "paid@example.com" })
})

test("Stripe checkout route returns bad request for malformed JSON", async () => {
  const response = await createStripeCheckoutSession({
    json: async () => {
      throw new Error("malformed")
    },
  } as any)

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: "bad request" })
})

test("Stripe checkout conflict check uses the provided billing-visible client", async () => {
  const calls: string[] = []
  const blockingClient = {
    from(table: string) {
      calls.push(table)
      return active.supabase.from(table)
    },
  } as SupabaseBillingClient
  const active = createSupabaseStub({
    billing: [{ user_id: "user-1", entitlement_status: "active" }],
    profiles: { "user-1": { id: "user-1", subscription_status: null } },
  })

  const response = await createStripeCheckoutAccessConflictResponse(blockingClient, "user-1")

  assert.equal(response?.status, 409)
  assert.ok(calls.includes("billing_subscriptions"))
})

test("Stripe checkout lead-email conflict uses provider-neutral access guard", async () => {
  const active = createSupabaseStub({
    billing: [{ user_id: "user-1", entitlement_status: "active" }],
    profiles: {
      "user-1": { id: "user-1", email: "paid@example.com", subscription_status: null },
    },
  })

  const response = await createStripeCheckoutEmailAccessConflictResponse(
    active.supabase,
    "paid@example.com",
  )

  assert.equal(response?.status, 409)
  assert.deepEqual(await response?.json(), {
    error: "checkout_access_already_exists",
    email: "paid@example.com",
  })
})

test("Stripe checkout email conflict blocks email-only manual grants", async () => {
  const active = createSupabaseStub({
    manualGrants: [
      {
        id: "grant-1",
        user_id: null,
        email: "friend@example.com",
        expires_at: null,
        revoked_at: null,
      },
    ],
  })

  const response = await createStripeCheckoutEmailAccessConflictResponse(
    active.supabase,
    "Friend@Example.com",
  )

  assert.equal(response?.status, 409)
  assert.deepEqual(await response?.json(), {
    error: "checkout_access_already_exists",
    email: "Friend@Example.com",
  })
})

test("Stripe checkout email conflict ignores missing manual grants table", async () => {
  const active = createSupabaseStub({
    tableErrors: {
      manual_access_grants: {
        code: "PGRST205",
        message: "Could not find the table 'public.manual_access_grants' in the schema cache",
      },
    },
  })

  const response = await createStripeCheckoutEmailAccessConflictResponse(
    active.supabase,
    "friend@example.com",
  )

  assert.equal(response, null)
})

test("getPayPalPlanId reads interval-specific server env vars", () => {
  const previous = {
    monthly: process.env.PAYPAL_PLAN_ID_MONTHLY,
    quarterly: process.env.PAYPAL_PLAN_ID_QUARTERLY,
    annual: process.env.PAYPAL_PLAN_ID_ANNUAL,
  }
  process.env.PAYPAL_PLAN_ID_MONTHLY = "P-month"
  process.env.PAYPAL_PLAN_ID_QUARTERLY = "P-quarter"
  process.env.PAYPAL_PLAN_ID_ANNUAL = "P-year"

  try {
    assert.equal(getPayPalPlanId("month"), "P-month")
    assert.equal(getPayPalPlanId("quarter"), "P-quarter")
    assert.equal(getPayPalPlanId("year"), "P-year")
  } finally {
    restoreEnv("PAYPAL_PLAN_ID_MONTHLY", previous.monthly)
    restoreEnv("PAYPAL_PLAN_ID_QUARTERLY", previous.quarterly)
    restoreEnv("PAYPAL_PLAN_ID_ANNUAL", previous.annual)
  }
})

test("getPayPalPlanId throws when the interval plan id is missing", () => {
  const previous = process.env.PAYPAL_PLAN_ID_MONTHLY
  delete process.env.PAYPAL_PLAN_ID_MONTHLY

  try {
    assert.throws(() => getPayPalPlanId("month"), /PAYPAL_PLAN_ID_MONTHLY is not set/)
  } finally {
    restoreEnv("PAYPAL_PLAN_ID_MONTHLY", previous)
  }
})

test("expected PayPal plan definitions use configured EUR prices and intervals", () => {
  assert.deepEqual(EXPECTED_PAYPAL_PLAN_SHAPES, {
    month: { amount: "7.49", currency: "EUR", intervalUnit: "MONTH", intervalCount: 1 },
    quarter: { amount: "17.49", currency: "EUR", intervalUnit: "MONTH", intervalCount: 3 },
    year: { amount: "49.99", currency: "EUR", intervalUnit: "YEAR", intervalCount: 1 },
  })
})

test("PayPal subscription statuses map to billing entitlement statuses", () => {
  assert.equal(mapPayPalSubscriptionStatus("ACTIVE"), "active")
  assert.equal(mapPayPalSubscriptionStatus("APPROVAL_PENDING"), "incomplete")
  assert.equal(mapPayPalSubscriptionStatus("SUSPENDED"), "past_due")
})

test("PayPal CANCELLED maps to provider cancellation without immediate paid-through downgrade", () => {
  const periodEnd = futureIso()

  const row = toBillingSubscriptionInputFromPayPal(
    {
      id: "I-cancelled",
      status: "CANCELLED",
      plan_id: "P-month",
      subscriber: { payer_id: "payer-1" },
      billing_info: { next_billing_time: periodEnd },
    },
    "user-1",
    "month",
  )

  assert.equal(row.provider, "paypal")
  assert.equal(row.provider_customer_id, "payer-1")
  assert.equal(row.provider_subscription_id, "I-cancelled")
  assert.equal(row.provider_status, "CANCELLED")
  assert.equal(row.entitlement_status, "canceled")
  assert.equal(row.cancel_at_period_end, true)
  assert.equal(row.current_period_end, periodEnd)
})

test("validatePayPalPlanShape accepts the expected active PayPal billing plan shape", () => {
  assert.doesNotThrow(() => validatePayPalPlanShape(paypalPlan("ACTIVE"), "month"))
})

test("validatePayPalPlanShape rejects wrong amount, currency, or interval count", () => {
  assert.throws(
    () => validatePayPalPlanShape(paypalPlan("ACTIVE", { value: "8.49" }), "month"),
    /expected amount 7\.49 but received 8\.49/,
  )
  assert.throws(
    () => validatePayPalPlanShape(paypalPlan("ACTIVE", { currency_code: "USD" }), "month"),
    /expected currency EUR but received USD/,
  )
  assert.throws(
    () => validatePayPalPlanShape(paypalPlan("ACTIVE", { interval_count: 2 }), "month"),
    /expected interval MONTH x1 but received MONTH x2/,
  )
})

test("validatePayPalPlanShape rejects inactive PayPal plans", () => {
  assert.throws(
    () => validatePayPalPlanShape(paypalPlan("CREATED"), "month"),
    /expected ACTIVE status/,
  )
})

test("validatePayPalPlanShape rejects finite plans, setup fees, or PayPal plan taxes", () => {
  assert.throws(
    () => validatePayPalPlanShape(paypalPlan("ACTIVE", { total_cycles: 12 }), "month"),
    /expected infinite regular billing cycles but received 12/,
  )
  assert.throws(
    () => validatePayPalPlanShape(paypalPlan("ACTIVE", { setup_fee_value: "4.99" }), "month"),
    /expected no setup fee but received 4\.99/,
  )
  assert.throws(
    () => validatePayPalPlanShape(paypalPlan("ACTIVE", { tax_percentage: "19" }), "month"),
    /expected no PayPal plan taxes but received 19/,
  )
})

function restoreEnv(key: string, value: string | undefined) {
  if (typeof value === "string") {
    process.env[key] = value
  } else {
    delete process.env[key]
  }
}

function paypalPlan(
  status: string,
  overrides: {
    value?: string
    currency_code?: string
    interval_unit?: string
    interval_count?: number
    total_cycles?: number
    setup_fee_value?: string
    tax_percentage?: string
  } = {},
) {
  return {
    id: "P-month",
    status,
    payment_preferences:
      typeof overrides.setup_fee_value === "string"
        ? {
            setup_fee: {
              value: overrides.setup_fee_value,
              currency_code: "EUR",
            },
          }
        : undefined,
    taxes:
      typeof overrides.tax_percentage === "string"
        ? {
            percentage: overrides.tax_percentage,
            inclusive: false,
          }
        : undefined,
    billing_cycles: [
      {
        tenure_type: "REGULAR",
        total_cycles: overrides.total_cycles ?? 0,
        frequency: {
          interval_unit: overrides.interval_unit ?? "MONTH",
          interval_count: overrides.interval_count ?? 1,
        },
        pricing_scheme: {
          fixed_price: {
            value: overrides.value ?? "7.49",
            currency_code: overrides.currency_code ?? "EUR",
          },
        },
      },
    ],
  }
}
