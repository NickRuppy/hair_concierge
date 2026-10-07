import type { SupabaseClient } from "@supabase/supabase-js"

export const PAYPAL_PERSONAL_PLAN_ONCE_AMOUNT = "29.99"
export const PAYPAL_PERSONAL_PLAN_ONCE_CURRENCY = "EUR"

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
        create_time?: string
        amount?: { currency_code?: string; value?: string }
      }>
    }
  }>
}

export function paypalOrderRequestId(token: string, action: "create" | "capture") {
  return `personal-plan-once:${action}:${token}`
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
  orderId: string,
  captureId: string,
) {
  const { data, error } = await supabase
    .from("paypal_order_intents")
    .update({ provider_capture_id: captureId, status: "captured" })
    .eq("token", token)
    .eq("provider_order_id", orderId)
    .is("provider_capture_id", null)
    .select("*")
    .maybeSingle()
  if (error) throw error
  if (data) return data as PayPalOrderIntentRow

  const current = await findPayPalOrderIntentByToken(supabase, token)
  if (
    current?.provider_order_id === orderId &&
    current.provider_capture_id === captureId &&
    current.status === "captured"
  ) {
    return current
  }
  return null
}

export async function captureProviderPayPalOrder(orderId: string, token: string) {
  const { paypalRequest } = await import("./client")
  return paypalRequest<PayPalCaptureResponse>(
    `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: "POST",
      headers: {
        "PayPal-Request-Id": paypalOrderRequestId(token, "capture"),
        Prefer: "return=representation",
      },
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
