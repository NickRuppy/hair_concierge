"use client"

import { useRef, useState } from "react"
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js"
import type { CreateSubscriptionActions, OnApproveData } from "@paypal/paypal-js"

import type { BillingInterval } from "@/lib/stripe/intervals"
import type { PayPalCheckoutSource } from "@/lib/paypal/checkout-intents"

const paypalStartError = "PayPal-Zahlung konnte nicht gestartet werden. Bitte versuche es erneut."
const duplicateAccessError =
  "Für diese E-Mail gibt es bereits ein aktives Abo. Bitte melde dich mit deinem bestehenden Konto an."

export function buildPayPalWelcomeUrl(token: string) {
  const params = new URLSearchParams({
    provider: "paypal",
    token,
  })
  return `/welcome?${params.toString()}`
}

export function PayPalSubscriptionButton({
  interval,
  leadId,
  onCheckoutStarted,
  source,
}: {
  interval: BillingInterval
  leadId?: string | null
  onCheckoutStarted: () => void
  source: PayPalCheckoutSource
}) {
  const [error, setError] = useState<string | null>(null)
  const intentTokenRef = useRef<string | null>(null)
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID

  if (!clientId) {
    return (
      <div className="rounded-[14px] border border-destructive/30 bg-destructive/10 p-4 text-center">
        <p className="text-sm text-destructive">{paypalStartError}</p>
      </div>
    )
  }

  return (
    <div>
      <PayPalScriptProvider
        options={{
          clientId,
          components: "buttons",
          currency: "EUR",
          intent: "subscription",
          vault: true,
        }}
      >
        <PayPalButtons
          className="w-full"
          createSubscription={async (
            _data: Record<string, unknown>,
            actions: CreateSubscriptionActions,
          ) => {
            setError(null)
            onCheckoutStarted()
            try {
              const intent = await createSubscriptionIntent({ interval, leadId, source })
              intentTokenRef.current = intent.token
              return actions.subscription.create({
                plan_id: intent.planId,
                custom_id: intent.token,
                application_context: {
                  shipping_preference: "NO_SHIPPING",
                },
              } as Parameters<CreateSubscriptionActions["subscription"]["create"]>[0])
            } catch (err) {
              setError(err instanceof Error ? err.message : paypalStartError)
              throw err
            }
          }}
          onApprove={async (data: OnApproveData) => {
            const token = intentTokenRef.current
            if (!data.subscriptionID || !token) {
              setError(paypalStartError)
              return
            }
            const approved = await approveSubscriptionIntent(token, data.subscriptionID)
            if (!approved.ok) {
              setError(approved.message)
              if (approved.duplicate) window.location.assign(buildPayPalWelcomeUrl(token))
              return
            }
            window.location.assign(buildPayPalWelcomeUrl(token))
          }}
          onError={() => setError(paypalStartError)}
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
  interval,
  leadId,
  source,
}: {
  interval: BillingInterval
  leadId?: string | null
  source: PayPalCheckoutSource
}): Promise<{ token: string; planId: string }> {
  const response = await fetch("/api/paypal/create-subscription-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interval, leadId: leadId ?? null, source }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 409) throw new Error(duplicateAccessError)
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
): Promise<{ ok: true } | { ok: false; duplicate: boolean; message: string }> {
  const response = await fetch("/api/paypal/approve-subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, subscription_id: subscriptionId }),
  })
  if (response.ok) return { ok: true }

  const body = await response.json().catch(() => ({}))
  const message = typeof body.message === "string" ? body.message : paypalStartError
  return { ok: false, duplicate: response.status === 409, message }
}
