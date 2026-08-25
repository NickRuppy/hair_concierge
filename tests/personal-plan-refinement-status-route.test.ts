import assert from "node:assert/strict"
import test from "node:test"

import { createRefinementStatusRouteHandlers } from "../src/app/api/personal-plan/refinement-status/route"
import { PERSONAL_PLAN_UI_LIFECYCLE_MARKS_TABLE } from "../src/lib/personal-plan/lifecycle/repository"

const ids = {
  user: "11111111-1111-4111-8111-111111111111",
  plan: "22222222-2222-4222-8222-222222222222",
  initialNeed: "33333333-3333-4333-8333-333333333333",
}

type Row = Record<string, unknown>

const INITIAL_NEED_SNAPSHOT = {
  renderedOrder: ["shampoo", "conditioner"],
  profile: { scalp: { concerns: [] } },
  decisions: [],
}

function planRow(overrides: Partial<Row> = {}): Row {
  return {
    id: ids.plan,
    user_id: ids.user,
    current_initial_need_version_id: ids.initialNeed,
    ...overrides,
  }
}

function needVersionRow(overrides: Partial<Row> = {}): Row {
  return {
    id: ids.initialNeed,
    user_id: ids.user,
    output_snapshot: INITIAL_NEED_SNAPSHOT,
    // A quiz-sourced initial need version always carries one of these; the read loader
    // treats a row with neither as legacy/unusable data (mirrors stage2-refinement-supabase.ts).
    stage1_source_lead_id: "lead-1",
    prepared_artifact_source_id: null,
    ...overrides,
  }
}

/**
 * A combined in-memory stand-in for the two Supabase query shapes this route touches:
 * a `.select().eq()...maybeSingle()` chain for `personal_plans` /
 * `personal_plan_need_versions` / `personal_plan_refinement_drafts` (mirrors
 * tests/personal-plan-refinement-presentation-route.test.ts), and the thenable
 * `.select().eq().eq()` chain the lifecycle repository awaits directly for
 * `personal_plan_ui_lifecycle_marks` (mirrors tests/personal-plan-lifecycle-marks.test.ts).
 */
function makeClient(tables: Record<string, Row[]>) {
  const lifecycleRows: Row[] = [...(tables[PERSONAL_PLAN_UI_LIFECYCLE_MARKS_TABLE] ?? [])]

  return {
    from(table: string) {
      if (table === PERSONAL_PLAN_UI_LIFECYCLE_MARKS_TABLE) {
        const filters: Record<string, unknown> = {}
        const query = {
          select: () => query,
          eq(column: string, value: unknown) {
            filters[column] = value
            return query
          },
          async upsert(row: Record<string, unknown>) {
            lifecycleRows.push(row)
            return { error: null }
          },
          then(
            onFulfilled: (value: { data: Row[]; error: null }) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) {
            const data = lifecycleRows.filter((row) =>
              Object.entries(filters).every(([column, value]) => row[column] === value),
            )
            return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected)
          },
        }
        return query as never
      }

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
      return query as never
    },
  }
}

function handlersFor(tables: Record<string, Row[]>, userId: string | null = ids.user) {
  return createRefinementStatusRouteHandlers({
    getUserId: async () => userId,
    client: () => makeClient(tables) as never,
  })
}

test("fresh plan with no refinement draft: both modules open, progress 2/4", async () => {
  const res = await handlersFor({
    personal_plans: [planRow()],
    personal_plan_need_versions: [needVersionRow()],
  }).GET()
  const body = await res.json()

  assert.equal(res.status, 200)
  assert.equal(res.headers.get("Cache-Control"), "no-store")
  assert.deepEqual(
    body.modules.map((m: { module: string; status: string }) => [m.module, m.status]),
    [
      ["products", "open"],
      ["habits", "open"],
    ],
  )
  assert.deepEqual(body.progress, { completedSteps: 2, totalSteps: 4 })
  assert.equal(body.module1HandedOff, false)
  assert.deepEqual(body.banner, { visible: true, module: "products", dismissed: false })
})

test("partial products user-answers: products open with the correct open-question count", async () => {
  const res = await handlersFor({
    personal_plans: [planRow()],
    personal_plan_need_versions: [needVersionRow()],
    personal_plan_refinement_drafts: [
      {
        personal_plan_id: ids.plan,
        base_initial_need_version_id: ids.initialNeed,
        status: "in_progress",
        answers: { currentProductCategories: ["shampoo"] },
        completed_question_ids: ["current_product_categories"],
        answer_provenance: { current_product_categories: "user" },
        module_projections: {},
        updated_at: "2026-08-20T00:00:00.000Z",
      },
    ],
  }).GET()
  const body = await res.json()

  assert.equal(res.status, 200)
  const products = body.modules.find((m: { module: string }) => m.module === "products")
  assert.equal(products.status, "open")
  assert.equal(products.openQuestionCount, 1)
  assert.deepEqual(body.progress, { completedSteps: 2, totalSteps: 4 })
})

