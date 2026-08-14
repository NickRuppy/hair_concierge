import type { Stage3Recommendation } from "../contracts"
import { recommendationForBondbuilder } from "./categories/bondbuilder"
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
    input.candidateCatalogComplete !== true ||
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
      return recommendationForMask(candidate, true)
    case "oil":
      return recommendationForSupportiveOil(candidate, input as Stage3AuthorityInput<"oil">)
    case "bondbuilder":
      return recommendationForBondbuilder(candidate, true)
    default:
      return null
  }
}
