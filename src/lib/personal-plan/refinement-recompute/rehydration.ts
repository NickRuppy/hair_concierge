import {
  stage3ProductDraftSchema,
  validateStage3Draft,
  type Stage3ProductDraft,
} from "@/lib/personal-plan/products/contracts"

import type {
  Stage3RehydrationInput,
  Stage3RehydrationResult,
  Stage3RehydrationUnavailableReason,
} from "./types"

function unavailable(reason: Stage3RehydrationUnavailableReason): Stage3RehydrationResult {
  return { status: "unavailable", reason }
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
 * draft may only carry captures for its own ordered categories.
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
  const roleAssignments = source.roleAssignments.filter((assignment) =>
    capturedProductIds.has(assignment.capturedProductId),
  )
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

  const rawSource = await persistence.loadDraft({ userId, draftId: input.source.draftId })
  if (!rawSource) return unavailable("source_draft_missing")
  if (!stage3ProductDraftSchema.safeParse(rawSource).success) {
    return unavailable("source_draft_unparsable")
  }
  if (rawSource.personalPlanId !== personalPlanId) return unavailable("source_draft_foreign_plan")
  if (rawSource.revision !== input.source.revision) return unavailable("source_revision_mismatch")

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
