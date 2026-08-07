import assert from "node:assert/strict"
import test from "node:test"

import {
  evaluatePaidOneTimePurchaseAccess,
  monitorPaidOneTimeAccess,
  PAID_ACCESS_MONITOR_WORKER_COUNT,
} from "../src/lib/billing/paid-access-monitor"
import type { PersonalPlanOneTimeCheckoutConsentRow } from "../src/lib/billing/personal-plan-one-time-consents"
import type {
  BillingOneTimePurchaseRow,
  OneTimeAccessState,
  PersonalPlanOneTimeFulfillmentJobRow,
} from "../src/lib/billing/types"
import { buildPaymentFailurePayload } from "../src/lib/observability/payment"

const now = new Date("2026-08-07T12:00:00.000Z")

test("paid access monitor ignores active delivery even when first access is still null", () => {
  const finding = evaluatePaidOneTimePurchaseAccess({
    purchase: purchase(),
    consent: activeConsent({ first_accessed_at: null }),
    now,
  })

  assert.equal(finding, null)
})

test("paid access monitor ignores paid purchases inside the 60 minute grace", () => {
  const finding = evaluatePaidOneTimePurchaseAccess({
    purchase: purchase({ paid_at: "2026-08-07T11:15:00.000Z" }),
    consent: pendingConsent(),
    now,
  })

  assert.equal(finding, null)
})

test("paid access monitor reports missing delivery evidence after grace", () => {
  const finding = evaluatePaidOneTimePurchaseAccess({
    purchase: purchase(),
    consent: pendingConsent({
      confirmation_status: "sent",
      confirmation_sent_at: "2026-08-07T10:05:00.000Z",
    }),
    now,
  })

  assert.deepEqual(finding, {
    signal: "paid_but_entitlement_not_active",
    provider: "paypal",
    purchaseId: "purchase_12345678",
    reason: "delivery_evidence_missing",
    userId: "user_12345678",
    leadId: "lead_12345678",
    paidAt: "2026-08-07T10:00:00.000Z",
    isInternalTest: false,
  })
})

test("paid access monitor prefers permanent and stalled fulfillment evidence", () => {
  const base = {
    purchase: purchase(),
    consent: pendingConsent({ confirmation_status: "pending" }),
    now,
  }

  assert.equal(
    evaluatePaidOneTimePurchaseAccess({
      ...base,
      fulfillmentJob: job({ status: "failed_permanent" }),
    })?.reason,
    "fulfillment_failed_permanent",
  )
  assert.equal(
    evaluatePaidOneTimePurchaseAccess({
      ...base,
      fulfillmentJob: job({
        status: "pending",
        next_attempt_at: "2026-08-07T12:01:00.000Z",
      }),
    })?.reason,
    "confirmation_pending",
  )
  assert.equal(
    evaluatePaidOneTimePurchaseAccess({
      ...base,
      fulfillmentJob: job({
        status: "pending",
        next_attempt_at: "2026-08-07T12:00:00.000Z",
      }),
    })?.reason,
    "fulfillment_retry_stalled",
  )
  assert.equal(
    evaluatePaidOneTimePurchaseAccess({
      ...base,
      fulfillmentJob: job({
        status: "processing",
        processing_started_at: "2026-08-07T11:50:00.000Z",
        next_attempt_at: null,
      }),
    })?.reason,
    "confirmation_pending",
  )
  assert.equal(
    evaluatePaidOneTimePurchaseAccess({
      ...base,
      fulfillmentJob: job({
        status: "processing",
        processing_started_at: "2026-08-07T11:46:00.000Z",
        next_attempt_at: null,
      }),
      staleProcessingMs: 15 * 60 * 1000,
    })?.reason,
    "confirmation_pending",
  )
  assert.equal(
    evaluatePaidOneTimePurchaseAccess({
      ...base,
      fulfillmentJob: job({
        status: "processing",
        processing_started_at: "2026-08-07T11:45:00.000Z",
        next_attempt_at: null,
      }),
      staleProcessingMs: 15 * 60 * 1000,
    })?.reason,
    "fulfillment_retry_stalled",
  )
  assert.equal(
    evaluatePaidOneTimePurchaseAccess({
      ...base,
      fulfillmentJob: job({
        status: "processing",
        processing_started_at: "2026-08-07T11:44:00.000Z",
        next_attempt_at: null,
      }),
      staleProcessingMs: 15 * 60 * 1000,
    })?.reason,
    "fulfillment_retry_stalled",
  )
})