test("products module complete via lineage: 3/4 and the handoff marker is set", async () => {
  const res = await handlersFor({
    personal_plans: [planRow()],
    personal_plan_need_versions: [needVersionRow()],
    personal_plan_refinement_drafts: [
      {
        personal_plan_id: ids.plan,
        base_initial_need_version_id: ids.initialNeed,
        status: "in_progress",
        answers: { currentProductCategories: ["shampoo"], wetWashFrequency: "daily" },
        completed_question_ids: ["current_product_categories", "wet_wash_frequency"],
        answer_provenance: { current_product_categories: "user", wet_wash_frequency: "user" },
        module_projections: {
          products: { needVersionId: "need-v2", projectedAtRevision: 1, stage3Handoff: true },
        },
        updated_at: "2026-08-20T00:00:00.000Z",
      },
    ],
  }).GET()
  const body = await res.json()

  assert.equal(res.status, 200)
  assert.equal(
    body.modules.find((m: { module: string }) => m.module === "products").status,
    "complete",
  )
  assert.equal(body.modules.find((m: { module: string }) => m.module === "habits").status, "open")
  assert.deepEqual(body.progress, { completedSteps: 3, totalSteps: 4 })
  assert.equal(body.module1HandedOff, true)
  assert.deepEqual(body.banner, { visible: true, module: "habits", dismissed: false })
})

test("both modules complete: 4/4", async () => {
  const answers = {
    currentProductCategories: ["shampoo"],
    wetWashFrequency: "daily",
    towel: { material: "no_towel" },
    dryingRoutes: [],
    additionalHeatTools: [],
    nightProtection: [],
  }
  const completedQuestionIds = [
    "current_product_categories",
    "wet_wash_frequency",
    "towel_handling",
    "drying_routes",
    "additional_heat_tools",
    "night_protection",
  ]
  const res = await handlersFor({
    personal_plans: [planRow()],
    personal_plan_need_versions: [needVersionRow()],
    personal_plan_refinement_drafts: [
      {
        personal_plan_id: ids.plan,
        base_initial_need_version_id: ids.initialNeed,
        status: "complete",
        answers,
        completed_question_ids: completedQuestionIds,
        answer_provenance: Object.fromEntries(completedQuestionIds.map((id) => [id, "user"])),
        module_projections: {
          products: { needVersionId: "need-v2", projectedAtRevision: 1, stage3Handoff: true },
          habits: { needVersionId: "need-v3", projectedAtRevision: 2, stage3Handoff: false },
        },
        updated_at: "2026-08-21T00:00:00.000Z",
      },
    ],
  }).GET()
  const body = await res.json()

  assert.equal(res.status, 200)
  assert.deepEqual(
    body.modules.map((m: { status: string }) => m.status),
    ["complete", "complete"],
  )
  assert.deepEqual(body.progress, { completedSteps: 4, totalSteps: 4 })
  assert.equal(body.module1HandedOff, true)
  assert.deepEqual(body.banner, { visible: false, module: null, dismissed: false })
})

test("banner reflects a stored dismissal for the current open module", async () => {
  const res = await handlersFor({
    personal_plans: [planRow()],
    personal_plan_need_versions: [needVersionRow()],
    [PERSONAL_PLAN_UI_LIFECYCLE_MARKS_TABLE]: [
      {
        user_id: ids.user,
        kind: "module_banner_dismissed",
        subject: "products",
        marked_at: "2026-08-20T00:00:00.000Z",
      },
    ],
  }).GET()
  const body = await res.json()

  assert.equal(res.status, 200)
  assert.deepEqual(body.banner, { visible: false, module: "products", dismissed: true })
})

test("in_progress draft wins over a completed draft on the same initial need version", async () => {
  const res = await handlersFor({
    personal_plans: [planRow()],
    personal_plan_need_versions: [needVersionRow()],
    personal_plan_refinement_drafts: [
      {
        personal_plan_id: ids.plan,
        base_initial_need_version_id: ids.initialNeed,
        status: "complete",
        answers: {
          currentProductCategories: ["shampoo"],
          wetWashFrequency: "daily",
          towel: { material: "no_towel" },
          dryingRoutes: [],
          additionalHeatTools: [],
          nightProtection: [],
        },
        completed_question_ids: [
          "current_product_categories",
          "wet_wash_frequency",
          "towel_handling",
          "drying_routes",
          "additional_heat_tools",
          "night_protection",
        ],
        answer_provenance: { current_product_categories: "user" },
        module_projections: {},
        updated_at: "2026-08-19T00:00:00.000Z",
      },
      {
        personal_plan_id: ids.plan,
        base_initial_need_version_id: ids.initialNeed,
        status: "in_progress",
        answers: {},
        completed_question_ids: [],
        answer_provenance: {},
        module_projections: {},
        updated_at: "2026-08-22T00:00:00.000Z",
      },
    ],
  }).GET()
  const body = await res.json()

  assert.equal(res.status, 200)
  // Reads the in_progress row, not the (also present) complete one.
  assert.deepEqual(body.progress, { completedSteps: 2, totalSteps: 4 })
})

test("initial need version with neither a Stage-1 lead nor a prepared-artifact source degrades to 503", async () => {
  const res = await handlersFor({
    personal_plans: [planRow()],
    personal_plan_need_versions: [
      needVersionRow({ stage1_source_lead_id: null, prepared_artifact_source_id: null }),
    ],
  }).GET()

  assert.equal(res.status, 503)
})

test("no personal plan: typed 404", async () => {
  const res = await handlersFor({}).GET()
  const body = await res.json()

  assert.equal(res.status, 404)
  assert.equal(body.error, "no_personal_plan")
})

test("rejects unauthenticated reads", async () => {
  const res = await handlersFor({}, null).GET()
  assert.equal(res.status, 401)
})
