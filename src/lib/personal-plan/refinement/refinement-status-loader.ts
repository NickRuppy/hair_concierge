import { loadModuleBannerDismissals } from "@/lib/personal-plan/lifecycle/repository"
import {
  loadRefinementStatusSource,
  type RefinementStatusReadClient,
} from "@/lib/personal-plan/persistence/refinement-status-read"

import { buildRefinementStatusResponse, type RefinementStatusResponse } from "./refinement-status"

export type RefinementStatusLoadClient = RefinementStatusReadClient &
  Parameters<typeof loadModuleBannerDismissals>[0]

export type RefinementStatusLoadResult =
  | { status: "ok"; data: RefinementStatusResponse }
  | { status: "no_personal_plan" }
  | { status: "unavailable" }

/**
 * Shared loader behind the `refinement-status` API route (Task 1.7) and any
 * in-process consumer that wants the same module/progress/banner contract
 * without an extra network round trip — e.g. the Routine page's server-side
 * banner load (Task 2.3), which must stay a single request for that data.
 */
export async function loadRefinementStatusForUser(
  client: RefinementStatusLoadClient,
  userId: string,
): Promise<RefinementStatusLoadResult> {
  try {
    const source = await loadRefinementStatusSource(client, userId)
    if (source.status === "no_personal_plan") return { status: "no_personal_plan" }

    const bannerDismissals = await loadModuleBannerDismissals(client, userId)

    return {
      status: "ok",
      data: buildRefinementStatusResponse({
        moduleStatusInput: {
          triggerContext: source.triggerContext,
          answers: source.answers,
          completedQuestionIds: source.completedQuestionIds,
          answerProvenance: source.answerProvenance,
        },
        moduleProjections: source.moduleProjections,
        bannerDismissals,
      }),
    }
  } catch {
    return { status: "unavailable" }
  }
}
