import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { CATEGORY_COPY } from "../src/components/personal-plan-products/stage3-product-copy"

import {
  DISCOVERY_INTAKE_CATEGORY_COPY,
  DISCOVERY_INTAKE_CATEGORY_COUNT,
  DISCOVERY_INTAKE_GROUPS,
} from "../src/components/discovery/intake/categories"
import { DiscoveryProductEntry } from "../src/components/discovery/intake/discovery-product-entry"
import { DISCOVERY_INTAKE_CATEGORIES } from "../src/lib/discovery/intake"

/**
 * The checklist's display grouping is UI-only, but it is still load-bearing:
 * completeness is derived from the ten category keys, and the participant can
 * only answer what the four groups put on screen.
 */

test("the checklist's display groups cover every category exactly once", () => {
  // Completeness is derived from the ten category keys, but the participant can
  // only answer what the four groups put on screen: a key missing from the groups
  // would make „Absenden" unreachable, and a duplicate would double-count nothing
  // while showing the same row twice.
  const grouped = DISCOVERY_INTAKE_GROUPS.flatMap((group) =>
    group.categories.map((category) => category.key),
  )
  assert.equal(grouped.length, DISCOVERY_INTAKE_CATEGORY_COUNT)
  assert.deepEqual([...grouped].sort(), [...DISCOVERY_INTAKE_CATEGORIES].sort())
  assert.equal(new Set(grouped).size, grouped.length)
  assert.equal(DISCOVERY_INTAKE_CATEGORY_COUNT, DISCOVERY_INTAKE_CATEGORIES.length)

  // Every row also needs its German gender, or the headings read wrong.
  for (const key of DISCOVERY_INTAKE_CATEGORIES) {
    const copy = DISCOVERY_INTAKE_CATEGORY_COPY[key]
    assert.ok(copy, `no checklist copy for ${key}`)
    assert.ok(copy.label.length > 0)
    assert.match(copy.possessive, /^Dein(e)?$/)
    assert.match(copy.interrogative, /^Welche(s|n)?$/)
  }
})

test("the checklist says „Kopfhautpflege“ — feminine — and names examples, shared copy untouched", () => {
  const scalp = DISCOVERY_INTAKE_CATEGORY_COPY.scalp_care
  assert.equal(scalp.label, "Kopfhautpflege")
  assert.equal(`${scalp.possessive} ${scalp.label}`, "Deine Kopfhautpflege")
  assert.equal(
    `${scalp.interrogative} ${scalp.label} benutzt du?`,
    "Welche Kopfhautpflege benutzt du?",
  )
  assert.equal(scalp.hint, "z. B. Kopfhaut-Serum, -Tonikum oder -Peeling")

  // Nothing else in the checklist still says „Kopfhautprodukt“ …
  for (const copy of Object.values(DISCOVERY_INTAKE_CATEGORY_COPY)) {
    assert.doesNotMatch(copy.label, /Kopfhautprodukt/)
  }
  // … and only scalp care carries a hint, so every other entry screen is unchanged.
  assert.deepEqual(
    Object.values(DISCOVERY_INTAKE_CATEGORY_COPY)
      .filter((copy) => copy.hint)
      .map((copy) => copy.key),
    ["scalp_care"],
  )

  // The override is scoped to the checklist: the personal plan keeps its label.
  assert.equal(CATEGORY_COPY.scalp_care.label, "Kopfhautprodukt")
})

test("the scalp entry screen asks the feminine question with the example line", () => {
  const html = renderToStaticMarkup(
    <DiscoveryProductEntry
      category={DISCOVERY_INTAKE_CATEGORY_COPY.scalp_care}
      items={[]}
      retailerSearchEnabled={false}
      onAdded={() => {}}
      onRemoved={() => {}}
      onBack={() => {}}
    />,
  )
  assert.match(html, /Welche Kopfhautpflege benutzt du\?/)
  assert.match(html, /z\. B\. Kopfhaut-Serum, -Tonikum oder -Peeling/)
  assert.doesNotMatch(html, /Kopfhautprodukt/)
})

test("a filled scalp category reads „Deine Kopfhautpflege“ and drops the example line", () => {
  const html = renderToStaticMarkup(
    <DiscoveryProductEntry
      category={DISCOVERY_INTAKE_CATEGORY_COPY.scalp_care}
      items={[
        {
          id: "i1",
          category: "scalp_care",
          source: "catalog_search",
          brandText: "Weleda",
          productNameText: "Kopfhaut-Tonikum",
          barcodeIdentifier: null,
        },
      ]}
      retailerSearchEnabled={false}
      onAdded={() => {}}
      onRemoved={() => {}}
      onBack={() => {}}
    />,
  )
  assert.match(html, /Deine Kopfhautpflege/)
  assert.doesNotMatch(html, /z\. B\. Kopfhaut-Serum/)
})

test("other categories' entry screens carry no hint line", () => {
  const html = renderToStaticMarkup(
    <DiscoveryProductEntry
      category={DISCOVERY_INTAKE_CATEGORY_COPY.shampoo}
      items={[]}
      retailerSearchEnabled={false}
      onAdded={() => {}}
      onRemoved={() => {}}
      onBack={() => {}}
    />,
  )
  assert.match(html, /Welches Shampoo benutzt du\?/)
  assert.doesNotMatch(html, /z\. B\./)
})

test("the shelves: conditioner is care, not washing", () => {
  const byGroup = Object.fromEntries(
    DISCOVERY_INTAKE_GROUPS.map((group) => [
      group.label,
      group.categories.map((category) => category.key),
    ]),
  )
  assert.deepEqual(byGroup, {
    Waschen: ["shampoo", "deep_cleansing_shampoo"],
    Pflege: ["conditioner", "mask", "leave_in", "oil", "bondbuilder"],
    Kopfhaut: ["scalp_care"],
    Styling: ["heat_protectant", "dry_shampoo"],
  })
})
