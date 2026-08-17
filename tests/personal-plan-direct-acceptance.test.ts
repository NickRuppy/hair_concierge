import assert from "node:assert/strict"
import test from "node:test"

import { STAGE1_STAGE2_LAB_ENVELOPE } from "../src/app/labs/personal-plan-stage-1-2/fixture"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import {
  acceptIdealPlan,
  buildDirectAcceptanceIntents,
  DirectAcceptanceError,
  type AcceptIdealPlanDeps,
  type DirectAcceptanceSeenRole,
  type DirectAcceptanceStage3Gateway,
} from "../src/lib/personal-plan/direct-acceptance/accept"
import {
  DIRECT_ACCEPTANCE_WET_WASH_FREQUENCY,
  buildDirectAcceptanceStage2Defaults,
  directAcceptanceAssumptions,
} from "../src/lib/personal-plan/direct-acceptance/defaults"
import { createPersistedStage2RefinementGateway } from "../src/lib/personal-plan/refinement/production-persistence-gateway"
import { buildPlanRoutineContextFromCompletedRefinement } from "../src/lib/personal-plan/refinement/stage1-adapter"
import { deriveStage2TriggerContext } from "../src/lib/personal-plan/refinement/stage1-adapter"
import { resolveStage2RefinementContract } from "../src/lib/personal-plan/refinement/question-path"
import type {
  Stage2PersistedDraft,
  Stage2RefinementPersistence,
} from "../src/lib/personal-plan/persistence/stage2-refinement-service"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "../src/lib/personal-plan/refinement/types"
import type { Stage3AuthorityEvaluation } from "../src/lib/personal-plan/products/authority/contracts"
import type { Stage3ProductDraft } from "../src/lib/personal-plan/products/contracts"
import { PRODUCT_FREQUENCY_LABELS } from "../src/lib/vocabulary/frequencies"

const ARTIFACT_ID = "11111111-1111-4111-8111-111111111111"
const PERSONAL_PLAN_ID = "22222222-2222-4222-8222-222222222222"
const INITIAL_NEED_VERSION_ID = "33333333-3333-4333-8333-333333333333"
const REFINED_NEED_VERSION_ID = "44444444-4444-4444-8444-444444444444"
const DRAFT_ID = "55555555-5555-4555-8555-555555555555"
const USER_ID = "66666666-6666-4666-8666-666666666666"

function labTriggerContext(): Stage2TriggerContext {
  const initial = computeNeedPlan({
    rawEnvelope: STAGE1_STAGE2_LAB_ENVELOPE,
    artifactId: ARTIFACT_ID,
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-16T09:00:00.000Z",
  })
  assert.equal(initial.status, "ready")
  if (initial.status !== "ready") throw new Error("unreachable")
  return deriveStage2TriggerContext(initial.snapshot)
}

const TRIGGER_CONTEXT_VARIANTS: Array<{ name: string; triggerContext: Stage2TriggerContext }> = [
  {
    name: "lab quiz source",
    triggerContext: labTriggerContext(),
  },
  {
    name: "no irritation, bridge ineligible",
    triggerContext: {
      relevantCategories: ["shampoo", "conditioner"],
      hasReportedIrritatedScalp: false,
      dryShampooBridgeEligibility: "ineligible",
    },
  },
  {
    name: "no irritation, bridge eligible",
    triggerContext: {
      relevantCategories: ["shampoo", "conditioner", "mask"],
      hasReportedIrritatedScalp: false,
      dryShampooBridgeEligibility: "eligible",
    },
  },
  {
    name: "irritation, bridge eligible",
    triggerContext: {
      relevantCategories: ["shampoo", "conditioner", "scalp_care"],
      hasReportedIrritatedScalp: true,
      dryShampooBridgeEligibility: "eligible",
    },
  },
]

/* ── Defaults: Stage-2 contract completeness ── */

for (const variant of TRIGGER_CONTEXT_VARIANTS) {
  test(`direct-acceptance defaults complete the Stage 2 contract (${variant.name})`, () => {
    const defaults = buildDirectAcceptanceStage2Defaults(variant.triggerContext)
    const contract = resolveStage2RefinementContract({
      triggerContext: variant.triggerContext,
      answers: defaults.answers,
      completedQuestionIds: defaults.completedQuestionIds,
    })

    assert.deepEqual(contract.validationErrors, [])
    assert.equal(contract.path.firstUnresolvedQuestionId, null)
    assert.equal(contract.isComplete, true)
    assert.deepEqual(contract.prunedAnswerKeys, [])
  })

  test(`direct-acceptance defaults project a conservative routine context (${variant.name})`, () => {
    const defaults = buildDirectAcceptanceStage2Defaults(variant.triggerContext)
    const routine = buildPlanRoutineContextFromCompletedRefinement({
      triggerContext: variant.triggerContext,
      answers: defaults.answers,
      completedQuestionIds: defaults.completedQuestionIds,
    })

    assert.deepEqual(routine.shampooFrequency, {
      state: "known",
      value: DIRECT_ACCEPTANCE_WET_WASH_FREQUENCY,
    })
    assert.deepEqual(routine.currentProductLoad, {
      state: "known",
      value: { categories: [], oilPurposes: [] },
    })
    assert.deepEqual(routine.heatToolUse, { state: "known", value: [] })
    assert.deepEqual(routine.mechanicalExposureSignals, [])
  })
}

