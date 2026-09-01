import {
  stage3ProductDraftSchema,
  validateStage3Draft,
  type PersonalPlanCategory,
  type Stage3CategoryRequirement,
  type Stage3ProductDraft,
} from "@/lib/personal-plan/products/contracts"
import {
  effectiveStage3CategoryDecisions,
  effectiveStage3Requirements,
} from "@/lib/personal-plan/products/product-load-resolution"
import {
  completeCaptureCategory,
  computeStage3PathState,
  markRoleUncovered,
} from "@/lib/personal-plan/products/state-machine"
import type { InitialNeedPlanSnapshot, PlanProductRole } from "@/lib/personal-plan/types"

import type {
  Stage3RehydrationInput,
  Stage3RehydrationResult,
  Stage3RehydrationUnavailableReason,
} from "./types"

/**
 * Stage-3 completion records `source_product_draft_revision` from the draft row
 * and only then bumps that row to `completed`
 * (`20260808062603_personal_plan_routine_backend.sql`,
 * `20260811154526_personal_plan_initial_routine_activation_v1.sql`), so the
 * completed draft always sits exactly one revision above the value the routine
 * version recorded. The successor-lifecycle guard documents the same offset
 * (`20260808070000_personal_plan_routine_successor_lifecycle.sql`).
 */
const EXPECTED_SOURCE_COMPLETION_REVISION_OFFSET = 1

function unavailable(reason: Stage3RehydrationUnavailableReason): Stage3RehydrationResult {
  return { status: "unavailable", reason }
}

/**
 * Roles the fresh draft's own refined authority still requires, per category.
 *
 * Returns `null` when the draft carries no authority snapshot for its refined
 * version — the same fallback `finalRefinedRequirementsForInventoryDispositions`
 * takes. Copied assignments are then left untouched rather than all pruned.
 */
function requiredRolesByCategory(
  draft: Stage3ProductDraft,
): Map<PersonalPlanCategory, Set<PlanProductRole>> | null {
  const snapshot = draft.authoritySnapshot
  if (!snapshot || snapshot.refinedNeedVersionId !== draft.refinedVersionId) return null
  const inventoryOnlyCategories = new Set(snapshot.inventoryOnlyCategories ?? [])
  const required = new Map<PersonalPlanCategory, Set<PlanProductRole>>()
  for (const decision of effectiveStage3CategoryDecisions(draft)) {
    const category = decision.category as PersonalPlanCategory
    const included = decision.needTier === "basis" || decision.needTier === "optional"
    if (!included || inventoryOnlyCategories.has(category)) continue
    required.set(category, new Set(decision.roles ?? []))
  }
  return required
}

/**
 * Copies the capture state of the source draft onto the fresh draft.
 *
 * Only capture facts travel: owned and pending captures (with their observed
 * `frequencyRange`) and their role assignments. Decisions stay unset — they are
 * re-authored against fresh evaluations by the intent pass.
 *
 * The retained-inventory dispositions behind "Nicht verwendete Produkte" are
 * deliberately NOT copied: they are derived state, and `deriveInventoryDispositions`
 * re-derives them from these very captures during the capture completion below,
 * against the CURRENT authority fingerprint. Copying the old rows would carry
 * the person's acknowledgement of the OLD authority onto a disposition they
 * never saw. The recompute lane acknowledges the re-derived ones explicitly
 * instead (orchestrator step 3b, founder ruling R2).
 *
 * Captures whose category left the refined plan are dropped, because a Stage-3
 * draft may only carry captures for its own ordered categories. Assignments to
 * a role the refined plan no longer requires are dropped the same way; their
 * capture stays as an unassigned copy and flows into retained inventory, so a
 * stale assignment can never mask a genuinely uncovered new role.
 */
