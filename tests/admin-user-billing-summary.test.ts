import assert from "node:assert/strict"
import test from "node:test"
import { summarizeAdminUserBilling } from "../src/lib/billing/admin-user-summary"
import type { BillingSubscriptionRow } from "../src/lib/billing/types"

const NOW = new Date("2026-09-22T12:00:00.000Z")
const ENROLLMENT_ID = "9f8b8a1e-0000-4000-8000-000000000001"

function subscriptionRow(overrides: Partial<BillingSubscriptionRow> = {}): BillingSubscriptionRow {
  return {
    id: "sub-1",
    user_id: "user-1",
    provider: "paypal",
    provider_customer_id: null,
    provider_subscriber_email: "payer@example.com",
    provider_subscription_id: "I-TEST",
    provider_status: "ACTIVE",
    entitlement_status: "active",
    interval: "month",
    current_period_end: null,
    cancel_at_period_end: false,
    cancel_scheduled_at: null,
    cancelled_at: null,
    trial_enrollment_id: null,
    trial_access_facts: null,
    metadata: {},
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  }
}

function trialFacts(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    enrollmentId: ENROLLMENT_ID,
    admissionStatus: "active",
    authorizationSucceededAt: "2026-09-15T10:00:00.000Z",
    originalTrialEndAt: "2026-09-29T10:00:00.000Z",
    firstPaymentSucceededAt: null,
    paidThroughAt: null,
    renewalGraceEndsAt: null,
    renewalPaymentFailed: false,
    cancelAtPeriodEnd: false,
    accessRevoked: false,
    ...overrides,
  }
}

function trialRow(factsOverrides: Record<string, unknown> = {}) {
  return subscriptionRow({
    trial_enrollment_id: ENROLLMENT_ID,
    trial_access_facts: trialFacts(factsOverrides),
  })
}

test("no subscription row summarizes as none", () => {
  assert.deepEqual(summarizeAdminUserBilling(null, NOW), {
    status: "none",
    trial_ends_at: null,
    period_end: null,
    provider_subscriber_email: null,
  })
})

test("active trial reports trial status with the trial end date", () => {
  const summary = summarizeAdminUserBilling(trialRow(), NOW)
  assert.equal(summary.status, "trial")
  assert.equal(summary.trial_ends_at, "2026-09-29T10:00:00.000Z")
})

test("trial canceled before its end reports trial_canceled and keeps the end date", () => {
  const summary = summarizeAdminUserBilling(trialRow({ cancelAtPeriodEnd: true }), NOW)
  assert.equal(summary.status, "trial_canceled")
  assert.equal(summary.trial_ends_at, "2026-09-29T10:00:00.000Z")
})

test("converted trial reports active with paid-through as period end", () => {
  const summary = summarizeAdminUserBilling(
    trialRow({
      originalTrialEndAt: "2026-09-20T10:00:00.000Z",
      firstPaymentSucceededAt: "2026-09-21T10:00:00.000Z",
      paidThroughAt: "2026-10-21T10:00:00.000Z",
    }),
    NOW,
  )
  assert.equal(summary.status, "active")
  assert.equal(summary.trial_ends_at, null)
  assert.equal(summary.period_end, "2026-10-21T10:00:00.000Z")
})

test("converted trial with pending cancellation reports canceled_at_period_end", () => {
  const summary = summarizeAdminUserBilling(
    trialRow({
      originalTrialEndAt: "2026-09-20T10:00:00.000Z",
      firstPaymentSucceededAt: "2026-09-21T10:00:00.000Z",
      paidThroughAt: "2026-10-21T10:00:00.000Z",
      cancelAtPeriodEnd: true,
    }),
    NOW,
  )
  assert.equal(summary.status, "canceled_at_period_end")
})

test("trial in renewal grace reports past_due", () => {
  const summary = summarizeAdminUserBilling(
    trialRow({
      originalTrialEndAt: "2026-07-20T10:00:00.000Z",
      authorizationSucceededAt: "2026-07-06T10:00:00.000Z",
      firstPaymentSucceededAt: "2026-07-21T10:00:00.000Z",
      paidThroughAt: "2026-09-21T10:00:00.000Z",
      renewalGraceEndsAt: "2026-09-28T10:00:00.000Z",
      renewalPaymentFailed: true,
    }),
    NOW,
  )
  assert.equal(summary.status, "past_due")
})

test("trial that ran out without payment and was canceled reports expired", () => {
  const summary = summarizeAdminUserBilling(
    trialRow({
      authorizationSucceededAt: "2026-08-15T10:00:00.000Z",
      originalTrialEndAt: "2026-08-29T10:00:00.000Z",
      cancelAtPeriodEnd: true,
    }),
    NOW,
  )
  assert.equal(summary.status, "expired")
})

test("plain active subscription reports active", () => {
  const summary = summarizeAdminUserBilling(
    subscriptionRow({ current_period_end: "2026-10-10T00:00:00.000Z" }),
    NOW,
  )
  assert.equal(summary.status, "active")
  assert.equal(summary.period_end, "2026-10-10T00:00:00.000Z")
})

test("legacy active subscription without period end reports active", () => {
  assert.equal(summarizeAdminUserBilling(subscriptionRow(), NOW).status, "active")
})

test("past_due entitlement reports past_due", () => {
  assert.equal(
    summarizeAdminUserBilling(subscriptionRow({ entitlement_status: "past_due" }), NOW).status,
    "past_due",
  )
})

test("canceled subscription with remaining access reports canceled_at_period_end", () => {
  const summary = summarizeAdminUserBilling(
    subscriptionRow({
      entitlement_status: "canceled",
      cancel_at_period_end: true,
      current_period_end: "2026-10-05T00:00:00.000Z",
    }),
    NOW,
  )
  assert.equal(summary.status, "canceled_at_period_end")
  assert.equal(summary.period_end, "2026-10-05T00:00:00.000Z")
})

test("canceled subscription past its period end reports expired", () => {
  const summary = summarizeAdminUserBilling(
    subscriptionRow({
      entitlement_status: "canceled",
      cancel_at_period_end: true,
      current_period_end: "2026-08-05T00:00:00.000Z",
    }),
    NOW,
  )
  assert.equal(summary.status, "expired")
})

test("active entitlement with lapsed period end reports expired", () => {
  const summary = summarizeAdminUserBilling(
    subscriptionRow({ current_period_end: "2026-08-05T00:00:00.000Z" }),
    NOW,
  )
  assert.equal(summary.status, "expired")
})
