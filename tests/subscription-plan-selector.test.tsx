import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { SubscriptionPlanSelector } from "../src/components/checkout/subscription-plan-selector"
import {
  formatQuizResultReferencePrice,
  PERSONAL_PLAN_LAUNCH_REFERENCE_PRICES,
  QUIZ_RESULT_REFERENCE_PRICES,
} from "../src/components/checkout/plan-reference-prices"
import type { BillingInterval } from "../src/lib/stripe/intervals"
import {
  getStripePricingPlan,
  PERSONAL_PLAN_LAUNCH_PRICING_PLANS,
} from "../src/lib/stripe/pricing-plans"

function renderSelector(
  referencePrices?: typeof QUIZ_RESULT_REFERENCE_PRICES,
  {
    busy = false,
    busyLabel,
  }: {
    busy?: boolean
    busyLabel?: string
  } = {},
) {
  return renderToStaticMarkup(
    <SubscriptionPlanSelector
      busy={busy}
      busyLabel={busyLabel}
      onContinue={() => undefined}
      onSelect={() => undefined}
      referencePrices={referencePrices}
      selectedInterval="quarter"
    />,
  )
}

test("busy selector keeps the CTA focusable while disabling plan changes", () => {
  const html = renderSelector(undefined, {
    busy: true,
    busyLabel: "Zahlungsoptionen werden vorbereitet …",
  })

  assert.equal((html.match(/disabled=""/g) ?? []).length, 3)
  assert.match(html, /aria-disabled="true"/)
  assert.match(html, /role="status"/)
  assert.match(html, /Zahlungsoptionen werden vorbereitet …/)
  assert.doesNotMatch(html, />Jetzt starten — €34,99 im Quartal</)
})

test("idle selector keeps the selected plan action label", () => {
  const html = renderSelector()

  assert.match(html, />Jetzt starten — €34,99 im Quartal</)
  assert.doesNotMatch(html, /disabled=""/)
  assert.doesNotMatch(html, /aria-disabled="true"/)
})

test("selector exposes stable motion hooks without changing selected plan layout", () => {
  const html = renderSelector(QUIZ_RESULT_REFERENCE_PRICES)
  const selectorSource = readFileSync(
    new URL("../src/components/checkout/subscription-plan-selector.tsx", import.meta.url),
    "utf8",
  )

  assert.equal((html.match(/data-offer-plan-card=/g) ?? []).length, 3)
  assert.equal((html.match(/data-offer-plan-selected="true"/g) ?? []).length, 1)
  assert.equal((html.match(/data-offer-plan-radio=/g) ?? []).length, 3)
  assert.equal((html.match(/data-offer-plan-price=/g) ?? []).length, 3)
  assert.match(html, /data-offer-selected-price="€34,99"/)
  assert.match(html, /data-offer-cta-label="Jetzt starten — €34,99 im Quartal"/)
  assert.match(html, /data-offer-plan-cta-content/)
  assert.match(selectorSource, /key=\{busy \? "busy" : selectedInterval\}/)
  assert.match(selectorSource, /personal-plan-pricing-cta-content/)
})

test("quiz-result selector displays the three reference prices as comparison prices", () => {
  const html = renderSelector(QUIZ_RESULT_REFERENCE_PRICES)

  assert.equal((html.match(/Vergleichspreis/g) ?? []).length, 3)
  assert.deepEqual(
    Array.from(html.matchAll(/<s[^>]*>([^<]+)<\/s>/g), ([, label]) => label),
    Object.values(QUIZ_RESULT_REFERENCE_PRICES).map(formatQuizResultReferencePrice),
  )
})

test("quiz-result selector highlights the minimum discount above the plans", () => {
  const html = renderSelector(QUIZ_RESULT_REFERENCE_PRICES)

  assert.equal((html.match(/JETZT MIND\. 20 % RABATT SICHERN/g) ?? []).length, 1)
  assert.equal((html.match(/Jetzt mindestens 20 Prozent Rabatt sichern/g) ?? []).length, 1)
})

