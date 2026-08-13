type PersonalPlanAppReleaseEnvironment = {
  [key: string]: string | undefined
  PERSONAL_PLAN_APP_V1_INTERNAL_EMAILS?: string
  PERSONAL_PLAN_APP_V1_NEW_BUYER_CUTOFF?: string
  PERSONAL_PLAN_LEGACY_QUIZ_CUTOVER_ENABLED?: string
  PERSONAL_PLAN_STAGE3_INVENTORY_AUTHORITY_V2?: string
}

export type PersonalPlanAppV1Rollout = "off" | "internal" | "all"

export function resolvePersonalPlanAppV1Rollout(
  _environment: PersonalPlanAppReleaseEnvironment = process.env,
): PersonalPlanAppV1Rollout {
  void _environment
  return "all"
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
  _environment: PersonalPlanAppReleaseEnvironment = process.env,
): boolean {
  void _environment
  return true
}

export function isPersonalPlanStage3Enabled(
  _environment: PersonalPlanAppReleaseEnvironment = process.env,
): boolean {
  void _environment
  return true
}

/** Default-off: marked v2 envelopes still resume through their persisted pass. */
export function isPersonalPlanStage3InventoryAuthorityV2Enabled(
  environment: PersonalPlanAppReleaseEnvironment = process.env,
): boolean {
  return environment.PERSONAL_PLAN_STAGE3_INVENTORY_AUTHORITY_V2 === "true"
}

export function isPersonalPlanStage4Enabled(
  _environment: PersonalPlanAppReleaseEnvironment = process.env,
): boolean {
  void _environment
  return true
}

const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

export function isPersonalPlanAppV1Enabled(
  _environment: PersonalPlanAppReleaseEnvironment = process.env,
): boolean {
  void _environment
  return true
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
