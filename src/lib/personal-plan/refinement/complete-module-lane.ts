import { reportPersonalPlanTransitionTiming } from "@/lib/personal-plan/transition-performance"
import type { SyncPlanWithFacts } from "@/lib/personal-plan/facts-recompute/types"
import type { Stage3RecomputeResult } from "@/lib/personal-plan/refinement-recompute/types"

import {
  Stage2RefinementError,
  type Stage2ModuleCompletionResult,
  type Stage2RefinementGateway,
} from "./gateway"
import type { Stage2Module } from "./types"

/**
 * The server-side lane for finishing ONE Stage-2 module, shared by the PATCH
 * save-and-complete route and `POST stage-2/complete {module}` (the replay-safe
 * retry). Both must run exactly the same lane: the gateway completion, then — for
 * `habits` only — the facts rebase and the headless routine recompute. Tools
 * completion triggers no recompute.
 */
export type Stage2ModuleCompletionLaneDeps = {
  /**
   * Facts recompute lane (central profile PR2): after a habits module completion and before the
   * routine recompute, moves the plan to the current profile facts. A `rebased` result with a
   * refined version replaces the completion's refined version as the recompute's target; every
   * other result (or a throw) leaves today's behaviour. Absent = no lane.
   */
  syncPlanWithFacts?: SyncPlanWithFacts
  /**
   * Runs the headless habits-recompute lane after a Verhalten (habits) module
   * completion. Returns `null` when the plan has no active routine yet — the
   * cheap gate this dep applies BEFORE doing any Stage-3 work, so the caller
   * knows to omit the response field entirely rather than report a no-op
   * outcome. Never expected to throw, but the lane wraps the call in its own
   * try/catch regardless — a failure here must never fail the habits module
   * completion that triggered it.
   */
  runHabitsRecompute: (input: {
    userId: string
    refinedVersionId: string
  }) => Promise<Stage3RecomputeResult | null>
}

/** The client-visible shape added to `moduleCompletion.recompute` — no reasons or retryability. */
type HabitsRecomputeClientOutcome = { outcome: "applied" | "unchanged" | "unavailable" }

/**
 * The refined version the routine recompute must target: the one a facts rebase just produced,
 * else the completion's own. Completing the habits module on a plan whose profile changed since
 * the last rebase would otherwise recompute the routine on a refined version that the rebase is
 * about to supersede. Never throws: a plan problem must not fail the module completion.
 */
async function resolveRecomputeTarget(
  deps: Stage2ModuleCompletionLaneDeps,
  userId: string,
  completedRefinedVersionId: string,
): Promise<string> {
  if (!deps.syncPlanWithFacts) return completedRefinedVersionId
  const phaseStarted = performance.now()
  let status = "unexpected_error"
  let target = completedRefinedVersionId
  try {
    const result = await deps.syncPlanWithFacts({ userId })
    status = result.status
    if (result.status === "rebased" && result.refinedVersionId) target = result.refinedVersionId
  } catch {
    // Keep the completion's refined version; the outbox self-heal covers a missed rebase.
  }
  reportPersonalPlanTransitionTiming({
    layer: "server",
    operation: "stage2_habits_facts_sync",
    outcome: status,
    durationMs: performance.now() - phaseStarted,
  })
  console.info("personal_plan_stage2_api", { event: "habits_facts_sync", status })
  return target
}

/**
 * Runs the habits-recompute lane and reports it via the same telemetry idiom
 * as the rest of the Stage-2 API: a `reportPersonalPlanTransitionTiming` entry
 * (outcome carries the unavailable reason, e.g. `unavailable:decision_blocked`,
 * for server-side comparison) plus a matching `console.info` line. Any
 * failure — from the dep itself, not just from the orchestrator it wraps —
 * is caught here and reported as a retryable `unexpected_error`, so this
 * function itself never throws.
 */
async function runHabitsRecomputeLane(
  deps: Stage2ModuleCompletionLaneDeps,
  userId: string,
  refinedVersionId: string,
): Promise<HabitsRecomputeClientOutcome | null> {
  const phaseStarted = performance.now()
  let outcome: HabitsRecomputeClientOutcome["outcome"]
  let reason: string | undefined
  let retryable: boolean | undefined
  let cause: unknown
  try {
    const result = await deps.runHabitsRecompute({ userId, refinedVersionId })
    if (result === null) return null
    if (result.status === "unavailable") {
      outcome = "unavailable"
      reason = result.reason
      retryable = result.retryable
      cause = result.cause
    } else {
      outcome = result.status
    }
  } catch (error) {
    outcome = "unavailable"
    reason = "unexpected_error"
    retryable = true
    cause = error
  }
  reportPersonalPlanTransitionTiming({
    layer: "server",
    operation: "stage2_habits_recompute",
    outcome: reason ? `unavailable:${reason}` : outcome,
    durationMs: performance.now() - phaseStarted,
  })
  console.info("personal_plan_stage2_api", {
    event: "habits_recompute",
    outcome,
    ...(reason ? { reason } : {}),
    ...(retryable !== undefined ? { retryable } : {}),
    ...(cause !== undefined
      ? { cause: cause instanceof Error ? cause.message : String(cause) }
      : {}),
  })
  return { outcome }
}

/**
 * Completes `module` on `gateway` and, for `habits` only, runs the facts rebase and the
 * routine recompute lane. Throws what the gateway throws; the lane itself never fails the
 * completion. A gateway that cannot complete a module is `temporarily_unavailable`.
 */
export async function completeStage2ModuleWithLane(input: {
  gateway: Stage2RefinementGateway
  deps: Stage2ModuleCompletionLaneDeps
  userId: string
  module: Stage2Module
  expectedRevision: number
}): Promise<Stage2ModuleCompletionResult> {
  const { gateway, deps, userId } = input
  if (!gateway.completeModule) throw new Stage2RefinementError("temporarily_unavailable")
  const phaseStarted = performance.now()
  const moduleCompletion = await gateway.completeModule({
    module: input.module,
    expectedRevision: input.expectedRevision,
  })
  reportPersonalPlanTransitionTiming({
    layer: "server",
    operation: "stage2_module_completion",
    outcome: "success",
    durationMs: performance.now() - phaseStarted,
  })
  if (input.module !== "habits") return moduleCompletion
  const recompute = await runHabitsRecomputeLane(
    deps,
    userId,
    await resolveRecomputeTarget(deps, userId, moduleCompletion.refinedVersionId),
  )
  return recompute ? { ...moduleCompletion, recompute } : moduleCompletion
}
