"use client"

import * as React from "react"

import { ActiveSubscriptionDialog } from "@/components/checkout/active-subscription-dialog"
import { OfferPaymentOverlay } from "@/components/checkout/offer-payment-overlay"
import {
  StripeOfferElementsCheckoutContent,
  type StripeOfferCheckoutResult,
  type StripeOfferExpressRendererProps,
  type StripeOfferProvider,
  type StripeExpressCheckoutElementAvailablePaymentMethodsChangeEvent,
} from "@/components/checkout/stripe-offer-elements-checkout"
import { Button } from "@/components/ui/button"
import { ToastProvider, useToast } from "@/providers/toast-provider"
import type { StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js"

type PaymentFixtureProps = {
  applePayAvailable: boolean
  applePayAvailabilityDelayMs: number | null
  checkoutLoading: boolean
  applePayLoadError: boolean
  applePayFlapping: boolean
  applePaySilent: boolean
  checkoutAttemptId: string
  confirmBehavior: "success" | "reject" | "blocked" | "deferred"
  checkoutLoadingReleaseDelayMs: number | null
  initiateCheckoutCount: number
  lifecycleProbe: boolean
  onFirstPaymentEngagement: () => void
}

const labZeroAmount = { amount: "0,00 €", minorUnitsAmount: 0 }
let labPaymentFixtureMountCount = 0

const labCheckoutTotal = {
  appliedBalance: labZeroAmount,
  balanceAppliedToNextInvoice: false,
  discount: labZeroAmount,
  shippingRate: labZeroAmount,
  subtotal: { amount: "34,99 €", minorUnitsAmount: 3499 },
  surcharge: labZeroAmount,
  taxExclusive: labZeroAmount,
  taxInclusive: labZeroAmount,
  total: { amount: "34,99 €", minorUnitsAmount: 3499 },
}

function LabExpressCheckoutElement({
  applePayAvailable,
  applePayAvailabilityDelayMs,
  applePayLoadError,
  applePayFlapping,
  applePaySilent,
  disabled,
  onAvailablePaymentMethodsChange,
  onConfirm,
  onConfirmReturn,
  onLoadError,
  onPaymentFailed,
  onReady,
}: StripeOfferExpressRendererProps & {
  applePayAvailable: boolean
  applePayAvailabilityDelayMs: number | null
  applePayLoadError: boolean
  applePayFlapping: boolean
  applePaySilent: boolean
  disabled: boolean
  onConfirmReturn: (value: unknown) => void
  onPaymentFailed: () => void
}) {
  const [visible, setVisible] = React.useState(
    applePayAvailable && applePayAvailabilityDelayMs === null && !applePaySilent,
  )

  React.useEffect(() => {
    if (applePayFlapping) {
      setVisible(true)
      onReady({
        elementType: "expressCheckout",
        availablePaymentMethods: {
          amazonPay: false,
          applePay: true,
          googlePay: false,
          klarna: false,
          link: false,
          paypal: false,
        },
      })
      const unavailableTimeout = window.setTimeout(() => {
        setVisible(false)
        onAvailablePaymentMethodsChange({
          elementType: "expressCheckout",
          paymentMethods: { applePay: { available: false } },
        } satisfies StripeExpressCheckoutElementAvailablePaymentMethodsChangeEvent)
      }, 500)
      const availableTimeout = window.setTimeout(() => {
        setVisible(true)
        onAvailablePaymentMethodsChange({
          elementType: "expressCheckout",
          paymentMethods: { applePay: { available: true } },
        } satisfies StripeExpressCheckoutElementAvailablePaymentMethodsChangeEvent)
      }, 1500)
      return () => {
        window.clearTimeout(unavailableTimeout)
        window.clearTimeout(availableTimeout)
      }
    }

    if (applePayLoadError) {
      setVisible(false)
      onLoadError({
        error: {
          code: "express_checkout_load_error",
          type: "api_error",
        },
      })
      return
    }

    if (applePaySilent) {
      setVisible(false)
      return
    }

    if (applePayAvailabilityDelayMs !== null) {
      const timeout = window.setTimeout(() => {
        setVisible(true)
        onAvailablePaymentMethodsChange({
          elementType: "expressCheckout",
          paymentMethods: {
            applePay: { available: true },
          },
        } satisfies StripeExpressCheckoutElementAvailablePaymentMethodsChangeEvent)
      }, applePayAvailabilityDelayMs)

      return () => window.clearTimeout(timeout)
    }

    setVisible(applePayAvailable)
    onReady({
      elementType: "expressCheckout",
      availablePaymentMethods: {
        amazonPay: false,
        applePay: applePayAvailable,
        googlePay: false,
        klarna: false,
        link: false,
        paypal: false,
      },
    })
    if (applePayAvailable) {
      onAvailablePaymentMethodsChange({
        elementType: "expressCheckout",
        paymentMethods: {
          applePay: { available: true },
        },
      } satisfies StripeExpressCheckoutElementAvailablePaymentMethodsChangeEvent)
    }
  }, [
    applePayAvailabilityDelayMs,
    applePayAvailable,
    applePayFlapping,
    applePayLoadError,
    applePaySilent,
    onAvailablePaymentMethodsChange,
    onLoadError,
    onReady,
  ])

  if (!visible) return null

  return (
    <section data-testid="apple-pay-row" className="min-h-[52px]">
      <button
        type="button"
        aria-label="Apple Pay"
        disabled={disabled}
        onClick={() => {
          const confirmReturn: unknown = onConfirm({
            paymentFailed: onPaymentFailed,
          } as StripeExpressCheckoutElementConfirmEvent)
          onConfirmReturn(confirmReturn)
        }}
        className="min-h-[52px] w-full rounded-full bg-black px-4 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="text-xl font-semibold tracking-tight">Pay</span>
      </button>
    </section>
  )
}

function PaymentFixture({
  applePayAvailable,
  applePayAvailabilityDelayMs,
  applePayFlapping,
  checkoutLoading,
  applePayLoadError,
  applePaySilent,
  checkoutAttemptId,
  confirmBehavior,
  checkoutLoadingReleaseDelayMs,
  initiateCheckoutCount,
  lifecycleProbe,
  onFirstPaymentEngagement,
}: PaymentFixtureProps) {
  const [mountIdentity] = React.useState(() => {
    labPaymentFixtureMountCount += 1
    return {
      id: `lab-payment-fixture-${labPaymentFixtureMountCount}`,
      count: labPaymentFixtureMountCount,
    }
  })
  const [duplicateDialogOpen, setDuplicateDialogOpen] = React.useState(false)
  const [providerLock, setProviderLock] = React.useState<StripeOfferProvider | null>(null)
  const [appleCancelCount, setAppleCancelCount] = React.useState(0)
  const [confirmationCount, setConfirmationCount] = React.useState(0)
  const [paymentFailedCount, setPaymentFailedCount] = React.useState(0)
  const [applePayConfirmReturn, setApplePayConfirmReturn] = React.useState<
    "unobserved" | "thenable_pending" | "thenable_settled" | "not_thenable"
  >("unobserved")
  const [checkoutLoadingReleased, setCheckoutLoadingReleased] = React.useState(false)
  const [checkoutRetryCount, setCheckoutRetryCount] = React.useState(0)
  const providerLockRef = React.useRef<StripeOfferProvider | null>(null)
  const cancelHandlerRef = React.useRef<(() => void) | null>(null)
  const deferredConfirmResolverRef = React.useRef<(() => void) | null>(null)
  const { toast } = useToast()
  const effectiveCheckoutLoading = checkoutLoading && !checkoutLoadingReleased

  React.useEffect(() => {
    setCheckoutLoadingReleased(false)
    if (checkoutLoadingReleaseDelayMs === null) return
    const timeout = window.setTimeout(
      () => setCheckoutLoadingReleased(true),
      checkoutLoadingReleaseDelayMs,
    )
    return () => window.clearTimeout(timeout)
  }, [checkoutLoadingReleaseDelayMs])

  const claimProvider = (provider: StripeOfferProvider) => {
    if (providerLockRef.current && providerLockRef.current !== provider) return false
    providerLockRef.current = provider
    setProviderLock(provider)
    return true
  }

  const releaseProvider = (provider: StripeOfferProvider) => {
    if (providerLockRef.current !== provider) return false
    providerLockRef.current = null
    setProviderLock(null)
    return true
  }

  const expressElement = React.useMemo(() => {
    const element = {
      on: (_event: "cancel", handler: () => void) => {
        cancelHandlerRef.current = handler
        return element
      },
      off: (_event: "cancel", handler: () => void) => {
        if (cancelHandlerRef.current === handler) cancelHandlerRef.current = null
        return element
      },
    }
    return element
  }, [])

  const checkoutResult = React.useMemo<StripeOfferCheckoutResult>(() => {
    if (effectiveCheckoutLoading) return { type: "loading" }

    return {
      type: "success",
      checkout: {
        canConfirm: confirmBehavior !== "blocked",
        total: labCheckoutTotal,
        getExpressCheckoutElement: () => expressElement,
        confirm: async () => {
          setConfirmationCount((count) => count + 1)
          if (confirmBehavior === "deferred") {
            await new Promise<void>((resolve) => {
              deferredConfirmResolverRef.current = resolve
            })
          }
          if (confirmBehavior === "reject") {
            throw new Error("synthetic Stripe rejection")
          }
          return { type: "success" }
        },
      },
    }
  }, [confirmBehavior, effectiveCheckoutLoading, expressElement])

  const paypalFixture = (
    <section
      data-testid="paypal-row"
      data-offer-payment-step="paypal"
      className="rounded-[16px] border border-border bg-white p-4 shadow-sm"
    >
      <p className="mb-3 text-sm font-bold text-[var(--brand-plum-darkest)]">Mit PayPal bezahlen</p>
      <button
        type="button"
        data-testid="paypal-button"
        disabled={providerLock !== null}
        onClick={() => {
          if (claimProvider("paypal")) onFirstPaymentEngagement()
        }}
        className="min-h-12 w-full rounded-full bg-[#ffc439] px-4 text-sm font-extrabold text-[#111]"
      >
        PayPal
      </button>
    </section>
  )

  const paymentElementFixture = (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Sicher verschlüsselte Zahlung</p>
      <label className="block text-xs font-semibold text-muted-foreground">
        Kartennummer
        <input
          className="mt-1 min-h-11 w-full rounded-[10px] border border-border bg-white px-3 text-sm text-foreground"
          inputMode="numeric"
          onChange={onFirstPaymentEngagement}
          placeholder="1234 1234 1234 1234"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-muted-foreground">
          Gültig bis
          <input
            className="mt-1 min-h-11 w-full rounded-[10px] border border-border bg-white px-3 text-sm text-foreground"
            placeholder="MM / JJ"
          />
        </label>
        <label className="block text-xs font-semibold text-muted-foreground">
          CVC
          <input
            className="mt-1 min-h-11 w-full rounded-[10px] border border-border bg-white px-3 text-sm text-foreground"
            inputMode="numeric"
            placeholder="123"
          />
        </label>
      </div>
    </div>
  )

  return (
    <div
      className="space-y-4"
      data-testid={lifecycleProbe ? "prewarmed-payment-child" : "payment-fixture"}
      data-payment-child-mount-id={lifecycleProbe ? mountIdentity.id : undefined}
      data-payment-child-mount-count={lifecycleProbe ? mountIdentity.count : undefined}
    >
      <div
        data-testid="checkout-attempt-diagnostic"
        data-checkout-attempt-id={checkoutAttemptId}
        data-initiate-checkout-count={initiateCheckoutCount}
        data-apple-cancel-count={appleCancelCount}
        data-confirmation-count={confirmationCount}
        data-payment-failed-count={paymentFailedCount}
        data-apple-pay-confirm-return={applePayConfirmReturn}
        data-provider-lock={providerLock ?? "unlocked"}
        className="sr-only"
      />
      <p className="text-xs leading-5 text-muted-foreground">
        Es gilt das gesetzliche 14-tägige Widerrufsrecht.{" "}
        <a
          href="/widerruf"
          className="whitespace-nowrap font-semibold text-[var(--brand-plum)] underline"
        >
          Details ansehen
        </a>
      </p>

      <StripeOfferElementsCheckoutContent
        key={`checkout-retry-${checkoutRetryCount}`}
        checkoutResult={checkoutResult}
        lockedProvider={providerLock}
        onFirstPaymentEngagement={onFirstPaymentEngagement}
        onProviderLockClaim={claimProvider}
        onProviderLockRelease={releaseProvider}
        onRetry={() => {
          setCheckoutLoadingReleased(true)
          setCheckoutRetryCount((count) => count + 1)
        }}
        paymentElement={paymentElementFixture}
        renderExpressCheckoutElement={(props) => (
          <LabExpressCheckoutElement
            {...props}
            applePayAvailable={applePayAvailable}
            applePayAvailabilityDelayMs={applePayAvailabilityDelayMs}
            applePayFlapping={applePayFlapping}
            applePayLoadError={applePayLoadError}
            applePaySilent={applePaySilent || effectiveCheckoutLoading}
            disabled={providerLock !== null}
            onConfirmReturn={(value) => {
              const isThenable =
                value !== null &&
                (typeof value === "object" || typeof value === "function") &&
                typeof (value as { then?: unknown }).then === "function"
              if (!isThenable) {
                setApplePayConfirmReturn("not_thenable")
                return
              }

              setApplePayConfirmReturn("thenable_pending")
              void Promise.resolve(value).then(
                () => setApplePayConfirmReturn("thenable_settled"),
                () => setApplePayConfirmReturn("thenable_settled"),
              )
            }}
            onPaymentFailed={() => setPaymentFailedCount((count) => count + 1)}
          />
        )}
        secondaryPaymentMethod={paypalFixture}
      />

      <button
        type="button"
        onClick={() => {
          setAppleCancelCount((count) => count + 1)
          cancelHandlerRef.current?.()
        }}
        className="w-full rounded-[10px] border border-dashed border-border px-4 py-3 text-sm font-bold text-muted-foreground"
      >
        Apple Pay abbrechen simulieren
      </button>

      <button
        type="button"
        onClick={() => releaseProvider("paypal")}
        className="w-full rounded-[10px] border border-dashed border-muted-foreground px-4 py-3 text-sm font-bold text-muted-foreground"
      >
        Verspäteten PayPal-Abbruch simulieren
      </button>

      <button
        type="button"
        onClick={() => {
          const resolve = deferredConfirmResolverRef.current
          deferredConfirmResolverRef.current = null
          resolve?.()
        }}
        className="w-full rounded-[10px] border border-dashed border-muted-foreground px-4 py-3 text-sm font-bold text-muted-foreground"
      >
        Stripe-Bestätigung abschließen simulieren
      </button>

      <button
        type="button"
        onClick={() => setDuplicateDialogOpen(true)}
        className="w-full rounded-[10px] border border-dashed border-[var(--brand-plum)] px-4 py-3 text-sm font-bold text-[var(--brand-plum)]"
      >
        Doppelzugang simulieren
      </button>

      <button
        type="button"
        onClick={() =>
          toast({
            title: "Zahlung nicht möglich",
            description: "Bitte prüfe deine Angaben und versuche es erneut.",
            variant: "destructive",
          })
        }
        className="w-full rounded-[10px] border border-dashed border-destructive px-4 py-3 text-sm font-bold text-destructive"
      >
        Fehlermeldung simulieren
      </button>

      <ActiveSubscriptionDialog
        email="lea@example.com"
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
      />
    </div>
  )
}

function OfferPaymentOverlayLabContent() {
  const [ready, setReady] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [checkoutEngaged, setCheckoutEngaged] = React.useState(true)
  const [lastOutcome, setLastOutcome] = React.useState("Noch nicht geöffnet")
  const [applePayAvailable, setApplePayAvailable] = React.useState(true)
  const [applePayAvailabilityDelayMs, setApplePayAvailabilityDelayMs] = React.useState<
    number | null
  >(null)
  const [applePayLoadError, setApplePayLoadError] = React.useState(false)
  const [applePayFlapping, setApplePayFlapping] = React.useState(false)
  const [applePaySilent, setApplePaySilent] = React.useState(false)
  const [checkoutLoading, setCheckoutLoading] = React.useState(false)
  const [checkoutLoadingReleaseDelayMs, setCheckoutLoadingReleaseDelayMs] = React.useState<
    number | null
  >(null)
  const [prewarmedLifecycle, setPrewarmedLifecycle] = React.useState(false)
  const [confirmBehavior, setConfirmBehavior] = React.useState<
    "success" | "reject" | "blocked" | "deferred"
  >("success")
  const [initiateCheckoutCount, setInitiateCheckoutCount] = React.useState(0)
  const checkoutAttemptId = "lab-checkout-attempt-1"
  const selectedPlanRef = React.useRef<HTMLElement | null>(null)
  const checkoutReturnFocusRef = React.useRef<HTMLElement | null>(null)
  const pristineDismissalModeRef = React.useRef(false)

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    pristineDismissalModeRef.current = params.get("dismissal") === "pristine"
    setCheckoutEngaged(!pristineDismissalModeRef.current)
    const initialApplePayState = params.get("apple")
    setApplePayAvailable(initialApplePayState !== "unavailable")
    setApplePayAvailabilityDelayMs(
      initialApplePayState === "delayed" ? 1500 : initialApplePayState === "late" ? 5500 : null,
    )
    setApplePayLoadError(initialApplePayState === "load-error")
    setApplePayFlapping(initialApplePayState === "flapping")
    setApplePaySilent(initialApplePayState === "silent" || initialApplePayState === "slow-checkout")
    setCheckoutLoading(
      initialApplePayState === "checkout-loading" || initialApplePayState === "slow-checkout",
    )
    setCheckoutLoadingReleaseDelayMs(initialApplePayState === "slow-checkout" ? 8_000 : null)
    setPrewarmedLifecycle(params.get("lifecycle") === "prewarm")
    const initialConfirmBehavior = params.get("confirm")
    setConfirmBehavior(
      initialConfirmBehavior === "reject" ||
        initialConfirmBehavior === "blocked" ||
        initialConfirmBehavior === "deferred"
        ? initialConfirmBehavior
        : "success",
    )
    setReady(true)
  }, [])

  const setApplePayAvailability = (available: boolean) => {
    setApplePayAvailable(available)
    setApplePayAvailabilityDelayMs(null)
    setApplePayLoadError(false)
    setApplePayFlapping(false)
    setApplePaySilent(false)
    setCheckoutLoading(false)
    setCheckoutLoadingReleaseDelayMs(null)
    const url = new URL(window.location.href)
    if (available) url.searchParams.delete("apple")
    else url.searchParams.set("apple", "unavailable")
    window.history.replaceState(null, "", url)
  }

  const closeWithOutcome = (outcome: string) => {
    setLastOutcome(outcome)
    setCheckoutEngaged(false)
    setOpen(false)
  }

  return (
    <main
      data-payment-overlay-lab-ready={ready ? "true" : "false"}
      className="min-h-[220vh] bg-[#f7f3f7] px-5 pb-24 pt-10 text-foreground"
    >
      <div className="mx-auto max-w-[720px]" data-testid="offer-page-background">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--brand-plum)]">
          Chaarlie Angebotsvorschau
        </p>
        <h1 className="text-3xl font-bold text-[var(--brand-plum-darkest)]">
          Deine persönliche Haar-Routine
        </h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          Diese sichere Laboransicht bildet den Checkout ohne echte Zahlungsanbieter nach.
        </p>

        <div className="mt-5 flex flex-wrap gap-2" aria-label="Apple-Pay-Laborsteuerung">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={applePayAvailable}
            onClick={() => setApplePayAvailability(true)}
          >
            Apple Pay verfügbar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={!applePayAvailable}
            onClick={() => setApplePayAvailability(false)}
          >
            Apple Pay nicht verfügbar
          </Button>
        </div>

        <div className="h-[72vh]" aria-hidden="true" />

        <section
          ref={selectedPlanRef}
          tabIndex={-1}
          data-testid="selected-plan-card"
          className="rounded-[22px] border border-border bg-white p-5 shadow-sm outline-none focus:ring-2 focus:ring-[var(--brand-plum)] focus:ring-offset-2"
        >
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-plum)]">
            Ausgewählter Plan
          </p>
          <h2 className="mt-2 text-xl font-bold text-[var(--brand-plum-darkest)]">Quartal</h2>
          <p className="mt-1 text-sm text-muted-foreground">34,99 € alle 3 Monate</p>
          <Button
            type="button"
            variant="unstyled"
            onClick={() => {
              setLastOutcome("Zahlung geöffnet")
              checkoutReturnFocusRef.current = null
              setCheckoutEngaged(!pristineDismissalModeRef.current)
              setInitiateCheckoutCount((count) => count + 1)
              setOpen(true)
            }}
            className="mt-5 min-h-12 w-full rounded-[12px] bg-[var(--brand-coral)] px-5 font-bold text-white"
          >
            Ja, jetzt starten
          </Button>
        </section>

        <p className="mt-4 text-sm text-muted-foreground" data-testid="last-outcome">
          Status: {lastOutcome}
        </p>
      </div>

      <OfferPaymentOverlay
        checkoutEngaged={checkoutEngaged}
        open={open}
        keepMounted={prewarmedLifecycle}
        planName="Quartal"
        priceLabel="34,99 €"
        onConfirmedAbort={() => {
          checkoutReturnFocusRef.current = null
          closeWithOutcome("Zahlung abgebrochen")
        }}
        onConfirmedPlanChange={() => {
          checkoutReturnFocusRef.current = selectedPlanRef.current
          closeWithOutcome("Planänderung bestätigt")
        }}
        restoreFocusRef={checkoutReturnFocusRef}
      >
        <PaymentFixture
          applePayAvailable={applePayAvailable}
          applePayAvailabilityDelayMs={applePayAvailabilityDelayMs}
          applePayFlapping={applePayFlapping}
          checkoutLoading={checkoutLoading}
          applePayLoadError={applePayLoadError}
          applePaySilent={applePaySilent}
          checkoutAttemptId={checkoutAttemptId}
          confirmBehavior={confirmBehavior}
          checkoutLoadingReleaseDelayMs={checkoutLoadingReleaseDelayMs}
          initiateCheckoutCount={initiateCheckoutCount}
          lifecycleProbe={prewarmedLifecycle}
          onFirstPaymentEngagement={() => setCheckoutEngaged(true)}
        />
      </OfferPaymentOverlay>
    </main>
  )
}

