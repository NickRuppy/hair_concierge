import assert from "node:assert/strict"
import test from "node:test"

import { CATEGORY_ROLE_POLICIES } from "../../../src/lib/personal-plan/products/authorities"
import { BONDBUILDER_TIE_DEFAULT_PRODUCT_ID } from "../../../src/lib/personal-plan/products/authority/categories/bondbuilder"
import { evaluateStage3Authority } from "../../../src/lib/personal-plan/products/authority/evaluate"
import type {
  Stage3AuthorityCommonProductFacts,
  Stage3AuthorityInput,
  Stage3CategoryProductFacts,
} from "../../../src/lib/personal-plan/products/authority/contracts"
import type { PersonalPlanCategory } from "../../../src/lib/personal-plan/products/contracts"

const TARGETS: Record<PersonalPlanCategory, unknown> = {
  shampoo: {
    category: "shampoo",
    roles: ["shampoo_everyday"],
    scalpRoute: "balanced",
    everydayConstraint: "standard",
    requiresTargetedDandruffCapability: false,
  },
  conditioner: {
    category: "conditioner",
    roles: ["conditioner_rinse_out"],
    weight: "light",
    careDirection: "moisture",
    repairSupportLevel: "medium",
    functionalNeeds: [],
  },
  leave_in: {
    category: "leave_in",
    roles: ["post_wash_leave_in"],
    weight: "light",
    careDirection: "moisture",
    repairSupportLevel: "low",
    functions: [],
    conditionerReplacementEligible: false,
  },
  heat_protectant: {
    category: "heat_protectant",
    roles: ["pre_heat_protection"],
    qualifyingRoutes: ["direct_contact_heat"],
    carrierPolicy: "integrated_or_separate_verified_binary_capability",
  },
  oil: {
    category: "oil",
    roles: ["dry_finish"],
    roleTargets: [{ role: "dry_finish", tier: "basis", weight: "light", functionalBenefits: [] }],
  },
  mask: {
    category: "mask",
    roles: ["intensive_conditioning_mask"],
    needStrength: "standard",
    weight: "light",
    careDirection: "moisture",
    repairSupportLevel: "medium",
    functionalNeeds: [],
  },
  scalp_care: {
    category: "scalp_care",
    roles: ["scalp_comfort"],
    roleTargets: [{ role: "scalp_comfort", coverage: "primary" }],
  },
  dry_shampoo: {
    category: "dry_shampoo",
    roles: ["root_refresh_bridge"],
    cadenceAdjustment: "keep",
  },
  bondbuilder: {
    category: "bondbuilder",
    roles: ["specialized_bond_treatment"],
    requiredFunction: "support_stressed_hair_resilience",
    mechanismTarget: "mechanism_neutral",
  },
  deep_cleansing_shampoo: {
    category: "deep_cleansing_shampoo",
    roles: ["residue_reset"],
  },
}

function common(category: PersonalPlanCategory): Stage3AuthorityCommonProductFacts {
  const role = ((TARGETS[category] as { roles?: string[] }).roles?.[0] ??
    CATEGORY_ROLE_POLICIES[category]
      .allowedRoles[0]) as (typeof CATEGORY_ROLE_POLICIES)[PersonalPlanCategory]["allowedRoles"][number]
  return {
    productId: `product-${category}`,
    displayName: `Produkt ${category}`,
    category,
    isActive: true,
    lifecycleStatus: "active",
    recommendable: false,
    suitableThicknesses: ["normal"],
    knownReaction: false,
    protocols: [{ role, status: "verified_complete", fingerprint: `protocol-${category}` }],
    factFingerprint: `facts-${category}`,
  }
}

function knownFacts(category: PersonalPlanCategory): Stage3CategoryProductFacts {
  const base = common(category)
  switch (category) {
    case "shampoo":
      return {
        ...base,
        category,
        spec: {
          thickness: "normal",
          shampooBucket: "normal",
          scalpRoute: "balanced",
          cleansingIntensity: "regular",
          targetFit: "matched",
        },
      }
    case "conditioner":
      return {
        ...base,
        category,
        spec: {
          thickness: "normal",
          proteinMoistureBalance: "balanced",
          weight: "light",
          repairSupportLevel: "medium",
          balanceDirection: "moisture",
          targetFit: "matched",
        },
      }
    case "leave_in":
      return {
        ...base,
        category,
        spec: {
          format: "cream",
          weight: "light",
          careDirection: "moisture",
          repairSupportLevel: "low",
          roles: ["post_wash_leave_in"],
          providesHeatProtection: false,
          careBenefits: [],
          applicationStages: ["damp"],
        },
      }
    case "heat_protectant":
      return { ...base, category, spec: { format: "spray", providesHeatProtection: true } }
    case "oil":
      return {
        ...base,
        category,
        spec: {
          roleSupport: { dry_finish: true },
          weight: "light",
          targetThicknessEligible: true,
          providesHeatProtection: false,
        },
      }
    case "mask":
      return {
        ...base,
        category,
        spec: {
          weight: "light",
          careDirection: "moisture",
          repairSupportLevel: "medium",
          functionalBenefits: [],
        },
      }
    case "scalp_care":
      return {
        ...base,
        category,
        spec: { primaryRole: "scalp_comfort", presentationFormat: "serum", rinseMode: "leave_on" },
      }
    case "dry_shampoo":
      return {
        ...base,
        category,
        spec: {
          primaryEffect: "classic_refresh",
          hairColorFit: "universal",
          scalpSensitivityFit: "sensitive_ok",
          format: "aerosol_spray",
        },
      }
    case "bondbuilder":
      return {
        ...base,
        category,
        spec: {
          applicationMode: "pre_shampoo",
          treatmentMode: "standalone",
          productFormat: "treatment",
          usageProtocol: "verified_course",
          relationship: "standalone",
        },
      }
    case "deep_cleansing_shampoo":
      return {
        ...base,
        category,
        spec: {
          supportedResetRoles: ["residue_reset"],
          scalpTypeFocus: "balanced",
          colorTreatedSuitability: "suitable",
        },
      }
  }
}

function unknownFacts(category: PersonalPlanCategory): Stage3CategoryProductFacts {
  const facts = structuredClone(knownFacts(category)) as Stage3CategoryProductFacts
  switch (facts.category) {
    case "shampoo":
      facts.spec.scalpRoute = null
      facts.spec.targetFit = "unknown"
      break
    case "conditioner":
      facts.spec.weight = null
      facts.spec.targetFit = "unknown"
      break
    case "leave_in":
      facts.spec.roles = null
      break
    case "heat_protectant":
      facts.spec.providesHeatProtection = null
      break
    case "oil":
      facts.spec.roleSupport = { dry_finish: null }
      break
    case "mask":
      facts.spec.repairSupportLevel = null
      break
    case "scalp_care":
      facts.spec.primaryRole = null
      break
    case "dry_shampoo":
      facts.spec.format = null
      break
    case "bondbuilder":
      facts.spec.usageProtocol = null
      break
    case "deep_cleansing_shampoo":
      facts.spec.supportedResetRoles = null
      break
  }
  return facts
}

function input(
  category: PersonalPlanCategory,
  state: "known" | "pending" | "unknown" | "unsupported",
): Stage3AuthorityInput {
  // Oil targets are role-specific. Use the exact target present in this
  // fixture instead of treating another valid Oil role as interchangeable.
  const role = category === "oil" ? "dry_finish" : CATEGORY_ROLE_POLICIES[category].allowedRoles[0]
  const pending = state === "pending"
  return {
    category,
    authorityVersion: CATEGORY_ROLE_POLICIES[category].authorityVersion,
    refinedVersionId: "refined-1",
    refinedInputHash: "input-1",
    subjectKey: `decision:${category}:${role}:owned-1`,
    role,
    capturedProductId: "owned-1",
    subjectIdentity: pending
      ? {
          kind: "pending_submission",
          submissionId: "submission-1",
          displayName: "Noch in Prüfung",
          category,
          reviewStatus: "pending_review",
        }
      : {
          kind: "catalog_product",
          productId: `product-${category}`,
          displayName: `Produkt ${category}`,
          category,
        },
    categoryDecision: {
      category,
      resolution: "resolved",
      needTier: "basis",
      roles: [role],
      target: state === "unsupported" ? null : TARGETS[category],
      frequency: null,
      reasons: [],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: [],
    } as never,
    coverage: [],
    hairThickness: "normal",
    productFacts:
      state === "known"
        ? (knownFacts(category) as never)
        : state === "unknown"
          ? (unknownFacts(category) as never)
          : null,
    recommendationCandidates: [],
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
  }
}

function shampooUncoveredCandidate(overrides: {
  productId: string
  displayName: string
  catalogSortOrder: number
  role: "shampoo_everyday" | "shampoo_dandruff"
  shampooBucket: "normal" | "schuppen"
  scalpRoute: "balanced" | "dandruff"
  cleansingIntensity: "gentle" | "regular" | "clarifying"
}) {
  const facts = knownFacts("shampoo")
  if (facts.category !== "shampoo") throw new Error("expected Shampoo fixture")
  Object.assign(facts, {
    productId: overrides.productId,
    displayName: overrides.displayName,
    catalogSortOrder: overrides.catalogSortOrder,
    recommendable: true,
    factFingerprint: `facts-${overrides.productId}`,
    protocols: [
      {
        role: overrides.role,
        status: "verified_complete",
        fingerprint: `protocol-${overrides.productId}`,
      },
    ],
  })
  facts.spec.shampooBucket = overrides.shampooBucket
  facts.spec.scalpRoute = overrides.scalpRoute
  facts.spec.cleansingIntensity = overrides.cleansingIntensity
  return facts
}

function heatCandidate(input: {
  productId: string
  displayName: string
  priceEur: number | null
  purchaseLinkStatus: "available" | "unavailable" | null
}) {
  const facts = knownFacts("heat_protectant")
  if (facts.category !== "heat_protectant") throw new Error("expected Heat Protectant fixture")
  return Object.assign(facts, {
    productId: input.productId,
    displayName: input.displayName,
    recommendable: true,
    suitableThicknesses: null,
    priceEur: input.priceEur,
    purchaseLinkStatus: input.purchaseLinkStatus,
    factFingerprint: `facts-${input.displayName}`,
  })
}

