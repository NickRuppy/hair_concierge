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
  StripeCheckoutElementsOptions,
  StripeCheckoutExpressCheckoutElementOptions,
  StripeCheckoutSession,
  StripeExpressCheckoutElementConfirmEvent,
  StripeExpressCheckoutElementReadyEvent,
  StripePaymentElementChangeEvent,
} from "@stripe/stripe-js"

import { Button } from "@/components/ui/button"
import { usePaymentRuntime } from "@/components/providers/payment-runtime-provider"
import { useOfferTrackingContext } from "@/components/quiz/offer-tracking-provider"
import type { OfferPaymentOption, OfferPaymentOptionProvider } from "@/lib/analytics/events"
import { addCheckoutBreadcrumb, type CheckoutSource } from "@/lib/observability/checkout"
import {
  capturePaymentFailure,
  type PaymentCommerceKind,
  type PaymentErrorFamily,
} from "@/lib/observability/payment-client"
import { PaymentOptionExposure } from "./payment-option-exposure"
import {
  isAlreadyReportedPreparedCheckoutError,
  isHandledPreparedCheckoutControlError,
} from "@/lib/stripe/prepared-checkout-credential"

export type StripeOfferPaymentMethodType = "apple_pay" | "payment_element"
export type StripeOfferProvider = "stripe" | "paypal"
export type OfferCheckoutProviderLifecycleCallback = (
  provider: OfferPaymentOptionProvider,
  option: OfferPaymentOption,
) => void
export type OfferCheckoutProviderLifecycleFailureCallback = (
  provider: OfferPaymentOptionProvider,
  option: OfferPaymentOption,
  failureReason: "provider_ready_timeout" | "provider_load_error",
) => void
type ApplePayAvailability = "pending" | "available" | "unavailable" | "failed"
export type StripeExpressCheckoutElementAvailablePaymentMethodsChangeEvent = {
  elementType?: "expressCheckout"
  paymentMethods?: Record<string, { available?: boolean } | undefined>
}
export type StripePaymentElementAvailablePaymentMethodsChangeEvent =
  StripeExpressCheckoutElementAvailablePaymentMethodsChangeEvent
const APPLE_PAY_INITIAL_RESPONSE_TIMEOUT_MS = 5_000
const APPLE_PAY_CHECKOUT_LOADING_TIMEOUT_MS = 10_000
const PAYMENT_ELEMENT_READY_TIMEOUT_MS = 10_000
type StripeOfferConfirmResult = { type: "success" } | { type: "error"; error: { message: string } }
export type StripeOfferBeforeConfirmResult = boolean | { allowed: boolean; errorMessage?: string }
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
  onConfirm: (event: StripeExpressCheckoutElementConfirmEvent) => Promise<void>
  onLoadError: (event: { error: { code?: string | null; type: string } }) => void
  onReady: (event: StripeExpressCheckoutElementReadyEvent) => void
  options: StripeCheckoutExpressCheckoutElementOptions
}

