import { STAGE3_AUTHORITY_DECISION_BATCH_LIMIT } from "@/lib/personal-plan/products/authority/contracts"
import type { Stage3ProductDraft } from "@/lib/personal-plan/products/contracts"
import type { Stage3RoutineAuthorityRepairService } from "@/lib/personal-plan/products/stage3-routine-authority-repair-service"
import type { PlanProductRole } from "@/lib/personal-plan/types"

import { buildStage3RecomputeIntents } from "./intents"
import { rehydrateStage3ProductDraft } from "./rehydration"
import type {
  Stage3RecomputeActiveRoutineVersion,
  Stage3RecomputeDeps,
  Stage3RecomputeRepick,
  Stage3RecomputeUnavailableReason,
  Stage3RehydrationUnavailableReason,
} from "./types"

/**
 * Catalogue-change re-pick lane (Nick Q8, 2026-10-13; generalises S5 plan T5.5b).
 *
 * The headless recompute's second reason, next to a habits completion: a product the
 * ACTIVE routine plans for a slot no longer fits that slot because the catalogue
 * changed — it was tombstoned as a `replaced_by` source (S5), or its current Stage-3
 * authority evaluation no longer admits the planned role after a catalogue role change.
 *
 * The refined need did not change, so instead of a draft on a newer version this
 * lane opens the routine's own authority-repair draft on the SAME version
 * (`personal_plan_create_or_load_routine_authority_repair_draft`, the same draft
 * the "Plan reparieren" entry uses), rehydrates it from the routine's immutable
 * source draft, re-authors every decision exactly like the habits lane — except
 * that the affected subjects are re-picked to the authority's next-best product —
 * and completes + activates through `personal_plan_complete_draft_activate_v2`.
 *
 * Never silent about a person's own choice: an OWNED product, or a planned one the
 * person explicitly picked from the alternatives (`select_replacement`), is not
 * replaced; the lane reports it as `needs_attention` and writes nothing.
 *
 * Like the habits lane it never throws, and `applied` is decided by an owner-scoped
 * re-read of the active routine after completion.
 */

export type Stage3PlannedProductFit = "fits" | "no_longer_fits" | "retired" | "unknown"

export type Stage3CatalogFitProbe = {
  /**
   * The product's current fit for the planned role, owner-scoped and evaluated with
   * the person's own refined need: `retired` for a `replaced_by` tombstone source,
   * `no_longer_fits` when the Stage-3 authority verdict is neither ideal nor
   * supportive, `unknown` when the facts cannot be evaluated (fails closed).
   */
  plannedProductFit(input: {
    userId: string
    personalPlanId: string
    refinedVersionId: string
    productId: string
    category: string
    role: PlanProductRole
  }): Promise<Stage3PlannedProductFit>
}

export type Stage3CatalogChangeDeps = Stage3RecomputeDeps & {
  repairDraft: Pick<Stage3RoutineAuthorityRepairService, "createOrLoad">
  catalogFit: Stage3CatalogFitProbe
}

export type Stage3CatalogChangeInput = {
  userId: string
  personalPlanId: string
  /** The catalogue product whose planned slots are re-checked. */
  productId: string
  /** Restrict to one planned role (e.g. `post_wash_leave_in`); all roles when absent. */
  role?: PlanProductRole
}

export type Stage3CatalogChangeAttention = {
  subjectKey: string
  productId: string
  reason: "owned" | "explicit_choice"
}

export type Stage3CatalogChangeResult =
  | { status: "applied"; routineVersionId: string; repicked: Stage3RecomputeRepick[] }
  | { status: "unchanged" }
  | { status: "needs_attention"; cases: Stage3CatalogChangeAttention[] }
  | {
      status: "unavailable"
      reason:
        | Stage3RecomputeUnavailableReason
        | "catalog_fit_unknown"
        | "repair_draft_unavailable"
        | "repick_not_applied"
      retryable: boolean
      cause?: unknown
    }

const RETRYABLE_REHYDRATION_REASONS = new Set<Stage3RehydrationUnavailableReason>([
  "source_revision_mismatch",
  "target_draft_stale_source",
])

function unavailable(
  reason: Extract<Stage3CatalogChangeResult, { status: "unavailable" }>["reason"],
  retryable: boolean,
  cause?: unknown,
): Stage3CatalogChangeResult {
  return cause === undefined
    ? { status: "unavailable", reason, retryable }
    : { status: "unavailable", reason, retryable, cause }
}

type RoutineItem = Stage3RecomputeActiveRoutineVersion["payload"]["items"][number]

