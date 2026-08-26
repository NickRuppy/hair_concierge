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
 * every kind's read to an empty result instead of failing the page. What
 * that empty result MEANS differs per kind, and is the caller's call:
 *   - module_banner_dismissed: empty reads as "no dismissals" — banner
 *     visible. Showing the banner on a read failure is the safe default
 *     (worst case it nags once more), so `loadModuleBannerDismissals`
 *     needs no extra signal.
 *   - nav_surface_visited: empty must NOT be read as "nothing visited yet"
 *     by the nav-dot caller (PR 2 Task 2.9), because that would light up
 *     EVERY tab the moment the table goes missing — the opposite of
 *     "quietly do nothing" for a pre-migration deploy. `loadVisitedNavSurfaces`
 *     therefore also reports `available: false` on any read error so the
 *     caller can render zero dots instead of all of them; see that
 *     function's doc comment.
 * Writes are NOT swallowed: the caller (an API route, or a deferred
 * `after()` write in a nav-target layout) needs to know a dismissal/visit
 * failed to persist so it can respond accordingly.
 */

export const PERSONAL_PLAN_UI_LIFECYCLE_MARKS_TABLE = "personal_plan_ui_lifecycle_marks"

/**
 * Single source of truth for the nav-dot subject set; mirrors
 * `PERSONAL_PLAN_NAVIGATION_ITEM_KEYS` in navigation-access.ts, which is
 * the actual tab-key union. The two are declared independently (this file
 * has no reason to import the nav module), so
 * tests/personal-plan-nav-surface-union-sync.test.ts asserts they stay in
 * sync at test time.
 */
export const PERSONAL_PLAN_NAV_SURFACES = [
  "chat",
  "routine",
  "scan",
  "application",
  "profile",
] as const
export type PersonalPlanNavSurface = (typeof PERSONAL_PLAN_NAV_SURFACES)[number]

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

export type NavSurfaceVisitedState = {
  visitedSurfaces: ReadonlySet<PersonalPlanNavSurface>
  /**
   * False when the read degraded (pre-migration `42P01`, or any other
   * failure) rather than genuinely returning zero rows. Callers deciding
   * whether to render an unvisited-tab dot MUST check this first: an empty
   * `visitedSurfaces` set alone is ambiguous between "brand-new user, every
   * tab genuinely unvisited" and "table unavailable" — only `available`
   * tells them apart. See the module doc comment above.
   */
  available: boolean
}
const NAV_VISITS_UNAVAILABLE: NavSurfaceVisitedState = {
  visitedSurfaces: new Set(),
  available: false,
}

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

/**
 * Failure-tolerant read: any error degrades to `available: false` with an
 * empty `visitedSurfaces` set — i.e. "the feature is silently off", NOT
 * "nothing visited yet" (which would render a dot on every tab). Callers
 * MUST gate on `available` before treating an unlisted surface as
 * unvisited; see `NavSurfaceVisitedState`'s doc comment.
 */
export async function loadVisitedNavSurfaces(
  client: PersonalPlanLifecycleClient,
  userId: string,
): Promise<NavSurfaceVisitedState> {
  try {
    const { data, error } = await selectSubjects(client, userId, "nav_surface_visited")
    if (error) {
      warnUnavailable("nav_surface_visited", error)
      return NAV_VISITS_UNAVAILABLE
    }
    const knownSurfaces = PERSONAL_PLAN_NAV_SURFACES as readonly string[]
    const visitedSurfaces = new Set<PersonalPlanNavSurface>(
      subjectsOf(data).filter((subject): subject is PersonalPlanNavSurface =>
        knownSurfaces.includes(subject),
      ),
    )
    return { visitedSurfaces, available: true }
  } catch (error) {
    warnUnavailable("nav_surface_visited", error)
    return NAV_VISITS_UNAVAILABLE
  }
}

export function isNavSurfaceVisited(
  state: NavSurfaceVisitedState,
  surface: PersonalPlanNavSurface,
): boolean {
  return state.visitedSurfaces.has(surface)
}

/**
 * Whether the "never visited this tab" dot should render for `surface`
 * (Task 2.9, decision 14). Single source of truth for the two rules that
 * decide it, so no call site has to remember either on its own:
 *   - `routine` is never dotted. It's the Personal Plan's landing surface,
 *     so treating it as "visited from the start" and simply excluding it
 *     is simpler than seeding a visit row on plan acceptance — and it
 *     avoids colliding with `RoutineAttentionIndicator`, which owns that
 *     tab's attention semantics (pending-proposal review, not discovery).
 *   - Every other surface dots only when the read succeeded
 *     (`state.available`) and the surface isn't in the visited set.
 *     `state.available === false` (pre-migration or any read failure)
 *     always renders no dot — see `NavSurfaceVisitedState`'s doc comment.
 */
export function shouldShowNavUnvisitedDot(
  state: NavSurfaceVisitedState,
  surface: PersonalPlanNavSurface,
): boolean {
  if (surface === "routine") return false
  return state.available && !isNavSurfaceVisited(state, surface)
}
