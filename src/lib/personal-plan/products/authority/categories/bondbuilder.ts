import { BOND_TECHNOLOGY_FAMILIES } from "@/lib/bondbuilder-research/contracts"
import { evaluateGateCriteria } from "../fit-criteria"
import type { PlanProductRole } from "@/lib/personal-plan/types"

import type { Stage3CriterionResult } from "../../contracts"
import type {
  Stage3AuthorityEvaluation,
  Stage3AuthorityInput,
  Stage3BondbuilderFacts,
} from "../contracts"
import {
  commonUnknownFacts,
  criterion,
  hasValidTarget,
  isPendingIdentity,
  knownEvaluation,
  unknownEvaluation,
  unsupportedEvaluation,
} from "../shared"

// Retained as a product identifier for existing consumers; no selection preference.
// Spec §6, ruled 2026-10-12: equal trust ranks by price, not a house default.
export const BONDBUILDER_TIE_DEFAULT_PRODUCT_ID = "38dace91-0fba-49ee-a93f-ac36e488fe4b"

const BONDBUILDER_TRUST_RANKS: Readonly<Record<string, number>> = { high: 0, medium: 1, low: 2 }

/**
 * Nick's ranking rule (2026-10-09): Bondbuilders rank by the researched claim trust level
 * (high > medium > low > none). Lower is better; an unknown or missing level ranks last. The
 * repair axis (crosslink vs peptide) and the repair intensity never influence the ranking.
 */
export function bondbuilderTrustRank(level: string | null | undefined): number {
  return (level ? BONDBUILDER_TRUST_RANKS[level] : undefined) ?? 3
}

export function recommendationForBondbuilder(product: Stage3BondbuilderFacts) {
  return {
    recommendationId: `recommendation:bondbuilder:${product.productId}`,
    productId: product.productId,
    category: "bondbuilder" as const,
    role: "specialized_bond_treatment" as const,
    displayName: product.displayName,
    reason: "Erfüllt die eigenständige Bondbuilder-Rolle mit verifiziertem Protokoll.",
    authorityRuleId: "bondbuilder.stage3.validated_standalone",
  }
}

/** Spec §6, ruled 2026-10-12; the 2026-10-09 trust-tie rule. */
export function compareBondbuilderCandidates(
  left: Stage3BondbuilderFacts,
  right: Stage3BondbuilderFacts,
): number {
  return (
    bondbuilderTrustRank(left.spec.claimTrustLevel) -
      bondbuilderTrustRank(right.spec.claimTrustLevel) ||
    (left.priceEur ?? Number.MAX_SAFE_INTEGER) - (right.priceEur ?? Number.MAX_SAFE_INTEGER) ||
    (left.catalogSortOrder ?? Number.MAX_SAFE_INTEGER) -
      (right.catalogSortOrder ?? Number.MAX_SAFE_INTEGER) ||
    left.productId.localeCompare(right.productId)
  )
}

/**
 * Single source of truth for the verified-application state. Authority uses it as the
 * `bondbuilder.protocol` criterion.
 */
export function bondbuilderApplicationVerified(
  product: Stage3BondbuilderFacts,
  role: PlanProductRole,
): boolean {
  const protocol = product.protocols.find((entry) => entry.role === role)
  return (
    protocol?.status === "verified_complete" &&
    product.spec.applicationMode !== null &&
    product.spec.treatmentMode !== null &&
    product.spec.usageProtocol !== null
  )
}

