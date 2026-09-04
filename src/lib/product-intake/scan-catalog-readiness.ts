/**
 * Operator-only readiness oracle: predicts whether a catalog product would resolve a
 * `scan_result_ready` verdict across every applicable role/thickness combination, for the
 * product-intake expansion tooling's preflight/verify scripts and the coverage export. Not
 * part of the runtime `/scan` request path — nothing under `src/app/api/scan/` imports this.
 */

import type { CategorySelectionContext } from "@/lib/personal-plan/products/authority/catalog-facts"
import type { Stage3CategoryProductFacts } from "@/lib/personal-plan/products/authority/contracts"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import type {
  PlanCategoryDecision,
  PlanCategoryTarget,
  PlanHairThickness,
  PlanProductRole,
} from "@/lib/personal-plan/types"

import { buildScanVerdict } from "@/lib/scan/resolve-verdict"

export type ScanCatalogReadinessVerdict = {
  profile: PlanHairThickness
  role: PlanProductRole
  verdict: "ideal" | "supportive" | "mismatch" | "unknown" | "error"
}

export type ScanCatalogReadinessResult = {
  factsPresent: boolean
  protocolsComplete: boolean
  verdicts: ScanCatalogReadinessVerdict[]
}

export type LoadScanCatalogFacts = (
  category: PersonalPlanCategory,
  productId: string,
  selectionContext: CategorySelectionContext,
) => Promise<Stage3CategoryProductFacts | null>

const PRIMARY_ROLE = {
  shampoo: "shampoo_everyday",
  conditioner: "conditioner_rinse_out",
  mask: "intensive_conditioning_mask",
  leave_in: "post_wash_leave_in",
  oil: "dry_finish",
  dry_shampoo: "root_refresh_bridge",
  heat_protectant: "pre_heat_protection",
  deep_cleansing_shampoo: "residue_reset",
  scalp_care: "scalp_comfort",
  bondbuilder: "specialized_bond_treatment",
} as const satisfies Record<PersonalPlanCategory, PlanProductRole>

const KNOWN_ROLES = new Set<PlanProductRole>([
  "shampoo_everyday",
  "shampoo_dandruff",
  "conditioner_rinse_out",
  "post_wash_leave_in",
  "pre_heat_application",
  "pre_heat_protection",
  "pre_wash_fibre_treatment",
  "leave_on_fibre_conditioning",
  "dry_finish",
  "intensive_conditioning_mask",
  "scalp_comfort",
  "scalp_flake_oil_adjunct",
  "density_claim_tonic",
  "scalp_exfoliant",
  "root_refresh_bridge",
  "residue_reset",
  "mineral_reset",
  "specialized_bond_treatment",
])

function declaredRoles(values: ReadonlyArray<string | null> | null | undefined): PlanProductRole[] {
  return (values ?? []).filter(
    (role): role is PlanProductRole =>
      typeof role === "string" && KNOWN_ROLES.has(role as PlanProductRole),
  )
}

/**
 * Canonical role expansion for the scanner's product-readiness audit. Roles come from the
 * same normalized authority facts consumed by the runtime verdict builder.
 */
export function scanReadinessRoles(facts: Stage3CategoryProductFacts): PlanProductRole[] {
  switch (facts.category) {
    case "shampoo": {
      // Scanner readiness starts by loading the everyday target. Read the complete observed
      // scalp-route coverage when it is available, so that bootstrap load can discover a
      // dandruff-only product without inferring everyday coverage from `schuppen` alone.
      const supportedRoutes = facts.comparisonObservations?.supportedScalpRoutes
      if (supportedRoutes?.length) {
        const roles: PlanProductRole[] = []
        if (supportedRoutes.some((route) => route !== "dandruff")) roles.push("shampoo_everyday")
        if (supportedRoutes.includes("dandruff")) roles.push("shampoo_dandruff")
        return roles
      }
      return facts.spec.shampooBucket === "schuppen" ? ["shampoo_dandruff"] : ["shampoo_everyday"]
    }
    case "conditioner":
      return ["conditioner_rinse_out"]
    case "mask":
      return ["intensive_conditioning_mask"]
    case "dry_shampoo":
      return ["root_refresh_bridge"]
    case "heat_protectant":
      return ["pre_heat_protection"]
    case "bondbuilder":
      return ["specialized_bond_treatment"]
    case "deep_cleansing_shampoo":
      return facts.spec.supportedResetRoles ?? ["residue_reset"]
    case "scalp_care": {
      const primary = declaredRoles([facts.spec.primaryRole]).slice(0, 1)
      return primary.length > 0 ? primary : ["scalp_comfort"]
    }
    case "leave_in": {
      const roles = new Set<PlanProductRole>([
        "post_wash_leave_in",
        ...declaredRoles(facts.spec.roles),
      ])
      if (facts.spec.providesHeatProtection === true) roles.add("pre_heat_application")
      return [...roles].filter(
        (role) => role === "post_wash_leave_in" || role === "pre_heat_application",
      )
    }
    case "oil": {
      const roles = Object.entries(facts.spec.roleSupport)
        .filter(([, supported]) => supported === true)
        .map(([role]) => role)
        .filter(
          (
            role,
          ): role is Extract<
            PlanProductRole,
            "pre_wash_fibre_treatment" | "leave_on_fibre_conditioning" | "dry_finish"
          > =>
            role === "pre_wash_fibre_treatment" ||
            role === "leave_on_fibre_conditioning" ||
            role === "dry_finish",
        )
      return roles.length > 0 ? roles : ["dry_finish"]
    }
  }
}

