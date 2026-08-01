import { randomBytes } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

import { PERSONAL_PLAN_ONCE_PRODUCT } from "@/lib/billing/offer-products"

export const PAYPAL_PERSONAL_PLAN_ONCE_AMOUNT = "29.99"
export const PAYPAL_PERSONAL_PLAN_ONCE_CURRENCY = "EUR"
const PAYPAL_ORDER_INTENT_TTL_MS = 24 * 60 * 60 * 1_000

export type PayPalOrderIntentRow = {
  id: string
  token: string
  user_id: string | null
  lead_id: string | null
  funnel_session_id: string
  consent_id: string
  email: string | null
  checkout_attempt_id: string
  product_kind: "personal_plan_once"
  provider_order_id: string | null
  provider_capture_id: string | null
  status: "created" | "approved" | "captured" | "duplicate" | "failed" | "expired"
  expires_at: string
  metadata: Record<string, unknown>
}

export type PayPalOrderIntentClient = Pick<SupabaseClient, "from">

type PayPalCaptureResponse = {
  id?: string
  status?: string
  purchase_units?: Array<{
    custom_id?: string
    payee?: { merchant_id?: string }
    amount?: { currency_code?: string; value?: string }
    payments?: {
      captures?: Array<{
        id?: string
        status?: string
        amount?: { currency_code?: string; value?: string }
      }>
    }
  }>
}

export function createPayPalOrderIntentToken() {
  return randomBytes(24).toString("base64url")
}

export function paypalOrderRequestId(token: string, action: "create" | "capture") {
  return `personal-plan-once:${action}:${token}`
}

export function buildPayPalPersonalPlanOrder(
  token: string,
  merchantId = process.env.PAYPAL_MERCHANT_ID,
) {
  if (!merchantId?.trim()) throw new Error("PAYPAL_MERCHANT_ID is not set")
  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: PERSONAL_PLAN_ONCE_PRODUCT.analyticsId,
        custom_id: token,
        payee: { merchant_id: merchantId.trim() },
        amount: {
          currency_code: PAYPAL_PERSONAL_PLAN_ONCE_CURRENCY,
          value: PAYPAL_PERSONAL_PLAN_ONCE_AMOUNT,
          breakdown: {
            item_total: {
              currency_code: PAYPAL_PERSONAL_PLAN_ONCE_CURRENCY,
              value: PAYPAL_PERSONAL_PLAN_ONCE_AMOUNT,
            },
          },
        },
        items: [
          {
            name: PERSONAL_PLAN_ONCE_PRODUCT.name,
            description: PERSONAL_PLAN_ONCE_PRODUCT.description,
            sku: PERSONAL_PLAN_ONCE_PRODUCT.sku,
            quantity: "1",
            category: PERSONAL_PLAN_ONCE_PRODUCT.paypalCategory,
            unit_amount: {
              currency_code: PAYPAL_PERSONAL_PLAN_ONCE_CURRENCY,
              value: PAYPAL_PERSONAL_PLAN_ONCE_AMOUNT,
            },
          },
        ],
      },
    ],
    application_context: { shipping_preference: "NO_SHIPPING" },
  }
}