function evaluateProduct(
  input: Stage3AuthorityInput<"bondbuilder">,
  product: Stage3BondbuilderFacts,
) {
  const criteria: Stage3CriterionResult[] = []
  if (product.knownReaction)
    criteria.push(
      criterion(
        "bondbuilder.safety",
        "Verträglichkeit",
        "fail",
        "Eine bekannte Reaktion verhindert die Empfehlung.",
      ),
    )
  // Nick's category rule (2026-10-06), not inferred producer fit evidence.
  criteria.push(
    criterion(
      "bondbuilder.thickness",
      "Haarstärke",
      "pass",
      "Bondbuilder sind für feines, normales und dickes Haar geeignet.",
    ),
  )
  if (
    !product.isActive ||
    !product.recommendable ||
    (product.lifecycleStatus !== null && product.lifecycleStatus !== "active")
  )
    criteria.push(
      criterion("bondbuilder.lifecycle", "Produktstatus", "fail", "Das Produkt ist nicht aktiv."),
    )
  if (product.spec.relationship === null)
    criteria.push(
      criterion(
        "bondbuilder.relationship",
        "Rollenbeziehung",
        "unknown",
        "Die Rollenbeziehung fehlt.",
      ),
    )
  else
    criteria.push(
      criterion(
        "bondbuilder.relationship",
        "Rollenbeziehung",
        product.spec.relationship === "standalone" ? "pass" : "fail",
        product.spec.relationship === "standalone"
          ? "Kann die spezialisierte Rolle eigenständig erfüllen."
          : "Ist nur ein ergänzendes Produkt und kann die Rolle nicht allein erfüllen.",
      ),
    )
  const protocolComplete = bondbuilderApplicationVerified(product, input.role)
  criteria.push(
    criterion(
      "bondbuilder.protocol",
      "Kritisches Protokoll",
      protocolComplete ? "pass" : "unknown",
      protocolComplete
        ? "Das genaue Kursprotokoll ist verifiziert."
        : "Anwendungsmodus, Behandlung oder Kursprotokoll ist nicht vollständig verifiziert.",
    ),
  )
  // Reviewed owner tiers, including low trust, are approved; owner_default is not.
  // Older catalog facts omit research metadata; their active/recommendable flags and
  // verified application remain the admission contract. Explicit null technology/owner
  // evidence stays unknown. Claim trust is a ranking input: missing ranks last, not ineligible.
  // Spec §2.5 / §6, ruled 2026-10-12; recommendation policy 2026-10-05.
  const family = product.spec.technologyFamily
  const basis = product.spec.trustBasis
  const trust = product.spec.claimTrustLevel
  const technologyOutcome =
    (family != null && !BOND_TECHNOLOGY_FAMILIES.includes(family as never)) ||
    (basis != null && basis !== "owner_anchor" && basis !== "owner_calibration") ||
    (trust != null && !["high", "medium", "low"].includes(trust)) ||
    (product.spec.researchProfile &&
      product.spec.researchProfile.assessment.boundary_status !== "in_scope")
      ? "fail"
      : family === null || basis === null
        ? "unknown"
        : "pass"
  criteria.push(
    criterion(
      "bondbuilder.technology",
      "Verifizierte Technologie",
      technologyOutcome,
      technologyOutcome === "pass"
        ? "Die Technologie ist geprüft und freigegeben."
        : "Die Technologie ist nicht freigegeben oder noch nicht geprüft.",
    ),
  )
  const commonMissing = commonUnknownFacts(
    { ...input, productFacts: product },
    { requiresSuitableThickness: false },
  )
  const missing = [...commonMissing]
  if (criteria.some((row) => row.result === "unknown")) missing.push("bondbuilder_fit_or_protocol")
  return evaluateGateCriteria(input, product, criteria, missing)
}

export function evaluateBondbuilderAuthority(
  input: Stage3AuthorityInput<"bondbuilder">,
): Stage3AuthorityEvaluation {
  const sharedInput = input as Stage3AuthorityInput
  if (!hasValidTarget(sharedInput))
    return unsupportedEvaluation(sharedInput, "bondbuilder_target_unavailable")
  if (isPendingIdentity(sharedInput))
    return {
      status: "pending",
      category: input.category,
      subjectKey: input.subjectKey,
      reason: "product_intake_pending",
      allowedActions: ["keep_pending", "leave_uncovered"],
      coverageRuleIds: [],
    }
  if (!input.productFacts && input.capturedProductId)
    return unknownEvaluation(sharedInput, ["catalog_product_facts"])
  if (!input.productFacts) {
    const ideal = input.recommendationCandidates
      .filter(
        (candidate) =>
          candidate.recommendable && candidate.isActive && candidate.lifecycleStatus === "active",
      )
      .filter((candidate) => evaluateProduct(input, candidate).verdict === "ideal")
    const selected = [...ideal].sort(compareBondbuilderCandidates)[0] ?? null
    const multiple =
      selected !== null &&
      ideal.filter(
        (candidate) =>
          bondbuilderTrustRank(candidate.spec.claimTrustLevel) ===
          bondbuilderTrustRank(selected.spec.claimTrustLevel),
      ).length > 1
    return knownEvaluation(sharedInput, {
      verdict: ideal.length === 0 ? "unknown" : "ideal",
      criteria: multiple
        ? [
            criterion(
              "bondbuilder.equal_shortlist",
              "Auswahl",
              "caution",
              "Mehrere gleich passende eigenständige Produkte brauchen eine Auswahl.",
            ),
          ]
        : [],
      allowedActions: selected ? ["plan_recommendation", "leave_uncovered"] : ["leave_uncovered"],
      recommendation: selected ? recommendationForBondbuilder(selected) : null,
      productFactFingerprint: null,
      recommendationFactFingerprint: selected?.factFingerprint ?? null,
    })
  }
  const assessment = evaluateProduct(input, input.productFacts)
  if (assessment.verdict === "unknown") {
    return unknownEvaluation(sharedInput, assessment.missing, assessment.criteria)
  }
  const replacement =
    assessment.verdict === "mismatch"
      ? evaluateBondbuilderAuthority({
          ...input,
          productFacts: null,
          capturedProductId: null,
          subjectIdentity: null,
        })
      : null
  const recommendation = replacement?.status === "known" ? replacement.recommendation : null
  return knownEvaluation(sharedInput, {
    verdict: assessment.verdict,
    criteria: assessment.criteria,
    allowedActions:
      assessment.verdict === "ideal"
        ? ["keep_owned"]
        : assessment.verdict === "mismatch"
          ? recommendation
            ? ["acknowledge_override", "plan_recommendation", "leave_uncovered"]
            : ["acknowledge_override", "leave_uncovered"]
          : ["keep_owned", "leave_uncovered"],
    recommendation,
    productFactFingerprint: input.productFacts.factFingerprint,
    recommendationFactFingerprint:
      replacement?.status === "known" ? replacement.recommendationFactFingerprint : null,
  })
}
