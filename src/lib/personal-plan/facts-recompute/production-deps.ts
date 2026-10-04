import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { loadUserFacts } from "@/lib/user-facts/read"

import { syncPlanWithFacts } from "./sync-plan-with-facts"
import type {
  FactsRecomputeDeps,
  FactsRecomputeSourceDraft,
  PersonalPlanRebaseOnFactsResult,
  SyncPlanWithFacts,
} from "./types"

const SOURCE_DRAFT_COLUMNS = "id,status,revision,answers,completed_question_ids,answer_provenance"

/** An RPC error with its Postgres SQLSTATE, so the lane can retry deadlocks (R14). */
export class FactsRebaseRpcError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message)
    this.name = "FactsRebaseRpcError"
  }
}

function mapSourceDraft(row: Record<string, unknown>): FactsRecomputeSourceDraft {
  return {
    id: String(row.id),
    status: row.status as FactsRecomputeSourceDraft["status"],
    revision: Number(row.revision),
    answers: (row.answers ?? {}) as FactsRecomputeSourceDraft["answers"],
    completedQuestionIds: (row.completed_question_ids ??
      []) as FactsRecomputeSourceDraft["completedQuestionIds"],
    answerProvenance: (row.answer_provenance ??
      {}) as FactsRecomputeSourceDraft["answerProvenance"],
  }
}

/**
 * Production wiring of `syncPlanWithFacts` over one admin (service-role) client. Reads mirror
 * the code whose view the RPC re-checks under lock: the source draft is chosen exactly like
 * `loadExistingFromSource` (stage2-refinement-supabase.ts) and the RPC's step 4 (in-progress
 * draft on the current initial, else its latest complete one by `updated_at DESC, id DESC`).
 * Building the deps does no I/O, so routes can construct them per request.
 */
export function createProductionFactsRecomputeDeps(admin: SupabaseClient): FactsRecomputeDeps {
  return {
    async loadPlan(userId) {
      const { data, error } = await admin
        .from("personal_plans")
        .select(
          "id,revision,current_initial_need_version_id,current_refined_need_version_id,active_routine_version_id",
        )
        .eq("user_id", userId)
        .maybeSingle()
      if (error) throw new Error(`facts_recompute_plan_read_failed: ${error.message}`)
      if (!data) return null
      return {
        id: String(data.id),
        revision: Number(data.revision),
        currentInitialNeedVersionId: data.current_initial_need_version_id ?? null,
        currentRefinedNeedVersionId: data.current_refined_need_version_id ?? null,
        activeRoutineVersionId: data.active_routine_version_id ?? null,
      }
    },
    async loadInitialVersion({ userId, needVersionId }) {
      const { data, error } = await admin
        .from("personal_plan_need_versions")
        .select("id,input_hash,prepared_artifact_source_id,stage1_source_lead_id")
        .eq("id", needVersionId)
        .eq("user_id", userId)
        .eq("kind", "initial")
        .maybeSingle()
      if (error) throw new Error(`facts_recompute_initial_read_failed: ${error.message}`)
      if (!data) return null
      return {
        id: String(data.id),
        inputHash: String(data.input_hash),
        preparedArtifactSourceId: data.prepared_artifact_source_id ?? null,
        stage1SourceLeadId: data.stage1_source_lead_id ?? null,
      }
    },
    loadFacts: (userId) => loadUserFacts(admin, userId),
    async findInitialVersionId({ personalPlanId, inputHash }) {
      const { data, error } = await admin
        .from("personal_plan_need_versions")
        .select("id")
        .eq("personal_plan_id", personalPlanId)
        .eq("kind", "initial")
        .eq("input_hash", inputHash)
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(`facts_recompute_initial_lookup_failed: ${error.message}`)
      return data ? String(data.id) : null
    },
    async loadSourceDraft({ personalPlanId, initialNeedVersionId }) {
      const { data: open, error: openError } = await admin
        .from("personal_plan_refinement_drafts")
        .select(SOURCE_DRAFT_COLUMNS)
        .eq("personal_plan_id", personalPlanId)
        .eq("base_initial_need_version_id", initialNeedVersionId)
        .eq("status", "in_progress")
        .maybeSingle()
      if (openError) throw new Error(`facts_recompute_draft_read_failed: ${openError.message}`)
      if (open) return mapSourceDraft(open)

      const { data: completed, error: completedError } = await admin
        .from("personal_plan_refinement_drafts")
        .select(SOURCE_DRAFT_COLUMNS)
        .eq("personal_plan_id", personalPlanId)
        .eq("base_initial_need_version_id", initialNeedVersionId)
        .eq("status", "complete")
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (completedError) {
        throw new Error(`facts_recompute_completed_draft_read_failed: ${completedError.message}`)
      }
      return completed ? mapSourceDraft(completed) : null
    },
    async rebase(params) {
      const { data, error } = await admin.rpc("personal_plan_rebase_on_facts_v1", params)
      if (error) {
        throw new FactsRebaseRpcError(
          `personal_plan_rebase_on_facts_v1 failed: ${error.message}`,
          typeof error.code === "string" ? error.code : null,
        )
      }
      if (!data || typeof data !== "object" || typeof data.status !== "string") {
        throw new Error("personal_plan_rebase_on_facts_v1 returned no status")
      }
      return normalizeRebaseResult(data as Record<string, unknown>)
    },
    newId: () => crypto.randomUUID(),
    now: () => new Date(),
  }
}

/** `revision` is a bigint column: PostgREST may return it as a string. */
function normalizeRebaseResult(data: Record<string, unknown>): PersonalPlanRebaseOnFactsResult {
  const result = { ...data }
  for (const key of ["revision", "factsRevision", "currentRevision", "currentDraftRevision"]) {
    if (typeof result[key] === "string") result[key] = Number(result[key])
  }
  return result as PersonalPlanRebaseOnFactsResult
}

/** The lane as routes and services receive it; cheap and side-effect free to construct. */
export function createProductionSyncPlanWithFacts(admin: SupabaseClient): SyncPlanWithFacts {
  const deps = createProductionFactsRecomputeDeps(admin)
  return (input) => syncPlanWithFacts(deps, input)
}
