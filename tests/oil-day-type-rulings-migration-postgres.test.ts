import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import { buildExpansionProtocolRow } from "@/lib/product-intake/expansion-apply-templates"
import {
  SHARED_APPLICATION_TEMPLATE_BY_KEY_V2,
  SHARED_APPLICATION_TEMPLATES_AT_ARTIFACT_FREEZE_V2,
} from "@/lib/routines/personal-plan/application/shared-templates-v2"

const ROOT = new URL("../", import.meta.url)
const MIGRATION = "supabase/migrations/20260929231000_oil_day_type_rulings.sql"
const BETWEEN_WASH_OIL_KEYS = [
  "oil.finish.damp-refresh.v2",
  "oil.finish.dry-care.v2",
  "oil.leave-in.damp-refresh.v2",
  "oil.leave-in.dry-care.v2",
] as const

const WASH_FAMILY = ["wash_day", "intensive_care_day", "bond_repair_day", "clarifying_wash_day"]

const STUB = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TABLE public.products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL);
CREATE TABLE public.product_application_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  category text NOT NULL,
  role text NOT NULL,
  guidance_payload jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`

async function migrationSql(): Promise<string> {
  return readFile(new URL(MIGRATION, ROOT), "utf8")
}

async function database(t: { after: (fn: () => Promise<void>) => void }): Promise<PGlite> {
  const pg = new PGlite()
  t.after(async () => {
    await pg.close()
  })
  await pg.exec(STUB)
  for (const path of [
    "supabase/migrations/20260808062747_personal_plan_application_guidance.sql",
    "supabase/migrations/20260812182731_personal_plan_stage5_v2_generation_storage.sql",
  ]) {
    await pg.exec(await readFile(new URL(path, ROOT), "utf8"))
  }
  return pg
}

/** The template as published before O4 — the version the frozen artifact still embeds. */
function previousTemplate(key: (typeof BETWEEN_WASH_OIL_KEYS)[number]) {
  return SHARED_APPLICATION_TEMPLATES_AT_ARTIFACT_FREEZE_V2.find(
    (entry) => entry.guidanceKey === key,
  )!
}

async function seedTemplates(pg: PGlite) {
  for (const key of BETWEEN_WASH_OIL_KEYS) {
    const payload = previousTemplate(key)
    await pg.query(
      `INSERT INTO public.application_guidance_protocols (
         id, guidance_key, protocol_version, locale, scope_kind, category_key, role_key,
         application_family, payload, status, verified_at, contract_version)
       VALUES (gen_random_uuid(), $1, 2, 'de', 'application_family', 'oil', $2, $3, $4, 'active', now(), 2)`,
      [key, payload.role, payload.applicationFamily, JSON.stringify(payload)],
    )
  }
}

async function seedOil(pg: PGlite, role: string, days: string[]) {
  const product = await pg.query<{ id: string }>(
    "INSERT INTO public.products (name) VALUES ('Öl') RETURNING id",
  )
  const productId = product.rows[0]!.id
  const template = role === "dry_finish" ? "TPL-OIL-DRYFINISH" : "TPL-OIL-LEAVEON"
  const row = buildExpansionProtocolRow(template, {
    productId,
    evidence: [
      { sourceUrl: "https://www.dm.de/p/oil", sourceType: "retailer", checkedAt: "2026-09-02" },
    ],
  }) as { guidance_payload: Record<string, unknown> }
  const payload = { ...row.guidance_payload, compatibleDayTypes: days }
  const inserted = await pg.query<{ id: string }>(
    `INSERT INTO public.product_application_protocols (product_id, category, role, guidance_payload)
     VALUES ($1, 'oil', $2, $3) RETURNING id`,
    [productId, role, JSON.stringify(payload)],
  )
  return { id: inserted.rows[0]!.id, payload }
}

async function storedPayload(pg: PGlite, id: string) {
  const result = await pg.query<{ guidance_payload: Record<string, unknown> }>(
    "SELECT guidance_payload FROM public.product_application_protocols WHERE id = $1",
    [id],
  )
  return result.rows[0]!.guidance_payload
}

async function activeTemplates(pg: PGlite) {
  const result = await pg.query<{
    guidance_key: string
    protocol_version: number
    payload: unknown
  }>(
    `SELECT guidance_key, protocol_version, payload FROM public.application_guidance_protocols
     WHERE status = 'active' AND guidance_key LIKE 'oil.%' ORDER BY guidance_key`,
  )
  return result.rows
}

test("the migration's template literals are the code templates, before and after O4", async () => {
  const sql = await migrationSql()
  for (const key of BETWEEN_WASH_OIL_KEYS) {
    const next = SHARED_APPLICATION_TEMPLATE_BY_KEY_V2.get(key)!
    assert.equal(next.protocolVersion, 3, key)
    assert.deepEqual(next.compatibleDayTypes, ["between_wash_care_day"], key)
    assert.ok(sql.includes(`$json$${JSON.stringify(next)}$json$`), `${key}: v3 literal`)
    assert.ok(
      sql.includes(`$json$${JSON.stringify(previousTemplate(key))}$json$`),
      `${key}: v2 literal`,
    )
  }
})

test("O4 retires the Refresh-Tag Oil templates as version 2 and publishes version 3", async (t) => {
  const pg = await database(t)
  await seedTemplates(pg)

  await pg.exec(await migrationSql())
  const active = await activeTemplates(pg)
  assert.deepEqual(
    active.map(({ guidance_key, protocol_version }) => [guidance_key, protocol_version]),
    BETWEEN_WASH_OIL_KEYS.map((key) => [key, 3]),
  )
  for (const row of active) {
    assert.deepEqual(row.payload, SHARED_APPLICATION_TEMPLATE_BY_KEY_V2.get(row.guidance_key))
  }
  const retired = await pg.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM public.application_guidance_protocols WHERE status = 'retired'",
  )
  assert.equal(retired.rows[0]!.count, 4)

  await pg.exec(await migrationSql())
  assert.deepEqual(await activeTemplates(pg), active, "a re-run is a no-op")
})

test("O4 refuses a drifted active template and leaves it active", async (t) => {
  const pg = await database(t)
  await seedTemplates(pg)
  await pg.query(
    `UPDATE public.application_guidance_protocols SET status = 'retired'
     WHERE guidance_key = 'oil.finish.dry-care.v2'`,
  )
  const drifted = { ...previousTemplate("oil.finish.dry-care.v2"), protocolVersion: 5 }
  await pg.query(
    `INSERT INTO public.application_guidance_protocols (
       id, guidance_key, protocol_version, locale, scope_kind, category_key, role_key,
       application_family, payload, status, verified_at, contract_version)
     VALUES (gen_random_uuid(), 'oil.finish.dry-care.v2', 5, 'de', 'application_family', 'oil', 'finish',
       'between_wash_dry_care', $1, 'active', now(), 2)`,
    [JSON.stringify(drifted)],
  )
  await assert.rejects(
    pg.exec(await migrationSql()),
    /shared template oil\.finish\.dry-care\.v2 does not match its reviewed version 2/,
  )
  await pg.exec("ROLLBACK")
  const active = await activeTemplates(pg)
  assert.ok(
    active.every(({ protocol_version }) => protocol_version !== 3),
    "nothing was published",
  )
})

test("O4 refuses a version-3 row whose indexed columns drifted", async (t) => {
  const pg = await database(t)
  await seedTemplates(pg)
  await pg.exec(await migrationSql())
  await pg.query(
    `UPDATE public.application_guidance_protocols SET status = 'retired'
     WHERE guidance_key = 'oil.finish.dry-care.v2' AND protocol_version = 3`,
  )
  await pg.query(
    `INSERT INTO public.application_guidance_protocols (
       id, guidance_key, protocol_version, locale, scope_kind, category_key, role_key,
       application_family, payload, status, verified_at, contract_version)
     VALUES (gen_random_uuid(), 'oil.finish.dry-care.v2', 4, 'de', 'application_family', 'oil',
       'leave_in', 'between_wash_dry_care', $1, 'active', now(), 2)`,
    [JSON.stringify(SHARED_APPLICATION_TEMPLATE_BY_KEY_V2.get("oil.finish.dry-care.v2"))],
  )
  await assert.rejects(
    pg.exec(await migrationSql()),
    /shared template oil\.finish\.dry-care\.v2 has drifted indexed columns/,
  )
  await pg.exec("ROLLBACK")
})

test("O2 realigns every V1 Oil leave-on day set, leaves dry-finish rows alone, and refuses unknown sets", async (t) => {
  const pg = await database(t)
  const staleLeaveOn = await seedOil(pg, "leave_on_fibre_conditioning", [
    "wash_day",
    "intensive_care_day",
    "styling_day",
  ])
  const ruledLeaveOn = await seedOil(pg, "leave_on_fibre_conditioning", WASH_FAMILY)
  const templateDry = await seedOil(pg, "dry_finish", [
    "wash_day",
    "intensive_care_day",
    "styling_day",
    "between_wash_care_day",
  ])
  const shortDry = await seedOil(pg, "dry_finish", [
    "wash_day",
    "styling_day",
    "between_wash_care_day",
  ])

  await pg.exec(await migrationSql())
  for (const [row, expected] of [
    [staleLeaveOn, WASH_FAMILY],
    [ruledLeaveOn, WASH_FAMILY],
    [templateDry, templateDry.payload.compatibleDayTypes],
    [shortDry, shortDry.payload.compatibleDayTypes],
  ] as const) {
    const stored = await storedPayload(pg, row.id)
    assert.deepEqual(stored.compatibleDayTypes, expected)
    assert.deepEqual(
      { ...stored, compatibleDayTypes: null },
      { ...row.payload, compatibleDayTypes: null },
      "only the day set changed",
    )
  }
  await pg.exec(await migrationSql())

  await seedOil(pg, "leave_on_fibre_conditioning", ["styling_day"])
  await assert.rejects(
    pg.exec(await migrationSql()),
    /oil leave-on protocols with an unreviewed day set: 1/,
  )
  await pg.exec("ROLLBACK")
})
