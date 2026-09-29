import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import { STUB_PREREQUISITES, publicationGateSql } from "./helpers/leave-in-calibration-postgres"

import {
  LEAVE_IN_CALIBRATION_BATCH_ID,
  LEAVE_IN_CALIBRATION_MIGRATION,
  LEAVE_IN_CALIBRATION_RPC,
  buildLeaveInCalibrationPackage,
  type LeaveInCalibrationPackage,
} from "@/lib/product-intake/catalog-enrichment/leave-in-research-calibration"

/**
 * Real-Postgres tests for the Leave-In calibration executor.
 *
 * Harness pattern: tests/scan-expansion-batch-postgres.test.ts — stub the FK
 * targets and column shapes, then apply the REAL migration for the thing under
 * test. Here the thing under test is the executor migration itself, so it is
 * loaded verbatim from supabase/migrations and the RPC is called end to end.
 * This is the primary executor test: the PL/pgSQL `ON CONFLICT (product_id)`
 * ambiguity that a renamed OUT column fixes is only observable by executing it.
 *
 * Table shapes below mirror production (`information_schema.columns` /
 * `pg_constraint` on pqdkhefxsxkyeqelqegq, read-only), including the generated
 * `application_family` / `category_key` columns on product_application_protocols
 * and the four-column eligibility primary key the delete addresses.
 *
 * The last test installs the REAL curated-publication constraint triggers from
 * their own migrations, so the runbook's ordering claim is proven rather than
 * asserted: the apply is rejected at COMMIT until Redken's pre_heat_protection
 * protocol exists, and commits once it does.
 *
 * Known limitation, stated rather than papered over: PGlite is a single
 * in-process connection, so a genuine two-session interleave cannot be run here.
 * The TOCTOU fix is covered in two parts instead — the contract test asserts the
 * `FOR UPDATE` locks are taken before the snapshot read, and the drift test below
 * proves the guard refuses when the row changed after the package was pinned,
 * which is the outcome the race would otherwise produce.
 */

const ROOT = new URL("../", import.meta.url)
const MIGRATION = `supabase/migrations/${LEAVE_IN_CALIBRATION_MIGRATION}_catalog_enrichment_leave_in_calibration_v1_executor.sql`
const HARDENING_MIGRATION =
  "supabase/migrations/20260929090000_catalog_apply_executor_null_guards_shared_lock.sql"
const POINTER_DELTA_MIGRATION =
  "supabase/migrations/20260914170000_personal_plan_stage5_v2_pointer_delta_executor.sql"
const SHARED_PRODUCT_APPLY_LOCK =
  "pg_catalog.hashtextextended('catalog-enrichment:product-apply', 0)"

/**
 * The hardening migration patches thirteen installed executors in place; only
 * this executor exists here, so the test applies the shared patch helper plus
 * this executor's own block. The whole migration, against all thirteen, runs in
 * tests/catalog-apply-executor-hardening-postgres.test.ts.
 */
async function hardeningSql(): Promise<{ helper: string; calibration: string }> {
  const sql = await readFile(new URL(HARDENING_MIGRATION, ROOT), "utf8")
  const blockStart = sql.indexOf("-- @harden apply_catalog_enrichment_leave_in_calibration_v1")
  const blockEnd = sql.indexOf("-- @end", blockStart)
  assert.ok(blockStart > 0 && blockEnd > blockStart, "hardening migration markers moved")
  return {
    helper: sql.slice(sql.indexOf("CREATE FUNCTION pg_temp."), blockStart),
    calibration: sql.slice(blockStart, blockEnd),
  }
}

async function applyHardening(pg: PGlite) {
  const { helper, calibration } = await hardeningSql()
  await pg.exec(
    `BEGIN;\n${helper}\n${calibration}\n` +
      `DROP FUNCTION pg_temp.harden_catalog_apply_executor(text, text[], text);\nCOMMIT;`,
  )
}

