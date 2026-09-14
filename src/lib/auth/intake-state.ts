import {
  hasCompletedQuizDiagnostics,
  type PersistedQuizDiagnosticsProfile,
} from "@/lib/quiz/completion"

export type IntakeState = "needs_quiz" | "needs_onboarding" | "ready"

export type PersonalPlanRoutineAccess = {
  hasActivePersonalPlanEntitlement: boolean
  /**
   * Current paid app access, mirroring the subscription paywall's own
   * composite (`hasCurrentAppAccess` OR an active one-time purchase OR an
   * active moderator grant). Distinct from
   * `hasActivePersonalPlanEntitlement`, which deliberately excludes plain
   * subscribers. Only the `/scan` rule reads it; omitted means "unknown",
   * treated as no paid access.
   */
  hasPaidAppAccess?: boolean
  pendingRoutineProposalId: string | null
  activeRoutineVersionId: string | null
}

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
  options?: {
    isQuizRetake?: boolean
    personalPlanRoutineAccess?: PersonalPlanRoutineAccess
    freemiumScannerFirstEnabled?: boolean
  },
): string | null {
  if (pathname === "/quiz" && options?.isQuizRetake) {
    return null
  }

  if (pathname === "/auth") {
    if (intakeState === "needs_quiz") return "/quiz"
    if (intakeState === "needs_onboarding") return "/onboarding"
    return "/chat"
  }

  if (pathname === "/quiz") {
    if (intakeState === "needs_quiz") return null
    if (intakeState === "needs_onboarding") return "/onboarding"
    return "/chat"
  }

  if (isAuthenticatedAppRoute(pathname)) {
    if (intakeState === "needs_quiz") return "/quiz"
    if (intakeState === "needs_onboarding") {
      return canBypassLegacyOnboardingForPersonalPlanRoutine(
        pathname,
        options?.personalPlanRoutineAccess,
        { freemiumScannerFirstEnabled: options?.freemiumScannerFirstEnabled },
      )
        ? null
        : "/onboarding"
    }
    return null
  }

  return null
}

export function isPersonalPlanRoutineRoute(pathname: string): boolean {
  return isRoute(pathname, "/routine") || isRoute(pathname, "/anwendung")
}

export function isPersonalPlanOnboardingBypassRoute(pathname: string): boolean {
  return (
    isPersonalPlanRoutineRoute(pathname) || isRoute(pathname, "/chat") || isRoute(pathname, "/scan")
  )
}

export function canBypassLegacyOnboardingForPersonalPlanRoutine(
  pathname: string,
  access: PersonalPlanRoutineAccess | undefined,
  options?: { freemiumScannerFirstEnabled?: boolean },
): boolean {
  // Freemium scanner-first: /scan's onboarding bypass is decoupled from the
  // Personal-Plan routine entitlement entirely when the flag is on — it no
  // longer matters whether the user holds any paid/guest entitlement.
  if (options?.freemiumScannerFirstEnabled && isRoute(pathname, "/scan")) {
    return true
  }

  if (!access?.hasActivePersonalPlanEntitlement) {
    // Scanner funnel (`scan_v1`): the funnel sells the *subscription* and lands
    // the buyer on `/scan`, but a plain subscriber holds no Personal-Plan
    // routine entitlement (that composite covers one-time access, field-test /
    // partner guests and moderators only). Current paid app access alone opens
    // `/scan`; the profile prerequisite stays enforced downstream by the scan
    // page's own gate (loadScanRouteAccess -> redirect to /quiz).
    if (isRoute(pathname, "/scan") && access?.hasPaidAppAccess) return true
    return false
  }

  const hasPendingOrActiveRoutine = Boolean(
    access.pendingRoutineProposalId || access.activeRoutineVersionId,
  )
  if (isRoute(pathname, "/routine")) return hasPendingOrActiveRoutine
  if (isRoute(pathname, "/anwendung")) return Boolean(access.activeRoutineVersionId)
  if (isRoute(pathname, "/chat")) return hasPendingOrActiveRoutine
  // /scan bypasses legacy onboarding for any personal-plan entitlement holder,
  // independent of routine pointers: quiz completion (the actual prerequisite
  // for the verdict engine) is enforced downstream by the scan page's own
  // gate (loadScanRouteAccess -> redirect to /quiz).
  if (isRoute(pathname, "/scan")) return true
  return false
}

function isAuthenticatedAppRoute(pathname: string): boolean {
  return ["/anwendung", "/chat", "/routine", "/scan"].some((prefix) => isRoute(pathname, prefix))
}

function isRoute(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}
