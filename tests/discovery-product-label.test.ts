import assert from "node:assert/strict"
import test from "node:test"

import { discoveryProductLabel } from "../src/lib/discovery/product-label"

/**
 * Brand + name for every discovery surface (cockpit, PDF, CLI receipts). Participants and
 * retailer search often deliver a name that already starts with the brand, and the naive
 * join printed „Afrolocke Afrolocke …".
 */

test("a name without the brand gets the brand in front", () => {
  assert.equal(
    discoveryProductLabel("Schwarzkopf", "Klärendes Serum"),
    "Schwarzkopf Klärendes Serum",
  )
})

test("a name that already starts with the brand is not prefixed twice", () => {
  assert.equal(
    discoveryProductLabel("Afrolocke", "Afrolocke Shea Butter Leave-in"),
    "Afrolocke Shea Butter Leave-in",
  )
  assert.equal(
    discoveryProductLabel("Garnier Fructis", "Garnier Fructis Hair Food Aloe Vera"),
    "Garnier Fructis Hair Food Aloe Vera",
  )
})

test("the brand match ignores case, outer whitespace and inner whitespace runs", () => {
  assert.equal(
    discoveryProductLabel("garnier fructis", "Garnier Fructis Maske"),
    "Garnier Fructis Maske",
  )
  assert.equal(discoveryProductLabel("  AFROLOCKE ", "Afrolocke Öl"), "Afrolocke Öl")
  assert.equal(
    discoveryProductLabel("Garnier  Fructis", " Garnier Fructis   Maske "),
    "Garnier Fructis Maske",
  )
})

test("a name equal to the brand is just the name", () => {
  assert.equal(discoveryProductLabel("NEQI", "neqi"), "neqi")
})

test("the brand only counts as a prefix at a word boundary", () => {
  assert.equal(discoveryProductLabel("Bio", "Biotin Shampoo"), "Bio Biotin Shampoo")
})

test("an empty or missing brand leaves the name alone, and vice versa", () => {
  assert.equal(discoveryProductLabel(null, "Eigenmarke Spülung"), "Eigenmarke Spülung")
  assert.equal(discoveryProductLabel(undefined, "Eigenmarke Spülung"), "Eigenmarke Spülung")
  assert.equal(discoveryProductLabel("   ", "Eigenmarke Spülung"), "Eigenmarke Spülung")
  assert.equal(discoveryProductLabel("Balea", null), "Balea")
  assert.equal(discoveryProductLabel(null, null), "")
})
