import assert from "node:assert/strict"
import test from "node:test"

import {
  createInitialNeed,
  id,
  insertOpenRefinementDraft,
  insertProfile,
  migratedPersonalPlanDatabase,
  type PersonalPlanTestDb,
} from "./personal-plan-pglite-migration.fixtures"

/**
 * Direct-acceptance draft ownership (migration 20261006180100) on the REAL migration chain:
 * only `personal_plan_save_direct_acceptance_draft` marks a draft, and every interactive save —
 * through either `personal_plan_save_refinement_draft` overload — clears the mark again.
 */

const USER_ID = id(9, 9)
const DRAFT_ID = id(2, 2)

async function seeded(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = await migratedPersonalPlanDatabase(t)
  await insertProfile(pg, USER_ID)
  const initial = await createInitialNeed(pg, { userId: USER_ID, inputHash: "a".repeat(64) })
  await insertOpenRefinementDraft(pg, {
    draftId: DRAFT_ID,
    userId: USER_ID,
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial.needVersionId,
  })
  return pg
}

async function save(
  pg: PersonalPlanTestDb,
  rpc: "personal_plan_save_refinement_draft" | "personal_plan_save_direct_acceptance_draft",
  expectedRevision: number,
  answers: Record<string, unknown>,
) {
  const { rows } = await pg.query<{ result: { outcome: string; revision?: number } }>(
    `SELECT public.${rpc}($1::uuid, $2::uuid, $3::bigint, $4::jsonb, $5::text[], $6::jsonb) AS result`,
    [
      USER_ID,
      DRAFT_ID,
      expectedRevision,
      JSON.stringify(answers),
      ["wet_wash_frequency"],
      JSON.stringify({ wet_wash_frequency: "assumed" }),
    ],
  )
  return rows[0]!.result
}

async function owned(pg: PersonalPlanTestDb): Promise<boolean | null> {
  const { rows } = await pg.query<{ direct_acceptance_owned: boolean | null }>(
    `SELECT direct_acceptance_owned FROM public.personal_plan_refinement_drafts WHERE id = $1`,
    [DRAFT_ID],
  )
  return rows[0]!.direct_acceptance_owned
}

test("a new draft is not owned by direct acceptance", async (t) => {
  const pg = await seeded(t)
  assert.equal(await owned(pg), false)
})

test("the direct-acceptance save marks the draft with the same CAS as an interactive save", async (t) => {
  const pg = await seeded(t)
  const result = await save(pg, "personal_plan_save_direct_acceptance_draft", 0, {
    wetWashFrequency: "weekly_2x",
  })
  assert.deepEqual(result, { outcome: "saved", revision: 1 })
  assert.equal(await owned(pg), true)

  const stale = await save(pg, "personal_plan_save_direct_acceptance_draft", 0, {})
  assert.deepEqual(stale, { outcome: "revision_conflict", currentRevision: 1 })
  assert.equal(await owned(pg), true)
})

test("an interactive save clears the mark", async (t) => {
  const pg = await seeded(t)
  await save(pg, "personal_plan_save_direct_acceptance_draft", 0, { wetWashFrequency: "weekly_2x" })

  await save(pg, "personal_plan_save_refinement_draft", 1, { wetWashFrequency: "weekly_1x" })

  assert.equal(await owned(pg), false)
})

test("the legacy 5-arg save overload clears the mark too", async (t) => {
  const pg = await seeded(t)
  await save(pg, "personal_plan_save_direct_acceptance_draft", 0, { wetWashFrequency: "weekly_2x" })

  await pg.query(
    `SELECT public.personal_plan_save_refinement_draft($1::uuid, $2::uuid, 1::bigint, $3::jsonb, $4::text[])`,
    [USER_ID, DRAFT_ID, JSON.stringify({ wetWashFrequency: "weekly_1x" }), ["wet_wash_frequency"]],
  )

  assert.equal(await owned(pg), false)
})

test("a rejected interactive save leaves the mark alone", async (t) => {
  const pg = await seeded(t)
  await save(pg, "personal_plan_save_direct_acceptance_draft", 0, { wetWashFrequency: "weekly_2x" })

  const stale = await save(pg, "personal_plan_save_refinement_draft", 0, {})

  assert.equal(stale.outcome, "revision_conflict")
  assert.equal(await owned(pg), true)
})

test("rows that predate the column stay NULL; rows created afterwards start false", async (t) => {
  const { readFile } = await import("node:fs/promises")
  const pg = await seeded(t)
  // Simulate the deploy: drop the column, then re-apply the migration over an existing row.
  await pg.exec(
    `ALTER TABLE public.personal_plan_refinement_drafts DROP COLUMN direct_acceptance_owned`,
  )
  await pg.exec(
    await readFile(
      "supabase/migrations/20261006180100_personal_plan_direct_acceptance_draft_owner.sql",
      "utf8",
    ),
  )
  assert.equal(await owned(pg), null)

  const { rows } = await pg.query<{ column_default: string | null }>(
    `SELECT column_default FROM information_schema.columns
      WHERE table_name = 'personal_plan_refinement_drafts' AND column_name = 'direct_acceptance_owned'`,
  )
  assert.equal(rows[0]!.column_default, "false")
})
