import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

import {
  DISCOVERY_INTAKE_CATEGORIES,
  buildDiscoveryIntakeItemRow,
  discoveryIntakeItemBodySchema,
  type DiscoveryIntakeCapture,
} from "../src/lib/discovery/intake"
import { missingDiscoveryIntakeCategories } from "../src/lib/discovery/refined-routine"

/**
 * The checklist's row mapping: one capture in, one `discovery_intake_items` row
 * out. Every source is covered, both `POST /api/scan/submit` outcomes are
 * covered, and the rows are then actually INSERTED against the real migration in
 * PGlite — which is what proves the mapping satisfies
 * `discovery_intake_items_captured_has_identity` rather than merely claiming to.
 */

const INTAKE = "40000000-0000-4000-8000-000000000001"
const PRODUCT = "20000000-0000-4000-8000-000000000002"
const SUBMISSION = "30000000-0000-4000-8000-000000000004"

function row(
  capture: DiscoveryIntakeCapture,
  category: (typeof DISCOVERY_INTAKE_CATEGORIES)[number] = "shampoo",
) {
  const built = buildDiscoveryIntakeItemRow(INTAKE, category, capture)
  assert.equal(built.ok, true, `expected a row for source ${capture.source}`)
  return built.ok ? built.row : null!
}

// --- One mapping per source --------------------------------------------------

test("a catalog-search pick stores the product id AND the wording the row showed", () => {
  assert.deepEqual(
    row({
      source: "catalog_search",
      productId: PRODUCT,
      brandText: "L'Oréal Elvital",
      productNameText: "Elvital Hyaluron Pure Shampoo",
    }),
    {
      intake_id: INTAKE,
      category: "shampoo",
      source: "catalog_search",
      brand_text: "L'Oréal Elvital",
      product_name_text: "Elvital Hyaluron Pure Shampoo",
      barcode_identifier: null,
      product_id: PRODUCT,
      product_submission_id: null,
    },
  )
})

test("a resolved barcode keeps the barcode next to the product id", () => {
  assert.deepEqual(
    row({
      source: "barcode",
      productId: PRODUCT,
      barcodeIdentifier: "4005808858149",
      brandText: "Nivea",
      productNameText: "Nivea Shampoo",
    }),
    {
      intake_id: INTAKE,
      category: "shampoo",
      source: "barcode",
      brand_text: "Nivea",
      product_name_text: "Nivea Shampoo",
      barcode_identifier: "4005808858149",
      product_id: PRODUCT,
      product_submission_id: null,
    },
  )
})

test("an unknown barcode is identified by the barcode itself, with no text at all", () => {
  const built = row({
    source: "barcode_unknown",
    barcodeIdentifier: "4005808858149",
    productSubmissionId: SUBMISSION,
  })
  assert.equal(built.barcode_identifier, "4005808858149")
  assert.equal(built.product_submission_id, SUBMISSION)
  assert.equal(built.product_id, null)
  assert.equal(built.product_name_text, null)
  assert.equal(built.brand_text, null)
})

test("a dm row stores the gtin plus the dm wording, for BOTH submit outcomes", () => {
  const pending = row({
    source: "dm_search",
    barcodeIdentifier: "4066447107524",
    productSubmissionId: SUBMISSION,
    brandText: "Balea",
    productNameText: "Balea Professional Repair Shampoo",
  })
  assert.equal(pending.source, "dm_search")
  assert.equal(pending.barcode_identifier, "4066447107524")
  assert.equal(pending.product_submission_id, SUBMISSION)
  assert.equal(pending.product_id, null)
  assert.equal(pending.brand_text, "Balea")
  assert.equal(pending.product_name_text, "Balea Professional Repair Shampoo")

  // `200 {kind:"already_in_catalog"}`: the product id arrives instead of a
  // submission id — and the dm wording is stored ANYWAY.
  const catalogued = row({
    source: "dm_search",
    barcodeIdentifier: "4066447107524",
    productId: PRODUCT,
    brandText: "Balea",
    productNameText: "Balea Professional Repair Shampoo",
  })
  assert.equal(catalogued.product_id, PRODUCT)
  assert.equal(catalogued.product_submission_id, null)
  assert.equal(catalogued.brand_text, "Balea")
  assert.equal(catalogued.product_name_text, "Balea Professional Repair Shampoo")
})

