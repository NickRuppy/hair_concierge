import assert from "node:assert/strict"
import test from "node:test"

import { CATEGORY_ROLE_POLICIES } from "../../../src/lib/personal-plan/products/authorities"
import type {
  Stage3AuthorityEvaluation,
  Stage3AuthoritySemanticIntent,
} from "../../../src/lib/personal-plan/products/authority/contracts"
import type {
  AnyProposedProductPortfolio,
  PersonalPlanCategory,
  Stage3CategoryRequirement,
  Stage3ProductDraft,
} from "../../../src/lib/personal-plan/products/contracts"
import { stage3DecisionKey } from "../../../src/lib/personal-plan/products/contracts"
import { createStage3Draft } from "../../../src/lib/personal-plan/products/state-machine"
import {
  recomputeRoutineAfterCatalogChange,
  type Stage3CatalogChangeDeps,
  type Stage3PlannedProductFit,
} from "../../../src/lib/personal-plan/refinement-recompute/catalog-change"
import type {
  Stage3RecomputeActiveRoutineVersion,
  Stage3RecomputeGateway,
} from "../../../src/lib/personal-plan/refinement-recompute/types"
import type { RoutinePayloadV1 } from "../../../src/lib/personal-plan/routine/contracts"
import type { PlanProductRole } from "../../../src/lib/personal-plan/types"

/**
 * Catalogue-change re-pick lane (Nick Q8, 2026-10-13; generalises S5 T5.5b): a
 * planned product that no longer fits its planned slot after a catalogue change
 * (S3: HEAT&GLOW activated ⇒ post-wash mismatch; S5: tombstoned `replaced_by`
 * source) is re-picked to the next-best product. Everything else is preserved;
 * an owned or explicitly chosen product is never replaced silently.
 */

const USER_ID = "owner-a"
const PLAN_ID = "plan-a"
const REFINED = "refined-1"
const HEAT_GLOW = "e781ca9e-886d-40a1-bfe1-48177cfbf381"
const NEXT_BEST = "olaplex-no-6"
const PANTENE_7IN1 = "f8f3b51d-0000-4000-8000-000000000001"
const LEAVE_IN_GAP = stage3DecisionKey("leave_in", "post_wash_leave_in", null)
const SHAMPOO_KEY = stage3DecisionKey("shampoo", "shampoo_everyday", "capture-shampoo")

function requirement(
  category: PersonalPlanCategory,
  roles: PlanProductRole[],
): Stage3CategoryRequirement {
  return {
    category,
    requiredRoles: roles,
    needSummary: category,
    authorityVersion: CATEGORY_ROLE_POLICIES[category].authorityVersion,
  }
}
const REQUIREMENTS = [
  requirement("shampoo", ["shampoo_everyday"]),
  requirement("leave_in", ["post_wash_leave_in"]),
]

function sourceDraft(
  resolutionAction: "plan_recommendation" | "select_replacement",
  productId: string,
): Stage3ProductDraft {
  const base = createStage3Draft({
    draftId: "draft-source",
    userId: USER_ID,
    personalPlanId: PLAN_ID,
    refinedVersionId: REFINED,
    requirements: REQUIREMENTS,
    now: "2026-09-01T00:00:00.000Z",
  })
  return {
    ...base,
    status: "completed",
    pass: "ready_for_routine",
    revision: 10,
    categoryCursor: null,
    completedCaptureCategories: ["shampoo", "leave_in"],
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
    ],
    roleAssignments: [
      { capturedProductId: "capture-shampoo", category: "shampoo", roles: ["shampoo_everyday"] },
    ],
    uncoveredRoles: [
      { category: "leave_in", role: "post_wash_leave_in", reason: "no_product_owned" },
    ],
    decisions: [
      {
        decisionKey: LEAVE_IN_GAP,
        category: "leave_in",
        role: "post_wash_leave_in",
        capturedProductId: null,
        verdict: "ideal",
        choiceState: "planned_purchase",
        criterionResults: [],
        recommendation: {
          recommendationId: `recommend:${productId}:post_wash_leave_in`,
          productId,
          category: "leave_in",
          role: "post_wash_leave_in",
          displayName: "Leave-in",
          reason: "Passt zur erforderlichen Leave-in-Rolle.",
          authorityRuleId: "leave_in.selection.role_fit",
        },
        limitationAcknowledged: false,
        resolutionAction,
      },
    ],
    completedDecisionKeys: [LEAVE_IN_GAP],
    inventoryDispositions: [],
  } as Stage3ProductDraft
}

