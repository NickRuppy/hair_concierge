import assert from "node:assert/strict"
import test from "node:test"

import type { SupabaseClient } from "@supabase/supabase-js"

import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import {
  createProductionFactsRecomputeDeps,
  createProductionSyncPlanWithFacts,
  syncPlanWithFacts,
} from "../src/lib/personal-plan/facts-recompute"
import { buildLegacyQuizStage1Source } from "../src/lib/personal-plan/input"
import {
  hashPersonalPlanNeedVersionInput,
  type JsonValue,
} from "../src/lib/personal-plan/persistence"
import { PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION } from "../src/lib/personal-plan/persistence/stage1-service"
import type { QuizAnswers } from "../src/lib/quiz/types"
import { projectLegacyLeadToFacts } from "../src/lib/user-facts/project-legacy-lead"
import {
  completeStage2Module,
  id,
  insertLegacyQuizLead,
  insertProfile,
  migratedPersonalPlanDatabase,
  readHairProfile,
  saveUserFacts,
  type PersonalPlanTestDb,
} from "./personal-plan-pglite-migration.fixtures"

/**
 * End to end over the REAL SQL (plans/2026-10-03-central-user-profile-pr2.md §8 task 3): the
 * production deps (`createProductionFactsRecomputeDeps`) run against PGlite through a thin
 * PostgREST-shaped adapter, on the real migration chain incl. `personal_plan_rebase_on_facts_v1`
 * and the user-facts door + lock. A legacy-lead plan with an in-progress draft projected once →
 * a diagnostics edit through the door → the lane → the plan sits on the new initial version.
 */

const USER = id(9, 9)
const LEAD = id(8, 8)
const DRAFT = id(7, 7)
const AT = "2026-10-03T10:00:00.000Z"

const LEGACY_QUIZ_ANSWERS = {
  structure: "wavy",
  thickness: "normal",
  density: "medium",
  hair_length: "medium",
  fingertest: "leicht_uneben",
  pulltest: "stretches_bounces",
  treatment: ["natur"],
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  goals: ["moisture"],
  concerns: ["dryness"],
} as QuizAnswers

/**
 * The PostgREST surface the production deps and `loadUserFacts` use: `select` + `eq` +
 * `order` (repeatable) + `limit` + `maybeSingle`, and `rpc` for the rebase function by named
 * notation. Errors come back as `{ message, code }`, like supabase-js.
 */
function pgliteSupabaseClient(pg: PersonalPlanTestDb): SupabaseClient {
  const REBASE_PARAM_TYPES: Record<string, string> = {
    p_user_id: "uuid",
    p_personal_plan_id: "uuid",
    p_expected_plan_revision: "bigint",
    p_expected_facts_revision: "integer",
    p_initial_id: "uuid",
    p_schema_version: "integer",
    p_computation_version: "text",
    p_initial_input_hash: "text",
    p_initial_input_snapshot: "jsonb",
    p_initial_output_snapshot: "jsonb",
    p_source_draft_id: "uuid",
    p_expected_draft_revision: "bigint",
    p_clone_answers: "jsonb",
    p_clone_completed_question_ids: "text[]",
    p_clone_answer_provenance: "jsonb",
    p_care_habits_patch: "jsonb",
    p_care_habits_provenance: "jsonb",
    p_refined_schema_version: "integer",
    p_refined_computation_version: "text",
    p_refined_input_hash: "text",
    p_refined_input_snapshot: "jsonb",
    p_refined_output_snapshot: "jsonb",
  }
  const client = {
    from(table: string) {
      return {
        select(columns: string) {
          const filters: Array<[string, unknown]> = []
          const orderBy: string[] = []
          let rowLimit: number | null = null
          async function maybeSingle() {
            const where = filters
              .map(([column], index) => `${column} = $${index + 1}`)
              .join(" AND ")
            const sql = [
              `SELECT ${columns} FROM public.${table}`,
              where ? `WHERE ${where}` : "",
              orderBy.length ? `ORDER BY ${orderBy.join(", ")}` : "",
              rowLimit === null ? "" : `LIMIT ${rowLimit}`,
            ]
              .filter(Boolean)
              .join(" ")
            try {
              const { rows } = await pg.query<Record<string, unknown>>(
                sql,
                filters.map(([, value]) => value),
              )
              if (rows.length > 1)
                return { data: null, error: { message: "multiple rows", code: "PGRST116" } }
              return { data: rows[0] ?? null, error: null }
            } catch (error) {
              return {
                data: null,
                error: { message: String(error), code: (error as { code?: string }).code },
              }
            }
          }
          const chain = {
            eq(column: string, value: unknown) {
              filters.push([column, value])
              return chain
            },
            order(column: string, options: { ascending: boolean }) {
              orderBy.push(`${column} ${options.ascending ? "ASC" : "DESC"}`)
              return chain
            },
            limit(count: number) {
              rowLimit = count
              return chain
            },
            maybeSingle,
          }
          return chain
        },
      }
    },
    async rpc(functionName: string, args: Record<string, unknown>) {
      assert.equal(functionName, "personal_plan_rebase_on_facts_v1")
      const keys = Object.keys(args)
      for (const key of keys) assert.ok(REBASE_PARAM_TYPES[key], `unknown parameter ${key}`)
      const values = keys.map((key) => {
        const type = REBASE_PARAM_TYPES[key]
        if (type === "jsonb") return JSON.stringify(args[key])
        if (type === "text[]") {
          return `{${(args[key] as string[]).map((value) => `"${value}"`).join(",")}}`
        }
        return args[key]
      })
      try {
        const { rows } = await pg.query<{ result: unknown }>(
          `SELECT public.${functionName}(${keys
            .map((key, index) => `${key} => $${index + 1}::${REBASE_PARAM_TYPES[key]}`)
            .join(", ")}) AS result`,
          values,
        )
        return { data: rows[0]!.result, error: null }
      } catch (error) {
        return {
          data: null,
          error: { message: String(error), code: (error as { code?: string }).code },
        }
      }
    },
  }
  return client as unknown as SupabaseClient
}

