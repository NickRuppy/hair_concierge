import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const migrationsDir = join(process.cwd(), "supabase/migrations")
const migrationPath = join(
  migrationsDir,
  readdirSync(migrationsDir).find((name) =>
    name.endsWith("_add_personal_plan_result_returns.sql"),
  ) ?? "missing_add_personal_plan_result_returns.sql",
)
const migration = readFileSync(migrationPath, "utf8").replace(/\s+/g, " ")

test("result-return migration keeps a private, bounded, service-role capability mapping", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.personal_plan_result_returns/)
  assert.match(
    migration,
    /token_hash text NOT NULL UNIQUE CHECK \(token_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/,
  )
  assert.match(
    migration,
    /lead_id uuid NOT NULL UNIQUE REFERENCES public\.leads\(id\) ON DELETE CASCADE/,
  )
  assert.match(migration, /expires_at > created_at/)
  assert.match(migration, /expires_at <= created_at \+ interval '720 hours'/)
  assert.match(
    migration,
    /ALTER TABLE public\.personal_plan_result_returns ENABLE ROW LEVEL SECURITY/,
  )
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.personal_plan_result_returns FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    migration,
    /GRANT (?:SELECT, INSERT, UPDATE, DELETE|ALL) ON TABLE public\.personal_plan_result_returns TO service_role/,
  )
  assert.match(migration, /CREATE INDEX .*personal_plan_result_returns.*expiry/i)
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.resolve_personal_plan_result_return\(p_token_hash text\)/,
  )
  assert.match(migration, /SECURITY DEFINER SET search_path = ''/)
  assert.match(migration, /public\.leads/)
  assert.match(migration, /quiz_kind = 'personal_plan'/)
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.purge_expired_personal_plan_result_returns\(p_limit integer DEFAULT 100\)/,
  )
  assert.match(
    migration,
    /LIMIT CASE WHEN p_limit IS NULL THEN 100 WHEN p_limit < 1 THEN 1 WHEN p_limit > 500 THEN 500 ELSE p_limit END FOR UPDATE SKIP LOCKED/,
  )
  assert.doesNotMatch(migration, /(?<!pg_catalog\.)\bnow\(\)/)
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.resolve_personal_plan_result_return\(text\) FROM PUBLIC, anon, authenticated/,
  )
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.resolve_personal_plan_result_return\(text\) TO service_role/,
  )
  assert.doesNotMatch(migration, /\b(email|name|quiz_answers|payment)\b/i)
})