function freshDraft(revision: number): Stage3ProductDraft {
  return {
    ...createStage3Draft({
      draftId: "draft-repair",
      userId: USER_ID,
      personalPlanId: PLAN_ID,
      refinedVersionId: REFINED,
      requirements: REQUIREMENTS,
      now: "2026-10-13T00:00:00.000Z",
    }),
    revision,
  }
}

function item(
  category: "shampoo" | "leave_in",
  product: RoutinePayloadV1["items"][number]["product"],
  decisionKey: string,
): RoutinePayloadV1["items"][number] {
  const role = category === "shampoo" ? "shampoo_everyday" : "post_wash_leave_in"
  return {
    itemKey: `item:${category}:${role}`,
    assignmentKey: `assignment:${category}`,
    category,
    role,
    purposeKey: role,
    roleOrder: 0,
    state: {
      systemAssessment: "basis",
      inclusion: "included",
      availability:
        product.kind === "owned" ? "owned" : product.kind === "planned" ? "planned" : "none",
      fitDecision: "standard",
    },
    product,
    cadence: { recommended: null, userOverride: null, displayKey: "personal_plan.cadence.none" },
    sourceDecisionKeys: [decisionKey],
    authorityRuleIds: [],
    executable: true,
  }
}

const SHAMPOO_ITEM = item(
  "shampoo",
  {
    kind: "owned",
    capturedProductId: "capture-shampoo",
    productId: "catalog-shampoo",
    displayName: "Shampoo",
  },
  SHAMPOO_KEY,
)
const planned = (productId: string) =>
  item(
    "leave_in",
    {
      kind: "planned",
      plannedPurchaseId: `planned:${productId}`,
      productId,
      displayName: "Leave-in",
    },
    LEAVE_IN_GAP,
  )

function routine(
  versionId: string,
  leaveIn: RoutinePayloadV1["items"][number],
): Stage3RecomputeActiveRoutineVersion {
  const items = [SHAMPOO_ITEM, leaveIn]
  return {
    routineVersionId: versionId,
    payload: {
      schemaVersion: 1,
      planId: PLAN_ID,
      versionId,
      parentVersionId: null,
      source: {
        refinedVersionId: REFINED,
        productPortfolioVersionId: "portfolio-1",
        sourceFingerprint: "a".repeat(64),
        compilerVersion: "routine-compiler-v1",
        authorityVersions: {},
      },
      intent: {
        schemaVersion: 1,
        categories: [
          {
            category: "shampoo",
            inclusion: "included",
            inclusionSource: "stage3",
            assignments: [],
          },
          {
            category: "leave_in",
            inclusion: "included",
            inclusionSource: "stage3",
            assignments: [],
          },
        ],
      },
      sections: [
        { key: "basis", itemKeys: items.map((entry) => entry.itemKey) },
        { key: "optional", itemKeys: [] },
      ],
      items,
      createdAt: "2026-09-01T00:00:00.000Z",
    },
    source: { refinedVersionId: REFINED, productDraftId: "draft-source", productDraftRevision: 9 },
  }
}

const SHAMPOO_EVALUATION: Stage3AuthorityEvaluation = {
  status: "known",
  category: "shampoo",
  subjectKey: SHAMPOO_KEY,
  verdict: "ideal",
  criteria: [],
  allowedActions: ["keep_owned"],
  recommendation: null,
  productFactFingerprint: "b".repeat(64),
  recommendationFactFingerprint: null,
  coverageRuleIds: [],
}
/** HEAT&GLOW is gone from the post-wash candidates; the authority now recommends the next best. */
const LEAVE_IN_EVALUATION: Stage3AuthorityEvaluation = {
  status: "known",
  category: "leave_in",
  subjectKey: LEAVE_IN_GAP,
  verdict: "ideal",
  criteria: [],
  allowedActions: ["plan_recommendation", "leave_uncovered"],
  recommendation: {
    recommendationId: `recommend:${NEXT_BEST}:post_wash_leave_in`,
    productId: NEXT_BEST,
    category: "leave_in",
    role: "post_wash_leave_in",
    displayName: "Olaplex No.6",
    reason: "Passt zur erforderlichen Leave-in-Rolle.",
    authorityRuleId: "leave_in.selection.role_fit",
  },
  productFactFingerprint: null,
  recommendationFactFingerprint: "c".repeat(64),
  coverageRuleIds: [],
}

