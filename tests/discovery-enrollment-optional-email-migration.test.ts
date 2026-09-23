import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { readdirSync } from "node:fs"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

const BASE = "20260922120000_discovery_call_toolkit.sql"
const OPTIONAL_EMAIL = "20260923120000_discovery_enrollment_optional_email.sql"
const dir = "supabase/migrations"

const predecessorSchema = `
CREATE SCHEMA auth;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = pg_catalog.now(); RETURN NEW; END;
$$;
CREATE TABLE public.profiles (id uuid PRIMARY KEY, email text NOT NULL);
CREATE TABLE public.products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL);
CREATE TABLE public.product_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approved_product_id uuid REFERENCES public.products (id)
);
`

const USER = "10000000-0000-4000-8000-000000000001"

async function migrated(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(async () => pg.close())
  await pg.exec(predecessorSchema)
  await pg.exec(await readFile(`${dir}/${BASE}`, "utf8"))
  await pg.exec(await readFile(`${dir}/${OPTIONAL_EMAIL}`, "utf8"))
  await pg.query("INSERT INTO public.profiles (id, email) VALUES ($1, 'lea@example.test')", [USER])
  return pg
}

const insert = (pg: PGlite, email: string | null) =>
  pg.query<{ id: string }>(
    "INSERT INTO public.discovery_enrollments (display_name, normalized_email) VALUES ('Lea', $1) RETURNING id",
    [email],
  )

test("the optional-email migration has the latest, unique version", () => {
  const versions = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.split("_")[0])
  const own = OPTIONAL_EMAIL.split("_")[0]
  assert.equal(versions.filter((version) => version === own).length, 1)
  assert.ok(
    versions.every((version) => version <= own),
    "must sort after every migration",
  )
})

test("a name-only invite is allowed, and several can coexist", async (t) => {
  const pg = await migrated(t)
  await insert(pg, null)
  await insert(pg, null)
  const { rows } = await pg.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM public.discovery_enrollments WHERE normalized_email IS NULL",
  )
  assert.equal(rows[0].n, 2)
})

test("a non-null address is still normalised and unique among current invites", async (t) => {
  const pg = await migrated(t)
  await assert.rejects(insert(pg, "Lea@Example.test"), /check/i)
  await assert.rejects(insert(pg, "not-an-address"), /check/i)
  const { rows } = await insert(pg, "lea@example.test")
  await assert.rejects(insert(pg, "lea@example.test"), /unique|duplicate/i)
  // Revoking frees the address for a new invite, as before.
  await pg.query("UPDATE public.discovery_enrollments SET revoked_at = now() WHERE id = $1", [
    rows[0].id,
  ])
  await insert(pg, "lea@example.test")
})

test("a claimed invite must carry its address", async (t) => {
  const pg = await migrated(t)
  const { rows } = await insert(pg, null)
  await assert.rejects(
    pg.query(
      "UPDATE public.discovery_enrollments SET claimed_user_id = $1, claimed_at = now() WHERE id = $2",
      [USER, rows[0].id],
    ),
    /claim_has_email/,
  )
  await pg.query(
    "UPDATE public.discovery_enrollments SET normalized_email = 'lea@example.test', claimed_user_id = $1, claimed_at = now() WHERE id = $2",
    [USER, rows[0].id],
  )
})
