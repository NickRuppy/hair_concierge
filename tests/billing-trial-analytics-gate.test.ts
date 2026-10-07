import assert from "node:assert/strict"
import test from "node:test"

import {
  isTrialAnalyticsCandidate,
  resolveTrialStartedAnalytics,
} from "../src/lib/billing/trial-analytics"

const enrollmentId = "trial-enrollment-1"
const authorizationSucceededAt = "2026-09-14T10:00:00.000Z"
const trialEndAt = "2026-09-21T10:00:00.000Z"

test("admits a trial_started payload only from a matching canonical activation result", () => {
  assert.deepEqual(
    resolveTrialStartedAnalytics({
      activation: { trialEnrollmentId: enrollmentId, authorizationSucceededAt, trialEndAt },
      interval: "year",
      session: {
        currency: "eur",
        metadata: { trial_cohort: "trial_v1", trial_enrollment_id: enrollmentId },
      },
    }),
    {
      authorizationSucceededAt,
      currency: "EUR",
      enrollmentId,
      interval: "year",
      trialEndAt,
      value: 0,
    },
  )
})

test("rejects marker-only, mismatched, malformed, and non-trial checkout inputs", () => {
  const activation = { trialEnrollmentId: enrollmentId, authorizationSucceededAt, trialEndAt }
  const base = {
    activation,
    interval: "month",
    session: {
      currency: "eur",
      metadata: { trial_cohort: "trial_v1", trial_enrollment_id: enrollmentId },
    },
  }

  assert.equal(resolveTrialStartedAnalytics({ ...base, activation: {} }), null)
  assert.equal(
    resolveTrialStartedAnalytics({
      ...base,
      session: {
        ...base.session,
        metadata: { trial_cohort: "trial_v1", trial_enrollment_id: "other" },
      },
    }),
    null,
  )
  assert.equal(
    resolveTrialStartedAnalytics({
      ...base,
      activation: { ...activation, trialEndAt: authorizationSucceededAt },
    }),
    null,
  )
  assert.equal(
    resolveTrialStartedAnalytics({
      ...base,
      session: { ...base.session, metadata: { trial_cohort: "trial_v1" } },
    }),
    null,
  )
  assert.equal(resolveTrialStartedAnalytics({ ...base, interval: "quarter" }), null)
  assert.equal(
    resolveTrialStartedAnalytics({
      ...base,
      session: { ...base.session, currency: "usd" },
    }),
    null,
  )
  assert.equal(
    resolveTrialStartedAnalytics({
      ...base,
      session: { ...base.session, currency: "eur" },
      activation: { ...activation, trialEndAt: "2026-09-21T10:00:00.001Z" },
    }),
    null,
  )
})

test("classifies every trial marker and canonical enrollment as fail-closed candidates", () => {
  assert.equal(
    isTrialAnalyticsCandidate({
      activation: {},
      session: { metadata: { trial_offer_version: "v1" } },
    }),
    true,
  )
  assert.equal(
    isTrialAnalyticsCandidate({
      activation: { trialEnrollmentId: enrollmentId },
      session: { metadata: {} },
    }),
    true,
  )
  assert.equal(isTrialAnalyticsCandidate({ activation: {}, session: { metadata: {} } }), false)
})
