import assert from "node:assert/strict"
import test from "node:test"

import { handleStage1ProductExamplePreviews } from "../../src/app/api/personal-plan/stage-1/previews/route"
import { computeNeedPlan } from "../../src/lib/personal-plan/compute-stage1"
import type { Stage1PersistenceDependencies } from "../../src/lib/personal-plan/persistence/stage1-service"
import type {
  Stage1ProductExampleRecommendation,
  Stage1ProductExampleRolePreview,
} from "../../src/lib/personal-plan/product-preview-contract"
import {
  computeStage1ProductExamplePreviews,
  type Stage1ProductExamplePreviewBudget,
} from "../../src/lib/personal-plan/product-previews"
import type {
  Stage3CategoryProductFacts,
  Stage3ConditionerFacts,
  Stage3MaskFacts,
  Stage3OilFacts,
} from "../../src/lib/personal-plan/products/authority/contracts"
import type {
  InitialNeedPlanSnapshot,
  PlanCategoryDecision,
} from "../../src/lib/personal-plan/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./fixtures"

/*
 * Budget-aware Stage-1 previews (Task 5, C3/C15). Every expectation below is computed by hand
 * from plan §4: the allocation runs ONCE per previewed proposal (one flexible allowance, one
 * no-ceiling mix), the previewed product is the allocated default, and without a budget the
 * payload is exactly the price-neutral one.
 */

function baseSnapshot(): InitialNeedPlanSnapshot {
  const result = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-14T10:00:00.000Z",
  })
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected ready snapshot")
  return result.snapshot
}

const OFF_BY_ONE: Record<string, string> = { light: "medium", medium: "light", rich: "medium" }

function conditionerDecision(snapshot: InitialNeedPlanSnapshot) {
  const decision = snapshot.decisions.find((item) => item.category === "conditioner")
  assert.ok(decision?.target?.category === "conditioner")
  return decision
}

function oilDecision(snapshot: InitialNeedPlanSnapshot): PlanCategoryDecision {
  const decision = snapshot.decisions.find((item) => item.category === "oil")
  assert.ok(decision?.target?.category === "oil")
  // A leave-on role: only leave-on Oil roles grade weight (pre-wash ignores it).
  const roleTarget = {
    ...decision.target.roleTargets[0]!,
    role: "leave_on_fibre_conditioning" as const,
    weight: "light" as const,
  }
  return {
    ...decision,
    roles: [roleTarget.role],
    target: { ...decision.target, roles: [roleTarget.role], roleTargets: [roleTarget] },
  } as PlanCategoryDecision
}

const MASK_ROLE = "intensive_conditioning_mask" as const

function maskDecision(): PlanCategoryDecision {
  return {
    category: "mask",
    resolution: "resolved",
    needTier: "optional",
    roles: [MASK_ROLE],
    target: {
      category: "mask",
      roles: [MASK_ROLE],
      needStrength: "standard",
      weight: "light",
      careDirection: "moisture",
      repairSupportLevel: "medium",
      functionalNeeds: [],
    },
    frequency: null,
    reasons: [],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  } satisfies PlanCategoryDecision
}

function commerce(priceEur: number) {
  return { priceEur, currency: "EUR", purchaseLinkStatus: "available" as const }
}

function conditioner(
  snapshot: InitialNeedPlanSnapshot,
  id: string,
  priceEur: number,
  fit: "on_target" | "off_by_one",
  extra: Partial<Stage3ConditionerFacts> = {},
): Stage3ConditionerFacts {
  const target = conditionerDecision(snapshot).target
  assert.ok(target?.category === "conditioner")
  return {
    productId: id,
    displayName: `Conditioner ${id}`,
    category: "conditioner",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: [snapshot.profile.hair.thickness],
    knownReaction: false,
    protocols: [
      { role: "conditioner_rinse_out", status: "verified_complete", fingerprint: `p-${id}` },
    ],
    presentationImageUrl: `https://example.com/${id}.webp`,
    factFingerprint: `facts-${id}`,
    ...commerce(priceEur),
    spec: {
      thickness: snapshot.profile.hair.thickness,
      proteinMoistureBalance: target.careDirection,
      weight: fit === "on_target" ? target.weight : (OFF_BY_ONE[target.weight] as never),
      repairSupportLevel: target.repairSupportLevel,
      balanceDirection: target.careDirection,
      targetFit: "matched",
    },
    ...extra,
  }
}

