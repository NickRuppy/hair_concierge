import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"

import { applyInciStage, extractCanonicalInci } from "../src/lib/product-intake/pipeline/inci"
import {
  normalizeResearchOutputForCategory,
  isModelGeneratedArtifactKind,
  type BrandResolutionPromptContext,
} from "../scripts/product-intake/codex-research-worker"

const context: BrandResolutionPromptContext = {
  submitted_brand_text: null,
  submitted_product_name_text: null,
  scanned_identifier: null,
  lookup_text: "",
  resolved_brand: null,
  nearby_brand_options: [],
  catalog_summary: {},
  rules: [],
}
const retailerPacket = { ingredients_text: "Aqua, Glycerin" }
const envelopeFormula = {
  rawInci: "Aqua, Cetearyl Alcohol",
  normalizedIngredients: ["Aqua", "Cetearyl Alcohol"],
  formulaFingerprintSha256: "engine-fingerprint",
}

for (const source of ["conditioner", "leave_in", "bondbuilder"] as const) {
  test(`${source} envelope keeps its ordered ingredients and engine fingerprint`, () => {
    const formula =
      source === "bondbuilder"
        ? {
            raw_inci: envelopeFormula.rawInci,
            normalized_ingredients: envelopeFormula.normalizedIngredients,
            normalized_sha256: "engine-fingerprint",
          }
        : envelopeFormula
    const payload = {
      [`${source}_research_envelope`]:
        source === "bondbuilder" ? { profile: { formula } } : { formula },
    }
    const result = extractCanonicalInci([{ kind: "property_synthesis", payload }], retailerPacket)
    assert.deepEqual(result, {
      status: "present",
      source: `${source}_envelope`,
      raw_inci: envelopeFormula.rawInci,
      normalized_ingredients: envelopeFormula.normalizedIngredients,
      fingerprint_sha256: "engine-fingerprint",
    })
  })
}

test("engine envelope wins over model formula, which wins over retailer text", () => {
  const model = { kind: "formula", payload: { raw_inci: "Aqua, Panthenol" } }
  assert.equal(
    extractCanonicalInci(
      [
        model,
        {
          kind: "property_synthesis",
          payload: { conditioner_research_envelope: { formula: envelopeFormula } },
        },
      ],
      retailerPacket,
    ).source,
    "conditioner_envelope",
  )
  assert.equal(extractCanonicalInci([model], retailerPacket).source, "model_formula")
  assert.equal(extractCanonicalInci([], retailerPacket).source, "retailer_packet")
})

test("fallback fingerprint ignores case, punctuation and redundant whitespace", () => {
  const first = extractCanonicalInci([
    { kind: "formula", payload: { raw_inci: "Aqua,  Glycerin." } },
  ])
  const second = extractCanonicalInci([], { ingredients_text: " AQUA ; glycerin " })
  assert.equal(first.fingerprint_sha256, createHash("sha256").update("AQUA GLYCERIN").digest("hex"))
  assert.equal(first.fingerprint_sha256, second.fingerprint_sha256)
  assert.deepEqual(first.normalized_ingredients, ["AQUA", "GLYCERIN"])
})

test("blank and absent INCI yield an explicit missing marker", () => {
  assert.deepEqual(extractCanonicalInci([{ kind: "formula", payload: { raw_inci: " " } }]), {
    status: "missing",
    source: null,
    raw_inci: null,
    normalized_ingredients: [],
    fingerprint_sha256: null,
  })
})

for (const category of ["conditioner", "leave_in", "bondbuilder", "shampoo", "mask"]) {
  for (const retry of [false, true]) {
    test(`${category} missing INCI gate with retry=${retry}`, () => {
      const result = normalizeResearchOutputForCategory(
        {
          summary: "Research",
          blockers: [],
          artifacts: [],
          researched_payload: { final: { product: {}, category_specs: {} } },
        },
        category,
        context,
        [],
        "submission",
        { inciRetryAttempted: retry },
      )
      const inciBlockers = result.blockers.filter((reason) => reason.startsWith("inci_"))
      if (["conditioner", "leave_in", "bondbuilder"].includes(category)) {
        assert.equal(inciBlockers.length, 1)
        assert.ok(
          inciBlockers[0]!.startsWith(retry ? "inci_unavailable:" : "inci_missing_first_pass:"),
        )
      } else assert.deepEqual(inciBlockers, [])
      assert.equal(
        (result.researched_payload!.draft as Record<string, Record<string, unknown>>).formula!
          .status,
        "missing",
      )
      assert.equal(result.artifacts.filter((artifact) => artifact.kind === "formula").length, 1)
    })
  }
}

