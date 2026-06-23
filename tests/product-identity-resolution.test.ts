import assert from "node:assert/strict"
import test from "node:test"

import {
  buildBrandResolutionCatalog,
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
  assert.equal(resolution.confidence, "high")
  assert.equal(resolution.reason, "canonical_brand_with_line_inference")
})

test("resolveBrandFromText returns an exact brand match without over-matching inside words", () => {
  const resolution = resolveBrandFromText("K 18 Leave-in Molecular Repair Hair Oil", brands)
  assert.equal(resolution.match, "brand")
  assert.equal(resolution.brand?.key, "k18")
  assert.equal(resolution.productLine, null)
  assert.equal(resolution.reason, "brand_alias_exact")

  const nonMatch = resolveBrandFromText("SK18 Leave-in Molecular Repair Hair Oil", brands)
  assert.equal(nonMatch.match, "none")
  assert.equal(nonMatch.brand, null)
  assert.equal(nonMatch.unresolvedRawText, "SK18 Leave-in Molecular Repair Hair Oil")
})

test("resolveBrandFromText resolves Phase 0 aliases before canonical brand names", () => {
  const catalog = buildBrandResolutionCatalog({
    brands: [
      { id: "brand-pantene", canonical_name: "Pantene", normalized_name: "pantene" },
      { id: "brand-garnier", canonical_name: "Garnier", normalized_name: "garnier" },
    ],
    productLines: [
      {
        id: "line-pro-v",
        brand_id: "brand-pantene",
        canonical_name: "Pro-V",
        normalized_name: "pro v",
      },
      {
        id: "line-fructis",
        brand_id: "brand-garnier",
        canonical_name: "Fructis",
        normalized_name: "fructis",
      },
    ],
    brandAliases: [
      {
        brand_id: "brand-garnier",
        product_line_id: "line-fructis",
        alias: "Fructis",
        normalized_alias: "fructis",
      },
    ],
  })

  const proV = resolveBrandFromText("Pantene Pro-V Repair & Care Shampoo", catalog)
  assert.equal(proV.match, "brand_line")
  assert.equal(proV.brand?.id, "brand-pantene")
  assert.equal(proV.productLine?.id, "line-pro-v")
  assert.equal(proV.reason, "canonical_brand_with_line_inference")

  const garnierFructis = resolveBrandFromText("Garnier Fructis Aloe Hydra Bomb", catalog)
  assert.equal(garnierFructis.match, "brand_line")
  assert.equal(garnierFructis.brand?.id, "brand-garnier")
  assert.equal(garnierFructis.productLine?.id, "line-fructis")
  assert.equal(garnierFructis.reason, "canonical_brand_with_line_inference")

  const fructisAlias = resolveBrandFromText("Fructis Aloe Hydra Bomb", catalog)
  assert.equal(fructisAlias.match, "brand_line")
  assert.equal(fructisAlias.brand?.id, "brand-garnier")
  assert.equal(fructisAlias.productLine?.id, "line-fructis")
  assert.equal(fructisAlias.reason, "brand_line_alias_exact")
})

test("unknown brand returns unresolved raw text with no confidence", () => {
  const catalog = buildBrandResolutionCatalog({
    brands: [{ id: "brand-garnier", canonical_name: "Garnier", normalized_name: "garnier" }],
    productLines: [],
    brandAliases: [],
  })

  const resolution = resolveBrandFromText("Unbekannte Pflegecreme", catalog)

  assert.equal(resolution.match, "none")
  assert.equal(resolution.confidence, "none")
  assert.equal(resolution.reason, "unresolved")
  assert.equal(resolution.unresolvedRawText, "Unbekannte Pflegecreme")
})

test("conflicting aliases are reported and excluded from usable alias resolution", () => {
  const catalog = buildBrandResolutionCatalog({
    brands: [
      { id: "brand-first", canonical_name: "First", normalized_name: "first" },
      { id: "brand-second", canonical_name: "Second", normalized_name: "second" },
    ],
    productLines: [],
    brandAliases: [
      {
        brand_id: "brand-first",
        product_line_id: null,
        alias: "Shared",
        normalized_alias: "shared",
      },
      {
        brand_id: "brand-second",
        product_line_id: null,
        alias: "Shared",
        normalized_alias: "shared",
      },
    ],
  })

  assert.deepEqual(
    catalog.conflicts.map((conflict) => conflict.normalizedAlias),
    ["shared"],
  )

  const resolution = resolveBrandFromText("Shared Shampoo", catalog)
  assert.equal(resolution.match, "none")
  assert.equal(resolution.reason, "unresolved")
})