async function migratedDatabase(
  t: { after: (fn: () => Promise<void>) => void },
  transform: (sql: string) => string = (sql) => sql,
  options: { publicationGate?: boolean; hardened?: boolean } = {},
): Promise<PGlite> {
  const pg = new PGlite()
  t.after(async () => {
    await pg.close()
  })
  await pg.exec(STUB_PREREQUISITES)
  if (options.publicationGate) await pg.exec(await publicationGateSql())
  const sql = (await readFile(new URL(MIGRATION, ROOT), "utf8"))
    .replace("CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;", "")
    .replace("CREATE SCHEMA IF NOT EXISTS extensions;", "")
  await pg.exec(transform(sql))
  if (options.hardened ?? true) await applyHardening(pg)
  return pg
}

/**
 * Undoes the OUT-column rename and the `#variable_conflict` pragma — i.e. the
 * exact shape the executor had before the Oil-executor fix technique was applied
 * (20260901131456_fix_oil_authority_executor_product_id_ambiguity.sql).
 */
function withShadowingOutColumns(sql: string): string {
  return sql
    .replace(/applied_product_key/g, "product_key")
    .replace(/applied_product_id/g, "product_id")
    .replace(/applied_deleted_rows/g, "deleted_rows")
    .replace(/applied_eligibility_rows/g, "eligibility_rows")
    .replace("#variable_conflict use_column\n", "")
}

async function loadPackage(): Promise<ReturnType<typeof buildLeaveInCalibrationPackage>> {
  const batch = JSON.parse(
    await readFile(
      new URL("plans/leave-in-apply/leave-in-research-enrichment-manifest.json", ROOT),
      "utf8",
    ),
  )
  return buildLeaveInCalibrationPackage(batch)
}

/** Seeds exactly the pre-apply state each manifest pinned itself to. */
async function seedReviewedState(pg: PGlite, pkg: LeaveInCalibrationPackage) {
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
  built: ReturnType<typeof buildLeaveInCalibrationPackage>,
  overrides: { json?: string | null; fingerprint?: string | null; reviewer?: string | null } = {},
) {
  // `undefined` means "use the approved value"; an explicit `null` is sent as SQL NULL.
  return pg.query<{
    applied_product_key: string
    applied_product_id: string
    applied_deleted_rows: number
    applied_eligibility_rows: number
  }>(`SELECT * FROM public.${LEAVE_IN_CALIBRATION_RPC}($1, $2, $3)`, [
    overrides.json === undefined ? built.canonical_json : overrides.json,
    overrides.fingerprint === undefined ? built.fingerprint : overrides.fingerprint,
    overrides.reviewer === undefined ? "nick" : overrides.reviewer,
  ])
}