function itemsForProduct(
  routine: Stage3RecomputeActiveRoutineVersion,
  input: Stage3CatalogChangeInput,
): RoutineItem[] {
  return routine.payload.items.filter(
    (item) =>
      item.state.inclusion === "included" &&
      (item.product.kind === "planned" || item.product.kind === "owned") &&
      item.product.productId === input.productId &&
      (input.role === undefined || item.role === input.role),
  )
}

/**
 * Read-only part of the lane, shared with the dry-run script: which of the active
 * routine's slots for this product would be re-picked, and which need the person.
 */
export async function planCatalogChangeRepick(
  deps: Pick<Stage3CatalogChangeDeps, "routineState" | "persistence" | "catalogFit">,
  input: Stage3CatalogChangeInput,
): Promise<
  | { status: "no_active_routine" | "unchanged" | "legacy_source_draft" | "catalog_fit_unknown" }
  | { status: "needs_attention"; cases: Stage3CatalogChangeAttention[] }
  | {
      status: "repick"
      routine: Stage3RecomputeActiveRoutineVersion
      sourceDraft: Stage3ProductDraft
      subjects: Array<{ subjectKey: string; fit: Stage3PlannedProductFit }>
    }
> {
  const routine = await deps.routineState.loadActiveRoutineVersion({
    userId: input.userId,
    personalPlanId: input.personalPlanId,
  })
  if (!routine) return { status: "no_active_routine" }
  const items = itemsForProduct(routine, input)
  if (items.length === 0) return { status: "unchanged" }

  const affected: Array<{ item: RoutineItem; fit: Stage3PlannedProductFit }> = []
  for (const item of items) {
    const fit = await deps.catalogFit.plannedProductFit({
      userId: input.userId,
      personalPlanId: input.personalPlanId,
      refinedVersionId: routine.source.refinedVersionId,
      productId: input.productId,
      category: item.category,
      role: item.role,
    })
    if (fit === "unknown") return { status: "catalog_fit_unknown" }
    if (fit !== "fits") affected.push({ item, fit })
  }
  if (affected.length === 0) return { status: "unchanged" }

  if (routine.source.productDraftId === null || routine.source.productDraftRevision === null)
    return { status: "legacy_source_draft" }
  const sourceDraft = await deps.persistence.loadDraft({
    userId: input.userId,
    draftId: routine.source.productDraftId,
  })
  if (!sourceDraft) return { status: "legacy_source_draft" }

  const cases: Stage3CatalogChangeAttention[] = []
  for (const { item } of affected) {
    const subjectKey = item.sourceDecisionKeys[0] ?? item.itemKey
    if (item.product.kind === "owned") {
      cases.push({ subjectKey, productId: input.productId, reason: "owned" })
      continue
    }
    const explicit = sourceDraft.decisions.some(
      (decision) =>
        item.sourceDecisionKeys.includes(decision.decisionKey) &&
        decision.recommendation?.productId === input.productId &&
        decision.resolutionAction === "select_replacement",
    )
    if (explicit) cases.push({ subjectKey, productId: input.productId, reason: "explicit_choice" })
  }
  if (cases.length > 0) return { status: "needs_attention", cases }

  return {
    status: "repick",
    routine,
    sourceDraft,
    subjects: affected.map(({ item, fit }) => ({
      subjectKey: item.sourceDecisionKeys[0] ?? item.itemKey,
      fit,
    })),
  }
}

