import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

/**
 * Batch 7 follow-up (plan Rev. 3 §2.4, D2): the cockpit's usage correction
 * (`discovery_admin_set_intake_item_usage`, replaced by 20260925150000) moves a styling item
 * into an evaluated type and an evaluated item into styling — within the
 * `discovery_intake_items_styling_not_evaluated` CHECK. Replayed on PGlite over the
 * discovery migrations.
 */

const dir = "supabase/migrations"
const CHAIN = [
  "20260922120000_discovery_call_toolkit.sql",
  "20260923120000_discovery_enrollment_optional_email.sql",
  "20260924120000_discovery_intake_usage_product_type.sql",
  "20260924140000_discovery_admin_item_usage.sql",
  "20260925120000_discovery_intake_frequency_heat_styling.sql",
  "20260925150000_discovery_admin_item_usage_styling.sql",
]
const OWN = CHAIN[5]

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

let enrollments = 0

async function submittedIntake(pg: PGlite, finalized = false) {
  enrollments += 1
  const enrollment = await pg.query<{ id: string }>(
    "INSERT INTO public.discovery_enrollments (display_name, normalized_email) VALUES ('Lea', $1) RETURNING id",
    [`lea${enrollments}@example.test`],
  )
  const intake = await pg.query<{ id: string }>(
    `INSERT INTO public.discovery_intakes (enrollment_id, user_id, state, submitted_at)
     VALUES ($1, $2, 'submitted', now()) RETURNING id`,
    [enrollment.rows[0].id, USER],
  )
  if (finalized) {
    await pg.query(
      "UPDATE public.discovery_intakes SET call_finalized_at = now(), finalized_source_hash = 'h' WHERE id = $1",
      [intake.rows[0].id],
    )
  }
  return intake.rows[0].id
}

type ItemRow = {
  category: string | null
  source: string
  product_type: string | null
  usage_role: string | null
  product_submission_id: string | null
}

async function insertItem(pg: PGlite, intakeId: string, row: Partial<ItemRow>) {
  const full: ItemRow = {
    category: null,
    source: "name_research",
    product_type: null,
    usage_role: null,
    product_submission_id: null,
    ...row,
  }
  const inserted = await pg.query<{ id: string }>(
    `INSERT INTO public.discovery_intake_items
       (intake_id, category, source, product_type, usage_role, product_name_text, product_submission_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      intakeId,
      full.category,
      full.source,
      full.product_type,
      full.usage_role,
      full.source === "none" ? null : "Irgendwas",
      full.product_submission_id,
    ],
  )
  return inserted.rows[0].id
}

async function setUsage(
  pg: PGlite,
  intakeId: string,
  itemId: string,
  category: string | null,
  role: string | null,
  productType: string | null,
) {
  const result = await pg.query<{ result: Record<string, unknown> }>(
    "SELECT public.discovery_admin_set_intake_item_usage($1, $2, $3, $4, $5, ARRAY[]::text[]) AS result",
    [intakeId, itemId, category, role, productType],
  )
  return result.rows[0].result
}

async function row(pg: PGlite, itemId: string) {
  const result = await pg.query<ItemRow>(
    "SELECT category, source, product_type, usage_role, product_submission_id FROM public.discovery_intake_items WHERE id = $1",
    [itemId],
  )
  return result.rows[0]
}

async function noneRows(pg: PGlite, intakeId: string) {
  const result = await pg.query<{ category: string }>(
    "SELECT category FROM public.discovery_intake_items WHERE intake_id = $1 AND source = 'none' ORDER BY category",
    [intakeId],
  )
  return result.rows.map((entry) => entry.category)
}

test("the follow-up migration has a unique version that sorts after every migration", () => {
  const versions = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.split("_")[0])
  const own = OWN.split("_")[0]
  assert.equal(versions.filter((version) => version === own).length, 1)
  assert.ok(
    versions.every((version) => version <= own),
    "must sort after every migration",
  )
})

test("styling → evaluated: type and usage set together; the destination's „none“ goes", async (t) => {
  const pg = await migrated(t)
  const intakeId = await submittedIntake(pg)
  const spray = await insertItem(pg, intakeId, { product_type: "styling" })
  await insertItem(pg, intakeId, { source: "none", category: "leave_in" })

  const result = await setUsage(pg, intakeId, spray, "leave_in", null, "leave_in")
  assert.equal(result.outcome, "updated")
  assert.equal(result.none_removed, true)
  assert.deepEqual(await row(pg, spray), {
    category: "leave_in",
    source: "name_research",
    product_type: "leave_in",
    usage_role: null,
    product_submission_id: null,
  })
  assert.deepEqual(await noneRows(pg, intakeId), [])
})

test("styling → evaluated needs the type; styling → styling is already known", async (t) => {
  const pg = await migrated(t)
  const intakeId = await submittedIntake(pg)
  const spray = await insertItem(pg, intakeId, { product_type: "styling" })
  assert.equal(
    (await setUsage(pg, intakeId, spray, "leave_in", null, null)).outcome,
    "product_type_required",
  )
  assert.equal((await setUsage(pg, intakeId, spray, null, null, "styling")).outcome, "type_known")
  assert.equal((await row(pg, spray)).product_type, "styling", "nothing written")
})

test("evaluated → styling: usage, role and research link cleared; the vacated category gets its „none“", async (t) => {
  const pg = await migrated(t)
  const intakeId = await submittedIntake(pg)
  const oil = await insertItem(pg, intakeId, {
    category: "oil",
    product_type: "oil",
    usage_role: "dry_finish",
    product_submission_id: SUBMISSION,
  })

  const result = await setUsage(pg, intakeId, oil, null, null, "styling")
  assert.equal(result.outcome, "updated")
  assert.equal(result.none_inserted, true)
  assert.equal(result.vacated_category, "oil")
  assert.deepEqual(await row(pg, oil), {
    category: null,
    source: "name_research",
    product_type: "styling",
    usage_role: null,
    product_submission_id: null,
  })
  assert.deepEqual(await noneRows(pg, intakeId), ["oil"])
  const submissions = await pg.query("SELECT id FROM public.product_submissions WHERE id = $1", [
    SUBMISSION,
  ])
  assert.equal(submissions.rows.length, 1, "the research itself stays; only the link goes")
})

test("the batch-5 rules still hold, and a finalized call refuses every correction", async (t) => {
  const pg = await migrated(t)
  const intakeId = await submittedIntake(pg)
  const typed = await insertItem(pg, intakeId, { category: "mask", product_type: "mask" })
  const typeOpen = await insertItem(pg, intakeId, {})
  assert.equal(
    (await setUsage(pg, intakeId, typed, "mask", null, "conditioner")).outcome,
    "type_known",
  )
  assert.equal(
    (await setUsage(pg, intakeId, typeOpen, "mask", null, null)).outcome,
    "product_type_required",
  )
  assert.equal((await setUsage(pg, intakeId, typed, "conditioner", null, null)).outcome, "updated")
  // Type-open items may go straight into styling too.
  assert.equal((await setUsage(pg, intakeId, typeOpen, null, null, "styling")).outcome, "updated")

  const frozen = await submittedIntake(pg, true)
  const frozenItem = await insertItem(pg, frozen, { product_type: "styling" })
  assert.equal(
    (await setUsage(pg, frozen, frozenItem, "leave_in", null, "leave_in")).outcome,
    "finalized",
  )
})
