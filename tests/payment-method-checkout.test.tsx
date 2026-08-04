import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import {
  createPaymentMethodCheckoutState,
  PaymentMethodCheckout,
  paymentMethodCheckoutReducer,
} from "../src/components/checkout/payment-method-checkout"
import { buildPayPalWelcomeUrl } from "../src/components/checkout/paypal-subscription-button"
import {
  createCheckoutWatchdog,
  createCheckoutWatchdogRegistry,
} from "../src/lib/observability/checkout-watchdog"
import { reportPayPalScriptFailureOnce } from "../src/components/checkout/paypal-script-failure"
import { customerIoDestination } from "../src/lib/analytics/destinations/customerio"
import {
  clearCustomerIoBrowserClient,
  setCustomerIoBrowserClient,
} from "../src/lib/customerio-tracking"

const paypalSubscriptionButtonSource = readFileSync(
  new URL("../src/components/checkout/paypal-subscription-button.tsx", import.meta.url),
  "utf8",
)

function renderCheckout(
  paypalEnabled: boolean,
  presentation: "default" | "offer-overlay" = "default",
  expressElementsEnabled = false,
) {
  const previousPayPalEnabled = process.env.NEXT_PUBLIC_PAYPAL_ENABLED
  const previousPayPalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
  const previousPayPalPlanId = process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID_QUARTERLY

  process.env.NEXT_PUBLIC_PAYPAL_ENABLED = paypalEnabled ? "true" : "false"
  process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID = "test-paypal-client-id"
  process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID_QUARTERLY = "paypal-quarter-plan"

  try {
    return renderToStaticMarkup(
      <PaymentMethodCheckout
        checkoutKey="quarter"
        fetchClientSecret={async () => "cs_test_secret"}
        interval="quarter"
        leadId="lead-123"
        onChangePlan={() => undefined}
        onPayPalCheckoutStarted={() => undefined}
        onRetry={() => undefined}
        planLabel="Jetzt starten — €34,99 im Quartal"
        presentation={presentation}
        expressElementsEnabled={expressElementsEnabled}
        source="quiz_result_offer"
        stripe={Promise.resolve(null)}
      />,
    )
  } finally {
    if (previousPayPalEnabled === undefined) {
      delete process.env.NEXT_PUBLIC_PAYPAL_ENABLED
    } else {
      process.env.NEXT_PUBLIC_PAYPAL_ENABLED = previousPayPalEnabled
    }

    if (previousPayPalClientId === undefined) {
      delete process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
    } else {
      process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID = previousPayPalClientId
    }

    if (previousPayPalPlanId === undefined) {
      delete process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID_QUARTERLY
    } else {
      process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID_QUARTERLY = previousPayPalPlanId
    }
  }
}

test("PayPal enabled checkout renders express PayPal first and keeps card checkout collapsed", () => {
  const html = renderCheckout(true)

  assert.match(html, /Sicher bezahlen/)
  assert.match(html, /Jetzt starten — €34,99 im Quartal/)
  assert.match(html, /PayPal öffnet sich zur Bestätigung\. Danach aktivieren wir dein Konto\./)
  assert.match(html, />oder</)
  assert.match(html, /Karte &amp; weitere/)
  assert.match(html, /Im sicheren Checkout siehst du alle verfügbaren Zahlungsarten\./)
  assert.doesNotMatch(html, /SEPA/)
  assert.doesNotMatch(html, /Karte \/ SEPA/)
  assert.match(html, /aria-expanded="false"/)
  assert.doesNotMatch(html, /min-h-\[560px\]|min-h-\[600px\]/)
  assert.doesNotMatch(html, /Stripe|native|nativ integriert|über Stripe|keine doppelte Zahlung/i)
  assert.doesNotMatch(html, /bezahlt bis|paid-through|Kündigung/i)
})

test("PayPal disabled checkout preserves the immediate Stripe checkout surface", () => {
  const html = renderCheckout(false)

  assert.match(html, /Sicher bezahlen/)
  assert.match(html, /Jetzt starten — €34,99 im Quartal/)
  assert.doesNotMatch(html, /PayPal öffnet sich zur Bestätigung/)
  assert.doesNotMatch(html, />oder</)
  assert.doesNotMatch(html, /SEPA/)
  assert.doesNotMatch(html, /Karte \/ SEPA/)
  assert.doesNotMatch(html, /Im sicheren Checkout siehst du alle verfügbaren Zahlungsarten\./)
  assert.match(html, /min-h-\[560px\]/)
})

