import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import { canonicalJson } from "../src/lib/product-intake/catalog-enrichment/stage5-v2-application"
import { applyShampooResearchAdapter } from "../src/lib/product-intake/shampoo-research-adapter"
import { SHAMPOO_PRODUCTION_LIGHT_V162_RESEARCH_METHOD } from "../src/lib/shampoo/production-light-adapter"

type RecordValue = Record<string, unknown>

function nativeRecord(name: string): RecordValue {
  return JSON.parse(
    readFileSync(
      path.resolve(`tests/fixtures/shampoo-production-light/v1.6.2/${name}.json`),
      "utf8",
    ),
  ) as RecordValue
}

function envelope(name = "A01"): RecordValue {
  const value = structuredClone(nativeRecord(name))
  value.researchMethod = { ...SHAMPOO_PRODUCTION_LIGHT_V162_RESEARCH_METHOD }
  return value
}

function setup(name = "A01") {
  const research = envelope(name)
  const identity = research.identity as RecordValue
  const final: RecordValue = {
    product: { suitable_thicknesses: ["coarse"] },
    category_specs: {
      product_shampoo_specs: [{ thickness: "coarse", shampoo_bucket: "normal" }],
      product_application_protocols: [{ role: "shampoo_everyday", source: "directions" }],
    },
    field_rationales: {
      "product.clean_name": "Identity stays.",
      "product.suitable_thicknesses": "Stale thickness rationale.",
      "category_specs.product_shampoo_specs[9]": "Stale shampoo row rationale.",
      "research.properties.removed_property": "Stale property rationale.",
    },
  }
  const artifacts: { kind: string; payload: RecordValue }[] = [
    { kind: "property_synthesis", payload: { shampoo_research_envelope: research } },
  ]
  return {
    final,
    artifacts,
    research,
    expectedResearchId: identity.productId as string,
    expectedFormulaFingerprintSha256: identity.formulaFingerprintSha256 as string,
  }
}

test("projects one exact v1.6.2 record, retaining protocols and durable research", () => {
  const input = setup()
  const before = structuredClone(input.research)
  input.artifacts[0].payload.shampoo_production_projection = {
    research_input_sha256: "model-authored-input",
    projection_sha256: "model-authored-projection",
  }

  const result = applyShampooResearchAdapter(input)

  assert.deepEqual(result.blockers, [])
  assert.deepEqual((input.final.product as RecordValue).suitable_thicknesses, [
    "fine",
    "normal",
    "coarse",
  ])
  assert.deepEqual((input.final.category_specs as RecordValue).product_shampoo_specs, [
    {
      thickness: "fine",
      shampoo_bucket: "irritationen",
      scalp_route: "irritated",
      cleansing_intensity: "regular",
    },
    {
      thickness: "fine",
      shampoo_bucket: "trocken",
      scalp_route: "dry",
      cleansing_intensity: "regular",
    },
    {
      thickness: "normal",
      shampoo_bucket: "irritationen",
      scalp_route: "irritated",
      cleansing_intensity: "regular",
    },
    {
      thickness: "normal",
      shampoo_bucket: "trocken",
      scalp_route: "dry",
      cleansing_intensity: "regular",
    },
    {
      thickness: "coarse",
      shampoo_bucket: "irritationen",
      scalp_route: "irritated",
      cleansing_intensity: "regular",
    },
    {
      thickness: "coarse",
      shampoo_bucket: "trocken",
      scalp_route: "dry",
      cleansing_intensity: "regular",
    },
  ])
  assert.deepEqual((input.final.category_specs as RecordValue).product_application_protocols, [
    { role: "shampoo_everyday", source: "directions" },
  ])
  assert.equal(
    (input.final.field_rationales as RecordValue)["product.clean_name"],
    "Identity stays.",
  )
  assert.equal(
    (input.final.field_rationales as RecordValue)["category_specs.product_shampoo_specs[9]"],
    undefined,
  )
  assert.deepEqual(input.artifacts[0].payload.shampoo_research_envelope, before)
  const rationales = input.final.field_rationales as RecordValue
  assert.equal(rationales["research.properties.removed_property"], undefined)
  assert.ok(Object.values(rationales).every((value) => typeof value === "string"))
  assert.match(
    rationales["research.weight"] as string,
    /Confidence: high\. Rules: W-LIVE, T7, R19\./,
  )

  const projection = input.artifacts[0].payload.shampoo_production_projection as RecordValue
  assert.equal(typeof projection.research_input_sha256, "string")
  assert.equal(typeof projection.projection_sha256, "string")
  assert.equal(
    projection.research_input_sha256,
    createHash("sha256").update(canonicalJson(before)).digest("hex"),
  )
  assert.notEqual(projection.projection_sha256, "model-authored-projection")
  assert.equal(projection.status, "property_lane_ready")
})

