import assert from "node:assert/strict"
import test from "node:test"

import { computeNeedPlan } from "../../src/lib/personal-plan/compute-stage1"
import { handleStage1ProductExamplePreviews } from "../../src/app/api/personal-plan/stage-1/previews/route"
import { computeStage1ProductExamplePreviews } from "../../src/lib/personal-plan/product-previews"
import type { Stage1PersistenceDependencies } from "../../src/lib/personal-plan/persistence/stage1-service"
import type {
  Stage3BondbuilderFacts,
  Stage3ConditionerFacts,
  Stage3MaskFacts,
  Stage3OilFacts,
  Stage3ScalpCareFacts,
  Stage3ShampooFacts,
} from "../../src/lib/personal-plan/products/authority/contracts"
import type { PlanCategoryDecision } from "../../src/lib/personal-plan/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./fixtures"

function conditionerSnapshot() {
  const result = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-14T10:00:00.000Z",
  })
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected ready snapshot")
  const decision = result.snapshot.decisions.find((item) => item.category === "conditioner")
  assert.ok(decision?.target?.category === "conditioner")
  return {
    ...result.snapshot,
    decisions: [decision],
    renderedOrder: ["conditioner" as const],
  }
}

test("uses the shared Conditioner authority and maps its selected product back to the image fact", async () => {
  const snapshot = conditionerSnapshot()
  const target = snapshot.decisions[0]!.target
  assert.ok(target?.category === "conditioner")
  let receivedTarget: unknown = null
  let receivedCompleteCatalog: unknown = null
  const candidate: Stage3ConditionerFacts = {
    productId: "conditioner-profile-fit",
    displayName: "Conditioner Profil Fit",
    category: "conditioner",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: [snapshot.profile.hair.thickness],
    knownReaction: false,
    protocols: [
      {
        role: "conditioner_rinse_out",
        status: "verified_complete",
        fingerprint: "protocol-conditioner",
      },
    ],
    presentationImageUrl: "https://example.com/conditioner-profile-fit.webp",
    factFingerprint: "facts-conditioner",
    spec: {
      thickness: snapshot.profile.hair.thickness,
      proteinMoistureBalance: target.careDirection,
      weight: target.weight,
      repairSupportLevel: target.repairSupportLevel,
      balanceDirection: target.careDirection,
      targetFit: "matched",
    },
  }

  const response = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot,
    loadCandidates: async (selection) => {
      receivedTarget = selection.conditionerTarget
      receivedCompleteCatalog = selection.completeCatalog
      return [candidate]
    },
  })

  assert.deepEqual(receivedTarget, target)
  assert.equal(receivedCompleteCatalog, true)
  assert.deepEqual(response.previews, [
    {
      category: "conditioner",
      role: "conditioner_rinse_out",
      productId: "conditioner-profile-fit",
      productName: "Conditioner Profil Fit",
      imageUrl: "https://example.com/conditioner-profile-fit.webp",
      verdict: "ideal",
      authorityVersion: "personal-plan.conditioner.v3",
    },
  ])
})

test("fails closed when the shared authority product has no presentation image", async () => {
  const snapshot = conditionerSnapshot()
  const target = snapshot.decisions[0]!.target
  assert.ok(target?.category === "conditioner")
  const candidate: Stage3ConditionerFacts = {
    productId: "conditioner-no-image",
    displayName: "Conditioner ohne Bild",
    category: "conditioner",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: [snapshot.profile.hair.thickness],
    knownReaction: false,
    protocols: [
      {
        role: "conditioner_rinse_out",
        status: "verified_complete",
        fingerprint: "protocol-conditioner",
      },
    ],
    presentationImageUrl: null,
    factFingerprint: "facts-conditioner",
    spec: {
      thickness: snapshot.profile.hair.thickness,
      proteinMoistureBalance: target.careDirection,
      weight: target.weight,
      repairSupportLevel: target.repairSupportLevel,
      balanceDirection: target.careDirection,
      targetFit: "matched",
    },
  }

  const response = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot,
    loadCandidates: async () => [candidate],
  })

  assert.deepEqual(response.previews, [])
})

