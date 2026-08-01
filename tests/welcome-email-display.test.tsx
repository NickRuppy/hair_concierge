import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const welcomePageSource = readFileSync(
  new URL("../src/app/welcome/page.tsx", import.meta.url),
  "utf8",
)
const welcomeClientSource = readFileSync(
  new URL("../src/app/welcome/welcome-client.tsx", import.meta.url),
  "utf8",
)
const checkoutReturnAnalyticsSource = readFileSync(
  new URL("../src/app/welcome/checkout-return-analytics.tsx", import.meta.url),
  "utf8",
)

test("PayPal welcome passes Chaarlie and provider subscriber emails separately", () => {
  assert.match(welcomePageSource, /email=\{activation\.email\}/)
  assert.match(welcomePageSource, /providerSubscriberEmail=\{activation\.providerSubscriberEmail\}/)
})

test("PayPal welcome uses a hashed analytics id instead of the activation token", () => {
  assert.match(welcomePageSource, /function paypalCheckoutAnalyticsId/)
  assert.match(welcomePageSource, /createHash\("sha256"\)\.update\(token\)/)
  assert.match(welcomePageSource, /analyticsId=\{paypalCheckoutAnalyticsId\(token\)\}/)
  assert.doesNotMatch(welcomeClientSource, /`paypal:\$\{source\.token\}`/)
  assert.match(welcomeClientSource, /return "paypal:checkout"/)
})

test("PayPal pending polling depends on the stable token instead of the activationSource object", () => {
  assert.match(welcomeClientSource, /const paypalActivationToken =/)
  assert.match(
    welcomeClientSource,
    /!isOneTimePurchase && activationSource\.provider === "paypal" \? activationSource\.token : null/,
  )
  assert.match(welcomeClientSource, /\}, \[mode, paypalActivationToken\]\)/)
  assert.doesNotMatch(welcomeClientSource, /\}, \[activationSource, mode\]\)/)
})

test("welcome labels the account email as Chaarlie-E-Mail", () => {
  assert.match(welcomeClientSource, /Chaarlie-E-Mail/)
  assert.doesNotMatch(welcomeClientSource, /E-Mail aus deinem Checkout/)
})

test("welcome only shows PayPal-E-Mail when it differs from Chaarlie email", () => {
  assert.match(welcomeClientSource, /providerSubscriberEmail\?: string \| null/)
  assert.match(welcomeClientSource, /const showProviderSubscriberEmail =/)
  assert.match(
    welcomeClientSource,
    /providerSubscriberEmail\?\.trim\(\)\.toLowerCase\(\) !== email\?\.trim\(\)\.toLowerCase\(\)/,
  )
  assert.match(welcomeClientSource, /PayPal-E-Mail/)
})

test("one-time welcome recovery selects the order activator and neutral access copy", () => {
  assert.match(welcomePageSource, /purchase === "one_time"/)
  assert.match(welcomePageSource, /renderPayPalOneTimeWelcome/)
  assert.match(welcomePageSource, /recoverPayPalOrderActivation/)
  assert.match(welcomePageSource, /ensureOneTimeCheckoutAccount/)
  assert.match(welcomeClientSource, /Zugang einrichten/)
  assert.match(welcomeClientSource, /Zugang bereits vorhanden/)
  assert.match(welcomeClientSource, /purchase: "one_time"/)
})

test("one-time pending polls the provider-neutral activation status route", () => {
  assert.match(welcomeClientSource, /function oneTimeActivationStatusRequestUrl/)
  assert.match(
    welcomeClientSource,
    /\/api\/billing\/one-time-activation-status\?\$\{params\.toString\(\)\}/,
  )
  assert.match(welcomeClientSource, /new URLSearchParams\(\{ provider: source\.provider \}\)/)
  assert.match(welcomeClientSource, /params\.set\("session_id", source\.sessionId\)/)
  assert.match(welcomeClientSource, /params\.set\("token", source\.token\)/)
})

test("Stripe one-time welcome renders paid-pending instead of activation choices", () => {
  assert.match(welcomePageSource, /account\.state !== "active"/)
  assert.match(welcomePageSource, /mode="pending"/)
  assert.match(welcomePageSource, /purchaseKind: "one_time"/)
})

