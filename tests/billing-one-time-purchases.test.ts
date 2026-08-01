import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  findCurrentOneTimePurchaseForUser,
  hasCurrentOneTimePurchaseAccess,
  resolveOneTimeAccessStateForUser,
  resolveOneTimePurchaseAccessState,
  upsertOneTimePurchase,
} from "../src/lib/billing/purchases"
import { assertCanStartCheckout, hasCurrentAppAccess } from "../src/lib/billing/subscriptions"
import type { BillingOneTimePurchaseRow } from "../src/lib/billing/types"
import type { PersonalPlanOneTimeCheckoutConsentRow } from "../src/lib/billing/personal-plan-one-time-consents"

function paidPurchase(
  overrides: Partial<BillingOneTimePurchaseRow> = {},
): BillingOneTimePurchaseRow {
  return {
    id: "purchase-1",
    user_id: "user-1",
    consent_id: "consent-1",
    provider: "stripe",
    product_kind: "personal_plan_once",
    provider_transaction_id: "pi_123",
    provider_customer_id: null,
    provider_order_id: "cs_123",
    amount_minor: 2999,
    currency: "eur",
    refunded_amount_minor: 0,
    status: "paid",
    paid_at: "2026-07-31T10:00:00.000Z",
    refunded_at: null,
    metadata: {},
    created_at: "2026-07-31T10:00:00.000Z",
    updated_at: "2026-07-31T10:00:00.000Z",
    ...overrides,
  }
}

function fulfilledConsent(
  overrides: Partial<PersonalPlanOneTimeCheckoutConsentRow> = {},
): PersonalPlanOneTimeCheckoutConsentRow {
  return {
    id: "consent-1",
    lead_id: "lead-1",
    funnel_session_id: "session-1",
    user_id: "user-1",
    product_kind: "personal_plan_once",
    offer_variant: "personal-plan-once",
    copy_version: "2026-07-31",
    consent_text: "consent",
    consent_text_sha256: "a".repeat(64),
    accepted_at: "2026-07-31T09:00:00.000Z",
    stripe_checkout_session_id: "cs_123",
    paypal_order_id: null,
    paypal_capture_id: null,
    confirmation_provider: "customerio",
    confirmation_status: "sent",
    confirmation_reference: "customerio:message:stripe:pi_123",
    confirmation_sent_at: "2026-07-31T10:00:01.000Z",
    confirmation_delivered_at: null,
    generation_started_at: "2026-07-31T10:00:02.000Z",
    generation_completed_at: "2026-07-31T10:00:03.000Z",
    generated_content_sha256: "b".repeat(64),
    delivery_provider: "customerio",
    delivery_reference: "customerio:delivery:1",
    delivered_at: "2026-07-31T10:00:04.000Z",
    first_accessed_at: null,
    created_at: "2026-07-31T09:00:00.000Z",
    updated_at: "2026-07-31T10:00:04.000Z",
    ...overrides,
  }
}

test("only a fully confirmed and delivered paid one-time personal-plan purchase grants access", () => {
  const active = { purchase: paidPurchase(), consent: fulfilledConsent() }
  assert.equal(resolveOneTimePurchaseAccessState(active), "active")
  assert.equal(hasCurrentOneTimePurchaseAccess(active), true)
  assert.equal(
    resolveOneTimePurchaseAccessState({
      purchase: paidPurchase(),
      consent: fulfilledConsent({ confirmation_status: "failed", delivered_at: null }),
    }),
    "paid_pending",
  )
  assert.equal(
    resolveOneTimePurchaseAccessState({
      purchase: paidPurchase({ status: "refunded" }),
      consent: fulfilledConsent(),
    }),
    "revoked",
  )
  assert.equal(
    resolveOneTimePurchaseAccessState({
      purchase: paidPurchase({ status: "reversed" }),
      consent: fulfilledConsent(),
    }),
    "revoked",
  )
  assert.equal(
    resolveOneTimePurchaseAccessState({
      purchase: paidPurchase({ status: "disputed" }),
      consent: fulfilledConsent(),
    }),
    "revoked",
  )
})

test("the paid purchase is included in common access and checkout conflict checks", async () => {
  const purchase = paidPurchase()
  const consent = fulfilledConsent()
  const supabase = {
    from(table: string) {
      if (table === "billing_one_time_purchases") return query([purchase])
      if (table === "personal_plan_one_time_checkout_consents") return query([consent])
      return query([])
    },
  }
  assert.deepEqual(await findCurrentOneTimePurchaseForUser(supabase as never, "user-1"), purchase)
  assert.equal(await hasCurrentAppAccess(supabase as never, { userId: "user-1" }), true)
  await assert.rejects(
    () => assertCanStartCheckout(supabase as never, "user-1"),
    /already has access/,
  )
})