test("draft formula is canonicalized without leaking into strict final approval fields", () => {
  const final = { product: {}, category_specs: {} }
  const result = normalizeResearchOutputForCategory(
    {
      summary: "Research",
      blockers: [],
      artifacts: [],
      researched_payload: {
        draft: {
          formula: { raw_inci: "Aqua, Panthenol", source_url: "https://example.test/label" },
        },
        final,
      },
    },
    "conditioner",
    context,
    [],
    "submission",
    { retailerPacket },
  )
  const draft = result.researched_payload!.draft as Record<string, Record<string, unknown>>
  assert.equal(draft.formula!.source, "model_formula")
  assert.equal(draft.formula!.source_url, "https://example.test/label")
  assert.equal((result.researched_payload!.final as Record<string, unknown>).formula, undefined)
  assert.deepEqual(final, { product: {}, category_specs: {} })
  assert.ok(!result.blockers.some((reason) => reason.startsWith("inci_")))
})

test("INCI replaces only its marker and preserves existing formula evidence", () => {
  const model = { kind: "formula" as const, payload: { raw_inci: "Aqua, Panthenol" } }
  const artifacts: Parameters<typeof applyInciStage>[1] = [
    model,
    { kind: "formula" as const, payload: { stage: "inci", stale: true } },
  ]
  applyInciStage({ final: {} }, artifacts, { state: "active", engineId: "test" }, {})
  assert.strictEqual(artifacts[0], model)
  assert.equal(artifacts.length, 2)
  assert.equal(artifacts[1].payload.stage, "inci")
  assert.equal(artifacts[1].payload.stale, undefined)
})

test("models cannot emit formula, commerce or protocol stage artifacts", () => {
  for (const kind of ["formula", "commerce_check", "protocol_template"])
    assert.equal(isModelGeneratedArtifactKind(kind), false, kind)
  assert.equal(isModelGeneratedArtifactKind("identity_candidate"), true)
})

for (const category of ["conditioner", "leave_in", "oil", "mask", "shampoo", "bondbuilder"]) {
  test(`${category} draft-only passes write markers without INCI or protocol blockers`, () => {
    const result = normalizeResearchOutputForCategory(
      {
        summary: "Waiting",
        blockers: [],
        artifacts: [],
        researched_payload: { draft: { notes: "Need more evidence" } },
      },
      category,
      context,
      [],
      "submission",
    )
    assert.deepEqual(
      result.blockers.filter((reason) => /^(inci_|protocol_)/.test(reason)),
      [],
    )
    assert.equal(
      result.artifacts.find((artifact) => artifact.kind === "formula")?.status,
      "missing",
    )
    const protocol = result.artifacts.find((artifact) => artifact.kind === "protocol_template")!
    assert.ok(protocol)
    assert.deepEqual(protocol.payload.blockers, [])
  })
}

test("protocol stamping preserves legacy evidence, replaces its marker and records W3 fallback", () => {
  const legacy = {
    kind: "protocol_template" as const,
    payload: { reasoning: "Legacy protocol evidence" },
  }
  const result = normalizeResearchOutputForCategory(
    {
      summary: "Research",
      blockers: [],
      artifacts: [
        legacy,
        { kind: "protocol_template", payload: { stage: "protocol", stale: true } },
      ],
      researched_payload: {
        draft: {
          protocol: {
            evidence: [
              {
                sourceUrl: "https://example.test/product",
                sourceType: "manufacturer",
                checkedAt: "2026-10-06",
                sourceText: "Ins feuchte Haar geben und danach ausspülen.",
              },
            ],
          },
        },
        final: { product: {}, category_specs: { product_mask_specs: {} } },
      },
    },
    "mask",
    context,
    [],
    "submission",
  )
  const artifacts = result.artifacts.filter((artifact) => artifact.kind === "protocol_template")
  assert.equal(artifacts.length, 2)
  assert.deepEqual(artifacts[0].payload, legacy.payload)
  assert.equal(artifacts[1].payload.stage, "protocol")
  assert.deepEqual(artifacts[1].payload.notes, ["mask_wait_fallback_w3"])
  assert.equal(artifacts[1].payload.stale, undefined)
})
