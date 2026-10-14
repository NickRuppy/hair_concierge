import assert from "node:assert/strict"
import test from "node:test"

import { mapLegacyRefinementPrefill } from "../src/lib/personal-plan/legacy-prefill"

test("submitted but unrecognized night protection never becomes an explicit none answer", () => {
  assert.deepEqual(
    mapLegacyRefinementPrefill({
      profile: { nightProtection: ["old_unknown_value"], submittedFields: ["night_protection"] },
      usageRows: [],
    }).stage2Answers,
    {},
  )
})

test("maps only canonical saved profile facts and supported visible usage categories", () => {
  const result = mapLegacyRefinementPrefill({
    profile: {
      shampooFrequency: "weekly_3_4x",
      towelMaterial: "mikrofaser",
      towelTechnique: "gentle_press",
      dryingMethod: ["air_dry", "blow_dry_diffuser"],
      stylingTools: ["flat_iron", "thermal_rollers"],
      nightProtection: ["silk_satin_bonnet"],
    },
    usageRows: [
      { id: "shampoo", category: "shampoo", productName: "Clean", frequencyRange: "weekly_3_4x" },
      {
        id: "fallback",
        category: "shampoo",
        productName: "__system_no_shampoo_selected__",
        frequencyRange: "less_than_monthly",
      },
      {
        id: "unknown",
        category: "something_else",
        productName: "Ignored",
        frequencyRange: "weekly_1x",
      },
    ],
  })

  assert.deepEqual(result.stage2Answers, {
    currentProductCategories: ["shampoo"],
    wetWashFrequency: "weekly_3_4x",
    towel: { material: "mikrofaser", technique: "gentle_press" },
    dryingRoutes: ["air_dry", "diffuser_or_airflow_shaping"],
    additionalHeatTools: ["straightener", "thermal_rollers"],
    nightProtection: ["silk_satin_bonnet"],
  })
  assert.deepEqual(result.sourceIds, ["fallback", "shampoo", "unknown"])
})

test("keeps partial and ambiguous legacy facts unanswered and only permits empty arrays with submitted evidence", () => {
  const result = mapLegacyRefinementPrefill({
    profile: {
      shampooFrequency: "every_2_3_days",
      towelMaterial: "frottee",
      towelTechnique: "not-a-technique",
      dryingMethod: "unknown",
      stylingTools: ["multi_tool", "flat_iron"],
      nightProtection: [],
      submittedFields: ["night_protection"],
    },
    usageRows: [],
  })

  assert.deepEqual(result.stage2Answers, {
    towel: { material: "frottee" },
    additionalHeatTools: ["straightener"],
    nightProtection: [],
  })
})

test("does not map historical empty defaults without independent submitted evidence", () => {
  const result = mapLegacyRefinementPrefill({
    profile: { stylingTools: [], nightProtection: [] },
    usageRows: [],
  })

  assert.deepEqual(result.stage2Answers, {})
})

test("maps a confirmed empty styling-tools answer but not a mixed unknown array", () => {
  const confirmedEmpty = mapLegacyRefinementPrefill({
    profile: { stylingTools: [], submittedFields: ["styling_tools"] },
    usageRows: [],
  })
  const mixedUnknown = mapLegacyRefinementPrefill({
    profile: { stylingTools: ["flat_iron", "unknown_tool"] },
    usageRows: [],
  })

  assert.deepEqual(confirmedEmpty.stage2Answers, { additionalHeatTools: [] })
  assert.deepEqual(mixedUnknown.stage2Answers, { additionalHeatTools: ["straightener"] })
})

