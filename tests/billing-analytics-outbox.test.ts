import assert from "node:assert/strict"
import test from "node:test"

import {
  createBillingAnalyticsEvent,
  dispatchBillingAnalyticsDue,
  dispatchBillingAnalyticsEvent,
} from "../src/lib/billing/analytics-outbox"
import type {
  BillingAnalyticsDeliveryRow,
  BillingAnalyticsOutboxRow,
  SupabaseBillingClient,
} from "../src/lib/billing/types"

function createSupabaseStub() {
  const outbox: BillingAnalyticsOutboxRow[] = []
  const deliveries: BillingAnalyticsDeliveryRow[] = []
  const profiles = [{ id: "user-123", email: "buyer@example.com" }]

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
      select() {
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
      maybeSingle: async () => ({
        data: applySelection()[0] ?? null,
        error: null,
      }),
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
    supabase: { from: makeQuery } as unknown as SupabaseBillingClient,
  }
}

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
