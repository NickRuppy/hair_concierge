import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const PRODUCT_ID = "8f84eae5-222d-4bbf-9ab0-f30361882a95"

test("the Stage 5 V2 authority artifact carries forward the live K18 protocol", () => {
  const artifact = JSON.parse(
    readFileSync(
      "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json",
      "utf8",
    ),
  )
  const k18 = artifact.items.find(
    (item: { product_id: string; source_role: string }) =>
      item.product_id === PRODUCT_ID && item.source_role === "post_wash_leave_in",
  )

  assert.ok(k18, "live K18 post_wash_leave_in protocol is missing")
  assert.equal(k18.guidance_payload_v2.applicationFamily, "post_wash_damp_conditioning")
  assert.deepEqual(k18.guidance_payload_v2.facts.contactTime, {
    kind: "seconds",
    seconds: 240,
  })
  assert.equal(k18.guidance_payload_v2.runtimeBlockerCode, null)
})
