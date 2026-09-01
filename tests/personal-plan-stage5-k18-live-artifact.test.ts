import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import test from "node:test"

import { stage5V2SourceFingerprint } from "@/lib/product-intake/catalog-enrichment/stage5-v2-application"

const PRODUCT_ID = "8f84eae5-222d-4bbf-9ab0-f30361882a95"
const K18_READINESS_PATH =
  "data/catalog-enrichment/personal-plan-stage5-v1/S5R-02-k18-molecular-repair-hair-mist-readiness.json"

test("the Stage 5 V2 authority artifact carries forward the live K18 protocol", () => {
  const artifact = JSON.parse(
    readFileSync(
      "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json",
      "utf8",
    ),
  )
  const readinessText = readFileSync(K18_READINESS_PATH, "utf8")
  const readiness = JSON.parse(readinessText)
  const sourceFile = artifact.source_files.find(
    (file: { path: string }) => file.path === K18_READINESS_PATH,
  )
  const k18 = artifact.items.find(
    (item: { product_id: string; source_role: string }) =>
      item.product_id === PRODUCT_ID && item.source_role === "post_wash_leave_in",
  )

  assert.ok(k18, "live K18 post_wash_leave_in protocol is missing")
  assert.deepEqual(sourceFile, {
    path: K18_READINESS_PATH,
    sha256: createHash("sha256").update(readinessText).digest("hex"),
  })
  assert.equal(
    k18.source_fingerprint,
    stage5V2SourceFingerprint(
      readiness.item.target.protocol.role,
      readiness.item.target.protocol.guidance_payload,
    ),
  )
  assert.equal(k18.guidance_payload_v2.applicationFamily, "post_wash_damp_conditioning")
  assert.deepEqual(k18.guidance_payload_v2.facts.contactTime, {
    kind: "seconds",
    seconds: 240,
  })
  assert.equal(k18.guidance_payload_v2.runtimeBlockerCode, null)
})
