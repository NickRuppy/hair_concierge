import assert from "node:assert/strict"
import test from "node:test"

import {
  createBillingAnalyticsEvent,
  dispatchBillingAnalyticsDue,
  dispatchBillingAnalyticsDueWithStats,
  dispatchBillingAnalyticsEvent,
} from "../src/lib/billing/analytics-outbox"
import type {
  BillingAnalyticsDeliveryRow,
  BillingAnalyticsOutboxRow,
  SupabaseBillingAnalyticsClient,
} from "../src/lib/billing/types"

test("Slack rows cannot consume the Node batch limit or interrupt other deliveries", async () => {
  const { supabase, deliveries } = createSupabaseStub()
  await createBillingAnalyticsEvent(
    supabase,
    {
      eventKey: "stripe:purchase_completed:slack-state-outage",
      eventName: "purchase_completed",
      userId: "user-123",
      provider: "stripe",
      occurredAt: new Date().toISOString(),
      payload: { value: 9.99, currency: "EUR" },
    },
    { dispatch: false, destinations: ["meta", "posthog"] },
  )
  deliveries[0].destination = "slack"
  const sent: string[] = []
  await dispatchBillingAnalyticsDueWithStats(supabase, {
    limit: 1,
    dependencies: {
      deliver: async (destination) => {
        sent.push(destination)
        return { ok: true }
      },
    },
  })
  assert.deepEqual(sent, ["posthog"])
  assert.equal(deliveries[0].status, "pending")
  assert.equal(deliveries[0].attempts, 0)
  assert.equal(deliveries[1].status, "delivered")
})

test("trial authorization can only queue the internal PostHog event, even with paid destinations requested", async () => {
  for (const destinations of [undefined, ["customerio", "meta", "posthog", "funnel"] as const]) {
    const { supabase, deliveries } = createSupabaseStub()
    await createBillingAnalyticsEvent(
      supabase,
      {
        eventKey: "stripe:trial_started:enrollment",
        eventName: "trial_started",
        userId: "user-123",
        provider: "stripe",
        occurredAt: "2026-09-14T12:00:00.000Z",
        payload: { value: 0 },
      },
      { dispatch: false, ...(destinations ? { destinations: [...destinations] } : {}) },
    )
    assert.deepEqual(
      deliveries.map((row) => row.destination),
      ["posthog"],
    )
  }
})

