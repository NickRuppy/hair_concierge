/**
 * The "Plan aktualisiert" toast signal (Task 2.6).
 *
 * An explicit, one-shot navigation marker attached to the `/routine` href by
 * the Task-2.4 routing touchpoints — a habits-first module completion, or a
 * Stage-3 completion that followed an explicit `products` module entry
 * (`src/components/personal-plan-start/plan-start-flow.tsx`). A query param,
 * not routine-content diffing: the toast reflects where the user came from
 * (an explicit refinement-module deep link that just recomputed the routine),
 * never whether the routine payload happens to look different.
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