test("selects the thirteenth injected complete-mode irritation Shampoo candidate", async () => {
  const result = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-14T10:00:00.000Z",
  })
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected ready snapshot")
  const sourceDecision = result.snapshot.decisions.find((item) => item.category === "shampoo")
  assert.ok(sourceDecision?.target?.category === "shampoo")
  const role = "shampoo_everyday" as const
  const target = {
    ...sourceDecision.target,
    roles: [role],
    scalpRoute: "oily" as const,
    everydayConstraint: "irritation_compatible" as const,
    requiresTargetedDandruffCapability: false,
  }
  const decision = { ...sourceDecision, roles: [role], target }
  const candidates: Stage3ShampooFacts[] = Array.from({ length: 13 }, (_, index) => ({
    productId: `shampoo-candidate-${index + 1}`,
    displayName: `Shampoo Kandidat ${index + 1}`,
    category: "shampoo",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: [result.snapshot.profile.hair.thickness],
    knownReaction: false,
    protocols: [{ role, status: "verified_complete", fingerprint: `protocol-${index + 1}` }],
    presentationImageUrl: `https://example.com/shampoo-candidate-${index + 1}.webp`,
    factFingerprint: `facts-${index + 1}`,
    spec: {
      thickness: result.snapshot.profile.hair.thickness,
      shampooBucket: index === 12 ? "irritationen" : "does-not-match",
      scalpRoute: index === 12 ? "irritated" : "balanced",
      cleansingIntensity: index === 12 ? "gentle" : "regular",
      targetFit: "matched",
    },
  }))

  const response = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot: {
      ...result.snapshot,
      decisions: [decision],
      renderedOrder: ["shampoo"],
    },
    loadCandidates: async () => candidates,
  })

  assert.deepEqual(
    response.previews.map((preview) => [preview.productId, preview.imageUrl]),
    [["shampoo-candidate-13", "https://example.com/shampoo-candidate-13.webp"]],
  )
})

test("does not use a merely supportive Shampoo as a Stage 1 product example", async () => {
  const result = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-14T10:00:00.000Z",
  })
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected ready snapshot")
  const sourceDecision = result.snapshot.decisions.find((item) => item.category === "shampoo")
  assert.ok(sourceDecision?.target?.category === "shampoo")
  const role = "shampoo_everyday" as const
  const decision = {
    ...sourceDecision,
    roles: [role],
    target: {
      ...sourceDecision.target,
      roles: [role],
      scalpRoute: "balanced" as const,
      everydayConstraint: "standard" as const,
      requiresTargetedDandruffCapability: false,
    },
  }
  const supportiveCandidate: Stage3ShampooFacts = {
    productId: "supportive-shampoo",
    displayName: "Nur teilweise passendes Shampoo",
    category: "shampoo",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: [result.snapshot.profile.hair.thickness],
    knownReaction: false,
    protocols: [{ role, status: "verified_complete", fingerprint: "protocol-supportive" }],
    presentationImageUrl: "https://example.com/supportive-shampoo.webp",
    factFingerprint: "facts-supportive-shampoo",
    spec: {
      thickness: result.snapshot.profile.hair.thickness,
      shampooBucket: "normal",
      scalpRoute: "balanced",
      cleansingIntensity: "gentle",
      targetFit: "matched",
    },
  }

  const response = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot: {
      ...result.snapshot,
      decisions: [decision],
      renderedOrder: ["shampoo"],
    },
    loadCandidates: async () => [supportiveCandidate],
  })

  assert.deepEqual(response.previews, [])
})

