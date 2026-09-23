import assert from "node:assert/strict"
import test from "node:test"

import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import { CATEGORY_LABELS, frequencyLabel } from "../src/lib/personal-plan/decision-presentation"
import { stage1PreviewedRoleDecisionKeys } from "../src/lib/personal-plan/product-previews"
import type { Stage1ProductExampleRolePreview } from "../src/lib/personal-plan/product-preview-contract"
import { stage3DecisionKey } from "../src/lib/personal-plan/products/contracts"
import {
  routinePurposeLabel,
  routineRolePurposeDescription,
} from "../src/lib/personal-plan/routine/labels"
import type {
  InitialNeedPlanSnapshot,
  PlanCategoryDecision,
  PlanProductRole,
} from "../src/lib/personal-plan/types"
import { buildDiscoveryIdealSteps } from "../src/lib/discovery/load-ideal-routine"
import {
  composeDiscoveryRefinedRoutine,
  reduceIntakeItemsToSteps,
  type DiscoveryCallDecision,
  type DiscoveryIntakeItem,
} from "../src/lib/discovery/refined-routine"
import type { ScanCatalogPresentationRow } from "../src/lib/scan/product-presentation"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

function decision(overrides: Partial<PlanCategoryDecision> = {}): PlanCategoryDecision {
  return {
    category: "oil",
    resolution: "resolved",
    needTier: "basis",
    roles: ["pre_wash_fibre_treatment"],
    target: { category: "oil" } as never,
    frequency: null,
    reasons: [],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
    ...overrides,
  }
}

function snapshotOf(decisions: PlanCategoryDecision[]): InitialNeedPlanSnapshot {
  return {
    schemaVersion: 1,
    snapshotKind: "initial_need",
    computationVersion: "stage1-v1",
    inputHash: "input-hash",
    createdAt: "2026-09-22T00:00:00.000Z",
    sourceQuiz: {} as never,
    profile: { hair: { thickness: "normal" } } as never,
    assessments: {} as never,
    decisions,
    coverage: [],
    productPreviews: [],
    renderedOrder: decisions.map((entry) => entry.category),
    deferredFacts: [],
  }
}

function recommendationPreview(
  category: string,
  role: PlanProductRole,
  productId: string,
): Stage1ProductExampleRolePreview {
  return {
    kind: "recommendation",
    category: category as never,
    role,
    decisionKey: stage3DecisionKey(category as never, role, null),
    productId,
    productName: `Ideal ${role}`,
    imageUrl: "https://cdn.test/ideal.png",
    verdict: "ideal",
    authorityVersion: "personal-plan.oil.v2",
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

function fallbackPreview(category: string, role: PlanProductRole): Stage1ProductExampleRolePreview {
  return {
    kind: "fallback",
    category: category as never,
    role,
    decisionKey: stage3DecisionKey(category as never, role, null),
    authorityVersion: "personal-plan.oil.v2",
    fallback: "post_refinement",
  }
}

function item(overrides: Partial<DiscoveryIntakeItem> & { id: string }): DiscoveryIntakeItem {
  return {
    category: "oil",
    source: "catalog_search",
    brandText: null,
    productNameText: null,
    barcodeIdentifier: null,
    productId: null,
    productSubmissionId: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    ...overrides,
  }
}

const OIL_ROLES: PlanProductRole[] = [
  "pre_wash_fibre_treatment",
  "leave_on_fibre_conditioning",
  "dry_finish",
]

function oilSteps() {
  const oil = decision({ category: "oil", roles: OIL_ROLES })
  return buildDiscoveryIdealSteps(
    snapshotOf([oil]),
    OIL_ROLES.map((role) => fallbackPreview("oil", role)),
  )
}

test("ideal steps mirror exactly the roles Stage 1 previews — the drift net against stage1PreviewedRoleDecisionKeys", () => {
  const computed = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-09-22T10:00:00.000Z",
  })
  assert.equal(computed.status, "ready")
  if (computed.status !== "ready") throw new Error("expected a ready snapshot")
  const snapshot = computed.snapshot

  const steps = buildDiscoveryIdealSteps(snapshot, [])
  assert.ok(steps.length > 0, "fixture must produce at least one previewed role")
  assert.deepEqual(
    new Set(steps.map((step) => step.decisionKey)),
    stage1PreviewedRoleDecisionKeys(snapshot),
  )
  assert.equal(new Set(steps.map((step) => step.decisionKey)).size, steps.length)
})

