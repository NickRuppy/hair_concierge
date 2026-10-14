import assert from "node:assert/strict"
import test from "node:test"

import { createRefinementPresentationRouteHandlers } from "../src/app/api/personal-plan/refinement-presentation/route"

const ids = {
  user: "11111111-1111-4111-8111-111111111111",
  plan: "22222222-2222-4222-8222-222222222222",
  routineVersion: "33333333-3333-4333-8333-333333333333",
  refined: "44444444-4444-4444-8444-444444444444",
  staleRefined: "55555555-5555-4555-8555-555555555555",
  portfolio: "66666666-6666-4666-8666-666666666666",
}

type Row = Record<string, unknown>

/**
 * Minimal in-memory Supabase-like query builder. Filters are applied as the chain is built
 * (eq narrows the candidate rows, order sorts them, limit truncates) so tests can prove the
 * route issues the exact filters it claims to (e.g. binding on result_refined_need_version_id
 * rather than only sorting by updated_at).
 */
function makeClient(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])]
      const query = {
        select: () => query,
        eq(column: string, value: unknown) {
          rows = rows.filter((row) => row[column] === value)
          return query
        },
        order(column: string, opts: { ascending: boolean }) {
          rows = [...rows].sort((a, b) => {
            const av = String(a[column] ?? "")
            const bv = String(b[column] ?? "")
            if (av === bv) return 0
            const cmp = av < bv ? -1 : 1
            return opts.ascending ? cmp : -cmp
          })
          return query
        },
        limit(n: number) {
          rows = rows.slice(0, n)
          return query
        },
        async maybeSingle() {
          return { data: rows[0] ?? null, error: null }
        },
      }
      return query
    },
  }
}

function routinePayload(versionId: string, items: Array<Record<string, unknown>>) {
  const categories = [...new Set(items.map((item) => item.category as string))]
  return {
    schemaVersion: 1,
    planId: ids.plan,
    versionId,
    parentVersionId: null,
    source: {
      refinedVersionId: ids.refined,
      productPortfolioVersionId: ids.portfolio,
      sourceFingerprint: "a".repeat(64),
      compilerVersion: "v1",
      authorityVersions: {},
    },
    intent: {
      schemaVersion: 1,
      categories: categories.map((category) => ({
        category,
        inclusion: "included",
        inclusionSource: "stage3",
        assignments: [],
      })),
    },
    sections: [
      { key: "basis", itemKeys: [] },
      { key: "optional", itemKeys: [] },
    ],
    items,
    createdAt: "2026-08-10T00:00:00.000Z",
  }
}

const ownedConditioner = {
  itemKey: "item:conditioner",
  assignmentKey: "assignment:conditioner",
  category: "conditioner",
  role: "conditioner_rinse_out",
  purposeKey: "conditioner_rinse_out",
  roleOrder: 0,
  state: {
    systemAssessment: "basis",
    inclusion: "included",
    availability: "owned",
    fitDecision: "standard",
  },
  product: {
    kind: "owned",
    capturedProductId: "captured-conditioner",
    productId: "product-conditioner",
    displayName: "Gliss Kur Aqua Revive Conditioner",
  },
  cadence: { recommended: null, userOverride: null, displayKey: "none" },
  sourceDecisionKeys: [],
  authorityRuleIds: [],
  executable: true,
}

const plannedShampoo = {
  itemKey: "item:shampoo",
  assignmentKey: "assignment:shampoo",
  category: "shampoo",
  role: "shampoo_everyday",
  purposeKey: "shampoo_everyday",
  roleOrder: 1,
  state: {
    systemAssessment: "basis",
    inclusion: "included",
    availability: "planned",
    fitDecision: "standard",
  },
  product: {
    kind: "planned",
    plannedPurchaseId: "planned-shampoo",
    productId: null,
    displayName: "Neues Shampoo",
  },
  cadence: { recommended: null, userOverride: null, displayKey: "none" },
  sourceDecisionKeys: [],
  authorityRuleIds: [],
  executable: true,
}

