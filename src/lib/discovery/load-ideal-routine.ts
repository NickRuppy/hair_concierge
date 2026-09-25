import type { SupabaseClient } from "@supabase/supabase-js"

import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import {
  CATEGORY_LABELS,
  frequencyLabel,
  presentationFor,
  type CategoryPresentation,
} from "@/lib/personal-plan/decision-presentation"
import type { Stage1ProductExampleRolePreview } from "@/lib/personal-plan/product-preview-contract"
import {
  computeStage1ProductExamplePreviews,
  createSupabaseStage1ProductExamplePreviewCandidateLoader,
} from "@/lib/personal-plan/product-previews"
import { CATEGORY_ROLE_POLICIES } from "@/lib/personal-plan/products/authorities"
import {
  stage3DecisionKey,
  type PersonalPlanCategory,
} from "@/lib/personal-plan/products/contracts"
import {
  routinePurposeLabel,
  routineRolePurposeDescription,
  routineRoleTimingLabel,
} from "@/lib/personal-plan/routine/labels"
import type {
  InitialNeedPlanSnapshot,
  PlanCategoryDecision,
  PlanProductRole,
  PlanRoutineContext,
} from "@/lib/personal-plan/types"
import type { ScanEvaluationContext } from "@/lib/scan/profile-context"
import { prepareScannerContext } from "@/lib/scan/scanner-context"
import { readScannerProfileSource } from "@/lib/scan/scanner-context-supabase"

/**
 * The participant's Idealplan, read for the admin cockpit.
 *
 * Read-only by construction (§4 read-only contract): the ONLY write anywhere on this path
 * is the idempotent source registration `read_scanner_profile_source` performs inside
 * `scanner_context_read_source` (migration 20260916175239) — an `INSERT … ON CONFLICT DO
 * NOTHING` plus a `FOR UPDATE` lock. Everything else is a plain select.
 *
 * That is why this module deliberately does NOT use the ordinary Stage-1 entry points:
 * `loadSharedScannerContext` / `loadScanEvaluationContext` publish a scanner context,
 * `createStage1PersistenceService` is entitlement-gated and writes, and
 * `provisionFreeInitialSnapshotForUser` writes a snapshot that would collide with the
 * participant's own. Opening a discovery participant's cockpit must change nothing about
 * their plan artifacts.
 */

/**
 * Why this step, what product type, what matters in the product, why it fits her hair and
 * when it is used — the Idealplan's own copy (`presentationFor`, `labels.ts`), read off the
 * decisions the cockpit already has. Nothing here reads or writes a Personal Plan artifact.
 *
 * Presentation only, and deliberately NOT part of the finalised fingerprint
 * (`composeDiscoveryRefinedRoutine` hashes the step without it): the printed document does
 * not show it, so a copy edit here must never flag a finalised call as drifted.
 */
export type DiscoveryStepDepth = {
  /** „Warum dieser Schritt": the role's purpose, else the category's. */
  purpose: string | null
  /** „Produkttyp". */
  targetType: string | null
  /** „Worauf es ankommt". */
  productCriteria: string | null
  /** „Warum das zu ihrem Haar passt" (the engine's own second-person sentence). */
  fit: string | null
  /** When in the wash routine („Nach Shampoo"). */
  timingLabel: string | null
}

export type DiscoveryIdealStep = {
  decisionKey: string
  category: PersonalPlanCategory
  role: PlanProductRole
  /** `decision.needTier` — the cockpit's section split (Basis vs. Optional). */
  section: "basis" | "optional"
  categoryLabel: string
  roleLabel: string
  roleDescription: string | null
  frequencyLabel: string
  /** The Stage-1 example for this role — a recommendation, a fallback, or nothing. */
  preview: Stage1ProductExampleRolePreview | null
  /** Step detail for the call — see `DiscoveryStepDepth` (never hashed). */
  depth?: DiscoveryStepDepth
}

/** A malformed decision target must thin the step detail, not fail the whole cockpit. */
function safePresentation(decision: PlanCategoryDecision): CategoryPresentation | null {
  try {
    return presentationFor(decision)
  } catch {
    return null
  }
}

export function discoveryStepDepth(
  decision: PlanCategoryDecision,
  role: PlanProductRole,
): DiscoveryStepDepth {
  const presentation = safePresentation(decision)
  return {
    purpose: routineRolePurposeDescription(role) ?? presentation?.purpose ?? null,
    targetType: presentation?.targetType ?? null,
    productCriteria: presentation?.productCriteria ?? null,
    fit: presentation?.fit ?? null,
    timingLabel: routineRoleTimingLabel(role),
  }
}

