/**
 * Every German string the purchase step of the Premium sheet introduces
 * (freemium-scanner-first T14), in one place so the invented copy is countable and
 * reviewable rather than scattered through JSX.
 *
 * Telegram-style throughout: one job per line, no reassurance padding, no exclamation
 * marks, no claim the product cannot keep.
 */
export const PREMIUM_SHEET_PURCHASE_COPY = {
  /** Journey step 9, brief-binding — the unlock confirmation. */
  unlockToast: "Alles freigeschaltet",
  /** Shown under the toast title only while the Routine is still being built. */
  unlockToastRoutinePending: "Deine Routine wird gerade gebaut.",
  /** Back out of the payment step without leaving the sheet (reuses the offer's label). */
  backToPlans: "Plan ändern",
  /** Between „onComplete" and the server's verdict. Deliberately not „Geschafft". */
  verifying: "Wir prüfen deine Zahlung …",
  /** Asynchronous payment method still settling. */
  pendingTitle: "Zahlung wird noch geprüft",
  pendingBody: "Sobald sie durch ist, schalten wir frei. Du musst nichts weiter tun.",
  /** Recoverable failures. One line each, then the retry. */
  checkoutUnavailable: "Checkout konnte nicht geladen werden.",
  providerUnavailable: "Zahlung konnte nicht gestartet werden.",
  verificationFailed: "Wir konnten deine Zahlung nicht bestätigen.",
  /** Existing repo-wide retry label. */
  retry: "Erneut versuchen",
} as const

export function premiumSheetPurchaseFailureCopy(
  reason: "checkout_unavailable" | "provider_unavailable" | "verification_failed",
): string {
  if (reason === "checkout_unavailable") return PREMIUM_SHEET_PURCHASE_COPY.checkoutUnavailable
  if (reason === "provider_unavailable") return PREMIUM_SHEET_PURCHASE_COPY.providerUnavailable
  return PREMIUM_SHEET_PURCHASE_COPY.verificationFailed
}
