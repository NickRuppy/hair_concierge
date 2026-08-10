type PersonalPlanStage3LabEnvironment = Partial<
  Pick<
    NodeJS.ProcessEnv,
    "CI" | "CI_PERSONAL_PLAN_STAGE3_LAB_ENABLED" | "NODE_ENV" | "VERCEL_ENV"
  >
>

/** Standalone fixture preview guard; production access is deliberately closed. */
export function isPersonalPlanStage3LabEnabled(
  environment: PersonalPlanStage3LabEnvironment,
): boolean {
  return (
    environment.NODE_ENV === "development" ||
    environment.VERCEL_ENV === "preview" ||
    (environment.CI === "true" && environment.CI_PERSONAL_PLAN_STAGE3_LAB_ENABLED === "true")
  )
}
