export type IntakeState = "needs_quiz" | "needs_onboarding" | "ready"

type QuizDiagnosticsProfile = {
  hair_texture?: string | null
  thickness?: string | null
  cuticle_condition?: string | null
  protein_moisture_balance?: string | null
  scalp_type?: string | null
  scalp_condition?: string | null
  chemical_treatment?: string[] | null
} | null

type ProfileRow = {
  onboarding_completed?: boolean | null
} | null

export function hasQuizDiagnostics(profile: QuizDiagnosticsProfile): boolean {
  if (!profile) {
    return false
  }

  const requiredFields = [
    profile.hair_texture,
    profile.thickness,
    profile.cuticle_condition,
    profile.protein_moisture_balance,
    profile.scalp_type,
    profile.scalp_condition,
  ]

  return (
    requiredFields.every((value) => typeof value === "string" && value.length > 0) &&
    Array.isArray(profile.chemical_treatment) &&
    profile.chemical_treatment.length > 0
  )
}

export function resolveIntakeState(
  profile: ProfileRow,
  hairProfile: QuizDiagnosticsProfile,
): IntakeState {
  if (profile?.onboarding_completed) {
    return "ready"
  }

  if (hasQuizDiagnostics(hairProfile)) {
    return "needs_onboarding"
  }

  return "needs_quiz"
}

export function getAuthenticatedAppRedirect(
  pathname: string,
  intakeState: IntakeState,
  options?: { isQuizRetake?: boolean },
): string | null {
  if (pathname === "/quiz" && options?.isQuizRetake) {
    return null
  }

  switch (pathname) {
    case "/auth":
      if (intakeState === "needs_quiz") return "/quiz"
      if (intakeState === "needs_onboarding") return "/onboarding"
      return "/chat"
    case "/quiz":
      if (intakeState === "needs_quiz") return null
      if (intakeState === "needs_onboarding") return "/onboarding"
      return "/chat"
    case "/chat":
      if (intakeState === "needs_quiz") return "/quiz"
      if (intakeState === "needs_onboarding") return "/onboarding"
      return null
    case "/":
      if (intakeState === "needs_quiz") return "/quiz"
      if (intakeState === "needs_onboarding") return "/onboarding"
      return "/chat"
    default:
      return null
  }
}