for (const category of Object.keys(CATEGORY_ROLE_POLICIES) as PersonalPlanCategory[]) {
  test(`${category} preserves known, pending, unknown and unsupported authority states`, () => {
    const known = evaluateStage3Authority(input(category, "known"))
    assert.equal(
      known.status,
      "known",
      known.status === "unsupported" ? known.reason : `${category} did not resolve known facts`,
    )
    if (known.status === "known") {
      assert.equal(known.verdict, "ideal")
      assert.deepEqual(known.allowedActions, ["keep_owned"])
    }

    assert.equal(evaluateStage3Authority(input(category, "pending")).status, "pending")
    assert.equal(evaluateStage3Authority(input(category, "unknown")).status, "unknown")
    assert.equal(evaluateStage3Authority(input(category, "unsupported")).status, "unsupported")
  })
}

test("supportive owned-product verdicts retain explicit keep and uncovered actions", () => {
  const conditionerInput = input("conditioner", "known") as Stage3AuthorityInput<"conditioner">
  if (conditionerInput.productFacts?.category !== "conditioner") throw new Error("fixture")
  conditionerInput.productFacts.spec.weight = "medium"
  const leaveInInput = input("leave_in", "known") as Stage3AuthorityInput<"leave_in">
  if (leaveInInput.productFacts?.category !== "leave_in") throw new Error("fixture")
  leaveInInput.productFacts.spec.weight = "medium"
  const maskInput = input("mask", "known") as Stage3AuthorityInput<"mask">
  if (maskInput.productFacts?.category !== "mask") throw new Error("fixture")
  maskInput.productFacts.spec.weight = "rich"
  const bondbuilderInput = input("bondbuilder", "known") as Stage3AuthorityInput<"bondbuilder">
  if (bondbuilderInput.productFacts?.category !== "bondbuilder") throw new Error("fixture")
  bondbuilderInput.productFacts.spec.relationship = "add_on"
  const oilInput = input("oil", "known") as Stage3AuthorityInput<"oil">
  if (oilInput.productFacts?.category !== "oil") throw new Error("fixture")
  oilInput.productFacts.spec.weight = "medium"

  for (const authorityInput of [
    conditionerInput,
    leaveInInput,
    maskInput,
    bondbuilderInput,
    oilInput,
  ]) {
    const result = evaluateStage3Authority(authorityInput as never)
    assert.equal(result.status, "known")
    if (result.status !== "known") continue
    assert.equal(result.verdict, "supportive")
    assert.ok(result.allowedActions.includes("keep_owned"))
    assert.ok(result.allowedActions.includes("leave_uncovered"))
    assert.ok(!result.allowedActions.includes("select_replacement"))
  }
})

for (const category of [
  "shampoo",
  "conditioner",
  "leave_in",
  "mask",
  "bondbuilder",
  "deep_cleansing_shampoo",
] as const) {
  test(`${category} does not fabricate an owned-product fit when no product was captured`, () => {
    const noOwnedProduct = input(category, "known")
    noOwnedProduct.capturedProductId = null
    noOwnedProduct.subjectIdentity = null
    noOwnedProduct.productFacts = null
    noOwnedProduct.recommendationCandidates = []

    const result = evaluateStage3Authority(noOwnedProduct)

    assert.equal(result.status, "known")
    if (result.status !== "known") return
    assert.equal(result.verdict, "unknown")
    assert.deepEqual(result.allowedActions, ["leave_uncovered"])
    assert.equal(result.recommendation, null)
    assert.equal(result.productFactFingerprint, null)
  })
}

for (const category of [
  "shampoo",
  "conditioner",
  "leave_in",
  "mask",
  "bondbuilder",
  "deep_cleansing_shampoo",
] as const) {
  test(`${category} keeps leaving the need uncovered available beside a recommendation`, () => {
    const noOwnedProduct = input(category, "known")
    const candidate = knownFacts(category)
    candidate.recommendable = true
    if (candidate.category === "mask") {
      candidate.presentationImageUrl = "https://example.com/mask.webp"
    }
    noOwnedProduct.capturedProductId = null
    noOwnedProduct.subjectIdentity = null
    noOwnedProduct.productFacts = null
    noOwnedProduct.recommendationCandidates = [candidate] as never

    const result = evaluateStage3Authority(noOwnedProduct)

    assert.equal(result.status, "known")
    if (result.status !== "known") return
    assert.ok(result.recommendation)
    assert.ok(result.allowedActions.includes("plan_recommendation"))
    assert.ok(result.allowedActions.includes("leave_uncovered"))
  })
}

function bondbuilderCandidate(productId: string, displayName: string) {
  const facts = knownFacts("bondbuilder")
  if (facts.category !== "bondbuilder") throw new Error("expected Bondbuilder fixture")
  return Object.assign(facts, {
    productId,
    displayName,
    recommendable: true,
    factFingerprint: `facts-${productId}`,
  })
}

function bondbuilderGapInput(candidates: ReturnType<typeof bondbuilderCandidate>[]) {
  const gap = input("bondbuilder", "known")
  gap.capturedProductId = null
  gap.subjectIdentity = null
  gap.productFacts = null
  gap.recommendationCandidates = candidates as never
  return gap
}

test("a Bondbuilder tie defaults to K18 without claiming it is the better product", () => {
  const k18 = bondbuilderCandidate(
    BONDBUILDER_TIE_DEFAULT_PRODUCT_ID,
    "K18 Leave-In Molecular Repair Hair Mask",
  )
  const result = evaluateStage3Authority(
    bondbuilderGapInput([
      bondbuilderCandidate("olaplex-no3", "OLAPLEX No.3PLUS Complete Repair Treatment"),
      k18,
      bondbuilderCandidate("epres", "Epres Bond Repair Treatment"),
    ]),
  )

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "ideal")
  assert.equal(result.recommendation?.productId, BONDBUILDER_TIE_DEFAULT_PRODUCT_ID)
  assert.equal(result.recommendation?.authorityRuleId, "bondbuilder.stage3.tie_default")
  assert.equal(
    result.recommendation?.reason,
    "Unsere Standardwahl, wenn mehrere Produkte gleich gut passen.",
  )
  assert.equal(result.recommendationFactFingerprint, k18.factFingerprint)
  assert.deepEqual(result.allowedActions, ["plan_recommendation", "leave_uncovered"])
  // The "several equally suitable products" fact stays visible: the default is
  // a choice among equals, not a superiority claim.
  assert.ok(
    result.criteria.some(
      (entry) => entry.criterionId === "bondbuilder.equal_shortlist" && entry.result === "caution",
    ),
  )
})

test("a Bondbuilder tie without the default product still leaves the need uncovered", () => {
  const result = evaluateStage3Authority(
    bondbuilderGapInput([
      bondbuilderCandidate("olaplex-no3", "OLAPLEX No.3PLUS Complete Repair Treatment"),
      bondbuilderCandidate("epres", "Epres Bond Repair Treatment"),
    ]),
  )

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "ideal")
  assert.equal(result.recommendation, null)
  assert.equal(result.recommendationFactFingerprint, null)
  assert.deepEqual(result.allowedActions, ["leave_uncovered"])
  assert.ok(result.criteria.some((entry) => entry.criterionId === "bondbuilder.equal_shortlist"))
})

test("a single ideal Bondbuilder candidate keeps the standalone rule, not the tie default", () => {
  const only = bondbuilderCandidate(
    BONDBUILDER_TIE_DEFAULT_PRODUCT_ID,
    "K18 Leave-In Molecular Repair Hair Mask",
  )
  const result = evaluateStage3Authority(bondbuilderGapInput([only]))

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.recommendation?.productId, BONDBUILDER_TIE_DEFAULT_PRODUCT_ID)
  assert.equal(result.recommendation?.authorityRuleId, "bondbuilder.stage3.validated_standalone")
  assert.ok(result.criteria.every((entry) => entry.criterionId !== "bondbuilder.equal_shortlist"))
})

test("only owned-fit authority policies advance for this semantic correction", () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
        category,
        policy.authorityVersion,
      ]),
    ),
    {
      shampoo: "personal-plan.shampoo.v4",
      conditioner: "personal-plan.conditioner.v3",
      leave_in: "personal-plan.leave-in.v3",
      heat_protectant: "personal-plan.heat-protectant.v1",
      oil: "personal-plan.oil.v2",
      mask: "personal-plan.mask.v4",
      scalp_care: "personal-plan.scalp-care.v3",
      dry_shampoo: "personal-plan.dry-shampoo.v2",
      bondbuilder: "personal-plan.bondbuilder.v2",
      deep_cleansing_shampoo: "personal-plan.deep-cleansing.v2",
    },
  )
})

test("Shampoo with complete nonmatching semantic facts is a known mismatch, not unknown", () => {
  const shampooInput = input("shampoo", "known") as Stage3AuthorityInput<"shampoo">
  if (shampooInput.productFacts?.category !== "shampoo") throw new Error("expected Shampoo fixture")
  shampooInput.productFacts.spec = {
    thickness: null,
    shampooBucket: null,
    scalpRoute: null,
    cleansingIntensity: null,
    targetFit: "known_mismatch",
  }

  const result = evaluateStage3Authority(shampooInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "mismatch")
  assert.ok(result.criteria.some((criterion) => criterion.criterionId === "shampoo.role"))
})

test("Shampoo treats a confirmed cleansing-intensity difference as supportive, not ideal", () => {
  const shampooInput = input("shampoo", "known") as Stage3AuthorityInput<"shampoo">
  if (shampooInput.productFacts?.category !== "shampoo") throw new Error("expected Shampoo fixture")
  shampooInput.productFacts.spec.cleansingIntensity = "gentle"

  const result = evaluateStage3Authority(shampooInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "supportive")
  assert.deepEqual(result.allowedActions, ["keep_owned", "leave_uncovered"])
  assert.ok(
    result.criteria.some(
      (criterion) =>
        criterion.criterionId === "shampoo.cleansing_intensity" && criterion.result === "caution",
    ),
  )
})

test("Shampoo known mismatch can use its exact verified supported-role protocol", () => {
  const shampooInput = input("shampoo", "known") as Stage3AuthorityInput<"shampoo">
  if (shampooInput.productFacts?.category !== "shampoo") throw new Error("expected Shampoo fixture")
  shampooInput.role = "shampoo_dandruff"
  shampooInput.productFacts.protocols = [
    {
      role: "shampoo_everyday",
      status: "verified_complete",
      fingerprint: "exact-everyday-protocol",
    },
  ]
  shampooInput.productFacts.spec = {
    thickness: null,
    shampooBucket: null,
    scalpRoute: null,
    cleansingIntensity: null,
    targetFit: "known_mismatch",
  }

  const result = evaluateStage3Authority(shampooInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "mismatch")
  assert.ok(result.criteria.some((criterion) => criterion.criterionId === "shampoo.role"))
})

