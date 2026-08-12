import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationPath = new URL(
  "../supabase/migrations/20260812182731_personal_plan_stage5_v2_generation_storage.sql",
  import.meta.url,
)

test("V2 guidance storage expands without changing the active V1 generation", async () => {
  const source = await readFile(migrationPath, "utf8")

  assert.match(
    source,
    /ALTER TABLE public\.application_guidance_protocols[\s\S]*ADD COLUMN contract_version integer NOT NULL DEFAULT 1/,
  )
  assert.match(source, /CHECK \(contract_version IN \(1, 2\)\)/)
  assert.match(
    source,
    /ALTER TABLE public\.product_application_protocols[\s\S]*ADD COLUMN guidance_payload_v2 jsonb/,
  )
  assert.match(
    source,
    /guidance_payload_v2 IS NULL[\s\S]*jsonb_typeof\(guidance_payload_v2\) = 'object'/,
  )
  assert.match(source, /guidance_payload_v2->>'schemaVersion' = '2'/)
  assert.doesNotMatch(source, /UPDATE public\.application_guidance_protocols/)
  assert.doesNotMatch(source, /UPDATE public\.product_application_protocols/)
})
