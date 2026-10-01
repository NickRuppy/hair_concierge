import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { writeAccountLinkFacts } from "../src/lib/user-facts/account-link"
import { planUserFactsBackfill } from "../src/lib/user-facts/backfill/plan-row"
import { deriveCareHabitsColumns } from "../src/lib/user-facts/derive-legacy-columns"
import { toCareHabitsPatch, toFieldProvenance } from "../src/lib/user-facts/from-refinement-draft"
import { parseUserFactsRow } from "../src/lib/user-facts/read"
import { saveUserFacts as saveUserFactsRpc } from "../src/lib/user-facts/save"
import { CARE_HABITS_SCHEMA_VERSION } from "../src/lib/user-facts/schema"
import {
  mobileFactsDatabase,
  pgliteAdminClient,
  pgliteRpcClient,
  readRow,
} from "./mobile-profile-facts-pglite.fixtures"
import {
  applyUserFactsLock,
  createInitialNeed,
  id,
  insertOpenRefinementDraft,
  insertProfile,
  migratedPersonalPlanDatabase,
  saveUserFacts,
  type PersonalPlanTestDb,
} from "./personal-plan-pglite-migration.fixtures"

/**
 * Clean-switch task 9: the lock on `hair_profiles` (migration 20260930120000_user_facts_lock.sql)
 * on the real schema in PGlite. Every fact column (the three documents, `facts_provenance`,
 * `facts_revision` and the 21 derived legacy columns) can change only inside
 * `user_facts_save_v1`; every other column stays writable; browser roles lose INSERT/UPDATE.
 *
 * The other writers are proven under the lock by their own suites, whose harnesses now apply the
 * lock last (profile-answers, onboarding-care, mobile edit/registration). This file proves the
 * guard itself plus the writers that have no suite of their own on PGlite (account link without
 * the mobile chain, the Feinschliff lane's write, the backfill's write path).
 */

const OWNER = id(1, 1)
const OTHER = id(2, 2)

const GUARD_TRIGGER = "zz_hair_profiles_fact_write_guard"

/** Every column of `hair_profiles` that is NOT a fact: identity, free text nobody derives, chat
 * memory, timestamps. Mirrors the migration header; the migration refuses to apply otherwise. */
const NON_FACT_COLUMNS = [
  "additional_notes",
  "conversation_memory",
  "created_at",
  "id",
  "products_used",
  "routine_preference",
  "updated_at",
  "user_id",
]

const DIAGNOSTICS_PROVENANCE = {
  source: { kind: "legacy_quiz", id: "lock" },
  schemaVersion: 1,
  at: "2026-09-30T00:00:00.000Z",
}

type GuardError = { message: string; code?: string; detail?: string }

async function rejectsOutsideDoor(action: Promise<unknown>, columns: string[]) {
  await assert.rejects(action, (error: GuardError) => {
    assert.equal(error.message, "hair_profiles_fact_write_outside_door")
    assert.equal(error.code, "42501")
    assert.equal(error.detail, `columns: ${columns.join(", ")}`)
    return true
  })
}

/** A locked database with one door-written profile (diagnostics facts + derived columns). */
async function lockedWithFacts(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = await migratedPersonalPlanDatabase(t)
  await insertProfile(pg, OWNER)
  await insertProfile(pg, OTHER)
  const saved = await saveUserFacts(pg, {
    userId: OWNER,
    domain: "diagnostics",
    patch: {
      texture: "wavy",
      thickness: "fine",
      currentConcerns: ["dry_lengths", "frizz_flyaways"],
      primaryConcern: "dry_lengths",
      goals: ["moisture"],
    },
    provenance: DIAGNOSTICS_PROVENANCE,
  })
  assert.equal(saved.status, "ok")
  return pg
}

