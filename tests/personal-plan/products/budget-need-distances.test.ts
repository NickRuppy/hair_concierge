import assert from "node:assert/strict"
import test from "node:test"

import { CATEGORY_ROLE_POLICIES } from "../../../src/lib/personal-plan/products/authorities"
import type {
  Stage3AuthorityInput,
  Stage3CategoryProductFacts,
} from "../../../src/lib/personal-plan/products/authority/contracts"
import { budgetNeedDistances } from "../../../src/lib/personal-plan/products/comparison-dimensions"

// Distances come from the real comparison-dimension builders, so every case below runs the same
// target/position resolution the comparison rail renders.

function conditionerInput(target: {
  weight: string
  repairSupportLevel: string
}): Stage3AuthorityInput {
  return {
    category: "conditioner",
    authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
    refinedVersionId: "refined-1",
    refinedInputHash: "input-1",
    subjectKey: "decision:conditioner:conditioner_rinse_out:none",
    role: "conditioner_rinse_out",
    capturedProductId: null,
    subjectIdentity: null,
    categoryDecision: {
      category: "conditioner",
      resolution: "resolved",
      needTier: "basis",
      roles: ["conditioner_rinse_out"],
      target: {
        category: "conditioner",
        roles: ["conditioner_rinse_out"],
        weight: target.weight,
        careDirection: "moisture",
        repairSupportLevel: target.repairSupportLevel,
        functionalNeeds: [],
      },
      frequency: null,
      reasons: [],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: [],
    } as never,
    coverage: [],
    productFacts: null,
    recommendationCandidates: [],
    hairThickness: "normal",
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
  } as Stage3AuthorityInput
}

function maskInput(target: { weight: string | null }): Stage3AuthorityInput {
  return {
    ...conditionerInput({ weight: "light", repairSupportLevel: "medium" }),
    category: "mask",
    authorityVersion: CATEGORY_ROLE_POLICIES.mask.authorityVersion,
    subjectKey: "decision:mask:intensive_conditioning_mask:none",
    role: "intensive_conditioning_mask",
    categoryDecision: {
      category: "mask",
      resolution: "resolved",
      needTier: "basis",
      roles: ["intensive_conditioning_mask"],
      target: {
        category: "mask",
        roles: ["intensive_conditioning_mask"],
        needStrength: "standard",
        weight: target.weight,
        careDirection: "moisture",
        repairSupportLevel: "medium",
        functionalNeeds: [],
      },
      frequency: null,
      reasons: [],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: [],
    } as never,
  } as Stage3AuthorityInput
}

function conditionerFacts(spec: {
  weight: string | null
  repairSupportLevel: string | null
}): Stage3CategoryProductFacts {
  return {
    productId: "conditioner-x",
    displayName: "Conditioner X",
    category: "conditioner",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: ["normal"],
    knownReaction: false,
    protocols: [],
    factFingerprint: "facts-conditioner-x",
    spec: {
      thickness: "normal",
      proteinMoistureBalance: "moisture",
      weight: spec.weight,
      repairSupportLevel: spec.repairSupportLevel,
      balanceDirection: "moisture",
      targetFit: "matched",
    },
  }
}

function maskFacts(weight: string | null): Stage3CategoryProductFacts {
  return {
    productId: "mask-x",
    displayName: "Mask X",
    category: "mask",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: ["normal"],
    knownReaction: false,
    protocols: [],
    factFingerprint: "facts-mask-x",
    spec: {
      weight,
      careDirection: "moisture",
      repairSupportLevel: "medium",
      functionalBenefits: [],
    },
  }
}

test("on-target conditioner weight and repair are distance 0", () => {
  assert.deepEqual(
    budgetNeedDistances(
      conditionerInput({ weight: "light", repairSupportLevel: "medium" }),
      conditionerFacts({ weight: "light", repairSupportLevel: "medium" }),
    ),
    { "conditioner.weight": 0, "conditioner.repair_support": 0 },
  )
})

test("distance counts ordered stops to the target on either side", () => {
  assert.deepEqual(
    budgetNeedDistances(
      conditionerInput({ weight: "light", repairSupportLevel: "low" }),
      conditionerFacts({ weight: "rich", repairSupportLevel: "medium" }),
    ),
    { "conditioner.weight": 2, "conditioner.repair_support": 1 },
  )
})

test("overshooting the repair target is a distance, never better than on target", () => {
  const input = conditionerInput({ weight: "medium", repairSupportLevel: "medium" })
  const overshoot = budgetNeedDistances(
    input,
    conditionerFacts({ weight: "medium", repairSupportLevel: "high" }),
  )
  const undershoot = budgetNeedDistances(
    input,
    conditionerFacts({ weight: "medium", repairSupportLevel: "low" }),
  )
  assert.equal(overshoot["conditioner.repair_support"], 1)
  assert.equal(undershoot["conditioner.repair_support"], 1)
})

test("an unknown product value omits the dimension instead of reading as far", () => {
  assert.deepEqual(
    budgetNeedDistances(
      conditionerInput({ weight: "light", repairSupportLevel: "medium" }),
      conditionerFacts({ weight: null, repairSupportLevel: "high" }),
    ),
    { "conditioner.repair_support": 1 },
  )
})

test("mask weight uses the mask builder; care direction is never a need dimension", () => {
  assert.deepEqual(budgetNeedDistances(maskInput({ weight: "light" }), maskFacts("medium")), {
    "mask.weight": 1,
    "mask.repair_support": 0,
  })
})

test("an unknown target omits the dimension", () => {
  assert.deepEqual(budgetNeedDistances(maskInput({ weight: null }), maskFacts("rich")), {
    "mask.repair_support": 0,
  })
})
