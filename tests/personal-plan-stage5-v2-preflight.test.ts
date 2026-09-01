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

function reads(payload: unknown = sourcePayload, pointer: unknown = undefined) {
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
        application_family: item.guidance_payload_v2.applicationFamily,
        guidance_payload: payload,
        ...(pointer === undefined ? {} : { guidance_payload_v2: pointer }),
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

test("Stage 5 V2 preflight exposes a conflicting stored V2 pointer before apply", async () => {
  const result = await preflightStage5V2ApplicationArtifact(
    artifact,
    reads(sourcePayload, { ...item.guidance_payload_v2, evidence: [] }),
  )

  assert.equal(result.ok, false)
  assert.deepEqual(result.blockers, [`v2_authority_conflict:${item.key}`])
})

test("Stage 5 V2 preflight rejects every stale observed-count projection", async () => {
  for (const [field, value, blocker] of [
    ["exact_workflows", 1, "observed_exact_workflow_count_mismatch"],
    ["composable_rows", 0, "observed_composable_count_mismatch"],
    ["blocked_rows", 1, "observed_blocked_count_mismatch"],
    ["by_category", { conditioner: 1 }, "observed_category_counts_mismatch"],
  ] as const) {
    const result = await preflightStage5V2ApplicationArtifact(
      { ...artifact, observed_counts: { ...artifact.observed_counts, [field]: value } },
      reads(),
    )
    assert.equal(result.ok, false, field)
    assert.deepEqual(result.blockers, [blocker], field)
  }
})

test("Stage 5 V2 preflight rejects an active curated protocol omitted from the artifact", async () => {
  const result = await preflightStage5V2ApplicationArtifact(artifact, {
    ...reads(),
    listActiveCuratedProtocols: async () => [
      {
        product_id: item.product_id,
        category: "shampoo",
        role: item.source_role,
        application_family: item.guidance_payload_v2.applicationFamily,
        guidance_payload: sourcePayload,
      },
      {
        product_id: "20000000-0000-4000-8000-000000000001",
        category: "shampoo",
        role: "shampoo_everyday",
        guidance_payload: { reviewed: "new source authority" },
      },
    ],
  })

  assert.equal(result.ok, false)
  assert.deepEqual(result.blockers, [
    "active_protocol_missing_from_artifact:20000000-0000-4000-8000-000000000001:shampoo_everyday:unknown",
  ])
})

test("Stage 5 V2 preflight binds a source row to its exact family when one role has variants", async () => {
  const result = await preflightStage5V2ApplicationArtifact(artifact, {
    ...reads(),
    listProtocols: async () => [
      {
        product_id: item.product_id,
        category: "shampoo",
        role: item.source_role,
        application_family: "targeted_treatment_shampoo",
        guidance_payload: sourcePayload,
      },
    ],
  })

  assert.equal(result.ok, false)
  assert.deepEqual(result.blockers, [`source_protocol_missing:${item.key}`])
})
