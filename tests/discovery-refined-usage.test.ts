import assert from "node:assert/strict"
import test from "node:test"

import type { Stage1ProductExampleRolePreview } from "../src/lib/personal-plan/product-preview-contract"
import {
  stage3DecisionKey,
  type PersonalPlanCategory,
} from "../src/lib/personal-plan/products/contracts"
import type { PlanProductRole } from "../src/lib/personal-plan/types"
import type { DiscoveryIdealStep } from "../src/lib/discovery/load-ideal-routine"
import {
  composeDiscoveryRefinedRoutine,
  discoveryItemUsageLabel,
  reduceIntakeItemsToSteps,
  type DiscoveryCallDecision,
  type DiscoveryIntakeItem,
} from "../src/lib/discovery/refined-routine"
import type { ScanCatalogPresentationRow } from "../src/lib/scan/product-presentation"

/**
 * Batch 5 (plan Rev. 3, F4): a LEGACY finalized intake — tile model, no product type, no
 * usage role — must keep its exact fingerprint. The hash below was computed before batch 5
 * touched the composition (the composition at f8ab433a is main's 224c0d47 plus one optional
 * type field); it is pinned, not recomputed.
 */

function recommendation(
  category: PersonalPlanCategory,
  role: PlanProductRole,
  productId: string,
): Stage1ProductExampleRolePreview {
  return {
    kind: "recommendation",
    category,
    role,
    decisionKey: stage3DecisionKey(category, role, null),
    productId,
    productName: `Ideal ${role}`,
    imageUrl: "https://cdn.test/ideal.png",
    verdict: "ideal",
    authorityVersion: "personal-plan.test.v1",
    factFingerprint: "fingerprint",
    commerce: {
      priceEur: null,
      purchaseLinkStatus: null,
      netContentValue: null,
      netContentUnit: null,
      priceLabel: null,
      netContentLabel: null,
      availabilityLabel: null,
      productUrl: null,
      affiliateDisclosure: null,
    },
    reasoning: { productCriteria: "a", fit: "b", frequency: "c" },
  }
}

function step(
  category: PersonalPlanCategory,
  role: PlanProductRole,
  preview: Stage1ProductExampleRolePreview | null = null,
): DiscoveryIdealStep {
  return {
    decisionKey: stage3DecisionKey(category, role, null),
    category,
    role,
    section: "basis",
    categoryLabel: `Kategorie ${category}`,
    roleLabel: `Rolle ${role}`,
    roleDescription: `Beschreibung ${role}`,
    frequencyLabel: "2×/Woche",
    preview,
    depth: {
      purpose: "Warum",
      targetType: "Typ",
      productCriteria: "Kriterien",
      fit: "Passt",
      timingLabel: "Nach Shampoo",
    },
  }
}

export const LEGACY_STEPS: DiscoveryIdealStep[] = [
  step("shampoo", "shampoo_everyday", recommendation("shampoo", "shampoo_everyday", "p-ideal-sh")),
  step("conditioner", "conditioner_rinse_out"),
  step("oil", "pre_wash_fibre_treatment"),
  step("oil", "dry_finish", recommendation("oil", "dry_finish", "p-ideal-oil")),
  step("mask", "intensive_conditioning_mask"),
]

function legacyItem(overrides: Partial<DiscoveryIntakeItem> & { id: string }): DiscoveryIntakeItem {
  return {
    category: "shampoo",
    source: "catalog_search",
    brandText: "Marke",
    productNameText: "Produkt",
    barcodeIdentifier: null,
    productId: null,
    productSubmissionId: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    ...overrides,
  }
}

export const LEGACY_ITEMS: DiscoveryIntakeItem[] = [
  legacyItem({ id: "i-cond", category: "conditioner", productId: "p-cond" }),
  legacyItem({ id: "i-oil-1", category: "oil", productId: "p-oil-1" }),
  legacyItem({
    id: "i-oil-2",
    category: "oil",
    productId: "p-oil-2",
    createdAt: "2026-09-20T11:00:00.000Z",
  }),
  legacyItem({
    id: "i-oil-3",
    category: "oil",
    productId: "p-oil-3",
    createdAt: "2026-09-20T12:00:00.000Z",
  }),
  legacyItem({
    id: "i-research",
    category: "mask",
    source: "name_research",
    productSubmissionId: "s-1",
  }),
  legacyItem({
    id: "i-none",
    category: "dry_shampoo",
    source: "none",
    brandText: null,
    productNameText: null,
  }),
]

