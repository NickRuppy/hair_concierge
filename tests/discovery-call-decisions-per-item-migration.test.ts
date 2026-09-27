import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

import type { DiscoveryIdealStep } from "../src/lib/discovery/load-ideal-routine"
import {
  reduceIntakeItemsToSteps,
  type DiscoveryIntakeItem,
} from "../src/lib/discovery/refined-routine"

/**
 * Batch 9 (plan `plans/discovery-multi-product/plan.md` Rev. 2, D2): one call decision per
 * (step, product), the new `drop`, the cascade, and the locked decision write
 * `discovery_admin_set_call_decision`. Replayed on PGlite over the discovery migrations.
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

async function rows(pg: PGlite, intakeId: string) {
  const result = await pg.query<{
    decision_key: string
    intake_item_id: string | null
    decision: string
    swap_product_id: string | null
  }>(
    `SELECT decision_key, intake_item_id, decision, swap_product_id
       FROM public.discovery_call_decisions WHERE intake_id = $1
      ORDER BY decision_key, intake_item_id NULLS FIRST`,
    [intakeId],
  )
  return result.rows
}

test("the migration has a unique version that sorts after every migration", () => {
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

test("one row per (step, product); an empty step still holds exactly one (NULLS NOT DISTINCT)", async (t) => {
  const pg = await migrated(t)
  const intakeId = await intake(pg)
  const [a, b] = [await shampoo(pg, intakeId), await shampoo(pg, intakeId)]
  const insert = (
    key: string,
    itemId: string | null,
    decision = "keep",
    swap: string | null = null,
  ) =>
    pg.query(
      "INSERT INTO public.discovery_call_decisions (intake_id, decision_key, intake_item_id, decision, swap_product_id) VALUES ($1, $2, $3, $4, $5)",
      [intakeId, key, itemId, decision, swap],
    )

  await insert(KEY, a)
  await insert(KEY, b, "drop")
  await assert.rejects(insert(KEY, a), /discovery_call_decisions_one_per_item/)
  await insert(EMPTY_KEY, null)
  await assert.rejects(insert(EMPTY_KEY, null), /discovery_call_decisions_one_per_item/)
  await assert.rejects(
    insert("decision:x:y:gap", null, "drop"),
    /discovery_call_decisions_drop_names_item/,
  )
  await assert.rejects(
    insert("decision:x:y:gap", a, "drop", SWAP),
    /discovery_call_decisions_swap_pair/,
  )
  await assert.rejects(
    insert("decision:x:y:gap", a, "replace"),
    /discovery_call_decisions_decision_check/,
  )
})

test("a deleted product takes its decisions with it (ON DELETE CASCADE)", async (t) => {
  const pg = await migrated(t)
  const intakeId = await intake(pg)
  const [a, b] = [await shampoo(pg, intakeId), await shampoo(pg, intakeId)]
  await decide(pg, { intakeId, itemId: a, decision: "keep", siblings: [b] })
  await decide(pg, { intakeId, itemId: b, decision: "keep", siblings: [a] })
  await pg.query("DELETE FROM public.discovery_intake_items WHERE id = $1", [a])
  assert.deepEqual(
    (await rows(pg, intakeId)).map((row) => row.intake_item_id),
    [b],
  )
})

test("the write upserts on (intake, step, product) — for a product and for an empty step", async (t) => {
  const pg = await migrated(t)
  const intakeId = await intake(pg)
  const [a, b] = [await shampoo(pg, intakeId), await shampoo(pg, intakeId)]

  const first = await decide(pg, { intakeId, itemId: a, decision: "keep", siblings: [b] })
  assert.deepEqual(first, {
    outcome: "stored",
    decision_key: KEY,
    decision: "keep",
    swap_product_id: null,
    intake_item_id: a,
  })
  await decide(pg, { intakeId, itemId: a, decision: "swap", swap: SWAP, siblings: [b] })
  await decide(pg, { intakeId, key: EMPTY_KEY, itemId: null, decision: "keep" })
  await decide(pg, { intakeId, key: EMPTY_KEY, itemId: null, decision: "swap", swap: SWAP_TWO })

  assert.deepEqual(await rows(pg, intakeId), [
    { decision_key: EMPTY_KEY, intake_item_id: null, decision: "swap", swap_product_id: SWAP_TWO },
    { decision_key: KEY, intake_item_id: a, decision: "swap", swap_product_id: SWAP },
  ])
})

test("drop needs a sibling that stays; the last one refuses (drop_last)", async (t) => {
  const pg = await migrated(t)
  const intakeId = await intake(pg)
  const [a, b] = [await shampoo(pg, intakeId), await shampoo(pg, intakeId)]

  assert.equal((await decide(pg, { intakeId, itemId: a, decision: "drop" })).outcome, "drop_last")
  assert.equal(
    (await decide(pg, { intakeId, itemId: a, decision: "drop", siblings: [b] })).outcome,
    "stored",
  )
  // b is now the only one left in the step.
  assert.equal(
    (await decide(pg, { intakeId, itemId: b, decision: "drop", siblings: [a] })).outcome,
    "drop_last",
  )
  // A foreign „sibling" (another intake's product) never counts.
  const other = await shampoo(pg, await intake(pg))
  assert.equal(
    (await decide(pg, { intakeId, itemId: b, decision: "drop", siblings: [a, other] })).outcome,
    "drop_last",
  )
  // Bringing a back frees b to go.
  await decide(pg, { intakeId, itemId: a, decision: "keep", siblings: [b] })
  assert.equal(
    (await decide(pg, { intakeId, itemId: b, decision: "drop", siblings: [a] })).outcome,
    "stored",
  )
})

test("two products of one step never swap to the same product (swap_taken)", async (t) => {
  const pg = await migrated(t)
  const intakeId = await intake(pg)
  const [a, b] = [await shampoo(pg, intakeId), await shampoo(pg, intakeId)]
  await decide(pg, { intakeId, itemId: a, decision: "swap", swap: SWAP, siblings: [b] })
  assert.equal(
    (await decide(pg, { intakeId, itemId: b, decision: "swap", swap: SWAP, siblings: [a] }))
      .outcome,
    "swap_taken",
  )
  // The same product may re-save its own swap.
  assert.equal(
    (await decide(pg, { intakeId, itemId: a, decision: "swap", swap: SWAP, siblings: [b] }))
      .outcome,
    "stored",
  )
  // Another step is another matter.
  assert.equal(
    (await decide(pg, { intakeId, key: EMPTY_KEY, itemId: null, decision: "swap", swap: SWAP }))
      .outcome,
    "stored",
  )
})

test("a draft intake is decidable, as before batch 9 — only finalised and unknown intakes refuse", async (t) => {
  const pg = await migrated(t)
  const draft = await intake(pg, "draft")
  const [a, b] = [await shampoo(pg, draft), await shampoo(pg, draft)]
  assert.equal(
    (await decide(pg, { intakeId: draft, itemId: a, decision: "keep", siblings: [b] })).outcome,
    "stored",
  )
  assert.equal(
    (await decide(pg, { intakeId: draft, key: EMPTY_KEY, itemId: null, decision: "keep" })).outcome,
    "stored",
  )
})

test("a sibling moved out of the step between compose and write never counts — drop refused (P1)", async (t) => {
  const pg = await migrated(t)
  const intakeId = await intake(pg)
  const [a, b] = [await shampoo(pg, intakeId), await shampoo(pg, intakeId)]
  // The route composed {a, b} in the shampoo step; then a usage correction moved b away.
  await pg.query(
    "UPDATE public.discovery_intake_items SET category = 'conditioner' WHERE id = $1",
    [b],
  )
  assert.equal(
    (await decide(pg, { intakeId, itemId: a, decision: "drop", siblings: [b] })).outcome,
    "drop_last",
  )
  // A sibling whose ROLE moved counts as moved too.
  const [oil, oilSibling] = [await shampoo(pg, intakeId), await shampoo(pg, intakeId)]
  await pg.query(
    "UPDATE public.discovery_intake_items SET category = 'oil', usage_role = 'dry_finish' WHERE id = ANY($1::uuid[])",
    [[oil, oilSibling]],
  )
  await pg.query(
    "UPDATE public.discovery_intake_items SET usage_role = 'pre_wash_fibre_treatment' WHERE id = $1",
    [oilSibling],
  )
  const dryKey = "decision:oil:dry_finish:gap"
  const oilExpected = { category: "oil", role: "dry_finish" }
  assert.equal(
    (
      await decide(pg, {
        intakeId,
        key: dryKey,
        itemId: oil,
        decision: "drop",
        siblings: [{ id: oilSibling, category: "oil", role: "dry_finish" }],
        expected: oilExpected,
      })
    ).outcome,
    "drop_last",
  )
  assert.deepEqual(await rows(pg, intakeId), [])
})

test("a step legitimately holding different raw roles (as the reducer binds it): drop succeeds", async (t) => {
  const pg = await migrated(t)
  const intakeId = await intake(pg)
  const rows = await pg.query<{ id: string; usage_role: string | null; created_at: string }>(
    `INSERT INTO public.discovery_intake_items (intake_id, category, source, product_name_text, product_id, usage_role)
     VALUES ($1, 'conditioner', 'catalog_search', 'Vor der Wäsche', $2, 'pre_wash_conditioner'),
            ($1, 'conditioner', 'catalog_search', 'Spülung', $3, NULL)
     RETURNING id, usage_role, created_at::text`,
    [intakeId, SWAP, SWAP_TWO],
  )
  // The real binding: the pre-wash conditioner binds role-less, so both share the one
  // conditioner step although their raw roles differ.
  const conditionerKey = "decision:conditioner:conditioner_rinse_out:gap"
  const conditionerStep = {
    decisionKey: conditionerKey,
    category: "conditioner",
    role: "conditioner_rinse_out",
    section: "basis",
    categoryLabel: "Conditioner",
    roleLabel: "Pflege",
    roleDescription: null,
    frequencyLabel: "nach jeder Wäsche",
    preview: null,
  } as DiscoveryIdealStep
  const items: DiscoveryIntakeItem[] = rows.rows.map((row, index) => ({
    id: row.id,
    category: "conditioner",
    source: "catalog_search",
    brandText: null,
    productNameText: "x",
    barcodeIdentifier: null,
    productId: index === 0 ? SWAP : SWAP_TWO,
    productSubmissionId: null,
    createdAt: row.created_at,
    ...(row.usage_role ? { usageRole: "pre_wash_conditioner" as const } : {}),
  }))
  const bound = reduceIntakeItemsToSteps([conditionerStep], items).bindings
  assert.equal(bound.length, 2)
  assert.ok(bound.every((binding) => binding.step.decisionKey === conditionerKey))
  const [target, sibling] = bound.map((binding) => binding.item!)
  assert.notEqual(target!.usageRole ?? null, sibling!.usageRole ?? null, "different raw roles")

  const result = await decide(pg, {
    intakeId,
    key: conditionerKey,
    itemId: target!.id,
    decision: "drop",
    expected: { category: "conditioner", role: target!.usageRole ?? null },
    siblings: [{ id: sibling!.id, category: "conditioner", role: sibling!.usageRole ?? null }],
  })
  assert.equal(result.outcome, "stored")
})

test("the target itself moved since the route composed it: stale_binding, nothing written (P1)", async (t) => {
  const pg = await migrated(t)
  const intakeId = await intake(pg)
  const [a, b] = [await shampoo(pg, intakeId), await shampoo(pg, intakeId)]
  await pg.query(
    "UPDATE public.discovery_intake_items SET category = 'conditioner' WHERE id = $1",
    [a],
  )
  for (const decision of ["keep", "drop"] as const) {
    assert.equal(
      (await decide(pg, { intakeId, itemId: a, decision, siblings: [b] })).outcome,
      "stale_binding",
    )
  }
  assert.equal(
    (
      await decide(pg, {
        intakeId,
        itemId: a,
        decision: "keep",
        expected: { category: "shampoo", role: "shampoo_everyday" },
      })
    ).outcome,
    "stale_binding",
    "a role that differs is stale as well",
  )
  assert.deepEqual(await rows(pg, intakeId), [])
})

test("finalised, unknown intake and a foreign product are refused without a write", async (t) => {
  const pg = await migrated(t)
  const frozen = await intake(pg, "finalized")
  const live = await intake(pg)
  const foreign = await shampoo(pg, frozen)

  assert.equal(
    (await decide(pg, { intakeId: frozen, itemId: foreign, decision: "keep" })).outcome,
    "finalized",
  )
  assert.equal(
    (
      await decide(pg, {
        intakeId: "40000000-0000-4000-8000-0000000000ff",
        itemId: null,
        decision: "keep",
      })
    ).outcome,
    "not_found",
  )
  assert.equal(
    (await decide(pg, { intakeId: live, itemId: foreign, decision: "keep" })).outcome,
    "item_not_found",
  )
  for (const id of [frozen, live]) assert.deepEqual(await rows(pg, id), [])
})

test("the write is service-role only and locks the intake row first", async (t) => {
  const pg = await migrated(t)
  const signature =
    "public.discovery_admin_set_call_decision(uuid, text, uuid, text, text, text, uuid, jsonb)"
  const privileges = await pg.query<{ anon: boolean; member: boolean; service: boolean }>(
    `SELECT has_function_privilege('anon', $1, 'EXECUTE') AS anon,
            has_function_privilege('authenticated', $1, 'EXECUTE') AS member,
            has_function_privilege('service_role', $1, 'EXECUTE') AS service`,
    [signature],
  )
  assert.deepEqual(privileges.rows[0], { anon: false, member: false, service: true })

  const definition = await pg.query<{ secdef: boolean; config: string[] | null }>(
    "SELECT prosecdef AS secdef, proconfig AS config FROM pg_proc WHERE oid = $1::regprocedure",
    [signature],
  )
  assert.equal(definition.rows[0].secdef, false, "SECURITY INVOKER")
  assert.deepEqual(definition.rows[0].config, ['search_path=""'])

  const sql = await readFile(`${dir}/${OWN}`, "utf8")
  const body = sql.slice(sql.indexOf("CREATE FUNCTION public.discovery_admin_set_call_decision"))
  const lock = body.indexOf("FOR UPDATE")
  assert.ok(lock > 0 && lock < body.indexOf("discovery_call_decisions"), "intake row lock first")
  assert.match(body.slice(0, lock), /FROM public\.discovery_intakes/)
})
