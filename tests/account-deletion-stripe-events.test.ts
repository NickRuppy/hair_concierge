import assert from "node:assert/strict"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cancelDeletedAccountStripeSubscription } from "../src/lib/stripe/deleted-account"

const LEAD = "11111111-1111-4111-8111-111111111111"
const ENROLLMENT = "22222222-2222-4222-8222-222222222222"

const DELETED_AT = "2026-09-27T10:00:00Z"

function fakes(input: {
  anonymized: Record<string, boolean>
  status: string
  live?: { billing?: boolean; profile?: boolean }
  /** N2: the record RPC's result and the kind of an existing refund row. */
  recorded?: boolean
  existingKind?: "deletion" | "post_deletion" | null
}) {
  const reads: string[] = []
  const cancelled: unknown[] = []
  const reports: unknown[] = []
  const recorded: string[] = []
  const recordedFrom: string[] = []
  const kindReads: string[] = []
  const notRecorded: unknown[] = []
  const supabase = {
    from(table: string) {
      let id = ""
      const builder = {
        select: () => builder,
        eq: (_: string, value: string) => ((id = value), builder),
        maybeSingle: async () => {
          reads.push(`${table}:${id}`)
          if (table === "billing_subscriptions")
            return { data: input.live?.billing ? { id: "billing-1" } : null, error: null }
          if (table === "profiles")
            return { data: input.live?.profile ? { id: "user-live" } : null, error: null }
          return {
            data: { anonymized_at: input.anonymized[id] ? DELETED_AT : null },
            error: null,
          }
        },
      }
      return builder
    },
  } as unknown as SupabaseClient
  const stripe = {
    subscriptions: {
      retrieve: async () => ({ status: input.status, customer: "cus_payer" }),
      cancel: async (id: string, params: unknown) => {
        // R-a: the full refund is recorded before the cancel.
        assert.deepEqual(recorded, [id])
        cancelled.push([id, params])
      },
    },
  } as never
  return {
    supabase,
    stripe,
    reads,
    cancelled,
    reports,
    recorded,
    report: (d: unknown) => void reports.push(d),
    recordedFrom,
    recordRefund: async (id: string, from: string) => {
      recorded.push(id)
      recordedFrom.push(from)
      return input.recorded ?? true
    },
    kindReads,
    refundKind: async (id: string) => {
      kindReads.push(id)
      return input.existingKind ?? null
    },
    notRecorded,
    reportRefundNotRecorded: (d: unknown) => void notRecorded.push(d),
  }
}

test("a live subscription of a deleted account is cancelled at once and reported", async () => {
  const cases: Record<string, string>[] = [
    { lead_id: LEAD },
    { trial_cohort: "trial_v1", trial_enrollment_id: ENROLLMENT },
  ]
  for (const metadata of cases) {
    const f = fakes({ anonymized: { [LEAD]: true, [ENROLLMENT]: true }, status: "active" })
    assert.equal(
      await cancelDeletedAccountStripeSubscription(
        { eventType: "checkout.session.completed", subscriptionId: "sub_1", metadata },
        { supabase: f.supabase, stripe: f.stripe, report: f.report, recordRefund: f.recordRefund },
      ),
      true,
    )
    assert.deepEqual(f.cancelled, [["sub_1", { prorate: false, invoice_now: false }]])
    assert.deepEqual(f.recorded, ["sub_1"])
    // I-2: only payments from the deletion (anonymization) on are refunded.
    assert.deepEqual(f.recordedFrom, [DELETED_AT])
    assert.deepEqual(f.reports, [{ provider: "stripe", eventType: "checkout.session.completed" }])
  }
})

test("N2: a no-op refund record still cancels; reported unless the row is the post-deletion refund already", async () => {
  const run = async (existingKind: "deletion" | "post_deletion" | null) => {
    const f = fakes({
      anonymized: { [LEAD]: true },
      status: "active",
      recorded: false,
      existingKind,
    })
    assert.equal(
      await cancelDeletedAccountStripeSubscription(
        {
          eventType: "customer.subscription.updated",
          subscriptionId: "sub_1",
          metadata: { lead_id: LEAD },
        },
        {
          supabase: f.supabase,
          stripe: f.stripe,
          report: f.report,
          recordRefund: f.recordRefund,
          refundKind: f.refundKind,
          reportRefundNotRecorded: f.reportRefundNotRecorded,
        },
      ),
      true,
    )
    assert.deepEqual(f.cancelled, [["sub_1", { prorate: false, invoice_now: false }]])
    assert.deepEqual(f.kindReads, ["sub_1"])
    return f.notRecorded
  }
  // A retried webhook: its own post-deletion row already exists — nothing to report.
  assert.deepEqual(await run("post_deletion"), [])
  // A deletion row that could not be taken over (e.g. paid out already): an operator checks.
  assert.deepEqual(await run("deletion"), [
    { provider: "stripe", eventType: "customer.subscription.updated", existingKind: "deletion" },
  ])
  assert.deepEqual(await run(null), [
    { provider: "stripe", eventType: "customer.subscription.updated", existingKind: "none" },
  ])
  // Recorded: no kind lookup, no report.
  const ok = fakes({ anonymized: { [LEAD]: true }, status: "active" })
  await cancelDeletedAccountStripeSubscription(
    {
      eventType: "checkout.session.completed",
      subscriptionId: "sub_1",
      metadata: { lead_id: LEAD },
    },
    {
      supabase: ok.supabase,
      stripe: ok.stripe,
      report: ok.report,
      recordRefund: ok.recordRefund,
      refundKind: ok.refundKind,
      reportRefundNotRecorded: ok.reportRefundNotRecorded,
    },
  )
  assert.deepEqual(ok.kindReads, [])
  assert.deepEqual(ok.notRecorded, [])
})