export function OfferPaymentOverlayLab() {
  return (
    <ToastProvider>
      <OfferPaymentOverlayLabContent />
    </ToastProvider>
  )
}

type ColdCheckoutScenario = "loading" | "ready" | "unavailable" | "failure" | "retry" | "one-time"

const coldCheckoutScenarios = new Set<ColdCheckoutScenario>([
  "loading",
  "ready",
  "unavailable",
  "failure",
  "retry",
  "one-time",
])

function getColdCheckoutScenario(value: string | undefined): ColdCheckoutScenario {
  return value && coldCheckoutScenarios.has(value as ColdCheckoutScenario)
    ? (value as ColdCheckoutScenario)
    : "loading"
}

function OfferPaymentColdCheckoutLabContent({ scenario: scenarioInput }: { scenario?: string }) {
  const scenario = getColdCheckoutScenario(scenarioInput)
  const [open, setOpen] = React.useState(false)
  const [attempt, setAttempt] = React.useState(0)
  const [accepted, setAccepted] = React.useState(false)
  const [stripeRetry, setStripeRetry] = React.useState(0)
  const stripeStarted = open && (scenario !== "one-time" || accepted)
  const resolvedScenario = stripeRetry > 0 ? "ready" : scenario

  return (
    <main className="min-h-screen bg-[#f7f3f7] px-5 py-10" data-testid="payment-cold-checkout-lab">
      <div className="mx-auto max-w-[560px] space-y-6" data-testid="cold-page-background">
        <button
          type="button"
          data-testid="cold-final-cta"
          onClick={() => {
            setAttempt((value) => value + 1)
            setAccepted(false)
            setOpen(true)
          }}
        >
          Plan sichern
        </button>
        <div
          data-testid="cold-diagnostic"
          data-attempt-count={attempt}
          data-stripe-started={String(stripeStarted)}
        />
        <OfferPaymentOverlay
          checkoutEngaged={false}
          onConfirmedAbort={() => setOpen(false)}
          onConfirmedPlanChange={() => setOpen(false)}
          open={open}
          planName="Dein Haarplan"
          priceLabel="29,99 €"
        >
          <section
            data-testid="cold-payment-checkout"
            data-checkout-attempt-id={attempt || "none"}
            className="space-y-4"
          >
            {scenario === "one-time" ? (
              <label className="flex gap-2 text-sm">
                <input
                  data-testid="cold-consent"
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                />
                Ich stimme der sofortigen Erstellung meines persönlichen Haarplans zu.
              </label>
            ) : null}
            {!stripeStarted ? (
              <div data-testid="cold-consent-placeholder">
                Apple Pay wird nach deiner Zustimmung geladen.
              </div>
            ) : resolvedScenario === "failure" ? (
              <>
                <p data-testid="cold-stripe-failure">
                  Apple Pay und Karte konnten gerade nicht geladen werden. Nutze PayPal oder
                  versuche es erneut.
                </p>
                <button
                  type="button"
                  data-testid="cold-stripe-retry"
                  onClick={() => setStripeRetry((value) => value + 1)}
                >
                  Stripe erneut laden
                </button>
              </>
            ) : resolvedScenario === "unavailable" ? (
              <p data-testid="cold-apple-pay-unavailable">
                Apple Pay ist auf diesem Gerät nicht verfügbar.
              </p>
            ) : resolvedScenario === "ready" ? (
              <button type="button" data-testid="cold-apple-pay">
                Apple Pay
              </button>
            ) : (
              <div data-testid="cold-stripe-loading">Apple Pay wird geladen …</div>
            )}
            <button type="button" data-testid="cold-paypal">
              PayPal
            </button>
            {stripeStarted && resolvedScenario !== "failure" ? (
              <input data-testid="cold-card" aria-label="Kartennummer" />
            ) : null}
          </section>
        </OfferPaymentOverlay>
      </div>
    </main>
  )
}

export function OfferPaymentColdCheckoutLab({ scenario }: { scenario?: string }) {
  return (
    <ToastProvider>
      <OfferPaymentColdCheckoutLabContent scenario={scenario} />
    </ToastProvider>
  )
}