test("one-time activation errors render a safe support or revoked state instead of repricing", () => {
  const stripeStart = welcomePageSource.indexOf("if (isOneTimePurchase)")
  const subscriptionStart = welcomePageSource.indexOf(
    "if (user?.email?.toLowerCase() === email.toLowerCase())",
    stripeStart,
  )
  const stripeOneTimeBranch = welcomePageSource.slice(stripeStart, subscriptionStart)
  const paypalStart = welcomePageSource.indexOf("async function renderPayPalOneTimeWelcome")
  const paypalEnd = welcomePageSource.indexOf("async function renderPayPalWelcome", paypalStart)
  const paypalOneTimeBranch = welcomePageSource.slice(paypalStart, paypalEnd)

  assert.match(stripeOneTimeBranch, /await ensureOneTimeCheckoutAccount/)
  assert.match(stripeOneTimeBranch, /catch \(err\)/)
  assert.match(stripeOneTimeBranch, /oneTimeReturnState=\{oneTimeReturnStateFromError\(err\)\}/)
  assert.match(welcomePageSource, /checkout_one_time_charge_revoked/)
  assert.doesNotMatch(stripeOneTimeBranch, /redirect\("\/pricing"\)/)
  assert.doesNotMatch(stripeOneTimeBranch, /throw err/)
  assert.match(paypalOneTimeBranch, /await recoverPayPalOrderActivation/)
  assert.match(paypalOneTimeBranch, /oneTimeReturnState="support_needed"/)
  assert.doesNotMatch(paypalOneTimeBranch, /redirect\("\/pricing"\)/)
  assert.doesNotMatch(paypalOneTimeBranch, /throw err/)
  assert.match(welcomeClientSource, /ONE_TIME_RETURN_REVOKED_BODY/)
  assert.match(welcomeClientSource, /ONE_TIME_RETURN_SUPPORT_BODY/)
  assert.doesNotMatch(welcomeClientSource, /href="\/pricing"/)
  assert.doesNotMatch(welcomeClientSource, /Erneut kaufen/)
})

test("paid Stripe checkout_one_time_invalid verification failures recover to pending support instead of pricing", () => {
  const verificationStart = welcomePageSource.indexOf(
    "session = await verifyCheckoutSessionForActivation(session_id, stripe)",
  )
  const verificationEnd = welcomePageSource.indexOf(
    "\n  const email = session.customer_details?.email",
    verificationStart,
  )
  const verificationBranch = welcomePageSource.slice(verificationStart, verificationEnd)

  assert.ok(verificationStart >= 0)
  assert.match(verificationBranch, /stripe\.checkout\.sessions\.retrieve\(session_id\)/)
  assert.match(verificationBranch, /recoveredSession\?\.mode === "payment"/)
  assert.match(verificationBranch, /recoveredSession\.payment_status === "paid"/)
  assert.match(verificationBranch, /purchaseKind: "one_time"/)
  assert.match(verificationBranch, /mode="pending"/)
  assert.match(verificationBranch, /oneTimeReturnState=\{oneTimeReturnStateFromError\(err\)\}/)
  assert.ok(
    verificationBranch.indexOf('recoveredSession?.mode === "payment"') <
      verificationBranch.indexOf('redirect("/pricing")'),
  )
})

test("a paid Stripe verification failure preserves the revoked return state", () => {
  assert.match(
    welcomePageSource,
    /oneTimeReturnStateFromError\(error: unknown\): "revoked" \| "support_needed"/,
  )
  assert.match(welcomePageSource, /error\.code === "checkout_one_time_charge_revoked"/)
})

test("unpaid or non-payment Stripe verification failures retain the pricing fallback", () => {
  const verificationStart = welcomePageSource.indexOf(
    "session = await verifyCheckoutSessionForActivation(session_id, stripe)",
  )
  const verificationEnd = welcomePageSource.indexOf(
    "\n  const email = session.customer_details?.email",
    verificationStart,
  )
  const verificationBranch = welcomePageSource.slice(verificationStart, verificationEnd)

  assert.match(
    verificationBranch,
    /recoveredSession\?\.mode === "payment" && recoveredSession\.payment_status === "paid"/,
  )
  assert.match(verificationBranch, /redirect\("\/pricing"\)/)
})