test("paid access monitor excludes internal tests and emits no raw identity in payload", async () => {
  const result = await monitorPaidOneTimeAccess({
    now,
    supabase: fakeSupabase({
      purchases: [
        purchase({ id: "purchase_internal", metadata: { is_internal_test: "true" } }),
        purchase({ id: "purchase_real_1" }),
      ],
      consents: [pendingConsent()],
      jobs: [],
      funnelSessions: [{ id: "funnel_12345678", is_internal_test: false }],
    }) as never,
  })

  assert.equal(result.status, "completed")
  assert.equal(result.counters.skippedInternalTest, 1)
  assert.equal(result.counters.findings, 1)
  assert.equal(result.findings.length, 1)

  const payload = buildPaymentFailurePayload({
    signal: "paid_but_entitlement_not_active",
    provider: "paypal",
    boundary: "entitlement",
    errorFamily: "entitlement_state",
    commerceKind: "one_time",
    origin: "reconciliation",
    method: "paypal",
    truth: "succeeded",
    live: true,
    isInternalTest: false,
    purchaseId: "purchase_real_1",
    userId: "user_12345678",
    leadId: "lead_12345678",
    invariant: "delivery_evidence_missing",
    status: "delivery_evidence_missing",
    plan: "personal_plan_once",
  })

  assert.deepEqual(payload.fingerprint, [
    "payment/paid_but_entitlement_not_active/paypal/entitlement/entitlement_state",
    "delivery_evidence_missing",
    "purchase_real_1",
  ])
  assert.doesNotMatch(JSON.stringify(payload), /kundin@example\.de|ORDER-|CAPTURE-|token/i)
})

test("paid access monitor suppresses losing paid-pending rows when canonical user access is active", async () => {
  const result = await monitorPaidOneTimeAccess({
    now,
    supabase: fakeSupabase({
      purchases: [
        purchase({
          id: "purchase_losing_pending",
          consent_id: "consent_losing_pending",
          paid_at: "2026-08-07T10:30:00.000Z",
          updated_at: "2026-08-07T10:30:00.000Z",
        }),
        purchase({
          id: "purchase_active_winner",
          consent_id: "consent_active_winner",
          paid_at: "2026-08-07T10:00:00.000Z",
          updated_at: "2026-08-07T10:45:00.000Z",
        }),
      ],
      consents: [
        pendingConsent({ id: "consent_losing_pending" }),
        activeConsent({ id: "consent_active_winner" }),
      ],
      jobs: [],
      funnelSessions: [{ id: "funnel_12345678", is_internal_test: false }],
      accessStatesByUser: new Map([["user_12345678", "active"]]),
    }) as never,
  })

  assert.equal(result.status, "completed")
  assert.equal(result.counters.purchasesChecked, 2)
  assert.equal(result.counters.findings, 0)
  assert.equal(result.counters.active, 2)
  assert.deepEqual(result.findings, [])
})

test("paid access monitor fails visibly when canonical access contradicts a paid pending row", async () => {
  for (const canonicalAccess of ["none", "revoked"] as const) {
    const result = await monitorPaidOneTimeAccess({
      now,
      supabase: fakeSupabase({
        purchases: [purchase({ id: `purchase_canonical_${canonicalAccess}` })],
        consents: [pendingConsent()],
        jobs: [],
        funnelSessions: [{ id: "funnel_12345678", is_internal_test: false }],
        accessStatesByUser: new Map([["user_12345678", canonicalAccess]]),
      }) as never,
    })

    assert.equal(result.status, "monitor_failed")
    assert.equal(result.counters.findings, 1)
    assert.equal(result.counters.monitorFailures, 1)
    assert.equal(result.monitorFailures[0]?.reason, "canonical_access_conflict")
    assert.equal(result.monitorFailures[0]?.provider, "paypal")
    assert.equal(result.monitorFailures[0]?.purchaseId, `purchase_canonical_${canonicalAccess}`)
    assert.equal(result.findings[0]?.purchaseId, `purchase_canonical_${canonicalAccess}`)
  }
})

