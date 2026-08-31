import assert from "node:assert/strict"
import test from "node:test"

import { CATEGORY_ROLE_POLICIES } from "../../../src/lib/personal-plan/products/authorities"
import type {
  PersonalPlanCategory,
  Stage3CategoryRequirement,
  Stage3InventoryDispositionV1,
  Stage3ProductDraft,
} from "../../../src/lib/personal-plan/products/contracts"
import { stage3InventoryDispositionKey } from "../../../src/lib/personal-plan/products/contracts"
import type { PlanCategoryDecision, PlanProductRole } from "../../../src/lib/personal-plan/types"
import { createStage3Draft } from "../../../src/lib/personal-plan/products/state-machine"
import { rehydrateStage3ProductDraft } from "../../../src/lib/personal-plan/refinement-recompute/rehydration"
import type { Stage3RehydrationPersistence } from "../../../src/lib/personal-plan/refinement-recompute/types"

const FINGERPRINT = "a".repeat(64)

function requirement(
  category: Stage3CategoryRequirement["category"],
  requiredRoles: Stage3CategoryRequirement["requiredRoles"],
): Stage3CategoryRequirement {
  return {
    category,
    requiredRoles,
    needSummary: category,
    authorityVersion: CATEGORY_ROLE_POLICIES[category].authorityVersion,
  }
}

const targetRequirements: Stage3CategoryRequirement[] = [
  requirement("shampoo", ["shampoo_everyday"]),
  requirement("conditioner", ["conditioner_rinse_out"]),
  requirement("mask", ["intensive_conditioning_mask"]),
]

function categoryDecision(
  category: PersonalPlanCategory,
  roles: PlanProductRole[],
): PlanCategoryDecision {
  return {
    category,
    resolution: "resolved",
    needTier: "basis",
    roles,
    target: null,
    frequency: null,
    reasons: [],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  }
}

/** Refined authority the fresh draft was rebuilt on. */
function authoritySnapshot(
  categoryDecisions: PlanCategoryDecision[],
): NonNullable<Stage3ProductDraft["authoritySnapshot"]> {
  return {
    schemaVersion: 1,
    refinedNeedVersionId: "refined-new",
    refinedInputHash: "refined-input-new",
    categoryDecisions,
    coverage: [],
    orderedCategories: categoryDecisions.map((decision) => decision.category),
    authorityVersions: Object.fromEntries(
      Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
        category,
        policy.authorityVersion,
      ]),
    ) as never,
  }
}

const maskDisposition: Stage3InventoryDispositionV1 = {
  schemaVersion: 1,
  dispositionKey: stage3InventoryDispositionKey("mask", "capture-mask"),
  capturedProductId: "capture-mask",
  category: "mask",
  planStatus: "not_used",
  reason: "not_assigned_to_final_role",
  acknowledged: true,
  authorityFingerprint: FINGERPRINT,
}

/** Immutable Stage-3 draft the active routine version was compiled from. */
function sourceDraft(overrides: Partial<Stage3ProductDraft> = {}): Stage3ProductDraft {
  const base = createStage3Draft({
    draftId: "draft-source",
    userId: "owner-a",
    personalPlanId: "plan-a",
    refinedVersionId: "refined-old",
    requirements: [...targetRequirements, requirement("oil", ["dry_finish"])],
    now: "2026-08-20T00:00:00.000Z",
  })
  return {
    ...base,
    status: "completed",
    pass: "ready_for_routine",
    // Completion records source_product_draft_revision (9) and then bumps the
    // draft row, so the completed row sits one revision above the recorded one.
    revision: 10,
    categoryCursor: null,
    completedCaptureCategories: ["shampoo", "conditioner", "mask", "oil"],
    products: [
      {
        capturedProductId: "capture-shampoo",
        userProductId: "owned-shampoo",
        identity: {
          kind: "catalog_product",
          productId: "catalog-shampoo",
          displayName: "Shampoo",
          category: "shampoo",
        },
        frequencyRange: "weekly_3_4x",
        ownership: "owned",
        source: "catalog_search",
      },
      {
        capturedProductId: "capture-conditioner",
        userProductId: "owned-conditioner",
        identity: {
          kind: "pending_submission",
          submissionId: "submission-conditioner",
          displayName: "Spülung",
          category: "conditioner",
          reviewStatus: "pending_review",
        },
        frequencyRange: "weekly_2x",
        ownership: "owned",
        source: "intake_fallback",
      },
      {
        capturedProductId: "capture-mask",
        userProductId: "owned-mask",
        identity: {
          kind: "catalog_product",
          productId: "catalog-mask",
          displayName: "Maske",
          category: "mask",
        },
        frequencyRange: "weekly_1x",
        ownership: "owned",
        source: "existing_inventory",
      },
    ],
    roleAssignments: [
      {
        capturedProductId: "capture-shampoo",
        category: "shampoo",
        roles: ["shampoo_everyday"],
      },
      {
        capturedProductId: "capture-conditioner",
        category: "conditioner",
        roles: ["conditioner_rinse_out"],
      },
    ],
    uncoveredRoles: [],
    decisions: [
      {
        decisionKey: "decision:shampoo:shampoo_everyday:capture-shampoo",
        category: "shampoo",
        role: "shampoo_everyday",
        capturedProductId: "capture-shampoo",
        verdict: "ideal",
        choiceState: "owned_active",
        criterionResults: [],
        recommendation: null,
        limitationAcknowledged: false,
      },
    ],
    completedDecisionKeys: ["decision:shampoo:shampoo_everyday:capture-shampoo"],
    inventoryDispositions: [maskDisposition],
    ...overrides,
  }
}