test("ideal steps follow renderedOrder then the category's allowedRoles order, and carry German labels from the shared helpers", () => {
  const oil = decision({ category: "oil", roles: ["dry_finish", "pre_wash_fibre_treatment"] })
  const mask = decision({
    category: "mask",
    roles: ["intensive_conditioning_mask"],
    needTier: "optional",
    target: { category: "mask" } as never,
  })
  const snapshot = { ...snapshotOf([oil, mask]), renderedOrder: ["mask", "oil"] as never }

  const steps = buildDiscoveryIdealSteps(snapshot, [])

  assert.deepEqual(
    steps.map((step) => [step.category, step.role]),
    [
      ["mask", "intensive_conditioning_mask"],
      // allowedRoles order wins over the decision's own role order.
      ["oil", "pre_wash_fibre_treatment"],
      ["oil", "dry_finish"],
    ],
  )
  assert.equal(steps[0]!.section, "optional")
  assert.equal(steps[1]!.section, "basis")
  assert.equal(steps[0]!.categoryLabel, CATEGORY_LABELS.mask)
  assert.equal(steps[0]!.roleLabel, routinePurposeLabel("intensive_conditioning_mask"))
  assert.equal(
    steps[0]!.roleDescription,
    routineRolePurposeDescription("intensive_conditioning_mask"),
  )
  assert.equal(steps[0]!.frequencyLabel, frequencyLabel(mask.frequency, false))
})

test("ideal steps skip the decisions Stage 1 never previews: not_needed, deferred and target-less", () => {
  const notNeeded = decision({ category: "oil", needTier: "not_needed" })
  const deferred = decision({
    category: "mask",
    resolution: "deferred_until_post_plan_onboarding",
    target: { category: "mask" } as never,
    roles: ["intensive_conditioning_mask"],
  })
  const targetless = decision({
    category: "bondbuilder",
    target: null,
    roles: ["bond_repair"] as never,
  })

  assert.deepEqual(buildDiscoveryIdealSteps(snapshotOf([notNeeded, deferred, targetless]), []), [])
})

test("ideal steps attach the matching role preview and leave a role without one at null", () => {
  const oil = decision({ category: "oil", roles: OIL_ROLES })
  const steps = buildDiscoveryIdealSteps(snapshotOf([oil]), [
    recommendationPreview("oil", "dry_finish", "product-dry"),
    fallbackPreview("oil", "pre_wash_fibre_treatment"),
  ])

  assert.equal(steps[0]!.preview?.kind, "fallback")
  assert.equal(steps[1]!.preview, null)
  assert.equal(steps[2]!.preview?.kind, "recommendation")
})

test("binding is positional per category: three oil roles, two owned products, one open step", () => {
  const steps = oilSteps()
  const reduction = reduceIntakeItemsToSteps(steps, [
    item({ id: "item-a", productId: "product-a", createdAt: "2026-09-20T09:00:00.000Z" }),
    item({ id: "item-b", productId: "product-b", createdAt: "2026-09-20T11:00:00.000Z" }),
  ])

  assert.deepEqual(
    reduction.bindings.map((binding) => [binding.step.role, binding.item?.id ?? null]),
    [
      ["pre_wash_fibre_treatment", "item-a"],
      ["leave_on_fibre_conditioning", "item-b"],
      ["dry_finish", null],
    ],
  )
  assert.deepEqual(reduction.unassignedIntakeProducts, [])
})

test("binding order is (resolved product first, source rank, created_at, id) and independent of input order", () => {
  const steps = oilSteps()
  const items = [
    item({
      id: "item-name",
      source: "name_research",
      productId: "product-name",
      createdAt: "2026-09-20T08:00:00.000Z",
    }),
    item({
      id: "item-barcode",
      source: "barcode",
      productId: "product-barcode",
      createdAt: "2026-09-20T12:00:00.000Z",
    }),
    item({
      id: "item-catalog",
      source: "catalog_search",
      productId: "product-catalog",
      createdAt: "2026-09-20T09:00:00.000Z",
    }),
  ]

  const forward = reduceIntakeItemsToSteps(steps, items)
  const reversed = reduceIntakeItemsToSteps(steps, [...items].reverse())

  // barcode outranks catalog_search outranks name_research, regardless of created_at.
  assert.deepEqual(
    forward.bindings.map((binding) => binding.item?.id ?? null),
    ["item-barcode", "item-catalog", "item-name"],
  )
  assert.deepEqual(forward, reversed)
})