test("paid access monitor bounds concurrent canonical checks and shares duplicate-user resolution", async () => {
  let activeRpc = 0
  let maxActiveRpc = 0
  const rpcCalls: string[] = []
  const userIds = [
    "user_shared",
    "user_unique_1",
    "user_unique_2",
    "user_unique_3",
    "user_shared",
    "user_unique_4",
    "user_unique_5",
    "user_unique_6",
  ]
  const purchases = userIds.map((userId, index) =>
    purchase({
      id: `purchase_concurrent_${index}`,
      user_id: userId,
      consent_id: `consent_concurrent_${index}`,
      paid_at: new Date(now.getTime() - (61 + index) * 60_000).toISOString(),
    }),
  )
  const consents = userIds.map((userId, index) =>
    pendingConsent({
      id: `consent_concurrent_${index}`,
      user_id: userId,
    }),
  )

  const result = await monitorPaidOneTimeAccess({
    now,
    supabase: fakeSupabase({
      purchases,
      consents,
      jobs: [],
      funnelSessions: [{ id: "funnel_12345678", is_internal_test: false }],
      accessStatesByUser: new Map(userIds.map((userId) => [userId, "paid_pending"])),
      onRpcStart: async (userId) => {
        rpcCalls.push(userId)
        activeRpc += 1
        maxActiveRpc = Math.max(maxActiveRpc, activeRpc)
        await new Promise((resolve) => setTimeout(resolve, 5))
      },
      onRpcFinish: () => {
        activeRpc -= 1
      },
    }) as never,
  })

  assert.equal(result.status, "completed")
  assert.equal(result.counters.findings, purchases.length)
  assert.ok(maxActiveRpc <= PAID_ACCESS_MONITOR_WORKER_COUNT)
  assert.equal(rpcCalls.filter((userId) => userId === "user_shared").length, 1)
  assert.equal(rpcCalls.length, new Set(userIds).size)
})

test("paid access monitor does not fail merely because healthy sales exceed the result limit", async () => {
  const purchases = Array.from({ length: 3 }, (_, index) =>
    purchase({
      id: `purchase_healthy_${index}`,
      consent_id: `consent_healthy_${index}`,
      paid_at: new Date(now.getTime() - (61 + index) * 60_000).toISOString(),
    }),
  )
  const result = await monitorPaidOneTimeAccess({
    now,
    limit: 2,
    supabase: fakeSupabase({
      purchases,
      consents: purchases.map((candidate) =>
        activeConsent({ id: candidate.consent_id ?? "", user_id: candidate.user_id }),
      ),
      jobs: [],
      funnelSessions: [],
    }) as never,
  })

  assert.equal(result.status, "completed")
  assert.equal(result.counters.purchasesListed, 3)
  assert.equal(result.counters.active, 3)
  assert.equal(result.counters.monitorFailures, 0)
})

test("paid access monitor fails visibly when the bounded scan budget is exhausted", async () => {
  const purchases = Array.from({ length: 9 }, (_, index) =>
    purchase({
      id: `purchase_budget_${index}`,
      metadata: { is_internal_test: true },
      paid_at: new Date(now.getTime() - (61 + index) * 60_000).toISOString(),
    }),
  )
  const result = await monitorPaidOneTimeAccess({
    now,
    limit: 2,
    supabase: fakeSupabase({
      purchases,
      consents: [],
      jobs: [],
      funnelSessions: [],
    }) as never,
  })

  assert.equal(result.status, "monitor_failed")
  assert.equal(result.counters.purchasesListed, 0)
  assert.equal(result.counters.skippedInternalTest, 8)
  assert.equal(result.counters.monitorFailures, 1)
  assert.equal(result.monitorFailures[0]?.reason, "candidate_cap")
})

test("paid access monitor does not report a partial scan at the exact bounded budget", async () => {
  const purchases = Array.from({ length: 8 }, (_, index) =>
    purchase({
      id: `purchase_exact_budget_${index}`,
      consent_id: `consent_exact_budget_${index}`,
      paid_at: new Date(now.getTime() - (61 + index) * 60_000).toISOString(),
    }),
  )
  const result = await monitorPaidOneTimeAccess({
    now,
    limit: 2,
    supabase: fakeSupabase({
      purchases,
      consents: purchases.map((candidate) =>
        activeConsent({ id: candidate.consent_id ?? "", user_id: candidate.user_id }),
      ),
      jobs: [],
      funnelSessions: [],
    }) as never,
  })

  assert.equal(result.status, "completed")
  assert.equal(result.counters.purchasesListed, 8)
  assert.equal(result.counters.monitorFailures, 0)
})

