import { deriveStage2TriggerContext } from "@/lib/personal-plan/refinement/stage1-adapter"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2AnswerProvenance,
  Stage2ModuleProjections,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "@/lib/personal-plan/refinement/types"
import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"
import { mapModuleProjections } from "./stage2-refinement-supabase"

/**
 * Read-only source loader for the module-status API contract (Task 1.7).
 * Deliberately bypasses `Stage2RefinementPersistence.loadOrCreate` (which
 * would INSERT a fresh draft row as a side effect) — this endpoint must stay
 * read-only, including for a plan that has never opened Stage 2 at all
 * ("fresh auto-accept"), where no draft row exists yet.
 */

type Query = {
  select: (columns: string) => Query
  eq: (column: string, value: unknown) => Query
  order: (column: string, options: { ascending: boolean }) => Query
  limit: (count: number) => Query
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>
}
export type RefinementStatusReadClient = { from: (table: string) => Query }

export type RefinementStatusSource =
  | { status: "no_personal_plan" }
  | {
      status: "ok"
      triggerContext: Stage2TriggerContext
      answers: PersonalPlanRefinementAnswersV1
      completedQuestionIds: Stage2QuestionId[]
      answerProvenance: Stage2AnswerProvenance
      moduleProjections: Stage2ModuleProjections
    }

type PlanRow = { id: string; current_initial_need_version_id: string | null }
type DraftRow = {
  answers: unknown
  completed_question_ids: unknown
  answer_provenance: unknown
  module_projections: unknown
}

async function loadPlan(
  client: RefinementStatusReadClient,
  userId: string,
): Promise<PlanRow | null> {
  const { data, error } = await client
    .from("personal_plans")
    .select("id,current_initial_need_version_id")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  return data as PlanRow | null
}

async function loadInitialNeedSnapshot(
  client: RefinementStatusReadClient,
  initialNeedVersionId: string,
): Promise<InitialNeedPlanSnapshot> {
  const { data, error } = await client
    .from("personal_plan_need_versions")
    .select("output_snapshot")
    .eq("id", initialNeedVersionId)
    .maybeSingle()
  if (error || !data) throw new Error("refinement_status_initial_need_unavailable")
  return (data as { output_snapshot: unknown }).output_snapshot as InitialNeedPlanSnapshot
}

/** Mirrors `loadExistingFromSource` in stage2-refinement-supabase.ts: an in_progress
 * draft wins over a completed one; both are bound to the plan's current initial need
 * version so a stale/superseded draft is never mistaken for the current one. */
async function loadCurrentDraft(
  client: RefinementStatusReadClient,
  planId: string,
  baseInitialNeedVersionId: string,
): Promise<DraftRow | null> {
  const columns = "answers,completed_question_ids,answer_provenance,module_projections,updated_at"
  const { data: inProgress, error: inProgressError } = await client
    .from("personal_plan_refinement_drafts")
    .select(columns)
    .eq("personal_plan_id", planId)
    .eq("base_initial_need_version_id", baseInitialNeedVersionId)
    .eq("status", "in_progress")
    .maybeSingle()
  if (inProgressError) throw inProgressError
  if (inProgress) return inProgress as DraftRow

  const { data: completed, error: completedError } = await client
    .from("personal_plan_refinement_drafts")
    .select(columns)
    .eq("personal_plan_id", planId)
    .eq("base_initial_need_version_id", baseInitialNeedVersionId)
    .eq("status", "complete")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (completedError) throw completedError
  return (completed as DraftRow | null) ?? null
}

export async function loadRefinementStatusSource(
  client: RefinementStatusReadClient,
  userId: string,
): Promise<RefinementStatusSource> {
  const plan = await loadPlan(client, userId)
  if (!plan) return { status: "no_personal_plan" }
  if (!plan.current_initial_need_version_id) {
    // Structurally, a personal_plans row is only ever created together with its initial
    // need version (Haar-Analyse + Idealplan) — this is defensive, not a modeled state.
    throw new Error("refinement_status_plan_missing_initial_need")
  }

  const triggerContext = deriveStage2TriggerContext(
    await loadInitialNeedSnapshot(client, plan.current_initial_need_version_id),
  )
  const draft = await loadCurrentDraft(client, plan.id, plan.current_initial_need_version_id)

  return {
    status: "ok",
    triggerContext,
    answers: (draft?.answers ?? {}) as PersonalPlanRefinementAnswersV1,
    completedQuestionIds: (Array.isArray(draft?.completed_question_ids)
      ? draft.completed_question_ids
      : []) as Stage2QuestionId[],
    answerProvenance: (draft?.answer_provenance ?? {}) as Stage2AnswerProvenance,
    moduleProjections: mapModuleProjections(draft?.module_projections),
  }
}