test("PayPal one-time pending and revoked returns do not require an account", () => {
  const oneTimeWelcomeStart = welcomePageSource.indexOf("async function renderPayPalOneTimeWelcome")
  const nonActiveBranch = welcomePageSource.indexOf(
    'if (activation.status !== "active")',
    oneTimeWelcomeStart,
  )
  const accountRead = welcomePageSource.indexOf(
    "const account = activation.account",
    oneTimeWelcomeStart,
  )

  assert.ok(oneTimeWelcomeStart >= 0)
  assert.ok(nonActiveBranch > oneTimeWelcomeStart)
  assert.ok(accountRead > nonActiveBranch)
  assert.match(welcomePageSource, /intent\.lead_id/)
  assert.match(welcomePageSource, /mode="pending"/)
})

test("one-time pending accepts pending states, reloads active, and blocks permanent states", () => {
  assert.match(welcomeClientSource, /status === "active"/)
  assert.match(welcomeClientSource, /status === "paid_pending" \|\| status === "pending"/)
  assert.match(welcomeClientSource, /status === "revoked"/)
  assert.match(welcomeClientSource, /failed_permanent/)
  assert.match(welcomeClientSource, /permanent_failure/)
  assert.match(welcomeClientSource, /window\.location\.reload\(\)/)
})

test("one-time support-needed returns can poll again while revoked stays support-only", () => {
  assert.match(
    welcomeClientSource,
    /const oneTimePollingBlockedByReturnState = oneTimeReturnState === "revoked"/,
  )
  assert.match(welcomeClientSource, /\|\|\s*oneTimePollingBlockedByReturnState/)
  assert.doesNotMatch(welcomeClientSource, /\|\|\s*oneTimeReturnState\s*\)\s*return/)
  assert.match(
    welcomeClientSource,
    /\}, \[[\s\S]*oneTimePendingCheck,[\s\S]*oneTimePollingBlockedByReturnState,[\s\S]*\]\)/,
  )
  assert.match(
    welcomeClientSource,
    /const canRetryOneTimeStatus = oneTimePendingState !== "revoked"/,
  )
  assert.match(welcomeClientSource, /\{canRetryOneTimeStatus \? \(/)
  assert.match(welcomeClientSource, /onClick=\{\(\) => setOneTimePendingCheck/)
  assert.match(welcomeClientSource, /Support kontaktieren/)
})

test("one-time pending timeout is support-safe and never offers repurchase", () => {
  assert.match(welcomeClientSource, /Das dauert gerade länger als erwartet/)
  assert.match(
    welcomeClientSource,
    /Deine Zahlung ist sicher erfasst – du wirst nicht erneut belastet\. Wir senden dir eine E-Mail, sobald dein Zugang bereit ist\./,
  )
  assert.match(welcomeClientSource, /Status erneut prüfen/)
  assert.match(welcomeClientSource, /Support kontaktieren/)
  assert.doesNotMatch(welcomeClientSource, /href="\/pricing"/)
  assert.doesNotMatch(welcomeClientSource, /Erneut kaufen/)
})

test("one-time pending renders the approved calm copy and progress labels", () => {
  assert.match(welcomeClientSource, /Zahlung bestätigt/)
  assert.match(welcomeClientSource, /Wir schließen deinen Zugang ab/)
  assert.match(
    welcomeClientSource,
    /Deine Zahlung ist sicher erfasst\. Wir senden dir gleich die Bestätigung und öffnen anschließend deinen persönlichen Haarplan\./,
  )
  assert.match(welcomeClientSource, /Bestätigung wird gesendet/)
  assert.match(welcomeClientSource, /Zugang wird geöffnet/)
})

test("checkout return analytics does not emit completion events without server purchase truth", () => {
  assert.match(
    checkoutReturnAnalyticsSource,
    /return purchaseKind !== "one_time" && !sessionId\.startsWith\("paypal:"\)/,
  )
  assert.match(checkoutReturnAnalyticsSource, /if \(purchase\) \{/)
})