test("an item with no resolved product never binds and never gets a step — it is research pending", () => {
  const steps = oilSteps()
  const reduction = reduceIntakeItemsToSteps(steps, [
    item({ id: "item-open", source: "name_research", productNameText: "Irgendein Öl" }),
    item({ id: "item-bound", productId: "product-a" }),
  ])

  assert.deepEqual(
    reduction.bindings.map((binding) => binding.item?.id ?? null),
    ["item-bound", null, null],
  )
  assert.deepEqual(
    reduction.unassignedIntakeProducts.map((entry) => [entry.item.id, entry.reason]),
    [["item-open", "research_pending"]],
  )
})

test("surplus items past the category's last step are unassigned, not silently dropped", () => {
  const steps = oilSteps()
  const reduction = reduceIntakeItemsToSteps(steps, [
    item({ id: "item-1", productId: "p1", createdAt: "2026-09-20T01:00:00.000Z" }),
    item({ id: "item-2", productId: "p2", createdAt: "2026-09-20T02:00:00.000Z" }),
    item({ id: "item-3", productId: "p3", createdAt: "2026-09-20T03:00:00.000Z" }),
    item({ id: "item-4", productId: "p4", createdAt: "2026-09-20T04:00:00.000Z" }),
    item({ id: "item-5", category: "mask", productId: "p5" }),
  ])

  assert.deepEqual(
    reduction.unassignedIntakeProducts.map((entry) => [entry.item.id, entry.reason]),
    [
      ["item-4", "no_ideal_step"],
      // A whole category the Idealplan has no step for lands here too.
      ["item-5", "no_ideal_step"],
    ],
  )
})

test('„benutze ich nicht" is an explicit answer, not an unassigned product', () => {
  const steps = oilSteps()
  const reduction = reduceIntakeItemsToSteps(steps, [
    item({ id: "item-none", source: "none" }),
    item({ id: "item-none-mask", category: "mask", source: "none" }),
  ])

  assert.deepEqual(reduction.unassignedIntakeProducts, [])
  assert.deepEqual(
    reduction.bindings.map((binding) => binding.item),
    [null, null, null],
  )
  assert.deepEqual(reduction.declinedCategories, ["mask", "oil"])
})

test("zero intake leaves every ideal step open", () => {
  const steps = oilSteps()
  const reduction = reduceIntakeItemsToSteps(steps, [])
  assert.equal(reduction.bindings.length, 3)
  assert.ok(reduction.bindings.every((binding) => binding.item === null))
  assert.deepEqual(reduction.unassignedIntakeProducts, [])
  assert.deepEqual(reduction.declinedCategories, [])
})

function swapRow(id: string): ScanCatalogPresentationRow {
  return {
    id,
    name: "Swap Öl",
    brand: "Marke",
    category: "oil",
    imageUrl: null,
    priceEur: 19,
    currency: "EUR",
    affiliateLink: null,
    purchaseLinkStatus: null,
    priceCheckedAt: null,
  }
}

function callDecision(
  decisionKey: string,
  overrides: Partial<DiscoveryCallDecision> = {},
): DiscoveryCallDecision {
  return { decisionKey, decision: "keep", swapProductId: null, intakeItemId: null, ...overrides }
}

test("composed outcomes: kept, swapped, undecided for an owned product, ideal for an open step", () => {
  const oil = decision({ category: "oil", roles: OIL_ROLES })
  const steps = buildDiscoveryIdealSteps(snapshotOf([oil]), [
    recommendationPreview("oil", "pre_wash_fibre_treatment", "ideal-1"),
    fallbackPreview("oil", "leave_on_fibre_conditioning"),
    recommendationPreview("oil", "dry_finish", "ideal-3"),
  ])
  const items = [
    item({ id: "item-a", productId: "product-a", createdAt: "2026-09-20T01:00:00.000Z" }),
    item({ id: "item-b", productId: "product-b", createdAt: "2026-09-20T02:00:00.000Z" }),
  ]

  const routine = composeDiscoveryRefinedRoutine({
    steps,
    items,
    decisions: [
      callDecision(steps[0]!.decisionKey),
      callDecision(steps[1]!.decisionKey, { decision: "swap", swapProductId: "swap-1" }),
    ],
    swapProducts: [swapRow("swap-1")],
  })

  assert.deepEqual(
    routine.steps.map((step) => [step.step.role, step.outcome, step.item?.id ?? null]),
    [
      ["pre_wash_fibre_treatment", "kept", "item-a"],
      ["leave_on_fibre_conditioning", "swapped", "item-b"],
      ["dry_finish", "ideal", null],
    ],
  )
  assert.equal(routine.steps[1]!.swapProduct?.id, "swap-1")
  assert.equal(routine.steps[0]!.swapProduct, null)
  assert.equal(routine.steps[0]!.step.preview?.kind, "recommendation")
  assert.equal(routine.steps[1]!.step.preview?.kind, "fallback")

  const undecided = composeDiscoveryRefinedRoutine({
    steps,
    items,
    decisions: [],
    swapProducts: [],
  })
  assert.deepEqual(
    undecided.steps.map((step) => step.outcome),
    ["undecided", "undecided", "ideal"],
  )
})

