import assert from "node:assert/strict"
import test from "node:test"

import { billingSubscriptionPayload } from "../src/lib/billing/analytics-events"
import type { BillingSubscriptionRow } from "../src/lib/billing/types"
import type { TrialAccessFacts } from "../src/lib/billing/trial-policy"

const activeTrial: Pick<
  BillingSubscriptionRow,
  | "provider_status"
  | "entitlement_status"
  | "interval"
  | "current_period_end"
  | "cancel_at_period_end"
  | "trial_enrollment_id"
  | "metadata"
> & {
  trial_access_facts: TrialAccessFacts & {
    version: 1
    enrollmentId: string
    admissionStatus: "active"
  }
} = {
  provider_status: "active",
  entitlement_status: "active" as const,
  interval: "month" as const,
  current_period_end: "2020-01-08T00:00:00Z",
  cancel_at_period_end: false,
  trial_enrollment_id: "trial-enrollment-1",
  metadata: { trial_cohort: "trial_v1" },
  trial_access_facts: {
    version: 1,
    enrollmentId: "trial-enrollment-1",
    admissionStatus: "active",
    authorizationSucceededAt: "2020-01-01T00:00:00Z",
    originalTrialEndAt: "2020-01-08T00:00:00Z",
    firstPaymentSucceededAt: null,
    paidThroughAt: null,
    renewalGraceEndsAt: null,
    renewalPaymentFailed: false,
    cancelAtPeriodEnd: false,
    accessRevoked: false,
  },
}

test("does not report an active free trial as paid access", () => {
  assert.deepEqual(
    billingSubscriptionPayload(
      activeTrial,
      {
        has_paid_access: true,
        has_app_access: false,
        trial_access_status: "paid",
        retained_extra: "yes",
      },
      new Date("2020-01-02T00:00:00Z"),
    ),
    {
      subscription_status: "active",
      provider_status: "active",
      has_paid_access: false,
      has_app_access: true,
      trial_access_status: "trial",
      interval: "month",
      current_period_end: "2020-01-08T00:00:00Z",
      cancel_at_period_end: false,
      retained_extra: "yes",
    },
  )
})

test("reports linked paid and renewal-grace access only from valid first-payment facts", () => {
  const paid = structuredClone(activeTrial)
  paid.trial_access_facts.firstPaymentSucceededAt = "2020-01-10T00:00:00Z"
  paid.trial_access_facts.paidThroughAt = "2020-02-10T00:00:00Z"

  const paidPayload = billingSubscriptionPayload(paid, {}, new Date("2020-01-15T00:00:00Z"))
  assert.ok("has_app_access" in paidPayload && "trial_access_status" in paidPayload)
  assert.equal(paidPayload.has_paid_access, true)
  assert.equal(paidPayload.has_app_access, true)
  assert.equal(paidPayload.trial_access_status, "paid")

  const grace = structuredClone(activeTrial)
  grace.trial_access_facts.firstPaymentSucceededAt = "2020-01-10T00:00:00Z"
  grace.trial_access_facts.paidThroughAt = "2020-02-10T00:00:00Z"
  grace.trial_access_facts.renewalPaymentFailed = true
  grace.trial_access_facts.renewalGraceEndsAt = "2020-02-17T00:00:00Z"

  const gracePayload = billingSubscriptionPayload(grace, {}, new Date("2020-02-11T00:00:00Z"))
  assert.ok("trial_access_status" in gracePayload)
  assert.equal(gracePayload.has_paid_access, true)
  assert.equal(gracePayload.trial_access_status, "renewal_grace")
})

test("fails closed on an invalid linked trial projection", () => {
  const invalid = { ...activeTrial, trial_access_facts: { enrollmentId: "trial-enrollment-1" } }
  const payload = billingSubscriptionPayload(invalid, {}, new Date("2020-01-02T00:00:00Z"))
  assert.ok("has_app_access" in payload && "trial_access_status" in payload)

  assert.equal(payload.has_paid_access, false)
  assert.equal(payload.has_app_access, false)
  assert.equal(payload.trial_access_status, "locked")
  assert.doesNotMatch(JSON.stringify(payload), /claim|price/i)
})

test("keeps legacy payload and extra-property behavior byte-compatible", () => {
  const legacy = {
    provider_status: "active",
    entitlement_status: "active" as const,
    interval: "year" as const,
    current_period_end: null,
    cancel_at_period_end: false,
  }

  assert.deepEqual(
    billingSubscriptionPayload(legacy, { has_paid_access: "legacy override", trace: "same" }),
    {
      subscription_status: "active",
      provider_status: "active",
      has_paid_access: "legacy override",
      interval: "year",
      current_period_end: null,
      cancel_at_period_end: false,
      trace: "same",
    },
  )
})
