/**
 * The Profil holds its Styling/Alltag vs Deine Tools/Gewohnheiten decision until the refinement
 * status read has settled, so flag-on members never see one set of cards turn into the other.
 * That wait must never be permanent: if the read has not resolved after this long, the gate opens
 * and the Profil shows today's cards (fail open). A late answer still applies when it arrives.
 */
export const REFINEMENT_STATUS_GATE_TIMEOUT_MS = 3_000

/** Arms the fail-open timer; returns its canceller. */
export function armRefinementStatusGate(
  open: () => void,
  timeoutMs: number = REFINEMENT_STATUS_GATE_TIMEOUT_MS,
): () => void {
  const timer = setTimeout(open, timeoutMs)
  return () => clearTimeout(timer)
}
