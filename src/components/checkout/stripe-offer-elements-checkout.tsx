"use client"

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CheckoutElementsProvider,
  ExpressCheckoutElement,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout"
import type {
  Stripe,
  StripeCheckoutExpressCheckoutElementOptions,
  StripeCheckoutSession,
  StripeExpressCheckoutElementConfirmEvent,
  StripeExpressCheckoutElementReadyEvent,
} from "@stripe/stripe-js"

import { Button } from "@/components/ui/button"

export type StripeOfferPaymentMethodType = "apple_pay" | "payment_element"
export type StripeOfferProvider = "stripe" | "paypal"
type ApplePayAvailability = "pending" | "available" | "unavailable"
type StripeOfferConfirmResult = { type: "success" } | { type: "error"; error: { message: string } }
type StripeOfferExpressElement = {
  on: (event: "cancel", handler: () => void) => unknown
  off: (event: "cancel", handler: () => void) => unknown
}
export type StripeOfferCheckoutResult =
  | { type: "loading" }
  | { type: "error"; error: { message: string } }
  | {
      type: "success"
      checkout: Pick<StripeCheckoutSession, "canConfirm" | "total"> & {
        confirm: (args?: {
          expressCheckoutConfirmEvent?: StripeExpressCheckoutElementConfirmEvent
        }) => Promise<StripeOfferConfirmResult>
        getExpressCheckoutElement: () => StripeOfferExpressElement | null
      }
    }
export type StripeOfferExpressRendererProps = {
  onConfirm: (event: StripeExpressCheckoutElementConfirmEvent) => void
  onReady: (event: StripeExpressCheckoutElementReadyEvent) => void
  options: StripeCheckoutExpressCheckoutElementOptions
}

export const stripeOfferExpressCheckoutOptions: StripeCheckoutExpressCheckoutElementOptions = {
  buttonHeight: 52,
  buttonTheme: {
    applePay: "black",
  },
  buttonType: {
    applePay: "subscribe",
  },
  layout: {
    maxColumns: 1,
    maxRows: 1,
    overflow: "never",
  },
  paymentMethodOrder: ["applePay"],
  paymentMethods: {
    applePay: "auto",
    googlePay: "never",
    link: "never",
    paypal: "never",
    amazonPay: "never",
    klarna: "never",
  },
}

export type StripeOfferElementsState = {
  applePayReady: boolean
  canSubmit: boolean
  confirming: boolean
  errorMessage: string | null
  totalLabel: string
}

export function hasApplePayMethod(
  event: Pick<StripeExpressCheckoutElementReadyEvent, "availablePaymentMethods"> | null | undefined,
) {
  return event?.availablePaymentMethods?.applePay === true
}

export function getApplePayAvailability(
  event: Pick<StripeExpressCheckoutElementReadyEvent, "availablePaymentMethods"> | null | undefined,
): ApplePayAvailability {
  if (!event?.availablePaymentMethods) return "unavailable"
  return event.availablePaymentMethods.applePay ? "available" : "unavailable"
}

export function formatCheckoutTotal(session: Pick<StripeCheckoutSession, "total"> | null) {
  return session?.total.total.amount ?? "Wird berechnet"
}

export function createStripeOfferElementsState({
  applePayAvailable,
  canConfirm,
  confirming,
  errorMessage = null,
  session,
}: {
  applePayAvailable: boolean
  canConfirm: boolean
  confirming: boolean
  errorMessage?: string | null
  session: Pick<StripeCheckoutSession, "total"> | null
}): StripeOfferElementsState {
  return {
    applePayReady: applePayAvailable,
    canSubmit: canConfirm && !confirming,
    confirming,
    errorMessage,
    totalLabel: formatCheckoutTotal(session),
  }
}

export function getStripeOfferElementsErrorMessage(message?: string | null) {
  void message
  return "Die Zahlung konnte nicht bestätigt werden. Bitte prüfe deine Angaben und versuche es erneut."
}

function StripeOfferElementsCheckoutBody({
  lockedProvider,
  onPaymentMethodSelected,
  onProviderLockClaim,
  onProviderLockRelease,
  onRetry,
  secondaryPaymentMethod,
}: {
  lockedProvider?: StripeOfferProvider | null
  onPaymentMethodSelected?: (
    provider: StripeOfferProvider,
    paymentMethodType?: StripeOfferPaymentMethodType,
  ) => void
  onProviderLockClaim?: (provider: StripeOfferProvider) => boolean
  onProviderLockRelease?: (provider: StripeOfferProvider) => boolean
  onRetry: () => void
  secondaryPaymentMethod?: ReactNode
}) {
  const checkoutResult = useCheckoutElements()

  return (
    <StripeOfferElementsCheckoutContent
      checkoutResult={checkoutResult}
      lockedProvider={lockedProvider}
      onPaymentMethodSelected={onPaymentMethodSelected}
      onProviderLockClaim={onProviderLockClaim}
      onProviderLockRelease={onProviderLockRelease}
      onRetry={onRetry}
      secondaryPaymentMethod={secondaryPaymentMethod}
    />
  )
}