test("direct-acceptance defaults recompute a refined plan without clarification", () => {
  const triggerContext = labTriggerContext()
  const defaults = buildDirectAcceptanceStage2Defaults(triggerContext)
  const refined = computeNeedPlan({
    rawEnvelope: STAGE1_STAGE2_LAB_ENVELOPE,
    artifactId: ARTIFACT_ID,
    projection: "refined_post_plan",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-16T09:00:00.000Z",
    routine: buildPlanRoutineContextFromCompletedRefinement({
      triggerContext,
      answers: defaults.answers,
      completedQuestionIds: defaults.completedQuestionIds,
    }),
  })

  assert.equal(refined.status, "ready")
  if (refined.status !== "ready") throw new Error("unreachable")
  assert.ok(refined.snapshot.renderedOrder.length > 0)
  // Air-drying defaults must not invent a Heat Protectant the Idealplan never showed.
  assert.equal(refined.snapshot.renderedOrder.includes("heat_protectant"), false)
  // Nor a Dry Shampoo, because the bridge default declines it.
  assert.equal(refined.snapshot.renderedOrder.includes("dry_shampoo"), false)
})

/**
 * Pins a known, deliberate limit of the "accept the plan you see" promise.
 * Stage 1 defers Scalp Care whenever an irritated scalp is reported, so it is
 * absent from the Idealplan. Answering the deferred question at all resolves the
 * deferral, and for an oily scalp the `scalp_flake_oil_adjunct` role then comes
 * from `scalpOiliness`, not from the irritation answer. The "normal" default
 * avoids the extra `scalp_comfort` role but cannot avoid this one.
 */
test("resolving the deferred scalp question can still add Scalp Care for an oily scalp", () => {
  const triggerContext = labTriggerContext()
  assert.equal(triggerContext.hasReportedIrritatedScalp, true)

  const initial = computeNeedPlan({
    rawEnvelope: STAGE1_STAGE2_LAB_ENVELOPE,
    artifactId: ARTIFACT_ID,
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-16T09:00:00.000Z",
  })
  if (initial.status !== "ready") throw new Error("unreachable")
  assert.equal(initial.snapshot.renderedOrder.includes("scalp_care"), false)

  const defaults = buildDirectAcceptanceStage2Defaults(triggerContext)
  assert.equal(defaults.answers.scalpIrritationDetail, "normal")
  const refined = computeNeedPlan({
    rawEnvelope: STAGE1_STAGE2_LAB_ENVELOPE,
    artifactId: ARTIFACT_ID,
    projection: "refined_post_plan",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-16T09:00:00.000Z",
    routine: buildPlanRoutineContextFromCompletedRefinement({
      triggerContext,
      answers: defaults.answers,
      completedQuestionIds: defaults.completedQuestionIds,
    }),
  })
  if (refined.status !== "ready") throw new Error("unreachable")

  const scalpCare = refined.snapshot.decisions.find(
    (decision) => decision.category === "scalp_care",
  )
  assert.deepEqual(scalpCare?.roles, ["scalp_flake_oil_adjunct"])
  // The "normal" default at least keeps the irritation-driven comfort role out.
  assert.equal(scalpCare?.roles.includes("scalp_comfort"), false)
})

/* ── Defaults: German assumption labels ── */

test("assumption labels stay honest to the chosen defaults", () => {
  const assumptions = directAcceptanceAssumptions({
    relevantCategories: ["shampoo"],
    hasReportedIrritatedScalp: false,
    dryShampooBridgeEligibility: "ineligible",
  })

  assert.ok(assumptions.length >= 4)
  for (const assumption of assumptions) {
    assert.ok(assumption.id.length > 0)
    assert.ok(assumption.label.trim().length > 0)
  }
  const washAssumption = assumptions.find((item) => item.id === "wet_wash_frequency")
  assert.ok(washAssumption)
  assert.ok(
    washAssumption.label.includes(PRODUCT_FREQUENCY_LABELS[DIRECT_ACCEPTANCE_WET_WASH_FREQUENCY]),
    `wash label must name the actual default frequency, got "${washAssumption.label}"`,
  )
  assert.equal(
    assumptions.some((item) => item.id === "scalp_irritation_detail"),
    false,
  )
  assert.equal(
    assumptions.some((item) => item.id === "dry_shampoo_bridge_preference"),
    false,
  )
})

test("assumption labels disclose the conditional Stage 2 answers", () => {
  const assumptions = directAcceptanceAssumptions({
    relevantCategories: ["shampoo", "scalp_care"],
    hasReportedIrritatedScalp: true,
    dryShampooBridgeEligibility: "eligible",
  })

  assert.ok(assumptions.some((item) => item.id === "scalp_irritation_detail"))
  assert.ok(assumptions.some((item) => item.id === "dry_shampoo_bridge_preference"))
})

