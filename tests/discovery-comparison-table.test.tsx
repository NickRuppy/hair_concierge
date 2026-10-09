import assert from "node:assert/strict"
import test from "node:test"
import { JSDOM } from "jsdom"
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

test("an alternative without her product: two columns, ALTERNATIVE | ZIEL", () => {
  const markup = renderToStaticMarkup(<DiscoveryComparisonTable rows={ROWS} compact />)
  assert.deepEqual(cellsOf(markup, "data-comparison"), ["compact"])
  assert.match(markup, />Alternative</)
  assert.doesNotMatch(markup, />Bisheriges Produkt</)
  assert.doesNotMatch(markup, /data-owned-glyph/)
  // Empty owned rows are the same as none (Neu-dazu step).
  const empty = renderToStaticMarkup(
    <DiscoveryComparisonTable rows={ROWS} compact ownedRows={[]} />,
  )
  assert.equal(empty, markup)
  assert.match(markup, /text-\[12px\] font-bold/)
  assert.doesNotMatch(markup, /text-\[13px\] font-bold/)
})

test("her own table ignores ownedRows — it stays PRODUKT | ZIEL", () => {
  const full = renderToStaticMarkup(<DiscoveryComparisonTable rows={ROWS} />)
  const withOwned = renderToStaticMarkup(<DiscoveryComparisonTable rows={ROWS} ownedRows={ROWS} />)
  assert.equal(withOwned, full)
  assert.match(full, />Produkt</)
})

// --- alternative next to her product (Produktphase T3) -----------------------------

const OWNED: DiscoveryPropertyRow[] = [
  row({ status: "mismatch", productValue: "trocken" }),
  row({
    dimensionId: "conditioner.weight",
    label: "Pflegegewicht",
    status: "partial",
    productValue: "reichhaltig",
    targetValue: "leicht",
  }),
  // An axis only her product has — never shown in the alternative's table.
  row({
    dimensionId: "shampoo.silicones",
    label: "Silikone",
    status: "match",
    productValue: "ohne",
  }),
]

const ALT: DiscoveryPropertyRow[] = [
  row({ status: "match", productValue: "fettig" }),
  row({
    dimensionId: "conditioner.weight",
    label: "Pflegegewicht",
    status: "match",
    productValue: "leicht",
    targetValue: "leicht",
  }),
  // An axis her product lacks — her cell stays empty.
  row({
    dimensionId: "shampoo.cleansing",
    label: "Reinigung",
    status: "mismatch",
    productValue: "stark",
    targetValue: "mild",
  }),
]

function liBodies(markup: string): string[] {
  return [...markup.matchAll(/<li [\s\S]*?<\/li>/g)].map((match) => match[0])
}

test("with her product: three columns BISHERIGES PRODUKT | ALTERNATIVE | ZIEL, ZIEL in plum", () => {
  const markup = renderToStaticMarkup(
    <DiscoveryComparisonTable rows={ALT} compact ownedRows={OWNED} />,
  )
  assert.deepEqual(cellsOf(markup, "data-comparison"), ["compact-owned"])
  const header = markup.slice(0, markup.indexOf("<ul"))
  assert.ok(
    header.indexOf(">Bisheriges Produkt<") < header.indexOf(">Alternative<") &&
      header.indexOf(">Alternative<") < header.indexOf(">Ziel<"),
  )
  assert.match(header, /text-\[var\(--brand-plum\)\][^>]*>Ziel</)
  assert.match(markup, /grid-cols-\[96px_minmax\(0,1fr\)_minmax\(0,1fr\)_minmax\(0,1fr\)\]/)
  // Only the alternative's axes, in its order.
  assert.equal(liBodies(markup).length, 3)
  assert.doesNotMatch(markup, /Silikone/)
  // Narrow widths scroll inside the card, never the page.
  assert.match(markup, /overflow-x-auto/)
})

test("axes are matched by dimension; a missing axis leaves her cell empty", () => {
  const markup = renderToStaticMarkup(
    <DiscoveryComparisonTable rows={ALT} compact ownedRows={OWNED} />,
  )
  const [scalp, weight, cleansing] = liBodies(markup)
  assert.match(scalp!, /data-cell="owned"[^>]*>.*data-owned-glyph="✕".*>trocken</)
  assert.match(weight!, /data-cell="owned"[^>]*>.*data-owned-glyph="!".*>reichhaltig</)
  assert.match(cleansing!, /<span aria-hidden="true" data-cell="owned" class="[^"]*"><\/span>/)
  assert.deepEqual(cellsOf(markup, "data-owned-status"), ["mismatch", "partial", "none"])
  assert.match(
    markup,
    /aria-label="Kopfhaut, passt, bisheriges Produkt: trocken \(passt nicht\), Alternative: fettig, Ziel: fettig"/,
  )
  assert.match(markup, /aria-label="Reinigung, passt nicht, Alternative: stark, Ziel: mild"/)
})