async function doorWrite(pg: PersonalPlanTestDb, texture: string) {
  return pg.query(
    `SELECT public.user_facts_save_v1($1::uuid, 'diagnostics', $2::jsonb, $3::jsonb)`,
    [OWNER, JSON.stringify({ texture }), JSON.stringify(DIAGNOSTICS_PROVENANCE)],
  )
}

async function writerFlag(pg: PersonalPlanTestDb): Promise<string | null> {
  const { rows } = await pg.query<{ flag: string | null }>(
    "SELECT pg_catalog.current_setting('app.user_facts_writer', true) AS flag",
  )
  return rows[0]!.flag
}

// ---------------------------------------------------------------------------
// Structure: firing order, classification
// ---------------------------------------------------------------------------

test("the guard is the LAST before-row trigger on hair_profiles (same-kind triggers fire in name order)", async (t) => {
  const pg = await mobileFactsDatabase(t)
  const { rows } = await pg.query<{ tgname: string; before: boolean }>(
    `SELECT tgname, (tgtype & 2) <> 0 AS before
       FROM pg_catalog.pg_trigger
      WHERE tgrelid = 'public.hair_profiles'::pg_catalog.regclass
        AND NOT tgisinternal AND (tgtype & 1) <> 0
      ORDER BY tgname`,
  )
  assert.deepEqual(
    rows.filter((row) => row.before).map((row) => row.tgname),
    ["hair_profiles_primary_concern_contained", "set_updated_at_hair_profiles", GUARD_TRIGGER],
  )
  assert.deepEqual(
    rows.filter((row) => !row.before).map((row) => row.tgname),
    ["scanner_context_source_changed"],
  )
})

test("every hair_profiles column is classified: each fact column is guarded, each other column is free", async (t) => {
  const pg = await lockedWithFacts(t)
  const { rows: columns } = await pg.query<{ name: string; type: string }>(
    `SELECT attname AS name, pg_catalog.format_type(atttypid, atttypmod) AS type
       FROM pg_catalog.pg_attribute
      WHERE attrelid = 'public.hair_profiles'::pg_catalog.regclass AND attnum > 0 AND NOT attisdropped
      ORDER BY attname`,
  )
  const { rows: defaults } = await pg.query<{ facts: Record<string, unknown> }>(
    "SELECT public.hair_profiles_fact_column_defaults_v1() AS facts",
  )
  const factColumns = Object.keys(defaults[0]!.facts).sort()
  assert.equal(factColumns.length, 26, "3 documents + provenance + revision + 21 derived columns")
  assert.deepEqual(
    [...factColumns, ...NON_FACT_COLUMNS].sort(),
    columns.map((column) => column.name),
    "fact + non-fact = the table, no overlap, nothing unclassified",
  )

  const changed: Record<string, string> = {
    text: "'lock-test'",
    "text[]": "ARRAY['lock-test']",
    boolean: "NOT %I",
    jsonb: `'{"lockTest":true}'::jsonb`,
    integer: "%I + 1",
    uuid: "extensions.uuid_generate_v4()",
    "timestamp with time zone": "pg_catalog.now() - interval '1 day'",
  }
  const typeOf = new Map(columns.map((column) => [column.name, column.type]))
  const setClause = (column: string) =>
    `${column} = ${changed[typeOf.get(column)!]!.replace("%I", column)}`

  for (const column of factColumns) {
    // `concerns` without the stored main problem also makes the primary_concern trigger drop it.
    const expected = column === "concerns" ? ["concerns", "primary_concern"] : [column]
    await rejectsOutsideDoor(
      pg.query(`UPDATE public.hair_profiles SET ${setClause(column)} WHERE user_id = $1`, [OWNER]),
      expected,
    )
  }
  for (const column of NON_FACT_COLUMNS.filter((name) => name !== "user_id")) {
    const value = column === "routine_preference" ? "'minimal'" : undefined
    await pg.query(
      `UPDATE public.hair_profiles SET ${value ? `${column} = ${value}` : setClause(column)} WHERE user_id = $1`,
      [OWNER],
    )
  }
})

