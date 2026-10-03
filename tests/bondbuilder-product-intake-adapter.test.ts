import assert from "node:assert/strict"
import test from "node:test"

import { applyBondbuilderResearchAdapter, applyBondbuilderResearchAdapterForWorker } from "../src/lib/product-intake/bondbuilder-research-adapter"
import { bondbuilderResearchPromptContract } from "../src/lib/product-intake/bondbuilder-research-prompt-contract"
import { BOND_CURRENT_METHOD_PINS } from "../src/lib/bondbuilder-research/registry"
import { makeBondbuilderEnvelope, sealProfile } from "./fixtures/bondbuilder-research/profile"

test("Bondbuilder prepared prompt requires the complete source-bound envelope without obsolete intensity fields", () => {
  const contract = bondbuilderResearchPromptContract()

  assert.equal(contract.enabled, false)
  assert.equal(contract.required_artifact.payload_key, "bondbuilder_research_envelope")
  assert.deepEqual(contract.profile.required_roots, [
    "method", "identity", "formula", "assessment", "technology_reference", "application",
    "evidence", "explanations_de", "sources", "fit", "holds", "review",
  ])
  assert.deepEqual(contract.profile.application.timing.kinds, [
    "exact_seconds", "range_seconds", "minimum_seconds", "overnight", "no_extra_wait",
  ])
  assert.match(contract.adapter.behavior, /Do not hand-author/)
  assert.doesNotMatch(JSON.stringify(contract), /bond_repair_intensity/)
  assert.doesNotMatch(JSON.stringify(contract), /bond_repair_axis/)
})

test("Bondbuilder intake adapter preserves the original full research envelope beside its projection", () => {
  const envelope = { ...makeBondbuilderEnvelope(), submission_id: "00000000-0000-4000-8000-000000000111" }
  const before = structuredClone(envelope)
  const final: Record<string, unknown> = { category_specs: {}, field_rationales: {} }
  const artifacts: Array<{ kind: string; payload: Record<string, unknown> }> = [{ kind: "property_synthesis", payload: { bondbuilder_research_envelope: envelope } }]

  const result = applyBondbuilderResearchAdapter({
    final,
    artifacts,
    expectedSubmissionId: envelope.submission_id,
  })

  assert.deepEqual(result.blockers, [])
  assert.deepEqual(artifacts[0].payload.bondbuilder_research_envelope, before)
  const specs = (final.category_specs as Record<string, Record<string, unknown>>)
    .product_bondbuilder_specs
  assert.equal(specs.technology_family, "maleate_ester")
  assert.equal(specs.claim_trust_level, "high")
  assert.deepEqual(specs.research_profile, before.profile)
  assert.ok(artifacts[0].payload.bondbuilder_property_coverage)
  assert.equal(
    (artifacts[0].payload.readiness as { global_recommendation_ready: boolean })
      .global_recommendation_ready,
    false,
  )
})

test("Bondbuilder intake adapter rejects an envelope for another submission before projecting", () => {
  const envelope = { ...makeBondbuilderEnvelope(), submission_id: "00000000-0000-4000-8000-000000000111" }
  const final: Record<string, unknown> = { category_specs: {}, field_rationales: {} }
  const artifacts: Array<{ kind: string; payload: Record<string, unknown> }> = [{ kind: "property_synthesis", payload: { bondbuilder_research_envelope: envelope } }]

  const result = applyBondbuilderResearchAdapter({
    final,
    artifacts,
    expectedSubmissionId: "00000000-0000-4000-8000-000000000222",
  })

  assert.match(result.blockers.join("\n"), /submission_id must match/)
  assert.deepEqual(final.category_specs, {})
  assert.equal(artifacts[0].payload.bondbuilder_production_projection, undefined)
})

test("submission method constraint rejects readable historical research without mutating the draft", () => {
  const historical = makeBondbuilderEnvelope()
  const final: Record<string, unknown> = { category_specs: {}, field_rationales: {} }
  const artifacts: Array<{ kind: string; payload: Record<string, unknown> }> = [{
    kind: "property_synthesis", payload: { bondbuilder_research_envelope: historical },
  }]
  const before = structuredClone({ final, artifacts })
  const rejected = applyBondbuilderResearchAdapter({
    final, artifacts, expectedMethodVersion: "bondbuilder-inci-v0.5",
  })
  assert.match(rejected.blockers.join(" "), /method_version must match.*v0\.5/)
  assert.deepEqual({ final, artifacts }, before)

  // Ordinary offline history remains available; this constraint is submission-owned.
  assert.deepEqual(applyBondbuilderResearchAdapter({ final, artifacts }).blockers, [])

  const current = makeBondbuilderEnvelope()
  Object.assign(current.profile.method, BOND_CURRENT_METHOD_PINS)
  sealProfile(current.profile)
  const currentArtifacts = [{ kind: "property_synthesis", payload: {
    bondbuilder_research_envelope: current,
  } }]
  assert.deepEqual(applyBondbuilderResearchAdapter({
    final: { category_specs: {}, field_rationales: {} },
    artifacts: currentArtifacts,
    expectedMethodVersion: "bondbuilder-inci-v0.5",
  }).blockers, [])
})

test("Bondbuilder worker cannot activate provisional research through a model-authored envelope", () => {
  const envelope = makeBondbuilderEnvelope()
  const final: Record<string, unknown> = { category_specs: {}, field_rationales: {} }
  const artifacts = [{ kind: "property_synthesis", payload: {
    bondbuilder_research_envelope: envelope, research_engine_enabled: true,
  } }]
  const before = structuredClone({ final, artifacts })
  const result = applyBondbuilderResearchAdapterForWorker({ final, artifacts })
  assert.match(result.blockers.join("\n"), /routing is disabled.*owner-locked/)
  assert.deepEqual({ final, artifacts }, before)
})

test("Bondbuilder worker also holds direct research fields without an envelope", () => {
  for (const [key, value] of Object.entries({
    technology_family: "maleate_ester", claim_trust_level: "low",
    trust_basis: "owner_default", research_profile: makeBondbuilderEnvelope().profile,
  })) {
    const final: Record<string, unknown> = { category_specs: {
      product_bondbuilder_specs: { [key]: value },
    } }
    const before = structuredClone(final)
    const result = applyBondbuilderResearchAdapterForWorker({ final, artifacts: [] })
    assert.match(result.blockers.join("\n"), /routing is disabled/, key)
    assert.deepEqual(final, before)
  }
})

test("Bondbuilder worker keeps legacy output unchanged while research routing is disabled", () => {
  const final: Record<string, unknown> = { category_specs: { product_bondbuilder_specs: {
    bond_repair_intensity: "maintenance", application_mode: "pre_shampoo",
    bond_repair_axis: "disulfide_crosslink", treatment_mode: "rinse_out",
    product_format: "spray_treatment", usage_protocol: "epres_spray",
  } } }
  const before = structuredClone(final)
  assert.deepEqual(applyBondbuilderResearchAdapterForWorker({ final, artifacts: [] }), {
    blockers: [], warnings: [],
  })
  assert.deepEqual(final, before)
})