function buildRehydratedDraft(
  target: Stage3ProductDraft,
  source: Stage3ProductDraft,
): Stage3ProductDraft {
  const orderedCategories = new Set(target.orderedCategories)
  const products = source.products.filter((product) =>
    orderedCategories.has(product.identity.category),
  )
  const capturedProductIds = new Set(products.map((product) => product.capturedProductId))
  const requiredRoles = requiredRolesByCategory(target)
  const roleAssignments = source.roleAssignments.flatMap((assignment) => {
    if (!capturedProductIds.has(assignment.capturedProductId)) return []
    if (!requiredRoles) return [assignment]
    const stillRequired = requiredRoles.get(assignment.category)
    const roles = assignment.roles.filter((role) => stillRequired?.has(role))
    return roles.length > 0 ? [{ ...assignment, roles }] : []
  })
  const coveredRoleKeys = new Set(
    roleAssignments.flatMap((assignment) =>
      assignment.roles.map((role) => `${assignment.category}:${role}`),
    ),
  )

  return {
    ...target,
    products,
    roleAssignments,
    uncoveredRoles: target.uncoveredRoles.filter(
      (uncoveredRole) => !coveredRoleKeys.has(`${uncoveredRole.category}:${uncoveredRole.role}`),
    ),
  }
}

/**
 * Drives the copied draft through the SAME capture-completion transitions the
 * person's own Stage-3 pass would run, headlessly.
 *
 * This is the difference between a draft that can complete and one that can
 * never complete. `createStage3Draft` marks only the categories the person owns
 * NOTHING in as capture-complete (`state-machine.ts`,
 * `productLoadContext.ownedCategories`), because every owned category is
 * exactly what the capture pass exists to confirm. A rebuilt draft for the
 * recompute lane's main cohort — everyone with owned products — therefore
 * starts in `pass: "product_capture"`, and copying captures onto it does not
 * change that: `computeStage3PathState` keeps `canCreatePortfolio: false` and
 * `complete()` answers `not_ready` forever.
 *
 * Copying the captures is what MAKES the capture pass answered — the person
 * already told us these products in the source draft — so the completion is
 * driven, never hand-set:
 *
 * 1. every required role the copied assignments do not cover becomes an
 *    explicit `no_product_owned` gap (`markRoleUncovered`), the same fact
 *    `resolveStage3NeedRevision` derives for the same situation. Without it the
 *    capture pass is legitimately incomplete and nothing below would fire. The
 *    gap surfaces as an `uncovered_role` decision subject, which the intent
 *    builder answers with `leave_uncovered` (founder ruling R2/R5);
 * 2. `completeCaptureCategory` then runs per still-open category, exactly as
 *    the client's `complete_capture_category` mutation does — including the
 *    immutable refined snapshot the production gateway loads for the same
 *    transition (`shouldLoadBaseRefinedSnapshotForMutation`), so the product
 *    load authority envelope and the retained-inventory dispositions are
 *    derived by the state machine against the CURRENT authority.
 */
function completeRehydratedCapture(
  draft: Stage3ProductDraft,
  requirements: Stage3CategoryRequirement[],
  baseRefinedSnapshot: InitialNeedPlanSnapshot,
): Stage3ProductDraft {
  const effective = effectiveStage3Requirements(requirements, draft)
  let next = draft
  const coveredRoleKeys = new Set([
    ...next.roleAssignments.flatMap((assignment) =>
      assignment.roles.map((role) => `${assignment.category}:${role}`),
    ),
    ...next.uncoveredRoles.map(
      (uncoveredRole) => `${uncoveredRole.category}:${uncoveredRole.role}`,
    ),
  ])
  for (const requirement of effective) {
    for (const role of requirement.requiredRoles) {
      if (coveredRoleKeys.has(`${requirement.category}:${role}`)) continue
      next = markRoleUncovered(next, {
        category: requirement.category,
        role,
        reason: "no_product_owned",
      })
    }
  }
  const pending = next.orderedCategories.filter(
    (candidate) => !next.completedCaptureCategories.includes(candidate),
  )
  // A draft the person owns nothing in is created already capture-complete, so
  // it has no pending category to drive — but the copied captures still have to
  // reach the product-load authority and the retained-inventory dispositions.
  // Re-running the last category's completion is the canonical way to get
  // there; the transition is idempotent on an already-completed category.
  for (const category of pending.length > 0 ? pending : next.orderedCategories.slice(-1)) {
    next = completeCaptureCategory(next, category, effective, { baseRefinedSnapshot })
  }
  return next
}