test("paid-pending one-time purchase blocks checkout but does not grant app access", async () => {
  const purchase = paidPurchase()
  const consent = fulfilledConsent({ confirmation_status: "failed", delivered_at: null })
  const supabase = {
    from(table: string) {
      if (table === "billing_one_time_purchases") return query([purchase])
      if (table === "personal_plan_one_time_checkout_consents") return query([consent])
      return query([])
    },
  }
  assert.equal(await resolveOneTimeAccessStateForUser(supabase as never, "user-1"), "paid_pending")
  assert.equal(await hasCurrentAppAccess(supabase as never, { userId: "user-1" }), false)
  await assert.rejects(
    () => assertCanStartCheckout(supabase as never, "user-1"),
    /already has access/,
  )
})

test("authenticated access resolver uses coarse RPC without reading private consent rows", async () => {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const supabase = {
    from(table: string) {
      if (table === "personal_plan_one_time_checkout_consents") {
        assert.fail("authenticated access resolver must not select consent evidence directly")
      }
      return query([])
    },
    async rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args })
      return { data: "paid_pending", error: null }
    },
  }

  assert.equal(await resolveOneTimeAccessStateForUser(supabase as never, "user-1"), "paid_pending")
  assert.deepEqual(rpcCalls, [
    {
      fn: "get_personal_plan_one_time_access_state",
      args: { p_user_id: "user-1" },
    },
  ])
})

test("RPC fallback fails closed when authenticated RLS denies private consent evidence", async () => {
  const permissionDenied = { code: "42501", message: "permission denied for table consents" }
  const withPrivateConsentDenied = (purchase: BillingOneTimePurchaseRow | null) => ({
    from(table: string) {
      if (table === "billing_one_time_purchases") return query(purchase ? [purchase] : [])
      if (table === "personal_plan_one_time_checkout_consents") {
        return {
          select() {
            return this
          },
          eq() {
            return this
          },
          async maybeSingle() {
            return { data: null, error: permissionDenied }
          },
        }
      }
      return query([])
    },
    async rpc() {
      return { data: null, error: { code: "PGRST202", message: "function does not exist" } }
    },
  })

  assert.equal(
    await resolveOneTimeAccessStateForUser(
      withPrivateConsentDenied(paidPurchase()) as never,
      "user-1",
    ),
    "paid_pending",
  )
  assert.equal(
    await resolveOneTimeAccessStateForUser(
      withPrivateConsentDenied(paidPurchase({ status: "refunded" })) as never,
      "user-1",
    ),
    "revoked",
  )
  assert.equal(
    await resolveOneTimeAccessStateForUser(withPrivateConsentDenied(null) as never, "user-1"),
    "none",
  )
})

test("RPC fallback keeps a legacy paid row without consent_id paid-pending", async () => {
  const { consent_id: _omittedConsentId, ...legacyPurchase } = paidPurchase()
  const supabase = {
    from(table: string) {
      if (table === "personal_plan_one_time_checkout_consents") {
        assert.fail("legacy fallback must not query consent with a missing id")
      }
      if (table === "billing_one_time_purchases") return query([legacyPurchase])
      return query([])
    },
    async rpc() {
      return { data: null, error: { code: "PGRST202", message: "function does not exist" } }
    },
  }

  assert.equal(await resolveOneTimeAccessStateForUser(supabase as never, "user-1"), "paid_pending")
})

test("current purchase lookup uses RPC state before selecting the own purchase row", async () => {
  const purchase = paidPurchase()
  const supabase = {
    from(table: string) {
      if (table === "personal_plan_one_time_checkout_consents") {
        assert.fail("current purchase lookup must not select consent evidence directly")
      }
      if (table === "billing_one_time_purchases") return query([purchase])
      return query([])
    },
    async rpc() {
      return { data: "active", error: null }
    },
  }

  assert.deepEqual(await findCurrentOneTimePurchaseForUser(supabase as never, "user-1"), purchase)
})

test("revoked one-time purchase resolves as revoked without blocking fresh checkout", async () => {
  const purchase = paidPurchase({ status: "refunded", refunded_amount_minor: 2999 })
  const consent = fulfilledConsent()
  const supabase = {
    from(table: string) {
      if (table === "billing_one_time_purchases") return query([purchase])
      if (table === "personal_plan_one_time_checkout_consents") return query([consent])
      return query([])
    },
  }

  assert.equal(await resolveOneTimeAccessStateForUser(supabase as never, "user-1"), "revoked")
  assert.equal(await hasCurrentAppAccess(supabase as never, { userId: "user-1" }), false)
  await assert.doesNotReject(() => assertCanStartCheckout(supabase as never, "user-1"))
})

