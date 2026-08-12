type PersonalPlanAppReleaseEnvironment = {
  [key: string]: string | undefined
  PERSONAL_PLAN_APP_V1_ENABLED?: string
  PERSONAL_PLAN_APP_V1_ROLLOUT?: string
  PERSONAL_PLAN_APP_V1_INTERNAL_EMAILS?: string
  PERSONAL_PLAN_APP_V1_NEW_BUYER_CUTOFF?: string
  PERSONAL_PLAN_LEGACY_QUIZ_CUTOVER_ENABLED?: string
  PERSONAL_PLAN_STAGE2_ENABLED?: string
  PERSONAL_PLAN_STAGE3_ENABLED?: string
  PERSONAL_PLAN_STAGE4_ENABLED?: string
  PERSONAL_PLAN_STAGE4_AUTO_ACTIVATE_INITIAL?: string
}

export type PersonalPlanAppV1Rollout = "off" | "internal" | "all"

const APP_ROLLOUT_VALUES = new Set<PersonalPlanAppV1Rollout>(["off", "internal", "all"])

export function resolvePersonalPlanAppV1Rollout(
  environment: PersonalPlanAppReleaseEnvironment = process.env,
): PersonalPlanAppV1Rollout {
  const configured = environment.PERSONAL_PLAN_APP_V1_ROLLOUT
  if (configured !== undefined) {
    return APP_ROLLOUT_VALUES.has(configured as PersonalPlanAppV1Rollout)
      ? (configured as PersonalPlanAppV1Rollout)
      : "off"
  }

  // Preserve the reviewed boolean release contract for existing test and
  // deployment environments that do not configure a cohort rollout yet.
  return environment.PERSONAL_PLAN_APP_V1_ENABLED === "true" ? "all" : "off"
}

export function canAccessPersonalPlanAppV1Rollout(input: {
  appEnabled: boolean
  rollout: PersonalPlanAppV1Rollout
  isInternal: boolean
}): boolean {
  if (!input.appEnabled || input.rollout === "off") return false
  return input.rollout === "all" || input.isInternal
}

export function resolvePersonalPlanAppV1InternalEmails(
  environment: PersonalPlanAppReleaseEnvironment = process.env,
): ReadonlySet<string> {
  return new Set(
    (environment.PERSONAL_PLAN_APP_V1_INTERNAL_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
  )
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

/**
 * Keeps first-Routine auto-activation independently reversible while refusing
 * to create a Routine that the Stage 4 journey cannot expose. The migration is
 * additive; with either flag absent or disabled callers retain the legacy
 * pending-proposal completion RPC.
 */
export function isPersonalPlanStage4AutoActivateInitialEnabled(
  environment: PersonalPlanAppReleaseEnvironment = process.env,
): boolean {
  return (
    isPersonalPlanStage4Enabled(environment) &&
    environment.PERSONAL_PLAN_STAGE4_AUTO_ACTIVATE_INITIAL === "true"
  )
}

const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

export function isPersonalPlanAppV1Enabled(
  environment: PersonalPlanAppReleaseEnvironment = process.env,
): boolean {
  return environment.PERSONAL_PLAN_APP_V1_ENABLED === "true"
}

/** Separate default-off rollback gate for regular-quiz buyers. */
export function isPersonalPlanLegacyQuizCutoverEnabled(
  environment: PersonalPlanAppReleaseEnvironment = process.env,
): boolean {
  return environment.PERSONAL_PLAN_LEGACY_QUIZ_CUTOVER_ENABLED === "true"
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