test("a decision on a step the participant owns nothing for still resolves, with a null product", () => {
  const steps = oilSteps()
  const routine = composeDiscoveryRefinedRoutine({
    steps,
    items: [],
    decisions: [callDecision(steps[2]!.decisionKey, { decision: "swap", swapProductId: "swap-9" })],
    swapProducts: [swapRow("swap-9")],
  })

  assert.deepEqual(
    routine.steps.map((step) => [step.outcome, step.item?.id ?? null]),
    [
      ["ideal", null],
      ["ideal", null],
      ["swapped", null],
    ],
  )
  assert.equal(routine.steps[2]!.swapProduct?.id, "swap-9")
})

test("a swap whose catalog row was not supplied keeps the outcome but carries no product", () => {
  const steps = oilSteps()
  const routine = composeDiscoveryRefinedRoutine({
    steps,
    items: [item({ id: "item-a", productId: "product-a" })],
    decisions: [callDecision(steps[0]!.decisionKey, { decision: "swap", swapProductId: "gone" })],
    swapProducts: [],
  })

  assert.equal(routine.steps[0]!.outcome, "swapped")
  assert.equal(routine.steps[0]!.swapProduct, null)
})

test("a decision key no ideal step carries is ignored rather than inventing a step", () => {
  const steps = oilSteps()
  const routine = composeDiscoveryRefinedRoutine({
    steps,
    items: [],
    decisions: [callDecision("decision:shampoo:shampoo_everyday:gap")],
    swapProducts: [],
  })

  assert.equal(routine.steps.length, 3)
  assert.ok(routine.steps.every((step) => step.outcome === "ideal"))
})

test("the composed routine surfaces unassigned intake products and declined categories", () => {
  const steps = oilSteps()
  const routine = composeDiscoveryRefinedRoutine({
    steps,
    items: [
      item({ id: "item-open", source: "name_research", productNameText: "Unbekannt" }),
      item({ id: "item-none", category: "mask", source: "none" }),
    ],
    decisions: [],
    swapProducts: [],
  })

  assert.deepEqual(
    routine.unassignedIntakeProducts.map((entry) => [entry.item.id, entry.reason]),
    [["item-open", "research_pending"]],
  )
  assert.deepEqual(routine.declinedCategories, ["mask"])
})

test("sourceHash is order-independent and changes when the routine's content changes", () => {
  const steps = oilSteps()
  const items = [
    item({ id: "item-a", productId: "product-a", createdAt: "2026-09-20T01:00:00.000Z" }),
    item({ id: "item-b", productId: "product-b", createdAt: "2026-09-20T02:00:00.000Z" }),
  ]
  const decisions = [
    callDecision(steps[0]!.decisionKey),
    callDecision(steps[1]!.decisionKey, { decision: "swap", swapProductId: "swap-1" }),
  ]
  const swapProducts = [swapRow("swap-1")]

  const base = composeDiscoveryRefinedRoutine({ steps, items, decisions, swapProducts })
  const shuffled = composeDiscoveryRefinedRoutine({
    steps,
    items: [...items].reverse(),
    decisions: [...decisions].reverse(),
    swapProducts,
  })
  assert.equal(base.sourceHash, shuffled.sourceHash)
  assert.match(base.sourceHash, /^[0-9a-f]{64}$/)

  const driftedDecision = composeDiscoveryRefinedRoutine({
    steps,
    items,
    decisions: [callDecision(steps[0]!.decisionKey)],
    swapProducts,
  })
  assert.notEqual(base.sourceHash, driftedDecision.sourceHash)

  // The swap TARGET must move the hash even when neither catalog row could be read —
  // otherwise swap→A and swap→B fingerprint identically and the PDF's drift banner stays
  // silent on a real change.
  const swapToA = composeDiscoveryRefinedRoutine({
    steps,
    items,
    decisions: [callDecision(steps[0]!.decisionKey, { decision: "swap", swapProductId: "swap-a" })],
    swapProducts: [],
  })
  const swapToB = composeDiscoveryRefinedRoutine({
    steps,
    items,
    decisions: [callDecision(steps[0]!.decisionKey, { decision: "swap", swapProductId: "swap-b" })],
    swapProducts: [],
  })
  assert.equal(swapToA.steps[0]!.swapProduct, null)
  assert.equal(swapToB.steps[0]!.swapProduct, null)
  assert.equal(swapToA.steps[0]!.swapProductId, "swap-a")
  assert.equal(swapToB.steps[0]!.swapProductId, "swap-b")
  assert.notEqual(swapToA.sourceHash, swapToB.sourceHash)

  const driftedCatalog = composeDiscoveryRefinedRoutine({
    steps,
    items,
    decisions,
    swapProducts: [{ ...swapRow("swap-1"), priceEur: 24 }],
  })
  assert.notEqual(base.sourceHash, driftedCatalog.sourceHash)

  const driftedIdeal = composeDiscoveryRefinedRoutine({
    steps: buildDiscoveryIdealSteps(snapshotOf([decision({ category: "oil", roles: OIL_ROLES })]), [
      recommendationPreview("oil", "pre_wash_fibre_treatment", "ideal-other"),
    ]),
    items,
    decisions,
    swapProducts,
  })
  assert.notEqual(base.sourceHash, driftedIdeal.sourceHash)
})

