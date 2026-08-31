import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  mapLegacyRefinementPrefill,
  type LegacyRefinementPrefill,
  type LegacyRefinementPrefillInput,
  type LegacyProductUsageRow,
} from "@/lib/personal-plan/legacy-prefill"
import { pruneAnswerProvenance } from "@/lib/personal-plan/refinement/answer-provenance"
import { resolveStage2RefinementContract } from "@/lib/personal-plan/refinement/question-path"
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
  legacyPrefillEligible: boolean
  legacyPrefillStage2Receipt?: unknown
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
  loadLegacyPrefillInput: (userId: string) => Promise<LegacyRefinementPrefillInput>
  openPreparedDraft: (input: OpenPreparedOptionalDraftInput) => Promise<Stage2PersistedDraft>
}

export class Stage2OptionalEntryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "Stage2OptionalEntryError"
  }
}

const stage2AnswerQuestionIds: Record<keyof PersonalPlanRefinementAnswersV1, Stage2QuestionId[]> = {
  currentProductCategories: ["current_product_categories"],
  wetWashFrequency: ["wet_wash_frequency"],
  scalpIrritationDetail: ["scalp_irritation_detail"],
  dryShampooBridgePreference: ["dry_shampoo_bridge_preference"],
  dryShampooVisibleHairColor: ["dry_shampoo_visible_hair_color"],
  oilPurposes: ["oil_purposes"],
  towel: ["towel_handling"],
  dryingRoutes: ["drying_routes"],
  additionalHeatTools: ["additional_heat_tools"],
  heatEvents: [],
  nightProtection: ["night_protection"],
}

export function buildOptionalStage2Seed(input: {
  parentDraft: Stage2PersistedDraft
  prefill: LegacyRefinementPrefill
}): OptionalStage2Seed {
  const mappedQuestionIds = new Set<Stage2QuestionId>()
  for (const key of Object.keys(input.prefill.stage2Answers) as Array<
    keyof PersonalPlanRefinementAnswersV1
  >) {
    for (const questionId of stage2AnswerQuestionIds[key] ?? []) mappedQuestionIds.add(questionId)
  }

  const answers = {
    ...structuredClone(input.parentDraft.answers),
    ...structuredClone(input.prefill.stage2Answers),
  }
  const completedCandidates = [
    ...input.parentDraft.completedQuestionIds,
    ...Array.from(mappedQuestionIds),
  ]
  const contract = resolveStage2RefinementContract({
    triggerContext: input.parentDraft.triggerContext,
    answers,
    completedQuestionIds: completedCandidates,
  })
  const provenance: Stage2AnswerProvenance = { ...input.parentDraft.answerProvenance }
  for (const questionId of mappedQuestionIds) {
    if (contract.completedQuestionIds.includes(questionId)) provenance[questionId] = "user"
  }

  return {
    outcome:
      mappedQuestionIds.size > 0 && Object.keys(input.prefill.stage2Answers).length > 0
        ? "applied"
        : "nothing_usable",
    answers: withoutUndefinedValues(contract.answers),
    completedQuestionIds: contract.completedQuestionIds,
    answerProvenance: pruneAnswerProvenance(provenance, contract.completedQuestionIds),
    sourceFingerprint: input.prefill.sourceFingerprint,
    sourceIds: input.prefill.sourceIds,
  }
}

