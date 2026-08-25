import type { SupabaseClient } from "@supabase/supabase-js"

import { deriveStage2TriggerContext } from "@/lib/personal-plan/refinement/stage1-adapter"
import { ignoresStoredStage2HeatProtection } from "@/lib/personal-plan/refinement/heat-events"
import {
  STAGE2_QUESTION_PATH_VERSION,
  type PersonalPlanRefinementAnswersV1,
  type Stage2HeatEventSource,
} from "@/lib/personal-plan/refinement/types"
import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"
import type {
  Stage2PersistedDraft,
  Stage2RefinementPersistence,
  Stage2RefinementResumeReader,
} from "./stage2-refinement-service"

/**
 * Read-time compatibility decoders, not migrations. The stored row is never
 * rewritten; each rule below only changes what the application reads out of it.
 * This is the `D8` decoder half of the path version in
 * `refinement/types.ts` (`STAGE2_QUESTION_PATH_VERSION`).
 *
 * Path version 1 -> 2:
 *
 * - `toolSections` -> `toolFamiliesWithSomething`. Refinement answers were
 *   briefly persisted under the old key (same `ToolFamily[]` shape; only the key
 *   changed). Without this, an old draft resumes at a blank Tools overview and a
 *   subsequent overview submission materializes an explicit `[]` for every
 *   family the user had actually reported -- silently destroying their prior
 *   selections (see C7). The old value wins only when the new key is absent, so
 *   a row already written under the current key is untouched.
 * - `heatEvents["heat:diffuser_airflow_shaping"].protectionConsistency` is
 *   dropped (`R1`). The diffuser source no longer raises the heat-protection
 *   question, its tier is `not_needed`, and nothing may derive from the value a
 *   row stored under the old contract. Dropping it on read is what keeps that
 *   row valid -- and therefore complete -- under today's contract (fixture 125).
 */
export function decodeStage2RefinementAnswers(raw: unknown): PersonalPlanRefinementAnswersV1 {
  if (!raw || typeof raw !== "object") return {} as PersonalPlanRefinementAnswersV1
  const answers = { ...(raw as Record<string, unknown>) }
  if (answers.toolFamiliesWithSomething === undefined && "toolSections" in answers) {
    answers.toolFamiliesWithSomething = answers.toolSections
  }
  delete answers.toolSections
  return decodeLegacyHeatProtection(answers as PersonalPlanRefinementAnswersV1)
}

function decodeLegacyHeatProtection(
  answers: PersonalPlanRefinementAnswersV1,
): PersonalPlanRefinementAnswersV1 {
  const heatEvents = answers.heatEvents
  if (!heatEvents) return answers
  const decoded = Object.fromEntries(
    Object.entries(heatEvents).map(([id, event]) => {
      const source = id.slice("heat:".length) as Stage2HeatEventSource
      if (!id.startsWith("heat:") || !ignoresStoredStage2HeatProtection(source)) return [id, event]
      const decodedEvent = { ...event }
      delete decodedEvent.protectionConsistency
      return [id, decodedEvent]
    }),
  )
  return { ...answers, heatEvents: decoded }
}

type AdminClient = SupabaseClient

/** Server-only persistence adapter. It is intentionally supplied only to route composition. */
export function createSupabaseStage2RefinementPersistence(
  client: AdminClient,
  options: {
    /**
     * Server-owned Hair Tools rollout for this owner. Omitted means off, so the
     * released Feinschliff question path is unchanged.
     */
    toolsEnabled?: (userId: string) => Promise<boolean>
  } = {},
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
      triggerContext: {
        ...deriveStage2TriggerContext(initial.output_snapshot as InitialNeedPlanSnapshot),
        toolsEnabled: (await options.toolsEnabled?.(userId)) === true,
      },
    }
  }

  async function loadExistingFromSource(
    source: Awaited<ReturnType<typeof loadSource>>,
  ): Promise<Stage2PersistedDraft | null> {
    const { plan, initial, triggerContext } = source
    const { data: current, error: currentError } = await client
      .from("personal_plan_refinement_drafts")
      .select(
        "id,personal_plan_id,base_initial_need_version_id,schema_version,answers,completed_question_ids,revision,status,result_refined_need_version_id",
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
        "id,personal_plan_id,base_initial_need_version_id,schema_version,answers,completed_question_ids,revision,status,result_refined_need_version_id",
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
          // `D8`: a new draft is written under the contract in force now. The
          // derived `pathVersion` follows the stored column, so an existing v1
          // row keeps reading as `stage2-v1` and completing under its own
          // completion-time contract.
          schema_version: STAGE2_QUESTION_PATH_VERSION,
          answers: {},
          completed_question_ids: [],
        })
        .select(
          "id,personal_plan_id,base_initial_need_version_id,schema_version,answers,completed_question_ids,revision,status,result_refined_need_version_id",
        )
        .single()
      if (!createError && created) return mapDraft(created, triggerContext, initial)

      // The partial unique index turns concurrent creation into a safe read-after-conflict.
      const { data: raced, error: racedError } = await client
        .from("personal_plan_refinement_drafts")
        .select(
          "id,personal_plan_id,base_initial_need_version_id,schema_version,answers,completed_question_ids,revision,status,result_refined_need_version_id",
        )
        .eq("personal_plan_id", plan.id)
        .eq("base_initial_need_version_id", initial.id)
        .eq("status", "in_progress")
        .single()
      if (racedError || !raced) throw new Error("stage2_draft_create_failed")
      return mapDraft(raced, triggerContext, initial)
    },
    async reopen({ userId, draft }) {
      const insert = {
        user_id: userId,
        personal_plan_id: draft.personalPlanId,
        base_initial_need_version_id: draft.baseInitialNeedVersionId,
        schema_version: draft.schemaVersion,
        answers: draft.answers,
        completed_question_ids: draft.completedQuestionIds,
        revision: draft.revision,
      }
      const columns =
        "id,personal_plan_id,base_initial_need_version_id,schema_version,answers,completed_question_ids,revision,status,result_refined_need_version_id"
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
  }
}

function mapDraft(
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
    answers: decodeStage2RefinementAnswers(row.answers),
    completedQuestionIds: (row.completed_question_ids ??
      []) as Stage2PersistedDraft["completedQuestionIds"],
    revision: Number(row.revision),
    status: row.status as Stage2PersistedDraft["status"],
    refinedVersionId:
      typeof row.result_refined_need_version_id === "string"
        ? row.result_refined_need_version_id
        : null,
  }
}
