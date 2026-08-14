import { config as loadEnv } from "dotenv"
import { existsSync } from "node:fs"
import { join, sep } from "node:path"
import { pathToFileURL } from "node:url"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { CATEGORY_ROLE_POLICIES } from "../../src/lib/personal-plan/products/authorities"
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
import type { PlanCategoryDecision, PlanProductRole } from "../../src/lib/personal-plan/types"

export type CoverageAuditObservation = {
  category: PersonalPlanCategory
  role: PlanProductRole
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
}

export function coverageAuditFailures(observation: CoverageAuditObservation): string[] {
  const failures: string[] = []
  if (observation.candidateCount === 0) failures.push("catalog_empty")
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
  return [...SHAMPOO_TARGETS, ...withoutDefaultShampoo]
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
): Promise<CoverageAuditObservation> {
  const shampooTargetValue =
    target.decision.target?.category === "shampoo" ? target.decision.target : null
  const conditionerTarget =
    target.decision.target?.category === "conditioner" ? target.decision.target : null
  const candidates = await loadStage3RecommendationCandidates(client, {
    category: target.category,
    role: target.role,
    hairThickness: "normal",
    shampooTarget: shampooTargetValue,
    conditionerTarget,
    completeCatalog: true,
  })
  const seed = candidates[0] ?? null
  const productFacts = seed ? syntheticOwnedFacts(seed, target.key) : null
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
    candidateCatalogComplete: true,
    hairThickness: "normal",
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
  } as Stage3AuthorityInput
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
  }> = []
  for (const target of allAuditTargets()) {
    try {
      const observation = await observeTarget(client, target)
      rows.push({
        target: target.key,
        candidates: observation.candidateCount,
        alternatives: observation.alternatives.length,
        failures: coverageAuditFailures(observation),
      })
    } catch {
      rows.push({ target: target.key, candidates: 0, alternatives: 0, failures: ["query_error"] })
    }
  }
  process.stdout.write(`${JSON.stringify({ targets: rows })}\n`)
  if (rows.some((row) => row.failures.length > 0)) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) void main()
