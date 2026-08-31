import {
  stage3ProductDraftSchema,
  validateStage3Draft,
  type PersonalPlanCategory,
  type Stage3ProductDraft,
} from "@/lib/personal-plan/products/contracts"
import { effectiveStage3CategoryDecisions } from "@/lib/personal-plan/products/product-load-resolution"
import type { PlanProductRole } from "@/lib/personal-plan/types"

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
 * `frequencyRange`), their role assignments and the retained-inventory
 * dispositions behind "Nicht verwendete Produkte". Decisions stay unset — they
 * are re-authored against fresh evaluations by the intent pass.
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
  const assignedProductIds = new Set(
    roleAssignments.map((assignment) => assignment.capturedProductId),
  )
  const coveredRoleKeys = new Set(
    roleAssignments.flatMap((assignment) =>
      assignment.roles.map((role) => `${assignment.category}:${role}`),
    ),
  )
  const inventoryDispositions = (source.inventoryDispositions ?? []).filter(
    (disposition) =>
      capturedProductIds.has(disposition.capturedProductId) &&
      !assignedProductIds.has(disposition.capturedProductId),
  )

  return {
    ...target,
    products,
    roleAssignments,
    uncoveredRoles: target.uncoveredRoles.filter(
      (uncoveredRole) => !coveredRoleKeys.has(`${uncoveredRole.category}:${uncoveredRole.role}`),
    ),
    ...(inventoryDispositions.length > 0 || target.inventoryDispositions
      ? { inventoryDispositions }
      : {}),
  }
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

  const rehydrated = buildRehydratedDraft(rawTarget, rawSource)
  if (validateStage3Draft(rehydrated).length > 0) return unavailable("rehydrated_draft_invalid")

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