test("one-time access state prefers a paid row over later revoked history", async () => {
  const lateRevoked = paidPurchase({
    id: "purchase-revoked",
    consent_id: "consent-revoked",
    status: "refunded",
    refunded_amount_minor: 2999,
    updated_at: "2026-07-31T12:00:00.000Z",
  })
  const currentPaid = paidPurchase({
    id: "purchase-paid",
    consent_id: "consent-paid",
    updated_at: "2026-07-31T11:00:00.000Z",
  })
  const consents = [
    fulfilledConsent({ id: "consent-revoked" }),
    fulfilledConsent({
      id: "consent-paid",
      confirmation_status: "pending",
      confirmation_provider: null,
      confirmation_reference: null,
      confirmation_sent_at: null,
      generation_started_at: null,
      generation_completed_at: null,
      generated_content_sha256: null,
      delivery_provider: null,
      delivery_reference: null,
      delivered_at: null,
    }),
  ]
  const supabase = {
    from(table: string) {
      if (table === "billing_one_time_purchases") return query([lateRevoked, currentPaid])
      if (table === "personal_plan_one_time_checkout_consents") return consentQuery(consents)
      return query([])
    },
  }

  assert.equal(await resolveOneTimeAccessStateForUser(supabase as never, "user-1"), "paid_pending")
})

test("a provider replay cannot reactivate a refunded transaction", async () => {
  const existing = paidPurchase({ status: "refunded", refunded_amount_minor: 2999 })
  let written: Record<string, unknown> | null = null
  const supabase = {
    from() {
      const filters: Array<[string, unknown]> = []
      const builder = {
        select() {
          return builder
        },
        eq(key: string, value: unknown) {
          filters.push([key, value])
          return builder
        },
        async maybeSingle() {
          return {
            data: filters.every(([key, value]) => existing[key as keyof typeof existing] === value)
              ? existing
              : null,
            error: null,
          }
        },
        upsert(row: Record<string, unknown>) {
          written = { ...existing, ...row }
          return { select: () => ({ single: async () => ({ data: written, error: null }) }) }
        },
      }
      return builder
    },
  }
  const result = await upsertOneTimePurchase(supabase as never, {
    user_id: existing.user_id,
    consent_id: existing.consent_id,
    provider: existing.provider,
    provider_transaction_id: existing.provider_transaction_id,
    amount_minor: 2999,
    currency: "eur",
    status: "paid",
    paid_at: "2026-07-31T12:00:00.000Z",
  })
  assert.equal(result.status, "refunded")
})

test("migration keeps provider references unique and browser writes disabled", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260731120000_billing_one_time_purchases.sql",
      import.meta.url,
    ),
    "utf8",
  )
  assert.match(migration, /UNIQUE \(provider, provider_transaction_id\)/)
  assert.match(migration, /WHERE status = 'paid'/)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.billing_one_time_purchases FROM anon, authenticated/,
  )
})

test("recovery migration makes purchases consent-bound, service-only, and safely claimable", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260731125000_one_time_payment_recovery_state.sql",
      import.meta.url,
    ),
    "utf8",
  )
  assert.match(migration, /ALTER COLUMN user_id DROP NOT NULL/)
  assert.match(migration, /billing_one_time_purchases_consent_id_fkey/)
  assert.match(migration, /ON DELETE RESTRICT/)
  assert.match(migration, /bind_personal_plan_one_time_purchase_user/)
  assert.match(migration, /one-time purchase user must be bound through consent RPC/)
  assert.match(migration, /personal_plan_one_time_delivery_evidence_complete/)
  assert.match(migration, /get_personal_plan_one_time_access_state/)
  assert.match(migration, /auth\.role\(\) <> 'service_role'/)
  assert.doesNotMatch(migration, /request\.jwt\.claim\.role/)
  assert.match(migration, /ORDER BY \(status = 'paid'\) DESC, updated_at DESC/)
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.get_personal_plan_one_time_access_state\(uuid\)/,
  )
  assert.match(migration, /personal_plan_one_time_fulfillment_jobs/)
  assert.match(migration, /claim_personal_plan_one_time_fulfillment_job/)
  assert.match(migration, /FOR UPDATE SKIP LOCKED/)
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.personal_plan_one_time_fulfillment_jobs FROM anon, authenticated/,
  )
})

function query(rows: unknown[]) {
  return {
    select() {
      return this
    },
    eq() {
      return this
    },
    ilike() {
      return this
    },
    async maybeSingle() {
      return { data: rows[0] ?? null, error: null }
    },
    async then(resolve: (result: unknown) => void) {
      resolve({ data: rows, error: null })
    },
  }
}

function consentQuery(rows: PersonalPlanOneTimeCheckoutConsentRow[]) {
  let idFilter: string | null = null
  return {
    select() {
      return this
    },
    eq(column: string, value: string) {
      if (column === "id") idFilter = value
      return this
    },
    async maybeSingle() {
      return { data: rows.find((row) => row.id === idFilter) ?? null, error: null }
    },
  }
}
