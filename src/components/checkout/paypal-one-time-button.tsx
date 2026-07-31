"use client"

import { useRef, useState } from "react"
import { FUNDING, PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js"

import { PERSONAL_PLAN_ONE_TIME_CONSENT_COPY_VERSION } from "@/lib/billing/personal-plan-one-time-consent-copy"
import { createFunnelEventId } from "@/lib/funnel/client"

export function PayPalOneTimeButton({
  checkoutAttemptId,
  consentAccepted,
  funnelSessionId,
  leadId,
  onCheckoutStarted,
  onDuplicateAccess,
  onPaymentMethodSelected,
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
  onProviderConflict?: () => void
  onReady?: () => void
  onConsentRequired?: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const intentTokenRef = useRef<string | null>(null)
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim()

  if (!clientId) return null

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
            if (!consentAccepted) {
              onConsentRequired?.()
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
            if (response.status === 409) {
              if (body.error === "checkout_access_already_exists") onDuplicateAccess?.()
              else onProviderConflict?.()
              setBusy(false)
              throw new Error("checkout access already exists")
            }
            if (
              !response.ok ||
              typeof body.orderId !== "string" ||
              typeof body.token !== "string"
            ) {
              setBusy(false)
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
              return
            }
            const response = await fetch("/api/paypal/capture-order", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ token }),
            })
            const body = (await response.json().catch(() => ({}))) as { welcomeUrl?: unknown }
            if (!response.ok || typeof body.welcomeUrl !== "string") {
              setBusy(false)
              setError(
                "PayPal-Zahlung konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
              )
              return
            }
            window.location.assign(body.welcomeUrl)
          }}
          onCancel={() => setBusy(false)}
          onInit={() => onReady?.()}
          onError={(paypalError) => {
            setBusy(false)
            if (
              paypalError instanceof Error &&
              (paypalError.message === "checkout access already exists" ||
                paypalError.message === "one-time checkout consent required")
            )
              return
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