async function ledgerCount(pg: PGlite): Promise<string> {
  const ledger = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.catalog_enrichment_applied_items`,
  )
  return ledger.rows[0]!.count
}

test("the executor migration loads and the RPC applies the whole batch", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadPackage()
  await seedReviewedState(pg, built.package)

  const result = await callExecutor(pg, built)
  assert.equal(result.rows.length, 9, "one returned row per product")
  assert.equal(
    result.rows.reduce((total, row) => total + Number(row.applied_deleted_rows), 0),
    27,
    "every planned eligibility delete executed",
  )

  for (const product of built.package.products) {
    const specs = await pg.query<Record<string, unknown>>(
      `SELECT format, weight, roles, provides_heat_protection, heat_activation_required,
              care_benefits, ingredient_flags, application_stage, care_direction,
              repair_support_level, plan_roles, functional_benefits, heat_protection_max_c
         FROM public.product_leave_in_specs WHERE product_id = $1`,
      [product.product_id],
    )
    const row = specs.rows[0]!
    for (const [field, value] of Object.entries(product.leave_in_specs)) {
      assert.deepEqual(row[field], value, `${product.product_key}.${field}`)
    }
    assert.equal(row.heat_protection_max_c, null, "AD-6 invariant holds after the apply")

    const fit = await pg.query<Record<string, unknown>>(
      `SELECT weight, conditioner_relationship, care_benefits
         FROM public.product_leave_in_fit_specs WHERE product_id = $1`,
      [product.product_id],
    )
    for (const [field, value] of Object.entries(product.leave_in_fit_specs)) {
      assert.deepEqual(fit.rows[0]![field], value, `${product.product_key}.fit.${field}`)
    }

    const eligibility = await pg.query<{
      thickness: string
      need_bucket: string
      styling_context: string
    }>(
      `SELECT thickness, need_bucket, styling_context FROM public.product_leave_in_eligibility
        WHERE product_id = $1 ORDER BY thickness, need_bucket, styling_context`,
      [product.product_id],
    )
    const expected = [...product.eligibility_upsert].sort((left, right) =>
      `${left.thickness}${left.need_bucket}${left.styling_context}`.localeCompare(
        `${right.thickness}${right.need_bucket}${right.styling_context}`,
      ),
    )
    assert.deepEqual(eligibility.rows, expected, `${product.product_key} eligibility set`)

    const catalog = await pg.query<{ suitable_thicknesses: string[] }>(
      `SELECT suitable_thicknesses FROM public.products WHERE id = $1`,
      [product.product_id],
    )
    assert.deepEqual(
      [...catalog.rows[0]!.suitable_thicknesses].sort(),
      [...product.suitable_thicknesses].sort(),
      `${product.product_key} suitable_thicknesses`,
    )
  }

  const ledger = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.catalog_enrichment_applied_items WHERE batch_id = $1`,
    [LEAVE_IN_CALIBRATION_BATCH_ID],
  )
  assert.equal(ledger.rows[0]!.count, "9")
})

test("re-running the executor is an idempotent replay, not a second write", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadPackage()
  await seedReviewedState(pg, built.package)
  await callExecutor(pg, built)

  const before = await pg.query<{ digest: string }>(
    `SELECT md5(string_agg(t::text, '|' ORDER BY t::text)) AS digest
       FROM (SELECT * FROM public.product_leave_in_eligibility) t`,
  )
  const replay = await callExecutor(pg, built)
  assert.equal(replay.rows.length, 9)
  assert.equal(
    replay.rows.reduce((total, row) => total + Number(row.applied_deleted_rows), 0),
    0,
    "a replay deletes nothing",
  )
  const after = await pg.query<{ digest: string }>(
    `SELECT md5(string_agg(t::text, '|' ORDER BY t::text)) AS digest
       FROM (SELECT * FROM public.product_leave_in_eligibility) t`,
  )
  assert.equal(after.rows[0]!.digest, before.rows[0]!.digest, "no rows changed on replay")
  const ledger = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.catalog_enrichment_applied_items WHERE batch_id = $1`,
    [LEAVE_IN_CALIBRATION_BATCH_ID],
  )
  assert.equal(ledger.rows[0]!.count, "9", "the ledger is not duplicated")
})

test("a replay over drifted rows is refused instead of silently re-applying", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadPackage()
  await seedReviewedState(pg, built.package)
  await callExecutor(pg, built)

  const victim = built.package.products[0]!
  await pg.query(`DELETE FROM public.product_leave_in_eligibility WHERE product_id = $1`, [
    victim.product_id,
  ])
  await assert.rejects(
    callExecutor(pg, built),
    /conflicting or partial retry/,
    "a hand-edited product must not be silently repaired by a replay",
  )
})

test("the fingerprint guard refuses a target that moved after the package was pinned", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadPackage()
  await seedReviewedState(pg, built.package)

  // What a concurrent writer would have done between preflight and apply.
  const victim = built.package.products[0]!
  await pg.query(
    `UPDATE public.products SET is_chaarlie_recommended = NOT is_chaarlie_recommended WHERE id = $1`,
    [victim.product_id],
  )

  await assert.rejects(callExecutor(pg, built), /target drifted since review/)

  const untouched = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.catalog_enrichment_applied_items`,
  )
  assert.equal(untouched.rows[0]!.count, "0", "a refused batch writes nothing at all")
  const specs = await pg.query<{ care_direction: string | null }>(
    `SELECT care_direction FROM public.product_leave_in_specs WHERE product_id = $1`,
    [built.package.products[8]!.product_id],
  )
  assert.equal(
    specs.rows[0]!.care_direction,
    (
      built.package.products[8]!.current_catalog_target.product_leave_in_specs as {
        care_direction: string | null
      }
    ).care_direction,
    "no other product in the batch was written either",
  )
})

