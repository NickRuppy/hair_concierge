import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

import { PROFILE_CONCERNS } from "../src/lib/vocabulary/concerns-goals"

/**
 * `hair_profiles.primary_concern` (F1): vocabulary CHECK, and the „always one of
 * concerns" invariant enforced by dropping a stale pick rather than rejecting the write
 * of a caller (profile edit, mobile RPCs) that never heard of the column.
 */

const migration = new URL(
  "../supabase/migrations/20260925100000_hair_profiles_primary_concern.sql",
  import.meta.url,
)
// concern vocabulary widening, ruled 2026-10-11: apply the forward widening too.
const wideningMigration = new URL(
  "../supabase/migrations/20261012190000_widen_engine_concern_goal_vocabulary.sql",
  import.meta.url,
)
const user = "11111111-1111-4111-8111-111111111111"

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const db = new PGlite()
  t.after(async () => {
    await db.close()
  })
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;")
  // Narrow shape fixture of the real table (00001_initial_schema.sql).
  await db.exec(`create table public.hair_profiles(
    id uuid primary key default gen_random_uuid(),
    user_id uuid unique not null,
    concerns text[] default '{}',
    thickness text
  );`)
  await db.exec(await readFile(migration, "utf8"))
  await db.exec(await readFile(wideningMigration, "utf8"))
  return db
}

async function primaryConcern(db: PGlite): Promise<string | null> {
  const result = await db.query<{ primary_concern: string | null }>(
    "select primary_concern from public.hair_profiles where user_id = $1",
    [user],
  )
  return result.rows[0]?.primary_concern ?? null
}

test("the CHECK lists exactly the profile concern vocabulary", async (t) => {
  const db = await fixture(t)
  const { rows } = await db.query<{ definition: string }>(
    "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'public.hair_profiles'::regclass AND conname = 'hair_profiles_primary_concern_check'",
  )
  const listed = [...rows[0].definition.matchAll(/'([a-z_]+)'/g)].map((match) => match[1])
  assert.deepEqual([...listed].sort(), [...PROFILE_CONCERNS].sort())
})

test("a contained pick is stored; NULL stays allowed", async (t) => {
  const db = await fixture(t)
  await db.query(
    "insert into public.hair_profiles(user_id, concerns, primary_concern) values ($1, $2, $3)",
    [user, ["frizz", "breakage"], "frizz"],
  )
  assert.equal(await primaryConcern(db), "frizz")
  await db.query("update public.hair_profiles set primary_concern = null where user_id = $1", [
    user,
  ])
  assert.equal(await primaryConcern(db), null)
})

test("a value outside the vocabulary is rejected", async (t) => {
  const db = await fixture(t)
  await assert.rejects(
    db.query(
      "insert into public.hair_profiles(user_id, concerns, primary_concern) values ($1, $2, $3)",
      [user, ["unknown_concern"], "unknown_concern"],
    ),
  )
})

test("a pick not among concerns is dropped on insert, never rejected", async (t) => {
  const db = await fixture(t)
  await db.query(
    "insert into public.hair_profiles(user_id, concerns, primary_concern) values ($1, $2, $3)",
    [user, ["breakage"], "frizz"],
  )
  assert.equal(await primaryConcern(db), null)
})

test("a concerns-only edit that removes the pick clears it; one that keeps it does not", async (t) => {
  const db = await fixture(t)
  await db.query(
    "insert into public.hair_profiles(user_id, concerns, primary_concern) values ($1, $2, $3)",
    [user, ["frizz", "breakage"], "frizz"],
  )
  await db.query("update public.hair_profiles set concerns = $2 where user_id = $1", [
    user,
    ["frizz", "tangling"],
  ])
  assert.equal(await primaryConcern(db), "frizz")

  await db.query("update public.hair_profiles set concerns = $2 where user_id = $1", [
    user,
    ["tangling"],
  ])
  assert.equal(await primaryConcern(db), null)
})

test("edits of unrelated columns leave the pick alone", async (t) => {
  const db = await fixture(t)
  await db.query(
    "insert into public.hair_profiles(user_id, concerns, primary_concern) values ($1, $2, $3)",
    [user, ["frizz", "breakage"], "breakage"],
  )
  await db.query("update public.hair_profiles set thickness = 'fine' where user_id = $1", [user])
  assert.equal(await primaryConcern(db), "breakage")
})
