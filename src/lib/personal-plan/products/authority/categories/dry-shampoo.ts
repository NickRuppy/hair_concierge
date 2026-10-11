import type { Stage3CriterionResult } from "../../contracts"
import { compareRankableCandidates, type RankableCandidate } from "../../candidate-ranking"
import { candidateDimensionCoverage } from "../../comparison-dimensions"
import type {
  Stage3AuthorityInput,
  Stage3CategoryAuthorityAdapter,
  Stage3DryShampooFacts,
} from "../contracts"
import type { Stage3VisibleHairColor } from "../selection-profile"
import {
  criterion,
  hasValidTarget,
  isPendingIdentity,
  knownEvaluation,
  pendingEvaluation,
  unknownEvaluation,
  unsupportedEvaluation,
} from "../shared"

type DryShampooInput = Stage3AuthorityInput<"dry_shampoo">

type FactsEvaluation =
  | { verdict: "ideal" | "supportive" | "mismatch"; criteria: Stage3CriterionResult[] }
  | { verdict: "unknown"; criteria: Stage3CriterionResult[]; missing: string[] }

const TINT_FOR_COLOR: Record<Stage3VisibleHairColor, string> = {
  light_blonde: "blonde_light",
  brown: "brown",
  dark: "dark",
}

/**
 * Q1 (pending with Nick, plan §8): the confirmed dry-shampoo rule. A colourless (`universal`)
 * product fits every root colour fully; a tinted product fits fully only when its tint matches the
 * user's answered root colour. A matching tint is NOT an extra fulfilled need (option A), so
 * universal and matching tinted products tie and catalogue order decides. Switching to option B
 * changes only this function and its pinned test.
 */
export function dryShampooTintFit(
  hairColorFit: string,
  visibleHairColor: Stage3VisibleHairColor | null,
): "pass" | "caution" {
  if (hairColorFit === "universal") return "pass"
  return visibleHairColor !== null && TINT_FOR_COLOR[visibleHairColor] === hairColorFit
    ? "pass"
    : "caution"
}

function missingFacts(facts: Stage3DryShampooFacts, role: DryShampooInput["role"]): string[] {
  const missing: string[] = []
  if (facts.knownReaction === null) missing.push("known_reaction")
  if (facts.spec.primaryEffect === null) missing.push("styling_effect")
  if (facts.spec.hairColorFit === null) missing.push("hair_color_fit")
  if (facts.spec.scalpSensitivityFit === null) missing.push("scalp_sensitivity_fit")
  if (facts.spec.format === null) missing.push("format")
  const protocol = facts.protocols.find((candidate) => candidate.role === role)
  if (protocol?.status !== "verified_complete") missing.push("application_protocol")
  return [...new Set(missing)].sort()
}

function sensitivityCriterion(input: DryShampooInput, facts: Stage3DryShampooFacts) {
  if (!input.selectionProfile.sensitiveScalp) {
    return criterion(
      "dry_shampoo.sensitivity.verified",
      "Kopfhautverträglichkeit",
      "pass",
      "Deine Kopfhaut braucht keine besonders milde Formel.",
    )
  }
  return facts.spec.scalpSensitivityFit === "sensitive_ok"
    ? criterion(
        "dry_shampoo.sensitivity.verified",
        "Kopfhautverträglichkeit",
        "pass",
        "Ausdrücklich für empfindliche Kopfhaut gedacht.",
      )
    : criterion(
        "dry_shampoo.sensitivity.verified",
        "Kopfhautverträglichkeit",
        "caution",
        "Nicht für empfindliche Kopfhaut ausgelobt.",
      )
}

function tintCriterion(input: DryShampooInput, facts: Stage3DryShampooFacts) {
  const color = input.selectionProfile.visibleHairColor
  const hairColorFit = facts.spec.hairColorFit as string
  const result = dryShampooTintFit(hairColorFit, color)
  const explanation =
    hairColorFit === "universal"
      ? "Farblos – passt zu jeder Haarfarbe."
      : result === "pass"
        ? "Die Tönung passt zu deiner Ansatzfarbe."
        : color === null
          ? "Getöntes Produkt – deine Ansatzfarbe ist noch nicht bekannt."
          : "Die Tönung passt nicht zu deiner Ansatzfarbe."
  return criterion("dry_shampoo.tint.verified", "Farbpassung", result, explanation)
}

function stylingCriterion(input: DryShampooInput, facts: Stage3DryShampooFacts) {
  const direction = input.selectionProfile.volumeDirection
  // Legacy `sensitive_refresh` is a standard refresh until the schema cutover; sensitivity comes
  // only from `scalp_sensitivity_fit`.
  const addsVolume = facts.spec.primaryEffect === "volume_texture"
  if (direction === null) {
    return criterion(
      "dry_shampoo.styling.direction",
      "Volumen",
      "pass",
      "Kein Volumenziel angegeben.",
    )
  }
  if (direction === "more") {
    return addsVolume
      ? criterion("dry_shampoo.styling.direction", "Volumen", "pass", "Gibt zusätzliches Volumen.")
      : criterion(
          "dry_shampoo.styling.direction",
          "Volumen",
          "caution",
          "Frischt auf, gibt aber kein zusätzliches Volumen.",
        )
  }
  return addsVolume
    ? criterion(
        "dry_shampoo.styling.direction",
        "Volumen",
        "caution",
        "Gibt zusätzliches Volumen – du möchtest eher weniger.",
      )
    : criterion(
        "dry_shampoo.styling.direction",
        "Volumen",
        "pass",
        "Frischt auf, ohne aufzubauschen.",
      )
}

