import assert from "node:assert/strict"
import test from "node:test"

import {
  scanAlternativeMetaLine,
  scanCriterionMarker,
  scanDimensionSegments,
  scanDimensionSummary,
  scanFooterActions,
  scanNotNeededSections,
  scanReasonsLabel,
  scanSaveButtonLabel,
  type ScanFooterInput,
} from "../src/lib/scan/result-presentation"
import type { ScanDimension, ScanProductHeader } from "../src/lib/scan/types"

const buyableProduct: ScanProductHeader = {
  productId: "p1",
  name: "Repair Shampoo",
  brand: "Olaplex",
  category: "shampoo",
  categoryLabel: "Shampoo",
  imageUrl: null,
  priceLabel: "24,90 €",
  purchaseUrl: "https://shop.test/a",
}

function footer(overrides: Partial<ScanFooterInput> = {}): ScanFooterInput {
  return {
    kind: "in_catalog",
    verdict: "ideal",
    product: buyableProduct,
    savedState: null,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ footer */

test("footer on a fitting product leads with a priced solid buy button", () => {
  assert.deepEqual(scanFooterActions(footer()), [
    { kind: "buy", label: "Kaufen · 24,90 €", tone: "coral-solid", url: "https://shop.test/a" },
    { kind: "save", label: "Speichern", tone: "plum-outline" },
  ])
})

test("footer drops the price from the buy label when no price is known", () => {
  const actions = scanFooterActions(footer({ product: { ...buyableProduct, priceLabel: null } }))
  assert.equal(actions[0].label, "Kaufen")
})

test("footer on supportive, mismatch and unknown verdicts keeps the buy affordance honest", () => {
  for (const verdict of ["supportive", "mismatch", "unknown"] as const) {
    const actions = scanFooterActions(footer({ verdict }))
    assert.deepEqual(
      actions.map((action) => [action.kind, action.label, action.tone]),
      [
        ["buy", "Trotzdem kaufen", "coral-outline"],
        ["save", "Speichern", "plum-outline"],
      ],
      verdict,
    )
  }
})

test("footer on not_needed leads with a solid save button, buy stays available", () => {
  assert.deepEqual(
    scanFooterActions(footer({ kind: "not_needed", verdict: null })).map((action) => [
      action.kind,
      action.label,
      action.tone,
    ]),
    [
      ["save", "Speichern", "plum-solid"],
      ["buy", "Trotzdem kaufen", "coral-outline"],
    ],
  )
})

test("footer without a purchase url renders save alone instead of a dead buy slot", () => {
  const actions = scanFooterActions(
    footer({ product: { ...buyableProduct, purchaseUrl: null }, verdict: "mismatch" }),
  )
  assert.deepEqual(actions, [{ kind: "save", label: "Speichern", tone: "plum-outline" }])
})

test("footer without a purchase url still leads with the solid save button on not_needed", () => {
  const actions = scanFooterActions(
    footer({
      kind: "not_needed",
      verdict: null,
      product: { ...buyableProduct, purchaseUrl: null },
    }),
  )
  assert.deepEqual(actions, [{ kind: "save", label: "Speichern", tone: "plum-solid" }])
})

test("saved state morphs the save button label", () => {
  assert.equal(scanSaveButtonLabel(null), "Speichern")
  assert.equal(scanSaveButtonLabel("routine"), "✓ In deiner Routine")
  assert.equal(scanSaveButtonLabel("merkliste"), "✓ Gemerkt")
  assert.equal(scanFooterActions(footer({ savedState: "routine" }))[1].label, "✓ In deiner Routine")
})

/* -------------------------------------------------------------- dimensions */

const thickness: ScanDimension = {
  dimensionId: "thickness",
  label: "Geeignete Haardicke",
  stops: [
    { stopId: "fine", label: "Fein" },
    { stopId: "normal", label: "Normal" },
    { stopId: "coarse", label: "Grob" },
  ],
  targetStopIds: ["normal"],
  productStopIds: ["normal", "coarse"],
  state: "in_target",
}

test("dimension segments mark target stops and place one dot per covered stop", () => {
  assert.deepEqual(scanDimensionSegments(thickness), [
    { stopId: "fine", label: "Fein", isTarget: false, dot: null },
    { stopId: "normal", label: "Normal", isTarget: true, dot: "primary" },
    { stopId: "coarse", label: "Grob", isTarget: false, dot: "secondary" },
  ])
})

test("dimension segments place the primary dot on the first covered stop in stop order", () => {
  const reversed = scanDimensionSegments({ ...thickness, productStopIds: ["coarse", "fine"] })
  assert.deepEqual(
    reversed.map((segment) => segment.dot),
    ["primary", null, "secondary"],
  )
})

test("dimension segments carry no dot when the product value is unconfirmed", () => {
  const segments = scanDimensionSegments({
    ...thickness,
    productStopIds: [],
    state: "unknown",
  })
  assert.ok(segments.every((segment) => segment.dot === null))
})

test("dimension summary marks a hit, a miss and a target-less axis differently", () => {
  assert.deepEqual(scanDimensionSummary(thickness), {
    marker: "✓",
    text: "Normal · Grob",
    state: "in_target",
  })
  assert.deepEqual(
    scanDimensionSummary({ ...thickness, productStopIds: ["fine"], state: "outside_target" }),
    { marker: "✕", text: "Fein", state: "outside_target" },
  )
  assert.deepEqual(
    scanDimensionSummary({
      ...thickness,
      targetStopIds: [],
      productStopIds: ["fine"],
      state: "no_target",
    }),
    { marker: null, text: "Fein", state: "no_target" },
  )
})

test("dimension summary says so when the product value is unknown", () => {
  assert.deepEqual(scanDimensionSummary({ ...thickness, productStopIds: [], state: "unknown" }), {
    marker: null,
    text: "Keine Angabe",
    state: "unknown",
  })
})

/* ----------------------------------------------------------------- criteria */

test("criterion markers cover every result value", () => {
  assert.deepEqual(scanCriterionMarker("pass"), { marker: "✓", tone: "ok" })
  assert.deepEqual(scanCriterionMarker("caution"), { marker: "!", tone: "pending" })
  assert.deepEqual(scanCriterionMarker("fail"), { marker: "✕", tone: "danger" })
  assert.deepEqual(scanCriterionMarker("unknown"), { marker: "?", tone: "neutral" })
})

/* -------------------------------------------------------------- why labels */

test("reasons label follows the verdict and the need mode", () => {
  assert.equal(
    scanReasonsLabel({ kind: "in_catalog", verdict: "ideal" }),
    "Warum das zu deinem Haar passt",
  )
  assert.equal(
    scanReasonsLabel({ kind: "in_catalog", verdict: "supportive" }),
    "Warum das nur eingeschränkt passt",
  )
  assert.equal(scanReasonsLabel({ kind: "in_catalog", verdict: "mismatch" }), "Warum nicht")
  assert.equal(
    scanReasonsLabel({ kind: "in_catalog", verdict: "unknown" }),
    "Warum wir uns nicht sicher sind",
  )
  assert.equal(
    scanReasonsLabel({ kind: "not_needed", mode: "not_needed", category: "mask" }),
    "Warum du keine Maske brauchst",
  )
  assert.equal(
    scanReasonsLabel({ kind: "not_needed", mode: "not_needed", category: "conditioner" }),
    "Warum du keinen Conditioner brauchst",
  )
  assert.equal(
    scanReasonsLabel({ kind: "not_needed", mode: "deferred", category: "scalp_care" }),
    "Warum das noch offen ist",
  )
})

/* ------------------------------------------------- not_needed section flags */

test("an empty not_needed payload shows headline and subtitle only", () => {
  assert.deepEqual(scanNotNeededSections({ reasons: [], coveredBy: [] }), {
    reasons: false,
    goodToKnow: false,
    coveredBy: false,
  })
})

test("reasons alone still earn the Gut-zu-wissen card", () => {
  assert.deepEqual(scanNotNeededSections({ reasons: ["Kein Bedarf."], coveredBy: [] }), {
    reasons: true,
    goodToKnow: true,
    coveredBy: false,
  })
})

test("coverage alone still earns the Gut-zu-wissen card", () => {
  assert.deepEqual(
    scanNotNeededSections({ reasons: [], coveredBy: [{ label: "Conditioner", detail: null }] }),
    { reasons: false, goodToKnow: true, coveredBy: true },
  )
})

test("reasons plus coverage show every not_needed section", () => {
  assert.deepEqual(
    scanNotNeededSections({
      reasons: ["Kein Bedarf."],
      coveredBy: [{ label: "Conditioner", detail: "Repair-Pflege" }],
    }),
    { reasons: true, goodToKnow: true, coveredBy: true },
  )
})

/* ------------------------------------------------------------ alternatives */

test("alternative meta line joins the known facts only", () => {
  assert.equal(
    scanAlternativeMetaLine({ brand: "Kérastase", priceLabel: "18,00 €" }),
    "Kérastase · 18,00 €",
  )
  assert.equal(scanAlternativeMetaLine({ brand: null, priceLabel: "18,00 €" }), "18,00 €")
  assert.equal(scanAlternativeMetaLine({ brand: "Kérastase", priceLabel: null }), "Kérastase")
  assert.equal(scanAlternativeMetaLine({ brand: null, priceLabel: null }), null)
})