test("evaluates the recommended Oil itself instead of rejecting the uncovered-slot verdict", async () => {
  const result = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-14T10:00:00.000Z",
  })
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected ready snapshot")
  const decision = result.snapshot.decisions.find((item) => item.category === "oil")
  assert.ok(decision?.target?.category === "oil")
  const role = decision.roles[0]
  assert.ok(
    role === "pre_wash_fibre_treatment" ||
      role === "leave_on_fibre_conditioning" ||
      role === "dry_finish",
  )
  const roleTarget = decision.target.roleTargets.find((target) => target.role === role)
  assert.ok(roleTarget)
  const candidate: Stage3OilFacts = {
    productId: "oil-profile-fit",
    displayName: "Haaröl Profil Fit",
    category: "oil",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: [result.snapshot.profile.hair.thickness],
    knownReaction: false,
    protocols: [{ role, status: "verified_complete", fingerprint: "protocol-oil" }],
    presentationImageUrl: "https://example.com/oil-profile-fit.webp",
    factFingerprint: "facts-oil",
    spec: {
      roleSupport: { [role]: true },
      weight: roleTarget.weight,
      targetThicknessEligible: true,
      providesHeatProtection: false,
    },
  }

  const response = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot: {
      ...result.snapshot,
      decisions: [decision],
      renderedOrder: ["oil"],
    },
    loadCandidates: async () => [candidate],
  })

  assert.deepEqual(response.previews, [
    {
      category: "oil",
      role,
      productId: "oil-profile-fit",
      productName: "Haaröl Profil Fit",
      imageUrl: "https://example.com/oil-profile-fit.webp",
      verdict: "ideal",
      authorityVersion: "personal-plan.oil.v2",
    },
  ])
})

test("evaluates an uncovered Scalp Care recommendation before exposing its image", async () => {
  const result = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-14T10:00:00.000Z",
  })
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected ready snapshot")
  const role = "scalp_comfort" as const
  const decision = {
    category: "scalp_care",
    resolution: "resolved",
    needTier: "optional",
    roles: [role],
    target: {
      category: "scalp_care",
      roles: [role],
      roleTargets: [{ role, coverage: "primary" }],
    },
    frequency: null,
    reasons: [],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  } satisfies PlanCategoryDecision
  const candidate: Stage3ScalpCareFacts = {
    productId: "scalp-care-profile-fit",
    displayName: "Kopfhautpflege Profil Fit",
    category: "scalp_care",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: [],
    knownReaction: false,
    protocols: [{ role, status: "verified_complete", fingerprint: "protocol-scalp-care" }],
    presentationImageUrl: "https://example.com/scalp-care-profile-fit.webp",
    factFingerprint: "facts-scalp-care",
    spec: {
      primaryRole: role,
      presentationFormat: "serum",
      rinseMode: "leave_in",
    },
  }

  const response = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot: {
      ...result.snapshot,
      decisions: [decision],
      renderedOrder: ["scalp_care"],
      coverage: [],
    },
    loadCandidates: async () => [candidate],
  })

  assert.deepEqual(response.previews, [
    {
      category: "scalp_care",
      role,
      productId: "scalp-care-profile-fit",
      productName: "Kopfhautpflege Profil Fit",
      imageUrl: "https://example.com/scalp-care-profile-fit.webp",
      verdict: "ideal",
      authorityVersion: "personal-plan.scalp-care.v2",
    },
  ])
})

test("returns an exact-fit Mask preview and rejects an unsuitable thickness", async () => {
  const result = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-14T10:00:00.000Z",
  })
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected ready snapshot")
  const role = "intensive_conditioning_mask" as const
  const decision = {
    category: "mask",
    resolution: "resolved",
    needTier: "optional",
    roles: [role],
    target: {
      category: "mask",
      roles: [role],
      needStrength: "standard",
      weight: "light",
      careDirection: "moisture",
      repairSupportLevel: "medium",
      functionalNeeds: [],
    },
    frequency: null,
    reasons: [],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  } satisfies PlanCategoryDecision
  const candidate: Stage3MaskFacts = {
    productId: "mask-profile-fit",
    displayName: "Maske Profil Fit",
    category: "mask",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: [result.snapshot.profile.hair.thickness],
    knownReaction: false,
    protocols: [{ role, status: "verified_complete", fingerprint: "protocol-mask" }],
    presentationImageUrl: "https://example.com/mask-profile-fit.webp",
    factFingerprint: "facts-mask",
    spec: {
      weight: "light",
      careDirection: "moisture",
      repairSupportLevel: "medium",
      functionalBenefits: [],
    },
  }
  const snapshot = {
    ...result.snapshot,
    decisions: [decision],
    renderedOrder: ["mask" as const],
  }

  const exactFit = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot,
    loadCandidates: async () => [candidate],
  })
  const unsuitable = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot,
    loadCandidates: async () => [
      {
        ...candidate,
        suitableThicknesses: [
          result.snapshot.profile.hair.thickness === "coarse" ? "fine" : "coarse",
        ],
      },
    ],
  })

  assert.deepEqual(
    exactFit.previews.map((preview) => [preview.productId, preview.imageUrl, preview.verdict]),
    [["mask-profile-fit", "https://example.com/mask-profile-fit.webp", "ideal"]],
  )
  assert.deepEqual(unsuitable.previews, [])
})