test("offer overlay presentation renders PayPal first and opens card checkout by default", () => {
  const html = renderCheckout(true, "offer-overlay")
  const paypalIndex = html.indexOf("PayPal")
  const cardIndex = html.indexOf("Karte &amp; weitere")

  assert.ok(paypalIndex > -1)
  assert.ok(cardIndex > -1)
  assert.ok(paypalIndex < cardIndex)
  assert.match(html, /min-h-\[560px\]/)
  assert.match(html, /Sicher bezahlen/)
  assert.doesNotMatch(html, /Jetzt starten — €34,99 im Quartal/)
  assert.doesNotMatch(html, /aria-expanded="false"/)
  assert.doesNotMatch(html, /Im sicheren Checkout siehst du alle verfügbaren Zahlungsarten\./)
  assert.doesNotMatch(html, /mt-5 rounded-\[16px\] border border-border bg-white p-4/)
})

test("offer overlay express path renders withdrawal link and direct fallback without reveal click", () => {
  const html = renderCheckout(true, "offer-overlay", true)
  const noticeIndex = html.indexOf("Es gilt das gesetzliche 14-tägige Widerrufsrecht.")
  const appleIndex = html.indexOf('data-offer-payment-element="apple_pay"')
  const paypalIndex = html.indexOf('data-offer-payment-step="paypal"')
  const cardIndex = html.indexOf("Karte &amp; weitere")

  assert.match(html, /Es gilt das gesetzliche 14-tägige Widerrufsrecht\./)
  assert.match(html, /href="\/widerruf"/)
  assert.ok(noticeIndex > -1)
  assert.ok(appleIndex > noticeIndex)
  assert.ok(paypalIndex > -1)
  assert.ok(paypalIndex > appleIndex)
  assert.ok(cardIndex > -1)
  assert.ok(cardIndex > paypalIndex)
  assert.doesNotMatch(html, /aria-expanded="false"/)
  assert.doesNotMatch(html, /Im sicheren Checkout siehst du alle verfügbaren Zahlungsarten\./)
  assert.doesNotMatch(html, /min-h-\[560px\]|min-h-\[600px\]/)
  assert.match(html, /data-offer-payment-option="paypal"/)
})

test("offer overlay no longer threads prepared-session synchronization into Stripe Checkout Elements", () => {
  const source = readFileSync(
    new URL("../src/components/checkout/payment-method-checkout.tsx", import.meta.url),
    "utf8",
  )

  assert.doesNotMatch(source, /onPreparedCheckoutActivate/)
  assert.doesNotMatch(source, /onPreparedCheckoutSyncFailed/)
  assert.doesNotMatch(source, /onPreparedCheckoutSyncSucceeded/)
  assert.doesNotMatch(source, /preparedCheckoutId/)
  assert.match(
    source,
    /<StripeOfferElementsCheckout[\s\S]*onBeforeConfirm=\{onBeforeStripeConfirm\}/,
  )
})

