import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { PaymentMethodCheckout } from "../src/components/checkout/payment-method-checkout"
import { buildPayPalWelcomeUrl } from "../src/components/checkout/paypal-subscription-button"
import { customerIoDestination } from "../src/lib/analytics/destinations/customerio"
import {
  clearCustomerIoBrowserClient,
  setCustomerIoBrowserClient,
} from "../src/lib/customerio-tracking"

function renderCheckout(paypalEnabled: boolean) {
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
        planLabel="Jetzt starten — €17,49 im Quartal"
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
  assert.match(html, /Jetzt starten — €17,49 im Quartal/)
  assert.match(html, /PayPal öffnet sich zur Bestätigung\. Danach aktivieren wir dein Konto\./)
  assert.match(html, />oder</)
  assert.match(html, /Karte \/ SEPA/)
  assert.match(html, /aria-expanded="false"/)
  assert.doesNotMatch(html, /min-h-\[560px\]|min-h-\[600px\]/)
  assert.doesNotMatch(html, /Stripe|native|nativ integriert|über Stripe|keine doppelte Zahlung/i)
  assert.doesNotMatch(html, /bezahlt bis|paid-through|Kündigung/i)
})

test("PayPal disabled checkout preserves the immediate card and SEPA checkout surface", () => {
  const html = renderCheckout(false)

  assert.match(html, /Sicher bezahlen/)
  assert.match(html, /Jetzt starten — €17,49 im Quartal/)
  assert.doesNotMatch(html, /PayPal öffnet sich zur Bestätigung/)
  assert.doesNotMatch(html, />oder</)
  assert.doesNotMatch(html, /Karte \/ SEPA/)
  assert.match(html, /min-h-\[560px\]/)
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

  const routeSource = readFileSync(
    new URL("../src/app/api/paypal/create-subscription-intent/route.ts", import.meta.url),
    "utf8",
  )
  assert.match(routeSource, /getPayPalPlanId/)
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
