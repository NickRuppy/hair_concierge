import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

import { PERSONAL_PLAN_ONCE_PRODUCT } from "@/lib/billing/offer-products"
import {
  activateVerifiedOneTimePayment,
  OneTimeActivationError,
  processPersonalPlanOneTimeFulfillmentJob,
  type OneTimeActivationDependencies,
  type OneTimeActivationResult,
  type VerifiedOneTimePayment,
} from "@/lib/billing/personal-plan-one-time-activation"
import { findOneTimePurchaseByProviderTransactionId } from "@/lib/billing/purchases"
import {
  bindPersonalPlanOneTimeConsentProviderReference,
  type PersonalPlanOneTimeCheckoutConsentRow,
} from "@/lib/billing/personal-plan-one-time-consents"
import { sendPersonalPlanOneTimeConfirmation } from "@/lib/customerio/personal-plan-one-time-confirmation"
import {
  canSetInitialPasswordForPayPalCheckout,
  ensurePayPalOneTimePurchaseAccount,
  PayPalCheckoutActivationError,
  type PayPalCheckoutAccountResult,
} from "./checkout-activation"
import {
  captureProviderPayPalOrder,
  findPayPalOrderIntentByProviderReference,
  findPayPalOrderIntentByToken,
  isPayPalOrderIntentExpired,
  markPayPalOrderIntentCaptured,
  PAYPAL_PERSONAL_PLAN_ONCE_AMOUNT,
  PAYPAL_PERSONAL_PLAN_ONCE_CURRENCY,
  type PayPalOrderIntentRow,
} from "./order-intents"
import type { PersonalPlanOneTimeFulfillmentJobRow } from "@/lib/billing/types"
import { resolvePaymentRuntime } from "@/lib/billing/payment-runtime-config"
import type { PaymentFailureReporter } from "@/lib/observability/payment"
import { captureServerPaymentFailure } from "@/lib/observability/payment-server"

