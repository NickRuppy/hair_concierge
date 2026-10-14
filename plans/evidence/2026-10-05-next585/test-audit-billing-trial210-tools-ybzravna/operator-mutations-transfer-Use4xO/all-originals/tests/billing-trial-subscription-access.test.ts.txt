import assert from "node:assert/strict"
import test from "node:test"
import {
  assertCanStartCheckout,
  hasCurrentAppAccess,
  hasCurrentBillingAccess,
  hasCurrentPaidAppAccess,
  hasTrialBillingHistory,
  upsertBillingSubscription,
} from "../src/lib/billing/subscriptions"
import type { BillingSubscriptionRow } from "../src/lib/billing/types"

const NOW = new Date("2026-09-20T12:00:00.000Z")
// The first-collection bridge keeps an unpaid, uncancelled trial open until
// the collection window closes (trial end 09-20 -> window closes 09-23T00Z).
const AFTER_WINDOW = new Date("2026-09-23T00:00:00.000Z")

function facts(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    enrollmentId: "enrollment-1",
    admissionStatus: "active",
    authorizationSucceededAt: "2026-09-13T12:00:00.000Z",
    originalTrialEndAt: "2026-09-20T12:00:00.000Z",
    firstPaymentSucceededAt: null,
    paidThroughAt: null,
    renewalGraceEndsAt: null,
    renewalPaymentFailed: false,
    cancelAtPeriodEnd: false,
    accessRevoked: false,
    ...overrides,
  }
}

function billingRow(overrides: Partial<BillingSubscriptionRow> = {}): BillingSubscriptionRow {
  return {
    id: "billing-1",
    user_id: "user-1",
    provider: "stripe",
    provider_customer_id: null,
    provider_subscriber_email: null,
    provider_subscription_id: "sub-1",
    provider_status: "active",
    entitlement_status: "active",
    interval: "month",
    current_period_end: "2026-10-20T12:00:00.000Z",
    cancel_at_period_end: false,
    cancel_scheduled_at: null,
    cancelled_at: null,
    metadata: {},
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  }
}

function trialRow(overrides: Partial<BillingSubscriptionRow> = {}) {
  return billingRow({
    trial_enrollment_id: "enrollment-1",
    trial_access_facts: facts(),
    metadata: { trial_cohort: "trial_v1" },
    ...overrides,
  })
}

function createSupabaseStub(
  options: {
    billing?: BillingSubscriptionRow[]
    profile?: Record<string, unknown> | null
    manualGrant?: boolean
    oneTimeState?: "none" | "active" | "paid_pending"
  } = {},
) {
  const billing = options.billing ?? []
  const profile = options.profile ?? null
  const manualGrants = options.manualGrant
    ? [{ id: "grant-1", user_id: "user-1", email: null, expires_at: null, revoked_at: null }]
    : []

  function query(table: string) {
    const filters: Array<[string, unknown]> = []
    let selectedRows: Record<string, unknown>[] = []
    if (table === "billing_subscriptions") selectedRows = billing.map((row) => ({ ...row }))
    if (table === "profiles") selectedRows = profile ? [profile] : []
    if (table === "manual_access_grants") selectedRows = manualGrants
    const builder: Record<string, unknown> = {}
    const result = () => ({
      data: selectedRows.filter((row) => filters.every(([key, value]) => row[key] === value)),
      error: null,
    })
    builder.select = () => builder
    builder.eq = (key: string, value: unknown) => {
      filters.push([key, value])
      return builder
    }
    builder.in = () => builder
    builder.order = () => builder
    builder.limit = () => builder
    builder.is = (key: string, value: unknown) => {
      filters.push([key, value])
      return builder
    }
    builder.maybeSingle = async () => {
      const response = result()
      return { data: response.data[0] ?? null, error: null }
    }
    builder.then = (resolve: (value: ReturnType<typeof result>) => unknown) =>
      Promise.resolve(result()).then(resolve)
    return builder
  }

  return {
    from: (table: string) => query(table),
    rpc: async () => ({ data: options.oneTimeState ?? "none", error: null }),
  }
}

function createUpsertStub(existing: BillingSubscriptionRow | null) {
  let outgoing: Record<string, unknown> | null = null
  const billingQuery = {
    select: () => billingQuery,
    eq: () => billingQuery,
    maybeSingle: async () => ({ data: existing, error: null }),
    upsert: (row: Record<string, unknown>) => {
      outgoing = row
      return { select: () => ({ single: async () => ({ data: row, error: null }) }) }
    },
  }
  return {
    supabase: { from: () => billingQuery },
    payload: () => outgoing,
  }
}

