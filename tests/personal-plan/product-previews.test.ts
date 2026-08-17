import assert from "node:assert/strict"
import test from "node:test"

import { computeNeedPlan } from "../../src/lib/personal-plan/compute-stage1"
import { handleStage1ProductExamplePreviews } from "../../src/app/api/personal-plan/stage-1/previews/route"
import { computeStage1ProductExamplePreviews } from "../../src/lib/personal-plan/product-previews"
import { frequencyLabel, presentationFor } from "../../src/lib/personal-plan/decision-presentation"
import type { Stage1PersistenceDependencies } from "../../src/lib/personal-plan/persistence/stage1-service"
import type {
  Stage3BondbuilderFacts,
  Stage3ConditionerFacts,
  Stage3MaskFacts,
  Stage3OilFacts,
  Stage3ScalpCareFacts,
  Stage3ShampooFacts,
} from "../../src/lib/personal-plan/products/authority/contracts"
import { stage3DecisionKey } from "../../src/lib/personal-plan/products/contracts"
import type {
  Stage1ProductExampleFallback,
  Stage1ProductExampleRecommendation,
  Stage1ProductExampleRolePreview,
} from "../../src/lib/personal-plan/product-preview-contract"
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

function asRecommendation(
  preview: Stage1ProductExampleRolePreview,
): Stage1ProductExampleRecommendation {
  assert.equal(preview.kind, "recommendation", `expected a recommendation, got ${preview.kind}`)
  return preview as Stage1ProductExampleRecommendation
}

function asFallback(preview: Stage1ProductExampleRolePreview): Stage1ProductExampleFallback {
  assert.equal(preview.kind, "fallback", `expected a fallback, got ${preview.kind}`)
  return preview as Stage1ProductExampleFallback
}

function emptyCommerce() {
  return {
    priceEur: null,
    purchaseLinkStatus: null,
    netContentValue: null,
    netContentUnit: null,
    priceLabel: null,
    netContentLabel: null,
    // Unknown availability stays quiet rather than announcing an unconfirmed status.
    availabilityLabel: null,
    productUrl: null,
    affiliateDisclosure: null,
  }
}

function expectedReasoning(decision: PlanCategoryDecision) {
  const presentation = presentationFor(decision)
  assert.ok(presentation, "decision must have presentation copy")
  return {
    productCriteria: presentation.productCriteria,
    fit: presentation.fit,
    frequency: frequencyLabel(decision.frequency, decision.executionState === "paused"),
  }
}

test("uses the shared Conditioner authority and maps its selected product back to the image, commerce and reasoning facts", async () => {
  const snapshot = conditionerSnapshot()
  const decision = snapshot.decisions[0]!
  const target = decision.target
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
  assert.equal(response.schemaVersion, 2)
  assert.deepEqual(response.previews, [
    {
      kind: "recommendation",
      category: "conditioner",
      role: "conditioner_rinse_out",
      decisionKey: stage3DecisionKey("conditioner", "conditioner_rinse_out", null),
      productId: "conditioner-profile-fit",
      productName: "Conditioner Profil Fit",
      imageUrl: "https://example.com/conditioner-profile-fit.webp",
      verdict: "ideal",
      authorityVersion: "personal-plan.conditioner.v3",
      factFingerprint: "facts-conditioner",
      commerce: emptyCommerce(),
      reasoning: expectedReasoning(decision),
    },
  ])
})

test("falls back to post_refinement when the shared authority product has no presentation image", async () => {
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

  assert.equal(response.previews.length, 1)
  assert.deepEqual(asFallback(response.previews[0]!), {
    kind: "fallback",
    category: "conditioner",
    role: "conditioner_rinse_out",
    decisionKey: stage3DecisionKey("conditioner", "conditioner_rinse_out", null),
    authorityVersion: "personal-plan.conditioner.v3",
    fallback: "post_refinement",
  })
})

