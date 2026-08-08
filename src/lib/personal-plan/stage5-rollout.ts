import "server-only"

export type PersonalPlanStage5Rollout = "off" | "internal" | "all"

export type PersonalPlanStage5RolloutEligibility = {
  rollout: PersonalPlanStage5Rollout
  isEligiblePersonalPlanOwner: boolean
  /**
   * The page adapter must source this only from the existing server-side
   * admin/internal profile signal (currently `profiles.is_admin`).
   */
  isInternal: boolean
}

const ROLLOUT_VALUES = new Set<PersonalPlanStage5Rollout>(["off", "internal", "all"])

export function parsePersonalPlanStage5Rollout(
  value: string | undefined,
): PersonalPlanStage5Rollout {
  return ROLLOUT_VALUES.has(value as PersonalPlanStage5Rollout)
    ? (value as PersonalPlanStage5Rollout)
    : "off"
}

export function resolvePersonalPlanStage5Rollout(environment?: {
  PERSONAL_PLAN_STAGE5_ROLLOUT?: string
}): PersonalPlanStage5Rollout {
  return parsePersonalPlanStage5Rollout(
    environment?.PERSONAL_PLAN_STAGE5_ROLLOUT ?? process.env.PERSONAL_PLAN_STAGE5_ROLLOUT,
  )
}

export function canAccessPersonalPlanStage5({
  rollout,
  isEligiblePersonalPlanOwner,
  isInternal,
}: PersonalPlanStage5RolloutEligibility): boolean {
  if (!isEligiblePersonalPlanOwner || rollout === "off") return false

  return rollout === "all" || isInternal
}
