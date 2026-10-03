import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import type { BondbuilderResearchEnvelope } from "../src/lib/bondbuilder-research/contracts"
import type { BondbuilderProductionAdapterOutcome } from "../src/lib/bondbuilder-research/production-adapter"
import { bondbuilderProfileSha256, projectBondbuilderForProduction } from "../src/lib/bondbuilder-research/production-adapter"
import { amendMethodWire } from "../scripts/bondbuilder-research/amend-method-wire"

const ROOT = path.resolve(__dirname, "..")
const canonicalRun = path.join(ROOT, "data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3")
const read = <T>(file: string) => JSON.parse(readFileSync(file, "utf8")) as T
const digest = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex")
const write = (file: string, value: unknown) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)

function fixtureRun() {
  const base = mkdtempSync(path.join(os.tmpdir(), "bondbuilder-wire-")), run = path.join(base, "replay")
  cpSync(canonicalRun, run, { recursive: true })
  rmSync(path.join(run, "wire-amendment-01"), { recursive: true, force: true })
  return { base, run }
}

function updateAssemblyHash(run: string, lane: "lane-a" | "lane-b", slot: string) {
  const reportPath = path.join(run, "assembly-report.json")
  const report = read<{ profiles: Array<{ lane: string; slot_id: string; path: string; sha256: string }> }>(reportPath)
  const record = report.profiles.find((entry) => entry.lane === lane && entry.slot_id === slot)
  assert.ok(record)
  record.sha256 = digest(path.join(run, record.path))
  write(reportPath, report)
}

test("amends only canonical shared-marker casing, then the real adapter projects P01, while originals remain byte-identical", () => {
  const fixture = fixtureRun()
  try {
    const inputPath = path.join(fixture.run, "lane-a/assembled/P01.json")
    const inputBytes = readFileSync(inputPath)
    const before = read<BondbuilderResearchEnvelope>(inputPath)
    // RED baseline: original casing reaches the real adapter but fails its reference binding.
    assert.ok(projectBondbuilderForProduction(before).errors.includes("technology_reference_binding_mismatch"))
    const result = amendMethodWire(path.relative(ROOT, fixture.run))
    assert.equal(result.total, 24)
    const outputPath = path.join(fixture.run, "wire-amendment-01/lane-a/P01.json")
    const after = read<BondbuilderResearchEnvelope>(outputPath)
    assert.notDeepEqual(after.profile.technology_reference.shared_markers, before.profile.technology_reference.shared_markers)
    const exceptWire = structuredClone(after)
    exceptWire.profile.technology_reference.shared_markers = before.profile.technology_reference.shared_markers
    exceptWire.profile.method.output_sha256 = before.profile.method.output_sha256
    exceptWire.profile.review.profile_sha256 = before.profile.review.profile_sha256
    assert.deepEqual(exceptWire, before)
    assert.deepEqual(readFileSync(inputPath), inputBytes)
    const projected = read<BondbuilderProductionAdapterOutcome>(path.join(fixture.run, "wire-amendment-01/projection-replay/lane-a/P01/production-projection.json"))
    assert.equal(projected.status, "projected")
    assert.deepEqual(projected.errors, [])
    const outputBytes = readFileSync(outputPath)
    assert.throws(() => amendMethodWire(path.relative(ROOT, fixture.run)), /existing wire amendment target/i)
    assert.deepEqual(readFileSync(outputPath), outputBytes)
    assert.deepEqual(readFileSync(inputPath), inputBytes)
  } finally { rmSync(fixture.base, { recursive: true, force: true }) }
})

test("refuses a self-consistent but nonmember shared marker before creating a target", () => {
  const fixture = fixtureRun()
  try {
    const file = path.join(fixture.run, "lane-a/assembled/P01.json"), envelope = read<BondbuilderResearchEnvelope>(file)
    envelope.profile.technology_reference.shared_markers = ["not a formula marker"]
    envelope.profile.method.output_sha256 = "0".repeat(64)
    envelope.profile.review.profile_sha256 = "0".repeat(64)
    const profileDigest = bondbuilderProfileSha256(envelope.profile)
    envelope.profile.method.output_sha256 = profileDigest
    envelope.profile.review.profile_sha256 = profileDigest
    write(file, envelope)
    updateAssemblyHash(fixture.run, "lane-a", "P01")
    assert.throws(() => amendMethodWire(path.relative(ROOT, fixture.run)), /not canonical in both formulae/i)
    assert.equal(existsSync(path.join(fixture.run, "wire-amendment-01")), false)
  } finally { rmSync(fixture.base, { recursive: true, force: true }) }
})

test("refuses an unresealed profile even when its local assembly hash is replaced", () => {
  const fixture = fixtureRun()
  try {
    const file = path.join(fixture.run, "lane-a/assembled/P01.json"), envelope = read<BondbuilderResearchEnvelope>(file)
    envelope.profile.assessment.reasoning.boundary_status.rationale = `${envelope.profile.assessment.reasoning.boundary_status.rationale} tampered`
    write(file, envelope)
    updateAssemblyHash(fixture.run, "lane-a", "P01")
    assert.throws(() => amendMethodWire(path.relative(ROOT, fixture.run)), /input profile digest mismatch/i)
    assert.equal(existsSync(path.join(fixture.run, "wire-amendment-01")), false)
  } finally { rmSync(fixture.base, { recursive: true, force: true }) }
})
