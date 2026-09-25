import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { readdirSync } from "node:fs"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

/**
 * Batch 5 (plan Rev. 3 task 5 — R7, R10, P1-3, F3): the cockpit's usage correction is one
 * database call. Replayed on PGlite over the three discovery migrations before it.
 */

const dir = "supabase/migrations"
const CHAIN = [
  "20260922120000_discovery_call_toolkit.sql",
  "20260923120000_discovery_enrollment_optional_email.sql",
  "20260924120000_discovery_intake_usage_product_type.sql",
  "20260924140000_discovery_admin_item_usage.sql",
]
const OWN = CHAIN[3]

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
const SWAP = "20000000-0000-4000-8000-000000000003"

async function migrated(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(async () => pg.close())
  await pg.exec(predecessorSchema)
  for (const file of CHAIN) await pg.exec(await readFile(`${dir}/${file}`, "utf8"))
  await pg.query("INSERT INTO public.profiles (id, email) VALUES ($1, 'lea@example.test')", [USER])
  await pg.query("INSERT INTO public.products (id, name) VALUES ($1, 'Elixir'), ($2, 'Tausch')", [
    PRODUCT,
    SWAP,
  ])
  return pg
}

let enrollmentCount = 0

async function createIntake(pg: PGlite, state: "draft" | "submitted" = "submitted") {
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
  product_id?: string | null
  product_name_text?: string | null
}

async function insertItem(pg: PGlite, intakeId: string, row: Row): Promise<string> {
  const full = {
    category: null,
    source: "catalog_search",
    product_type: null,
    usage_role: null,
    product_id: PRODUCT,
    product_name_text: "Irgendwas",
    ...row,
  }
  const inserted = await pg.query<{ id: string }>(
    `INSERT INTO public.discovery_intake_items
       (intake_id, category, source, product_type, usage_role, product_id, product_name_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      intakeId,
      full.category,
      full.source,
      full.product_type,
      full.usage_role,
      full.product_id,
      full.product_name_text,
    ],
  )
  return inserted.rows[0].id
}

function none(pg: PGlite, intakeId: string, category: string) {
  return insertItem(pg, intakeId, {
    category,
    source: "none",
    product_id: null,
    product_name_text: null,
  })
}

async function decide(
  pg: PGlite,
  intakeId: string,
  decisionKey: string,
  itemId: string | null,
  swap = false,
) {
  await pg.query(
    `INSERT INTO public.discovery_call_decisions
       (intake_id, decision_key, decision, swap_product_id, intake_item_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [intakeId, decisionKey, swap ? "swap" : "keep", swap ? SWAP : null, itemId],
  )
}

async function correct(
  pg: PGlite,
  input: {
    intakeId: string
    itemId: string
    category: string
    role?: string | null
    productType?: string | null
    staleKeys?: string[]
  },
) {
  const result = await pg.query<{ result: Record<string, unknown> }>(
    "SELECT public.discovery_admin_set_intake_item_usage($1, $2, $3, $4, $5, $6) AS result",
    [
      input.intakeId,
      input.itemId,
      input.category,
      input.role ?? null,
      input.productType ?? null,
      input.staleKeys ?? [],
    ],
  )
  return result.rows[0].result
}

async function item(pg: PGlite, itemId: string) {
  const result = await pg.query<{
    category: string | null
    usage_role: string | null
    product_type: string | null
  }>("SELECT category, usage_role, product_type FROM public.discovery_intake_items WHERE id = $1", [
    itemId,
  ])
  return result.rows[0]
}

async function noneCategories(pg: PGlite, intakeId: string) {
  const result = await pg.query<{ category: string }>(
    "SELECT category FROM public.discovery_intake_items WHERE intake_id = $1 AND source = 'none' ORDER BY category",
    [intakeId],
  )
  return result.rows.map((row) => row.category)
}

async function decisionKeys(pg: PGlite, intakeId: string) {
  const result = await pg.query<{ decision_key: string }>(
    "SELECT decision_key FROM public.discovery_call_decisions WHERE intake_id = $1 ORDER BY decision_key",
    [intakeId],
  )
  return result.rows.map((row) => row.decision_key)
}

const COND_KEY = "decision:conditioner:conditioner_rinse_out:gap"
const MASK_KEY = "decision:mask:intensive_conditioning_mask:gap"
const OIL_PRE_KEY = "decision:oil:pre_wash_fibre_treatment:gap"

test("the usage-correction migration has a unique version that sorts after the migrations it builds on", () => {
  const versions = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.split("_")[0])
  const own = OWN.split("_")[0]
  assert.equal(versions.filter((version) => version === own).length, 1)
  // Was "sorts after every migration" when it was the newest; hair_profiles.primary_concern
  // (20260925100000) now follows it, so what still matters is that it follows its chain.
  assert.ok(
    CHAIN.slice(0, 3).every((file) => file.split("_")[0] < own),
    "must sort after the discovery migrations it builds on",
  )
})

