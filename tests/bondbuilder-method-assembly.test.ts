import assert from "node:assert/strict"
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { createHash } from "node:crypto"
import { assembleMethodReplay } from "../scripts/bondbuilder-research/assemble-method-replay"
import { makeBondbuilderProfile } from "./fixtures/bondbuilder-research/profile"
import { projectBondbuilderForProduction } from "../src/lib/bondbuilder-research/production-adapter"

const ROOT = path.resolve(__dirname, "..")
const canonicalRun = path.join(
  ROOT,
  "data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3",
)
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
const read = <T>(file: string) => JSON.parse(readFileSync(file, "utf8")) as T
const stageBPath = (run: string, lane = "lane-a") => path.join(run, lane, "stage-b.json")
const sealPath = (run: string, lane = "lane-a") => path.join(run, lane, "stage-b-seal.json")
const SOURCE_FACT_KEYS = [
  "assessment",
  "technology_reference",
  "application",
  "evidence",
  "explanations_de",
  "fit",
  "holds",
] as const

function writeStageB(run: string, stageB: Record<string, unknown>, lane = "lane-a") {
  writeFileSync(stageBPath(run, lane), JSON.stringify(stageB, null, 2))
  writeFileSync(
    sealPath(run, lane),
    JSON.stringify(
      {
        lane_id: lane,
        stage: "B",
        sha256: { "stage-b.json": digest(readFileSync(stageBPath(run, lane))) },
      },
      null,
      2,
    ),
  )
}

function stagedRun() {
  const base = mkdtempSync(path.join(os.tmpdir(), "bondbuilder-assembly-"))
  const run = path.join(base, "replay")
  cpSync(canonicalRun, run, { recursive: true })
  for (const lane of ["lane-a", "lane-b"]) {
    rmSync(stageBPath(run, lane), { force: true })
    rmSync(sealPath(run, lane), { force: true })
    rmSync(path.join(run, lane, "assembled"), { recursive: true, force: true })
  }
  rmSync(path.join(run, "assembly-report.json"), { force: true })
  const profile = makeBondbuilderProfile()
  const stageA = read<{ records: Array<Record<string, unknown>> }>(
    path.join(run, "lane-a/stage-a.json"),
  )
  const anonymous = read<{ rows: Array<Record<string, unknown>> }>(
    path.join(run, "anonymous-packet.json"),
  )
  const named = read<{
    records: Array<Record<string, unknown>>
    source_registry: Array<Record<string, unknown>>
  }>(path.join(run, "named-packet.json"))
  const record = {
    slot_id: "P03",
    source_facts: {
      assessment: profile.assessment,
      technology_reference: profile.technology_reference,
      application: profile.application,
      evidence: profile.evidence,
      explanations_de: profile.explanations_de,
      fit: profile.fit,
      holds: profile.holds,
    },
    source_ids: ["R07"],
    conflicts: [],
    unknowns: [],
    limitations: ["Fixture assembly only."],
    identity_status: "resolved",
    candidate_to_final_trace: profile.formula.candidate_to_final_trace,
  }
  const stageB: Record<string, any> = {
    stage: "B",
    lane_id: "lane-a",
    input_receipt: [{ path: "named-packet.json", sha256: "0".repeat(64) }],
    stage_a_seal: { path: "lane-a/stage-a-seal.json", sha256: "0".repeat(64) },
    source_registry: named.source_registry.filter((source) => source.id === "R07"),
    records: [record],
  }
  writeFileSync(
    path.join(run, "lane-a/stage-a.json"),
    JSON.stringify(
      { ...stageA, records: stageA.records.filter((row) => row.slot_id === "P03") },
      null,
      2,
    ),
  )
  writeFileSync(
    path.join(run, "lane-a/stage-a-seal.json"),
    JSON.stringify(
      {
        lane_id: "lane-a",
        stage: "A",
        sha256: { "stage-a.json": digest(readFileSync(path.join(run, "lane-a/stage-a.json"))) },
      },
      null,
      2,
    ),
  )
  writeFileSync(
    path.join(run, "anonymous-packet.json"),
    JSON.stringify({ rows: anonymous.rows.filter((row) => row.slot_id === "P03") }, null, 2),
  )
  writeFileSync(
    path.join(run, "named-packet.json"),
    JSON.stringify(
      {
        records: named.records.filter((row) => row.slot_id === "P03"),
        source_registry: stageB.source_registry,
      },
      null,
      2,
    ),
  )
  stageB.input_receipt[0].sha256 = digest(readFileSync(path.join(run, "named-packet.json")))
  stageB.stage_a_seal.sha256 = digest(readFileSync(path.join(run, "lane-a/stage-a-seal.json")))
  writeStageB(run, stageB)
  return { base, run, stageB, record }
}

