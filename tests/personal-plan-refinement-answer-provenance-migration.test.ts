import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

import { buildDirectAcceptanceStage2Defaults } from "@/lib/personal-plan/direct-acceptance/defaults"
import type { Stage2TriggerContext } from "@/lib/personal-plan/refinement/types"

/**
 * The answer-provenance migration executed against a real Postgres.
 *
 * The synthetic answer sets are built by the production
 * `buildDirectAcceptanceStage2Defaults()`, not hand-copied JSON, so the
 * migration's backfill heuristic cannot silently drift away from the values
 * direct acceptance actually writes.
 */

const MIGRATION =
  "supabase/migrations/20260825120000_personal_plan_refinement_answer_provenance.sql"

const SCHEMA = `
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE ROLE service_role;
  CREATE TABLE public.personal_plans (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    unrefined_direct_accept boolean NOT NULL DEFAULT false
  );
  CREATE TABLE public.personal_plan_refinement_drafts (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    personal_plan_id uuid NOT NULL,
    answers jsonb NOT NULL DEFAULT '{}'::jsonb,
    completed_question_ids text[] NOT NULL DEFAULT '{}',
    revision bigint NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'in_progress',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
`

const PLAIN_CONTEXT: Stage2TriggerContext = {
  relevantCategories: [],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible",
}
const CONDITIONAL_CONTEXT: Stage2TriggerContext = {
  relevantCategories: [],
  hasReportedIrritatedScalp: true,
  dryShampooBridgeEligibility: "eligible",
}

/** Distinct, deterministic uuids — `id(3, 7)` reads as 33333333-…-777777777777. */
function id(prefix: number, suffix: number): string {
  const p = String(prefix).repeat(1)
  const s = String(suffix).repeat(1)
  return `${p.repeat(8)}-${p.repeat(4)}-4${p.repeat(3)}-8${s.repeat(3)}-${s.repeat(12)}`
}

async function migratedDatabase(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(async () => {
    await pg.close()
  })
  await pg.exec(SCHEMA)
  return pg
}

async function insertPlan(
  pg: PGlite,
  input: { planId: string; userId: string; unrefinedDirectAccept: boolean },
) {
  await pg.query(
    "INSERT INTO public.personal_plans (id, user_id, unrefined_direct_accept) VALUES ($1, $2, $3)",
    [input.planId, input.userId, input.unrefinedDirectAccept],
  )
}

async function insertDraft(
  pg: PGlite,
  input: {
    draftId: string
    planId: string
    userId: string
    answers: unknown
    completedQuestionIds: readonly string[]
    status?: string
  },
) {
  await pg.query(
    `INSERT INTO public.personal_plan_refinement_drafts
       (id, user_id, personal_plan_id, answers, completed_question_ids, status)
     VALUES ($1, $2, $3, $4::jsonb, $5::text[], $6)`,
    [
      input.draftId,
      input.userId,
      input.planId,
      JSON.stringify(input.answers),
      `{${input.completedQuestionIds.join(",")}}`,
      input.status ?? "complete",
    ],
  )
}

async function provenanceOf(pg: PGlite, draftId: string): Promise<Record<string, string>> {
  const { rows } = await pg.query<{ answer_provenance: Record<string, string> }>(
    "SELECT answer_provenance FROM public.personal_plan_refinement_drafts WHERE id = $1",
    [draftId],
  )
  return rows[0]!.answer_provenance
}

function allAssumed(questionIds: readonly string[]): Record<string, string> {
  return Object.fromEntries(questionIds.map((questionId) => [questionId, "assumed"]))
}

function allUser(questionIds: readonly string[]): Record<string, string> {
  return Object.fromEntries(questionIds.map((questionId) => [questionId, "user"]))
}

test("the provenance backfill labels a synthetic draft on a CLEARED-flag plan 'assumed'", async (t) => {
  const pg = await migratedDatabase(t)
  const synthetic = buildDirectAcceptanceStage2Defaults(CONDITIONAL_CONTEXT)
  // The exact regression: an old unconditional proposal-accept already cleared
  // `unrefined_direct_accept`, so the plan flag alone reads this fully
  // synthetic draft as real refinement progress ("4 von 4").
  await insertPlan(pg, { planId: id(1, 1), userId: id(9, 9), unrefinedDirectAccept: false })
  await insertDraft(pg, {
    draftId: id(2, 2),
    planId: id(1, 1),
    userId: id(9, 9),
    answers: synthetic.answers,
    completedQuestionIds: synthetic.completedQuestionIds,
  })

  await pg.exec(await readFile(MIGRATION, "utf8"))

  assert.ok(synthetic.completedQuestionIds.includes("scalp_irritation_detail"))
  assert.ok(synthetic.completedQuestionIds.includes("dry_shampoo_bridge_preference"))
  assert.deepEqual(await provenanceOf(pg, id(2, 2)), allAssumed(synthetic.completedQuestionIds))
})

