import { evaluateGateCriteria } from "../fit-criteria"
import type {
  Stage3AuthorityInput,
  Stage3CategoryAuthorityAdapter,
  Stage3ScalpCareFacts,
} from "../contracts"
import {
  commonUnknownFacts,
  criterion,
  hasValidTarget,
  isPendingIdentity,
  knownEvaluation,
  pendingEvaluation,
  protocolForRole,
  unknownEvaluation,
  unsupportedEvaluation,
} from "../shared"

type ScalpCareInput = Stage3AuthorityInput<"scalp_care">

function coverageSuppressesPurchase(input: ScalpCareInput): boolean {
  if (input.role !== "scalp_exfoliant") return false
  return input.coverage.some(
    (fact) =>
      fact.outcome === "duplicate_purchase_suppressed" &&
      fact.ruleId === "portfolio.reset.deep_cleansing_primary" &&
      fact.job === "scalp_root_reset",
  )
}

function productMissingFacts(input: ScalpCareInput, facts: Stage3ScalpCareFacts): string[] {
  const missing = commonUnknownFacts(input, { requiresSuitableThickness: false })
  if (facts.spec.primaryRole === null) missing.push("primary_role")
  if (facts.spec.presentationFormat === null || facts.spec.presentationFormat === "unknown") {
    missing.push("presentation_format")
  }
  if (facts.spec.rinseMode === null) missing.push("rinse_mode")
  const protocol = protocolForRole(input)
  if (protocol?.status !== "verified_complete") missing.push("application_protocol")
  return [...new Set(missing)].sort()
}

function evaluateFacts(input: ScalpCareInput, facts: Stage3ScalpCareFacts) {
  const missing = productMissingFacts({ ...input, productFacts: facts }, facts)
  const criteria =
    missing.length > 0
      ? [
          criterion(
            "scalp_care.protocol.readiness",
            "Verifizierte Anwendung",
            "unknown",
            "Rolle, Format, Ausspülart und sicherheitskritische Anwendungshinweise müssen vollständig verifiziert sein.",
          ),
        ]
      : []
  if (facts.spec.primaryRole !== null)
    criteria.push(
      criterion(
        "scalp_care.role.exact_match",
        "Exakte Kopfhautpflege-Rolle",
        facts.spec.primaryRole === input.role ? "pass" : "fail",
        facts.spec.primaryRole === input.role
          ? "Die Rolle ist verifiziert."
          : "Die verifizierte Produktrolle deckt diese Planrolle nicht ab.",
      ),
    )
  if (missing.length === 0 && facts.spec.primaryRole === input.role)
    criteria.push(
      criterion(
        "scalp_care.format.verified",
        "Verifiziertes Format",
        "pass",
        "Das Produktformat ist geprüft.",
      ),
      criterion(
        "scalp_care.rinse_mode.verified",
        "Verifizierte Ausspülart",
        "pass",
        "Die Ausspülart ist geprüft.",
      ),
      criterion(
        "scalp_care.protocol.verified",
        "Verifizierte Anwendung",
        "pass",
        "Das Rollenprotokoll ist vollständig geprüft.",
      ),
    )
  return evaluateGateCriteria(input, facts, criteria, missing)
}

function recommendationFor(input: ScalpCareInput) {
  if (coverageSuppressesPurchase(input)) return null
  const candidate = [...input.recommendationCandidates]
    .filter((facts) => evaluateFacts(input, facts).verdict === "ideal")
    .sort((left, right) => left.productId.localeCompare(right.productId))[0]
  if (!candidate) return null

  return {
    recommendationId: `stage3:${input.subjectKey}:${candidate.productId}`,
    productId: candidate.productId,
    category: "scalp_care" as const,
    role: input.role,
    displayName: candidate.displayName,
    reason: "Verifizierte Rolle, Format, Ausspülart und Anwendungshinweise passen.",
    authorityRuleId: "scalp_care.selection.verified_role_protocol",
  }
}

export const evaluateScalpCareAuthority: Stage3CategoryAuthorityAdapter<"scalp_care"> = (input) => {
  if (isPendingIdentity(input as never)) return pendingEvaluation(input as never)
  if (!hasValidTarget(input as never)) {
    return unsupportedEvaluation(input as never, "scalp_care_target_unavailable")
  }

  const facts = input.productFacts
  if (!facts) {
    const purchaseSuppressed = coverageSuppressesPurchase(input)
    const recommendation = recommendationFor(input)
    if (input.capturedProductId) return unknownEvaluation(input as never, ["catalog_product_facts"])
    return knownEvaluation(input as never, {
      verdict: "unknown",
      criteria: [
        criterion(
          "scalp_care.selection.uncovered_role",
          "Offene Kopfhautpflege-Rolle",
          "caution",
          purchaseSuppressed
            ? "Die Tiefenreinigung deckt diese Reset-Rolle bereits ab; deshalb empfehlen wir kein zusätzliches Kopfhaut-Peeling."
            : recommendation
              ? "Eine verifizierte, empfehlbare Option ist verfügbar."
              : "Keine verifizierte, empfehlbare Option ist verfügbar.",
        ),
      ],
      allowedActions: recommendation
        ? ["plan_recommendation", "leave_uncovered"]
        : ["leave_uncovered"],
      recommendation,
      productFactFingerprint: null,
      recommendationFactFingerprint: recommendation
        ? (input.recommendationCandidates.find(
            (candidate) => candidate.productId === recommendation.productId,
          )?.factFingerprint ?? null)
        : null,
    })
  }

  const result = evaluateFacts(input, facts)
  if (result.verdict === "unknown") return unknownEvaluation(input, result.missing, result.criteria)
  const recommendation = result.verdict === "mismatch" ? recommendationFor(input) : null
  return knownEvaluation(input, {
    verdict: result.verdict,
    criteria: result.criteria,
    allowedActions:
      result.verdict === "mismatch"
        ? recommendation
          ? ["acknowledge_override", "plan_recommendation", "leave_uncovered"]
          : ["acknowledge_override", "leave_uncovered"]
        : ["keep_owned"],
    recommendation,
    productFactFingerprint: facts.factFingerprint,
    recommendationFactFingerprint: recommendation
      ? (input.recommendationCandidates.find(
          (candidate) => candidate.productId === recommendation.productId,
        )?.factFingerprint ?? null)
      : null,
  })
}