test("moving a kept product: vacated category becomes „none“, destination „none“ goes, its decision is cleared", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  const conditioner = await insertItem(pg, intakeId, {
    category: "conditioner",
    product_type: "conditioner",
  })
  await none(pg, intakeId, "mask")
  await decide(pg, intakeId, COND_KEY, conditioner)

  const result = await correct(pg, { intakeId, itemId: conditioner, category: "mask" })

  assert.equal(result.outcome, "updated")
  assert.equal(result.vacated_category, "conditioner")
  assert.equal(result.none_removed, true)
  assert.equal(result.none_inserted, true)
  assert.equal(result.decisions_cleared, 1)
  assert.deepEqual(await item(pg, conditioner), {
    category: "mask",
    usage_role: null,
    product_type: "conditioner",
  })
  // Her confirmation covered the whole list: the old category is honestly empty now.
  assert.deepEqual(await noneCategories(pg, intakeId), ["conditioner"])
  assert.deepEqual(await decisionKeys(pg, intakeId), [])
})

test("moving a swapped product clears its swap and the destination step's stale decision", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  const moving = await insertItem(pg, intakeId, {
    category: "conditioner",
    product_type: "conditioner",
  })
  const stays = await insertItem(pg, intakeId, {
    category: "conditioner",
    product_type: "conditioner",
  })
  const maskItem = await insertItem(pg, intakeId, { category: "mask", product_type: "mask" })
  await decide(pg, intakeId, COND_KEY, moving, true)
  // The mask step's decision was made for another item that the move displaces.
  await decide(pg, intakeId, MASK_KEY, maskItem)
  await decide(pg, intakeId, OIL_PRE_KEY, null)

  const result = await correct(pg, {
    intakeId,
    itemId: moving,
    category: "mask",
    staleKeys: [MASK_KEY],
  })

  assert.equal(result.outcome, "updated")
  // The vacated category still holds a product: no „none“.
  assert.equal(result.none_inserted, false)
  assert.deepEqual(await noneCategories(pg, intakeId), [])
  assert.equal(result.decisions_cleared, 2)
  // An unrelated step's decision survives.
  assert.deepEqual(await decisionKeys(pg, intakeId), [OIL_PRE_KEY])
  assert.equal((await item(pg, stays)).category, "conditioner")
})

test("a role change inside oil keeps the category and clears the item's decisions", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  const oil = await insertItem(pg, intakeId, {
    category: "oil",
    product_type: "oil",
    usage_role: "pre_wash_fibre_treatment",
  })
  await decide(pg, intakeId, OIL_PRE_KEY, oil)

  const result = await correct(pg, { intakeId, itemId: oil, category: "oil", role: "dry_finish" })

  assert.equal(result.outcome, "updated")
  assert.equal(result.none_inserted, false)
  assert.deepEqual(await item(pg, oil), {
    category: "oil",
    usage_role: "dry_finish",
    product_type: "oil",
  })
  assert.deepEqual(await decisionKeys(pg, intakeId), [])
})

test("an oil used on the scalp moves to scalp care with the scalp oil role", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  const oil = await insertItem(pg, intakeId, { category: "oil", product_type: "oil" })
  await none(pg, intakeId, "scalp_care")

  const result = await correct(pg, {
    intakeId,
    itemId: oil,
    category: "scalp_care",
    role: "scalp_flake_oil_adjunct",
  })

  assert.equal(result.outcome, "updated")
  assert.deepEqual(await noneCategories(pg, intakeId), ["oil"])
})

