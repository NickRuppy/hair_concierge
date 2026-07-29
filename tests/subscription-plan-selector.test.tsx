import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { SubscriptionPlanSelector } from "../src/components/checkout/subscription-plan-selector"
import {
  formatQuizResultReferencePrice,
  QUIZ_RESULT_REFERENCE_PRICES,
} from "../src/components/checkout/plan-reference-prices"
import type { BillingInterval } from "../src/lib/stripe/intervals"
import { getStripePricingPlan } from "../src/lib/stripe/pricing-plans"

function renderSelector(referencePrices?: typeof QUIZ_RESULT_REFERENCE_PRICES) {
  return renderToStaticMarkup(
    <SubscriptionPlanSelector
      onContinue={() => undefined}
      onSelect={() => undefined}
      referencePrices={referencePrices}
      selectedInterval="quarter"
    />,
  )
}

test("quiz-result selector displays the three reference prices as comparison prices", () => {
  const html = renderSelector(QUIZ_RESULT_REFERENCE_PRICES)

  assert.equal((html.match(/Vergleichspreis/g) ?? []).length, 3)
  assert.deepEqual(
    Array.from(html.matchAll(/<s[^>]*>([^<]+)<\/s>/g), ([, label]) => label),
    Object.values(QUIZ_RESULT_REFERENCE_PRICES).map(formatQuizResultReferencePrice),
  )
})

test("selector without reference prices does not render comparison prices", () => {
  const html = renderSelector()

  assert.doesNotMatch(html, /<s[\s>]/)
  assert.doesNotMatch(html, /Vergleichspreis/)
  for (const amount of Object.values(QUIZ_RESULT_REFERENCE_PRICES)) {
    assert.doesNotMatch(html, new RegExp(formatQuizResultReferencePrice(amount)))
  }
})

test("each quiz-result reference price remains above its current checkout price", () => {
  for (const [interval, referencePrice] of Object.entries(QUIZ_RESULT_REFERENCE_PRICES)) {
    assert.ok(
      referencePrice > getStripePricingPlan(interval as BillingInterval).amount,
      `${interval} reference price must exceed its current checkout price`,
    )
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
