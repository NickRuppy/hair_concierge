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
  StripeExpressCheckoutElementAvailablePaymentMethodsChangeEvent,
  StripeExpressCheckoutElementConfirmEvent,
  StripeExpressCheckoutElementReadyEvent,
  StripePaymentElementAvailablePaymentMethodsChangeEvent,
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
type WalletDebugMethods =
  | Record<string, boolean | { available?: boolean; [key: string]: unknown } | null | undefined>
  | null
  | undefined
type WalletDebugEntry = {
  sequence: number
  elapsedMs: number
  event: string
  methods?: Record<string, boolean> | null
  detail?: string
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
  onAvailablePaymentMethodsChange: (
    event: StripeExpressCheckoutElementAvailablePaymentMethodsChangeEvent,
  ) => void
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
    overflow: "auto",
  },
  paymentMethodOrder: ["applePay"],
  paymentMethods: {
    applePay: "always",
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
  return event?.availablePaymentMethods?.applePay ? "available" : "unavailable"
}

export function getChangedApplePayAvailability(
  event:
    | Pick<StripeExpressCheckoutElementAvailablePaymentMethodsChangeEvent, "paymentMethods">
    | null
    | undefined,
): ApplePayAvailability {
  if (!event?.paymentMethods) return "unavailable"
  return event.paymentMethods.applePay?.available ? "available" : "unavailable"
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

export function isWalletDebugEnabled(search: string) {
  return new URLSearchParams(search).get("wallet_debug") === "1"
}

export function isWalletPaymentEligibilityProbeEnabled(search: string) {
  const params = new URLSearchParams(search)
  return params.get("wallet_debug") === "1" && params.get("wallet_probe") === "payment_eligibility"
}

export function isWalletExpressDomProbeEnabled(search: string) {
  const params = new URLSearchParams(search)
  return params.get("wallet_debug") === "1" && params.get("wallet_probe") === "express_dom"
}

function describeWalletExpressDom(host: HTMLElement | null) {
  if (!host) return "host=missing"

  const hostRect = host.getBoundingClientRect()
  const mountNode = host.firstElementChild
  const mountRect = mountNode?.getBoundingClientRect()
  const iframe = host.querySelector("iframe")
  const iframeRect = iframe?.getBoundingClientRect()
  const style = window.getComputedStyle(host)
  const dimensions = (rect?: DOMRect) =>
    rect ? `${Math.round(rect.width)}x${Math.round(rect.height)}` : "missing"

  return [
    "probe=forced_visible",
    `host=${dimensions(hostRect)}`,
    `probe_display=${style.display}`,
    `probe_visibility=${style.visibility}`,
    `children=${host.childElementCount}`,
    `mount=${dimensions(mountRect)}`,
    `iframes=${host.querySelectorAll("iframe").length}`,
    `iframe=${dimensions(iframeRect)}`,
  ].join(";")
}

export function normalizeWalletDebugMethods(
  methods: WalletDebugMethods,
): Record<string, boolean> | null {
  if (!methods) return null

  return Object.fromEntries(
    Object.entries(methods).map(([method, availability]) => [
      method,
      typeof availability === "boolean" ? availability : availability?.available === true,
    ]),
  )
}

export function reconcilePaymentElementApplePayAvailability(
  current: ApplePayAvailability,
  event: Pick<StripePaymentElementAvailablePaymentMethodsChangeEvent, "paymentMethods">,
): ApplePayAvailability {
  if (current !== "pending" || event.paymentMethods?.applePay?.available !== true) {
    return current
  }

  return "available"
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
  const debugEnabledRef = useRef(
    typeof window !== "undefined" && isWalletDebugEnabled(window.location.search),
  )
  const paymentEligibilityProbeEnabledRef = useRef(
    typeof window !== "undefined" && isWalletPaymentEligibilityProbeEnabled(window.location.search),
  )
  const expressDomProbeEnabledRef = useRef(
    typeof window !== "undefined" && isWalletExpressDomProbeEnabled(window.location.search),
  )
  const debugStartedAtRef = useRef(Date.now())
  const debugSequenceRef = useRef(0)
  const [debugEnabled, setDebugEnabled] = useState(false)
  const [debugEntries, setDebugEntries] = useState<WalletDebugEntry[]>([])
  const [debugCopied, setDebugCopied] = useState(false)
  const confirmingRef = useRef(false)
  const lockOwnerRef = useRef<StripeOfferProvider | null>(null)
  const expressHostRef = useRef<HTMLDivElement>(null)

  const recordWalletDebugEvent = useCallback(
    (event: string, methods?: WalletDebugMethods, detail?: string) => {
      if (!debugEnabledRef.current) return

      const entry: WalletDebugEntry = {
        sequence: ++debugSequenceRef.current,
        elapsedMs: Date.now() - debugStartedAtRef.current,
        event,
        ...(methods === undefined ? {} : { methods: normalizeWalletDebugMethods(methods) }),
        ...(detail ? { detail } : {}),
      }
      setDebugEntries((current) => [...current.slice(-29), entry])
    },
    [],
  )

  useEffect(() => {
    if (!debugEnabledRef.current) return
    setDebugEnabled(true)
    recordWalletDebugEvent("checkout_component_mounted")
  }, [recordWalletDebugEvent])

  useEffect(() => {
    recordWalletDebugEvent("checkout_state", undefined, checkoutResult.type)
  }, [checkoutResult.type, recordWalletDebugEvent])

  const recordExpressDomSnapshot = useCallback(
    (label: string) => {
      if (!expressDomProbeEnabledRef.current) return
      recordWalletDebugEvent(
        "express_dom_snapshot",
        undefined,
        `${label};${describeWalletExpressDom(expressHostRef.current)}`,
      )
    },
    [recordWalletDebugEvent],
  )

  useEffect(() => {
    if (!expressDomProbeEnabledRef.current || !expressHostRef.current) return

    let mutationRecorded = false
    const observer = new MutationObserver(() => {
      if (mutationRecorded) return
      mutationRecorded = true
      observer.disconnect()
      recordExpressDomSnapshot("first_mutation")
    })
    observer.observe(expressHostRef.current, { childList: true, subtree: true })

    const timers = [
      window.setTimeout(() => recordExpressDomSnapshot("component_after_0ms"), 0),
      window.setTimeout(() => recordExpressDomSnapshot("component_after_250ms"), 250),
      window.setTimeout(() => recordExpressDomSnapshot("component_after_1500ms"), 1500),
      window.setTimeout(() => recordExpressDomSnapshot("component_after_3500ms"), 3500),
    ]

    return () => {
      observer.disconnect()
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [recordExpressDomSnapshot])

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
    recordWalletDebugEvent("express_instance", undefined, element ? "present" : "missing")
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
  }, [checkout, recordWalletDebugEvent, releaseStripe])

  const state = createStripeOfferElementsState({
    applePayAvailable: applePayAvailability === "available",
    canConfirm: checkout?.canConfirm === true,
    confirming,
    errorMessage,
    session: checkout,
  })

  const handleExpressCheckoutReady = useCallback(
    (event: StripeExpressCheckoutElementReadyEvent) => {
      recordWalletDebugEvent("express_ready", event.availablePaymentMethods)
      setApplePayAvailability(getApplePayAvailability(event))
    },
    [recordWalletDebugEvent],
  )

  const handleAvailablePaymentMethodsChange = useCallback(
    (event: StripeExpressCheckoutElementAvailablePaymentMethodsChangeEvent) => {
      recordWalletDebugEvent("express_methods_changed", event.paymentMethods)
      setApplePayAvailability(getChangedApplePayAvailability(event))
    },
    [recordWalletDebugEvent],
  )

  const handlePaymentMethodsChange = useCallback(
    (event: StripePaymentElementAvailablePaymentMethodsChangeEvent) => {
      recordWalletDebugEvent("payment_methods_changed", event.paymentMethods)
      const applePayAvailable = event.paymentMethods?.applePay?.available === true
      if (
        applePayAvailable &&
        (paymentEligibilityProbeEnabledRef.current || expressDomProbeEnabledRef.current)
      ) {
        recordWalletDebugEvent(
          "express_probe_from_payment",
          event.paymentMethods,
          "apple_pay_available",
        )
      }
      if (applePayAvailable && expressDomProbeEnabledRef.current) {
        window.setTimeout(() => recordExpressDomSnapshot("payment_apple_pay_available"), 0)
      }
      if (!paymentEligibilityProbeEnabledRef.current) return

      setApplePayAvailability((current) =>
        reconcilePaymentElementApplePayAvailability(current, event),
      )
    },
    [recordExpressDomSnapshot, recordWalletDebugEvent],
  )

  const copyWalletDebugTrace = useCallback(() => {
    const trace = JSON.stringify(debugEntries, null, 2)
    const markCopied = () => {
      setDebugCopied(true)
      window.setTimeout(() => setDebugCopied(false), 1500)
    }
    const copyWithSelectionFallback = () => {
      const textarea = document.createElement("textarea")
      textarea.value = trace
      textarea.style.position = "fixed"
      textarea.style.opacity = "0"
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand("copy")
      textarea.remove()
      if (copied) markCopied()
    }

    if (!navigator.clipboard) {
      copyWithSelectionFallback()
      return
    }

    void navigator.clipboard.writeText(trace).then(markCopied).catch(copyWithSelectionFallback)
  }, [debugEntries])

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

  const showPaymentDivider = state.applePayReady || Boolean(secondaryPaymentMethod)
  const applePayPending = applePayAvailability === "pending"
  const applePayUnavailable = applePayAvailability === "unavailable"
  const expressDomProbeEnabled = expressDomProbeEnabledRef.current

  return (
    <div className="relative grid gap-3">
      {debugEnabled ? (
        <details className="fixed inset-x-2 bottom-[max(8px,env(safe-area-inset-bottom))] z-[100] max-h-[44svh] overflow-auto rounded-xl bg-black/95 p-3 text-left font-mono text-[11px] leading-4 text-white shadow-2xl">
          <summary className="cursor-pointer font-sans text-xs font-bold">
            Wallet-Debug · Express {applePayAvailability} · {debugEntries.length} Events
            {paymentEligibilityProbeEnabledRef.current ? " · Probe aktiv" : ""}
            {expressDomProbeEnabled ? " · DOM-Probe aktiv" : ""}
          </summary>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className="rounded bg-white px-2 py-1 font-sans text-xs font-bold text-black"
              onClick={copyWalletDebugTrace}
            >
              {debugCopied ? "Kopiert" : "Trace kopieren"}
            </button>
            <span className="font-sans text-[10px] text-white/70">Keine Zahlungsdaten</span>
          </div>
          <pre className="mt-2 whitespace-pre-wrap break-all">
            {debugEntries.map((entry) => JSON.stringify(entry)).join("\n")}
          </pre>
        </details>
      ) : null}

      {/* Stripe's documented hidden mount preserves measurable geometry while wallets are
          evaluated. Unavailable Express Checkout stays out of flow without collapsing to 0px. */}
      <div
        ref={expressHostRef}
        aria-hidden={!state.applePayReady && !expressDomProbeEnabled}
        className={`${
          expressDomProbeEnabled
            ? "min-h-[52px]"
            : applePayPending
              ? "invisible min-h-[52px]"
              : applePayUnavailable
                ? "invisible absolute inset-x-0 h-[52px] overflow-hidden"
                : ""
        } ${lockedProvider === "paypal" ? "pointer-events-none opacity-50" : ""}`}
        data-offer-apple-pay-availability={applePayAvailability}
        data-offer-payment-element="apple_pay"
        data-offer-payment-step={state.applePayReady ? "apple_pay" : undefined}
      >
        {renderExpressCheckoutElement ? (
          renderExpressCheckoutElement({
            onAvailablePaymentMethodsChange: handleAvailablePaymentMethodsChange,
            onConfirm: (event) => void confirmCheckout("apple_pay", event),
            onReady: handleExpressCheckoutReady,
            options: stripeOfferExpressCheckoutOptions,
          })
        ) : (
          <ExpressCheckoutElement
            onAvailablePaymentMethodsChange={handleAvailablePaymentMethodsChange}
            onConfirm={(event) => void confirmCheckout("apple_pay", event)}
            onLoadError={(event) =>
              recordWalletDebugEvent(
                "express_load_error",
                undefined,
                event.error.code ?? event.error.type,
              )
            }
            onReady={handleExpressCheckoutReady}
            options={stripeOfferExpressCheckoutOptions}
          />
        )}
      </div>

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
        {paymentElement ?? (
          <PaymentElement
            onAvailablePaymentMethodsChange={handlePaymentMethodsChange}
            onLoadError={(event) =>
              recordWalletDebugEvent(
                "payment_load_error",
                undefined,
                event.error.code ?? event.error.type,
              )
            }
            onLoaderStart={() => recordWalletDebugEvent("payment_loader_started")}
            onReady={() => recordWalletDebugEvent("payment_ready")}
          />
        )}

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
