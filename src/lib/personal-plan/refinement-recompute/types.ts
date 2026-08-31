import type {
  Stage3AuthorityEvaluation,
  Stage3AuthoritySemanticIntent,
} from "@/lib/personal-plan/products/authority/contracts"
import type { Stage3ProductDraft } from "@/lib/personal-plan/products/contracts"
import type {
  Stage3AuthorityProductionGateway,
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
 * - `owned_capture_missing` — the routine owns (or is waiting on) a product for
 *   this subject, but the evaluation carries no captured product to keep. The
 *   routine's immutable source draft never held that capture, so rehydration
 *   could not copy one: the acquire/scan path flips a planned item to `owned`
 *   in the routine alone (`routine/source-reconciler.ts`,
 *   `lib/scan/saved-state.ts`). Preserving it is impossible here, and every
 *   fallback would end at `leave_uncovered` — dropping the person's own product
 *   while the recompute reported success. The pass fails closed instead.
 */
export type Stage3RecomputeBlockedSubject = {
  subjectKey: string
  blocked: "unsupported" | "no_allowed_action" | "owned_capture_missing"
}

export type Stage3RecomputeIntentPlan = {
  /** In evaluation order; safe to hand to `resolveDecisions` as a batch. */
  intents: Stage3AuthoritySemanticIntent[]
  blocked: Stage3RecomputeBlockedSubject[]
}

/**
 * Narrow gateway surface the T1.3 orchestrator drives: everything
 * `Stage3AuthorityProductionGateway` exposes for headless draft acquisition,
 * decision evaluation/resolution and completion. The production wiring (T1.4)
 * supplies `createProductionStage3ProductsGateway(...)` as-is — it already
 * satisfies this pick.
 */
export type Stage3RecomputeGateway = Pick<
  Stage3AuthorityProductionGateway,
  "loadOrCreate" | "evaluateDecisions" | "reviewDecisionBundles" | "resolveDecisions" | "complete"
>

/**
 * What the active routine version currently on the plan looks like. The
 * orchestrator reads this twice with the SAME method — once before any work
 * (the owner-scoped starting state 4c's `unchanged`/`applied` distinction
 * relies on) and once again after completion (the re-read that decides
 * `applied`, never the completion receipt itself — see
 * `production-persistence-gateway.ts:913` / `stage3-persistence-supabase.ts:406`).
 */
export type Stage3RecomputeActiveRoutineVersion = {
  routineVersionId: string
  /** The compiled Routine payload — the intent builder's final-choice source. */
  payload: RoutinePayloadV1
  source: {
    refinedVersionId: string
    /** Null on a legacy row that predates the source-draft columns. */
    productDraftId: string | null
    productDraftRevision: number | null
  }
}

export type Stage3RecomputeRoutineStateReader = {
  /** Owner-scoped; resolves to null when the plan has no routine at all yet. */
  loadActiveRoutineVersion(input: {
    userId: string
    personalPlanId: string
  }): Promise<Stage3RecomputeActiveRoutineVersion | null>
}

export type Stage3RecomputeDeps = {
  gateway: Stage3RecomputeGateway
  /** Raw persistence rehydration needs (`loadDraft`/`save`) — same port T1.1 takes. */
  persistence: Stage3RehydrationPersistence
  routineState: Stage3RecomputeRoutineStateReader
}

export type Stage3RecomputeInput = {
  userId: string
  personalPlanId: string
  /** The refined need version a habits-module completion just made current. */
  refinedVersionId: string
}

/**
 * Typed reasons the recompute could not complete. Rehydration's own reasons
 * (`Stage3RehydrationUnavailableReason`) pass through unchanged so a caller
 * can trace an unavailable result back to exactly which layer produced it —
 * see the T1.3 report's retryability table for which of these are safe to
 * retry.
 */
export type Stage3RecomputeUnavailableReason =
  | "no_active_routine"
  | "legacy_source_draft"
  | "superseded"
  | Stage3RehydrationUnavailableReason
  | "rehydration_conflict"
  /**
   * The gateway's per-draft memo (set by the first `loadOrCreate`) still
   * pointed at the pre-rehydration row when re-acquired after rehydration's
   * direct persistence write — a race, not a structural problem.
   */
  | "rehydration_reload_conflict"
  | "decision_blocked"
  | "resolve_conflict"
  /** `loadOrCreate` returned a draft in the `"stale"` status — fix round 1 MINOR 4. */
  | "draft_stale"
  | "completion_not_ready"
  | "completion_conflict"
  /**
   * `complete()` reported success and staged a routine proposal
   * (`routineProposalId !== null`), but the re-read shows the active
   * routine still on the starting source — a replayed completion call
   * short-circuited to the stored receipt without this attempt being the
   * one that activated it, and the confirm that would activate the staged
   * proposal never landed. The routine page's own "Änderungen prüfen"
   * pending-proposal recovery is the correct next step, not a retry.
   */
  | "pending_proposal_staged"
  | "concurrent_activation"
  | "unexpected_error"

export type Stage3RecomputeResult =
  | { status: "applied"; routineVersionId: string }
  | { status: "unchanged" }
  | {
      status: "unavailable"
      reason: Stage3RecomputeUnavailableReason
      retryable: boolean
      /** The caught error, when `reason` is `"unexpected_error"` — for logging. */
      cause?: unknown
    }
