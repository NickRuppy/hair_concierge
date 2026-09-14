import "server-only"

/** Owner-controlled rollout switch; never inferred from an ad query or client storage. */
export function isScannerFunnelRefinementEnabled(): boolean {
  return process.env.SCANNER_FUNNEL_REFINEMENT_ENABLED === "true"
}
