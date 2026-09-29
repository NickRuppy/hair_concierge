import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import { LEAVE_IN_CALIBRATION_MIGRATION } from "@/lib/product-intake/catalog-enrichment/leave-in-research-calibration"
import {
  LEAVE_IN_CALIBRATION_V2_T20_APPROVED_BATCH_FINGERPRINT,
  LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID,
  LEAVE_IN_CALIBRATION_V2_T20_COHORT_INDEX_FINGERPRINT,
  LEAVE_IN_CALIBRATION_V2_T20_MANIFEST,
  LEAVE_IN_CALIBRATION_V2_T20_MIGRATION,
  LEAVE_IN_CALIBRATION_V2_T20_RPC,
  buildLeaveInCalibrationV2T20Package,
  type LeaveInV2T20Package,
} from "@/lib/product-intake/catalog-enrichment/leave-in-research-calibration-v2-t20"

import { STUB_PREREQUISITES, publicationGateSql } from "./helpers/leave-in-calibration-postgres"

/**
 * Real-Postgres tests for the batch v2-t20 executor. The REAL batch-v1 migration
 * (whose drift helpers v2 reuses) and the REAL v2-t20 migration are loaded
 * verbatim and the RPC is called end to end against the pinned pre-state.
 *
 * Executor-side invariants that the approved-fingerprint pin makes unreachable
 * with a tampered payload are red-proofed by re-approving the tampered package in
 * a transformed copy of the migration — the checks under test are the real ones.
 *
 * PGlite is one in-process connection, so a genuine two-session interleave is
 * not runnable here; the drift test proves the guard refuses what the race
 * would produce (same stated limitation as the v1 harness).
 */

const ROOT = new URL("../", import.meta.url)
const V1_MIGRATION = `supabase/migrations/${LEAVE_IN_CALIBRATION_MIGRATION}_catalog_enrichment_leave_in_calibration_v1_executor.sql`
const V2_MIGRATION = `supabase/migrations/${LEAVE_IN_CALIBRATION_V2_T20_MIGRATION}_catalog_enrichment_leave_in_calibration_v2_t20_executor.sql`

type Built = ReturnType<typeof buildLeaveInCalibrationV2T20Package>

function stripExtensionSetup(sql: string) {
  return sql
    .replace("CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;", "")
    .replace("CREATE SCHEMA IF NOT EXISTS extensions;", "")
}

async function migratedDatabase(
  t: { after: (fn: () => Promise<void>) => void },
  transform: (sql: string) => string = (sql) => sql,
  options: { publicationGate?: boolean } = {},
): Promise<PGlite> {
  const pg = new PGlite()
  t.after(async () => {
    await pg.close()
  })
  await pg.exec(STUB_PREREQUISITES)
  if (options.publicationGate) await pg.exec(await publicationGateSql())
  await pg.exec(stripExtensionSetup(await readFile(new URL(V1_MIGRATION, ROOT), "utf8")))
  await pg.exec(transform(stripExtensionSetup(await readFile(new URL(V2_MIGRATION, ROOT), "utf8"))))
  return pg
}

async function loadBuilt(): Promise<Built> {
  const batch = JSON.parse(
    await readFile(new URL(LEAVE_IN_CALIBRATION_V2_T20_MANIFEST, ROOT), "utf8"),
  )
  return buildLeaveInCalibrationV2T20Package(batch)
}

/** Re-approves an arbitrary package in a copy of the migration (red-proof only). */
function approving(pkg: LeaveInV2T20Package) {
  const json = JSON.stringify(pkg)
  const fingerprint = createHash("sha256").update(json, "utf8").digest("hex")
  return {
    canonical_json: json,
    fingerprint,
    transform: (sql: string) =>
      sql
        .replace(LEAVE_IN_CALIBRATION_V2_T20_APPROVED_BATCH_FINGERPRINT, fingerprint)
        .replace(
          LEAVE_IN_CALIBRATION_V2_T20_COHORT_INDEX_FINGERPRINT,
          pkg.cohort_index_fingerprint,
        ),
  }
}

