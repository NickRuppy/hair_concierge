import type { Stage3Recommendation } from "../contracts"
import { recommendationForMask } from "./categories/mask"
import { recommendationForSupportiveOil } from "./categories/oil"
import { recommendationForShampoo } from "./categories/shampoo"
import type {
  Stage3AuthorityInput,
  Stage3CategoryProductFacts,
  Stage3KnownAuthorityEvaluation,
} from "./contracts"

export function supportiveOwnedRecommendation(
  input: Stage3AuthorityInput,
  candidate: Stage3CategoryProductFacts,
  evaluation: Stage3KnownAuthorityEvaluation,
): Stage3Recommendation | null {
  if (
    input.productFacts === null ||
    evaluation.verdict !== "supportive" ||
    candidate.category !== input.category
  ) {
    return null
  }

  switch (candidate.category) {
    case "shampoo":
      return recommendationForShampoo(candidate, input as Stage3AuthorityInput<"shampoo">, true)
    case "mask":
      return recommendationForMask(
        candidate,
        true,
        evaluation.criteria.find((item) => item.result === "caution")?.explanation,
      )
    case "oil":
      return recommendationForSupportiveOil(candidate, input as Stage3AuthorityInput<"oil">)
    case "bondbuilder":
      return null // Spec §6, ruled 2026-10-12: Bondbuilder never has supportive candidates.
    default:
      return null
  }
}
