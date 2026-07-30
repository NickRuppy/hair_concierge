import type { OfferPaymentOption } from "./events"
import { observeOnceEngaged, type ObserveOnceEngagedOptions } from "./observe-once-engaged"

export const OFFER_PAYMENT_OPTION_VIEW_DWELL_MS = 750
export const OFFER_PAYMENT_OPTION_VIEW_THRESHOLD = 0.5

export function isOfferPaymentOptionViewEligible({
  available,
  checkoutAttemptId,
  providerReady,
  visible,
}: {
  available: boolean
  checkoutAttemptId?: string | null
  providerReady: boolean
  visible: boolean
}) {
  return Boolean(checkoutAttemptId && available && providerReady && visible)
}

export function claimOfferPaymentOptionView(
  seen: Set<string>,
  checkoutAttemptId: string,
  option: OfferPaymentOption,
) {
  const key = `${checkoutAttemptId}:${option}`
  if (seen.has(key)) return false
  seen.add(key)
  return true
}

export function observeOfferPaymentOptionView(
  element: Element,
  onViewed: () => void,
  options: ObserveOnceEngagedOptions = {},
) {
  return observeOnceEngaged(element, onViewed, {
    ...options,
    dwellMs: OFFER_PAYMENT_OPTION_VIEW_DWELL_MS,
    threshold: OFFER_PAYMENT_OPTION_VIEW_THRESHOLD,
  })
}
