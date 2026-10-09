import type { SupabaseClient } from "@supabase/supabase-js"

import { deriveStage2TriggerContext } from "@/lib/personal-plan/refinement/stage1-adapter"
import { STAGE2_MODULES, type Stage2ModuleProjections } from "@/lib/personal-plan/refinement/types"
import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"
import type {
  Stage2PersistedDraft,
  Stage2RefinementPersistence,
  Stage2RefinementResumeReader,
} from "./stage2-refinement-service"

type AdminClient = SupabaseClient

/** Server-only persistence adapter. It is intentionally supplied only to route composition. */
export function createSupabaseStage2RefinementPersistence(
  client: AdminClient,
): Stage2RefinementPersistence & Stage2RefinementResumeReader {
  async function loadSource(userId: string) {
    const { data: plan, error: planError } = await client
      .from("personal_plans")
      .select("id,current_initial_need_version_id")
      .eq("user_id", userId)
      .maybeSingle()
    if (planError || !plan?.current_initial_need_version_id)
      throw new Error("stage2_plan_unavailable")

    const { data: initial, error: initialError } = await client
      .from("personal_plan_need_versions")
      .select(
        "id,prepared_artifact_source_id,stage1_source_kind,stage1_source_lead_id,input_snapshot,output_snapshot",
      )
      .eq("id", plan.current_initial_need_version_id)
      .eq("user_id", userId)
      .maybeSingle()
    if (
      initialError ||
      !initial ||
      (!initial.prepared_artifact_source_id && !initial.stage1_source_lead_id)
    )
      throw new Error("stage2_initial_need_unavailable")

    return {
      plan,
      initial,
      triggerContext: deriveStage2TriggerContext(
        initial.output_snapshot as InitialNeedPlanSnapshot,
      ),
    }
  }

  async function loadExistingFromSource(
    source: Awaited<ReturnType<typeof loadSource>>,
  ): Promise<Stage2PersistedDraft | null> {
    const { plan, initial, triggerContext } = source
    const { data: current, error: currentError } = await client
      .from("personal_plan_refinement_drafts")
      .select(
        "id,personal_plan_id,base_initial_need_version_id,schema_version,answers,completed_question_ids,answer_provenance,module_projections,revision,status,result_refined_need_version_id",
      )
      .eq("personal_plan_id", plan.id)
      .eq("base_initial_need_version_id", initial.id)
      .eq("status", "in_progress")
      .maybeSingle()
    if (currentError) throw new Error("stage2_draft_read_failed")
    if (current) return mapDraft(current, triggerContext, initial)

    const { data: completed, error: completedError } = await client
      .from("personal_plan_refinement_drafts")
      .select(
        "id,personal_plan_id,base_initial_need_version_id,schema_version,answers,completed_question_ids,answer_provenance,module_projections,revision,status,result_refined_need_version_id",
      )
      .eq("personal_plan_id", plan.id)
      .eq("base_initial_need_version_id", initial.id)
      .eq("status", "complete")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (completedError) throw new Error("stage2_completed_draft_read_failed")
    return completed ? mapDraft(completed, triggerContext, initial) : null
  }

  return {
    async loadExisting(userId) {
      return loadExistingFromSource(await loadSource(userId))
    },
    async loadOrCreate(userId) {
      const source = await loadSource(userId)
      const existing = await loadExistingFromSource(source)
      if (existing) return existing
      const { plan, initial, triggerContext } = source

      const { data: created, error: createError } = await client
        .from("personal_plan_refinement_drafts")
        .insert({
          user_id: userId,
          personal_plan_id: plan.id,
          base_initial_need_version_id: initial.id,
          schema_version: 1,
          answers: {},
          completed_question_ids: [],
          answer_provenance: {},
        })
        .select(
          "id,personal_plan_id,base_initial_need_version_id,schema_version,answers,completed_question_ids,answer_provenance,module_projections,revision,status,result_refined_need_version_id",
        )
        .single()
      if (!createError && created) return mapDraft(created, triggerContext, initial)

      // The partial unique index turns concurrent creation into a safe read-after-conflict.
      const { data: raced, error: racedError } = await client
        .from("personal_plan_refinement_drafts")
        .select(
          "id,personal_plan_id,base_initial_need_version_id,schema_version,answers,completed_question_ids,answer_provenance,module_projections,revision,status,result_refined_need_version_id",
        )
        .eq("personal_plan_id", plan.id)
        .eq("base_initial_need_version_id", initial.id)
        .eq("status", "in_progress")
        .single()
      if (racedError || !raced) throw new Error("stage2_draft_create_failed")
      return mapDraft(raced, triggerContext, initial)
    },
    async reopen({ userId, draft }) {
      // The successor draft starts with an empty projection lineage: it has not
      // projected any version itself, and must never claim its predecessor's.
      const insert = {
        user_id: userId,
        personal_plan_id: draft.personalPlanId,
        base_initial_need_version_id: draft.baseInitialNeedVersionId,
        schema_version: draft.schemaVersion,
        answers: draft.answers,
        completed_question_ids: draft.completedQuestionIds,
        answer_provenance: draft.answerProvenance,
        revision: draft.revision,
      }
      const columns =
        "id,personal_plan_id,base_initial_need_version_id,schema_version,answers,completed_question_ids,answer_provenance,module_projections,revision,status,result_refined_need_version_id"
      const { data: created, error } = await client
        .from("personal_plan_refinement_drafts")
        .insert(insert)
        .select(columns)
        .single()
      const initial = {
        prepared_artifact_source_id: draft.preparedArtifactSourceId,
        stage1_source_lead_id: null,
        input_snapshot: draft.baseInputSnapshot,
      }
      if (!error && created) return mapDraft(created, draft.triggerContext, initial)
      const { data: raced, error: racedError } = await client
        .from("personal_plan_refinement_drafts")
        .select(columns)
        .eq("personal_plan_id", draft.personalPlanId)
        .eq("base_initial_need_version_id", draft.baseInitialNeedVersionId)
        .eq("status", "in_progress")
        .single()
      if (racedError || !raced) throw new Error("stage2_draft_reopen_failed")
      return mapDraft(raced, draft.triggerContext, initial)
    },
    async save(input) {
      const { data, error } = await client.rpc("personal_plan_save_refinement_draft", {
        p_user_id: input.userId,
        p_draft_id: input.draft.id,
        p_expected_revision: input.expectedRevision,
        p_answers: input.answers,
        p_completed_question_ids: input.completedQuestionIds,
        p_answer_provenance: input.answerProvenance,
      })
      if (error || !data) throw new Error("stage2_save_failed")
      if (data.outcome === "revision_conflict")
        return { outcome: "revision_conflict", revision: Number(data.currentRevision) }
      if (data.outcome !== "saved") throw new Error("stage2_save_rejected")
      return { outcome: "saved", revision: Number(data.revision) }
    },
    async complete(input) {
      const { data, error } = await client.rpc("personal_plan_complete_refinement_draft", {
        p_user_id: input.userId,
        p_personal_plan_id: input.draft.personalPlanId,
        p_draft_id: input.draft.id,
        p_expected_revision: input.expectedRevision,
        p_schema_version: input.schemaVersion,
        p_computation_version: input.computationVersion,
        p_input_hash: input.inputHash,
        p_input_snapshot: input.inputSnapshot,
        p_output_snapshot: input.outputSnapshot,
      })
      if (error || !data) throw new Error("stage2_complete_failed")
      if (data.outcome === "revision_conflict")
        return { outcome: "revision_conflict", revision: Number(data.currentRevision ?? 0) }
      if (data.outcome === "stale_source") return { outcome: "stale_source" }
      if (
        (data.outcome === "completed" || data.outcome === "already_completed") &&
        data.refinedNeedVersionId
      ) {
        return { outcome: data.outcome, refinedVersionId: String(data.refinedNeedVersionId) }
      }
      throw new Error("stage2_complete_rejected")
    },
    async completeModule(input) {
      const { data, error } = await client.rpc("personal_plan_complete_stage2_module", {
        p_user_id: input.userId,
        p_personal_plan_id: input.draft.personalPlanId,
        p_draft_id: input.draft.id,
        p_module: input.module,
        p_expected_revision: input.expectedRevision,
        p_schema_version: input.schemaVersion,
        p_computation_version: input.computationVersion,
        p_input_hash: input.inputHash,
        p_input_snapshot: input.inputSnapshot,
        p_output_snapshot: input.outputSnapshot,
      })
      if (error || !data) throw new Error("stage2_complete_module_failed")
      if (data.outcome === "revision_conflict")
        return { outcome: "revision_conflict", revision: Number(data.currentRevision ?? 0) }
      if (data.outcome === "stale_source") return { outcome: "stale_source" }
      if (
        (data.outcome === "completed" || data.outcome === "already_projected") &&
        data.refinedNeedVersionId
      ) {
        return {
          outcome: data.outcome,
          refinedVersionId: String(data.refinedNeedVersionId),
          stage3Handoff: data.stage3Handoff === true,
        }
      }
      throw new Error("stage2_complete_module_rejected")
    },
  }
}

