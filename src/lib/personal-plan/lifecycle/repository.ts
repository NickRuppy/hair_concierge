import { STAGE2_MODULES, type Stage2Module } from "@/lib/personal-plan/refinement/types"

/**
 * Persistence for two small, unrelated pieces of per-user UI lifecycle state
 * that share one table (migration 20260825150000_personal_plan_ui_lifecycle_marks):
 *
 * - Routine refinement banner dismissal, per user+module. Replaces the old
 *   24h `nudge_dismissed_until` timestamp (routine/nudge.ts): dismissing the
 *   banner for a module hides it until a DIFFERENT module becomes the next
 *   open one. Per-module dismissal rows alone give this "hidden until next
 *   different module, then once more" behavior — a caller (PR 2 Task 2.3)
 *   just checks `isModuleBannerDismissed(state, currentOpenModule)`: if the
 *   open module changes, its row doesn't exist yet, so the banner reappears.
 * - Nav-tab "never visited" dot state, per user+nav-surface (PR 2 Task 2.9).
 *
 * Both follow the graceful-degradation pattern in
 * src/lib/personal-plan/routine/repository.ts:72-108 — any read error
 * (including `42P01 undefined_table` from a pre-migration deploy) degrades
 * to "no marks" (banner visible, nav dot shown) instead of failing the page.
 * Writes are NOT swallowed: the caller (an API route) needs to know a
 * dismissal/visit failed to persist so it can respond accordingly.
 */

export const PERSONAL_PLAN_UI_LIFECYCLE_MARKS_TABLE = "personal_plan_ui_lifecycle_marks"

/** Mirrors `PersonalPlanNavigationItem["key"]` in navigation-access.ts. */
export type PersonalPlanNavSurface = "chat" | "routine" | "scan" | "application" | "profile"
export const PERSONAL_PLAN_NAV_SURFACES: readonly PersonalPlanNavSurface[] = [
  "chat",
  "routine",
  "scan",
  "application",
  "profile",
]

type LifecycleMarkKind = "module_banner_dismissed" | "nav_surface_visited"

type LifecycleTableQuery = {
  select: (columns: string) => LifecycleTableQuery
  eq: (column: string, value: unknown) => LifecycleTableQuery
  upsert: (
    row: Record<string, unknown>,
    options?: { onConflict?: string },
  ) => PromiseLike<{ error: unknown }>
}
export type PersonalPlanLifecycleClient = { from: (table: string) => LifecycleTableQuery }

export type ModuleBannerDismissalState = { dismissedModules: ReadonlySet<Stage2Module> }
const NO_MODULE_DISMISSALS: ModuleBannerDismissalState = { dismissedModules: new Set() }

export type NavSurfaceVisitedState = { visitedSurfaces: ReadonlySet<PersonalPlanNavSurface> }
const NO_NAV_VISITS: NavSurfaceVisitedState = { visitedSurfaces: new Set() }

function warnUnavailable(kind: LifecycleMarkKind, error: unknown): void {
  console.warn("personal_plan_ui_lifecycle_marks_unavailable", {
    kind,
    code: (error as { code?: unknown } | null)?.code ?? null,
  })
}

async function selectSubjects(
  client: PersonalPlanLifecycleClient,
  userId: string,
  kind: LifecycleMarkKind,
): Promise<{ data: unknown[] | null; error: unknown }> {
  const query = client
    .from(PERSONAL_PLAN_UI_LIFECYCLE_MARKS_TABLE)
    .select("subject")
    .eq("user_id", userId)
    .eq("kind", kind)
  return query as unknown as PromiseLike<{ data: unknown[] | null; error: unknown }>
}

async function upsertMark(
  client: PersonalPlanLifecycleClient,
  row: { user_id: string; kind: LifecycleMarkKind; subject: string; marked_at: string },
): Promise<void> {
  const { error } = await client
    .from(PERSONAL_PLAN_UI_LIFECYCLE_MARKS_TABLE)
    .upsert(row, { onConflict: "user_id,kind,subject" })
  if (error) throw error
}

function subjectsOf(data: unknown[] | null): string[] {
  return ((data ?? []) as { subject?: unknown }[])
    .map((row) => row?.subject)
    .filter((subject): subject is string => typeof subject === "string")
}

// --- Module banner dismissal -------------------------------------------------

/**
 * Marks the refinement banner dismissed for one module. Idempotent: the
 * table's primary key is (user_id, kind, subject), so re-dismissing the same
 * module overwrites the existing row rather than duplicating it.
 */
export async function recordModuleBannerDismissal(
  client: PersonalPlanLifecycleClient,
  input: { userId: string; module: Stage2Module; dismissedAt: string },
): Promise<void> {
  await upsertMark(client, {
    user_id: input.userId,
    kind: "module_banner_dismissed",
    subject: input.module,
    marked_at: input.dismissedAt,
  })
}

/** Failure-tolerant read: any error degrades to "no modules dismissed". */
export async function loadModuleBannerDismissals(
  client: PersonalPlanLifecycleClient,
  userId: string,
): Promise<ModuleBannerDismissalState> {
  try {
    const { data, error } = await selectSubjects(client, userId, "module_banner_dismissed")
    if (error) {
      warnUnavailable("module_banner_dismissed", error)
      return NO_MODULE_DISMISSALS
    }
    const knownModules = STAGE2_MODULES as readonly string[]
    const dismissedModules = new Set<Stage2Module>(
      subjectsOf(data).filter((subject): subject is Stage2Module => knownModules.includes(subject)),
    )
    return { dismissedModules }
  } catch (error) {
    warnUnavailable("module_banner_dismissed", error)
    return NO_MODULE_DISMISSALS
  }
}

export function isModuleBannerDismissed(
  state: ModuleBannerDismissalState,
  module: Stage2Module,
): boolean {
  return state.dismissedModules.has(module)
}

// --- Nav-surface visited ------------------------------------------------------

/** Marks a nav surface visited. Idempotent for the same reason as above. */
export async function recordNavSurfaceVisited(
  client: PersonalPlanLifecycleClient,
  input: { userId: string; surface: PersonalPlanNavSurface; visitedAt: string },
): Promise<void> {
  await upsertMark(client, {
    user_id: input.userId,
    kind: "nav_surface_visited",
    subject: input.surface,
    marked_at: input.visitedAt,
  })
}

/** Failure-tolerant read: any error degrades to "nothing visited" (dot shown). */
export async function loadVisitedNavSurfaces(
  client: PersonalPlanLifecycleClient,
  userId: string,
): Promise<NavSurfaceVisitedState> {
  try {
    const { data, error } = await selectSubjects(client, userId, "nav_surface_visited")
    if (error) {
      warnUnavailable("nav_surface_visited", error)
      return NO_NAV_VISITS
    }
    const knownSurfaces = PERSONAL_PLAN_NAV_SURFACES as readonly string[]
    const visitedSurfaces = new Set<PersonalPlanNavSurface>(
      subjectsOf(data).filter((subject): subject is PersonalPlanNavSurface =>
        knownSurfaces.includes(subject),
      ),
    )
    return { visitedSurfaces }
  } catch (error) {
    warnUnavailable("nav_surface_visited", error)
    return NO_NAV_VISITS
  }
}

export function isNavSurfaceVisited(
  state: NavSurfaceVisitedState,
  surface: PersonalPlanNavSurface,
): boolean {
  return state.visitedSurfaces.has(surface)
}
