import type { PlanCategoryTarget, PlanProductRole } from "@/lib/personal-plan/types"
import {
  deriveShampooBucket,
  primaryShampooScalpRoute,
  shampooCleansingIntensity,
  type ShampooBucket,
} from "@/lib/shampoo/constants"

type ShampooTarget = Extract<PlanCategoryTarget, { category: "shampoo" }>

export function expectedShampooBucket(input: {
  role: PlanProductRole
  target: ShampooTarget
}): ShampooBucket | null {
  if (input.role === "shampoo_dandruff") {
    return deriveShampooBucket(null, "dandruff")
  }
  if (input.role !== "shampoo_everyday") return null

  const condition = input.target.everydayConstraint.includes("irritation")
    ? "irritated"
    : input.target.everydayConstraint.includes("dry_scalp")
      ? "dry_flakes"
      : null
  return deriveShampooBucket(input.target.scalpRoute, condition)
}

export function expectedShampooSpecTarget(input: { role: PlanProductRole; target: ShampooTarget }) {
  const shampooBucket = expectedShampooBucket(input)
  if (!shampooBucket) return null
  return {
    shampooBucket,
    scalpRoute: primaryShampooScalpRoute(shampooBucket),
    cleansingIntensity: shampooCleansingIntensity(shampooBucket),
  }
}

/** R19, ruled 2026-10-12: only the normal/balanced cell scores hair thickness. */
export function isScalpShampooTarget(input: {
  role: PlanProductRole
  target: PlanCategoryTarget | null
}): boolean {
  const expected =
    input.target?.category === "shampoo"
      ? expectedShampooSpecTarget({ role: input.role, target: input.target })
      : null
  return expected !== null && expected.shampooBucket !== "normal"
}