type CapturedPayPalOrder = Awaited<ReturnType<typeof captureProviderPayPalOrder>>
export const PERSONAL_PLAN_PREPARED_ARTIFACT_DELIVERY_PROVIDER = "personal_plan_prepared_artifacts"
export type VerifiedPayPalCapture = {
  captureId: string
  orderId: string
  paidAt: string
}
type PayPalOrderLookupResponse = CapturedPayPalOrder & {
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

export type PayPalOrderActivationDeps = {
  supabase: SupabaseClient
  captureOrder?: typeof captureProviderPayPalOrder
  retrieveOrder?: typeof retrieveProviderPayPalOrder
  ensureAccount?: typeof ensurePayPalOneTimePurchaseAccount
  linkQuizToProfile?: (userId: string, email: string | undefined, leadId?: string) => Promise<void>
  now?: () => Date
  sendConfirmation?: typeof sendPersonalPlanOneTimeConfirmation
  finalizeLockedPlan?: OneTimeActivationDependencies["finalizeLockedPlan"]
  siteUrl?: string
  defer?: (work: () => void | Promise<void>) => void
  capturePaymentFailure?: PaymentFailureReporter
}

type ActivePayPalCheckoutAccount = Extract<PayPalCheckoutAccountResult, { status: "active" }>

type PayPalOrderActivationBase = {
  intent: PayPalOrderIntentRow
  activation?: OneTimeActivationResult
}

export type PayPalOrderActivationResult =
  | (PayPalOrderActivationBase & {
      status: "active"
      state?: "active"
      account: ActivePayPalCheckoutAccount
    })
  | (PayPalOrderActivationBase & {
      status: Exclude<OneTimeActivationResult["state"], "active">
      state?: Exclude<OneTimeActivationResult["state"], "active">
      account?: ActivePayPalCheckoutAccount | null
    })

export type PayPalOneTimeRecoveryVerification = {
  payment: VerifiedOneTimePayment
  intent: PayPalOrderIntentRow
  consent: PersonalPlanOneTimeCheckoutConsentRow
  existingPurchase: Awaited<ReturnType<typeof findOneTimePurchaseByProviderTransactionId>>
  accountContext: {
    activationKey: string
    email: string
    leadId: string
  }
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
  if (isPayPalOrderIntentExpired(intent, (deps.now ?? (() => new Date()))())) {
    throw new PayPalCheckoutActivationError(
      "paypal_order_intent_expired",
      "PayPal order intent is expired",
    )
  }

  let verifiedCapture: VerifiedPayPalCapture
  if (intent.provider_capture_id) {
    const existingPurchase = await findOneTimePurchaseByProviderTransactionId(
      deps.supabase,
      "paypal",
      intent.provider_capture_id,
    )
    if (existingPurchase) {
      verifiedCapture = {
        captureId: intent.provider_capture_id,
        orderId: intent.provider_order_id,
        paidAt: existingPurchase.paid_at,
      }
    } else {
      let order: CapturedPayPalOrder
      try {
        order = await (deps.retrieveOrder ?? retrieveProviderPayPalOrder)(intent.provider_order_id)
      } catch {
        reportPayPalOrderFailure(deps, intent, {
          signal: "customer_payment_error_observed",
          boundary: "provider_outcome",
          errorFamily: "provider_unavailable",
          truth: "unknown",
        })
        throw payPalCapturePendingError()
      }
      try {
        verifiedCapture = validateCapturedPayPalOrder(order, intent, undefined, {
          expectedCaptureId: intent.provider_capture_id,
        })
      } catch (error) {
        reportPayPalOrderFailure(deps, intent, {
          signal: "customer_payment_error_observed",
          boundary: "provider_outcome",
          errorFamily: "processing",
          truth: "unknown",
        })
        throw error
      }
    }
  } else {
    let order: CapturedPayPalOrder
    try {
      order = await (deps.captureOrder ?? captureProviderPayPalOrder)(
        intent.provider_order_id,
        intent.token,
      )
    } catch (error) {
      if (isPayPalOrderAlreadyCaptured(error)) {
        try {
          order = await (deps.retrieveOrder ?? retrieveProviderPayPalOrder)(
            intent.provider_order_id,
          )
        } catch {
          reportPayPalOrderFailure(deps, intent, {
            signal: "customer_payment_error_observed",
            boundary: "provider_outcome",
            errorFamily: "provider_unavailable",
            truth: "unknown",
          })
          throw payPalCapturePendingError()
        }
      } else {
        reportPayPalOrderFailure(
          deps,
          intent,
          isPayPalCaptureRejected(error)
            ? {
                signal: "provider_payment_failed",
                boundary: "provider_outcome",
                errorFamily: "processing",
                truth: "failed",
              }
            : {
                signal: "customer_payment_error_observed",
                boundary: "provider_outcome",
                errorFamily: "provider_unavailable",
                truth: "unknown",
              },
        )
        throw error
      }
    }
    try {
      verifiedCapture = validateCapturedPayPalOrder(order, intent)
    } catch (error) {
      if (shouldRetrievePayPalOrderAfterCapture(order, intent)) {
        try {
          order = await (deps.retrieveOrder ?? retrieveProviderPayPalOrder)(
            intent.provider_order_id,
          )
        } catch {
          reportPayPalOrderFailure(deps, intent, {
            signal: "customer_payment_error_observed",
            boundary: "provider_outcome",
            errorFamily: "provider_unavailable",
            truth: "unknown",
          })
          throw payPalCapturePendingError()
        }
        try {
          verifiedCapture = validateCapturedPayPalOrder(order, intent)
        } catch (retrieveValidationError) {
          reportPayPalOrderFailure(deps, intent, payPalCaptureValidationFailure(order))
          throw retrieveValidationError
        }
      } else {
        reportPayPalOrderFailure(deps, intent, payPalCaptureValidationFailure(order))
        throw error
      }
    }
  }

  if (!intent.provider_capture_id) {
    intent = await tryMarkPayPalOrderIntentCaptured(
      deps.supabase,
      token,
      verifiedCapture.orderId,
      verifiedCapture.captureId,
    )
  }
  const result = await activateVerifiedPayPalOrderIntent(intent, verifiedCapture, deps)
  return { ...result, intent }
}

export async function activateVerifiedPayPalOrderIntent(
  intent: PayPalOrderIntentRow,
  capture: VerifiedPayPalCapture,
  deps: PayPalOrderActivationDeps,
): Promise<PayPalOrderActivationResult> {
  if (!intent.email) {
    throw new PayPalCheckoutActivationError(
      "paypal_order_intent_missing",
      "PayPal order intent is missing an email",
    )
  }

  const { data: consent, error: consentError } = await deps.supabase
    .from("personal_plan_one_time_checkout_consents")
    .select("*")
    .eq("id", intent.consent_id)
    .single()
  if (consentError || !consent) {
    reportPayPalOrderFailure(deps, intent, {
      signal: "customer_payment_error_observed",
      boundary: "billing",
      errorFamily: "billing_state",
      truth: "succeeded",
    })
    throw new PayPalCheckoutActivationError(
      "paypal_order_intent_missing",
      "PayPal order consent is missing",
    )
  }
  const canonicalConsent = consent as PersonalPlanOneTimeCheckoutConsentRow

  let account: ActivePayPalCheckoutAccount | null = null
  let activation: OneTimeActivationResult
  try {
    activation = await activateVerifiedOneTimePayment(
      payPalVerifiedPaymentFromCapture(capture, intent, canonicalConsent),
      {
        supabase: deps.supabase,
        postPurchasePersisted: async () =>
          bindPayPalConsentProviderReference(deps.supabase, canonicalConsent.id, capture),
        sendConfirmation: deps.sendConfirmation,
        finalizeLockedPlan:
          deps.finalizeLockedPlan ??
          ((context) => finalizeLockedPersonalPlanFromPreparedArtifact(deps.supabase, context)),
        siteUrl: deps.siteUrl,
        defer: deps.defer,
        now: deps.now,
        ensureAccount: async (payment) => {
          account = await (deps.ensureAccount ?? ensurePayPalOneTimePurchaseAccount)(
            {
              supabase: deps.supabase,
              premiumTierId: "",
            },
            {
              email: payment.email,
              activationKey: intent.token,
              leadId: canonicalConsent.lead_id,
            },
          )
          return { userId: account.userId }
        },
        linkQuizToProfile: deps.linkQuizToProfile
          ? async ({ userId, payment, consent }) => {
              await deps.linkQuizToProfile?.(userId, payment.email, consent.lead_id)
            }
          : undefined,
      },
    )
  } catch (error) {
    reportPayPalOrderFailure(deps, intent, {
      signal: "customer_payment_error_observed",
      boundary: "entitlement",
      errorFamily: "entitlement_state",
      truth: "succeeded",
    })
    throw error
  }

  if (activation.state === "active") {
    const activeAccount =
      account ??
      (await loadActivePayPalOneTimeAccountFromReplay(deps.supabase, {
        userId: activation.purchase.user_id,
        email: intent.email,
        leadId: canonicalConsent.lead_id,
        activationKey: intent.token,
      }))
    return {
      status: "active",
      state: "active",
      intent,
      account: activeAccount,
      activation,
    }
  }
  return {
    status: activation.state,
    state: activation.state,
    intent,
    account: null,
    activation,
  }
}

export async function recoverPayPalOrderActivation(token: string, deps: PayPalOrderActivationDeps) {
  const verification = await verifyPayPalOneTimePaymentForRecovery({
    supabase: deps.supabase,
    token,
    retrieveOrder: deps.retrieveOrder,
  })
  const intent = verification.intent.provider_capture_id
    ? verification.intent
    : await tryMarkPayPalOrderIntentCaptured(
        deps.supabase,
        token,
        verification.payment.providerOrderId,
        verification.payment.providerTransactionId,
      )
  const result = await activateVerifiedPayPalOrderIntent(
    intent,
    {
      captureId: verification.payment.providerTransactionId,
      orderId: verification.payment.providerOrderId,
      paidAt: verification.payment.paidAt,
    },
    deps,
  )
  return { ...result, intent }
}

function reportPayPalOrderFailure(
  deps: PayPalOrderActivationDeps,
  intent: PayPalOrderIntentRow,
  failure: {
    signal: "provider_payment_failed" | "customer_payment_error_observed"
    boundary: "provider_outcome" | "billing" | "entitlement"
    errorFamily: "processing" | "provider_unavailable" | "billing_state" | "entitlement_state"
    truth: "failed" | "succeeded" | "unknown"
  },
) {
  const report = deps.capturePaymentFailure ?? captureServerPaymentFailure
  const runtime = resolvePaymentRuntime({
    VERCEL_ENV: process.env.VERCEL_ENV,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    PAYPAL_ENVIRONMENT: process.env.PAYPAL_ENVIRONMENT,
  })
  try {
    report({
      ...failure,
      provider: "paypal",
      commerceKind: "one_time",
      origin: "provider_api",
      method: "paypal",
      live: runtime.paypalLive,
      isInternalTest: intent.metadata?.is_internal_test === true,
      retryable: "true",
      checkoutAttemptId: intent.checkout_attempt_id,
      leadId: intent.lead_id,
      providerReferencePresent: Boolean(intent.provider_order_id),
    })
  } catch {
    // Observability must not alter provider capture or activation behavior.
  }
}

function isPayPalCaptureRejected(error: unknown) {
  if (!error || typeof error !== "object" || !("status" in error)) return false
  return error.status === 422
}

function payPalCapturePendingError() {
  return new PayPalCheckoutActivationError(
    "paypal_order_capture_pending",
    "PayPal order capture is not complete",
  )
}

function isPayPalOrderAlreadyCaptured(error: unknown) {
  if (!isPayPalCaptureRejected(error)) return false
  const candidate = error as { message?: unknown; details?: unknown }
  const message = typeof candidate.message === "string" ? candidate.message : ""
  let details = ""
  try {
    details = JSON.stringify(candidate.details ?? "")
  } catch {
    // A malformed provider error remains an ordinary rejected capture.
  }
  return /ORDER_ALREADY_CAPTURED/i.test(`${message} ${details}`)
}

function shouldRetrievePayPalOrderAfterCapture(
  order: CapturedPayPalOrder,
  intent: PayPalOrderIntentRow,
) {
  const expectedMerchantId = process.env.PAYPAL_MERCHANT_ID?.trim()
  const orderId = typeof order.id === "string" ? order.id.trim() : ""
  const purchaseUnits = order.purchase_units ?? []
  const purchaseUnit = purchaseUnits[0]
  const captures = purchaseUnit?.payments?.captures ?? []

  if (orderId && orderId !== intent.provider_order_id) return false
  if (purchaseUnits.length > 1) return false
  if (purchaseUnit?.custom_id != null && purchaseUnit.custom_id !== intent.token) return false
  if (
    purchaseUnit?.payee?.merchant_id != null &&
    expectedMerchantId &&
    purchaseUnit.payee.merchant_id !== expectedMerchantId
  ) {
    return false
  }
  if (
    purchaseUnit?.amount?.currency_code != null &&
    purchaseUnit.amount.currency_code !== PAYPAL_PERSONAL_PLAN_ONCE_CURRENCY
  ) {
    return false
  }
  if (
    purchaseUnit?.amount?.value != null &&
    purchaseUnit.amount.value !== PAYPAL_PERSONAL_PLAN_ONCE_AMOUNT
  ) {
    return false
  }
  if (
    captures.some(
      (capture) =>
        (capture.amount?.currency_code != null &&
          capture.amount.currency_code !== PAYPAL_PERSONAL_PLAN_ONCE_CURRENCY) ||
        (capture.amount?.value != null &&
          capture.amount.value !== PAYPAL_PERSONAL_PLAN_ONCE_AMOUNT),
    )
  ) {
    return false
  }

  // A successful capture can return a deliberately sparse representation.
  // Only missing or unsettled evidence is eligible for the single read-only lookup;
  // explicit identity or amount contradictions above remain fail-closed.
  if (!orderId || !order.status || !purchaseUnit) return true
  if (
    purchaseUnit.custom_id == null ||
    purchaseUnit.payee?.merchant_id == null ||
    purchaseUnit.amount?.currency_code == null ||
    purchaseUnit.amount?.value == null ||
    captures.length === 0
  ) {
    return true
  }
  return captures.some(
    (capture) =>
      capture.status === "PENDING" ||
      capture.id == null ||
      capture.create_time == null ||
      capture.amount?.currency_code == null ||
      capture.amount?.value == null,
  )
}

function payPalCaptureValidationFailure(order: CapturedPayPalOrder) {
  const captureStatuses =
    order.purchase_units?.flatMap((unit) =>
      (unit.payments?.captures ?? []).map((capture) => capture.status),
    ) ?? []
  const providerConfirmedFailure =
    order.status === "VOIDED" ||
    captureStatuses.some((status) => status === "DECLINED" || status === "FAILED")
  return providerConfirmedFailure
    ? ({
        signal: "provider_payment_failed",
        boundary: "provider_outcome",
        errorFamily: "processing",
        truth: "failed",
      } as const)
    : ({
        signal: "customer_payment_error_observed",
        boundary: "provider_outcome",
        errorFamily: "processing",
        truth: "unknown",
      } as const)
}

export async function processPayPalOneTimeFulfillmentJob(
  job: PersonalPlanOneTimeFulfillmentJobRow,
  deps: PayPalOrderActivationDeps,
): Promise<OneTimeActivationResult> {
  return processPersonalPlanOneTimeFulfillmentJob(job, {
    supabase: deps.supabase,
    postPurchasePersisted: async ({ payment, consent }) =>
      bindPayPalConsentProviderReference(deps.supabase, consent.id, {
        orderId: payment.providerOrderId,
        captureId: payment.providerTransactionId,
      }),
    ensureAccount: async (payment, { consent, purchase }) => {
      const intent = await loadPayPalIntentForPurchase(deps.supabase, purchase, consent)
      const account = await (deps.ensureAccount ?? ensurePayPalOneTimePurchaseAccount)(
        {
          supabase: deps.supabase,
          premiumTierId: "",
        },
        {
          email: payment.email,
          activationKey: intent.token,
          leadId: consent.lead_id,
        },
      )
      return { userId: account.userId }
    },
    linkQuizToProfile: deps.linkQuizToProfile
      ? async ({ userId, payment, consent }) => {
          await deps.linkQuizToProfile?.(userId, payment.email, consent.lead_id)
        }
      : undefined,
    sendConfirmation: deps.sendConfirmation,
    finalizeLockedPlan:
      deps.finalizeLockedPlan ??
      ((context) => finalizeLockedPersonalPlanFromPreparedArtifact(deps.supabase, context)),
    siteUrl: deps.siteUrl,
    now: deps.now,
    resolveVerifiedPaymentForRetry: async ({ purchase, consent }) => {
      try {
        const verification = await verifyPayPalOneTimePaymentForRecovery({
          supabase: deps.supabase,
          orderId: purchase.provider_order_id,
          captureId: purchase.provider_transaction_id,
          retrieveOrder: deps.retrieveOrder,
        })
        if (verification.consent.id !== consent.id) {
          throw new PayPalCheckoutActivationError(
            "paypal_order_intent_missing",
            "PayPal one-time fulfillment job consent mismatch",
          )
        }
        return verification.payment
      } catch (error) {
        throw payPalRetryVerificationError(error)
      }
    },
  })
}

function payPalRetryVerificationError(error: unknown): unknown {
  if (error instanceof OneTimeActivationError) return error
  if (!(error instanceof PayPalCheckoutActivationError)) return error
  return new OneTimeActivationError(
    `paypal_${error.code}`,
    error.message,
    isRetryablePayPalOneTimeVerificationError(error),
  )
}

function isRetryablePayPalOneTimeVerificationError(error: PayPalCheckoutActivationError) {
  return error.code === "paypal_order_capture_pending"
}

function bindPayPalConsentProviderReference(
  supabase: SupabaseClient,
  consentId: string,
  capture: Pick<VerifiedPayPalCapture, "orderId" | "captureId">,
) {
  return bindPersonalPlanOneTimeConsentProviderReference(supabase, consentId, {
    paypalOrderId: capture.orderId,
    paypalCaptureId: capture.captureId,
  })
}

export async function verifyPayPalOneTimePaymentForRecovery(input: {
  supabase: SupabaseClient
  token?: string | null
  orderId?: string | null
  captureId?: string | null
  retrieveOrder?: typeof retrieveProviderPayPalOrder
}): Promise<PayPalOneTimeRecoveryVerification> {
  const intent = await loadPayPalIntentForRecovery(input.supabase, input)
  if (!intent.email) {
    throw new PayPalCheckoutActivationError(
      "paypal_order_intent_missing",
      "PayPal one-time recovery intent is missing an email",
    )
  }
  const providerOrderId = input.orderId?.trim() || intent.provider_order_id
  const expectedCaptureId = input.captureId?.trim() || intent.provider_capture_id
  if (!providerOrderId) {
    throw new PayPalCheckoutActivationError(
      "paypal_order_capture_incomplete",
      "PayPal one-time recovery is missing provider references",
    )
  }

  const { data: consent, error: consentError } = await input.supabase
    .from("personal_plan_one_time_checkout_consents")
    .select("*")
    .eq("id", intent.consent_id)
    .single()
  if (consentError || !consent) {
    throw new PayPalCheckoutActivationError(
      "paypal_order_intent_missing",
      "PayPal one-time recovery consent is missing",
    )
  }

  const canonicalIntent = { ...intent, provider_order_id: providerOrderId }
  const order = await (input.retrieveOrder ?? retrieveProviderPayPalOrder)(providerOrderId)
  const capture = expectedCaptureId
    ? validateCapturedPayPalOrder(order, canonicalIntent, undefined, {
        expectedCaptureId,
      })
    : validateSingleCompletedPayPalOrderCapture(order, canonicalIntent)
  const existingPurchase = await findOneTimePurchaseByProviderTransactionId(
    input.supabase,
    "paypal",
    capture.captureId,
  )
  return {
    payment: payPalVerifiedPaymentFromCapture(
      capture,
      canonicalIntent,
      consent as PersonalPlanOneTimeCheckoutConsentRow,
    ),
    intent: canonicalIntent,
    consent: consent as PersonalPlanOneTimeCheckoutConsentRow,
    existingPurchase,
    accountContext: {
      activationKey: intent.token,
      email: intent.email,
      leadId: (consent as PersonalPlanOneTimeCheckoutConsentRow).lead_id,
    },
  }
}

export function validateCapturedPayPalOrder(
  order: CapturedPayPalOrder,
  intent: PayPalOrderIntentRow,
  expectedMerchantId = process.env.PAYPAL_MERCHANT_ID,
  options: { expectedCaptureId?: string | null } = {},
): VerifiedPayPalCapture {
  const rawOrder = order as { id?: unknown }
  const purchaseUnit = order.purchase_units?.[0]
  const captures = purchaseUnit?.payments?.captures ?? []
  const capture =
    options.expectedCaptureId != null
      ? captures.find((candidate) => candidate.id?.trim() === options.expectedCaptureId)
      : captures[0]
  const orderId = typeof rawOrder.id === "string" ? rawOrder.id.trim() : ""
  const captureId = typeof capture?.id === "string" ? capture.id.trim() : ""
  const captureCreatedAt =
    typeof (capture as { create_time?: unknown } | undefined)?.create_time === "string"
      ? (capture as { create_time: string }).create_time.trim()
      : ""
  if (
    !expectedMerchantId?.trim() ||
    !orderId ||
    orderId !== intent.provider_order_id ||
    purchaseUnit?.custom_id !== intent.token ||
    purchaseUnit?.payee?.merchant_id !== expectedMerchantId.trim() ||
    purchaseUnit?.amount?.currency_code !== PAYPAL_PERSONAL_PLAN_ONCE_CURRENCY ||
    purchaseUnit?.amount?.value !== PAYPAL_PERSONAL_PLAN_ONCE_AMOUNT
  ) {
    throw new PayPalCheckoutActivationError(
      "paypal_order_capture_incomplete",
      "PayPal order capture failed validation",
    )
  }
  if (options.expectedCaptureId != null && captures.length > 0 && !capture) {
    throw new PayPalCheckoutActivationError(
      "paypal_order_capture_incomplete",
      "PayPal order capture failed validation",
    )
  }
  if (order.status === "VOIDED" || capture?.status === "DECLINED" || capture?.status === "FAILED") {
    throw new PayPalCheckoutActivationError(
      "paypal_order_capture_incomplete",
      "PayPal order capture failed validation",
    )
  }
  if (order.status !== "COMPLETED" || !capture || capture.status !== "COMPLETED") {
    throw payPalCapturePendingError()
  }
  if (
    capture?.amount?.currency_code !== PAYPAL_PERSONAL_PLAN_ONCE_CURRENCY ||
    capture?.amount?.value !== PAYPAL_PERSONAL_PLAN_ONCE_AMOUNT ||
    !captureId ||
    (options.expectedCaptureId != null && captureId !== options.expectedCaptureId) ||
    !Number.isFinite(Date.parse(captureCreatedAt))
  ) {
    throw new PayPalCheckoutActivationError(
      "paypal_order_capture_incomplete",
      "PayPal order capture failed validation",
    )
  }
  return { captureId, orderId, paidAt: captureCreatedAt }
}

function validateSingleCompletedPayPalOrderCapture(
  order: CapturedPayPalOrder,
  intent: PayPalOrderIntentRow,
): VerifiedPayPalCapture {
  const completedCaptures = (order.purchase_units?.[0]?.payments?.captures ?? []).filter(
    (capture) => capture.status === "COMPLETED" && typeof capture.id === "string",
  )
  if (completedCaptures.length === 0) {
    throw payPalCapturePendingError()
  }
  if (completedCaptures.length !== 1) {
    throw new PayPalCheckoutActivationError(
      "paypal_order_capture_incomplete",
      "PayPal order capture failed validation",
    )
  }
  return validateCapturedPayPalOrder(order, intent, undefined, {
    expectedCaptureId: completedCaptures[0]?.id,
  })
}

export function verifiedPayPalCaptureFromWebhook(
  event: {
    create_time?: string
    resource?: {
      id?: string
      create_time?: string
      supplementary_data?: { related_ids?: { order_id?: string } }
    }
  },
  captureId: string,
): VerifiedPayPalCapture {
  const orderId = event.resource?.supplementary_data?.related_ids?.order_id?.trim() ?? ""
  const paidAt = event.resource?.create_time?.trim() || event.create_time?.trim() || ""
  if (!captureId.trim() || !orderId || !Number.isFinite(Date.parse(paidAt))) {
    throw new PayPalCheckoutActivationError(
      "paypal_order_capture_incomplete",
      "PayPal capture webhook is missing stable payment references",
    )
  }
  return { captureId: captureId.trim(), orderId, paidAt }
}

function payPalVerifiedPaymentFromCapture(
  capture: VerifiedPayPalCapture,
  intent: PayPalOrderIntentRow,
  consent: PersonalPlanOneTimeCheckoutConsentRow,
): VerifiedOneTimePayment {
  if (!intent.email) {
    throw new PayPalCheckoutActivationError(
      "paypal_order_intent_missing",
      "PayPal one-time payment intent is missing an email",
    )
  }
  return {
    provider: "paypal",
    providerTransactionId: capture.captureId,
    providerOrderId: capture.orderId,
    providerCustomerId: null,
    consentId: consent.id,
    email: intent.email,
    amountMinor: PERSONAL_PLAN_ONCE_PRODUCT.amountMinor,
    currency: "eur",
    paidAt: capture.paidAt,
    providerEvidence: {
      paypal_order_id: capture.orderId,
      paypal_capture_id: capture.captureId,
      paypal_order_intent_token_hash: tokenHash(intent.token),
    },
  }
}

async function loadPayPalIntentForPurchase(
  supabase: SupabaseClient,
  purchase: { provider: string; provider_order_id: string | null; provider_transaction_id: string },
  consent: PersonalPlanOneTimeCheckoutConsentRow,
): Promise<PayPalOrderIntentRow> {
  if (
    purchase.provider !== "paypal" ||
    !purchase.provider_order_id ||
    purchase.provider_transaction_id.trim() === ""
  ) {
    throw new PayPalCheckoutActivationError(
      "paypal_order_capture_incomplete",
      "PayPal one-time fulfillment job is missing provider references",
    )
  }
  const intent = await findPayPalOrderIntentByProviderReference(supabase, {
    captureId: purchase.provider_transaction_id,
    orderId: purchase.provider_order_id,
  })
  if (!intent || intent.consent_id !== consent.id || !intent.email) {
    throw new PayPalCheckoutActivationError(
      "paypal_order_intent_missing",
      "PayPal one-time fulfillment job is missing its order intent",
    )
  }
  return intent
}

async function loadPayPalIntentForRecovery(
  supabase: SupabaseClient,
  input: { token?: string | null; orderId?: string | null; captureId?: string | null },
): Promise<PayPalOrderIntentRow> {
  const token = input.token?.trim()
  const intent = token
    ? await findPayPalOrderIntentByToken(supabase, token)
    : await findPayPalOrderIntentByProviderReference(supabase, {
        orderId: input.orderId?.trim() || undefined,
        captureId: input.captureId?.trim() || undefined,
      })
  if (!intent) {
    throw new PayPalCheckoutActivationError(
      "paypal_order_intent_missing",
      "PayPal one-time recovery intent is missing",
    )
  }
  return intent
}

export async function loadActivePayPalOneTimeAccountFromReplay(
  supabase: SupabaseClient,
  input: { userId: string | null; email: string; leadId: string; activationKey: string },
): Promise<ActivePayPalCheckoutAccount> {
  if (!input.userId) {
    throw new PayPalCheckoutActivationError(
      "paypal_user_race_unresolved",
      "PayPal one-time activation is active but has no bound user",
    )
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("id", input.userId)
    .maybeSingle()
  if (error) throw new Error(`profile lookup failed: ${error.message}`)

  const profileEmail =
    typeof (data as { email?: unknown } | null)?.email === "string"
      ? (data as { email: string }).email.trim().toLowerCase()
      : ""
  let canSetInitialPassword = false
  try {
    canSetInitialPassword = await canSetInitialPasswordForPayPalCheckout(
      supabase,
      input.userId,
      input.activationKey,
    )
  } catch {
    // The payment and entitlement are already active. An auth-admin read outage
    // must not turn the welcome replay into a support failure; deny password setup
    // until a later replay can re-check the one-time activation capability.
    canSetInitialPassword = false
  }
  return {
    status: "active",
    userId: input.userId,
    email: profileEmail || input.email.trim().toLowerCase(),
    providerSubscriberEmail: null,
    canSetInitialPassword,
    leadId: input.leadId,
    checkoutContext: null,
  }
}

export async function retrieveProviderPayPalOrder(
  orderId: string,
): Promise<PayPalOrderLookupResponse> {
  const { paypalRequest } = await import("./client")
  return paypalRequest<PayPalOrderLookupResponse>(
    `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
    {
      method: "GET",
    },
  )
}

export async function finalizeLockedPersonalPlanFromPreparedArtifact(
  supabase: SupabaseClient,
  context: Parameters<NonNullable<OneTimeActivationDependencies["finalizeLockedPlan"]>>[0],
) {
  if (!context.purchase.user_id) {
    throw new Error("one-time purchase must be bound before plan finalization")
  }
  // This is intentionally separate from linkQuizToProfile: that generic
  // projection can no-op without withholding a paid customer's artifact.
  const { data, error } = await supabase.rpc("link_personal_plan_artifact_to_user", {
    p_lead_id: context.consent.lead_id,
    p_user_id: context.purchase.user_id,
  })
  if (error) throw new Error(`prepared locked plan binding failed: ${error.message}`)
  const artifact = Array.isArray(data) ? data[0] : data
  const lockedPlan = (artifact as { locked_plan?: unknown } | null)?.locked_plan
  const artifactId = (artifact as { artifact_id?: unknown } | null)?.artifact_id
  if (typeof artifactId !== "string" || !hasMeaningfulLockedPlan(lockedPlan)) {
    throw new Error("attached personal plan artifact is missing locked_plan")
  }
  return {
    lockedPlan,
    deliveryProvider: PERSONAL_PLAN_PREPARED_ARTIFACT_DELIVERY_PROVIDER,
    deliveryReference: artifactId,
  }
}

function hasMeaningfulLockedPlan(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === "string") return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === "object") return Object.keys(value).length > 0
  return true
}

function tokenHash(token: string) {
  return `sha256:${createHash("sha256").update(token).digest("hex")}`
}

export async function tryMarkPayPalOrderIntentCaptured(
  supabase: SupabaseClient,
  token: string,
  orderId: string,
  captureId: string,
): Promise<PayPalOrderIntentRow> {
  try {
    const intent = await markPayPalOrderIntentCaptured(supabase, token, orderId, captureId)
    if (!intent) {
      throw new PayPalCheckoutActivationError(
        "paypal_order_capture_incomplete",
        "PayPal capture no longer matches the current order intent",
      )
    }
    return intent
  } catch (error) {
    if (error instanceof PayPalCheckoutActivationError) throw error
    console.warn("[paypal:one-time] captured payment persisted but intent update failed", {
      reason: sanitizedIntentUpdateFailureReason(error),
    })
    throw payPalCapturePendingError()
  }
}

function sanitizedIntentUpdateFailureReason(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return `supabase:${(error as { code: string }).code}`
  }
  return error instanceof Error ? error.name : "unknown"
}
