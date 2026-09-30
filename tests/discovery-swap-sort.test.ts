import assert from "node:assert/strict"
import test from "node:test"

import {
  parseDiscoveryPriceLabel,
  sortDiscoverySwapOptions,
} from "../src/components/discovery/cockpit/swap-sort"

/**
 * Verdict-layer T2 (R19): the cockpit's alternatives can be re-sorted by price. Display
 * only — the parser reads the already formatted label, the sorter reorders the list the
 * engine delivered, and „Fit" keeps the engine's order untouched.
 */

test("price parser: the catalog's own de-DE labels, with or without a no-break space", () => {
  const formatted = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" })
  assert.equal(parseDiscoveryPriceLabel(formatted.format(5.45)), 5.45)
  assert.equal(parseDiscoveryPriceLabel(formatted.format(1234.5)), 1234.5)
  assert.equal(parseDiscoveryPriceLabel("5,45 €"), 5.45)
  assert.equal(parseDiscoveryPriceLabel("5,45 €"), 5.45)
  assert.equal(parseDiscoveryPriceLabel("€ 5,45"), 5.45)
  assert.equal(parseDiscoveryPriceLabel("12 €"), 12)
  assert.equal(parseDiscoveryPriceLabel("1.234,56 €"), 1234.56)
  assert.equal(parseDiscoveryPriceLabel("0,99 EUR"), 0.99)
})

test("price parser: garbage and ambiguity read as no price, never a guess", () => {
  for (const input of [
    null,
    undefined,
    "",
    "   ",
    "€",
    "Preis auf Anfrage",
    "5,45,3 €",
    "5,45 € – 7,90 €",
    "24,90 € / 100 ml",
    "1.2.3",
  ]) {
    assert.equal(parseDiscoveryPriceLabel(input), null, `expected null for ${String(input)}`)
  }
})

type Option = { productId: string; priceLabel?: string | null }

const options: Option[] = [
  { productId: "a", priceLabel: "9,95 €" },
  { productId: "b", priceLabel: null },
  { productId: "c", priceLabel: "3,45 €" },
  { productId: "d" },
  { productId: "e", priceLabel: "9,95 €" },
  { productId: "f", priceLabel: "Preis auf Anfrage" },
]

const ids = (list: readonly Option[]) => list.map((option) => option.productId)

test("sort: „Fit“ is the engine's order, unchanged (and a copy, never the same array)", () => {
  const sorted = sortDiscoverySwapOptions(options, "fit")
  assert.deepEqual(ids(sorted), ["a", "b", "c", "d", "e", "f"])
  assert.notEqual(sorted, options)
})

test("sort: „Preis“ ascending, ties and priceless options keep the engine's order, at the end", () => {
  const sorted = sortDiscoverySwapOptions(options, "price")
  assert.deepEqual(ids(sorted), ["c", "a", "e", "b", "d", "f"])
  // The input is never mutated.
  assert.deepEqual(ids(options), ["a", "b", "c", "d", "e", "f"])
})

test("sort: nothing priced — „Preis“ changes nothing", () => {
  const unpriced: Option[] = [{ productId: "x" }, { productId: "y", priceLabel: null }]
  assert.deepEqual(ids(sortDiscoverySwapOptions(unpriced, "price")), ["x", "y"])
  assert.deepEqual(sortDiscoverySwapOptions([], "price"), [])
})