test("resolver uses Phase 0 normalized brand and line fields for punctuation variants", () => {
  const catalog = buildBrandResolutionCatalog({
    brands: [
      {
        id: "brand-loreal-paris",
        canonical_name: "Loreal Paris",
        normalized_name: "loreal paris",
      },
    ],
    productLines: [
      {
        id: "line-elvital",
        brand_id: "brand-loreal-paris",
        canonical_name: "Elvital",
        normalized_name: "elvital",
      },
    ],
    brandAliases: [],
  })

  const resolution = resolveBrandFromText("Loreal Paris Elvital Dream Length", catalog)

  assert.equal(resolution.match, "brand_line")
  assert.equal(resolution.brand?.id, "brand-loreal-paris")
  assert.equal(resolution.productLine?.id, "line-elvital")
  assert.equal(resolution.matchedText, "Loreal Paris Elvital")
  assert.equal(resolution.reason, "canonical_brand_with_line_inference")

  const apostropheResolution = resolveBrandFromText("L'Oréal Paris Elvital Dream Length", catalog)
  assert.equal(apostropheResolution.match, "brand_line")
  assert.equal(apostropheResolution.brand?.id, "brand-loreal-paris")
  assert.equal(apostropheResolution.productLine?.id, "line-elvital")
  assert.equal(apostropheResolution.matchedText, "L'Oréal Paris Elvital")
  assert.equal(apostropheResolution.reason, "canonical_brand_with_line_inference")
})

test("alias collisions with canonical brand names are reported and excluded", () => {
  const catalog = buildBrandResolutionCatalog({
    brands: [
      { id: "brand-garnier", canonical_name: "Garnier", normalized_name: "garnier" },
      { id: "brand-fructis", canonical_name: "Fructis", normalized_name: "fructis" },
    ],
    productLines: [
      {
        id: "line-fructis",
        brand_id: "brand-garnier",
        canonical_name: "Fructis",
        normalized_name: "fructis",
      },
    ],
    brandAliases: [
      {
        brand_id: "brand-garnier",
        product_line_id: "line-fructis",
        alias: "Fructis",
        normalized_alias: "fructis",
      },
    ],
  })

  assert.deepEqual(
    catalog.conflicts.map((conflict) => conflict.normalizedAlias),
    ["fructis"],
  )

  const resolution = resolveBrandFromText("Fructis Shampoo", catalog)
  assert.equal(resolution.match, "brand")
  assert.equal(resolution.brand?.id, "brand-fructis")
  assert.equal(resolution.productLine, null)
  assert.equal(resolution.reason, "canonical_brand_exact")
})