test("Shampoo with ambiguous or incomplete semantic facts remains unknown", () => {
  const shampooInput = input("shampoo", "known") as Stage3AuthorityInput<"shampoo">
  if (shampooInput.productFacts?.category !== "shampoo") throw new Error("expected Shampoo fixture")
  shampooInput.productFacts.spec.targetFit = "unknown"
  shampooInput.productFacts.spec.shampooBucket = null

  const result = evaluateStage3Authority(shampooInput as never)

  assert.equal(result.status, "unknown")
  if (result.status !== "unknown") return
  assert.ok(result.missingFacts.includes("shampoo.target_fit"))
})

test("Shampoo uncovered-role recommendation falls back to a supportive candidate, ranked by the shared comparator", () => {
  const shampooInput = input("shampoo", "known") as Stage3AuthorityInput<"shampoo">
  shampooInput.capturedProductId = null
  shampooInput.subjectIdentity = null
  shampooInput.productFacts = null

  // Both supportive (cleansing intensity off-target); array-first has the
  // worse catalogSortOrder, so array order alone would pick the wrong one.
  const worseSortOrder = shampooUncoveredCandidate({
    productId: "shampoo-supportive-worse-order",
    displayName: "Schlechtere Katalogposition",
    catalogSortOrder: 9,
    role: "shampoo_everyday",
    shampooBucket: "normal",
    scalpRoute: "balanced",
    cleansingIntensity: "gentle",
  })
  const betterSortOrder = shampooUncoveredCandidate({
    productId: "shampoo-supportive-better-order",
    displayName: "Bessere Katalogposition",
    catalogSortOrder: 1,
    role: "shampoo_everyday",
    shampooBucket: "normal",
    scalpRoute: "balanced",
    cleansingIntensity: "clarifying",
  })
  shampooInput.recommendationCandidates = [worseSortOrder, betterSortOrder]

  const result = evaluateStage3Authority(shampooInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "supportive")
  assert.equal(result.recommendation?.productId, "shampoo-supportive-better-order")
  assert.equal(
    result.recommendation?.authorityRuleId,
    "shampoo.selection.verified_supportive_intensity",
  )
})

test("Shampoo uncovered-role recommendation still prefers an ideal candidate over a supportive one", () => {
  const shampooInput = input("shampoo", "known") as Stage3AuthorityInput<"shampoo">
  shampooInput.capturedProductId = null
  shampooInput.subjectIdentity = null
  shampooInput.productFacts = null

  const supportive = shampooUncoveredCandidate({
    productId: "shampoo-supportive",
    displayName: "Unterstützend",
    catalogSortOrder: 1,
    role: "shampoo_everyday",
    shampooBucket: "normal",
    scalpRoute: "balanced",
    cleansingIntensity: "gentle",
  })
  const ideal = shampooUncoveredCandidate({
    productId: "shampoo-ideal",
    displayName: "Ideal",
    catalogSortOrder: 9,
    role: "shampoo_everyday",
    shampooBucket: "normal",
    scalpRoute: "balanced",
    cleansingIntensity: "regular",
  })
  shampooInput.recommendationCandidates = [supportive, ideal]

  const result = evaluateStage3Authority(shampooInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "ideal")
  assert.equal(result.recommendation?.productId, "shampoo-ideal")
  assert.equal(result.recommendation?.authorityRuleId, "shampoo.selection.verified_role_fit")
})

test("Shampoo uncovered-role recommendation ranks two ideal candidates by catalog order, not array order", () => {
  const shampooInput = input("shampoo", "known") as Stage3AuthorityInput<"shampoo">
  shampooInput.capturedProductId = null
  shampooInput.subjectIdentity = null
  shampooInput.productFacts = null

  const worseSortOrder = shampooUncoveredCandidate({
    productId: "shampoo-ideal-worse-order",
    displayName: "Schlechtere Katalogposition",
    catalogSortOrder: 9,
    role: "shampoo_everyday",
    shampooBucket: "normal",
    scalpRoute: "balanced",
    cleansingIntensity: "regular",
  })
  const betterSortOrder = shampooUncoveredCandidate({
    productId: "shampoo-ideal-better-order",
    displayName: "Bessere Katalogposition",
    catalogSortOrder: 1,
    role: "shampoo_everyday",
    shampooBucket: "normal",
    scalpRoute: "balanced",
    cleansingIntensity: "regular",
  })
  shampooInput.recommendationCandidates = [worseSortOrder, betterSortOrder]

  const result = evaluateStage3Authority(shampooInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "ideal")
  assert.equal(result.recommendation?.productId, "shampoo-ideal-better-order")
})

test("Shampoo dandruff role stays ideal-only: no supportive fallback even when only supportive candidates exist", () => {
  const shampooInput = input("shampoo", "known") as Stage3AuthorityInput<"shampoo">
  shampooInput.role = "shampoo_dandruff"
  shampooInput.capturedProductId = null
  shampooInput.subjectIdentity = null
  shampooInput.productFacts = null

  const supportiveOnly = shampooUncoveredCandidate({
    productId: "shampoo-dandruff-supportive",
    displayName: "Unterstützend (Schuppen)",
    catalogSortOrder: 1,
    role: "shampoo_dandruff",
    shampooBucket: "schuppen",
    scalpRoute: "dandruff",
    cleansingIntensity: "gentle",
  })
  shampooInput.recommendationCandidates = [supportiveOnly]

  const result = evaluateStage3Authority(shampooInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "unknown")
  assert.deepEqual(result.allowedActions, ["leave_uncovered"])
  assert.equal(result.recommendation, null)
})

test("Conditioner with complete nonmatching semantic facts is a known mismatch, not unknown", () => {
  const conditionerInput = input("conditioner", "known") as Stage3AuthorityInput<"conditioner">
  if (conditionerInput.productFacts?.category !== "conditioner") {
    throw new Error("expected Conditioner fixture")
  }
  conditionerInput.productFacts.spec = {
    thickness: null,
    proteinMoistureBalance: null,
    weight: "light",
    repairSupportLevel: "medium",
    balanceDirection: "moisture",
    targetFit: "known_mismatch",
  }

  const result = evaluateStage3Authority(conditionerInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "mismatch")
  assert.ok(result.criteria.some((criterion) => criterion.criterionId === "conditioner.role"))
})

test("Conditioner with ambiguous or incomplete semantic facts remains unknown", () => {
  const conditionerInput = input("conditioner", "known") as Stage3AuthorityInput<"conditioner">
  if (conditionerInput.productFacts?.category !== "conditioner") {
    throw new Error("expected Conditioner fixture")
  }
  conditionerInput.productFacts.spec.targetFit = "unknown"
  conditionerInput.productFacts.spec.proteinMoistureBalance = null

  const result = evaluateStage3Authority(conditionerInput as never)

  assert.equal(result.status, "unknown")
  if (result.status !== "unknown") return
  assert.ok(result.missingFacts.includes("conditioner.target_fit"))
})

test("Oil v2 distinguishes known unsupported roles from missing role support", () => {
  const unsupportedInput = input("oil", "known") as Stage3AuthorityInput<"oil">
  if (unsupportedInput.productFacts?.category !== "oil") throw new Error("expected Oil fixture")
  unsupportedInput.productFacts.spec.roleSupport = {
    pre_wash_fibre_treatment: true,
    leave_on_fibre_conditioning: false,
    dry_finish: false,
  }
  unsupportedInput.productFacts.spec.weight = "light"
  unsupportedInput.productFacts.spec.targetThicknessEligible = true

  const unsupported = evaluateStage3Authority(unsupportedInput as never)
  assert.equal(unsupported.status, "known")
  if (unsupported.status !== "known") return
  assert.equal(unsupported.verdict, "mismatch")

  const missingInput = structuredClone(unsupportedInput) as Stage3AuthorityInput<"oil">
  if (missingInput.productFacts?.category !== "oil") throw new Error("expected Oil fixture")
  missingInput.productFacts.spec.roleSupport = { dry_finish: null }
  const missing = evaluateStage3Authority(missingInput as never)
  assert.equal(missing.status, "unknown")
  if (missing.status !== "unknown") return
  assert.ok(missing.missingFacts.includes("oil.role_support"))
})

test("Oil v2 requires explicit leave-on support, canonical weight, and target-thickness eligibility", () => {
  const oilInput = input("oil", "known") as Stage3AuthorityInput<"oil">
  oilInput.role = "leave_on_fibre_conditioning"
  oilInput.subjectKey = "decision:oil:leave_on_fibre_conditioning:owned-1"
  oilInput.categoryDecision.roles = ["leave_on_fibre_conditioning"]
  oilInput.categoryDecision.target = {
    category: "oil",
    roles: ["leave_on_fibre_conditioning"],
    roleTargets: [
      {
        role: "leave_on_fibre_conditioning",
        tier: "basis",
        weight: "light",
        functionalBenefits: [],
      },
    ],
  } as never
  if (oilInput.productFacts?.category !== "oil") throw new Error("expected Oil fixture")
  oilInput.productFacts.protocols = [
    {
      role: "leave_on_fibre_conditioning",
      status: "verified_complete",
      fingerprint: "protocol-oil-leave-on",
    },
  ]
  oilInput.productFacts.spec.roleSupport = {
    leave_on_fibre_conditioning: true,
    dry_finish: false,
    pre_wash_fibre_treatment: false,
  }
  oilInput.productFacts.spec.weight = "light"
  oilInput.productFacts.spec.targetThicknessEligible = true

  const ideal = evaluateStage3Authority(oilInput as never)
  assert.equal(ideal.status, "known")
  if (ideal.status !== "known") return
  assert.equal(ideal.verdict, "ideal")

  const noWeight = structuredClone(oilInput) as Stage3AuthorityInput<"oil">
  if (noWeight.productFacts?.category !== "oil") throw new Error("expected Oil fixture")
  noWeight.productFacts.spec.weight = null
  const missingWeight = evaluateStage3Authority(noWeight as never)
  assert.equal(missingWeight.status, "unknown")
  if (missingWeight.status !== "unknown") return
  assert.ok(missingWeight.missingFacts.includes("oil.weight"))

  const wrongThickness = structuredClone(oilInput) as Stage3AuthorityInput<"oil">
  if (wrongThickness.productFacts?.category !== "oil") throw new Error("expected Oil fixture")
  wrongThickness.productFacts.spec.targetThicknessEligible = false
  const mismatch = evaluateStage3Authority(wrongThickness as never)
  assert.equal(mismatch.status, "known")
  if (mismatch.status !== "known") return
  assert.equal(mismatch.verdict, "mismatch")
})