const LEGACY_DECISIONS: DiscoveryCallDecision[] = [
  {
    decisionKey: stage3DecisionKey("conditioner", "conditioner_rinse_out", null),
    decision: "keep",
    swapProductId: null,
    intakeItemId: "i-cond",
  },
  {
    decisionKey: stage3DecisionKey("oil", "pre_wash_fibre_treatment", null),
    decision: "swap",
    swapProductId: "p-swap",
    intakeItemId: "i-oil-1",
  },
]

function row(
  id: string,
  category: PersonalPlanCategory,
  brand: string,
): ScanCatalogPresentationRow {
  return {
    id,
    name: `Name ${id}`,
    brand,
    category,
    imageUrl: null,
    priceEur: null,
    currency: null,
    affiliateLink: null,
    purchaseLinkStatus: null,
    priceCheckedAt: null,
  }
}

export function composeLegacy(items: DiscoveryIntakeItem[] = LEGACY_ITEMS) {
  return composeDiscoveryRefinedRoutine({
    steps: LEGACY_STEPS,
    items,
    decisions: LEGACY_DECISIONS,
    swapProducts: [row("p-swap", "oil", "Swapmarke")],
    recommendationProducts: [row("p-ideal-sh", "shampoo", "Idealmarke")],
    ownedProducts: [
      { itemId: "i-cond", brand: "Katalogmarke", name: "Katalog Conditioner" },
      { itemId: "i-oil-1", brand: "Katalogmarke", name: "Katalog Öl" },
    ],
    productLines: new Map([["p-cond", "Linie"]]),
  })
}

const LEGACY_GOLDEN_HASH = "708bd65669a5f1c3fdc129944111730be4c3cad9a2fb309a9d50e279189d755c"

test("F4 golden: a legacy (tile-model) finalized routine keeps its exact sourceHash", () => {
  assert.equal(composeLegacy().sourceHash, LEGACY_GOLDEN_HASH)
})

test("F4: the legacy fixture's item objects carry no batch-5 keys at all", () => {
  const routine = composeLegacy()
  for (const entry of routine.steps) {
    assert.ok(!entry.item || !("usageRole" in entry.item))
    assert.ok(!entry.item || !("productType" in entry.item))
    assert.ok(!("ownedUsageLabel" in entry))
  }
  for (const entry of routine.unassignedIntakeProducts) assert.ok(!("usageLabel" in entry))
})

test("F4: a non-null usage role moves the fingerprint (and the binding)", () => {
  const withRole = LEGACY_ITEMS.map((item) =>
    item.id === "i-oil-2" ? { ...item, usageRole: "dry_finish" as const } : item,
  )
  const routine = composeLegacy(withRole)
  assert.notEqual(routine.sourceHash, LEGACY_GOLDEN_HASH)
  // i-oil-2 takes the dry-finish step; i-oil-3 is left without a step.
  const dry = routine.steps.find((entry) => entry.step.role === "dry_finish")
  assert.equal(dry?.item?.id, "i-oil-2")

  const otherRole = LEGACY_ITEMS.map((item) =>
    item.id === "i-oil-2" ? { ...item, usageRole: "pre_wash_fibre_treatment" as const } : item,
  )
  assert.notEqual(composeLegacy(otherRole).sourceHash, routine.sourceHash)
})

// --- Binding with usage roles -----------------------------------------------------

function flatItem(overrides: Partial<DiscoveryIntakeItem> & { id: string }): DiscoveryIntakeItem {
  return legacyItem({ productId: `p-${overrides.id}`, ...overrides })
}

function bindingOf(items: DiscoveryIntakeItem[]) {
  const reduction = reduceIntakeItemsToSteps(LEGACY_STEPS, items)
  return {
    steps: reduction.bindings.map((binding) => [
      binding.step.decisionKey,
      binding.item?.id ?? null,
    ]),
    unassigned: reduction.unassignedIntakeProducts.map((entry) => [entry.item.id, entry.reason]),
  }
}

const OIL_PRE = stage3DecisionKey("oil", "pre_wash_fibre_treatment", null)
const OIL_DRY = stage3DecisionKey("oil", "dry_finish", null)

