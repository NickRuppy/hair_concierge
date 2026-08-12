import assert from "node:assert/strict"
import test from "node:test"

import { CATEGORY_ROLE_POLICIES } from "../../../src/lib/personal-plan/products/authorities"
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
          cleansingIntensity: "medium",
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

test("only owned-fit authority policies advance for this semantic correction", () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
        category,
        policy.authorityVersion,
      ]),
    ),
    {
      shampoo: "personal-plan.shampoo.v3",
      conditioner: "personal-plan.conditioner.v3",
      leave_in: "personal-plan.leave-in.v3",
      heat_protectant: "personal-plan.heat-protectant.v1",
      oil: "personal-plan.oil.v2",
      mask: "personal-plan.mask.v3",
      scalp_care: "personal-plan.scalp-care.v1",
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

test("Mask v3 evaluates complete canonical facts as ideal, supportive, or mismatch", () => {
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

  const supportiveInput = structuredClone(idealInput) as Stage3AuthorityInput<"mask">
  if (supportiveInput.productFacts?.category !== "mask") throw new Error("expected Mask fixture")
  supportiveInput.productFacts.spec.weight = "medium"
  const supportive = evaluateStage3Authority(supportiveInput as never)
  assert.equal(supportive.status, "known")
  if (supportive.status !== "known") return
  assert.equal(supportive.verdict, "supportive")

  const mismatchInput = structuredClone(idealInput) as Stage3AuthorityInput<"mask">
  if (mismatchInput.productFacts?.category !== "mask") throw new Error("expected Mask fixture")
  mismatchInput.productFacts.spec.functionalBenefits = ["shine"]
  const mismatch = evaluateStage3Authority(mismatchInput as never)
  assert.equal(mismatch.status, "known")
  if (mismatch.status !== "known") return
  assert.equal(mismatch.verdict, "mismatch")
})

test("Mask v3 fails closed when required canonical functional benefits are missing", () => {
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

test("Heat candidate selection excludes products without verified current availability", () => {
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

  const result = evaluateStage3Authority(heatInput as never)

  assert.equal(result.status, "known")
  if (result.status !== "known") return
  assert.equal(result.recommendation?.productId, "available")
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
  },
  {
    name: "dry",
    scalpRoute: "dry" as const,
    everydayConstraint: "gentle_dry_scalp" as const,
    role: "shampoo_everyday" as const,
    bucket: "trocken",
  },
  {
    name: "irritation",
    scalpRoute: "balanced" as const,
    everydayConstraint: "irritation_compatible" as const,
    role: "shampoo_everyday" as const,
    bucket: "irritationen",
  },
  {
    name: "balanced",
    scalpRoute: "balanced" as const,
    everydayConstraint: "standard" as const,
    role: "shampoo_everyday" as const,
    bucket: "normal",
  },
  {
    name: "dandruff",
    scalpRoute: "oily" as const,
    everydayConstraint: "standard" as const,
    role: "shampoo_dandruff" as const,
    bucket: "schuppen",
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
      shampooInput.productFacts.spec.scalpRoute = route.scalpRoute
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