test("every assumption maps to an answered default question", () => {
  for (const variant of TRIGGER_CONTEXT_VARIANTS) {
    const defaults = buildDirectAcceptanceStage2Defaults(variant.triggerContext)
    const answered = new Set<string>(defaults.completedQuestionIds)
    for (const assumption of directAcceptanceAssumptions(variant.triggerContext)) {
      assert.ok(
        answered.has(assumption.id),
        `${variant.name}: assumption ${assumption.id} is not an answered question`,
      )
    }
  }
})

/* ── Per-role resolution ── */

function knownEvaluation(
  category: Stage3AuthorityEvaluation["category"],
  role: string,
  productId: string,
): Stage3AuthorityEvaluation {
  return {
    status: "known",
    category,
    subjectKey: `decision:${category}:${role}:gap`,
    verdict: "unknown",
    criteria: [],
    allowedActions: ["plan_recommendation", "leave_uncovered"],
    recommendation: {
      recommendationId: `rec-${productId}`,
      productId,
      category,
      role: role as never,
      displayName: `Produkt ${productId}`,
      reason: "Passt zu deinem Bedarf.",
      authorityRuleId: `${category}.rule.v1`,
    },
    productFactFingerprint: null,
    recommendationFactFingerprint: `fingerprint-${productId}`,
    coverageRuleIds: [],
  }
}

const MULTI_ROLE_EVALUATIONS: Stage3AuthorityEvaluation[] = [
  knownEvaluation("shampoo", "shampoo_everyday", "p-shampoo-everyday"),
  knownEvaluation("shampoo", "shampoo_dandruff", "p-shampoo-dandruff"),
  knownEvaluation("conditioner", "conditioner_rinse_out", "p-conditioner"),
  knownEvaluation("oil", "pre_wash_fibre_treatment", "p-oil-prewash"),
  knownEvaluation("oil", "leave_on_fibre_conditioning", "p-oil-leave-on"),
  knownEvaluation("oil", "dry_finish", "p-oil-finish"),
]

function seenRolesFor(evaluations: Stage3AuthorityEvaluation[]): DirectAcceptanceSeenRole[] {
  return evaluations.map((evaluation) => {
    if (evaluation.status !== "known" || !evaluation.recommendation) {
      throw new Error("fixture evaluation must be known")
    }
    return {
      decisionKey: evaluation.subjectKey,
      productId: evaluation.recommendation.productId,
      factFingerprint: evaluation.recommendationFactFingerprint!,
    }
  })
}

test("every role gets its own planned-purchase intent, not one per category", () => {
  const intents = buildDirectAcceptanceIntents(
    MULTI_ROLE_EVALUATIONS,
    seenRolesFor(MULTI_ROLE_EVALUATIONS),
  )

  assert.equal(intents.length, MULTI_ROLE_EVALUATIONS.length)
  assert.deepEqual(
    intents.map((intent) => intent.subjectKey),
    MULTI_ROLE_EVALUATIONS.map((evaluation) => evaluation.subjectKey),
  )
  for (const intent of intents) {
    assert.equal(intent.type, "resolve_decision")
    assert.equal(intent.action, "plan_recommendation")
    // plan_recommendation must not carry a candidate override.
    assert.equal(intent.selectedCandidateId, undefined)
    assert.equal(intent.selectedCandidateFactFingerprint, undefined)
  }
  assert.equal(new Set(intents.map((intent) => intent.subjectKey)).size, intents.length)
})

test("a changed recommendation fact fingerprint rejects the accept request", () => {
  const seen = seenRolesFor(MULTI_ROLE_EVALUATIONS)
  seen[2] = { ...seen[2]!, factFingerprint: "fingerprint-stale" }

  assert.throws(
    () => buildDirectAcceptanceIntents(MULTI_ROLE_EVALUATIONS, seen),
    (error: unknown) => error instanceof DirectAcceptanceError && error.code === "seen_state_stale",
  )
})

test("a changed recommended product rejects the accept request", () => {
  const seen = seenRolesFor(MULTI_ROLE_EVALUATIONS)
  seen[0] = { ...seen[0]!, productId: "p-shampoo-other" }

  assert.throws(
    () => buildDirectAcceptanceIntents(MULTI_ROLE_EVALUATIONS, seen),
    (error: unknown) => error instanceof DirectAcceptanceError && error.code === "seen_state_stale",
  )
})

test("a missing or extra seen role rejects the accept request", () => {
  assert.throws(
    () =>
      buildDirectAcceptanceIntents(
        MULTI_ROLE_EVALUATIONS,
        seenRolesFor(MULTI_ROLE_EVALUATIONS).slice(1),
      ),
    (error: unknown) => error instanceof DirectAcceptanceError && error.code === "seen_state_stale",
  )
  assert.throws(
    () =>
      buildDirectAcceptanceIntents(MULTI_ROLE_EVALUATIONS, [
        ...seenRolesFor(MULTI_ROLE_EVALUATIONS),
        {
          decisionKey: "decision:mask:intensive_conditioning_mask:gap",
          productId: "p-mask",
          factFingerprint: "fingerprint-p-mask",
        },
      ]),
    (error: unknown) => error instanceof DirectAcceptanceError && error.code === "seen_state_stale",
  )
})