test("quiz-result reference prices use the approved readable styling", () => {
  const html = renderSelector(QUIZ_RESULT_REFERENCE_PRICES)

  assert.equal(
    (html.match(/class="text-\[14px\] font-medium leading-none text-muted-foreground"/g) ?? [])
      .length,
    3,
  )
})

test("selector without reference prices does not render comparison prices", () => {
  const html = renderSelector()

  assert.doesNotMatch(html, /<s[\s>]/)
  assert.doesNotMatch(html, /Vergleichspreis/)
  assert.doesNotMatch(html, /JETZT MIND\. 20 % RABATT SICHERN/)
  assert.doesNotMatch(html, /Jetzt mindestens 20 Prozent Rabatt sichern/)
  for (const amount of Object.values(QUIZ_RESULT_REFERENCE_PRICES)) {
    assert.doesNotMatch(html, new RegExp(formatQuizResultReferencePrice(amount)))
  }
})

test("personal-plan launch selector renders approved launch prices and retention copy", () => {
  const html = renderToStaticMarkup(
    <SubscriptionPlanSelector
      onContinue={() => undefined}
      onSelect={() => undefined}
      pricingCatalog="personal_plan_launch_v1"
      referencePrices={PERSONAL_PLAN_LAUNCH_REFERENCE_PRICES}
      selectedInterval="quarter"
    />,
  )

  assert.match(html, /Launch-Rabatt sichern/)
  assert.match(html, /Dein Launch-Preis bleibt bis zur Kündigung erhalten\./)
  assert.match(html, /Jetzt starten — €19,99 im Quartal/)
  assert.match(html, /~€6,66 \/ Monat · 33% sparen/)
  assert.match(html, /~€5,83 \/ Monat · 42% sparen/)
  assert.deepEqual(
    Array.from(html.matchAll(/<s[^>]*>([^<]+)<\/s>/g), ([, label]) => label),
    Object.values(PERSONAL_PLAN_LAUNCH_REFERENCE_PRICES).map(formatQuizResultReferencePrice),
  )
})

test("launch catalog retains exact plans while standard callers retain the standard catalog", () => {
  assert.deepEqual(
    PERSONAL_PLAN_LAUNCH_PRICING_PLANS.map(({ amount, interval, perMonth, savings }) => ({
      amount,
      interval,
      perMonth,
      savings,
    })),
    [
      { amount: 9.99, interval: "month", perMonth: "/ Monat", savings: undefined },
      { amount: 19.99, interval: "quarter", perMonth: "~€6,66 / Monat", savings: "33% sparen" },
      { amount: 69.99, interval: "year", perMonth: "~€5,83 / Monat", savings: "42% sparen" },
    ],
  )
  assert.equal(getStripePricingPlan("quarter").amount, 34.99)
  assert.equal(getStripePricingPlan("quarter", "personal_plan_launch_v1").amount, 19.99)
})

test("each quiz-result reference price keeps the advertised minimum 20 percent discount", () => {
  for (const [interval, referencePrice] of Object.entries(QUIZ_RESULT_REFERENCE_PRICES)) {
    const checkoutPrice = getStripePricingPlan(interval as BillingInterval).amount
    const discount = (referencePrice - checkoutPrice) / referencePrice

    assert.ok(discount >= 0.2, `${interval} discount must remain at or above 20 percent`)
  }
})

test("membership reactivation keeps the standard selector without quiz-result reference prices", () => {
  const reactivationCheckoutSource = readFileSync(
    new URL("../src/components/reactivation/membership-reactivation-checkout.tsx", import.meta.url),
    "utf8",
  )

  assert.doesNotMatch(reactivationCheckoutSource, /referencePrices/)
  assert.doesNotMatch(reactivationCheckoutSource, /QUIZ_RESULT_REFERENCE_PRICES/)
})
