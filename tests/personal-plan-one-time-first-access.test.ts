import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { recordPersonalPlanOneTimeFirstAccess } from "../src/lib/billing/personal-plan-one-time-first-access"
import type { BillingOneTimePurchaseRow } from "../src/lib/billing/types"
import type { PersonalPlanOneTimeCheckoutConsentRow } from "../src/lib/billing/personal-plan-one-time-consents"

function purchase(overrides: Partial<BillingOneTimePurchaseRow> = {}): BillingOneTimePurchaseRow {
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

function consent(
  overrides: Partial<PersonalPlanOneTimeCheckoutConsentRow> = {},
): PersonalPlanOneTimeCheckoutConsentRow {
  return {
    id: "consent-1",
    lead_id: "lead-1",
    funnel_session_id: "session-1",
    user_id: "user-1",
    product_kind: "personal_plan_once",
    offer_variant: "personal-plan-one-time-v1",
    copy_version: "2026-07-31",
    consent_text: "consent",
    consent_text_sha256: "a".repeat(64),
    accepted_at: "2026-07-31T09:00:00.000Z",
    stripe_checkout_session_id: "cs_123",
    paypal_order_id: null,
    paypal_capture_id: null,
    confirmation_provider: "customerio",
    confirmation_status: "delivered",
    confirmation_reference: "message-1",
    confirmation_sent_at: "2026-07-31T10:00:01.000Z",
    confirmation_delivered_at: "2026-07-31T10:00:01.000Z",
    generation_started_at: "2026-07-31T10:00:02.000Z",
    generation_completed_at: "2026-07-31T10:00:03.000Z",
    generated_content_sha256: "b".repeat(64),
    delivery_provider: "customerio",
    delivery_reference: "delivery-1",
    delivered_at: "2026-07-31T10:00:04.000Z",
    first_accessed_at: null,
    created_at: "2026-07-31T09:00:00.000Z",
    updated_at: "2026-07-31T10:00:04.000Z",
    ...overrides,
  }
}

function query(data: unknown) {
  const result = { data, error: null }
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => result,
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  return chain
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

function supabaseFor({
  purchases,
  consents,
}: {
  purchases: BillingOneTimePurchaseRow[]
  consents: PersonalPlanOneTimeCheckoutConsentRow[]
}) {
  const writes: Array<{ id: string; firstAccessedAt: string }> = []
  return {
    writes,
    client: {
      from(table: string) {
        if (table === "billing_one_time_purchases") return query(purchases)
        if (table === "personal_plan_one_time_checkout_consents") {
          const updates = {
            id: "",
            userId: "",
            leadId: "",
            onlyUnset: false,
            firstAccessedAt: "",
          }
          const updateChain = {
            eq(column: string, value: string) {
              if (column === "id") updates.id = value
              if (column === "user_id") updates.userId = value
              if (column === "lead_id") updates.leadId = value
              return updateChain
            },
            is(column: string, value: null) {
              updates.onlyUnset = column === "first_accessed_at" && value === null
              return updateChain
            },
            select: () => updateChain,
            maybeSingle: async () => {
              const row = consents.find(
                (candidate) =>
                  candidate.id === updates.id &&
                  candidate.user_id === updates.userId &&
                  candidate.lead_id === updates.leadId &&
                  (!updates.onlyUnset || candidate.first_accessed_at === null),
              )
              if (!row) return { data: null, error: null }
              row.first_accessed_at = updates.firstAccessedAt
              writes.push({ id: row.id, firstAccessedAt: row.first_accessed_at })
              return { data: { id: row.id }, error: null }
            },
          }
          return {
            ...consentQuery(consents),
            update(patch: { first_accessed_at: string }) {
              updates.firstAccessedAt = patch.first_accessed_at
              return updateChain
            },
          }
        }
        throw new Error(`Unexpected table ${table}`)
      },
    },
  }
}

test("records matching active one-time plan access once", async () => {
  const fixture = supabaseFor({ purchases: [purchase()], consents: [consent()] })
  const input = { userId: "user-1", leadId: "lead-1", at: "2026-07-31T12:00:00.000Z" }

  assert.equal(await recordPersonalPlanOneTimeFirstAccess(fixture.client as never, input), true)
  assert.equal(await recordPersonalPlanOneTimeFirstAccess(fixture.client as never, input), false)
  assert.deepEqual(fixture.writes, [
    { id: "consent-1", firstAccessedAt: "2026-07-31T12:00:00.000Z" },
  ])
})

for (const [name, purchaseOverrides, consentOverrides] of [
  ["a different result lead", {}, { lead_id: "lead-other" }],
  ["a pending fulfillment", {}, { confirmation_status: "pending", delivered_at: null }],
  ["a revoked purchase", { status: "refunded" }, {}],
  ["a non-one-time purchase", { product_kind: "other" }, {}],
] as const) {
  test(`does not record first access for ${name}`, async () => {
    const fixture = supabaseFor({
      purchases: [purchase(purchaseOverrides as Partial<BillingOneTimePurchaseRow>)],
      consents: [consent(consentOverrides)],
    })

    assert.equal(
      await recordPersonalPlanOneTimeFirstAccess(fixture.client as never, {
        userId: "user-1",
        leadId: "lead-1",
        at: "2026-07-31T12:00:00.000Z",
      }),
      false,
    )
    assert.deepEqual(fixture.writes, [])
  })
}

test("result rendering keeps the existing client surface while the evidence write is best effort", () => {
  const source = readFileSync(
    new URL("../src/app/result/[leadId]/page.tsx", import.meta.url),
    "utf8",
  )
  assert.match(source, /recordPersonalPlanOneTimeFirstAccess\(createAdminClient\(\),/)
  assert.match(source, /\.catch\(\(\) => \{[\s\S]*failed to record one-time plan first access/)
  assert.match(source, /<ResultPageClient[\s\S]*hasAccess=\{hasAccess\}/)
})