test("paid access monitor caps unresolved findings without dropping oldest-first order", async () => {
  const purchases = Array.from({ length: 3 }, (_, index) =>
    purchase({
      id: `purchase_unresolved_${index}`,
      consent_id: `consent_unresolved_${index}`,
      paid_at: new Date(now.getTime() - (63 - index) * 60_000).toISOString(),
    }),
  )
  const result = await monitorPaidOneTimeAccess({
    now,
    limit: 2,
    supabase: fakeSupabase({
      purchases,
      consents: purchases.map((candidate) =>
        pendingConsent({ id: candidate.consent_id ?? "", user_id: candidate.user_id }),
      ),
      jobs: [],
      funnelSessions: [],
    }) as never,
  })

  assert.equal(result.status, "monitor_failed")
  assert.deepEqual(
    result.findings.map((finding) => finding.purchaseId),
    ["purchase_unresolved_0", "purchase_unresolved_1"],
  )
  assert.equal(result.counters.findings, 2)
  assert.equal(result.counters.monitorFailures, 1)
  assert.equal(result.monitorFailures[0]?.reason, "candidate_cap")
})

test("paid access monitor pages by paid time and then stable id at a tie boundary", async () => {
  const tiedPaidAt = new Date(now.getTime() - 62 * 60_000).toISOString()
  const purchases = [
    purchase({
      id: "zz_older",
      consent_id: "consent_zz_older",
      paid_at: new Date(now.getTime() - 63 * 60_000).toISOString(),
    }),
    ...Array.from({ length: 50 }, (_, index) => {
      const suffix = String(index).padStart(3, "0")
      return purchase({
        id: `aa_${suffix}`,
        consent_id: `consent_aa_${suffix}`,
        paid_at: tiedPaidAt,
      })
    }),
  ]
  const result = await monitorPaidOneTimeAccess({
    now,
    supabase: fakeSupabase({
      purchases: [...purchases].reverse(),
      consents: purchases.map((candidate) =>
        pendingConsent({ id: candidate.consent_id ?? "", user_id: candidate.user_id }),
      ),
      jobs: [],
      funnelSessions: [],
    }) as never,
  })

  assert.equal(result.status, "monitor_failed")
  assert.equal(result.counters.purchasesListed, 51)
  assert.equal(result.findings.length, 50)
  assert.equal(result.findings[0]?.purchaseId, "zz_older")
  assert.equal(result.findings[1]?.purchaseId, "aa_000")
  assert.equal(result.findings[49]?.purchaseId, "aa_048")
})

test("paid access monitor treats legacy null metadata as non-internal instead of aborting", async () => {
  const result = await monitorPaidOneTimeAccess({
    now,
    supabase: fakeSupabase({
      purchases: [purchase({ metadata: null as never })],
      consents: [pendingConsent()],
      jobs: [],
      funnelSessions: [{ id: "funnel_12345678", is_internal_test: false }],
    }) as never,
  })

  assert.equal(result.status, "completed")
  assert.equal(result.counters.purchasesChecked, 1)
  assert.equal(result.counters.findings, 1)
})

function purchase(overrides: Partial<BillingOneTimePurchaseRow> = {}): BillingOneTimePurchaseRow {
  return {
    id: "purchase_12345678",
    user_id: "user_12345678",
    consent_id: "consent_12345678",
    provider: "paypal",
    product_kind: "personal_plan_once",
    provider_transaction_id: "CAPTURE-SECRET",
    provider_customer_id: null,
    provider_order_id: "ORDER-SECRET",
    amount_minor: 2999,
    currency: "EUR",
    refunded_amount_minor: 0,
    status: "paid",
    paid_at: "2026-08-07T10:00:00.000Z",
    refunded_at: null,
    metadata: {},
    created_at: "2026-08-07T10:00:00.000Z",
    updated_at: "2026-08-07T10:00:00.000Z",
    ...overrides,
  }
}

function pendingConsent(
  overrides: Partial<PersonalPlanOneTimeCheckoutConsentRow> = {},
): PersonalPlanOneTimeCheckoutConsentRow {
  return {
    id: "consent_12345678",
    lead_id: "lead_12345678",
    funnel_session_id: "funnel_12345678",
    user_id: "user_12345678",
    product_kind: "personal_plan_once",
    offer_variant: "personal-plan-one-time-v1",
    copy_version: "v1",
    consent_text: "purchase context",
    consent_text_sha256: "hash",
    accepted_at: "2026-08-07T09:59:00.000Z",
    stripe_checkout_session_id: null,
    paypal_order_id: "ORDER-SECRET",
    paypal_capture_id: "CAPTURE-SECRET",
    confirmation_provider: null,
    confirmation_status: "pending",
    confirmation_reference: null,
    confirmation_sent_at: null,
    confirmation_delivered_at: null,
    generation_started_at: null,
    generation_completed_at: null,
    generated_content_sha256: null,
    delivery_provider: null,
    delivery_reference: null,
    delivered_at: null,
    first_accessed_at: null,
    created_at: "2026-08-07T09:59:00.000Z",
    updated_at: "2026-08-07T09:59:00.000Z",
    ...overrides,
  }
}