test("a null currency fails closed to no price label on the Stage 1 preview path too", async () => {
  const snapshot = conditionerSnapshot()
  const decision = snapshot.decisions[0]!
  const target = decision.target
  assert.ok(target?.category === "conditioner")
  const candidate: Stage3ConditionerFacts = {
    productId: "conditioner-unknown-currency",
    displayName: "Conditioner ohne bekannte Währung",
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
    presentationImageUrl: "https://example.com/conditioner-unknown-currency.webp",
    factFingerprint: "facts-conditioner-unknown-currency",
    priceEur: 9.9,
    currency: null,
    purchaseLinkStatus: "available",
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

  assert.equal(response.previews.length, 1)
  const recommendation = asRecommendation(response.previews[0]!)
  assert.equal(recommendation.commerce.priceEur, 9.9)
  assert.equal(recommendation.commerce.priceLabel, null)
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
    response.previews.map((preview) => {
      const recommendation = asRecommendation(preview)
      return [recommendation.productId, recommendation.imageUrl]
    }),
    [["shampoo-candidate-13", "https://example.com/shampoo-candidate-13.webp"]],
  )
})

test("surfaces a supportive Conditioner verdict for a basis decision now that supportive is allowed for basis categories", async () => {
  // The Conditioner authority already falls back to a supportive candidate
  // in its search (see conditioner.ts) regardless of need tier; the old
  // stage1ExampleVerdictAllowed gate (ideal-only, plus optional-tier Mask)
  // blocked it from ever reaching the Stage 1 preview. This is a basis
  // decision, so the loosened gate must now let it through.
  const snapshot = conditionerSnapshot()
  const decision = snapshot.decisions[0]!
  assert.equal(decision.needTier, "basis")
  const target = decision.target
  assert.ok(target?.category === "conditioner")
  // One weight step away from the target is a documented "caution" fit
  // (see orderedAxisFitResult), which the authority reports as supportive
  // rather than ideal.
  const weights = ["light", "medium", "rich"] as const
  const targetWeightIndex = weights.indexOf(target.weight as (typeof weights)[number])
  const offByOneWeight = weights[targetWeightIndex === 0 ? 1 : targetWeightIndex - 1]!
  const supportiveCandidate: Stage3ConditionerFacts = {
    productId: "supportive-conditioner",
    displayName: "Conditioner mit abweichendem Gewicht",
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
        fingerprint: "protocol-conditioner-supportive",
      },
    ],
    presentationImageUrl: "https://example.com/supportive-conditioner.webp",
    factFingerprint: "facts-supportive-conditioner",
    spec: {
      thickness: snapshot.profile.hair.thickness,
      proteinMoistureBalance: target.careDirection,
      weight: offByOneWeight,
      repairSupportLevel: target.repairSupportLevel,
      balanceDirection: target.careDirection,
      targetFit: "matched",
    },
  }

  const response = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot,
    loadCandidates: async () => [supportiveCandidate],
  })

  assert.equal(response.previews.length, 1)
  const recommendation = asRecommendation(response.previews[0]!)
  assert.equal(recommendation.productId, "supportive-conditioner")
  assert.equal(recommendation.verdict, "supportive")
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

  // The decision may require other Oil roles too (one entry per required
  // role); only the role this fixture's candidate actually supports must
  // resolve to a recommendation.
  const matchingPreview = response.previews.find((preview) => preview.role === role)
  assert.ok(matchingPreview)
  const recommendation = asRecommendation(matchingPreview)
  assert.equal(recommendation.productId, "oil-profile-fit")
  assert.equal(recommendation.imageUrl, "https://example.com/oil-profile-fit.webp")
  assert.equal(recommendation.verdict, "ideal")
  assert.equal(recommendation.role, role)
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
      coverage: [
        {
          job: "scalp_flake_or_comfort",
          ruleId: "portfolio.scalp.shampoo_primary",
          primaryCategories: ["shampoo"],
          supportingCategories: ["scalp_care"],
          outcome: "duplicate_purchase_suppressed",
        },
      ],
    },
    loadCandidates: async () => [candidate],
  })

  assert.equal(response.previews.length, 1)
  const recommendation = asRecommendation(response.previews[0]!)
  assert.equal(recommendation.productId, "scalp-care-profile-fit")
  assert.equal(recommendation.imageUrl, "https://example.com/scalp-care-profile-fit.webp")
  assert.equal(recommendation.verdict, "ideal")
})

test("returns an exact-fit Mask preview and falls back on an unsuitable thickness", async () => {
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

  assert.equal(exactFit.previews.length, 1)
  const recommendation = asRecommendation(exactFit.previews[0]!)
  assert.equal(recommendation.productId, "mask-profile-fit")
  assert.equal(recommendation.imageUrl, "https://example.com/mask-profile-fit.webp")
  assert.equal(recommendation.verdict, "ideal")

  assert.equal(unsuitable.previews.length, 1)
  assert.equal(asFallback(unsuitable.previews[0]!).fallback, "post_refinement")
})