/** Stage 1 for the legacy lead, exactly as `stage1-service.ts` computes it (lead path). */
function legacyInitial() {
  const computed = computeNeedPlan({
    rawEnvelope: buildLegacyQuizStage1Source({ leadId: LEAD, answers: LEGACY_QUIZ_ANSWERS }),
    artifactId: LEAD,
    projection: "initial_quiz",
    computationVersion: PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION,
    createdAt: AT,
  })
  if (computed.status !== "ready") throw new Error("legacy fixture not ready")
  const inputSnapshot = computed.snapshot.sourceQuiz as unknown as JsonValue
  return {
    computed: computed.snapshot,
    inputSnapshot,
    inputHash: hashPersonalPlanNeedVersionInput({
      schemaVersion: computed.snapshot.schemaVersion,
      computationVersion: computed.snapshot.computationVersion,
      inputSnapshot,
    }),
  }
}

async function seedPlanWithProjectedDraft(pg: PersonalPlanTestDb) {
  await insertProfile(pg, USER)
  await insertLegacyQuizLead(pg, { leadId: LEAD, userId: USER })
  const initial = legacyInitial()
  const { rows } = await pg.query<{
    result: { outcome: string; personalPlanId: string; needVersionId: string }
  }>(
    `SELECT public.personal_plan_create_or_reuse_initial_need(
       $1::uuid, NULL, NULL, $2::integer, $3::text, $4::text, $5::jsonb, $6::jsonb,
       'legacy_quiz_lead', $7::uuid
     ) AS result`,
    [
      USER,
      initial.computed.schemaVersion,
      initial.computed.computationVersion,
      initial.inputHash,
      JSON.stringify(initial.inputSnapshot),
      JSON.stringify(initial.computed),
      LEAD,
    ],
  )
  const created = rows[0]!.result
  assert.equal(created.outcome, "completed")

  // The profile facts as the PR1 backfill projects them from the lead (unedited).
  const projected = projectLegacyLeadToFacts({ leadId: LEAD, quizAnswers: LEGACY_QUIZ_ANSWERS })
  const facts = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: projected.diagnostics,
    provenance: { source: { kind: "legacy_lead", id: LEAD }, schemaVersion: 1, at: AT },
  })
  assert.equal(facts.status, "ok")

  // An open Feinschliff draft whose products module was projected once; a towel answer is
  // saved in the open habits module but not published (R16).
  await pg.query(
    `INSERT INTO public.personal_plan_refinement_drafts
       (id, user_id, personal_plan_id, base_initial_need_version_id, schema_version, answers,
        completed_question_ids, answer_provenance, revision)
     VALUES ($1, $2, $3, $4, 1, $5::jsonb, $6::text[], $7::jsonb, 2)`,
    [
      DRAFT,
      USER,
      created.personalPlanId,
      created.needVersionId,
      JSON.stringify({
        currentProductCategories: [],
        wetWashFrequency: "daily_1x",
        towel: { material: "tshirt", technique: "gentle_press" },
      }),
      "{current_product_categories,wet_wash_frequency,towel_handling}",
      JSON.stringify({
        current_product_categories: "user",
        wet_wash_frequency: "user",
        towel_handling: "user",
      }),
    ],
  )
  const module = await completeStage2Module(pg, {
    userId: USER,
    planId: created.personalPlanId,
    draftId: DRAFT,
    module: "products",
    expectedRevision: 2,
    inputHash: "a".repeat(64),
  })
  assert.equal(module.outcome, "completed")
  return { planId: created.personalPlanId, initialA: created.needVersionId, initial }
}