test("the executor refuses an unapproved reviewer, fingerprint, or payload", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadPackage()
  await seedReviewedState(pg, built.package)

  await assert.rejects(
    callExecutor(pg, built, { reviewer: "someone-else" }),
    /reviewer must be nick/,
  )
  await assert.rejects(
    callExecutor(pg, built, { fingerprint: "d".repeat(64) }),
    /batch fingerprint mismatch/,
  )
  const tampered = built.canonical_json.replace('"thickness":"coarse"', '"thickness":"fine"')
  assert.notEqual(tampered, built.canonical_json, "tamper fixture did not apply")
  await assert.rejects(
    callExecutor(pg, built, { json: tampered }),
    /batch fingerprint mismatch/,
    "editing the payload invalidates the caller-supplied fingerprint",
  )
  const { createHash } = await import("node:crypto")
  await assert.rejects(
    callExecutor(pg, built, {
      json: tampered,
      fingerprint: createHash("sha256").update(tampered, "utf8").digest("hex"),
    }),
    /fingerprint is not approved/,
    "a self-consistent but unapproved batch is still refused",
  )
  const ledger = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.catalog_enrichment_applied_items`,
  )
  assert.equal(ledger.rows[0]!.count, "0")
})

test("red proof: before hardening, a NULL reviewer or NULL fingerprint slips past the guards", async (t) => {
  // `x <> 'nick'` and `x !~ '…'` are NULL for NULL input, and IF NULL is not
  // taken — so the original executor applies the whole approved batch.
  for (const overrides of [{ reviewer: null }, { fingerprint: null }]) {
    const pg = await migratedDatabase(t, (sql) => sql, { hardened: false })
    const built = await loadPackage()
    await seedReviewedState(pg, built.package)
    const applied = await callExecutor(pg, built, overrides)
    assert.equal(applied.rows.length, 9, `${JSON.stringify(overrides)} applied the batch`)
    assert.equal(await ledgerCount(pg), "9")
  }
})

test("after hardening, every NULL approval argument is refused and nothing is written", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadPackage()
  await seedReviewedState(pg, built.package)

  await assert.rejects(callExecutor(pg, built, { reviewer: null }), /reviewer must be nick/)
  await assert.rejects(
    callExecutor(pg, built, { fingerprint: null }),
    /batch fingerprint must be lowercase sha256/,
  )
  await assert.rejects(
    callExecutor(pg, built, { json: null }),
    /batch fingerprint mismatch/,
    "a NULL payload digests to NULL, which must not equal the expected fingerprint",
  )
  await assert.rejects(
    callExecutor(pg, built, { json: null, fingerprint: null }),
    /batch fingerprint must be lowercase sha256/,
  )
  assert.equal(await ledgerCount(pg), "0")
})

test("a batch applied by the pre-hardening executor replays unchanged under the hardened one", async (t) => {
  // Production case: leave-in-research-calibration-v1 may already have run
  // against the original function before this hardening lands.
  const pg = await migratedDatabase(t, (sql) => sql, { hardened: false })
  const built = await loadPackage()
  await seedReviewedState(pg, built.package)
  await callExecutor(pg, built)
  const digest = `SELECT md5(string_agg(t::text, '|' ORDER BY t::text)) AS digest FROM (
      SELECT product_id::text, thickness, need_bucket, styling_context
        FROM public.product_leave_in_eligibility
      UNION ALL SELECT id::text, array_to_string(suitable_thicknesses, ','), '', ''
        FROM public.products
      UNION ALL SELECT product_key, batch_fingerprint, content_fingerprint, reviewed_by
        FROM public.catalog_enrichment_applied_items) t`
  const before = await pg.query<{ digest: string }>(digest)

  await applyHardening(pg)
  const replay = await callExecutor(pg, built)
  assert.equal(replay.rows.length, 9)
  assert.equal(
    replay.rows.reduce((total, row) => total + Number(row.applied_deleted_rows), 0),
    0,
    "the replay writes nothing",
  )
  const after = await pg.query<{ digest: string }>(digest)
  assert.equal(after.rows[0]!.digest, before.rows[0]!.digest)
  assert.equal(await ledgerCount(pg), "9")
})

test("the shared product-apply lock is pinned: same key as the delta executor, taken before any product lock", async (t) => {
  const hardening = await readFile(new URL(HARDENING_MIGRATION, ROOT), "utf8")
  const delta = await readFile(new URL(POINTER_DELTA_MIGRATION, ROOT), "utf8")
  assert.ok(delta.includes(SHARED_PRODUCT_APPLY_LOCK), "delta executor key moved")
  assert.ok(hardening.includes(SHARED_PRODUCT_APPLY_LOCK), "hardening key diverged from the delta")

  const pg = await migratedDatabase(t)
  const installed = await pg.query<{ definition: string }>(
    `SELECT pg_get_functiondef('public.${LEAVE_IN_CALIBRATION_RPC}(text,text,text)'::regprocedure) AS definition`,
  )
  const definition = installed.rows[0]!.definition
  const shared = definition.indexOf(SHARED_PRODUCT_APPLY_LOCK)
  assert.ok(shared > 0, "installed executor takes the shared lock")
  assert.equal(definition.lastIndexOf(SHARED_PRODUCT_APPLY_LOCK), shared, "taken exactly once")
  for (const later of [
    "hashtextextended('catalog-enrichment:' || v_batch_id, 0)",
    "FROM public.products WHERE id = v_pid FOR UPDATE",
    "UPDATE public.products",
  ]) {
    const at = definition.indexOf(later)
    assert.ok(at > shared, `shared lock precedes ${later}`)
  }
  assert.doesNotMatch(definition, /p_reviewed_by <> 'nick'|fingerprint <> p_expected/)
})

test("the hardening patch fails closed when an anchor does not match exactly once", async (t) => {
  const pg = await migratedDatabase(t)
  const { helper } = await hardeningSql()
  await pg.exec("BEGIN")
  await pg.exec(helper)
  await assert.rejects(
    pg.query(`SELECT pg_temp.harden_catalog_apply_executor($1, ARRAY[]::text[], $2)`, [
      `public.${LEAVE_IN_CALIBRATION_RPC}(text,text,text)`,
      "no such anchor",
    ]),
    /already takes the shared product-apply lock/,
    "re-running against an already hardened executor is refused",
  )
  await pg.exec("ROLLBACK")

  const fresh = await migratedDatabase(t, (sql) => sql, { hardened: false })
  await fresh.exec("BEGIN")
  await fresh.exec(helper)
  await assert.rejects(
    fresh.query(`SELECT pg_temp.harden_catalog_apply_executor($1, ARRAY[]::text[], $2)`, [
      `public.${LEAVE_IN_CALIBRATION_RPC}(text,text,text)`,
      "no such anchor",
    ]),
    /expected exactly one match, found 0/,
  )
  await fresh.exec("ROLLBACK")
})

test("the executor refuses a batch that plans a delete and an upsert for the same row", async (t) => {
  const pg = await migratedDatabase(t)
  const built = await loadPackage()
  await seedReviewedState(pg, built.package)

  // Executor-side backstop for the contract's own contradiction check.
  const contradiction = JSON.parse(built.canonical_json) as LeaveInCalibrationPackage
  const product = contradiction.products.find((entry) => entry.eligibility_delete.length > 0)!
  product.eligibility_upsert = [...product.eligibility_upsert, product.eligibility_delete[0]!]
  const json = JSON.stringify(contradiction)
  const { createHash } = await import("node:crypto")
  const fingerprint = createHash("sha256").update(json, "utf8").digest("hex")
  // Reaches the per-item check only if the approved-fingerprint pin is satisfied,
  // so this asserts the guard order too: the pin fires first.
  await assert.rejects(
    callExecutor(pg, built, { json, fingerprint }),
    /fingerprint is not approved/,
  )
})

test("the OUT-column rename is load-bearing: shadowing columns breaks the first upsert", async (t) => {
  const pg = await migratedDatabase(t, withShadowingOutColumns)
  const built = await loadPackage()
  await seedReviewedState(pg, built.package)

  // PL/pgSQL compiles either way; the ambiguity is a runtime error on the first
  // `ON CONFLICT (product_id)`. Without this proof the fix would be untested.
  await assert.rejects(callExecutor(pg, built), (error: Error) => {
    assert.match(error.message, /product_id is ambiguous|ambiguous/i)
    return true
  })
  const ledger = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.catalog_enrichment_applied_items`,
  )
  assert.equal(ledger.rows[0]!.count, "0")
})