export const stripeOfferExpressCheckoutOptions: StripeCheckoutExpressCheckoutElementOptions = {
  buttonHeight: 52,
  buttonTheme: {
    applePay: "black",
  },
  buttonType: {
    applePay: "plain",
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

export function getStripeExpressCheckoutExceptionReason(
  error: unknown,
): "confirm_event_invalid" | "exception" {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error !== null &&
            typeof error === "object" &&
            "message" in error &&
            typeof error.message === "string"
          ? error.message
          : ""
  const normalized = message.toLowerCase()
  return normalized.includes("confirm method must be called within the confirm event") ||
    (normalized.includes("confirm") &&
      normalized.includes("event") &&
      normalized.includes("must be called"))
    ? "confirm_event_invalid"
    : "exception"
}

type StripeCustomerPaymentErrorReason =
  | "checkout_unavailable"
  | "payment_element_not_confirmable"
  | "confirm_error"
  | "confirm_event_invalid"
  | "exception"

const STRIPE_CUSTOMER_PAYMENT_ERROR_FAMILY_BY_REASON: Record<
  StripeCustomerPaymentErrorReason,
  PaymentErrorFamily
> = {
  checkout_unavailable: "provider_session",
  payment_element_not_confirmable: "not_confirmable",
  confirm_error: "unknown",
  confirm_event_invalid: "unknown",
  exception: "unknown",
}

function mapStripeOfferPaymentMethod(method: StripeOfferPaymentMethodType): "apple_pay" | "card" {
  return method === "apple_pay" ? "apple_pay" : "card"
}

function getStripeOfferPaymentOption(method: StripeOfferPaymentMethodType): OfferPaymentOption {
  return method === "apple_pay" ? "apple_pay" : "card_and_more"
}

function captureStripeCustomerPaymentError({
  checkoutAttemptId,
  commerceKind,
  isInternalTest,
  live,
  method,
  reason,
  source,
}: {
  checkoutAttemptId?: string
  commerceKind: PaymentCommerceKind
  isInternalTest: boolean
  live: boolean
  method: StripeOfferPaymentMethodType
  reason: StripeCustomerPaymentErrorReason
  source: CheckoutSource
}) {
  capturePaymentFailure({
    signal: "customer_payment_error_observed",
    provider: "stripe",
    stage: "stripe_express_checkout_confirm",
    errorFamily: STRIPE_CUSTOMER_PAYMENT_ERROR_FAMILY_BY_REASON[reason],
    commerceKind,
    origin: "browser",
    method: mapStripeOfferPaymentMethod(method),
    truth: "unknown",
    live,
    isInternalTest,
    retryable: "true",
    checkoutAttemptId,
    source,
    status: reason,
  })
}

export const stripeOfferCheckoutAppearance: NonNullable<
  StripeCheckoutElementsOptions["appearance"]
> = {
  variables: {
    borderRadius: "26px",
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
  checkoutAttemptId,
  checkoutKey,
  commerceKind,
  preparationFailureReported,
  onBeforeConfirm,
  onFirstPaymentEngagement,
  onClientMounted,
  onConfirmStarted,
  onConfirmFailed,
  paymentElementEnabled,
  paymentButtonLabel,
  visible,
  lockedProvider,
  onPaymentMethodSelected,
  onPaymentOptionViewed,
  onProviderReady,
  onProviderCancelled,
  onProviderLoadError,
  onProviderLoadStarted,
  onProviderLoadTimeout,
  onProviderLockClaim,
  onProviderLockRelease,
  onRetry,
  secondaryPaymentMethod,
  observabilitySource,
}: {
  checkoutAttemptId?: string
  checkoutKey: string
  commerceKind?: PaymentCommerceKind
  preparationFailureReported?: boolean
  lockedProvider?: StripeOfferProvider | null
  onBeforeConfirm?: () => Promise<StripeOfferBeforeConfirmResult>
  onFirstPaymentEngagement?: () => void
  onClientMounted?: OfferCheckoutProviderLifecycleCallback
  onConfirmStarted?: OfferCheckoutProviderLifecycleCallback
  onConfirmFailed?: OfferCheckoutProviderLifecycleCallback
  onPaymentMethodSelected?: (
    provider: StripeOfferProvider,
    paymentMethodType?: StripeOfferPaymentMethodType,
  ) => void
  onPaymentOptionViewed?: (provider: OfferPaymentOptionProvider, option: OfferPaymentOption) => void
  onProviderReady?: OfferCheckoutProviderLifecycleCallback
  onProviderCancelled?: OfferCheckoutProviderLifecycleCallback
  onProviderLoadError?: OfferCheckoutProviderLifecycleFailureCallback
  onProviderLoadStarted?: OfferCheckoutProviderLifecycleCallback
  onProviderLoadTimeout?: OfferCheckoutProviderLifecycleFailureCallback
  paymentElementEnabled?: boolean
  paymentButtonLabel?: string
  onProviderLockClaim?: (provider: StripeOfferProvider) => boolean
  onProviderLockRelease?: (provider: StripeOfferProvider) => boolean
  onRetry: () => void
  secondaryPaymentMethod?: ReactNode
  observabilitySource?: CheckoutSource
  visible?: boolean
}) {
  const checkoutResult = useCheckoutElements()

  return (
    <StripeOfferElementsCheckoutContent
      checkoutAttemptId={checkoutAttemptId}
      checkoutKey={checkoutKey}
      commerceKind={commerceKind}
      checkoutResult={checkoutResult}
      preparationFailureReported={preparationFailureReported}
      lockedProvider={lockedProvider}
      onBeforeConfirm={onBeforeConfirm}
      onFirstPaymentEngagement={onFirstPaymentEngagement}
      onClientMounted={onClientMounted}
      onConfirmStarted={onConfirmStarted}
      onConfirmFailed={onConfirmFailed}
      onPaymentMethodSelected={onPaymentMethodSelected}
      onPaymentOptionViewed={onPaymentOptionViewed}
      onProviderReady={onProviderReady}
      onProviderCancelled={onProviderCancelled}
      onProviderLoadError={onProviderLoadError}
      onProviderLoadStarted={onProviderLoadStarted}
      onProviderLoadTimeout={onProviderLoadTimeout}
      paymentElementEnabled={paymentElementEnabled}
      paymentButtonLabel={paymentButtonLabel}
      onProviderLockClaim={onProviderLockClaim}
      onProviderLockRelease={onProviderLockRelease}
      onRetry={onRetry}
      secondaryPaymentMethod={secondaryPaymentMethod}
      observabilitySource={observabilitySource}
      visible={visible}
    />
  )
}

export function StripeOfferElementsCheckoutContent({
  checkoutAttemptId,
  checkoutKey = "unscoped_checkout",
  commerceKind = "unknown",
  checkoutResult,
  preparationFailureReported = false,
  initialApplePayAvailability = "pending",
  lockedProvider,
  onBeforeConfirm,
  onFirstPaymentEngagement,
  onClientMounted,
  onConfirmStarted,
  onConfirmFailed,
  onPaymentMethodSelected,
  onPaymentOptionViewed,
  onProviderReady,
  onProviderCancelled,
  onProviderLoadError,
  onProviderLoadStarted,
  onProviderLoadTimeout,
  paymentElementEnabled = true,
  paymentButtonLabel,
  onProviderLockClaim,
  onProviderLockRelease,
  onRetry,
  paymentElement,
  paymentElementReady: paymentElementReadyOverride,
  renderExpressCheckoutElement,
  secondaryPaymentMethod,
  observabilitySource = "quiz_result_offer",
  visible = true,
}: {
  checkoutAttemptId?: string
  checkoutKey?: string
  commerceKind?: PaymentCommerceKind
  checkoutResult: StripeOfferCheckoutResult
  preparationFailureReported?: boolean
  initialApplePayAvailability?: ApplePayAvailability
  lockedProvider?: StripeOfferProvider | null
  onBeforeConfirm?: () => Promise<StripeOfferBeforeConfirmResult>
  onFirstPaymentEngagement?: () => void
  onClientMounted?: OfferCheckoutProviderLifecycleCallback
  onConfirmStarted?: OfferCheckoutProviderLifecycleCallback
  onConfirmFailed?: OfferCheckoutProviderLifecycleCallback
  onPaymentMethodSelected?: (
    provider: StripeOfferProvider,
    paymentMethodType?: StripeOfferPaymentMethodType,
  ) => void
  onPaymentOptionViewed?: (provider: OfferPaymentOptionProvider, option: OfferPaymentOption) => void
  onProviderReady?: OfferCheckoutProviderLifecycleCallback
  onProviderCancelled?: OfferCheckoutProviderLifecycleCallback
  onProviderLoadError?: OfferCheckoutProviderLifecycleFailureCallback
  onProviderLoadStarted?: OfferCheckoutProviderLifecycleCallback
  onProviderLoadTimeout?: OfferCheckoutProviderLifecycleFailureCallback
  paymentElementEnabled?: boolean
  paymentButtonLabel?: string
  onProviderLockClaim?: (provider: StripeOfferProvider) => boolean
  onProviderLockRelease?: (provider: StripeOfferProvider) => boolean
  onRetry: () => void
  paymentElement?: ReactNode
  /** Test-only readiness seam for an injected payment element. */
  paymentElementReady?: boolean
  renderExpressCheckoutElement?: (props: StripeOfferExpressRendererProps) => ReactNode
  secondaryPaymentMethod?: ReactNode
  observabilitySource?: CheckoutSource
  visible?: boolean
}) {
  const checkout = checkoutResult.type === "success" ? checkoutResult.checkout : null
  const { stripeLive } = usePaymentRuntime()
  const offerContext = useOfferTrackingContext()
  const isInternalTest = offerContext?.isInternalTest ?? false
  const [applePayAvailability, setApplePayAvailability] = useState<ApplePayAvailability>(
    initialApplePayAvailability,
  )
  const [confirming, setConfirming] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [paymentElementReadyFromProvider, setPaymentElementReady] = useState(false)
  const paymentElementReady = paymentElementReadyOverride ?? paymentElementReadyFromProvider
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
  const firstPaymentEngagementRef = useRef(false)
  const lockOwnerRef = useRef<StripeOfferProvider | null>(null)
  const expressHostRef = useRef<HTMLDivElement>(null)
  const applePayInitialResponseTimerRef = useRef<number | null>(null)
  const paymentElementReadyTimerRef = useRef<number | null>(null)
  const visibleRef = useRef(visible)
  visibleRef.current = visible
  const applePayLoadingDeadlineRef = useRef(Date.now() + APPLE_PAY_CHECKOUT_LOADING_TIMEOUT_MS)
  const applePayInitialResponseReceivedRef = useRef(false)
  const applePayAvailabilityClosedRef = useRef(false)
  const reportedCheckoutLoadErrorRef = useRef(false)
  const reportedPaymentElementLoadErrorAttemptRef = useRef<string | null>(null)
  const mountedProviderOptionsRef = useRef(new Set<OfferPaymentOption>())
  const readyProviderOptionsRef = useRef(new Set<OfferPaymentOption>())
  const confirmStartedProviderOptionsRef = useRef(new Set<OfferPaymentOption>())
  const providerLoadStartedOptionsRef = useRef(new Set<OfferPaymentOption>())
  const providerLoadTimeoutOptionsRef = useRef(new Set<OfferPaymentOption>())

  useEffect(() => {
    mountedProviderOptionsRef.current.clear()
    readyProviderOptionsRef.current.clear()
    confirmStartedProviderOptionsRef.current.clear()
    providerLoadStartedOptionsRef.current.clear()
    providerLoadTimeoutOptionsRef.current.clear()
  }, [checkoutAttemptId, checkoutKey])

  const reportClientMounted = useCallback(
    (option: OfferPaymentOption) => {
      if (!visibleRef.current) return
      if (mountedProviderOptionsRef.current.has(option)) return
      mountedProviderOptionsRef.current.add(option)
      onClientMounted?.("stripe", option)
    },
    [onClientMounted],
  )

  const reportProviderReady = useCallback(
    (option: OfferPaymentOption) => {
      if (!visibleRef.current) return
      if (readyProviderOptionsRef.current.has(option)) return
      readyProviderOptionsRef.current.add(option)
      onProviderReady?.("stripe", option)
    },
    [onProviderReady],
  )

  const reportConfirmStarted = useCallback(
    (option: OfferPaymentOption) => {
      if (confirmStartedProviderOptionsRef.current.has(option)) return
      confirmStartedProviderOptionsRef.current.add(option)
      onConfirmStarted?.("stripe", option)
    },
    [onConfirmStarted],
  )

  const reportProviderLoadStarted = useCallback(
    (option: OfferPaymentOption) => {
      if (!visibleRef.current) return
      if (providerLoadStartedOptionsRef.current.has(option)) return
      providerLoadStartedOptionsRef.current.add(option)
      onProviderLoadStarted?.("stripe", option)
    },
    [onProviderLoadStarted],
  )

  const reportProviderLoadTimeout = useCallback(
    (option: OfferPaymentOption) => {
      if (!visibleRef.current) return
      if (providerLoadTimeoutOptionsRef.current.has(option)) return
      providerLoadTimeoutOptionsRef.current.add(option)
      onProviderLoadTimeout?.("stripe", option, "provider_ready_timeout")
      capturePaymentFailure({
        signal: "checkout_experience_degraded",
        provider: "stripe",
        boundary: "provider_session",
        errorFamily: "timeout",
        commerceKind,
        origin: "browser",
        method: option === "apple_pay" ? "apple_pay" : "card",
        truth: "unknown",
        live: stripeLive,
        isInternalTest,
        retryable: "true",
        checkoutAttemptId,
        source: observabilitySource,
        status: "provider_ready_timeout",
      })
    },
    [
      checkoutAttemptId,
      commerceKind,
      isInternalTest,
      observabilitySource,
      onProviderLoadTimeout,
      stripeLive,
    ],
  )

  const clearApplePayInitialResponseTimer = useCallback(() => {
    if (applePayInitialResponseTimerRef.current === null) return
    window.clearTimeout(applePayInitialResponseTimerRef.current)
    applePayInitialResponseTimerRef.current = null
  }, [])

  const clearPaymentElementReadyTimer = useCallback(() => {
    if (paymentElementReadyTimerRef.current === null) return
    window.clearTimeout(paymentElementReadyTimerRef.current)
    paymentElementReadyTimerRef.current = null
  }, [])

  useEffect(() => clearPaymentElementReadyTimer, [checkoutAttemptId, clearPaymentElementReadyTimer])

  useEffect(() => {
    if (!visible) clearPaymentElementReadyTimer()
  }, [clearPaymentElementReadyTimer, visible])

  const resolveApplePayAvailability = useCallback(
    (availability: ApplePayAvailability) => {
      clearApplePayInitialResponseTimer()
      applePayInitialResponseReceivedRef.current = true
      if (applePayAvailabilityClosedRef.current) return
      setApplePayAvailability(availability)
    },
    [clearApplePayInitialResponseTimer],
  )

  const closeApplePayAvailability = useCallback(
    (availability: Extract<ApplePayAvailability, "failed" | "unavailable">) => {
      clearApplePayInitialResponseTimer()
      applePayInitialResponseReceivedRef.current = true
      applePayAvailabilityClosedRef.current = true
      setApplePayAvailability(availability)
    },
    [clearApplePayInitialResponseTimer],
  )

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
    if (
      checkoutResult.type !== "error" ||
      !visible ||
      preparationFailureReported ||
      isHandledPreparedCheckoutControlError(checkoutResult.error) ||
      isAlreadyReportedPreparedCheckoutError(checkoutResult.error)
    ) {
      reportedCheckoutLoadErrorRef.current = false
      return
    }
    if (reportedCheckoutLoadErrorRef.current) return
    reportedCheckoutLoadErrorRef.current = true
    capturePaymentFailure({
      signal: "customer_payment_error_observed",
      provider: "stripe",
      stage: "stripe_embedded_checkout_load",
      errorFamily: "provider_session",
      commerceKind,
      origin: "browser",
      method: "unknown",
      truth: "unknown",
      live: stripeLive,
      isInternalTest,
      retryable: "true",
      checkoutAttemptId,
      source: observabilitySource,
      status: "checkout_load_error",
    })
  }, [
    checkoutAttemptId,
    checkoutResult,
    checkoutResult.type,
    commerceKind,
    isInternalTest,
    observabilitySource,
    preparationFailureReported,
    stripeLive,
    visible,
  ])

  useEffect(() => {
    if (
      !visible ||
      applePayInitialResponseReceivedRef.current ||
      applePayAvailabilityClosedRef.current
    ) {
      return
    }
    reportProviderLoadStarted("apple_pay")
    applePayLoadingDeadlineRef.current = Date.now() + APPLE_PAY_CHECKOUT_LOADING_TIMEOUT_MS
  }, [reportProviderLoadStarted, visible])

  useEffect(() => {
    if (
      !visible ||
      checkoutResult.type === "error" ||
      applePayInitialResponseReceivedRef.current ||
      applePayAvailabilityClosedRef.current
    ) {
      return
    }

    const remainingCheckoutLoadingMs = Math.max(0, applePayLoadingDeadlineRef.current - Date.now())
    const responseTimeoutMs =
      checkoutResult.type === "success"
        ? Math.min(APPLE_PAY_INITIAL_RESPONSE_TIMEOUT_MS, remainingCheckoutLoadingMs)
        : remainingCheckoutLoadingMs

    applePayInitialResponseTimerRef.current = window.setTimeout(() => {
      recordWalletDebugEvent("express_response_timeout")
      reportProviderLoadTimeout("apple_pay")
      closeApplePayAvailability("failed")
    }, responseTimeoutMs)

    return () => {
      clearApplePayInitialResponseTimer()
    }
  }, [
    checkoutResult.type,
    clearApplePayInitialResponseTimer,
    closeApplePayAvailability,
    recordWalletDebugEvent,
    reportProviderLoadTimeout,
    visible,
  ])

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

  const markFirstPaymentEngagement = useCallback(() => {
    if (firstPaymentEngagementRef.current || !onFirstPaymentEngagement) return
    firstPaymentEngagementRef.current = true
    onFirstPaymentEngagement()
  }, [onFirstPaymentEngagement])

  useEffect(() => {
    firstPaymentEngagementRef.current = false
  }, [checkoutAttemptId])

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
      onProviderCancelled?.("stripe", "apple_pay")
    }
    element.on("cancel", handleCancel)
    return () => {
      element.off("cancel", handleCancel)
    }
  }, [checkout, onProviderCancelled, recordWalletDebugEvent, releaseStripe])

  const state = createStripeOfferElementsState({
    applePayAvailable: applePayAvailability === "available",
    canConfirm: checkout?.canConfirm === true,
    confirming,
    errorMessage,
    session: checkout,
  })
  const handleExpressCheckoutReady = useCallback(
    (event: StripeExpressCheckoutElementReadyEvent) => {
      // Checkout Elements does not expose Express Checkout's loader-start event.
      // Its ready callback is therefore the earliest truthful mounted surface signal.
      reportClientMounted("apple_pay")
      reportProviderReady("apple_pay")
      recordWalletDebugEvent("express_ready", event.availablePaymentMethods)
      resolveApplePayAvailability(getApplePayAvailability(event))
    },
    [recordWalletDebugEvent, reportClientMounted, reportProviderReady, resolveApplePayAvailability],
  )

  // The Checkout Elements SDK reports wallet availability from `onReady`. Keep this
  // compatibility callback solely for the interactive checkout lab's injected renderer.
  const handleAvailablePaymentMethodsChange = useCallback(
    (event: StripeExpressCheckoutElementAvailablePaymentMethodsChangeEvent) => {
      recordWalletDebugEvent("express_methods_changed", event.paymentMethods)
      const availability = getChangedApplePayAvailability(event)
      resolveApplePayAvailability(availability)
    },
    [recordWalletDebugEvent, resolveApplePayAvailability],
  )

  const handleExpressCheckoutLoadError = useCallback(
    (event: { error: { code?: string | null; type: string } }) => {
      if (!visibleRef.current) return
      recordWalletDebugEvent("express_load_error", undefined, event.error.code ?? event.error.type)
      onProviderLoadError?.("stripe", "apple_pay", "provider_load_error")
      closeApplePayAvailability("failed")
    },
    [closeApplePayAvailability, onProviderLoadError, recordWalletDebugEvent],
  )

  const handlePaymentElementLoadError = useCallback(
    (event: { error: { code?: string | null; type: string } }) => {
      if (!visibleRef.current) return
      clearPaymentElementReadyTimer()
      setPaymentElementReady(false)
      recordWalletDebugEvent("payment_load_error", undefined, event.error.code ?? event.error.type)
      onProviderLoadError?.("stripe", "card_and_more", "provider_load_error")
      const attemptKey = checkoutAttemptId ?? "unscoped_checkout"
      if (!visible || preparationFailureReported) return
      if (reportedPaymentElementLoadErrorAttemptRef.current === attemptKey) return
      reportedPaymentElementLoadErrorAttemptRef.current = attemptKey
      capturePaymentFailure({
        signal: "customer_payment_error_observed",
        provider: "stripe",
        stage: "stripe_embedded_checkout_load",
        errorFamily: "provider_session",
        commerceKind,
        origin: "browser",
        method: "card",
        truth: "unknown",
        live: stripeLive,
        isInternalTest,
        retryable: "true",
        checkoutAttemptId,
        source: observabilitySource,
        status: "payment_element_load_error",
      })
    },
    [
      checkoutAttemptId,
      clearPaymentElementReadyTimer,
      commerceKind,
      isInternalTest,
      observabilitySource,
      onProviderLoadError,
      preparationFailureReported,
      recordWalletDebugEvent,
      stripeLive,
      visible,
    ],
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
      const recordExpressConfirm = (
        status: "entered" | "succeeded" | "failed",
        reason?: string,
      ) => {
        if (!expressCheckoutConfirmEvent) return
        addCheckoutBreadcrumb(
          {
            provider: "stripe",
            stage: "stripe_express_checkout_confirm",
            source: "quiz_result_offer",
            checkoutAttemptId,
            reason,
            status,
          },
          status === "failed" ? "warning" : "info",
        )
      }

      recordExpressConfirm("entered")
      if (expressCheckoutConfirmEvent) {
        recordWalletDebugEvent("express_confirm_entered")
      }
      const rejectConfirmation = (reason: string) => {
        recordExpressConfirm("failed", reason)
        if (expressCheckoutConfirmEvent) {
          recordWalletDebugEvent("express_confirm_rejected", undefined, reason)
        }
        expressCheckoutConfirmEvent?.paymentFailed({
          message: getStripeOfferElementsErrorMessage(),
        })
      }
      const reportAndRejectConfirmation = (reason: StripeCustomerPaymentErrorReason) => {
        captureStripeCustomerPaymentError({
          checkoutAttemptId,
          commerceKind,
          isInternalTest,
          live: stripeLive,
          method: paymentMethodType,
          reason,
          source: observabilitySource,
        })
        onConfirmFailed?.("stripe", getStripeOfferPaymentOption(paymentMethodType))
        rejectConfirmation(reason)
      }
      if (!checkout) {
        reportAndRejectConfirmation("checkout_unavailable")
        return
      }
      const confirmationGuardFailureReason = confirmingRef.current
        ? "confirmation_in_flight"
        : !expressCheckoutConfirmEvent && !checkout.canConfirm
          ? "payment_element_not_confirmable"
          : null
      if (confirmationGuardFailureReason) {
        if (confirmationGuardFailureReason === "confirmation_in_flight") {
          rejectConfirmation(confirmationGuardFailureReason)
        } else {
          reportAndRejectConfirmation(confirmationGuardFailureReason)
        }
        return
      }
      markFirstPaymentEngagement()
      if (!claimStripe(paymentMethodType)) {
        rejectConfirmation("provider_locked")
        return
      }

      confirmingRef.current = true
      setConfirming(true)
      setErrorMessage(null)
      let shouldRelease = false

      try {
        const beforeConfirmResult = await (onBeforeConfirm?.() ?? Promise.resolve(true))
        const beforeConfirmAccepted =
          typeof beforeConfirmResult === "boolean"
            ? beforeConfirmResult
            : beforeConfirmResult.allowed
        if (!beforeConfirmAccepted) {
          recordExpressConfirm("failed", "before_confirm_rejected")
          shouldRelease = true
          const message =
            typeof beforeConfirmResult === "object" && beforeConfirmResult.errorMessage
              ? beforeConfirmResult.errorMessage
              : getStripeOfferElementsErrorMessage()
          setErrorMessage(message)
          expressCheckoutConfirmEvent?.paymentFailed({ message })
          return
        }

        reportConfirmStarted(getStripeOfferPaymentOption(paymentMethodType))
        const result = await checkout.confirm(
          expressCheckoutConfirmEvent ? { expressCheckoutConfirmEvent } : undefined,
        )

        if (result.type !== "error") {
          recordExpressConfirm("succeeded")
          recordWalletDebugEvent("checkout_confirm_succeeded")
          return
        }

        shouldRelease = true
        recordExpressConfirm("failed", "confirm_error")
        recordWalletDebugEvent("checkout_confirm_failed", undefined, "confirm_error")
        captureStripeCustomerPaymentError({
          checkoutAttemptId,
          commerceKind,
          isInternalTest,
          live: stripeLive,
          method: paymentMethodType,
          reason: "confirm_error",
          source: observabilitySource,
        })
        onConfirmFailed?.("stripe", getStripeOfferPaymentOption(paymentMethodType))
        const message = getStripeOfferElementsErrorMessage(result.error.message)
        setErrorMessage(message)
        expressCheckoutConfirmEvent?.paymentFailed({ message })
      } catch (error) {
        shouldRelease = true
        const reason = getStripeExpressCheckoutExceptionReason(error)
        recordExpressConfirm("failed", reason)
        recordWalletDebugEvent("checkout_confirm_failed", undefined, reason)
        captureStripeCustomerPaymentError({
          checkoutAttemptId,
          commerceKind,
          isInternalTest,
          live: stripeLive,
          method: paymentMethodType,
          reason,
          source: observabilitySource,
        })
        onConfirmFailed?.("stripe", getStripeOfferPaymentOption(paymentMethodType))
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
    [
      checkout,
      checkoutAttemptId,
      claimStripe,
      commerceKind,
      isInternalTest,
      markFirstPaymentEngagement,
      onBeforeConfirm,
      onConfirmFailed,
      observabilitySource,
      recordWalletDebugEvent,
      reportConfirmStarted,
      releaseStripe,
      stripeLive,
    ],
  )

  if (checkoutResult.type === "error") {
    return (
      <div className="grid gap-3">
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
        {visible && secondaryPaymentMethod ? secondaryPaymentMethod : null}
      </div>
    )
  }

  const applePayPending = applePayAvailability === "pending"
  const applePayFailed = applePayAvailability === "failed"
  const applePayUnavailable = applePayAvailability === "unavailable"
  const expressDomProbeEnabled = expressDomProbeEnabledRef.current
  const showSecondaryPaymentMethod = visible === true && Boolean(secondaryPaymentMethod)
  const showPaymentElement = paymentElementEnabled
  const showResolvedPaymentDivider =
    showPaymentElement && (state.applePayReady || showSecondaryPaymentMethod)
  const applePayProviderReady = state.applePayReady

  return (
    <div className="relative grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
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
      {applePayPending && !expressDomProbeEnabled ? (
        <div
          aria-label="Apple Pay wird geladen"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-black/[0.06] bg-black/[0.055] text-[13px] font-semibold text-[var(--text-caption)]"
          role="status"
        >
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-black/15 border-t-black/50 motion-reduce:animate-none"
          />
          <span>Apple Pay wird geladen …</span>
        </div>
      ) : null}
      {applePayFailed && !expressDomProbeEnabled ? (
        checkoutResult.type === "loading" ? (
          lockedProvider === "paypal" ? (
            <div
              aria-label="Zahlungsoptionen konnten nicht geladen werden"
              className="pointer-events-none absolute inset-x-0 top-0 z-10 flex min-h-[52px] items-center justify-center rounded-full border border-black/[0.06] bg-black/[0.035] px-4 text-center text-[13px] font-semibold text-[var(--text-caption)]"
              role="status"
            >
              Zahlungsoptionen konnten nicht geladen werden.
            </div>
          ) : (
            <button
              type="button"
              aria-label="Zahlungsoptionen konnten nicht geladen werden. Erneut versuchen"
              className="absolute inset-x-0 top-0 z-10 flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-black/[0.06] bg-black/[0.035] px-4 text-center text-[13px] font-semibold text-[var(--text-caption)]"
              onClick={onRetry}
            >
              <span>Zahlungsoptionen konnten nicht geladen werden.</span>
              <span className="font-bold underline">Erneut versuchen</span>
            </button>
          )
        ) : (
          <div
            aria-label="Apple Pay ist derzeit nicht verfügbar"
            className="pointer-events-none absolute inset-x-0 top-0 z-10 flex min-h-[52px] items-center justify-center rounded-full border border-black/[0.06] bg-black/[0.035] px-4 text-center text-[13px] font-semibold text-[var(--text-caption)]"
            role="status"
          >
            Apple Pay ist derzeit nicht verfügbar
          </div>
        )
      ) : null}
      <PaymentOptionExposure
        available={applePayProviderReady}
        checkoutAttemptId={checkoutAttemptId}
        className={
          applePayUnavailable && !expressDomProbeEnabled
            ? "absolute inset-x-0 h-[52px] overflow-hidden"
            : undefined
        }
        onViewed={onPaymentOptionViewed}
        option="apple_pay"
        provider="stripe"
        providerReady={applePayProviderReady}
        visible={visible}
      >
        <div
          ref={expressHostRef}
          aria-hidden={!applePayProviderReady && !expressDomProbeEnabled}
          className={`${
            expressDomProbeEnabled
              ? "min-h-[52px]"
              : applePayPending || applePayFailed
                ? "invisible min-h-[52px]"
                : applePayUnavailable
                  ? "invisible absolute inset-x-0 h-[52px] overflow-hidden"
                  : ""
          } ${lockedProvider === "paypal" ? "pointer-events-none opacity-50" : ""}`}
          data-offer-apple-pay-availability={applePayAvailability}
          data-offer-payment-element="apple_pay"
          data-offer-payment-step={applePayProviderReady ? "apple_pay" : undefined}
        >
          {renderExpressCheckoutElement ? (
            renderExpressCheckoutElement({
              onAvailablePaymentMethodsChange: handleAvailablePaymentMethodsChange,
              onConfirm: (event) => confirmCheckout("apple_pay", event),
              onLoadError: handleExpressCheckoutLoadError,
              onReady: handleExpressCheckoutReady,
              options: stripeOfferExpressCheckoutOptions,
            })
          ) : (
            <ExpressCheckoutElement
              onConfirm={(event) => confirmCheckout("apple_pay", event)}
              onLoadError={handleExpressCheckoutLoadError}
              onReady={handleExpressCheckoutReady}
              options={stripeOfferExpressCheckoutOptions}
            />
          )}
        </div>
      </PaymentOptionExposure>

      {showSecondaryPaymentMethod ? secondaryPaymentMethod : null}

      {showResolvedPaymentDivider ? (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-[11px] font-bold uppercase text-[var(--text-caption)]">
          <span className="h-px bg-border" aria-hidden="true" />
          <span>oder</span>
          <span className="h-px bg-border" aria-hidden="true" />
        </div>
      ) : null}

      {showPaymentElement ? (
        <PaymentOptionExposure
          available={paymentElementReady}
          checkoutAttemptId={checkoutAttemptId}
          onViewed={onPaymentOptionViewed}
          option="card_and_more"
          provider="stripe"
          providerReady={paymentElementReady}
          visible={visible}
        >
          <div
            className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 rounded-[16px] border border-border bg-white p-4 shadow-sm"
            data-offer-payment-step="payment_element"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <strong className="text-[14px] text-[var(--brand-plum-darkest)]">
                Karte & weitere
              </strong>
              <span className="text-[12px] font-bold text-[var(--brand-plum-darkest)]">
                {state.totalLabel}
              </span>
            </div>
            {paymentElement ?? (
              <PaymentElement
                onChange={(event: StripePaymentElementChangeEvent) => {
                  if (!event.empty) markFirstPaymentEngagement()
                }}
                onLoadError={handlePaymentElementLoadError}
                onLoaderStart={() => {
                  if (!visibleRef.current) return
                  reportClientMounted("card_and_more")
                  reportProviderLoadStarted("card_and_more")
                  recordWalletDebugEvent("payment_loader_started")
                  clearPaymentElementReadyTimer()
                  paymentElementReadyTimerRef.current = window.setTimeout(() => {
                    reportProviderLoadTimeout("card_and_more")
                  }, PAYMENT_ELEMENT_READY_TIMEOUT_MS)
                }}
                onReady={() => {
                  clearPaymentElementReadyTimer()
                  reportClientMounted("card_and_more")
                  reportProviderReady("card_and_more")
                  setPaymentElementReady(true)
                  recordWalletDebugEvent("payment_ready")
                }}
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
              className="min-h-[52px] w-full whitespace-normal rounded-full bg-[var(--brand-plum)] px-5 text-center text-[15px] font-black leading-tight text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state.confirming
                ? "Zahlung wird bestätigt ..."
                : (paymentButtonLabel ?? `Kostenpflichtig abonnieren · ${state.totalLabel}`)}
            </Button>
          </div>
        </PaymentOptionExposure>
      ) : state.errorMessage ? (
        <p
          className="rounded-[12px] bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {state.errorMessage}
        </p>
      ) : null}
    </div>
  )
}

export function StripeOfferElementsCheckout({
  checkoutAttemptId,
  checkoutKey,
  clientSecret,
  commerceKind = "unknown",
  fetchClientSecret,
  preparationFailureReported = false,
  lockedProvider = null,
  onBeforeConfirm,
  onClientMounted,
  onConfirmStarted,
  onConfirmFailed,
  onFirstPaymentEngagement,
  onPaymentMethodSelected,
  onPaymentOptionViewed,
  onProviderReady,
  onProviderCancelled,
  onProviderLoadError,
  onProviderLoadStarted,
  onProviderLoadTimeout,
  paymentElementEnabled = true,
  paymentButtonLabel,
  onProviderLockClaim,
  onProviderLockRelease,
  onRetry,
  secondaryPaymentMethod,
  observabilitySource = "quiz_result_offer",
  stripe,
  visible = true,
}: {
  checkoutAttemptId?: string
  checkoutKey: string
  clientSecret?: string | null
  commerceKind?: PaymentCommerceKind
  fetchClientSecret: () => Promise<string>
  preparationFailureReported?: boolean
  lockedProvider?: StripeOfferProvider | null
  onBeforeConfirm?: () => Promise<StripeOfferBeforeConfirmResult>
  onClientMounted?: OfferCheckoutProviderLifecycleCallback
  onConfirmStarted?: OfferCheckoutProviderLifecycleCallback
  onConfirmFailed?: OfferCheckoutProviderLifecycleCallback
  onFirstPaymentEngagement?: () => void
  onPaymentMethodSelected?: (
    provider: StripeOfferProvider,
    paymentMethodType?: StripeOfferPaymentMethodType,
  ) => void
  onPaymentOptionViewed?: (provider: OfferPaymentOptionProvider, option: OfferPaymentOption) => void
  onProviderReady?: OfferCheckoutProviderLifecycleCallback
  onProviderCancelled?: OfferCheckoutProviderLifecycleCallback
  onProviderLoadError?: OfferCheckoutProviderLifecycleFailureCallback
  onProviderLoadStarted?: OfferCheckoutProviderLifecycleCallback
  onProviderLoadTimeout?: OfferCheckoutProviderLifecycleFailureCallback
  paymentElementEnabled?: boolean
  paymentButtonLabel?: string
  onProviderLockClaim?: (provider: StripeOfferProvider) => boolean
  onProviderLockRelease?: (provider: StripeOfferProvider) => boolean
  onRetry: () => void
  secondaryPaymentMethod?: ReactNode
  observabilitySource?: CheckoutSource
  stripe: Promise<Stripe | null>
  visible?: boolean
}) {
  const clientSecretPromise = useMemo(
    () => (clientSecret ? Promise.resolve(clientSecret) : fetchClientSecret()),
    [clientSecret, fetchClientSecret],
  )

  return (
    <CheckoutElementsProvider
      key={checkoutKey}
      stripe={stripe}
      options={{
        clientSecret: clientSecretPromise,
        elementsOptions: {
          appearance: stripeOfferCheckoutAppearance,
        },
      }}
    >
      <StripeOfferElementsCheckoutBody
        checkoutAttemptId={checkoutAttemptId}
        checkoutKey={checkoutKey}
        commerceKind={commerceKind}
        preparationFailureReported={preparationFailureReported}
        lockedProvider={lockedProvider}
        onBeforeConfirm={onBeforeConfirm}
        onFirstPaymentEngagement={onFirstPaymentEngagement}
        onClientMounted={onClientMounted}
        onConfirmStarted={onConfirmStarted}
        onConfirmFailed={onConfirmFailed}
        onPaymentMethodSelected={onPaymentMethodSelected}
        onPaymentOptionViewed={onPaymentOptionViewed}
        onProviderReady={onProviderReady}
        onProviderCancelled={onProviderCancelled}
        onProviderLoadError={onProviderLoadError}
        onProviderLoadStarted={onProviderLoadStarted}
        onProviderLoadTimeout={onProviderLoadTimeout}
        paymentElementEnabled={paymentElementEnabled}
        paymentButtonLabel={paymentButtonLabel}
        onProviderLockClaim={onProviderLockClaim}
        onProviderLockRelease={onProviderLockRelease}
        onRetry={onRetry}
        secondaryPaymentMethod={secondaryPaymentMethod}
        observabilitySource={observabilitySource}
        visible={visible}
      />
    </CheckoutElementsProvider>
  )
}
