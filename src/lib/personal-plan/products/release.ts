type PersonalPlanStage3ReleaseEnvironment = Partial<
  Pick<NodeJS.ProcessEnv, "PERSONAL_PLAN_STAGE3_ENABLED">
>

/**
 * Independent Stage 3 entry kill-switch. The default stays closed until an
 * explicit rollout enables it; disabling entry must not mutate saved drafts or
 * immutable portfolio versions.
 */
export function isPersonalPlanStage3Enabled(
  environment: PersonalPlanStage3ReleaseEnvironment,
): boolean {
  return environment.PERSONAL_PLAN_STAGE3_ENABLED === "true"
}
