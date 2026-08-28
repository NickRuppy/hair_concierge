import assert from "node:assert/strict"
import test from "node:test"

import {
  planStartRefinementExitDestination,
  planStartSuppressesChapterCeremony,
  stage3CompletionRoutineHref,
} from "../src/components/personal-plan-start/plan-start-flow"
import { resolvePlanStartPageState, type PlanStartPageDeps } from "../src/app/plan-start/page"
import { loadModule1Stage3Resume } from "../src/lib/personal-plan/refinement/module1-stage3-resume"
import { withRoutinePlanUpdatedSignal } from "../src/lib/personal-plan/routine/plan-updated-signal"
import type { Stage2RefinementSession } from "../src/lib/personal-plan/refinement/session"

/**
 * Carried obligation 1 of Task 2.5 (ruled in the 2.4 review): after the Modul-1
 * handoff the refinement draft stays `in_progress`, so a plain reload of
 * `/plan-start` used to resume Stage 2 — dropping the user back into the
 * Feinschliff instead of the Stage 3 they were in. The persistent handoff marker
 * (Task 1.4) plus the Stage-3 draft's own existence are the server-side facts the
 * client deliberately does not read.
 */

const ids = {
  user: "11111111-1111-4111-8111-111111111111",
  plan: "22222222-2222-4222-8222-222222222222",
  initialNeed: "33333333-3333-4333-8333-333333333333",
  refined: "44444444-4444-4444-8444-444444444444",
  activeRoutine: "55555555-5555-4555-8555-555555555555",
}

type Row = Record<string, unknown>

const PRODUCTS_ANSWERS = { currentProductCategories: ["shampoo"], wetWashFrequency: "daily" }
const PRODUCTS_QUESTION_IDS = ["current_product_categories", "wet_wash_frequency"]

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
    output_snapshot: {
      renderedOrder: ["shampoo", "conditioner"],
      profile: { scalp: { concerns: [] } },
      decisions: [],
    },
    stage1_source_lead_id: "lead-1",
    prepared_artifact_source_id: null,
    ...overrides,
  }
}

function refinementDraftRow(overrides: Partial<Row> = {}): Row {
  return {
    personal_plan_id: ids.plan,
    base_initial_need_version_id: ids.initialNeed,
    status: "in_progress",
    answers: PRODUCTS_ANSWERS,
    completed_question_ids: PRODUCTS_QUESTION_IDS,
    answer_provenance: Object.fromEntries(PRODUCTS_QUESTION_IDS.map((id) => [id, "user"])),
    module_projections: {
      products: { needVersionId: ids.refined, projectedAtRevision: 1, stage3Handoff: true },
    },
    updated_at: "2026-08-26T00:00:00.000Z",
    ...overrides,
  }
}

function stage3DraftRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    user_id: ids.user,
    personal_plan_id: ids.plan,
    refined_need_version_id: ids.refined,
    status: "active",
    ...overrides,
  }
}

/** Same in-memory query stand-in as tests/personal-plan-refinement-status-route.test.ts. */
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
            return (av < bv ? -1 : 1) * (opts.ascending ? 1 : -1)
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

const resumeFor = (tables: Record<string, Row[]>) =>
  loadModule1Stage3Resume(makeClient(tables) as never, ids.user)

test("the products module handoff plus its live Stage-3 draft resume Stage 3", async () => {
  assert.deepEqual(
    await resumeFor({
      personal_plans: [planRow()],
      personal_plan_need_versions: [needVersionRow()],
      personal_plan_refinement_drafts: [refinementDraftRow()],
      personal_plan_product_drafts: [stage3DraftRow()],
    }),
    { refinedVersionId: ids.refined },
  )
})

