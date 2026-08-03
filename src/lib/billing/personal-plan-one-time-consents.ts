import { createHash } from "node:crypto"

import {
  PERSONAL_PLAN_ONE_TIME_PURCHASE_CONTEXT_COPY_VERSION,
  PERSONAL_PLAN_ONE_TIME_PURCHASE_CONTEXT_TEXT,
} from "./personal-plan-one-time-consent-copy"
import type { BillingOneTimePurchaseRow, SupabaseBillingClient } from "./types"

export {
  PERSONAL_PLAN_ONE_TIME_PURCHASE_CONTEXT_COPY_VERSION,
  PERSONAL_PLAN_ONE_TIME_PURCHASE_CONTEXT_TEXT,
} from "./personal-plan-one-time-consent-copy"

const PURCHASE_CONTEXT_BY_VERSION = {
  [PERSONAL_PLAN_ONE_TIME_PURCHASE_CONTEXT_COPY_VERSION]:
    PERSONAL_PLAN_ONE_TIME_PURCHASE_CONTEXT_TEXT,
} as const

export type PersonalPlanOneTimeCheckoutConsentRow = {
  id: string
  lead_id: string
  funnel_session_id: string
  user_id: string | null
  product_kind: "personal_plan_once"
  offer_variant: string
  copy_version: string
  consent_text: string
  consent_text_sha256: string
  accepted_at: string
  stripe_checkout_session_id: string | null
  paypal_order_id: string | null
  paypal_capture_id: string | null
  confirmation_provider: string | null
  confirmation_status: "pending" | "sent" | "delivered" | "failed"
  confirmation_reference: string | null
  confirmation_sent_at: string | null
  confirmation_delivered_at: string | null
  generation_started_at: string | null
  generation_completed_at: string | null
  generated_content_sha256: string | null
  delivery_provider: string | null
  delivery_reference: string | null
  delivered_at: string | null
  first_accessed_at: string | null
  created_at: string
  updated_at: string
}

export type CreatePersonalPlanOneTimeConsentInput = {
  leadId: string
  funnelSessionId: string
  offerVariant: string
  userId?: string | null
  createdAt?: string
  purchaseContextText?: string
  purchaseContextVersion?: string
}

export function consentTextSha256(consentText: string): string {
  return createHash("sha256").update(consentText, "utf8").digest("hex")
}

export async function createPersonalPlanOneTimeCheckoutConsent(
  supabase: SupabaseBillingClient,
  input: CreatePersonalPlanOneTimeConsentInput,
): Promise<PersonalPlanOneTimeCheckoutConsentRow> {
  const purchaseContextText =
    input.purchaseContextText ?? PERSONAL_PLAN_ONE_TIME_PURCHASE_CONTEXT_TEXT
  const purchaseContextVersion =
    input.purchaseContextVersion ?? PERSONAL_PLAN_ONE_TIME_PURCHASE_CONTEXT_COPY_VERSION
  if (
    PURCHASE_CONTEXT_BY_VERSION[
      purchaseContextVersion as keyof typeof PURCHASE_CONTEXT_BY_VERSION
    ] !== purchaseContextText
  ) {
    throw new Error("Unsupported personal-plan one-time purchase context")
  }
  const { data, error } = await supabase
    .from("personal_plan_one_time_checkout_consents")
    .insert({
      lead_id: input.leadId,
      funnel_session_id: input.funnelSessionId,
      user_id: input.userId ?? null,
      product_kind: "personal_plan_once",
      offer_variant: input.offerVariant,
      copy_version: purchaseContextVersion,
      consent_text: purchaseContextText,
      consent_text_sha256: consentTextSha256(purchaseContextText),
      // Compatibility column: for purchase-context rows this is the server-created
      // context timestamp, not evidence of a customer acceptance action.
      accepted_at: input.createdAt ?? new Date().toISOString(),
    })
    .select("*")
    .single()

  if (error) throw error
  return data as PersonalPlanOneTimeCheckoutConsentRow
}

export async function findPersonalPlanOneTimeConsentByStripeCheckoutSessionId(
  supabase: SupabaseBillingClient,
  stripeCheckoutSessionId: string,
): Promise<PersonalPlanOneTimeCheckoutConsentRow | null> {
  return findPersonalPlanOneTimeCheckoutConsentByProviderReference(
    supabase,
    "stripe_checkout_session_id",
    stripeCheckoutSessionId,
  )
}

export async function findPersonalPlanOneTimeConsentById(
  supabase: SupabaseBillingClient,
  consentId: string,
): Promise<PersonalPlanOneTimeCheckoutConsentRow | null> {
  const { data, error } = await supabase
    .from("personal_plan_one_time_checkout_consents")
    .select("*")
    .eq("id", consentId)
    .maybeSingle()

  if (error) throw error
  return (data as PersonalPlanOneTimeCheckoutConsentRow | null) ?? null
}

export async function findPersonalPlanOneTimeConsentByPayPalReference(
  supabase: SupabaseBillingClient,
  reference: { orderId: string } | { captureId: string },
): Promise<PersonalPlanOneTimeCheckoutConsentRow | null> {
  if ("orderId" in reference) {
    return findPersonalPlanOneTimeCheckoutConsentByProviderReference(
      supabase,
      "paypal_order_id",
      reference.orderId,
    )
  }
  return findPersonalPlanOneTimeCheckoutConsentByProviderReference(
    supabase,
    "paypal_capture_id",
    reference.captureId,
  )
}