function tamper(built: Built, mutate: (pkg: LeaveInV2T20Package) => void) {
  const pkg = JSON.parse(built.canonical_json) as LeaveInV2T20Package
  mutate(pkg)
  return approving(pkg)
}

/** Seeds exactly the pre-apply state (batch v1's output) each manifest pinned. */
async function seedPinnedState(pg: PGlite, pkg: LeaveInV2T20Package) {
  for (const product of pkg.products) {
    const target = product.current_catalog_target
    const catalog = target.products as Record<string, unknown>
    await pg.query(
      `INSERT INTO public.products
         (id, name, brand, category_key, origin, is_active, lifecycle_status,
          is_chaarlie_recommended, suitable_thicknesses, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        product.product_id,
        catalog.name,
        catalog.brand,
        catalog.category_key,
        catalog.origin,
        catalog.is_active,
        catalog.lifecycle_status,
        catalog.is_chaarlie_recommended,
        catalog.suitable_thicknesses,
        catalog.image_url,
      ],
    )
    const specs = target.product_leave_in_specs as Record<string, unknown>
    await pg.query(
      `INSERT INTO public.product_leave_in_specs
         (product_id, format, weight, roles, provides_heat_protection, heat_protection_max_c,
          heat_activation_required, care_benefits, ingredient_flags, application_stage,
          care_direction, repair_support_level, plan_roles, functional_benefits,
          category_key, conditioner_relationship)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        product.product_id,
        specs.format,
        specs.weight,
        specs.roles,
        specs.provides_heat_protection,
        specs.heat_protection_max_c,
        specs.heat_activation_required,
        specs.care_benefits,
        specs.ingredient_flags,
        specs.application_stage,
        specs.care_direction,
        specs.repair_support_level,
        specs.plan_roles,
        specs.functional_benefits,
        specs.category_key,
        specs.conditioner_relationship,
      ],
    )
    const fit = target.product_leave_in_fit_specs as Record<string, unknown>
    await pg.query(
      `INSERT INTO public.product_leave_in_fit_specs
         (product_id, weight, conditioner_relationship, care_benefits) VALUES ($1,$2,$3,$4)`,
      [product.product_id, fit.weight, fit.conditioner_relationship, fit.care_benefits],
    )
    for (const row of target.product_leave_in_eligibility as Array<Record<string, string>>) {
      await pg.query(
        `INSERT INTO public.product_leave_in_eligibility
           (product_id, thickness, need_bucket, styling_context) VALUES ($1,$2,$3,$4)`,
        [product.product_id, row.thickness, row.need_bucket, row.styling_context],
      )
    }
  }
}

async function callExecutor(
  pg: PGlite,
  built: { canonical_json: string; fingerprint: string },
  overrides: { json?: string | null; fingerprint?: string | null; reviewer?: string | null } = {},
) {
  return pg.query<{
    applied_product_key: string
    applied_product_id: string
    applied_changed_columns: string[]
    applied_replay: boolean
  }>(`SELECT * FROM public.${LEAVE_IN_CALIBRATION_V2_T20_RPC}($1, $2, $3)`, [
    overrides.json === undefined ? built.canonical_json : overrides.json,
    overrides.fingerprint === undefined ? built.fingerprint : overrides.fingerprint,
    overrides.reviewer === undefined ? "nick" : overrides.reviewer,
  ])
}

async function digest(pg: PGlite, table: string) {
  const result = await pg.query<{ digest: string | null }>(
    `SELECT md5(string_agg(t::text, '|' ORDER BY t::text)) AS digest
       FROM (SELECT * FROM public.${table}) t`,
  )
  return result.rows[0]!.digest
}

/** Fit and eligibility rows minus timestamps — the columns this batch must never touch. */
async function untouchableDigest(pg: PGlite) {
  const result = await pg.query<{ digest: string | null }>(
    `SELECT md5(
       coalesce((SELECT string_agg(concat_ws(',', product_id, weight, conditioner_relationship, care_benefits::text), '|' ORDER BY product_id)
                 FROM public.product_leave_in_fit_specs), '') || '#' ||
       coalesce((SELECT string_agg(concat_ws(',', product_id, thickness, need_bucket, styling_context), '|'
                        ORDER BY product_id, thickness, need_bucket, styling_context)
                 FROM public.product_leave_in_eligibility), '') || '#' ||
       coalesce((SELECT string_agg(concat_ws(',', id, suitable_thicknesses::text), '|' ORDER BY id)
                 FROM public.products), '')
     ) AS digest`,
  )
  return result.rows[0]!.digest
}

