export type PersonalPlanRoutingPlan = {
  currentInitialNeedVersionId: string | null
  currentRefinedNeedVersionId: string | null
  pendingRoutineProposalId: string | null
  activeRoutineVersionId: string | null
}

export type PersonalPlanRoutingFrontier =
  | { kind: "legacy" }
  | { kind: "recovery"; nextHref: "/plan-bereit" }
  | {
      kind: "personal_plan"
      frontier: "stage1" | "stage2" | "stage3" | "stage4" | "stage5"
      nextHref: "/plan-start" | "/routine" | "/anwendung"
    }

export function resolvePersonalPlanRoutingFrontier(input: {
  eligible: boolean
  sourceReady: boolean
  plan: PersonalPlanRoutingPlan | null
}): PersonalPlanRoutingFrontier {
  if (!input.eligible) return { kind: "legacy" }
  if (!input.sourceReady) return { kind: "recovery", nextHref: "/plan-bereit" }

  if (!input.plan?.currentInitialNeedVersionId) {
    return { kind: "personal_plan", frontier: "stage1", nextHref: "/plan-start" }
  }
  if (!input.plan.currentRefinedNeedVersionId) {
    return { kind: "personal_plan", frontier: "stage2", nextHref: "/plan-start" }
  }
  if (input.plan.activeRoutineVersionId) {
    return { kind: "personal_plan", frontier: "stage5", nextHref: "/anwendung" }
  }
  if (input.plan.pendingRoutineProposalId) {
    return { kind: "personal_plan", frontier: "stage4", nextHref: "/routine" }
  }
  return { kind: "personal_plan", frontier: "stage3", nextHref: "/plan-start" }
}

export function getPersonalPlanFrontierRedirect(
  pathname: string,
  frontier: PersonalPlanRoutingFrontier,
): string | null {
  if (frontier.kind === "legacy" || isRoute(pathname, "/onboarding")) return null

  if (frontier.kind === "recovery") {
    return isFrontierControlledRoute(pathname) ? frontier.nextHref : null
  }

  if (pathname === "/auth" || isRoute(pathname, "/chat")) return frontier.nextHref
  if (isRoute(pathname, "/routine")) {
    return frontier.frontier === "stage4" || frontier.frontier === "stage5"
      ? null
      : frontier.nextHref
  }
  if (isRoute(pathname, "/anwendung")) {
    if (frontier.frontier === "stage5") return null
    return frontier.frontier === "stage4" ? "/routine" : frontier.nextHref
  }
  return null
}

function isFrontierControlledRoute(pathname: string): boolean {
  return (
    pathname === "/auth" ||
    isRoute(pathname, "/chat") ||
    isRoute(pathname, "/routine") ||
    isRoute(pathname, "/anwendung")
  )
}

function isRoute(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}
