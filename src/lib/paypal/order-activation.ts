import type { SupabaseClient } from "@supabase/supabase-js"

import { PERSONAL_PLAN_ONCE_PRODUCT } from "@/lib/billing/offer-products"
import { upsertOneTimePurchase } from "@/lib/billing/purchases"
import {
  recordPersonalPlanOneTimeConfirmation,
  type PersonalPlanOneTimeCheckoutConsentRow,
} from "@/lib/billing/personal-plan-one-time-consents"
import { sendPersonalPlanOneTimeConfirmation } from "@/lib/customerio/personal-plan-one-time-confirmation"
import {
  ensurePayPalOneTimePurchaseAccount,
  PayPalCheckoutActivationError,
  type PayPalCheckoutAccountResult,
} from "./checkout-activation"
import {
  captureProviderPayPalOrder,
  findPayPalOrderIntentByToken,
  isPayPalOrderIntentExpired,
  markPayPalOrderIntentCaptured,
  PAYPAL_PERSONAL_PLAN_ONCE_AMOUNT,
  PAYPAL_PERSONAL_PLAN_ONCE_CURRENCY,
  type PayPalOrderIntentRow,
} from "./order-intents"

type CapturedPayPalOrder = Awaited<ReturnType<typeof captureProviderPayPalOrder>>

export type PayPalOrderActivationDeps = {
  supabase: SupabaseClient
  captureOrder?: typeof captureProviderPayPalOrder
  ensureAccount?: typeof ensurePayPalOneTimePurchaseAccount
  linkQuizToProfile?: (userId: string, email: string | undefined, leadId?: string) => Promise<void>
  now?: () => Date
  sendConfirmation?: typeof sendPersonalPlanOneTimeConfirmation
}

export type PayPalOrderActivationResult = {
  status: "active"
  intent: PayPalOrderIntentRow
  account: Extract<PayPalCheckoutAccountResult, { status: "active" }>
}

export async function captureAndActivatePayPalOrder(
  token: string,
  deps: PayPalOrderActivationDeps,
): Promise<PayPalOrderActivationResult> {
  let intent = await findPayPalOrderIntentByToken(deps.supabase, token)
  if (!intent?.provider_order_id || !intent.email) {
    throw new PayPalCheckoutActivationError(
      "paypal_order_intent_missing",
      "PayPal order intent is missing",
    )
  }
  const purchaseEmail = intent.email
  if (isPayPalOrderIntentExpired(intent, (deps.now ?? (() => new Date()))())) {
    throw new PayPalCheckoutActivationError(
      "paypal_order_intent_expired",
      "PayPal order intent is expired",
    )
  }

  let captureId = intent.provider_capture_id
  if (!captureId) {
    const order = await (deps.captureOrder ?? captureProviderPayPalOrder)(
      intent.provider_order_id,
      intent.token,
    )
    captureId = validateCapturedPayPalOrder(order, intent)
    intent = await markPayPalOrderIntentCaptured(deps.supabase, token, captureId)
  }
  if (!captureId) {
    throw new PayPalCheckoutActivationError(
      "paypal_order_capture_incomplete",
      "PayPal order capture is missing",
    )
  }

  const { data: consent, error: consentError } = await deps.supabase
    .from("personal_plan_one_time_checkout_consents")
    .select("*")
    .eq("id", intent.consent_id)
    .single()
  if (consentError || !consent)
    throw new PayPalCheckoutActivationError(
      "paypal_order_intent_missing",
      "PayPal order consent is missing",
    )
  const canonicalConsent = consent as PersonalPlanOneTimeCheckoutConsentRow
  if (
    canonicalConsent.confirmation_status !== "sent" &&
    canonicalConsent.confirmation_status !== "delivered"
  ) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
    try {
      const confirmation = await (deps.sendConfirmation ?? sendPersonalPlanOneTimeConfirmation)({
        email: purchaseEmail,
        consent: {
          text: canonicalConsent.consent_text,
          version: canonicalConsent.copy_version,
          acceptedAt: canonicalConsent.accepted_at,
        },
        payment: { provider: "paypal", reference: captureId },
        supportUrl: new URL("/kontakt", siteUrl).toString(),
        withdrawalUrl: new URL("/widerruf", siteUrl).toString(),
        resultUrl: intent.lead_id
          ? new URL(`/result/${encodeURIComponent(intent.lead_id)}`, siteUrl).toString()
          : undefined,
      })
      await recordPersonalPlanOneTimeConfirmation(deps.supabase, intent.consent_id, {
        provider: "paypal",
        reference: confirmation.confirmationReference,
        status: "sent",
      })
    } catch {
      await recordPersonalPlanOneTimeConfirmation(deps.supabase, intent.consent_id, {
        provider: "paypal",
        reference: `paypal:${captureId}:confirmation_failed`,
        status: "failed",
      }).catch(() => {})
      throw new PayPalCheckoutActivationError(
        "paypal_order_confirmation_failed",
        "PayPal one-time confirmation could not be sent",
      )
    }
  }

  const account = await (deps.ensureAccount ?? ensurePayPalOneTimePurchaseAccount)(
    {
      supabase: deps.supabase,
      premiumTierId: "",
      linkQuizToProfile: deps.linkQuizToProfile,
    },
    {
      email: purchaseEmail,
      activationKey: token,
      leadId: intent.lead_id,
    },
  )
  await upsertOneTimePurchase(deps.supabase, {
    user_id: account.userId,
    provider: "paypal",
    provider_transaction_id: captureId,
    provider_order_id: intent.provider_order_id,
    amount_minor: PERSONAL_PLAN_ONCE_PRODUCT.amountMinor,
    currency: "eur",
    status: "paid",
    paid_at: (deps.now ?? (() => new Date()))().toISOString(),
    metadata: { paypal_order_intent_token: token },
  })

  return { status: "active", intent, account }
}

export async function recoverPayPalOrderActivation(token: string, deps: PayPalOrderActivationDeps) {
  return captureAndActivatePayPalOrder(token, deps)
}

export function validateCapturedPayPalOrder(
  order: CapturedPayPalOrder,
  intent: PayPalOrderIntentRow,
  expectedMerchantId = process.env.PAYPAL_MERCHANT_ID,
) {
  const purchaseUnit = order.purchase_units?.[0]
  const capture = purchaseUnit?.payments?.captures?.[0]
  if (
    !expectedMerchantId?.trim() ||
    order.status !== "COMPLETED" ||
    purchaseUnit?.custom_id !== intent.token ||
    purchaseUnit?.payee?.merchant_id !== expectedMerchantId.trim() ||
    purchaseUnit?.amount?.currency_code !== PAYPAL_PERSONAL_PLAN_ONCE_CURRENCY ||
    purchaseUnit?.amount?.value !== PAYPAL_PERSONAL_PLAN_ONCE_AMOUNT ||
    capture?.status !== "COMPLETED" ||
    capture?.amount?.currency_code !== PAYPAL_PERSONAL_PLAN_ONCE_CURRENCY ||
    capture?.amount?.value !== PAYPAL_PERSONAL_PLAN_ONCE_AMOUNT ||
    !capture.id
  ) {
    throw new PayPalCheckoutActivationError(
      "paypal_order_capture_incomplete",
      "PayPal order capture failed validation",
    )
  }
  return capture.id
}
