/**
 * The cadence the participant's sheet prints for a routine step, guarded against the plan's
 * own internal phrasings.
 *
 * `frequencyLabel` (decision-presentation.ts) answers „wird im nächsten Schritt verfeinert"
 * for a category with no frequency target yet, and prefixes „später: " while a category is
 * paused. Both are plan-machinery wording about a step that is not settled — on a finished
 * document they read as a loose end, so the cadence falls back to a neutral „nach Bedarf"
 * and the step's own line (open or named) carries the actual state.
 *
 * Shared by the routine list and the „So wendest du es an" section (batch 6), which prints
 * the same cadence per application day.
 */
const CADENCE_FALLBACK = "nach Bedarf"
const CADENCE_UNREFINED = "wird im nächsten Schritt verfeinert"
const CADENCE_PAUSED_PREFIX = "später:"

export function discoveryCadenceLabel(label: string): string {
  const value = label.trim()
  if (!value || value === CADENCE_UNREFINED || value.startsWith(CADENCE_PAUSED_PREFIX)) {
    return CADENCE_FALLBACK
  }
  return value
}
