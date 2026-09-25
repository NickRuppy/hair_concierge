import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { readdirSync } from "node:fs"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

import { DISCOVERY_ITEM_FREQUENCIES } from "../src/lib/discovery/frequency"
import { PRODUCT_FREQUENCIES } from "../src/lib/vocabulary/frequencies"

/**
 * Batch 7 migration (plan plans/discovery-refinement-b7/plan.md Rev. 3, §2.2/§2.4):
 * per-product frequency, the heat & styling answers, the pre-wash conditioner role (D1),
 * the non-evaluated styling type (D2) and the cockpit's frequency correction. Replayed on
 * PGlite over the discovery migrations before it.
 */

const dir = "supabase/migrations"
const CHAIN = [
  "20260922120000_discovery_call_toolkit.sql",
  "20260923120000_discovery_enrollment_optional_email.sql",
  "20260924120000_discovery_intake_usage_product_type.sql",
  "20260924140000_discovery_admin_item_usage.sql",
  "20260925120000_discovery_intake_frequency_heat_styling.sql",
]
const OWN = CHAIN[4]

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
const SUBMISSION = "40000000-0000-4000-8000-000000000004"

async function migrated(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(async () => pg.close())
  await pg.exec(predecessorSchema)
  for (const file of CHAIN) await pg.exec(await readFile(`${dir}/${file}`, "utf8"))
  await pg.query("INSERT INTO public.profiles (id, email) VALUES ($1, 'lea@example.test')", [USER])
  await pg.query("INSERT INTO public.product_submissions (id) VALUES ($1)", [SUBMISSION])
  return pg
}

let enrollmentCount = 0

async function createIntake(pg: PGlite, state: "draft" | "submitted" = "draft") {
  enrollmentCount += 1
  const enrollment = await pg.query<{ id: string }>(
    "INSERT INTO public.discovery_enrollments (display_name, normalized_email) VALUES ('Lea', $1) RETURNING id",
    [`lea${enrollmentCount}@example.test`],
  )
  const intake = await pg.query<{ id: string }>(
    "INSERT INTO public.discovery_intakes (enrollment_id, user_id) VALUES ($1, $2) RETURNING id",
    [enrollment.rows[0].id, USER],
  )
  if (state === "submitted") {
    await pg.query(
      "UPDATE public.discovery_intakes SET state = 'submitted', submitted_at = now() WHERE id = $1",
      [intake.rows[0].id],
    )
  }
  return intake.rows[0].id
}

type Row = {
  category?: string | null
  source?: string
  product_type?: string | null
  usage_role?: string | null
  frequency?: string | null
  product_name_text?: string | null
  product_submission_id?: string | null
}

