type PersonalPlanAppReleaseEnvironment = {
  [key: string]: string | undefined
  PERSONAL_PLAN_APP_V1_ENABLED?: string
  PERSONAL_PLAN_APP_V1_NEW_BUYER_CUTOFF?: string
  PERSONAL_PLAN_STAGE2_ENABLED?: string
  PERSONAL_PLAN_STAGE3_ENABLED?: string
  PERSONAL_PLAN_STAGE4_ENABLED?: string
}

export function isPersonalPlanStage2Enabled(
  environment: PersonalPlanAppReleaseEnvironment = process.env,
): boolean {
  return environment.PERSONAL_PLAN_STAGE2_ENABLED === "true"
}

export function isPersonalPlanStage3Enabled(
  environment: PersonalPlanAppReleaseEnvironment = process.env,
): boolean {
  return environment.PERSONAL_PLAN_STAGE3_ENABLED === "true"
}

export function isPersonalPlanStage4Enabled(
  environment: PersonalPlanAppReleaseEnvironment = process.env,
): boolean {
  return environment.PERSONAL_PLAN_STAGE4_ENABLED === "true"
}

const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

export function isPersonalPlanAppV1Enabled(
  environment: PersonalPlanAppReleaseEnvironment = process.env,
): boolean {
  return environment.PERSONAL_PLAN_APP_V1_ENABLED === "true"
}

export function getPersonalPlanNewBuyerCohortCutoff(
  environment: PersonalPlanAppReleaseEnvironment = process.env,
): Date | null {
  const value = environment.PERSONAL_PLAN_APP_V1_NEW_BUYER_CUTOFF?.trim()
  if (!value || !UTC_INSTANT.test(value)) return null

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null

  const canonical = parsed.toISOString()
  const comparableCanonical = value.includes(".") ? canonical : canonical.replace(".000Z", "Z")
  return comparableCanonical === value ? parsed : null
}