/** Freshly rebuilt, empty Stage-3 draft on the newer refined need version. */
function targetDraft(overrides: Partial<Stage3ProductDraft> = {}): Stage3ProductDraft {
  const base = createStage3Draft({
    draftId: "draft-target",
    userId: "owner-a",
    personalPlanId: "plan-a",
    refinedVersionId: "refined-new",
    requirements: targetRequirements,
    now: "2026-08-31T00:00:00.000Z",
  })
  return { ...base, revision: 3, ...overrides }
}

type SaveOutcome = "saved" | "revision_conflict" | "stale_source"

function fakePersistence(input: {
  drafts: Record<string, unknown>
  saveOutcome?: SaveOutcome
  conflictRevision?: number
}) {
  const saves: Array<{ draftId: string; expectedRevision: number; draft: Stage3ProductDraft }> = []
  const loads: string[] = []
  const persistence: Stage3RehydrationPersistence = {
    loadDraft: async ({ userId, draftId }) => {
      loads.push(draftId)
      if (userId !== "owner-a") return null
      const draft = input.drafts[draftId]
      return (draft ?? null) as Stage3ProductDraft | null
    },
    save: async ({ draftId, expectedRevision, draft }) => {
      saves.push({ draftId, expectedRevision, draft })
      const outcome = input.saveOutcome ?? "saved"
      if (outcome === "saved") {
        return { outcome, draft: { ...draft, revision: expectedRevision + 1 } }
      }
      if (outcome === "revision_conflict") {
        return {
          outcome,
          draft: { ...draft, revision: input.conflictRevision ?? expectedRevision + 5 },
        }
      }
      return { outcome, draft }
    },
  }
  return { persistence, saves, loads }
}

function run(
  persistence: Stage3RehydrationPersistence,
  overrides: { targetRevision?: number; sourceRevision?: number } = {},
) {
  return rehydrateStage3ProductDraft({
    persistence,
    userId: "owner-a",
    personalPlanId: "plan-a",
    target: { draftId: "draft-target", revision: overrides.targetRevision ?? 3 },
    source: { draftId: "draft-source", revision: overrides.sourceRevision ?? 9 },
  })
}

test("copies captures, frequencies, role assignments and pending products into the fresh draft", async () => {
  const source = sourceDraft()
  const { persistence, saves } = fakePersistence({
    drafts: { "draft-source": source, "draft-target": targetDraft() },
  })

  const result = await run(persistence)

  assert.equal(result.status, "rehydrated")
  if (result.status !== "rehydrated") return
  assert.deepEqual(result.draft.products, source.products)
  assert.deepEqual(result.draft.roleAssignments, source.roleAssignments)
  assert.equal(
    result.draft.products.find((product) => product.capturedProductId === "capture-shampoo")
      ?.frequencyRange,
    "weekly_3_4x",
  )
  assert.equal(
    result.draft.products.find((product) => product.capturedProductId === "capture-conditioner")
      ?.identity.kind,
    "pending_submission",
  )
  assert.equal(result.draft.draftId, "draft-target")
  assert.equal(result.draft.refinedVersionId, "refined-new")
  assert.equal(saves.length, 1)
  assert.equal(saves[0]?.expectedRevision, 3)
  assert.equal(saves[0]?.draftId, "draft-target")
})

