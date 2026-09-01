import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { productApplicationPointerV2Schema } from "../src/lib/routines/personal-plan/application/contracts-v2"
import { SHARED_APPLICATION_TEMPLATE_BY_KEY_V2 } from "../src/lib/routines/personal-plan/application/shared-templates-v2"

const artifact = JSON.parse(
  readFileSync(
    "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json",
    "utf8",
  ),
) as {
  observed_counts: {
    rows: number
    products: number
    exact_workflows: number
    family_templates: number
    composable_rows: number
    blocked_rows: number
    by_category: Record<string, number>
  }
  family_templates: unknown[]
  items: Array<{
    key: string
    product_id: string
    product_name: string
    source_role: string
    template_keys: string[]
    exact_workflow_id: string | null
    guidance_payload_v2: unknown
  }>
}

test("Stage 5 V2 backfill exhaustively covers the reviewed production-shaped snapshot", () => {
  assert.deepEqual(artifact.observed_counts, {
    rows: 309,
    products: 240,
    exact_workflows: 4,
    family_templates: 28,
    composable_rows: 309,
    blocked_rows: 0,
    by_category: {
      bondbuilder: 3,
      conditioner: 42,
      deep_cleansing_shampoo: 6,
      dry_shampoo: 10,
      heat_protectant: 7,
      leave_in: 79,
      mask: 34,
      oil: 71,
      scalp_care: 8,
      shampoo: 49,
    },
  })
  assert.equal(new Set(artifact.items.map(({ key }) => key)).size, artifact.items.length)
  assert.equal(new Set(artifact.items.map(({ product_id }) => product_id)).size, 240)
  assert.equal(artifact.family_templates.length, SHARED_APPLICATION_TEMPLATE_BY_KEY_V2.size)
})

test("every V2 row validates and ordinary products contain no visible bespoke steps", () => {
  for (const item of artifact.items) {
    const pointer = productApplicationPointerV2Schema.parse(item.guidance_payload_v2)
    assert.equal(pointer.scope.productId, item.product_id)
    assert.equal(pointer.sourceRole, item.source_role)
    if (item.exact_workflow_id === null) {
      assert.deepEqual(pointer.exactSteps, [], item.key)
      assert.ok(item.template_keys.length > 0, item.key)
      for (const templateKey of item.template_keys) {
        assert.ok(SHARED_APPLICATION_TEMPLATE_BY_KEY_V2.has(templateKey), templateKey)
      }
    } else {
      assert.equal(pointer.workflowId, item.exact_workflow_id)
      assert.ok(pointer.exactSteps.length > 0, item.key)
    }
  }
})

test("all OGX shampoos use the canonical shampoo template with no exact steps", () => {
  const rows = artifact.items.filter(
    (item) => /OGX/i.test(item.product_name) && item.source_role.startsWith("shampoo_"),
  )
  assert.ok(rows.length > 0)
  for (const row of rows) {
    const pointer = productApplicationPointerV2Schema.parse(row.guidance_payload_v2)
    assert.deepEqual(row.template_keys, ["shampoo.standard-scalp-cleanse.v2"])
    assert.deepEqual(pointer.exactSteps, [])
    assert.equal(pointer.facts.contactTime, null)
  }
})

test("only the three reviewed conditioners retain a typed wait", () => {
  const timed = artifact.items
    .filter((item) => item.source_role === "conditioner_rinse_out")
    .flatMap((item) => {
      const pointer = productApplicationPointerV2Schema.parse(item.guidance_payload_v2)
      return pointer.facts.contactTime ? [item.product_name] : []
    })
    .sort()

  assert.deepEqual(timed, [
    "Elvital Fiber Booster Conditioner",
    "Nivea Power Repair Conditioner",
    "Nivea Volumen & Kraft Conditioner",
  ])
})

test("targeted shampoo timing is rendered once instead of repeated as a generic caution", () => {
  const targeted = artifact.items.filter((item) => {
    const pointer = productApplicationPointerV2Schema.parse(item.guidance_payload_v2)
    return pointer.applicationFamily === "targeted_treatment_shampoo"
  })

  assert.ok(targeted.length > 0)
  for (const item of targeted) {
    const pointer = productApplicationPointerV2Schema.parse(item.guidance_payload_v2)
    assert.ok(pointer.facts.contactTime, item.key)
    assert.equal(pointer.cautionCodes.includes("follow_label_time"), false, item.key)
  }
})

test("retired OLAPLEX No.0 is the only removed pointer", () => {
  assert.equal(
    artifact.items.some(({ product_id }) => product_id === "aadbbab5-bcf5-4b46-b38a-5533648bcb1d"),
    false,
  )
  assert.equal(
    artifact.items.some(({ exact_workflow_id }) => exact_workflow_id === null),
    true,
  )
  assert.equal(
    artifact.items.filter(({ exact_workflow_id }) => exact_workflow_id !== null).length,
    4,
  )
})