export function StripeOfferElementsCheckoutContent({
  checkoutResult,
  lockedProvider,
  onPaymentMethodSelected,
  onProviderLockClaim,
  onProviderLockRelease,
  onRetry,
  paymentElement,
  renderExpressCheckoutElement,
  secondaryPaymentMethod,
}: {
  checkoutResult: StripeOfferCheckoutResult
  lockedProvider?: StripeOfferProvider | null
  onPaymentMethodSelected?: (
    provider: StripeOfferProvider,
    paymentMethodType?: StripeOfferPaymentMethodType,
  ) => void
  onProviderLockClaim?: (provider: StripeOfferProvider) => boolean
  onProviderLockRelease?: (provider: StripeOfferProvider) => boolean
  onRetry: () => void
  paymentElement?: ReactNode
  renderExpressCheckoutElement?: (props: StripeOfferExpressRendererProps) => ReactNode
  secondaryPaymentMethod?: ReactNode
}) {
  const checkout = checkoutResult.type === "success" ? checkoutResult.checkout : null
  const [applePayAvailability, setApplePayAvailability] = useState<ApplePayAvailability>("pending")
  const [confirming, setConfirming] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const confirmingRef = useRef(false)
  const lockOwnerRef = useRef<StripeOfferProvider | null>(null)

  const claimStripe = useCallback(
    (paymentMethodType: StripeOfferPaymentMethodType) => {
      if (lockedProvider && lockedProvider !== "stripe") return false
      if (onProviderLockClaim?.("stripe") === false) return false
      lockOwnerRef.current = "stripe"
      onPaymentMethodSelected?.("stripe", paymentMethodType)
      return true
    },
    [lockedProvider, onPaymentMethodSelected, onProviderLockClaim],
  )

  const releaseStripe = useCallback(() => {
    if (lockOwnerRef.current !== "stripe") return
    lockOwnerRef.current = null
    onProviderLockRelease?.("stripe")
  }, [onProviderLockRelease])

  useEffect(() => {
    if (!checkout) return
    const element = checkout.getExpressCheckoutElement()
    if (!element) return
    const handleCancel = () => {
      confirmingRef.current = false
      setConfirming(false)
      releaseStripe()
    }
    element.on("cancel", handleCancel)
    return () => {
      element.off("cancel", handleCancel)
    }
  }, [checkout, releaseStripe])

  const state = createStripeOfferElementsState({
    applePayAvailable: applePayAvailability === "available",
    canConfirm: checkout?.canConfirm === true,
    confirming,
    errorMessage,
    session: checkout,
  })

  const confirmCheckout = useCallback(
    async (
      paymentMethodType: StripeOfferPaymentMethodType,
      expressCheckoutConfirmEvent?: StripeExpressCheckoutElementConfirmEvent,
    ) => {
      if (!checkout || confirmingRef.current || !checkout.canConfirm) {
        expressCheckoutConfirmEvent?.paymentFailed({
          message: getStripeOfferElementsErrorMessage(),
        })
        return
      }
      if (!claimStripe(paymentMethodType)) {
        expressCheckoutConfirmEvent?.paymentFailed({
          message: getStripeOfferElementsErrorMessage(),
        })
        return
      }

      confirmingRef.current = true
      setConfirming(true)
      setErrorMessage(null)
      let shouldRelease = false

      try {
        const result = await checkout.confirm(
          expressCheckoutConfirmEvent ? { expressCheckoutConfirmEvent } : undefined,
        )

        if (result.type !== "error") return

        shouldRelease = true
        const message = getStripeOfferElementsErrorMessage(result.error.message)
        setErrorMessage(message)
        expressCheckoutConfirmEvent?.paymentFailed({ message })
      } catch {
        shouldRelease = true
        const message = getStripeOfferElementsErrorMessage()
        setErrorMessage(message)
        expressCheckoutConfirmEvent?.paymentFailed({ message })
      } finally {
        if (shouldRelease && confirmingRef.current && lockOwnerRef.current === "stripe") {
          confirmingRef.current = false
          setConfirming(false)
          releaseStripe()
        }
      }
    },
    [checkout, claimStripe, releaseStripe],
  )

  if (checkoutResult.type === "error") {
    return (
      <div className="rounded-[14px] border border-destructive/30 bg-destructive/10 p-5 text-center">
        <p className="mb-3 text-sm text-destructive" role="alert">
          {getStripeOfferElementsErrorMessage(checkoutResult.error.message)}
        </p>
        <Button
          type="button"
          variant="unstyled"
          onClick={onRetry}
          className="min-h-10 rounded-[10px] bg-[var(--brand-coral)] px-4 text-sm font-bold text-white"
        >
          Erneut versuchen
        </Button>
      </div>
    )
  }

  const renderApplePayElement = applePayAvailability !== "unavailable"
  const showPaymentDivider = state.applePayReady || Boolean(secondaryPaymentMethod)

  return (
    <div className="grid gap-3">
      {renderApplePayElement ? (
        <div
          aria-hidden={!state.applePayReady}
          className={`${state.applePayReady ? "" : "h-0 overflow-hidden"} ${
            lockedProvider === "paypal" ? "pointer-events-none opacity-50" : ""
          }`}
          data-offer-payment-step="apple_pay"
        >
          {renderExpressCheckoutElement ? (
            renderExpressCheckoutElement({
              onConfirm: (event) => void confirmCheckout("apple_pay", event),
              onReady: (event) => {
                setApplePayAvailability(getApplePayAvailability(event))
              },
              options: stripeOfferExpressCheckoutOptions,
            })
          ) : (
            <ExpressCheckoutElement
              onConfirm={(event) => void confirmCheckout("apple_pay", event)}
              onReady={(event) => {
                setApplePayAvailability(getApplePayAvailability(event))
              }}
              options={stripeOfferExpressCheckoutOptions}
            />
          )}
        </div>
      ) : null}

      {secondaryPaymentMethod}

      {showPaymentDivider ? (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[11px] font-bold uppercase text-[var(--text-caption)]">
          <span className="h-px bg-border" aria-hidden="true" />
          <span>oder</span>
          <span className="h-px bg-border" aria-hidden="true" />
        </div>
      ) : null}

      <div
        className="grid gap-3 rounded-[16px] border border-border bg-white p-4 shadow-sm"
        data-offer-payment-step="payment_element"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <strong className="text-[14px] text-[var(--brand-plum-darkest)]">Karte & weitere</strong>
          <span className="text-[12px] font-bold text-[var(--brand-plum-darkest)]">
            {state.totalLabel}
          </span>
        </div>
        {paymentElement ?? <PaymentElement />}

        {state.errorMessage ? (
          <p
            className="rounded-[12px] bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {state.errorMessage}
          </p>
        ) : null}

        <Button
          type="button"
          variant="unstyled"
          disabled={!state.canSubmit || lockedProvider === "paypal"}
          onClick={() => void confirmCheckout("payment_element")}
          className="min-h-[52px] rounded-full bg-[var(--brand-plum)] px-5 text-[15px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.confirming
            ? "Zahlung wird bestätigt ..."
            : `Kostenpflichtig abonnieren · ${state.totalLabel}`}
        </Button>
      </div>
    </div>
  )
}