test("Mask v4 treats compatible formulation preferences as ideal but keeps hard needs strict", () => {
  const idealInput = input("mask", "known") as Stage3AuthorityInput<"mask">
  idealInput.categoryDecision.target = {
    category: "mask",
    roles: ["intensive_conditioning_mask"],
    needStrength: "standard",
    weight: "light",
    careDirection: "moisture",
    repairSupportLevel: "medium",
    functionalNeeds: [
      {
        need: "detangling_slip",
        priority: 2,
        ownership: "required",
      },
    ],
  }
  if (!idealInput.productFacts || idealInput.productFacts.category !== "mask") {
    throw new Error("expected Mask fixture")
  }
  idealInput.productFacts.spec.functionalBenefits = ["detangling_slip"]

  const ideal = evaluateStage3Authority(idealInput as never)
  assert.equal(ideal.status, "known")
  if (ideal.status !== "known") return
  assert.equal(ideal.verdict, "ideal")

  const compatibleInput = structuredClone(idealInput) as Stage3AuthorityInput<"mask">
  if (compatibleInput.productFacts?.category !== "mask") throw new Error("expected Mask fixture")
  compatibleInput.productFacts.spec.weight = "medium"
  compatibleInput.productFacts.spec.careDirection = "protein"
  compatibleInput.productFacts.spec.repairSupportLevel = "low"
  const compatible = evaluateStage3Authority(compatibleInput as never)
  assert.equal(compatible.status, "known")
  if (compatible.status !== "known") return
  assert.equal(compatible.verdict, "ideal")
  assert.deepEqual(
    compatible.criteria
      .filter((criterion) =>
        ["mask.weight", "mask.care_direction", "mask.repair_support"].includes(
          criterion.criterionId,
        ),
      )
      .map((criterion) => criterion.result),
    ["pass", "pass", "pass"],
  )

  const strongerThanRequestedInput = structuredClone(idealInput) as Stage3AuthorityInput<"mask">
  if (strongerThanRequestedInput.productFacts?.category !== "mask") {
    throw new Error("expected Mask fixture")
  }
  if (strongerThanRequestedInput.categoryDecision.target?.category !== "mask") {
    throw new Error("expected Mask target")
  }
  strongerThanRequestedInput.categoryDecision.target.repairSupportLevel = "low"
  strongerThanRequestedInput.productFacts.spec.repairSupportLevel = "medium"
  const strongerThanRequested = evaluateStage3Authority(strongerThanRequestedInput as never)
  assert.equal(strongerThanRequested.status, "known")
  if (strongerThanRequested.status !== "known") return
  assert.equal(
    strongerThanRequested.criteria.find(
      (criterion) => criterion.criterionId === "mask.repair_support",
    )?.explanation,
    "Unterstützt stärker als erforderlich.",
  )

  const tooHeavyInput = structuredClone(idealInput) as Stage3AuthorityInput<"mask">
  if (tooHeavyInput.productFacts?.category !== "mask") throw new Error("expected Mask fixture")
  tooHeavyInput.productFacts.spec.weight = "rich"
  const tooHeavy = evaluateStage3Authority(tooHeavyInput as never)
  assert.equal(tooHeavy.status, "known")
  if (tooHeavy.status !== "known") return
  assert.equal(tooHeavy.verdict, "supportive")
  assert.equal(
    tooHeavy.criteria.find((criterion) => criterion.criterionId === "mask.weight")?.result,
    "caution",
  )

  const mismatchInput = structuredClone(idealInput) as Stage3AuthorityInput<"mask">
  if (mismatchInput.productFacts?.category !== "mask") throw new Error("expected Mask fixture")
  mismatchInput.productFacts.spec.functionalBenefits = ["shine"]
  const mismatch = evaluateStage3Authority(mismatchInput as never)
  assert.equal(mismatch.status, "known")
  if (mismatch.status !== "known") return
  assert.equal(mismatch.verdict, "mismatch")
})

test("Mask v4 fails closed when required canonical functional benefits are missing", () => {
  const maskInput = input("mask", "known") as Stage3AuthorityInput<"mask">
  maskInput.categoryDecision.target = {
    category: "mask",
    roles: ["intensive_conditioning_mask"],
    needStrength: "standard",
    weight: "light",
    careDirection: "moisture",
    repairSupportLevel: "medium",
    functionalNeeds: [
      {
        need: "detangling_slip",
        priority: 2,
        ownership: "required",
      },
    ],
  }
  if (maskInput.productFacts?.category !== "mask") throw new Error("expected Mask fixture")
  maskInput.productFacts.spec.functionalBenefits = null

  const result = evaluateStage3Authority(maskInput as never)

  assert.equal(result.status, "unknown")
  if (result.status !== "unknown") return
  assert.ok(result.missingFacts.includes("mask.functional_benefits"))
})

test("Mask selects the best image-backed supportive candidate regardless of need tier", () => {
  const maskInput = input("mask", "known") as Stage3AuthorityInput<"mask">
  maskInput.capturedProductId = null
  maskInput.subjectIdentity = null
  maskInput.productFacts = null
  maskInput.categoryDecision.needTier = "optional"
  if (maskInput.categoryDecision.target?.category !== "mask") throw new Error("expected target")
  maskInput.categoryDecision.target.repairSupportLevel = "high"
  const oneCaution = knownFacts("mask")
  const twoCautions = knownFacts("mask")
  if (oneCaution.category !== "mask" || twoCautions.category !== "mask") {
    throw new Error("expected Mask fixtures")
  }
  Object.assign(oneCaution, {
    productId: "z-one-caution",
    displayName: "Eine Abweichung",
    recommendable: true,
    presentationImageUrl: "https://example.com/one.webp",
    factFingerprint: "facts-one-caution",
  })
  oneCaution.spec.weight = "rich"
  oneCaution.spec.repairSupportLevel = "high"
  Object.assign(twoCautions, {
    productId: "a-two-cautions",
    displayName: "Zwei Abweichungen",
    recommendable: true,
    presentationImageUrl: "https://example.com/two.webp",
    factFingerprint: "facts-two-cautions",
  })
  twoCautions.spec.weight = "rich"
  twoCautions.spec.repairSupportLevel = "low"

  const evaluate = (candidates: Stage3CategoryProductFacts[]) => {
    maskInput.recommendationCandidates = candidates as never
    return evaluateStage3Authority(maskInput as never)
  }
  const forward = evaluate([twoCautions, oneCaution])
  const reverse = evaluate([oneCaution, twoCautions])

  for (const result of [forward, reverse]) {
    assert.equal(result.status, "known")
    if (result.status !== "known") continue
    assert.equal(result.verdict, "supportive")
    assert.equal(result.recommendation?.productId, "z-one-caution")
    assert.equal(result.recommendationFactFingerprint, "facts-one-caution")
    assert.deepEqual(result.allowedActions, ["plan_recommendation", "leave_uncovered"])
  }

  // Nick's decision (Task 3d): supportive candidates are eligible for every
  // need tier, not only "optional" -- required (basis) slots also get a
  // best-available supportive pick instead of falling back to uncovered.
  maskInput.categoryDecision.needTier = "basis"
  const basis = evaluate([oneCaution])
  assert.equal(basis.status, "known")
  if (basis.status !== "known") return
  assert.equal(basis.verdict, "supportive")
  assert.equal(basis.recommendation?.productId, "z-one-caution")
  assert.deepEqual(basis.allowedActions, ["plan_recommendation", "leave_uncovered"])

  maskInput.categoryDecision.needTier = "optional"
  oneCaution.presentationImageUrl = null
  const imageLess = evaluate([oneCaution])
  assert.equal(imageLess.status, "known")
  if (imageLess.status !== "known") return
  assert.equal(imageLess.recommendation, null)
})

test("Mask v4 preserves catalog merchandising order among equally fitting candidates", () => {
  const maskInput = input("mask", "known") as Stage3AuthorityInput<"mask">
  maskInput.capturedProductId = null
  maskInput.subjectIdentity = null
  maskInput.productFacts = null
  const first = knownFacts("mask")
  const second = knownFacts("mask")
  if (first.category !== "mask" || second.category !== "mask") {
    throw new Error("expected Mask fixtures")
  }
  Object.assign(first, {
    productId: "z-merchandising-first",
    displayName: "Zuerst kuratiert",
    catalogSortOrder: 1,
    recommendable: true,
    presentationImageUrl: "https://example.com/first.webp",
    factFingerprint: "facts-first",
  })
  Object.assign(second, {
    productId: "a-merchandising-second",
    displayName: "Danach kuratiert",
    catalogSortOrder: 2,
    recommendable: true,
    presentationImageUrl: "https://example.com/second.webp",
    factFingerprint: "facts-second",
  })
  maskInput.recommendationCandidates = [second, first] as never

  const result = evaluateStage3Authority(maskInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "ideal")
  assert.equal(result.recommendation?.productId, "z-merchandising-first")
  assert.equal(result.recommendationFactFingerprint, "facts-first")
})

test("Leave-in v3 evaluates towel-dry post-wash facts and repair support deterministically", () => {
  const idealInput = input("leave_in", "known") as Stage3AuthorityInput<"leave_in">
  idealInput.categoryDecision.target = {
    category: "leave_in",
    roles: ["post_wash_leave_in"],
    weight: "light",
    careDirection: "moisture",
    repairSupportLevel: "high",
    functions: [
      {
        function: "detangle",
        priority: 3,
        ownership: "required",
      },
    ],
    conditionerReplacementEligible: false,
  }
  if (!idealInput.productFacts || idealInput.productFacts.category !== "leave_in") {
    throw new Error("expected Leave-in fixture")
  }
  idealInput.productFacts.spec.repairSupportLevel = "high"
  idealInput.productFacts.spec.careBenefits = ["detangle"]
  idealInput.productFacts.spec.applicationStages = ["towel_dry"]

  const ideal = evaluateStage3Authority(idealInput as never)
  assert.equal(ideal.status, "known")
  if (ideal.status !== "known") return
  assert.equal(ideal.verdict, "ideal")

  const supportiveInput = structuredClone(idealInput) as Stage3AuthorityInput<"leave_in">
  if (supportiveInput.productFacts?.category !== "leave_in") {
    throw new Error("expected Leave-in fixture")
  }
  supportiveInput.productFacts.spec.weight = "medium"
  const supportive = evaluateStage3Authority(supportiveInput as never)
  assert.equal(supportive.status, "known")
  if (supportive.status !== "known") return
  assert.equal(supportive.verdict, "supportive")

  const mismatchInput = structuredClone(idealInput) as Stage3AuthorityInput<"leave_in">
  if (mismatchInput.productFacts?.category !== "leave_in") {
    throw new Error("expected Leave-in fixture")
  }
  mismatchInput.productFacts.spec.repairSupportLevel = "low"
  const mismatch = evaluateStage3Authority(mismatchInput as never)
  assert.equal(mismatch.status, "known")
  if (mismatch.status !== "known") return
  assert.equal(mismatch.verdict, "mismatch")
})

