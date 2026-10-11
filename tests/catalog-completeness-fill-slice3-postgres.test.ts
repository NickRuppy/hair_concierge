import assert from "node:assert/strict"
import test from "node:test"

import type { PGlite } from "@electric-sql/pglite"

import { loadScanProductFacts } from "@/lib/personal-plan/products/authority/catalog-facts"
import type { Stage3AuthorityInput } from "@/lib/personal-plan/products/authority/contracts"
import { evaluateStage3Authority } from "@/lib/personal-plan/products/authority/evaluate"
import {
  buildHeatActivatedProtocolRow,
  NEQI_DIAMOND_GLASS_ULTIMATE_HEAT_ACTIVATED_ROW_INPUT,
  PANTENE_HEAT_GLOW_HEAT_ACTIVATED_ROW_INPUTS,
} from "@/lib/product-intake/catalog-enrichment/heat-activated-protocols"

import {
  heatActivationDatabase,
  readRepoFile,
  transaction,
} from "./helpers/leave-in-heat-activation-postgres"

/**
 * PGlite rehearsal of the Slice 3 guarded one-shot data migration
 * (plans/catalog-completeness-fill/slice3/, S3 plan T3.9). The database runs
 * the real S3 schema migration; the two products are seeded in their Slice 1
 * post-state from the generated prestate.json, then the REAL migration file,
 * verify.sql and rollback.sql run with every trigger and the deferred
 * curated-publication gate live. PGlite is single-connection: lock contention
 * is not proven here.
 */

const MIGRATION = "supabase/migrations/20261011161000_catalog_completeness_fill_slice3.sql"
const SLICE = "plans/catalog-completeness-fill/slice3/"
const NEQI = "42a2fe20-bd7e-49a3-a880-8ae89015a5c9"
const HEAT_GLOW = "e781ca9e-886d-40a1-bfe1-48177cfbf381"

type Row = Record<string, unknown>
type Prestate = {
  products: Row[]
  product_leave_in_specs: Row[]
  product_leave_in_fit_specs: Row[]
  product_leave_in_eligibility: Row[]
  guarded_protocols: Row[]
  kept_protocols: Row[]
}

const PROTOCOL_COLUMNS = [
  "id",
  "product_id",
  "category",
  "role",
  "cadence",
  "application_stage",
  "application_state",
  "placement",
  "contact_time_seconds",
  "rinse_action",
  "reapplication",
  "instruction_modifiers",
  "source_label",
  "source_url",
  "source_text",
  "guidance_payload",
  "guidance_payload_v2",
] as const

