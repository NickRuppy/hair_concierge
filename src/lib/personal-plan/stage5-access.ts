import "server-only"

export const PERSONAL_PLAN_STAGE5_CONTRACT_VERSION = 2 as const
export type PersonalPlanStage5ContractVersion = 1 | 2

export function isPersonalPlanStage5UseCaseCoverageEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  return env.PERSONAL_PLAN_STAGE5_USE_CASE_COVERAGE_ENABLED === "true"
}

export function canAccessPersonalPlanStage5(input: {
  isEligiblePersonalPlanOwner: boolean
}): boolean {
  return input.isEligiblePersonalPlanOwner
}
