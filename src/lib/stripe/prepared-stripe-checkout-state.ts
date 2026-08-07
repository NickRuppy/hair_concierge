import { getPreparedCheckoutControlOutcome } from "./prepared-checkout-credential"

export type PreparedStripeCheckout = {
  clientSecret: string
  expiresAt: number
  /** A recovered Stripe session owns the attempt; its secret remains usable. */
  owner: "stripe" | null
  preparationToken: string | null
  sessionId: string
}

/**
 * The one-time checkout has exactly one parent-owned answer to "which provider
 * may render?". Expected prepare control outcomes are states, not rejected
 * Checkout Elements client-secret promises.
 */
export type PreparedStripeCheckoutState =
  | { kind: "loading" }
  | { kind: "ready"; checkout: PreparedStripeCheckout }
  | { kind: "provider_locked_paypal" }
  | { kind: "provider_locked_stripe" }
  | { kind: "duplicate_access"; email: string | null }
  | { kind: "unavailable" }

export type PreparedStripeCheckoutResponse = {
  client_secret?: unknown
  email?: unknown
  error?: unknown
  expires_at?: unknown
  preparation_token?: unknown
  provider_locked?: unknown
  session_id?: unknown
  status?: unknown
}

/** Returns null only for an unexpected response that the caller should report. */
export function resolvePreparedStripeCheckoutState({
  body,
  responseOk,
  responseStatus,
}: {
  body: PreparedStripeCheckoutResponse
  responseOk: boolean
  responseStatus: number
}): PreparedStripeCheckoutState | null {
  const controlOutcome = getPreparedCheckoutControlOutcome({
    error: body.error,
    providerLocked: body.provider_locked,
    status: body.status,
  })

  if (responseStatus === 409 && controlOutcome === "provider_locked") {
    return body.provider_locked === "stripe"
      ? { kind: "provider_locked_stripe" }
      : { kind: "provider_locked_paypal" }
  }

  if (responseStatus === 409 && controlOutcome === "duplicate_access") {
    return {
      kind: "duplicate_access",
      email: typeof body.email === "string" && body.email.trim() ? body.email.trim() : null,
    }
  }

  if (controlOutcome === "prepared_checkout_unavailable" || body.status === "unavailable") {
    return { kind: "unavailable" }
  }

  if (
    responseOk &&
    (body.status === "prepared" || body.status === "recovered") &&
    typeof body.client_secret === "string" &&
    body.client_secret.trim().length > 0 &&
    typeof body.expires_at === "number" &&
    (body.status === "recovered" || typeof body.preparation_token === "string") &&
    typeof body.session_id === "string"
  ) {
    return {
      kind: "ready",
      checkout: {
        clientSecret: body.client_secret,
        expiresAt: body.expires_at,
        owner: body.provider_locked === "stripe" ? "stripe" : null,
        preparationToken:
          typeof body.preparation_token === "string" ? body.preparation_token : null,
        sessionId: body.session_id,
      },
    }
  }

  return null
}