test("does not copy decisions from the source draft", async () => {
  const { persistence } = fakePersistence({
    drafts: { "draft-source": sourceDraft(), "draft-target": targetDraft() },
  })

  const result = await run(persistence)

  assert.equal(result.status, "rehydrated")
  if (result.status !== "rehydrated") return
  assert.deepEqual(result.draft.decisions, [])
  assert.deepEqual(result.draft.completedDecisionKeys, [])
})

test("carries retained-inventory dispositions across, including acknowledgement", async () => {
  const { persistence } = fakePersistence({
    drafts: { "draft-source": sourceDraft(), "draft-target": targetDraft() },
  })

  const result = await run(persistence)

  assert.equal(result.status, "rehydrated")
  if (result.status !== "rehydrated") return
  assert.deepEqual(result.draft.inventoryDispositions, [maskDisposition])
})

test("skips captures whose category left the refined plan", async () => {
  const source = sourceDraft()
  const withOil: Stage3ProductDraft = {
    ...source,
    products: [
      ...source.products,
      {
        capturedProductId: "capture-oil",
        userProductId: "owned-oil",
        identity: {
          kind: "catalog_product",
          productId: "catalog-oil",
          displayName: "Öl",
          category: "oil",
        },
        frequencyRange: "weekly_1x",
        ownership: "owned",
        source: "catalog_search",
      },
    ],
    inventoryDispositions: [
      maskDisposition,
      {
        schemaVersion: 1,
        dispositionKey: stage3InventoryDispositionKey("oil", "capture-oil"),
        capturedProductId: "capture-oil",
        category: "oil",
        planStatus: "not_used",
        reason: "category_not_in_final_plan",
        acknowledged: false,
        authorityFingerprint: FINGERPRINT,
      },
    ],
  }
  const { persistence } = fakePersistence({
    drafts: { "draft-source": withOil, "draft-target": targetDraft() },
  })

  const result = await run(persistence)

  assert.equal(result.status, "rehydrated")
  if (result.status !== "rehydrated") return
  assert.deepEqual(
    result.draft.products.map((product) => product.capturedProductId),
    ["capture-shampoo", "capture-conditioner", "capture-mask"],
  )
  assert.deepEqual(result.draft.inventoryDispositions, [maskDisposition])
})

test("drops assignments to a role the refined plan no longer requires and retains the capture", async () => {
  const source = sourceDraft()
  const withLeaveIn: Stage3ProductDraft = {
    ...source,
    orderedCategories: [...source.orderedCategories, "leave_in"],
    authorityVersions: {
      ...source.authorityVersions,
      leave_in: CATEGORY_ROLE_POLICIES.leave_in.authorityVersion,
    },
    products: [
      ...source.products,
      {
        capturedProductId: "capture-leave-in",
        userProductId: "owned-leave-in",
        identity: {
          kind: "catalog_product",
          productId: "catalog-leave-in",
          displayName: "Leave-in",
          category: "leave_in",
        },
        frequencyRange: "weekly_2x",
        ownership: "owned",
        source: "catalog_search",
      },
    ],
    roleAssignments: [
      ...source.roleAssignments,
      {
        capturedProductId: "capture-leave-in",
        category: "leave_in",
        roles: ["post_wash_leave_in"],
      },
    ],
  }
  // The refined plan now wants the leave-in for heat protection instead.
  const target = targetDraft({
    orderedCategories: ["shampoo", "conditioner", "mask", "leave_in"],
    authorityVersions: {
      shampoo: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
      conditioner: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
      mask: CATEGORY_ROLE_POLICIES.mask.authorityVersion,
      leave_in: CATEGORY_ROLE_POLICIES.leave_in.authorityVersion,
    },
    uncoveredRoles: [
      { category: "leave_in", role: "pre_heat_application", reason: "no_product_owned" },
    ],
    authoritySnapshot: authoritySnapshot([
      categoryDecision("shampoo", ["shampoo_everyday"]),
      categoryDecision("conditioner", ["conditioner_rinse_out"]),
      categoryDecision("mask", ["intensive_conditioning_mask"]),
      categoryDecision("leave_in", ["pre_heat_application"]),
    ]),
  })
  const { persistence } = fakePersistence({
    drafts: { "draft-source": withLeaveIn, "draft-target": target },
  })

  const result = await run(persistence)

  assert.equal(result.status, "rehydrated")
  if (result.status !== "rehydrated") return
  assert.equal(
    result.draft.roleAssignments.some(
      (assignment) => assignment.capturedProductId === "capture-leave-in",
    ),
    false,
  )
  assert.equal(
    result.draft.products.some((product) => product.capturedProductId === "capture-leave-in"),
    true,
  )
  assert.deepEqual(result.draft.uncoveredRoles, [
    { category: "leave_in", role: "pre_heat_application", reason: "no_product_owned" },
  ])
  assert.deepEqual(
    result.draft.roleAssignments.map((assignment) => assignment.capturedProductId),
    ["capture-shampoo", "capture-conditioner"],
  )
})