test("uses a source-bound supportive Mask only for an optional Mask decision", async () => {
  const result = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-14T10:00:00.000Z",
  })
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected ready snapshot")
  const role = "intensive_conditioning_mask" as const
  const decision = {
    category: "mask",
    resolution: "resolved",
    needTier: "optional",
    roles: [role],
    target: {
      category: "mask",
      roles: [role],
      needStrength: "standard",
      weight: "light",
      careDirection: "moisture",
      repairSupportLevel: "medium",
      functionalNeeds: [],
    },
    frequency: null,
    reasons: [],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  } satisfies PlanCategoryDecision
  const candidate: Stage3MaskFacts = {
    productId: "mask-supportive-fit",
    displayName: "Maske mit begrenzter Gewichtsabweichung",
    category: "mask",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: [result.snapshot.profile.hair.thickness],
    knownReaction: false,
    protocols: [{ role, status: "verified_complete", fingerprint: "protocol-mask-supportive" }],
    presentationImageUrl: "https://example.com/mask-supportive.webp",
    factFingerprint: "facts-mask-supportive",
    spec: {
      weight: "rich",
      careDirection: "moisture",
      repairSupportLevel: "medium",
      functionalBenefits: [],
    },
  }
  const preview = (needTier: "basis" | "optional") =>
    computeStage1ProductExamplePreviews({
      personalPlanId: "plan-1",
      sourceNeedVersionId: "need-1",
      snapshot: {
        ...result.snapshot,
        decisions: [{ ...decision, needTier }],
        renderedOrder: ["mask"],
      },
      loadCandidates: async () => [candidate],
    })

  const optional = await preview("optional")
  const basis = await preview("basis")

  assert.deepEqual(
    optional.previews.map((item) => [item.productId, item.verdict]),
    [["mask-supportive-fit", "supportive"]],
  )
  assert.deepEqual(basis.previews, [])
})

test("returns an exact-fit Bondbuilder preview and rejects an unsuitable thickness", async () => {
  const result = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-14T10:00:00.000Z",
  })
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected ready snapshot")
  const role = "specialized_bond_treatment" as const
  const decision = {
    category: "bondbuilder",
    resolution: "resolved",
    needTier: "basis",
    roles: [role],
    target: {
      category: "bondbuilder",
      roles: [role],
      requiredFunction: "support_stressed_hair_resilience",
      mechanismTarget: "mechanism_neutral",
    },
    frequency: null,
    reasons: [],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  } satisfies PlanCategoryDecision
  const candidate: Stage3BondbuilderFacts = {
    productId: "bondbuilder-profile-fit",
    displayName: "Bondbuilder Profil Fit",
    category: "bondbuilder",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: [result.snapshot.profile.hair.thickness],
    knownReaction: false,
    protocols: [{ role, status: "verified_complete", fingerprint: "protocol-bondbuilder" }],
    presentationImageUrl: "https://example.com/bondbuilder-profile-fit.webp",
    factFingerprint: "facts-bondbuilder",
    spec: {
      applicationMode: "pre_shampoo",
      treatmentMode: "rinse_out",
      productFormat: "treatment",
      usageProtocol: "course",
      relationship: "standalone",
    },
  }
  const snapshot = {
    ...result.snapshot,
    decisions: [decision],
    renderedOrder: ["bondbuilder" as const],
  }

  const exactFit = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot,
    loadCandidates: async () => [candidate],
  })
  const unsuitable = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot,
    loadCandidates: async () => [
      {
        ...candidate,
        suitableThicknesses: [
          result.snapshot.profile.hair.thickness === "coarse" ? "fine" : "coarse",
        ],
      },
    ],
  })

  assert.deepEqual(
    exactFit.previews.map((preview) => [preview.productId, preview.imageUrl, preview.verdict]),
    [["bondbuilder-profile-fit", "https://example.com/bondbuilder-profile-fit.webp", "ideal"]],
  )
  assert.deepEqual(unsuitable.previews, [])
})

