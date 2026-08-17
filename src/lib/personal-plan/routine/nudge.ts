/**
 * Pure visibility and snooze logic for the routine-page refinement nudge
 * ("Dein Plan basiert noch auf Annahmen."). Clock-injected throughout so
 * dismiss/reappear behavior is testable without real time passing.
 */

export const ROUTINE_REFINEMENT_NUDGE_SNOOZE_MS = 24 * 60 * 60 * 1000

/**
 * The nudge's "Jetzt verfeinern" target. `refine=1` is load-bearing: after a
 * direct accept the refinement draft is already complete, so a bare
 * `/plan-start` would seed the completed session and hand off straight into
 * Stage 3 instead of showing the Feinschliff. See `parseRefineParam` in
 * `src/app/plan-start/page.tsx`.
 */
export const ROUTINE_REFINEMENT_NUDGE_HREF = "/plan-start?refine=1"

export type RoutineRefinementNudgeState = {
  unrefinedDirectAccept: boolean
  nudgeDismissedUntil: string | null
}

/**
 * The nudge shows only while the active Routine's provenance is an
 * unrefined direct accept, and only once any prior dismissal has expired. A
 * malformed `nudgeDismissedUntil` is treated as "not dismissed" rather than
 * hiding the nudge indefinitely.
 */
export function shouldShowRoutineRefinementNudge(
  input: RoutineRefinementNudgeState & { now: number },
): boolean {
  if (!input.unrefinedDirectAccept) return false
  if (!input.nudgeDismissedUntil) return true
  const dismissedUntilMs = Date.parse(input.nudgeDismissedUntil)
  if (Number.isNaN(dismissedUntilMs)) return true
  return input.now >= dismissedUntilMs
}

/** Snoozes the nudge for one day from `now`. */
export function computeRoutineRefinementNudgeDismissedUntil(now: number): string {
  return new Date(now + ROUTINE_REFINEMENT_NUDGE_SNOOZE_MS).toISOString()
}
