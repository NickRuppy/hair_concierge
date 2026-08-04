"use client"

import { useEffect, useRef, useState } from "react"
import {
  FUNDING,
  PayPalButtons,
  PayPalScriptProvider,
  usePayPalScriptReducer,
} from "@paypal/react-paypal-js"
import type { CreateSubscriptionActions, OnApproveData } from "@paypal/paypal-js"

import { usePaymentRuntime } from "@/components/providers/payment-runtime-provider"
import { useOfferTrackingContext } from "@/components/quiz/offer-tracking-provider"
import { addCheckoutBreadcrumb } from "@/lib/observability/checkout"
import type { CheckoutStage } from "@/lib/observability/checkout"
import { capturePaymentFailure, type PaymentErrorFamily } from "@/lib/observability/payment-client"
import type { BillingInterval } from "@/lib/stripe/intervals"
import type { PayPalCheckoutSource } from "@/lib/paypal/checkout-intents"
import { createFunnelEventId } from "@/lib/funnel/client"
import type { CheckoutFailure } from "./payment-method-checkout"
import type { CheckoutContext } from "@/lib/analytics/events"
import { reportPayPalScriptFailureOnce } from "./paypal-script-failure"
import {
  ActiveSubscriptionDialog,
  checkoutAccessAlreadyExistsError,
  isCheckoutAccessAlreadyExistsResponse,
  readCheckoutAccessAlreadyExistsEmail,
} from "./active-subscription-dialog"

const paypalStartError = "PayPal-Zahlung konnte nicht gestartet werden. Bitte versuche es erneut."

function capturePayPalSubscriptionCustomerPaymentError({
  checkoutAttemptId,
  errorFamily,
  interval,
  isInternalTest,
  leadId,
  live,
  providerReferencePresent = false,
  retryable = "true",
  source,
  stage,
  status,
}: {
  checkoutAttemptId?: string
  errorFamily: PaymentErrorFamily
  interval: BillingInterval
  isInternalTest: boolean
  leadId?: string | null
  live: boolean
  providerReferencePresent?: boolean
  retryable?: "true" | "false"
  source: PayPalCheckoutSource
  stage: CheckoutStage
  status?: string | number | null
}) {
  capturePaymentFailure({
    signal: "customer_payment_error_observed",
    provider: "paypal",
    stage,
    errorFamily,
    commerceKind: "subscription",
    origin: "browser",
    method: "paypal",
    truth: "unknown",
    live,
    isInternalTest,
    retryable,
    checkoutAttemptId,
    interval,
    leadId,
    source,
    status,
    providerReferencePresent,
  })
}

class CheckoutAccessAlreadyExistsError extends Error {
  constructor(readonly email?: string | null) {
    super(checkoutAccessAlreadyExistsError)
    this.name = "CheckoutAccessAlreadyExistsError"
  }
}

export function buildPayPalWelcomeUrl(token: string) {
  const params = new URLSearchParams({
    provider: "paypal",
    token,
  })
  return `/welcome?${params.toString()}`
}

function PayPalScriptFailureObserver({
  checkoutAttemptId,
  interval,
  isInternalTest,
  leadId,
  live,
  onCheckoutFailed,
  source,
}: {
  checkoutAttemptId?: string
  interval: BillingInterval
  isInternalTest: boolean
  leadId?: string | null
  live: boolean
  onCheckoutFailed?: (failure: CheckoutFailure) => void
  source: PayPalCheckoutSource
}) {
  const [{ isRejected }] = usePayPalScriptReducer()
  const reportedRef = useRef(false)

  useEffect(() => {
    reportPayPalScriptFailureOnce(reportedRef, isRejected, (failure) => {
      capturePayPalSubscriptionCustomerPaymentError({
        checkoutAttemptId,
        errorFamily: "provider_unavailable",
        interval,
        isInternalTest,
        leadId,
        live,
        source,
        stage: "paypal_create_subscription",
        status: failure.errorCode,
      })
      onCheckoutFailed?.(failure)
    })
  }, [
    checkoutAttemptId,
    interval,
    isInternalTest,
    isRejected,
    leadId,
    live,
    onCheckoutFailed,
    source,
  ])

  return null
}

