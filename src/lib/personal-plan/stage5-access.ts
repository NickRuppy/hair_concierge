import "server-only"

export const PERSONAL_PLAN_STAGE5_CONTRACT_VERSION = 2 as const
export type PersonalPlanStage5ContractVersion = 1 | 2

export function canAccessPersonalPlanStage5(input: {
  isEligiblePersonalPlanOwner: boolean
}): boolean {
  return input.isEligiblePersonalPlanOwner
}