test("the provenance backfill still labels a synthetic draft on a flagged plan 'assumed'", async (t) => {
  const pg = await migratedDatabase(t)
  const synthetic = buildDirectAcceptanceStage2Defaults(PLAIN_CONTEXT)
  await insertPlan(pg, { planId: id(1, 1), userId: id(9, 9), unrefinedDirectAccept: true })
  await insertDraft(pg, {
    draftId: id(2, 2),
    planId: id(1, 1),
    userId: id(9, 9),
    answers: synthetic.answers,
    completedQuestionIds: synthetic.completedQuestionIds,
  })

  await pg.exec(await readFile(MIGRATION, "utf8"))

  assert.deepEqual(await provenanceOf(pg, id(2, 2)), allAssumed(synthetic.completedQuestionIds))
})

test("the provenance backfill leaves a plan without direct-acceptance evidence entirely 'user'", async (t) => {
  const pg = await migratedDatabase(t)
  const completedQuestionIds = [
    "current_product_categories",
    "wet_wash_frequency",
    "towel_handling",
    "drying_routes",
    "additional_heat_tools",
    "night_protection",
    "heat:ordinary_blow_dry",
  ]
  await insertPlan(pg, { planId: id(1, 1), userId: id(9, 9), unrefinedDirectAccept: false })
  await insertDraft(pg, {
    draftId: id(2, 2),
    planId: id(1, 1),
    userId: id(9, 9),
    answers: {
      currentProductCategories: ["shampoo", "conditioner"],
      wetWashFrequency: "daily",
      towel: { material: "baumwolle", technique: "rough_rubbing" },
      dryingRoutes: ["ordinary_blow_dry"],
      additionalHeatTools: [],
      nightProtection: ["silk_pillowcase"],
      heatEvents: { "heat:ordinary_blow_dry": { frequency: "weekly_3x" } },
    },
    completedQuestionIds,
  })

  await pg.exec(await readFile(MIGRATION, "utf8"))

  assert.deepEqual(await provenanceOf(pg, id(2, 2)), allUser(completedQuestionIds))
})

test("the provenance backfill splits a reopened, partially refined draft per answer", async (t) => {
  const pg = await migratedDatabase(t)
  const synthetic = buildDirectAcceptanceStage2Defaults(PLAIN_CONTEXT)
  await insertPlan(pg, { planId: id(1, 1), userId: id(9, 9), unrefinedDirectAccept: false })
  // The completed synthetic draft `reopen()` left behind — the durable trace of
  // direct acceptance that survives the flag clear.
  await insertDraft(pg, {
    draftId: id(2, 2),
    planId: id(1, 1),
    userId: id(9, 9),
    answers: synthetic.answers,
    completedQuestionIds: synthetic.completedQuestionIds,
  })
  // The successor draft: `reopen()` copied the synthetic answers forward and the
  // user has since re-answered two of them (plus the heat event that opened).
  await insertDraft(pg, {
    draftId: id(3, 3),
    planId: id(1, 1),
    userId: id(9, 9),
    status: "in_progress",
    answers: {
      ...synthetic.answers,
      wetWashFrequency: "daily",
      dryingRoutes: ["ordinary_blow_dry"],
      heatEvents: { "heat:ordinary_blow_dry": { frequency: "weekly_3x" } },
    },
    completedQuestionIds: [...synthetic.completedQuestionIds, "heat:ordinary_blow_dry"],
  })

  await pg.exec(await readFile(MIGRATION, "utf8"))

  assert.deepEqual(await provenanceOf(pg, id(3, 3)), {
    ...allAssumed(synthetic.completedQuestionIds),
    wet_wash_frequency: "user",
    drying_routes: "user",
    "heat:ordinary_blow_dry": "user",
  })
})

test("the provenance backfill keeps an assumed-valued heat event 'assumed' inside the cohort", async (t) => {
  const pg = await migratedDatabase(t)
  const synthetic = buildDirectAcceptanceStage2Defaults(PLAIN_CONTEXT)
  await insertPlan(pg, { planId: id(1, 1), userId: id(9, 9), unrefinedDirectAccept: true })
  await insertDraft(pg, {
    draftId: id(2, 2),
    planId: id(1, 1),
    userId: id(9, 9),
    status: "in_progress",
    answers: {
      ...synthetic.answers,
      additionalHeatTools: ["straightener"],
      heatEvents: {
        "heat:straightener": { frequency: "less_than_monthly", protectionConsistency: "unsure" },
      },
    },
    completedQuestionIds: [...synthetic.completedQuestionIds, "heat:straightener"],
  })

  await pg.exec(await readFile(MIGRATION, "utf8"))

  assert.deepEqual(await provenanceOf(pg, id(2, 2)), {
    ...allAssumed(synthetic.completedQuestionIds),
    additional_heat_tools: "user",
    "heat:straightener": "assumed",
  })
})