test("uses K18 as the Stage 1 Bondbuilder example when ideal candidates tie", async () => {
  const result = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-14T10:00:00.000Z",
  })
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected ready snapshot")
  const role = "specialized_bond_treatment" as const
  const decision = {
    category: "bondbuilder",
    resolution: "resolved",
    needTier: "basis",
    roles: [role],
    target: {
      category: "bondbuilder",
      roles: [role],
      requiredFunction: "support_stressed_hair_resilience",
      mechanismTarget: "mechanism_neutral",
    },
    frequency: null,
    reasons: [],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  } satisfies PlanCategoryDecision
  const candidate = (
    productId: string,
    displayName: string,
    imageUrl: string,
  ): Stage3BondbuilderFacts => ({
    productId,
    displayName,
    category: "bondbuilder",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: [result.snapshot.profile.hair.thickness],
    knownReaction: false,
    protocols: [{ role, status: "verified_complete", fingerprint: `protocol-${productId}` }],
    presentationImageUrl: imageUrl,
    factFingerprint: `facts-${productId}`,
    spec: {
      applicationMode:
        productId === "38dace91-0fba-49ee-a93f-ac36e488fe4b" ? "post_wash_leave_in" : "pre_shampoo",
      treatmentMode:
        productId === "38dace91-0fba-49ee-a93f-ac36e488fe4b" ? "leave_in" : "rinse_out",
      productFormat:
        productId === "38dace91-0fba-49ee-a93f-ac36e488fe4b" ? "leave_in_mask" : "treatment",
      usageProtocol:
        productId === "38dace91-0fba-49ee-a93f-ac36e488fe4b" ? "k18_leave_in" : "course",
      relationship: "standalone",
    },
  })
  const tiedCandidates = [
    candidate("epres", "Epres Bond Repair Treatment", "https://example.com/epres.webp"),
    candidate(
      "38dace91-0fba-49ee-a93f-ac36e488fe4b",
      "K18 Leave-In Molecular Repair Hair Mask",
      "https://example.com/k18.webp",
    ),
    candidate(
      "olaplex",
      "OLAPLEX No.3PLUS Complete Repair Treatment",
      "https://example.com/olaplex.webp",
    ),
  ]
  const previewInput = {
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot: {
      ...result.snapshot,
      decisions: [decision],
      renderedOrder: ["bondbuilder" as const],
    },
  }
  const response = await computeStage1ProductExamplePreviews({
    ...previewInput,
    loadCandidates: async () => tiedCandidates,
  })
  const unsuitableK18 = await computeStage1ProductExamplePreviews({
    ...previewInput,
    loadCandidates: async () =>
      tiedCandidates.map((item) =>
        item.productId === "38dace91-0fba-49ee-a93f-ac36e488fe4b"
          ? {
              ...item,
              suitableThicknesses: [
                result.snapshot.profile.hair.thickness === "coarse" ? "fine" : "coarse",
              ],
            }
          : item,
      ),
  })

  assert.deepEqual(
    response.previews.map((preview) => [preview.productId, preview.imageUrl, preview.verdict]),
    [["38dace91-0fba-49ee-a93f-ac36e488fe4b", "https://example.com/k18.webp", "ideal"]],
  )
  assert.deepEqual(unsuitableK18.previews, [])
})

