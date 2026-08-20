import "server-only"

import { cache } from "react"

import { createClient } from "@/lib/supabase/server"
import { loadPersonalPlanJourneyAccessForUser } from "./journey-access-loader"
import type { PersonalPlanJourneyAccess } from "./journey-access"

export type PersonalPlanNavigationItem = {
  key: "chat" | "routine" | "scan" | "application" | "profile"
  href: "/chat" | "/routine" | "/scan" | "/anwendung" | "/profile"
  label: "Chat" | "Routine" | "Scan" | "Anwendung" | "Profil"
}

export type AuthenticatedAppNavigationAccess =
  | { kind: "legacy" }
  | {
      kind: "personal_plan"
      items: readonly PersonalPlanNavigationItem[]
      hasPendingRoutineProposal: boolean
    }

export type AuthenticatedAppNavigationResolverDeps = {
  getUserId: () => Promise<string | null>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
}

export function toAuthenticatedAppNavigationAccess(
  access: PersonalPlanJourneyAccess,
): AuthenticatedAppNavigationAccess {
  if (access.kind !== "personal_plan" && access.kind !== "personal_plan_start") {
    return { kind: "legacy" }
  }

  const items: PersonalPlanNavigationItem[] = [{ key: "chat", href: "/chat", label: "Chat" }]
  if (access.allowed.stage4) {
    items.push({ key: "routine", href: "/routine", label: "Routine" })
    // Stealth rollout: Scan stays reachable via direct link only — re-add the
    // item below to relaunch the tab.
    // items.push({ key: "scan", href: "/scan", label: "Scan" })
  }
  if (access.allowed.stage5) {
    items.push({ key: "application", href: "/anwendung", label: "Anwendung" })
  }
  items.push({ key: "profile", href: "/profile", label: "Profil" })
  return {
    kind: "personal_plan",
    items,
    hasPendingRoutineProposal:
      access.kind === "personal_plan" ? access.hasPendingRoutineProposal === true : false,
  }
}

export async function resolveAuthenticatedAppNavigationAccess(
  deps: AuthenticatedAppNavigationResolverDeps,
): Promise<AuthenticatedAppNavigationAccess> {
  try {
    const userId = await deps.getUserId()
    if (!userId) return { kind: "legacy" }
    return toAuthenticatedAppNavigationAccess(await deps.loadJourneyAccess(userId))
  } catch {
    // This is a presentation fallback only. Pages and APIs retain their own
    // owner/frontier checks and continue to fail closed independently.
    return { kind: "legacy" }
  }
}

export const loadCachedPersonalPlanJourneyAccessForUser = cache(
  loadPersonalPlanJourneyAccessForUser,
)

export const loadCachedAuthenticatedAppUserId = cache(
  async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
)

export const loadAuthenticatedAppNavigationAccess = cache(
  async (): Promise<AuthenticatedAppNavigationAccess> =>
    resolveAuthenticatedAppNavigationAccess({
      getUserId: loadCachedAuthenticatedAppUserId,
      loadJourneyAccess: loadCachedPersonalPlanJourneyAccessForUser,
    }),
)