function targetFor(category: PersonalPlanCategory, role: PlanProductRole): PlanCategoryTarget {
  switch (category) {
    case "shampoo": {
      if (role !== "shampoo_everyday" && role !== "shampoo_dandruff")
        throw new Error("scan_readiness_role_category_mismatch")
      return {
        category,
        roles: [role],
        scalpRoute: "balanced",
        everydayConstraint: "standard",
        requiresTargetedDandruffCapability: role === "shampoo_dandruff",
      }
    }
    case "conditioner":
      if (role !== "conditioner_rinse_out") throw new Error("scan_readiness_role_category_mismatch")
      return {
        category,
        roles: [role],
        weight: "medium",
        careDirection: "balanced",
        repairSupportLevel: "medium",
        functionalNeeds: [],
      }
    case "mask":
      if (role !== "intensive_conditioning_mask")
        throw new Error("scan_readiness_role_category_mismatch")
      return {
        category,
        roles: [role],
        needStrength: "standard",
        weight: "medium",
        careDirection: "balanced",
        repairSupportLevel: "medium",
        functionalNeeds: [],
      }
    case "leave_in":
      if (role !== "post_wash_leave_in" && role !== "pre_heat_application")
        throw new Error("scan_readiness_role_category_mismatch")
      return {
        category,
        roles: [role],
        weight: "medium",
        careDirection: "balanced",
        repairSupportLevel: "medium",
        functions: [],
        conditionerReplacementEligible: false,
      }
    case "oil":
      if (
        role !== "pre_wash_fibre_treatment" &&
        role !== "leave_on_fibre_conditioning" &&
        role !== "dry_finish"
      )
        throw new Error("scan_readiness_role_category_mismatch")
      return {
        category,
        roles: [role],
        roleTargets: [{ role, tier: "optional", weight: "medium", functionalBenefits: [] }],
      }
    case "dry_shampoo":
      if (role !== "root_refresh_bridge") throw new Error("scan_readiness_role_category_mismatch")
      return { category, roles: [role], cadenceAdjustment: "keep" }
    case "heat_protectant":
      if (role !== "pre_heat_protection") throw new Error("scan_readiness_role_category_mismatch")
      return {
        category,
        roles: [role],
        qualifyingRoutes: ["direct_contact_heat"],
        carrierPolicy: "integrated_or_separate_verified_binary_capability",
      }
    case "deep_cleansing_shampoo":
      if (role !== "residue_reset" && role !== "mineral_reset")
        throw new Error("scan_readiness_role_category_mismatch")
      return { category, roles: [role] }
    case "scalp_care":
      if (
        role !== "scalp_comfort" &&
        role !== "scalp_flake_oil_adjunct" &&
        role !== "density_claim_tonic" &&
        role !== "scalp_exfoliant"
      )
        throw new Error("scan_readiness_role_category_mismatch")
      return { category, roles: [role], roleTargets: [{ role, coverage: "primary" }] }
    case "bondbuilder":
      if (role !== "specialized_bond_treatment")
        throw new Error("scan_readiness_role_category_mismatch")
      return {
        category,
        roles: [role],
        requiredFunction: "support_stressed_hair_resilience",
        mechanismTarget: "mechanism_neutral",
      }
  }
}

function selectionFor(
  category: PersonalPlanCategory,
  role: PlanProductRole,
  hairThickness: PlanHairThickness,
): CategorySelectionContext {
  const target = targetFor(category, role)
  return {
    hairThickness,
    role,
    shampooTarget: target.category === "shampoo" ? target : null,
    conditionerTarget: target.category === "conditioner" ? target : null,
  }
}

function decisionFor(category: PersonalPlanCategory, role: PlanProductRole): PlanCategoryDecision {
  return {
    category,
    resolution: "resolved",
    needTier: "basis",
    roles: [role],
    target: targetFor(category, role),
    frequency: null,
    reasons: [],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  }
}

/**
 * Runs the canonical scanner verdict builder for every applicable product role and thickness.
 * This is the single readiness oracle used by catalog coverage exports; exporters only select
 * product rows and persist the result.
 */
export async function evaluateScanCatalogReadiness(input: {
  category: PersonalPlanCategory
  productId: string
  loadFacts: LoadScanCatalogFacts
}): Promise<ScanCatalogReadinessResult> {
  const verdicts: ScanCatalogReadinessVerdict[] = []
  let factsPresent = true
  let protocolsComplete = true
  let roles: PlanProductRole[] = [PRIMARY_ROLE[input.category]]
  try {
    const primary = await input.loadFacts(
      input.category,
      input.productId,
      selectionFor(input.category, roles[0]!, "normal"),
    )
    if (!primary) factsPresent = false
    else roles = scanReadinessRoles(primary)
  } catch {
    factsPresent = false
  }
  for (const role of roles)
    for (const profile of ["fine", "normal", "coarse"] as const) {
      try {
        const facts = await input.loadFacts(
          input.category,
          input.productId,
          selectionFor(input.category, role, profile),
        )
        if (!facts) {
          factsPresent = false
          verdicts.push({ profile, role, verdict: "error" })
          continue
        }
        if (
          facts.protocols.some(
            (protocol) => protocol.role === role && protocol.status !== "verified_complete",
          )
        )
          protocolsComplete = false
        const result = buildScanVerdict({
          category: input.category,
          decision: decisionFor(input.category, role),
          productFacts: facts,
          recommendationCandidates: [facts],
          coverage: [],
          hairThickness: profile,
          heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
          refinedVersionId: "scanner-readiness-v1",
          refinedInputHash: "scanner-readiness-v1",
        })
        verdicts.push({
          profile,
          role,
          verdict: result.kind === "in_catalog" ? result.verdict : "unknown",
        })
      } catch {
        verdicts.push({ profile, role, verdict: "error" })
      }
    }
  return { factsPresent, protocolsComplete, verdicts }
}
