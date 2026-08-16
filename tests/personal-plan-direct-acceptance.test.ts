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
import { buildPlanRoutineContextFromCompletedRefinement } from "../src/lib/personal-plan/refinement/stage1-adapter"
import { deriveStage2TriggerContext } from "../src/lib/personal-plan/refinement/stage1-adapter"
import { resolveStage2RefinementContract } from "../src/lib/personal-plan/refinement/question-path"
import type {
  Stage2PersistedDraft,
  Stage2RefinementPersistence,
} from "../src/lib/personal-plan/persistence/stage2-refinement-service"
import type { Stage2TriggerContext } from "../src/lib/personal-plan/refinement/types"
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

/* ── Chain orchestration ── */

type RefinementCall =
  | { kind: "loadOrCreate" }
  | { kind: "save"; answers: unknown; completedQuestionIds: unknown; expectedRevision: number }
  | { kind: "complete"; expectedRevision: number; inputHash: string }

function createFakeRefinementPersistence(options: {
  status?: Stage2PersistedDraft["status"]
  refinedVersionId?: string | null
  completeOutcome?: "completed" | "already_completed"
  calls: RefinementCall[]
}): Stage2RefinementPersistence {
  const triggerContext = labTriggerContext()
  const draft: Stage2PersistedDraft = {
    id: "77777777-7777-4777-8777-777777777777",
    personalPlanId: PERSONAL_PLAN_ID,
    baseInitialNeedVersionId: INITIAL_NEED_VERSION_ID,
    schemaVersion: 1,
    preparedArtifactSourceId: ARTIFACT_ID,
    baseInputSnapshot: STAGE1_STAGE2_LAB_ENVELOPE as never,
    pathVersion: "stage2-v1",
    triggerContext,
    answers: {},
    completedQuestionIds: [],
    revision: 0,
    status: options.status ?? "in_progress",
    refinedVersionId: options.refinedVersionId ?? null,
  }
  let current = draft

  return {
    async loadOrCreate() {
      options.calls.push({ kind: "loadOrCreate" })
      return current
    },
    async reopen() {
      throw new Error("reopen is not part of the direct-acceptance chain")
    },
    async save(input) {
      options.calls.push({
        kind: "save",
        answers: input.answers,
        completedQuestionIds: input.completedQuestionIds,
        expectedRevision: input.expectedRevision,
      })
      current = {
        ...current,
        answers: input.answers,
        completedQuestionIds: input.completedQuestionIds,
        revision: input.expectedRevision + 1,
      }
      return { outcome: "saved", revision: current.revision }
    },
    async complete(input) {
      options.calls.push({
        kind: "complete",
        expectedRevision: input.expectedRevision,
        inputHash: input.inputHash,
      })
      current = { ...current, status: "complete", refinedVersionId: REFINED_NEED_VERSION_ID }
      return {
        outcome: options.completeOutcome ?? "completed",
        refinedVersionId: REFINED_NEED_VERSION_ID,
      }
    },
  }
}

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

