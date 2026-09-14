import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { TrialOffer, type TrialOfferPricing } from "../src/components/billing/trial-offer"
import { ScannerTrialOffer } from "../src/components/billing/scanner-trial-offer"

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

test("scanner presentation uses the controlled selection and only the compact tariff layout", () => {
  const selected: string[] = []
  const offer = ScannerTrialOffer({
    onContinue: () => {},
    onSelect: (interval) => selected.push(interval),
    pricing,
    selectedInterval: "year",
  })

  assert.equal(
    findByDataAttribute(offer, "data-trial-offer-plan", "year").props["aria-pressed"],
    true,
  )
  ;(findByDataAttribute(offer, "data-trial-offer-plan", "month").props.onClick as () => void)()
  assert.deepEqual(selected, ["month"])

  const html = renderToStaticMarkup(offer)
  assert.match(html, /69,99.*im ersten Jahr/i)
  assert.match(html, /danach 99,99.*Jahr/i)
  assert.match(html, /Karte oder PayPal zum Teststart erforderlich/i)
  assert.doesNotMatch(html, /spare \d+|trial-scanner\.webp|Teste chaarlie/i)
})

test("scanner presentation propagates pending state and selected dynamic monthly terms", () => {
  let continued = 0
  const pending = ScannerTrialOffer({
    onContinue: () => continued++,
    onSelect: () => {},
    pending: true,
    pricing,
    selectedInterval: "month",
  })
  const button = findByDataAttribute(pending, "data-trial-offer-continue", "")
  assert.equal(button.props.disabled, true)
  ;(button.props.onClick as () => void)()
  assert.equal(continued, 0)
  assert.match(renderToStaticMarkup(pending), /dann 9,99.*Monat/i)

  assert.match(
    renderToStaticMarkup(
      <TrialOffer
        onContinue={() => {}}
        onSelect={() => {}}
        presentation="scanner"
        pricing={pricing}
        selectedInterval="month"
      />,
    ),
    /dann 9,99.*Monat/i,
  )
})
