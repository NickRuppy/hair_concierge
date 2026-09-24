import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { DiscoveryIntakeChecklist } from "../src/components/discovery/intake/discovery-intake-checklist"
import { DiscoveryIntakeReview } from "../src/components/discovery/intake/discovery-intake-review"
import { DiscoveryProductList } from "../src/components/discovery/intake/discovery-product-list"
import type { DiscoveryIntakeItemView } from "../src/components/discovery/intake/types"
import {
  missingCategoryLabels,
  reviewGroups,
  usagePillLabel,
} from "../src/components/discovery/intake/usage-flow"

/**
 * The flat list (Variante A) and the review screen, as markup: one card per product with
 * its coral usage pill, grouped review, „Nichts eingetragen für: …", and legacy rows.
 */

function item(overrides: Partial<DiscoveryIntakeItemView>): DiscoveryIntakeItemView {
  return {
    id: "i1",
    category: "conditioner",
    source: "catalog_search",
    brandText: "Balea",
    productNameText: "Spülung",
    barcodeIdentifier: null,
    productType: "conditioner",
    ...overrides,
  }
}

const CONDITIONER = item({ id: "c1" })
const OIL = item({
  id: "o1",
  category: "oil",
  productType: "oil",
  usageRole: "pre_wash_fibre_treatment",
  brandText: "Olaplex",
  productNameText: "No. 7 Bonding Oil",
})
const SCALP_OIL = item({
  id: "o2",
  category: "scalp_care",
  productType: "oil",
  usageRole: "scalp_flake_oil_adjunct",
  brandText: "Weleda",
  productNameText: "Kopfhaut Öl",
})
const SERUM = item({
  id: "s1",
  category: "scalp_care",
  productType: "scalp_care",
  brandText: "Gliss",
  productNameText: "Scalp Serum",
})
const UNKNOWN = item({
  id: "u1",
  category: null,
  productType: undefined,
  source: "name_research",
  brandText: "Friseurin",
  productNameText: "Geheimtipp",
})
const LEGACY = item({
  id: "l1",
  category: "shampoo",
  productType: undefined,
  productNameText: "Shampoo",
})
const LEGACY_NONE = item({
  id: "n1",
  category: "mask",
  source: "none",
  brandText: null,
  productNameText: null,
  productType: undefined,
})

function list(items: DiscoveryIntakeItemView[]) {
  return renderToStaticMarkup(
    <DiscoveryProductList items={items} busy={false} onChange={() => {}} onRemove={() => {}} />,
  )
}

test("pill labels: usage category, oil role, scalp oil, „Weiß ich nicht“", () => {
  assert.equal(usagePillLabel(CONDITIONER), "Conditioner")
  assert.equal(usagePillLabel(OIL), "Öl · vor der Wäsche")
  assert.equal(usagePillLabel(SCALP_OIL), "Öl · Kopfhaut")
  assert.equal(usagePillLabel(SERUM), "Kopfhautpflege")
  assert.equal(usagePillLabel(UNKNOWN), "Weiß ich nicht")
})

test("each product is one card: name, coral pill, remove X", () => {
  const html = list([CONDITIONER, OIL, UNKNOWN])
  assert.equal((html.match(/<li/g) ?? []).length, 3)
  for (const pill of ["Conditioner", "Öl · vor der Wäsche", "Weiß ich nicht"]) {
    assert.match(html, new RegExp(`aria-label="${pill} – ändern"`))
  }
  assert.match(html, /Balea Spülung/)
  assert.match(html, /aria-label="Olaplex No\. 7 Bonding Oil entfernen"/)
  assert.match(html, /brand-coral-light/)
})