test("a role without a usable recommendation cannot be accepted directly", () => {
  const evaluations: Stage3AuthorityEvaluation[] = [
    {
      status: "unknown",
      category: "mask",
      subjectKey: "decision:mask:intensive_conditioning_mask:gap",
      missingFacts: ["spec"],
      criteria: [],
      allowedActions: ["leave_uncovered"],
      coverageRuleIds: [],
    },
  ]

  assert.throws(
    () =>
      buildDirectAcceptanceIntents(evaluations, [
        {
          decisionKey: "decision:mask:intensive_conditioning_mask:gap",
          productId: "p-mask",
          factFingerprint: "fingerprint-p-mask",
        },
      ]),
    (error: unknown) =>
      error instanceof DirectAcceptanceError && error.code === "recommendation_unavailable",
  )
})

/* ── A refinement persistence fake that enforces the real SQL constraints ── */

/**
 * Mirrors `supabase/migrations/20260808062602_personal_plan_stage1_3_foundation.sql`:
 *
 * - line 43  `personal_plan_need_versions_refined_input_key`
 *            UNIQUE (personal_plan_id, parent_need_version_id, input_hash) WHERE kind='refined'
 * - lines 67-69 `personal_plan_refinement_drafts_open_key`
 *            UNIQUE (personal_plan_id, base_initial_need_version_id) WHERE status='in_progress'
 * - lines 300-322 `personal_plan_complete_refinement_draft`, including the
 *            `already_completed` short-circuit, the revision CAS, the
 *            `ON CONFLICT … DO NOTHING` + re-select hash-collision path, the
 *            staling of active product drafts whose refined need id changed, and
 *            the `refined_need` source-change enqueue.
 * - lines 285-289 `personal_plan_save_refinement_draft` revision CAS.
 *
 * Read-after-conflict for both partial unique indexes mirrors
 * `stage2-refinement-supabase.ts` lines 50-79 (loadExisting: in_progress first,
 * then the newest complete draft), 107-118 (loadOrCreate) and 143-151 (reopen).
 *
 * Live-DB verification of these paths is deferred to controller verification;
 * this fake is the highest fidelity available while the migration must not be
 * applied.
 */
function createRefinementDb() {
  const triggerContext = labTriggerContext()
  type DraftRow = {
    id: string
    status: "in_progress" | "complete" | "stale"
    answers: PersonalPlanRefinementAnswersV1
    completedQuestionIds: Stage2QuestionId[]
    revision: number
    resultRefinedNeedVersionId: string | null
    updatedAt: number
  }

  const drafts: DraftRow[] = []
  const needVersions: Array<{ id: string; inputHash: string }> = []
  const productDrafts: Array<{ id: string; status: string; refinedNeedVersionId: string }> = []
  const sourceChanges: Array<{ sourceKind: string; sourceKey: string }> = []
  const plan = { currentRefinedNeedVersionId: null as string | null }
  let clock = 0
  let sequence = 0

  function openDraft(): DraftRow | undefined {
    return drafts.find((row) => row.status === "in_progress")
  }

  function newestCompleteDraft(): DraftRow | undefined {
    return drafts
      .filter((row) => row.status === "complete")
      .toSorted((left, right) => right.updatedAt - left.updatedAt)[0]
  }

  function toPersisted(row: DraftRow): Stage2PersistedDraft {
    return {
      id: row.id,
      personalPlanId: PERSONAL_PLAN_ID,
      baseInitialNeedVersionId: INITIAL_NEED_VERSION_ID,
      schemaVersion: 1,
      preparedArtifactSourceId: ARTIFACT_ID,
      baseInputSnapshot: STAGE1_STAGE2_LAB_ENVELOPE as never,
      pathVersion: "stage2-v1",
      triggerContext,
      answers: structuredClone(row.answers),
      completedQuestionIds: [...row.completedQuestionIds],
      revision: row.revision,
      status: row.status,
      refinedVersionId: row.resultRefinedNeedVersionId,
    }
  }

  function insertDraft(seed: Partial<DraftRow> = {}): DraftRow {
    // The partial unique index makes a concurrent create a safe read.
    const existing = openDraft()
    if (existing) return existing
    sequence += 1
    const row: DraftRow = {
      id: `draft-${sequence}`,
      status: "in_progress",
      answers: {},
      completedQuestionIds: [],
      revision: 0,
      resultRefinedNeedVersionId: null,
      updatedAt: (clock += 1),
      ...seed,
    }
    drafts.push(row)
    return row
  }

  const persistence: Stage2RefinementPersistence = {
    async loadOrCreate() {
      return toPersisted(openDraft() ?? newestCompleteDraft() ?? insertDraft())
    },
    async reopen({ draft }) {
      return toPersisted(
        insertDraft({
          answers: structuredClone(draft.answers),
          completedQuestionIds: [...draft.completedQuestionIds],
          revision: draft.revision,
        }),
      )
    },
    async save(input) {
      const row = drafts.find((candidate) => candidate.id === input.draft.id)
      if (!row) throw new Error("stage2_save_failed")
      if (row.status !== "in_progress" || row.revision !== input.expectedRevision) {
        return { outcome: "revision_conflict", revision: row.revision }
      }
      row.answers = structuredClone(input.answers)
      row.completedQuestionIds = [...input.completedQuestionIds]
      row.revision += 1
      row.updatedAt = clock += 1
      return { outcome: "saved", revision: row.revision }
    },
    async complete(input) {
      const row = drafts.find((candidate) => candidate.id === input.draft.id)
      if (!row) return { outcome: "stale_source" }
      if (row.status === "complete") {
        return {
          outcome: "already_completed",
          refinedVersionId: row.resultRefinedNeedVersionId!,
        }
      }
      if (row.status !== "in_progress" || row.revision !== input.expectedRevision) {
        return { outcome: "revision_conflict", revision: row.revision }
      }
      if (!/^[0-9a-f]{64}$/.test(input.inputHash)) throw new Error("invalid_refined_need")

      // ON CONFLICT (personal_plan_id, parent_need_version_id, input_hash)
      // WHERE kind='refined' DO NOTHING, then re-select the colliding row.
      let needVersion = needVersions.find((candidate) => candidate.inputHash === input.inputHash)
      if (!needVersion) {
        sequence += 1
        needVersion = { id: `refined-${sequence}`, inputHash: input.inputHash }
        needVersions.push(needVersion)
      }
      row.status = "complete"
      row.resultRefinedNeedVersionId = needVersion.id
      row.updatedAt = clock += 1
      for (const productDraft of productDrafts) {
        if (
          productDraft.status === "active" &&
          productDraft.refinedNeedVersionId !== needVersion.id
        ) {
          productDraft.status = "stale"
        }
      }
      plan.currentRefinedNeedVersionId = needVersion.id
      sourceChanges.push({ sourceKind: "refined_need", sourceKey: needVersion.id })
      return { outcome: "completed", refinedVersionId: needVersion.id }
    },
  }

  return { persistence, drafts, needVersions, productDrafts, sourceChanges, plan, insertDraft }
}