export type DiscoveryPreviewInput = {
  personalPlanId: string
  sourceNeedVersionId: string
}

/**
 * The two identity arguments the Stage-1 preview computation runs under, as one value.
 *
 * A synthetic `discovery:<intakeId>` plan id keeps the payload's identity tied to this
 * intake without inventing a `personal_plans` row, and the version id is the PREPARED
 * context's — not a published one. Both live here, in one pure function the loader spreads
 * and a test can assert, rather than as two literals at the call site where a change would
 * be invisible.
 */
export function discoveryPreviewInput(
  intakeId: string,
  context: Pick<ScanEvaluationContext, "refinedVersionId">,
): DiscoveryPreviewInput {
  return {
    personalPlanId: `discovery:${intakeId}`,
    sourceNeedVersionId: context.refinedVersionId,
  }
}

/**
 * Where the Idealroutine's habits came from (batch 7, discovery-only — the shared
 * `ScanEvaluationContext.snapshotSource` keeps its `"initial" | "refined"` contract):
 *
 *  - `quiz_only` — today's computation: the quiz, or a refined participant's own Feinschliff;
 *  - `intake_answers` — recomputed with her checklist answers (frequency, heat) as the
 *    routine context (plan §2.3).
 */
export type DiscoveryRoutineSource = "quiz_only" | "intake_answers"

export type DiscoveryIdealRoutine = {
  status: "ready"
  steps: DiscoveryIdealStep[]
  /** Discovery-only: see `DiscoveryRoutineSource`. Absent in older fixtures = `quiz_only`. */
  routineSource?: DiscoveryRoutineSource
  /**
   * The heat protectant is still deferred for lack of heat answers — the step is not in
   * the Idealroutine, so the cockpit says „Hitzeschutz: im Call fragen" (F3 quick fix).
   * Display only: deferred decisions never become steps, so this is outside every hash.
   */
  heatProtectionDeferred?: boolean
  context: ScanEvaluationContext
  /**
   * Echoed straight off the computed preview response — the identity the previews were
   * actually computed under, not a recomputation. It makes the loader's two preview
   * arguments observable from its own output, which is what pins them in the tests.
   *
   * Deliberately NOT rendered anywhere: the participant's document carries no internal
   * identity (`discovery:<intakeId>`, a need-version id), and the cockpit has no use for it.
   */
  previewSource: DiscoveryPreviewInput
}

export type DiscoveryIdealRoutineResult =
  | DiscoveryIdealRoutine
  /** The participant has no usable quiz/plan source yet — nothing to show, not a failure. */
  | { status: "no_usable_source" }
  /** The source exists but could not be projected right now — retryable. */
  | { status: "temporarily_unavailable" }

/**
 * Exactly the roles Stage 1 previews, in Idealplan order.
 *
 * The filters mirror `stage1PreviewRoleTasks` (product-previews.ts:63-77) one for one —
 * rendered order, a target of the category's own kind, a basis/optional tier, no deferred
 * resolution, and only roles the category's policy allows, ordered by `allowedRoles`.
 * `tests/discovery-refined-routine.test.ts` pins the resulting decision keys equal to
 * `stage1PreviewedRoleDecisionKeys`, so a change to either side fails there instead of
 * silently giving the cockpit a step the participant's plan never shows.
 */
export function buildDiscoveryIdealSteps(
  snapshot: InitialNeedPlanSnapshot,
  previews: readonly Stage1ProductExampleRolePreview[],
): DiscoveryIdealStep[] {
  const previewsByDecisionKey = new Map(
    previews.map((preview) => [preview.decisionKey, preview] as const),
  )
  const decisions = new Map(snapshot.decisions.map((decision) => [decision.category, decision]))
  const steps: DiscoveryIdealStep[] = []

  for (const category of snapshot.renderedOrder) {
    const decision = decisions.get(category)
    if (!decision?.target || decision.target.category !== category) continue
    if (decision.needTier !== "basis" && decision.needTier !== "optional") continue
    if (decision.resolution === "deferred_until_post_plan_onboarding") continue
    const allowedRoles = CATEGORY_ROLE_POLICIES[category].allowedRoles
    for (const role of allowedRoles as readonly PlanProductRole[]) {
      if (!decision.roles.includes(role)) continue
      const decisionKey = stage3DecisionKey(category, role, null)
      steps.push({
        decisionKey,
        category,
        role,
        section: decision.needTier,
        categoryLabel: CATEGORY_LABELS[category],
        roleLabel: routinePurposeLabel(role),
        roleDescription: routineRolePurposeDescription(role),
        frequencyLabel: frequencyLabel(decision.frequency, decision.executionState === "paused"),
        preview: previewsByDecisionKey.get(decisionKey) ?? null,
        depth: discoveryStepDepth(decision, role),
      })
    }
  }

  return steps
}