test("a product with no usage question shows its pill as text, not as a button", () => {
  const html = list([SERUM])
  assert.match(html, />Kopfhautpflege</)
  assert.doesNotMatch(html, /ändern"/)
})

test("legacy (tile) rows render with their category as the pill; „benutze ich nicht“ rows do not render", () => {
  const html = list([LEGACY, LEGACY_NONE])
  assert.equal((html.match(/<li/g) ?? []).length, 1)
  assert.match(html, /aria-label="Shampoo – ändern"/)
})

test("the list screen: title, lede, the three entry paths — and „Fertig“ only with a product", () => {
  const empty = renderToStaticMarkup(
    <DiscoveryIntakeChecklist initialItems={[]} initialSubmitted={false} retailerSearchEnabled />,
  )
  assert.match(empty, /Deine Produkte/)
  assert.match(empty, /Trag ein, was du benutzt\./)
  assert.match(empty, /Produkt suchen/)
  assert.match(empty, /Scannen/)
  assert.match(empty, /Nicht gefunden\? Namen eintippen/)
  assert.doesNotMatch(empty, />Fertig</)
  // No tiles, no per-category „benutze ich nicht“.
  assert.doesNotMatch(empty, /benutze ich nicht/i)
  assert.doesNotMatch(empty, /Was benutzt du gerade/)

  const onlyNone = renderToStaticMarkup(
    <DiscoveryIntakeChecklist
      initialItems={[LEGACY_NONE]}
      initialSubmitted={false}
      retailerSearchEnabled={false}
    />,
  )
  assert.doesNotMatch(onlyNone, />Fertig</)

  const filled = renderToStaticMarkup(
    <DiscoveryIntakeChecklist
      initialItems={[CONDITIONER, LEGACY]}
      initialSubmitted={false}
      retailerSearchEnabled={false}
    />,
  )
  assert.match(filled, />Fertig</)
  assert.match(filled, /Balea Spülung/)
})

test("a returning participant who already submitted sees the thank-you", () => {
  const html = renderToStaticMarkup(
    <DiscoveryIntakeChecklist
      initialItems={[CONDITIONER]}
      initialSubmitted
      retailerSearchEnabled={false}
    />,
  )
  assert.match(html, /Danke!/)
  assert.match(html, /Wir sehen uns im Call\./)
  assert.doesNotMatch(html, /Deine Produkte/)
})

// --- Review ----------------------------------------------------------------------------

test("review groups follow the shelf order by usage; „Weiß ich nicht“ last", () => {
  const groups = reviewGroups([UNKNOWN, SERUM, OIL, CONDITIONER, SCALP_OIL, LEGACY, LEGACY_NONE])
  assert.deepEqual(
    groups.map((group) => [group.label, group.items.map((entry) => entry.id)]),
    [
      ["Shampoo", ["l1"]],
      ["Conditioner", ["c1"]],
      ["Öl", ["o1"]],
      ["Kopfhautpflege", ["s1", "o2"]],
      ["Weiß ich nicht", ["u1"]],
    ],
  )
})

test("„Nichts eingetragen für“ lists every category without a product — a legacy none row included", () => {
  assert.deepEqual(missingCategoryLabels([CONDITIONER, OIL, SCALP_OIL, UNKNOWN, LEGACY_NONE]), [
    "Shampoo",
    "Tiefenreinigung",
    "Maske",
    "Leave-in",
    "Bondbuilder",
    "Hitzeschutz",
    "Trockenshampoo",
  ])
})

test("the review screen: grouped rows, the missing line, the confirm CTA and the way back", () => {
  const html = renderToStaticMarkup(
    <DiscoveryIntakeReview
      items={[CONDITIONER, OIL, SERUM, UNKNOWN]}
      submitting={false}
      error={null}
      onChange={() => {}}
      onSubmit={() => {}}
      onBack={() => {}}
    />,
  )
  assert.match(html, /Passt das so\?/)
  assert.match(html, />Conditioner</)
  assert.match(html, />Weiß ich nicht</)
  // The oil row says WHEN; changeable rows say „Ändern“, a fixed type does not.
  assert.match(html, /Öl · vor der Wäsche/)
  assert.equal((html.match(/>Ändern</g) ?? []).length, 3)
  assert.match(
    html,
    /Nichts eingetragen für:.*Shampoo · Tiefenreinigung · Maske · Leave-in · Bondbuilder · Hitzeschutz · Trockenshampoo/,
  )
  assert.match(html, />Stimmt so – abschicken</)
  assert.match(html, />Noch was ergänzen</)
})
