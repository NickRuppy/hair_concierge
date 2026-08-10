"use client"

import { useEffect, useRef, useState } from "react"
import { FUNDING, PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js"

import { usePaymentRuntime } from "@/components/providers/payment-runtime-provider"
import { PaymentFeedbackCard } from "@/components/checkout/payment-feedback-card"
import { usePaymentSupportReport } from "@/components/checkout/use-payment-support-report"
import { useOfferTrackingContext } from "@/components/quiz/offer-tracking-provider"
import {
  beginPayPalOneTimeRecoveryCheck,
  completePayPalOneTimeRecoveryCheck,
  createInitialPayPalOneTimeRecoveryState,
  derivePayPalOneTimeRecoveryView,
  requestManualPayPalOneTimeRecoveryCheck,
  resolvePayPalOneTimeRecoveryHttpResult,
  settlePayPalOneTimeRecoveryRequest,
  settlePayPalOneTimeRecoveryWindow,
  startPayPalOneTimeRecovery,
  type PayPalOneTimeRecoveryEffect,
  type PayPalOneTimeRecoveryOutcome,
  type PayPalOneTimeRecoveryStatus,
  type PayPalOneTimeRecoveryView,
} from "@/lib/checkout/paypal-one-time-recovery"
import { createFunnelEventId } from "@/lib/funnel/client"
import { paymentFeedback } from "@/lib/checkout/payment-feedback"
import { isPaymentFeedbackV2Enabled, isPaymentSupportUiEnabled } from "@/lib/funnel/flags"
import { buildPayPalOneTimeWelcomeUrl } from "@/lib/paypal/welcome-url"
import type { CheckoutLifecycleClaim } from "@/lib/analytics/checkout-attempt"
import {
  createCheckoutWatchdog,
  createCheckoutWatchdogRegistry,
} from "@/lib/observability/checkout-watchdog"
import { capturePayPalOneTimeSdkRecoveryWarning } from "@/lib/observability/checkout"
import {
  capturePaymentFailure,
  type PaymentBoundary,
  type PaymentErrorFamily,
} from "@/lib/observability/payment-client"

function capturePayPalOneTimeCustomerPaymentError({
  boundary,
  checkoutAttemptId,
  errorFamily,
  isInternalTest,
  leadId,
  live,
  providerReferencePresent = false,
  signal = "customer_payment_error_observed",
  status,
  durationMs,
}: {
  boundary: PaymentBoundary
  checkoutAttemptId: string
  errorFamily: PaymentErrorFamily
  isInternalTest: boolean
  leadId: string
  live: boolean
  providerReferencePresent?: boolean
  signal?: "checkout_experience_degraded" | "customer_payment_error_observed"
  status: string | number
  durationMs?: number
}) {
  capturePaymentFailure({
    signal,
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
    durationMs,
    providerReferencePresent,
  })
}

export function PayPalOneTimeButton({
  checkoutAttemptId,
  funnelSessionId,
  leadId,
  onClientMounted,
  onCheckoutStarted,
  onConfirmStarted,
  onDuplicateAccess,
  onPaymentMethodSelected,
  onProviderSelected,
  onProviderConflict,
  onReady,
  onCheckoutLifecycle,
  visible = true,
}: {
  checkoutAttemptId: string
  funnelSessionId: string
  leadId: string
  onClientMounted?: () => void
  onCheckoutStarted?: (funnelEventId: string) => void
  onConfirmStarted?: () => void
  onDuplicateAccess?: () => void
  onPaymentMethodSelected?: () => void
  onProviderSelected?: () => void
  onProviderConflict?: () => void
  onReady?: () => void
  visible?: boolean
  onCheckoutLifecycle?: (
    claim: Omit<CheckoutLifecycleClaim, "checkoutAttemptId" | "lastState" | "openIndex">,
  ) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [busy, setBusy] = useState(false)
  const [recoveryView, setRecoveryView] = useState<PayPalOneTimeRecoveryView | null>(null)
  const intentTokenRef = useRef<string | null>(null)
  const recoveryStateRef = useRef(createInitialPayPalOneTimeRecoveryState())
  const recoveryTimersRef = useRef<Set<number>>(new Set())
  const manualCooldownTimerRef = useRef<number | null>(null)
  const recoveryAbortRef = useRef<{ requestId: number; controller: AbortController } | null>(null)
  const deferredWelcomeUrlRef = useRef<string | null>(null)
  const navigationClaimedRef = useRef(false)
  const payPalFunnelEventRef = useRef<{ checkoutAttemptId: string; funnelEventId: string } | null>(
    null,
  )
  const suppressNextPayPalErrorRef = useRef(false)
  const clientMountedReportedRef = useRef(false)
  const confirmStartedReportedRef = useRef(false)
  const clearSdkWatchdogRef = useRef<(() => void) | null>(null)
  const watchdogsRef = useRef(createCheckoutWatchdogRegistry())
  const visibleRef = useRef(visible)
  visibleRef.current = visible
  const { paypalLive } = usePaymentRuntime()
  const offerContext = useOfferTrackingContext()
  const isInternalTest = offerContext?.isInternalTest ?? false
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim()
  const pendingFeedback =
    recoveryView?.kind === "pending"
      ? paymentFeedback(
          recoveryView.outcome === "no_token" ? "checkout_not_loaded" : "payment_status_pending",
          {
            provider: "paypal",
            method: "paypal",
            confirmationPhase:
              recoveryView.outcome === "no_token" ? "before_confirm" : "after_confirm",
          },
        )
      : null
  const errorFeedback = error
    ? paymentFeedback("payment_not_completed", {
        provider: "paypal",
        method: "paypal",
        confirmationPhase: "after_confirm",
      })
    : null
  const activeFeedback = pendingFeedback ?? errorFeedback
  const supportReport = usePaymentSupportReport({
    checkoutAttemptId,
    checkoutContext: "result_one_time",
    feedback: activeFeedback,
  })

  useEffect(() => {
    clientMountedReportedRef.current = false
    confirmStartedReportedRef.current = false
    resetPayPalRecovery()
    intentTokenRef.current = null
    navigationClaimedRef.current = false
    payPalFunnelEventRef.current = null
    setRecoveryView(null)
  }, [checkoutAttemptId])

  useEffect(() => {
    if (!clientId || !visible) return
    const watchdogs = watchdogsRef.current
    const watchdog = watchdogs.track(
      createCheckoutWatchdog({
        onTimeout: (durationMs) => {
          if (clientMountedReportedRef.current) return
          capturePayPalOneTimeCustomerPaymentError({
            boundary: "provider_session",
            checkoutAttemptId,
            durationMs,
            errorFamily: "timeout",
            isInternalTest,
            leadId,
            live: paypalLive,
            signal: "checkout_experience_degraded",
            status: "paypal_sdk_ready_timeout",
          })
          onCheckoutLifecycle?.({
            failureReason: "provider_ready_timeout",
            option: "paypal",
            provider: "paypal",
            transition: "provider_load_timeout",
          })
        },
      }),
    )
    clearSdkWatchdogRef.current = () => watchdogs.settle(watchdog)
    return () => {
      watchdogs.settle(watchdog)
      if (clearSdkWatchdogRef.current) clearSdkWatchdogRef.current = null
    }
  }, [
    checkoutAttemptId,
    clientId,
    isInternalTest,
    leadId,
    onCheckoutLifecycle,
    paypalLive,
    visible,
  ])

  useEffect(() => {
    if (visible) return
    watchdogsRef.current.settleAll()
    clearSdkWatchdogRef.current = null
  }, [visible])

  useEffect(() => {
    const watchdogs = watchdogsRef.current
    return () => {
      watchdogs.settleAll()
      resetPayPalRecovery()
    }
  }, [])

  useEffect(() => {
    publishPayPalRecoveryView()
    if (visible && deferredWelcomeUrlRef.current) {
      const url = deferredWelcomeUrlRef.current
      deferredWelcomeUrlRef.current = null
      claimWelcomeNavigation(url)
    }
    // `publishPayPalRecoveryView` intentionally reads mutable refs so hidden callbacks
    // can keep reconciling without remounting or restarting the recovery cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  if (!clientId) return null

  function resetPayPalRecovery() {
    for (const timer of recoveryTimersRef.current) window.clearTimeout(timer)
    recoveryTimersRef.current.clear()
    if (manualCooldownTimerRef.current !== null) {
      window.clearTimeout(manualCooldownTimerRef.current)
      manualCooldownTimerRef.current = null
    }
    recoveryAbortRef.current?.controller.abort()
    recoveryAbortRef.current = null
    deferredWelcomeUrlRef.current = null
    recoveryStateRef.current = createInitialPayPalOneTimeRecoveryState()
  }

  function publishPayPalRecoveryView() {
    const view = derivePayPalOneTimeRecoveryView(recoveryStateRef.current, {
      visible: visibleRef.current,
      now: Date.now(),
    })
    setRecoveryView(view)
    scheduleManualCooldownPublish(view)
  }

  function scheduleManualCooldownPublish(view: PayPalOneTimeRecoveryView | null) {
    if (manualCooldownTimerRef.current !== null) {
      window.clearTimeout(manualCooldownTimerRef.current)
      manualCooldownTimerRef.current = null
    }
    if (
      view?.kind !== "pending" ||
      view.manualCheckReady ||
      view.nextManualCheckAt === null ||
      !visibleRef.current
    )
      return
    const delay = Math.max(0, view.nextManualCheckAt - Date.now())
    manualCooldownTimerRef.current = window.setTimeout(() => {
      manualCooldownTimerRef.current = null
      publishPayPalRecoveryView()
    }, delay)
  }

  function claimWelcomeNavigation(url: string) {
    if (navigationClaimedRef.current) return false
    if (!visibleRef.current) {
      deferredWelcomeUrlRef.current = url
      return false
    }
    navigationClaimedRef.current = true
    deferredWelcomeUrlRef.current = null
    for (const timer of recoveryTimersRef.current) window.clearTimeout(timer)
    recoveryTimersRef.current.clear()
    if (manualCooldownTimerRef.current !== null) {
      window.clearTimeout(manualCooldownTimerRef.current)
      manualCooldownTimerRef.current = null
    }
    recoveryAbortRef.current?.controller.abort()
    recoveryAbortRef.current = null
    window.location.assign(url)
    return true
  }

  function payPalFunnelEventIdForAttempt() {
    if (payPalFunnelEventRef.current?.checkoutAttemptId === checkoutAttemptId) {
      return payPalFunnelEventRef.current.funnelEventId
    }
    const funnelEventId = createFunnelEventId()
    payPalFunnelEventRef.current = { checkoutAttemptId, funnelEventId }
    return funnelEventId
  }

  function applyPayPalRecoveryEffects(effects: PayPalOneTimeRecoveryEffect[]) {
    for (const effect of effects) {
      if (effect.type === "schedule_check") {
        const delay = Math.max(0, effect.dueAt - Date.now())
        const timer = window.setTimeout(() => {
          recoveryTimersRef.current.delete(timer)
          beginScheduledPayPalRecoveryCheck(effect.index)
        }, delay)
        recoveryTimersRef.current.add(timer)
        continue
      }

      if (effect.type === "schedule_window_deadline") {
        const delay = Math.max(0, effect.dueAt - Date.now())
        const timer = window.setTimeout(() => {
          recoveryTimersRef.current.delete(timer)
          settlePayPalRecoveryWindow()
        }, delay)
        recoveryTimersRef.current.add(timer)
        continue
      }

      if (effect.type === "schedule_manual_enable") {
        publishPayPalRecoveryView()
        continue
      }

      if (effect.type === "schedule_request_deadline") {
        const delay = Math.max(0, effect.dueAt - Date.now())
        const timer = window.setTimeout(() => {
          recoveryTimersRef.current.delete(timer)
          const settled = settlePayPalOneTimeRecoveryRequest(recoveryStateRef.current, {
            now: Date.now(),
            requestId: effect.requestId,
          })
          recoveryStateRef.current = settled.state
          publishPayPalRecoveryView()
          applyPayPalRecoveryEffects(settled.effects)
        }, delay)
        recoveryTimersRef.current.add(timer)
        continue
      }

      if (effect.type === "abort_status_check") {
        if (recoveryAbortRef.current?.requestId === effect.requestId) {
          recoveryAbortRef.current.controller.abort()
          recoveryAbortRef.current = null
        }
        continue
      }

      if (effect.type === "status_check") {
        void pollPayPalRecoveryStatus(effect)
        continue
      }

      if (effect.type === "navigate") {
        const returnState =
          effect.outcome === "failed_permanent" || effect.outcome === "revoked"
            ? effect.outcome
            : undefined
        claimWelcomeNavigation(buildPayPalOneTimeWelcomeUrl(effect.token, returnState))
        continue
      }

      if (effect.type === "warning") {
        capturePayPalOneTimeSdkRecoveryWarning({
          checkoutAttemptId,
          isInternalTest,
          live: paypalLive,
          paypalTokenPresent: effect.tokenPresent,
          paypalRecoveryOutcome: sentryOutcome(effect.outcome),
          release: checkoutRelease(),
          browserFamily: browserFamily(),
          viewportClass: viewportClass(),
          standaloneWebViewHint: standaloneWebViewHint(),
        })
        continue
      }

      if (effect.type === "lifecycle") {
        onCheckoutLifecycle?.({
          option: "paypal",
          provider: "paypal",
          transition: effect.transition,
        })
      }
    }
  }

  function beginScheduledPayPalRecoveryCheck(index: number) {
    const result = beginPayPalOneTimeRecoveryCheck(recoveryStateRef.current, {
      now: Date.now(),
      source: "automatic",
      index,
    })
    recoveryStateRef.current = result.state
    publishPayPalRecoveryView()
    applyPayPalRecoveryEffects(result.effects)
  }

  function settlePayPalRecoveryWindow() {
    const result = settlePayPalOneTimeRecoveryWindow(recoveryStateRef.current, {
      now: Date.now(),
    })
    recoveryStateRef.current = result.state
    publishPayPalRecoveryView()
    applyPayPalRecoveryEffects(result.effects)
  }

  function beginManualPayPalRecoveryCheck() {
    const result = requestManualPayPalOneTimeRecoveryCheck(recoveryStateRef.current, {
      now: Date.now(),
    })
    recoveryStateRef.current = result.state
    publishPayPalRecoveryView()
    applyPayPalRecoveryEffects(result.effects)
  }

  async function pollPayPalRecoveryStatus(
    effect: Extract<PayPalOneTimeRecoveryEffect, { type: "status_check" }>,
  ) {
    const controller = new AbortController()
    recoveryAbortRef.current = { requestId: effect.requestId, controller }
    let result: { ok: true; status: PayPalOneTimeRecoveryStatus } | { ok: false } = { ok: false }
    try {
      const params = new URLSearchParams({ provider: "paypal", token: effect.token })
      const response = await fetch(`/api/billing/one-time-activation-status?${params.toString()}`, {
        signal: controller.signal,
      })
      const body = (await response.json().catch(() => ({}))) as { status?: unknown }
      result = resolvePayPalOneTimeRecoveryHttpResult({
        responseOk: response.ok,
        status: body.status,
      })
    } catch {
      if (controller.signal.aborted) return
      result = { ok: false }
    } finally {
      if (recoveryAbortRef.current?.requestId === effect.requestId) recoveryAbortRef.current = null
    }

    const completed =
      effect.source === "automatic"
        ? completePayPalOneTimeRecoveryCheck(recoveryStateRef.current, {
            now: Date.now(),
            source: "automatic",
            index: effect.index ?? 0,
            requestId: effect.requestId,
            result,
          })
        : completePayPalOneTimeRecoveryCheck(recoveryStateRef.current, {
            now: Date.now(),
            source: "manual",
            requestId: effect.requestId,
            result,
          })
    recoveryStateRef.current = completed.state
    publishPayPalRecoveryView()
    applyPayPalRecoveryEffects(completed.effects)
  }

  function startPayPalSdkErrorRecovery() {
    setBusy(false)
    setError(null)
    const token = intentTokenRef.current
    if (!token && recoveryStateRef.current.phase === "idle") {
      // No client token means the SDK failed before this browser had evidence of
      // a server-owned PayPal attempt. Keep the customer surface neutral, but
      // preserve the truthful provider-load telemetry. Token-backed popup
      // uncertainty is reconciled by the recovery poller instead.
      capturePayPalOneTimeCustomerPaymentError({
        boundary: "provider_session",
        checkoutAttemptId,
        errorFamily: "unknown",
        isInternalTest,
        leadId,
        live: paypalLive,
        status: "paypal_button_error",
      })
      onCheckoutLifecycle?.({
        failureReason: "provider_load_error",
        option: "paypal",
        provider: "paypal",
        transition: "provider_load_error",
      })
    }
    const result = startPayPalOneTimeRecovery(recoveryStateRef.current, {
      token,
      now: Date.now(),
    })
    recoveryStateRef.current = result.state
    publishPayPalRecoveryView()
    applyPayPalRecoveryEffects(result.effects)
  }

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
            resetPayPalRecovery()
            intentTokenRef.current = null
            setError(null)
            setRecoveryView(null)
            suppressNextPayPalErrorRef.current = false
            setBusy(true)
            const funnelEventId = payPalFunnelEventIdForAttempt()
            onPaymentMethodSelected?.()
            if (!confirmStartedReportedRef.current) {
              confirmStartedReportedRef.current = true
              onConfirmStarted?.()
            }
            const watchdog = watchdogsRef.current.track(
              createCheckoutWatchdog({
                onTimeout: (durationMs) => {
                  capturePayPalOneTimeCustomerPaymentError({
                    boundary: "provider_session",
                    checkoutAttemptId,
                    durationMs,
                    errorFamily: "timeout",
                    isInternalTest,
                    leadId,
                    live: paypalLive,
                    signal: "checkout_experience_degraded",
                    status: "paypal_create_order_timeout",
                  })
                  onCheckoutLifecycle?.({
                    failureReason: "provider_request_timeout",
                    option: "paypal",
                    provider: "paypal",
                    transition: "provider_load_timeout",
                  })
                },
              }),
            )
            let response: Response
            try {
              response = await fetch("/api/paypal/create-order-intent", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  purchaseKind: "personal_plan_once",
                  leadId,
                  funnelSessionId,
                  checkoutAttemptId,
                  funnelEventId,
                }),
              })
            } finally {
              watchdogsRef.current.settle(watchdog)
            }
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
            onProviderSelected?.()
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
            const watchdog = watchdogsRef.current.track(
              createCheckoutWatchdog({
                onTimeout: (durationMs) => {
                  capturePayPalOneTimeCustomerPaymentError({
                    boundary: "provider_outcome",
                    checkoutAttemptId,
                    durationMs,
                    errorFamily: "timeout",
                    isInternalTest,
                    leadId,
                    live: paypalLive,
                    providerReferencePresent: true,
                    signal: "checkout_experience_degraded",
                    status: "paypal_capture_order_timeout",
                  })
                  onCheckoutLifecycle?.({
                    failureReason: "provider_request_timeout",
                    option: "paypal",
                    provider: "paypal",
                    transition: "provider_load_timeout",
                  })
                },
              }),
            )
            let response: Response
            try {
              response = await fetch("/api/paypal/capture-order", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ token }),
              })
            } finally {
              watchdogsRef.current.settle(watchdog)
            }
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
              if (typeof body.welcomeUrl === "string") claimWelcomeNavigation(body.welcomeUrl)
              else {
                setBusy(false)
                setError(
                  "PayPal-Zahlung konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
                )
                capturePayPalOneTimeCustomerPaymentError({
                  boundary: "provider_outcome",
                  checkoutAttemptId,
                  errorFamily: "provider_session",
                  isInternalTest,
                  leadId,
                  live: paypalLive,
                  providerReferencePresent: true,
                  signal: "checkout_experience_degraded",
                  status: "paypal_capture_pending_missing_welcome_url",
                })
                onCheckoutLifecycle?.({
                  failureReason: "malformed_provider_response",
                  option: "paypal",
                  provider: "paypal",
                  transition: "provider_load_error",
                })
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
            claimWelcomeNavigation(body.welcomeUrl)
          }}
          onCancel={() => {
            setBusy(false)
            onCheckoutLifecycle?.({
              option: "paypal",
              provider: "paypal",
              transition: "provider_cancelled",
            })
            if (intentTokenRef.current) onProviderSelected?.()
          }}
          onInit={() => {
            clearSdkWatchdogRef.current?.()
            if (!clientMountedReportedRef.current) {
              clientMountedReportedRef.current = true
              onClientMounted?.()
            }
            onReady?.()
          }}
          onError={(paypalError) => {
            if (!visibleRef.current) return
            setBusy(false)
            if (suppressNextPayPalErrorRef.current) {
              suppressNextPayPalErrorRef.current = false
              return
            }
            if (
              paypalError instanceof Error &&
              paypalError.message === "checkout access already exists"
            )
              return
            startPayPalSdkErrorRecovery()
          }}
        />
      </PayPalScriptProvider>
      {busy ? (
        <span className="text-center text-xs text-muted-foreground">PayPal wird vorbereitet …</span>
      ) : null}
      {error && errorFeedback && isPaymentFeedbackV2Enabled() ? (
        <PaymentFeedbackCard
          feedback={errorFeedback}
          onAction={() => setError(null)}
          onReportProblem={isPaymentSupportUiEnabled() ? supportReport.report : undefined}
          reportState={supportReport.state}
        />
      ) : error ? (
        <p className="text-center text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {recoveryView?.kind === "pending" && pendingFeedback && isPaymentFeedbackV2Enabled() ? (
        <PaymentFeedbackCard
          feedback={pendingFeedback}
          onAction={() => {
            if (recoveryView.outcome === "no_token") setRecoveryView(null)
            else if (recoveryView.manualCheckReady) beginManualPayPalRecoveryCheck()
          }}
          onReportProblem={isPaymentSupportUiEnabled() ? supportReport.report : undefined}
          reportState={supportReport.state}
        />
      ) : recoveryView && (recoveryView.kind === "checking" || recoveryView.kind === "pending") ? (
        <div
          className="grid gap-3 rounded-[14px] border border-[var(--brand-plum)]/15 bg-[var(--brand-lavender)]/35 p-4 text-center"
          role={recoveryView.kind === "checking" ? "status" : undefined}
        >
          {recoveryView.kind === "checking" ? (
            <>
              <span
                aria-hidden="true"
                className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg text-[var(--brand-plum)]"
              >
                ↻
              </span>
              <p className="text-sm font-semibold text-[var(--brand-plum-darkest)]">
                Wir prüfen deine PayPal-Zahlung
              </p>
              <p className="text-sm text-muted-foreground">
                PayPal hat das Fenster unerwartet geschlossen. Wir gleichen kurz ab, ob eine Zahlung
                eingegangen ist.
              </p>
            </>
          ) : null}
          {recoveryView.kind === "pending" ? (
            <>
              <p className="text-sm font-semibold text-[var(--brand-plum-darkest)]">
                {recoveryView.outcome === "no_token"
                  ? "PayPal konnte nicht sicher gestartet werden"
                  : "Noch keine Zahlung bestätigt"}
              </p>
              <p className="text-sm text-muted-foreground">
                {recoveryView.outcome === "no_token"
                  ? "Es wurde noch keine Zahlung bestätigt. Du kannst den PayPal-Button erneut verwenden oder das Zahlungsfenster schließen."
                  : "Du kannst PayPal erneut öffnen. Wir verwenden denselben Zahlungsversuch – es wird keine zweite Bestellung angelegt."}
              </p>
              {recoveryView.outcome !== "no_token" ? (
                <>
                  <button
                    type="button"
                    className="rounded-[12px] border border-[var(--brand-plum)]/45 px-4 py-2 text-sm font-semibold text-[var(--brand-plum)] disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={!recoveryView.manualCheckReady}
                    onClick={beginManualPayPalRecoveryCheck}
                  >
                    Status erneut prüfen
                  </button>
                  {!recoveryView.manualCheckReady ? (
                    <p className="text-xs text-muted-foreground">
                      Du kannst den Status in wenigen Sekunden erneut prüfen.
                    </p>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function sentryOutcome(
  outcome: PayPalOneTimeRecoveryOutcome,
): "no_token" | "pending" | "pending_access" | "succeeded" | "failed_permanent" | "revoked" {
  if (outcome === "not_started") return "pending"
  return outcome
}

function checkoutRelease() {
  return (
    process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || null
  )
}

function browserFamily(): "chrome" | "safari" | "firefox" | "edge" | "other" | "unknown" {
  if (typeof navigator === "undefined") return "unknown"
  const ua = navigator.userAgent
  if (/Edg\//.test(ua)) return "edge"
  if (/Firefox\//.test(ua)) return "firefox"
  if (/Chrome\//.test(ua) || /CriOS\//.test(ua)) return "chrome"
  if (/Safari\//.test(ua)) return "safari"
  return "other"
}

function viewportClass(): "mobile" | "tablet" | "desktop" | "unknown" {
  if (typeof window === "undefined") return "unknown"
  if (window.innerWidth < 640) return "mobile"
  if (window.innerWidth < 1024) return "tablet"
  return "desktop"
}

function standaloneWebViewHint(): "standalone" | "webview" | "browser" | "unknown" {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "unknown"
  if (window.matchMedia?.("(display-mode: standalone)").matches) return "standalone"
  const ua = navigator.userAgent
  if (/\bInstagram\b|\bFBAN\b|\bFBAV\b|\bLine\//i.test(ua)) return "webview"
  return "browser"
}
