import assert from "node:assert/strict"
import test from "node:test"
import {
  buildTrialMembershipState,
  readTrialMembershipState,
} from "../src/lib/billing/trial-membership"
import { readMembershipResponse } from "../src/app/api/billing/membership/route"
import type { SupabaseClient } from "@supabase/supabase-js"

const userId = "11111111-1111-4111-8111-111111111111"
const enrollment = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: userId,
  admission_status: "active",
  authorization_succeeded_at: "2026-09-13T10:30:00.000Z",
  original_trial_end_at: "2026-09-20T10:30:00.000Z",
  first_payment_succeeded_at: null,
  paid_through_at: null,
  renewal_grace_ends_at: null,
  renewal_payment_failed: false,
  cancel_at_period_end: false,
  access_revoked: false,
  accepted_offer: {
    cohort: "trial_v1",
    offerVersion: "trial_launch_v1",
    interval: "year",
    currency: "EUR",
    trialDays: 7,
    firstAmountMinor: 6999,
    renewalAmountMinor: 9999,
    taxBehavior: "inclusive",
    stripePriceId: "price_accepted",
    stripeCouponId: "coupon_accepted",
  },
}
const now = new Date("2026-09-16T12:00:00Z")
const effectiveContractRpc = async (name: string) => {
  assert.equal(name, "read_trial_effective_contract")
  return {
    data: {
      accepted_offer: enrollment.accepted_offer,
      provider: "stripe",
      provider_agreement_id: "sub_trial",
      revision: 0,
    },
    error: null,
  }
}

test("membership reads accepted prices and original deadline without exposing provider identifiers", () => {
  assert.deepEqual(buildTrialMembershipState(enrollment, userId, now), {
    kind: "trial_membership",
    enrollmentId: enrollment.id,
    phase: "trial",
    interval: "year",
    originalTrialEndAt: "2026-09-20T10:30:00.000Z",
    paidThroughAt: null,
    firstPaymentSucceededAt: null,
    cancelAtPeriodEnd: false,
    canCancelTrial: true,
    firstAmountMinor: 6999,
    renewalAmountMinor: 9999,
    currency: "EUR",
  })
})

test("saved cancellation keeps access until the exact original deadline and disables another declaration", () => {
  for (const [at, phase] of [
    ["2026-09-20T10:29:59Z", "trial"],
    ["2026-09-20T10:30:00Z", "locked"],
  ]) {
    const result = buildTrialMembershipState(
      { ...enrollment, cancel_at_period_end: true },
      userId,
      new Date(at),
    )
    assert.equal(result.kind, "trial_membership")
    if (result.kind !== "trial_membership") throw new Error("missing state")
    assert.equal(result.phase, phase)
    assert.equal(result.canCancelTrial, false)
    assert.equal(result.cancelAtPeriodEnd, true)
  }
})

test("paid new-cohort membership cannot enter the free-trial cancellation flow", () => {
  const result = buildTrialMembershipState(
    {
      ...enrollment,
      first_payment_succeeded_at: "2026-09-20T10:30:00Z",
      paid_through_at: "2027-09-20T10:30:00Z",
    },
    userId,
    new Date("2026-09-21T00:00:00Z"),
  )
  assert.equal(result.kind, "trial_membership")
  if (result.kind !== "trial_membership") throw new Error("missing state")
  assert.equal(result.phase, "paid")
  assert.equal(result.canCancelTrial, false)
})

test("mismatched owners, corrupt accepted offers and incomplete facts fail closed", () => {
  for (const value of [
    null,
    { ...enrollment, user_id: "another-user" },
    { ...enrollment, accepted_offer: {} },
    { ...enrollment, original_trial_end_at: null },
    { ...enrollment, cancel_at_period_end: "false" },
    { ...enrollment, admission_status: "blocked" },
  ]) {
    assert.deepEqual(buildTrialMembershipState(value, userId, now), { kind: "uncertain" })
  }
})

test("read scopes an enrollment to the authenticated owner and preserves expired status", async () => {
  const filters: unknown[] = []
  const query = {
    select: () => query,
    eq: (key: string, value: string) => {
      filters.push([key, value])
      return query
    },
    maybeSingle: async () => ({ data: enrollment, error: null }),
  }
  const admin = {
    rpc: effectiveContractRpc,
    from: (table: string) => {
      assert.equal(table, "trial_enrollments")
      return query
    },
  } as unknown as SupabaseClient
  const result = await readTrialMembershipState(
    admin,
    userId,
    enrollment.id,
    new Date("2026-09-21T00:00:00Z"),
  )
  assert.deepEqual(filters, [
    ["user_id", userId],
    ["id", enrollment.id],
  ])
  assert.equal(result?.kind, "trial_membership")
  if (result?.kind === "trial_membership") assert.equal(result.phase, "locked")
})

test("composed membership read prefers expired trial facts to a stale active compatibility profile", async () => {
  const tables: string[] = []
  const admin = {
    rpc: effectiveContractRpc,
    from(table: string) {
      tables.push(table)
      const data =
        table === "trial_enrollments"
          ? enrollment
          : table === "profiles"
            ? { subscription_status: "active", current_period_end: "2026-09-20T10:30:00Z" }
            : []
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        order: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data, error: null }),
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve({ data, error: null }).then(resolve)
        },
      }
      return query
    },
  } as unknown as SupabaseClient
  const response = await readMembershipResponse(
    { id: userId },
    admin,
    new Date("2026-09-20T10:30:01Z"),
  )
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.state.kind, "trial_membership")
  assert.equal(body.state.phase, "locked")
  assert.equal(tables.includes("profiles"), false)
  assert.equal(tables.includes("billing_plan_changes"), false)
})

test("legacy and manual membership responses remain unchanged without a trial", async () => {
  for (const manual of [false, true]) {
    const admin = {
      from(table: string) {
        const data =
          table === "trial_enrollments"
            ? null
            : table === "profiles"
              ? { subscription_status: "active", current_period_end: "2026-10-01T00:00:00Z" }
              : table === "manual_access_grants" && manual
                ? [
                    {
                      id: "grant",
                      user_id: userId,
                      email: null,
                      expires_at: null,
                      revoked_at: null,
                    },
                  ]
                : []
        const query = {
          select: () => query,
          eq: () => query,
          in: () => query,
          order: () => query,
          limit: () => query,
          maybeSingle: async () => ({ data, error: null }),
          then(resolve: (value: unknown) => unknown) {
            return Promise.resolve({ data, error: null }).then(resolve)
          },
        }
        return query
      },
    } as unknown as SupabaseClient
    const response = await readMembershipResponse({ id: userId }, admin, now)
    assert.deepEqual(await response.json(), {
      state: manual
        ? { kind: "manual_grant", renewalAt: null }
        : { kind: "legacy_unmanageable", renewalAt: "2026-10-01T00:00:00Z" },
    })
  }
})
