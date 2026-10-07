import assert from "node:assert/strict"
import test from "node:test"
import type { ComponentType, ReactElement } from "react"
import { ResultPageClient } from "../src/app/result/[leadId]/result-client"
import { ScanRegalOffer } from "../src/components/scan-regal-offer/scan-regal-offer"
import { ScannerRefinedOffer } from "../src/components/scan-regal-offer/scanner-refined-offer"
import type { FunnelOfferVariantProps } from "../src/funnels/types"
import { mountComponent } from "./helpers/react-hook-mount"

const pricing = {
  trialDays: 7,
  monthlyAmountMinor: 999,
  annualFirstAmountMinor: 6999,
  annualRenewalAmountMinor: 9999,
}
const base = {
  leadId: "local-review",
  name: "Nick",
  quizAnswers: { structure: "wavy", thickness: "fine" },
  focusRoutine: false,
  hasAccess: false,
  offerVariant: "scan-regal-v1",
  scannerRefinementEnabled: true,
  trialOfferPricing: pricing,
} as const

test("only the eligible commercial scanner selects both the refined page and compact shared pricing", () => {
  for (const [override, expected] of [
    [{}, true],
    [{ scannerRefinementEnabled: false }, false],
    [{ trialOfferPricing: null }, false],
    [{ offerVariant: "organic-plan-v1" }, false],
    [{ regularFieldTest: { accessDurationHours: 48 } }, false],
    [{ partnerAccess: { activationApiPath: "/api/partner-access/activate" } }, false],
  ] as const) {
    const legacy = ResultPageClient({ ...base, ...override }) as ReactElement<
      Record<string, unknown>
    >
    const Component = legacy.type as (props: Record<string, unknown>) => ReactElement
    const mounted = mountComponent(() => Component(legacy.props))
    const offer = mounted.tree as ReactElement<FunnelOfferVariantProps>
    assert.equal(offer.props.scannerRefinementEnabled, expected)
    assert.equal(
      (offer.props.pricingSlot as ReactElement<{ presentation: string }>).props.presentation,
      expected ? "scanner" : "default",
    )
    if (offer.props.offerVariant === "scan-regal-v1") {
      assert.equal(ScanRegalOffer(offer.props).type === ScannerRefinedOffer, expected)
    }
    mounted.unmount()
  }
})

test("paid and personal-plan routes cannot acquire the scanner refinement", () => {
  const personal = ResultPageClient({ ...base, quizKind: "personal_plan", hasAccess: true })
  assert.notEqual((personal.type as ComponentType).name, "LegacyResultPageClient")
  const legacy = ResultPageClient({ ...base, hasAccess: true }) as ReactElement<
    Record<string, unknown>
  >
  const Component = legacy.type as (props: Record<string, unknown>) => ReactElement
  const mounted = mountComponent(() => Component(legacy.props))
  assert.equal((mounted.tree!.type as ComponentType).name, "QuizResultsView")
  mounted.unmount()
})
