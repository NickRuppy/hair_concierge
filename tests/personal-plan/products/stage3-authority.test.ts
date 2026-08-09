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
          shampooBucket: "everyday",
          scalpRoute: "balanced",
          cleansingIntensity: "medium",
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
      break
    case "conditioner":
      facts.spec.weight = null
      break
    case "leave_in":
      facts.spec.roles = null
      break
    case "heat_protectant":
      facts.spec.providesHeatProtection = null
      break
    case "oil":
      facts.spec.roleSupport = {}
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
