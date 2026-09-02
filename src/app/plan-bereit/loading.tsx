import { PlanBereitArrival } from "./plan-ready-arrival"

/**
 * Deliberately NOT the neutral static shell the other Phase-3 routes use: this
 * route continues the post-payment opening frame that /welcome already painted,
 * so the streaming gap must show the identical loading frame — wordmark,
 * spinner ring, „Dein Plan wird geöffnet.“ (founder sign-off 02.09.2026).
 */
export default function PlanBereitLoading() {
  return <PlanBereitArrival phase="loading" loadingShellId="plan-bereit-loading-shell" />
}
