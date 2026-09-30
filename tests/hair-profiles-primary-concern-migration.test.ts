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
const user = "11111111-1111-4111-8111-111111111111"

async function fixture() {
  const db = new PGlite()
  // Narrow shape fixture of the real table (00001_initial_schema.sql).
  await db.exec(`create table public.hair_profiles(
    id uuid primary key default gen_random_uuid(),
    user_id uuid unique not null,
    concerns text[] default '{}',
    thickness text
  );`)
  await db.exec(await readFile(migration, "utf8"))
  return db
}

async function primaryConcern(db: PGlite): Promise<string | null> {
  const result = await db.query<{ primary_concern: string | null }>(
    "select primary_concern from public.hair_profiles where user_id = $1",
    [user],
  )
  return result.rows[0]?.primary_concern ?? null
}

test("the CHECK lists exactly the profile concern vocabulary", async () => {
  const sql = await readFile(migration, "utf8")
  const listed = [...sql.matchAll(/^\s+'([a-z_]+)',?$/gm)].map((match) => match[1])
  assert.deepEqual([...listed].sort(), [...PROFILE_CONCERNS].sort())
})

test("a contained pick is stored; NULL stays allowed", async () => {
  const db = await fixture()
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

test("a value outside the vocabulary is rejected", async () => {
  const db = await fixture()
  await assert.rejects(
    db.query(
      "insert into public.hair_profiles(user_id, concerns, primary_concern) values ($1, $2, $3)",
      [user, ["low_shine"], "low_shine"],
    ),
  )
})

test("a pick not among concerns is dropped on insert, never rejected", async () => {
  const db = await fixture()
  await db.query(
    "insert into public.hair_profiles(user_id, concerns, primary_concern) values ($1, $2, $3)",
    [user, ["breakage"], "frizz"],
  )
  assert.equal(await primaryConcern(db), null)
})

test("a concerns-only edit that removes the pick clears it; one that keeps it does not", async () => {
  const db = await fixture()
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

test("edits of unrelated columns leave the pick alone", async () => {
  const db = await fixture()
  await db.query(
    "insert into public.hair_profiles(user_id, concerns, primary_concern) values ($1, $2, $3)",
    [user, ["frizz", "breakage"], "breakage"],
  )
  await db.query("update public.hair_profiles set thickness = 'fine' where user_id = $1", [user])
  assert.equal(await primaryConcern(db), "breakage")
})
