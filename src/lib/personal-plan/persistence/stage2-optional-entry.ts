import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { deriveStage2TriggerContext } from "@/lib/personal-plan/refinement/stage1-adapter"
import {
  STAGE2_MODULES,
  type PersonalPlanRefinementAnswersV1,
  type Stage2AnswerProvenance,
  type Stage2Module,
  type Stage2QuestionId,
} from "@/lib/personal-plan/refinement/types"
import type { JsonValue } from "./index"
import { mapDraft } from "./stage2-refinement-supabase"
import type { Stage2PersistedDraft } from "./stage2-refinement-service"

export const OPEN_OPTIONAL_STAGE2_REFINEMENT_RPC = "personal_plan_open_optional_refinement_v1"

export type OptionalStage2Context = {
  personalPlanId: string
  currentInitialNeedVersionId: string
  initial: {
    prepared_artifact_source_id: string | null
    stage1_source_lead_id?: string | null
    input_snapshot: unknown
    output_snapshot: unknown
  }
  currentDraft: Stage2PersistedDraft | null
  latestCompleteDraft: Stage2PersistedDraft | null
}

export type OptionalStage2SeedOutcome = "applied" | "nothing_usable" | "skipped_existing_state"

export type OptionalStage2Seed = {
  outcome: OptionalStage2SeedOutcome
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: Stage2QuestionId[]
  answerProvenance: Stage2AnswerProvenance
  sourceFingerprint: string
  sourceIds: string[]
}

export type OpenPreparedOptionalDraftInput = {
  userId: string
  module: Stage2Module
  personalPlanId: string
  baseInitialNeedVersionId: string
  parentDraftId: string | null
  parentRevision: number | null
  context: OptionalStage2Context
  seed: OptionalStage2Seed
}

export type Stage2OptionalEntryClient = SupabaseClient

export type Stage2OptionalEntryDeps = {
  loadContext: (userId: string) => Promise<OptionalStage2Context>
  openPreparedDraft: (input: OpenPreparedOptionalDraftInput) => Promise<Stage2PersistedDraft>
}

export class Stage2OptionalEntryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "Stage2OptionalEntryError"
  }
}

export async function openOptionalRefinement(input: {
  userId: string
  module: Stage2Module
  client?: Stage2OptionalEntryClient
  deps?: Stage2OptionalEntryDeps
}): Promise<Stage2PersistedDraft> {
  if (!STAGE2_MODULES.includes(input.module)) {
    throw new Stage2OptionalEntryError("invalid_optional_module")
  }
  const userId = normalizeRequiredId(input.userId, "userId")
  const deps = input.deps ?? defaultDeps(input.client)
  const context = await deps.loadContext(userId)

  if (context.currentDraft) {
    return deps.openPreparedDraft({
      userId,
      module: input.module,
      personalPlanId: context.personalPlanId,
      baseInitialNeedVersionId: context.currentInitialNeedVersionId,
      parentDraftId: null,
      parentRevision: null,
      context,
      seed: skippedSeed(),
    })
  }

  const parentDraft = context.latestCompleteDraft
  if (!parentDraft) {
    throw new Stage2OptionalEntryError("stage2_optional_parent_unavailable")
  }

  return deps.openPreparedDraft({
    userId,
    module: input.module,
    personalPlanId: context.personalPlanId,
    baseInitialNeedVersionId: context.currentInitialNeedVersionId,
    parentDraftId: parentDraft.id,
    parentRevision: parentDraft.revision,
    context,
    seed: skippedSeed(),
  })
}

function defaultDeps(client: Stage2OptionalEntryClient | undefined): Stage2OptionalEntryDeps {
  if (!client) throw new Stage2OptionalEntryError("stage2_optional_client_required")
  return {
    loadContext: (userId) => loadOptionalStage2Context(client, userId),
    openPreparedDraft: (request) => openPreparedDraftWithRpc(client, request),
  }
}

function normalizeRequiredId(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Stage2OptionalEntryError(`${field} is required`)
  return normalized
}

function skippedSeed(): OptionalStage2Seed {
  return {
    outcome: "skipped_existing_state",
    answers: {},
    completedQuestionIds: [],
    answerProvenance: {},
    sourceFingerprint: "legacy-prefill-v1:skipped",
    sourceIds: [],
  }
}

