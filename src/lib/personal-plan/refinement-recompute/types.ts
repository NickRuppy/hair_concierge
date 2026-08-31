import type { Stage3ProductDraft } from "@/lib/personal-plan/products/contracts"
import type { Stage3ProductionPersistence } from "@/lib/personal-plan/products/production-persistence-gateway"

/**
 * Narrow persistence surface the recompute lane needs. Both members already
 * exist on the Stage-3 production persistence port, so the Supabase adapter
 * (`createSupabaseStage3ProductionPersistence`) satisfies this as-is and no
 * new RPC or migration is required.
 */
export type Stage3RehydrationPersistence = Pick<Stage3ProductionPersistence, "loadDraft" | "save">

export type Stage3RehydrationInput = {
  persistence: Stage3RehydrationPersistence
  userId: string
  personalPlanId: string
  /** The freshly rebuilt, empty Stage-3 draft on the newer refined need version. */
  target: { draftId: string; revision: number }
  /**
   * The immutable Stage-3 draft the active routine version was compiled from
   * (`personal_plan_routine_versions.source_product_draft_id` /
   * `source_product_draft_revision`).
   *
   * `revision` is the value the routine version recorded, which is the draft
   * revision *before* completion bumped it — see
   * `EXPECTED_SOURCE_COMPLETION_REVISION_OFFSET`.
   */
  source: { draftId: string; revision: number }
}

export type Stage3RehydrationUnavailableReason =
  | "source_is_target"
  | "source_draft_missing"
  | "source_draft_unparsable"
  | "source_draft_foreign_plan"
  | "source_draft_not_completed"
  | "source_revision_mismatch"
  | "target_draft_missing"
  | "target_draft_unparsable"
  | "target_draft_foreign_plan"
  | "target_draft_not_active"
  | "target_draft_pending_need_revision"
  | "target_draft_stale_source"
  | "rehydrated_draft_invalid"

export type Stage3RehydrationResult =
  | { status: "rehydrated"; draft: Stage3ProductDraft }
  | { status: "conflict"; currentRevision: number }
  | { status: "unavailable"; reason: Stage3RehydrationUnavailableReason }
