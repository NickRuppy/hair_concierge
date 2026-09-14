import assert from "node:assert/strict"
import test from "node:test"
import { resolveTrialAccess, type TrialAccessFacts } from "../src/lib/billing/trial-policy"

const NOW = new Date("2026-09-20T12:00:00.000Z")

function facts(overrides: Partial<TrialAccessFacts> = {}): TrialAccessFacts {
  return {
    authorizationSucceededAt: "2026-09-13T12:00:00.000Z",
    originalTrialEndAt: "2026-09-20T12:00:00.000Z",
    firstPaymentSucceededAt: null,
    paidThroughAt: null,
    renewalGraceEndsAt: null,
    renewalPaymentFailed: false,
    cancelAtPeriodEnd: false,
    accessRevoked: false,
    ...overrides,
  }
}

test("grants trial access from authorization inclusively until the immutable end exclusively", () => {
  assert.deepEqual(resolveTrialAccess(facts(), new Date("2026-09-13T12:00:00.000Z")), {
    hasAccess: true,
    phase: "trial",
    reason: "trial_active",
  })
  assert.equal(resolveTrialAccess(facts(), NOW).hasAccess, false)
})

test("accepts valid ISO offsets and fractional seconds", () => {
  assert.deepEqual(
    resolveTrialAccess(
      facts({
        authorizationSucceededAt: "2026-09-13T14:00:00.123+02:00",
        originalTrialEndAt: "2026-09-20T14:00:00.123+02:00",
      }),
      new Date("2026-09-13T12:00:00.123Z"),
    ),
    { hasAccess: true, phase: "trial", reason: "trial_active" },
  )
})

test("does not grant access before authorization, including a future verified authorization", () => {
  const access = resolveTrialAccess(
    facts({
      authorizationSucceededAt: "2026-09-21T12:00:00.000Z",
      originalTrialEndAt: "2026-09-28T12:00:00.000Z",
    }),
    NOW,
  )
  assert.deepEqual(access, {
    hasAccess: false,
    phase: "awaiting_authorization",
    reason: "authorization_pending",
  })
  assert.deepEqual(
    resolveTrialAccess(facts({ authorizationSucceededAt: null, originalTrialEndAt: null }), NOW),
    { hasAccess: false, phase: "awaiting_authorization", reason: "authorization_pending" },
  )
})

test("a canceled trial retains access through its original end but has no expiry grace", () => {
  assert.equal(
    resolveTrialAccess(facts({ cancelAtPeriodEnd: true }), new Date("2026-09-19T12:00:00.000Z"))
      .hasAccess,
    true,
  )
  assert.deepEqual(resolveTrialAccess(facts({ cancelAtPeriodEnd: true }), NOW), {
    hasAccess: false,
    phase: "locked",
    reason: "trial_expired_without_payment",
  })
})

test("requires a successful first payment at exact trial expiry and does not grant first-conversion grace", () => {
  assert.deepEqual(
    resolveTrialAccess(
      facts({ renewalPaymentFailed: true, renewalGraceEndsAt: "2026-09-27T12:00:00.000Z" }),
      NOW,
    ),
    {
      hasAccess: false,
      phase: "locked",
      reason: "trial_expired_without_payment",
    },
  )
  assert.deepEqual(
    resolveTrialAccess(
      facts({
        firstPaymentSucceededAt: "2026-09-21T12:00:00.000Z",
        paidThroughAt: "2026-10-21T12:00:00.000Z",
      }),
      NOW,
    ),
    {
      hasAccess: false,
      phase: "locked",
      reason: "first_payment_pending",
    },
  )
})

test("grants a finite paid period even when the membership did not use a trial", () => {
  assert.deepEqual(
    resolveTrialAccess(
      facts({
        authorizationSucceededAt: null,
        originalTrialEndAt: null,
        firstPaymentSucceededAt: "2026-09-20T12:00:00.000Z",
        paidThroughAt: "2026-10-20T12:00:00.000Z",
      }),
      NOW,
    ),
    { hasAccess: true, phase: "paid", reason: "paid_active" },
  )
})

test("grants verified paid access even when payment succeeds before the recorded trial end", () => {
  assert.deepEqual(
    resolveTrialAccess(
      facts({
        firstPaymentSucceededAt: "2026-09-19T12:00:00.000Z",
        paidThroughAt: "2026-10-19T12:00:00.000Z",
      }),
      new Date("2026-09-19T12:00:00.000Z"),
    ),
    { hasAccess: true, phase: "paid", reason: "paid_active" },
  )
})

