const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

/**
 * PayPal collects subscriptions in a daily batch (~09:00–10:00 UTC) keyed to
 * the UTC date of the subscription's start_time, and can schedule that batch
 * earlier in the day than the start_time itself. A first collection therefore
 * starts on a UTC midnight: a trial end that already sits on a midnight (the
 * frozen PayPal trial end) collects on that same disclosed date; a second-exact
 * legacy trial end collects on the next UTC midnight after it, so the charge
 * can never fall inside the trial. The access bridge uses
 * trialFirstCollectionWindowEnd instead, which keeps the exact-seven-day
 * contracts (Stripe, legacy PayPal) on their original window.
 */
export function paypalTrialCollectionStart(trialEndIso: string): string {
  const trialEnd = Date.parse(trialEndIso)
  if (!Number.isFinite(trialEnd)) throw new Error("PayPal trial collection start unavailable")
  return new Date(Math.ceil(trialEnd / DAY) * DAY).toISOString()
}

/**
 * The PayPal trial end is fixed when the checkout attempt is frozen, before
 * the customer approves, because PayPal computes its billing clock once from
 * the start_time it was created with and never recomputes it after a patch.
 * The frozen end is the next UTC midnight strictly after freeze + 8 days: every
 * approval inside the 24-hour checkout intent window (freeze ≤ approval ≤
 * freeze + 24h) still gets at least 7 × 24h before that midnight, and PayPal's
 * batch on that date can never precede it. The attempt records freeze + 72h as
 * request_expires_at; the start is derived from that frozen value so activation
 * verifies the provider's echoed start_time against exactly what was requested.
 */
export function frozenPayPalTrialStart(requestExpiresAtIso: string | null | undefined): string {
  const expiry = Date.parse(requestExpiresAtIso ?? "")
  if (!Number.isFinite(expiry)) throw new Error("PayPal trial frozen start unavailable")
  const freeze = expiry - 72 * HOUR
  return new Date((Math.floor((freeze + 8 * DAY) / DAY) + 1) * DAY).toISOString()
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