function mask(
  snapshot: InitialNeedPlanSnapshot,
  id: string,
  priceEur: number,
  fit: "on_target" | "off_by_one",
): Stage3MaskFacts {
  return {
    productId: id,
    displayName: `Maske ${id}`,
    category: "mask",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: [snapshot.profile.hair.thickness],
    knownReaction: false,
    protocols: [{ role: MASK_ROLE, status: "verified_complete", fingerprint: `p-${id}` }],
    presentationImageUrl: `https://example.com/${id}.webp`,
    factFingerprint: `facts-${id}`,
    ...commerce(priceEur),
    spec: {
      weight: fit === "on_target" ? "light" : "medium",
      careDirection: "moisture",
      repairSupportLevel: "medium",
      functionalBenefits: [],
    },
  }
}

function oil(
  snapshot: InitialNeedPlanSnapshot,
  id: string,
  priceEur: number,
  fit: "on_target" | "off_by_one",
): Stage3OilFacts {
  const decision = oilDecision(snapshot)
  assert.ok(decision.target?.category === "oil")
  const roleTarget = decision.target.roleTargets[0]!
  return {
    productId: id,
    displayName: `Öl ${id}`,
    category: "oil",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: [snapshot.profile.hair.thickness],
    knownReaction: false,
    protocols: [{ role: roleTarget.role, status: "verified_complete", fingerprint: `p-${id}` }],
    presentationImageUrl: `https://example.com/${id}.webp`,
    factFingerprint: `facts-${id}`,
    ...commerce(priceEur),
    spec: {
      roleSupport: { [roleTarget.role]: true },
      weight: fit === "on_target" ? roleTarget.weight : (OFF_BY_ONE[roleTarget.weight!] as never),
      targetThicknessEligible: true,
      providesHeatProtection: false,
    },
  }
}

function threeRoleSnapshot(): InitialNeedPlanSnapshot {
  const snapshot = baseSnapshot()
  return {
    ...snapshot,
    decisions: [conditionerDecision(snapshot), maskDecision(), oilDecision(snapshot)],
    renderedOrder: ["conditioner", "mask", "oil"],
  }
}

function conditionerOnlySnapshot(): InitialNeedPlanSnapshot {
  const snapshot = baseSnapshot()
  return { ...snapshot, decisions: [conditionerDecision(snapshot)], renderedOrder: ["conditioner"] }
}

/** Each role: a better-fitting product above 15 € and a one-step-off product at 4 €. */
function threeRoleCandidates(snapshot: InitialNeedPlanSnapshot) {
  return {
    conditioner: [
      conditioner(snapshot, "cond-hi", 20, "on_target"),
      conditioner(snapshot, "cond-lo", 4, "off_by_one"),
    ],
    mask: [mask(snapshot, "mask-hi", 18, "on_target"), mask(snapshot, "mask-lo", 4, "off_by_one")],
    oil: [oil(snapshot, "oil-hi", 25, "on_target"), oil(snapshot, "oil-lo", 4, "off_by_one")],
  } as Record<string, Stage3CategoryProductFacts[]>
}

async function previewThreeRoles(
  budget?: Stage1ProductExamplePreviewBudget | null,
  candidates?: (snapshot: InitialNeedPlanSnapshot) => Record<string, Stage3CategoryProductFacts[]>,
) {
  const snapshot = threeRoleSnapshot()
  const byCategory = (candidates ?? threeRoleCandidates)(snapshot)
  return computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot,
    loadCandidates: async (selection) => byCategory[selection.category] ?? [],
    ...(budget !== undefined ? { budget } : {}),
  })
}

function recommendations(previews: Stage1ProductExampleRolePreview[]) {
  return new Map(
    previews.flatMap((preview): [string, Stage1ProductExampleRecommendation][] =>
      preview.kind === "recommendation" ? [[preview.category, preview]] : [],
    ),
  )
}

const strict5: Stage1ProductExamplePreviewBudget = {
  budget: { kind: "capped", limitEur: 5, allowExceptions: false },
}
const flexible5: Stage1ProductExamplePreviewBudget = {
  budget: { kind: "capped", limitEur: 5, allowExceptions: true },
}
const uncapped: Stage1ProductExamplePreviewBudget = { budget: { kind: "uncapped" } }

test("B-PREV-NONE: without a budget the previews are the price-neutral ones, with no affordability field", async () => {
  const omitted = await previewThreeRoles()
  const explicitNull = await previewThreeRoles(null)
  assert.deepEqual(explicitNull, omitted)

  const picked = recommendations(omitted.previews)
  assert.equal(picked.get("conditioner")?.productId, "cond-hi")
  assert.equal(picked.get("mask")?.productId, "mask-hi")
  assert.equal(picked.get("oil")?.productId, "oil-hi")
  for (const preview of picked.values()) {
    assert.equal("overBudget" in preview.commerce, false)
    assert.equal("marketSegment" in preview.commerce, false)
  }
})