const pendingReviewMask = {
  itemKey: "item:mask",
  assignmentKey: "assignment:mask",
  category: "mask",
  role: "intensive_conditioning_mask",
  purposeKey: "intensive_conditioning_mask",
  roleOrder: 2,
  state: {
    systemAssessment: "optional",
    inclusion: "included",
    availability: "pending_review",
    fitDecision: "standard",
  },
  product: {
    kind: "pending_review",
    submissionId: "submission-mask",
    displayName: "Wird geprüft",
  },
  cadence: { recommended: null, userOverride: null, displayKey: "none" },
  sourceDecisionKeys: [],
  authorityRuleIds: [],
  executable: false,
}

test("returns the refinement answers bound to the current refined need version", async () => {
  const client = makeClient({
    personal_plans: [
      {
        id: ids.plan,
        user_id: ids.user,
        revision: 1,
        source_revision: 1,
        current_refined_need_version_id: ids.refined,
        active_routine_version_id: null,
        pending_routine_proposal_id: null,
      },
    ],
    personal_plan_refinement_drafts: [
      {
        id: "draft-stale",
        personal_plan_id: ids.plan,
        status: "complete",
        result_refined_need_version_id: ids.staleRefined,
        answers: { towel: { material: "handtuch", technique: "rub" } },
        completed_question_ids: ["towel_handling"],
        // Newer than the correct draft below, but bound to a superseded refined-need
        // version. Winning here would prove the route wrongly authorities on recency.
        updated_at: "2026-08-14T00:00:00.000Z",
      },
      {
        id: "draft-current",
        personal_plan_id: ids.plan,
        status: "complete",
        result_refined_need_version_id: ids.refined,
        answers: { towel: { material: "frottee", technique: "gentle_press" }, nightProtection: [] },
        completed_question_ids: ["towel_handling", "night_protection"],
        updated_at: "2026-08-10T00:00:00.000Z",
      },
    ],
  })

  const res = await createRefinementPresentationRouteHandlers({
    getUserId: async () => ids.user,
    client: () => client as never,
  }).GET()
  const body = await res.json()

  assert.equal(res.status, 200)
  assert.equal(res.headers.get("Cache-Control"), "no-store")
  assert.equal(body.answers.towel.material, "frottee")
  assert.deepEqual(body.answers.nightProtection, [])
  assert.deepEqual(body.completedQuestionIds, ["towel_handling", "night_protection"])
  assert.equal(body.routineProducts, null)
})

test("returns null answers when no complete draft matches the pointer", async () => {
  const client = makeClient({
    personal_plans: [
      {
        id: ids.plan,
        user_id: ids.user,
        revision: 1,
        source_revision: 1,
        current_refined_need_version_id: ids.refined,
        active_routine_version_id: null,
        pending_routine_proposal_id: null,
      },
    ],
    personal_plan_refinement_drafts: [
      {
        id: "draft-other",
        personal_plan_id: ids.plan,
        status: "complete",
        result_refined_need_version_id: ids.staleRefined,
        answers: { towel: { material: "handtuch" } },
        completed_question_ids: ["towel_handling"],
        updated_at: "2026-08-10T00:00:00.000Z",
      },
    ],
  })

  const res = await createRefinementPresentationRouteHandlers({
    getUserId: async () => ids.user,
    client: () => client as never,
  }).GET()
  const body = await res.json()

  assert.equal(res.status, 200)
  assert.equal(body.answers, null)
  assert.deepEqual(body.completedQuestionIds, [])
  assert.equal(body.routineProducts, null)
})