test("the migration refuses to apply over a column it does not classify, or a fact default it does not expect", async (t) => {
  const unclassified = await migratedPersonalPlanDatabase(t, { lock: false })
  await unclassified.exec("ALTER TABLE public.hair_profiles ADD COLUMN shampoo_frequency text")
  await assert.rejects(applyUserFactsLock(unclassified), /hair_profiles_unclassified_column/)

  const drifted = await migratedPersonalPlanDatabase(t, { lock: false })
  await drifted.exec("ALTER TABLE public.hair_profiles ALTER COLUMN styling_tools SET DEFAULT '{}'")
  await assert.rejects(applyUserFactsLock(drifted), /hair_profiles_fact_default_mismatch/)
})

// ---------------------------------------------------------------------------
// Rejections
// ---------------------------------------------------------------------------

test("rejected: a direct update of a derived column, of a document, of facts_revision, of user_id", async (t) => {
  const pg = await lockedWithFacts(t)
  const before = await readRow(pg, OWNER)
  await rejectsOutsideDoor(
    pg.query("UPDATE public.hair_profiles SET thickness = 'coarse' WHERE user_id = $1", [OWNER]),
    ["thickness"],
  )
  await rejectsOutsideDoor(
    pg.query(
      `UPDATE public.hair_profiles SET care_habits = '{"dryingRoutes":["air_dry"]}' WHERE user_id = $1`,
      [OWNER],
    ),
    ["care_habits"],
  )
  await rejectsOutsideDoor(
    pg.query("UPDATE public.hair_profiles SET facts_revision = 0 WHERE user_id = $1", [OWNER]),
    ["facts_revision"],
  )
  await rejectsOutsideDoor(
    pg.query("UPDATE public.hair_profiles SET user_id = $2 WHERE user_id = $1", [OWNER, OTHER]),
    ["user_id"],
  )
  assert.deepEqual(await readRow(pg, OWNER), before)
})

test("rejected: an insert carrying a fact value, also as an upsert", async (t) => {
  const pg = await lockedWithFacts(t)
  await rejectsOutsideDoor(
    pg.query("INSERT INTO public.hair_profiles (user_id, thickness) VALUES ($1, 'fine')", [OTHER]),
    ["thickness"],
  )
  await rejectsOutsideDoor(
    pg.query(
      "INSERT INTO public.hair_profiles (user_id, facts_revision, goals) VALUES ($1, 1, ARRAY[]::text[])",
      [OTHER],
    ),
    ["facts_revision"],
  )
  // `src/lib/dev/local-login.ts`-style upsert: the proposed row is checked before the conflict.
  await rejectsOutsideDoor(
    pg.query(
      `INSERT INTO public.hair_profiles (user_id, hair_texture) VALUES ($1, 'straight')
       ON CONFLICT (user_id) DO UPDATE SET hair_texture = excluded.hair_texture`,
      [OWNER],
    ),
    ["hair_texture"],
  )
  assert.equal(await readRow(pg, OTHER), null)
})

test("allowed: setting a fact column to the value it already has is a no-op, not a write", async (t) => {
  const pg = await lockedWithFacts(t)
  const before = (await readRow(pg, OWNER))!
  await pg.query(
    `UPDATE public.hair_profiles
        SET thickness = thickness, diagnostics = diagnostics, concerns = concerns,
            primary_concern = primary_concern, facts_revision = facts_revision
      WHERE user_id = $1`,
    [OWNER],
  )
  const after = (await readRow(pg, OWNER))!
  assert.deepEqual({ ...after, updated_at: null }, { ...before, updated_at: null })
})