type RefinementDb = ReturnType<typeof createRefinementDb>

/* ── Chain orchestration ── */

function fakeStage3Draft(overrides: Partial<Stage3ProductDraft> = {}): Stage3ProductDraft {
  return {
    schemaVersion: 1,
    status: "active",
    authorityVersions: {} as Stage3ProductDraft["authorityVersions"],
    draftId: DRAFT_ID,
    userId: USER_ID,
    personalPlanId: PERSONAL_PLAN_ID,
    refinedVersionId: REFINED_NEED_VERSION_ID,
    staleRefinedVersionId: null,
    revision: 3,
    pass: "product_decisions",
    orderedCategories: ["shampoo", "conditioner", "oil"],
    categoryCursor: null,
    products: [],
    roleAssignments: [],
    uncoveredRoles: [],
    decisions: [],
    completedCaptureCategories: ["shampoo", "conditioner", "oil"],
    completedDecisionKeys: [],
    createdAt: "2026-08-16T09:00:00.000Z",
    updatedAt: "2026-08-16T09:00:00.000Z",
    ...overrides,
  } as Stage3ProductDraft
}

type Stage3Call =
  | { kind: "loadOrCreate"; personalPlanId: string; refinedVersionId: string }
  | { kind: "evaluateDecisions" }
  | { kind: "resolveDecisions"; expectedRevision: number; subjectKeys: string[] }
  | { kind: "complete"; expectedRevision: number }

/**
 * Stateful Stage-3 fake: `complete` flips the draft to completed and activates a
 * Routine, so a second accept exercises the real replay path rather than a
 * pre-seeded fixture.
 */
function createFakeStage3Gateway(options: {
  calls: Stage3Call[]
  planState: { activeRoutineVersionId: string | null }
  evaluations?: Stage3AuthorityEvaluation[]
}): DirectAcceptanceStage3Gateway {
  let draft = fakeStage3Draft()
  return {
    async loadOrCreate(input) {
      options.calls.push({
        kind: "loadOrCreate",
        personalPlanId: input.personalPlanId,
        refinedVersionId: input.refinedVersionId,
      })
      return { status: draft.status, draft, requirements: [] }
    },
    async evaluateDecisions() {
      options.calls.push({ kind: "evaluateDecisions" })
      return draft.status === "active" ? (options.evaluations ?? MULTI_ROLE_EVALUATIONS) : []
    },
    async resolveDecisions(input) {
      options.calls.push({
        kind: "resolveDecisions",
        expectedRevision: input.expectedRevision,
        subjectKeys: input.intents.map((intent) => intent.subjectKey),
      })
      draft = { ...draft, revision: input.expectedRevision + 1 }
      return { status: "saved", draft }
    },
    async complete(input) {
      options.calls.push({ kind: "complete", expectedRevision: input.expectedRevision })
      draft = { ...draft, status: "completed" }
      options.planState.activeRoutineVersionId = "routine-1"
      return {
        status: "ready_for_routine",
        draft,
        portfolio: { plannedPurchases: [], ownedProducts: [] } as never,
        personalPlanId: PERSONAL_PLAN_ID,
        refinedVersionId: REFINED_NEED_VERSION_ID,
        productPortfolioVersionId: "portfolio-1",
        routineProposalId: null,
        next: { stage: 4, href: "/routine" },
      }
    },
  }
}

