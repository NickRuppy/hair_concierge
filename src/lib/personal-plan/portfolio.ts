import type {
  PlanCategoryDecision,
  PlanNeedTier,
  PlanPortfolioCoverageFact,
  PlanProfile,
} from "./types"
import { normalizeReasonSalience } from "./reasons"

const TIER_RANK: Record<PlanNeedTier, number> = {
  not_needed: 0,
  optional: 1,
  basis: 2,
}

function decisionFor(
  decisions: readonly PlanCategoryDecision[],
  category: PlanCategoryDecision["category"],
) {
  return decisions.find((decision) => decision.category === category)
}

function included(decision: PlanCategoryDecision | undefined) {
  return decision?.needTier === "basis" || decision?.needTier === "optional"
}

function strongestTier(tiers: readonly PlanNeedTier[]): PlanNeedTier {
  return tiers.reduce<PlanNeedTier>(
    (strongest, tier) => (TIER_RANK[tier] > TIER_RANK[strongest] ? tier : strongest),
    "not_needed",
  )
}

function arbitrateDampSmoothing(
  profile: PlanProfile,
  decisions: readonly PlanCategoryDecision[],
): PlanCategoryDecision[] {
  if (profile.hair.texture === "coily") return [...decisions]

  const leaveIn = decisionFor(decisions, "leave_in")
  const oil = decisionFor(decisions, "oil")
  if (leaveIn?.needTier !== "basis" || oil?.target?.category !== "oil") return [...decisions]

  const dampRole = oil.target.roleTargets.find(
    (roleTarget) => roleTarget.role === "leave_on_fibre_conditioning",
  )
  if (dampRole?.tier !== "basis") return [...decisions]

  const roleTargets = oil.target.roleTargets.map((roleTarget) =>
    roleTarget.role === "leave_on_fibre_conditioning"
      ? { ...roleTarget, tier: "optional" as const }
      : roleTarget,
  )
  const frequency =
    oil.frequency?.kind === "role_based_wash_linked"
      ? {
          ...oil.frequency,
          roleFrequencies: oil.frequency.roleFrequencies.map((roleFrequency) =>
            roleFrequency.role === "leave_on_fibre_conditioning"
              ? { ...roleFrequency, tier: "optional" as const }
              : roleFrequency,
          ),
        }
      : oil.frequency
  const nextOil: PlanCategoryDecision = {
    ...oil,
    needTier: strongestTier(roleTargets.map((roleTarget) => roleTarget.tier)),
    target: { ...oil.target, roleTargets },
    frequency,
  }

  return decisions.map((decision) => (decision.category === "oil" ? nextOil : decision))
}

function coverageFacts(
  profile: PlanProfile,
  decisions: readonly PlanCategoryDecision[],
): PlanPortfolioCoverageFact[] {
  const conditioner = decisionFor(decisions, "conditioner")
  const leaveIn = decisionFor(decisions, "leave_in")
  const oil = decisionFor(decisions, "oil")
  const mask = decisionFor(decisions, "mask")
  const bondbuilder = decisionFor(decisions, "bondbuilder")
  const deepCleansing = decisionFor(decisions, "deep_cleansing_shampoo")
  const dryShampoo = decisionFor(decisions, "dry_shampoo")
  const scalpCare = decisionFor(decisions, "scalp_care")
  const heat = decisionFor(decisions, "heat_protectant")
  const facts: PlanPortfolioCoverageFact[] = [
    {
      job: "wet_wash_cleansing",
      ruleId: "portfolio.cleansing.shampoo_owns_total",
      primaryCategories: ["shampoo"],
      supportingCategories: included(deepCleansing) ? ["deep_cleansing_shampoo"] : [],
      outcome: included(deepCleansing) ? "shared" : "owned",
    },
  ]

  if (included(dryShampoo)) {
    facts.push({
      job: "dry_shampoo_bridge",
      ruleId: "portfolio.cleansing.dry_bridge_preserves_wet_wash",
      primaryCategories: ["shampoo"],
      supportingCategories: ["dry_shampoo"],
      outcome: "shared",
    })
  }

  const scalpRoles = new Set(scalpCare?.roles ?? [])
  if (
    included(scalpCare) &&
    (scalpRoles.has("scalp_comfort") || scalpRoles.has("scalp_flake_oil_adjunct"))
  ) {
    facts.push({
      job: "scalp_flake_or_comfort",
      ruleId: "portfolio.scalp.shampoo_primary",
      primaryCategories: ["shampoo"],
      supportingCategories: ["scalp_care"],
      outcome: "duplicate_purchase_suppressed",
    })
  }
  if (included(deepCleansing) && scalpRoles.has("scalp_exfoliant")) {
    facts.push({
      job: "scalp_root_reset",
      ruleId: "portfolio.reset.deep_cleansing_primary",
      primaryCategories: ["deep_cleansing_shampoo"],
      supportingCategories: ["scalp_care"],
      outcome: "duplicate_purchase_suppressed",
    })
  }

  const repairCategories = [
    included(conditioner) ? "conditioner" : null,
    included(leaveIn) ? "leave_in" : null,
    included(mask) ? "mask" : null,
    included(bondbuilder) ? "bondbuilder" : null,
  ].filter(
    (category): category is "conditioner" | "leave_in" | "mask" | "bondbuilder" =>
      category !== null,
  )
  if (repairCategories.length > 1 && (included(mask) || included(bondbuilder))) {
    facts.push({
      job: "repair_support",
      ruleId: "portfolio.repair.distinct_roles_no_score_addition",
      primaryCategories: repairCategories.filter((category) => category !== "leave_in"),
      supportingCategories: repairCategories.includes("leave_in") ? ["leave_in"] : [],
      outcome: "shared",
    })
  }

  const oilDamp =
    oil?.target?.category === "oil"
      ? oil.target.roleTargets.find(
          (roleTarget) => roleTarget.role === "leave_on_fibre_conditioning",
        )
      : undefined
  if (leaveIn?.needTier === "basis" && oilDamp) {
    const coilyLayer = profile.hair.texture === "coily" && oilDamp.tier === "basis"
    facts.push({
      job: "damp_smoothing",
      ruleId: coilyLayer
        ? "portfolio.smoothing.coily_two_layer_exception"
        : "portfolio.smoothing.leave_in_primary",
      primaryCategories: coilyLayer ? ["leave_in", "oil"] : ["leave_in"],
      supportingCategories: coilyLayer ? [] : ["oil"],
      outcome: coilyLayer ? "shared" : "duplicate_purchase_suppressed",
    })
  }

  if (included(heat)) {
    facts.push({
      job: "heat_protection",
      ruleId: "portfolio.heat.carrier_allocation_deferred",
      primaryCategories: ["heat_protectant"],
      supportingCategories: [],
      outcome: "deferred_allocation",
    })
  }

  if (included(conditioner) && included(leaveIn)) {
    facts.push({
      job: "rinse_out_conditioning",
      ruleId: "portfolio.conditioner.baseline_retained",
      primaryCategories: ["conditioner"],
      supportingCategories: ["leave_in"],
      outcome: "owned",
    })
  }

  return facts
}

export function composeStage1Portfolio(
  profile: PlanProfile,
  localDecisions: readonly PlanCategoryDecision[],
) {
  const decisions = arbitrateDampSmoothing(profile, localDecisions).map((decision) => ({
    ...decision,
    reasons: normalizeReasonSalience(decision.reasons),
  }))
  return { decisions, coverage: coverageFacts(profile, decisions) }
}