test("fails closed on untrusted bindings, malformed pins, duplicate evidence, or low-confidence projection", () => {
  for (const mutate of [
    (input: ReturnType<typeof setup>) => ({ ...input, expectedResearchId: " " }),
    (input: ReturnType<typeof setup>) => ({ ...input, expectedResearchId: "other-submission" }),
    (input: ReturnType<typeof setup>) => ({ ...input, expectedFormulaFingerprintSha256: "" }),
    (input: ReturnType<typeof setup>) => {
      delete (input.research.identity as RecordValue).productId
      return input
    },
    (input: ReturnType<typeof setup>) => {
      input.research.policy = "shampoo-classification-v1.4"
      return input
    },
    (input: ReturnType<typeof setup>) => {
      delete input.research.researchMethod
      return input
    },
    (input: ReturnType<typeof setup>) => {
      ;(input.research.researchMethod as RecordValue).modelVersion = "shampoo-inci-v1.4"
      return input
    },
    (input: ReturnType<typeof setup>) => {
      input.artifacts.push({
        kind: "property_synthesis",
        payload: { shampoo_research_envelope: structuredClone(input.research) },
      })
      return input
    },
    (input: ReturnType<typeof setup>) => ({
      ...input,
      expectedFormulaFingerprintSha256: "f".repeat(64),
    }),
    (input: ReturnType<typeof setup>) => {
      ;(
        (input.research.directProperties as RecordValue).cleansingStrength as RecordValue
      ).confidence = "low"
      return input
    },
    (input: ReturnType<typeof setup>) => {
      delete input.research.selfCheck
      return input
    },
    (input: ReturnType<typeof setup>) => {
      delete ((input.research.directProperties as RecordValue).weightPotential as RecordValue)
        .wLineRecord
      return input
    },
  ]) {
    const input = mutate(setup())
    input.artifacts[0].payload.shampoo_production_projection = {
      projection_sha256: "model-authored",
    }
    const result = applyShampooResearchAdapter(input)
    assert.ok(result.blockers.length > 0)
    assert.equal(input.artifacts[0].payload.shampoo_production_projection, undefined)
    assert.equal(
      (input.final.field_rationales as RecordValue)["product.suitable_thicknesses"],
      undefined,
    )
    assert.equal((input.final.product as RecordValue).suitable_thicknesses, undefined)
    assert.equal(
      (input.final.field_rationales as RecordValue)["research.properties.removed_property"],
      undefined,
    )
    assert.equal((input.final.category_specs as RecordValue).product_shampoo_specs, undefined)
    assert.deepEqual((input.final.category_specs as RecordValue).product_application_protocols, [
      { role: "shampoo_everyday", source: "directions" },
    ])
  }
})

test("D2 retains regular rows and creates one server-hashed decision without a catalog write", () => {
  const input = setup("U2")
  const result = applyShampooResearchAdapter(input)

  assert.deepEqual(result.blockers, [])
  assert.deepEqual((input.final.product as RecordValue).suitable_thicknesses, ["fine", "normal"])
  assert.deepEqual((input.final.category_specs as RecordValue).product_shampoo_specs, [
    {
      thickness: "fine",
      shampoo_bucket: "normal",
      scalp_route: "balanced",
      cleansing_intensity: "clarifying",
    },
    {
      thickness: "normal",
      shampoo_bucket: "normal",
      scalp_route: "balanced",
      cleansing_intensity: "clarifying",
    },
  ])
  assert.deepEqual(result.downstreamDecisions, [
    {
      code: "separate_deep_cleanser_listing",
      question: "Auch als Tiefenreiniger anlegen? Die reguläre Shampoo-Recherche bleibt erhalten.",
      projection_sha256: (input.artifacts[0].payload.shampoo_production_projection as RecordValue)
        .projection_sha256,
    },
  ])
})
