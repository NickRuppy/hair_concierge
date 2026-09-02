import { PlanStartOpening } from "@/components/personal-plan-start/plan-start-opening"

/**
 * Deliberately NOT the neutral static shell the other Phase-3 routes use: this
 * route continues the opening choreography — the identical layout the in-flow
 * PlanStartLoading renders — so the arrival→plan handoff never swaps loading
 * layouts (founder sign-off 02.09.2026).
 */
export default function PlanStartLoading() {
  return <PlanStartOpening loadingShellId="plan-start-loading-shell" />
}