async function ledgerCount(pg: PGlite) {
  const result = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.catalog_enrichment_applied_items WHERE batch_id = $1`,
    [LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID],
  )
  return Number(result.rows[0]!.count)
}

async function careDirections(pg: PGlite) {
  const result = await pg.query<{ product_id: string; care_direction: string }>(
    `SELECT product_id::text, care_direction FROM public.product_leave_in_specs ORDER BY product_id`,
  )
  return result.rows
}

// ---------------------------------------------------------------------------
// Happy path and replay
// ---------------------------------------------------------------------------

test("v2-t20: the executor applies exactly the three allowlisted spec columns on the five products", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadBuilt()
  await seedPinnedState(pg, built.package)
  const untouchedBefore = await untouchableDigest(pg)

  const result = await callExecutor(pg, built)
  assert.equal(result.rows.length, 5, "one returned row per product")
  assert.ok(
    result.rows.every((row) => row.applied_replay === false),
    "first apply is not a replay",
  )

  const byKey = new Map(result.rows.map((row) => [row.applied_product_key, row]))
  for (const product of built.package.products) {
    assert.deepEqual(
      byKey.get(product.product_key)?.applied_changed_columns,
      product.changed_spec_columns,
      `${product.product_key} changed columns`,
    )
    const specs = await pg.query<Record<string, unknown>>(
      `SELECT format, weight, roles, provides_heat_protection, heat_activation_required,
              care_benefits, ingredient_flags, application_stage, care_direction,
              repair_support_level, plan_roles, functional_benefits, heat_protection_max_c
         FROM public.product_leave_in_specs WHERE product_id = $1`,
      [product.product_id],
    )
    const row = specs.rows[0]!
    for (const [column, value] of Object.entries(product.projected_leave_in_specs)) {
      const live = Array.isArray(row[column]) ? [...(row[column] as string[])].sort() : row[column]
      const expected = Array.isArray(value) ? [...(value as string[])].sort() : value
      assert.deepEqual(live, expected, `${product.product_key}.${column}`)
    }
    for (const column of product.changed_spec_columns) {
      if (Array.isArray(product.projected_leave_in_specs[column]))
        assert.deepEqual(
          row[column],
          product.projected_leave_in_specs[column],
          `${product.product_key}.${column} is written in the projection's own order`,
        )
    }
    assert.equal(row.heat_protection_max_c, null, "AD-6 invariant holds")
  }

  assert.equal(
    await untouchableDigest(pg),
    untouchedBefore,
    "no fit row, eligibility row or suitable_thicknesses value changed",
  )
  assert.equal(await ledgerCount(pg), 5)

  const directions = Object.fromEntries(
    (await careDirections(pg)).map((row) => [row.product_id, row.care_direction]),
  )
  assert.equal(directions["5dc2fae3-a0ca-4e6c-9c30-02dd192772f0"], "balanced", "Gliss")
  assert.equal(directions["4e99706a-2232-4ee6-ba1b-9ca1029a7364"], "balanced", "Olaplex")
  assert.equal(directions["42a2fe20-bd7e-49a3-a880-8ae89015a5c9"], "balanced", "Neqi")
  assert.equal(directions["118ebae1-b7a9-4a89-a2ff-6c31df28c4dc"], "balanced", "EVO")
  assert.equal(directions["2b7db7e3-2058-4178-8a03-7d05f4a1d447"], "protein", "Redken")
})

test("v2-t20: re-running the executor is a replay that writes nothing", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadBuilt()
  await seedPinnedState(pg, built.package)
  await callExecutor(pg, built)
  const specsBefore = await digest(pg, "product_leave_in_specs")
  const untouchedBefore = await untouchableDigest(pg)

  const replay = await callExecutor(pg, built)
  assert.equal(replay.rows.length, 5)
  assert.ok(
    replay.rows.every((row) => row.applied_replay === true),
    "every product short-circuits",
  )
  assert.equal(await digest(pg, "product_leave_in_specs"), specsBefore, "no spec row changed")
  assert.equal(await untouchableDigest(pg), untouchedBefore)
  assert.equal(await ledgerCount(pg), 5, "the ledger is not duplicated")
})

