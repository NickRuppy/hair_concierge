import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { readdirSync } from "node:fs"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

import { SUPPORTED_PRODUCT_CATEGORY_KEYS } from "../src/lib/product-identity"

/**
 * Batch 5 migration (plan Rev. 3, task 1): usage (`category`, now nullable, + `usage_role`)
 * is separate from what the product is (`product_type`), and „Stimmt so – abschicken" is one
 * atomic RPC. Replayed on PGlite over the two discovery migrations before it.
 */

const dir = "supabase/migrations"
const CHAIN = [
  "20260922120000_discovery_call_toolkit.sql",
  "20260923120000_discovery_enrollment_optional_email.sql",
  "20260924120000_discovery_intake_usage_product_type.sql",
]
const OWN = CHAIN[2]

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
const PRODUCT = "20000000-0000-4000-8000-000000000002"

async function migrated(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(async () => pg.close())
  await pg.exec(predecessorSchema)
  for (const file of CHAIN) await pg.exec(await readFile(`${dir}/${file}`, "utf8"))
  await pg.query("INSERT INTO public.profiles (id, email) VALUES ($1, 'lea@example.test')", [USER])
  await pg.query("INSERT INTO public.products (id, name) VALUES ($1, 'Elixir')", [PRODUCT])
  return pg
}

async function createIntake(pg: PGlite, email = "lea@example.test") {
  const enrollment = await pg.query<{ id: string }>(
    "INSERT INTO public.discovery_enrollments (display_name, normalized_email) VALUES ('Lea', $1) RETURNING id",
    [email],
  )
  const intake = await pg.query<{ id: string }>(
    "INSERT INTO public.discovery_intakes (enrollment_id, user_id) VALUES ($1, $2) RETURNING id",
    [enrollment.rows[0].id, USER],
  )
  return intake.rows[0].id
}

type Row = {
  category?: string | null
  source?: string
  product_type?: string | null
  usage_role?: string | null
  product_name_text?: string | null
  product_id?: string | null
}