test("trigger order: the guard sees the primary_concern trigger's rewrite, so that trigger is no bypass", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t, { lock: false })
  await insertProfile(pg, OWNER)
  // A row whose stored main problem is no longer one of its concerns (only constructible with
  // the containment trigger off; seeded before the lock, as production rows are).
  await pg.exec(
    "ALTER TABLE public.hair_profiles DISABLE TRIGGER hair_profiles_primary_concern_contained",
  )
  await pg.query(
    "INSERT INTO public.hair_profiles (user_id, concerns, primary_concern) VALUES ($1, ARRAY['dryness'], 'frizz')",
    [OWNER],
  )
  await pg.exec(
    "ALTER TABLE public.hair_profiles ENABLE TRIGGER hair_profiles_primary_concern_contained",
  )
  await applyUserFactsLock(pg)

  // Assigning `concerns` its own value fires the containment trigger, which drops the stale pick.
  // The guard fires after it and sees primary_concern change: rejected, nothing written.
  await rejectsOutsideDoor(
    pg.query("UPDATE public.hair_profiles SET concerns = concerns WHERE user_id = $1", [OWNER]),
    ["primary_concern"],
  )
  // A non-fact write does not fire the containment trigger at all.
  await pg.query("UPDATE public.hair_profiles SET conversation_memory = 'x' WHERE user_id = $1", [
    OWNER,
  ])
  assert.equal((await readRow(pg, OWNER))!.primary_concern, "frizz")
})

test("the door's flag does not outlive its write: a later fact write in the same transaction is rejected", async (t) => {
  const pg = await lockedWithFacts(t)
  await pg.exec("BEGIN")
  await doorWrite(pg, "curly")
  assert.equal(await writerFlag(pg), "")
  await rejectsOutsideDoor(
    pg.query("UPDATE public.hair_profiles SET thickness = 'coarse' WHERE user_id = $1", [OWNER]),
    ["thickness"],
  )
  await pg.exec("ROLLBACK")
})

test("the door's flag does not survive a door that raised and was caught (savepoint, plpgsql handler)", async (t) => {
  const pg = await lockedWithFacts(t)
  // 'zigzag' violates the hair_texture CHECK inside the door's own UPDATE — after the flag is set.
  await pg.exec("BEGIN")
  await pg.exec("SAVEPOINT door")
  await assert.rejects(doorWrite(pg, "zigzag"), /hair_profiles_hair_texture_check/)
  await pg.exec("ROLLBACK TO SAVEPOINT door")
  assert.ok(!(await writerFlag(pg)), "flag reverted with the savepoint")
  await rejectsOutsideDoor(
    pg.query("UPDATE public.hair_profiles SET thickness = 'coarse' WHERE user_id = $1", [OWNER]),
    ["thickness"],
  )
  await pg.exec("ROLLBACK")

  await rejectsOutsideDoor(
    pg.query(
      `DO $$
       BEGIN
         BEGIN
           PERFORM public.user_facts_save_v1(
             '${OWNER}'::uuid, 'diagnostics', '{"texture":"zigzag"}'::jsonb, '{}'::jsonb);
         EXCEPTION WHEN check_violation THEN NULL;
         END;
         UPDATE public.hair_profiles SET thickness = 'coarse' WHERE user_id = '${OWNER}';
       END $$`,
    ),
    ["thickness"],
  )
  assert.equal((await readRow(pg, OWNER))!.thickness, "fine")
})

