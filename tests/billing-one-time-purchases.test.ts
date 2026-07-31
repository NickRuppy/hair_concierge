import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  findCurrentOneTimePurchaseForUser,
  hasCurrentOneTimePurchaseAccess,
  upsertOneTimePurchase,
} from "../src/lib/billing/purchases"
import { assertCanStartCheckout, hasCurrentAppAccess } from "../src/lib/billing/subscriptions"
import type { BillingOneTimePurchaseRow } from "../src/lib/billing/types"

function paidPurchase(
  overrides: Partial<BillingOneTimePurchaseRow> = {},
): BillingOneTimePurchaseRow {
  return {
    id: "purchase-1",
    user_id: "user-1",
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

test("only a paid one-time personal-plan purchase grants access", () => {
  assert.equal(hasCurrentOneTimePurchaseAccess(paidPurchase()), true)
  assert.equal(hasCurrentOneTimePurchaseAccess(paidPurchase({ status: "refunded" })), false)
  assert.equal(hasCurrentOneTimePurchaseAccess(paidPurchase({ status: "reversed" })), false)
  assert.equal(hasCurrentOneTimePurchaseAccess(paidPurchase({ status: "disputed" })), false)
})

test("the paid purchase is included in common access and checkout conflict checks", async () => {
  const purchase = paidPurchase()
  const supabase = {
    from(table: string) {
      if (table === "billing_one_time_purchases") return query([purchase])
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
