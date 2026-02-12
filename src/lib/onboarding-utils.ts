export function getOnboardingPath(step: number | null | undefined): string {
  const clamped = Math.max(1, Math.min(4, step ?? 1))
  return `/onboarding/step-${clamped}`
}