test("v2-t20: a replay over a hand-reverted product is refused, not silently repaired", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadBuilt()
  await seedPinnedState(pg, built.package)
  await callExecutor(pg, built)
  await pg.query(
    `UPDATE public.product_leave_in_specs SET care_direction = 'moisture' WHERE product_id = $1`,
    ["5dc2fae3-a0ca-4e6c-9c30-02dd192772f0"],
  )
  await assert.rejects(callExecutor(pg, built), /conflicting or partial retry/)
})

test("v2-t20: a ledger row from different content is a replay conflict", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadBuilt()
  await seedPinnedState(pg, built.package)
  await callExecutor(pg, built)
  await pg.query(
    `UPDATE public.catalog_enrichment_applied_items SET content_fingerprint = $1
      WHERE batch_id = $2 AND product_key = 'leave-in-slot-13-neqi-diamond-glass'`,
    ["e".repeat(64), LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID],
  )
  await assert.rejects(callExecutor(pg, built), /ledger conflicts with retry/)
})

test("v2-t20: a partial ledger is refused before any product is touched", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadBuilt()
  await seedPinnedState(pg, built.package)
  const first = built.package.products[0]!
  await pg.query(
    `INSERT INTO public.catalog_enrichment_applied_items
       (batch_id, product_key, batch_fingerprint, content_fingerprint, product_id, reviewed_by)
     VALUES ($1,$2,$3,$4,$5,'nick')`,
    [
      LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID,
      first.product_key,
      built.fingerprint,
      first.content_fingerprint,
      first.product_id,
    ],
  )
  const before = await digest(pg, "product_leave_in_specs")
  await assert.rejects(callExecutor(pg, built), /partial ledger state/)
  assert.equal(await digest(pg, "product_leave_in_specs"), before)
})

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

test("v2-t20: the drift guard refuses a target that moved after it was pinned; nothing is written", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadBuilt()
  await seedPinnedState(pg, built.package)
  await pg.query(
    `UPDATE public.products SET is_chaarlie_recommended = NOT is_chaarlie_recommended WHERE id = $1`,
    ["4e99706a-2232-4ee6-ba1b-9ca1029a7364"],
  )
  const before = await digest(pg, "product_leave_in_specs")
  await assert.rejects(callExecutor(pg, built), /target drifted since review/)
  assert.equal(
    await digest(pg, "product_leave_in_specs"),
    before,
    "earlier products rolled back too",
  )
  assert.equal(await ledgerCount(pg), 0)
})

test("v2-t20: an eligibility row that drifted is caught by the drift guard", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadBuilt()
  await seedPinnedState(pg, built.package)
  await pg.query(
    `DELETE FROM public.product_leave_in_eligibility
      WHERE product_id = $1 AND need_bucket = 'heat_protect'`,
    ["2b7db7e3-2058-4178-8a03-7d05f4a1d447"],
  )
  await assert.rejects(callExecutor(pg, built), /target drifted since review/)
  assert.equal(await ledgerCount(pg), 0)
})