// loadPersonalPlanRoutineView() only trusts the frozen active Routine version when its
// intent category order still matches the immutable refined-need snapshot it was compiled
// from (personal_plan_need_versions.output_snapshot.renderedOrder). Seeding a matching row
// here is what keeps the "active version" test out of the authority_repair_required branch;
// the repair-required test below deliberately omits it.
function matchingRefinedNeedVersionRow(renderedOrder: string[]) {
  return {
    id: ids.refined,
    user_id: ids.user,
    personal_plan_id: ids.plan,
    kind: "refined",
    output_snapshot: { renderedOrder },
  }
}

test("returns included routine products of the active version", async () => {
  const client = makeClient({
    personal_plans: [
      {
        id: ids.plan,
        user_id: ids.user,
        revision: 1,
        source_revision: 1,
        current_refined_need_version_id: null,
        active_routine_version_id: ids.routineVersion,
        pending_routine_proposal_id: null,
      },
    ],
    personal_plan_routine_versions: [
      {
        id: ids.routineVersion,
        user_id: ids.user,
        personal_plan_id: ids.plan,
        payload: routinePayload(ids.routineVersion, [
          ownedConditioner,
          plannedShampoo,
          pendingReviewMask,
        ]),
      },
    ],
    personal_plan_need_versions: [
      matchingRefinedNeedVersionRow(["conditioner", "shampoo", "mask"]),
    ],
  })

  const res = await createRefinementPresentationRouteHandlers({
    getUserId: async () => ids.user,
    client: () => client as never,
  }).GET()
  const body = await res.json()

  assert.equal(res.status, 200)
  assert.equal(body.routineProducts.length, 2)
  const owned = body.routineProducts.find((product: { state: string }) => product.state === "owned")
  assert.equal(owned.name, "Gliss Kur Aqua Revive Conditioner")
  assert.equal(owned.categoryLabel, "Conditioner")
  assert.equal(owned.purposeLabel, "Pflege nach der Reinigung")
  const planned = body.routineProducts.find(
    (product: { state: string }) => product.state === "planned",
  )
  assert.equal(planned.name, "Neues Shampoo")
  assert.equal(planned.categoryLabel, "Shampoo")
})

test("routineProducts is null without an active routine", async () => {
  const client = makeClient({
    personal_plans: [
      {
        id: ids.plan,
        user_id: ids.user,
        revision: 1,
        source_revision: 1,
        current_refined_need_version_id: null,
        active_routine_version_id: null,
        pending_routine_proposal_id: null,
      },
    ],
  })

  const res = await createRefinementPresentationRouteHandlers({
    getUserId: async () => ids.user,
    client: () => client as never,
  }).GET()
  const body = await res.json()

  assert.equal(res.status, 200)
  assert.equal(body.routineProducts, null)
})

test("routineProducts is null when the active routine is authority_repair_required", async () => {
  // No personal_plan_need_versions row is seeded for ids.refined, so
  // hasMatchingSourceCategoryOrder() cannot confirm the frozen Routine still matches its
  // immutable source. /routine would show a repair prompt and hide items in this state;
  // /profile must not show a possibly-stale product list either.
  const client = makeClient({
    personal_plans: [
      {
        id: ids.plan,
        user_id: ids.user,
        revision: 1,
        source_revision: 1,
        current_refined_need_version_id: null,
        active_routine_version_id: ids.routineVersion,
        pending_routine_proposal_id: null,
      },
    ],
    personal_plan_routine_versions: [
      {
        id: ids.routineVersion,
        user_id: ids.user,
        personal_plan_id: ids.plan,
        payload: routinePayload(ids.routineVersion, [ownedConditioner, plannedShampoo]),
      },
    ],
  })

  const res = await createRefinementPresentationRouteHandlers({
    getUserId: async () => ids.user,
    client: () => client as never,
  }).GET()
  const body = await res.json()

  assert.equal(res.status, 200)
  assert.equal(body.routineProducts, null)
})

test("refinement presentation API rejects unauthenticated reads", async () => {
  const res = await createRefinementPresentationRouteHandlers({
    getUserId: async () => null,
    client: () => {
      throw new Error("must not construct client")
    },
  }).GET()
  assert.equal(res.status, 401)
})