test("reloading on the bridge — handoff done, Stage-3 draft not created yet — resumes Stage 3", async () => {
  // The Stage-3 journey bootstrap creates the draft itself (today's tap-"weiter"
  // path), so an absent draft is the pre-tap reload point, not a blocker.
  assert.deepEqual(
    await resumeFor({
      personal_plans: [planRow()],
      personal_plan_need_versions: [needVersionRow()],
      personal_plan_refinement_drafts: [refinementDraftRow()],
      personal_plan_product_drafts: [],
    }),
    { refinedVersionId: ids.refined },
  )
})

test("a finished or stale Stage-3 draft is not a resume target", async () => {
  for (const status of ["completed", "stale"]) {
    assert.equal(
      await resumeFor({
        personal_plans: [planRow()],
        personal_plan_need_versions: [needVersionRow()],
        personal_plan_refinement_drafts: [refinementDraftRow()],
        personal_plan_product_drafts: [stage3DraftRow({ status })],
      }),
      null,
      `status ${status} must not resume`,
    )
  }
})

test("an open draft still wins when a stale row for the same version is lying around", async () => {
  assert.deepEqual(
    await resumeFor({
      personal_plans: [planRow()],
      personal_plan_need_versions: [needVersionRow()],
      personal_plan_refinement_drafts: [refinementDraftRow()],
      personal_plan_product_drafts: [
        stage3DraftRow({ id: "66666666-6666-4666-8666-666666666666", status: "stale" }),
        stage3DraftRow(),
      ],
    }),
    { refinedVersionId: ids.refined },
  )
})

test("another owner's Stage-3 draft neither resumes nor blocks — it is simply not read", async () => {
  // Owner scoping only: the foreign row is invisible, so this falls back to the
  // bridge-reload case (no draft of this owner yet) and resumes.
  assert.deepEqual(
    await resumeFor({
      personal_plans: [planRow()],
      personal_plan_need_versions: [needVersionRow()],
      personal_plan_refinement_drafts: [refinementDraftRow()],
      personal_plan_product_drafts: [stage3DraftRow({ user_id: "someone-else" })],
    }),
    { refinedVersionId: ids.refined },
  )
})

test("a completed Stage-3 draft of another owner cannot block this owner's resume", async () => {
  assert.deepEqual(
    await resumeFor({
      personal_plans: [planRow()],
      personal_plan_need_versions: [needVersionRow()],
      personal_plan_refinement_drafts: [refinementDraftRow()],
      personal_plan_product_drafts: [
        stage3DraftRow({ user_id: "someone-else", status: "completed" }),
      ],
    }),
    { refinedVersionId: ids.refined },
  )
})

test("no handoff marker: no resume even with an unrelated Stage-3 draft", async () => {
  assert.equal(
    await resumeFor({
      personal_plans: [planRow()],
      personal_plan_need_versions: [needVersionRow()],
      personal_plan_refinement_drafts: [refinementDraftRow({ module_projections: {} })],
      personal_plan_product_drafts: [stage3DraftRow()],
    }),
    null,
  )
})

test("a products module that is not user-complete does not resume", async () => {
  assert.equal(
    await resumeFor({
      personal_plans: [planRow()],
      personal_plan_need_versions: [needVersionRow()],
      personal_plan_refinement_drafts: [
        refinementDraftRow({
          answers: { currentProductCategories: ["shampoo"] },
          completed_question_ids: ["current_product_categories"],
          answer_provenance: { current_product_categories: "user" },
        }),
      ],
      personal_plan_product_drafts: [stage3DraftRow()],
    }),
    null,
  )
})

test("assumed (direct-accept) answers alone never look like a completed products module", async () => {
  assert.equal(
    await resumeFor({
      personal_plans: [planRow()],
      personal_plan_need_versions: [needVersionRow()],
      personal_plan_refinement_drafts: [
        refinementDraftRow({
          answer_provenance: Object.fromEntries(PRODUCTS_QUESTION_IDS.map((id) => [id, "assumed"])),
        }),
      ],
      personal_plan_product_drafts: [stage3DraftRow()],
    }),
    null,
  )
})

test("a plan without a personal plan row resolves to no resume, not a throw", async () => {
  assert.equal(await resumeFor({}), null)
})