test("an invalid usage/role pair is refused by the table's CHECK", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  const oil = await insertItem(pg, intakeId, { category: "oil", product_type: "oil" })
  await assert.rejects(
    correct(pg, { intakeId, itemId: oil, category: "mask", role: "dry_finish" }),
    /usage_role_pair/,
  )
})

test("„Kategorie offen“: a type-open item gets its type and usage; the destination „none“ goes", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  const open = await insertItem(pg, intakeId, {
    category: null,
    source: "name_research",
    product_id: null,
  })
  await none(pg, intakeId, "mask")

  const refused = await correct(pg, { intakeId, itemId: open, category: "mask" })
  assert.equal(refused.outcome, "product_type_required")

  const result = await correct(pg, {
    intakeId,
    itemId: open,
    category: "mask",
    productType: "conditioner",
  })
  assert.equal(result.outcome, "updated")
  // Nothing was vacated: the item had no usage before.
  assert.equal(result.vacated_category, null)
  assert.equal(result.none_inserted, false)
  assert.deepEqual(await item(pg, open), {
    category: "mask",
    usage_role: null,
    product_type: "conditioner",
  })
  assert.deepEqual(await noneCategories(pg, intakeId), [])
})

test("a known product type is never overwritten", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  const catalog = await insertItem(pg, intakeId, { category: null, product_type: "conditioner" })
  const result = await correct(pg, {
    intakeId,
    itemId: catalog,
    category: "mask",
    productType: "mask",
  })
  assert.equal(result.outcome, "type_known")
  assert.equal((await item(pg, catalog)).product_type, "conditioner")

  // Its usage alone is fine.
  assert.equal(
    (await correct(pg, { intakeId, itemId: catalog, category: "mask" })).outcome,
    "updated",
  )
})

test("refused while finalized, while a draft, and for another intake's item", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  const conditioner = await insertItem(pg, intakeId, {
    category: "conditioner",
    product_type: "conditioner",
  })
  await pg.query(
    "UPDATE public.discovery_intakes SET call_finalized_at = now(), finalized_source_hash = 'h' WHERE id = $1",
    [intakeId],
  )
  assert.deepEqual(await correct(pg, { intakeId, itemId: conditioner, category: "mask" }), {
    outcome: "finalized",
  })
  assert.equal((await item(pg, conditioner)).category, "conditioner")

  const draft = await createIntake(pg, "draft")
  const draftItem = await insertItem(pg, draft, {
    category: "conditioner",
    product_type: "conditioner",
  })
  assert.deepEqual(await correct(pg, { intakeId: draft, itemId: draftItem, category: "mask" }), {
    outcome: "not_submitted",
  })

  const other = await createIntake(pg)
  assert.deepEqual(await correct(pg, { intakeId: other, itemId: conditioner, category: "mask" }), {
    outcome: "item_not_found",
  })
  assert.deepEqual(
    await correct(pg, {
      intakeId: "90000000-0000-4000-8000-000000000009",
      itemId: conditioner,
      category: "mask",
    }),
    { outcome: "not_found" },
  )
})

test("a „none“ row is not an item the correction can move", async (t) => {
  const pg = await migrated(t)
  const intakeId = await createIntake(pg)
  const answer = await none(pg, intakeId, "mask")
  assert.deepEqual(await correct(pg, { intakeId, itemId: answer, category: "oil" }), {
    outcome: "item_not_found",
  })
})

test("only service_role may execute the correction, and its own grants suffice", async (t) => {
  const pg = await migrated(t)
  const signature =
    "public.discovery_admin_set_intake_item_usage(uuid, uuid, text, text, text, text[])"
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
  const conditioner = await insertItem(pg, intakeId, {
    category: "conditioner",
    product_type: "conditioner",
  })
  await pg.exec("SET ROLE authenticated")
  await assert.rejects(
    correct(pg, { intakeId, itemId: conditioner, category: "mask" }),
    /permission denied/,
  )
  await pg.exec("RESET ROLE")
  await pg.exec("SET ROLE service_role")
  const result = await correct(pg, { intakeId, itemId: conditioner, category: "mask" })
  await pg.exec("RESET ROLE")
  assert.equal(result.outcome, "updated")
})