/**
 * Batch 7 (plan §2.3 Rev. 3): the Idealroutine recomputed with her checklist answers, inside
 * the discovery module — the shared scanner code stays untouched. Only on the INITIAL path:
 * a refined participant keeps her real Feinschliff answers. Projection stays `initial_quiz`
 * because `refined_post_plan` answers `needs_clarification` when the shampoo frequency is
 * unknown (`compute-stage1.ts`), and decisions read the routine regardless of projection.
 * Anything but `ready` falls back to the prepared snapshot — never an error. Pure.
 */
export function recomputeDiscoverySnapshot(
  context: Pick<ScanEvaluationContext, "snapshot" | "snapshotSource">,
  routineOverride: PlanRoutineContext | null | undefined,
): { snapshot: InitialNeedPlanSnapshot; routineSource: DiscoveryRoutineSource } {
  const unchanged = { snapshot: context.snapshot, routineSource: "quiz_only" as const }
  if (!routineOverride || context.snapshotSource !== "initial") return unchanged
  try {
    const computed = computeNeedPlan({
      rawEnvelope: context.snapshot.sourceQuiz,
      artifactId: context.snapshot.profile.source.artifactId,
      projection: "initial_quiz",
      computationVersion: context.snapshot.computationVersion,
      createdAt: context.snapshot.createdAt,
      routine: routineOverride,
    })
    return computed.status === "ready"
      ? { snapshot: computed.snapshot, routineSource: "intake_answers" }
      : unchanged
  } catch (error) {
    console.error("[discovery] ideal routine recompute failed, quiz-only routine kept:", error)
    return unchanged
  }
}

/** The heat protectant waits for heat answers nobody gave (plan §2.3, F3 quick fix). */
export function discoveryHeatProtectionDeferred(snapshot: InitialNeedPlanSnapshot): boolean {
  return snapshot.decisions.some(
    (decision) =>
      decision.category === "heat_protectant" &&
      decision.resolution === "deferred_until_post_plan_onboarding",
  )
}

export async function loadDiscoveryIdealRoutine(
  admin: SupabaseClient,
  userId: string,
  intakeId: string,
  options: {
    /**
     * Batch 7: her checklist answers as a routine context (`buildDiscoveryRoutineContext`),
     * handed in ONLY for an intake with new answers — `null`/absent runs exactly today's
     * computation, so every legacy intake keeps its steps and its fingerprint.
     */
    routineOverride?: PlanRoutineContext | null
  } = {},
): Promise<DiscoveryIdealRoutineResult> {
  let context
  try {
    context = prepareScannerContext(await readScannerProfileSource(admin, userId))
  } catch {
    // `scan_profile_context_unavailable` covers both the RPC failing and an inconsistent
    // stored source; neither is something the admin can fix from the cockpit.
    return { status: "temporarily_unavailable" }
  }
  if (!context) return { status: "no_usable_source" }

  const { snapshot, routineSource } = recomputeDiscoverySnapshot(context, options.routineOverride)

  // All four inputs are named explicitly so no future edit can reintroduce the
  // `stage1-service` / shared-context loading this path must stay clear of. Nothing here
  // is persisted, because nothing on this path persists. The previews run on the SAME
  // snapshot the steps come from, so steps and previews stay consistent.
  const previews = await computeStage1ProductExamplePreviews({
    ...discoveryPreviewInput(intakeId, context),
    snapshot,
    loadCandidates: createSupabaseStage1ProductExamplePreviewCandidateLoader(admin),
  })

  return {
    status: "ready",
    steps: buildDiscoveryIdealSteps(snapshot, previews.previews),
    routineSource,
    heatProtectionDeferred: discoveryHeatProtectionDeferred(snapshot),
    context: {
      snapshot,
      snapshotSource: context.snapshotSource,
      refinedVersionId: context.refinedVersionId,
      refinedInputHash: context.refinedInputHash,
    },
    // Read back off the response, so the arguments above are observable to a caller.
    previewSource: {
      personalPlanId: previews.personalPlanId,
      sourceNeedVersionId: previews.sourceNeedVersionId,
    },
  }
}
