import { computeRoutineRefinementNudgeDismissedUntil } from "./nudge"
import { loadOwnerRoutinePlan, type PersonalPlanRoutineReadClient } from "./repository"
import { transitionOutcome } from "./transitions"

export type RoutineNudgeDismissalRpc = (
  name: "personal_plan_dismiss_routine_nudge",
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown | null }>

export type RoutineNudgeDismissalRepository = {
  loadPlan(userId: string): Promise<{ id: string } | null>
}

export type RoutineNudgeDismissalResult =
  | { status: "dismissed"; nudgeDismissedUntil: string }
  | { status: "no_personal_plan" }
  | { status: "temporarily_unavailable" }

export function createRoutineNudgeDismissalService(input: {
  repository: RoutineNudgeDismissalRepository
  rpc: RoutineNudgeDismissalRpc
  now?: () => number
}) {
  const now = input.now ?? (() => Date.now())
  return {
    async dismiss(request: { userId: string }): Promise<RoutineNudgeDismissalResult> {
      try {
        const plan = await input.repository.loadPlan(request.userId)
        if (!plan) return { status: "no_personal_plan" }
        const nudgeDismissedUntil = computeRoutineRefinementNudgeDismissedUntil(now())
        const response = await input.rpc("personal_plan_dismiss_routine_nudge", {
          p_user_id: request.userId,
          p_personal_plan_id: plan.id,
          p_dismissed_until: nudgeDismissedUntil,
        })
        const outcome = !response.error && transitionOutcome(response.data)
        if (!outcome || outcome.outcome !== "dismissed") {
          return { status: "temporarily_unavailable" }
        }
        return { status: "dismissed", nudgeDismissedUntil }
      } catch {
        return { status: "temporarily_unavailable" }
      }
    },
  }
}

export function createSupabaseRoutineNudgeDismissalService(input: {
  client: PersonalPlanRoutineReadClient & { rpc: RoutineNudgeDismissalRpc }
}) {
  return createRoutineNudgeDismissalService({
    repository: {
      loadPlan: (userId) => loadOwnerRoutinePlan(input.client, userId),
    },
    rpc: input.client.rpc.bind(input.client),
  })
}