test("B-PREV-STR: strict 5 € previews the affordable product of every role", async () => {
  const response = await previewThreeRoles(strict5)
  const picked = recommendations(response.previews)
  assert.equal(picked.get("conditioner")?.productId, "cond-lo")
  assert.equal(picked.get("mask")?.productId, "mask-lo")
  assert.equal(picked.get("oil")?.productId, "oil-lo")
  for (const preview of picked.values()) {
    assert.equal(preview.commerce.overBudget, false)
    // The pinned fingerprint is the allocated product's own — what direct acceptance re-checks.
    assert.equal(preview.factFingerprint, `facts-${preview.productId}`)
  }
})

test("B-PREV-STR-0: strict 5 € with nothing affordable previews no product for that role", async () => {
  const snapshot = conditionerOnlySnapshot()
  const response = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot,
    loadCandidates: async () => [
      conditioner(snapshot, "cond-a", 9, "on_target"),
      conditioner(snapshot, "cond-b", 12, "off_by_one"),
    ],
    budget: strict5,
  })
  assert.equal(response.previews.length, 1)
  assert.equal(response.previews[0]!.kind, "fallback")
})

test("B-PREV-FLX: flexible 5 € grants ONE exception per proposal — the cheapest improvement", async () => {
  // N = 3 new purchases → A = max(1, floor(0.75)) = 1, no gaps. All three roles improve on
  // their weight dimension (no stated main concern applies), so the smallest extra cost wins:
  // mask 18 − 4 = 14 € < conditioner 16 € < oil 21 €.
  const response = await previewThreeRoles(flexible5)
  const picked = recommendations(response.previews)
  assert.equal(picked.get("mask")?.productId, "mask-hi")
  assert.equal(picked.get("mask")?.commerce.overBudget, true)
  assert.equal(picked.get("conditioner")?.productId, "cond-lo")
  assert.equal(picked.get("conditioner")?.commerce.overBudget, false)
  assert.equal(picked.get("oil")?.productId, "oil-lo")
  assert.equal(picked.get("oil")?.commerce.overBudget, false)
  assert.equal([...picked.values()].filter((preview) => preview.commerce.overBudget).length, 1)
})

test("B-PREV-FLX-1: a single-role proposal spends its one allowance on the better fit", async () => {
  const snapshot = conditionerOnlySnapshot()
  const response = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot,
    loadCandidates: async () => [
      conditioner(snapshot, "cond-hi", 20, "on_target"),
      conditioner(snapshot, "cond-lo", 4, "off_by_one"),
    ],
    budget: flexible5,
  })
  const preview = response.previews[0]!
  assert.equal(preview.kind, "recommendation")
  if (preview.kind !== "recommendation") return
  assert.equal(preview.productId, "cond-hi")
  assert.equal(preview.commerce.overBudget, true)
})

test("B-PREV-OPEN: no ceiling targets round(0.6 · 3) = 2 products above 15 € via fit-equal swaps", async () => {
  // Per role an equal-fit pair: above 15 € and at 10 €. Whichever the ranking leads with, the
  // portfolio nudge lands on exactly two products above 15 € and one at or below.
  const response = await previewThreeRoles(uncapped, (snapshot) => ({
    conditioner: [
      conditioner(snapshot, "cond-hi", 20, "on_target"),
      conditioner(snapshot, "cond-mid", 10, "on_target"),
    ],
    mask: [mask(snapshot, "mask-hi", 18, "on_target"), mask(snapshot, "mask-mid", 10, "on_target")],
    oil: [oil(snapshot, "oil-hi", 25, "on_target"), oil(snapshot, "oil-mid", 10, "on_target")],
  }))
  const picked = [...recommendations(response.previews).values()]
  assert.equal(picked.length, 3)
  assert.equal(picked.filter((preview) => (preview.commerce.priceEur ?? 0) > 15).length, 2)
  // Uncapped never claims anything is over budget.
  assert.ok(picked.every((preview) => preview.commerce.overBudget === false))
})

test("B-PREV-OPEN-FIT: no ceiling never trades fit for the price mix", async () => {
  // The cheaper products are one step off: no fit-comparable swap exists, so all three stay on
  // the better fit even though that means 3 of 3 above 15 €.
  const response = await previewThreeRoles(uncapped)
  const picked = recommendations(response.previews)
  assert.equal(picked.get("conditioner")?.productId, "cond-hi")
  assert.equal(picked.get("mask")?.productId, "mask-hi")
  assert.equal(picked.get("oil")?.productId, "oil-hi")
})