test("a name research intake stores the typed text, for BOTH submit outcomes", () => {
  const pending = row({
    source: "name_research",
    productSubmissionId: SUBMISSION,
    brandText: "Kérastase",
    productNameText: "Bain Satin 2",
  })
  assert.equal(pending.product_submission_id, SUBMISSION)
  assert.equal(pending.product_id, null)
  assert.equal(pending.barcode_identifier, null)
  assert.equal(pending.brand_text, "Kérastase")

  const catalogued = row({
    source: "name_research",
    productId: PRODUCT,
    brandText: "Kérastase",
    productNameText: "Bain Satin 2",
  })
  assert.equal(catalogued.product_id, PRODUCT)
  assert.equal(catalogued.product_submission_id, null)
  assert.equal(catalogued.brand_text, "Kérastase")
  assert.equal(catalogued.product_name_text, "Bain Satin 2")
})

test("\u201ebenutze ich nicht\u201c carries nothing at all", () => {
  assert.deepEqual(row({ source: "none" }, "leave_in"), {
    intake_id: INTAKE,
    category: "leave_in",
    source: "none",
    brand_text: null,
    product_name_text: null,
    barcode_identifier: null,
    product_id: null,
    product_submission_id: null,
  })
})

// --- The identity invariant, in code and in the database ---------------------

test("a submit outcome that carried neither id is refused before it reaches Postgres", () => {
  const built = buildDiscoveryIntakeItemRow(INTAKE, "mask", {
    source: "barcode_unknown",
    barcodeIdentifier: "4005808858149",
  })
  assert.equal(built.ok, true, "a barcode alone IS an identity")

  // The only capture shape that can arrive empty: `dm_search` without a submit
  // outcome would still have its gtin, so this is `name_research`-shaped — force
  // the degenerate case past the schema to prove the builder, not zod, is the
  // backstop.
  const degenerate = buildDiscoveryIntakeItemRow(INTAKE, "mask", {
    source: "name_research",
    brandText: "Balea",
    productNameText: null,
  } as unknown as DiscoveryIntakeCapture)
  assert.deepEqual(degenerate, { ok: false, reason: "missing_identity" })
})

test("the request schema rejects a capture with an unknown source or a stray field", () => {
  assert.equal(
    discoveryIntakeItemBodySchema.safeParse({
      category: "shampoo",
      capture: { source: "guessed", productId: PRODUCT },
    }).success,
    false,
  )
  assert.equal(
    discoveryIntakeItemBodySchema.safeParse({
      category: "shampoo",
      capture: { source: "none", productId: PRODUCT },
    }).success,
    false,
  )
  assert.equal(
    discoveryIntakeItemBodySchema.safeParse({
      category: "not_a_category",
      capture: { source: "none" },
    }).success,
    false,
  )
  // A barcode that is not barcode-shaped is a 400, not a constraint violation.
  assert.equal(
    discoveryIntakeItemBodySchema.safeParse({
      category: "shampoo",
      capture: { source: "barcode_unknown", barcodeIdentifier: "not-a-barcode" },
    }).success,
    false,
  )
})

// --- Unanswered categories ---------------------------------------------------

test("the unanswered categories are exactly the ones with no row at all", () => {
  const all = DISCOVERY_INTAKE_CATEGORIES.map((category) => ({ category }))
  assert.deepEqual(missingDiscoveryIntakeCategories(all), [])

  const withoutOil = all.filter((item) => item.category !== "oil")
  assert.deepEqual(missingDiscoveryIntakeCategories(withoutOil), ["oil"])

  // Several products in one category do not stand in for a missing one.
  assert.deepEqual(
    missingDiscoveryIntakeCategories([...withoutOil, { category: "shampoo" as const }]),
    ["oil"],
  )
})

