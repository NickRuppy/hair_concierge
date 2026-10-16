import assert from "node:assert/strict"
import test from "node:test"
import { ZodError } from "zod"

import {
  createOilLabCandidatePackage,
  parseOilLabCandidatePackage,
} from "../src/lib/oil-research/candidate-package"
import {
  OilResearchEnvelopeSchema,
  LegacyOilResearchEnvelopeSchema,
  sha256Utf8,
} from "../src/lib/oil-research/contracts"
import { OIL_LOCAL_RESEARCH_METHOD } from "../src/lib/oil-research/registry"
import { applyOilResearchAdapter } from "../src/lib/product-intake/oil-research-adapter"
import { makeOilEnvelope, preserveFixtureProfile } from "./fixtures/oil-research/fixture"

function localEnvelope() {
  const envelope = makeOilEnvelope()
  envelope.research_method = OIL_LOCAL_RESEARCH_METHOD as typeof envelope.research_method
  envelope.submission_id = null
  envelope.provenance.import_kind = "local"
  envelope.provenance.original_method = {
    ...envelope.provenance.original_method,
    declared_version: "v0.9",
    unrecorded_note: null,
  }
  return LegacyOilResearchEnvelopeSchema.parse(envelope)
}

function matchingSuggestions() {
  return {
    product_oil_eligibility: [
      {
        thickness: "fine" as const,
        oil_subtype: "styling-oel" as const,
        oil_purpose: "light_finish" as const,
        ingredient_flags: ["oils" as const],
      },
    ],
    suitable_thicknesses: ["fine" as const],
    field_rationales: { matching: "Draft for Lab review only." },
  }
}

function replaceRawDeclaration(
  envelope: ReturnType<typeof makeOilEnvelope>,
  rawInci: string,
): void {
  envelope.formula.raw_inci = rawInci
  envelope.formula.raw_sha256 = sha256Utf8(rawInci)
  ;((envelope.profile as Record<string, unknown>).formula as Record<string, unknown>).raw_inci =
    rawInci
  preserveFixtureProfile(envelope)
}

test("local candidate package is self-contained, fingerprinted, and preserves manual drafts", () => {
  const candidate = createOilLabCandidatePackage({
    envelope: localEnvelope(),
    matchingSuggestions: matchingSuggestions(),
    sourceManifest: {
      records: [{ path: "research/pc01/source-unblind.json", sha256: "a".repeat(64) }],
    },
  })

  assert.equal(candidate.version, "oil-lab-candidate-bundle-v1")
  assert.deepEqual(parseOilLabCandidatePackage(candidate), candidate)
  assert.deepEqual(candidate.matchingSuggestions, matchingSuggestions())

  const tampered = structuredClone(candidate)
  tampered.matchingSuggestions.suitable_thicknesses = ["coarse"]
  assert.throws(() => parseOilLabCandidatePackage(tampered), /fingerprint/)
})

test("local provenance/method pairing is strict in both directions", () => {
  const local = localEnvelope()
  local.provenance.import_kind = "current"
  assert.throws(() => OilResearchEnvelopeSchema.parse(local), /Local research cannot relabel/)

  const historical = makeOilEnvelope()
  historical.provenance.import_kind = "local"
  assert.throws(
    () => OilResearchEnvelopeSchema.parse(historical),
    /Historical consolidation cannot relabel/,
  )
})

test("local v0.9 candidates preserve maker bullet and ASCII-hyphen delimiters only", () => {
  for (const separator of [" • ", " - "]) {
    const local = localEnvelope()
    replaceRawDeclaration(local, `JOJOBA OIL${separator}1,2-HEXANEDIOL.`)
    assert.equal(OilResearchEnvelopeSchema.parse(local).formula.raw_inci, local.formula.raw_inci)
  }

  const localWithExtraIngredient = localEnvelope()
  replaceRawDeclaration(localWithExtraIngredient, "JOJOBA OIL • 1,2-HEXANEDIOL • UNLISTED.")
  assert.throws(
    () => OilResearchEnvelopeSchema.parse(localWithExtraIngredient),
    /Raw declaration contains unrepresented ingredients/,
  )

  const historical = makeOilEnvelope()
  replaceRawDeclaration(historical, "JOJOBA OIL • 1,2-HEXANEDIOL.")
  assert.throws(
    () => OilResearchEnvelopeSchema.parse(historical),
    /Raw declaration and ordered raw ranks differ/,
  )
})

test("candidate matching drafts use the established catalogue vocabulary", () => {
  assert.throws(
    () =>
      createOilLabCandidatePackage({
        envelope: localEnvelope(),
        matchingSuggestions: {
          ...matchingSuggestions(),
          suitable_thicknesses: ["ultra_fine" as "fine"],
        },
        sourceManifest: {
          records: [{ path: "research/pc01/source-unblind.json", sha256: "a".repeat(64) }],
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof ZodError)
      assert.deepEqual(error.issues[0]?.path, ["suitable_thicknesses", 0])
      return true
    },
  )
})

test("local candidates cannot mutate a Product Intake payload", () => {
  const local = localEnvelope()
  const final: Record<string, unknown> = {
    category_specs: { product_oil_specs: { weight: "rich" } },
    field_rationales: { "category_specs.product_oil_specs": "existing" },
  }
  const artifacts = [{ kind: "property_synthesis", payload: { oil_research_envelope: local } }]
  const beforeFinal = structuredClone(final)
  const beforeArtifacts = structuredClone(artifacts)

  const result = applyOilResearchAdapter({
    final,
    artifacts,
    expectedResearchId: "00000000-0000-4000-8000-000000000111",
  })

  assert.match(result.blockers.join(" "), /exact v0.10 current-intake research method/)
  assert.deepEqual(final, beforeFinal)
  assert.deepEqual(artifacts, beforeArtifacts)
})

test("spoofed historical research cannot enter Product Intake", () => {
  const historical = makeOilEnvelope()
  historical.submission_id = "00000000-0000-4000-8000-000000000111"
  const final: Record<string, unknown> = {
    category_specs: { product_oil_specs: { weight: "rich" } },
    field_rationales: { "category_specs.product_oil_specs": "existing" },
  }
  const artifacts = [{ kind: "property_synthesis", payload: { oil_research_envelope: historical } }]
  const beforeFinal = structuredClone(final)
  const beforeArtifacts = structuredClone(artifacts)

  const result = applyOilResearchAdapter({
    final,
    artifacts,
    expectedResearchId: "00000000-0000-4000-8000-000000000111",
  })

  assert.notDeepEqual(result.blockers, [])
  assert.deepEqual(final, beforeFinal)
  assert.deepEqual(artifacts, beforeArtifacts)
})
