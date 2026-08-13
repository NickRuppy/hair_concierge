import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migration = new URL(
  "../supabase/migrations/20260813113000_personal_plan_stage3_comparison_presentation_metadata.sql",
  import.meta.url,
)

test("Stage 3 comparison metadata stays presentation-only and service-owned", async () => {
  const source = await readFile(migration, "utf8")

  assert.match(source, /ADD COLUMN IF NOT EXISTS net_content_value numeric/)
  assert.match(source, /ADD COLUMN IF NOT EXISTS net_content_unit text/)
  assert.match(source, /net_content_value IS NULL OR net_content_value > 0/)
  assert.match(source, /net_content_unit IS NULL OR net_content_unit IN \('ml', 'g'\)/)
  assert.match(source, /\(net_content_value IS NULL\) = \(net_content_unit IS NULL\)/)

  assert.match(source, /Jean&Len Conditioner Keratin\/Mandel'::text, 300::numeric, 'ml'/)
  assert.match(source, /Bali Curls Moisturising Conditioner'::text, 250::numeric, 'ml'/)
  assert.match(source, /Garnier Fructis Hair Food Aloe Vera Feuchtigkeits-Spülung'::text, 400::numeric, 'ml'/)
  assert.match(source, /products\.id = payload\.id/)
  assert.match(source, /products\.name = payload\.expected_name/)

  assert.match(source, /RENAME TO product_intake_approve_reviewed_product_before_net_content/)
  assert.match(source, /SECURITY DEFINER\s+SET search_path = ''/)
  assert.match(source, /approved_product_id := \(approval_result->>'product_id'\)::uuid/)
  assert.match(source, /UPDATE public\.products[\s\S]*WHERE id = approved_product_id/)
  assert.match(
    source,
    /REVOKE ALL ON FUNCTION public\.product_intake_approve_reviewed_product_before_net_content[\s\S]*FROM PUBLIC, anon, authenticated, service_role/,
  )
  assert.match(
    source,
    /GRANT EXECUTE ON FUNCTION public\.product_intake_approve_reviewed_product[\s\S]*TO service_role/,
  )
  assert.doesNotMatch(source, /SELECT public\.product_intake_approve_reviewed_product\(/)
})
