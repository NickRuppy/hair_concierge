import { evaluateGateCriteria } from "../fit-criteria"
import type { FitAxis } from "../fit-evaluator"
import type {
  Stage3AuthorityInput,
  Stage3CategoryAuthorityAdapter,
  Stage3DryShampooFacts,
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

type DryShampooInput = Stage3AuthorityInput<"dry_shampoo">

function productMissingFacts(input: DryShampooInput, facts: Stage3DryShampooFacts): string[] {
  const missing = commonUnknownFacts(input, { requiresSuitableThickness: false })
  if (facts.spec.primaryEffect === null) missing.push("styling_effect")
  if (facts.spec.hairColorFit === null) missing.push("hair_color_fit")
  if (facts.spec.scalpSensitivityFit === null) missing.push("scalp_sensitivity_fit")
  if (facts.spec.format === null) missing.push("format")
  if (protocolForRole(input)?.status !== "verified_complete") missing.push("application_protocol")
  return [...new Set(missing)].sort()
}

function evaluateFacts(input: DryShampooInput, facts: Stage3DryShampooFacts) {
  const missing = productMissingFacts({ ...input, productFacts: facts }, facts)
  const target = input.dryShampooTarget
  const sensitivity = facts.spec.scalpSensitivityFit
  const tint = facts.spec.hairColorFit
  const sensitivityMatch =
    sensitivity === "sensitive_ok"
      ? true
      : sensitivity === "normal_only" && target?.scalpSensitivity
        ? target.scalpSensitivity === "normal"
        : null
  const tintMatch =
    tint === "universal"
      ? true
      : tint && ["blonde_light", "brown", "dark"].includes(tint) && target?.hairColorFit
        ? tint === target.hairColorFit
        : null
  // Missing user targets leave an axis unscored. Product facts are still required above.
  const axes: FitAxis[] = []
  if (target?.scalpSensitivity != null)
    axes.push({
      id: "dry_shampoo.sensitivity.verified",
      label: "Kopfhautverträglichkeit",
      scale: ["match", "other"],
      targetValue: "match",
      productValues: sensitivityMatch === null ? null : [sensitivityMatch ? "match" : "other"],
      reason: () => "Die Sensitivitätspositionierung passt nur eingeschränkt zu deiner Kopfhaut.",
    })
  if (target?.hairColorFit != null)
    axes.push({
      id: "dry_shampoo.tint.verified",
      label: "Farbpassung",
      scale: ["match", "other"],
      targetValue: "match",
      productValues: tintMatch === null ? null : [tintMatch ? "match" : "other"],
      reason: () => "Die Tönung passt nur eingeschränkt zu deiner Haarfarbe.",
    })
  const criteria = [
    criterion(
      "dry_shampoo.identity.active",
      "Aktive Produktidentität",
      "pass",
      "Das Produkt ist aktiv und verträglich.",
    ),
    criterion(
      "dry_shampoo.sensitivity.verified",
      "Kopfhautverträglichkeit",
      "pass",
      "Die Sensitivitätspositionierung ist geprüft.",
    ),
    criterion("dry_shampoo.tint.verified", "Farbpassung", "pass", "Die Farbpassung ist geprüft."),
    criterion(
      "dry_shampoo.format.verified",
      "Verifiziertes Format",
      facts.spec.format === null ? "unknown" : "pass",
      "Das Format ist geprüft.",
    ),
    criterion(
      "dry_shampoo.protocol.verified",
      "Verifizierte Anwendung",
      protocolForRole({ ...input, productFacts: facts })?.status === "verified_complete"
        ? "pass"
        : "unknown",
      "Das Anwendungsprotokoll ist vollständig geprüft.",
    ),
  ]
  if (missing.length > 0)
    criteria.unshift(
      criterion(
        "dry_shampoo.fit.verified_facts",
        "Verifizierte Trockenshampoo-Fakten",
        "unknown",
        "Auffrischung, Farbpassung, Kopfhautsensitivität, Format und Anwendung müssen geprüft sein.",
      ),
    )
  return evaluateGateCriteria(input, facts, criteria, missing, axes)
}

function bestCandidate(input: DryShampooInput) {
  // Spec §§3–5, ruled 2026-10-12: verdict first; stable first-entered order inside it.
  const assessed = input.recommendationCandidates
    .filter((candidate) => candidate.recommendable)
    .map((candidate) => ({
      candidate,
      result: evaluateFacts(input, candidate),
    }))
  return (
    assessed.find((entry) => entry.result.verdict === "ideal") ??
    assessed.find((entry) => entry.result.verdict === "supportive") ??
    null
  )
}

function recommendationFor(input: DryShampooInput) {
  const best = bestCandidate(input)
  if (!best) return null
  const { candidate, result } = best
  return {
    recommendationId: `stage3:${input.subjectKey}:${candidate.productId}`,
    productId: candidate.productId,
    category: "dry_shampoo" as const,
    role: input.role,
    displayName: candidate.displayName,
    reason:
      result.verdict === "supportive"
        ? result.criteria.find((row) => row.result === "caution")!.explanation
        : "Verifizierte Auffrischungs-, Farb-, Kopfhaut- und Formatangaben liegen vor.",
    authorityRuleId: "dry_shampoo.selection.stable_first_entered_verified",
  }
}

export const evaluateDryShampooAuthority: Stage3CategoryAuthorityAdapter<"dry_shampoo"> = (
  input,
) => {
  if (isPendingIdentity(input as never)) return pendingEvaluation(input as never)
  if (!hasValidTarget(input as never)) {
    return unsupportedEvaluation(input as never, "dry_shampoo_target_unavailable")
  }

  const facts = input.productFacts
  if (!facts) {
    const recommendation = recommendationFor(input)
    if (input.capturedProductId) return unknownEvaluation(input as never, ["catalog_product_facts"])
    return knownEvaluation(input as never, {
      verdict: bestCandidate(input)?.result.verdict ?? "unknown",
      criteria: [
        criterion(
          "dry_shampoo.selection.uncovered_role",
          "Offene Ansatzauffrischung",
          "caution",
          recommendation
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
        : result.verdict === "supportive"
          ? ["keep_owned", "acknowledge_override", "leave_uncovered"]
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