async function seedPrestate(pg: PGlite, prestate: Prestate) {
  const error = await transaction(pg, async (db) => {
    for (const product of prestate.products)
      await db.query(
        `INSERT INTO public.products (id, name, brand, category, category_key, origin, is_active, lifecycle_status, is_chaarlie_recommended, suitable_thicknesses)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          product.id,
          product.name,
          product.brand,
          product.category,
          product.category_key,
          product.origin,
          product.is_active,
          product.lifecycle_status,
          product.is_chaarlie_recommended,
          product.suitable_thicknesses,
        ],
      )
    for (const specs of prestate.product_leave_in_specs) {
      const columns = Object.keys(specs).filter((column) => column !== "conditioner_relationship")
      await db.query(
        `INSERT INTO public.product_leave_in_specs (${columns.join(", ")}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(", ")})`,
        columns.map((column) => specs[column]),
      )
    }
    for (const fit of prestate.product_leave_in_fit_specs)
      await db.query(
        "INSERT INTO public.product_leave_in_fit_specs (product_id, weight, conditioner_relationship, care_benefits) VALUES ($1, $2, $3, $4)",
        [fit.product_id, fit.weight, fit.conditioner_relationship, fit.care_benefits],
      )
    for (const row of prestate.product_leave_in_eligibility)
      await db.query(
        "INSERT INTO public.product_leave_in_eligibility (product_id, thickness, need_bucket, styling_context) VALUES ($1, $2, $3, $4)",
        [row.product_id, row.thickness, row.need_bucket, row.styling_context],
      )
    for (const protocol of [...prestate.guarded_protocols, ...prestate.kept_protocols])
      await db.query(
        `INSERT INTO public.product_application_protocols (${PROTOCOL_COLUMNS.join(", ")}) VALUES (${PROTOCOL_COLUMNS.map((column, index) => (column === "instruction_modifiers" || column.startsWith("guidance_payload") || column === "cadence" ? `$${index + 1}::jsonb` : `$${index + 1}`)).join(", ")})`,
        PROTOCOL_COLUMNS.map((column) =>
          column === "instruction_modifiers" ||
          column.startsWith("guidance_payload") ||
          column === "cadence"
            ? protocol[column] === null || protocol[column] === undefined
              ? column === "instruction_modifiers"
                ? "[]"
                : null
              : JSON.stringify(protocol[column])
            : (protocol[column] ?? null),
        ),
      )
  })
  assert.equal(error, null, "the Slice 1 post-state seeds and passes the curated gate")
}

async function snapshot(pg: PGlite) {
  const query = async (sql: string) => (await pg.query<Row>(sql, [[NEQI, HEAT_GLOW]])).rows
  return {
    specs: await query(
      "SELECT to_jsonb(li) - 'created_at' - 'updated_at' AS row FROM public.product_leave_in_specs li WHERE product_id = ANY($1::uuid[]) ORDER BY product_id",
    ),
    fit: await query(
      "SELECT to_jsonb(f) - 'created_at' - 'updated_at' AS row FROM public.product_leave_in_fit_specs f WHERE product_id = ANY($1::uuid[]) ORDER BY product_id",
    ),
    eligibility: await query(
      "SELECT product_id, thickness, need_bucket, styling_context FROM public.product_leave_in_eligibility WHERE product_id = ANY($1::uuid[]) ORDER BY 1, 2, 3, 4",
    ),
    protocols: await query(
      "SELECT product_id, role, application_family, application_state, reapplication, source_url, source_text, guidance_payload, guidance_payload_v2 FROM public.product_application_protocols WHERE product_id = ANY($1::uuid[]) ORDER BY 1, 2, 3",
    ),
    evidence: await query(
      "SELECT product_id, fact_key, fact_value, source_url, batch_id FROM public.personal_plan_catalog_fact_evidence WHERE product_id = ANY($1::uuid[]) ORDER BY 1, 2, 4",
    ),
  }
}

async function seededDatabase(t: Parameters<typeof heatActivationDatabase>[0]) {
  const pg = await heatActivationDatabase(t)
  const prestate = JSON.parse(await readRepoFile(`${SLICE}prestate.json`)) as Prestate
  await seedPrestate(pg, prestate)
  return pg
}

test("slice3 migrates, verifies, rolls back to the exact prestate, reapplies and replays", async (t) => {
  const pg = await seededDatabase(t)
  const migration = await readRepoFile(MIGRATION)
  const verify = await readRepoFile(`${SLICE}verify.sql`)
  const rollback = await readRepoFile(`${SLICE}rollback.sql`)
  const before = await snapshot(pg)

  await pg.exec(migration)
  await pg.exec(verify)
  const after = await snapshot(pg)
  assert.notDeepEqual(after, before)
  const specs = Object.fromEntries(
    after.specs.map((row) => [(row.row as Row).product_id, row.row as Row]),
  )
  for (const id of [NEQI, HEAT_GLOW]) {
    assert.equal(specs[id]!.heat_activation_required, true)
    assert.equal(specs[id]!.heat_activation_route, "airflow_shaping")
    assert.deepEqual(specs[id]!.plan_roles, ["pre_heat_application"])
    assert.deepEqual(specs[id]!.roles, ["styling_prep"])
  }
  assert.deepEqual(
    after.eligibility
      .filter((row) => row.product_id === NEQI)
      .map((row) => [row.thickness, row.need_bucket, row.styling_context]),
    [
      ["coarse", "heat_protect", "heat_style"],
      ["coarse", "moisture_anti_frizz", "heat_style"],
      ["normal", "heat_protect", "heat_style"],
      ["normal", "moisture_anti_frizz", "heat_style"],
    ],
  )
  assert.deepEqual(
    after.eligibility
      .filter((row) => row.product_id === HEAT_GLOW)
      .map((row) => [row.need_bucket, row.styling_context]),
    [
      ["heat_protect", "heat_style"],
      ["moisture_anti_frizz", "heat_style"],
      ["shine_protect", "heat_style"],
    ],
  )
  // Q1: the legacy post-wash rows stay byte-identical.
  assert.deepEqual(
    after.protocols.filter((row) => row.role === "post_wash_leave_in"),
    before.protocols.filter((row) => row.role === "post_wash_leave_in"),
  )
  await pg.query("SELECT public.assert_personal_plan_curated_publication($1::uuid)", [HEAT_GLOW])

  await pg.exec(rollback)
  assert.deepEqual(await snapshot(pg), before, "rollback restores the exact Slice 1 post-state")

  await pg.exec(migration)
  assert.deepEqual(await snapshot(pg), after, "reapply reaches the same target")
  await pg.exec(migration)
  assert.deepEqual(await snapshot(pg), after, "replay is a no-op")
  await pg.exec(verify)
})

test("slice3 aborts when one prestate cell drifted", async (t) => {
  const pg = await seededDatabase(t)
  await pg.query(
    "UPDATE public.product_leave_in_specs SET care_direction = 'balanced' WHERE product_id = $1",
    [HEAT_GLOW],
  )
  await assert.rejects(pg.exec(await readRepoFile(MIGRATION)), /slice3 prestate specs/)
  await pg.exec("ROLLBACK").catch(() => undefined)
  const unchanged = await pg.query<{ heat_activation_required: boolean }>(
    "SELECT heat_activation_required FROM public.product_leave_in_specs WHERE product_id = $1",
    [NEQI],
  )
  assert.equal(unchanged.rows[0]!.heat_activation_required, false)
})

test("slice3 skips on a fresh database without the captured products", async (t) => {
  const pg = await heatActivationDatabase(t)
  await pg.exec(await readRepoFile(MIGRATION))
  const rows = await pg.query("SELECT 1 FROM public.personal_plan_catalog_fact_evidence")
  assert.equal(rows.rows.length, 0)
})

/** Minimal Supabase-shaped client over PGlite for the Stage-3 fact loader. */
function pgliteClient(pg: PGlite) {
  return {
    from(table: string) {
      const filters: Array<[string, unknown]> = []
      let single = false
      const run = async () => {
        // Tables outside this harness (e.g. legacy shared guidance) read as empty.
        const exists = await pg.query<{ ok: boolean }>("SELECT to_regclass($1) IS NOT NULL AS ok", [
          `public.${table}`,
        ])
        if (!exists.rows[0]!.ok) return { data: single ? null : [], error: null }
        const where = filters.map(([column], index) => `${column} = $${index + 1}`).join(" AND ")
        const result = await pg.query<Row>(
          `SELECT to_jsonb(t) AS row FROM public.${table} t${where ? ` WHERE ${where}` : ""}`,
          filters.map(([, value]) => value),
        )
        const rows = result.rows.map((row) => row.row as Row)
        return { data: single ? (rows[0] ?? null) : rows, error: null }
      }
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters.push([column, value])
          return chain
        },
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          single = true
          return run()
        },
        then: (resolve: (value: Awaited<ReturnType<typeof run>>) => unknown) => run().then(resolve),
      }
      return chain
    },
  }
}

test("after apply, Stage 3 keeps HEAT&GLOW out of post-wash and offers it pre-heat only to blow-dry users", async (t) => {
  const pg = await seededDatabase(t)
  await pg.exec(await readRepoFile(MIGRATION))
  const facts = await loadScanProductFacts(pgliteClient(pg) as never, "leave_in", HEAT_GLOW, {
    hairThickness: "normal",
    role: "pre_heat_application",
    shampooTarget: null,
    conditionerTarget: null,
  })
  assert.equal(facts?.category, "leave_in")
  if (facts?.category !== "leave_in") return
  assert.deepEqual(facts.spec.heatActivation, { route: "airflow_shaping" })
  const base = (
    role: "post_wash_leave_in" | "pre_heat_application",
    heatRoutes: Array<"airflow_shaping" | "direct_contact_heat">,
  ) =>
    ({
      category: "leave_in",
      authorityVersion: "personal-plan.leave-in.v3",
      refinedVersionId: "refined",
      refinedInputHash: "hash",
      subjectKey: `scan:leave_in:${role}`,
      role,
      capturedProductId: null,
      subjectIdentity: null,
      categoryDecision: {
        category: "leave_in",
        resolution: "resolved",
        needTier: "basis",
        roles: [role],
        target: {
          category: "leave_in",
          roles: [role],
          weight: "medium",
          careDirection: "moisture",
          repairSupportLevel: "medium",
          functions: [],
          conditionerReplacementEligible: false,
        },
        frequency: null,
        reasons: [],
        executionState: "available",
        executionPauseReason: null,
        deferredFacts: [],
      },
      coverage: [],
      productFacts: facts,
      recommendationCandidates: [],
      hairThickness: "normal",
      heatRoutes,
      heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
    }) as unknown as Stage3AuthorityInput
  const postWash = evaluateStage3Authority(base("post_wash_leave_in", ["airflow_shaping"]))
  assert.equal(postWash.status === "known" && postWash.verdict, "mismatch")
  const blowDry = evaluateStage3Authority(base("pre_heat_application", ["airflow_shaping"]))
  assert.ok(
    blowDry.status === "known" && (blowDry.verdict === "ideal" || blowDry.verdict === "supportive"),
  )
  const straightener = evaluateStage3Authority(
    base("pre_heat_application", ["direct_contact_heat"]),
  )
  assert.equal(straightener.status === "known" && straightener.verdict, "mismatch")
})

test("applied protocol rows are exactly the reviewed rows Stage 5 renders (tests/heat-activated-protocols.test.ts)", async (t) => {
  const pg = await seededDatabase(t)
  await pg.exec(await readRepoFile(MIGRATION))
  const stored = await pg.query<Row>(
    `SELECT product_id, role, application_family, application_stage, application_state, placement,
            rinse_action, reapplication, source_label, source_url, source_text, guidance_payload, guidance_payload_v2
       FROM public.product_application_protocols
      WHERE product_id = ANY($1::uuid[]) AND role = 'pre_heat_protection'
      ORDER BY product_id, application_family`,
    [[NEQI, HEAT_GLOW]],
  )
  const expected = [
    buildHeatActivatedProtocolRow(NEQI_DIAMOND_GLASS_ULTIMATE_HEAT_ACTIVATED_ROW_INPUT),
    ...PANTENE_HEAT_GLOW_HEAT_ACTIVATED_ROW_INPUTS.map(buildHeatActivatedProtocolRow),
  ]
    .map((row) => ({
      product_id: row.product_id,
      role: row.role,
      application_family: (row.guidance_payload as Row).applicationFamily,
      application_stage: row.application_stage,
      application_state: row.application_state,
      placement: row.placement,
      rinse_action: row.rinse_action,
      reapplication: row.reapplication,
      source_label: row.source_label,
      source_url: row.source_url,
      source_text: row.source_text,
      guidance_payload: row.guidance_payload,
      guidance_payload_v2: row.guidance_payload_v2,
    }))
    .sort((left, right) =>
      `${left.product_id}|${String(left.application_family)}` <
      `${right.product_id}|${String(right.application_family)}`
        ? -1
        : 1,
    )
  assert.deepEqual(
    stored.rows.map((row) => ({ ...row })),
    JSON.parse(JSON.stringify(expected)),
  )
})