test("the provenance backfill errs to 'assumed' for a draft indistinguishable from the defaults", async (t) => {
  const pg = await migratedDatabase(t)
  const synthetic = buildDirectAcceptanceStage2Defaults(PLAIN_CONTEXT)
  // Ruled error direction: a user who freely answered every question with
  // exactly the assumed value is indistinguishable from a synthetic draft. One
  // unnecessary banner (false-incomplete) beats a synthetic user who never gets
  // the refinement entry point at all (false-complete).
  await insertPlan(pg, { planId: id(1, 1), userId: id(9, 9), unrefinedDirectAccept: false })
  await insertDraft(pg, {
    draftId: id(2, 2),
    planId: id(1, 1),
    userId: id(9, 9),
    answers: synthetic.answers,
    completedQuestionIds: synthetic.completedQuestionIds,
  })

  await pg.exec(await readFile(MIGRATION, "utf8"))

  assert.deepEqual(await provenanceOf(pg, id(2, 2)), allAssumed(synthetic.completedQuestionIds))
})

test("the provenance backfill writes an empty map for a draft with no completed answers", async (t) => {
  const pg = await migratedDatabase(t)
  await insertPlan(pg, { planId: id(1, 1), userId: id(9, 9), unrefinedDirectAccept: true })
  await insertDraft(pg, {
    draftId: id(2, 2),
    planId: id(1, 1),
    userId: id(9, 9),
    status: "in_progress",
    answers: {},
    completedQuestionIds: [],
  })

  await pg.exec(await readFile(MIGRATION, "utf8"))

  assert.deepEqual(await provenanceOf(pg, id(2, 2)), {})
})

test("the save RPC keeps a 5-argument compatibility overload for the migrate-then-deploy window", async (t) => {
  const pg = await migratedDatabase(t)
  await insertPlan(pg, { planId: id(1, 1), userId: id(9, 9), unrefinedDirectAccept: false })
  await insertDraft(pg, {
    draftId: id(2, 2),
    planId: id(1, 1),
    userId: id(9, 9),
    status: "in_progress",
    answers: {},
    completedQuestionIds: [],
  })

  await pg.exec(await readFile(MIGRATION, "utf8"))

  const { rows: signatures } = await pg.query<{ arity: number }>(
    `SELECT pg_catalog.array_length(proargtypes, 1) AS arity
       FROM pg_catalog.pg_proc
      WHERE proname = 'personal_plan_save_refinement_draft'
      ORDER BY 1`,
  )
  assert.deepEqual(
    signatures.map((row) => row.arity),
    [5, 6],
  )

  // The still-live previous build calls the 5-argument signature.
  const { rows: legacy } = await pg.query<{ result: { outcome: string; revision: number } }>(
    `SELECT public.personal_plan_save_refinement_draft(
       $1::uuid, $2::uuid, 0::bigint, $3::jsonb, $4::text[]
     ) AS result`,
    [id(9, 9), id(2, 2), JSON.stringify({ wetWashFrequency: "daily" }), "{wet_wash_frequency}"],
  )
  assert.equal(legacy[0]!.result.outcome, "saved")
  assert.equal(legacy[0]!.result.revision, 1)
  // An empty provenance map is exactly the legacy read semantics: a completed id
  // with no entry is treated as 'user' by userAnsweredQuestionIds().
  assert.deepEqual(await provenanceOf(pg, id(2, 2)), {})

  // The 6-argument path is untouched and still writes provenance.
  const { rows: current } = await pg.query<{ result: { outcome: string; revision: number } }>(
    `SELECT public.personal_plan_save_refinement_draft(
       $1::uuid, $2::uuid, 1::bigint, $3::jsonb, $4::text[], $5::jsonb
     ) AS result`,
    [
      id(9, 9),
      id(2, 2),
      JSON.stringify({ wetWashFrequency: "daily" }),
      "{wet_wash_frequency}",
      JSON.stringify({ wet_wash_frequency: "user" }),
    ],
  )
  assert.equal(current[0]!.result.outcome, "saved")
  assert.equal(current[0]!.result.revision, 2)
  assert.deepEqual(await provenanceOf(pg, id(2, 2)), { wet_wash_frequency: "user" })
})

test("the 6-argument save RPC still rejects a non-object provenance payload", async (t) => {
  const pg = await migratedDatabase(t)
  await insertPlan(pg, { planId: id(1, 1), userId: id(9, 9), unrefinedDirectAccept: false })
  await insertDraft(pg, {
    draftId: id(2, 2),
    planId: id(1, 1),
    userId: id(9, 9),
    status: "in_progress",
    answers: {},
    completedQuestionIds: [],
  })

  await pg.exec(await readFile(MIGRATION, "utf8"))

  const { rows } = await pg.query<{ result: { outcome: string; reasonCode: string } }>(
    `SELECT public.personal_plan_save_refinement_draft(
       $1::uuid, $2::uuid, 0::bigint, '{}'::jsonb, '{}'::text[], '[]'::jsonb
     ) AS result`,
    [id(9, 9), id(2, 2)],
  )
  assert.equal(rows[0]!.result.outcome, "invalid_source")
  assert.equal(rows[0]!.result.reasonCode, "invalid_answer_provenance")
})
