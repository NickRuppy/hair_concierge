import type Stripe from "stripe"

type BuildStripeCheckoutSessionParamsInput = {
  origin: string
  priceId: string
  customerId?: string
  customerEmail?: string
  leadId?: string | null
}

export function buildStripeCheckoutSessionParams({
  origin,
  priceId,
  customerId,
  customerEmail,
  leadId,
}: BuildStripeCheckoutSessionParamsInput): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "subscription",
    ui_mode: "embedded_page",
    line_items: [{ price: priceId, quantity: 1 }],
    // Pass customer OR customer_email — never both (Stripe rejects that combination)
    ...(customerId ? { customer: customerId } : { customer_email: customerEmail }),
    return_url: `${origin}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    automatic_tax: { enabled: true },
    consent_collection: { terms_of_service: "required" },
    custom_text: {
      terms_of_service_acceptance: {
        message:
          "Ich stimme zu, dass der Zugriff auf das Abo sofort beginnt und ich damit mein 14-tägiges Widerrufsrecht verliere (§ 356 Abs. 4 BGB).",
      },
    },
    excluded_payment_method_types: ["sepa_debit"],
    metadata: leadId ? { lead_id: leadId } : undefined,
  }
}