test("a caller that sets the flag itself: owner and service_role pass (documented hole), browser roles have no privilege", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t, { lock: false })
  // Supabase's default privileges on public tables, which the lock migration then narrows.
  await pg.exec("GRANT ALL ON public.hair_profiles TO anon, authenticated, service_role")
  await applyUserFactsLock(pg)
  await insertProfile(pg, OWNER)
  await insertProfile(pg, OTHER)
  await saveUserFacts(pg, {
    userId: OWNER,
    domain: "diagnostics",
    patch: { texture: "wavy", thickness: "fine" },
    provenance: DIAGNOSTICS_PROVENANCE,
  })

  const privilege = async (role: string, kind: string) =>
    (
      await pg.query<{ ok: boolean }>(
        "SELECT pg_catalog.has_table_privilege($1, 'public.hair_profiles', $2) AS ok",
        [role, kind],
      )
    ).rows[0]!.ok
  for (const role of ["anon", "authenticated"]) {
    assert.equal(await privilege(role, "INSERT"), false, `${role} INSERT`)
    assert.equal(await privilege(role, "UPDATE"), false, `${role} UPDATE`)
    assert.equal(await privilege(role, "SELECT"), true, `${role} SELECT stays (RLS decides)`)
    // Fix round 4: no application use, so the browser roles lose these too.
    for (const kind of ["TRUNCATE", "TRIGGER", "REFERENCES"]) {
      assert.equal(await privilege(role, kind), false, `${role} ${kind}`)
    }
    assert.equal(await privilege(role, "DELETE"), true, `${role} DELETE stays (RLS decides)`)
  }
  assert.equal(await privilege("service_role", "UPDATE"), true)

  const asRole = async (role: string, sql: string, flag: string | null) => {
    await pg.exec("BEGIN")
    try {
      await pg.exec(`SET LOCAL ROLE ${role}`)
      if (flag)
        await pg.query("SELECT pg_catalog.set_config('app.user_facts_writer', $1, true)", [flag])
      await pg.query(sql, [OWNER])
      await pg.exec("COMMIT")
    } catch (error) {
      await pg.exec("ROLLBACK")
      throw error
    }
  }
  const update = "UPDATE public.hair_profiles SET thickness = 'coarse' WHERE user_id = $1"

  for (const role of ["anon", "authenticated"]) {
    await assert.rejects(asRole(role, update, OWNER), /permission denied for table hair_profiles/)
    await assert.rejects(
      asRole(role, "INSERT INTO public.hair_profiles (user_id) VALUES ($1)", OWNER),
      /permission denied for table hair_profiles/,
    )
    await assert.rejects(
      asRole(
        role,
        "UPDATE public.hair_profiles SET conversation_memory = 'x' WHERE user_id = $1",
        null,
      ),
      /permission denied for table hair_profiles/,
    )
  }

  // service_role: the guard alone stops it without the flag; a flag for ANOTHER user does not
  // authorize this row; its own forged flag passes (residual hole, direct SQL only — PostgREST
  // cannot run set_config and runs each request in its own transaction).
  await rejectsOutsideDoor(asRole("service_role", update, null), ["thickness"])
  await rejectsOutsideDoor(asRole("service_role", update, OTHER), ["thickness"])
  await asRole(
    "service_role",
    "UPDATE public.hair_profiles SET conversation_memory = 'm' WHERE user_id = $1",
    null,
  )
  await asRole("service_role", update, OWNER)
  assert.equal((await readRow(pg, OWNER))!.thickness, "coarse")

  // The table owner (here: the superuser test session) can forge it too — and could equally
  // disable the trigger. Documented, not closable at this layer.
  await pg.exec("BEGIN")
  await pg.query("SELECT pg_catalog.set_config('app.user_facts_writer', $1, true)", [OWNER])
  await pg.query("UPDATE public.hair_profiles SET thickness = 'normal' WHERE user_id = $1", [OWNER])
  await pg.exec("COMMIT")
  assert.equal((await readRow(pg, OWNER))!.thickness, "normal")
})

// ---------------------------------------------------------------------------
// Allowed
// ---------------------------------------------------------------------------

