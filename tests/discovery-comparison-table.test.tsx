import assert from "node:assert/strict"
import test from "node:test"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import type { ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { DiscoveryCallCockpit } from "../src/components/discovery/cockpit/discovery-call-cockpit"
import { DiscoveryComparisonTable } from "../src/components/discovery/cockpit/comparison-table"
import { ScanVerdictSections } from "../src/components/scan/scan-verdict-sections"
import type { DiscoveryCockpitStepView } from "../src/lib/discovery/cockpit"
import type { DiscoveryPropertyRow } from "../src/lib/discovery/property-rows"
import type { ScanPresentedVerdictPayload } from "../src/lib/scan/types"

import { SCAN_PARITY_DIMENSION_RESULT } from "./scan-result-card.fixtures"

/**
 * Batch 6, part 1: the cockpit reads a product like the participant's iOS result card —
 * one comparison table (iOS `ComparisonTable`, design spec §2) with the product's value and
 * her target side by side, instead of the scanner's slider bars and the batch-4 text rows.
 * The live web scanner must not change: `ScanVerdictSections` only swaps its bars when the
 * cockpit hands it a table, and `tests/scan-result-card-parity.test.tsx` pins the scanner's
 * markup byte for byte.
 */

function row(overrides: Partial<DiscoveryPropertyRow>): DiscoveryPropertyRow {
  return {
    dimensionId: "shampoo.scalp_route",
    label: "Kopfhaut",
    status: "match",
    state: "in_target",
    productValue: "fettig",
    targetValue: "fettig",
    ...overrides,
  }
}

const ROWS: DiscoveryPropertyRow[] = [
  row({}),
  row({
    dimensionId: "conditioner.weight",
    label: "Pflegegewicht",
    status: "partial",
    state: "outside_target",
    productValue: "mittel",
    targetValue: "leicht",
  }),
  row({
    dimensionId: "conditioner.care_direction",
    label: "Pflegerichtung",
    status: "mismatch",
    state: "outside_target",
    productValue: "Protein",
    targetValue: "Feuchtigkeit",
  }),
  row({
    dimensionId: "shampoo.cleansing",
    label: "Reinigung",
    status: "unknown",
    state: "no_target",
    productValue: "mild",
    targetValue: null,
  }),
]

function cellsOf(markup: string, attribute: string): string[] {
  return [...markup.matchAll(new RegExp(`${attribute}="([^"]*)"`, "g"))].map((match) => match[1]!)
}

test("the table has the iOS header: two blank columns, PRODUKT, DEIN ZIEL in plum", () => {
  const markup = renderToStaticMarkup(<DiscoveryComparisonTable rows={ROWS} />)
  assert.match(markup, /rounded-\[14px\]/)
  assert.match(markup, /bg-\[#f6f3f0\]/)
  assert.match(markup, />Produkt</)
  assert.match(markup, /text-\[var\(--brand-plum\)\][^>]*>Dein Ziel</)
  // Upper-cased by CSS, like the iOS caps header.
  assert.match(markup, /uppercase/)
})

test("each dimension is one row: name, status disc, product value in status colour, target in plum", () => {
  const markup = renderToStaticMarkup(<DiscoveryComparisonTable rows={ROWS} />)
  assert.deepEqual(cellsOf(markup, "data-status"), ["match", "partial", "mismatch", "unknown"])
  // One glyph per row, white on the status colour.
  assert.deepEqual(cellsOf(markup, "data-glyph"), ["✓", "!", "✕", "–"])
  // Status surfaces and word colours from the locked spec (tokens where they match).
  assert.match(markup, /bg-\[var\(--status-ok-bg\)\]/)
  assert.match(markup, /bg-\[var\(--status-pending-bg\)\]/)
  assert.match(markup, /bg-\[var\(--status-danger-bg\)\]/)
  assert.match(markup, /text-\[var\(--status-danger-text\)\][^>]*>Protein</)
  assert.match(markup, /text-\[var\(--brand-plum\)\][^>]*>Feuchtigkeit</)
  // Rows are at least 52 px, with 1-px dividers between them.
  assert.match(markup, /min-h-\[52px\]/)
  assert.match(markup, /divide-y/)
})

test("in / out / no-target: a missing value reads „–“, never an invented word", () => {
  const markup = renderToStaticMarkup(<DiscoveryComparisonTable rows={ROWS} />)
  // in target: product and target both named.
  assert.match(markup, /aria-label="Kopfhaut, passt, Produkt: fettig, dein Ziel: fettig"/)
  // out of target: the miss is named against the target.
  assert.match(
    markup,
    /aria-label="Pflegegewicht, mit Einschränkung, Produkt: mittel, dein Ziel: leicht"/,
  )
  // no target: the target cell is a dash.
  assert.match(
    markup,
    /aria-label="Reinigung, nicht einschätzbar, Produkt: mild, dein Ziel: nicht verfügbar"/,
  )
  assert.match(markup, /text-\[var\(--brand-plum\)\][^>]*>–</)
  // The long property names may break at their word joint, like iOS („Pflege-/gewicht").
  assert.ok(markup.includes("Pflege­gewicht"))
  assert.ok(markup.includes("Pflege­richtung"))
})

test("the compact variant (alternatives) uses the smaller value font", () => {
  const full = renderToStaticMarkup(<DiscoveryComparisonTable rows={ROWS} />)
  const compact = renderToStaticMarkup(<DiscoveryComparisonTable rows={ROWS} compact />)
  assert.match(full, /text-\[13px\] font-bold/)
  assert.match(compact, /text-\[12px\] font-bold/)
  assert.doesNotMatch(compact, /text-\[13px\] font-bold/)
})

test("no rows, no table", () => {
  assert.equal(renderToStaticMarkup(<DiscoveryComparisonTable rows={[]} />), "")
})

// --- scanner unchanged ---------------------------------------------------------

const SCANNER_RESULT = SCAN_PARITY_DIMENSION_RESULT as unknown as Parameters<
  typeof ScanVerdictSections
>[0]["result"]

test("the scanner's own sections still render the slider bars (no table prop)", () => {
  const markup = renderToStaticMarkup(<ScanVerdictSections result={SCANNER_RESULT} />)
  // The bars' section and one bar per dimension, exactly as before.
  assert.match(
    markup,
    /divide-y divide-border rounded-\[14px\] border border-border bg-card px-4 py-1/,
  )
  assert.doesNotMatch(markup, /data-glyph/)
})

test("only a cockpit-supplied comparison replaces the bars", () => {
  const withTable = renderToStaticMarkup(
    <ScanVerdictSections
      result={SCANNER_RESULT}
      comparison={<DiscoveryComparisonTable rows={ROWS} />}
    />,
  )
  assert.doesNotMatch(
    withTable,
    /divide-y divide-border rounded-\[14px\] border border-border bg-card px-4 py-1/,
  )
  assert.match(withTable, /data-glyph/)
  // Everything around the bars is untouched: header and banner still come first.
  const without = renderToStaticMarkup(<ScanVerdictSections result={SCANNER_RESULT} />)
  const banner = without.indexOf("rounded-[14px] px-4 py-3.5")
  assert.ok(banner > 0)
  assert.equal(withTable.slice(0, banner), without.slice(0, banner))
})

// --- cockpit ------------------------------------------------------------------

const payload = {
  ...(SCAN_PARITY_DIMENSION_RESULT as unknown as Record<string, unknown>),
  alternatives: [],
} as unknown as ScanPresentedVerdictPayload

function cockpitStep(overrides: Partial<DiscoveryCockpitStepView> = {}): DiscoveryCockpitStepView {
  return {
    decisionKey: "decision:shampoo:shampoo_everyday:gap",
    category: "shampoo",
    categoryLabel: "Shampoo",
    roleLabel: "Hauptreinigung",
    roleDescription: null,
    frequencyLabel: "3× pro Woche",
    depth: null,
    section: "basis",
    outcome: "undecided",
    ownedLabel: "Chaarlie Lab Lab Shampoo Alpha",
    intakeItemId: "item-1",
    unanswered: false,
    verdict: {
      status: "verdict",
      product: SCAN_PARITY_DIMENSION_RESULT.product,
      payload,
      propertyRows: ROWS,
    },
    swapOptions: [
      {
        productId: "p-alternative-a",
        name: "Lab Shampoo Gamma",
        brand: "Chaarlie Lab",
        label: "Chaarlie Lab Lab Shampoo Gamma",
        verdictLabel: "Passt",
        origin: "alternative",
        propertyRows: [row({ productValue: "fettig" })],
      },
    ],
    swapProductId: null,
    swapProductLabel: null,
    idealRecommendation: null,
    recommendationLabel: null,
    ownedUsageLabel: null,
    usageDifference: null,
    ...overrides,
  }
}

function renderCockpit(element: ReactElement): string {
  const router = { refresh() {}, push() {}, replace() {}, prefetch() {}, back() {}, forward() {} }
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={router as never}>{element}</AppRouterContext.Provider>,
  )
}

test("the cockpit shows her product as a comparison table instead of bars and text rows", () => {
  const markup = renderCockpit(
    <DiscoveryCallCockpit
      enrollmentId="enrollment-1"
      steps={[cockpitStep()]}
      submitted
      initialFinalizedAt={null}
    />,
  )
  // Verdict title and badge stay.
  assert.match(markup, /Passt zu deinem Haar/)
  // No slider bars, no batch-4 text rows.
  assert.doesNotMatch(
    markup,
    /divide-y divide-border rounded-\[14px\] border border-border bg-card px-4 py-1/,
  )
  assert.doesNotMatch(markup, /Im Vergleich zum Ziel/)
  assert.doesNotMatch(markup, / statt /)
  // Her table (4 rows) plus one compact table for the alternative (1 row).
  assert.deepEqual(cellsOf(markup, "data-comparison"), ["full", "compact"])
  assert.equal(cellsOf(markup, "data-glyph").length, 5)
})

test("without rows the cockpit falls back to the scanner's bars rather than showing nothing", () => {
  const step = cockpitStep()
  const markup = renderCockpit(
    <DiscoveryCallCockpit
      enrollmentId="enrollment-1"
      steps={[
        {
          ...step,
          verdict:
            step.verdict?.status === "verdict" ? { ...step.verdict, propertyRows: [] } : null,
          swapOptions: [],
        },
      ]}
      submitted
      initialFinalizedAt={null}
    />,
  )
  assert.match(
    markup,
    /divide-y divide-border rounded-\[14px\] border border-border bg-card px-4 py-1/,
  )
  assert.deepEqual(cellsOf(markup, "data-comparison"), [])
})