// ————————————————————— page resolver wiring —————————————————————

const allowed = {
  stage1: true,
  stage2: true,
  stage3: true,
  stage4: true,
  stage5: false,
} as const

function inProgressSession(): Stage2RefinementSession {
  return {
    schemaVersion: 1,
    pathVersion: "stage2-v1",
    revision: 3,
    status: "in_progress",
    triggerContext: {
      relevantCategories: ["shampoo"],
      hasReportedIrritatedScalp: false,
      dryShampooBridgeEligibility: "ineligible",
    },
    answers: { currentProductCategories: ["shampoo"] },
    completedQuestionIds: ["current_product_categories"],
    path: {
      orderedQuestionIds: ["current_product_categories", "wet_wash_frequency"],
      requiredQuestionIds: ["current_product_categories", "wet_wash_frequency"],
      completedQuestionIds: ["current_product_categories"],
      firstUnresolvedQuestionId: "wet_wash_frequency",
      prunedAnswerKeys: [],
    },
  }
}

function depsWithResume(
  resume: PlanStartPageDeps["loadModule1Stage3Resume"],
  overrides: Partial<PlanStartPageDeps> = {},
): PlanStartPageDeps {
  return {
    enabled: () => true,
    stage2Enabled: () => true,
    getUserId: async () => ids.user,
    loadJourneyAccess: async () => ({
      kind: "personal_plan",
      personalPlanId: ids.plan,
      // The Feinschliff cohort already has an accepted Routine, so its frontier
      // is stage4 — the completed-draft Stage-3 branch would never fire here.
      frontier: "stage4",
      nextHref: "/routine",
      allowed,
      // ACTIVATED, not merely Stage-4-allowed: `planAccepted` is derived from
      // this field, so a fixture that claims an accepted Routine has to carry
      // it or it silently models the pending-proposal cohort instead.
      activeRoutineVersionId: ids.activeRoutine,
    }),
    loadExistingRefinementSession: async () => inProgressSession(),
    loadModule1Stage3Resume: resume,
    ...overrides,
  }
}

test("reload after the Modul-1 handoff resumes Stage 3, not Stage 2", async () => {
  assert.deepEqual(
    await resolvePlanStartPageState(
      depsWithResume(async () => ({ refinedVersionId: ids.refined })),
    ),
    {
      state: "production",
      // `refineModule: "products"` is what this state IS — the resumed leg of an
      // explicit products-module run. It keeps the retired chapter ceremony
      // suppressed across an undirected reload (founder ruling 27.08.2026).
      initialJourney: {
        stage: "stage3",
        refinedVersionId: ids.refined,
        refineModule: "products",
        // ORIGIN: this cohort came from the Routine banner, so its plan is
        // already activated — that is what earns the /routine exit and the
        // „Plan aktualisiert“ signal below.
        planAccepted: true,
      },
      personalPlanId: ids.plan,
      initialRefinementSession: inProgressSession(),
    },
  )
})

test("the resumed Stage-3 leg keeps the module exit and suppresses the ceremony", async () => {
  const state = await resolvePlanStartPageState(
    depsWithResume(async () => ({ refinedVersionId: ids.refined })),
  )
  assert.equal(state.state, "production")
  const initialJourney = state.state === "production" ? state.initialJourney : null
  assert.ok(initialJourney)
  // The undirected reload must behave exactly like the module entry it resumes:
  // exit to /routine, no chapter screens, and the "Plan aktualisiert" signal.
  assert.equal(planStartRefinementExitDestination(initialJourney), "routine")
  assert.equal(planStartSuppressesChapterCeremony(initialJourney), true)
  assert.equal(
    stage3CompletionRoutineHref(initialJourney, "/routine"),
    withRoutinePlanUpdatedSignal("/routine"),
  )
})

