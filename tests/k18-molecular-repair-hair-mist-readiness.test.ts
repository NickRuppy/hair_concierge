import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { productApplicationPointerV2Schema } from "../src/lib/routines/personal-plan/application/contracts-v2"
import { applicationGuidanceProtocolSchema } from "../src/lib/routines/personal-plan/application/contracts"

const manifestPath =
  "data/catalog-enrichment/personal-plan-stage5-v1/S5R-02-k18-molecular-repair-hair-mist-readiness.json"
const migrationPath =
  "supabase/migrations/20260901090000_k18_molecular_repair_hair_mist_readiness.sql"

test("K18 Molecular Repair Hair Mist readiness artifact is exact, complete, and fingerprinted", async () => {
  const raw = await readFile(manifestPath, "utf8")
  const manifest = JSON.parse(raw) as {
    schema_version: string
    batch_id: string
    review: { state: string; reviewed_by: string }
    item: {
      expected_product: unknown
      target: {
        product: unknown
        leave_in_specs: unknown
        eligibility: unknown
        protocol: {
          guidance_payload: unknown
          guidance_payload_v2: unknown
        }
      }
      sources: Array<{ url: string; source_type: string; text: string }>
    }
  }

  assert.equal(manifest.schema_version, "k18-molecular-repair-hair-mist-readiness-v1")
  assert.equal(manifest.batch_id, "S5R-02-k18-mist-readiness")
  assert.deepEqual(manifest.review, { state: "approved_by_nick", reviewed_by: "nick" })
  assert.deepEqual(manifest.item.expected_product, {
    id: "8f84eae5-222d-4bbf-9ab0-f30361882a95",
    brand: "K18",
    name: "K18 Hair Professional Molecular Repair Hair Mist",
    category_key: "leave_in",
    origin: "curated",
    is_active: true,
    lifecycle_status: "active",
  })
  assert.deepEqual(manifest.item.target.product, {
    description:
      "K18 Hair Professional Molecular Repair Hair Mist ist ein leichtes Leave-in für Längen und Spitzen bei Proteinbedarf.",
    suitable_thicknesses: ["fine", "normal", "coarse"],
    net_content_value: 300,
    net_content_unit: "ml",
  })
  assert.deepEqual(manifest.item.target.leave_in_specs, {
    ingredient_flags: ["humectants", "proteins", "polymers"],
    care_direction: "protein",
    repair_support_level: "medium",
    plan_roles: ["post_wash_leave_in"],
    functional_benefits: ["repair_support"],
    provides_heat_protection: false,
  })
  assert.deepEqual(manifest.item.target.eligibility, [
    { thickness: "fine", need_bucket: "repair", styling_context: "air_dry" },
    { thickness: "fine", need_bucket: "repair", styling_context: "non_heat_style" },
    { thickness: "normal", need_bucket: "repair", styling_context: "air_dry" },
    { thickness: "normal", need_bucket: "repair", styling_context: "non_heat_style" },
    { thickness: "coarse", need_bucket: "repair", styling_context: "air_dry" },
    { thickness: "coarse", need_bucket: "repair", styling_context: "non_heat_style" },
  ])
  assert.equal(
    applicationGuidanceProtocolSchema.safeParse(manifest.item.target.protocol.guidance_payload)
      .success,
    true,
  )
  assert.equal(
    productApplicationPointerV2Schema.safeParse(manifest.item.target.protocol.guidance_payload_v2)
      .success,
    true,
  )
  assert.deepEqual(
    manifest.item.sources.map(({ url, source_type }) => ({ url, source_type })),
    [
      {
        url: "https://www.k18hairpro.com/products/professional-molecular-repair-mist-300-ml-wholesale",
        source_type: "manufacturer",
      },
      {
        url: "https://www.k18hairpro.com/products/professional-molecular-repair-mist-300-ml-wholesale",
        source_type: "internal_verified",
      },
      { url: "https://www.cosmoprofbeauty.com/USA-040285.html", source_type: "retailer" },
    ],
  )
  assert.match(manifest.item.sources[1]!.text, /Nick approved/i)

  const migration = await readFile(migrationPath, "utf8")
  assert.match(migration, /K18 Molecular Repair Hair Mist readiness fingerprint: ([a-f0-9]{64})/)
  const fingerprint = createHash("sha256").update(raw).digest("hex")
  assert.match(migration, new RegExp(fingerprint))
})