function harness(input: {
  starting: Stage3RecomputeActiveRoutineVersion
  ending?: Stage3RecomputeActiveRoutineVersion
  source?: Stage3ProductDraft
  fit?: Stage3PlannedProductFit
}) {
  const intents: Stage3AuthoritySemanticIntent[] = []
  const calls = { repair: 0, loadOrCreate: 0, complete: 0, fit: [] as unknown[] }
  let routineReads = 0
  let loads = 0
  const gateway: Stage3RecomputeGateway = {
    loadOrCreate: async () => {
      calls.loadOrCreate += 1
      loads += 1
      return {
        status: "active",
        draft: freshDraft(loads === 1 ? 0 : 1),
        requirements: REQUIREMENTS,
      }
    },
    evaluateDecisions: async () => [SHAMPOO_EVALUATION, LEAVE_IN_EVALUATION],
    reviewDecisionBundles: async () => [],
    resolveDecisions: async (resolve) => {
      intents.push(...resolve.intents)
      return { status: "saved", draft: freshDraft(resolve.expectedRevision + 1) }
    },
    acknowledgeInventoryDisposition: async () => {
      throw new Error("no dispositions expected")
    },
    complete: async () => {
      calls.complete += 1
      return {
        status: "ready_for_routine",
        draft: freshDraft(9),
        portfolio: {} as AnyProposedProductPortfolio,
        personalPlanId: PLAN_ID,
        routineProposalId: "proposal-2",
      } as never
    },
  }
  const source = input.source ?? sourceDraft("plan_recommendation", HEAT_GLOW)
  const deps: Stage3CatalogChangeDeps = {
    gateway,
    persistence: {
      loadRequirements: async () => REQUIREMENTS,
      loadRefinedNeedSnapshot: async () =>
        ({
          inputHash: "refined-input",
          profile: { source: { projection: "refined_post_plan" }, hair: { thickness: "normal" } },
        }) as never,
      loadDraft: async ({ draftId }) =>
        draftId === "draft-source" ? source : draftId === "draft-repair" ? freshDraft(0) : null,
      save: async ({ expectedRevision, draft }) => ({
        outcome: "saved" as const,
        draft: { ...draft, revision: expectedRevision + 1 },
      }),
    },
    routineState: {
      loadActiveRoutineVersion: async () => {
        routineReads += 1
        return routineReads === 1 ? input.starting : (input.ending ?? input.starting)
      },
    },
    routineReactivator: {
      reactivateRoutineForProductDraft: async () => {
        throw new Error("reactivation not expected")
      },
    },
    repairDraft: {
      createOrLoad: async () => {
        calls.repair += 1
        return { requirements: REQUIREMENTS }
      },
    },
    catalogFit: {
      plannedProductFit: async (fitInput) => {
        calls.fit.push(fitInput)
        return input.fit ?? "no_longer_fits"
      },
    },
  }
  return { deps, intents, calls }
}

const INPUT = {
  userId: USER_ID,
  personalPlanId: PLAN_ID,
  productId: HEAT_GLOW,
  role: "post_wash_leave_in" as const,
}

test("HEAT&GLOW planned post-wash is re-picked to the next-best leave-in; other slots unchanged", async () => {
  const { deps, intents, calls } = harness({
    starting: routine("routine-1", planned(HEAT_GLOW)),
    ending: routine("routine-2", planned(NEXT_BEST)),
  })
  const result = await recomputeRoutineAfterCatalogChange(deps, INPUT)
  assert.deepEqual(result, {
    status: "applied",
    routineVersionId: "routine-2",
    repicked: [{ subjectKey: LEAVE_IN_GAP, fromProductId: HEAT_GLOW, toProductId: NEXT_BEST }],
  })
  assert.equal(calls.repair, 1)
  assert.equal(calls.complete, 1)
  assert.deepEqual(
    intents.map((intent) => [intent.subjectKey, intent.action]),
    [
      [SHAMPOO_KEY, "keep_owned"],
      [LEAVE_IN_GAP, "plan_recommendation"],
    ],
  )
})

test("second run is unchanged and touches nothing", async () => {
  const { deps, calls } = harness({ starting: routine("routine-2", planned(NEXT_BEST)) })
  assert.deepEqual(await recomputeRoutineAfterCatalogChange(deps, INPUT), { status: "unchanged" })
  assert.equal(calls.repair, 0)
  assert.equal(calls.loadOrCreate, 0)
})