function activeConsent(
  overrides: Partial<PersonalPlanOneTimeCheckoutConsentRow> = {},
): PersonalPlanOneTimeCheckoutConsentRow {
  return pendingConsent({
    confirmation_provider: "customerio",
    confirmation_status: "sent",
    confirmation_reference: "message-safe",
    confirmation_sent_at: "2026-08-07T10:01:00.000Z",
    generation_started_at: "2026-08-07T10:01:00.000Z",
    generation_completed_at: "2026-08-07T10:02:00.000Z",
    generated_content_sha256: "content-hash",
    delivery_provider: "artifact",
    delivery_reference: "artifact-safe",
    delivered_at: "2026-08-07T10:02:30.000Z",
    ...overrides,
  })
}

function job(
  overrides: Partial<PersonalPlanOneTimeFulfillmentJobRow> = {},
): PersonalPlanOneTimeFulfillmentJobRow {
  return {
    id: "job_12345678",
    purchase_id: "purchase_12345678",
    consent_id: "consent_12345678",
    status: "pending",
    attempts: 0,
    next_attempt_at: null,
    processing_started_at: null,
    last_error: null,
    delivery_provider: null,
    delivery_reference: null,
    canonical_content_sha256: null,
    delivered_at: null,
    created_at: "2026-08-07T10:00:00.000Z",
    updated_at: "2026-08-07T10:00:00.000Z",
    ...overrides,
  }
}

function fakeSupabase(input: {
  purchases: BillingOneTimePurchaseRow[]
  consents: PersonalPlanOneTimeCheckoutConsentRow[]
  jobs: PersonalPlanOneTimeFulfillmentJobRow[]
  funnelSessions: Array<{ id: string; is_internal_test: boolean }>
  accessStatesByUser?: Map<string, OneTimeAccessState>
  onRpcStart?: (userId: string) => Promise<void> | void
  onRpcFinish?: (userId: string) => void
}) {
  const client = {
    from(table: string) {
      const tableRows =
        table === "billing_one_time_purchases"
          ? input.purchases
          : table === "personal_plan_one_time_checkout_consents"
            ? input.consents
            : table === "personal_plan_one_time_fulfillment_jobs"
              ? input.jobs
              : input.funnelSessions
      return query(tableRows as Array<Record<string, unknown>>)
    },
  }
  if (!input.accessStatesByUser && !input.onRpcStart && !input.onRpcFinish) return client

  return {
    ...client,
    async rpc(fn: string, args: Record<string, unknown>) {
      if (fn !== "get_personal_plan_one_time_access_state") {
        return { data: null, error: { message: "unexpected rpc" } }
      }
      const userId = String(args.p_user_id)
      await input.onRpcStart?.(userId)
      try {
        return { data: input.accessStatesByUser?.get(userId) ?? "paid_pending", error: null }
      } finally {
        input.onRpcFinish?.(userId)
      }
    },
  }
}

function query(rows: Array<Record<string, unknown>>) {
  const state = {
    rows: [...rows],
    orders: [] as Array<{ column: string; ascending: boolean }>,
  }
  const applyOrders = () => {
    if (state.orders.length === 0) return
    state.rows.sort((left, right) => {
      for (const order of state.orders) {
        const comparison = String(left[order.column]).localeCompare(String(right[order.column]))
        if (comparison !== 0) return order.ascending ? comparison : -comparison
      }
      return 0
    })
  }
  const api = {
    select() {
      return api
    },
    eq(column: string, value: unknown) {
      state.rows = state.rows.filter((row) => row[column] === value)
      return api
    },
    gte(column: string, value: string) {
      state.rows = state.rows.filter(
        (row) => typeof row[column] === "string" && row[column] >= value,
      )
      return api
    },
    lte(column: string, value: string) {
      state.rows = state.rows.filter(
        (row) => typeof row[column] === "string" && row[column] <= value,
      )
      return api
    },
    order(column: string, options: { ascending: boolean }) {
      state.orders.push({ column, ascending: options.ascending })
      return api
    },
    range(from: number, to: number) {
      applyOrders()
      state.rows = state.rows.slice(from, to + 1)
      return api
    },
    limit(value: number) {
      applyOrders()
      state.rows = state.rows.slice(0, value)
      return api
    },
    async maybeSingle() {
      applyOrders()
      return { data: state.rows[0] ?? null, error: null }
    },
    then(resolve: (value: { data: unknown[]; error: null }) => void) {
      applyOrders()
      resolve({ data: state.rows, error: null })
    },
  }
  return api
}
