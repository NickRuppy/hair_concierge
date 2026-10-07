import assert from "node:assert/strict"
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { createHash } from "node:crypto"
import type { BondbuilderResearchEnvelope } from "../src/lib/bondbuilder-research/contracts"
import {
  bondbuilderProfileSha256,
  projectBondbuilderForProduction,
} from "../src/lib/bondbuilder-research/production-adapter"
import { applyProducerAmendments } from "../scripts/bondbuilder-research/apply-producer-amendments"

const ROOT = path.resolve(__dirname, "..")
const RUN = path.join(ROOT, "data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3")
const PRODUCER = path.join(
  ROOT,
  "data/research/bondbuilder-inci/v1.0/producer-application-amendment-2026-10-03/application-amendments.json",
)
const read = <T>(file: string) => JSON.parse(readFileSync(file, "utf8")) as T
function fixture() {
  const base = mkdtempSync(path.join(os.tmpdir(), "bond-producer-")),
    run = path.join(base, "run")
  cpSync(RUN, run, { recursive: true })
  rmSync(path.join(run, "source-amendment-02"), { recursive: true, force: true })
  return { base, run }
}

test("P05 real wire refusal becomes a projected producer-amended envelope without changing formula, classification, fit, or retained unknowns", () => {
  const f = fixture()
  try {
    const wire = read<{ profile: Record<string, unknown> }>(
      path.join(f.run, "wire-amendment-01/lane-a/P05.json"),
    )
    assert.ok(
      projectBondbuilderForProduction(wire).errors.includes(
        "specialized_treatment_boundary_evidence_missing",
      ),
    )
    applyProducerAmendments(path.relative(ROOT, f.run), PRODUCER)
    const amended = read<{ profile: Record<string, unknown> }>(
      path.join(f.run, "source-amendment-02/lane-a/P05.json"),
    )
    const outcome = read<{ status: string; errors: string[] }>(
      path.join(
        f.run,
        "source-amendment-02/projection-replay/lane-a/P05/production-projection.json",
      ),
    )
    assert.equal(outcome.status, "projected")
    assert.deepEqual(outcome.errors, [])
    for (const lane of ["lane-a", "lane-b"])
      for (const slot of ["P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08"]) {
        const actual = read<{ status: string; errors: string[] }>(
          path.join(
            f.run,
            "source-amendment-02/projection-replay",
            lane,
            slot,
            "production-projection.json",
          ),
        )
        assert.equal(actual.status, "projected", `${lane}/${slot}: ${actual.errors.join(", ")}`)
        assert.deepEqual(actual.errors, [])
      }
    const p06 = read<{
      profile: { holds: { protocol: Array<{ code: string; field: string | null }> } }
    }>(path.join(f.run, "source-amendment-02/lane-a/P06.json"))
    assert.ok(
      p06.profile.holds.protocol.some(
        (hold) => hold.code === "source_fact_unknown" && hold.field === "application.placement",
      ),
    )
    for (const key of ["formula", "fit"] as const)
      assert.deepEqual(amended.profile[key], wire.profile[key])
    const amendedAssessment = structuredClone(
      amended.profile.assessment as { reasoning: Record<string, unknown> },
    )
    const wireAssessment = wire.profile.assessment as { reasoning: Record<string, unknown> }
    for (const key of [
      "application_mode",
      "product_format",
      "treatment_mode",
      "intended_role",
      "application_facts",
    ])
      amendedAssessment.reasoning[key] = wireAssessment.reasoning[key]
    assert.deepEqual(amendedAssessment, wireAssessment)
    assert.ok(
      (amended.profile.holds as { protocol: Array<{ field: string | null }> }).protocol.some(
        (hold) => hold.field === "application.applied_format",
      ),
    )
    const receipt = path.join(f.run, "source-amendment-02/receipt.json"),
      bytes = readFileSync(receipt)
    assert.throws(
      () => applyProducerAmendments(path.relative(ROOT, f.run), PRODUCER),
      /existing target/i,
    )
    assert.deepEqual(readFileSync(receipt), bytes)
  } finally {
    rmSync(f.base, { recursive: true, force: true })
  }
})

test("refuses tampered wire preimages before creating output and keeps an existing output byte-identical", () => {
  const f = fixture()
  try {
    const input = path.join(f.run, "wire-amendment-01/lane-a/P01.json"),
      bad = read<{ profile: { application: { placement: { value: string | null } } } }>(input)
    bad.profile.application.placement.value = "post_shampoo"
    writeFileSync(input, JSON.stringify(bad))
    assert.throws(
      () => applyProducerAmendments(path.relative(ROOT, f.run), PRODUCER),
      /wire receipt binding/i,
    )
    assert.equal(existsSync(path.join(f.run, "source-amendment-02")), false)
  } finally {
    rmSync(f.base, { recursive: true, force: true })
  }
})

test("refuses a fabricated producer source URL even when the proposed application is schema-compatible", () => {
  const f = fixture()
  try {
    const proposal = read<{ records: Array<{ research_sources: Array<{ url: string }> }> }>(
      PRODUCER,
    )
    proposal.records[0].research_sources[0].url = "https://example.test/not-the-inspected-producer"
    const modified = path.join(f.base, "proposal.json")
    writeFileSync(modified, JSON.stringify(proposal))
    assert.throws(
      () => applyProducerAmendments(f.run, modified),
      /source capture mismatch C03-P01-1/,
    )
    assert.equal(existsSync(path.join(f.run, "source-amendment-02")), false)
  } finally {
    rmSync(f.base, { recursive: true, force: true })
  }
})

test("refuses a resealed Lane B fact divergence rather than calling it prose-only agreement", () => {
  const f = fixture()
  try {
    const input = path.join(f.run, "wire-amendment-01/lane-b/P02.json")
    const wire = read<BondbuilderResearchEnvelope>(input)
    wire.profile.application.placement.value = "pre_shampoo"
    wire.profile.application.placement.source_ids = ["R11"]
    wire.profile.application.placement.unknown_reason = null
    const profileDigest = bondbuilderProfileSha256(wire.profile)
    wire.profile.method.output_sha256 = profileDigest
    wire.profile.review.profile_sha256 = profileDigest
    writeFileSync(input, JSON.stringify(wire))
    const receiptPath = path.join(f.run, "wire-amendment-01/receipt.json")
    const receipt = read<{
      envelopes: Array<{ lane: string; slot_id: string; amended_sha256: string }>
    }>(receiptPath)
    const row = receipt.envelopes.find(
      (entry) => entry.lane === "lane-b" && entry.slot_id === "P02",
    )!
    row.amended_sha256 = createHash("sha256").update(readFileSync(input)).digest("hex")
    writeFileSync(receiptPath, JSON.stringify(receipt))
    assert.throws(
      () => applyProducerAmendments(f.run, PRODUCER),
      /Lane B fact mismatch P02.placement/,
    )
    assert.equal(existsSync(path.join(f.run, "source-amendment-02")), false)
  } finally {
    rmSync(f.base, { recursive: true, force: true })
  }
})