async function insertItem(pg: PGlite, intakeId: string, row: Row): Promise<string> {
  const full = {
    category: null,
    source: "name_research",
    product_type: null,
    usage_role: null,
    frequency: null,
    product_name_text: "Irgendwas",
    product_submission_id: null,
    ...row,
  }
  const inserted = await pg.query<{ id: string }>(
    `INSERT INTO public.discovery_intake_items
       (intake_id, category, source, product_type, usage_role, frequency, product_name_text,
        product_submission_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      intakeId,
      full.category,
      full.source,
      full.product_type,
      full.usage_role,
      full.frequency,
      full.product_name_text,
      full.product_submission_id,
    ],
  )
  return inserted.rows[0].id
}

async function setFrequency(pg: PGlite, intakeId: string, itemId: string, value: string | null) {
  const result = await pg.query<{ result: Record<string, unknown> }>(
    "SELECT public.discovery_admin_set_intake_item_frequency($1, $2, $3) AS result",
    [intakeId, itemId, value],
  )
  return result.rows[0].result
}

async function frequencyOf(pg: PGlite, itemId: string) {
  const result = await pg.query<{ frequency: string | null }>(
    "SELECT frequency FROM public.discovery_intake_items WHERE id = $1",
    [itemId],
  )
  return result.rows[0].frequency
}

test("the batch-7 migration has a unique version that sorts after every migration", () => {
  const versions = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.split("_")[0])
  const own = OWN.split("_")[0]
  assert.equal(versions.filter((version) => version === own).length, 1)
  // Only its own batch-7 follow-up (the styling-aware usage correction) may come later.
  assert.deepEqual(
    versions.filter((version) => version > own),
    ["20260925150000"],
    "must sort after every migration but its follow-up",
  )
})

test("the frequency CHECK lists exactly the app vocabulary: PRODUCT_FREQUENCIES plus unknown", async () => {
  const sql = await readFile(`${dir}/${OWN}`, "utf8")
  const block = sql.match(/frequency IS NULL OR frequency IN \(([^)]*)\)/)?.[1] ?? ""
  const listed = [...block.matchAll(/'([a-z_0-9]+)'/g)].map((match) => match[1])
  assert.deepEqual(listed.sort(), [...PRODUCT_FREQUENCIES, "unknown"].sort())
  assert.deepEqual([...DISCOVERY_ITEM_FREQUENCIES].sort(), listed.sort())
})

test("frequency: every vocabulary value and NULL are stored; anything else is refused", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  for (const value of [...DISCOVERY_ITEM_FREQUENCIES, null]) {
    const id = await insertItem(pg, intakeId, { frequency: value })
    assert.equal(await frequencyOf(pg, id), value)
  }
  await assert.rejects(
    insertItem(pg, intakeId, { frequency: "weekly" }),
    /discovery_intake_items_frequency_check/,
  )
})

test("a „none“ row never carries a frequency", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  await assert.rejects(
    insertItem(pg, intakeId, {
      source: "none",
      category: "mask",
      product_name_text: null,
      frequency: "weekly_1x",
    }),
    /discovery_intake_items_none_has_no_frequency/,
  )
  await insertItem(pg, intakeId, { source: "none", category: "mask", product_name_text: null })
})

test("D1: pre_wash_conditioner is a conditioner-only role", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  await insertItem(pg, intakeId, {
    category: "conditioner",
    product_type: "conditioner",
    usage_role: "pre_wash_conditioner",
  })
  for (const category of ["mask", "oil", "leave_in", null]) {
    await assert.rejects(
      insertItem(pg, intakeId, { category, usage_role: "pre_wash_conditioner" }),
      /discovery_intake_items_usage_role_pair/,
    )
  }
  // The batch-5 pairs still hold.
  await insertItem(pg, intakeId, { category: "oil", usage_role: "dry_finish" })
  await insertItem(pg, intakeId, {
    category: "scalp_care",
    usage_role: "scalp_flake_oil_adjunct",
  })
  await assert.rejects(
    insertItem(pg, intakeId, { category: "conditioner", usage_role: "dry_finish" }),
    /discovery_intake_items_usage_role_pair/,
  )
})

test("D2: a styling product has no usage, no role and no research", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  await insertItem(pg, intakeId, { product_type: "styling", frequency: "daily_1x" })
  await assert.rejects(
    insertItem(pg, intakeId, { product_type: "styling", category: "leave_in" }),
    /discovery_intake_items_styling_not_evaluated/,
  )
  await assert.rejects(
    insertItem(pg, intakeId, { product_type: "styling", product_submission_id: SUBMISSION }),
    /discovery_intake_items_styling_not_evaluated/,
  )
  await assert.rejects(
    insertItem(pg, intakeId, { product_type: "hairspray" }),
    /discovery_intake_items_product_type_check/,
  )
  // The ten categories are still product types.
  await insertItem(pg, intakeId, { product_type: "heat_protectant", category: "heat_protectant" })
})

test("heat_styling is a nullable object column", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  const read = async () =>
    (
      await pg.query<{ heat_styling: unknown }>(
        "SELECT heat_styling FROM public.discovery_intakes WHERE id = $1",
        [intakeId],
      )
    ).rows[0].heat_styling
  assert.equal(await read(), null)
  const answers = { dryingRoutes: ["air_dry"], additionalHeatTools: [], heatEvents: {} }
  await pg.query("UPDATE public.discovery_intakes SET heat_styling = $2 WHERE id = $1", [
    intakeId,
    JSON.stringify(answers),
  ])
  assert.deepEqual(await read(), answers)
  await assert.rejects(
    pg.query("UPDATE public.discovery_intakes SET heat_styling = '[]'::jsonb WHERE id = $1", [
      intakeId,
    ]),
    /discovery_intakes_heat_styling_object/,
  )
})

test("frequency correction: updated on a submitted intake, refused while finalized or a draft", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg, "submitted")
  const shampoo = await insertItem(pg, intakeId, {
    category: "shampoo",
    product_type: "shampoo",
    frequency: "weekly_2x",
  })
  assert.deepEqual(await setFrequency(pg, intakeId, shampoo, "weekly_3_4x"), {
    outcome: "updated",
  })
  assert.equal(await frequencyOf(pg, shampoo), "weekly_3_4x")
  await assert.rejects(setFrequency(pg, intakeId, shampoo, "often"), /frequency_check/)

  await pg.query(
    "UPDATE public.discovery_intakes SET call_finalized_at = now(), finalized_source_hash = 'h' WHERE id = $1",
    [intakeId],
  )
  assert.deepEqual(await setFrequency(pg, intakeId, shampoo, "daily_1x"), {
    outcome: "finalized",
  })
  assert.equal(await frequencyOf(pg, shampoo), "weekly_3_4x")

  const draft = await createIntake(pg, "draft")
  const draftItem = await insertItem(pg, draft, { category: "mask", product_type: "mask" })
  assert.deepEqual(await setFrequency(pg, draft, draftItem, "weekly_1x"), {
    outcome: "not_submitted",
  })

  const other = await createIntake(pg, "submitted")
  assert.deepEqual(await setFrequency(pg, other, shampoo, "weekly_1x"), {
    outcome: "item_not_found",
  })
  const none = await insertItem(pg, other, {
    source: "none",
    category: "mask",
    product_name_text: null,
  })
  assert.deepEqual(await setFrequency(pg, other, none, "weekly_1x"), {
    outcome: "item_not_found",
  })
  assert.deepEqual(
    await setFrequency(pg, "90000000-0000-4000-8000-000000000009", shampoo, "weekly_1x"),
    { outcome: "not_found" },
  )
})

test("only service_role may execute the frequency correction", async (t) => {
  const pg = await migrated(t)
  const signature = "public.discovery_admin_set_intake_item_frequency(uuid, uuid, text)"
  const grants = await pg.query<{ role: string; can: boolean }>(
    `SELECT role, has_function_privilege(role, $1, 'EXECUTE') AS can
       FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS role`,
    [signature],
  )
  assert.deepEqual(
    grants.rows.map((row) => [row.role, row.can]),
    [
      ["anon", false],
      ["authenticated", false],
      ["service_role", true],
    ],
  )

  const intakeId = await createIntake(pg, "submitted")
  const mask = await insertItem(pg, intakeId, { category: "mask", product_type: "mask" })
  await pg.exec("SET ROLE authenticated")
  await assert.rejects(setFrequency(pg, intakeId, mask, "weekly_1x"), /permission denied/)
  await pg.exec("RESET ROLE")
  await pg.exec("SET ROLE service_role")
  const result = await setFrequency(pg, intakeId, mask, "weekly_1x")
  await pg.exec("RESET ROLE")
  assert.equal(result.outcome, "updated")
})

/**
 * The heat write is a compare-and-set on `state = 'draft'` (`saveDiscoveryIntakeHeatStyling`:
 * `update … where id = $intake and state = 'draft'`, returning the row). Replayed here as the
 * very statement against the submit RPC, in both orders: whichever runs first wins, and a
 * heat answer never lands on a frozen intake.
 */
test("heat write vs submit: exactly one order wins, never a write after the freeze", async (t) => {
  const pg = await migrated(t)
  const heatWrite = async (intakeId: string) =>
    (
      await pg.query<{ id: string }>(
        "UPDATE public.discovery_intakes SET heat_styling = $2 WHERE id = $1 AND state = 'draft' RETURNING id",
        [intakeId, JSON.stringify({ dryingRoutes: [], additionalHeatTools: [], heatEvents: {} })],
      )
    ).rows.length
  const submit = async (intakeId: string) =>
    (
      await pg.query<{ result: { outcome: string } }>(
        "SELECT public.discovery_intake_submit_confirming_none($1) AS result",
        [intakeId],
      )
    ).rows[0].result.outcome
  const heatOf = async (intakeId: string) =>
    (
      await pg.query<{ heat_styling: unknown }>(
        "SELECT heat_styling FROM public.discovery_intakes WHERE id = $1",
        [intakeId],
      )
    ).rows[0].heat_styling

  // Submit first: the heat write matches no draft row (the route answers 409).
  const submittedFirst = await createIntake(pg)
  await insertItem(pg, submittedFirst, { category: "shampoo", product_type: "shampoo" })
  assert.equal(await submit(submittedFirst), "submitted")
  assert.equal(await heatWrite(submittedFirst), 0)
  assert.equal(await heatOf(submittedFirst), null)

  // Heat first: it lands, then the submit freezes the intake with it.
  const heatFirst = await createIntake(pg)
  await insertItem(pg, heatFirst, { category: "shampoo", product_type: "shampoo" })
  assert.equal(await heatWrite(heatFirst), 1)
  assert.equal(await submit(heatFirst), "submitted")
  assert.notEqual(await heatOf(heatFirst), null)
})