function insertItem(pg: PGlite, intakeId: string, row: Row) {
  const full = {
    category: null,
    source: "name_research",
    product_type: null,
    usage_role: null,
    product_name_text: "Irgendwas",
    product_id: null,
    ...row,
  }
  return pg.query(
    `INSERT INTO public.discovery_intake_items
       (intake_id, category, source, product_type, usage_role, product_name_text, product_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      intakeId,
      full.category,
      full.source,
      full.product_type,
      full.usage_role,
      full.product_name_text,
      full.product_id,
    ],
  )
}

async function submit(pg: PGlite, intakeId: string) {
  const result = await pg.query<{ result: Record<string, unknown> }>(
    "SELECT public.discovery_intake_submit_confirming_none($1) AS result",
    [intakeId],
  )
  return result.rows[0].result
}

async function noneCategories(pg: PGlite, intakeId: string) {
  const result = await pg.query<{ category: string }>(
    "SELECT category FROM public.discovery_intake_items WHERE intake_id = $1 AND source = 'none' ORDER BY category",
    [intakeId],
  )
  return result.rows.map((row) => row.category)
}

test("the usage migration has a unique version that sorts after every migration", () => {
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

test("rows the deployed app writes today still pass (backward compatible)", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  await insertItem(pg, intakeId, { category: "oil", source: "catalog_search", product_id: PRODUCT })
  await insertItem(pg, intakeId, { category: "mask", source: "name_research" })
  await insertItem(pg, intakeId, { category: "shampoo", source: "none", product_name_text: null })
})

test("category may be unknown; product_type is one of the ten categories or unknown", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  // „Weiß ich nicht": neither usage nor type.
  await insertItem(pg, intakeId, { category: null, product_type: null })
  // Type known, usage unknown (usage later set to „Weiß ich nicht").
  await insertItem(pg, intakeId, { category: null, product_type: "conditioner" })
  // A legitimate usage difference: a conditioner used as a mask.
  await insertItem(pg, intakeId, { category: "mask", product_type: "conditioner" })
  for (const productType of SUPPORTED_PRODUCT_CATEGORY_KEYS) {
    await insertItem(pg, intakeId, { category: productType, product_type: productType })
  }
  await assert.rejects(
    insertItem(pg, intakeId, { category: "mask", product_type: "serum" }),
    /discovery_intake_items_product_type_check/,
  )
  await assert.rejects(
    insertItem(pg, intakeId, { category: "styling_gel" }),
    /discovery_intake_items_category_check/,
  )
})

test("a usage role only goes with its own category (F5)", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  for (const role of ["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"]) {
    await insertItem(pg, intakeId, { category: "oil", product_type: "oil", usage_role: role })
  }
  await insertItem(pg, intakeId, {
    category: "scalp_care",
    product_type: "oil",
    usage_role: "scalp_flake_oil_adjunct",
  })

  const invalid: Row[] = [
    // The scalp oil role belongs to scalp care, not to the oil step.
    { category: "oil", usage_role: "scalp_flake_oil_adjunct" },
    // Oil roles never go with scalp care.
    { category: "scalp_care", usage_role: "dry_finish" },
    // No role on a single-role category.
    { category: "mask", usage_role: "leave_on_fibre_conditioning" },
    { category: "leave_in", usage_role: "dry_finish" },
    // A routine role the discovery usage does not know.
    { category: "scalp_care", usage_role: "scalp_comfort" },
    { category: "oil", usage_role: "bogus" },
    // A role without a usage category — the NULL comparison must not slip through.
    { category: null, usage_role: "dry_finish" },
    { category: null, usage_role: "scalp_flake_oil_adjunct" },
  ]
  for (const row of invalid) {
    await assert.rejects(
      insertItem(pg, intakeId, { product_type: "oil", ...row }),
      /discovery_intake_items_usage_role_pair/,
      JSON.stringify(row),
    )
  }
})

test("a „none“ row answers a category and carries no role and no product type", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  const none = { source: "none", product_name_text: null }
  await assert.rejects(
    insertItem(pg, intakeId, { ...none, category: null }),
    /discovery_intake_items_none_is_category_only/,
  )
  await assert.rejects(
    insertItem(pg, intakeId, { ...none, category: "oil", usage_role: "dry_finish" }),
    /discovery_intake_items_none_is_category_only/,
  )
  await assert.rejects(
    insertItem(pg, intakeId, { ...none, category: "oil", product_type: "oil" }),
    /discovery_intake_items_none_is_category_only/,
  )
  await insertItem(pg, intakeId, { ...none, category: "oil" })
})

test("unknown-usage rows never collide with each other or with a „none“ row", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  await insertItem(pg, intakeId, { category: null })
  await insertItem(pg, intakeId, { category: null })
  await insertItem(pg, intakeId, { category: "oil", source: "none", product_name_text: null })
  await assert.rejects(
    insertItem(pg, intakeId, { category: "oil", source: "none", product_name_text: null }),
    /discovery_intake_items_one_none_per_category/,
  )
})

test("submit-with-confirm records every category without a product as „none“ and freezes", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  await insertItem(pg, intakeId, { category: "shampoo", product_type: "shampoo" })
  // A conditioner used as a mask answers MASK, not conditioner.
  await insertItem(pg, intakeId, { category: "mask", product_type: "conditioner" })
  await insertItem(pg, intakeId, {
    category: "scalp_care",
    product_type: "oil",
    usage_role: "scalp_flake_oil_adjunct",
  })
  // Unknown usage: a product, but no category's answer.
  await insertItem(pg, intakeId, { category: null, product_type: "leave_in" })

  const result = await submit(pg, intakeId)
  assert.equal(result.outcome, "submitted")
  assert.ok(typeof result.submitted_at === "string")
  const expected = SUPPORTED_PRODUCT_CATEGORY_KEYS.filter(
    (category) => !["shampoo", "mask", "scalp_care"].includes(category),
  )
  // In the supported order; the unknown-usage leave-in does not answer „leave_in".
  assert.deepEqual(result.confirmed_none, expected)
  assert.deepEqual(await noneCategories(pg, intakeId), [...expected].sort())

  const intake = await pg.query<{ state: string; submitted_at: string | null }>(
    "SELECT state, submitted_at FROM public.discovery_intakes WHERE id = $1",
    [intakeId],
  )
  assert.equal(intake.rows[0].state, "submitted")
  assert.ok(intake.rows[0].submitted_at)

  // A second call changes nothing.
  assert.deepEqual(await submit(pg, intakeId), { outcome: "not_draft" })
  assert.equal((await noneCategories(pg, intakeId)).length, expected.length)
})

test("submit-with-confirm needs at least one product — „none“ rows and nothing do not count", async (t) => {
  const pg = await migrated(t)
  const empty = await createIntake(pg)
  assert.deepEqual(await submit(pg, empty), { outcome: "no_products" })

  const onlyNone = await createIntake(pg, "mia@example.test")
  await insertItem(pg, onlyNone, { category: "oil", source: "none", product_name_text: null })
  assert.deepEqual(await submit(pg, onlyNone), { outcome: "no_products" })

  // Nothing was written on a refusal.
  assert.deepEqual(await noneCategories(pg, empty), [])
  assert.deepEqual(await noneCategories(pg, onlyNone), ["oil"])
  const states = await pg.query<{ state: string }>(
    "SELECT state FROM public.discovery_intakes WHERE id = ANY($1::uuid[])",
    [[empty, onlyNone]],
  )
  assert.deepEqual(
    states.rows.map((row) => row.state),
    ["draft", "draft"],
  )

  // One product whose usage is unknown is enough: it counts as a product.
  await insertItem(pg, empty, { category: null, product_type: null })
  const result = await submit(pg, empty)
  assert.equal(result.outcome, "submitted")
  assert.deepEqual(result.confirmed_none, [...SUPPORTED_PRODUCT_CATEGORY_KEYS])
})

test("submit-with-confirm keeps a legacy „none“ and drops one contradicted by a product", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  await insertItem(pg, intakeId, { category: "oil", source: "none", product_name_text: null })
  await insertItem(pg, intakeId, { category: "mask", source: "none", product_name_text: null })
  await insertItem(pg, intakeId, { category: "mask", product_type: "mask" })

  const result = await submit(pg, intakeId)
  assert.equal(result.outcome, "submitted")
  // Oil already had its answer, mask has a product: neither is (re)inserted.
  assert.ok(!(result.confirmed_none as string[]).includes("oil"))
  assert.ok(!(result.confirmed_none as string[]).includes("mask"))
  const none = await noneCategories(pg, intakeId)
  assert.ok(none.includes("oil"), "the standing none survives")
  assert.ok(!none.includes("mask"), "products win over a contradicting none")
  assert.equal(none.length, SUPPORTED_PRODUCT_CATEGORY_KEYS.length - 1)
})

test("submit-with-confirm answers not_found for an intake that does not exist", async (t) => {
  const pg = await migrated(t)
  assert.deepEqual(await submit(pg, "90000000-0000-4000-8000-000000000009"), {
    outcome: "not_found",
  })
})

test("only service_role may execute the submit RPC, and its own grants suffice", async (t) => {
  const pg = await migrated(t)
  const signature = "public.discovery_intake_submit_confirming_none(uuid)"
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

  const intakeId = await createIntake(pg)
  await insertItem(pg, intakeId, { category: "oil", product_type: "oil", usage_role: "dry_finish" })
  await pg.exec("SET ROLE anon")
  await assert.rejects(submit(pg, intakeId), /permission denied/)
  await pg.exec("RESET ROLE")
  // SECURITY INVOKER: service_role's own table grants carry the call.
  await pg.exec("SET ROLE service_role")
  const result = await submit(pg, intakeId)
  await pg.exec("RESET ROLE")
  assert.equal(result.outcome, "submitted")
})
