import assert from "node:assert/strict"
import test from "node:test"

import {
  detectBrandAliasConflicts,
  resolveBrandFromText,
  type ProductIdentityBrand,
} from "../src/lib/product-identity"

const brands: ProductIdentityBrand[] = [
  {
    key: "olaplex",
    name: "Olaplex",
    aliases: ["Olaplex Inc."],
    productLines: [{ key: "no_5", name: "No. 5", aliases: ["Nr. 5"] }],
  },
  {
    key: "k18",
    name: "K18",
    aliases: ["K 18"],
  },
]

test("resolveBrandFromText returns an exact brand and product line prefix match", () => {
  const resolution = resolveBrandFromText("Olaplex Nr. 5 Leave-In Conditioner", brands)

  assert.equal(resolution.match, "brand_line")
  assert.equal(resolution.brand?.key, "olaplex")
  assert.equal(resolution.productLine?.key, "no_5")
  assert.equal(resolution.matchedText, "Olaplex Nr. 5")
})

test("resolveBrandFromText returns an exact brand match without over-matching inside words", () => {
  const resolution = resolveBrandFromText("K 18 Leave-in Molecular Repair Hair Oil", brands)
  assert.equal(resolution.match, "brand")
  assert.equal(resolution.brand?.key, "k18")
  assert.equal(resolution.productLine, null)

  const nonMatch = resolveBrandFromText("SK18 Leave-in Molecular Repair Hair Oil", brands)
  assert.equal(nonMatch.match, "none")
  assert.equal(nonMatch.brand, null)
})

test("detectBrandAliasConflicts reports duplicate normalized aliases with conflicting targets", () => {
  const conflicts = detectBrandAliasConflicts([
    { key: "first", name: "Curlsmith", aliases: ["Curl Smith"] },
    { key: "second", name: "Curl Smith" },
  ])

  assert.deepEqual(conflicts, [
    {
      normalizedAlias: "curl smith",
      targets: [
        { brandKey: "first", label: "Curl Smith" },
        { brandKey: "second", label: "Curl Smith" },
      ],
    },
  ])
})
