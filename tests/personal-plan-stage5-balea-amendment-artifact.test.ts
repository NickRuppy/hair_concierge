import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const PRODUCT_ID = "b000d235-1fc6-434c-9ba1-f1207d36cded"

test("the Stage 5 V2 authority artifact includes Balea ordinary wash guidance", () => {
  const artifact = JSON.parse(
    readFileSync(
      "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json",
      "utf8",
    ),
  )
  const balea = artifact.items.find(
    (item: { product_id: string; source_role: string }) =>
      item.product_id === PRODUCT_ID && item.source_role === "shampoo_everyday",
  )

  assert.ok(balea, "Balea shampoo_everyday amendment is missing")
  assert.equal(balea.guidance_payload_v2.applicationFamily, "standard_rinse_out_cleanse")
  assert.equal(balea.guidance_payload_v2.facts.contactTime, null)
  assert.equal(balea.guidance_payload_v2.runtimeBlockerCode, null)
})