test("v2-t20: reviewer, NULL arguments, fingerprint mismatch and unapproved payloads are refused", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadBuilt()
  await seedPinnedState(pg, built.package)

  await assert.rejects(
    callExecutor(pg, built, { reviewer: "someone-else" }),
    /reviewer must be nick/,
  )
  await assert.rejects(callExecutor(pg, built, { reviewer: null }), /reviewer must be nick/)
  await assert.rejects(
    callExecutor(pg, built, { fingerprint: null }),
    /fingerprint must be lowercase sha256/,
  )
  await assert.rejects(
    callExecutor(pg, built, { fingerprint: "D".repeat(64) }),
    /fingerprint must be lowercase sha256/,
  )
  await assert.rejects(callExecutor(pg, built, { json: null }), /payload is required/)
  await assert.rejects(
    callExecutor(pg, built, { fingerprint: "d".repeat(64) }),
    /batch fingerprint mismatch/,
  )
  const edited = built.canonical_json.replace(
    '"care_direction":"balanced"',
    '"care_direction":"moisture"',
  )
  assert.notEqual(edited, built.canonical_json, "tamper fixture did not apply")
  await assert.rejects(callExecutor(pg, built, { json: edited }), /batch fingerprint mismatch/)
  await assert.rejects(
    callExecutor(pg, built, {
      json: edited,
      fingerprint: createHash("sha256").update(edited, "utf8").digest("hex"),
    }),
    /fingerprint is not approved/,
    "a self-consistent but unapproved batch is refused",
  )
  assert.equal(await ledgerCount(pg), 0)
})

test("v2-t20 red proof: the null-safe reviewer guard is load-bearing", async (t) => {
  // The batch-v1 shape `IF p_reviewed_by <> 'nick'` evaluates to NULL for a NULL
  // reviewer, so the guard never fires and the apply proceeds.
  const pg = await migratedDatabase(t, (sql) =>
    sql.replace("IF p_reviewed_by IS DISTINCT FROM 'nick' THEN", "IF p_reviewed_by <> 'nick' THEN"),
  )
  const built = await loadBuilt()
  await seedPinnedState(pg, built.package)
  const result = await callExecutor(pg, built, { reviewer: null })
  assert.equal(result.rows.length, 5, "with a bare <> a NULL reviewer slips through and writes")
})

test("v2-t20: the executor refuses a package that would change the eligibility set", async (t) => {
  const built = await loadBuilt()
  const approved = tamper(built, (pkg) => {
    const gliss = pkg.products.find((product) => product.product_key.includes("gliss"))!
    gliss.projected_eligibility = [
      ...gliss.projected_eligibility,
      { thickness: "fine", need_bucket: "moisture_anti_frizz", styling_context: "air_dry" },
    ]
  })
  const pg = await migratedDatabase(t, approved.transform)
  await seedPinnedState(pg, built.package)
  await assert.rejects(callExecutor(pg, approved), /would change the eligibility set/)
  assert.equal(await ledgerCount(pg), 0)
})

test("v2-t20: the executor refuses a non-allowlisted, undeclared, fit or thickness change", async (t) => {
  const built = await loadBuilt()
  const cases: Array<[string, (pkg: LeaveInV2T20Package) => void, RegExp]> = [
    [
      "a declared weight change",
      (pkg) => {
        pkg.products[0]!.changed_spec_columns = [
          ...pkg.products[0]!.changed_spec_columns,
          "weight",
        ].sort()
      },
      /may only change care_direction, care_benefits, functional_benefits/,
    ],
    [
      "an undeclared weight change",
      (pkg) => {
        pkg.products[0]!.projected_leave_in_specs.weight = "rich"
      },
      /declared spec delta does not match the pinned target/,
    ],
    [
      "a fit change",
      (pkg) => {
        pkg.products[0]!.projected_leave_in_fit_specs.weight = "rich"
      },
      /would change the fit row/,
    ],
    [
      "a thickness change",
      (pkg) => {
        pkg.products[0]!.projected_suitable_thicknesses = ["fine", "normal", "coarse"].sort()
      },
      /would change suitable_thicknesses/,
    ],
    [
      "an empty delta",
      (pkg) => {
        pkg.products[0]!.changed_spec_columns = []
      },
      /may only change/,
    ],
    [
      "an unapproved product mapping",
      (pkg) => {
        pkg.products[0]!.product_id = "00000000-0000-4000-8000-000000000000"
      },
      /product mapping is not approved/,
    ],
  ]
  for (const [label, mutate, expected] of cases) {
    const approved = tamper(built, mutate)
    const pg = await migratedDatabase(t, approved.transform)
    await seedPinnedState(pg, built.package)
    await assert.rejects(callExecutor(pg, approved), expected, label)
    assert.equal(await ledgerCount(pg), 0, label)
  }
})