test("subscription upsert omits an additive trial column for legacy rows and preserves linked retries", async () => {
  const input = {
    user_id: "user-1",
    provider: "stripe" as const,
    provider_subscription_id: "sub-1",
    provider_status: "active",
    entitlement_status: "active" as const,
  }
  const legacy = createUpsertStub(null)
  await upsertBillingSubscription(legacy.supabase as never, input)
  assert.equal(Object.hasOwn(legacy.payload()!, "trial_enrollment_id"), false)
  assert.equal(Object.hasOwn(legacy.payload()!, "trial_access_facts"), false)

  const linked = createUpsertStub(trialRow())
  await upsertBillingSubscription(linked.supabase as never, input)
  assert.equal(linked.payload()?.trial_enrollment_id, "enrollment-1")
  assert.equal(Object.hasOwn(linked.payload()!, "trial_access_facts"), false)
})

test("active verified trial access overrides provider fields and grants full app access", async () => {
  const row = trialRow({ current_period_end: null })
  const supabase = createSupabaseStub({ billing: [row] })
  const duringTrial = new Date("2026-09-19T12:00:00.000Z")

  assert.equal(hasCurrentBillingAccess(row, duringTrial), true)
  assert.equal(
    await hasCurrentAppAccess(supabase as never, { userId: "user-1" }, duringTrial),
    true,
  )
  assert.equal(
    await hasCurrentPaidAppAccess(supabase as never, { userId: "user-1" }, duringTrial),
    true,
  )
})

test("expired trial does not inherit stale active/null-end profile access at the exact expiry", async () => {
  const supabase = createSupabaseStub({
    billing: [trialRow({ current_period_end: null })],
    profile: { id: "user-1", subscription_status: "active", current_period_end: null },
  })

  assert.equal(
    await hasCurrentAppAccess(supabase as never, { userId: "user-1" }, AFTER_WINDOW),
    false,
  )
  assert.equal(
    await hasCurrentPaidAppAccess(supabase as never, { userId: "user-1" }, AFTER_WINDOW),
    false,
  )
  await assert.doesNotReject(() =>
    assertCanStartCheckout(supabase as never, "user-1", AFTER_WINDOW),
  )
})

test("trial access remains strict after a failed first payment but admits later paid renewal grace", async () => {
  const failedFirst = createSupabaseStub({
    billing: [trialRow({ current_period_end: null })],
    profile: { id: "user-1", subscription_status: "active", current_period_end: null },
  })
  assert.equal(
    await hasCurrentAppAccess(failedFirst as never, { userId: "user-1" }, AFTER_WINDOW),
    false,
  )

  const laterPaidGrace = trialRow({
    trial_access_facts: facts({
      firstPaymentSucceededAt: "2026-08-20T12:00:00.000Z",
      paidThroughAt: "2026-09-19T12:00:00.000Z",
      renewalPaymentFailed: true,
      renewalGraceEndsAt: "2026-09-21T12:00:00.000Z",
    }),
  })
  const supabase = createSupabaseStub({ billing: [laterPaidGrace] })
  assert.equal(await hasCurrentAppAccess(supabase as never, { userId: "user-1" }, NOW), true)
})

test("malformed trial projections fail closed while independent access and legacy billing remain valid", async () => {
  const malformed = trialRow({ trial_access_facts: { version: 1 } })
  assert.equal(
    await hasTrialBillingHistory(
      createSupabaseStub({ billing: [malformed] }) as never,
      "user-1",
      NOW,
    ),
    true,
  )
  const manual = createSupabaseStub({ billing: [malformed], manualGrant: true })
  await assert.rejects(
    () => assertCanStartCheckout(manual as never, "user-1", NOW),
    /already has access/,
  )

  const oneTime = createSupabaseStub({ billing: [malformed], oneTimeState: "active" })
  await assert.rejects(
    () => assertCanStartCheckout(oneTime as never, "user-1", NOW),
    /already has access/,
  )

  const legacy = billingRow({ current_period_end: null })
  assert.equal(hasCurrentBillingAccess(legacy, NOW), true)
})

test("legacy profile access still blocks checkout when no trial marker exists", async () => {
  const supabase = createSupabaseStub({
    profile: { id: "user-1", subscription_status: "active", current_period_end: null },
  })
  await assert.rejects(
    () => assertCanStartCheckout(supabase as never, "user-1", NOW),
    /already has access/,
  )
})
