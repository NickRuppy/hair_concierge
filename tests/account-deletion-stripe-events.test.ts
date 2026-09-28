import assert from "node:assert/strict"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cancelDeletedAccountStripeSubscription } from "../src/lib/stripe/deleted-account"

const LEAD = "11111111-1111-4111-8111-111111111111"
const ENROLLMENT = "22222222-2222-4222-8222-222222222222"

function fakes(input: { anonymized: Record<string, boolean>; status: string }) {
  const reads: string[] = []
  const cancelled: unknown[] = []
  const reports: unknown[] = []
  const recorded: string[] = []
  const supabase = {
    from(table: string) {
      let id = ""
      const builder = {
        select: () => builder,
        eq: (_: string, value: string) => ((id = value), builder),
        maybeSingle: async () => {
          reads.push(`${table}:${id}`)
          return {
            data: { anonymized_at: input.anonymized[id] ? "2026-09-27T10:00:00Z" : null },
            error: null,
          }
        },
      }
      return builder
    },
  } as unknown as SupabaseClient
  const stripe = {
    subscriptions: {
      retrieve: async () => ({ status: input.status }),
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
    recordRefund: async (id: string) => void recorded.push(id),
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
    assert.deepEqual(f.reports, [{ provider: "stripe", eventType: "checkout.session.completed" }])
  }
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
      { p_provider: "stripe", p_subscription_id: "sub_1" },
    ],
  ])
  assert.deepEqual(f.cancelled, [])
})
