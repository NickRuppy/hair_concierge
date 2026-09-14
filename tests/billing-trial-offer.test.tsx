import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
  getTrialOfferPresentation,
  TrialOffer,
  type TrialOfferPricing,
} from "../src/components/billing/trial-offer"
import {
  ResultOfferPricing,
  getMembershipCheckoutSummary,
} from "../src/components/quiz/result-offer-pricing"
import { buildResultCheckoutSessionRequest } from "../src/components/quiz/result-offer-pricing"

type AnyElement = ReactElement<Record<string, unknown>>

function childrenOf(node: ReactNode): ReactNode[] {
  if (!React.isValidElement(node)) return []
  return React.Children.toArray((node as ReactElement<{ children?: ReactNode }>).props.children)
}

function findByDataAttribute(node: ReactNode, attribute: string, value: string): AnyElement {
  if (React.isValidElement(node)) {
    const element = node as AnyElement
    if (element.props[attribute] === value) return element
    for (const child of childrenOf(element)) {
      try {
        return findByDataAttribute(child, attribute, value)
      } catch {
        // Continue into the remaining branch.
      }
    }
  }
  throw new Error(`No element with ${attribute}=${value}`)
}

const pricing: TrialOfferPricing = {
  trialDays: 7,
  monthlyAmountMinor: 999,
  annualFirstAmountMinor: 6999,
  annualRenewalAmountMinor: 9999,
}

test("the composed sticky summary uses trial terms and rejects an unavailable quarterly trial", () => {
  assert.equal(getMembershipCheckoutSummary("year", "standard", pricing).priceLabel, "Heute 0,00 €")
  assert.equal(
    getMembershipCheckoutSummary("month", "standard", pricing).planName,
    "7 Tage kostenlos testen",
  )
  assert.throws(
    () => getMembershipCheckoutSummary("quarter", "standard", pricing),
    /Unsupported trial interval/,
  )
  assert.notEqual(getMembershipCheckoutSummary("year").priceLabel, "Heute 0,00 €")
})

test("the selected interval controls the plan state and emits the requested selection", () => {
  const selected: string[] = []
  const year = TrialOffer({
    onContinue: () => {},
    onSelect: (interval) => selected.push(interval),
    pricing,
    selectedInterval: "year",
  })
  const month = TrialOffer({
    onContinue: () => {},
    onSelect: (interval) => selected.push(interval),
    pricing,
    selectedInterval: "month",
  })

  assert.equal(
    findByDataAttribute(year, "data-trial-offer-plan", "year").props["aria-pressed"],
    true,
  )
  assert.equal(
    findByDataAttribute(year, "data-trial-offer-plan", "month").props["aria-pressed"],
    false,
  )
  assert.equal(
    findByDataAttribute(month, "data-trial-offer-plan", "year").props["aria-pressed"],
    false,
  )
  assert.equal(
    findByDataAttribute(month, "data-trial-offer-plan", "month").props["aria-pressed"],
    true,
  )
  ;(findByDataAttribute(year, "data-trial-offer-plan", "month").props.onClick as () => void)()
  ;(findByDataAttribute(month, "data-trial-offer-plan", "year").props.onClick as () => void)()
  assert.deepEqual(selected, ["month", "year"])
})

test("continue remains controlled and is unavailable while pending or disabled", () => {
  let continues = 0
  const selections: string[] = []
  const active = TrialOffer({
    onContinue: () => continues++,
    onSelect: () => {},
    pricing,
    selectedInterval: "year",
  })
  const pending = TrialOffer({
    onContinue: () => continues++,
    onSelect: (interval) => selections.push(interval),
    pending: true,
    pricing,
    selectedInterval: "year",
  })
  const disabled = TrialOffer({
    disabled: true,
    onContinue: () => continues++,
    onSelect: (interval) => selections.push(interval),
    pricing,
    selectedInterval: "year",
  })

  ;(findByDataAttribute(active, "data-trial-offer-continue", "").props.onClick as () => void)()
  assert.equal(continues, 1)
  assert.equal(findByDataAttribute(pending, "data-trial-offer-continue", "").props.disabled, true)
  assert.equal(findByDataAttribute(disabled, "data-trial-offer-continue", "").props.disabled, true)
  ;(findByDataAttribute(pending, "data-trial-offer-continue", "").props.onClick as () => void)()
  ;(findByDataAttribute(disabled, "data-trial-offer-continue", "").props.onClick as () => void)()
  ;(findByDataAttribute(pending, "data-trial-offer-plan", "month").props.onClick as () => void)()
  ;(findByDataAttribute(disabled, "data-trial-offer-plan", "month").props.onClick as () => void)()
  assert.equal(continues, 1)
  assert.deepEqual(selections, [])
})