function createFakeStage3Gateway(options: {
  calls: Stage3Call[]
  draft?: Stage3ProductDraft
  evaluations?: Stage3AuthorityEvaluation[]
}): DirectAcceptanceStage3Gateway {
  const draft = options.draft ?? fakeStage3Draft()
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
      return options.evaluations ?? MULTI_ROLE_EVALUATIONS
    },
    async resolveDecisions(input) {
      options.calls.push({
        kind: "resolveDecisions",
        expectedRevision: input.expectedRevision,
        subjectKeys: input.intents.map((intent) => intent.subjectKey),
      })
      return {
        status: "saved",
        draft: { ...draft, revision: input.expectedRevision + 1 },
      }
    },
    async complete(input) {
      options.calls.push({ kind: "complete", expectedRevision: input.expectedRevision })
      return {
        status: "ready_for_routine",
        draft: { ...draft, status: "completed" },
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

function createDeps(overrides: {
  refinementCalls: RefinementCall[]
  stage3Calls: Stage3Call[]
  provenanceCalls: Array<{ personalPlanId: string; refinedVersionId: string }>
  flags?: AcceptIdealPlanDeps["flags"]
  refinementStatus?: Stage2PersistedDraft["status"]
  refinedVersionId?: string | null
  completeOutcome?: "completed" | "already_completed"
  stage3Draft?: Stage3ProductDraft
  evaluations?: Stage3AuthorityEvaluation[]
}): AcceptIdealPlanDeps {
  return {
    userId: USER_ID,
    flags: overrides.flags ?? { stage2Enabled: true, stage3Enabled: true, stage4Enabled: true },
    refinementPersistence: createFakeRefinementPersistence({
      calls: overrides.refinementCalls,
      status: overrides.refinementStatus,
      refinedVersionId: overrides.refinedVersionId,
      completeOutcome: overrides.completeOutcome,
    }),
    stage3Gateway: createFakeStage3Gateway({
      calls: overrides.stage3Calls,
      draft: overrides.stage3Draft,
      evaluations: overrides.evaluations,
    }),
    provenance: {
      async recordDirectAccept(input) {
        overrides.provenanceCalls.push({
          personalPlanId: input.personalPlanId,
          refinedVersionId: input.refinedVersionId,
        })
      },
    },
  }
}

test("the accept chain drives Stage 2 completion, per-role planning and activation", async () => {
  const refinementCalls: RefinementCall[] = []
  const stage3Calls: Stage3Call[] = []
  const provenanceCalls: Array<{ personalPlanId: string; refinedVersionId: string }> = []
  const deps = createDeps({ refinementCalls, stage3Calls, provenanceCalls })

  const result = await acceptIdealPlan(deps, {
    seenRoles: seenRolesFor(MULTI_ROLE_EVALUATIONS),
  })

  assert.equal(result.status, "accepted")
  assert.equal(result.refinedVersionId, REFINED_NEED_VERSION_ID)
  assert.equal(result.productDraftId, DRAFT_ID)
  assert.equal(result.next.href, "/routine")

  const saveCall = refinementCalls.find((call) => call.kind === "save")
  assert.ok(saveCall && saveCall.kind === "save")
  const expectedDefaults = buildDirectAcceptanceStage2Defaults(labTriggerContext())
  assert.deepEqual(saveCall.answers, expectedDefaults.answers)
  assert.deepEqual(saveCall.completedQuestionIds, expectedDefaults.completedQuestionIds)
  assert.ok(refinementCalls.some((call) => call.kind === "complete"))

  assert.deepEqual(
    stage3Calls.map((call) => call.kind),
    ["loadOrCreate", "evaluateDecisions", "resolveDecisions", "complete"],
  )
  const resolveCall = stage3Calls.find((call) => call.kind === "resolveDecisions")
  assert.ok(resolveCall && resolveCall.kind === "resolveDecisions")
  assert.deepEqual(
    resolveCall.subjectKeys,
    MULTI_ROLE_EVALUATIONS.map((evaluation) => evaluation.subjectKey),
  )
  const completeCall = stage3Calls.find((call) => call.kind === "complete")
  assert.ok(completeCall && completeCall.kind === "complete")
  assert.equal(completeCall.expectedRevision, resolveCall.expectedRevision + 1)

  assert.deepEqual(provenanceCalls, [
    { personalPlanId: PERSONAL_PLAN_ID, refinedVersionId: REFINED_NEED_VERSION_ID },
  ])
})

test("a disabled Stage 2, 3 or 4 flag refuses the accept chain without any write", async () => {
  for (const flags of [
    { stage2Enabled: false, stage3Enabled: true, stage4Enabled: true },
    { stage2Enabled: true, stage3Enabled: false, stage4Enabled: true },
    { stage2Enabled: true, stage3Enabled: true, stage4Enabled: false },
  ]) {
    const refinementCalls: RefinementCall[] = []
    const stage3Calls: Stage3Call[] = []
    const provenanceCalls: Array<{ personalPlanId: string; refinedVersionId: string }> = []
    const deps = createDeps({ refinementCalls, stage3Calls, provenanceCalls, flags })

    await assert.rejects(
      acceptIdealPlan(deps, { seenRoles: seenRolesFor(MULTI_ROLE_EVALUATIONS) }),
      (error: unknown) =>
        error instanceof DirectAcceptanceError && error.code === "stage_not_available",
    )
    assert.deepEqual(refinementCalls, [])
    assert.deepEqual(stage3Calls, [])
    assert.deepEqual(provenanceCalls, [])
  }
})

test("a stale seen state aborts before any Stage 3 decision is written", async () => {
  const refinementCalls: RefinementCall[] = []
  const stage3Calls: Stage3Call[] = []
  const provenanceCalls: Array<{ personalPlanId: string; refinedVersionId: string }> = []
  const deps = createDeps({ refinementCalls, stage3Calls, provenanceCalls })
  const seen = seenRolesFor(MULTI_ROLE_EVALUATIONS)
  seen[1] = { ...seen[1]!, factFingerprint: "fingerprint-changed" }

  await assert.rejects(
    acceptIdealPlan(deps, { seenRoles: seen }),
    (error: unknown) => error instanceof DirectAcceptanceError && error.code === "seen_state_stale",
  )
  assert.deepEqual(
    stage3Calls.map((call) => call.kind),
    ["loadOrCreate", "evaluateDecisions"],
  )
  assert.deepEqual(provenanceCalls, [])
})

test("a second accept reuses the completed refinement and the completed product draft", async () => {
  const refinementCalls: RefinementCall[] = []
  const stage3Calls: Stage3Call[] = []
  const provenanceCalls: Array<{ personalPlanId: string; refinedVersionId: string }> = []
  const deps = createDeps({
    refinementCalls,
    stage3Calls,
    provenanceCalls,
    refinementStatus: "complete",
    refinedVersionId: REFINED_NEED_VERSION_ID,
    stage3Draft: fakeStage3Draft({ status: "completed" }),
  })

  const result = await acceptIdealPlan(deps, {
    seenRoles: seenRolesFor(MULTI_ROLE_EVALUATIONS),
  })

  assert.equal(result.status, "accepted")
  assert.equal(result.refinedVersionId, REFINED_NEED_VERSION_ID)
  // No second refinement write, and no decision replay on a completed draft.
  assert.deepEqual(
    refinementCalls.map((call) => call.kind),
    ["loadOrCreate"],
  )
  assert.deepEqual(
    stage3Calls.map((call) => call.kind),
    ["loadOrCreate", "complete"],
  )
})

test("an already-completed refinement hash resolves as a clean re-refinement", async () => {
  const refinementCalls: RefinementCall[] = []
  const stage3Calls: Stage3Call[] = []
  const provenanceCalls: Array<{ personalPlanId: string; refinedVersionId: string }> = []
  const deps = createDeps({
    refinementCalls,
    stage3Calls,
    provenanceCalls,
    completeOutcome: "already_completed",
  })

  const result = await acceptIdealPlan(deps, {
    seenRoles: seenRolesFor(MULTI_ROLE_EVALUATIONS),
  })

  assert.equal(result.status, "accepted")
  assert.equal(result.refinedVersionId, REFINED_NEED_VERSION_ID)
  assert.ok(refinementCalls.some((call) => call.kind === "complete"))
})
