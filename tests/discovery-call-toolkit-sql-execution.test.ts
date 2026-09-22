import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

const migrationPath = "supabase/migrations/20260922120000_discovery_call_toolkit.sql"

const ids = {
  participant: "10000000-0000-4000-8000-000000000001",
  product: "20000000-0000-4000-8000-000000000002",
  alternative: "20000000-0000-4000-8000-000000000003",
  submission: "30000000-0000-4000-8000-000000000004",
}

const predecessorSchema = `
CREATE SCHEMA auth;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = pg_catalog.now(); RETURN NEW; END;
$$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text NOT NULL
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
);

CREATE TABLE public.product_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approved_product_id uuid REFERENCES public.products (id)
);
`

async function migratedDatabase(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(async () => pg.close())
  await pg.exec(predecessorSchema)
  await pg.exec(await readFile(migrationPath, "utf8"))
  await pg.query("INSERT INTO public.profiles (id, email) VALUES ($1, 'lea@example.test')", [
    ids.participant,
  ])
  await pg.query(
    "INSERT INTO public.products (id, name) VALUES ($1, 'Ideal'), ($2, 'Alternative')",
    [ids.product, ids.alternative],
  )
  await pg.query("INSERT INTO public.product_submissions (id) VALUES ($1)", [ids.submission])
  return pg
}

async function createEnrollment(pg: PGlite, email = "lea@example.test") {
  const result = await pg.query<{ id: string }>(
    "INSERT INTO public.discovery_enrollments (display_name, normalized_email) VALUES ('Lea Sommer', $1) RETURNING id",
    [email],
  )
  return result.rows[0].id
}

async function createIntake(pg: PGlite, email = "lea@example.test") {
  const enrollmentId = await createEnrollment(pg, email)
  const result = await pg.query<{ id: string }>(
    "INSERT INTO public.discovery_intakes (enrollment_id, user_id) VALUES ($1, $2) RETURNING id",
    [enrollmentId, ids.participant],
  )
  return { enrollmentId, intakeId: result.rows[0].id }
}

test("the discovery migration applies clean and leaves every table service-only", async (t) => {
  const pg = await migratedDatabase(t)

  for (const table of [
    "discovery_enrollments",
    "discovery_intakes",
    "discovery_intake_items",
    "discovery_call_decisions",
  ]) {
    const state = await pg.query<{
      rls: boolean
      anon: boolean
      member: boolean
      service: boolean
    }>(
      `SELECT relrowsecurity AS rls,
              has_table_privilege('anon', $1, 'SELECT') AS anon,
              has_table_privilege('authenticated', $1, 'SELECT') AS member,
              has_table_privilege('service_role', $1, 'SELECT') AS service
         FROM pg_class WHERE oid = $1::regclass`,
      [`public.${table}`],
    )
    assert.deepEqual(
      state.rows[0],
      { rls: true, anon: false, member: false, service: true },
      `${table} must be service-only with RLS enabled`,
    )
  }
})

test("an enrollment holds one live invitation per participant and per account", async (t) => {
  const pg = await migratedDatabase(t)
  const enrollmentId = await createEnrollment(pg)

  await assert.rejects(createEnrollment(pg), /discovery_enrollments_one_current_email/)
  await assert.rejects(
    createEnrollment(pg, "LEA@example.test"),
    /discovery_enrollments_normalized_email_check/,
  )

  // Revoking frees the address: the same person can be re-invited later.
  await pg.query("UPDATE public.discovery_enrollments SET revoked_at = now() WHERE id = $1", [
    enrollmentId,
  ])
  const reinvited = await createEnrollment(pg)

  await assert.rejects(
    pg.query("UPDATE public.discovery_enrollments SET claimed_user_id = $1 WHERE id = $2", [
      ids.participant,
      reinvited,
    ]),
    /discovery_enrollments_claim_pair/,
  )
  await pg.query(
    "UPDATE public.discovery_enrollments SET claimed_user_id = $1, claimed_at = now() WHERE id = $2",
    [ids.participant, reinvited],
  )
  const second = await createEnrollment(pg, "mia@example.test")
  await assert.rejects(
    pg.query(
      "UPDATE public.discovery_enrollments SET claimed_user_id = $1, claimed_at = now() WHERE id = $2",
      [ids.participant, second],
    ),
    /discovery_enrollments_one_current_claimed_user/,
  )
})

