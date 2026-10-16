import assert from "node:assert/strict"
import test from "node:test"

import {
  assembleFreshOilResearchEnvelope,
  sha256Utf8,
  type FreshOilResearchDraft,
} from "../src/lib/oil-research/contracts"
import { OIL_LEGACY_INTAKE_METHOD } from "../src/lib/oil-research/registry"
import { createOilStorage, resolveOilStorage } from "../src/lib/oil-research/storage"
import { makeOilEnvelope } from "./fixtures/oil-research/fixture"

const submissionId = "00000000-0000-4000-8000-000000000111"

function freshDraft(): FreshOilResearchDraft {
  const historical = makeOilEnvelope()
  const { research_method: _method, provenance, formula, ...rest } = historical
  void _method
  const { raw_sha256: _raw, normalized_sha256: _normalized, ...authoredFormula } = formula
  void _raw
  void _normalized
  const {
    import_kind: _kind,
    original_record: _record,
    original_record_sha256: _recordHash,
    field_authorities: _authorities,
    ...authoredProvenance
  } = provenance
  void _kind
  void _record
  void _recordHash
  void _authorities
  return {
    ...rest,
    submission_id: submissionId,
    formula: authoredFormula,
    provenance: {
      ...authoredProvenance,
      original_method: {
        ...authoredProvenance.original_method,
        declared_version: "v0.8",
        unrecorded_note: null,
      },
    },
  }
}

function reorderObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorderObject)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .reverse()
        .map(([key, nested]) => [key, reorderObject(nested)]),
    )
  }
  return value
}

test("fresh assembler derives all formula and original-record digests from authored input", () => {
  const draft = freshDraft()
  ;(draft.formula as Record<string, unknown>).raw_sha256 = "0".repeat(64)
  ;(draft.formula as Record<string, unknown>).normalized_sha256 = "1".repeat(64)
  const envelope = assembleFreshOilResearchEnvelope(draft)

  assert.deepEqual(envelope.research_method, OIL_LEGACY_INTAKE_METHOD)
  assert.equal(envelope.provenance.import_kind, "current")
  assert.equal(envelope.formula.raw_sha256, sha256Utf8("JOJOBA OIL, 1,2-HEXANEDIOL."))
  assert.equal(
    envelope.formula.normalized_sha256,
    sha256Utf8(
      JSON.stringify([
        { rank: 1, canonical_name: "JOJOBA OIL" },
        { rank: 2, canonical_name: "1,2-HEXANEDIOL" },
      ]),
    ),
  )
  assert.equal(
    envelope.provenance.original_record_sha256,
    sha256Utf8(JSON.stringify(envelope.profile)),
  )
})

test("lossless storage accepts JSONB key reordering but refuses altered body, mirror, and historical promotion", () => {
  const fresh = assembleFreshOilResearchEnvelope(freshDraft())
  const storage = createOilStorage(fresh)
  storage.oil_research_envelope = reorderObject(storage.oil_research_envelope) as typeof fresh
  assert.deepEqual(resolveOilStorage(storage, { requireFresh: true }), fresh)

  const brokenHash = structuredClone(storage)
  brokenHash.oil_research_envelope_sha256 = "0".repeat(64)
  assert.throws(() => resolveOilStorage(brokenHash), /digest mismatch/)

  const brokenMirror = structuredClone(storage)
  brokenMirror.oil_research_envelope.profile.weight.value = "medium"
  assert.throws(() => resolveOilStorage(brokenMirror), /mirror differs/)

  const historicalStorage = createOilStorage(makeOilEnvelope())
  assert.throws(
    () => resolveOilStorage(historicalStorage, { requireFresh: true }),
    /current intake-bound/,
  )
})
