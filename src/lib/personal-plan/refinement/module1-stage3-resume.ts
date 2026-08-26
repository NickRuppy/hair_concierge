import {
  loadRefinementStatusSource,
  type RefinementStatusReadClient,
} from "@/lib/personal-plan/persistence/refinement-status-read"

import { stage2ModuleStates } from "./module-status"

/**
 * Server-side resume of the Modul-1 → Stage-3 handoff (Task 2.5, carried
 * obligation from the 2.4 review).
 *
 * Completing the `products` module projects a refined Need version and hands
 * the user into Stage 3, but leaves the refinement draft `in_progress` — the
 * `habits` module is still open. `resolvePlanStartPageState`'s Stage-3 branch
 * only fires for a COMPLETE draft, so a plain reload of `/plan-start` used to
 * drop the user back into Stage 2 instead of the Stage 3 they were standing in.
 *
 * The two facts that settle it are persisted and read here, never on the client:
 * the handoff marker `module_projections.products.stage3Handoff` (Task 1.4) with
 * the refined version it projected, and the existence of a still-open Stage-3
 * draft for exactly that version. A `completed` or `stale` Stage-3 draft is
 * deliberately NOT a resume target: the marker is persistent and never resets,
 * so resuming on it alone would keep pulling a user who already finished Stage 3
 * back into it.
 */

type Query = {
  select: (columns: string) => Query
  eq: (column: string, value: unknown) => Query
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>
}

export type Module1Stage3ResumeClient = RefinementStatusReadClient & {
  from: (table: string) => Query
}

export type Module1Stage3Resume = { refinedVersionId: string }

export async function loadModule1Stage3Resume(
  client: Module1Stage3ResumeClient,
  userId: string,
): Promise<Module1Stage3Resume | null> {
  try {
    const source = await loadRefinementStatusSource(client, userId)
    if (source.status !== "ok") return null

    const projection = source.moduleProjections.products
    if (!projection?.stage3Handoff || !projection.needVersionId) return null

    const states = stage2ModuleStates({
      triggerContext: source.triggerContext,
      answers: source.answers,
      completedQuestionIds: source.completedQuestionIds,
      answerProvenance: source.answerProvenance,
    })
    if (states.products.status !== "complete") return null

    const { data, error } = await client
      .from("personal_plan_product_drafts")
      .select("id")
      .eq("user_id", userId)
      .eq("refined_need_version_id", projection.needVersionId)
      .eq("status", "active")
      .maybeSingle()
    if (error || !data) return null

    return { refinedVersionId: projection.needVersionId }
  } catch {
    // A failed resume read must never take `/plan-start` down: the caller then
    // keeps today's Stage-2 fall-through.
    return null
  }
}
