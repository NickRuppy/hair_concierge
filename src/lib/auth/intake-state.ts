import {
  hasCompletedQuizDiagnostics,
  type PersistedQuizDiagnosticsProfile,
} from "@/lib/quiz/completion"

export type IntakeState = "needs_quiz" | "needs_onboarding" | "ready"

type ProfileRow = {
  onboarding_completed?: boolean | null
} | null

export function hasQuizDiagnostics(profile: PersistedQuizDiagnosticsProfile): boolean {
  return hasCompletedQuizDiagnostics(profile)
}

export function resolveIntakeState(
  profile: ProfileRow,
  hairProfile: PersistedQuizDiagnosticsProfile,
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