test("allowed: conversation_memory, an updated_at touch, a bare insert, deleting the row, the account cascade", async (t) => {
  const pg = await lockedWithFacts(t)
  await pg.query(
    "UPDATE public.hair_profiles SET conversation_memory = 'mag Locken' WHERE user_id = $1",
    [OWNER],
  )
  await pg.query(
    "UPDATE public.hair_profiles SET updated_at = pg_catalog.now() WHERE user_id = $1",
    [OWNER],
  )
  assert.equal((await readRow(pg, OWNER))!.conversation_memory, "mag Locken")

  await pg.query("INSERT INTO public.hair_profiles (user_id) VALUES ($1)", [OTHER])
  const bare = (await readRow(pg, OTHER))!
  assert.equal(bare.facts_revision, 0)
  assert.deepEqual(bare.concerns, [])

  await pg.query("DELETE FROM public.hair_profiles WHERE user_id = $1", [OTHER])
  assert.equal(await readRow(pg, OTHER), null)
  await pg.query("DELETE FROM public.profiles WHERE id = $1", [OWNER])
  assert.equal(await readRow(pg, OWNER), null)
})

// ---------------------------------------------------------------------------
// Fix round 4 (lock review): hardening
// ---------------------------------------------------------------------------

test("a role other than owner/service_role with table privileges writes non-fact columns; facts stay locked", async (t) => {
  const pg = await lockedWithFacts(t)
  // Any other role the table is granted to (the guard runs as the WRITER): before the fix the
  // guard called a function only owner/service_role could execute, so this failed with a
  // misleading "permission denied for function".
  await pg.exec(`
    CREATE ROLE lock_other_writer NOLOGIN BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO lock_other_writer;
    GRANT SELECT, INSERT, UPDATE ON public.hair_profiles TO lock_other_writer;
  `)
  const asOther = async (sql: string, params: unknown[]) => {
    await pg.exec("BEGIN")
    try {
      await pg.exec("SET LOCAL ROLE lock_other_writer")
      await pg.query(sql, params)
      await pg.exec("COMMIT")
    } catch (error) {
      await pg.exec("ROLLBACK")
      throw error
    }
  }
  await asOther("UPDATE public.hair_profiles SET additional_notes = 'notiz' WHERE user_id = $1", [
    OWNER,
  ])
  assert.equal((await readRow(pg, OWNER))!.additional_notes, "notiz")
  await asOther("INSERT INTO public.hair_profiles (user_id) VALUES ($1)", [OTHER])
  assert.equal((await readRow(pg, OTHER))!.facts_revision, 0)
  await rejectsOutsideDoor(
    asOther("UPDATE public.hair_profiles SET thickness = 'coarse' WHERE user_id = $1", [OWNER]),
    ["thickness"],
  )
})

test("the no-op check compares the stored text: an equal-by-meaning but re-written document is a write", async (t) => {
  const pg = await lockedWithFacts(t)
  // `1.0` equals `1` as jsonb, but the stored text changes (and hashes such as
  // user_facts_diagnostics_hash_v1 hash `::text`).
  const { rows } = await pg.query<{ same: boolean; text: string }>(
    `SELECT jsonb_set(facts_provenance, '{diagnostics,schemaVersion}', '1.0'::jsonb) = facts_provenance AS same,
            jsonb_set(facts_provenance, '{diagnostics,schemaVersion}', '1.0'::jsonb)::text AS text
       FROM public.hair_profiles WHERE user_id = $1`,
    [OWNER],
  )
  assert.equal(rows[0]!.same, true, "precondition: jsonb equality calls them equal")
  assert.match(rows[0]!.text, /"schemaVersion": 1\.0/)
  await rejectsOutsideDoor(
    pg.query(
      `UPDATE public.hair_profiles
          SET facts_provenance = jsonb_set(facts_provenance, '{diagnostics,schemaVersion}', '1.0'::jsonb)
        WHERE user_id = $1`,
      [OWNER],
    ),
    ["facts_provenance"],
  )
  // A value written back exactly as stored stays a no-op (see "allowed: setting a fact column…").
})

test("SQL NULL vs JSON null on a document: the guard cannot tell them apart, the *_object CHECK closes it", async (t) => {
  const pg = await lockedWithFacts(t)
  assert.equal((await readRow(pg, OWNER))!.care_habits, null)
  await assert.rejects(
    pg.query("UPDATE public.hair_profiles SET care_habits = 'null'::jsonb WHERE user_id = $1", [
      OWNER,
    ]),
    /hair_profiles_care_habits_object/,
  )
})

