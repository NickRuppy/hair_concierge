/**
 * Authoritative state for the short interval between an offer CTA tap and an
 * actual checkout open. The owner supplies preparation usability at each
 * terminal event so an expired preparation cannot be opened accidentally.
 */
export type OfferCheckoutReadyGateState =
  | { status: "idle" }
  | { status: "waiting" }
  | { status: "open_prepared" }
  | {
      status: "open_fallback"
      fallback: "prepared" | "cold"
      reason: "unavailable" | "failure" | "timeout" | "prepared_unusable"
    }

export type OfferCheckoutReadyGateEvent =
  | { type: "request" }
  | { type: "available"; preparedCheckoutUsable: boolean }
  | { type: "unavailable"; preparedCheckoutUsable: boolean }
  | { type: "failure"; preparedCheckoutUsable: boolean }
  | { type: "timeout"; preparedCheckoutUsable: boolean }
  | { type: "reset" }

export const IDLE_OFFER_CHECKOUT_READY_GATE: OfferCheckoutReadyGateState = {
  status: "idle",
}

function fallback(
  preparedCheckoutUsable: boolean,
  reason: Extract<OfferCheckoutReadyGateState, { status: "open_fallback" }>["reason"],
): OfferCheckoutReadyGateState {
  return {
    status: "open_fallback",
    fallback: preparedCheckoutUsable ? "prepared" : "cold",
    reason,
  }
}

export function reduceOfferCheckoutReadyGate(
  state: OfferCheckoutReadyGateState,
  event: OfferCheckoutReadyGateEvent,
): OfferCheckoutReadyGateState {
  if (event.type === "reset") return IDLE_OFFER_CHECKOUT_READY_GATE

  if (state.status === "idle") {
    return event.type === "request" ? { status: "waiting" } : state
  }

  if (state.status !== "waiting") return state

  switch (event.type) {
    case "request":
      return state
    case "available":
      return event.preparedCheckoutUsable
        ? { status: "open_prepared" }
        : fallback(false, "prepared_unusable")
    case "unavailable":
      return fallback(event.preparedCheckoutUsable, "unavailable")
    case "failure":
      return fallback(event.preparedCheckoutUsable, "failure")
    case "timeout":
      return fallback(event.preparedCheckoutUsable, "timeout")
  }
}
