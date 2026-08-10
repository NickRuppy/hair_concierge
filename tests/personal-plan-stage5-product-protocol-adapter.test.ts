import assert from "node:assert/strict"
import test from "node:test"

import { adaptReviewedProductApplicationProtocols } from "../src/lib/routines/personal-plan/application/product-protocol-adapter"

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