export async function findPersonalPlanOneTimeConsentByLeadSession(
  supabase: SupabaseBillingClient,
  lookup: { leadId: string; funnelSessionId: string },
): Promise<PersonalPlanOneTimeCheckoutConsentRow | null> {
  const { data, error } = await supabase
    .from("personal_plan_one_time_checkout_consents")
    .select("*")
    .eq("lead_id", lookup.leadId)
    .eq("funnel_session_id", lookup.funnelSessionId)
    .maybeSingle()

  if (error) throw error
  return (data as PersonalPlanOneTimeCheckoutConsentRow | null) ?? null
}

export async function bindPersonalPlanOneTimeConsentProviderReference(
  supabase: SupabaseBillingClient,
  consentId: string,
  reference:
    | { stripeCheckoutSessionId: string }
    | { paypalOrderId: string; paypalCaptureId?: string | null }
    | { paypalCaptureId: string },
): Promise<PersonalPlanOneTimeCheckoutConsentRow> {
  const { data, error } = await supabase
    .from("personal_plan_one_time_checkout_consents")
    .update(toProviderReferencePatch(reference))
    .eq("id", consentId)
    .select("*")
    .single()

  if (error) throw error
  return data as PersonalPlanOneTimeCheckoutConsentRow
}

export async function bindPersonalPlanOneTimePurchaseUser(
  supabase: SupabaseBillingClient & { rpc: (fn: string, args: Record<string, unknown>) => unknown },
  input: { consentId: string; purchaseId: string; userId: string },
): Promise<BillingOneTimePurchaseRow> {
  const result = supabase.rpc("bind_personal_plan_one_time_purchase_user", {
    p_consent_id: input.consentId,
    p_purchase_id: input.purchaseId,
    p_user_id: input.userId,
  }) as PromiseLike<{ data: unknown; error: unknown }>
  const { data, error } = await result
  if (error) throw error
  return data as BillingOneTimePurchaseRow
}

export async function recordPersonalPlanOneTimeConfirmation(
  supabase: SupabaseBillingClient,
  consentId: string,
  input: {
    provider: string
    reference: string
    status: "sent" | "delivered" | "failed"
    at?: string
  },
): Promise<PersonalPlanOneTimeCheckoutConsentRow> {
  const at = input.at ?? new Date().toISOString()
  const { data, error } = await supabase
    .from("personal_plan_one_time_checkout_consents")
    .update({
      confirmation_provider: input.provider,
      confirmation_reference: input.reference,
      confirmation_status: input.status,
      confirmation_sent_at: at,
      confirmation_delivered_at: input.status === "delivered" ? at : null,
    })
    .eq("id", consentId)
    .select("*")
    .single()

  if (error) throw error
  return data as PersonalPlanOneTimeCheckoutConsentRow
}

export async function recordPersonalPlanOneTimeDeliveryEvidence(
  supabase: SupabaseBillingClient,
  consentId: string,
  input: {
    generationStartedAt?: string
    generationCompletedAt?: string
    generatedContentSha256?: string
    deliveryProvider?: string
    deliveryReference?: string
    deliveredAt?: string
    firstAccessedAt?: string
  },
): Promise<PersonalPlanOneTimeCheckoutConsentRow> {
  const patch = Object.fromEntries(
    Object.entries({
      generation_started_at: input.generationStartedAt,
      generation_completed_at: input.generationCompletedAt,
      generated_content_sha256: input.generatedContentSha256,
      delivery_provider: input.deliveryProvider,
      delivery_reference: input.deliveryReference,
      delivered_at: input.deliveredAt,
      first_accessed_at: input.firstAccessedAt,
    }).filter(([, value]) => value !== undefined),
  )
  const { data, error } = await supabase
    .from("personal_plan_one_time_checkout_consents")
    .update(patch)
    .eq("id", consentId)
    .select("*")
    .single()

  if (error) throw error
  return data as PersonalPlanOneTimeCheckoutConsentRow
}

function toProviderReferencePatch(
  reference:
    | { stripeCheckoutSessionId: string }
    | { paypalOrderId: string; paypalCaptureId?: string | null }
    | { paypalCaptureId: string },
): Record<string, string | null> {
  if ("stripeCheckoutSessionId" in reference) {
    return { stripe_checkout_session_id: reference.stripeCheckoutSessionId }
  }
  if ("paypalOrderId" in reference) {
    return {
      paypal_order_id: reference.paypalOrderId,
      paypal_capture_id: reference.paypalCaptureId ?? null,
    }
  }
  return { paypal_capture_id: reference.paypalCaptureId }
}

async function findPersonalPlanOneTimeCheckoutConsentByProviderReference(
  supabase: SupabaseBillingClient,
  column: "stripe_checkout_session_id" | "paypal_order_id" | "paypal_capture_id",
  reference: string,
): Promise<PersonalPlanOneTimeCheckoutConsentRow | null> {
  const { data, error } = await supabase
    .from("personal_plan_one_time_checkout_consents")
    .select("*")
    .eq(column, reference)
    .maybeSingle()

  if (error) throw error
  return (data as PersonalPlanOneTimeCheckoutConsentRow | null) ?? null
}
