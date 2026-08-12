import assert from "node:assert/strict"
import test from "node:test"

import {
  adaptReviewedProductApplicationPointersV2,
  adaptReviewedProductApplicationProtocols,
} from "../src/lib/routines/personal-plan/application/product-protocol-adapter"

const productId = "30000000-0000-4000-8000-000000000001"

test("reviewed exact Heat instructions become damp and dry protocols without rewriting source text", () => {
  const sourceText =
    "Auf das handtuchtrockene oder trockene Haar sprühen. Anschließend wie gewohnt stylen."
  const protocols = adaptReviewedProductApplicationProtocols([
    {
      product_id: productId,
      category: "heat_protectant",
      role: "pre_heat_protection",
      application_state: "either",
      reapplication: "not_stated",
      source_url: "https://example.com/heat",
      source_text: sourceText,
      updated_at: "2026-08-10T09:00:00.000Z",
    },
  ])

  assert.deepEqual(
    protocols.map(({ applicationFamily, sequence, protocolFacts }) => ({
      applicationFamily,
      anchor: sequence.anchor,
      reapplication: protocolFacts.reapplication,
    })),
    [
      {
        applicationFamily: "damp_hair_protection",
        anchor: "damp_leave_on",
        reapplication: "none",
      },
      {
        applicationFamily: "dry_hair_protection",
        anchor: "dry_pre_heat",
        reapplication: "none",
      },
    ],
  )
  assert.ok(protocols.every((protocol) => protocol.scope.kind === "product"))
  assert.ok(protocols.every((protocol) => protocol.steps[0]?.copyTemplateDe === sourceText))
})

test("exact Heat adapter rejects rows without visible reviewed provenance", () => {
  const base = {
    product_id: productId,
    category: "heat_protectant",
    role: "pre_heat_protection",
    application_state: "dry",
    reapplication: "required",
    source_url: "https://example.com/heat",
    source_text: "Vor dem Glätten gleichmäßig auftragen.",
    updated_at: "2026-08-10T09:00:00.000Z",
  }

  assert.deepEqual(adaptReviewedProductApplicationProtocols([{ ...base, source_text: null }]), [])
  assert.deepEqual(adaptReviewedProductApplicationProtocols([{ ...base, source_url: null }]), [])
})

test("V2 adapter reads only the separate typed pointer payload and verifies indexed identity", () => {
  const pointer = {
    schemaVersion: 2,
    contractKind: "product_pointer",
    scope: { kind: "product", category: "shampoo", productId },
    sourceRole: "shampoo_everyday",
    role: "cleanse",
    applicationFamily: "standard_rinse_out_cleanse",
    facts: {
      applicationState: "wet_hair",
      applicationArea: "scalp_roots",
      rinse: "rinse_out",
      contactTime: null,
      amount: null,
      heat: null,
      conditionerPolicy: "not_applicable",
    },
    workflowId: null,
    requiredCompanionProductId: null,
    runtimeBlockerCode: null,
    exactSteps: [],
    cautionCodes: [],
    evidence: [
      {
        sourceUrl: "https://example.com/shampoo",
        sourceType: "manufacturer",
        checkedAt: "2026-08-12",
      },
    ],
  }
  const rows = [
    {
      product_id: productId,
      category: "shampoo",
      role: "shampoo_everyday",
      guidance_payload: { schemaVersion: 1 },
      guidance_payload_v2: pointer,
      application_state: null,
      reapplication: null,
      source_url: "https://example.com/shampoo",
      source_text: "Untrusted manufacturer prose",
      updated_at: "2026-08-12T09:00:00.000Z",
    },
  ]

  assert.deepEqual(adaptReviewedProductApplicationPointersV2(rows), [pointer])
  assert.deepEqual(
    adaptReviewedProductApplicationPointersV2([
      {
        ...rows[0]!,
        guidance_payload_v2: {
          ...pointer,
          scope: { ...pointer.scope, productId: "30000000-0000-4000-8000-000000000099" },
        },
      },
    ]),
    [],
  )
})