type PlanState = {
  current_initial_need_version_id: string
  current_refined_need_version_id: string | null
  applied_facts_revision: number | null
  revision: number
}

async function planState(pg: PersonalPlanTestDb, planId: string): Promise<PlanState> {
  const { rows } = await pg.query<PlanState>(
    `SELECT current_initial_need_version_id, current_refined_need_version_id,
            applied_facts_revision, revision::int AS revision
       FROM public.personal_plans WHERE id = $1`,
    [planId],
  )
  return rows[0]!
}

test("profile edit through the door → lane → refined head on the new parent, facts written, cursor advanced; a second run is unchanged", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t, { stage1Sources: true })
  const { planId, initialA, initial } = await seedPlanWithProjectedDraft(pg)
  const client = pgliteSupabaseClient(pg)
  const sync = createProductionSyncPlanWithFacts(client)

  // Unedited facts reproduce the plan's own initial hash: nothing to do, nothing written.
  const before = await planState(pg, planId)
  assert.deepEqual(await sync({ userId: USER }), { status: "unchanged", personalPlanId: planId })
  assert.deepEqual(await planState(pg, planId), before)

  // Hand edit in the Haar-Check editor.
  const edit = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { thickness: "coarse" },
    provenance: {
      source: { kind: "profile_editor" },
      schemaVersion: 1,
      at: AT,
      editedAt: AT,
    },
  })
  assert.equal(edit.status, "ok")
  const editedRevision = edit.revision!

  const result = await syncPlanWithFacts(createProductionFactsRecomputeDeps(client), {
    userId: USER,
  })
  assert.equal(result.status, "rebased")
  if (result.status !== "rebased") return
  assert.equal(result.personalPlanId, planId)
  assert.equal(result.activeRoutineVersionId, null)
  assert.notEqual(result.initialNeedVersionId, initialA)
  assert.ok(result.refinedVersionId)

  const after = await planState(pg, planId)
  assert.equal(after.current_initial_need_version_id, result.initialNeedVersionId)
  assert.equal(after.current_refined_need_version_id, result.refinedVersionId)

  // The new initial keeps the lead identity and carries the edited source.
  const { rows: initials } = await pg.query<{
    stage1_source_kind: string
    stage1_source_lead_id: string
    input_hash: string
  }>(
    `SELECT stage1_source_kind, stage1_source_lead_id, input_hash
       FROM public.personal_plan_need_versions WHERE id = $1`,
    [result.initialNeedVersionId],
  )
  assert.equal(initials[0]!.stage1_source_kind, "legacy_quiz_lead")
  assert.equal(initials[0]!.stage1_source_lead_id, LEAD)
  assert.notEqual(initials[0]!.input_hash, initial.inputHash)

  // The refined head hangs off the new initial, and its hash is the one recomputed with that
  // parent id.
  const { rows: refined } = await pg.query<{
    parent_need_version_id: string
    input_hash: string
    schema_version: number
    computation_version: string
    input_snapshot: JsonValue
  }>(
    `SELECT parent_need_version_id, input_hash, schema_version, computation_version, input_snapshot
       FROM public.personal_plan_need_versions WHERE id = $1`,
    [result.refinedVersionId],
  )
  const head = refined[0]!
  assert.equal(head.parent_need_version_id, result.initialNeedVersionId)
  assert.equal(
    head.input_hash,
    hashPersonalPlanNeedVersionInput({
      schemaVersion: head.schema_version,
      computationVersion: head.computation_version,
      inputSnapshot: head.input_snapshot,
      parentNeedVersionId: result.initialNeedVersionId,
    }),
  )

  // Care habits published from the draft, incl. the unpublished towel answer (R16), and the
  // cursor names the facts revision that write produced.
  const profile = await readHairProfile(pg, USER)
  assert.ok(profile)
  assert.deepEqual(profile.care_habits?.towel, { material: "tshirt", technique: "gentle_press" })
  assert.equal(profile.care_habits?.wetWashFrequency, "daily_1x")
  assert.equal(profile.facts_revision, editedRevision + 1)
  assert.equal(after.applied_facts_revision, profile.facts_revision)

  // The clone sits on the new base; the source draft was staled.
  const { rows: drafts } = await pg.query<{ id: string; status: string; origin: string | null }>(
    `SELECT id, status, origin FROM public.personal_plan_refinement_drafts
      WHERE base_initial_need_version_id = $1`,
    [result.initialNeedVersionId],
  )
  assert.equal(drafts.length, 1)
  assert.equal(drafts[0]!.status, "in_progress")
  assert.equal(drafts[0]!.origin, "facts_rebase")

  // Second run: the facts now produce the plan's current initial version.
  assert.deepEqual(await sync({ userId: USER }), { status: "unchanged", personalPlanId: planId })
  assert.deepEqual(await planState(pg, planId), after)
})
