const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

/** Earliest collection date boundary used by access windows and legacy requests.
 * This is not the provider start timestamp for new agreements. PayPal's live
 * annual midnight request scheduled the prior day's batch; the noon probe
 * scheduled the disclosed date. Always verify next_billing_time separately.
 */
export function paypalTrialCollectionStart(trialEndIso: string): string {
  const trialEnd = Date.parse(trialEndIso)
  if (!Number.isFinite(trialEnd)) throw new Error("PayPal trial collection start unavailable")
  return new Date(Math.ceil(trialEnd / DAY) * DAY).toISOString()
}

/**
 * The customer trial end is the next UTC midnight strictly after freeze + 8 days.
 * Every approval within the 24h intent window retains at least seven full days.
 * request_expires_at stores freeze + 72h. Legacy requests sent this end as their
 * provider start; v2 persists a separate noon start before creating the agreement.
 */
export function frozenPayPalTrialStart(requestExpiresAtIso: string | null | undefined): string {
  const expiry = Date.parse(requestExpiresAtIso ?? "")
  if (!Number.isFinite(expiry)) throw new Error("PayPal trial frozen start unavailable")
  const freeze = expiry - 72 * HOUR
  return new Date((Math.floor((freeze + 8 * DAY) / DAY) + 1) * DAY).toISOString()
}

/** Candidate provider timestamp for a NEW initial or restored agreement only.
 * Never use this to recompute an already-frozen request or its idempotent retry.
 * The exact timestamp is persisted; the provider billing date must still pass
 * the unchanged trial-end/window checks after approval.
 */
export function paypalTrialProviderStart(trialEndIso: string): string {
  return new Date(Date.parse(paypalTrialCollectionStart(trialEndIso)) + 12 * HOUR).toISOString()
}

/**
 * Upper bound for a verifiable first-collection time: the provider's batch on
 * the collection date, or at latest on the following day. Anything later is
 * not the schedule that was disclosed and requires reconciliation.
 */
export function paypalTrialCollectionWindowEnd(collectionStartIso: string): string {
  const start = Date.parse(collectionStartIso)
  if (!Number.isFinite(start)) throw new Error("PayPal trial collection window unavailable")
  return new Date(start + 2 * DAY).toISOString()
}

/**
 * When the first-collection access bridge closes (SQL twins: the window
 * expressions in trial_enrollment_has_access and the paid-recovery gate). The
 * two contracts are told apart by the stored dates alone: an end exactly seven
 * days after authorization (Stripe, legacy PayPal) keeps its original
 * next-midnight-plus-two-days window even when that end happens to sit on a
 * midnight; a frozen PayPal end (more than seven days out, always a midnight)
 * is its own collection start and closes two days later.
 */
export function trialFirstCollectionWindowEnd(
  authorizationSucceededAtIso: string,
  originalTrialEndIso: string,
): string {
  const authorized = Date.parse(authorizationSucceededAtIso)
  const trialEnd = Date.parse(originalTrialEndIso)
  if (!Number.isFinite(authorized) || !Number.isFinite(trialEnd))
    throw new Error("Trial collection window unavailable")
  const collectionStart =
    trialEnd - authorized === 7 * DAY
      ? (Math.floor(trialEnd / DAY) + 1) * DAY
      : Math.ceil(trialEnd / DAY) * DAY
  return new Date(collectionStart + 2 * DAY).toISOString()
}

/**
 * Whether a provider-reported first-billing time matches the trial's verified
 * collection schedule: at the trial end itself (frozen midnight ends, or the
 * legacy second-exact end) or a batch inside the collection window that starts
 * at the collection start. Fails closed on missing or unparseable timestamps.
 */
export function paypalTrialNextBillingMatches(
  originalTrialEndIso: string,
  nextBillingIso: string | null | undefined,
): boolean {
  const trialEnd = Date.parse(originalTrialEndIso)
  const nextBilling = Date.parse(nextBillingIso ?? "")
  if (!Number.isFinite(trialEnd) || !Number.isFinite(nextBilling)) return false
  if (nextBilling === trialEnd) return true
  const windowEnd = Date.parse(
    paypalTrialCollectionWindowEnd(paypalTrialCollectionStart(originalTrialEndIso)),
  )
  return nextBilling > trialEnd && nextBilling < windowEnd
}