test("verified integrated heat carriers suppress a duplicate standalone recommendation", () => {
  const heatInput = input("heat_protectant", "known")
  heatInput.capturedProductId = null
  heatInput.subjectIdentity = null
  heatInput.productFacts = null
  heatInput.heatCarrierCoverage = {
    carrierCategory: "leave_in",
    verifiedRoutes: ["direct_contact_heat"],
  }

  const result = evaluateStage3Authority(heatInput)
  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.recommendation, null)
  assert.deepEqual(result.allowedActions, ["leave_uncovered"])
  assert.ok(result.criteria.some((criterion) => criterion.criterionId.includes("carrier")))
})

test("partially covered Oil heat events preserve the standalone Heat Protectant need", () => {
  const heatInput = input("heat_protectant", "known")
  heatInput.capturedProductId = null
  heatInput.subjectIdentity = null
  heatInput.productFacts = null
  heatInput.categoryDecision = {
    ...heatInput.categoryDecision,
    target: {
      category: "heat_protectant",
      roles: ["pre_heat_protection"],
      qualifyingRoutes: ["airflow_shaping"],
      carrierPolicy: "integrated_or_separate_verified_binary_capability",
    },
  } as never
  heatInput.heatCarrierCoverage = {
    carrierCategory: "oil",
    verifiedRoutes: [],
    qualifyingEventIds: ["heat:dryer", "heat:dryer-brush"],
    verifiedEventIds: ["heat:dryer"],
  }

  const result = evaluateStage3Authority(heatInput)
  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "mismatch")
  assert.ok(
    result.criteria.some(
      (criterion) => criterion.criterionId === "heat_protectant.carrier.uncovered",
    ),
  )
})

test("an Oil evaluated against no qualifying heat events cannot close a declared heat need", () => {
  const heatInput = input("heat_protectant", "known")
  heatInput.capturedProductId = null
  heatInput.subjectIdentity = null
  heatInput.productFacts = null
  heatInput.heatCarrierCoverage = {
    carrierCategory: "oil",
    verifiedRoutes: [],
    qualifyingEventIds: [],
    verifiedEventIds: [],
  }

  const result = evaluateStage3Authority(heatInput)
  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "mismatch")
  assert.ok(
    result.criteria.some(
      (criterion) => criterion.criterionId === "heat_protectant.carrier.uncovered",
    ),
  )
})

test("standalone Heat does not require a suitable-thickness fact", () => {
  const heatInput = input("heat_protectant", "known")
  if (heatInput.productFacts?.category !== "heat_protectant") {
    throw new Error("expected Heat Protectant fixture")
  }
  heatInput.productFacts.suitableThicknesses = null

  const result = evaluateStage3Authority(heatInput)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "ideal")
  assert.deepEqual(result.allowedActions, ["keep_owned"])
})

test("Dry Shampoo does not fabricate or require a hair-thickness fit dimension", () => {
  const dryShampooInput = input("dry_shampoo", "known")
  if (dryShampooInput.productFacts?.category !== "dry_shampoo") {
    throw new Error("expected Dry Shampoo fixture")
  }
  dryShampooInput.productFacts.suitableThicknesses = null

  const result = evaluateStage3Authority(dryShampooInput)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "ideal")
  assert.deepEqual(result.allowedActions, ["keep_owned"])
})

test("Scalp Care does not require a hair-thickness fact when its exact role protocol is complete", () => {
  const scalpCareInput = input("scalp_care", "known")
  if (scalpCareInput.productFacts?.category !== "scalp_care") {
    throw new Error("expected Scalp Care fixture")
  }
  scalpCareInput.productFacts.suitableThicknesses = []

  const result = evaluateStage3Authority(scalpCareInput)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "ideal")
  assert.deepEqual(result.allowedActions, ["keep_owned"])
})

test("Scalp Care recommends an exact-role candidate without a hair-thickness fact", () => {
  const scalpCareInput = input("scalp_care", "known")
  const candidate = knownFacts("scalp_care")
  if (candidate.category !== "scalp_care") throw new Error("expected Scalp Care fixture")
  candidate.recommendable = true
  candidate.suitableThicknesses = []
  scalpCareInput.capturedProductId = null
  scalpCareInput.subjectIdentity = null
  scalpCareInput.productFacts = null
  scalpCareInput.recommendationCandidates = [candidate]

  const result = evaluateStage3Authority(scalpCareInput)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "unknown")
  assert.equal(result.recommendation?.productId, candidate.productId)
  assert.deepEqual(result.allowedActions, ["plan_recommendation", "leave_uncovered"])
})

for (const category of ["shampoo", "conditioner", "leave_in", "oil", "mask"] as const) {
  test(`${category} still fails closed without its required suitable-thickness fact`, () => {
    const categoryInput = input(category, "known")
    if (!categoryInput.productFacts) throw new Error(`expected ${category} fixture`)
    categoryInput.productFacts.suitableThicknesses = null

    const result = evaluateStage3Authority(categoryInput)

    assert.equal(result.status, "unknown")
    if (result.status !== "unknown") return
    assert.ok(result.missingFacts.includes("suitable_thicknesses"))
  })
}

test("Heat candidate selection is stable across input order and UUID changes", () => {
  const heatInput = input("heat_protectant", "known") as Stage3AuthorityInput<"heat_protectant">
  heatInput.capturedProductId = null
  heatInput.subjectIdentity = null
  heatInput.productFacts = null

  const choose = (reverse: boolean, swapIds: boolean) => {
    const affordable = heatCandidate({
      productId: swapIds
        ? "ffffffff-ffff-4fff-8fff-ffffffffffff"
        : "00000000-0000-4000-8000-000000000000",
      displayName: "A Preis-Favorit",
      priceEur: 4.95,
      purchaseLinkStatus: "available",
    })
    const expensive = heatCandidate({
      productId: swapIds
        ? "00000000-0000-4000-8000-000000000000"
        : "ffffffff-ffff-4fff-8fff-ffffffffffff",
      displayName: "Z Preis-Alternative",
      priceEur: 8.95,
      purchaseLinkStatus: "available",
    })
    heatInput.recommendationCandidates = reverse ? [expensive, affordable] : [affordable, expensive]
    return evaluateStage3Authority(heatInput as never)
  }

  for (const result of [
    choose(false, false),
    choose(true, false),
    choose(false, true),
    choose(true, true),
  ]) {
    assert.equal(result.status, "known")
    if (result.status !== "known") continue
    assert.equal(result.recommendation?.displayName, "A Preis-Favorit")
  }
})

test("Heat candidate authority ignores commerce and presentation-only changes", () => {
  const evaluate = (commerce: {
    preferred: Required<
      Pick<
        Stage3AuthorityCommonProductFacts,
        | "priceEur"
        | "purchaseLinkStatus"
        | "netContentValue"
        | "netContentUnit"
        | "presentationImageUrl"
      >
    >
    alternative: Required<
      Pick<
        Stage3AuthorityCommonProductFacts,
        | "priceEur"
        | "purchaseLinkStatus"
        | "netContentValue"
        | "netContentUnit"
        | "presentationImageUrl"
      >
    >
  }) => {
    const heatInput = input("heat_protectant", "known") as Stage3AuthorityInput<"heat_protectant">
    heatInput.capturedProductId = null
    heatInput.subjectIdentity = null
    heatInput.productFacts = null

    const preferred = Object.assign(
      heatCandidate({
        productId: "semantic-preferred",
        displayName: "Z Semantisch bevorzugt",
        priceEur: commerce.preferred.priceEur,
        purchaseLinkStatus: commerce.preferred.purchaseLinkStatus,
      }),
      { catalogSortOrder: 1, ...commerce.preferred },
    )
    const alternative = Object.assign(
      heatCandidate({
        productId: "semantic-alternative",
        displayName: "A Semantische Alternative",
        priceEur: commerce.alternative.priceEur,
        purchaseLinkStatus: commerce.alternative.purchaseLinkStatus,
      }),
      { catalogSortOrder: 2, ...commerce.alternative },
    )
    heatInput.recommendationCandidates = [alternative, preferred]

    return evaluateStage3Authority(heatInput as never)
  }

  const baseline = evaluate({
    preferred: {
      priceEur: 49.95,
      purchaseLinkStatus: "unavailable",
      netContentValue: 75,
      netContentUnit: "ml",
      presentationImageUrl: "https://example.com/preferred-before.jpg",
    },
    alternative: {
      priceEur: 4.95,
      purchaseLinkStatus: "available",
      netContentValue: 250,
      netContentUnit: "g",
      presentationImageUrl: "https://example.com/alternative-before.jpg",
    },
  })
  const presentationChanged = evaluate({
    preferred: {
      priceEur: 0.01,
      purchaseLinkStatus: "available",
      netContentValue: 500,
      netContentUnit: "g",
      presentationImageUrl: "https://example.com/preferred-after.jpg",
    },
    alternative: {
      priceEur: 999.99,
      purchaseLinkStatus: "unavailable",
      netContentValue: 10,
      netContentUnit: "ml",
      presentationImageUrl: "https://example.com/alternative-after.jpg",
    },
  })

  for (const result of [baseline, presentationChanged]) {
    assert.equal(result.status, "known")
    if (result.status !== "known") continue
    assert.equal(result.recommendation?.productId, "semantic-preferred")
    assert.deepEqual(result.allowedActions, ["plan_recommendation", "leave_uncovered"])
    assert.equal(result.recommendationFactFingerprint, "facts-Z Semantisch bevorzugt")
  }
})

test("Heat candidate selection keeps unavailable products eligible by catalog order", () => {
  const heatInput = input("heat_protectant", "known") as Stage3AuthorityInput<"heat_protectant">
  heatInput.capturedProductId = null
  heatInput.subjectIdentity = null
  heatInput.productFacts = null
  heatInput.recommendationCandidates = [
    heatCandidate({
      productId: "cheap-unavailable",
      displayName: "A Nicht verfügbar",
      priceEur: null,
      purchaseLinkStatus: "unavailable",
    }),
    heatCandidate({
      productId: "available",
      displayName: "Z Verfügbar",
      priceEur: 7.95,
      purchaseLinkStatus: "available",
    }),
  ]
  heatInput.recommendationCandidates[0]!.catalogSortOrder = 1
  heatInput.recommendationCandidates[1]!.catalogSortOrder = 2

  const result = evaluateStage3Authority(heatInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.recommendation?.productId, "cheap-unavailable")
})