/** A protocol row that satisfies both halves of the curated-publication gate. */
async function seedProtocol(pg: PGlite, productId: string, role: string) {
  const sourceUrl = `https://example.test/${productId}/${role}`
  const family = role === "pre_heat_protection" ? "pre_heat_damp" : "post_wash_damp_conditioning"
  await pg.query(
    `INSERT INTO public.product_application_protocols
       (product_id, category, role, source_label, source_url, source_text,
        guidance_payload, guidance_payload_v2)
     VALUES ($1,'leave_in',$2,'Hersteller',$3,'Anwendungshinweis laut Hersteller.',$4,$5)`,
    [
      productId,
      role,
      sourceUrl,
      JSON.stringify({
        applicationFamily: family,
        scope: { kind: "product", category: "leave_in", productId },
        evidence: [{ sourceUrl, sourceType: "manufacturer", checkedAt: "2026-09-14" }],
      }),
      JSON.stringify({
        schemaVersion: 2,
        contractKind: "product_pointer",
        applicationFamily: family,
        scope: { kind: "product", category: "leave_in", productId },
        runtimeBlockerCode: null,
      }),
    ],
  )
}

test("the real curated-publication trigger rejects the apply until the protocol exists", async (t) => {
  const pg = await migratedDatabase(t, (sql) => sql, { publicationGate: true })
  const built = await loadPackage()

  // The gate is a DEFERRABLE constraint trigger, so the reviewed pre-state has to
  // be seeded inside ONE transaction: a published product is invalid until its
  // specs and protocols exist alongside it.
  await pg.query("BEGIN")
  await seedReviewedState(pg, built.package)
  // Exactly the protocol coverage these products have in production today — and
  // deliberately NOT Redken's pre_heat_protection, the role its projection newly
  // requires. That is the gap this batch creates.
  for (const product of built.package.products) {
    const currentRoles = new Set(
      (
        (product.current_catalog_target.product_leave_in_specs as { plan_roles?: string[] })
          ?.plan_roles ?? []
      ).map((role) => (role === "pre_heat_application" ? "pre_heat_protection" : role)),
    )
    for (const role of currentRoles) await seedProtocol(pg, product.product_id, role)
  }
  await pg.query("COMMIT")

  await assert.rejects(
    callExecutor(pg, built),
    /curated publication requires/,
    "the deferred gate must reject the batch at COMMIT while Redken has no pre_heat_protection row",
  )
  const ledger = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.catalog_enrichment_applied_items`,
  )
  assert.equal(ledger.rows[0]!.count, "0", "the rejected transaction rolled back completely")

  // Step 4 of the runbook: add exactly that row, then the same apply succeeds.
  await seedProtocol(pg, "2b7db7e3-2058-4178-8a03-7d05f4a1d447", "pre_heat_protection")

  const applied = await callExecutor(pg, built)
  assert.equal(applied.rows.length, 9, "with the protocol in place the whole batch commits")
  const afterLedger = await pg.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.catalog_enrichment_applied_items`,
  )
  assert.equal(afterLedger.rows[0]!.count, "9")
})