test("uses a source-bound supportive Mask only for an optional Mask decision, falling back for basis", async () => {
  // Mask's own candidate search (mask.ts) only admits a supportive candidate
  // into `eligible` when needTier === "optional" — that gate is internal to
  // the Mask authority and is untouched by the Stage 1
  // stage1ExampleVerdictAllowed loosening, so a basis Mask decision still
  // has no recommendation to evaluate and must fall back.
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

  assert.equal(optional.previews.length, 1)
  const optionalRecommendation = asRecommendation(optional.previews[0]!)
  assert.equal(optionalRecommendation.productId, "mask-supportive-fit")
  assert.equal(optionalRecommendation.verdict, "supportive")

  assert.equal(basis.previews.length, 1)
  assert.equal(asFallback(basis.previews[0]!).fallback, "post_refinement")
})

test("returns an exact-fit Bondbuilder preview and falls back on an unsuitable thickness", async () => {
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

  assert.equal(exactFit.previews.length, 1)
  const recommendation = asRecommendation(exactFit.previews[0]!)
  assert.equal(recommendation.productId, "bondbuilder-profile-fit")
  assert.equal(recommendation.imageUrl, "https://example.com/bondbuilder-profile-fit.webp")
  assert.equal(recommendation.verdict, "ideal")

  assert.equal(unsuitable.previews.length, 1)
  assert.equal(asFallback(unsuitable.previews[0]!).fallback, "post_refinement")
})

test("a tied Bondbuilder shortlist previews the authority's tie default, not an illustration", async () => {
  // History: product-previews.ts once special-cased bondbuilder ties with a
  // hardcoded product id (STAGE1_BONDBUILDER_EXAMPLE_PRODUCT_ID, K18) as an
  // illustration-only fallback whenever multiple ideal candidates tied and
  // the bondbuilder authority itself declined to pick one
  // (recommendationCandidates.length > 1 => recommendation: null). That
  // presentation hardcode stays removed. The tie is now resolved where it
  // belongs — inside the authority, as the `bondbuilder.stage3.tie_default`
  // rule (BONDBUILDER_TIE_DEFAULT_PRODUCT_ID) — so the preview shows a real,
  // buyable recommendation with that product's own facts and fingerprint.
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

  assert.equal(response.previews.length, 1)
  const tied = asRecommendation(response.previews[0]!)
  assert.equal(tied.productId, "38dace91-0fba-49ee-a93f-ac36e488fe4b")
  assert.equal(tied.productName, "K18 Leave-In Molecular Repair Hair Mask")
  assert.equal(tied.imageUrl, "https://example.com/k18.webp")
  assert.equal(tied.factFingerprint, "facts-38dace91-0fba-49ee-a93f-ac36e488fe4b")
  assert.equal(tied.verdict, "ideal")

  // A tie WITHOUT the default product on the shortlist keeps the honest
  // fallback: the authority still refuses to pick among equals.
  const tieWithoutDefault = await computeStage1ProductExamplePreviews({
    ...previewInput,
    loadCandidates: async () =>
      tiedCandidates.filter((item) => item.productId !== "38dace91-0fba-49ee-a93f-ac36e488fe4b"),
  })

  assert.equal(tieWithoutDefault.previews.length, 1)
  assert.equal(asFallback(tieWithoutDefault.previews[0]!).fallback, "post_refinement")

  // If only one ideal candidate remains, the tie resolves and the engine
  // recommends it directly (no tie default involved).
  const untied = await computeStage1ProductExamplePreviews({
    ...previewInput,
    loadCandidates: async () =>
      tiedCandidates.map((item) =>
        item.productId === "38dace91-0fba-49ee-a93f-ac36e488fe4b"
          ? item
          : {
              ...item,
              suitableThicknesses: [
                result.snapshot.profile.hair.thickness === "coarse" ? "fine" : "coarse",
              ],
            },
      ),
  })

  assert.equal(untied.previews.length, 1)
  const recommendation = asRecommendation(untied.previews[0]!)
  assert.equal(recommendation.productId, "38dace91-0fba-49ee-a93f-ac36e488fe4b")
  assert.equal(recommendation.imageUrl, "https://example.com/k18.webp")
  assert.equal(recommendation.verdict, "ideal")
})

