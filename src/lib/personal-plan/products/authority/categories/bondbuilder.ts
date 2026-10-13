import type { BondbuilderTiming } from "@/lib/personal-plan/refinement/types"
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

// S4 owner ruling: K18 remains the house default within an equal trust/timing tie.
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

/** The house default within an equally trusted and equally timed shortlist. */
function tieDefaultRecommendationForBondbuilder(product: Stage3BondbuilderFacts) {
  return {
    ...recommendationForBondbuilder(product),
    reason: "Unsere Standardwahl, wenn mehrere Produkte gleich gut passen.",
    authorityRuleId: "bondbuilder.stage3.tie_default",
  }
}

/**
 * Q1 (S4 owner ruling): an equally trusted tie
 * without the K18 house default names the first product by catalogue order, then the lower price.
 * The other tied products stay visible as equal options (the shortlist caution stays).
 */
function tieOrderedRecommendationForBondbuilder(product: Stage3BondbuilderFacts) {
  return {
    ...recommendationForBondbuilder(product),
    reason: "Gleich gut passende Produkte; wir nennen das erste nach Katalogreihenfolge und Preis.",
    authorityRuleId: "bondbuilder.stage3.tie_ordered",
  }
}

/**
 * The stated timing cannot be met at the best trust level: the pick is the most trusted product,
 * used differently. The rule id carries requested and actual timing for the routine card line.
 */
function timingUnmetRecommendationForBondbuilder(
  product: Stage3BondbuilderFacts,
  timing: Exclude<BondbuilderTiming, "no_preference">,
) {
  return {
    ...recommendationForBondbuilder(product),
    reason: "Kein gleich vertrauenswürdiges Produkt passt zu deinem Zeitpunkt.",
    authorityRuleId: bondbuilderTimingUnmetRuleId(timing, bondbuilderTimingBucket(product.spec)),
  }
}

/** When a Bondbuilder is used, from the catalogue's `application_mode` (S4 plan §2.2). */
export type BondbuilderTimingBucket = "before_wash" | "after_wash" | "overnight"

export function bondbuilderTimingBucket(spec: {
  applicationMode: string | null
}): BondbuilderTimingBucket | null {
  switch (spec.applicationMode) {
    case "pre_shampoo":
      return "before_wash"
    case "post_wash_leave_in":
      return "after_wash"
    case "bedtime_leave_in":
      return "overnight"
    default:
      return null
  }
}

/** „Ist mir egal" matches every product; a stated timing only its exact bucket (overnight: none). */
export function bondbuilderMatchesTiming(
  bucket: BondbuilderTimingBucket | null,
  timing: BondbuilderTiming,
): boolean {
  return timing === "no_preference" || bucket === timing
}

export const BONDBUILDER_TIMING_UNMET_RULE_PREFIX = "bondbuilder.stage3.timing_unmet."

export function bondbuilderTimingUnmetRuleId(
  timing: Exclude<BondbuilderTiming, "no_preference">,
  actual: BondbuilderTimingBucket | null,
): string {
  return `${BONDBUILDER_TIMING_UNMET_RULE_PREFIX}${timing}.${actual ?? "unknown"}`
}

/** The timing the selection respects; absent (synthetic callers) means „Ist mir egal". */
export function bondbuilderTimingOf(input: Pick<Stage3AuthorityInput, "selectionProfile">) {
  return input.selectionProfile?.bondbuilderTiming ?? "no_preference"
}

/**
 * Q1 tie order among equally trusted, equally timed Bondbuilders: catalogue order, then the lower
 * price (unknown last), then the product id. One function so the ruling is pinned by one test.
 */
export function compareBondbuilderTieOrder(
  left: Pick<Stage3BondbuilderFacts, "catalogSortOrder" | "priceEur" | "productId">,
  right: Pick<Stage3BondbuilderFacts, "catalogSortOrder" | "priceEur" | "productId">,
): number {
  const order = (value: number | null | undefined) => value ?? Number.MAX_SAFE_INTEGER
  return (
    order(left.catalogSortOrder) - order(right.catalogSortOrder) ||
    order(left.priceEur) - order(right.priceEur) ||
    left.productId.localeCompare(right.productId)
  )
}

/**
 * An explicit user pick fulfils the preference by definition (she chose it): a `timing_unmet`
 * recommendation is persisted as `validated_standalone`, so the routine card never claims the
 * answer could not be met.
 */
export function explicitBondbuilderPickRecommendation<
  T extends { authorityRuleId: string; reason: string; category: string },
>(recommendation: T): T {
  if (
    recommendation.category !== "bondbuilder" ||
    !recommendation.authorityRuleId.startsWith(BONDBUILDER_TIMING_UNMET_RULE_PREFIX)
  )
    return recommendation
  return {
    ...recommendation,
    reason: "Erfüllt die eigenständige Bondbuilder-Rolle mit verifiziertem Protokoll.",
    authorityRuleId: "bondbuilder.stage3.validated_standalone",
  }
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

/**
 * The recommendation shortlist (S2 + X1, plan §2.3): ideal candidates → the most trusted level
 * (Nick, 2026-10-09) → those matching the stated timing, unless none does (then the whole most
 * trusted level, flagged `timingUnmet`). Timing never lifts a less trusted product. A tie picks K18
 * when it is in the pool, otherwise the Q1 order. Exported so equal options list exactly this tie.
 */
export function bondbuilderShortlist(input: Stage3AuthorityInput<"bondbuilder">): {
  ideal: Stage3BondbuilderFacts[]
  pool: Stage3BondbuilderFacts[]
  selected: Stage3BondbuilderFacts | null
  timingUnmet: boolean
} {
  const timing = bondbuilderTimingOf(input as Stage3AuthorityInput)
  const ideal = input.recommendationCandidates
    .filter(
      (candidate) =>
        candidate.recommendable && candidate.isActive && candidate.lifecycleStatus === "active",
    )
    .filter((candidate) => evaluateProduct(input, candidate).verdict === "ideal")
  const bestTrust = Math.min(
    ...ideal.map((candidate) => bondbuilderTrustRank(candidate.spec.claimTrustLevel)),
  )
  const mostTrusted = ideal.filter(
    (candidate) => bondbuilderTrustRank(candidate.spec.claimTrustLevel) === bestTrust,
  )
  const matching = mostTrusted.filter((candidate) =>
    bondbuilderMatchesTiming(bondbuilderTimingBucket(candidate.spec), timing),
  )
  const pool = matching.length > 0 ? matching : mostTrusted
  const selected =
    pool.length === 0
      ? null
      : pool.length === 1
        ? pool[0]!
        : (pool.find((candidate) => candidate.productId === BONDBUILDER_TIE_DEFAULT_PRODUCT_ID) ??
          [...pool].sort(compareBondbuilderTieOrder)[0]!)
  return {
    ideal,
    pool,
    selected,
    timingUnmet: timing !== "no_preference" && mostTrusted.length > 0 && matching.length === 0,
  }
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
    const { ideal, pool, selected, timingUnmet } = bondbuilderShortlist(input)
    const timing = bondbuilderTimingOf(input)
    const multiple = pool.length > 1
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
      recommendation: !selected
        ? null
        : timingUnmet && timing !== "no_preference"
          ? timingUnmetRecommendationForBondbuilder(selected, timing)
          : !multiple
            ? recommendationForBondbuilder(selected)
            : selected.productId === BONDBUILDER_TIE_DEFAULT_PRODUCT_ID
              ? tieDefaultRecommendationForBondbuilder(selected)
              : tieOrderedRecommendationForBondbuilder(selected),
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