test("rejected: a non-door insert with an explicit NULL for a column whose default is '{}'", async (t) => {
  const pg = await lockedWithFacts(t)
  await rejectsOutsideDoor(
    pg.query("INSERT INTO public.hair_profiles (user_id, goals) VALUES ($1, NULL)", [OTHER]),
    ["goals"],
  )
  assert.equal(await readRow(pg, OTHER), null)
})

test("the migration refuses to apply when a before-row trigger sorts after the guard, or a fact column is missing", async (t) => {
  const late = await migratedPersonalPlanDatabase(t, { lock: false })
  await late.exec(`
    CREATE FUNCTION public.lock_test_noop() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
    CREATE TRIGGER zzz_after_the_guard BEFORE UPDATE ON public.hair_profiles
      FOR EACH ROW EXECUTE FUNCTION public.lock_test_noop();
  `)
  await assert.rejects(applyUserFactsLock(late), (error: GuardError) => {
    assert.equal(error.message, "hair_profiles_fact_guard_not_last")
    assert.equal(error.detail, "zzz_after_the_guard")
    return true
  })
  const { rows: guards } = await late.query(
    "SELECT 1 FROM pg_catalog.pg_trigger WHERE tgname = 'zz_hair_profiles_fact_write_guard'",
  )
  assert.equal(guards.length, 0, "a refused apply leaves nothing behind")

  const missing = await migratedPersonalPlanDatabase(t, { lock: false })
  await missing.exec("ALTER TABLE public.hair_profiles DROP COLUMN brush_type")
  await assert.rejects(applyUserFactsLock(missing), /hair_profiles_fact_column_missing/)
})

test("the guard and the apply-time check hold the same fact columns and defaults", async () => {
  const sql = await readFile(
    new URL("../supabase/pending/20260930120000_user_facts_lock.sql", import.meta.url),
    "utf8",
  )
  const literals = [...sql.matchAll(/'(\{\s*"diagnostics": null[\s\S]*?\})'::jsonb/g)].map(
    (match) => JSON.parse(match[1]!) as Record<string, unknown>,
  )
  assert.equal(literals.length, 2, "one literal in the guard, one in the apply-time check")
  assert.deepEqual(literals[0], literals[1])
  assert.equal(Object.keys(literals[0]!).length, 26)
})

// ---------------------------------------------------------------------------
// Writers proven here (the rest by their own suites, which now run with the lock)
// ---------------------------------------------------------------------------

test("writer under the lock: the web account link (writeAccountLinkFacts)", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await insertProfile(pg, OWNER)
  const outcome = await writeAccountLinkFacts(pgliteAdminClient(pg) as never, {
    userId: OWNER,
    quiz: {
      kind: "lead",
      leadId: id(3, 3),
      quizAnswers: {
        structure: "wavy",
        thickness: "fine",
        density: "medium",
        hair_length: "long",
        fingertest: "rau",
        pulltest: "stretches_bounces",
        scalp_type: "ausgeglichen",
        has_scalp_issue: false,
        treatment: ["natur"],
        concerns: ["dryness"],
        goals: ["moisture"],
      },
      createdAt: "2026-09-01T00:00:00.000Z",
    },
  })
  assert.equal(outcome, "replaced")
  const row = (await readRow(pg, OWNER))!
  assert.equal(row.hair_texture, "wavy")
  assert.ok((row.facts_revision as number) >= 1)
})

