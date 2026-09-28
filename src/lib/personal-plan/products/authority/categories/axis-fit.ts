import type { PlanCareDirection, PlanRepairSupportLevel } from "@/lib/personal-plan/types"

export type AxisFitResult = "pass" | "caution" | "fail"

export function orderedAxisFitResult<T extends string>(
  product: T,
  target: T,
  values: readonly T[],
): AxisFitResult {
  if (product === target) return "pass"
  const distance = Math.abs(values.indexOf(product) - values.indexOf(target))
  return distance === 1 ? "caution" : "fail"
}

export function careDirectionAxisFitResult(product: string, target: string): AxisFitResult {
  if (product === target) return "pass"
  return product === "balanced" || target === "balanced" ? "caution" : "fail"
}

/**
 * R12: the care directions an intensive mask may carry for a confirmed mask target, primary
 * (the target itself) first. High repair support additionally accepts Protein; nothing else
 * widens the set. Single source of truth for the mask authority and the comparison target.
 */
export function maskAcceptedCareDirections(target: {
  careDirection: PlanCareDirection
  repairSupportLevel: PlanRepairSupportLevel
}): PlanCareDirection[] {
  if (target.repairSupportLevel === "high" && target.careDirection !== "protein")
    return [target.careDirection, "protein"]
  return [target.careDirection]
}

/** Mask care direction mirrors the conditioner axis, but a deviation stays a caution for the mask role. */
export function maskCareDirectionFitResult(
  product: PlanCareDirection,
  target: { careDirection: PlanCareDirection; repairSupportLevel: PlanRepairSupportLevel },
): Exclude<AxisFitResult, "fail"> {
  return maskAcceptedCareDirections(target).includes(product) ? "pass" : "caution"
}

export function repairSupportAxisFitResult<T extends string>(
  product: T,
  target: T,
  values: readonly T[],
): AxisFitResult {
  if (product === target) return "pass"
  const productIndex = values.indexOf(product)
  const targetIndex = values.indexOf(target)
  if (productIndex < 0 || targetIndex < 0) return "fail"
  if (productIndex > targetIndex) return "caution"
  return targetIndex - productIndex === 1 ? "caution" : "fail"
}