test("clears fresh-draft uncovered roles that the copied assignments now cover", async () => {
  const target = targetDraft({
    uncoveredRoles: [
      { category: "shampoo", role: "shampoo_everyday", reason: "no_product_owned" },
      { category: "mask", role: "intensive_conditioning_mask", reason: "no_product_owned" },
    ],
  })
  const { persistence } = fakePersistence({
    drafts: { "draft-source": sourceDraft(), "draft-target": target },
  })

  const result = await run(persistence)

  assert.equal(result.status, "rehydrated")
  if (result.status !== "rehydrated") return
  assert.deepEqual(result.draft.uncoveredRoles, [
    { category: "mask", role: "intensive_conditioning_mask", reason: "no_product_owned" },
  ])
})

test("fails closed when the source draft moved on past the routine version's revision", async () => {
  const { persistence, saves } = fakePersistence({
    drafts: { "draft-source": sourceDraft({ revision: 12 }), "draft-target": targetDraft() },
  })

  const result = await run(persistence)

  assert.deepEqual(result, { status: "unavailable", reason: "source_revision_mismatch" })
  assert.equal(saves.length, 0)
})

test("expects the completion revision bump, not the recorded revision itself", async () => {
  const { persistence, saves } = fakePersistence({
    drafts: { "draft-source": sourceDraft({ revision: 9 }), "draft-target": targetDraft() },
  })

  const result = await run(persistence, { sourceRevision: 9 })

  assert.deepEqual(result, { status: "unavailable", reason: "source_revision_mismatch" })
  assert.equal(saves.length, 0)
})

test("fails closed when the source draft was never completed", async () => {
  const { persistence, saves } = fakePersistence({
    drafts: {
      "draft-source": sourceDraft({ status: "active", revision: 10 }),
      "draft-target": targetDraft(),
    },
  })

  const result = await run(persistence)

  assert.deepEqual(result, { status: "unavailable", reason: "source_draft_not_completed" })
  assert.equal(saves.length, 0)
})

test("fails closed when source and target are the same draft", async () => {
  const { persistence, saves, loads } = fakePersistence({
    drafts: { "draft-target": targetDraft() },
  })

  const result = await rehydrateStage3ProductDraft({
    persistence,
    userId: "owner-a",
    personalPlanId: "plan-a",
    target: { draftId: "draft-target", revision: 3 },
    source: { draftId: "draft-target", revision: 2 },
  })

  assert.deepEqual(result, { status: "unavailable", reason: "source_is_target" })
  assert.equal(loads.length, 0)
  assert.equal(saves.length, 0)
})

test("fails closed when the source draft row is missing", async () => {
  const { persistence, saves } = fakePersistence({
    drafts: { "draft-target": targetDraft() },
  })

  const result = await run(persistence)

  assert.deepEqual(result, { status: "unavailable", reason: "source_draft_missing" })
  assert.equal(saves.length, 0)
})

test("fails closed when the source draft payload cannot be parsed", async () => {
  const source = sourceDraft()
  const { persistence, saves } = fakePersistence({
    drafts: {
      "draft-source": { ...source, products: [{ capturedProductId: "capture-shampoo" }] },
      "draft-target": targetDraft(),
    },
  })

  const result = await run(persistence)

  assert.deepEqual(result, { status: "unavailable", reason: "source_draft_unparsable" })
  assert.equal(saves.length, 0)
})

test("fails closed when the source draft belongs to another personal plan", async () => {
  const { persistence, saves } = fakePersistence({
    drafts: {
      "draft-source": sourceDraft({ personalPlanId: "plan-b" }),
      "draft-target": targetDraft(),
    },
  })

  const result = await run(persistence)

  assert.deepEqual(result, { status: "unavailable", reason: "source_draft_foreign_plan" })
  assert.equal(saves.length, 0)
})