// --- The write path, against the real migration ------------------------------

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
CREATE TABLE public.product_submissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
`

async function intakeDatabase(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(async () => pg.close())
  await pg.exec(predecessorSchema)
  await pg.exec(
    await readFile("supabase/migrations/20260922120000_discovery_call_toolkit.sql", "utf8"),
  )
  const participant = "10000000-0000-4000-8000-000000000001"
  await pg.query("INSERT INTO public.profiles (id, email) VALUES ($1, 'lea@example.test')", [
    participant,
  ])
  await pg.query("INSERT INTO public.products (id, name) VALUES ($1, 'Shampoo')", [PRODUCT])
  await pg.query("INSERT INTO public.product_submissions (id) VALUES ($1)", [SUBMISSION])
  const enrollment = await pg.query<{ id: string }>(
    "INSERT INTO public.discovery_enrollments (display_name, normalized_email, claimed_user_id, claimed_at) VALUES ('Lea Sommer', 'lea@example.test', $1, now()) RETURNING id",
    [participant],
  )
  const intake = await pg.query<{ id: string }>(
    "INSERT INTO public.discovery_intakes (enrollment_id, user_id) VALUES ($1, $2) RETURNING id",
    [enrollment.rows[0].id, participant],
  )
  return { pg, intakeId: intake.rows[0].id }
}

async function insert(pg: PGlite, built: ReturnType<typeof row>) {
  return pg.query(
    `INSERT INTO public.discovery_intake_items
       (intake_id, category, source, brand_text, product_name_text, barcode_identifier, product_id, product_submission_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      built.intake_id,
      built.category,
      built.source,
      built.brand_text,
      built.product_name_text,
      built.barcode_identifier,
      built.product_id,
      built.product_submission_id,
    ],
  )
}

test("every mapped row satisfies the captured-has-identity CHECK", async (t) => {
  const { pg, intakeId } = await intakeDatabase(t)
  const captures: Array<[string, DiscoveryIntakeCapture]> = [
    [
      "shampoo",
      {
        source: "catalog_search",
        productId: PRODUCT,
        brandText: "Elvital",
        productNameText: "Hyaluron Pure",
      },
    ],
    [
      "conditioner",
      {
        source: "barcode",
        productId: PRODUCT,
        barcodeIdentifier: "4005808858149",
        brandText: "Nivea",
        productNameText: "Nivea Spülung",
      },
    ],
    // The row that only the barcode identifies — the CHECK's interesting case.
    ["mask", { source: "barcode_unknown", barcodeIdentifier: "4005808858149" }],
    [
      "oil",
      {
        source: "dm_search",
        barcodeIdentifier: "4066447107524",
        productSubmissionId: SUBMISSION,
        brandText: "Balea",
        productNameText: "Balea Öl",
      },
    ],
    [
      "leave_in",
      {
        source: "name_research",
        productSubmissionId: SUBMISSION,
        brandText: "K",
        productNameText: "Bain",
      },
    ],
    ["bondbuilder", { source: "none" }],
  ]

  for (const [category, capture] of captures) {
    const built = buildDiscoveryIntakeItemRow(
      intakeId,
      category as (typeof DISCOVERY_INTAKE_CATEGORIES)[number],
      capture,
    )
    assert.equal(built.ok, true)
    if (!built.ok) return
    const result = await insert(pg, built.row)
    assert.equal(result.rows.length, 1, `${capture.source} was rejected by the table`)
  }
})

test("the CHECK is real: an identity-less captured row is refused by Postgres", async (t) => {
  const { pg, intakeId } = await intakeDatabase(t)
  await assert.rejects(
    () =>
      pg.query(
        `INSERT INTO public.discovery_intake_items (intake_id, category, source, brand_text)
         VALUES ($1, 'shampoo', 'name_research', 'Balea')`,
        [intakeId],
      ),
    /discovery_intake_items_captured_has_identity/,
  )
})

test("one \u201ebenutze ich nicht\u201c per category, enforced by the partial unique index", async (t) => {
  const { pg, intakeId } = await intakeDatabase(t)
  const none = buildDiscoveryIntakeItemRow(intakeId, "shampoo", { source: "none" })
  assert.equal(none.ok, true)
  if (!none.ok) return
  await insert(pg, none.row)
  await assert.rejects(() => insert(pg, none.row), /one_none_per_category/)
})