test("Heat candidate selection uses a stable name fallback instead of UUID or insertion order", () => {
  const heatInput = input("heat_protectant", "known") as Stage3AuthorityInput<"heat_protectant">
  heatInput.capturedProductId = null
  heatInput.subjectIdentity = null
  heatInput.productFacts = null

  const choose = (reverse: boolean, swapIds: boolean) => {
    const alpha = heatCandidate({
      productId: swapIds
        ? "ffffffff-ffff-4fff-8fff-ffffffffffff"
        : "00000000-0000-4000-8000-000000000000",
      displayName: "Alpha Spray",
      priceEur: 5.95,
      purchaseLinkStatus: "available",
    })
    const zeta = heatCandidate({
      productId: swapIds
        ? "00000000-0000-4000-8000-000000000000"
        : "ffffffff-ffff-4fff-8fff-ffffffffffff",
      displayName: "Zeta Spray",
      priceEur: 5.95,
      purchaseLinkStatus: "available",
    })
    heatInput.recommendationCandidates = reverse ? [zeta, alpha] : [alpha, zeta]
    return evaluateStage3Authority(heatInput as never)
  }

  for (const result of [
    choose(false, false),
    choose(true, false),
    choose(false, true),
    choose(true, true),
  ]) {
    assert.equal(result.status, "known")
    if (result.status !== "known") continue
    assert.equal(result.recommendation?.displayName, "Alpha Spray")
  }
})

test("Heat candidate selection leaves a non-UUID tie unresolved", () => {
  const heatInput = input("heat_protectant", "known") as Stage3AuthorityInput<"heat_protectant">
  heatInput.capturedProductId = null
  heatInput.subjectIdentity = null
  heatInput.productFacts = null
  heatInput.recommendationCandidates = [
    heatCandidate({
      productId: "00000000-0000-4000-8000-000000000000",
      displayName: "Gleicher stabiler Name",
      priceEur: 5.95,
      purchaseLinkStatus: "available",
    }),
    heatCandidate({
      productId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      displayName: "Gleicher stabiler Name",
      priceEur: 5.95,
      purchaseLinkStatus: "available",
    }),
  ]

  const result = evaluateStage3Authority(heatInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.recommendation, null)
  assert.deepEqual(result.allowedActions, ["leave_uncovered"])
})

test("bondbuilder without a suitable candidate remains unknown", () => {
  const bondbuilderInput = input("bondbuilder", "known")
  bondbuilderInput.capturedProductId = null
  bondbuilderInput.subjectIdentity = null
  bondbuilderInput.productFacts = null

  const result = evaluateStage3Authority(bondbuilderInput)
  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "unknown")
  assert.deepEqual(result.allowedActions, ["leave_uncovered"])
  assert.equal(result.recommendation, null)
  assert.equal(result.productFactFingerprint, null)
  assert.equal(result.recommendationFactFingerprint, null)
})

test("Conditioner recommendation ranking prefers ideal authority before catalog order", () => {
  const conditionerInput = input("conditioner", "known") as Stage3AuthorityInput<"conditioner">
  conditionerInput.capturedProductId = null
  conditionerInput.subjectIdentity = null
  conditionerInput.productFacts = null
  const ideal = knownFacts("conditioner")
  if (ideal.category !== "conditioner") throw new Error("expected Conditioner fixture")
  const supportive = structuredClone(ideal)
  supportive.recommendable = true
  supportive.productId = "conditioner-supportive"
  supportive.displayName = "A Supportive"
  supportive.catalogSortOrder = 1
  supportive.spec.weight = "medium"
  ideal.productId = "conditioner-ideal"
  ideal.recommendable = true
  ideal.displayName = "Z Ideal"
  ideal.catalogSortOrder = 2
  conditionerInput.recommendationCandidates = [supportive, ideal]

  const result = evaluateStage3Authority(conditionerInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "ideal")
  assert.equal(result.recommendation?.productId, "conditioner-ideal")
})

for (const route of [
  {
    name: "oily",
    scalpRoute: "oily" as const,
    everydayConstraint: "standard" as const,
    role: "shampoo_everyday" as const,
    bucket: "dehydriert-fettig",
    catalogScalpRoute: "oily",
  },
  {
    name: "dry",
    scalpRoute: "dry" as const,
    everydayConstraint: "gentle_dry_scalp" as const,
    role: "shampoo_everyday" as const,
    bucket: "trocken",
    catalogScalpRoute: "dry",
  },
  {
    name: "irritation",
    scalpRoute: "balanced" as const,
    everydayConstraint: "irritation_compatible" as const,
    role: "shampoo_everyday" as const,
    bucket: "irritationen",
    catalogScalpRoute: "irritated",
  },
  {
    name: "balanced",
    scalpRoute: "balanced" as const,
    everydayConstraint: "standard" as const,
    role: "shampoo_everyday" as const,
    bucket: "normal",
    catalogScalpRoute: "balanced",
  },
  {
    name: "dandruff",
    scalpRoute: "oily" as const,
    everydayConstraint: "standard" as const,
    role: "shampoo_dandruff" as const,
    bucket: "schuppen",
    catalogScalpRoute: "dandruff",
  },
]) {
  test(`Shampoo authority evaluates the exact signed ${route.name} bucket`, () => {
    const shampooInput = input("shampoo", "known") as Stage3AuthorityInput<"shampoo">
    shampooInput.role = route.role
    shampooInput.categoryDecision = {
      ...shampooInput.categoryDecision,
      roles: [route.role],
      target: {
        category: "shampoo",
        roles: [route.role],
        scalpRoute: route.scalpRoute,
        everydayConstraint: route.everydayConstraint,
        requiresTargetedDandruffCapability: route.role === "shampoo_dandruff",
      },
    }
    if (shampooInput.productFacts) {
      shampooInput.productFacts.spec.shampooBucket = route.bucket
      shampooInput.productFacts.spec.scalpRoute = route.catalogScalpRoute
      shampooInput.productFacts.spec.cleansingIntensity =
        route.bucket === "trocken" || route.bucket === "irritationen" ? "gentle" : "regular"
      shampooInput.productFacts.protocols = [
        {
          role: route.role,
          status: "verified_complete",
          fingerprint: `protocol-${route.name}`,
        },
      ]
    }

    const result = evaluateStage3Authority(shampooInput as never)

    assert.equal(result.status, "known")
    if (result.status !== "known") return
    assert.equal(result.verdict, "ideal")
  })
}

for (const route of [
  {
    name: "dandruff",
    scalpRoute: "oily" as const,
    everydayConstraint: "standard" as const,
    role: "shampoo_dandruff" as const,
    bucket: "schuppen",
    catalogScalpRoute: "dandruff",
    catalogCleansingIntensity: "regular",
  },
  {
    name: "irritation",
    scalpRoute: "balanced" as const,
    everydayConstraint: "irritation_compatible" as const,
    role: "shampoo_everyday" as const,
    bucket: "irritationen",
    catalogScalpRoute: "irritated",
    catalogCleansingIntensity: "gentle",
  },
  {
    name: "dry-scalp override",
    scalpRoute: "oily" as const,
    everydayConstraint: "gentle_dry_scalp" as const,
    role: "shampoo_everyday" as const,
    bucket: "trocken",
    catalogScalpRoute: "dry",
    catalogCleansingIntensity: "gentle",
  },
]) {
  test(`complete Shampoo authority translates ${route.name} into catalogue route semantics`, () => {
    const shampooInput = input("shampoo", "known") as Stage3AuthorityInput<"shampoo">
    shampooInput.role = route.role
    shampooInput.categoryDecision = {
      ...shampooInput.categoryDecision,
      roles: [route.role],
      target: {
        category: "shampoo",
        roles: [route.role],
        scalpRoute: route.scalpRoute,
        everydayConstraint: route.everydayConstraint,
        requiresTargetedDandruffCapability: route.role === "shampoo_dandruff",
      },
    }
    if (!shampooInput.productFacts) throw new Error("expected Shampoo facts")
    shampooInput.productFacts.spec.shampooBucket = route.bucket
    shampooInput.productFacts.spec.scalpRoute = route.catalogScalpRoute
    shampooInput.productFacts.spec.cleansingIntensity = route.catalogCleansingIntensity
    shampooInput.productFacts.protocols = [
      { role: route.role, status: "verified_complete", fingerprint: `protocol-${route.name}` },
    ]

    const result = evaluateStage3Authority(shampooInput as never)

    assert.equal(result.status, "known")
    if (result.status !== "known") return
    assert.equal(result.verdict, "ideal")
  })
}