test("line-specific aliases with missing product lines are excluded", () => {
  const catalog = buildBrandResolutionCatalog({
    brands: [
      {
        id: "brand-loreal-paris",
        canonical_name: "L'Oréal Paris",
        normalized_name: "loreal paris",
      },
    ],
    productLines: [],
    brandAliases: [
      {
        brand_id: "brand-loreal-paris",
        product_line_id: "line-elvital",
        alias: "Elvital",
        normalized_alias: "elvital",
      },
    ],
  })

  assert.equal(catalog.aliases.length, 0)

  const resolution = resolveBrandFromText("Elvital Dream Length Shampoo", catalog)
  assert.equal(resolution.match, "none")
  assert.equal(resolution.reason, "unresolved")
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

test("resolver handles corrected Phase A catalog aliases", () => {
  const catalog = buildBrandResolutionCatalog({
    brands: [
      {
        id: "brand-garnier",
        canonical_name: "Garnier",
        normalized_name: "garnier",
      },
      {
        id: "brand-gliss",
        canonical_name: "Schwarzkopf GLISS",
        normalized_name: "schwarzkopf gliss",
      },
      {
        id: "brand-monday",
        canonical_name: "MONDAY",
        normalized_name: "monday",
      },
      {
        id: "brand-loreal-paris",
        canonical_name: "L'Oréal Paris",
        normalized_name: "loreal paris",
      },
      {
        id: "brand-loreal-professionnel",
        canonical_name: "L'Oréal Professionnel",
        normalized_name: "loreal professionnel",
      },
      {
        id: "brand-balea",
        canonical_name: "Balea",
        normalized_name: "balea",
      },
    ],
    productLines: [
      {
        id: "line-fructis",
        brand_id: "brand-garnier",
        canonical_name: "Fructis",
        normalized_name: "fructis",
      },
      {
        id: "line-wahre",
        brand_id: "brand-garnier",
        canonical_name: "Wahre Schätze",
        normalized_name: "wahre schatze",
      },
      {
        id: "line-elvital",
        brand_id: "brand-loreal-paris",
        canonical_name: "Elvital",
        normalized_name: "elvital",
      },
      {
        id: "line-metal-dx",
        brand_id: "brand-loreal-professionnel",
        canonical_name: "Metal DX",
        normalized_name: "metal dx",
      },
      {
        id: "line-professional",
        brand_id: "brand-balea",
        canonical_name: "Professional",
        normalized_name: "professional",
      },
    ],
    brandAliases: [
      {
        brand_id: "brand-garnier",
        product_line_id: "line-fructis",
        alias: "Fructis",
        normalized_alias: "fructis",
      },
      {
        brand_id: "brand-garnier",
        product_line_id: "line-fructis",
        alias: "Garnier Hair Food",
        normalized_alias: "garnier hair food",
      },
      {
        brand_id: "brand-garnier",
        product_line_id: "line-wahre",
        alias: "Wahre Schätze",
        normalized_alias: "wahre schatze",
      },
      {
        brand_id: "brand-gliss",
        product_line_id: null,
        alias: "Glisskur",
        normalized_alias: "glisskur",
      },
      {
        brand_id: "brand-monday",
        product_line_id: null,
        alias: "Monday Haircare",
        normalized_alias: "monday haircare",
      },
      {
        brand_id: "brand-loreal-paris",
        product_line_id: null,
        alias: "L'Oréal",
        normalized_alias: "loreal",
      },
      {
        brand_id: "brand-loreal-paris",
        product_line_id: "line-elvital",
        alias: "Elvital",
        normalized_alias: "elvital",
      },
      {
        brand_id: "brand-loreal-professionnel",
        product_line_id: "line-metal-dx",
        alias: "Serie Expert Metal DX",
        normalized_alias: "serie expert metal dx",
      },
      {
        brand_id: "brand-balea",
        product_line_id: "line-professional",
        alias: "Balea Aqua",
        normalized_alias: "balea aqua",
      },
    ],
  })

  const fructis = resolveBrandFromText("Garnier Hair Food Aloe Vera", catalog)
  assert.equal(fructis.match, "brand_line")
  assert.equal(fructis.brand?.id, "brand-garnier")
  assert.equal(fructis.productLine?.id, "line-fructis")

  const wahre = resolveBrandFromText("Wahre Schätze Avocado", catalog)
  assert.equal(wahre.match, "brand_line")
  assert.equal(wahre.productLine?.id, "line-wahre")

  const gliss = resolveBrandFromText("Glisskur Liquid Silk", catalog)
  assert.equal(gliss.match, "brand")
  assert.equal(gliss.brand?.id, "brand-gliss")
  assert.equal(gliss.productLine, null)

  const monday = resolveBrandFromText("Monday Haircare Volume Shampoo", catalog)
  assert.equal(monday.match, "brand")
  assert.equal(monday.brand?.id, "brand-monday")

  const elvital = resolveBrandFromText("Elvital Öl Magique", catalog)
  assert.equal(elvital.match, "brand_line")
  assert.equal(elvital.productLine?.id, "line-elvital")

  const metalDx = resolveBrandFromText("Serie Expert Metal DX Shampoo", catalog)
  assert.equal(metalDx.match, "brand_line")
  assert.equal(metalDx.brand?.id, "brand-loreal-professionnel")
  assert.equal(metalDx.productLine?.id, "line-metal-dx")

  const balea = resolveBrandFromText("Balea Aqua Hyaluron", catalog)
  assert.equal(balea.match, "brand_line")
  assert.equal(balea.productLine?.id, "line-professional")
})