test("an intake can only be finalized after submit, and never half-finalized", async (t) => {
  const pg = await migratedDatabase(t)
  const { intakeId } = await createIntake(pg)

  await assert.rejects(
    pg.query("UPDATE public.discovery_intakes SET state = 'submitted' WHERE id = $1", [intakeId]),
    /discovery_intakes_submitted_pair/,
  )
  await assert.rejects(
    pg.query(
      "UPDATE public.discovery_intakes SET call_finalized_at = now(), finalized_source_hash = 'hash-1' WHERE id = $1",
      [intakeId],
    ),
    /discovery_intakes_finalize_requires_submit/,
  )

  await pg.query(
    "UPDATE public.discovery_intakes SET state = 'submitted', submitted_at = now() WHERE id = $1",
    [intakeId],
  )
  await assert.rejects(
    pg.query("UPDATE public.discovery_intakes SET call_finalized_at = now() WHERE id = $1", [
      intakeId,
    ]),
    /discovery_intakes_finalized_pair/,
  )
  await assert.rejects(
    pg.query("UPDATE public.discovery_intakes SET finalized_source_hash = 'hash-1' WHERE id = $1", [
      intakeId,
    ]),
    /discovery_intakes_finalized_pair/,
  )

  await pg.query(
    "UPDATE public.discovery_intakes SET call_finalized_at = now(), finalized_source_hash = 'hash-1' WHERE id = $1",
    [intakeId],
  )
  // Un-finalizing clears both fields together.
  await pg.query(
    "UPDATE public.discovery_intakes SET call_finalized_at = NULL, finalized_source_hash = NULL WHERE id = $1",
    [intakeId],
  )

  const { enrollmentId } = await createIntake(pg, "mia@example.test")
  await assert.rejects(
    pg.query("INSERT INTO public.discovery_intakes (enrollment_id, user_id) VALUES ($1, $2)", [
      enrollmentId,
      ids.participant,
    ]),
    /discovery_intakes_enrollment_id_key/,
  )
})

test("items allow several products per category but exactly one explicit 'none'", async (t) => {
  const pg = await migratedDatabase(t)
  const { intakeId } = await createIntake(pg)

  const insert = (columns: string, values: string, params: unknown[]) =>
    pg.query(
      `INSERT INTO public.discovery_intake_items (intake_id, ${columns}) VALUES ($1, ${values})`,
      [intakeId, ...params],
    )

  await insert(
    "category, source, brand_text, product_name_text, product_id",
    "$2, $3, $4, $5, $6",
    ["oil", "catalog_search", "Olaplex", "No. 7 Bonding Oil", ids.product],
  )
  await insert(
    "category, source, brand_text, product_name_text, barcode_identifier",
    "$2, $3, $4, $5, $6",
    ["oil", "barcode", "Kérastase", "Elixir Ultime", "4006381333931"],
  )
  await insert("category, source, product_name_text, product_submission_id", "$2, $3, $4, $5", [
    "mask",
    "name_research",
    "Unbekannte Maske",
    ids.submission,
  ])

  await assert.rejects(
    insert("category, source, product_name_text", "$2, $3, $4", [
      "styling_gel",
      "catalog_search",
      "Gel",
    ]),
    /discovery_intake_items_category_check/,
  )
  await assert.rejects(
    insert("category, source, product_name_text", "$2, $3, $4", ["shampoo", "imported", "Shampoo"]),
    /discovery_intake_items_source_check/,
  )
  await assert.rejects(
    insert("category, source", "$2, $3", ["shampoo", "catalog_search"]),
    /discovery_intake_items_captured_has_identity/,
  )
  await assert.rejects(
    insert("category, source, product_name_text", "$2, $3, $4", [
      "shampoo",
      "none",
      "Irgendein Shampoo",
    ]),
    /discovery_intake_items_none_is_empty/,
  )

  await insert("category, source", "$2, $3", ["dry_shampoo", "none"])
  await assert.rejects(
    insert("category, source", "$2, $3", ["dry_shampoo", "none"]),
    /discovery_intake_items_one_none_per_category/,
  )
  // A different category may also be answered with "benutze ich nicht".
  await insert("category, source", "$2, $3", ["bondbuilder", "none"])
})

test("a decision is one row per routine step and a swap always names a product", async (t) => {
  const pg = await migratedDatabase(t)
  const { intakeId } = await createIntake(pg)

  const decide = (decisionKey: string, decision: string, swapProductId: string | null) =>
    pg.query(
      "INSERT INTO public.discovery_call_decisions (intake_id, decision_key, decision, swap_product_id) VALUES ($1, $2, $3, $4)",
      [intakeId, decisionKey, decision, swapProductId],
    )

  await decide("decision:shampoo:cleanse:gap", "keep", null)
  await assert.rejects(
    decide("decision:shampoo:cleanse:gap", "keep", null),
    /discovery_call_decisions_intake_id_decision_key_key/,
  )
  await assert.rejects(
    decide("decision:shampoo:cleanse:gap", "keep", ids.alternative),
    /discovery_call_decisions_swap_pair/,
  )
  await assert.rejects(
    decide("decision:mask:treat:gap", "swap", null),
    /discovery_call_decisions_swap_pair/,
  )
  await assert.rejects(
    decide("decision:mask:treat:gap", "replace", ids.alternative),
    /discovery_call_decisions_decision_check/,
  )

  // An ideal step the participant owns nothing for is still decidable.
  await decide("decision:mask:treat:gap", "swap", ids.alternative)
  const bound = await pg.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.discovery_call_decisions WHERE intake_id = $1 AND intake_item_id IS NULL",
    [intakeId],
  )
  assert.equal(bound.rows[0].count, "2")
})
