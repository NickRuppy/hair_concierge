import { config as loadEnv } from "dotenv"
import { existsSync } from "node:fs"
import { join, sep } from "node:path"
import { pathToFileURL } from "node:url"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { CATEGORY_ROLE_POLICIES } from "../../src/lib/personal-plan/products/authorities"
import { buildMaskDecision } from "../../src/lib/personal-plan/categories/mask"
import { buildPlanNeedAssessment } from "../../src/lib/personal-plan/needs"
import {
  loadStage3RecommendationCandidates,
  stage3AuthorityFactFingerprint,
} from "../../src/lib/personal-plan/products/authority/catalog-facts"
import type {
  Stage3AuthorityInput,
  Stage3CategoryProductFacts,
} from "../../src/lib/personal-plan/products/authority/contracts"
import type {
  PersonalPlanCategory,
  Stage3FitVerdict,
} from "../../src/lib/personal-plan/products/contracts"
import { buildStage3FitComparison } from "../../src/lib/personal-plan/products/fit-comparison"
import { evaluateStage3Authority } from "../../src/lib/personal-plan/products/authority/evaluate"
import type {
  PlanCategoryDecision,
  PlanCategoryTarget,
  PlanChemicalTreatment,
  PlanCurrentConcern,
  PlanElasticResponse,
  PlanHairSurface,
  PlanHairThickness,
  PlanProfile,
  PlanProductRole,
} from "../../src/lib/personal-plan/types"

export type ReachableBasisMaskTargetWitness = {
  target: Extract<PlanCategoryTarget, { category: "mask" }>
  hairThickness: PlanHairThickness
  witness: string
}

function subsets<T>(values: readonly T[]): T[][] {
  return values.reduce<T[][]>(
    (sets, value) => [...sets, ...sets.map((set) => [...set, value])],
    [[]],
  )
}