test("N2: the record helper returns the RPC boolean and the kind is read by RPC", async () => {
  const f = fakes({ anonymized: { [LEAD]: true }, status: "active" })
  const calls: unknown[] = []
  const notRecorded: unknown[] = []
  const supabase = Object.assign(Object.create(f.supabase), {
    from: f.supabase.from.bind(f.supabase),
    rpc: async (name: string, args: unknown) => {
      calls.push([name, args])
      if (name === "account_deletion_record_post_deletion_refund")
        return { data: false, error: null }
      return { data: "deletion", error: null }
    },
  }) as SupabaseClient
  const stripe = {
    subscriptions: {
      retrieve: async () => ({ status: "active", customer: "cus_payer" }),
      cancel: async (id: string) => void f.cancelled.push(id),
    },
  } as never
  await cancelDeletedAccountStripeSubscription(
    {
      eventType: "checkout.session.completed",
      subscriptionId: "sub_1",
      metadata: { lead_id: LEAD },
    },
    {
      supabase,
      stripe,
      report: f.report,
      reportRefundNotRecorded: (d) => void notRecorded.push(d),
    },
  )
  assert.deepEqual(calls, [
    [
      "account_deletion_record_post_deletion_refund",
      { p_provider: "stripe", p_subscription_id: "sub_1", p_payments_from: DELETED_AT },
    ],
    ["account_deletion_web_refund_kind", { p_provider: "stripe", p_subscription_id: "sub_1" }],
  ])
  assert.deepEqual(f.cancelled, ["sub_1"])
  assert.deepEqual(notRecorded, [
    { provider: "stripe", eventType: "checkout.session.completed", existingKind: "deletion" },
  ])
})

test("an ended subscription of a deleted account is acknowledged without a cancel", async () => {
  const f = fakes({ anonymized: { [LEAD]: true }, status: "canceled" })
  assert.equal(
    await cancelDeletedAccountStripeSubscription(
      {
        eventType: "customer.subscription.updated",
        subscriptionId: "sub_1",
        metadata: { lead_id: LEAD },
      },
      { supabase: f.supabase, stripe: f.stripe, report: f.report, recordRefund: f.recordRefund },
    ),
    true,
  )
  assert.deepEqual(f.cancelled, [])
  assert.deepEqual(f.reports, [])
  assert.deepEqual(f.recorded, [], "an ended subscription is not refunded by this path")
})

test("live accounts and events without deletion markers pass through untouched", async () => {
  const live = fakes({ anonymized: {}, status: "active" })
  assert.equal(
    await cancelDeletedAccountStripeSubscription(
      {
        eventType: "checkout.session.completed",
        subscriptionId: "sub_1",
        metadata: { lead_id: LEAD },
      },
      {
        supabase: live.supabase,
        stripe: live.stripe,
        report: live.report,
        recordRefund: live.recordRefund,
      },
    ),
    false,
  )
  assert.deepEqual(live.cancelled, [])
  assert.deepEqual(live.recorded, [])
  const bare = fakes({ anonymized: {}, status: "active" })
  assert.equal(
    await cancelDeletedAccountStripeSubscription(
      {
        eventType: "checkout.session.completed",
        subscriptionId: "sub_1",
        metadata: { lead_id: "not-a-uuid" },
      },
      {
        supabase: bare.supabase,
        stripe: bare.stripe,
        report: bare.report,
        recordRefund: bare.recordRefund,
      },
    ),
    false,
  )
  assert.deepEqual(bare.reads, [])
})

test("R-a: a failed refund record keeps the subscription live and the webhook retryable", async () => {
  const f = fakes({ anonymized: { [LEAD]: true }, status: "active" })
  const calls: unknown[] = []
  const supabase = Object.assign(Object.create(f.supabase), {
    from: f.supabase.from.bind(f.supabase),
    rpc: async (name: string, args: unknown) => {
      calls.push([name, args])
      return { data: null, error: { message: "db down" } }
    },
  }) as SupabaseClient
  await assert.rejects(
    cancelDeletedAccountStripeSubscription(
      {
        eventType: "checkout.session.completed",
        subscriptionId: "sub_1",
        metadata: { lead_id: LEAD },
      },
      { supabase, stripe: f.stripe, report: f.report },
    ),
    /Post-deletion refund could not be recorded/,
  )
  assert.deepEqual(calls, [
    [
      "account_deletion_record_post_deletion_refund",
      { p_provider: "stripe", p_subscription_id: "sub_1", p_payments_from: DELETED_AT },
    ],
  ])
  assert.deepEqual(f.cancelled, [])
})

test("I-2: a subscription bound to a live account is left to normal processing (no cancel, no refund)", async () => {
  for (const live of [{ profile: true }, { billing: true }]) {
    // e.g. the lead was anonymized only by an email match with a deleted account.
    const f = fakes({ anonymized: { [LEAD]: true }, status: "active", live })
    assert.equal(
      await cancelDeletedAccountStripeSubscription(
        {
          eventType: "checkout.session.completed",
          subscriptionId: "sub_1",
          metadata: { lead_id: LEAD },
        },
        { supabase: f.supabase, stripe: f.stripe, report: f.report, recordRefund: f.recordRefund },
      ),
      false,
      JSON.stringify(live),
    )
    assert.deepEqual(f.cancelled, [])
    assert.deepEqual(f.recorded, [])
    assert.deepEqual(f.reports, [])
  }
})
