import type { FitAxis } from "../fit-evaluator"
import {
  commonFitGates,
  evaluateCriteria,
  THICKNESSES,
  thicknessReason,
  cleansingValue,
  directionalReason,
} from "../fit-criteria"
import type {
  Stage3AuthorityInput,
  Stage3CategoryAuthorityAdapter,
  Stage3ShampooFacts,
} from "../contracts"
import { candidateDimensionCoverage } from "../../comparison-dimensions"
import { compareRankableCandidates, type RankableCandidate } from "../../candidate-ranking"
import {
  criterion,
  hasValidTarget,
  isPendingIdentity,
  knownEvaluation,
  pendingEvaluation,
  unknownEvaluation,
  unsupportedEvaluation,
} from "../shared"
import { expectedShampooSpecTarget } from "./shampoo-spec-target"

export { expectedShampooBucket, expectedShampooSpecTarget } from "./shampoo-spec-target"

export function recommendationForShampoo(
  candidate: Stage3ShampooFacts,
  input: Stage3AuthorityInput<"shampoo">,
  supportive = false,
) {
  return {
    recommendationId: `recommend:${candidate.productId}:${input.role}`,
    productId: candidate.productId,
    category: "shampoo" as const,
    role: input.role,
    displayName: candidate.displayName,
    reason: supportive
      ? evaluateFacts(input, candidate).criteria.find((item) => item.result === "caution")!
          .explanation
      : "Passt zur erforderlichen Shampoo-Aufgabe.",
    authorityRuleId: supportive
      ? "shampoo.selection.verified_supportive_intensity"
      : "shampoo.selection.verified_role_fit",
  }
}

function evaluateFacts(input: Stage3AuthorityInput<"shampoo">, facts: Stage3ShampooFacts) {
  const target = input.categoryDecision.target
  const expected =
    target?.category === "shampoo" ? expectedShampooSpecTarget({ role: input.role, target }) : null
  const gates = commonFitGates(input, facts)
  gates.push(
    {
      id: "shampoo.role",
      label: "Reinigungsaufgabe",
      outcome:
        facts.spec.targetFit === "known_mismatch"
          ? "fail"
          : facts.spec.shampooBucket === null || !expected
            ? "unknown"
            : facts.spec.shampooBucket === expected.shampooBucket
              ? "pass"
              : "fail",
      reason: "Das Produkt deckt die erforderliche Shampoo-Aufgabe nicht ab.",
    },
    {
      id: "shampoo.scalp_route",
      label: "Kopfhautroute",
      outcome:
        facts.spec.scalpRoute === null || !expected
          ? "unknown"
          : facts.spec.scalpRoute === expected.scalpRoute
            ? "pass"
            : "fail",
      reason: "Die bestätigte Kopfhautroute passt nicht.",
    },
    {
      id: "shampoo.target_fit",
      label: "Shampoo-Passung",
      outcome: facts.spec.targetFit === "unknown" ? "unknown" : "pass",
    },
  )
  // fit-verdict spec §2, ruled 2026-10-12: dandruff with irritation requires gentle cleansing.
  if (
    input.role === "shampoo_dandruff" &&
    target?.category === "shampoo" &&
    target.everydayConstraint.includes("irritation")
  ) {
    gates.push({
      id: "shampoo.medical_exclusion",
      label: "Verträglichkeit",
      outcome:
        facts.spec.cleansingIntensity === null
          ? "unknown"
          : facts.spec.cleansingIntensity === "gentle"
            ? "pass"
            : "fail",
      reason: "Reinigt kräftiger als nötig",
    })
  }
  const axes: FitAxis[] = [
    {
      id: "shampoo.thickness",
      label: "Haardicke",
      scale: THICKNESSES,
      productValues:
        facts.spec.thicknesses === undefined
          ? facts.spec.thickness
            ? [facts.spec.thickness]
            : null
          : facts.spec.thicknesses,
      targetValue: input.hairThickness ?? null,
      reason: thicknessReason,
    },
    {
      id: "shampoo.cleansing_intensity",
      label: "Reinigungsintensität",
      scale: ["gentle", "regular", "strong"],
      productValues: facts.spec.cleansingIntensity
        ? [cleansingValue(facts.spec.cleansingIntensity)!]
        : null,
      targetValue: expected ? cleansingValue(expected.cleansingIntensity) : null,
      reason: directionalReason(
        ["gentle", "regular", "strong"],
        "Reinigt kräftiger als nötig",
        "Reinigt sanfter als nötig",
      ),
    },
  ]
  const result = evaluateCriteria(input, facts, gates, axes, {
    "shampoo.role": [
      ...(facts.spec.shampooBucket === null ? ["shampoo_bucket"] : []),
      ...(!expected ? ["shampoo_bucket_target", "shampoo_spec_target"] : []),
    ],
    "shampoo.scalp_route": facts.spec.scalpRoute === null ? ["scalp_route"] : [],
    "shampoo.cleansing_intensity":
      expected || facts.spec.cleansingIntensity === null ? ["cleansing_intensity"] : [],
    "shampoo.medical_exclusion": ["cleansing_intensity"],
  })
  if (result.verdict === "ideal" || result.verdict === "supportive")
    result.criteria.unshift(
      criterion(
        input.role === "shampoo_dandruff" ? "shampoo.fit" : "shampoo.role",
        input.role === "shampoo_dandruff" ? "Shampoo-Passung" : "Reinigungsaufgabe",
        "pass",
        "Das Produkt deckt die bestätigte Shampoo-Aufgabe ab.",
      ),
    )
  return result
}