test("a product that still fits its slot is left alone without opening a draft", async () => {
  const { deps, calls } = harness({
    starting: routine("routine-1", planned(HEAT_GLOW)),
    fit: "fits",
  })
  assert.deepEqual(await recomputeRoutineAfterCatalogChange(deps, INPUT), { status: "unchanged" })
  assert.equal(calls.repair, 0)
})

test("an explicit user choice is never replaced silently — it is reported for attention", async () => {
  const { deps, calls } = harness({
    starting: routine("routine-1", planned(HEAT_GLOW)),
    source: sourceDraft("select_replacement", HEAT_GLOW),
  })
  assert.deepEqual(await recomputeRoutineAfterCatalogChange(deps, INPUT), {
    status: "needs_attention",
    cases: [{ subjectKey: LEAVE_IN_GAP, productId: HEAT_GLOW, reason: "explicit_choice" }],
  })
  assert.equal(calls.repair, 0)
  assert.equal(calls.complete, 0)
})

test("an owned product is never replaced silently — it is reported for attention", async () => {
  const owned = item(
    "leave_in",
    {
      kind: "owned",
      capturedProductId: "capture-hg",
      productId: HEAT_GLOW,
      displayName: "HEAT&GLOW",
    },
    stage3DecisionKey("leave_in", "post_wash_leave_in", "capture-hg"),
  )
  const { deps, calls } = harness({ starting: routine("routine-1", owned) })
  assert.deepEqual(await recomputeRoutineAfterCatalogChange(deps, INPUT), {
    status: "needs_attention",
    cases: [
      {
        subjectKey: stage3DecisionKey("leave_in", "post_wash_leave_in", "capture-hg"),
        productId: HEAT_GLOW,
        reason: "owned",
      },
    ],
  })
  assert.equal(calls.repair, 0)
})

test("a tombstoned replaced_by source is re-picked the same way (S5 reuse)", async () => {
  const { deps, intents } = harness({
    starting: routine("routine-1", planned(PANTENE_7IN1)),
    ending: routine("routine-2", planned(NEXT_BEST)),
    source: sourceDraft("plan_recommendation", PANTENE_7IN1),
    fit: "retired",
  })
  const result = await recomputeRoutineAfterCatalogChange(deps, {
    ...INPUT,
    productId: PANTENE_7IN1,
  })
  assert.equal(result.status, "applied")
  assert.deepEqual(
    intents.find((intent) => intent.subjectKey === LEAVE_IN_GAP),
    { type: "resolve_decision", subjectKey: LEAVE_IN_GAP, action: "plan_recommendation" },
  )
})

test("the re-pick never plans the dropped product again, even if the authority still names it", async () => {
  const { deps, intents } = harness({
    starting: routine("routine-1", planned(HEAT_GLOW)),
    ending: routine("routine-2", {
      ...planned(HEAT_GLOW),
      product: { kind: "none", displayName: null },
    }),
  })
  deps.gateway.evaluateDecisions = async () => [
    SHAMPOO_EVALUATION,
    {
      ...LEAVE_IN_EVALUATION,
      recommendation: { ...LEAVE_IN_EVALUATION.recommendation!, productId: HEAT_GLOW },
    } as Stage3AuthorityEvaluation,
  ]
  await recomputeRoutineAfterCatalogChange(deps, INPUT)
  const leaveIn = intents.find((intent) => intent.subjectKey === LEAVE_IN_GAP)
  assert.equal(leaveIn?.action, "leave_uncovered")
})

test("repick script: --apply refuses without --confirm, dry run never needs it, hashes hide plan ids", async () => {
  const script = await import("../../../scripts/personal-plan/repick-planned-products")
  const base = ["--product", HEAT_GLOW, "--role", "post_wash_leave_in"]
  assert.throws(
    () => script.assertApplyAllowed(script.parseArgs([...base, "--apply"])),
    /--confirm/,
  )
  assert.doesNotThrow(() =>
    script.assertApplyAllowed(script.parseArgs([...base, "--apply", "--confirm"])),
  )
  assert.doesNotThrow(() => script.assertApplyAllowed(script.parseArgs([...base, "--dry-run"])))
  assert.throws(() => script.parseArgs([...base]), /--dry-run or --apply/)
  assert.throws(
    () =>
      script.parseArgs([
        ...base,
        "--apply",
        "--confirm",
        "--simulate-heat-activation",
        "airflow_shaping",
      ]),
    /dry-run only/,
  )
  const hash = script.planHash("11111111-2222-4333-8444-555555555555")
  assert.match(hash, /^[0-9a-f]{12}$/)
  assert.ok(!hash.includes("1111"))
})