type Harness = {
  deps: AcceptIdealPlanDeps
  db: RefinementDb
  stage3Calls: Stage3Call[]
  provenanceCalls: Array<{ personalPlanId: string; refinedVersionId: string }>
  planState: { activeRoutineVersionId: string | null }
}

function createHarness(
  overrides: {
    flags?: AcceptIdealPlanDeps["flags"]
    db?: RefinementDb
    activeRoutineVersionId?: string | null
    evaluations?: Stage3AuthorityEvaluation[]
  } = {},
): Harness {
  const db = overrides.db ?? createRefinementDb()
  const stage3Calls: Stage3Call[] = []
  const provenanceCalls: Array<{ personalPlanId: string; refinedVersionId: string }> = []
  const planState = { activeRoutineVersionId: overrides.activeRoutineVersionId ?? null }

  return {
    db,
    stage3Calls,
    provenanceCalls,
    planState,
    deps: {
      userId: USER_ID,
      flags: overrides.flags ?? { stage2Enabled: true, stage3Enabled: true, stage4Enabled: true },
      refinementPersistence: db.persistence,
      planState: {
        async loadActiveRoutineVersionId() {
          return planState.activeRoutineVersionId
        },
      },
      stage3Gateway: createFakeStage3Gateway({
        calls: stage3Calls,
        planState,
        evaluations: overrides.evaluations,
      }),
      provenance: {
        async recordDirectAccept(input) {
          provenanceCalls.push({
            personalPlanId: input.personalPlanId,
            refinedVersionId: input.refinedVersionId,
          })
        },
      },
    },
  }
}

const SEEN_ROLES = () => seenRolesFor(MULTI_ROLE_EVALUATIONS)

test("the accept chain drives Stage 2 completion, per-role planning and activation", async () => {
  const harness = createHarness()

  const result = await acceptIdealPlan(harness.deps, { seenRoles: SEEN_ROLES() })

  assert.equal(result.status, "accepted")
  assert.equal(result.productDraftId, DRAFT_ID)
  assert.equal(result.next.href, "/routine")

  const expectedDefaults = buildDirectAcceptanceStage2Defaults(labTriggerContext())
  assert.equal(harness.db.drafts.length, 1)
  assert.equal(harness.db.drafts[0]!.status, "complete")
  assert.deepEqual(harness.db.drafts[0]!.answers, expectedDefaults.answers)
  assert.deepEqual(
    harness.db.drafts[0]!.completedQuestionIds,
    expectedDefaults.completedQuestionIds,
  )
  assert.equal(harness.db.needVersions.length, 1)
  assert.equal(result.refinedVersionId, harness.db.needVersions[0]!.id)

  assert.deepEqual(
    harness.stage3Calls.map((call) => call.kind),
    ["loadOrCreate", "evaluateDecisions", "resolveDecisions", "complete"],
  )
  const resolveCall = harness.stage3Calls.find((call) => call.kind === "resolveDecisions")
  assert.ok(resolveCall && resolveCall.kind === "resolveDecisions")
  assert.deepEqual(
    resolveCall.subjectKeys,
    MULTI_ROLE_EVALUATIONS.map((evaluation) => evaluation.subjectKey),
  )
  const completeCall = harness.stage3Calls.find((call) => call.kind === "complete")
  assert.ok(completeCall && completeCall.kind === "complete")
  assert.equal(completeCall.expectedRevision, resolveCall.expectedRevision + 1)

  assert.deepEqual(harness.provenanceCalls, [
    { personalPlanId: PERSONAL_PLAN_ID, refinedVersionId: harness.db.needVersions[0]!.id },
  ])
})

/**
 * Activation has already committed by the time provenance is written, so the
 * Routine is live. Failing the request here would tell the user acceptance
 * failed while it in fact succeeded — and the retry converges to `conflict`,
 * not to a second accept. The write stays best-effort and logged.
 */
test("a failed provenance write still returns accepted and only logs a warning", async () => {
  const harness = createHarness()
  const attempts: Array<{ personalPlanId: string; refinedVersionId: string }> = []
  harness.deps.provenance = {
    async recordDirectAccept(input) {
      attempts.push({
        personalPlanId: input.personalPlanId,
        refinedVersionId: input.refinedVersionId,
      })
      throw Object.assign(new Error("direct_accept_provenance_write_failed"), { code: "42703" })
    },
  }
  const warnings: unknown[][] = []
  const originalWarn = console.warn
  console.warn = (...args: unknown[]) => {
    warnings.push(args)
  }

  try {
    const result = await acceptIdealPlan(harness.deps, { seenRoles: SEEN_ROLES() })
    assert.equal(result.status, "accepted")
    assert.equal(result.next.href, "/routine")
  } finally {
    console.warn = originalWarn
  }

  // The write is still ATTEMPTED — only its failure is tolerated.
  assert.deepEqual(attempts, [
    { personalPlanId: PERSONAL_PLAN_ID, refinedVersionId: harness.db.needVersions[0]!.id },
  ])
  assert.equal(warnings.length, 1)
  assert.equal(warnings[0]![0], "personal_plan_direct_accept_provenance_write_failed")
  assert.deepEqual(warnings[0]![1], {
    code: "42703",
    message: "direct_accept_provenance_write_failed",
  })
})