function bestCandidate(input: Stage3AuthorityInput<"shampoo">) {
  const candidates = input.recommendationCandidates
    .filter((item) => item.recommendable)
    .map((item) => ({ item, result: evaluateFacts(input, item) }))
  const rankable = candidates
    .filter(
      (
        candidate,
      ): candidate is typeof candidate & { result: { verdict: "ideal" | "supportive" } } =>
        candidate.result.verdict === "ideal" || candidate.result.verdict === "supportive",
    )
    .map((candidate) => ({
      candidate,
      rank: {
        verdict: candidate.result.verdict,
        targetMatchCount: candidateDimensionCoverage(
          input as never,
          candidate.item,
          candidate.result.criteria,
        ).matches,
        cautionCount: candidate.result.criteria.filter((c) => c.result === "caution").length,
        catalogSortOrder: candidate.item.catalogSortOrder,
        priceEur: candidate.item.priceEur ?? null,
        productId: candidate.item.productId,
      } satisfies RankableCandidate,
    }))
    .sort((left, right) => compareRankableCandidates(left.rank, right.rank))
  return rankable[0]?.candidate
}

export const evaluateShampooAuthority: Stage3CategoryAuthorityAdapter<"shampoo"> = (
  input: Stage3AuthorityInput<"shampoo">,
) => {
  if (isPendingIdentity(input as never)) return pendingEvaluation(input as never)
  if (!hasValidTarget(input as never))
    return unsupportedEvaluation(input as never, "shampoo_target_unavailable")
  if (!input.productFacts) {
    if (input.capturedProductId) return unknownEvaluation(input as never, ["catalog_product_facts"])
    const selected = bestCandidate(input)
    if (!selected)
      return knownEvaluation(input as never, {
        verdict: "unknown",
        criteria: [],
        allowedActions: ["leave_uncovered"],
        recommendation: null,
        productFactFingerprint: null,
        recommendationFactFingerprint: null,
      })
    return knownEvaluation(input as never, {
      verdict: selected.result.verdict,
      criteria: selected.result.criteria,
      allowedActions: ["plan_recommendation", "leave_uncovered"],
      recommendation: recommendationForShampoo(
        selected.item,
        input,
        selected.result.verdict === "supportive",
      ),
      productFactFingerprint: null,
      recommendationFactFingerprint: selected.item.factFingerprint,
    })
  }

  const result = evaluateFacts(input, input.productFacts)
  if (result.verdict === "unknown")
    return unknownEvaluation(input as never, result.missing ?? [], result.criteria)
  const best = result.verdict === "mismatch" ? bestCandidate(input) : null
  return knownEvaluation(input as never, {
    verdict: result.verdict,
    criteria: result.criteria,
    allowedActions:
      result.verdict === "mismatch"
        ? best
          ? ["acknowledge_override", "plan_recommendation", "leave_uncovered"]
          : ["acknowledge_override", "leave_uncovered"]
        : result.verdict === "supportive"
          ? ["keep_owned", "leave_uncovered"]
          : ["keep_owned"],
    recommendation: best
      ? recommendationForShampoo(best.item, input, best.result.verdict === "supportive")
      : null,
    productFactFingerprint: input.productFacts.factFingerprint,
    recommendationFactFingerprint: best?.item.factFingerprint ?? null,
  })
}
