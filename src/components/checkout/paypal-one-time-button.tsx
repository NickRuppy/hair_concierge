"use client"

import { useRef, useState } from "react"
import { FUNDING, PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js"

import { usePaymentRuntime } from "@/components/providers/payment-runtime-provider"
import { useOfferTrackingContext } from "@/components/quiz/offer-tracking-provider"
import { PERSONAL_PLAN_ONE_TIME_CONSENT_COPY_VERSION } from "@/lib/billing/personal-plan-one-time-consent-copy"
import { createFunnelEventId } from "@/lib/funnel/client"
import {
  capturePaymentFailure,
  type PaymentBoundary,
  type PaymentErrorFamily,
} from "@/lib/observability/payment"

function capturePayPalOneTimeCustomerPaymentError({
  boundary,
  checkoutAttemptId,
  errorFamily,
  isInternalTest,
  leadId,
  live,
  providerReferencePresent = false,
  status,
}: {
  boundary: PaymentBoundary
  checkoutAttemptId: string
  errorFamily: PaymentErrorFamily
  isInternalTest: boolean
  leadId: string
  live: boolean
  providerReferencePresent?: boolean
  status: string | number
}) {
  capturePaymentFailure({
    signal: "customer_payment_error_observed",
    provider: "paypal",
    boundary,
    errorFamily,
    commerceKind: "one_time",
    origin: "browser",
    method: "paypal",
    truth: "unknown",
    live,
    isInternalTest,
    retryable: "true",
    checkoutAttemptId,
    leadId,
    source: "quiz_result_offer",
    status,
    providerReferencePresent,
  })
}

export function PayPalOneTimeButton({
  checkoutAttemptId,
  consentAccepted,
  funnelSessionId,
  leadId,
  onCheckoutStarted,
  onDuplicateAccess,
  onPaymentMethodSelected,
  onProviderSelected,
  onProviderConflict,
  onReady,
  onConsentRequired,
}: {
  checkoutAttemptId: string
  consentAccepted: boolean
  funnelSessionId: string
  leadId: string
  onCheckoutStarted?: (funnelEventId: string) => void
  onDuplicateAccess?: () => void
  onPaymentMethodSelected?: () => void
  onProviderSelected?: () => void
  onProviderConflict?: () => void
  onReady?: () => void
  onConsentRequired?: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [busy, setBusy] = useState(false)
  const intentTokenRef = useRef<string | null>(null)
  const suppressNextPayPalErrorRef = useRef(false)
  const { paypalLive } = usePaymentRuntime()
  const offerContext = useOfferTrackingContext()
  const isInternalTest = offerContext?.isInternalTest ?? false
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim()

  if (!clientId) return null

  if (expired) {
    return (
      <div className="grid gap-3 rounded-[14px] border border-border bg-muted/30 p-4 text-center">
        <p className="text-sm text-[var(--brand-plum-darkest)]">
          Die PayPal-Zahlung ist abgelaufen. Schreib uns kurz – wir schalten die Zahlung sicher
          wieder frei.
        </p>
        <a
          className="text-sm font-semibold text-[var(--brand-plum)] underline underline-offset-4"
          href="mailto:info@chaarlie.de?subject=PayPal-Zahlung%20freischalten"
        >
          Support kontaktieren
        </a>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <PayPalScriptProvider
        options={{ clientId, components: "buttons", currency: "EUR", intent: "capture" }}
      >
        <PayPalButtons
          className="w-full"
          fundingSource={FUNDING.PAYPAL}
          createOrder={async () => {
            setError(null)
            suppressNextPayPalErrorRef.current = false
            if (!consentAccepted) {
              onConsentRequired?.()
              suppressNextPayPalErrorRef.current = true
              throw new Error("one-time checkout consent required")
            }
            setBusy(true)
            const funnelEventId = createFunnelEventId()
            onPaymentMethodSelected?.()
            const response = await fetch("/api/paypal/create-order-intent", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                purchaseKind: "personal_plan_once",
                consentAccepted: true,
                consentCopyVersion: PERSONAL_PLAN_ONE_TIME_CONSENT_COPY_VERSION,
                leadId,
                funnelSessionId,
                checkoutAttemptId,
                funnelEventId,
              }),
            })
            const body = (await response.json().catch(() => ({}))) as {
              error?: unknown
              orderId?: unknown
              token?: unknown
            }
            if (response.status === 409 && body.error === "paypal_order_intent_expired") {
              setBusy(false)
              setExpired(true)
              suppressNextPayPalErrorRef.current = true
              throw new Error("paypal order intent expired")
            }
            if (response.status === 409) {
              if (body.error === "checkout_access_already_exists") onDuplicateAccess?.()
              else onProviderConflict?.()
              setBusy(false)
              suppressNextPayPalErrorRef.current = true
              throw new Error("checkout access already exists")
            }
            if (
              !response.ok ||
              typeof body.orderId !== "string" ||
              typeof body.token !== "string"
            ) {
              setBusy(false)
              setError("PayPal-Zahlung konnte nicht gestartet werden. Bitte versuche es erneut.")
              suppressNextPayPalErrorRef.current = true
              capturePayPalOneTimeCustomerPaymentError({
                boundary: "provider_session",
                checkoutAttemptId,
                errorFamily: "provider_session",
                isInternalTest,
                leadId,
                live: paypalLive,
                status: response.ok ? "order_payload_incomplete" : response.status,
              })
              throw new Error("PayPal order creation failed")
            }
            intentTokenRef.current = body.token
            onCheckoutStarted?.(funnelEventId)
            return body.orderId
          }}
          onApprove={async () => {
            const token = intentTokenRef.current
            if (!token) {
              setBusy(false)
              setError(
                "PayPal-Zahlung konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
              )
              capturePayPalOneTimeCustomerPaymentError({
                boundary: "customer_authorization",
                checkoutAttemptId,
                errorFamily: "provider_session",
                isInternalTest,
                leadId,
                live: paypalLive,
                status: "approval_token_missing",
              })
              return
            }
            const response = await fetch("/api/paypal/capture-order", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ token }),
            })
            const body = (await response.json().catch(() => ({}))) as {
              error?: unknown
              status?: unknown
              welcomeUrl?: unknown
            }
            if (response.status === 409 && body.error === "paypal_order_intent_expired") {
              setBusy(false)
              setExpired(true)
              return
            }
            if (response.status === 202 && body.status === "pending") {
              if (typeof body.welcomeUrl === "string") window.location.assign(body.welcomeUrl)
              else {
                setBusy(false)
                setError(
                  "PayPal-Zahlung konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
                )
              }
              return
            }
            if (!response.ok || typeof body.welcomeUrl !== "string") {
              setBusy(false)
              setError(
                "PayPal-Zahlung konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
              )
              capturePayPalOneTimeCustomerPaymentError({
                boundary: "provider_outcome",
                checkoutAttemptId,
                errorFamily: response.ok ? "provider_session" : "unknown",
                isInternalTest,
                leadId,
                live: paypalLive,
                providerReferencePresent: true,
                status: response.ok ? "capture_payload_incomplete" : response.status,
              })
              return
            }
            window.location.assign(body.welcomeUrl)
          }}
          onCancel={() => {
            setBusy(false)
            if (intentTokenRef.current) onProviderSelected?.()
          }}
          onInit={() => onReady?.()}
          onError={(paypalError) => {
            setBusy(false)
            if (suppressNextPayPalErrorRef.current) {
              suppressNextPayPalErrorRef.current = false
              return
            }
            if (
              paypalError instanceof Error &&
              (paypalError.message === "checkout access already exists" ||
                paypalError.message === "one-time checkout consent required")
            )
              return
            capturePayPalOneTimeCustomerPaymentError({
              boundary: "provider_session",
              checkoutAttemptId,
              errorFamily: "unknown",
              isInternalTest,
              leadId,
              live: paypalLive,
              status: "paypal_button_error",
            })
            setError("PayPal-Zahlung konnte nicht gestartet werden. Bitte versuche es erneut.")
          }}
        />
      </PayPalScriptProvider>
      {busy ? (
        <span className="text-center text-xs text-muted-foreground">PayPal wird vorbereitet …</span>
      ) : null}
      {error ? (
        <p className="text-center text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
