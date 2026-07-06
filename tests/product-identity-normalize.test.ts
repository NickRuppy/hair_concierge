import assert from "node:assert/strict"
import test from "node:test"

import {
  KNOWN_PRODUCT_CATEGORY_KEYS,
  PRODUCT_CATEGORY_DISPLAY_LABELS,
  SUPPORTED_PRODUCT_CATEGORY_KEYS,
  cleanProductDisplayName,
  normalizeIdentityText,
  normalizeCategoryKey,
  normalizeIdentifier,
  normalizeText,
  tokenizeProductName,
} from "../src/lib/product-identity"

test("canonical category constants include supported and known unsupported keys", () => {
  assert.deepEqual(SUPPORTED_PRODUCT_CATEGORY_KEYS, [
    "shampoo",
    "conditioner",
    "leave_in",
    "mask",
    "oil",
    "dry_shampoo",
    "deep_cleansing_shampoo",
    "bondbuilder",
  ])

  assert.equal(KNOWN_PRODUCT_CATEGORY_KEYS.includes("heat_protectant"), true)
  assert.equal(KNOWN_PRODUCT_CATEGORY_KEYS.includes("hairspray"), true)
  assert.equal(PRODUCT_CATEGORY_DISPLAY_LABELS.leave_in, "Leave-in")
})

test("normalizeCategoryKey maps production labels, canonical keys, and simple oil aliases", () => {
  assert.equal(normalizeCategoryKey("Shampoo"), "shampoo")
  assert.equal(normalizeCategoryKey("Conditioner (Drogerie)"), "conditioner")
  assert.equal(normalizeCategoryKey("Leave-in"), "leave_in")
  assert.equal(normalizeCategoryKey("Maske"), "mask")
  assert.equal(normalizeCategoryKey("Öle"), "oil")
  assert.equal(normalizeCategoryKey("Trockenshampoo"), "dry_shampoo")
  assert.equal(normalizeCategoryKey("Tiefenreinigungsshampoo"), "deep_cleansing_shampoo")
  assert.equal(normalizeCategoryKey("Bondbuilder"), "bondbuilder")
  assert.equal(normalizeCategoryKey("Hitzeschutz"), "heat_protectant")
  assert.equal(normalizeCategoryKey("Serum"), "serum")
  assert.equal(normalizeCategoryKey("Scrub"), "scrub")
  assert.equal(normalizeCategoryKey("Peeling"), "peeling")
  assert.equal(normalizeCategoryKey("Styling-Gel"), "styling_gel")
  assert.equal(normalizeCategoryKey("Styling Mousse"), "styling_mousse")
  assert.equal(normalizeCategoryKey("Styling-Creme"), "styling_cream")
  assert.equal(normalizeCategoryKey("Haarspray"), "hairspray")
  assert.equal(normalizeCategoryKey("dry_shampoo"), "dry_shampoo")
  assert.equal(normalizeCategoryKey("Deep Cleansing Shampoo"), "deep_cleansing_shampoo")
  assert.equal(normalizeCategoryKey("Öl"), "oil")
  assert.equal(normalizeCategoryKey("Oele"), "oil")
  assert.equal(normalizeCategoryKey("Ole"), "oil")
  assert.equal(normalizeCategoryKey("Unbekannt"), null)
})

test("normalizeText folds accents, punctuation, case, and spacing", () => {
  assert.equal(normalizeText("  Öl / Leave-in -- Nº 5  "), "ol leave in no 5")
  assert.equal(normalizeText("Tiefenreinigungs-Shampoo"), "tiefenreinigungs shampoo")
})

test("normalizeIdentityText is stable for case, whitespace, punctuation, and safe diacritics", () => {
  assert.equal(normalizeIdentityText("  OLAPLEX   Nº. 5 -- Leave-In  "), "olaplex no 5 leave in")
  assert.equal(
    normalizeIdentityText("OLAPLEX N°5 Bond Maintenance"),
    "olaplex no 5 bond maintenance",
  )
  assert.equal(normalizeIdentityText("Olaplex No 5 Leave In"), "olaplex no 5 leave in")
  assert.equal(normalizeIdentityText("Garnier Fructis / Hair-Food"), "garnier fructis hair food")
})

test("normalizeIdentityText matches L'Oreal variants without broad unsafe rewrites", () => {
  assert.equal(normalizeIdentityText("L'Oréal"), "loreal")
  assert.equal(normalizeIdentityText("L’Oréal"), "loreal")
  assert.equal(normalizeIdentityText("LʼOréal"), "loreal")
  assert.equal(normalizeIdentityText("Loreal"), "loreal")
})

test("normalizeIdentifier returns stable snake-case identifiers", () => {
  assert.equal(normalizeIdentifier("Deep Cleansing Shampoo"), "deep_cleansing_shampoo")
  assert.equal(normalizeIdentifier("  Öle + Pflege  "), "ole_pflege")
  assert.equal(normalizeIdentifier("leave_in"), "leave_in")
  assert.equal(normalizeIdentifier(null), "")
  assert.equal(normalizeIdentifier(undefined), "")
})

test("tokenizeProductName returns normalized searchable product-name tokens", () => {
  assert.deepEqual(tokenizeProductName("Garnier Fructis Hair-Food Aloe"), [
    "garnier",
    "fructis",
    "hair",
    "food",
    "aloe",
  ])
  assert.deepEqual(tokenizeProductName("L'Oréal Professionnel"), ["loreal", "professionnel"])
  assert.deepEqual(tokenizeProductName("OLAPLEX No. 5"), ["olaplex", "no", "5"])
})

test("cleanProductDisplayName removes exact brand and product line prefixes conservatively", () => {
  assert.equal(
    cleanProductDisplayName("Olaplex No. 5 Leave-In Conditioner", {
      brand: "Olaplex",
      productLine: "No. 5",
    }),
    "Leave-In Conditioner",
  )

  assert.equal(
    cleanProductDisplayName("Olaplex Bond Maintenance Shampoo", {
      brand: "Olaplex",
      productLine: "No. 5",
    }),
    "Bond Maintenance Shampoo",
  )

  assert.equal(
    cleanProductDisplayName("The Ordinary Ordinary Shampoo", {
      brand: "Ordinary",
    }),
    "The Ordinary Ordinary Shampoo",
  )

  assert.equal(
    cleanProductDisplayName("Olaplexx No. 5 Leave-In Conditioner", {
      brand: "Olaplex",
      productLine: "No. 5",
    }),
    "Olaplexx No. 5 Leave-In Conditioner",
  )

  assert.equal(
    cleanProductDisplayName("L'Oréal Paris Elvital Dream Length", {
      brand: "Loreal Paris",
      productLine: "Elvital",
    }),
    "Dream Length",
  )
})