export async function recomputeRoutineAfterCatalogChange(
  deps: Stage3CatalogChangeDeps,
  input: Stage3CatalogChangeInput,
): Promise<Stage3CatalogChangeResult> {
  try {
    const { userId, personalPlanId } = input
    const planned = await planCatalogChangeRepick(deps, input)
    if (planned.status === "no_active_routine") return unavailable("no_active_routine", false)
    if (planned.status === "unchanged") return { status: "unchanged" }
    if (planned.status === "legacy_source_draft") return unavailable("legacy_source_draft", false)
    if (planned.status === "catalog_fit_unknown") return unavailable("catalog_fit_unknown", false)
    if (planned.status === "needs_attention") return planned
    if (planned.status !== "repick") return { status: "unchanged" }

    const starting = planned.routine
    const refinedVersionId = starting.source.refinedVersionId

    // 1. The routine's own authority-repair draft on the SAME refined version.
    try {
      await deps.repairDraft.createOrLoad({
        userId,
        personalPlanId,
        refinedVersionId,
        routineVersionId: starting.routineVersionId,
      })
    } catch (error) {
      return unavailable("repair_draft_unavailable", true, error)
    }
    async function acquire(): Promise<Stage3ProductDraft | null> {
      const loaded = await deps.gateway.loadOrCreate({
        draftId: "server-derived",
        userId,
        personalPlanId,
        refinedVersionId,
        requirements: [],
        rebuildOnStaleRefinedVersion: false,
      })
      return loaded.draft.refinedVersionId === refinedVersionId ? loaded.draft : null
    }
    const draft = await acquire()
    if (!draft) return unavailable("superseded", true)
    if (draft.status !== "active") return unavailable("draft_stale", true)

    // 2. Rehydrate the captures from the routine's immutable source draft.
    const rehydrated = await rehydrateStage3ProductDraft({
      persistence: deps.persistence,
      userId,
      personalPlanId,
      target: { draftId: draft.draftId, revision: draft.revision },
      source: {
        draftId: starting.source.productDraftId!,
        revision: starting.source.productDraftRevision!,
      },
    })
    if (rehydrated.status === "conflict") return unavailable("rehydration_conflict", true)
    if (rehydrated.status === "unavailable")
      return unavailable(rehydrated.reason, RETRYABLE_REHYDRATION_REASONS.has(rehydrated.reason))
    const reacquired = await acquire()
    if (!reacquired) return unavailable("superseded", true)
    if (
      reacquired.draftId !== rehydrated.draft.draftId ||
      reacquired.revision !== rehydrated.draft.revision
    )
      return unavailable("rehydration_reload_conflict", true)
    let current: Stage3ProductDraft = reacquired

    // 3. Re-author every decision; only the affected subjects are re-picked.
    const evaluations = await deps.gateway.evaluateDecisions({ draftId: current.draftId })
    const reviewBundles = await deps.gateway.reviewDecisionBundles({ draftId: current.draftId })
    const intentPlan = buildStage3RecomputeIntents({
      evaluations,
      reviewBundles,
      routine: starting.payload,
      repickProductIds: [input.productId],
    })
    if (intentPlan.blocked.length > 0) return unavailable("decision_blocked", false)
    let expectedRevision = current.revision
    for (
      let index = 0;
      index < intentPlan.intents.length;
      index += STAGE3_AUTHORITY_DECISION_BATCH_LIMIT
    ) {
      const resolved = await deps.gateway.resolveDecisions({
        draftId: current.draftId,
        expectedRevision,
        intents: intentPlan.intents.slice(index, index + STAGE3_AUTHORITY_DECISION_BATCH_LIMIT),
      })
      if (resolved.status === "conflict") return unavailable("resolve_conflict", true)
      current = resolved.draft
      expectedRevision = current.revision
    }
    // Same as the habits lane (step 3b, founder ruling R2): retained-inventory
    // dispositions re-derived on the repair draft are acknowledged, never dead-ended.
    for (const disposition of current.inventoryDispositions ?? []) {
      if (disposition.acknowledged) continue
      const acknowledged = await deps.gateway.acknowledgeInventoryDisposition({
        draftId: current.draftId,
        expectedRevision,
        dispositionKey: disposition.dispositionKey,
      })
      if (acknowledged.status === "conflict") return unavailable("acknowledge_conflict", true)
      current = acknowledged.draft
      expectedRevision = current.revision
    }

    // 4. Completion activates the successor routine (`personal_plan_complete_draft_activate_v2`).
    const completed = await deps.gateway.complete({
      draftId: current.draftId,
      expectedRevision: current.revision,
      markUnrefinedDirectAccept: false,
    })

    // 5. Only the owner-scoped re-read decides.
    const ending = await deps.routineState.loadActiveRoutineVersion({ userId, personalPlanId })
    const stillPlanned =
      ending !== null &&
      itemsForProduct(ending, input).some((item) => item.product.kind === "planned")
    if (ending && ending.routineVersionId !== starting.routineVersionId && !stillPlanned) {
      return {
        status: "applied",
        routineVersionId: ending.routineVersionId,
        repicked: intentPlan.repicked ?? [],
      }
    }
    if (completed.status === "not_ready") return unavailable("completion_not_ready", false)
    if (completed.status === "conflict") return unavailable("completion_conflict", true)
    if (
      completed.routineProposalId !== null &&
      ending?.routineVersionId === starting.routineVersionId
    )
      return unavailable("pending_proposal_staged", false)
    return unavailable("repick_not_applied", true)
  } catch (error) {
    return unavailable("unexpected_error", true, error)
  }
}
