"use client"

import { useReducer, useState } from "react"
import dynamic from "next/dynamic"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import type { Stripe } from "@stripe/stripe-js"
import { LockKeyhole } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { CheckoutContext, CheckoutFailureStage } from "@/lib/analytics/events"
import type { OfferPaymentOption, OfferPaymentOptionProvider } from "@/lib/analytics/events"
import type { BillingInterval } from "@/lib/stripe/intervals"
import { PaymentOptionExposure } from "./payment-option-exposure"
import {
  StripeOfferElementsCheckout,
  type StripeOfferPaymentMethodType,
  type StripeOfferProvider,
} from "./stripe-offer-elements-checkout"

export type CheckoutFailure = {
  errorCode: string
  failureStage: CheckoutFailureStage
  retryable: boolean
}

const DynamicPayPalSubscriptionButton = dynamic(
  () => import("./paypal-subscription-button").then((module) => module.PayPalSubscriptionButton),
  {
    loading: () => (
      <div className="grid min-h-[52px] place-items-center rounded-full bg-[#ffc439] text-[17px] font-black text-[#003087]">
        PayPal
      </div>
    ),
    ssr: false,
  },
)

export function isPayPalCheckoutEnabled() {
  return process.env.NEXT_PUBLIC_PAYPAL_ENABLED === "true"
}

export type PaymentMethodCheckoutState = {
  cardCheckoutOpen: boolean
}

export function createPaymentMethodCheckoutState(
  paypalEnabled: boolean,
  options: { defaultCardCheckoutOpen?: boolean } = {},
): PaymentMethodCheckoutState {
  return { cardCheckoutOpen: options.defaultCardCheckoutOpen === true || !paypalEnabled }
}

export function paymentMethodCheckoutReducer(
  state: PaymentMethodCheckoutState,
  action: "reveal_card",
): PaymentMethodCheckoutState {
  if (action === "reveal_card" && !state.cardCheckoutOpen) {
    return { cardCheckoutOpen: true }
  }
  return state
}

