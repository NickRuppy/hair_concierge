const OFFER_CHECKOUT_HISTORY_KEY = "__chaarlieOfferCheckout"
const OFFER_CHECKOUT_HISTORY_VALUE = "open-v1"

declare const offerCheckoutHistoryBrand: unique symbol

export type OfferCheckoutHistoryState = {
  readonly [OFFER_CHECKOUT_HISTORY_KEY]: typeof OFFER_CHECKOUT_HISTORY_VALUE
  readonly [offerCheckoutHistoryBrand]: true
}

export type OfferCheckoutHistoryGuard = { ownsSentinel: boolean }

type CheckoutHistoryWindow = {
  history: Pick<History, "back" | "pushState" | "state">
  location: Pick<Location, "href">
}

export function createOfferCheckoutHistoryGuard(): OfferCheckoutHistoryGuard {
  return { ownsSentinel: false }
}

export function isOfferCheckoutHistoryState(value: unknown): value is OfferCheckoutHistoryState {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>)[OFFER_CHECKOUT_HISTORY_KEY] === OFFER_CHECKOUT_HISTORY_VALUE
  )
}

function createOfferCheckoutHistoryState(): OfferCheckoutHistoryState {
  return { [OFFER_CHECKOUT_HISTORY_KEY]: OFFER_CHECKOUT_HISTORY_VALUE } as OfferCheckoutHistoryState
}

/** Pushes one same-URL entry while the overlay is visible. */
export function pushOfferCheckoutHistorySentinel(
  guard: OfferCheckoutHistoryGuard,
  win: CheckoutHistoryWindow = window,
): boolean {
  if (guard.ownsSentinel || isOfferCheckoutHistoryState(win.history.state)) return false
  win.history.pushState(createOfferCheckoutHistoryState(), "", win.location.href)
  guard.ownsSentinel = true
  return true
}

/** Consumes only the checkout's current entry; foreign quiz entries are never interpreted. */
export function consumeOfferCheckoutHistorySentinel(
  guard: OfferCheckoutHistoryGuard,
  win: CheckoutHistoryWindow = window,
): boolean {
  if (!guard.ownsSentinel || !isOfferCheckoutHistoryState(win.history.state)) return false
  guard.ownsSentinel = false
  win.history.back()
  return true
}

/** Reinstates exactly one guard after a Back-origin confirmation is cancelled. */
export function restoreOfferCheckoutHistorySentinel(
  guard: OfferCheckoutHistoryGuard,
  win: CheckoutHistoryWindow = window,
): boolean {
  return pushOfferCheckoutHistorySentinel(guard, win)
}
