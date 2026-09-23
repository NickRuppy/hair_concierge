import type { SupabaseClient } from "@supabase/supabase-js"

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

export type DiscoveryIdealRoutine = {
  status: "ready"
  steps: DiscoveryIdealStep[]
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

export async function loadDiscoveryIdealRoutine(
  admin: SupabaseClient,
  userId: string,
  intakeId: string,
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

  // All four inputs are named explicitly so no future edit can reintroduce the
  // `stage1-service` / shared-context loading this path must stay clear of. Nothing here
  // is persisted, because nothing on this path persists.
  const previews = await computeStage1ProductExamplePreviews({
    ...discoveryPreviewInput(intakeId, context),
    snapshot: context.snapshot,
    loadCandidates: createSupabaseStage1ProductExamplePreviewCandidateLoader(admin),
  })

  return {
    status: "ready",
    steps: buildDiscoveryIdealSteps(context.snapshot, previews.previews),
    context: {
      snapshot: context.snapshot,
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
