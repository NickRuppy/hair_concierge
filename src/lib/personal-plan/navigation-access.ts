import "server-only"

import { cache } from "react"
import { after } from "next/server"

import {
  type NavSurfaceVisitedState,
  type PersonalPlanLifecycleClient,
  type PersonalPlanNavSurface,
  loadVisitedNavSurfaces,
  recordNavSurfaceVisited,
  shouldShowNavUnvisitedDot,
} from "@/lib/personal-plan/lifecycle/repository"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { loadPersonalPlanJourneyAccessForUser } from "./journey-access-loader"
import type { PersonalPlanJourneyAccess } from "./journey-access"

/**
 * Single source of truth for the nav tab-key union. `PersonalPlanNavSurface`
 * (lifecycle/repository.ts) is declared independently from this — that
 * module has no reason to import the nav module — so
 * tests/personal-plan-nav-surface-union-sync.test.ts asserts the two stay
 * in sync at test time.
 */
export const PERSONAL_PLAN_NAVIGATION_ITEM_KEYS = [
  "chat",
  "routine",
  "scan",
  "application",
  "profile",
] as const
export type PersonalPlanNavigationItemKey = (typeof PERSONAL_PLAN_NAVIGATION_ITEM_KEYS)[number]

export type PersonalPlanNavigationItem = {
  key: PersonalPlanNavigationItemKey
  href: "/chat" | "/routine" | "/scan" | "/anwendung" | "/profile"
  label: "Chat" | "Routine" | "Scan" | "Anwendung" | "Profil"
}

export type AuthenticatedAppNavigationAccess =
  | { kind: "legacy" }
  | {
      kind: "personal_plan"
      items: readonly PersonalPlanNavigationItem[]
      hasPendingRoutineProposal: boolean
      /**
       * Tabs to show the never-visited dot on (Task 2.9, decision 14).
       * Always a subset of `items`' keys — computed from the same list, so
       * a currently-ungated tab never dots — and never contains "routine"
       * (see `shouldShowNavUnvisitedDot`).
       */
      unvisitedNavSurfaces: ReadonlySet<PersonalPlanNavSurface>
    }

export type AuthenticatedAppNavigationResolverDeps = {
  getUserId: () => Promise<string | null>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
  /** Omit to render with no nav dots at all (safe default; see below). */
  loadNavVisitedState?: (userId: string) => Promise<NavSurfaceVisitedState>
}

export function toAuthenticatedAppNavigationAccess(
  access: PersonalPlanJourneyAccess,
  navVisitedState?: NavSurfaceVisitedState,
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

  // No `navVisitedState` (caller didn't wire the lifecycle read) degrades the
  // same way an unavailable read does: zero dots, never all of them.
  const unvisitedNavSurfaces = new Set<PersonalPlanNavSurface>(
    navVisitedState
      ? items
          .map((item) => item.key)
          .filter((key) => shouldShowNavUnvisitedDot(navVisitedState, key))
      : [],
  )

  return {
    kind: "personal_plan",
    items,
    hasPendingRoutineProposal:
      access.kind === "personal_plan" ? access.hasPendingRoutineProposal === true : false,
    unvisitedNavSurfaces,
  }
}

/**
 * Whether this user sees the Routine tab — i.e. whether `/routine` is a real
 * destination for them rather than the deliberately hidden "Routine nicht
 * verfügbar" page. Deliberately derived from the SAME item list the navigation
 * renders, so the two can never drift apart.
 *
 * The Profil tab's Haarprofil section links „Dein Plan“ at the plan view
 * (`/routine`) and presents it as done, so it stays absent for a mid-journey
 * buyer who has not reached Stage 4 yet (Task 2.5, review round 1).
 */
export function hasRoutineTabAccess(access: AuthenticatedAppNavigationAccess): boolean {
  return access.kind === "personal_plan" && access.items.some((item) => item.key === "routine")
}

export async function resolveAuthenticatedAppNavigationAccess(
  deps: AuthenticatedAppNavigationResolverDeps,
): Promise<AuthenticatedAppNavigationAccess> {
  try {
    const userId = await deps.getUserId()
    if (!userId) return { kind: "legacy" }
    const access = await deps.loadJourneyAccess(userId)
    if (access.kind !== "personal_plan" && access.kind !== "personal_plan_start") {
      return { kind: "legacy" }
    }
    // Only fetched for a Personal Plan destination: skip the extra read for
    // legacy/paid-pending users, who never see nav dots anyway.
    const navVisitedState = await deps.loadNavVisitedState?.(userId)
    return toAuthenticatedAppNavigationAccess(access, navVisitedState)
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

const loadCachedNavVisitedStateForUser = cache(
  async (userId: string): Promise<NavSurfaceVisitedState> =>
    loadVisitedNavSurfaces(createAdminClient() as unknown as PersonalPlanLifecycleClient, userId),
)

export type SchedulePersonalPlanNavSurfaceVisitDeps = {
  loadUserId?: () => Promise<string | null>
  client?: () => PersonalPlanLifecycleClient
  scheduleAfter?: typeof after
  now?: () => string
}

/**
 * Marks `surface` visited for the current user the first time they land on
 * it (Task 2.9): a no-op unless `navigation` already says the dot should be
 * showing there, so re-visiting a surface after the first time never writes
 * again. Call from a nav-target layout (chat/routine/scan/anwendung/profile)
 * right after resolving that layout's `navigation`.
 *
 * Uses `after()` (mirrors the `scheduleAfter` dependency pattern in
 * src/app/api/quiz/personal-plan-lead/route.ts) so the write never delays
 * the response — this is a presentation nicety (a dot disappearing), not
 * something the page's own render should wait on. The write itself
 * tolerates failure exactly like the Task 2.3 dismiss route: a
 * pre-migration `undefined_table` just means the dot may still show on the
 * next visit, nothing more (see lifecycle/repository.ts's module doc
 * comment). All deps are overridable for tests — `after()` throws outside a
 * real request scope.
 */
export async function schedulePersonalPlanNavSurfaceVisit(
  navigation: AuthenticatedAppNavigationAccess,
  surface: PersonalPlanNavSurface,
  deps: SchedulePersonalPlanNavSurfaceVisitDeps = {},
): Promise<void> {
  if (navigation.kind !== "personal_plan") return
  if (!navigation.unvisitedNavSurfaces.has(surface)) return

  const loadUserId = deps.loadUserId ?? loadCachedAuthenticatedAppUserId
  const userId = await loadUserId()
  if (!userId) return

  const client =
    deps.client ?? (() => createAdminClient() as unknown as PersonalPlanLifecycleClient)
  const scheduleAfter = deps.scheduleAfter ?? after
  const now = deps.now ?? (() => new Date().toISOString())

  scheduleAfter(() =>
    recordNavSurfaceVisited(client(), { userId, surface, visitedAt: now() }).catch((error) => {
      console.warn("personal_plan_nav_surface_visit_write_failed", { surface, error })
    }),
  )
}

export const loadAuthenticatedAppNavigationAccess = cache(
  async (): Promise<AuthenticatedAppNavigationAccess> =>
    resolveAuthenticatedAppNavigationAccess({
      getUserId: loadCachedAuthenticatedAppUserId,
      loadJourneyAccess: loadCachedPersonalPlanJourneyAccessForUser,
      loadNavVisitedState: loadCachedNavVisitedStateForUser,
    }),
)