test("keeps a matching Shampoo preview and an explicit fallback when another category candidate load fails", async () => {
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

  assert.equal(response.previews.length, 2)
  const conditionerPreview = response.previews.find((item) => item.category === "conditioner")!
  const shampooPreview = asRecommendation(
    response.previews.find((item) => item.category === "shampoo")!,
  )
  assert.equal(asFallback(conditionerPreview).fallback, "post_refinement")
  assert.equal(shampooPreview.productId, "shampoo-profile-fit")
})

test("emits one entry per required role, so a two-role Shampoo decision yields two previews", async () => {
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
  const decision: PlanCategoryDecision = {
    ...sourceDecision,
    roles: ["shampoo_everyday", "shampoo_dandruff"],
    target: { ...sourceDecision.target, roles: ["shampoo_everyday", "shampoo_dandruff"] },
  }

  const response = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot: {
      ...result.snapshot,
      decisions: [decision],
      renderedOrder: ["shampoo"],
    },
    // No candidates for either role: every role must still surface an
    // explicit fallback rather than being silently omitted.
    loadCandidates: async () => [],
  })

  assert.deepEqual(
    response.previews
      .map((preview) => [preview.category, preview.role, preview.kind])
      .sort((left, right) => String(left[1]).localeCompare(String(right[1]))),
    [
      ["shampoo", "shampoo_dandruff", "fallback"],
      ["shampoo", "shampoo_everyday", "fallback"],
    ],
  )
  for (const preview of response.previews) {
    assert.equal(asFallback(preview).fallback, "post_refinement")
  }
})

test("shares a single candidate load across every role of a role-insensitive multi-role category (Oil)", async () => {
  // Oil's derived candidate facts don't depend on `role` (see
  // ROLE_SENSITIVE_CANDIDATE_CATEGORIES in product-previews.ts), so all
  // three of its roles must be served by one candidate load, not three.
  const result = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-14T10:00:00.000Z",
  })
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected ready snapshot")
  const sourceDecision = result.snapshot.decisions.find((item) => item.category === "oil")
  assert.ok(sourceDecision?.target?.category === "oil")
  const allRoles = [
    "pre_wash_fibre_treatment",
    "leave_on_fibre_conditioning",
    "dry_finish",
  ] as const
  const sourceRoleTarget = sourceDecision.target.roleTargets[0]!
  const decision: PlanCategoryDecision = {
    ...sourceDecision,
    roles: [...allRoles],
    target: {
      ...sourceDecision.target,
      roles: [...allRoles],
      roleTargets: allRoles.map((role) => ({ ...sourceRoleTarget, role })),
    },
  }

  let loadCount = 0
  const response = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot: {
      ...result.snapshot,
      decisions: [decision],
      renderedOrder: ["oil"],
    },
    loadCandidates: async () => {
      loadCount += 1
      return []
    },
  })

  assert.equal(response.previews.length, 3)
  assert.equal(loadCount, 1)
})

test("issues a separate candidate load per role for Shampoo, whose spec is role-sensitive", async () => {
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
  const decision: PlanCategoryDecision = {
    ...sourceDecision,
    roles: ["shampoo_everyday", "shampoo_dandruff"],
    target: { ...sourceDecision.target, roles: ["shampoo_everyday", "shampoo_dandruff"] },
  }

  let loadCount = 0
  const requestedRoles: string[] = []
  const response = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot: {
      ...result.snapshot,
      decisions: [decision],
      renderedOrder: ["shampoo"],
    },
    loadCandidates: async (selection) => {
      loadCount += 1
      requestedRoles.push(selection.role)
      return []
    },
  })

  assert.equal(response.previews.length, 2)
  assert.equal(loadCount, 2)
  assert.deepEqual([...requestedRoles].sort(), ["shampoo_dandruff", "shampoo_everyday"])
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
  const conditionerPreview =
    "previews" in result.body
      ? result.body.previews.find((preview) => preview.category === "conditioner")
      : null
  assert.ok(conditionerPreview)
  assert.equal(conditionerPreview.kind, "recommendation")
  assert.equal(
    conditionerPreview.kind === "recommendation" ? conditionerPreview.productId : null,
    "conditioner-route-fit",
  )
})