/**
 * Reads the per-module projection lineage back into its typed shape. Only the
 * fields the code consumes are mapped; the row also carries a `projectedAt`
 * audit timestamp per entry that no read path needs. An unreadable or legacy
 * entry degrades to "no projection recorded" rather than a hard load failure.
 */
export function mapModuleProjections(value: unknown): Stage2ModuleProjections {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const projections: Stage2ModuleProjections = {}
  for (const stage2Module of STAGE2_MODULES) {
    const entry = (value as Record<string, unknown>)[stage2Module]
    if (!entry || typeof entry !== "object") continue
    const { needVersionId, projectedAtRevision, stage3Handoff } = entry as Record<string, unknown>
    if (typeof needVersionId !== "string" || !Number.isFinite(Number(projectedAtRevision))) continue
    projections[stage2Module] = {
      needVersionId,
      projectedAtRevision: Number(projectedAtRevision),
      stage3Handoff: stage3Handoff === true,
    }
  }
  return projections
}

export function mapDraft(
  row: Record<string, unknown>,
  triggerContext: Stage2PersistedDraft["triggerContext"],
  initial: {
    prepared_artifact_source_id: string | null
    stage1_source_lead_id?: string | null
    input_snapshot: unknown
  },
): Stage2PersistedDraft {
  const stage1SourceId =
    initial.prepared_artifact_source_id ?? initial.stage1_source_lead_id ?? null
  if (!stage1SourceId) throw new Error("stage2_initial_source_missing")

  return {
    id: String(row.id),
    personalPlanId: String(row.personal_plan_id),
    baseInitialNeedVersionId: String(row.base_initial_need_version_id),
    schemaVersion: Number(row.schema_version),
    // Stage 2 currently names this generic computation input after the original
    // artifact source. Legacy Stage 1 snapshots use their exact lead id here.
    preparedArtifactSourceId: stage1SourceId,
    baseInputSnapshot: initial.input_snapshot as Stage2PersistedDraft["baseInputSnapshot"],
    pathVersion: `stage2-v${String(row.schema_version)}`,
    triggerContext,
    answers: (row.answers ?? {}) as Stage2PersistedDraft["answers"],
    completedQuestionIds: (row.completed_question_ids ??
      []) as Stage2PersistedDraft["completedQuestionIds"],
    answerProvenance: (row.answer_provenance ?? {}) as Stage2PersistedDraft["answerProvenance"],
    moduleProjections: mapModuleProjections(row.module_projections),
    revision: Number(row.revision),
    status: row.status as Stage2PersistedDraft["status"],
    refinedVersionId:
      typeof row.result_refined_need_version_id === "string"
        ? row.result_refined_need_version_id
        : null,
  }
}
