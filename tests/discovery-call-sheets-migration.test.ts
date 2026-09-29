import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

/**
 * Consult runsheet (plan `plans/consult-runsheet/plan.md` §6): one call sheet per
 * discovery enrollment. Replayed on PGlite over the discovery migrations.
 */

const dir = "supabase/migrations"
const CHAIN = [
  "20260922120000_discovery_call_toolkit.sql",
  "20260923120000_discovery_enrollment_optional_email.sql",
  "20260924120000_discovery_intake_usage_product_type.sql",
  "20260924140000_discovery_admin_item_usage.sql",
  "20260925120000_discovery_intake_frequency_heat_styling.sql",
  "20260925150000_discovery_admin_item_usage_styling.sql",
  "20260927120000_discovery_call_decisions_per_item.sql",
  "20260928120000_discovery_call_sheets.sql",
]
const OWN = CHAIN.at(-1)!

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

async function migrated(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(async () => pg.close())
  await pg.exec(predecessorSchema)
  for (const file of CHAIN) await pg.exec(await readFile(`${dir}/${file}`, "utf8"))
  return pg
}

let enrollments = 0

async function enrollment(pg: PGlite) {
  enrollments += 1
  const row = await pg.query<{ id: string }>(
    "INSERT INTO public.discovery_enrollments (display_name, normalized_email) VALUES ('Lea', $1) RETURNING id",
    [`lea${enrollments}@example.test`],
  )
  return row.rows[0].id
}

test("the migration has a unique version that sorts after every migration", () => {
  const versions = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.split("_")[0])
  const own = OWN.split("_")[0]
  assert.equal(versions.filter((version) => version === own).length, 1)
  assert.deepEqual(
    versions.filter((version) => version > own).sort(),
    ["20260929120000", "20260929121000"],
    "must sort after every migration but the oil protocol repairs'",
  )
})

test("a fresh sheet defaults to empty arrays and nulls", async (t) => {
  const pg = await migrated(t)
  const id = await enrollment(pg)
  await pg.query("INSERT INTO public.discovery_call_sheets (enrollment_id) VALUES ($1)", [id])
  const row = await pg.query<Record<string, unknown>>(
    `SELECT baseline_score, rescores, touchpoints, consult_brief, habit_commitments, feedback,
            created_at IS NOT NULL AS has_created, updated_at IS NOT NULL AS has_updated
       FROM public.discovery_call_sheets WHERE enrollment_id = $1`,
    [id],
  )
  assert.deepEqual(row.rows[0], {
    baseline_score: null,
    rescores: [],
    touchpoints: [],
    consult_brief: null,
    habit_commitments: [],
    feedback: null,
    has_created: true,
    has_updated: true,
  })
})

test("one sheet per enrollment; an unknown enrollment is refused", async (t) => {
  const pg = await migrated(t)
  const id = await enrollment(pg)
  const insert = (enrollmentId: string) =>
    pg.query("INSERT INTO public.discovery_call_sheets (enrollment_id) VALUES ($1)", [enrollmentId])
  await insert(id)
  await assert.rejects(insert(id), /discovery_call_sheets_pkey/)
  await assert.rejects(
    insert("40000000-0000-4000-8000-0000000000ff"),
    /discovery_call_sheets_enrollment_id_fkey/,
  )
})

test("baseline_score is 1–10 or null", async (t) => {
  const pg = await migrated(t)
  const set = async (score: number | null) => {
    const id = await enrollment(pg)
    return pg.query(
      "INSERT INTO public.discovery_call_sheets (enrollment_id, baseline_score) VALUES ($1, $2)",
      [id, score],
    )
  }
  for (const ok of [1, 10, null]) await set(ok)
  for (const bad of [0, 11, -1]) {
    await assert.rejects(set(bad), /discovery_call_sheets_baseline_score_check/)
  }
})

