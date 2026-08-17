/**
 * Pure visibility and snooze logic for the routine-page refinement nudge
 * ("Dein Plan basiert noch auf Annahmen."). Clock-injected throughout so
 * dismiss/reappear behavior is testable without real time passing.
 */

export const ROUTINE_REFINEMENT_NUDGE_SNOOZE_MS = 24 * 60 * 60 * 1000

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