export function PayPalSubscriptionButton({
  checkoutAttemptId,
  checkoutContext,
  interval,
  leadId,
  onCheckoutCancelled,
  onCheckoutFailed,
  onClientMounted,
  onReady,
  onCheckoutStarted,
  onConfirmStarted,
  onPaymentMethodSelected,
  returnDestination,
  source,
}: {
  checkoutAttemptId?: string
  checkoutContext?: CheckoutContext
  interval: BillingInterval
  leadId?: string | null
  onCheckoutCancelled?: () => void
  onCheckoutFailed?: (failure: CheckoutFailure) => void
  onClientMounted?: () => void
  onReady?: () => void
  onCheckoutStarted: (funnelEventId: string) => void
  onConfirmStarted?: () => void
  onPaymentMethodSelected?: (provider: "stripe" | "paypal") => boolean | void
  returnDestination?: string
  source: PayPalCheckoutSource
}) {
  const [error, setError] = useState<string | null>(null)
  const [duplicateEmail, setDuplicateEmail] = useState<string | null>(null)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const intentTokenRef = useRef<string | null>(null)
  const suppressNextPayPalErrorRef = useRef(false)
  const configurationReportedRef = useRef(false)
  const clientMountedReportedRef = useRef(false)
  const readyReportedRef = useRef(false)
  const confirmStartedReportedRef = useRef(false)
  const { paypalLive } = usePaymentRuntime()
  const offerContext = useOfferTrackingContext()
  const isInternalTest = offerContext?.isInternalTest ?? false
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim()

  useEffect(() => {
    clientMountedReportedRef.current = false
    readyReportedRef.current = false
    confirmStartedReportedRef.current = false
  }, [checkoutAttemptId])

  useEffect(() => {
    if (clientId || configurationReportedRef.current) return
    configurationReportedRef.current = true
    capturePayPalSubscriptionCustomerPaymentError({
      checkoutAttemptId,
      errorFamily: "configuration",
      interval,
      isInternalTest,
      leadId,
      live: paypalLive,
      retryable: "false",
      source,
      stage: "paypal_create_subscription_intent",
      status: "paypal_client_id_missing",
    })
    onCheckoutFailed?.({
      errorCode: "paypal_client_id_missing",
      failureStage: "configuration",
      retryable: false,
    })
  }, [
    checkoutAttemptId,
    clientId,
    interval,
    isInternalTest,
    leadId,
    onCheckoutFailed,
    paypalLive,
    source,
  ])

  if (!clientId) {
    return (
      <div className="rounded-[14px] border border-destructive/30 bg-destructive/10 p-4 text-center">
        <p className="text-sm text-destructive">{paypalStartError}</p>
      </div>
    )
  }

  return (
    <div>
      <ActiveSubscriptionDialog
        email={duplicateEmail}
        onOpenChange={setDuplicateDialogOpen}
        open={duplicateDialogOpen}
      />
      <PayPalScriptProvider
        options={{
          clientId,
          components: "buttons",
          currency: "EUR",
          intent: "subscription",
          vault: true,
        }}
      >
        <PayPalScriptFailureObserver
          checkoutAttemptId={checkoutAttemptId}
          interval={interval}
          isInternalTest={isInternalTest}
          leadId={leadId}
          live={paypalLive}
          onCheckoutFailed={onCheckoutFailed}
          source={source}
        />
        <PayPalButtons
          className="w-full"
          fundingSource={FUNDING.PAYPAL}
          onInit={() => {
            if (!clientMountedReportedRef.current) {
              clientMountedReportedRef.current = true
              onClientMounted?.()
            }
            if (!readyReportedRef.current) {
              readyReportedRef.current = true
              onReady?.()
            }
          }}
          createSubscription={async (
            _data: Record<string, unknown>,
            actions: CreateSubscriptionActions,
          ) => {
            setError(null)
            suppressNextPayPalErrorRef.current = false
            if (onPaymentMethodSelected?.("paypal") === false) {
              suppressNextPayPalErrorRef.current = true
              throw new Error("another payment provider is already active")
            }
            const funnelEventId = createFunnelEventId()
            addCheckoutBreadcrumb({
              provider: "paypal",
              stage: "paypal_create_subscription_intent",
              source,
              interval,
              leadId,
            })
            let intent: Awaited<ReturnType<typeof createSubscriptionIntent>>
            try {
              if (!confirmStartedReportedRef.current) {
                confirmStartedReportedRef.current = true
                onConfirmStarted?.()
              }
              intent = await createSubscriptionIntent({
                checkoutAttemptId,
                checkoutContext,
                interval,
                leadId,
                returnDestination,
                source,
                funnelEventId,
              })
            } catch (err) {
              if (err instanceof CheckoutAccessAlreadyExistsError) {
                suppressNextPayPalErrorRef.current = true
                setDuplicateEmail(err.email ?? null)
                setDuplicateDialogOpen(true)
                onCheckoutFailed?.({
                  errorCode: "access_already_exists",
                  failureStage: "duplicate_access",
                  retryable: false,
                })
                throw err
              }
              setError(err instanceof Error ? err.message : paypalStartError)
              suppressNextPayPalErrorRef.current = true
              capturePayPalSubscriptionCustomerPaymentError({
                checkoutAttemptId,
                errorFamily: "provider_session",
                interval,
                isInternalTest,
                source,
                leadId,
                live: paypalLive,
                stage: "paypal_create_subscription_intent",
                status: "intent_failed",
              })
              onCheckoutFailed?.({
                errorCode: "paypal_intent_failed",
                failureStage: "provider_intent",
                retryable: true,
              })
              throw err
            }
            onCheckoutStarted(funnelEventId)
            intentTokenRef.current = intent.token
            addCheckoutBreadcrumb({
              provider: "paypal",
              stage: "paypal_create_subscription",
              source,
              interval,
              leadId,
            })
            try {
              return await actions.subscription.create({
                plan_id: intent.planId,
                custom_id: intent.token,
                application_context: {
                  shipping_preference: "NO_SHIPPING",
                },
              } as Parameters<CreateSubscriptionActions["subscription"]["create"]>[0])
            } catch (err) {
              setError(paypalStartError)
              suppressNextPayPalErrorRef.current = true
              capturePayPalSubscriptionCustomerPaymentError({
                checkoutAttemptId,
                errorFamily: "provider_session",
                interval,
                isInternalTest,
                source,
                leadId,
                live: paypalLive,
                stage: "paypal_create_subscription",
                status: "subscription_create_failed",
              })
              onCheckoutFailed?.({
                errorCode: "paypal_intent_failed",
                failureStage: "provider_intent",
                retryable: true,
              })
              throw err
            }
          }}
          onApprove={async (data: OnApproveData) => {
            const token = intentTokenRef.current
            if (!data.subscriptionID || !token) {
              setError(paypalStartError)
              capturePayPalSubscriptionCustomerPaymentError({
                checkoutAttemptId,
                errorFamily: "provider_session",
                interval,
                isInternalTest,
                source,
                leadId,
                live: paypalLive,
                stage: "paypal_approve_subscription",
                status: "approval_payload_incomplete",
                providerReferencePresent: Boolean(data.subscriptionID),
              })
              onCheckoutFailed?.({
                errorCode: "paypal_approval_payload_incomplete",
                failureStage: "provider_approval",
                retryable: true,
              })
              return
            }
            addCheckoutBreadcrumb({
              provider: "paypal",
              stage: "paypal_approve_subscription",
              source,
              interval,
              leadId,
              paypalSubscriptionId: data.subscriptionID,
              paypalTokenPresent: true,
            })
            let approved: Awaited<ReturnType<typeof approveSubscriptionIntent>>
            try {
              approved = await approveSubscriptionIntent(token, data.subscriptionID)
            } catch {
              setError(paypalStartError)
              capturePayPalSubscriptionCustomerPaymentError({
                checkoutAttemptId,
                errorFamily: "network",
                interval,
                isInternalTest,
                source,
                leadId,
                live: paypalLive,
                stage: "paypal_approve_subscription",
                status: "approval_request_failed",
                providerReferencePresent: true,
              })
              onCheckoutFailed?.({
                errorCode: "paypal_approval_network_error",
                failureStage: "provider_approval",
                retryable: true,
              })
              return
            }
            if (!approved.ok) {
              if (approved.duplicate) {
                addCheckoutBreadcrumb(
                  {
                    provider: "paypal",
                    stage: "checkout_return",
                    source,
                    interval,
                    leadId,
                    paypalSubscriptionId: data.subscriptionID,
                    paypalTokenPresent: true,
                    status: approved.status,
                    reason: "duplicate_access",
                  },
                  "warning",
                )
                setError(null)
                setDuplicateEmail(approved.email ?? null)
                setDuplicateDialogOpen(true)
                onCheckoutFailed?.({
                  errorCode: "access_already_exists",
                  failureStage: "duplicate_access",
                  retryable: false,
                })
                return
              }
              capturePayPalSubscriptionCustomerPaymentError({
                checkoutAttemptId,
                errorFamily: "provider_session",
                interval,
                isInternalTest,
                source,
                leadId,
                live: paypalLive,
                stage: "paypal_approve_subscription",
                status: approved.status,
                providerReferencePresent: true,
              })
              setError(approved.message)
              onCheckoutFailed?.({
                errorCode: "paypal_approval_failed",
                failureStage: "provider_approval",
                retryable: true,
              })
              return
            }
            addCheckoutBreadcrumb({
              provider: "paypal",
              stage: "checkout_return",
              source,
              interval,
              leadId,
              paypalSubscriptionId: data.subscriptionID,
              paypalTokenPresent: true,
            })
            window.location.assign(buildPayPalWelcomeUrl(token))
          }}
          onCancel={() => {
            onCheckoutCancelled?.()
          }}
          onError={() => {
            if (suppressNextPayPalErrorRef.current) {
              suppressNextPayPalErrorRef.current = false
              return
            }
            setError(paypalStartError)
            capturePayPalSubscriptionCustomerPaymentError({
              checkoutAttemptId,
              errorFamily: "unknown",
              interval,
              isInternalTest,
              source,
              leadId,
              live: paypalLive,
              stage: "paypal_create_subscription",
              status: "paypal_button_error",
            })
            onCheckoutFailed?.({
              errorCode: "paypal_button_error",
              failureStage: "provider_intent",
              retryable: true,
            })
          }}
          style={{
            borderRadius: 999,
            color: "gold",
            height: 52,
            label: "paypal",
            layout: "vertical",
            shape: "pill",
            tagline: false,
          }}
        />
      </PayPalScriptProvider>
      {error ? <p className="mt-3 text-center text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

async function createSubscriptionIntent({
  checkoutAttemptId,
  checkoutContext,
  interval,
  leadId,
  returnDestination,
  source,
  funnelEventId,
}: {
  checkoutAttemptId?: string
  checkoutContext?: CheckoutContext
  interval: BillingInterval
  leadId?: string | null
  returnDestination?: string
  source: PayPalCheckoutSource
  funnelEventId: string
}): Promise<{ token: string; planId: string }> {
  const response = await fetch("/api/paypal/create-subscription-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      checkoutAttemptId,
      checkoutContext,
      interval,
      leadId: leadId ?? null,
      returnDestination,
      source,
      funnelEventId,
    }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (isCheckoutAccessAlreadyExistsResponse(response, body)) {
      throw new CheckoutAccessAlreadyExistsError(readCheckoutAccessAlreadyExistsEmail(body))
    }
    throw new Error(paypalStartError)
  }

  const token = typeof body.token === "string" ? body.token : null
  const planId = typeof body.planId === "string" ? body.planId : null
  if (!token || !planId) throw new Error(paypalStartError)

  return { token, planId }
}

async function approveSubscriptionIntent(
  token: string,
  subscriptionId: string,
): Promise<
  | { ok: true }
  | { ok: false; duplicate: boolean; email?: string | null; message: string; status: number }
> {
  const response = await fetch("/api/paypal/approve-subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, subscription_id: subscriptionId }),
  })
  if (response.ok) return { ok: true }

  const body = await response.json().catch(() => ({}))
  const message = typeof body.message === "string" ? body.message : paypalStartError
  return {
    ok: false,
    duplicate: isCheckoutAccessAlreadyExistsResponse(response, body),
    email: readCheckoutAccessAlreadyExistsEmail(body),
    message,
    status: response.status,
  }
}
