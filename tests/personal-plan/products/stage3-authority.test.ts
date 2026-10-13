import assert from "node:assert/strict"
import { UNKNOWN_SELECTION_PROFILE } from "../../../src/lib/personal-plan/products/authority/selection-profile"
import test from "node:test"

import { CATEGORY_ROLE_POLICIES } from "../../../src/lib/personal-plan/products/authorities"
import {
  bondbuilderShortlist,
  compareBondbuilderTieOrder,
} from "../../../src/lib/personal-plan/products/authority/categories/bondbuilder"
import { evaluateStage3Authority } from "../../../src/lib/personal-plan/products/authority/evaluate"
import { comparisonDimensions } from "../../../src/lib/personal-plan/products/comparison-dimensions"
import type {
  Stage3AuthorityCommonProductFacts,
  Stage3AuthorityInput,
  Stage3CategoryProductFacts,
} from "../../../src/lib/personal-plan/products/authority/contracts"
import type { PersonalPlanCategory } from "../../../src/lib/personal-plan/products/contracts"

const K18_PRODUCT_ID = "38dace91-0fba-49ee-a93f-ac36e488fe4b"

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
        // fit-verdict spec §2, ruled 2026-10-12: lifecycle includes recommendability.
        recommendable: true,
        spec: {
          thickness: "normal",
          thicknesses: ["normal"],
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
        // fit-verdict spec §2, ruled 2026-10-12: lifecycle includes recommendability.
        recommendable: true,
        spec: {
          thickness: "normal",
          thicknesses: ["normal"],
          proteinMoistureBalance: "moisture",
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
        // fit-verdict spec §2, ruled 2026-10-12: the ideal fixture must be recommendable.
        recommendable: true,
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
      // fit-verdict spec §2, ruled 2026-10-12: lifecycle includes recommendability.
      return {
        ...base,
        category,
        recommendable: true,
        spec: { format: "spray", providesHeatProtection: true },
      }
    case "oil":
      return {
        ...base,
        category,
        // fit-verdict spec §2, ruled 2026-10-12: lifecycle includes recommendability.
        recommendable: true,
        spec: {
          roleSupport: { dry_finish: true },
          thicknesses: ["normal"],
          weight: "light",
          targetThicknessEligible: true,
          providesHeatProtection: false,
        },
      }
    case "mask":
      return {
        ...base,
        category,
        // fit-verdict spec §2, ruled 2026-10-12: the ideal fixture must be recommendable.
        recommendable: true,
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
        // fit-verdict spec §2, ruled 2026-10-12: lifecycle includes recommendability.
        recommendable: true,
        spec: { primaryRole: "scalp_comfort", presentationFormat: "serum", rinseMode: "leave_on" },
      }
    case "dry_shampoo":
      return {
        ...base,
        category,
        // fit-verdict spec §2, ruled 2026-10-12: lifecycle includes recommendability.
        recommendable: true,
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
        // fit-verdict spec §2, ruled 2026-10-12: lifecycle includes recommendability.
        recommendable: true,
        spec: {
          applicationMode: "pre_shampoo",
          treatmentMode: "standalone",
          productFormat: "treatment",
          usageProtocol: "verified_course",
          relationship: "standalone",
          // fit-verdict spec §6, ruled 2026-10-12: use reviewed technology facts.
          technologyFamily: "sulfur_targeting_dimaleate",
          claimTrustLevel: "high",
          trustBasis: "owner_anchor",
        },
      }
    case "deep_cleansing_shampoo":
      return {
        ...base,
        category,
        // fit-verdict spec §2, ruled 2026-10-12: lifecycle includes recommendability.
        recommendable: true,
        spec: {
          supportedResetRoles: ["residue_reset"],
          targetScalpTypes: null,
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
      target: state === "unsupported" ? null : structuredClone(TARGETS[category]),
      frequency: null,
      reasons: [],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: [],
    } as never,
    selectionProfile: UNKNOWN_SELECTION_PROFILE,
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

test("Leave-in heat claim and verified shared protocol cover pre-heat without a label timing claim", () => {
  const heatInput = input("leave_in", "known") as Stage3AuthorityInput<"leave_in">
  heatInput.role = "pre_heat_application"
  heatInput.categoryDecision.roles = ["pre_heat_application"]
  if (heatInput.categoryDecision.target?.category !== "leave_in") throw new Error("fixture")
  heatInput.categoryDecision.target.roles = ["pre_heat_application"]
  if (heatInput.productFacts?.category !== "leave_in") throw new Error("fixture")
  heatInput.productFacts.spec.roles = ["post_wash_leave_in", "pre_heat_application"]
  heatInput.productFacts.spec.providesHeatProtection = true
  heatInput.productFacts.spec.applicationStages = ["towel_dry"]
  heatInput.productFacts.protocols = [
    { role: "pre_heat_application", status: "verified_complete", fingerprint: "shared-heat" },
  ]

  const covered = evaluateStage3Authority(heatInput as never)
  assert.equal(covered.status, "known")
  if (covered.status === "known") assert.equal(covered.verdict, "ideal")

  heatInput.productFacts.protocols = []
  assert.equal(evaluateStage3Authority(heatInput as never).status, "unknown")

  heatInput.productFacts.protocols = [
    { role: "pre_heat_application", status: "verified_complete", fingerprint: "shared-heat" },
  ]
  heatInput.productFacts.spec.providesHeatProtection = false
  const noHeatClaim = evaluateStage3Authority(heatInput as never)
  assert.equal(noHeatClaim.status, "known")
  if (noHeatClaim.status === "known") assert.equal(noHeatClaim.verdict, "mismatch")
})

test("supportive owned-product verdicts retain explicit keep and uncovered actions", () => {
  const conditionerInput = input("conditioner", "known") as Stage3AuthorityInput<"conditioner">
  if (conditionerInput.productFacts?.category !== "conditioner") throw new Error("fixture")
  conditionerInput.productFacts.spec.weight = "medium"
  const leaveInInput = input("leave_in", "known") as Stage3AuthorityInput<"leave_in">
  if (leaveInInput.productFacts?.category !== "leave_in") throw new Error("fixture")
  leaveInInput.productFacts.spec.weight = "medium"
  const maskInput = input("mask", "known") as Stage3AuthorityInput<"mask">
  if (maskInput.productFacts?.category !== "mask") throw new Error("fixture")
  // fit-verdict spec §§3–4, ruled 2026-10-12: exactly one weight step is supportive.
  maskInput.productFacts.spec.weight = "medium"
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
    // fit-verdict spec §6, ruled 2026-10-12: an add-on cannot cover the role alone.
    if (authorityInput.category === "bondbuilder") {
      assert.equal(result.verdict, "mismatch")
      assert.deepEqual(result.allowedActions, ["acknowledge_override", "leave_uncovered"])
      continue
    }
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
    if (category === "bondbuilder") {
      assert.equal(result.recommendationFactFingerprint, null)
    }
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
    priceEur:
      productId === K18_PRODUCT_ID
        ? 56.25
        : productId.startsWith("olaplex")
          ? 34
          : productId === "epres"
            ? 48
            : null,
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

test("a Bondbuilder tie selects the cheapest option without claiming it is the better product", () => {
  const k18 = bondbuilderCandidate(K18_PRODUCT_ID, "K18 Leave-In Molecular Repair Hair Mask")
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
  assert.equal(result.recommendation?.productId, "olaplex-no3")
  assert.equal(result.recommendation?.authorityRuleId, "bondbuilder.stage3.tie_ordered")
  assert.equal(
    result.recommendation?.reason,
    "Gleich gut passende Produkte; wir nennen zuerst das günstigste.",
  )
  assert.equal(result.recommendationFactFingerprint, "facts-olaplex-no3")
  assert.deepEqual(result.allowedActions, ["plan_recommendation", "leave_uncovered"])
  // The "several equally suitable products" fact stays visible: the default is
  // a choice among equals, not a superiority claim.
  assert.ok(
    result.criteria.some(
      (entry) => entry.criterionId === "bondbuilder.equal_shortlist" && entry.result === "caution",
    ),
  )
})

test("a Bondbuilder tie without K18 resolves by price, then catalogue order", () => {
  const olaplex = Object.assign(
    bondbuilderCandidate("olaplex-no3", "OLAPLEX No.3PLUS Complete Repair Treatment"),
    { catalogSortOrder: 0, priceEur: 34 },
  )
  const epres = Object.assign(bondbuilderCandidate("epres", "Epres Bond Repair Treatment"), {
    catalogSortOrder: 0,
    priceEur: 48,
  })
  const result = evaluateStage3Authority(bondbuilderGapInput([epres, olaplex]))

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "ideal")
  assert.equal(result.recommendation?.productId, "olaplex-no3")
  assert.equal(result.recommendation?.authorityRuleId, "bondbuilder.stage3.tie_ordered")
  assert.equal(
    result.recommendation?.reason,
    "Gleich gut passende Produkte; wir nennen zuerst das günstigste.",
  )
  assert.equal(result.recommendationFactFingerprint, "facts-olaplex-no3")
  assert.deepEqual(result.allowedActions, ["plan_recommendation", "leave_uncovered"])
  // Still a choice among equals: the shortlist caution stays.
  assert.ok(result.criteria.some((entry) => entry.criterionId === "bondbuilder.equal_shortlist"))
})

test("a single ideal Bondbuilder candidate keeps the standalone rule, not the tie default", () => {
  const only = bondbuilderCandidate(K18_PRODUCT_ID, "K18 Leave-In Molecular Repair Hair Mask")
  const result = evaluateStage3Authority(bondbuilderGapInput([only]))

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.recommendation?.productId, K18_PRODUCT_ID)
  assert.equal(result.recommendation?.authorityRuleId, "bondbuilder.stage3.validated_standalone")
  assert.ok(result.criteria.every((entry) => entry.criterionId !== "bondbuilder.equal_shortlist"))
})

function trustedBondbuilder(productId: string, claimTrustLevel: string | null) {
  const candidate = bondbuilderCandidate(productId, productId)
  candidate.spec = { ...candidate.spec, claimTrustLevel }
  return candidate
}

test("a more trusted ideal Bondbuilder wins outright, without the tie default or shortlist", () => {
  const result = evaluateStage3Authority(
    bondbuilderGapInput([
      trustedBondbuilder(K18_PRODUCT_ID, "medium"),
      trustedBondbuilder("olaplex-no3", "high"),
      trustedBondbuilder("loreal", "low"),
    ]),
  )

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "ideal")
  assert.equal(result.recommendation?.productId, "olaplex-no3")
  assert.equal(result.recommendation?.authorityRuleId, "bondbuilder.stage3.validated_standalone")
  assert.equal(result.recommendationFactFingerprint, "facts-olaplex-no3")
  assert.ok(result.criteria.every((entry) => entry.criterionId !== "bondbuilder.equal_shortlist"))
})

test("the production Bondbuilder set resolves to OLAPLEX among the three high-trust products", () => {
  const result = evaluateStage3Authority(
    bondbuilderGapInput([
      trustedBondbuilder("loreal-elvital-bond", "medium"),
      trustedBondbuilder("ogx-sealing-serum", "low"),
      trustedBondbuilder("redken-acidic-bonding", "medium"),
      trustedBondbuilder("olaplex-3plus", "high"),
      trustedBondbuilder("epres", "high"),
      trustedBondbuilder("aveda", "low"),
      trustedBondbuilder(K18_PRODUCT_ID, "high"),
      trustedBondbuilder("kerastase-premiere", "medium"),
    ]),
  )

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.recommendation?.productId, "olaplex-3plus")
  assert.equal(result.recommendation?.authorityRuleId, "bondbuilder.stage3.tie_ordered")
  assert.ok(result.criteria.some((entry) => entry.criterionId === "bondbuilder.equal_shortlist"))
})

test("Q1: a high-trust tie without K18 never falls back to the less trusted K18", () => {
  const result = evaluateStage3Authority(
    bondbuilderGapInput([
      Object.assign(trustedBondbuilder("olaplex-no3", "high"), { priceEur: null }),
      Object.assign(trustedBondbuilder("epres", "high"), { priceEur: null }),
      trustedBondbuilder(K18_PRODUCT_ID, "medium"),
    ]),
  )

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  // Equal catalogue order and no price: the product id decides deterministically.
  assert.equal(result.recommendation?.productId, "epres")
  assert.equal(result.recommendation?.authorityRuleId, "bondbuilder.stage3.tie_ordered")
  assert.ok(result.criteria.some((entry) => entry.criterionId === "bondbuilder.equal_shortlist"))
})

test("trust never lifts a non-ideal Bondbuilder above an ideal one", () => {
  const unverified = trustedBondbuilder("unverified-high", "high")
  unverified.protocols = []
  const result = evaluateStage3Authority(
    bondbuilderGapInput([unverified, trustedBondbuilder("verified-low", "low")]),
  )

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.recommendation?.productId, "verified-low")
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
      bondbuilder: "personal-plan.bondbuilder.v3",
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

test("Shampoo dandruff role recommends a one-step supportive fallback", () => {
  // fit-verdict spec §5, ruled 2026-10-12: supportive fallback applies to every role.
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
  assert.equal(result.verdict, "supportive")
  assert.deepEqual(result.allowedActions, ["plan_recommendation", "leave_uncovered"])
  assert.equal(result.recommendation?.productId, "shampoo-dandruff-supportive")
})

test("Conditioner with complete nonmatching semantic facts is a known mismatch, not unknown", () => {
  // fit-verdict spec §3, ruled 2026-10-12: nonmatching direction is an axis, not a wrong-job gate.
  const conditionerInput = input("conditioner", "known") as Stage3AuthorityInput<"conditioner">
  if (conditionerInput.productFacts?.category !== "conditioner") {
    throw new Error("expected Conditioner fixture")
  }
  conditionerInput.productFacts.spec = {
    thickness: "normal",
    thicknesses: ["normal"],
    proteinMoistureBalance: "protein",
    weight: "light",
    repairSupportLevel: "medium",
    balanceDirection: "moisture",
    targetFit: "matched",
  }

  const result = evaluateStage3Authority(conditionerInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "mismatch")
  assert.ok(
    result.criteria.some(
      (criterion) => criterion.criterionId === "conditioner.balance" && criterion.result === "fail",
    ),
  )
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

test("Oil v2 requires explicit leave-on support, canonical weight, and distance-preserving thickness facts", () => {
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
  // fit-verdict spec §3, ruled 2026-10-12: thickness is a degree axis.
  oilInput.productFacts.spec.thicknesses = ["normal"]

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
  // fit-verdict spec §3, ruled 2026-10-12: a one-step thickness miss is supportive.
  wrongThickness.productFacts.spec.thicknesses = ["coarse"]
  const mismatch = evaluateStage3Authority(wrongThickness as never)
  assert.equal(mismatch.status, "known")
  if (mismatch.status !== "known") return
  assert.equal(mismatch.verdict, "supportive")
  assert.equal(
    mismatch.criteria.find((criterion) => criterion.criterionId === "oil.thickness")?.result,
    "caution",
  )
})

test("Mask uses additive formulation distances and keeps required functions strict", () => {
  // fit-verdict spec §§2–4, ruled 2026-10-12: one-step misses add; two steps fail.
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
  // R12: care direction is no longer an always-pass axis; see the R12 rule-ID fixtures below.
  compatibleInput.productFacts.spec.repairSupportLevel = "low"
  const compatible = evaluateStage3Authority(compatibleInput as never)
  assert.equal(compatible.status, "known")
  if (compatible.status !== "known") return
  assert.equal(compatible.verdict, "mismatch")
  assert.deepEqual(
    compatible.criteria
      .filter((criterion) =>
        ["mask.weight", "mask.care_direction", "mask.repair_support"].includes(
          criterion.criterionId,
        ),
      )
      .map((criterion) => criterion.result),
    ["caution", "pass", "caution"],
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
    "Entspricht deinem Bedarf.",
  )

  const tooHeavyInput = structuredClone(idealInput) as Stage3AuthorityInput<"mask">
  if (tooHeavyInput.productFacts?.category !== "mask") throw new Error("expected Mask fixture")
  tooHeavyInput.productFacts.spec.weight = "rich"
  const tooHeavy = evaluateStage3Authority(tooHeavyInput as never)
  assert.equal(tooHeavy.status, "known")
  if (tooHeavy.status !== "known") return
  assert.equal(tooHeavy.verdict, "mismatch")
  assert.equal(
    tooHeavy.criteria.find((criterion) => criterion.criterionId === "mask.weight")?.result,
    "fail",
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

// R12 rule-ID fixtures for `mask.care_direction` (slice 3, Task 1). Literal expectations, not
// derived from the implementation. Ruling R12 Option A: the accepted set is {target}, widened by
// exactly one step toward Protein (Feuchtigkeit → ausgeglichen → Protein) when the confirmed mask
// target carries high repair support; a Protein target never widens.
// fit-verdict spec §7a.3 / §§3–4, ruled 2026-10-12: nearest accepted-set distance decides caution vs fail.
type MaskDirection = "moisture" | "balanced" | "protein"
type MaskRepair = "low" | "medium" | "high"
const MASK_CARE_DIRECTION_FIXTURES: Array<{
  ruleId: string
  product: MaskDirection
  target: MaskDirection
  repair: MaskRepair
  result: "pass" | "caution" | "fail"
  accepted: MaskDirection[]
}> = [
  // Target Feuchtigkeit
  {
    ruleId: "R12.m-m-low",
    product: "moisture",
    target: "moisture",
    repair: "low",
    result: "pass",
    accepted: ["moisture"],
  },
  {
    ruleId: "R12.m-m-medium",
    product: "moisture",
    target: "moisture",
    repair: "medium",
    result: "pass",
    accepted: ["moisture"],
  },
  {
    ruleId: "R12.m-m-high",
    product: "moisture",
    target: "moisture",
    repair: "high",
    result: "pass",
    accepted: ["moisture", "balanced"],
  },
  {
    ruleId: "R12.b-m-low",
    product: "balanced",
    target: "moisture",
    repair: "low",
    result: "caution",
    accepted: ["moisture"],
  },
  {
    ruleId: "R12.b-m-medium",
    product: "balanced",
    target: "moisture",
    repair: "medium",
    result: "caution",
    accepted: ["moisture"],
  },
  // Adversarial vs. "always caution on mismatch": high repair widens one step to ausgeglichen.
  {
    ruleId: "R12.b-m-high",
    product: "balanced",
    target: "moisture",
    repair: "high",
    result: "pass",
    accepted: ["moisture", "balanced"],
  },
  // Adversarial vs. "always accept protein": no high repair need → Protein is a caution.
  {
    ruleId: "R12.p-m-low",
    product: "protein",
    target: "moisture",
    repair: "low",
    result: "fail",
    accepted: ["moisture"],
  },
  {
    ruleId: "R12.p-m-medium",
    product: "protein",
    target: "moisture",
    repair: "medium",
    result: "fail",
    accepted: ["moisture"],
  },
  // Adversarial vs. a non-contiguous widening: high repair never jumps two steps to Protein.
  {
    ruleId: "R12.p-m-high",
    product: "protein",
    target: "moisture",
    repair: "high",
    result: "caution",
    accepted: ["moisture", "balanced"],
  },
  // Target ausgeglichen
  {
    ruleId: "R12.m-b-low",
    product: "moisture",
    target: "balanced",
    repair: "low",
    result: "caution",
    accepted: ["balanced"],
  },
  {
    ruleId: "R12.m-b-medium",
    product: "moisture",
    target: "balanced",
    repair: "medium",
    result: "caution",
    accepted: ["balanced"],
  },
  {
    ruleId: "R12.m-b-high",
    product: "moisture",
    target: "balanced",
    repair: "high",
    result: "caution",
    accepted: ["balanced", "protein"],
  },
  {
    ruleId: "R12.b-b-low",
    product: "balanced",
    target: "balanced",
    repair: "low",
    result: "pass",
    accepted: ["balanced"],
  },
  {
    ruleId: "R12.b-b-medium",
    product: "balanced",
    target: "balanced",
    repair: "medium",
    result: "pass",
    accepted: ["balanced"],
  },
  {
    ruleId: "R12.b-b-high",
    product: "balanced",
    target: "balanced",
    repair: "high",
    result: "pass",
    accepted: ["balanced", "protein"],
  },
  {
    ruleId: "R12.p-b-low",
    product: "protein",
    target: "balanced",
    repair: "low",
    result: "caution",
    accepted: ["balanced"],
  },
  {
    ruleId: "R12.p-b-medium",
    product: "protein",
    target: "balanced",
    repair: "medium",
    result: "caution",
    accepted: ["balanced"],
  },
  {
    ruleId: "R12.p-b-high",
    product: "protein",
    target: "balanced",
    repair: "high",
    result: "pass",
    accepted: ["balanced", "protein"],
  },
  // Target Protein — high repair never widens toward Feuchtigkeit (adversarial vs. symmetric widening).
  {
    ruleId: "R12.m-p-low",
    product: "moisture",
    target: "protein",
    repair: "low",
    result: "fail",
    accepted: ["protein"],
  },
  {
    ruleId: "R12.m-p-medium",
    product: "moisture",
    target: "protein",
    repair: "medium",
    result: "fail",
    accepted: ["protein"],
  },
  {
    ruleId: "R12.m-p-high",
    product: "moisture",
    target: "protein",
    repair: "high",
    result: "fail",
    accepted: ["protein"],
  },
  {
    ruleId: "R12.b-p-low",
    product: "balanced",
    target: "protein",
    repair: "low",
    result: "caution",
    accepted: ["protein"],
  },
  {
    ruleId: "R12.b-p-medium",
    product: "balanced",
    target: "protein",
    repair: "medium",
    result: "caution",
    accepted: ["protein"],
  },
  {
    ruleId: "R12.b-p-high",
    product: "balanced",
    target: "protein",
    repair: "high",
    result: "caution",
    accepted: ["protein"],
  },
  {
    ruleId: "R12.p-p-low",
    product: "protein",
    target: "protein",
    repair: "low",
    result: "pass",
    accepted: ["protein"],
  },
  {
    ruleId: "R12.p-p-medium",
    product: "protein",
    target: "protein",
    repair: "medium",
    result: "pass",
    accepted: ["protein"],
  },
  {
    ruleId: "R12.p-p-high",
    product: "protein",
    target: "protein",
    repair: "high",
    result: "pass",
    accepted: ["protein"],
  },
]

function maskCareDirectionInput(fixture: (typeof MASK_CARE_DIRECTION_FIXTURES)[number]) {
  const maskInput = input("mask", "known") as Stage3AuthorityInput<"mask">
  // Keep this R12 fixture's explicit copy before overriding its target axes.
  maskInput.categoryDecision.target = structuredClone(maskInput.categoryDecision.target)
  if (maskInput.categoryDecision.target?.category !== "mask") throw new Error("expected target")
  if (maskInput.productFacts?.category !== "mask") throw new Error("expected Mask fixture")
  maskInput.categoryDecision.target.careDirection = fixture.target
  maskInput.categoryDecision.target.repairSupportLevel = fixture.repair
  maskInput.productFacts.spec.careDirection = fixture.product
  // Every other axis matches exactly so the care direction alone decides the verdict.
  maskInput.productFacts.spec.repairSupportLevel = fixture.repair
  return maskInput
}

for (const fixture of MASK_CARE_DIRECTION_FIXTURES) {
  test(`${fixture.ruleId}: mask ${fixture.product} vs target ${fixture.target} (repair ${fixture.repair}) → ${fixture.result}`, () => {
    const maskInput = maskCareDirectionInput(fixture)
    const result = evaluateStage3Authority(maskInput as never)
    assert.equal(result.status, "known")
    if (result.status !== "known") return
    assert.equal(
      result.criteria.find((criterion) => criterion.criterionId === "mask.care_direction")?.result,
      fixture.result,
    )
    assert.equal(
      result.verdict,
      fixture.result === "pass"
        ? "ideal"
        : fixture.result === "caution"
          ? "supportive"
          : "mismatch",
    )

    const [careDirection] = comparisonDimensions(maskInput as never, [
      {
        product: {
          productId: "owned-1",
          displayName: "Maske",
          category: "mask",
          role: "intensive_conditioning_mask",
          source: "current",
        },
        facts: maskInput.productFacts!,
      },
    ]).filter((dimension) => dimension.dimensionId === "mask.care_direction")
    assert.deepEqual(
      careDirection?.targetPosition,
      fixture.accepted.length > 1
        ? { kind: "supported_stops", stopIds: fixture.accepted }
        : { kind: "position", stopId: fixture.accepted[0] },
    )
  })
}

test("Mask selects the best image-backed supportive candidate regardless of need tier", () => {
  // fit-verdict spec §5, ruled 2026-10-12: basis and optional admit one-step fallback.
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
  oneCaution.spec.weight = "medium"
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
  // fit-verdict spec §§3–4, ruled 2026-10-12: repair uses at-or-above zero and additive distance.
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

test("Bondbuilder category suitability covers every diameter without inventing producer verification", () => {
  for (const hairThickness of ["fine", "normal", "coarse", undefined] as const) {
    for (const suitableThicknesses of [null, [], ["normal"]] as const) {
      const owned = input("bondbuilder", "known")
      if (owned.productFacts?.category !== "bondbuilder") throw new Error("fixture")
      owned.hairThickness = hairThickness
      owned.productFacts.suitableThicknesses =
        suitableThicknesses === null ? null : [...suitableThicknesses]
      const result = evaluateStage3Authority(owned)
      assert.equal(result.status, "known", `${hairThickness}/${suitableThicknesses}`)
      if (result.status !== "known") continue
      assert.equal(result.verdict, "ideal")
      assert.deepEqual(result.allowedActions, ["keep_owned"])
      const diameter = result.criteria.find(
        (entry) => entry.criterionId === "bondbuilder.thickness",
      )
      assert.equal(diameter?.result, "pass")
      assert.doesNotMatch(diameter?.explanation ?? "", /verifiziert/)
    }
  }
  const candidate = bondbuilderCandidate("reviewed-entry-point", "Bond Treatment")
  candidate.suitableThicknesses = []
  const gap = bondbuilderGapInput([candidate])
  gap.hairThickness = "coarse"
  const recommended = evaluateStage3Authority(gap)
  assert.equal(recommended.status, "known")
  if (recommended.status !== "known") throw new Error("expected recommendation")
  assert.equal(recommended.recommendation?.productId, candidate.productId)
  candidate.recommendable = false
  const unreviewed = evaluateStage3Authority(gap)
  assert.equal(unreviewed.status, "known")
  if (unreviewed.status === "known") assert.equal(unreviewed.recommendation, null)
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
  assert.equal(result.criteria.find((row) => row.criterionId === "shampoo.role")?.result, "pass")
  // fit-verdict spec §7a.3, ruled 2026-10-12: criteria now include every evaluated axis.
  assert.equal(
    result.criteria.find((item) => item.criterionId === "shampoo.cleansing_intensity")?.result,
    "caution",
  )
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
  // fit-verdict spec §4, ruled 2026-10-12: keep one miss so the ranking tie remains eligible.
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
    careDirection: "moisture",
    repairSupportLevel: "high",
  })
  const earlierInCatalog = leaveInCoverageCandidate({
    productId: "leave-in-tie-earlier",
    displayName: "Früher im Katalog",
    catalogSortOrder: 2,
    weight: "medium",
    careDirection: "moisture",
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
  // fit-verdict spec §4, ruled 2026-10-12: one weight miss stays supportive; two misses are excluded.
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
    balance: "moisture",
    repairSupportLevel: "high",
  })
  const earlierInCatalog = conditionerCoverageCandidate({
    productId: "conditioner-tie-earlier",
    displayName: "Früher im Katalog",
    catalogSortOrder: 2,
    weight: "medium",
    balance: "moisture",
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
  // fit-verdict spec §5, ruled 2026-10-12: basis admits a one-step fallback with its reason.
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
  supportiveCandidate.spec.weight = "medium"
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
  // fit-verdict spec §§4–5, ruled 2026-10-12: retain verdict-first ranking with a one-step fallback.
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
  supportive.spec.weight = "medium"
  maskInput.recommendationCandidates = [supportive, ideal]

  const result = evaluateStage3Authority(maskInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.verdict, "ideal")
  assert.equal(result.recommendation?.productId, "mask-required-ideal")
})

/* ------------------------------------------------ S4: Bondbuilder timing (decisions.md S2, X1) */

type ProductionBondbuilder = ReturnType<typeof bondbuilderCandidate>

/** The production catalogue (2026-10-09): every `products.sort_order` is 0. */
function productionBondbuilder(
  productId: string,
  trust: "high" | "medium" | "low",
  applicationMode: "pre_shampoo" | "post_wash_leave_in" | "bedtime_leave_in",
  priceEur: number,
): ProductionBondbuilder {
  const candidate = trustedBondbuilder(productId, trust)
  candidate.spec = {
    ...candidate.spec,
    applicationMode,
    treatmentMode: applicationMode === "pre_shampoo" ? "rinse_out" : "leave_in",
  }
  return Object.assign(candidate, { catalogSortOrder: 0, priceEur })
}

const PROD = {
  olaplex: () => productionBondbuilder("olaplex-3plus", "high", "pre_shampoo", 34),
  epres: () => productionBondbuilder("epres", "high", "pre_shampoo", 48),
  k18: () => productionBondbuilder(K18_PRODUCT_ID, "high", "post_wash_leave_in", 56.25),
  elvital: () => productionBondbuilder("loreal-elvital-bond", "medium", "pre_shampoo", 8.95),
  redken: () => productionBondbuilder("redken-acidic-bonding", "medium", "pre_shampoo", 25.5),
  kerastase: () => productionBondbuilder("kerastase-premiere", "medium", "pre_shampoo", 56.29),
  ogx: () => productionBondbuilder("ogx-sealing-serum", "low", "bedtime_leave_in", 18.68),
  aveda: () => productionBondbuilder("aveda", "low", "pre_shampoo", 52),
}

function productionSet(options: { withoutK18?: boolean } = {}) {
  return Object.entries(PROD)
    .filter(([key]) => !(options.withoutK18 && key === "k18"))
    .map(([, make]) => make())
}

function timed(
  candidates: ProductionBondbuilder[],
  bondbuilderTiming: "before_wash" | "after_wash" | "no_preference",
) {
  const gap = bondbuilderGapInput(candidates)
  gap.selectionProfile = { ...UNKNOWN_SELECTION_PROFILE, bondbuilderTiming }
  return gap
}

function knownResult(input: Stage3AuthorityInput) {
  const result = evaluateStage3Authority(input)
  assert.equal(result.status, "known")
  if (result.status !== "known") throw new Error("expected a known evaluation")
  return result
}

const hasShortlistCaution = (result: ReturnType<typeof knownResult>) =>
  result.criteria.some(
    (entry) => entry.criterionId === "bondbuilder.equal_shortlist" && entry.result === "caution",
  )

test("S4 E1: no preference picks OLAPLEX as the cheapest tie option with the shortlist caution", () => {
  for (const input of [
    timed(productionSet(), "no_preference"),
    bondbuilderGapInput(productionSet()),
  ]) {
    const result = knownResult(input)
    assert.equal(result.recommendation?.productId, "olaplex-3plus")
    assert.equal(result.recommendation?.authorityRuleId, "bondbuilder.stage3.tie_ordered")
    assert.ok(hasShortlistCaution(result))
  }
})

test("S4 E2: after the wash → K18 alone, validated_standalone without a tie caution", () => {
  const result = knownResult(timed(productionSet(), "after_wash"))
  assert.equal(result.recommendation?.productId, K18_PRODUCT_ID)
  assert.equal(result.recommendation?.authorityRuleId, "bondbuilder.stage3.validated_standalone")
  assert.equal(hasShortlistCaution(result), false)
})

test("S4 E3: before the wash → OLAPLEX by price (tie_ordered), the caution stays", () => {
  const result = knownResult(timed(productionSet(), "before_wash"))
  assert.equal(result.recommendation?.productId, "olaplex-3plus")
  assert.equal(result.recommendation?.authorityRuleId, "bondbuilder.stage3.tie_ordered")
  assert.ok(hasShortlistCaution(result))
})

test("S4 E8: after the wash without K18 → OLAPLEX with the unmet rule id", () => {
  const result = knownResult(timed(productionSet({ withoutK18: true }), "after_wash"))
  assert.equal(result.recommendation?.productId, "olaplex-3plus")
  assert.equal(
    result.recommendation?.authorityRuleId,
    "bondbuilder.stage3.timing_unmet.after_wash.before_wash",
  )
  assert.equal(
    result.recommendation?.reason,
    "Kein gleich vertrauenswürdiges Produkt passt zu deinem Zeitpunkt.",
  )
  assert.ok(hasShortlistCaution(result))
})

test("S4: a lower-trust matching product never beats a higher-trust non-matching one", () => {
  // A medium-trust after-wash product next to the high-trust pre-wash pair.
  const mediumAfterWash = productionBondbuilder("medium-after", "medium", "post_wash_leave_in", 5)
  const result = knownResult(
    timed([PROD.olaplex(), PROD.epres(), mediumAfterWash, PROD.ogx()], "after_wash"),
  )
  assert.equal(result.recommendation?.productId, "olaplex-3plus")
  assert.equal(
    result.recommendation?.authorityRuleId,
    "bondbuilder.stage3.timing_unmet.after_wash.before_wash",
  )
})

test("S4: overnight (OGX) matches neither answer", () => {
  for (const timing of ["before_wash", "after_wash"] as const) {
    const result = knownResult(timed([PROD.ogx()], timing))
    assert.equal(result.recommendation?.productId, "ogx-sealing-serum")
    assert.equal(
      result.recommendation?.authorityRuleId,
      `bondbuilder.stage3.timing_unmet.${timing}.overnight`,
    )
  }
  assert.equal(
    knownResult(timed([PROD.ogx()], "no_preference")).recommendation?.authorityRuleId,
    "bondbuilder.stage3.validated_standalone",
  )
})

test("S4: the timing never changes a scanned or owned product's verdict", () => {
  for (const owned of [PROD.k18(), PROD.olaplex(), PROD.ogx()]) {
    const verdicts = (["no_preference", "before_wash", "after_wash"] as const).map((timing) => {
      const subject = input("bondbuilder", "known") as Stage3AuthorityInput<"bondbuilder">
      subject.productFacts = owned
      subject.selectionProfile = { ...UNKNOWN_SELECTION_PROFILE, bondbuilderTiming: timing }
      const result = knownResult(subject as Stage3AuthorityInput)
      return [result.verdict, result.allowedActions, result.criteria]
    })
    assert.deepEqual(verdicts[1], verdicts[0])
    assert.deepEqual(verdicts[2], verdicts[0])
  }
})

test("S4: the exported shortlist is the authority's own tie set", () => {
  const ids = (timing: "before_wash" | "after_wash" | "no_preference", withoutK18 = false) => {
    const shortlist = bondbuilderShortlist(
      timed(productionSet({ withoutK18 }), timing) as Stage3AuthorityInput<"bondbuilder">,
    )
    return {
      pool: shortlist.pool.map((candidate) => candidate.productId).sort(),
      selected: shortlist.selected?.productId ?? null,
      timingUnmet: shortlist.timingUnmet,
    }
  }
  assert.deepEqual(ids("no_preference"), {
    pool: [K18_PRODUCT_ID, "epres", "olaplex-3plus"].sort(),
    selected: "olaplex-3plus",
    timingUnmet: false,
  })
  assert.deepEqual(ids("before_wash"), {
    pool: ["epres", "olaplex-3plus"],
    selected: "olaplex-3plus",
    timingUnmet: false,
  })
  assert.deepEqual(ids("after_wash"), {
    pool: [K18_PRODUCT_ID],
    selected: K18_PRODUCT_ID,
    timingUnmet: false,
  })
  assert.deepEqual(ids("after_wash", true), {
    pool: ["epres", "olaplex-3plus"],
    selected: "olaplex-3plus",
    timingUnmet: true,
  })
})

test("tie order is lower price (unpriced last), then catalogue order, then id", () => {
  const order = (...candidates: ProductionBondbuilder[]) =>
    [...candidates].sort(compareBondbuilderTieOrder).map((candidate) => candidate.productId)
  const withOrder = (candidate: ProductionBondbuilder, sort: number | null, price: number | null) =>
    Object.assign(candidate, { catalogSortOrder: sort, priceEur: price })
  // Price beats catalogue order.
  assert.deepEqual(order(withOrder(PROD.olaplex(), 2, 34), withOrder(PROD.epres(), 1, 48)), [
    "olaplex-3plus",
    "epres",
  ])
  // Same catalogue order (production: all 0) → the cheaper one.
  assert.deepEqual(order(PROD.epres(), PROD.olaplex()), ["olaplex-3plus", "epres"])
  assert.deepEqual(order(withOrder(PROD.olaplex(), 2, 40), withOrder(PROD.epres(), 1, 40)), [
    "epres",
    "olaplex-3plus",
  ])
  // Missing order or price ranks last; equal everything → product id.
  assert.deepEqual(order(withOrder(PROD.olaplex(), null, 34), withOrder(PROD.epres(), 0, 48)), [
    "olaplex-3plus",
    "epres",
  ])
  assert.deepEqual(order(withOrder(PROD.olaplex(), 0, null), withOrder(PROD.epres(), 0, 48)), [
    "epres",
    "olaplex-3plus",
  ])
  assert.deepEqual(order(withOrder(PROD.olaplex(), 0, 40), withOrder(PROD.epres(), 0, 40)), [
    "epres",
    "olaplex-3plus",
  ])
})
