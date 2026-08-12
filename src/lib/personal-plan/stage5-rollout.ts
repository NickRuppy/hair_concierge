import "server-only"

export type PersonalPlanStage5Rollout = "off" | "internal" | "all"
export type PersonalPlanStage5ContractVersion = 1 | 2

export type PersonalPlanStage5RolloutEligibility = {
  rollout: PersonalPlanStage5Rollout
  isEligiblePersonalPlanOwner: boolean
  /**
   * The page adapter must source this from the shared server-owned Personal
   * Plan cohort decision (admin profile or confirmed exact email allowlist).
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

export function parsePersonalPlanStage5V2Enabled(value: string | undefined): boolean {
  return value === "true"
}

export function resolvePersonalPlanStage5ContractVersion(environment?: {
  PERSONAL_PLAN_STAGE5_V2_ENABLED?: string
}): PersonalPlanStage5ContractVersion {
  return parsePersonalPlanStage5V2Enabled(
    environment?.PERSONAL_PLAN_STAGE5_V2_ENABLED ?? process.env.PERSONAL_PLAN_STAGE5_V2_ENABLED,
  )
    ? 2
    : 1
}

export function canAccessPersonalPlanStage5({
  rollout,
  isEligiblePersonalPlanOwner,
  isInternal,
}: PersonalPlanStage5RolloutEligibility): boolean {
  if (!isEligiblePersonalPlanOwner || rollout === "off") return false

  return rollout === "all" || isInternal
}