test("complete Shampoo authority treats a non-target cleansing intensity as supportive", () => {
  const shampooInput = input("shampoo", "known") as Stage3AuthorityInput<"shampoo">
  shampooInput.categoryDecision = {
    ...shampooInput.categoryDecision,
    target: {
      category: "shampoo",
      roles: ["shampoo_everyday"],
      scalpRoute: "balanced",
      everydayConstraint: "irritation_compatible",
      requiresTargetedDandruffCapability: false,
    },
  }
  if (!shampooInput.productFacts) throw new Error("expected Shampoo facts")
  shampooInput.productFacts.spec.shampooBucket = "irritationen"
  shampooInput.productFacts.spec.scalpRoute = "irritated"
  shampooInput.productFacts.spec.cleansingIntensity = "regular"

  const result = evaluateStage3Authority(shampooInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "supportive")
  assert.equal(result.criteria[0]?.criterionId, "shampoo.role")
  assert.equal(result.criteria[0]?.result, "pass")
  assert.equal(result.criteria[1]?.criterionId, "shampoo.cleansing_intensity")
  assert.equal(result.criteria[1]?.result, "caution")
  assert.deepEqual(result.allowedActions, ["keep_owned", "leave_uncovered"])
})
test("Scalp Care keeps comfort complementary while root reset suppresses only exfoliant", () => {
  const comfortInput = input("scalp_care", "known") as Stage3AuthorityInput<"scalp_care">
  const comfortCandidate = knownFacts("scalp_care")
  if (comfortCandidate.category !== "scalp_care") throw new Error("expected Scalp Care fixture")
  comfortCandidate.recommendable = true
  comfortInput.capturedProductId = null
  comfortInput.subjectIdentity = null
  comfortInput.productFacts = null
  comfortInput.recommendationCandidates = [comfortCandidate]
  comfortInput.coverage = [
    {
      job: "scalp_flake_or_comfort",
      ruleId: "portfolio.scalp.shampoo_primary",
      primaryCategories: ["shampoo"],
      supportingCategories: ["scalp_care"],
      outcome: "duplicate_purchase_suppressed",
    },
    {
      job: "scalp_root_reset",
      ruleId: "portfolio.reset.deep_cleansing_primary",
      primaryCategories: ["deep_cleansing_shampoo"],
      supportingCategories: ["scalp_care"],
      outcome: "duplicate_purchase_suppressed",
    },
  ]

  const comfort = evaluateStage3Authority(comfortInput as never)
  assert.equal(comfort.status, "known")
  if (comfort.status !== "known") return
  assert.equal(comfort.recommendation?.productId, comfortCandidate.productId)

  const exfoliantInput = structuredClone(comfortInput) as Stage3AuthorityInput<"scalp_care">
  exfoliantInput.role = "scalp_exfoliant"
  exfoliantInput.subjectKey = "decision:scalp_care:scalp_exfoliant:gap"
  exfoliantInput.categoryDecision.roles = ["scalp_exfoliant"]
  exfoliantInput.categoryDecision.target = {
    category: "scalp_care",
    roles: ["scalp_exfoliant"],
    roleTargets: [{ role: "scalp_exfoliant", coverage: "primary" }],
  }
  if (exfoliantInput.recommendationCandidates[0]?.category !== "scalp_care") {
    throw new Error("expected Scalp Care candidate")
  }
  exfoliantInput.recommendationCandidates[0].spec.primaryRole = "scalp_exfoliant"
  exfoliantInput.recommendationCandidates[0].protocols = [
    { role: "scalp_exfoliant", status: "verified_complete", fingerprint: "protocol-exfoliant" },
  ]

  const exfoliant = evaluateStage3Authority(exfoliantInput as never)
  assert.equal(exfoliant.status, "known")
  if (exfoliant.status !== "known") return
  assert.equal(exfoliant.recommendation, null)
  assert.deepEqual(exfoliant.allowedActions, ["leave_uncovered"])
  assert.match(exfoliant.criteria[0]?.explanation ?? "", /Tiefenreinigung.*Kopfhaut-Peeling/)
})

function leaveInTargetForCoverageTests() {
  return {
    ...(TARGETS.leave_in as Record<string, unknown>),
    weight: "rich",
    careDirection: "moisture",
    repairSupportLevel: "high",
  } as never
}

function leaveInCoverageCandidate(overrides: {
  productId: string
  displayName: string
  catalogSortOrder: number
  weight: "light" | "medium" | "rich"
  careDirection: "moisture" | "balanced" | "protein"
  repairSupportLevel: "low" | "medium" | "high"
}) {
  const facts = knownFacts("leave_in")
  if (facts.category !== "leave_in") throw new Error("expected Leave-in fixture")
  Object.assign(facts, {
    productId: overrides.productId,
    displayName: overrides.displayName,
    catalogSortOrder: overrides.catalogSortOrder,
    recommendable: true,
    factFingerprint: `facts-${overrides.productId}`,
  })
  facts.spec.weight = overrides.weight
  facts.spec.careDirection = overrides.careDirection
  facts.spec.repairSupportLevel = overrides.repairSupportLevel
  return facts
}

test("Leave-in uncovered-role recommendation ranks candidates by displayed coverage, not catalog order", () => {
  const leaveInInput = input("leave_in", "known") as Stage3AuthorityInput<"leave_in">
  leaveInInput.capturedProductId = null
  leaveInInput.subjectIdentity = null
  leaveInInput.productFacts = null
  leaveInInput.categoryDecision.target = leaveInTargetForCoverageTests()

  // A: 1/3 dimensions match the target, listed first in catalog order.
  const lowCoverage = leaveInCoverageCandidate({
    productId: "leave-in-low-coverage",
    displayName: "Wenig Übereinstimmung",
    catalogSortOrder: 1,
    weight: "medium",
    careDirection: "balanced",
    repairSupportLevel: "high",
  })
  // B: 2/3 dimensions match the target, listed last in catalog order.
  const highCoverage = leaveInCoverageCandidate({
    productId: "leave-in-high-coverage",
    displayName: "Hohe Übereinstimmung",
    catalogSortOrder: 9,
    weight: "rich",
    careDirection: "moisture",
    repairSupportLevel: "medium",
  })
  leaveInInput.recommendationCandidates = [lowCoverage, highCoverage]

  const result = evaluateStage3Authority(leaveInInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "supportive")
  assert.equal(result.recommendation?.productId, "leave-in-high-coverage")
})

test("Leave-in uncovered-role recommendation still prefers an ideal candidate over better-covered supportive ones", () => {
  const leaveInInput = input("leave_in", "known") as Stage3AuthorityInput<"leave_in">
  leaveInInput.capturedProductId = null
  leaveInInput.subjectIdentity = null
  leaveInInput.productFacts = null
  leaveInInput.categoryDecision.target = leaveInTargetForCoverageTests()

  const ideal = leaveInCoverageCandidate({
    productId: "leave-in-ideal",
    displayName: "Ideal",
    catalogSortOrder: 50,
    weight: "rich",
    careDirection: "moisture",
    repairSupportLevel: "high",
  })
  const betterCoveredSupportive = leaveInCoverageCandidate({
    productId: "leave-in-high-coverage",
    displayName: "Hohe Übereinstimmung",
    catalogSortOrder: 1,
    weight: "rich",
    careDirection: "moisture",
    repairSupportLevel: "medium",
  })
  leaveInInput.recommendationCandidates = [betterCoveredSupportive, ideal]

  const result = evaluateStage3Authority(leaveInInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "ideal")
  assert.equal(result.recommendation?.productId, "leave-in-ideal")
})

test("Leave-in uncovered-role recommendation falls back to catalog order once verdict and coverage tie", () => {
  const leaveInInput = input("leave_in", "known") as Stage3AuthorityInput<"leave_in">
  leaveInInput.capturedProductId = null
  leaveInInput.subjectIdentity = null
  leaveInInput.productFacts = null
  leaveInInput.categoryDecision.target = leaveInTargetForCoverageTests()

  // Identical fit on every axis (same verdict, same coverage, same caution
  // count) -- only catalogSortOrder differs, so the lower one must win.
  const laterInCatalog = leaveInCoverageCandidate({
    productId: "leave-in-tie-later",
    displayName: "Später im Katalog",
    catalogSortOrder: 5,
    weight: "medium",
    careDirection: "balanced",
    repairSupportLevel: "high",
  })
  const earlierInCatalog = leaveInCoverageCandidate({
    productId: "leave-in-tie-earlier",
    displayName: "Früher im Katalog",
    catalogSortOrder: 2,
    weight: "medium",
    careDirection: "balanced",
    repairSupportLevel: "high",
  })
  leaveInInput.recommendationCandidates = [laterInCatalog, earlierInCatalog]

  const result = evaluateStage3Authority(leaveInInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "supportive")
  assert.equal(result.recommendation?.productId, "leave-in-tie-earlier")
})

function conditionerTargetForCoverageTests() {
  return {
    ...(TARGETS.conditioner as Record<string, unknown>),
    weight: "rich",
    careDirection: "moisture",
    repairSupportLevel: "high",
  } as never
}

function conditionerCoverageCandidate(overrides: {
  productId: string
  displayName: string
  catalogSortOrder: number
  weight: "light" | "medium" | "rich"
  balance: "moisture" | "balanced" | "protein"
  repairSupportLevel: "low" | "medium" | "high"
}) {
  const facts = knownFacts("conditioner")
  if (facts.category !== "conditioner") throw new Error("expected Conditioner fixture")
  Object.assign(facts, {
    productId: overrides.productId,
    displayName: overrides.displayName,
    catalogSortOrder: overrides.catalogSortOrder,
    recommendable: true,
    factFingerprint: `facts-${overrides.productId}`,
  })
  facts.spec.weight = overrides.weight
  facts.spec.proteinMoistureBalance = overrides.balance
  facts.spec.balanceDirection = overrides.balance
  facts.spec.repairSupportLevel = overrides.repairSupportLevel
  return facts
}

test("Conditioner uncovered-role recommendation ranks candidates by displayed coverage, not catalog order", () => {
  const conditionerInput = input("conditioner", "known") as Stage3AuthorityInput<"conditioner">
  conditionerInput.capturedProductId = null
  conditionerInput.subjectIdentity = null
  conditionerInput.productFacts = null
  conditionerInput.categoryDecision.target = conditionerTargetForCoverageTests()

  const lowCoverage = conditionerCoverageCandidate({
    productId: "conditioner-low-coverage",
    displayName: "Wenig Übereinstimmung",
    catalogSortOrder: 1,
    weight: "medium",
    balance: "balanced",
    repairSupportLevel: "high",
  })
  const highCoverage = conditionerCoverageCandidate({
    productId: "conditioner-high-coverage",
    displayName: "Hohe Übereinstimmung",
    catalogSortOrder: 9,
    weight: "rich",
    balance: "moisture",
    repairSupportLevel: "medium",
  })
  conditionerInput.recommendationCandidates = [lowCoverage, highCoverage]

  const result = evaluateStage3Authority(conditionerInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "supportive")
  assert.equal(result.recommendation?.productId, "conditioner-high-coverage")
})

test("Conditioner uncovered-role recommendation still prefers an ideal candidate over better-covered supportive ones", () => {
  const conditionerInput = input("conditioner", "known") as Stage3AuthorityInput<"conditioner">
  conditionerInput.capturedProductId = null
  conditionerInput.subjectIdentity = null
  conditionerInput.productFacts = null
  conditionerInput.categoryDecision.target = conditionerTargetForCoverageTests()

  const ideal = conditionerCoverageCandidate({
    productId: "conditioner-ideal",
    displayName: "Ideal",
    catalogSortOrder: 50,
    weight: "rich",
    balance: "moisture",
    repairSupportLevel: "high",
  })
  const betterCoveredSupportive = conditionerCoverageCandidate({
    productId: "conditioner-high-coverage",
    displayName: "Hohe Übereinstimmung",
    catalogSortOrder: 1,
    weight: "rich",
    balance: "moisture",
    repairSupportLevel: "medium",
  })
  conditionerInput.recommendationCandidates = [betterCoveredSupportive, ideal]

  const result = evaluateStage3Authority(conditionerInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "ideal")
  assert.equal(result.recommendation?.productId, "conditioner-ideal")
})

