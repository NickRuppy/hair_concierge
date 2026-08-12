import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  preflightStage5V2ApplicationArtifact,
  stage5V2SourceFingerprint,
} from "../src/lib/product-intake/catalog-enrichment/stage5-v2-application"

const generated = JSON.parse(
  readFileSync(
    "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json",
    "utf8",
  ),
)
const originalItem = generated.items.find(
  (item: { product_name: string }) =>
    item.product_name === "OGX Renewing + Argan Oil of Morocco Shampoo",
)
const sourcePayload = { reviewed: "V1 source authority" }
const item = {
  ...originalItem,
  source_fingerprint: stage5V2SourceFingerprint(originalItem.source_role, sourcePayload),
}
const familyTemplate = generated.family_templates.find(
  (template: { guidanceKey: string }) => template.guidanceKey === item.template_keys[0],
)
const artifact = {
  schema_version: generated.schema_version,
  snapshot_date: generated.snapshot_date,
  source_kind: generated.source_kind,
  source_files: [],
  observed_counts: {
    rows: 1,
    products: 1,
    exact_workflows: 0,
    family_templates: 1,
    composable_rows: 1,
    blocked_rows: 0,
    by_category: { shampoo: 1 },
  },
  family_templates: [familyTemplate],
  items: [item],
}

function reads(payload: unknown = sourcePayload) {
  return {
    listProducts: async () => [
      {
        id: item.product_id,
        category_key: "shampoo",
        origin: "curated",
        is_active: true,
        lifecycle_status: "active",
      },
    ],
    listProtocols: async () => [
      {
        product_id: item.product_id,
        category: "shampoo",
        role: item.source_role,
        guidance_payload: payload,
      },
    ],
  }
}

test("Stage 5 V2 preflight binds the artifact to current product and V1 source authority", async () => {
  const result = await preflightStage5V2ApplicationArtifact(artifact, reads())

  assert.equal(result.ok, true)
  assert.deepEqual(result.blockers, [])
  assert.deepEqual(result.observed, {
    rows: 1,
    products: 1,
    familyTemplates: 1,
    exactWorkflows: 0,
    explicitRuntimeBlockers: 0,
  })
})

test("Stage 5 V2 preflight rejects source drift", async () => {
  const result = await preflightStage5V2ApplicationArtifact(artifact, reads({ changed: true }))

  assert.equal(result.ok, false)
  assert.deepEqual(result.blockers, [`source_protocol_diverged:${item.key}`])
})