/** The single dry-shampoo fit evaluation, for the owned product and for every candidate alike. */
function evaluateFacts(input: DryShampooInput, facts: Stage3DryShampooFacts): FactsEvaluation {
  if (!facts.isActive || facts.lifecycleStatus !== "active" || facts.knownReaction === true) {
    return {
      verdict: "mismatch",
      criteria: [
        criterion(
          "dry_shampoo.identity.active",
          "Aktive, verträgliche Produktidentität",
          "fail",
          "Das Produkt ist nicht als aktive, verträgliche Trockenshampoo-Option verfügbar.",
        ),
      ],
    }
  }
  const missing = missingFacts(facts, input.role)
  if (missing.length > 0) {
    return {
      verdict: "unknown",
      missing,
      criteria: [
        criterion(
          "dry_shampoo.fit.verified_facts",
          "Verifizierte Trockenshampoo-Fakten",
          "unknown",
          "Auffrischung, Farbpassung, Kopfhautsensitivität, Format und Anwendung müssen geprüft sein.",
        ),
      ],
    }
  }
  const criteria = [
    criterion(
      "dry_shampoo.identity.active",
      "Aktive Produktidentität",
      "pass",
      "Das Produkt ist aktiv und verträglich.",
    ),
    sensitivityCriterion(input, facts),
    tintCriterion(input, facts),
    stylingCriterion(input, facts),
    criterion(
      "dry_shampoo.format.verified",
      "Verifiziertes Format",
      "pass",
      "Das Format ist geprüft.",
    ),
    criterion(
      "dry_shampoo.protocol.verified",
      "Verifizierte Anwendung",
      "pass",
      "Das Anwendungsprotokoll ist vollständig geprüft.",
    ),
  ]
  return {
    verdict: criteria.some((entry) => entry.result === "caution") ? "supportive" : "ideal",
    criteria,
  }
}

/** Shared Stage-3 comparator over every rankable (ideal or supportive) recommendable candidate. */
function recommendationFor(input: DryShampooInput) {
  const selected = input.recommendationCandidates
    .filter((facts) => facts.recommendable)
    .map((facts) => ({ facts, result: evaluateFacts(input, facts) }))
    .flatMap(({ facts, result }) =>
      result.verdict === "ideal" || result.verdict === "supportive"
        ? [
            {
              facts,
              rank: {
                verdict: result.verdict,
                targetMatchCount: candidateDimensionCoverage(input as never, facts, result.criteria)
                  .matches,
                cautionCount: result.criteria.filter((entry) => entry.result === "caution").length,
                catalogSortOrder: facts.catalogSortOrder,
                priceEur: facts.priceEur ?? null,
                productId: facts.productId,
              } satisfies RankableCandidate,
            },
          ]
        : [],
    )
    .sort((left, right) => compareRankableCandidates(left.rank, right.rank))[0]?.facts
  if (!selected) return null

  return {
    recommendation: {
      recommendationId: `stage3:${input.subjectKey}:${selected.productId}`,
      productId: selected.productId,
      category: "dry_shampoo" as const,
      role: input.role,
      displayName: selected.displayName,
      reason: "Passt am besten zu Kopfhaut, Ansatzfarbe und Volumenziel.",
      authorityRuleId: "dry_shampoo.selection.shared_rank",
    },
    factFingerprint: selected.factFingerprint,
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
    if (input.capturedProductId) return unknownEvaluation(input as never, ["catalog_product_facts"])
    const selected = recommendationFor(input)
    return knownEvaluation(input as never, {
      verdict: "unknown",
      criteria: [
        criterion(
          "dry_shampoo.selection.uncovered_role",
          "Offene Ansatzauffrischung",
          "caution",
          selected
            ? "Eine verifizierte, empfehlbare Option ist verfügbar."
            : "Keine verifizierte, empfehlbare Option ist verfügbar.",
        ),
      ],
      allowedActions: selected ? ["plan_recommendation", "leave_uncovered"] : ["leave_uncovered"],
      recommendation: selected?.recommendation ?? null,
      productFactFingerprint: null,
      recommendationFactFingerprint: selected?.factFingerprint ?? null,
    })
  }

  const result = evaluateFacts(input, facts)
  if (result.verdict === "mismatch") {
    const selected = recommendationFor(input)
    return knownEvaluation(input as never, {
      verdict: "mismatch",
      criteria: result.criteria,
      allowedActions: ["acknowledge_override", "leave_uncovered"],
      recommendation: selected?.recommendation ?? null,
      productFactFingerprint: facts.factFingerprint,
      recommendationFactFingerprint: selected?.factFingerprint ?? null,
    })
  }
  if (result.verdict === "unknown") {
    return unknownEvaluation(input as never, result.missing, result.criteria)
  }
  return knownEvaluation(input as never, {
    verdict: result.verdict,
    criteria: result.criteria,
    allowedActions: result.verdict === "ideal" ? ["keep_owned"] : ["keep_owned", "leave_uncovered"],
    recommendation: null,
    productFactFingerprint: facts.factFingerprint,
    recommendationFactFingerprint: null,
  })
}