test("payment-method checkout forwards lifecycle seams to truthful Stripe and PayPal callbacks", () => {
  const source = readFileSync(
    new URL("../src/components/checkout/payment-method-checkout.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /onClientMounted\?: OfferCheckoutProviderLifecycleCallback/)
  assert.match(source, /onProviderReady\?: OfferCheckoutProviderLifecycleCallback/)
  assert.match(source, /onConfirmStarted\?: OfferCheckoutProviderLifecycleCallback/)
  assert.match(
    source,
    /<DynamicPayPalSubscriptionButton[\s\S]*?onClientMounted=\{\(\) => onClientMounted\?\.\("paypal", "paypal"\)\}[\s\S]*?onReady=\{\(\) => \{[\s\S]*?onProviderReady\?\.\("paypal", "paypal"\)/,
  )
  assert.match(
    source,
    /<StripeOfferElementsCheckout[\s\S]*?onClientMounted=\{onClientMounted\}[\s\S]*?onConfirmStarted=\{onConfirmStarted\}[\s\S]*?onProviderReady=\{onProviderReady\}/,
  )
  assert.match(paypalSubscriptionButtonSource, /onClientMounted\?: \(\) => void/)
  assert.match(paypalSubscriptionButtonSource, /onConfirmStarted\?: \(\) => void/)
  const paypalInit = paypalSubscriptionButtonSource.indexOf("onInit={() => {")
  const paypalMounted = paypalSubscriptionButtonSource.indexOf("onClientMounted?.()", paypalInit)
  const paypalReady = paypalSubscriptionButtonSource.indexOf("onReady?.()", paypalInit)
  assert.ok(paypalInit > -1)
  assert.ok(paypalMounted > paypalInit)
  assert.ok(paypalReady > paypalMounted)
  const confirmStarted = paypalSubscriptionButtonSource.indexOf("onConfirmStarted?.()")
  const providerCall = paypalSubscriptionButtonSource.indexOf("createSubscriptionIntent({")
  assert.ok(confirmStarted > -1)
  assert.ok(providerCall > confirmStarted)
})

test("PayPal script rejection reports once without coupling the card fallback", () => {
  const reported = { current: false }
  const failures: unknown[] = []
  let paymentState = createPaymentMethodCheckoutState(true)

  assert.deepEqual(paymentState, { cardCheckoutOpen: false })
  assert.equal(
    reportPayPalScriptFailureOnce(reported, false, (failure) => failures.push(failure)),
    false,
  )
  assert.equal(
    reportPayPalScriptFailureOnce(reported, true, (failure) => failures.push(failure)),
    true,
  )
  assert.equal(
    reportPayPalScriptFailureOnce(reported, true, (failure) => failures.push(failure)),
    false,
  )
  assert.deepEqual(failures, [
    {
      errorCode: "paypal_js_load_failed",
      failureStage: "provider_session",
      retryable: true,
    },
  ])

  assert.deepEqual(paymentState, { cardCheckoutOpen: false })
  paymentState = paymentMethodCheckoutReducer(paymentState, "reveal_card")
  assert.deepEqual(paymentState, { cardCheckoutOpen: true })
})

test("PayPal checkout watchdog reports one stalled operation without changing its later outcome", () => {
  let scheduled: (() => void) | undefined
  const reports: number[] = []
  const watchdog = createCheckoutWatchdog({
    onTimeout: (durationMs) => reports.push(durationMs),
    schedule: (callback) => {
      scheduled = callback
      return 0 as unknown as ReturnType<typeof globalThis.setTimeout>
    },
  })

  assert.ok(scheduled)
  scheduled?.()
  scheduled?.()
  assert.equal(reports.length, 1)
  // Settling after the signal is intentionally non-invasive: provider work can still finish.
  watchdog.settle()
  assert.equal(reports.length, 1)
})

test("hidden PayPal checkout settles active watchdogs and reopening can track a fresh one", () => {
  const scheduled: Array<() => void> = []
  const reports: string[] = []
  const registry = createCheckoutWatchdogRegistry()
  const createTrackedWatchdog = (label: string) =>
    registry.track(
      createCheckoutWatchdog({
        onTimeout: () => reports.push(label),
        schedule: (callback) => {
          scheduled.push(callback)
          return 0 as unknown as ReturnType<typeof globalThis.setTimeout>
        },
      }),
    )

  createTrackedWatchdog("hidden")
  registry.settleAll()
  scheduled[0]?.()
  assert.deepEqual(reports, [])

  createTrackedWatchdog("reopened")
  scheduled[1]?.()
  assert.deepEqual(reports, ["reopened"])
})

test("PayPal subscription button reports visible payment failures once and excludes control flow", () => {
  assert.match(paypalSubscriptionButtonSource, /usePaymentRuntime/)
  assert.match(paypalSubscriptionButtonSource, /useOfferTrackingContext/)
  assert.match(paypalSubscriptionButtonSource, /capturePayPalSubscriptionCustomerPaymentError/)
  assert.match(paypalSubscriptionButtonSource, /signal = "customer_payment_error_observed"/)
  assert.match(paypalSubscriptionButtonSource, /provider: "paypal"/)
  assert.match(paypalSubscriptionButtonSource, /commerceKind: "subscription"/)
  assert.match(paypalSubscriptionButtonSource, /origin: "browser"/)
  assert.match(paypalSubscriptionButtonSource, /method: "paypal"/)
  assert.match(paypalSubscriptionButtonSource, /truth: "unknown"/)
  assert.match(paypalSubscriptionButtonSource, /live: paypalLive/)
  assert.match(paypalSubscriptionButtonSource, /isInternalTest/)
  assert.doesNotMatch(paypalSubscriptionButtonSource, /captureCheckoutException/)

  const createSubscriptionSource = paypalSubscriptionButtonSource.slice(
    paypalSubscriptionButtonSource.indexOf("createSubscription={async"),
    paypalSubscriptionButtonSource.indexOf("onApprove={async"),
  )
  assert.match(
    createSubscriptionSource,
    /if \(onPaymentMethodSelected\?\.\("paypal"\) === false\) \{[\s\S]*suppressNextPayPalErrorRef\.current = true[\s\S]*another payment provider is already active/,
  )
  assert.match(
    createSubscriptionSource,
    /err instanceof CheckoutAccessAlreadyExistsError[\s\S]*suppressNextPayPalErrorRef\.current = true[\s\S]*errorCode: "access_already_exists"/,
  )
  assert.match(createSubscriptionSource, /stage: "paypal_create_subscription_intent"/)
  assert.match(createSubscriptionSource, /status: "intent_failed"/)
  assert.match(createSubscriptionSource, /stage: "paypal_create_subscription"/)
  assert.match(createSubscriptionSource, /status: "subscription_create_failed"/)

  const approveSource = paypalSubscriptionButtonSource.slice(
    paypalSubscriptionButtonSource.indexOf("onApprove={async"),
    paypalSubscriptionButtonSource.indexOf("onCancel={() =>"),
  )
  assert.match(approveSource, /status: "approval_payload_incomplete"/)
  assert.match(approveSource, /status: "approval_request_failed"/)
  assert.match(approveSource, /status: approved\.status/)
  const duplicateApproval = approveSource.slice(
    approveSource.indexOf("if (approved.duplicate)"),
    approveSource.indexOf(
      "capturePayPalSubscriptionCustomerPaymentError",
      approveSource.indexOf("if (approved.duplicate)"),
    ),
  )
  assert.doesNotMatch(duplicateApproval, /capturePayPalSubscriptionCustomerPaymentError/)

  const sdkErrorSource = paypalSubscriptionButtonSource.slice(
    paypalSubscriptionButtonSource.indexOf("onError={() =>"),
    paypalSubscriptionButtonSource.indexOf("style={{"),
  )
  assert.match(
    sdkErrorSource,
    /if \(suppressNextPayPalErrorRef\.current\) \{[\s\S]*suppressNextPayPalErrorRef\.current = false[\s\S]*return/,
  )
  assert.match(sdkErrorSource, /status: "paypal_button_error"/)
  assert.match(sdkErrorSource, /if \(!visibleRef\.current\) return/)
  assert.match(
    paypalSubscriptionButtonSource,
    /if \(!visible\) return[\s\S]*reportPayPalScriptFailureOnce/,
  )
  assert.match(paypalSubscriptionButtonSource, /signal: "checkout_experience_degraded"/)
  assert.match(paypalSubscriptionButtonSource, /status: "paypal_sdk_ready_timeout"/)
  assert.match(
    paypalSubscriptionButtonSource,
    /status: "paypal_create_subscription_intent_timeout"/,
  )
  assert.match(paypalSubscriptionButtonSource, /status: "paypal_approve_subscription_timeout"/)
  assert.match(paypalSubscriptionButtonSource, /transition: "provider_cancelled"/)
})

test("Stripe payment helper copy is only shown before the embedded checkout expands", () => {
  const source = readFileSync(
    new URL("../src/components/checkout/payment-method-checkout.tsx", import.meta.url),
    "utf8",
  )

  assert.match(
    source,
    /aria-describedby=\{!cardCheckoutOpen \? "payment-method-helper" : undefined\}/,
  )
  assert.match(source, /!cardCheckoutOpen \? \(/)
  assert.match(source, /id="payment-method-helper"/)
  assert.match(source, /Im sicheren Checkout siehst du alle verfügbaren Zahlungsarten\./)
})

test("first payment engagement follows provider-lock claims and legacy card reveal", () => {
  const source = readFileSync(
    new URL("../src/components/checkout/payment-method-checkout.tsx", import.meta.url),
    "utf8",
  )
  assert.match(source, /onFirstPaymentEngagement\?: \(\) => void/)
  assert.match(source, /onFirstPaymentEngagement=\{onFirstPaymentEngagement\}/)

  const paypalSelectionStart = source.indexOf("onPaymentMethodSelected={(provider) =>")
  const paypalLockClaim = source.indexOf('onProviderLockClaim?.("paypal")', paypalSelectionStart)
  const paypalEngagement = source.indexOf("onFirstPaymentEngagement?.()", paypalSelectionStart)
  const paypalSelection = source.indexOf(
    "onPaymentMethodSelected?.(provider)",
    paypalSelectionStart,
  )
  assert.ok(paypalSelectionStart > -1)
  assert.ok(paypalLockClaim > paypalSelectionStart)
  assert.ok(paypalEngagement > paypalLockClaim)
  assert.ok(paypalSelection > paypalEngagement)

  const paypalReadyStart = source.indexOf("onReady={() =>", paypalSelectionStart)
  const paypalReadyEnd = source.indexOf("returnDestination=", paypalReadyStart)
  assert.ok(paypalReadyStart > paypalSelection)
  assert.ok(paypalReadyEnd > paypalReadyStart)
  assert.doesNotMatch(source.slice(paypalReadyStart, paypalReadyEnd), /onFirstPaymentEngagement/)

  const legacyCardReveal = source.indexOf("if (!cardCheckoutOpen)")
  const legacyCardEngagement = source.indexOf("onFirstPaymentEngagement?.()", legacyCardReveal)
  const legacyCardSelection = source.indexOf(
    'onPaymentMethodSelected?.("stripe")',
    legacyCardReveal,
  )
  assert.ok(legacyCardReveal > -1)
  assert.ok(legacyCardEngagement > legacyCardReveal)
  assert.ok(legacyCardSelection > legacyCardEngagement)
})

test("PayPal approval redirects to the provider-aware welcome URL", () => {
  assert.equal(
    buildPayPalWelcomeUrl("paypal-token-123"),
    "/welcome?provider=paypal&token=paypal-token-123",
  )
})

test("PayPal plan IDs are resolved by the server intent route", () => {
  const buttonSource = readFileSync(
    new URL("../src/components/checkout/paypal-subscription-button.tsx", import.meta.url),
    "utf8",
  )
  assert.match(buttonSource, /fundingSource=\{FUNDING\.PAYPAL\}/)
  assert.match(buttonSource, /NEXT_PUBLIC_PAYPAL_CLIENT_ID\?\.trim\(\)/)
  assert.doesNotMatch(buttonSource, /PAYPAL_PLAN_ID_/)
  assert.match(buttonSource, /create-subscription-intent/)
  assert.match(buttonSource, /shipping_preference: "NO_SHIPPING"/)
  assert.match(buttonSource, /errorCode: "paypal_approval_network_error"/)
  assert.match(buttonSource, /onCancel=\{\(\) =>/)
  assert.match(buttonSource, /onCheckoutCancelled\?\.\(\)/)
  assert.match(buttonSource, /another payment provider is already active/)
  assert.match(buttonSource, /usePayPalScriptReducer/)
  assert.match(buttonSource, /<PayPalScriptFailureObserver/)
  assert.match(buttonSource, /reportPayPalScriptFailureOnce\(reportedRef, isRejected/)
  assert.match(buttonSource, /errorFamily: "provider_unavailable"[\s\S]*status: failure\.errorCode/)
  assert.match(
    buttonSource,
    /configurationReportedRef\.current = true[\s\S]*status: "paypal_client_id_missing"/,
  )
  assert.match(buttonSource, /onInit=\{\(\) =>/)
  assert.match(buttonSource, /onReady\?\.\(\)/)
  assert.match(buttonSource, /checkoutAttemptId,/)

  const routeSource = readFileSync(
    new URL("../src/app/api/paypal/create-subscription-intent/route.ts", import.meta.url),
    "utf8",
  )
  assert.match(routeSource, /getPayPalPlanId/)
  assert.match(routeSource, /currency: analyticsPlan\.currency/)
  assert.match(routeSource, /plan_id: analyticsPlan\.analyticsId/)
  assert.match(routeSource, /value: analyticsPlan\.amount/)
  assert.match(routeSource, /checkoutAttemptId: z\.string\(\)\.uuid\(\)\.optional\(\)/)
  assert.match(routeSource, /checkout_attempt_id: checkoutAttemptId/)

  const stripeRouteSource = readFileSync(
    new URL("../src/app/api/stripe/create-checkout-session/route.ts", import.meta.url),
    "utf8",
  )
  assert.match(stripeRouteSource, /currency: analyticsPlan\.currency/)
  assert.match(stripeRouteSource, /plan_id: analyticsPlan\.analyticsId/)
  assert.match(stripeRouteSource, /value: analyticsPlan\.amount/)
  assert.match(stripeRouteSource, /checkoutAttemptId: z\.string\(\)\.uuid\(\)\.optional\(\)/)
  assert.match(stripeRouteSource, /checkout_attempt_id: checkoutAttemptId/)
})

test("Cookie banner stacks above PayPal checkout iframes", () => {
  const cookieConsentSource = readFileSync(
    new URL("../src/components/cookie-consent/cookie-consent.tsx", import.meta.url),
    "utf8",
  )

  assert.match(cookieConsentSource, /aria-label="Cookie-Einstellungen"/)
  assert.match(cookieConsentSource, /bannerVisible && !settingsOpen/)
  assert.match(cookieConsentSource, /z-\[100\]/)
  assert.doesNotMatch(cookieConsentSource, /z-40/)
})

test("PayPal approval validates the provider custom id before accepting a bound intent", () => {
  const routeSource = readFileSync(
    new URL("../src/app/api/paypal/approve-subscription/route.ts", import.meta.url),
    "utf8",
  )

  const tokenMismatchIndex = routeSource.indexOf("subscription.custom_id?.trim() !== token")
  const alreadyBoundIndex = routeSource.indexOf(
    "intent.provider_subscription_id === subscription.id",
  )

  assert.ok(tokenMismatchIndex > -1)
  assert.ok(alreadyBoundIndex > -1)
  assert.ok(tokenMismatchIndex < alreadyBoundIndex)
})

test("PayPal approval retries run duplicate checks even for an already-bound intent", () => {
  const routeSource = readFileSync(
    new URL("../src/app/api/paypal/approve-subscription/route.ts", import.meta.url),
    "utf8",
  )

  const alreadyBoundIndex = routeSource.indexOf(
    "intent.provider_subscription_id === subscription.id",
  )
  const duplicateGuardIndex = routeSource.indexOf(
    "findPayPalCheckoutDuplicateReason",
    alreadyBoundIndex,
  )
  const firstOkAfterBoundIndex = routeSource.indexOf(
    "return NextResponse.json({ ok: true, token })",
    alreadyBoundIndex,
  )

  assert.ok(alreadyBoundIndex > -1)
  assert.ok(duplicateGuardIndex > alreadyBoundIndex)
  assert.ok(firstOkAfterBoundIndex > duplicateGuardIndex)
})

test("Customer.io checkout-started payload includes the selected payment provider", () => {
  const calls: unknown[][] = []

  setCustomerIoBrowserClient({
    identify: () => undefined,
    page: () => undefined,
    reset: () => undefined,
    track: (...args: unknown[]) => calls.push(args),
  })

  try {
    assert.equal(
      customerIoDestination.track("checkout_started", {
        funnelPackageKey: "default_organic",
        interval: "quarter",
        leadId: "lead-123",
        provider: "paypal",
        source: "quiz_result_offer",
      }),
      true,
    )

    assert.deepEqual(calls, [
      [
        "checkout_started",
        {
          funnel_package_key: "default_organic",
          interval: "quarter",
          lead_id: "lead-123",
          provider: "paypal",
          source: "quiz_result_offer",
        },
      ],
    ])
  } finally {
    clearCustomerIoBrowserClient()
  }
})