export function PaymentMethodCheckout({
  cardCheckoutMinHeightClassName = "min-h-[560px]",
  checkoutAttemptId,
  checkoutContext,
  checkoutError = null,
  checkoutKey,
  clientSecret,
  fetchClientSecret,
  holdPaymentChoicesUntilResolved = false,
  interval,
  leadId,
  lockedProvider = null,
  onBeforeStripeConfirm,
  onChangePlan,
  onPayPalCheckoutFailed,
  onPayPalCheckoutStarted,
  onFirstPaymentEngagement,
  onPaymentOptionViewed,
  onPreparedApplePayAvailabilityResolved,
  onPreparedCheckoutActivate,
  onPreparedCheckoutSyncFailed,
  onPreparedCheckoutSyncSucceeded,
  preparedCheckoutId,
  onPaymentMethodSelected,
  onProviderLockClaim,
  onProviderLockRelease,
  onRetry,
  planLabel,
  paymentElementEnabled = true,
  presentation = "default",
  returnDestination,
  source,
  stripe,
  visible = true,
  expressElementsEnabled = false,
  suppressExpressWallet = false,
}: {
  cardCheckoutMinHeightClassName?: "min-h-[560px]" | "min-h-[600px]"
  checkoutAttemptId?: string
  checkoutContext?: CheckoutContext
  checkoutError?: string | null
  checkoutKey: string
  clientSecret?: string | null
  fetchClientSecret: () => Promise<string>
  holdPaymentChoicesUntilResolved?: boolean
  interval: BillingInterval
  leadId?: string | null
  lockedProvider?: "stripe" | "paypal" | null
  onBeforeStripeConfirm?: () => Promise<boolean>
  onChangePlan: () => void
  onPayPalCheckoutFailed?: (failure: CheckoutFailure) => void
  onPayPalCheckoutStarted: (funnelEventId: string) => void
  onFirstPaymentEngagement?: () => void
  onPaymentOptionViewed?: (provider: OfferPaymentOptionProvider, option: OfferPaymentOption) => void
  onPreparedApplePayAvailabilityResolved?: (available: boolean) => void
  onPreparedCheckoutActivate?: Parameters<
    typeof StripeOfferElementsCheckout
  >[0]["onPreparedCheckoutActivate"]
  onPreparedCheckoutSyncFailed?: Parameters<
    typeof StripeOfferElementsCheckout
  >[0]["onPreparedCheckoutSyncFailed"]
  onPreparedCheckoutSyncSucceeded?: Parameters<
    typeof StripeOfferElementsCheckout
  >[0]["onPreparedCheckoutSyncSucceeded"]
  preparedCheckoutId?: string
  onPaymentMethodSelected?: (
    provider: "stripe" | "paypal",
    paymentMethodType?: StripeOfferPaymentMethodType,
  ) => void
  onProviderLockClaim?: (provider: StripeOfferProvider) => boolean
  onProviderLockRelease?: (provider: StripeOfferProvider) => boolean
  onRetry: () => void
  planLabel: string
  paymentElementEnabled?: boolean
  presentation?: "default" | "offer-overlay"
  returnDestination?: string
  source: "pricing_page" | "quiz_result_offer"
  stripe: Promise<Stripe | null>
  visible?: boolean
  expressElementsEnabled?: boolean
  suppressExpressWallet?: boolean
}) {
  const paypalEnabled = isPayPalCheckoutEnabled()
  const isOfferOverlay = presentation === "offer-overlay"
  const useOfferElementsCheckout = isOfferOverlay && expressElementsEnabled
  const [{ cardCheckoutOpen }, dispatchPaymentMethod] = useReducer(
    paymentMethodCheckoutReducer,
    paypalEnabled,
    (enabled) =>
      createPaymentMethodCheckoutState(enabled, {
        defaultCardCheckoutOpen: isOfferOverlay,
      }),
  )
  const [paypalReadyForCheckoutKey, setPayPalReadyForCheckoutKey] = useState<string | null>(null)
  const showPayPalCheckout = paypalEnabled && lockedProvider !== "stripe"
  const showCardCheckout =
    lockedProvider !== "paypal" &&
    (!paypalEnabled || cardCheckoutOpen || lockedProvider === "stripe")
  const providerLockCopy =
    lockedProvider === "paypal"
      ? "Dein PayPal-Checkout läuft bereits. Bitte führe ihn hier fort."
      : lockedProvider === "stripe"
        ? "Dein Karten-Checkout läuft bereits. Bitte führe ihn hier fort."
        : null
  const paypalCheckout = showPayPalCheckout ? (
    <div data-offer-payment-step={useOfferElementsCheckout ? "paypal" : undefined}>
      <PaymentOptionExposure
        checkoutAttemptId={checkoutAttemptId}
        onViewed={onPaymentOptionViewed}
        option="paypal"
        provider="paypal"
        providerReady={paypalReadyForCheckoutKey === checkoutKey}
        visible={visible}
      >
        <DynamicPayPalSubscriptionButton
          key={`paypal:${checkoutKey}`}
          checkoutAttemptId={checkoutAttemptId}
          checkoutContext={checkoutContext}
          interval={interval}
          leadId={leadId}
          onCheckoutFailed={(failure) => {
            setPayPalReadyForCheckoutKey((readyCheckoutKey) =>
              readyCheckoutKey === checkoutKey ? null : readyCheckoutKey,
            )
            onProviderLockRelease?.("paypal")
            onPayPalCheckoutFailed?.(failure)
          }}
          onCheckoutCancelled={() => {
            onProviderLockRelease?.("paypal")
          }}
          onCheckoutStarted={onPayPalCheckoutStarted}
          onPaymentMethodSelected={(provider) => {
            if (onProviderLockClaim?.("paypal") === false) return false
            onFirstPaymentEngagement?.()
            onPaymentMethodSelected?.(provider)
            return true
          }}
          onReady={() => setPayPalReadyForCheckoutKey(checkoutKey)}
          returnDestination={returnDestination}
          source={source}
        />
      </PaymentOptionExposure>
      <p className="mt-3 text-center text-[11px] leading-relaxed text-[var(--text-caption)]">
        PayPal öffnet sich zur Bestätigung. Danach aktivieren wir dein Konto.
      </p>
    </div>
  ) : null

  const checkoutContent = (
    <>
      {!isOfferOverlay ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-bold text-[var(--brand-plum-darkest)]">
              Sicher bezahlen
            </p>
            <p className="text-[12px] text-muted-foreground">{planLabel}</p>
          </div>
          <Button
            type="button"
            variant="unstyled"
            onClick={onChangePlan}
            disabled={lockedProvider !== null}
            data-offer-cta={source === "quiz_result_offer" ? "change_plan" : undefined}
            data-offer-destination={source === "quiz_result_offer" ? "pricing" : undefined}
            data-offer-selected-interval={source === "quiz_result_offer" ? interval : undefined}
            data-offer-source-section={source === "quiz_result_offer" ? "pricing" : undefined}
            className="min-h-10 rounded-[10px] bg-[var(--brand-plum-ice)] px-3 text-[12px] font-bold text-[var(--brand-plum)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Plan ändern
          </Button>
        </div>
      ) : null}

      {providerLockCopy ? (
        <p className="mb-3 rounded-[12px] bg-[var(--brand-plum-ice)] px-3 py-2 text-[12px] font-semibold leading-relaxed text-[var(--brand-plum-darkest)]">
          {providerLockCopy}
        </p>
      ) : null}

      {useOfferElementsCheckout ? (
        <>
          <p className="text-[12px] leading-relaxed text-[var(--text-caption)]">
            Es gilt das gesetzliche 14-tägige Widerrufsrecht.{" "}
            <a
              href="/widerruf"
              className="whitespace-nowrap font-bold text-[var(--brand-plum)] underline"
            >
              Details ansehen
            </a>
          </p>

          {checkoutError ? (
            <div className="rounded-[14px] border border-destructive/30 bg-destructive/10 p-5 text-center">
              <p className="mb-3 text-sm text-destructive">{checkoutError}</p>
              <Button
                type="button"
                variant="unstyled"
                onClick={onRetry}
                className="min-h-10 rounded-[10px] bg-[var(--brand-coral)] px-4 text-sm font-bold text-white"
              >
                Erneut versuchen
              </Button>
            </div>
          ) : (
            <StripeOfferElementsCheckout
              checkoutAttemptId={checkoutAttemptId}
              checkoutKey={checkoutKey}
              clientSecret={clientSecret}
              commerceKind="subscription"
              fetchClientSecret={fetchClientSecret}
              holdPaymentChoicesUntilResolved={holdPaymentChoicesUntilResolved}
              preparedCheckoutId={clientSecret ? preparedCheckoutId : undefined}
              suppressExpressWallet={suppressExpressWallet}
              lockedProvider={lockedProvider}
              onBeforeConfirm={onBeforeStripeConfirm}
              onApplePayAvailabilityResolved={onPreparedApplePayAvailabilityResolved}
              onFirstPaymentEngagement={onFirstPaymentEngagement}
              onPreparedCheckoutActivate={onPreparedCheckoutActivate}
              onPreparedCheckoutSyncFailed={onPreparedCheckoutSyncFailed}
              onPreparedCheckoutSyncSucceeded={onPreparedCheckoutSyncSucceeded}
              onPaymentMethodSelected={onPaymentMethodSelected}
              onPaymentOptionViewed={onPaymentOptionViewed}
              paymentElementEnabled={paymentElementEnabled}
              onProviderLockClaim={onProviderLockClaim}
              onProviderLockRelease={onProviderLockRelease}
              onRetry={onRetry}
              observabilitySource={
                checkoutContext === "membership_reactivation" ? "reactivation" : source
              }
              secondaryPaymentMethod={paypalCheckout}
              stripe={stripe}
              visible={visible}
            />
          )}
        </>
      ) : (
        <>
          {paypalCheckout ? (
            <div className="grid gap-3">
              {paypalCheckout}

              {lockedProvider === null ? (
                <>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[11px] font-bold uppercase text-[var(--text-caption)]">
                    <span className="h-px bg-border" aria-hidden="true" />
                    <span>oder</span>
                    <span className="h-px bg-border" aria-hidden="true" />
                  </div>

                  <div>
                    {isOfferOverlay && cardCheckoutOpen ? (
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <strong className="text-[14px] text-[var(--brand-plum-darkest)]">
                          Karte & weitere
                        </strong>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--brand-plum)]">
                          <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                          Sicher bezahlen
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-controls="card-checkout"
                        aria-describedby={!cardCheckoutOpen ? "payment-method-helper" : undefined}
                        aria-expanded={cardCheckoutOpen}
                        onClick={() => {
                          if (!cardCheckoutOpen) {
                            onFirstPaymentEngagement?.()
                            onPaymentMethodSelected?.("stripe")
                          }
                          dispatchPaymentMethod("reveal_card")
                        }}
                        className={`min-h-[52px] w-full rounded-[12px] border bg-white px-4 text-[16px] font-bold text-[var(--brand-plum-darkest)] transition-colors ${
                          cardCheckoutOpen
                            ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)]"
                            : "border-border hover:border-[var(--brand-plum-light)]"
                        }`}
                      >
                        Karte & weitere
                      </button>
                    )}
                    {!cardCheckoutOpen ? (
                      <p
                        id="payment-method-helper"
                        className="mt-3 text-center text-[11px] leading-relaxed text-[var(--text-caption)]"
                      >
                        Im sicheren Checkout siehst du alle verfügbaren Zahlungsarten.
                      </p>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {showCardCheckout ? (
            <div id="card-checkout" className={paypalEnabled ? "mt-3" : undefined}>
              {checkoutError ? (
                <div className="rounded-[14px] border border-destructive/30 bg-destructive/10 p-5 text-center">
                  <p className="mb-3 text-sm text-destructive">{checkoutError}</p>
                  <Button
                    type="button"
                    variant="unstyled"
                    onClick={onRetry}
                    className="min-h-10 rounded-[10px] bg-[var(--brand-coral)] px-4 text-sm font-bold text-white"
                  >
                    Erneut versuchen
                  </Button>
                </div>
              ) : (
                <div className={cardCheckoutMinHeightClassName}>
                  <EmbeddedCheckoutProvider
                    key={checkoutKey}
                    stripe={stripe}
                    options={{ fetchClientSecret }}
                  >
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </>
  )

  if (isOfferOverlay) {
    return <div className="grid gap-3">{checkoutContent}</div>
  }

  return (
    <div className="mt-5 rounded-[16px] border border-border bg-white p-4 shadow-[0_16px_40px_-28px_rgba(var(--brand-plum-rgb),0.45)]">
      {checkoutContent}
    </div>
  )
}