export function StripeOfferElementsCheckout({
  checkoutKey,
  fetchClientSecret,
  lockedProvider = null,
  onPaymentMethodSelected,
  onProviderLockClaim,
  onProviderLockRelease,
  onRetry,
  secondaryPaymentMethod,
  stripe,
}: {
  checkoutKey: string
  fetchClientSecret: () => Promise<string>
  lockedProvider?: StripeOfferProvider | null
  onPaymentMethodSelected?: (
    provider: StripeOfferProvider,
    paymentMethodType?: StripeOfferPaymentMethodType,
  ) => void
  onProviderLockClaim?: (provider: StripeOfferProvider) => boolean
  onProviderLockRelease?: (provider: StripeOfferProvider) => boolean
  onRetry: () => void
  secondaryPaymentMethod?: ReactNode
  stripe: Promise<Stripe | null>
}) {
  const clientSecret = useMemo(() => fetchClientSecret(), [fetchClientSecret])

  return (
    <CheckoutElementsProvider key={checkoutKey} stripe={stripe} options={{ clientSecret }}>
      <StripeOfferElementsCheckoutBody
        lockedProvider={lockedProvider}
        onPaymentMethodSelected={onPaymentMethodSelected}
        onProviderLockClaim={onProviderLockClaim}
        onProviderLockRelease={onProviderLockRelease}
        onRetry={onRetry}
        secondaryPaymentMethod={secondaryPaymentMethod}
      />
    </CheckoutElementsProvider>
  )
}