async function loadOptionalStage2Context(
  client: Stage2OptionalEntryClient,
  userId: string,
): Promise<OptionalStage2Context> {
  const { data: plan, error: planError } = await client
    .from("personal_plans")
    .select("id,current_initial_need_version_id")
    .eq("user_id", userId)
    .maybeSingle()
  if (planError || !plan?.current_initial_need_version_id) {
    throw new Stage2OptionalEntryError("stage2_plan_unavailable")
  }

  const { data: initial, error: initialError } = await client
    .from("personal_plan_need_versions")
    .select("id,prepared_artifact_source_id,stage1_source_lead_id,input_snapshot,output_snapshot")
    .eq("id", String(plan.current_initial_need_version_id))
    .eq("user_id", userId)
    .maybeSingle()
  if (initialError || !initial) {
    throw new Stage2OptionalEntryError("stage2_initial_need_unavailable")
  }
  const triggerContext = deriveStage2TriggerContext(initial.output_snapshot as never)
  const columns =
    "id,personal_plan_id,base_initial_need_version_id,schema_version,answers,completed_question_ids,answer_provenance,module_projections,revision,status,result_refined_need_version_id"

  const { data: current, error: currentError } = await client
    .from("personal_plan_refinement_drafts")
    .select(columns)
    .eq("personal_plan_id", String(plan.id))
    .eq("base_initial_need_version_id", String(initial.id))
    .eq("status", "in_progress")
    .maybeSingle()
  if (currentError) throw new Stage2OptionalEntryError("stage2_draft_read_failed")

  const { data: completed, error: completedError } = await client
    .from("personal_plan_refinement_drafts")
    .select(columns)
    .eq("personal_plan_id", String(plan.id))
    .eq("base_initial_need_version_id", String(initial.id))
    .eq("status", "complete")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (completedError) throw new Stage2OptionalEntryError("stage2_completed_draft_read_failed")
  return {
    personalPlanId: String(plan.id),
    currentInitialNeedVersionId: String(initial.id),
    initial: initial as OptionalStage2Context["initial"],
    currentDraft: current ? mapDraft(current, triggerContext, initial) : null,
    latestCompleteDraft: completed ? mapDraft(completed, triggerContext, initial) : null,
  }
}

async function openPreparedDraftWithRpc(
  client: Stage2OptionalEntryClient,
  input: OpenPreparedOptionalDraftInput,
): Promise<Stage2PersistedDraft> {
  const { data, error } = await client.rpc(OPEN_OPTIONAL_STAGE2_REFINEMENT_RPC, {
    p_user_id: input.userId,
    p_module: input.module,
    p_expected_personal_plan_id: input.personalPlanId,
    p_expected_base_initial_need_version_id: input.baseInitialNeedVersionId,
    p_expected_parent_draft_id: input.parentDraftId,
    p_expected_parent_revision: input.parentRevision,
    p_seed_outcome: input.seed.outcome,
    p_seed_answers: input.seed.answers,
    p_seed_completed_question_ids: input.seed.completedQuestionIds,
    p_seed_answer_provenance: input.seed.answerProvenance,
    p_source_fingerprint: input.seed.sourceFingerprint,
    p_source_ids: input.seed.sourceIds,
  })
  if (error || !data || typeof data !== "object") {
    throw new Stage2OptionalEntryError("stage2_optional_open_failed")
  }
  const result = data as { outcome?: unknown; draft?: unknown }
  if (result.outcome === "stale_source" || result.outcome === "revision_conflict") {
    throw new Stage2OptionalEntryError("revision_conflict")
  }
  if (
    result.outcome !== "applied" &&
    result.outcome !== "nothing_usable" &&
    result.outcome !== "skipped_existing_state" &&
    result.outcome !== "already_consumed" &&
    result.outcome !== "skip_not_eligible"
  ) {
    throw new Stage2OptionalEntryError("stage2_optional_open_rejected")
  }
  if (!result.draft || typeof result.draft !== "object") {
    throw new Stage2OptionalEntryError("stage2_optional_draft_missing")
  }
  return mapDraft(
    result.draft as Record<string, unknown>,
    deriveStage2TriggerContext(input.context.initial.output_snapshot as never),
    {
      prepared_artifact_source_id: input.context.initial.prepared_artifact_source_id,
      stage1_source_lead_id: input.context.initial.stage1_source_lead_id,
      input_snapshot: input.context.initial.input_snapshot as JsonValue,
    },
  )
}
