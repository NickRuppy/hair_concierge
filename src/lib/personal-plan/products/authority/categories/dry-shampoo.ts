import {
  compareRankableCandidates,
  dryShampooVolumeRank,
  type RankableCandidate,
} from "../../candidate-ranking"
import { candidateDimensionCoverage } from "../../comparison-dimensions"
import type { Stage3VisibleHairColor } from "../selection-profile"
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

const TINT_FOR_COLOR: Record<Stage3VisibleHairColor, string> = {
  light_blonde: "blonde_light",
  brown: "brown",
  dark: "dark",
}

/**
 * Q1 = A (ruled by Nick): the confirmed dry-shampoo rule. A colourless (`universal`)
 * product fits every root colour fully; a tinted product fits fully only when its tint matches the
 * user's answered root colour. A matching tint is NOT an extra fulfilled need (option A), so
 * universal and matching tinted products tie and the shared comparator decides.
 * Nick 2026-10-13: unknown colour is unscored, including for tinted products.
 */
export function dryShampooTintFit(
  hairColorFit: string,
  visibleHairColor: Stage3VisibleHairColor | null,
): "pass" | "caution" {
  if (visibleHairColor === null || hairColorFit === "universal") return "pass"
  return TINT_FOR_COLOR[visibleHairColor] === hairColorFit ? "pass" : "caution"
}

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
  const { sensitiveScalp, visibleHairColor, volumeDirection: direction } = input.selectionProfile
  const sensitivity = facts.spec.scalpSensitivityFit
  const tint = facts.spec.hairColorFit
  const sensitivityMatch =
    sensitivity === null ? null : !sensitiveScalp || sensitivity === "sensitive_ok"
  const sensitivityExplanation = !sensitiveScalp
    ? "Deine Kopfhaut braucht keine besonders milde Formel."
    : sensitivityMatch
      ? "Ausdrücklich für empfindliche Kopfhaut gedacht."
      : "Nicht für empfindliche Kopfhaut ausgelobt."
  const tintMatch = tint === null ? null : dryShampooTintFit(tint, visibleHairColor) === "pass"
  const tintExplanation =
    tint === "universal"
      ? "Farblos – passt zu jeder Haarfarbe."
      : visibleHairColor === null
        ? "Getöntes Produkt – deine Ansatzfarbe ist noch nicht bekannt."
        : tintMatch
          ? "Die Tönung passt zu deiner Ansatzfarbe."
          : "Die Tönung passt nicht zu deiner Ansatzfarbe."
  // Legacy sensitive_refresh is a standard refresh; scalp fit comes from its own fact.
  const addsVolume = facts.spec.primaryEffect === "volume_texture"
  const volumeExplanation =
    direction === null
      ? "Kein Volumenziel angegeben."
      : direction === "more"
        ? addsVolume
          ? "Gibt zusätzliches Volumen."
          : "Frischt auf, gibt aber kein zusätzliches Volumen."
        : addsVolume
          ? "Gibt zusätzliches Volumen – du möchtest eher weniger."
          : "Frischt auf, ohne aufzubauschen."
  const axes: FitAxis[] = []
  if (sensitiveScalp)
    axes.push({
      id: "dry_shampoo.sensitivity.verified",
      label: "Kopfhautverträglichkeit",
      scale: ["match", "other"],
      targetValue: "match",
      productValues: sensitivityMatch === null ? null : [sensitivityMatch ? "match" : "other"],
      reason: () => sensitivityExplanation,
    })
  if (visibleHairColor !== null)
    axes.push({
      id: "dry_shampoo.tint.verified",
      label: "Farbpassung",
      scale: ["match", "other"],
      targetValue: "match",
      productValues: tintMatch === null ? null : [tintMatch ? "match" : "other"],
      reason: () => tintExplanation,
    })
  // Nick 2026-10-13: volume is ranking only, never a degree axis.
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
      sensitivityExplanation,
    ),
    criterion("dry_shampoo.tint.verified", "Farbpassung", "pass", tintExplanation),
    criterion("dry_shampoo.styling.direction", "Volumen", "pass", volumeExplanation),
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
  return (
    input.recommendationCandidates
      .filter((candidate) => candidate.recommendable)
      .map((candidate) => ({ candidate, result: evaluateFacts(input, candidate) }))
      .flatMap(({ candidate, result }) =>
        result.verdict === "ideal" || result.verdict === "supportive"
          ? [
              {
                candidate,
                result,
                rank: {
                  verdict: result.verdict,
                  targetMatchCount: candidateDimensionCoverage(
                    input as never,
                    candidate,
                    result.criteria,
                  ).matches,
                  cautionCount: result.criteria.filter((row) => row.result === "caution").length,
                  dryShampooVolumePreference: dryShampooVolumeRank(input, candidate),
                  catalogSortOrder: candidate.catalogSortOrder,
                  priceEur: candidate.priceEur ?? null,
                  productId: candidate.productId,
                } satisfies RankableCandidate,
              },
            ]
          : [],
      )
      .sort((left, right) => compareRankableCandidates(left.rank, right.rank))[0] ?? null
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
    authorityRuleId: "dry_shampoo.selection.shared_rank",
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