function createSupabaseStub(options: { profileLookupErrors?: number } = {}) {
  const outbox: BillingAnalyticsOutboxRow[] = []
  const deliveries: BillingAnalyticsDeliveryRow[] = []
  const profiles = [{ id: "user-123", email: "buyer@example.com" }]
  const selections: Array<{ table: string; columns: string | undefined }> = []

  function rowsForTable(table: string): Record<string, unknown>[] {
    if (table === "billing_analytics_outbox") return outbox as unknown as Record<string, unknown>[]
    if (table === "billing_analytics_deliveries")
      return deliveries as unknown as Record<string, unknown>[]
    if (table === "profiles") return profiles
    return []
  }

  function makeQuery(table: string) {
    const filters: Array<(row: Record<string, unknown>) => boolean> = []
    let selectedRows: Record<string, unknown>[] | null = null
    let limitCount: number | null = null

    function applyFilters(rows: Record<string, unknown>[]) {
      return rows.filter((row) => filters.every((filter) => filter(row)))
    }

    function applySelection() {
      const rows = selectedRows ?? applyFilters(rowsForTable(table))
      return limitCount == null ? rows : rows.slice(0, limitCount)
    }

    const builder = {
      select(columns?: string) {
        selections.push({ table, columns })
        selectedRows = applyFilters(rowsForTable(table))
        return builder
      },
      eq(column: string, value: unknown) {
        filters.push((row) => row[column] === value)
        if (selectedRows) selectedRows = applyFilters(rowsForTable(table))
        return builder
      },
      in(column: string, values: unknown[]) {
        filters.push((row) => values.includes(row[column]))
        if (selectedRows) selectedRows = applyFilters(rowsForTable(table))
        return builder
      },
      lte(column: string, value: unknown) {
        filters.push((row) => row[column] != null && String(row[column]) <= String(value))
        if (selectedRows) selectedRows = applyFilters(rowsForTable(table))
        return builder
      },
      or(expression: string) {
        if (
          expression.includes("next_attempt_at") &&
          expression.includes("processing_started_at")
        ) {
          const nextAttemptMatch = expression.match(/next_attempt_at\.lte\.([^,]+)/)
          const processingMatch = expression.match(/processing_started_at\.lte\.([^,]+)/)
          const nextAttemptAt = nextAttemptMatch?.[1]
          const processingStartedAt = processingMatch?.[1]
          filters.push(
            (row) =>
              row.next_attempt_at == null ||
              (nextAttemptAt != null && String(row.next_attempt_at) <= nextAttemptAt) ||
              (processingStartedAt != null &&
                row.processing_started_at != null &&
                String(row.processing_started_at) <= processingStartedAt),
          )
        }
        if (selectedRows) selectedRows = applyFilters(rowsForTable(table))
        return builder
      },
      order() {
        return builder
      },
      limit(count: number) {
        limitCount = count
        return builder
      },
      insert(row: Record<string, unknown>) {
        if (
          table === "billing_analytics_outbox" &&
          outbox.some((candidate) => candidate.event_key === row.event_key)
        ) {
          return {
            select: () => ({
              single: async () => ({
                data: null,
                error: { code: "23505", message: "duplicate key value violates unique constraint" },
              }),
            }),
          }
        }
        if (table === "billing_analytics_outbox") {
          outbox.push({
            ...(row as unknown as BillingAnalyticsOutboxRow),
            id: `outbox-${outbox.length + 1}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          return {
            select: () => ({
              single: async () => ({ data: outbox[outbox.length - 1], error: null }),
            }),
          }
        }
        return {
          select: () => ({ single: async () => ({ data: row, error: null }) }),
        }
      },
      upsert(rows: Array<Record<string, unknown>>) {
        if (table === "billing_analytics_deliveries") {
          for (const row of rows) {
            const existing = deliveries.find(
              (candidate) =>
                candidate.outbox_id === row.outbox_id && candidate.destination === row.destination,
            )
            if (existing) continue
            deliveries.push({
              id: `delivery-${deliveries.length + 1}`,
              outbox_id: String(row.outbox_id),
              destination: row.destination as BillingAnalyticsDeliveryRow["destination"],
              status: "pending",
              attempts: 0,
              processing_started_at: null,
              next_attempt_at: null,
              delivered_at: null,
              last_error: null,
              provider_request_id: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          }
        }
        return { error: null }
      },
      update(patch: Record<string, unknown>) {
        const updateFilters: Array<(row: Record<string, unknown>) => boolean> = []
        let appliedRows: Record<string, unknown>[] | null = null
        const applyUpdate = () => {
          if (appliedRows) return appliedRows
          appliedRows = []
          for (const row of rowsForTable(table)) {
            if (updateFilters.every((filter) => filter(row))) {
              Object.assign(row, patch)
              appliedRows.push(row)
            }
          }
          return appliedRows
        }
        const updateBuilder = {
          eq(column: string, value: unknown) {
            updateFilters.push((row) => row[column] === value)
            return updateBuilder
          },
          in(column: string, values: unknown[]) {
            updateFilters.push((row) => values.includes(row[column]))
            return updateBuilder
          },
          lte(column: string, value: unknown) {
            updateFilters.push((row) => row[column] != null && String(row[column]) <= String(value))
            return updateBuilder
          },
          select() {
            applyUpdate()
            return updateBuilder
          },
          async maybeSingle() {
            const row = applyUpdate()[0]
            return { data: row ?? null, error: null }
          },
          then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => void) {
            return Promise.resolve({ data: applyUpdate(), error: null }).then(resolve)
          },
        }
        return {
          eq: updateBuilder.eq,
          in: updateBuilder.in,
          lte: updateBuilder.lte,
          select: updateBuilder.select,
          maybeSingle: updateBuilder.maybeSingle,
        }
      },
      maybeSingle: async () => {
        if (table === "profiles" && (options.profileLookupErrors ?? 0) > 0) {
          options.profileLookupErrors = (options.profileLookupErrors ?? 0) - 1
          return { data: null, error: new Error("profile lookup exploded") }
        }
        return {
          data: applySelection()[0] ?? null,
          error: null,
        }
      },
      single: async () => ({
        data: applySelection()[0] ?? null,
        error: null,
      }),
      then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => void) {
        resolve({ data: applySelection(), error: null })
      },
    }

    return builder
  }

  return {
    deliveries,
    outbox,
    selections,
    supabase: {
      from: makeQuery,
      rpc: async () => ({ data: null, error: null }),
    } as unknown as SupabaseBillingAnalyticsClient,
  }
}

test("billing analytics profile projection only selects real profile columns", async () => {
  const { selections, supabase } = createSupabaseStub()
  const event = await createBillingAnalyticsEvent(
    supabase,
    {
      eventKey: "stripe:subscription_updated:sub_123:profile-projection",
      eventName: "subscription_updated",
      userId: "user-123",
      provider: "stripe",
      sourceObjectId: "sub_123",
      occurredAt: "2026-07-16T10:00:00.000Z",
      payload: {},
    },
    { dispatch: false, destinations: ["customerio"] },
  )

  await dispatchBillingAnalyticsEvent(supabase, event, ["customerio"])

  const profileSelection = selections.find((selection) => selection.table === "profiles")
  assert.ok(profileSelection?.columns)
  assert.doesNotMatch(profileSelection.columns, /cancel_at_period_end/)
})

test("billing analytics outbox creates canonical event and idempotent destination rows", async () => {
  const { deliveries, outbox, supabase } = createSupabaseStub()
  const input = {
    eventKey: "stripe:purchase_completed:cs_test_123",
    eventName: "purchase_completed" as const,
    userId: "user-123",
    provider: "stripe" as const,
    providerCustomerId: "cus_123",
    providerSubscriptionId: "sub_123",
    sourceEventId: "evt_123",
    sourceObjectId: "cs_test_123",
    occurredAt: "2026-07-08T10:00:00.000Z",
    payload: { checkout_session_id: "cs_test_123", email: "buyer@example.com" },
  }

  const first = await createBillingAnalyticsEvent(supabase, input, { dispatch: false })
  const second = await createBillingAnalyticsEvent(supabase, input, { dispatch: false })

  assert.equal(first.id, second.id)
  assert.equal(outbox.length, 1)
  assert.equal(outbox[0].payload.email, undefined)
  assert.deepEqual(deliveries.map((delivery) => delivery.destination).sort(), [
    "customerio",
    "meta",
    "posthog",
  ])
})

test("billing analytics dispatch records failed delivery attempts without throwing", async () => {
  const { deliveries, supabase } = createSupabaseStub()
  const event = await createBillingAnalyticsEvent(
    supabase,
    {
      eventKey: "stripe:purchase_completed:cs_test_123",
      eventName: "purchase_completed",
      userId: "user-123",
      provider: "stripe",
      providerCustomerId: "cus_123",
      providerSubscriptionId: "sub_123",
      sourceEventId: "evt_123",
      sourceObjectId: "cs_test_123",
      occurredAt: "2026-07-08T10:00:00.000Z",
      payload: { checkout_session_id: "cs_test_123" },
    },
    { dispatch: false },
  )

  await dispatchBillingAnalyticsEvent(supabase, event)

  assert.equal(deliveries.length, 3)
  assert.deepEqual(
    deliveries.map((delivery) => delivery.status),
    ["failed", "failed", "failed"],
  )
  assert.deepEqual(
    deliveries.map((delivery) => delivery.attempts),
    [1, 1, 1],
  )
  assert.deepEqual(
    deliveries.map((delivery) => delivery.processing_started_at),
    [null, null, null],
  )
})

test("billing analytics immediate dispatch isolates a throwing profile lookup and continues", async () => {
  const { deliveries, supabase } = createSupabaseStub({ profileLookupErrors: 1 })
  const event = await createBillingAnalyticsEvent(
    supabase,
    {
      eventKey: "stripe:subscription_updated:profile-poison",
      eventName: "subscription_updated",
      userId: "user-123",
      provider: "stripe",
      providerSubscriptionId: "sub_profile_poison",
      occurredAt: "2026-07-16T10:00:00.000Z",
      payload: {},
    },
    { dispatch: false, destinations: ["customerio", "posthog"] },
  )

  await dispatchBillingAnalyticsEvent(supabase, event, ["customerio", "posthog"], {
    deliver: async () => ({ ok: true }),
  })

  assert.deepEqual(
    deliveries.map(({ status, attempts, last_error }) => ({ status, attempts, last_error })),
    [
      { status: "failed", attempts: 1, last_error: "profile lookup exploded" },
      { status: "delivered", attempts: 1, last_error: null },
    ],
  )
})

test("billing analytics immediate dispatch isolates a throwing destination and continues", async () => {
  const { deliveries, supabase } = createSupabaseStub()
  const event = await createBillingAnalyticsEvent(
    supabase,
    {
      eventKey: "stripe:subscription_updated:destination-poison",
      eventName: "subscription_updated",
      userId: "user-123",
      provider: "stripe",
      providerSubscriptionId: "sub_destination_poison",
      occurredAt: "2026-07-16T10:00:00.000Z",
      payload: {},
    },
    { dispatch: false, destinations: ["customerio", "posthog"] },
  )

  await dispatchBillingAnalyticsEvent(supabase, event, ["customerio", "posthog"], {
    deliver: async (destination) => {
      if (destination === "customerio") throw new Error("destination exploded")
      return { ok: true }
    },
  })

  assert.deepEqual(
    deliveries.map(({ status, attempts, last_error }) => ({ status, attempts, last_error })),
    [
      { status: "failed", attempts: 1, last_error: "destination exploded" },
      { status: "delivered", attempts: 1, last_error: null },
    ],
  )
})

test("billing analytics due dispatch skips future backoff rows before applying the limit", async () => {
  const { deliveries, supabase } = createSupabaseStub()
  const future = new Date(Date.now() + 60_000).toISOString()

  await createBillingAnalyticsEvent(
    supabase,
    {
      eventKey: "stripe:purchase_completed:future",
      eventName: "purchase_completed",
      userId: "user-123",
      provider: "stripe",
      sourceObjectId: "future",
      occurredAt: "2026-07-08T10:00:00.000Z",
      payload: {},
    },
    { dispatch: false },
  )
  for (const delivery of deliveries) delivery.next_attempt_at = future

  await createBillingAnalyticsEvent(
    supabase,
    {
      eventKey: "stripe:purchase_completed:due",
      eventName: "purchase_completed",
      userId: "user-123",
      provider: "stripe",
      sourceObjectId: "due",
      occurredAt: "2026-07-08T10:01:00.000Z",
      payload: {},
    },
    { dispatch: false },
  )

  const processed = await dispatchBillingAnalyticsDue(supabase, { limit: 3 })

  assert.equal(processed, 3)
  assert.deepEqual(
    deliveries.map((delivery) => delivery.status),
    ["pending", "pending", "pending", "failed", "failed", "failed"],
  )
})

test("billing analytics due dispatch resolves event keys before paging deliveries", async () => {
  const { deliveries, supabase } = createSupabaseStub()

  await createBillingAnalyticsEvent(
    supabase,
    {
      eventKey: "stripe:purchase_completed:first",
      eventName: "purchase_completed",
      userId: "user-123",
      provider: "stripe",
      sourceObjectId: "first",
      occurredAt: "2026-07-08T10:00:00.000Z",
      payload: {},
    },
    { dispatch: false },
  )
  await createBillingAnalyticsEvent(
    supabase,
    {
      eventKey: "stripe:purchase_completed:target",
      eventName: "purchase_completed",
      userId: "user-123",
      provider: "stripe",
      sourceObjectId: "target",
      occurredAt: "2026-07-08T10:01:00.000Z",
      payload: {},
    },
    { dispatch: false },
  )

  const processed = await dispatchBillingAnalyticsDue(supabase, {
    eventKey: "stripe:purchase_completed:target",
    limit: 1,
  })

  assert.equal(processed, 1)
  assert.equal(deliveries[0].status, "pending")
  assert.equal(deliveries[3].status, "failed")
})

test("billing analytics due batch continues after a destination throws", async () => {
  const { deliveries, supabase } = createSupabaseStub()
  await createBillingAnalyticsEvent(
    supabase,
    {
      eventKey: "stripe:subscription_updated:due-poison",
      eventName: "subscription_updated",
      userId: "user-123",
      provider: "stripe",
      providerSubscriptionId: "sub_due_poison",
      occurredAt: "2026-07-16T10:00:00.000Z",
      payload: {},
    },
    { dispatch: false, destinations: ["customerio", "posthog"] },
  )

  const processed = await dispatchBillingAnalyticsDue(supabase, {
    limit: 10,
    dependencies: {
      deliver: async (destination) => {
        if (destination === "customerio") throw new Error("due destination exploded")
        return { ok: true }
      },
    },
  })

  assert.equal(processed, 2)
  assert.deepEqual(
    deliveries.map(({ status, attempts, last_error }) => ({ status, attempts, last_error })),
    [
      { status: "failed", attempts: 1, last_error: "due destination exploded" },
      { status: "delivered", attempts: 1, last_error: null },
    ],
  )
})

test("billing analytics due stats distinguish delivered and failed vendor results", async () => {
  const { supabase } = createSupabaseStub()
  await createBillingAnalyticsEvent(
    supabase,
    {
      eventKey: "stripe:subscription_updated:due-stats",
      eventName: "subscription_updated",
      userId: "user-123",
      provider: "stripe",
      providerSubscriptionId: "sub_due_stats",
      occurredAt: "2026-07-16T10:00:00.000Z",
      payload: {},
    },
    { dispatch: false, destinations: ["customerio", "posthog"] },
  )

  const stats = await dispatchBillingAnalyticsDueWithStats(supabase, {
    limit: 10,
    dependencies: {
      deliver: async (destination) =>
        destination === "customerio"
          ? { ok: false, error: "vendor rejected delivery" }
          : { ok: true },
    },
  })

  assert.deepEqual(stats, { processed: 2, delivered: 1, failed: 1 })
})

test("billing analytics due dispatch retires a stale poison delivery after five attempts", async () => {
  const { deliveries, supabase } = createSupabaseStub()
  await createBillingAnalyticsEvent(
    supabase,
    {
      eventKey: "stripe:subscription_updated:stale-poison",
      eventName: "subscription_updated",
      userId: "user-123",
      provider: "stripe",
      providerSubscriptionId: "sub_stale_poison",
      occurredAt: "2026-07-16T10:00:00.000Z",
      payload: {},
    },
    { dispatch: false, destinations: ["customerio", "posthog"] },
  )
  deliveries[0].status = "processing"
  deliveries[0].attempts = 4
  deliveries[0].processing_started_at = new Date(Date.now() - 16 * 60_000).toISOString()

  const processed = await dispatchBillingAnalyticsDue(supabase, {
    destination: "customerio",
    limit: 10,
    dependencies: {
      deliver: async () => {
        throw new Error("still poisoned")
      },
    },
  })

  assert.equal(processed, 1)
  assert.equal(deliveries[0].status, "failed_permanent")
  assert.equal(deliveries[0].attempts, 5)
  assert.equal(deliveries[0].processing_started_at, null)
  assert.equal(deliveries[0].next_attempt_at, null)
  assert.equal(deliveries[0].last_error, "still poisoned")
  assert.equal(deliveries[1].status, "pending")
})

test("queued funnel delivery bypasses profile lookup and still runs after enqueue flags turn off", async () => {
  const { deliveries, selections, supabase } = createSupabaseStub()
  const event = await createBillingAnalyticsEvent(
    supabase,
    {
      eventKey: "stripe:purchase_completed:cs_funnel",
      eventName: "purchase_completed",
      userId: "user-123",
      provider: "stripe",
      sourceObjectId: "cs_funnel",
      occurredAt: "2026-07-18T10:00:00.000Z",
      payload: { funnel_session_id: "session-1" },
    },
    { dispatch: false, destinations: ["funnel"] },
  )
  const previousAttribution = process.env.FUNNEL_ATTRIBUTION_ENABLED
  const previousDelivery = process.env.BILLING_FUNNEL_DELIVERY_ENABLED
  process.env.FUNNEL_ATTRIBUTION_ENABLED = "false"
  process.env.BILLING_FUNNEL_DELIVERY_ENABLED = "false"

  try {
    await dispatchBillingAnalyticsEvent(supabase, event, ["funnel"], {
      findProfile: async () => {
        throw new Error("funnel must not load profile")
      },
      deliver: async (destination, input) => {
        assert.equal(destination, "funnel")
        assert.equal(input.profile, null)
        return { ok: true }
      },
    })

    assert.equal(deliveries[0].status, "delivered")
    assert.equal(
      selections.some((selection) => selection.table === "profiles"),
      false,
    )
  } finally {
    if (previousAttribution === undefined) delete process.env.FUNNEL_ATTRIBUTION_ENABLED
    else process.env.FUNNEL_ATTRIBUTION_ENABLED = previousAttribution
    if (previousDelivery === undefined) delete process.env.BILLING_FUNNEL_DELIVERY_ENABLED
    else process.env.BILLING_FUNNEL_DELIVERY_ENABLED = previousDelivery
  }
})

test("permanent delivery results stop after the first attempt", async () => {
  const { deliveries, supabase } = createSupabaseStub()
  const event = await createBillingAnalyticsEvent(
    supabase,
    {
      eventKey: "stripe:purchase_completed:invalid-funnel",
      eventName: "purchase_completed",
      userId: "user-123",
      provider: "stripe",
      sourceObjectId: "invalid-funnel",
      occurredAt: "2026-07-18T10:00:00.000Z",
      payload: {},
    },
    { dispatch: false, destinations: ["funnel"] },
  )

  await dispatchBillingAnalyticsEvent(supabase, event, ["funnel"], {
    deliver: async () => ({ ok: false, permanent: true, error: "invalid funnel data" }),
  })

  assert.equal(deliveries[0].status, "failed_permanent")
  assert.equal(deliveries[0].attempts, 1)
  assert.equal(deliveries[0].next_attempt_at, null)
  assert.equal(deliveries[0].last_error, "invalid funnel data")
})

test("OpenAI queues only new trial/first purchase events and never backfills a duplicate", async () => {
  const previous = process.env.OPENAI_ADS_ENABLED
  process.env.OPENAI_ADS_ENABLED = "true"
  try {
    for (const eventName of [
      "trial_started",
      "purchase_completed",
      "payment_completed",
      "subscription_updated",
    ] as const) {
      const { supabase, deliveries } = createSupabaseStub()
      const input = {
        eventKey: `stripe:${eventName}:openai-fixture`,
        eventName,
        userId: "user-123",
        provider: "stripe" as const,
        occurredAt: new Date().toISOString(),
        payload: {
          trial_analytics_version: 1,
          trial_authorized_at: new Date().toISOString(),
          value: eventName === "trial_started" ? 0 : 9.99,
          currency: "EUR",
          attempt_phase: "first_paid",
          funnel_session_id: "11111111-1111-4111-8111-111111111111",
        },
      }
      await createBillingAnalyticsEvent(supabase, input, { dispatch: false })
      assert.equal(
        deliveries.some((row) => row.destination === "openai"),
        eventName === "trial_started" || eventName === "purchase_completed",
      )
      const openaiIndex = deliveries.findIndex((row) => row.destination === "openai")
      if (openaiIndex >= 0) deliveries.splice(openaiIndex, 1)
      await createBillingAnalyticsEvent(supabase, input, { dispatch: false })
      assert.equal(
        deliveries.some((row) => row.destination === "openai"),
        false,
      )
    }
  } finally {
    if (previous === undefined) delete process.env.OPENAI_ADS_ENABLED
    else process.env.OPENAI_ADS_ENABLED = previous
  }
})

test("OpenAI skips are terminal and counted without reading a customer profile", async () => {
  const { supabase, deliveries } = createSupabaseStub()
  const event = await createBillingAnalyticsEvent(
    supabase,
    {
      eventKey: "stripe:purchase_completed:openai-skip",
      eventName: "purchase_completed",
      userId: "user-123",
      provider: "stripe",
      occurredAt: new Date().toISOString(),
      payload: {
        value: 9.99,
        currency: "EUR",
        funnel_session_id: "11111111-1111-4111-8111-111111111111",
      },
    },
    { dispatch: false, destinations: ["openai"] },
  )
  let calls = 0
  const stats = await dispatchBillingAnalyticsDueWithStats(supabase, {
    destination: "openai",
    eventKey: event.event_key,
    dependencies: {
      findProfile: async () => {
        assert.fail("OpenAI must not read contact profiles")
      },
      deliver: async () => {
        calls++
        return { ok: false, skipped: true, error: "consent_denied" }
      },
    },
  })
  assert.deepEqual(stats, { processed: 1, delivered: 0, failed: 0, skipped: 1 })
  assert.equal(deliveries[0].status, "skipped")
  assert.equal(deliveries[0].next_attempt_at, null)
  assert.equal(deliveries[0].delivered_at, null)
  await dispatchBillingAnalyticsEvent(supabase, event, ["openai"], {
    deliver: async () => {
      calls++
      return { ok: true }
    },
  })
  assert.equal(calls, 1)
})

test("Node dispatch leaves all Supabase-owned Slack states untouched", async () => {
  for (const status of [
    "pending",
    "failed",
    "processing",
    "delivered",
    "failed_permanent",
    "skipped",
  ] as const) {
    const { supabase, deliveries } = createSupabaseStub()
    const event = await createBillingAnalyticsEvent(
      supabase,
      {
        eventKey: `stripe:purchase_completed:slack-${status}`,
        eventName: "purchase_completed",
        userId: "user-123",
        provider: "stripe",
        occurredAt: new Date().toISOString(),
        payload: { value: 9.99, currency: "EUR" },
      },
      { dispatch: false, destinations: ["posthog"] },
    )
    const row = deliveries[0]
    row.destination = "slack"
    row.status = status
    row.attempts = 2
    row.processing_started_at = "2020-01-01T00:00:00Z"
    const before = structuredClone(row)
    let calls = 0
    const dependencies = {
      deliver: async () => {
        calls++
        return { ok: true }
      },
    }
    await dispatchBillingAnalyticsDueWithStats(supabase, { destination: "slack", dependencies })
    await dispatchBillingAnalyticsEvent(supabase, event, ["slack"], dependencies)
    assert.equal(calls, 0)
    assert.deepEqual(row, before)
  }
})