function stableTargetKey(target: unknown): string {
  if (Array.isArray(target)) return `[${target.map(stableTargetKey).join(",")}]`
  if (target && typeof target === "object")
    return `{${Object.entries(target as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${JSON.stringify(key)}:${stableTargetKey(value)}`)
      .join(",")}}`
  return JSON.stringify(target)
}

export function enumerateReachableBasisMaskTargetWitnesses(): ReachableBasisMaskTargetWitness[] {
  const thicknesses = ["fine", "normal", "coarse"] as const
  const surfaces = ["smooth", "slightly_uneven", "rough"] as const
  const elasticities = ["snaps", "stretches_bounces", "stretches_stays"] as const
  const treatmentSets = [
    ["natural"],
    ["colored"],
    ["lightened"],
  ] as const satisfies readonly (readonly PlanChemicalTreatment[])[]
  const strongConcernSets = subsets<PlanCurrentConcern>([
    "dry_lengths",
    "hair_damage",
    "breakage",
    "tangling",
  ])
  const presentationConcernSets = subsets<PlanCurrentConcern>([
    "low_volume_or_weighed_down",
    "frizz_flyaways",
    "low_shine",
    "split_ends",
  ])
  const functionalGoalSets = subsets<PlanProfile["goals"][number]>([
    "frizz_surface",
    "manageability_styling",
    "shine",
  ])
  const exposureVariants = [
    { key: "none", mechanicalExposureSignals: [] as const },
    { key: "mechanical", mechanicalExposureSignals: ["towel_rough_rubbing"] as const },
  ]
  const witnesses = new Map<string, ReachableBasisMaskTargetWitness>()

  // These are the complete equivalence partitions read by buildMaskDecision's target builder:
  // thickness/load sensitivity, surface, elasticity, repair stress, observed concerns,
  // function goals, and the presence/absence of a qualifying exposure. Other quiz fields do
  // not participate in Mask target generation and therefore use one valid representative.
  for (const thickness of thicknesses) {
    for (const surface of surfaces) {
      for (const elasticity of elasticities) {
        for (const chemicalTreatments of treatmentSets) {
          for (const strongConcerns of strongConcernSets) {
            for (const presentationConcerns of presentationConcernSets) {
              for (const goals of functionalGoalSets) {
                for (const exposure of exposureVariants) {
                  const profile: PlanProfile = {
                    source: {
                      quizVersion: 3,
                      artifactId: "basis-mask-reachability-audit",
                      projection: "refined_post_plan",
                    },
                    hair: {
                      texture: "wavy",
                      thickness,
                      density: "medium",
                      length: "long",
                      surface: surface as PlanHairSurface,
                      elasticity: elasticity as PlanElasticResponse,
                      chemicalTreatments: [...chemicalTreatments],
                    },
                    scalp: {
                      oiliness: "balanced",
                      concerns: [],
                      irritationState: { state: "unknown", reason: "scalp_irritation_detail" },
                    },
                    goals: [...goals],
                    concerns: [...strongConcerns, ...presentationConcerns],
                    concernRecurrence: { state: "unknown", reason: "concern_recurrence" },
                    routine: {
                      currentProductLoad: { state: "unknown", reason: "current_product_load" },
                      shampooFrequency: { state: "known", value: "weekly_2x" },
                      heatToolUse: { state: "known", value: [] },
                      mechanicalExposureSignals: [...exposure.mechanicalExposureSignals],
                      dryShampooBridgePreference: {
                        state: "unknown",
                        reason: "dry_shampoo_bridge_preference",
                      },
                      scalpIrritationState: {
                        state: "unknown",
                        reason: "scalp_irritation_detail",
                      },
                    },
                  }
                  const assessment = buildPlanNeedAssessment(profile)
                  const decision = buildMaskDecision(profile, assessment.damage)
                  if (decision.needTier !== "basis" || decision.target?.category !== "mask")
                    continue
                  const key = `${thickness}:${stableTargetKey(decision.target)}`
                  if (witnesses.has(key)) continue
                  witnesses.set(key, {
                    target: decision.target,
                    hairThickness: thickness,
                    witness: stableTargetKey({
                      thickness,
                      surface,
                      elasticity,
                      chemicalTreatments,
                      concerns: profile.concerns,
                      goals,
                      exposure: exposure.key,
                    }),
                  })
                }
              }
            }
          }
        }
      }
    }
  }

  return [...witnesses.values()].sort((left, right) =>
    `${left.hairThickness}:${stableTargetKey(left.target)}`.localeCompare(
      `${right.hairThickness}:${stableTargetKey(right.target)}`,
    ),
  )
}

export type CoverageAuditObservation = {
  category: PersonalPlanCategory
  role: PlanProductRole
  auditKind?: "portfolio_alternatives" | "basis_mask_reachable_target"
  candidateCount: number
  alternatives: Array<{
    category: PersonalPlanCategory
    role: PlanProductRole | null
    verdict: Extract<Stage3FitVerdict, "ideal" | "supportive">
    coveredTargetCount: number
    recommendationProductId: string
    productId: string
    fingerprint: string
  }>
  recommendation?: {
    productId: string
    recommendationProductId: string
    verdict: Extract<Stage3FitVerdict, "ideal">
    fingerprint: string
  } | null
  presentation?: {
    productId: string
    imageUrl: string
    fingerprint: string
  } | null
  explicitUnavailable?: boolean
  nearestCandidates?: Array<{
    productId: string
    displayName: string
    verdict: Stage3FitVerdict
    failedCriteria: string[]
    unknownCriteria: string[]
    cautionCriteria: string[]
    hasImage: boolean
  }>
}

export function coverageAuditFailures(observation: CoverageAuditObservation): string[] {
  const failures: string[] = []
  if (observation.candidateCount === 0) failures.push("catalog_empty")
  if (observation.auditKind === "basis_mask_reachable_target") {
    if (!observation.recommendation) failures.push("basis_mask_ideal_recommendation_missing")
    if (!observation.presentation) failures.push("basis_mask_ideal_presentation_missing")
    if (
      observation.recommendation &&
      observation.recommendation.recommendationProductId !== observation.recommendation.productId
    )
      failures.push("recommendation_identity_mismatch")
    if (
      observation.recommendation &&
      observation.presentation &&
      observation.recommendation.productId !== observation.presentation.productId
    )
      failures.push("presentation_identity_mismatch")
    if (observation.recommendation && !observation.recommendation.fingerprint.trim())
      failures.push("fingerprint_missing")
    if (observation.presentation && !observation.presentation.imageUrl.trim())
      failures.push("presentation_image_missing")
    if (observation.presentation && !observation.presentation.fingerprint.trim())
      failures.push("fingerprint_missing")
    return [...new Set(failures)]
  }
  if (observation.alternatives.length === 0) failures.push("alternative_empty")
  for (const alternative of observation.alternatives) {
    if (alternative.category !== observation.category) failures.push("category_mismatch")
    if (alternative.role !== observation.role) failures.push("role_mismatch")
    if (alternative.coveredTargetCount === 0) failures.push("zero_target_coverage")
    if (alternative.recommendationProductId !== alternative.productId)
      failures.push("recommendation_identity_mismatch")
    if (!alternative.fingerprint.trim()) failures.push("fingerprint_missing")
  }
  return [...new Set(failures)]
}

type AuditTarget = {
  key: string
  category: PersonalPlanCategory
  role: PlanProductRole
  decision: PlanCategoryDecision
  hairThickness?: PlanHairThickness
  auditKind?: "portfolio_alternatives" | "basis_mask_reachable_target"
  witness?: string
}

const SHAMPOO_TARGETS: AuditTarget[] = [
  shampooTarget("shampoo/standard", "shampoo_everyday", "balanced", "standard"),
  shampooTarget("shampoo/irritated", "shampoo_everyday", "balanced", "irritation_compatible"),
  shampooTarget("shampoo/dry-scalp", "shampoo_everyday", "oily", "gentle_dry_scalp"),
  shampooTarget(
    "shampoo/dry-and-irritated",
    "shampoo_everyday",
    "dry",
    "gentle_dry_scalp_and_irritation_compatible",
  ),
  shampooTarget("shampoo/dandruff", "shampoo_dandruff", "oily", "standard"),
]

function shampooTarget(
  key: string,
  role: "shampoo_everyday" | "shampoo_dandruff",
  scalpRoute: "oily" | "balanced" | "dry",
  everydayConstraint:
    | "standard"
    | "gentle_dry_scalp"
    | "irritation_compatible"
    | "gentle_dry_scalp_and_irritation_compatible",
): AuditTarget {
  return {
    key,
    category: "shampoo",
    role,
    decision: decision("shampoo", role, {
      category: "shampoo",
      roles: [role],
      scalpRoute,
      everydayConstraint,
      requiresTargetedDandruffCapability: role === "shampoo_dandruff",
    }),
  }
}

function allAuditTargets(): AuditTarget[] {
  const targets = Object.entries(CATEGORY_ROLE_POLICIES).flatMap(([category, policy]) =>
    policy.allowedRoles.map((role) => ({
      key: `${category}/${role}`,
      category: category as PersonalPlanCategory,
      role,
      decision: decisionFor(category as PersonalPlanCategory, role),
    })),
  )
  const withoutDefaultShampoo = targets.filter((target) => target.category !== "shampoo")
  const reachableBasisMasks = enumerateReachableBasisMaskTargetWitnesses().map(
    ({ target, hairThickness, witness }, index): AuditTarget => ({
      key: `mask/basis/reachable/${String(index + 1).padStart(4, "0")}`,
      category: "mask",
      role: "intensive_conditioning_mask",
      decision: decision("mask", "intensive_conditioning_mask", target),
      hairThickness,
      auditKind: "basis_mask_reachable_target",
      witness,
    }),
  )
  return [...SHAMPOO_TARGETS, ...withoutDefaultShampoo, ...reachableBasisMasks]
}

function decisionFor(category: PersonalPlanCategory, role: PlanProductRole): PlanCategoryDecision {
  switch (category) {
    case "shampoo":
      return shampooTarget("unused", role as "shampoo_everyday", "balanced", "standard").decision
    case "conditioner":
      return decision(category, role, {
        category,
        roles: [role],
        weight: "light",
        careDirection: "moisture",
        repairSupportLevel: "medium",
        functionalNeeds: [],
      })
    case "leave_in":
      return decision(category, role, {
        category,
        roles: [role],
        weight: "light",
        careDirection: "moisture",
        repairSupportLevel: "medium",
        functions: [],
        conditionerReplacementEligible: false,
      })
    case "mask":
      return decision(category, role, {
        category,
        roles: [role],
        needStrength: "standard",
        weight: "light",
        careDirection: "moisture",
        repairSupportLevel: "medium",
        functionalNeeds: [],
      })
    case "oil":
      return decision(category, role, {
        category,
        roles: [role],
        roleTargets: [
          {
            role,
            tier: "basis",
            weight: role === "pre_wash_fibre_treatment" ? null : "light",
            functionalBenefits: [],
          },
        ],
      })
    case "heat_protectant":
      return decision(category, role, {
        category,
        roles: [role],
        qualifyingRoutes: ["direct_contact_heat"],
        carrierPolicy: "integrated_or_separate_verified_binary_capability",
      })
    case "dry_shampoo":
      return decision(category, role, { category, roles: [role], cadenceAdjustment: "keep" })
    case "bondbuilder":
      return decision(category, role, {
        category,
        roles: [role],
        requiredFunction: "support_stressed_hair_resilience",
        mechanismTarget: "mechanism_neutral",
      })
    case "scalp_care":
      return decision(category, role, {
        category,
        roles: [role],
        roleTargets: [{ role, coverage: "primary" }],
      })
    case "deep_cleansing_shampoo":
      return decision(category, role, { category, roles: [role] })
  }
}

function decision(
  category: PersonalPlanCategory,
  role: PlanProductRole,
  target: unknown,
): PlanCategoryDecision {
  return {
    category,
    resolution: "resolved",
    needTier: "basis",
    roles: [role],
    target,
    frequency: null,
    reasons: [],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  } as PlanCategoryDecision
}

function loadLocalEnv(): void {
  const cwd = process.cwd()
  const candidates = [join(cwd, ".env.local")]
  const worktreeIndex = cwd.indexOf(`${sep}.worktrees${sep}`)
  if (worktreeIndex >= 0) candidates.push(join(cwd.slice(0, worktreeIndex), ".env.local"))
  for (const envPath of [...new Set(candidates)])
    if (existsSync(envPath)) loadEnv({ path: envPath })
}

async function observeTarget(
  client: SupabaseClient,
  target: AuditTarget,
  candidateCache: Map<string, Stage3CategoryProductFacts[]>,
): Promise<CoverageAuditObservation> {
  const shampooTargetValue =
    target.decision.target?.category === "shampoo" ? target.decision.target : null
  const conditionerTarget =
    target.decision.target?.category === "conditioner" ? target.decision.target : null
  const hairThickness = target.hairThickness ?? "normal"
  const selection = {
    category: target.category,
    role: target.role,
    hairThickness,
    shampooTarget: shampooTargetValue,
    conditionerTarget,
    completeCatalog: true,
  } as const
  const cacheKey = stableTargetKey(selection)
  let candidates = candidateCache.get(cacheKey)
  if (!candidates) {
    candidates = await loadStage3RecommendationCandidates(client, selection)
    candidateCache.set(cacheKey, candidates)
  }
  const seed = candidates[0] ?? null
  const productFacts =
    target.auditKind === "basis_mask_reachable_target"
      ? null
      : seed
        ? syntheticOwnedFacts(seed, target.key)
        : null
  const input = {
    category: target.category,
    authorityVersion: CATEGORY_ROLE_POLICIES[target.category].authorityVersion,
    refinedVersionId: "audit-refined",
    refinedInputHash: "audit-input",
    subjectKey: `audit:${target.key}`,
    role: target.role,
    capturedProductId: productFacts ? "audit-captured" : null,
    subjectIdentity: productFacts
      ? {
          kind: "catalog_product",
          productId: productFacts.productId,
          displayName: productFacts.displayName,
          category: target.category,
        }
      : null,
    categoryDecision: target.decision,
    coverage: [],
    productFacts,
    recommendationCandidates: candidates,
    hairThickness,
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
  } as Stage3AuthorityInput
  if (target.auditKind === "basis_mask_reachable_target") {
    const evaluation = evaluateStage3Authority(input)
    const initialRecommendation = evaluation.status === "known" ? evaluation.recommendation : null
    const selected = initialRecommendation
      ? (candidates.find((candidate) => candidate.productId === initialRecommendation.productId) ??
        null)
      : null
    const selectedEvaluation = selected
      ? evaluateStage3Authority({ ...input, productFacts: selected } as Stage3AuthorityInput)
      : null
    const recommendation =
      evaluation.status === "known" &&
      evaluation.verdict === "ideal" &&
      initialRecommendation &&
      selected &&
      selectedEvaluation?.status === "known" &&
      selectedEvaluation.verdict === "ideal" &&
      evaluation.recommendationFactFingerprint === selected.factFingerprint
        ? {
            productId: selected.productId,
            recommendationProductId: initialRecommendation.productId,
            verdict: "ideal" as const,
            fingerprint: selected.factFingerprint,
          }
        : null
    const presentation =
      recommendation && selected?.presentationImageUrl?.trim()
        ? {
            productId: selected.productId,
            imageUrl: selected.presentationImageUrl.trim(),
            fingerprint: selected.factFingerprint,
          }
        : null
    const assessedCandidates = candidates
      .filter(
        (candidate) =>
          candidate.recommendable && candidate.isActive && candidate.lifecycleStatus === "active",
      )
      .map((candidate) => {
        const result = evaluateStage3Authority({
          ...input,
          productFacts: candidate,
        } as Stage3AuthorityInput)
        const criteria =
          result.status === "known" || result.status === "unknown" ? result.criteria : []
        return {
          productId: candidate.productId,
          displayName: candidate.displayName,
          verdict: result.status === "known" ? result.verdict : ("unknown" as const),
          failedCriteria: criteria
            .filter((criterion) => criterion.result === "fail")
            .map((criterion) => criterion.criterionId),
          unknownCriteria: criteria
            .filter((criterion) => criterion.result === "unknown")
            .map((criterion) => criterion.criterionId),
          cautionCriteria: criteria
            .filter((criterion) => criterion.result === "caution")
            .map((criterion) => criterion.criterionId),
          hasImage: Boolean(candidate.presentationImageUrl?.trim()),
        }
      })
    const candidateDistance = (candidate: (typeof assessedCandidates)[number]) =>
      candidate.failedCriteria.length * 100 +
      candidate.unknownCriteria.length * 10 +
      candidate.cautionCriteria.length +
      (candidate.hasImage ? 0 : 1)
    const nearestCandidates = assessedCandidates
      .sort((left, right) => {
        return (
          candidateDistance(left) - candidateDistance(right) ||
          left.productId.localeCompare(right.productId)
        )
      })
      .slice(0, 5)
    return {
      category: target.category,
      role: target.role,
      auditKind: target.auditKind,
      candidateCount: candidates.length,
      alternatives: [],
      recommendation,
      presentation,
      explicitUnavailable:
        evaluation.status === "known" &&
        !evaluation.recommendation &&
        evaluation.allowedActions.includes("leave_uncovered"),
      nearestCandidates,
    }
  }
  const comparison = buildStage3FitComparison(input)
  const alternatives = comparison.alternatives.map((alternative) => ({
    category: alternative.category,
    role: alternative.role,
    verdict: alternative.verdict,
    coveredTargetCount:
      comparison.evidenceRows?.filter((row) =>
        row.productValues.some(
          (value) => value.productId === alternative.productId && value.relation === "in_target",
        ),
      ).length ?? 0,
    recommendationProductId: alternative.recommendation.productId,
    productId: alternative.productId,
    fingerprint: alternative.factFingerprint,
  }))
  return {
    category: target.category,
    role: target.role,
    auditKind: "portfolio_alternatives",
    candidateCount: candidates.length,
    alternatives,
  }
}

function syntheticOwnedFacts(
  seed: Stage3CategoryProductFacts,
  targetKey: string,
): Stage3CategoryProductFacts {
  const cloned = structuredClone(seed)
  const productId = `audit-owned-${targetKey}`
  const displayName = "Audit owned product"
  const { spec, factFingerprint: _fingerprint, ...commonWithObservations } = cloned
  const { comparisonObservations: _observations, ...common } =
    commonWithObservations as typeof commonWithObservations & {
      comparisonObservations?: unknown
    }
  return {
    ...cloned,
    productId,
    displayName,
    recommendable: false,
    factFingerprint: stage3AuthorityFactFingerprint({
      common: { ...common, productId, displayName, recommendable: false } as never,
      spec,
    }),
  } as Stage3CategoryProductFacts
}

async function main(): Promise<void> {
  loadLocalEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("stage3_coverage_audit_credentials_missing")
  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const rows: Array<{
    target: string
    candidates: number
    alternatives: number
    failures: string[]
    hairThickness?: PlanHairThickness
    matrix?: unknown
    witness?: string
    nearestCandidates?: CoverageAuditObservation["nearestCandidates"]
  }> = []
  const candidateCache = new Map<string, Stage3CategoryProductFacts[]>()
  for (const target of allAuditTargets()) {
    try {
      const observation = await observeTarget(client, target, candidateCache)
      const failures = coverageAuditFailures(observation)
      rows.push({
        target: target.key,
        candidates: observation.candidateCount,
        alternatives: observation.alternatives.length,
        failures,
        ...(target.auditKind === "basis_mask_reachable_target" && failures.length > 0
          ? {
              hairThickness: target.hairThickness,
              matrix: target.decision.target,
              witness: target.witness,
              nearestCandidates: observation.nearestCandidates,
            }
          : {}),
      })
    } catch {
      rows.push({ target: target.key, candidates: 0, alternatives: 0, failures: ["query_error"] })
    }
  }
  const basisRows = rows.filter((row) => row.target.startsWith("mask/basis/reachable/"))
  const nonBasisRows = rows.filter((row) => !row.target.startsWith("mask/basis/reachable/"))
  process.stdout.write(
    `${JSON.stringify({
      targets: nonBasisRows,
      basisMask: {
        reachableTargetCount: basisRows.length,
        coveredTargetCount: basisRows.filter((row) => row.failures.length === 0).length,
        uncoveredTargets: basisRows.filter((row) => row.failures.length > 0),
      },
    })}\n`,
  )
  if (rows.some((row) => row.failures.length > 0)) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) void main()
