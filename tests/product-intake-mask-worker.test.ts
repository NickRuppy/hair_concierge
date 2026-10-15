import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  normalizeResearchOutputForCategory,
  categoryApprovalContract,
  type BrandResolutionPromptContext,
} from "../scripts/product-intake/codex-research-worker"
import { CATEGORY_RESEARCH_REGISTRY } from "../src/lib/product-intake/category-research-router"
import type { MaskResearchEnvelope } from "../src/lib/mask-research/production-adapter"

type RecordValue = Record<string, unknown>
type Artifact = { kind: "property_synthesis"; payload: RecordValue }
const submissionId = "mask-worker-submission"

function input() {
  const envelope = JSON.parse(
    readFileSync(
      new URL(
        "../data/research/mask-inci/v1.0/calibration-envelopes/06-monday-smooth-anti-frizz.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as MaskResearchEnvelope
  envelope.identity.researchId = submissionId
  // Transport fixture only: adapt frozen evidence metadata in memory; never
  // rewrite or present it as a fresh research run.
  const record = JSON.parse(
    readFileSync(
      new URL(
        "../data/research/mask-inci/v1.0/reference-key-v1/06-monday-smooth-anti-frizz.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as RecordValue
  record.standardVersion = "mask-inci-v1.0"
  record.productId = submissionId
  record.reviewTriggers = ["formula_conflict_convergence"]
  record.profile = {
    ...Object.fromEntries(
      [
        "conditioningLevel",
        "weightPotential",
        "careDirection",
        "repairSupportLevel",
        "hairThicknessFit",
        "damageFit",
        "textureFit",
      ].map((key) => [
        key,
        structuredClone(envelope.profile[key as keyof typeof envelope.profile]),
      ]),
    ),
    primaryFocus: { value: envelope.profile.focus.value.primary },
    secondaryFocus: { value: envelope.profile.focus.value.secondary },
  }
  const artifact: Artifact = {
    kind: "property_synthesis",
    payload: { mask_research_envelope: envelope, mask_research_record: record },
  }
  const final: RecordValue = {
    product: { suitable_thicknesses: ["fine"], price_eur: 4.95 },
    category_specs: {
      product_mask_specs: { weight: "light" },
      product_application_protocols: [{ preserve: true }],
    },
    field_rationales: {
      "product.suitable_thicknesses[0]": "stale",
      "category_specs.product_mask_specs.weight": "stale",
      "category_specs.product_mask_specs[0].weight": "stale",
      "product.price_eur": "price source",
    },
  }
  return { envelope, record, artifact, final }
}

test("Mask worker projection replaces owned catalog values while retaining complete research and unrelated data", () => {
  const { envelope, record, artifact, final } = input()
  const originalEnvelope = structuredClone(envelope)
  const originalRecord = structuredClone(record)
  const result = CATEGORY_RESEARCH_REGISTRY.mask.apply({
    final,
    artifacts: [artifact],
    expectedResearchId: submissionId,
  })
  assert.deepEqual(result.blockers, [])
  assert.deepEqual((final.product as RecordValue).suitable_thicknesses, ["normal", "coarse"])
  assert.equal((final.product as RecordValue).price_eur, 4.95)
  assert.deepEqual((final.category_specs as RecordValue).product_mask_specs, {
    weight: "rich",
    concentration: "medium",
    balance_direction: "moisture",
    ingredient_flags: ["silicones", "oils", "humectants"],
    repair_support_level: "low",
    functional_benefits: ["smoothing_frizz_control", "detangling_slip", "moisture_softness"],
  })
  assert.deepEqual((final.category_specs as RecordValue).product_application_protocols, [
    { preserve: true },
  ])
  assert.deepEqual(artifact.payload.mask_research_envelope, originalEnvelope)
  assert.deepEqual(artifact.payload.mask_research_record, originalRecord)
  assert.ok(artifact.payload.mask_production_projection)
  assert.deepEqual(artifact.payload.required_protocol_roles, ["intensive_conditioning_mask"])
  const rationales = final.field_rationales as RecordValue
  assert.equal(rationales["product.price_eur"], "price source")
  assert.ok(!Object.values(rationales).includes("stale"))
})

for (const defect of [
  "missing envelope",
  "duplicate envelope",
  "wrong submission",
  "stale method",
  "unknown value",
  "missing complete record",
  "missing Hinweise",
  "missing direct property",
  "different record formula",
  "different record profile",
  "competing category envelope",
] as const) {
  test(`Mask worker refuses ${defect} without mutating final values`, () => {
    const { envelope, record, artifact, final } = input()
    const artifacts: Artifact[] = [artifact]
    if (defect === "missing envelope") delete artifact.payload.mask_research_envelope
    if (defect === "duplicate envelope") artifacts.push(structuredClone(artifact))
    if (defect === "wrong submission") envelope.identity.researchId = "another-submission"
    if (defect === "stale method")
      (envelope.researchMethod as unknown as RecordValue).policySha256 = "0".repeat(64)
    if (defect === "unknown value") envelope.profile.conditioningLevel.value = "unknown"
    if (defect === "missing complete record") delete artifact.payload.mask_research_record
    if (defect === "missing Hinweise") delete record.hinweise
    if (defect === "missing direct property")
      delete (record.directProperties as RecordValue).body_lightness_potential
    if (defect === "different record formula")
      (record.identity as RecordValue).rawInciSha256 = "0".repeat(64)
    if (defect === "different record profile")
      ((record.profile as RecordValue).weightPotential as RecordValue).value = "low"
    if (defect === "competing category envelope")
      artifacts.push({
        kind: "property_synthesis",
        payload: { conditioner_research_envelope: { formula: { rawInci: "AQUA" } } },
      })
    const before = structuredClone(final)
    const result = CATEGORY_RESEARCH_REGISTRY.mask.apply({
      final,
      artifacts,
      expectedResearchId: submissionId,
    })
    assert.ok(
      result.blockers.some((reason) => reason.startsWith("mask research adapter:")),
      defect,
    )
    assert.deepEqual(final, before)
    assert.equal(artifact.payload.mask_production_projection, undefined)
  })
}

test("real worker normalization records Mask provenance and envelope INCI while keeping unsourced protocol blocked", () => {
  const { envelope, artifact, final } = input()
  const context: BrandResolutionPromptContext = {
    submitted_brand_text: "MONDAY Haircare",
    submitted_product_name_text: "Smooth Anti-Frizz Haarmaske",
    scanned_identifier: null,
    lookup_text: "MONDAY Haircare Smooth Anti-Frizz Haarmaske",
    resolved_brand: {
      canonical_brand_id: "11111111-1111-4111-8111-111111111111",
      canonical_brand: "MONDAY Haircare",
      product_line: null,
    },
    nearby_brand_options: [],
    catalog_summary: {},
    rules: [],
  }
  const result = normalizeResearchOutputForCategory(
    {
      summary: "Mask",
      blockers: [],
      artifacts: [artifact],
      researched_payload: { draft: {}, final },
    },
    "mask",
    context,
    [],
    submissionId,
  )
  const synthesis = result.artifacts.find((item) => item.kind === "property_synthesis")!
  const provenance = synthesis.payload.engine as RecordValue
  assert.equal(provenance.state, "active")
  assert.equal(provenance.id, "mask-standard")
  assert.equal(provenance.methodology, "v1.0")
  assert.match(String(provenance.input_hash), /^[a-f0-9]{64}$/)
  assert.match(String(provenance.projection_hash), /^[a-f0-9]{64}$/)
  const formula = result.artifacts.find(
    (item) => item.kind === "formula" && item.payload.stage === "inci",
  )!
  assert.equal(formula.payload.source, "mask_envelope")
  assert.equal(formula.payload.raw_inci, envelope.formula.rawInci)
  assert.equal(formula.payload.fingerprint_sha256, envelope.formula.formulaFingerprintSha256)
  assert.ok(
    !result.blockers.some(
      (reason) => reason.startsWith("mask research adapter:") || reason.startsWith("inci_"),
    ),
  )
  assert.ok(result.blockers.includes("protocol_evidence_missing"))
  assert.deepEqual(
    ((result.researched_payload!.final as RecordValue).category_specs as RecordValue)
      .product_application_protocols,
    [],
  )
})

test("a refused Mask pass clears an untrusted old projection receipt", () => {
  const { envelope, artifact, final } = input()
  envelope.identity.researchId = "another-submission"
  artifact.payload.mask_production_projection = { projection_sha256: "old-model-receipt" }
  const before = structuredClone(final)
  const result = CATEGORY_RESEARCH_REGISTRY.mask.apply({
    final,
    artifacts: [artifact],
    expectedResearchId: submissionId,
  })
  assert.ok(result.blockers.length > 0)
  assert.deepEqual(final, before)
  assert.equal(artifact.payload.mask_production_projection, undefined)
})

test("Mask prompt delivers the real envelope schema and a separate complete-record carrier", () => {
  const contract = categoryApprovalContract("mask")
  const research = contract.mask_research as RecordValue
  const engine = research.engine as RecordValue
  const artifact = engine.required_artifact as RecordValue
  assert.equal(artifact.envelope_key, "mask_research_envelope")
  assert.equal(artifact.complete_record_key, "mask_research_record")
  const schema = engine.envelope_schema as RecordValue
  assert.equal(schema.additionalProperties, false)
  assert.deepEqual(schema.required, ["version", "researchMethod", "identity", "formula", "profile"])
  assert.equal(contract.product_mask_specs, undefined)
  assert.equal(
    (contract.protocol_slots as RecordValue).output_path,
    "researched_payload.draft.protocol",
  )
})
