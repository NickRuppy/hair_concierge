import type Stripe from "stripe"

type BuildStripeCheckoutSessionParamsInput = {
  checkoutKind?: "subscription" | "personal_plan_once"
  origin: string
  priceId: string
  presentation?: "embedded_page" | "elements"
  customerId?: string
  customerEmail?: string
  leadId?: string | null
  funnelSessionId?: string | null
  funnelPackageKey?: string | null
  checkoutContext?: "membership_reactivation" | null
  returnDestination?: string | null
  reactivationReservationId?: string | null
  expiresAt?: number
  metadata?: Record<string, string>
}

export function buildStripeCheckoutSessionParams({
  checkoutKind = "subscription",
  origin,
  priceId,
  presentation = "embedded_page",
  customerId,
  customerEmail,
  leadId,
  funnelSessionId,
  funnelPackageKey,
  checkoutContext,
  returnDestination,
  reactivationReservationId,
  expiresAt,
  metadata: extraMetadata,
}: BuildStripeCheckoutSessionParamsInput): Stripe.Checkout.SessionCreateParams {
  const isElementsPresentation = presentation === "elements"
  const isOneTimePurchase = checkoutKind === "personal_plan_once"

  return {
    mode: isOneTimePurchase ? "payment" : "subscription",
    ui_mode: presentation,
    line_items: [{ price: priceId, quantity: 1 }],
    // Pass customer OR customer_email — never both (Stripe rejects that combination)
    ...(customerId ? { customer: customerId } : { customer_email: customerEmail }),
    return_url: `${origin}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    ...(expiresAt ? { expires_at: expiresAt } : {}),
    automatic_tax: { enabled: true },
    ...(isOneTimePurchase
      ? {
          payment_intent_data: {
            metadata: {
              product_kind: "personal_plan_once",
              ...(extraMetadata?.checkout_attempt_id
                ? { checkout_attempt_id: extraMetadata.checkout_attempt_id }
                : {}),
            },
          },
        }
      : {}),
    ...(isElementsPresentation
      ? { excluded_payment_method_types: ["sepa_debit", "paypal"] }
      : {
          consent_collection: { terms_of_service: "required" },
          custom_text: {
            terms_of_service_acceptance: {
              message:
                "Ich akzeptiere die AGB. Mein gesetzliches 14-tägiges Widerrufsrecht bleibt unberührt: https://chaarlie.de/widerruf.",
            },
          },
          excluded_payment_method_types: ["sepa_debit"],
        }),
    metadata:
      leadId ||
      funnelSessionId ||
      funnelPackageKey ||
      checkoutContext ||
      returnDestination ||
      reactivationReservationId ||
      isOneTimePurchase ||
      extraMetadata
        ? {
            ...(leadId ? { lead_id: leadId } : {}),
            ...(funnelSessionId ? { funnel_session_id: funnelSessionId } : {}),
            ...(funnelPackageKey ? { funnel_package_key: funnelPackageKey } : {}),
            ...(checkoutContext ? { checkout_context: checkoutContext } : {}),
            ...(returnDestination ? { return_destination: returnDestination } : {}),
            ...(reactivationReservationId
              ? { reactivation_reservation_id: reactivationReservationId }
              : {}),
            ...(isOneTimePurchase ? { product_kind: "personal_plan_once" } : {}),
            ...extraMetadata,
          }
        : undefined,
  }
}
