import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import { applicationGuidanceProtocolSchema } from "../src/lib/routines/personal-plan/application/contracts"

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260808062747_personal_plan_application_guidance.sql",
)

async function migrationSql() {
  return readFile(migrationPath, "utf8")
}

test("Stage 5 migration defines only versioned canonical content tables", async () => {
  const sql = await migrationSql()

  assert.match(sql, /CREATE TABLE public\.application_day_type_definitions/i)
  assert.match(sql, /CREATE TABLE public\.application_guidance_protocols/i)
  assert.match(sql, /REFERENCES public\.products\(id\) ON DELETE RESTRICT/i)
  assert.match(sql, /PRIMARY KEY \(day_type_key, definition_version, locale\)/i)
  assert.match(sql, /UNIQUE \(guidance_key, protocol_version, locale\)/i)
  assert.match(sql, /WHERE status = 'active'/i)
  assert.match(sql, /scope_kind = 'product' AND product_id IS NOT NULL/i)
  assert.match(sql, /scope_kind = 'application_family' AND product_id IS NULL/i)
  assert.doesNotMatch(sql, /CREATE TABLE public\.(?:user_|personal_plan_).*application/i)
})

test("Stage 5 migration seeds the eight active German version-one day types", async () => {
  const sql = await migrationSql()
  const dayKeys = [
    "wash_day",
    "intensive_care_day",
    "bond_repair_day",
    "clarifying_wash_day",
    "refresh_day",
    "between_wash_care_day",
    "styling_day",
    "rest_day",
  ]

  for (const key of dayKeys) {
    assert.match(sql, new RegExp(`\\('${key}', 1, 'de',`))
  }
})

test("every active V1 guidance seed parses through the runtime contract", async () => {
  const sql = await migrationSql()
  const payloads = [...sql.matchAll(/\n    '(\{[\s\S]*?\})'::jsonb,\n    'active'/g)].map((match) =>
    JSON.parse(match[1]),
  )

  assert.ok(payloads.length > 0)
  for (const payload of payloads) {
    assert.equal(applicationGuidanceProtocolSchema.safeParse(payload).success, true)
  }
})

test("Stage 5 canonical content is server-read-only and active rows are immutable", async () => {
  const sql = await migrationSql()

  for (const table of ["application_day_type_definitions", "application_guidance_protocols"]) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, "i"))
    assert.match(
      sql,
      new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM PUBLIC, anon, authenticated`, "i"),
    )
    assert.match(sql, new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM service_role`, "i"))
    assert.match(sql, new RegExp(`GRANT SELECT ON TABLE public\\.${table} TO service_role`, "i"))
  }
  assert.match(sql, /active application content must be retired, not deleted/i)
  assert.match(sql, /only active-to-retired is allowed/i)
  assert.match(sql, /NEW\.updated_at := clock_timestamp\(\)/i)
  assert.match(sql, /status <> 'active' OR verified_at IS NOT NULL/i)
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.reject_active_application_content_mutation\(\) FROM PUBLIC, anon, authenticated/i,
  )
})