test("Conditioner uncovered-role recommendation falls back to catalog order once verdict and coverage tie", () => {
  const conditionerInput = input("conditioner", "known") as Stage3AuthorityInput<"conditioner">
  conditionerInput.capturedProductId = null
  conditionerInput.subjectIdentity = null
  conditionerInput.productFacts = null
  conditionerInput.categoryDecision.target = conditionerTargetForCoverageTests()

  const laterInCatalog = conditionerCoverageCandidate({
    productId: "conditioner-tie-later",
    displayName: "Später im Katalog",
    catalogSortOrder: 5,
    weight: "medium",
    balance: "balanced",
    repairSupportLevel: "high",
  })
  const earlierInCatalog = conditionerCoverageCandidate({
    productId: "conditioner-tie-earlier",
    displayName: "Früher im Katalog",
    catalogSortOrder: 2,
    weight: "medium",
    balance: "balanced",
    repairSupportLevel: "high",
  })
  conditionerInput.recommendationCandidates = [laterInCatalog, earlierInCatalog]

  const result = evaluateStage3Authority(conditionerInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "supportive")
  assert.equal(result.recommendation?.productId, "conditioner-tie-earlier")
})

function oilLeaveOnInput(targetWeight: "light" | "medium" | "rich" | null) {
  const oilInput = input("oil", "known") as Stage3AuthorityInput<"oil">
  oilInput.role = "leave_on_fibre_conditioning"
  oilInput.subjectKey = "decision:oil:leave_on_fibre_conditioning:owned-1"
  oilInput.capturedProductId = null
  oilInput.subjectIdentity = null
  oilInput.productFacts = null
  oilInput.categoryDecision.roles = ["leave_on_fibre_conditioning"]
  oilInput.categoryDecision.target = {
    category: "oil",
    roles: ["leave_on_fibre_conditioning"],
    roleTargets: [
      {
        role: "leave_on_fibre_conditioning",
        tier: "basis",
        weight: targetWeight,
        functionalBenefits: [],
      },
    ],
  } as never
  return oilInput
}

function oilCoverageCandidate(overrides: {
  productId: string
  catalogSortOrder: number
  weight: "light" | "medium" | "rich" | null
  role?: "leave_on_fibre_conditioning" | "dry_finish" | "pre_wash_fibre_treatment"
}) {
  const facts = knownFacts("oil")
  if (facts.category !== "oil") throw new Error("expected Oil fixture")
  const role = overrides.role ?? "leave_on_fibre_conditioning"
  Object.assign(facts, {
    productId: overrides.productId,
    displayName: overrides.productId,
    catalogSortOrder: overrides.catalogSortOrder,
    recommendable: true,
    factFingerprint: `facts-${overrides.productId}`,
    protocols: [
      { role, status: "verified_complete", fingerprint: `protocol-${overrides.productId}` },
    ],
  })
  facts.spec.roleSupport = { [role]: true }
  facts.spec.weight = overrides.weight
  facts.spec.targetThicknessEligible = true
  return facts
}

test("Oil uncovered-role recommendation ranks exact-weight ideal candidates by coverage/sortOrder, not array order", () => {
  // Regression: old code picked the first exact-weight candidate in array
  // order. A is listed first with a worse catalogSortOrder; the comparator
  // must promote B.
  const oilInput = oilLeaveOnInput("light")
  const worseSortOrderFirst = oilCoverageCandidate({
    productId: "oil-exact-a",
    catalogSortOrder: 5,
    weight: "light",
  })
  const betterSortOrderSecond = oilCoverageCandidate({
    productId: "oil-exact-b",
    catalogSortOrder: 2,
    weight: "light",
  })
  oilInput.recommendationCandidates = [worseSortOrderFirst, betterSortOrderSecond]

  const result = evaluateStage3Authority(oilInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.recommendation?.productId, "oil-exact-b")
  assert.equal(result.recommendation?.authorityRuleId, "oil.recommendation.role_verified")
})

test("Oil uncovered-role recommendation falls back to an adjacent-weight supportive candidate", () => {
  const oilInput = oilLeaveOnInput("light")
  const adjacent = oilCoverageCandidate({
    productId: "oil-adjacent",
    catalogSortOrder: 1,
    weight: "medium",
  })
  oilInput.recommendationCandidates = [adjacent]

  const result = evaluateStage3Authority(oilInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.recommendation?.productId, "oil-adjacent")
  assert.equal(
    result.recommendation?.authorityRuleId,
    "oil.recommendation.role_verified_supportive_weight",
  )
  assert.deepEqual(result.allowedActions, ["plan_recommendation", "leave_uncovered"])
})

test("Oil uncovered-role recommendation prefers an exact-weight candidate over a better-sorted adjacent one", () => {
  const oilInput = oilLeaveOnInput("light")
  const exact = oilCoverageCandidate({
    productId: "oil-exact",
    catalogSortOrder: 9,
    weight: "light",
  })
  const adjacentEarlier = oilCoverageCandidate({
    productId: "oil-adjacent-early",
    catalogSortOrder: 1,
    weight: "medium",
  })
  oilInput.recommendationCandidates = [adjacentEarlier, exact]

  const result = evaluateStage3Authority(oilInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.recommendation?.productId, "oil-exact")
  assert.equal(result.recommendation?.authorityRuleId, "oil.recommendation.role_verified")
})

test("Oil uncovered-role recommendation excludes distance-2 and null-weight leave-on candidates but ignores weight for non-leave-on roles", () => {
  const oilInput = oilLeaveOnInput("light")
  const farCandidate = oilCoverageCandidate({
    productId: "oil-far",
    catalogSortOrder: 1,
    weight: "rich",
  })
  const nullWeightCandidate = oilCoverageCandidate({
    productId: "oil-null-weight",
    catalogSortOrder: 2,
    weight: null,
  })
  oilInput.recommendationCandidates = [farCandidate, nullWeightCandidate]

  const result = evaluateStage3Authority(oilInput as never)
  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.recommendation, null)
  assert.deepEqual(result.allowedActions, ["leave_uncovered"])

  const preWashInput = input("oil", "known") as Stage3AuthorityInput<"oil">
  preWashInput.role = "pre_wash_fibre_treatment"
  preWashInput.subjectKey = "decision:oil:pre_wash_fibre_treatment:owned-1"
  preWashInput.capturedProductId = null
  preWashInput.subjectIdentity = null
  preWashInput.productFacts = null
  preWashInput.categoryDecision.roles = ["pre_wash_fibre_treatment"]
  preWashInput.categoryDecision.target = {
    category: "oil",
    roles: ["pre_wash_fibre_treatment"],
    roleTargets: [
      { role: "pre_wash_fibre_treatment", tier: "basis", weight: null, functionalBenefits: [] },
    ],
  } as never
  const preWashCandidate = oilCoverageCandidate({
    productId: "oil-pre-wash",
    catalogSortOrder: 1,
    weight: "rich",
    role: "pre_wash_fibre_treatment",
  })
  preWashInput.recommendationCandidates = [preWashCandidate]

  const preWashResult = evaluateStage3Authority(preWashInput as never)
  assert.equal(preWashResult.status, "known")
  if (preWashResult.status !== "known") return
  assert.equal(preWashResult.recommendation?.productId, "oil-pre-wash")
  assert.equal(preWashResult.recommendation?.authorityRuleId, "oil.recommendation.role_verified")
})

test("Oil uncovered-role recommendation preserves no-recommendation behavior when the leave-on target weight is unknown", () => {
  const oilInput = oilLeaveOnInput(null)
  const candidate = oilCoverageCandidate({
    productId: "oil-any-weight",
    catalogSortOrder: 1,
    weight: "light",
  })
  oilInput.recommendationCandidates = [candidate]

  const result = evaluateStage3Authority(oilInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.recommendation, null)
  assert.deepEqual(result.allowedActions, ["leave_uncovered"])
})

test("Mask uncovered-role recommendation ranks in a supportive candidate for a required tier", () => {
  const maskInput = input("mask", "known") as Stage3AuthorityInput<"mask">
  maskInput.capturedProductId = null
  maskInput.subjectIdentity = null
  maskInput.productFacts = null
  maskInput.categoryDecision.needTier = "basis"
  if (maskInput.categoryDecision.target?.category !== "mask") throw new Error("expected target")
  maskInput.categoryDecision.target.repairSupportLevel = "high"
  const supportiveCandidate = knownFacts("mask")
  if (supportiveCandidate.category !== "mask") throw new Error("expected Mask fixture")
  Object.assign(supportiveCandidate, {
    productId: "mask-required-supportive",
    displayName: "Erforderlich Unterstützend",
    recommendable: true,
    presentationImageUrl: "https://example.com/required.webp",
    factFingerprint: "facts-required-supportive",
  })
  supportiveCandidate.spec.weight = "rich"
  supportiveCandidate.spec.repairSupportLevel = "high"
  maskInput.recommendationCandidates = [supportiveCandidate]

  const result = evaluateStage3Authority(maskInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "supportive")
  assert.equal(result.recommendation?.productId, "mask-required-supportive")
  assert.equal(result.recommendation?.authorityRuleId, "mask.stage3.validated_supportive_candidate")
  assert.deepEqual(result.allowedActions, ["plan_recommendation", "leave_uncovered"])
})

test("Mask uncovered-role recommendation still prefers an ideal candidate over a supportive one at a required tier", () => {
  const maskInput = input("mask", "known") as Stage3AuthorityInput<"mask">
  maskInput.capturedProductId = null
  maskInput.subjectIdentity = null
  maskInput.productFacts = null
  maskInput.categoryDecision.needTier = "basis"
  const ideal = knownFacts("mask")
  const supportive = knownFacts("mask")
  if (ideal.category !== "mask" || supportive.category !== "mask") {
    throw new Error("expected Mask fixtures")
  }
  Object.assign(ideal, {
    productId: "mask-required-ideal",
    displayName: "Ideal",
    recommendable: true,
    presentationImageUrl: "https://example.com/ideal.webp",
    catalogSortOrder: 50,
    factFingerprint: "facts-required-ideal",
  })
  Object.assign(supportive, {
    productId: "mask-required-supportive-2",
    displayName: "Unterstützend",
    recommendable: true,
    presentationImageUrl: "https://example.com/supportive.webp",
    catalogSortOrder: 1,
    factFingerprint: "facts-required-supportive-2",
  })
  supportive.spec.weight = "rich"
  maskInput.recommendationCandidates = [supportive, ideal]

  const result = evaluateStage3Authority(maskInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "ideal")
  assert.equal(result.recommendation?.productId, "mask-required-ideal")
})