test("an item with a usage role binds to exactly that (category, role) step, even if it ranks later", () => {
  const { steps } = bindingOf([
    flatItem({ id: "role-less", category: "oil", createdAt: "2026-09-20T09:00:00.000Z" }),
    flatItem({
      id: "dry",
      category: "oil",
      usageRole: "dry_finish",
      createdAt: "2026-09-20T12:00:00.000Z",
    }),
  ])
  assert.deepEqual(
    steps.filter(([key]) => key === OIL_PRE || key === OIL_DRY),
    [
      [OIL_PRE, "role-less"],
      [OIL_DRY, "dry"],
    ],
  )
})

test("a role item never falls back to another role's step; role-less items fill what is left", () => {
  const { steps, unassigned } = bindingOf([
    flatItem({ id: "dry-1", category: "oil", usageRole: "dry_finish" }),
    flatItem({
      id: "dry-2",
      category: "oil",
      usageRole: "dry_finish",
      createdAt: "2026-09-20T11:00:00.000Z",
    }),
    // The Idealplan has no damp-hair oil step at all.
    flatItem({ id: "damp", category: "oil", usageRole: "leave_on_fibre_conditioning" }),
  ])
  assert.deepEqual(
    steps.filter(([key]) => key === OIL_PRE || key === OIL_DRY),
    [
      [OIL_PRE, null],
      [OIL_DRY, "dry-1"],
    ],
  )
  assert.deepEqual(unassigned, [
    ["damp", "no_ideal_step"],
    ["dry-2", "no_ideal_step"],
  ])
})

test("an unknown usage binds nowhere: `category_unknown`, even with a catalog product", () => {
  const { steps, unassigned } = bindingOf([
    flatItem({ id: "open", category: null, productId: "p-open" }),
    flatItem({ id: "open-research", category: null, productId: null, source: "name_research" }),
  ])
  assert.ok(steps.every(([, itemId]) => itemId === null))
  assert.deepEqual(
    unassigned.map(([, reason]) => reason),
    ["category_unknown", "category_unknown"],
  )
})

// --- F6: usage ≠ product type on paper --------------------------------------------

test("F6: her product used as something else carries „als … benutzt“ — and it is fingerprinted", () => {
  const items = [
    flatItem({ id: "cond-as-mask", category: "mask", productType: "conditioner" }),
    flatItem({ id: "cond", category: "conditioner", productType: "conditioner" }),
    flatItem({
      id: "research-as-mask",
      category: "mask",
      productType: "leave_in",
      productId: null,
      source: "name_research",
    }),
  ]
  const routine = composeDiscoveryRefinedRoutine({
    steps: LEGACY_STEPS,
    items,
    decisions: [],
    swapProducts: [],
  })
  const mask = routine.steps.find((entry) => entry.step.category === "mask")
  assert.equal(mask?.item?.id, "cond-as-mask")
  assert.equal(mask?.ownedUsageLabel, "als Haarmaske benutzt")
  const conditioner = routine.steps.find((entry) => entry.step.category === "conditioner")
  assert.ok(!("ownedUsageLabel" in conditioner!), "same usage and type: no note, no key")
  assert.deepEqual(
    routine.unassignedIntakeProducts.map((entry) => [entry.item.id, entry.usageLabel]),
    [["research-as-mask", "als Haarmaske benutzt"]],
  )

  // The printed note is part of the hash: the same items with the note's source changed move it.
  const sameUsage = items.map((item) =>
    item.id === "cond-as-mask" ? { ...item, productType: "mask" as const } : item,
  )
  assert.notEqual(
    composeDiscoveryRefinedRoutine({
      steps: LEGACY_STEPS,
      items: sameUsage,
      decisions: [],
      swapProducts: [],
    }).sourceHash,
    routine.sourceHash,
  )
})

test("F6: the usage note needs both a usage and a product type, and never names a „none“ row", () => {
  const labels = { mask: "Haarmaske", conditioner: "Conditioner" } as never
  assert.equal(
    discoveryItemUsageLabel(
      { category: "mask", productType: "conditioner", source: "barcode" },
      labels,
    ),
    "als Haarmaske benutzt",
  )
  assert.equal(
    discoveryItemUsageLabel(
      { category: "mask", productType: undefined, source: "barcode" },
      labels,
    ),
    null,
  )
  assert.equal(
    discoveryItemUsageLabel(
      { category: null, productType: "conditioner", source: "barcode" },
      labels,
    ),
    null,
  )
  assert.equal(
    discoveryItemUsageLabel({ category: "mask", productType: "mask", source: "barcode" }, labels),
    null,
  )
  assert.equal(
    discoveryItemUsageLabel(
      { category: "mask", productType: "conditioner", source: "none" },
      labels,
    ),
    null,
  )
})