test("marketSegment is emitted only for Shampoo/Conditioner/Mask with the display gate on", async () => {
  const snapshot = threeRoleSnapshot()
  const byCategory: Record<string, Stage3CategoryProductFacts[]> = {
    conditioner: [
      { ...conditioner(snapshot, "cond-hi", 20, "on_target"), marketSegment: "professional" },
    ],
    mask: [{ ...mask(snapshot, "mask-hi", 18, "on_target"), marketSegment: "drugstore" }],
    oil: [{ ...oil(snapshot, "oil-hi", 25, "on_target"), marketSegment: "professional" }],
  }
  const run = (marketSegmentDisplayEnabled?: boolean) =>
    computeStage1ProductExamplePreviews({
      personalPlanId: "plan-1",
      sourceNeedVersionId: "need-1",
      snapshot,
      loadCandidates: async (selection) => byCategory[selection.category] ?? [],
      ...(marketSegmentDisplayEnabled !== undefined ? { marketSegmentDisplayEnabled } : {}),
    })

  const on = recommendations((await run(true)).previews)
  assert.equal(on.get("conditioner")?.commerce.marketSegment, "professional")
  assert.equal(on.get("mask")?.commerce.marketSegment, "drugstore")
  assert.equal("marketSegment" in on.get("oil")!.commerce, false)

  for (const response of [await run(false), await run()]) {
    for (const preview of recommendations(response.previews).values()) {
      assert.equal("marketSegment" in preview.commerce, false)
    }
  }
})

test("an unknown market segment is never emitted, even with the display gate on", async () => {
  const snapshot = conditionerOnlySnapshot()
  const response = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot,
    loadCandidates: async () => [
      { ...conditioner(snapshot, "cond-hi", 20, "on_target"), marketSegment: null },
    ],
    marketSegmentDisplayEnabled: true,
  })
  const preview = response.previews[0]!
  assert.equal(preview.kind, "recommendation")
  if (preview.kind === "recommendation") assert.equal("marketSegment" in preview.commerce, false)
})

function persistence(): Stage1PersistenceDependencies {
  return {
    isEnabled: () => true,
    cohortCutoff: () => new Date("2026-08-08T00:00:00.000Z"),
    findEntitlement: async () => ({
      accessState: "active",
      enrollmentSourceId: "purchase-1",
      qualifiedAt: "2026-08-08T01:00:00.000Z",
      artifactLeadId: "lead-1",
    }),
    loadArtifact: async () => ({ id: "artifact-1", quizAnswers: COMPLETE_V3_PLAN_ENVELOPE }),
    createOrReuseInitialNeed: async (request) => ({
      outcome: "completed",
      personalPlanId: "plan-1",
      needVersionId: "need-1",
      outputSnapshot: request.outputSnapshot,
    }),
    now: () => new Date("2026-08-14T10:00:00.000Z"),
  }
}

test("preview route passes the saved budget through and fails closed when it cannot read it", async () => {
  const snapshot = conditionerOnlySnapshot()
  const base = {
    getAuthenticatedUser: async () => ({ id: "user-1" }),
    loadJourneyAccess: async () =>
      ({
        kind: "personal_plan_start",
        frontier: "stage1",
        nextHref: "/plan-start",
        allowed: { stage1: true, stage2: true, stage3: false, stage4: false, stage5: false },
      }) as never,
    loadCandidates: async (selection: { category: string }) =>
      selection.category === "conditioner"
        ? [
            conditioner(snapshot, "cond-hi", 20, "on_target"),
            conditioner(snapshot, "cond-lo", 4, "off_by_one"),
          ]
        : [],
  }
  const budgeted = await handleStage1ProductExamplePreviews({
    ...base,
    persistence: persistence(),
    loadShoppingBudget: async () => strict5,
  })
  assert.equal(budgeted.status, 200)
  const preview =
    "previews" in budgeted.body
      ? budgeted.body.previews.find((item) => item.category === "conditioner")
      : null
  assert.equal(preview?.kind === "recommendation" ? preview.productId : null, "cond-lo")

  const unreadable = await handleStage1ProductExamplePreviews({
    ...base,
    persistence: persistence(),
    loadShoppingBudget: async () => {
      throw new Error("down")
    },
  })
  assert.deepEqual(unreadable, { status: 503, body: { error: "temporarily_unavailable" } })
})