/**
 * Codex re-review finding 5. `allowed.stage4` is
 * `hasAcceptedRoutine || hasCurrentProposal`, so keying the origin on it would
 * call a user with only a PENDING proposal "accepted" — and hand them the
 * „Plan aktualisiert“ toast for a routine they have never activated.
 */
test("a pending proposal alone is not acceptance — no origin, no „aktualisiert“ claim", async () => {
  const state = await resolvePlanStartPageState(
    depsWithResume(async () => ({ refinedVersionId: ids.refined }), {
      loadJourneyAccess: async () => ({
        kind: "personal_plan",
        personalPlanId: ids.plan,
        frontier: "stage4",
        nextHref: "/routine",
        // Stage 4 is allowed by the pending proposal, but nothing is activated.
        allowed,
        hasPendingRoutineProposal: true,
        activeRoutineVersionId: null,
      }),
    }),
  )
  assert.equal(state.state, "production")
  const initialJourney = state.state === "production" ? state.initialJourney : null
  assert.ok(initialJourney)

  assert.deepEqual(initialJourney, {
    stage: "stage3",
    refinedVersionId: ids.refined,
    refineModule: "products",
  })
  // Module SCOPE is unaffected — this is still a directed module run.
  assert.equal(planStartSuppressesChapterCeremony(initialJourney), true)
  // ORIGIN is absent, so no toast and no /routine exit.
  assert.equal(stage3CompletionRoutineHref(initialJourney, "/routine"), "/routine")
  assert.equal(planStartRefinementExitDestination(initialJourney), "stage1")
})

test("a Stage-3 entry with no module marker still gets the full creation funnel", () => {
  const linear = { stage: "stage3", refinedVersionId: ids.refined } as const
  assert.equal(planStartSuppressesChapterCeremony(linear), false)
  assert.equal(planStartRefinementExitDestination(linear), "stage1")
  assert.equal(stage3CompletionRoutineHref(linear, "/routine"), "/routine")
})

test("without a handoff resume the in-progress draft still resolves to Stage 2", async () => {
  const state = await resolvePlanStartPageState(depsWithResume(async () => null))
  assert.equal(state.state, "production")
  assert.deepEqual(state.state === "production" ? state.initialJourney : null, {
    stage: "stage2",
    planAccepted: true,
  })
})

test("an unwired resume dep leaves the Stage 2 fall-through untouched", async () => {
  const state = await resolvePlanStartPageState(depsWithResume(undefined))
  assert.deepEqual(state.state === "production" ? state.initialJourney : null, {
    stage: "stage2",
    planAccepted: true,
  })
})

test("an explicit refine deep link still outranks the Stage-3 resume", async () => {
  const state = await resolvePlanStartPageState(
    depsWithResume(async () => ({ refinedVersionId: ids.refined })),
    { refine: true, refineModule: "habits" },
  )
  assert.deepEqual(state.state === "production" ? state.initialJourney : null, {
    stage: "stage2",
    returningToRefinement: true,
    refineModule: "habits",
    planAccepted: true,
  })
})

test("Stage 3 access is still required for the resume", async () => {
  const state = await resolvePlanStartPageState(
    depsWithResume(async () => ({ refinedVersionId: ids.refined }), {
      loadJourneyAccess: async () => ({
        kind: "personal_plan",
        personalPlanId: ids.plan,
        frontier: "stage2",
        nextHref: "/plan-start",
        allowed: { ...allowed, stage3: false, stage4: false },
      }),
    }),
  )
  // No Stage-4 access means no activated plan, so the journey carries no
  // `planAccepted` — the origin signal tracks real acceptance, not the URL.
  assert.deepEqual(state.state === "production" ? state.initialJourney : null, {
    stage: "stage2",
  })
})

test("a failing resume read degrades to Stage 2 instead of taking the page down", async () => {
  const state = await resolvePlanStartPageState(
    depsWithResume(async () => {
      throw new Error("resume read failed")
    }),
  )
  assert.deepEqual(state.state === "production" ? state.initialJourney : null, {
    stage: "stage2",
    planAccepted: true,
  })
})