test("the list columns must hold JSON arrays", async (t) => {
  const pg = await migrated(t)
  for (const column of ["rescores", "touchpoints", "habit_commitments"]) {
    const id = await enrollment(pg)
    await assert.rejects(
      pg.query(
        `INSERT INTO public.discovery_call_sheets (enrollment_id, ${column}) VALUES ($1, '{}'::jsonb)`,
        [id],
      ),
      new RegExp(`discovery_call_sheets_${column}_is_array`),
    )
    await assert.rejects(
      pg.query(
        `INSERT INTO public.discovery_call_sheets (enrollment_id, ${column}) VALUES ($1, NULL)`,
        [id],
      ),
      /null value/,
    )
  }
  const id = await enrollment(pg)
  await pg.query(
    `INSERT INTO public.discovery_call_sheets
       (enrollment_id, baseline_score, rescores, touchpoints, consult_brief, habit_commitments, feedback)
     VALUES ($1, 4, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, 'Hilft')`,
    [
      id,
      JSON.stringify([{ score: 7, at: "2026-10-05T10:00:00Z", channel: "whatsapp" }]),
      JSON.stringify([{ kind: "text_checkin", due_on: "2026-10-05", done_at: null }]),
      JSON.stringify({
        sections: {
          diagnose: "x",
          hebel: [],
          swapReasons: {},
          zielLuecken: [],
          callFragen: [],
          erwartungen: [],
        },
        generated_at: null,
        generated_by: "manual",
        source_hash: null,
      }),
      JSON.stringify([{ id: "h1", label: "Kalt ausspülen", committed: true }]),
    ],
  )
})

test("deleting the enrollment takes its sheet with it; updated_at is maintained", async (t) => {
  const pg = await migrated(t)
  const id = await enrollment(pg)
  await pg.query(
    "INSERT INTO public.discovery_call_sheets (enrollment_id, updated_at) VALUES ($1, now() - interval '1 day')",
    [id],
  )
  await pg.query(
    "UPDATE public.discovery_call_sheets SET feedback = 'gut' WHERE enrollment_id = $1",
    [id],
  )
  const fresh = await pg.query<{ fresh: boolean }>(
    "SELECT updated_at > now() - interval '1 hour' AS fresh FROM public.discovery_call_sheets WHERE enrollment_id = $1",
    [id],
  )
  assert.equal(fresh.rows[0].fresh, true)

  await pg.query("DELETE FROM public.discovery_enrollments WHERE id = $1", [id])
  const left = await pg.query(
    "SELECT 1 FROM public.discovery_call_sheets WHERE enrollment_id = $1",
    [id],
  )
  assert.equal(left.rows.length, 0)
})

test("the table is service-role only, behind RLS", async (t) => {
  const pg = await migrated(t)
  const privileges = await pg.query<Record<string, boolean>>(
    `SELECT has_table_privilege('anon', 'public.discovery_call_sheets', 'SELECT,INSERT,UPDATE,DELETE') AS anon,
            has_table_privilege('authenticated', 'public.discovery_call_sheets', 'SELECT,INSERT,UPDATE,DELETE') AS member,
            has_table_privilege('service_role', 'public.discovery_call_sheets', 'SELECT') AS service_select,
            has_table_privilege('service_role', 'public.discovery_call_sheets', 'INSERT') AS service_insert,
            has_table_privilege('service_role', 'public.discovery_call_sheets', 'UPDATE') AS service_update`,
  )
  assert.deepEqual(privileges.rows[0], {
    anon: false,
    member: false,
    service_select: true,
    service_insert: true,
    service_update: true,
  })

  const rls = await pg.query<{ enabled: boolean }>(
    "SELECT relrowsecurity AS enabled FROM pg_class WHERE oid = 'public.discovery_call_sheets'::regclass",
  )
  assert.equal(rls.rows[0].enabled, true)

  const policies = await pg.query<{ policyname: string; roles: string[]; cmd: string }>(
    "SELECT policyname, roles::text[] AS roles, cmd FROM pg_policies WHERE tablename = 'discovery_call_sheets'",
  )
  assert.deepEqual(policies.rows, [
    { policyname: "discovery_call_sheets_service_role_all", roles: ["service_role"], cmd: "ALL" },
  ])
})