test("the rendered recommendation brand is part of sourceHash, and only where it renders", () => {
  const oil = decision({ category: "oil", roles: OIL_ROLES })
  const steps = buildDiscoveryIdealSteps(snapshotOf([oil]), [
    recommendationPreview("oil", "pre_wash_fibre_treatment", "ideal-1"),
  ])
  const withBrand = (brand: string | null) => [{ ...swapRow("ideal-1"), brand }]

  // An open step: the recommendation is what the PDF prints, brand included.
  const brandA = composeDiscoveryRefinedRoutine({
    steps,
    items: [],
    decisions: [],
    swapProducts: [],
    recommendationProducts: withBrand("Marke A"),
  })
  const brandB = composeDiscoveryRefinedRoutine({
    steps,
    items: [],
    decisions: [],
    swapProducts: [],
    recommendationProducts: withBrand("Marke B"),
  })
  assert.equal(brandA.steps[0]!.outcome, "ideal")
  assert.equal(brandA.steps[0]!.recommendationLabel, "Marke A Ideal pre_wash_fibre_treatment")
  assert.notEqual(brandA.sourceHash, brandB.sourceHash)

  // A kept step does not print the recommendation, so its brand must not move the hash.
  const keptItems = [item({ id: "item-a", productId: "product-a" })]
  const keptDecisions = [callDecision(steps[0]!.decisionKey)]
  const keptA = composeDiscoveryRefinedRoutine({
    steps,
    items: keptItems,
    decisions: keptDecisions,
    swapProducts: [],
    recommendationProducts: withBrand("Marke A"),
  })
  const keptB = composeDiscoveryRefinedRoutine({
    steps,
    items: keptItems,
    decisions: keptDecisions,
    swapProducts: [],
    recommendationProducts: withBrand("Marke B"),
  })
  assert.equal(keptA.steps[0]!.outcome, "kept")
  assert.equal(keptA.steps[0]!.recommendationLabel, null)
  assert.equal(keptA.sourceHash, keptB.sourceHash)
})

test("sourceHash follows the printed label, not the brand's raw spelling", () => {
  const oil = decision({ category: "oil", roles: OIL_ROLES })
  const preview = recommendationPreview("oil", "pre_wash_fibre_treatment", "ideal-1")
  assert.equal(preview.kind, "recommendation")
  const steps = buildDiscoveryIdealSteps(snapshotOf([oil]), [
    {
      ...(preview as Extract<typeof preview, { kind: "recommendation" }>),
      productName: "Marke Öl",
    },
  ])
  const compose = (brand: string) =>
    composeDiscoveryRefinedRoutine({
      steps,
      items: [],
      decisions: [],
      swapProducts: [],
      recommendationProducts: [{ ...swapRow("ideal-1"), brand }],
    })
  // „Marke" / „MARKE" both print „Marke Öl" — the name already starts with the brand.
  assert.equal(compose("Marke").steps[0]!.recommendationLabel, "Marke Öl")
  assert.equal(compose("Marke").sourceHash, compose("MARKE").sourceHash)
  assert.notEqual(compose("Marke").sourceHash, compose("Andere").sourceHash)
})