test("v2-t20: the post-write check catches an eligibility change made during the apply", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadBuilt()
  await seedPinnedState(pg, built.package)
  // A foreign side effect the executor itself never performs.
  await pg.exec(`
    CREATE FUNCTION public.zz_add_eligibility() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO public.product_leave_in_eligibility (product_id, thickness, need_bucket, styling_context)
      VALUES (NEW.product_id, 'fine', 'shine_protect', 'air_dry') ON CONFLICT DO NOTHING;
      RETURN NEW;
    END $$;
    CREATE TRIGGER zz_add_eligibility AFTER UPDATE ON public.product_leave_in_specs
      FOR EACH ROW EXECUTE FUNCTION public.zz_add_eligibility();
  `)
  await assert.rejects(callExecutor(pg, built), /eligibility changed during apply/)
  assert.equal(await ledgerCount(pg), 0)
})

test("v2-t20: the real curated-publication gate lets the apply commit", async (t) => {
  const pg = await migratedDatabase(t, (sql) => sql, { publicationGate: true })
  const built = await loadBuilt()
  await pg.query("BEGIN")
  await seedPinnedState(pg, built.package)
  for (const product of built.package.products) {
    const roles = new Set(
      (
        (product.current_catalog_target.product_leave_in_specs as { plan_roles?: string[] })
          ?.plan_roles ?? []
      ).map((role) => (role === "pre_heat_application" ? "pre_heat_protection" : role)),
    )
    for (const role of roles) {
      const sourceUrl = `https://example.test/${product.product_id}/${role}`
      const family =
        role === "pre_heat_protection" ? "pre_heat_damp" : "post_wash_damp_conditioning"
      await pg.query(
        `INSERT INTO public.product_application_protocols
           (product_id, category, role, source_label, source_url, source_text,
            guidance_payload, guidance_payload_v2)
         VALUES ($1,'leave_in',$2,'Hersteller',$3,'Anwendungshinweis laut Hersteller.',$4,$5)`,
        [
          product.product_id,
          role,
          sourceUrl,
          JSON.stringify({
            applicationFamily: family,
            scope: { kind: "product", category: "leave_in", productId: product.product_id },
            evidence: [{ sourceUrl, sourceType: "manufacturer", checkedAt: "2026-09-29" }],
          }),
          JSON.stringify({
            schemaVersion: 2,
            contractKind: "product_pointer",
            applicationFamily: family,
            scope: { kind: "product", category: "leave_in", productId: product.product_id },
            runtimeBlockerCode: null,
          }),
        ],
      )
    }
  }
  await pg.query("COMMIT")
  const result = await callExecutor(pg, built)
  assert.equal(result.rows.length, 5)
  assert.equal(await ledgerCount(pg), 5)
})

test("v2-t20: the migration hardwires exactly the TypeScript-pinned fingerprints", async () => {
  const sql = await readFile(new URL(V2_MIGRATION, ROOT), "utf8")
  assert.ok(
    sql.includes(`'${LEAVE_IN_CALIBRATION_V2_T20_APPROVED_BATCH_FINGERPRINT}'`),
    "batch fingerprint",
  )
  assert.ok(
    sql.includes(`'${LEAVE_IN_CALIBRATION_V2_T20_COHORT_INDEX_FINGERPRINT}'`),
    "cohort index",
  )
  const built = await loadBuilt()
  assert.equal(built.fingerprint, LEAVE_IN_CALIBRATION_V2_T20_APPROVED_BATCH_FINGERPRINT)
  assert.equal(built.cohort_index_fingerprint, LEAVE_IN_CALIBRATION_V2_T20_COHORT_INDEX_FINGERPRINT)
  // The shared cross-executor lock comes before the first product row lock.
  const sharedLock = sql.indexOf("hashtextextended('catalog-enrichment:product-apply', 0)")
  const firstRowLock = sql.indexOf("FOR UPDATE")
  assert.ok(sharedLock > 0 && firstRowLock > sharedLock, "shared advisory lock precedes row locks")
  assert.ok(!/p_reviewed_by <> /.test(sql), "no bare <> against a parameter")
  assert.ok(!/GRANT EXECUTE[^;]*TO (anon|authenticated)/.test(sql), "service_role-only grants")
})