test("keeps verified paid access when stale renewal-grace bookkeeping is unusable", () => {
  const paidAfterRecovery = facts({
    authorizationSucceededAt: null,
    originalTrialEndAt: null,
    firstPaymentSucceededAt: "2026-09-22T12:00:00.000Z",
    paidThroughAt: "2026-10-22T12:00:00.000Z",
    renewalGraceEndsAt: "2026-09-27T12:00:00.000Z",
  })

  for (const staleGrace of [
    { renewalPaymentFailed: false },
    { renewalPaymentFailed: true },
    { renewalPaymentFailed: true, renewalGraceEndsAt: "not-an-iso-date" },
  ]) {
    assert.deepEqual(
      resolveTrialAccess(
        { ...paidAfterRecovery, ...staleGrace },
        new Date("2026-09-25T12:00:00.000Z"),
      ),
      {
        hasAccess: true,
        phase: "paid",
        reason: "paid_active",
      },
    )
  }
})

test("permits only a previously paid, non-canceled membership to use its persisted renewal-grace deadline", () => {
  const renewalFacts = facts({
    authorizationSucceededAt: null,
    originalTrialEndAt: null,
    firstPaymentSucceededAt: "2026-08-20T12:00:00.000Z",
    paidThroughAt: "2026-09-20T12:00:00.000Z",
    renewalPaymentFailed: true,
    renewalGraceEndsAt: "2026-09-27T12:00:00.000Z",
  })
  assert.deepEqual(resolveTrialAccess(renewalFacts, NOW), {
    hasAccess: true,
    phase: "renewal_grace",
    reason: "renewal_grace_active",
  })
  assert.deepEqual(resolveTrialAccess({ ...renewalFacts, cancelAtPeriodEnd: true }, NOW), {
    hasAccess: false,
    phase: "locked",
    reason: "paid_period_expired",
  })
  assert.deepEqual(resolveTrialAccess(renewalFacts, new Date("2026-09-27T12:00:00.000Z")), {
    hasAccess: false,
    phase: "locked",
    reason: "renewal_grace_expired",
  })
  for (const unusableGrace of ["not-an-iso-date", "2026-09-20T12:00:00.000Z"]) {
    assert.deepEqual(
      resolveTrialAccess({ ...renewalFacts, renewalGraceEndsAt: unusableGrace }, NOW),
      {
        hasAccess: false,
        phase: "locked",
        reason: "paid_period_expired",
      },
    )
  }
})

test("fails closed for malformed or contradictory persisted snapshots", () => {
  for (const invalid of [
    facts({ originalTrialEndAt: "not-an-iso-date" }),
    facts({ originalTrialEndAt: "2026-09-13T12:00:00.000Z" }),
    facts({ authorizationSucceededAt: null, originalTrialEndAt: "2026-09-20T12:00:00.000Z" }),
    facts({
      authorizationSucceededAt: null,
      originalTrialEndAt: null,
      paidThroughAt: "2026-10-20T12:00:00.000Z",
    }),
    facts({ firstPaymentSucceededAt: "2026-09-19T12:00:00.000Z" }),
  ]) {
    assert.deepEqual(resolveTrialAccess(invalid, NOW), {
      hasAccess: false,
      phase: "locked",
      reason: "invalid_facts",
    })
  }

  assert.deepEqual(resolveTrialAccess(facts(), new Date("invalid")), {
    hasAccess: false,
    phase: "locked",
    reason: "invalid_facts",
  })
  assert.deepEqual(
    resolveTrialAccess(
      facts({
        authorizationSucceededAt: "2026-02-20T12:00:00.000Z",
        originalTrialEndAt: "2026-02-30T12:00:00.000Z",
      }),
      new Date("2026-02-25T12:00:00.000Z"),
    ),
    { hasAccess: false, phase: "locked", reason: "invalid_facts" },
  )
})

test("revocation always wins and repeated resolution does not extend a persisted grace deadline", () => {
  const revoked = facts({
    firstPaymentSucceededAt: "2026-09-19T12:00:00.000Z",
    paidThroughAt: "2026-10-19T12:00:00.000Z",
    accessRevoked: true,
  })
  assert.deepEqual(resolveTrialAccess(revoked, NOW), {
    hasAccess: false,
    phase: "locked",
    reason: "revoked",
  })

  const grace = facts({
    authorizationSucceededAt: null,
    originalTrialEndAt: null,
    firstPaymentSucceededAt: "2026-08-20T12:00:00.000Z",
    paidThroughAt: "2026-09-20T12:00:00.000Z",
    renewalPaymentFailed: true,
    renewalGraceEndsAt: "2026-09-27T12:00:00.000Z",
  })
  assert.equal(resolveTrialAccess(grace, new Date("2026-09-26T23:59:59.999Z")).hasAccess, true)
  assert.equal(resolveTrialAccess(grace, new Date("2026-09-27T12:00:00.000Z")).hasAccess, false)
})