/**
 * Rehydrates a freshly rebuilt Stage-3 product draft from the immutable draft
 * the active routine version was compiled from, so a later headless pass can
 * express decision-preserving intents instead of walking the person through
 * Stage 3 again.
 *
 * Fails closed: any missing row, ownership/plan mismatch, stale source revision
 * or invalid result yields an `unavailable` result and no write at all.
 */
export async function rehydrateStage3ProductDraft(
  input: Stage3RehydrationInput,
): Promise<Stage3RehydrationResult> {
  const { persistence, userId, personalPlanId } = input
  if (input.source.draftId === input.target.draftId) return unavailable("source_is_target")

  const rawSource = await persistence.loadDraft({ userId, draftId: input.source.draftId })
  if (!rawSource) return unavailable("source_draft_missing")
  if (!stage3ProductDraftSchema.safeParse(rawSource).success) {
    return unavailable("source_draft_unparsable")
  }
  if (rawSource.personalPlanId !== personalPlanId) return unavailable("source_draft_foreign_plan")
  // Completion is what makes the recorded-revision offset deterministic.
  if (rawSource.status !== "completed") return unavailable("source_draft_not_completed")
  if (rawSource.revision !== input.source.revision + EXPECTED_SOURCE_COMPLETION_REVISION_OFFSET) {
    return unavailable("source_revision_mismatch")
  }

  const rawTarget = await persistence.loadDraft({ userId, draftId: input.target.draftId })
  if (!rawTarget) return unavailable("target_draft_missing")
  if (!stage3ProductDraftSchema.safeParse(rawTarget).success) {
    return unavailable("target_draft_unparsable")
  }
  if (rawTarget.personalPlanId !== personalPlanId) return unavailable("target_draft_foreign_plan")
  if (rawTarget.status !== "active") return unavailable("target_draft_not_active")
  // The guarded save RPC only accepts the three capture/decision passes; a fresh
  // draft parked on a pending inventory-need proposal must be resolved first.
  if (rawTarget.pass === "need_revision_review") {
    return unavailable("target_draft_pending_need_revision")
  }
  if (rawTarget.revision !== input.target.revision) {
    return { status: "conflict", currentRevision: rawTarget.revision }
  }

  const requirements = await persistence.loadRequirements({
    userId,
    personalPlanId,
    refinedVersionId: rawTarget.refinedVersionId,
  })
  const baseRefinedSnapshot = await persistence.loadRefinedNeedSnapshot({
    userId,
    personalPlanId,
    refinedVersionId: rawTarget.refinedVersionId,
  })

  let rehydrated: Stage3ProductDraft
  try {
    rehydrated = completeRehydratedCapture(
      buildRehydratedDraft(rawTarget, rawSource),
      requirements,
      baseRefinedSnapshot,
    )
  } catch {
    // Every canonical transition validates the draft it produces and throws on
    // a shape the state machine rejects. That is a structural mismatch between
    // the copied captures and the new authority, not a race.
    return unavailable("rehydrated_draft_invalid")
  }
  // Copied inventory carried the person's own product load into a need the
  // refined version does not describe yet; only they can resolve that.
  if (rehydrated.pass === "need_revision_review") {
    return unavailable("rehydrated_draft_pending_need_revision")
  }
  // The state machine — not this service — decides whether the capture pass is
  // answered. Refusing to save a draft that did not reach the decisions pass is
  // what keeps `complete()`'s `not_ready` from becoming this lane's steady state.
  const pathState = computeStage3PathState(rehydrated, requirements)
  if (!pathState.canCompleteCapture || pathState.pass !== "product_decisions") {
    return unavailable("rehydrated_capture_incomplete")
  }
  if (validateStage3Draft(rehydrated).length > 0) return unavailable("rehydrated_draft_invalid")
  // The canonical transitions each bump a local revision counter; the row's own
  // revision is server-assigned by the save RPC and is the only one that counts.
  rehydrated = { ...rehydrated, revision: rawTarget.revision }

  const saved = await persistence.save({
    userId,
    draftId: input.target.draftId,
    expectedRevision: input.target.revision,
    draft: rehydrated,
  })
  if (saved.outcome === "revision_conflict") {
    return { status: "conflict", currentRevision: saved.draft.revision }
  }
  if (saved.outcome === "stale_source") return unavailable("target_draft_stale_source")
  return { status: "rehydrated", draft: saved.draft }
}
