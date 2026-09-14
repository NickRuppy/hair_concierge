import assert from "node:assert/strict"
import test from "node:test"
import { resolveBillingTrialAccess } from "../src/lib/billing/trial-access-projection"

const ENROLLMENT_ID = "enrollment-123"
const AUTHORIZED_AT = "2026-09-13T12:00:00.000Z"
const TRIAL_END_AT = "2026-09-20T12:00:00.000Z"

function facts(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 1,
    enrollmentId: ENROLLMENT_ID,
    admissionStatus: "active",
    authorizationSucceededAt: AUTHORIZED_AT,
    originalTrialEndAt: TRIAL_END_AT,
    firstPaymentSucceededAt: null,
    paidThroughAt: null,
    renewalGraceEndsAt: null,
    renewalPaymentFailed: false,
    cancelAtPeriodEnd: false,
    accessRevoked: false,
    ...overrides,
  }
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    trial_enrollment_id: ENROLLMENT_ID,
    trial_access_facts: facts(),
    metadata: { trial_cohort: "trial_v1" },
    ...overrides,
  }
}

test("leaves only a completely unmarked legacy billing row to legacy access handling", () => {
  assert.equal(resolveBillingTrialAccess({}, new Date(AUTHORIZED_AT)), null)
  assert.equal(
    resolveBillingTrialAccess({ metadata: { trial_cohort: null } }, new Date(AUTHORIZED_AT)),
    null,
  )
})

test("uses the existing policy at the exact seven-day boundary without an injected 24-hour grace", () => {
  assert.deepEqual(resolveBillingTrialAccess(row(), new Date(AUTHORIZED_AT)), {
    hasAccess: true,
    phase: "trial",
    reason: "trial_active",
  })
  assert.deepEqual(resolveBillingTrialAccess(row(), new Date(TRIAL_END_AT)), {
    hasAccess: false,
    phase: "locked",
    reason: "trial_expired_without_payment",
  })
})

test("fails closed for cohort rows whose projection is missing, malformed, or linked to another enrollment", () => {
  const missingAccessRevoked = facts()
  delete missingAccessRevoked.accessRevoked

  for (const invalid of [
    row({ trial_access_facts: undefined }),
    row({ trial_access_facts: [] }),
    row({ trial_access_facts: missingAccessRevoked }),
    row({ trial_access_facts: facts({ version: 2 }) }),
    row({ trial_access_facts: facts({ enrollmentId: "another-enrollment" }) }),
    row({ trial_access_facts: facts({ authorizationSucceededAt: 123 }) }),
    row({ trial_access_facts: facts({ renewalPaymentFailed: "false" }) }),
  ]) {
    assert.deepEqual(resolveBillingTrialAccess(invalid, new Date(AUTHORIZED_AT)), {
      hasAccess: false,
      phase: "locked",
      reason: "invalid_facts",
    })
  }
})

test("never grants access before admission becomes active, even with injected paid facts", () => {
  for (const admissionStatus of ["reserved", "blocked", "released"] as const) {
    const access = resolveBillingTrialAccess(
      row({
        trial_access_facts: facts({
          admissionStatus,
          firstPaymentSucceededAt: AUTHORIZED_AT,
          paidThroughAt: "2026-10-13T12:00:00.000Z",
        }),
      }),
      new Date(AUTHORIZED_AT),
    )
    assert.deepEqual(
      access,
      admissionStatus === "reserved"
        ? { hasAccess: false, phase: "awaiting_authorization", reason: "authorization_pending" }
        : { hasAccess: false, phase: "locked", reason: "invalid_facts" },
    )
  }
})

test("delegates paid and renewal-grace decisions to the existing policy", () => {
  const paid = resolveBillingTrialAccess(
    row({
      trial_access_facts: facts({
        firstPaymentSucceededAt: "2026-09-20T12:00:00.000Z",
        paidThroughAt: "2026-10-20T12:00:00.000Z",
        renewalGraceEndsAt: "2026-09-27T12:00:00.000Z",
        renewalPaymentFailed: true,
      }),
    }),
    new Date("2026-09-21T12:00:00.000Z"),
  )
  assert.deepEqual(paid, { hasAccess: true, phase: "paid", reason: "paid_active" })

  const grace = resolveBillingTrialAccess(
    row({
      trial_access_facts: facts({
        firstPaymentSucceededAt: "2026-08-20T12:00:00.000Z",
        paidThroughAt: "2026-09-20T12:00:00.000Z",
        renewalGraceEndsAt: "2026-09-27T12:00:00.000Z",
        renewalPaymentFailed: true,
      }),
    }),
    new Date("2026-09-21T12:00:00.000Z"),
  )
  assert.deepEqual(grace, {
    hasAccess: true,
    phase: "renewal_grace",
    reason: "renewal_grace_active",
  })
})

test("treats user-editable cohort markers and boolean strings as invalid rather than legacy or truth", () => {
  for (const invalid of [
    { metadata: { trial_cohort: "user_controlled" } },
    row({ metadata: { trial_cohort: false } }),
    row({ trial_access_facts: facts({ accessRevoked: "false" }) }),
  ]) {
    assert.deepEqual(resolveBillingTrialAccess(invalid, new Date(AUTHORIZED_AT)), {
      hasAccess: false,
      phase: "locked",
      reason: "invalid_facts",
    })
  }
})
