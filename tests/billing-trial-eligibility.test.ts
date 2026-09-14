import assert from "node:assert/strict"
import test from "node:test"

import {
  evaluateTrialEligibility,
  type TrialEligibilityHistory,
  type TrialIdentityClaim,
} from "../src/lib/billing/trial-eligibility"

const account = (value = "account-1"): TrialIdentityClaim => ({
  kind: "account",
  keyVersion: 1,
  namespace: "chaarlie",
  value,
})
const verifiedEmail = (value = "person@example.com"): TrialIdentityClaim => ({
  kind: "verified_email",
  keyVersion: 1,
  namespace: "chaarlie",
  value,
})
const stripeCard = (value = "fp-shared"): TrialIdentityClaim => ({
  kind: "stripe_card",
  keyVersion: 1,
  namespace: "stripe",
  value,
})
const paypalPayer = (value = "payer-1"): TrialIdentityClaim => ({
  kind: "paypal_payer",
  keyVersion: 1,
  namespace: "paypal",
  value,
})

function history(overrides: Partial<TrialEligibilityHistory> = {}): TrialEligibilityHistory {
  return {
    consumedClaims: [],
    currentAccess: "none",
    lookupSucceeded: true,
    reviewRequired: false,
    ...overrides,
  }
}

test("denies a later account when its verified Stripe payment method was consumed", () => {
  const decision = evaluateTrialEligibility(history({ consumedClaims: [stripeCard()] }), {
    claims: [account("account-2"), stripeCard()],
  })

  assert.deepEqual(decision, {
    allowPaidSignup: true,
    eligible: false,
    reason: "trial_used",
  })
})

test("denies a later attempt on the same account even with a different payment method", () => {
  assert.deepEqual(
    evaluateTrialEligibility(history({ consumedClaims: [account()] }), {
      claims: [account(), paypalPayer("payer-new")],
    }),
    { allowPaidSignup: true, eligible: false, reason: "trial_used" },
  )
})

test("does not conflate provider-namespaced payment identities", () => {
  assert.deepEqual(
    evaluateTrialEligibility(history({ consumedClaims: [stripeCard("same-looking-id")] }), {
      claims: [account(), paypalPayer("same-looking-id")],
    }),
    { allowPaidSignup: false, eligible: true, reason: "eligible" },
  )
})

test("requires at least one reliable verified identity and ignores weak or unverified claims", () => {
  for (const claims of [
    [],
    [{ kind: "ip", keyVersion: 1, namespace: "network", value: "203.0.113.4" }],
    [{ kind: "device", keyVersion: 1, namespace: "browser", value: "device-1" }],
    [
      {
        kind: "unverified_email",
        keyVersion: 1,
        namespace: "chaarlie",
        value: "person@example.com",
      },
    ],
    [{ kind: "name", keyVersion: 1, namespace: "profile", value: "Ada Example" }],
    [{ kind: "address", keyVersion: 1, namespace: "profile", value: "Example Street 1" }],
  ]) {
    assert.deepEqual(evaluateTrialEligibility(history(), { claims }), {
      allowPaidSignup: false,
      eligible: false,
      reason: "needs_verification",
    })
  }
})

test("never denies a verified account from a matching IP, device, name, address, or unverified email", () => {
  for (const consumedClaim of [
    { kind: "ip", keyVersion: 1, namespace: "network", value: "203.0.113.4" },
    { kind: "device", keyVersion: 1, namespace: "browser", value: "device-1" },
    { kind: "unverified_email", keyVersion: 1, namespace: "chaarlie", value: "person@example.com" },
    { kind: "name", keyVersion: 1, namespace: "profile", value: "Ada Example" },
    { kind: "address", keyVersion: 1, namespace: "profile", value: "Example Street 1" },
  ]) {
    assert.deepEqual(
      evaluateTrialEligibility(history({ consumedClaims: [consumedClaim] }), {
        claims: [account()],
      }),
      { allowPaidSignup: false, eligible: true, reason: "eligible" },
    )
  }
})

test("fails closed when the trusted history lookup failed", () => {
  assert.deepEqual(
    evaluateTrialEligibility(history({ lookupSucceeded: false }), { claims: [account()] }),
    { allowPaidSignup: false, eligible: false, reason: "history_unavailable" },
  )
})

test("does not consume failed, pending, or abandoned authorization attempts", () => {
  assert.deepEqual(
    evaluateTrialEligibility(history({ consumedClaims: [] }), {
      claims: [account(), verifiedEmail()],
    }),
    { allowPaidSignup: false, eligible: true, reason: "eligible" },
  )
})

test("blocks existing membership, manual access, and one-time paid or pending admission separately from trial use", () => {
  for (const currentAccess of [
    "membership",
    "manual_grant",
    "one_time_paid",
    "one_time_pending",
  ] as const) {
    assert.deepEqual(
      evaluateTrialEligibility(history({ currentAccess }), { claims: [account()] }),
      {
        allowPaidSignup: false,
        eligible: false,
        reason: "existing_access",
      },
    )
  }
})

test("requires exact kind, namespace, and value matches for consumed strong claims", () => {
  assert.deepEqual(
    evaluateTrialEligibility(
      history({
        consumedClaims: [
          {
            kind: "verified_email",
            keyVersion: 1,
            namespace: "other",
            value: "person@example.com",
          },
        ],
      }),
      { claims: [verifiedEmail()] },
    ),
    { allowPaidSignup: false, eligible: true, reason: "eligible" },
  )
})

test("requires the same positive claim-key version before matching an identical digest", () => {
  assert.deepEqual(
    evaluateTrialEligibility(history({ consumedClaims: [{ ...stripeCard(), keyVersion: 1 }] }), {
      claims: [{ ...stripeCard(), keyVersion: 2 }],
    }),
    { allowPaidSignup: false, eligible: true, reason: "eligible" },
  )
})

test("rejects missing or invalid key versions as unreliable identity evidence", () => {
  for (const keyVersion of [0, -1, 1.5, Number.NaN, undefined]) {
    assert.deepEqual(
      evaluateTrialEligibility(history(), {
        claims: [{ ...account(), keyVersion } as TrialIdentityClaim],
      }),
      { allowPaidSignup: false, eligible: false, reason: "needs_verification" },
    )
  }
})

test("holds known history for review when a rights or correction disposition remains unresolved", () => {
  assert.deepEqual(
    evaluateTrialEligibility(history({ reviewRequired: true }), { claims: [account()] }),
    { allowPaidSignup: false, eligible: false, reason: "needs_review" },
  )
})
