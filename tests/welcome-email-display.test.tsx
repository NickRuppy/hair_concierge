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