test("fails closed when the fresh target draft is missing", async () => {
  const { persistence, saves } = fakePersistence({
    drafts: { "draft-source": sourceDraft() },
  })

  const result = await run(persistence)

  assert.deepEqual(result, { status: "unavailable", reason: "target_draft_missing" })
  assert.equal(saves.length, 0)
})

test("fails closed when the fresh target draft payload cannot be parsed", async () => {
  const { persistence, saves } = fakePersistence({
    drafts: {
      "draft-source": sourceDraft(),
      "draft-target": { ...targetDraft(), orderedCategories: [] },
    },
  })

  const result = await run(persistence)

  assert.deepEqual(result, { status: "unavailable", reason: "target_draft_unparsable" })
  assert.equal(saves.length, 0)
})

test("fails closed when the fresh target draft is no longer active", async () => {
  const { persistence, saves } = fakePersistence({
    drafts: {
      "draft-source": sourceDraft(),
      "draft-target": targetDraft({ status: "stale" }),
    },
  })

  const result = await run(persistence)

  assert.deepEqual(result, { status: "unavailable", reason: "target_draft_not_active" })
  assert.equal(saves.length, 0)
})

test("fails closed when the fresh target draft waits on a need-revision proposal", async () => {
  const { persistence, saves } = fakePersistence({
    drafts: {
      "draft-source": sourceDraft(),
      "draft-target": targetDraft({ pass: "need_revision_review" }),
    },
  })

  const result = await run(persistence)

  assert.deepEqual(result, { status: "unavailable", reason: "target_draft_pending_need_revision" })
  assert.equal(saves.length, 0)
})

test("reports a conflict when the target revision moved before the write", async () => {
  const { persistence, saves } = fakePersistence({
    drafts: { "draft-source": sourceDraft(), "draft-target": targetDraft({ revision: 5 }) },
  })

  const result = await run(persistence, { targetRevision: 3 })

  assert.deepEqual(result, { status: "conflict", currentRevision: 5 })
  assert.equal(saves.length, 0)
})

test("reports a conflict when the guarded write loses the compare-and-set", async () => {
  const { persistence, saves } = fakePersistence({
    drafts: { "draft-source": sourceDraft(), "draft-target": targetDraft() },
    saveOutcome: "revision_conflict",
    conflictRevision: 8,
  })

  const result = await run(persistence)

  assert.deepEqual(result, { status: "conflict", currentRevision: 8 })
  assert.equal(saves.length, 1)
})

test("fails closed when the guarded write reports a stale refined source", async () => {
  const { persistence } = fakePersistence({
    drafts: { "draft-source": sourceDraft(), "draft-target": targetDraft() },
    saveOutcome: "stale_source",
  })

  const result = await run(persistence)

  assert.deepEqual(result, { status: "unavailable", reason: "target_draft_stale_source" })
})

test("re-running against an already rehydrated draft does not duplicate state", async () => {
  const source = sourceDraft()
  const first = fakePersistence({
    drafts: { "draft-source": source, "draft-target": targetDraft() },
  })
  const firstResult = await run(first.persistence)
  assert.equal(firstResult.status, "rehydrated")
  if (firstResult.status !== "rehydrated") return
  assert.equal(first.saves.length, 1)
  assert.equal(firstResult.draft.revision, 4)

  const second = fakePersistence({
    drafts: { "draft-source": source, "draft-target": firstResult.draft },
  })
  const secondResult = await run(second.persistence, { targetRevision: firstResult.draft.revision })

  assert.equal(secondResult.status, "rehydrated")
  if (secondResult.status !== "rehydrated") return
  // The write is unconditional, so a no-op re-run still advances the revision.
  assert.equal(second.saves.length, 1)
  assert.equal(second.saves[0]?.expectedRevision, 4)
  assert.equal(secondResult.draft.revision, 5)
  assert.deepEqual(secondResult.draft.products, firstResult.draft.products)
  assert.deepEqual(secondResult.draft.roleAssignments, firstResult.draft.roleAssignments)
  assert.deepEqual(
    secondResult.draft.inventoryDispositions,
    firstResult.draft.inventoryDispositions,
  )
  assert.deepEqual(secondResult.draft.uncoveredRoles, firstResult.draft.uncoveredRoles)
})