test("the displayed terms derive every selected price from the public pricing projection", () => {
  const presentation = getTrialOfferPresentation(pricing)
  assert.deepEqual(presentation, {
    annualFirst: "69,99 €",
    annualMonthlyEquivalent: "5,83 €",
    annualRenewal: "99,99 €",
    annualSavingsPercent: 42,
    hasIntroductoryAnnualPrice: true,
    monthly: "9,99 €",
  })

  const yearHtml = renderToStaticMarkup(
    <TrialOffer
      onContinue={() => {}}
      onSelect={() => {}}
      pricing={pricing}
      selectedInterval="year"
    />,
  )
  const monthHtml = renderToStaticMarkup(
    <TrialOffer
      onContinue={() => {}}
      onSelect={() => {}}
      pricing={pricing}
      selectedInterval="month"
    />,
  )
  assert.match(yearHtml, /7 Tage kostenlos, dann 69,99.* fürs erste Jahr/i)
  assert.match(yearHtml, /Danach 99,99.* jährlich/i)
  assert.match(yearHtml, /5,83.* \/ Monat/i)
  assert.match(monthHtml, /7 Tage kostenlos, dann 9,99.* pro Monat/i)
  assert.doesNotMatch(monthHtml, /Danach 99,99.* jährlich/i)
})

test("a no-coupon annual offer never retains the introductory annual display", () => {
  const noCouponPricing: TrialOfferPricing = {
    ...pricing,
    annualFirstAmountMinor: 9999,
  }
  const presentation = getTrialOfferPresentation(noCouponPricing)
  const html = renderToStaticMarkup(
    <TrialOffer
      onContinue={() => {}}
      onSelect={() => {}}
      pricing={noCouponPricing}
      selectedInterval="year"
    />,
  )

  assert.deepEqual(presentation, {
    annualFirst: "99,99 €",
    annualMonthlyEquivalent: "8,33 €",
    annualRenewal: "99,99 €",
    annualSavingsPercent: 17,
    hasIntroductoryAnnualPrice: false,
    monthly: "9,99 €",
  })
  assert.match(html, /99,99.* pro Jahr/i)
  assert.match(html, /8,33.* \/ Monat/i)
  assert.match(html, /spare 17 %/i)
  assert.match(html, /\*Monatsvergleich bei jährlicher Zahlung\./i)
  assert.doesNotMatch(html, /im ersten Jahr|Danach/i)
  assert.doesNotMatch(html, /69,99/)
})

test("invalid public pricing fails closed instead of rendering misleading terms", () => {
  const invalidPricing: TrialOfferPricing = { ...pricing, monthlyAmountMinor: 0 }

  assert.throws(
    () =>
      renderToStaticMarkup(
        <TrialOffer
          onContinue={() => {}}
          onSelect={() => {}}
          pricing={invalidPricing}
          selectedInterval="year"
        />,
      ),
    /Ungültige Angebotskonditionen/,
  )
})

test("a server-sanitized trial projection replaces legacy result pricing only when supplied", () => {
  const trialHtml = renderToStaticMarkup(
    <ResultOfferPricing
      leadId="11111111-1111-4111-8111-111111111111"
      trialOfferPricing={pricing}
    />,
  )
  const legacyHtml = renderToStaticMarkup(
    <ResultOfferPricing leadId="11111111-1111-4111-8111-111111111111" />,
  )

  assert.match(trialHtml, /Teste chaarlie/i)
  assert.match(trialHtml, /7 Tage kostenlos/i)
  assert.doesNotMatch(trialHtml, /14 Tage Geld-zurück-Garantie/i)
  assert.match(legacyHtml, /14 Tage Geld-zurück-Garantie/i)
  assert.doesNotMatch(legacyHtml, /7 Tage kostenlos/i)
})

test("trial checkout serialization is explicit and cannot inherit a paid attempt", () => {
  const request = buildResultCheckoutSessionRequest({
    checkoutAttemptId: "attempt-trial",
    checkoutSessionAttemptId: "session-trial",
    funnelEventId: "event-trial",
    interval: "year",
    leadId: "11111111-1111-4111-8111-111111111111",
    trial: true,
  })
  assert.deepEqual(request, {
    checkoutAttemptId: "attempt-trial",
    checkoutSessionAttemptId: "session-trial",
    funnelEventId: "event-trial",
    funnelSessionId: undefined,
    interval: "year",
    leadId: "11111111-1111-4111-8111-111111111111",
    source: "quiz_result_offer",
    trial: true,
  })
})