test("assembles sealed exact research cores into a production-shaped envelope without judgment changes", () => {
  const fixture = stagedRun()
  try {
    assert.equal(assembleMethodReplay(path.relative(ROOT, fixture.run)).profiles, 1)
    const envelope = read<any>(path.join(fixture.run, "lane-a/assembled/P03.json"))
    assert.equal(envelope.version, "bondbuilder-research-envelope-v1")
    assert.equal(envelope.submission_id, null)
    for (const key of SOURCE_FACT_KEYS)
      assert.deepEqual(envelope.profile[key], fixture.record.source_facts[key])
    assert.equal(envelope.profile.method.output_sha256, envelope.profile.review.profile_sha256)
    assert.equal(projectBondbuilderForProduction(envelope).status, "projected")
  } finally {
    rmSync(fixture.base, { recursive: true, force: true })
  }
})

test("rejects altered Stage A or Stage B contents when their seals were not refreshed", () => {
  for (const target of ["stage-a", "stage-b"] as const) {
    const fixture = stagedRun()
    try {
      const file =
        target === "stage-a"
          ? path.join(fixture.run, "lane-a/stage-a.json")
          : stageBPath(fixture.run)
      const altered = read<any>(file)
      altered.records[0].limitations = ["tampered"]
      writeFileSync(file, JSON.stringify(altered))
      assert.throws(
        () => assembleMethodReplay(path.relative(ROOT, fixture.run)),
        /seal digest mismatch/i,
      )
      assert.equal(existsSync(path.join(fixture.run, "lane-a/assembled")), false)
    } finally {
      rmSync(fixture.base, { recursive: true, force: true })
    }
  }
})

test("preflights every available lane before writing when another lane is invalid", () => {
  const fixture = stagedRun()
  try {
    const laneB = structuredClone(fixture.stageB)
    laneB.lane_id = "lane-b"
    laneB.stage_a_seal.path = "lane-b/stage-a-seal.json"
    laneB.stage_a_seal.sha256 = digest(
      readFileSync(path.join(fixture.run, "lane-b/stage-a-seal.json")),
    )
    laneB.records[0].source_ids = ["unknown-source"]
    writeStageB(fixture.run, laneB, "lane-b")
    assert.throws(() => assembleMethodReplay(path.relative(ROOT, fixture.run)), /unknown source/i)
    assert.equal(existsSync(path.join(fixture.run, "lane-a/assembled")), false)
    assert.equal(existsSync(path.join(fixture.run, "lane-b/assembled")), false)
    assert.equal(existsSync(path.join(fixture.run, "assembly-report.json")), false)
  } finally {
    rmSync(fixture.base, { recursive: true, force: true })
  }
})

test("rejects incomplete source cores and source authority/access upgrades", () => {
  const fixture = stagedRun()
  try {
    delete (fixture.record.source_facts as Record<string, unknown>).fit
    writeStageB(fixture.run, fixture.stageB)
    assert.throws(
      () => assembleMethodReplay(path.relative(ROOT, fixture.run)),
      /source_facts fields/i,
    )
    fixture.record.source_facts.fit = makeBondbuilderProfile().fit
    for (const [key, value] of [
      ["access", "full_text"],
      ["authority", "peer_reviewed"],
    ]) {
      fixture.stageB.source_registry[0][key] = value
      writeStageB(fixture.run, fixture.stageB)
      assert.throws(
        () => assembleMethodReplay(path.relative(ROOT, fixture.run)),
        /source capture mismatch/i,
      )
      fixture.stageB.source_registry[0][key] = read<any>(
        path.join(fixture.run, "named-packet.json"),
      ).source_registry[0][key]
    }
  } finally {
    rmSync(fixture.base, { recursive: true, force: true })
  }
})

test("converts frozen legacy V captures with explicit S07 technology provenance", () => {
  const fixture = stagedRun()
  try {
    const legacy = read<any>(path.join(canonicalRun, "named-packet.json")).source_registry.filter(
      (source: any) => source.source_id === "S07",
    )
    fixture.stageB.source_registry.push(...legacy)
    const named = read<any>(path.join(fixture.run, "named-packet.json"))
    named.source_registry.push(...legacy)
    writeFileSync(path.join(fixture.run, "named-packet.json"), JSON.stringify(named))
    fixture.stageB.input_receipt[0].sha256 = digest(
      readFileSync(path.join(fixture.run, "named-packet.json")),
    )
    writeStageB(fixture.run, fixture.stageB)
    assembleMethodReplay(path.relative(ROOT, fixture.run))
    const source = read<any>(
      path.join(fixture.run, "lane-a/assembled/P03.json"),
    ).profile.sources.find((entry: any) => entry.id === "S07")
    assert.deepEqual(
      { id: source.id, authority: source.authority, scope: source.scope, access: source.access },
      { id: "S07", authority: "supplier", scope: "technology", access: "full_text" },
    )
  } finally {
    rmSync(fixture.base, { recursive: true, force: true })
  }
})

