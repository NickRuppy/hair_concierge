export type TrialIdentityClaim = Readonly<{
  /** A trusted adapter supplies normalized, server-side claim projections. */
  kind: string
  /**
   * Versioned adapter-derived key; policy never normalizes or hashes claims.
   * The repository adapter must derive every still-valid key version it needs
   * to compare, rather than changing case or re-hashing in this policy.
   */
  keyVersion: number
  namespace: string
  value: string
}>

export type TrialEligibilityHistory = Readonly<{
  /**
   * Historical activated trials and paid memberships, after any lawful
   * retention exclusion has been applied by the repository adapter. The adapter
   * must respect a restriction or erasure rather than retaining a shadow hash
   * solely to continue matching a forbidden identity.
   */
  consumedClaims: readonly TrialIdentityClaim[]
  /** Current access is an admission block distinct from a consumed trial. */
  currentAccess: "none" | "membership" | "manual_grant" | "one_time_paid" | "one_time_pending"
  /** A failed history read cannot establish eligibility. */
  lookupSucceeded: boolean
  /**
   * An unresolved known rights or correction disposition must not auto-admit a
   * trial. This is not an erasure tombstone or permission to retain a forbidden
   * identity; a fully erased identity may be indistinguishable from a new user.
   */
  reviewRequired: boolean
}>

export type VerifiedTrialIdentity = Readonly<{
  claims: readonly TrialIdentityClaim[]
}>

export type TrialEligibility = Readonly<{
  eligible: boolean
  reason:
    | "eligible"
    | "needs_verification"
    | "history_unavailable"
    | "existing_access"
    | "needs_review"
    | "trial_used"
  /** Only a prior trial-use denial keeps the explicitly selected paid path available. */
  allowPaidSignup: boolean
}>

const STRONG_CLAIM_KINDS = new Set(["account", "verified_email", "stripe_card", "paypal_payer"])

function isStrongClaim(claim: TrialIdentityClaim): boolean {
  return (
    STRONG_CLAIM_KINDS.has(claim.kind) &&
    Number.isSafeInteger(claim.keyVersion) &&
    claim.keyVersion > 0 &&
    typeof claim.namespace === "string" &&
    claim.namespace.length > 0 &&
    typeof claim.value === "string" &&
    claim.value.length > 0
  )
}

function sameClaim(left: TrialIdentityClaim, right: TrialIdentityClaim): boolean {
  return (
    left.kind === right.kind &&
    left.keyVersion === right.keyVersion &&
    left.namespace === right.namespace &&
    left.value === right.value
  )
}

/**
 * Resolves the read-only eligibility policy from trusted repository projections.
 * It deliberately does not reserve admission; the later database adapter must
 * atomically reserve every strong claim before provider authorization starts.
 */
export function evaluateTrialEligibility(
  history: TrialEligibilityHistory,
  verifiedIdentity: VerifiedTrialIdentity,
): TrialEligibility {
  if (!history.lookupSucceeded) {
    return { allowPaidSignup: false, eligible: false, reason: "history_unavailable" }
  }

  if (history.currentAccess !== "none") {
    return { allowPaidSignup: false, eligible: false, reason: "existing_access" }
  }

  if (history.reviewRequired) {
    return { allowPaidSignup: false, eligible: false, reason: "needs_review" }
  }

  const claims = verifiedIdentity.claims.filter(isStrongClaim)
  if (claims.length === 0) {
    return { allowPaidSignup: false, eligible: false, reason: "needs_verification" }
  }

  const hasConsumedClaim = history.consumedClaims
    .filter(isStrongClaim)
    .some((consumedClaim) => claims.some((claim) => sameClaim(consumedClaim, claim)))

  if (hasConsumedClaim) {
    return { allowPaidSignup: true, eligible: false, reason: "trial_used" }
  }

  return { allowPaidSignup: false, eligible: true, reason: "eligible" }
}
