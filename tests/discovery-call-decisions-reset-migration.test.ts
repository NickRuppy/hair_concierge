import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

/**
 * „Testlauf zurücksetzen" (cockpit call-ready A2): one locked write that deletes every call
 * decision of one intake — until it is finalised. Replayed on PGlite over the discovery
 * migrations.
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
  "20261009160000_discovery_admin_reset_call_decisions.sql",
]

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
const SWAP = "20000000-0000-4000-8000-000000000001"
const SWAP_TWO = "20000000-0000-4000-8000-000000000002"
const KEY = "decision:shampoo:shampoo_everyday:gap"
const EMPTY_KEY = "decision:mask:intensive_conditioning_mask:gap"

async function migrated(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(async () => pg.close())
  await pg.exec(predecessorSchema)
  for (const file of CHAIN) await pg.exec(await readFile(`${dir}/${file}`, "utf8"))
  await pg.query("INSERT INTO public.profiles (id, email) VALUES ($1, 'lea@example.test')", [USER])
  await pg.query("INSERT INTO public.products (id, name) VALUES ($1, 'Swap'), ($2, 'Swap 2')", [
    SWAP,
    SWAP_TWO,
  ])
  return pg
}

let enrollments = 0

async function intake(pg: PGlite, state: "draft" | "submitted" | "finalized" = "submitted") {
  enrollments += 1
  const enrollment = await pg.query<{ id: string }>(
    "INSERT INTO public.discovery_enrollments (display_name, normalized_email) VALUES ('Lea', $1) RETURNING id",
    [`lea${enrollments}@example.test`],
  )
  const row = await pg.query<{ id: string }>(
    state === "draft"
      ? "INSERT INTO public.discovery_intakes (enrollment_id, user_id) VALUES ($1, $2) RETURNING id"
      : `INSERT INTO public.discovery_intakes (enrollment_id, user_id, state, submitted_at)
         VALUES ($1, $2, 'submitted', now()) RETURNING id`,
    [enrollment.rows[0].id, USER],
  )
  const id = row.rows[0].id
  if (state === "finalized") {
    await pg.query(
      "UPDATE public.discovery_intakes SET call_finalized_at = now(), finalized_source_hash = 'h' WHERE id = $1",
      [id],
    )
  }
  return id
}

async function shampoo(pg: PGlite, intakeId: string) {
  const row = await pg.query<{ id: string }>(
    `INSERT INTO public.discovery_intake_items (intake_id, category, source, product_name_text)
     VALUES ($1, 'shampoo', 'name_research', 'Shampoo') RETURNING id`,
    [intakeId],
  )
  return row.rows[0].id
}

async function decide(
  pg: PGlite,
  input: {
    intakeId: string
    key?: string
    itemId: string | null
    decision: "keep" | "swap" | "drop"
    swap?: string | null
    /**
     * The step's other products with THEIR composed usage — a bare id means a role-less
     * shampoo, as composed.
     */
    siblings?: Array<string | { id: string; category: string | null; role: string | null }>
    /** The item's usage as the route composed it (default: a role-less shampoo). */
    expected?: { category: string | null; role: string | null }
  },
) {
  const expected =
    input.expected ??
    (input.itemId ? { category: "shampoo", role: null } : { category: null, role: null })
  const result = await pg.query<{ result: Record<string, unknown> }>(
    "SELECT public.discovery_admin_set_call_decision($1, $2, $3, $4, $5, $6, $7, $8::jsonb) AS result",
    [
      input.intakeId,
      input.key ?? KEY,
      input.itemId,
      expected.category,
      expected.role,
      input.decision,
      input.swap ?? null,
      JSON.stringify(
        (input.siblings ?? []).map((sibling) =>
          typeof sibling === "string"
            ? { id: sibling, category: "shampoo", usage_role: null }
            : { id: sibling.id, category: sibling.category, usage_role: sibling.role },
        ),
      ),
    ],
  )
  return result.rows[0].result
}

async function count(pg: PGlite, intakeId: string) {
  const result = await pg.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM public.discovery_call_decisions WHERE intake_id = $1",
    [intakeId],
  )
  return result.rows[0].n
}

async function reset(pg: PGlite, intakeId: string) {
  const result = await pg.query<{ result: Record<string, unknown> }>(
    "SELECT public.discovery_admin_reset_call_decisions($1) AS result",
    [intakeId],
  )
  return result.rows[0].result
}

test("reset deletes every decision of the intake — and only of that intake", async (t) => {
  const pg = await migrated(t)
  const mine = await intake(pg)
  const other = await intake(pg)
  const item = await shampoo(pg, mine)
  const otherItem = await shampoo(pg, other)
  await decide(pg, { intakeId: mine, itemId: item, decision: "swap", swap: SWAP })
  await decide(pg, { intakeId: mine, key: EMPTY_KEY, itemId: null, decision: "keep" })
  await decide(pg, { intakeId: other, itemId: otherItem, decision: "keep" })

  assert.deepEqual(await reset(pg, mine), { outcome: "reset", deleted: 2 })
  assert.equal(await count(pg, mine), 0)
  assert.equal(await count(pg, other), 1)
  // Idempotent: nothing left to delete is still a reset.
  assert.deepEqual(await reset(pg, mine), { outcome: "reset", deleted: 0 })
})

test("a draft intake resets like a submitted one", async (t) => {
  const pg = await migrated(t)
  const draft = await intake(pg, "draft")
  await decide(pg, { intakeId: draft, key: EMPTY_KEY, itemId: null, decision: "keep" })
  assert.deepEqual(await reset(pg, draft), { outcome: "reset", deleted: 1 })
})

test("a finalised call is frozen; an unknown intake is not found", async (t) => {
  const pg = await migrated(t)
  const open = await intake(pg)
  await decide(pg, { intakeId: open, key: EMPTY_KEY, itemId: null, decision: "keep" })
  await pg.query(
    "UPDATE public.discovery_intakes SET call_finalized_at = now(), finalized_source_hash = 'h' WHERE id = $1",
    [open],
  )
  assert.deepEqual(await reset(pg, open), { outcome: "finalized" })
  assert.equal(await count(pg, open), 1)
  assert.deepEqual(await reset(pg, "40000000-0000-4000-8000-0000000000ff"), {
    outcome: "not_found",
  })
})

test("only the service role may reset", async (t) => {
  const pg = await migrated(t)
  const grants = await pg.query<{ grantee: string }>(
    `SELECT grantee FROM information_schema.role_routine_grants
      WHERE routine_name = 'discovery_admin_reset_call_decisions' AND privilege_type = 'EXECUTE'`,
  )
  const grantees = new Set(grants.rows.map((row) => row.grantee))
  assert.ok(grantees.has("service_role"))
  for (const role of ["anon", "authenticated", "PUBLIC"]) assert.ok(!grantees.has(role), role)
})