test("keeps a matching Shampoo preview when another category candidate load fails", async () => {
  const result = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-14T10:00:00.000Z",
  })
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected ready snapshot")
  const sourceShampooDecision = result.snapshot.decisions.find(
    (item) => item.category === "shampoo",
  )
  const conditionerDecision = result.snapshot.decisions.find(
    (item) => item.category === "conditioner",
  )
  assert.ok(sourceShampooDecision?.target?.category === "shampoo")
  assert.ok(conditionerDecision?.target?.category === "conditioner")
  const role = "shampoo_everyday" as const
  const shampooDecision = {
    ...sourceShampooDecision,
    roles: [role],
    target: {
      ...sourceShampooDecision.target,
      roles: [role],
      scalpRoute: "balanced" as const,
      everydayConstraint: "standard" as const,
      requiresTargetedDandruffCapability: false,
    },
  }
  const candidate: Stage3ShampooFacts = {
    productId: "shampoo-profile-fit",
    displayName: "Shampoo Profil Fit",
    category: "shampoo",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: [result.snapshot.profile.hair.thickness],
    knownReaction: false,
    protocols: [{ role, status: "verified_complete", fingerprint: "protocol-shampoo" }],
    presentationImageUrl: "https://example.com/shampoo-profile-fit.webp",
    factFingerprint: "facts-shampoo",
    spec: {
      thickness: result.snapshot.profile.hair.thickness,
      shampooBucket: "normal",
      scalpRoute: "balanced",
      cleansingIntensity: "regular",
      targetFit: "matched",
    },
  }

  const response = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot: {
      ...result.snapshot,
      decisions: [conditionerDecision, shampooDecision],
      renderedOrder: ["conditioner", "shampoo"],
    },
    loadCandidates: async (selection) => {
      if (selection.category === "conditioner") throw new Error("conditioner unavailable")
      return [candidate]
    },
  })

  assert.deepEqual(
    response.previews.map((preview) => [preview.category, preview.productId]),
    [["shampoo", "shampoo-profile-fit"]],
  )
})

function persistence(): Stage1PersistenceDependencies {
  return {
    isEnabled: () => true,
    cohortCutoff: () => new Date("2026-08-08T00:00:00.000Z"),
    findEntitlement: async () => ({
      accessState: "active",
      enrollmentSourceId: "purchase-1",
      qualifiedAt: "2026-08-08T01:00:00.000Z",
      artifactLeadId: "lead-1",
    }),
    loadArtifact: async () => ({ id: "artifact-1", quizAnswers: COMPLETE_V3_PLAN_ENVELOPE }),
    createOrReuseInitialNeed: async (request) => ({
      outcome: "completed",
      personalPlanId: "plan-1",
      needVersionId: "need-1",
      outputSnapshot: request.outputSnapshot,
    }),
    now: () => new Date("2026-08-14T10:00:00.000Z"),
  }
}

test("preview route enforces authentication before reading plan or catalog data", async () => {
  let candidateLoads = 0
  const result = await handleStage1ProductExamplePreviews({
    getAuthenticatedUser: async () => null,
    loadJourneyAccess: async () => ({ kind: "legacy" }),
    persistence: persistence(),
    loadCandidates: async () => {
      candidateLoads += 1
      return []
    },
  })

  assert.deepEqual(result, { status: 401, body: { error: "unauthorized" } })
  assert.equal(candidateLoads, 0)
})

test("preview route returns source-bound presentation data without mutating Stage 1", async () => {
  const result = await handleStage1ProductExamplePreviews({
    getAuthenticatedUser: async () => ({ id: "user-1" }),
    loadJourneyAccess: async () => ({
      kind: "personal_plan_start",
      frontier: "stage1",
      nextHref: "/plan-start",
      allowed: { stage1: true, stage2: true, stage3: false, stage4: false, stage5: false },
    }),
    persistence: persistence(),
    loadCandidates: async (selection) => {
      if (selection.category !== "conditioner" || !selection.conditionerTarget) return []
      const target = selection.conditionerTarget
      return [
        {
          productId: "conditioner-route-fit",
          displayName: "Conditioner Route Fit",
          category: "conditioner",
          isActive: true,
          lifecycleStatus: "active",
          recommendable: true,
          suitableThicknesses: [selection.hairThickness],
          knownReaction: false,
          protocols: [
            {
              role: "conditioner_rinse_out",
              status: "verified_complete",
              fingerprint: "protocol-conditioner",
            },
          ],
          presentationImageUrl: "https://example.com/conditioner-route-fit.webp",
          factFingerprint: "facts-conditioner",
          spec: {
            thickness: selection.hairThickness,
            proteinMoistureBalance: target.careDirection,
            weight: target.weight,
            repairSupportLevel: target.repairSupportLevel,
            balanceDirection: target.careDirection,
            targetFit: "matched",
          },
        },
      ]
    },
  })

  assert.equal(result.status, 200)
  assert.equal("personalPlanId" in result.body ? result.body.personalPlanId : null, "plan-1")
  assert.deepEqual(
    "previews" in result.body
      ? result.body.previews.map((preview) => [preview.category, preview.productId])
      : [],
    [["conditioner", "conditioner-route-fit"]],
  )
})