function withoutUndefinedValues(
  answers: PersonalPlanRefinementAnswersV1,
): PersonalPlanRefinementAnswersV1 {
  return Object.fromEntries(
    Object.entries(answers).filter(([, value]) => value !== undefined),
  ) as PersonalPlanRefinementAnswersV1
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

  if (
    !context.legacyPrefillEligible ||
    context.legacyPrefillStage2Receipt ||
    !isFullyAssumedCompleteParent(parentDraft)
  ) {
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

  const legacyInput = await deps.loadLegacyPrefillInput(userId)
  const seed = buildOptionalStage2Seed({
    parentDraft,
    prefill: mapLegacyRefinementPrefill(legacyInput),
  })

  return deps.openPreparedDraft({
    userId,
    module: input.module,
    personalPlanId: context.personalPlanId,
    baseInitialNeedVersionId: context.currentInitialNeedVersionId,
    parentDraftId: parentDraft.id,
    parentRevision: parentDraft.revision,
    context,
    seed,
  })
}

function defaultDeps(client: Stage2OptionalEntryClient | undefined): Stage2OptionalEntryDeps {
  if (!client) throw new Stage2OptionalEntryError("stage2_optional_client_required")
  return {
    loadContext: (userId) => loadOptionalStage2Context(client, userId),
    loadLegacyPrefillInput: (userId) => loadLegacyRefinementPrefillInput(client, userId),
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

function isFullyAssumedCompleteParent(draft: Stage2PersistedDraft): boolean {
  return (
    draft.status === "complete" &&
    draft.completedQuestionIds.length > 0 &&
    draft.completedQuestionIds.every((id) => draft.answerProvenance[id] === "assumed")
  )
}

async function loadOptionalStage2Context(
  client: Stage2OptionalEntryClient,
  userId: string,
): Promise<OptionalStage2Context> {
  const { data: plan, error: planError } = await client
    .from("personal_plans")
    .select(
      "id,current_initial_need_version_id,enrollment_purchase_source_id,active_routine_version_id,legacy_prefill_v1",
    )
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
  const legacyPrefillEligible = await loadLegacyPrefillEligibility(client, {
    userId,
    enrollmentId:
      typeof plan.enrollment_purchase_source_id === "string"
        ? plan.enrollment_purchase_source_id
        : null,
    activeRoutineVersionId:
      typeof plan.active_routine_version_id === "string" ? plan.active_routine_version_id : null,
  })

  return {
    personalPlanId: String(plan.id),
    currentInitialNeedVersionId: String(initial.id),
    initial: initial as OptionalStage2Context["initial"],
    currentDraft: current ? mapDraft(current, triggerContext, initial) : null,
    latestCompleteDraft: completed ? mapDraft(completed, triggerContext, initial) : null,
    legacyPrefillEligible,
    legacyPrefillStage2Receipt:
      typeof plan.legacy_prefill_v1 === "object" && plan.legacy_prefill_v1
        ? (plan.legacy_prefill_v1 as Record<string, unknown>).stage2
        : null,
  }
}

async function loadLegacyPrefillEligibility(
  client: Stage2OptionalEntryClient,
  input: { userId: string; enrollmentId: string | null; activeRoutineVersionId: string | null },
): Promise<boolean> {
  if (!input.enrollmentId || !input.activeRoutineVersionId) return false
  const { data, error } = await client
    .from("personal_plan_migration_enrollments")
    .select("id")
    .eq("id", input.enrollmentId)
    .eq("user_id", input.userId)
    .eq("status", "ready")
    .maybeSingle()
  if (error) throw new Stage2OptionalEntryError("stage2_migration_enrollment_read_failed")
  return Boolean(data?.id)
}

async function loadLegacyRefinementPrefillInput(
  client: Stage2OptionalEntryClient,
  userId: string,
): Promise<LegacyRefinementPrefillInput> {
  const { data: profile, error: profileError } = await client
    .from("hair_profiles")
    .select(
      "shampoo_frequency,towel_material,towel_technique,drying_method,styling_tools,night_protection",
    )
    .eq("user_id", userId)
    .maybeSingle()
  if (profileError) throw new Stage2OptionalEntryError("stage2_legacy_profile_read_failed")

  const { data: usage, error: usageError } = await client
    .from("user_product_usage")
    .select("id,category,product_name,frequency_range")
    .eq("user_id", userId)
  if (usageError) throw new Stage2OptionalEntryError("stage2_legacy_usage_read_failed")

  const usageRows = coerceLegacyUsageRows(usage)
  return {
    profile: {
      shampooFrequency: fieldString(profile, "shampoo_frequency"),
      towelMaterial: fieldString(profile, "towel_material"),
      towelTechnique: fieldString(profile, "towel_technique"),
      dryingMethod:
        fieldStringArray(profile, "drying_method") ?? fieldString(profile, "drying_method"),
      stylingTools: fieldStringArray(profile, "styling_tools"),
      nightProtection: fieldStringArray(profile, "night_protection"),
    },
    usageRows: usageRows.map((row) => ({
      id: row.id,
      category: row.category,
      productName: row.productName,
      frequencyRange: row.frequencyRange,
    })),
  }
}

function coerceLegacyUsageRows(value: unknown): LegacyProductUsageRow[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return []
    const record = row as Record<string, unknown>
    const id = fieldString(record, "id")
    const category = fieldString(record, "category")
    if (!id || !category) return []
    return [
      {
        id,
        category,
        productName: fieldString(record, "product_name"),
        frequencyRange: fieldString(record, "frequency_range"),
      },
    ]
  })
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

function fieldString(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const candidate = (value as Record<string, unknown>)[key]
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null
}

function fieldStringArray(value: unknown, key: string): string[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const candidate = (value as Record<string, unknown>)[key]
  if (!Array.isArray(candidate)) return null
  const strings = candidate.filter((item): item is string => typeof item === "string")
  return strings.length === candidate.length ? strings : null
}
