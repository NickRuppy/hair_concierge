import assert from "node:assert/strict"
import test from "node:test"

import { applyOilResearchAdapter } from "../src/lib/product-intake/oil-research-adapter"
import { makeCurrentOilEnvelope } from "./fixtures/oil-research/current"

const submissionId = "00000000-0000-4000-8000-000000000111"

function admittedEnvelope() {
  return makeCurrentOilEnvelope()
}

test("current oil intake helper replaces only its singleton and exact rationale subtree", () => {
  const envelope = admittedEnvelope()
  const beforeEnvelope = structuredClone(envelope)
  const final: Record<string, unknown> = {
    product: { suitable_thicknesses: ["coarse"], clean_name: "Unrelated" },
    category_specs: {
      product_oil_specs: { weight: "rich", role_support: ["dry_finish"] },
      product_oil_eligibility: [{ thickness: "coarse" }],
      product_application_protocols: [{ role: "dry_finish" }],
    },
    field_rationales: {
      "product.clean_name": "Keep this.",
      "category_specs.product_oil_specs": "stale root",
      "category_specs.product_oil_specs.weight": "stale child",
      "category_specs.product_oil_specs[0]": "stale array child",
      "category_specs.product_oil_specs_extra[0]": "unrelated neighboring key",
      "category_specs.product_oil_eligibility": "manual matching remains",
    },
  }
  const artifacts = [{ kind: "property_synthesis", payload: { oil_research_envelope: envelope } }]

  const result = applyOilResearchAdapter({ final, artifacts, expectedResearchId: submissionId })
  assert.deepEqual(result.blockers, [])
  const categorySpecs = final.category_specs as Record<string, unknown>
  assert.deepEqual(categorySpecs.product_oil_specs, {
    weight: "light",
    role_support: ["dry_finish"],
    provides_heat_protection: false,
  })
  assert.deepEqual(categorySpecs.product_oil_eligibility, [{ thickness: "coarse" }])
  assert.deepEqual(categorySpecs.product_application_protocols, [{ role: "dry_finish" }])
  assert.deepEqual((final.product as Record<string, unknown>).suitable_thicknesses, ["coarse"])
  const rationales = final.field_rationales as Record<string, unknown>
  assert.equal(rationales["product.clean_name"], "Keep this.")
  assert.equal(rationales["category_specs.product_oil_specs"], undefined)
  assert.match(
    rationales["category_specs.product_oil_specs.weight"] as string,
    /complete formula and maker direction review/,
  )
  assert.match(
    rationales["category_specs.product_oil_specs.role_support"] as string,
    /complete formula and maker direction review/,
  )
  assert.match(
    rationales["category_specs.product_oil_specs.provides_heat_protection"] as string,
    /complete formula and maker direction review/,
  )
  assert.equal(rationales["category_specs.product_oil_specs[0]"], undefined)
  assert.equal(rationales["category_specs.product_oil_specs_extra[0]"], "unrelated neighboring key")
  assert.equal(rationales["category_specs.product_oil_eligibility"], "manual matching remains")
  const payload = artifacts[0]!.payload as Record<string, unknown>
  assert.deepEqual(payload.oil_research_envelope, beforeEnvelope)
  assert.ok(payload.oil_production_projection)
  assert.ok(payload.oil_retained_only_coverage)
})

test("oil intake helper has exact UUID/submission binding and refuses without mutation", () => {
  const envelope = admittedEnvelope()
  const final: Record<string, unknown> = {
    category_specs: { product_oil_specs: { weight: "rich" } },
    field_rationales: { "category_specs.product_oil_specs": "old" },
  }
  const artifacts = [{ kind: "property_synthesis", payload: { oil_research_envelope: envelope } }]
  const beforeFinal = structuredClone(final)
  const beforeArtifacts = structuredClone(artifacts)

  const mismatch = applyOilResearchAdapter({
    final,
    artifacts,
    expectedResearchId: "00000000-0000-4000-8000-000000000222",
  })
  assert.match(mismatch.blockers.join(" "), /must match Product Intake submission/)
  assert.deepEqual(final, beforeFinal)
  assert.deepEqual(artifacts, beforeArtifacts)

  const missing = applyOilResearchAdapter({
    final,
    artifacts: [
      ...artifacts,
      { kind: "property_synthesis", payload: { oil_research_envelope: admittedEnvelope() } },
    ],
    expectedResearchId: submissionId,
  })
  assert.match(missing.blockers.join(" "), /exactly one/)
  assert.deepEqual(final, beforeFinal)
  assert.deepEqual(artifacts, beforeArtifacts)
})

test("semantic needs-research refusal does not add projection receipts or alter the final payload", () => {
  const envelope = admittedEnvelope()
  ;(envelope.profile.weight as { value: string }).value = "unknown"
  const final: Record<string, unknown> = { category_specs: { retained: true } }
  const artifacts = [{ kind: "property_synthesis", payload: { oil_research_envelope: envelope } }]
  const beforeFinal = structuredClone(final)
  const beforeArtifacts = structuredClone(artifacts)

  const result = applyOilResearchAdapter({ final, artifacts, expectedResearchId: submissionId })
  assert.match(result.blockers.join(" "), /invalid admitted oil research envelope/i)
  assert.deepEqual(final, beforeFinal)
  assert.deepEqual(artifacts, beforeArtifacts)
})