test("separates verified exact inventory from frequency-repair and name hints", () => {
  const result = mapLegacyRefinementPrefill({
    profile: {},
    usageRows: [
      {
        id: "exact",
        category: "conditioner",
        productName: "Exact conditioner",
        frequencyRange: "weekly_2x",
        catalogMatch: {
          productId: "catalog-1",
          displayName: "Exact conditioner",
          category: "conditioner",
          eligible: true,
        },
      },
      {
        id: "needs-frequency",
        category: "oil",
        productName: "Exact oil",
        frequencyRange: "old_range",
        catalogMatch: {
          productId: "catalog-2",
          displayName: "Exact oil",
          category: "oil",
          eligible: true,
        },
      },
      {
        id: "retired",
        category: "mask",
        productName: "Old mask",
        frequencyRange: "weekly_1x",
        catalogMatch: {
          productId: "catalog-3",
          displayName: "Old mask",
          category: "mask",
          eligible: false,
        },
      },
      {
        id: "name-only",
        category: "leave_in",
        productName: "Known only by name",
        frequencyRange: null,
      },
    ],
  })

  assert.deepEqual(result.exactInventory, [
    {
      usageId: "exact",
      productId: "catalog-1",
      displayName: "Exact conditioner",
      category: "conditioner",
      frequencyRange: "weekly_2x",
    },
  ])
  assert.deepEqual(result.productHints, [
    {
      kind: "catalog_frequency_required",
      usageId: "needs-frequency",
      productId: "catalog-2",
      displayName: "Exact oil",
      category: "oil",
    },
    { kind: "search_name", usageId: "retired", category: "mask", productName: "Old mask" },
    {
      kind: "search_name",
      usageId: "name-only",
      category: "leave_in",
      productName: "Known only by name",
    },
  ])
})

test("never trusts a mismatched catalog category and has a stable source fingerprint", () => {
  const input = {
    profile: {},
    usageRows: [
      {
        id: "wrong-category",
        category: "shampoo",
        productName: "Product",
        frequencyRange: "weekly_1x",
        catalogMatch: {
          productId: "catalog-4",
          displayName: "Product",
          category: "conditioner",
          eligible: true,
        },
      },
    ],
  } as const

  const first = mapLegacyRefinementPrefill(input)
  const second = mapLegacyRefinementPrefill(input)
  assert.deepEqual(first.exactInventory, [])
  assert.deepEqual(first.productHints, [
    { kind: "search_name", usageId: "wrong-category", category: "shampoo", productName: "Product" },
  ])
  assert.equal(first.sourceFingerprint, second.sourceFingerprint)
  assert.match(first.sourceFingerprint, /^legacy-prefill-v1:sha256:[a-f0-9]{64}$/)
})

test("fingerprints equivalent input independently of property and row order", () => {
  const first = mapLegacyRefinementPrefill({
    profile: { shampooFrequency: "weekly_2x", towelMaterial: "tshirt" },
    usageRows: [
      { id: "a", category: "shampoo", productName: "A", frequencyRange: "weekly_2x" },
      { id: "b", category: "mask", productName: "B", frequencyRange: "weekly_1x" },
    ],
  })
  const second = mapLegacyRefinementPrefill({
    profile: { towelMaterial: "tshirt", shampooFrequency: "weekly_2x" },
    usageRows: [
      { frequencyRange: "weekly_1x", productName: "B", category: "mask", id: "b" },
      { frequencyRange: "weekly_2x", productName: "A", category: "shampoo", id: "a" },
    ],
  })

  assert.equal(first.sourceFingerprint, second.sourceFingerprint)
  assert.match(first.sourceFingerprint, /^legacy-prefill-v1:sha256:[a-f0-9]{64}$/)
})

test("conflicting duplicate frequencies become a repair hint instead of an arbitrary exact seed", () => {
  const result = mapLegacyRefinementPrefill({
    profile: {},
    usageRows: [
      {
        id: "first",
        category: "conditioner",
        productName: "Same product",
        frequencyRange: "weekly_1x",
        catalogMatch: {
          productId: "catalog-1",
          displayName: "Same product",
          category: "conditioner",
          eligible: true,
        },
      },
      {
        id: "second",
        category: "conditioner",
        productName: "Same product",
        frequencyRange: "weekly_3_4x",
        catalogMatch: {
          productId: "catalog-1",
          displayName: "Same product",
          category: "conditioner",
          eligible: true,
        },
      },
    ],
  })

  assert.deepEqual(result.exactInventory, [])
  assert.deepEqual(result.productHints, [
    {
      kind: "catalog_frequency_required",
      usageId: "first",
      productId: "catalog-1",
      displayName: "Same product",
      category: "conditioner",
    },
  ])
})
