import type { Stage3AuthorityEvaluation, Stage3AuthorityInput } from "./contracts"
import { evaluateBondbuilderAuthority } from "./categories/bondbuilder"
import { evaluateConditionerAuthority } from "./categories/conditioner"
import { evaluateDeepCleansingAuthority } from "./categories/deep-cleansing-shampoo"
import { evaluateDryShampooAuthority } from "./categories/dry-shampoo"
import { evaluateHeatProtectantAuthority } from "./categories/heat-protectant"
import { evaluateLeaveInAuthority } from "./categories/leave-in"
import { evaluateMaskAuthority } from "./categories/mask"
import { evaluateOilAuthority } from "./categories/oil"
import { evaluateScalpCareAuthority } from "./categories/scalp-care"
import { evaluateShampooAuthority } from "./categories/shampoo"

export function evaluateStage3Authority(input: Stage3AuthorityInput): Stage3AuthorityEvaluation {
  switch (input.category) {
    case "shampoo":
      return evaluateShampooAuthority(input as never)
    case "conditioner":
      return evaluateConditionerAuthority(input as never)
    case "leave_in":
      return evaluateLeaveInAuthority(input as never)
    case "heat_protectant":
      return evaluateHeatProtectantAuthority(input as never)
    case "oil":
      return evaluateOilAuthority(input as never)
    case "mask":
      return evaluateMaskAuthority(input as never)
    case "scalp_care":
      return evaluateScalpCareAuthority(input as never)
    case "dry_shampoo":
      return evaluateDryShampooAuthority(input as never)
    case "bondbuilder":
      return evaluateBondbuilderAuthority(input as never)
    case "deep_cleansing_shampoo":
      return evaluateDeepCleansingAuthority(input as never)
  }
}
