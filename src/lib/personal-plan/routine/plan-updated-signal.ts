/**
 * The "Plan aktualisiert" toast signal (Task 2.6, made honest in Task 2.2).
 *
 * An explicit, one-shot navigation marker attached to the `/routine` href by
 * the Task-2.4 routing touchpoints
 * (`src/components/personal-plan-start/plan-start-flow.tsx`):
 *
 * - a habits-first (or habits-closing) module completion — attached ONLY when
 *   the server-reported recompute outcome was `"applied"`
 *   (`moduleCompletion.recompute`, T1.4). `"unchanged"`, `"unavailable"`, and
 *   an absent field (no active routine, or an older server) all mean nothing
 *   was actually recomputed, so no signal rides along — even on an otherwise
 *   post-accept module entry.
 * - a Stage-3 completion that followed an explicit post-accept `products`
 *   module entry — that path always genuinely activates a routine, so its
 *   signal stays unconditional on post-accept origin alone
 *   (`stage3CompletionRoutineHref`, unchanged by Task 2.2).
 *
 * A query param, not routine-content diffing: the toast reflects a
 * server-confirmed fact about what THIS request just did, never whether the
 * routine payload happens to look different on a later read.
 *
 * The Routine page consumes the param exactly once (see
 * `personal-plan-routine-client.tsx`) and strips it from the URL
 * immediately, so a reload never re-shows the toast.
 */
export const ROUTINE_PLAN_UPDATED_PARAM = "planUpdated"

export function withRoutinePlanUpdatedSignal(href: string): string {
  const separator = href.includes("?") ? "&" : "?"
  return `${href}${separator}${ROUTINE_PLAN_UPDATED_PARAM}=1`
}

export function hasRoutinePlanUpdatedSignal(searchParams: Pick<URLSearchParams, "get">): boolean {
  return searchParams.get(ROUTINE_PLAN_UPDATED_PARAM) === "1"
}

/**
 * The href to replace the URL with once the signal has been read (the
 * "consume" half of "consume once" — see the module doc comment). Keeps
 * every other query param untouched so an unrelated one is never dropped.
 */
export function withoutRoutinePlanUpdatedSignal(
  pathname: string,
  searchParams: URLSearchParams,
): string {
  const params = new URLSearchParams(searchParams.toString())
  params.delete(ROUTINE_PLAN_UPDATED_PARAM)
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}