test("preserves a conservative inspected-excerpt label for a frozen legacy S07 capture", () => {
  const fixture = stagedRun()
  try {
    const legacy = read<any>(path.join(canonicalRun, "named-packet.json")).source_registry.find(
      (source: any) => source.source_id === "S07",
    )
    const typed = {
      id: "S07",
      url: legacy.url,
      checked_date: legacy.accessed_at,
      authority: "supplier",
      type: "legacy_supplier_document",
      scope: "technology",
      access: "inspected_excerpt",
      author: null,
      affiliation: legacy.publisher,
      commercial_context: legacy.commercial_context,
      observation: legacy.observations.join(" "),
      limitations: legacy.limitations,
    }
    const named = read<any>(path.join(fixture.run, "named-packet.json"))
    named.source_registry.push(legacy)
    fixture.stageB.source_registry.push(typed)
    writeFileSync(path.join(fixture.run, "named-packet.json"), JSON.stringify(named))
    fixture.stageB.input_receipt[0].sha256 = digest(
      readFileSync(path.join(fixture.run, "named-packet.json")),
    )
    writeStageB(fixture.run, fixture.stageB)
    assembleMethodReplay(path.relative(ROOT, fixture.run))
    const source = read<any>(
      path.join(fixture.run, "lane-a/assembled/P03.json"),
    ).profile.sources.find((entry: any) => entry.id === "S07")
    assert.equal(source.access, "inspected_excerpt")
  } finally {
    rmSync(fixture.base, { recursive: true, force: true })
  }
})

test("rejects an upgraded typed P capture that was frozen as uninspected", () => {
  const fixture = stagedRun()
  try {
    const named = read<any>(path.join(fixture.run, "named-packet.json"))
    const frozen = { ...named.source_registry[0], id: "P99:U01", access: "uninspected" }
    named.source_registry.push(frozen)
    fixture.stageB.source_registry.push({ ...frozen, access: "full_text" })
    writeFileSync(path.join(fixture.run, "named-packet.json"), JSON.stringify(named))
    fixture.stageB.input_receipt[0].sha256 = digest(
      readFileSync(path.join(fixture.run, "named-packet.json")),
    )
    writeStageB(fixture.run, fixture.stageB)
    assert.throws(
      () => assembleMethodReplay(path.relative(ROOT, fixture.run)),
      /source capture mismatch.*access/i,
    )
  } finally {
    rmSync(fixture.base, { recursive: true, force: true })
  }
})

test("filters sealed negative controls from profile markers and reports their exclusion", () => {
  const fixture = stagedRun()
  try {
    const stageAPath = path.join(fixture.run, "lane-a/stage-a.json")
    const stageA = read<any>(stageAPath)
    stageA.records[0].observed_ingredients.push("LACTIC ACID")
    writeFileSync(stageAPath, JSON.stringify(stageA))
    writeFileSync(
      path.join(fixture.run, "lane-a/stage-a-seal.json"),
      JSON.stringify({
        lane_id: "lane-a",
        stage: "A",
        sha256: { "stage-a.json": digest(readFileSync(stageAPath)) },
      }),
    )
    fixture.stageB.stage_a_seal.sha256 = digest(
      readFileSync(path.join(fixture.run, "lane-a/stage-a-seal.json")),
    )
    writeStageB(fixture.run, fixture.stageB)
    assembleMethodReplay(path.relative(ROOT, fixture.run))
    const envelope = read<any>(path.join(fixture.run, "lane-a/assembled/P03.json"))
    const report = read<any>(path.join(fixture.run, "assembly-report.json"))
    assert.equal(
      envelope.profile.formula.markers.some((marker: any) => marker.literal === "lactic acid"),
      false,
    )
    assert.deepEqual(report.marker_exclusions, [
      { lane: "lane-a", slot_id: "P03", observed_ingredients: ["LACTIC ACID"] },
    ])
  } finally {
    rmSync(fixture.base, { recursive: true, force: true })
  }
})
