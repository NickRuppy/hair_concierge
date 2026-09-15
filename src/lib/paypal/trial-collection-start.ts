/**
 * PayPal collects subscriptions in a daily batch (~09:00–10:00 UTC) keyed to
 * the UTC date of the subscription's start_time, and can schedule that batch
 * earlier in the day than the start_time itself. The first collection for a
 * trial therefore starts at the next UTC midnight strictly after the verified
 * trial end: every customer gets the full 7×24h trial plus at least the hours
 * until the following batch, and the charge can never fall inside the trial.
 */
export function paypalTrialCollectionStart(trialEndIso: string): string {
  const trialEnd = Date.parse(trialEndIso)
  if (!Number.isFinite(trialEnd)) throw new Error("PayPal trial collection start unavailable")
  const day = 24 * 60 * 60 * 1000
  return new Date((Math.floor(trialEnd / day) + 1) * day).toISOString()
}

/**
 * Upper bound for a verifiable first-collection time: the provider's batch on
 * the collection date, or at latest on the following day. Anything later is
 * not the schedule that was disclosed and requires reconciliation.
 */
export function paypalTrialCollectionWindowEnd(collectionStartIso: string): string {
  const start = Date.parse(collectionStartIso)
  if (!Number.isFinite(start)) throw new Error("PayPal trial collection window unavailable")
  return new Date(start + 2 * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * Whether a provider-reported first-billing time matches the trial's verified
 * collection schedule: either the legacy second-exact trial end (agreements
 * admitted before day-after collection) or a batch inside the day-after
 * collection window. Fails closed on missing or unparseable timestamps.
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