test("row tint and badges follow the alternative; her badge follows her status", () => {
  const markup = renderToStaticMarkup(
    <DiscoveryComparisonTable rows={ALT} compact ownedRows={OWNED} />,
  )
  assert.deepEqual(cellsOf(markup, "data-status"), ["match", "match", "mismatch"])
  const [scalp, , cleansing] = liBodies(markup)
  // Tint on the <li> is the alternative's, even where her product misses.
  assert.match(scalp!, /^<li [^>]*bg-\[var\(--status-ok-bg\)\]/)
  assert.match(cleansing!, /^<li [^>]*bg-\[var\(--status-danger-bg\)\]/)
  // One row glyph per row (the alternative's) plus her glyph where she has the axis.
  assert.deepEqual(cellsOf(markup, "data-glyph"), ["✓", "✓", "✕"])
  assert.deepEqual(cellsOf(markup, "data-owned-glyph"), ["✕", "!"])
  // Filled discs in semantic status colours — never the coral accent.
  assert.match(
    scalp!,
    /data-owned-glyph="✕" class="[^"]*rounded-full[^"]*bg-\[var\(--status-danger-text\)\]/,
  )
  assert.match(scalp!, /data-glyph="✓" class="[^"]*rounded-full[^"]*bg-\[var\(--status-ok-text\)\]/)
  assert.doesNotMatch(markup, /coral/)
})

test("no rows, no table", () => {
  assert.equal(renderToStaticMarkup(<DiscoveryComparisonTable rows={[]} />), "")
})

// --- scanner unchanged ---------------------------------------------------------

const SCANNER_RESULT = SCAN_PARITY_DIMENSION_RESULT as unknown as Parameters<
  typeof ScanVerdictSections
>[0]["result"]

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

  // The bars' section and one bar per dimension, exactly as before.
  assert.match(
    without,
    /divide-y divide-border rounded-\[14px\] border border-border bg-card px-4 py-1/,
  )
  assert.doesNotMatch(without, /data-glyph/)
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
    ownedProductId: null,
    ownedUsageRole: null,
    stepEntryCount: 1,
    ownedFrequencyLabel: null,
    ownedFrequency: null,
    idealAllowedRange: null,
    canDrop: false,
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
        priceLabel: null,
        imageUrl: null,
        origin: "alternative",
        propertyRows: [row({ productValue: "fettig" })],
      },
    ],
    swapProductId: null,
    swapProductLabel: null,
    idealRecommendation: null,
    recommendationLabel: null,
    ownedUsageLabel: null,
    ownedImageUrl: null,
    swapProductImageUrl: null,
    recommendationImageUrl: null,
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
  // Verdict title and badge stay (the title in the cockpit's voice, T4).
  assert.match(markup, /Passt zum Haarprofil/)
  // No slider bars, no batch-4 text rows.
  assert.doesNotMatch(
    markup,
    /divide-y divide-border rounded-\[14px\] border border-border bg-card px-4 py-1/,
  )
  assert.doesNotMatch(markup, /Im Vergleich zum Ziel/)
  assert.doesNotMatch(markup, / statt /)
  // Her table (4 rows) plus the alternative's table (1 row) — with her product's column
  // beside it, since the step carries her verdict rows. Her badges there are
  // `data-owned-glyph`, so the alternative's glyph count stays 5.
  assert.deepEqual(cellsOf(markup, "data-comparison"), ["full", "compact-owned"])
  assert.equal(cellsOf(markup, "data-glyph").length, 5)
  // The full table uses the same four ROWS as the step fixture above.
  const dom = new JSDOM(markup)
  const tables = dom.window.document.querySelectorAll('[data-comparison="full"]')
  assert.equal(tables.length, 1)
  const full = tables[0]!.outerHTML
  const header = tables[0]!.firstElementChild?.outerHTML
  assert.ok(header)
  dom.window.close()

  assert.match(full, /rounded-\[14px\]/)
  assert.match(header, /bg-\[#f6f3f0\]/)
  assert.match(header, />Produkt</)
  assert.match(header, /text-\[var\(--brand-plum\)\][^>]*>Ziel</)
  // Upper-cased by CSS, like the iOS caps header.
  assert.match(header, /uppercase/)

  assert.deepEqual(cellsOf(full, "data-status"), ["match", "partial", "mismatch", "unknown"])
  // One glyph per row, white on the status colour.
  assert.deepEqual(cellsOf(full, "data-glyph"), ["✓", "!", "✕", "–"])
  // Status surfaces and word colours from the locked spec (tokens where they match).
  assert.match(full, /bg-\[var\(--status-ok-bg\)\]/)
  assert.match(full, /bg-\[var\(--status-pending-bg\)\]/)
  assert.match(full, /bg-\[var\(--status-danger-bg\)\]/)
  assert.match(full, /text-\[var\(--status-danger-text\)\][^>]*>Protein</)
  assert.match(full, /text-\[var\(--brand-plum\)\][^>]*>Feuchtigkeit</)
  // Rows are at least 52 px, with 1-px dividers between them.
  assert.match(full, /min-h-\[52px\]/)
  assert.match(full, /divide-y/)

  // in target: product and target both named.
  assert.match(full, /aria-label="Kopfhaut, passt, Produkt: fettig, Ziel: fettig"/)
  // out of target: the miss is named against the target.
  assert.match(full, /aria-label="Pflegegewicht, mit Einschränkung, Produkt: mittel, Ziel: leicht"/)
  // no target: the target cell is a dash.
  assert.match(
    full,
    /aria-label="Reinigung, nicht einschätzbar, Produkt: mild, Ziel: nicht verfügbar"/,
  )
  assert.match(full, /text-\[var\(--brand-plum\)\][^>]*>–</)
  // The long property names may break at their word joint, like iOS („Pflege-/gewicht").
  assert.ok(full.includes("Pflege­gewicht"))
  assert.ok(full.includes("Pflege­richtung"))

  assert.match(full, /text-\[13px\] font-bold/)
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