test("a disabled Stage 2, 3 or 4 flag refuses the accept chain without any write", async () => {
  for (const flags of [
    { stage2Enabled: false, stage3Enabled: true, stage4Enabled: true },
    { stage2Enabled: true, stage3Enabled: false, stage4Enabled: true },
    { stage2Enabled: true, stage3Enabled: true, stage4Enabled: false },
  ]) {
    const harness = createHarness({ flags })

    await assert.rejects(
      acceptIdealPlan(harness.deps, { seenRoles: SEEN_ROLES() }),
      (error: unknown) =>
        error instanceof DirectAcceptanceError && error.code === "stage_not_available",
    )
    assert.deepEqual(harness.db.drafts, [])
    assert.deepEqual(harness.stage3Calls, [])
    assert.deepEqual(harness.provenanceCalls, [])
  }
})

test("a stale seen state aborts before any Stage 3 decision is written", async () => {
  const harness = createHarness()
  const seen = SEEN_ROLES()
  seen[1] = { ...seen[1]!, factFingerprint: "fingerprint-changed" }

  await assert.rejects(
    acceptIdealPlan(harness.deps, { seenRoles: seen }),
    (error: unknown) => error instanceof DirectAcceptanceError && error.code === "seen_state_stale",
  )
  assert.deepEqual(
    harness.stage3Calls.map((call) => call.kind),
    ["loadOrCreate", "evaluateDecisions"],
  )
  assert.deepEqual(harness.provenanceCalls, [])
})

/* ── Guards against destroying real work ── */

test("a partially answered real Stage 2 refuses the accept and writes nothing", async () => {
  const db = createRefinementDb()
  // The user answered the first Stage-2 question for real and left.
  db.insertDraft({
    answers: { currentProductCategories: ["shampoo", "conditioner"] },
    completedQuestionIds: ["current_product_categories"],
    revision: 1,
  })
  const harness = createHarness({ db })
  const before = structuredClone(db.drafts)

  await assert.rejects(
    acceptIdealPlan(harness.deps, { seenRoles: SEEN_ROLES() }),
    (error: unknown) =>
      error instanceof DirectAcceptanceError && error.code === "refinement_in_progress",
  )
  assert.deepEqual(db.drafts, before, "the real answers must survive untouched")
  assert.deepEqual(db.needVersions, [])
  assert.deepEqual(harness.stage3Calls, [])
  assert.deepEqual(harness.provenanceCalls, [])
})

test("an interrupted synthetic save resumes instead of being treated as real work", async () => {
  const db = createRefinementDb()
  const defaults = buildDirectAcceptanceStage2Defaults(labTriggerContext())
  // A previous accept saved the defaults and crashed before completing.
  db.insertDraft({
    answers: defaults.answers,
    completedQuestionIds: defaults.completedQuestionIds,
    revision: 1,
  })
  const harness = createHarness({ db })

  const result = await acceptIdealPlan(harness.deps, { seenRoles: SEEN_ROLES() })

  assert.equal(result.status, "accepted")
  assert.equal(db.drafts.length, 1)
  assert.equal(db.drafts[0]!.status, "complete")
})

test("an active Routine this flow did not create refuses the accept", async () => {
  const harness = createHarness({ activeRoutineVersionId: "routine-from-real-stage-3" })

  await assert.rejects(
    acceptIdealPlan(harness.deps, { seenRoles: SEEN_ROLES() }),
    (error: unknown) =>
      error instanceof DirectAcceptanceError && error.code === "plan_already_accepted",
  )
  assert.deepEqual(harness.db.needVersions, [])
  assert.deepEqual(harness.stage3Calls, [])
  assert.deepEqual(harness.provenanceCalls, [])
})

test("a double accept stays idempotent and returns the same receipt", async () => {
  const harness = createHarness()

  const first = await acceptIdealPlan(harness.deps, { seenRoles: SEEN_ROLES() })
  assert.equal(harness.planState.activeRoutineVersionId, "routine-1")

  const second = await acceptIdealPlan(harness.deps, { seenRoles: SEEN_ROLES() })

  assert.deepEqual(second, first)
  assert.equal(harness.db.drafts.length, 1, "no second refinement draft")
  assert.equal(harness.db.needVersions.length, 1, "no second refined need version")
  // The replay reuses the completed refinement and the completed product draft.
  assert.deepEqual(
    harness.stage3Calls.map((call) => call.kind),
    [
      "loadOrCreate",
      "evaluateDecisions",
      "resolveDecisions",
      "complete",
      "loadOrCreate",
      "complete",
    ],
  )
  assert.equal(harness.provenanceCalls.length, 2)
})

