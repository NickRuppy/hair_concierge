import assert from "node:assert/strict"
import test from "node:test"

import { matchCatalogProducts, type CatalogSearchCandidate } from "../src/lib/scan/catalog-search"

/**
 * F2 (plan Rev. 3 §1.2): typo tolerance in the shared catalog matcher. Per query token,
 * Damerau-Levenshtein (optimal string alignment) against the title tokens — 1 edit for
 * tokens ≤ 5 chars, 2 above. The pre-existing full-query substring match stays the strongest
 * tier: exact title → substring → token matches → typo-only matches.
 */

function row(
  id: string,
  name: string,
  brand: string | null,
  overrides: Partial<CatalogSearchCandidate> = {},
): CatalogSearchCandidate {
  return {
    id,
    name,
    brand,
    category_key: "shampoo",
    image_url: null,
    sort_order: 1,
    brand_identity: null,
    product_line: null,
    ...overrides,
  }
}

const catalog = [
  row("elvital", "Hyaluron Pure Shampoo", "Elvital"),
  row("gliss", "Aqua Revive Shampoo", "Gliss"),
  row("olaplex", "No. 4 Bond Maintenance Shampoo", "Olaplex"),
  row("kerastase", "Bain Satin", "Kerastase"),
  row("balea", "Repair Spülung", "Balea"),
]

function ids(query: string): string[] {
  return matchCatalogProducts(catalog, query).map((candidate) => candidate.id)
}

const TYPO_TABLE: Array<{ label: string; query: string; expected: string[] }> = [
  { label: "1 deletion on a short token (≤ 5 chars)", query: "glss", expected: ["gliss"] },
  { label: "1 substitution on a short token", query: "baloa", expected: ["balea"] },
  { label: "2 edits on a long token (> 5 chars)", query: "elvtol shampo", expected: ["elvital"] },
  // Plain Levenshtein would count "glsis" → "gliss" as 2 edits (over the short-token budget).
  { label: "a transposition counts as one edit", query: "glsis", expected: ["gliss"] },
  { label: "a transposition on a long token", query: "olpalex", expected: ["olaplex"] },
  { label: "2 edits on a short token are rejected", query: "gxxss", expected: [] },
  { label: "3 edits on a long token are rejected", query: "elxxxal", expected: [] },
  {
    label: "multi-token: every token must match some title token",
    query: "hyaluron elvitl",
    expected: ["elvital"],
  },
  {
    label: "multi-token: one unmatched token rejects the row",
    query: "elvital zzzzzz",
    expected: [],
  },
  {
    label: "a typo in a partially typed last token still matches",
    query: "kerasp",
    expected: ["kerastase"],
  },
]

for (const { label, query, expected } of TYPO_TABLE) {
  test(`matchCatalogProducts typo table: ${label} ("${query}")`, () => {
    assert.deepEqual(ids(query), expected)
  })
}

test("matchCatalogProducts: tokens under 5 chars compare whole words, not word prefixes", () => {
  // Prefix matching would let "oil" (1 edit) hit "Olaplex" via "ol".
  assert.deepEqual(ids("oil"), [])
  // A whole-word typo still matches: "olaplx" is 6 chars, "glss" a whole-word deletion.
  assert.deepEqual(ids("olaplx"), ["olaplex"])
  assert.deepEqual(ids("glss"), ["gliss"])
})

test("matchCatalogProducts: very short tokens (< 3 chars) get no typo tolerance", () => {
  // With 1 edit, "xy" would match any title token that merely starts with "x" or "y".
  assert.deepEqual(ids("xy"), [])
})

test("matchCatalogProducts: exact title → substring → token → typo-only tiers, sort_order only breaks ties within a tier", () => {
  const rows = [
    row("typo-only", "Shampo Deluxe", "Marke", { sort_order: 0 }),
    row("token-reordered", "Deluxe Shampoo", "Marke", { sort_order: 0 }),
    row("substring", "Shampoo Deluxe Plus", "Marke", { sort_order: 5 }),
    row("exact", "Shampoo Deluxe", "Marke", { sort_order: 9 }),
  ]
  const ranked = matchCatalogProducts(rows, "marke shampoo deluxe").map((candidate) => candidate.id)
  assert.deepEqual(ranked, ["exact", "substring", "token-reordered", "typo-only"])
})

test("matchCatalogProducts: within the typo tier the existing sort_order → name → id tiebreak holds", () => {
  const rows = [
    row("b", "Shampo B", "Marke", { sort_order: 2 }),
    row("a", "Shampo A", "Marke", { sort_order: 2 }),
    row("c", "Shampo C", "Marke", { sort_order: 1 }),
  ]
  assert.deepEqual(
    matchCatalogProducts(rows, "shampoo").map((candidate) => candidate.id),
    ["c", "a", "b"],
  )
})

test("matchCatalogProducts: plain substring matching is unchanged (case-insensitive, over the identity title)", () => {
  assert.deepEqual(ids("PURE SHAMP"), ["elvital"])
  assert.deepEqual(ids("aqua revive"), ["gliss"])
})