export async function createPayPalOrderIntent(
  supabase: PayPalOrderIntentClient,
  input: {
    checkoutAttemptId: string
    funnelSessionId: string
    consentId: string
    userId?: string | null
    leadId?: string | null
    email: string
    metadata?: Record<string, unknown>
    now?: Date
  },
) {
  const existing = await findPayPalOrderIntentByCheckoutAttemptId(supabase, input.checkoutAttemptId)
  if (existing) return existing

  const token = createPayPalOrderIntentToken()
  const now = input.now ?? new Date()
  const { data, error } = await supabase
    .from("paypal_order_intents")
    .insert({
      token,
      user_id: input.userId ?? null,
      lead_id: input.leadId ?? null,
      funnel_session_id: input.funnelSessionId,
      consent_id: input.consentId,
      email: input.email.trim().toLowerCase(),
      checkout_attempt_id: input.checkoutAttemptId,
      product_kind: PERSONAL_PLAN_ONCE_PRODUCT.analyticsId,
      expires_at: new Date(now.getTime() + PAYPAL_ORDER_INTENT_TTL_MS).toISOString(),
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()
  if (error) {
    if (isUniqueViolation(error)) {
      const raced = await findPayPalOrderIntentByCheckoutAttemptId(
        supabase,
        input.checkoutAttemptId,
      )
      if (raced) return raced
      const existingForConsent = await findPayPalOrderIntentByConsentId(supabase, input.consentId)
      if (
        existingForConsent?.status === "created" &&
        !isPayPalOrderIntentExpired(existingForConsent, now)
      ) {
        return existingForConsent
      }
    }
    throw error
  }
  return data as PayPalOrderIntentRow
}

export async function findPayPalOrderIntentByCheckoutAttemptId(
  supabase: PayPalOrderIntentClient,
  checkoutAttemptId: string,
) {
  const { data, error } = await supabase
    .from("paypal_order_intents")
    .select("*")
    .eq("checkout_attempt_id", checkoutAttemptId)
    .maybeSingle()
  if (error) throw error
  return data as PayPalOrderIntentRow | null
}

async function findPayPalOrderIntentByConsentId(
  supabase: PayPalOrderIntentClient,
  consentId: string,
) {
  const { data, error } = await supabase
    .from("paypal_order_intents")
    .select("*")
    .eq("consent_id", consentId)
    .maybeSingle()
  if (error) throw error
  return data as PayPalOrderIntentRow | null
}

export async function findPayPalOrderIntentByToken(
  supabase: PayPalOrderIntentClient,
  token: string,
) {
  const { data, error } = await supabase
    .from("paypal_order_intents")
    .select("*")
    .eq("token", token)
    .maybeSingle()
  if (error) {
    if (isMissingPayPalOrderIntentsTableError(error)) return null
    throw error
  }
  return data as PayPalOrderIntentRow | null
}

export async function findPayPalOrderIntentByProviderReference(
  supabase: PayPalOrderIntentClient,
  input: { orderId?: string | null; captureId?: string | null },
) {
  if (input.captureId) {
    const { data, error } = await supabase
      .from("paypal_order_intents")
      .select("*")
      .eq("provider_capture_id", input.captureId)
      .maybeSingle()
    if (error) throw error
    if (data || !input.orderId) return data as PayPalOrderIntentRow | null
  }
  if (!input.orderId) return null
  const { data, error } = await supabase
    .from("paypal_order_intents")
    .select("*")
    .eq("provider_order_id", input.orderId)
    .maybeSingle()
  if (error) throw error
  return data as PayPalOrderIntentRow | null
}

export async function createProviderPayPalOrder(intent: PayPalOrderIntentRow) {
  const { paypalRequest } = await import("./client")
  const order = await paypalRequest<{ id?: string }>("/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": paypalOrderRequestId(intent.token, "create") },
    body: JSON.stringify(buildPayPalPersonalPlanOrder(intent.token)),
  })
  if (!order.id) throw new Error("PayPal order creation did not return an id")
  return order.id
}

export async function bindPayPalOrderIntentToOrder(
  supabase: PayPalOrderIntentClient,
  token: string,
  orderId: string,
) {
  const { data, error } = await supabase
    .from("paypal_order_intents")
    .update({ provider_order_id: orderId })
    .eq("token", token)
    .select("*")
    .single()
  if (error) throw error
  return data as PayPalOrderIntentRow
}

export async function markPayPalOrderIntentCaptured(
  supabase: PayPalOrderIntentClient,
  token: string,
  captureId: string,
) {
  const { data, error } = await supabase
    .from("paypal_order_intents")
    .update({ provider_capture_id: captureId, status: "captured" })
    .eq("token", token)
    .select("*")
    .single()
  if (error) throw error
  return data as PayPalOrderIntentRow
}

export async function captureProviderPayPalOrder(orderId: string, token: string) {
  const { paypalRequest } = await import("./client")
  return paypalRequest<PayPalCaptureResponse>(
    `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: "POST",
      headers: { "PayPal-Request-Id": paypalOrderRequestId(token, "capture") },
    },
  )
}

export function isPayPalOrderIntentExpired(intent: PayPalOrderIntentRow, now = new Date()) {
  return Date.parse(intent.expires_at) <= now.getTime()
}

function isMissingPayPalOrderIntentsTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const candidate = error as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === "string" ? candidate.code : ""
  const message = typeof candidate.message === "string" ? candidate.message : ""
  return (code === "PGRST205" || code === "42P01") && message.includes("paypal_order_intents")
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505",
  )
}