/* ── Post-accept refinement: the two SQL constraint paths ── */

test("a real Stage 2 replaying the defaults completes as a clean re-refinement", async () => {
  const harness = createHarness()
  const accepted = await acceptIdealPlan(harness.deps, { seenRoles: SEEN_ROLES() })
  harness.db.productDrafts.push({
    id: DRAFT_ID,
    status: "completed",
    refinedNeedVersionId: accepted.refinedVersionId,
  })
  const sourceChangesAfterAccept = harness.db.sourceChanges.length

  // The user now runs Stage 2 for real and answers exactly the defaults.
  const gateway = createPersistedStage2RefinementGateway({
    userId: USER_ID,
    persistence: harness.db.persistence,
  })
  const completedSession = await gateway.load()
  assert.equal(completedSession.status, "complete")
  const reopened = await gateway.saveAnswer({
    questionId: "wet_wash_frequency",
    answer: DIRECT_ACCEPTANCE_WET_WASH_FREQUENCY,
    expectedRevision: completedSession.revision,
  })
  assert.equal(reopened.status, "in_progress")
  assert.equal(harness.db.drafts.length, 2, "reopen creates exactly one new in_progress draft")
  assert.equal(
    harness.db.drafts.filter((row) => row.status === "in_progress").length,
    1,
    "the partial unique index allows only one open draft",
  )

  const handoff = await gateway.complete({ expectedRevision: reopened.revision })

  // Hash collision: the refined need version is reused, never inserted twice.
  assert.equal(handoff.refinedVersionId, accepted.refinedVersionId)
  assert.equal(harness.db.needVersions.length, 1)
  assert.equal(harness.db.drafts.filter((row) => row.status === "complete").length, 2)
  assert.equal(
    harness.db.productDrafts[0]!.status,
    "completed",
    "an unchanged refined need must not stale the accepted product draft",
  )
  assert.equal(harness.db.sourceChanges.length, sourceChangesAfterAccept + 1)
  assert.equal(harness.db.sourceChanges.at(-1)!.sourceKind, "refined_need")
})

test("a real Stage 2 that changes an answer produces a successor refined source", async () => {
  const harness = createHarness()
  const accepted = await acceptIdealPlan(harness.deps, { seenRoles: SEEN_ROLES() })
  harness.db.productDrafts.push({
    id: DRAFT_ID,
    status: "active",
    refinedNeedVersionId: accepted.refinedVersionId,
  })

  const gateway = createPersistedStage2RefinementGateway({
    userId: USER_ID,
    persistence: harness.db.persistence,
  })
  const completedSession = await gateway.load()
  const reopened = await gateway.saveAnswer({
    questionId: "wet_wash_frequency",
    answer: "daily_1x",
    expectedRevision: completedSession.revision,
  })
  const handoff = await gateway.complete({ expectedRevision: reopened.revision })

  assert.notEqual(handoff.refinedVersionId, accepted.refinedVersionId)
  assert.equal(harness.db.needVersions.length, 2)
  assert.equal(harness.db.plan.currentRefinedNeedVersionId, handoff.refinedVersionId)
  assert.equal(
    harness.db.productDrafts[0]!.status,
    "stale",
    "the superseded active product draft is staled for the successor pass",
  )
  assert.equal(harness.db.sourceChanges.at(-1)!.sourceKey, handoff.refinedVersionId)
})

test("a leftover synthetic in_progress draft does not block a real Stage 2", async () => {
  const db = createRefinementDb()
  const defaults = buildDirectAcceptanceStage2Defaults(labTriggerContext())
  db.insertDraft({
    answers: defaults.answers,
    completedQuestionIds: defaults.completedQuestionIds,
    revision: 1,
  })

  const gateway = createPersistedStage2RefinementGateway({
    userId: USER_ID,
    persistence: db.persistence,
  })
  const session = await gateway.load()
  assert.equal(session.status, "in_progress")
  assert.equal(db.drafts.length, 1, "the open-draft index reuses the leftover row")

  const saved = await gateway.saveAnswer({
    questionId: "current_product_categories",
    answer: ["shampoo"],
    expectedRevision: session.revision,
  })
  assert.deepEqual(saved.answers.currentProductCategories, ["shampoo"])
  assert.equal(db.drafts.length, 1, "no second in_progress draft is created")
})

test("a lost completion response replays as already_completed, not a constraint error", async () => {
  const harness = createHarness()
  const accepted = await acceptIdealPlan(harness.deps, { seenRoles: SEEN_ROLES() })
  const row = harness.db.drafts[0]!

  const replay = await harness.db.persistence.complete({
    userId: USER_ID,
    draft: { id: row.id } as never,
    expectedRevision: row.revision,
    inputSnapshot: {},
    outputSnapshot: {},
    inputHash: "0".repeat(64),
    schemaVersion: 1,
    computationVersion: "stage1-v1",
  })

  assert.deepEqual(replay, {
    outcome: "already_completed",
    refinedVersionId: accepted.refinedVersionId,
  })
  assert.equal(harness.db.needVersions.length, 1)
})
