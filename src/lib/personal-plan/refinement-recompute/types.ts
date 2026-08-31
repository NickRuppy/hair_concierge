import type {
  Stage3AuthorityEvaluation,
  Stage3AuthoritySemanticIntent,
} from "@/lib/personal-plan/products/authority/contracts"
import type { Stage3ProductDraft } from "@/lib/personal-plan/products/contracts"
import type {
  Stage3DecisionReviewBundle,
  Stage3ProductionPersistence,
} from "@/lib/personal-plan/products/production-persistence-gateway"
import type { RoutinePayloadV1 } from "@/lib/personal-plan/routine/contracts"

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

export type Stage3RecomputeIntentInput = {
  /**
   * `evaluateDecisions` output for the REHYDRATED draft, in its own order —
   * one entry per role subject (inventory dispositions are already excluded by
   * `authorityDecisionSubjects`).
   */
  evaluations: readonly Stage3AuthorityEvaluation[]
  /**
   * `reviewDecisionBundles` output for the same draft: the only source of
   * alternative candidates and their fact fingerprints, which
   * `select_replacement` is validated against. A subject with no bundle simply
   * has no selectable alternatives.
   */
  reviewBundles: readonly Stage3DecisionReviewBundle[]
  /** The routine version currently active for the person. */
  routine: RoutinePayloadV1
}

/**
 * A subject the new authority permits no usable action on.
 *
 * - `unsupported` — the evaluation itself is `unsupported` and allows nothing.
 *   The orchestrator classifies the whole recompute as non-retryable
 *   unavailable.
 * - `no_allowed_action` — the preferred action and its whole fallback chain,
 *   `leave_uncovered` included, are absent from `allowedActions`.
 */
export type Stage3RecomputeBlockedSubject = {
  subjectKey: string
  blocked: "unsupported" | "no_allowed_action"
}

export type Stage3RecomputeIntentPlan = {
  /** In evaluation order; safe to hand to `resolveDecisions` as a batch. */
  intents: Stage3AuthoritySemanticIntent[]
  blocked: Stage3RecomputeBlockedSubject[]
}