test("writer under the lock: the Feinschliff completion lane's care_habits write, bound to its draft", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await insertProfile(pg, OWNER)
  const initial = await createInitialNeed(pg, { userId: OWNER, inputHash: "a".repeat(64) })
  const draftId = id(3, 3)
  await insertOpenRefinementDraft(pg, {
    draftId,
    userId: OWNER,
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial.needVersionId,
  })
  const answers = { dryingRoutes: ["air_dry"], towel: { material: "frottee" } }
  // The exact call `stage2-refinement-service.ts#writeCareHabitsFacts` makes.
  const result = await saveUserFactsRpc(pgliteRpcClient(pg) as never, {
    userId: OWNER,
    domain: "care_habits",
    patch: toCareHabitsPatch(answers as never),
    provenance: {
      source: { kind: "feinschliff_draft", id: draftId },
      schemaVersion: CARE_HABITS_SCHEMA_VERSION,
      at: "2026-09-30T00:00:00.000Z",
      fields: toFieldProvenance({
        completedQuestionIds: ["drying_routes", "towel_handling"],
        answerProvenance: {},
      }),
    },
    draftBinding: {
      sourceDraftId: draftId,
      expectedDraftRevision: 0,
      expectedInitialVersionId: initial.needVersionId,
    },
  })
  assert.equal(result.status, "ok")
  const row = (await readRow(pg, OWNER))!
  const derived = deriveCareHabitsColumns(parseUserFactsRow(OWNER, row).careHabits!)
  assert.equal(row.drying_method, derived.drying_method)
  assert.equal(row.towel_material, "frottee")
})

test("writer under the lock: the backfill's write path over a row a legacy writer left before the lock", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t, { lock: false })
  await insertProfile(pg, OWNER)
  const columns = {
    hair_texture: "curly",
    thickness: "coarse",
    density: "high",
    hair_length: "long",
    cuticle_condition: "rough",
    protein_moisture_balance: "stretches_bounces",
    scalp_type: "balanced",
    scalp_condition: null,
    chemical_treatment: ["colored"],
    concerns: ["dryness"],
    goals: ["moisture"],
    towel_material: "frottee",
    towel_technique: "gentle_press",
    drying_method: "air_dry",
    styling_tools: [] as string[],
    heat_styling: "never",
    uses_heat_protection: false,
    night_protection: null,
    brush_type: ["wide_tooth_comb"],
    desired_volume: null,
    primary_concern: "dryness",
  }
  const names = Object.keys(columns)
  await pg.query(
    `INSERT INTO public.hair_profiles (user_id, ${names.join(", ")})
     VALUES ($1, ${names.map((_, index) => `$${index + 2}`).join(", ")})`,
    [OWNER, ...Object.values(columns)],
  )
  await applyUserFactsLock(pg)

  const plan = planUserFactsBackfill(
    {
      userId: OWNER,
      factsRevision: 0,
      factsProvenance: {},
      columns: columns as never,
      storedDomains: { diagnostics: false, care_habits: false, quiz_context: false },
      storedDiagnostics: null,
      storedCareHabits: null,
      artifact: null,
      legacyLead: null,
      plan: null,
      needVersions: [],
      drafts: [],
    },
    { now: "2026-09-30T00:00:00.000Z", catchUp: false },
  )
  assert.ok(plan.writes.length >= 2, "diagnostics and care_habits planned")
  // The loop in scripts/user-facts/backfill.ts: every planned write through saveUserFacts, CAS
  // pinned to the revision the previous write returned.
  let expectedRevision = 0
  for (const write of plan.writes) {
    const result = await saveUserFactsRpc(
      pgliteRpcClient(pg) as never,
      {
        userId: OWNER,
        domain: write.domain,
        patch: write.patch,
        provenance: write.provenance,
        expectedRevision,
        mode: "upsert",
      } as Parameters<typeof saveUserFactsRpc>[1],
    )
    assert.equal(result.status, "ok", write.domain)
    expectedRevision = (result as { revision: number }).revision
  }
  const row = (await readRow(pg, OWNER))!
  assert.equal(row.facts_revision, plan.writes.length)
  assert.ok(row.diagnostics && row.care_habits)
  assert.equal(row.hair_texture, "curly")
  assert.equal(row.towel_material, "frottee")
})
