import type { JsonValue } from "@/lib/personal-plan/persistence"
import type { UserFacts } from "@/lib/user-facts/read"

import type { RebaseSourceDraft } from "./rebase-projection"

/**
 * Facts recompute lane (central user profile PR2, plans/2026-10-03-central-user-profile-pr2.md
 * §4a): `syncPlanWithFacts` is the only way an existing Personal Plan moves to new diagnostics.
 * It never throws; every caller branches on `status` only.
 */
export type SyncPlanWithFactsInput = { userId: string }

export type SyncPlanWithFactsUnavailableReason =
  /** No diagnostics, a `legacy_columns` source, or a required answer missing / only assumed. */
  | "facts_not_computable"
  /** A revision, draft or initial-id conflict (or a deadlock) that survived the one retry. */
  | "conflict"
  /** The plan's stored state cannot be rebased (e.g. a refined head without a source draft). */
  | "invalid_source"
  | "unexpected_error"

export type SyncPlanWithFactsResult =
  | { status: "no_plan" }
  /** The facts produce the plan's current initial version: nothing to do. */
  | { status: "unchanged"; personalPlanId: string }
  | {
      status: "rebased"
      personalPlanId: string
      initialNeedVersionId: string
      /** `null` when the plan had no refined head (nothing was projected). */
      refinedVersionId: string | null
      /** The routine that was active when the plan was rebased; its successor is not computed here. */
      activeRoutineVersionId: string | null
    }
  | { status: "unavailable"; reason: SyncPlanWithFactsUnavailableReason; retryable: boolean }

/** The lane bound to its production dependencies, as routes and services receive it. */
export type SyncPlanWithFacts = (input: SyncPlanWithFactsInput) => Promise<SyncPlanWithFactsResult>

/** The `personal_plans` row as the lane reads it. */
export type FactsRecomputePlan = {
  id: string
  revision: number
  currentInitialNeedVersionId: string | null
  currentRefinedNeedVersionId: string | null
  activeRoutineVersionId: string | null
}

/** The plan's current initial Need version: its hash and Stage-1 source identity. */
export type FactsRecomputeInitialVersion = {
  id: string
  inputHash: string
  preparedArtifactSourceId: string | null
  stage1SourceLeadId: string | null
}

/** The source draft as `loadExistingFromSource` picks it, plus its revision for the CAS. */
export type FactsRecomputeSourceDraft = RebaseSourceDraft & { revision: number }

/** Named arguments of `public.personal_plan_rebase_on_facts_v1`; absent optionals take the SQL DEFAULT. */
export type PersonalPlanRebaseOnFactsParams = {
  p_user_id: string
  p_personal_plan_id: string
  p_expected_plan_revision: number
  p_expected_facts_revision: number
  p_initial_id: string
  p_schema_version: number
  p_computation_version: string
  p_initial_input_hash: string
  p_initial_input_snapshot: JsonValue
  p_initial_output_snapshot: JsonValue
  p_source_draft_id?: string
  p_expected_draft_revision?: number
  p_clone_answers?: JsonValue
  p_clone_completed_question_ids?: string[]
  p_clone_answer_provenance?: JsonValue
  p_care_habits_patch?: JsonValue
  p_care_habits_provenance?: JsonValue
  p_refined_schema_version?: number
  p_refined_computation_version?: string
  p_refined_input_hash?: string
  p_refined_input_snapshot?: JsonValue
  p_refined_output_snapshot?: JsonValue
}

/** The RPC's jsonb result, by `status` (see the migration header). */
export type PersonalPlanRebaseOnFactsResult =
  | {
      status: "rebased"
      initialNeedVersionId: string
      refinedNeedVersionId: string | null
      cloneDraftId: string | null
      revision: number
      factsRevision: number
    }
  | { status: "unchanged"; initialNeedVersionId: string; revision: number }
  | { status: "plan_revision_conflict"; currentRevision: number }
  | { status: "facts_revision_conflict"; currentRevision: number }
  | { status: "draft_conflict"; currentDraftId: string | null; currentDraftRevision: number | null }
  | { status: "initial_conflict"; existingId: string }
  | { status: "invalid_source"; reasonCode: string }

/**
 * Everything `syncPlanWithFacts` reads or writes. `rebase` throws on an RPC error, carrying the
 * Postgres SQLSTATE as `code` (the lane retries `40P01` / `40001` once).
 */
export type FactsRecomputeDeps = {
  loadPlan(userId: string): Promise<FactsRecomputePlan | null>
  loadInitialVersion(input: {
    userId: string
    needVersionId: string
  }): Promise<FactsRecomputeInitialVersion | null>
  loadFacts(userId: string): Promise<UserFacts | null>
  /** Id of the plan's initial version with this input hash, if one exists (A→B→A). */
  findInitialVersionId(input: { personalPlanId: string; inputHash: string }): Promise<string | null>
  loadSourceDraft(input: {
    personalPlanId: string
    initialNeedVersionId: string
  }): Promise<FactsRecomputeSourceDraft | null>
  rebase(params: PersonalPlanRebaseOnFactsParams): Promise<PersonalPlanRebaseOnFactsResult>
  newId(): string
  now(): Date
}
