export type PersonalPlanTransitionTiming = {
  layer: "client" | "server"
  operation: string
  outcome: string
  durationMs: number
  status?: number
}

type TimingSink = (event: string, details: Record<string, string | number>) => void

/**
 * Stable, non-identifying timing envelope for browser-console and Vercel-log comparison.
 */
export function reportPersonalPlanTransitionTiming(
  timing: PersonalPlanTransitionTiming,
  sink: TimingSink = console.info,
) {
  const details: Record<string, string | number> = {
    layer: timing.layer,
    operation: timing.operation,
    outcome: timing.outcome,
    duration_ms: Math.max(0, Math.round(timing.durationMs * 100) / 100),
  }
  if (timing.status !== undefined) details.status = timing.status
  sink("personal_plan_transition_performance", details)
}
