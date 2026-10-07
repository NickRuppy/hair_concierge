/** Read-only verifier for a prepared bounded regression replay. */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { bondbuilderResearchEnvelopeSchema } from "../../src/lib/bondbuilder-research/contracts"
import { bondbuilderProfileSha256 } from "../../src/lib/bondbuilder-research/production-adapter"

const ROOT = path.resolve(__dirname, "../..")
const DEFAULT_RUN = "data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3"
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex")
const read = <T>(file: string) => JSON.parse(readFileSync(file, "utf8")) as T
type Receipt = { path: string; sha256: string }
type Stage = {
  stage: "A" | "B"
  lane_id: string
  input_receipt: Receipt[]
  records: Array<Record<string, unknown>>
  stage_a_seal?: Receipt
}
type Seal = { lane_id: string; stage: "A" | "B"; sha256: Record<string, string> }
const slots = new Set([
  "P01",
  "P02",
  "P03",
  "P04",
  "P05",
  "P06",
  "P07",
  "P08",
  "V01",
  "V02",
  "V03",
  "V04",
])

function verifyReceipt(run: string, receipt: Receipt[], required: string) {
  assert(
    receipt.some(
      (entry) => entry.path === required && entry.sha256 === hash(path.join(run, required)),
    ),
    `Missing exact input receipt: ${required}`,
  )
}

function verifyStage(run: string, lane: string, stage: "A" | "B") {
  const file = `stage-${stage.toLowerCase()}.json`
  assert(existsSync(path.join(run, lane, file)), `Incomplete replay: ${lane}/${file}`)
  assert(
    existsSync(path.join(run, lane, `stage-${stage.toLowerCase()}-seal.json`)),
    `Incomplete replay: ${lane}/stage-${stage.toLowerCase()}-seal.json`,
  )
  const output = read<Stage>(path.join(run, lane, file))
  assert.equal(output.stage, stage, `Wrong stage: ${lane}/${file}`)
  assert.equal(output.lane_id, lane, `Wrong lane: ${lane}/${file}`)
  assert(Array.isArray(output.input_receipt), `Missing input receipt: ${lane}/${file}`)
  const permitted =
    stage === "A"
      ? ["anonymous-packet.json", "method/researcher-prompt.md", "method/blind-instructions.md"]
      : [
          "named-packet.json",
          `${lane}/stage-a.json`,
          `${lane}/stage-a-seal.json`,
          "method/standard.md",
          "method/runbook.md",
          "method/researcher-prompt.md",
          "frozen-inputs/src/lib/bondbuilder-research/contracts.ts",
          "frozen-inputs/src/lib/product-intake/bondbuilder-research-prompt-contract.ts",
        ]
  assert.equal(
    output.input_receipt.length,
    permitted.length,
    `Unexpected input access: ${lane}/${file}`,
  )
  for (const input of permitted) verifyReceipt(run, output.input_receipt, input)
  assert.equal(output.records.length, 12, `Wrong record count: ${lane}/${file}`)
  assert.deepEqual(
    new Set(output.records.map((record) => record.slot_id)),
    slots,
    `Wrong slot set: ${lane}/${file}`,
  )
  for (const record of output.records) {
    assert.equal(typeof record.slot_id, "string", `Missing slot_id: ${lane}/${file}`)
    for (const key of stage === "A"
      ? [
          "observed_ingredients",
          "candidate_families",
          "formula_state",
          "confidence",
          "limitations",
          "recognition_incidents",
        ]
      : ["source_facts", "source_ids", "conflicts", "unknowns", "limitations"])
      assert(key in record, `Incomplete Stage ${stage} record: ${lane}/${file}:${key}`)
  }
  if (stage === "B") {
    assert(output.stage_a_seal, `Missing pre-unblinding Stage A seal reference: ${lane}/${file}`)
    assert.equal(output.stage_a_seal.path, `${lane}/stage-a-seal.json`)
    assert.equal(output.stage_a_seal.sha256, hash(path.join(run, output.stage_a_seal.path)))
  }
  const seal = read<Seal>(path.join(run, lane, `stage-${stage.toLowerCase()}-seal.json`))
  assert.equal(seal.lane_id, lane, `Wrong lane seal: ${lane}`)
  assert.equal(seal.stage, stage, `Wrong stage seal: ${lane}`)
  assert.equal(
    seal.sha256[file],
    hash(path.join(run, lane, file)),
    `Unsealed replay output: ${lane}/${file}`,
  )
  for (const [sealed, digest] of Object.entries(seal.sha256)) {
    assert(
      !sealed.includes("/") && !sealed.includes("\\") && sealed !== "..",
      `Invalid seal path: ${sealed}`,
    )
    assert.equal(
      digest,
      hash(path.join(run, lane, sealed)),
      `Sealed source drift: ${lane}/${sealed}`,
    )
  }
  return `${lane}/${file}`
}

export function verifyMethodReplay(runArgument?: string, complete = false, frozenOnly = false) {
  const run = path.resolve(ROOT, runArgument || DEFAULT_RUN)
  const manifest = read<{
    source_lineage: Record<string, string>
    frozen_copies: Record<string, string>
    generated_files: Record<string, string>
  }>(path.join(run, "manifest.json"))
  for (const [file, digest] of Object.entries(manifest.frozen_copies))
    assert.equal(hash(path.join(run, file)), digest, `Frozen byte drift: ${file}`)
  const currentSourceDrift: string[] = []
  for (const [file, digest] of Object.entries(manifest.source_lineage)) {
    const frozen = file.startsWith("docs/research/bondbuilder-inci/v0.5/")
      ? `method/${path.basename(file)}`
      : `frozen-inputs/${file}`
    assert.equal(
      manifest.frozen_copies[frozen],
      digest,
      `Missing source-to-snapshot binding: ${file}`,
    )
    if (hash(path.join(ROOT, file)) !== digest) currentSourceDrift.push(file)
    if (!frozenOnly)
      assert.equal(hash(path.join(ROOT, file)), digest, `Source lineage drift: ${file}`)
  }
  for (const [file, digest] of Object.entries(manifest.generated_files))
    assert.equal(hash(path.join(run, file)), digest, `Generated packet drift: ${file}`)
  const anonymous = read<{ rows: Array<Record<string, unknown>> }>(
    path.join(run, "anonymous-packet.json"),
  )
  const named = read<{
    records: Array<Record<string, unknown>>
    source_registry: Array<Record<string, unknown>>
  }>(path.join(run, "named-packet.json"))
  assert.equal(anonymous.rows.length, 12)
  assert.equal(named.records.length, 12)
  assert.deepEqual(new Set(anonymous.rows.map((row) => row.slot_id)), slots)
  const sourceIds = new Set(named.source_registry.map((source) => source.id ?? source.source_id))
  assert.equal(sourceIds.size, named.source_registry.length)
  for (const record of named.records) {
    const refs = [
      ...(Array.isArray(record.formula_source_ids) ? record.formula_source_ids : []),
      ...(Array.isArray(record.direction_source_ids) ? record.direction_source_ids : []),
      record.formula_source_id,
      record.selected_direction_source_id,
      ...(Array.isArray(record.supporting_source_ids) ? record.supporting_source_ids : []),
      ...(Array.isArray(record.conflicts)
        ? record.conflicts.flatMap((conflict) =>
            conflict &&
            typeof conflict === "object" &&
            Array.isArray((conflict as { source_ids?: unknown }).source_ids)
              ? (conflict as { source_ids: unknown[] }).source_ids
              : [],
          )
        : []),
    ]
    for (const id of refs)
      if (typeof id === "string") assert(sourceIds.has(id), `Unknown named source: ${id}`)
  }
  assert.doesNotMatch(
    JSON.stringify(anonymous),
    /OLAPLEX|Kérastase|Redken|claim_trust|owner_anchor|assessment/i,
  )
  if (complete) {
    const outputFiles = [
      "comparison.json",
      "comparison-correction-01.json",
      "adjudication.json",
      "findings.md",
      "assembly-report.json",
      "wire-amendment-01/receipt.json",
      "source-amendment-01/receipt.json",
      "source-amendment-02/receipt.json",
    ]
    for (const lane of ["lane-a", "lane-b"] as const) {
      outputFiles.push(verifyStage(run, lane, "A"), verifyStage(run, lane, "B"))
      outputFiles.push(`${lane}/stage-a-seal.json`, `${lane}/stage-b-seal.json`)
      for (const slot of slots) {
        const artifact = `${lane}/assembled/${slot}.json`
        const parsed = bondbuilderResearchEnvelopeSchema.parse(
          read<unknown>(path.join(run, artifact)),
        )
        const digest = bondbuilderProfileSha256(parsed.profile)
        assert.equal(
          parsed.profile.method.output_sha256,
          digest,
          `Profile digest drift: ${artifact}`,
        )
        assert.equal(
          parsed.profile.review.profile_sha256,
          digest,
          `Review digest drift: ${artifact}`,
        )
        outputFiles.push(artifact)
        const amendedArtifact = `wire-amendment-01/${lane}/${slot}.json`
        const amended = bondbuilderResearchEnvelopeSchema.parse(
          read<unknown>(path.join(run, amendedArtifact)),
        )
        const amendedDigest = bondbuilderProfileSha256(amended.profile)
        assert.equal(
          amended.profile.method.output_sha256,
          amendedDigest,
          `Amended profile digest drift: ${amendedArtifact}`,
        )
        assert.equal(
          amended.profile.review.profile_sha256,
          amendedDigest,
          `Amended review digest drift: ${amendedArtifact}`,
        )
        outputFiles.push(
          amendedArtifact,
          `wire-amendment-01/projection-replay/${lane}/${slot}/production-projection.json`,
        )
        if (slot.startsWith("P")) {
          const sourceArtifact = `source-amendment-02/${lane}/${slot}.json`
          const sourceAmended = bondbuilderResearchEnvelopeSchema.parse(
            read<unknown>(path.join(run, sourceArtifact)),
          )
          const sourceDigest = bondbuilderProfileSha256(sourceAmended.profile)
          assert.equal(
            sourceAmended.profile.method.output_sha256,
            sourceDigest,
            `Source-amended digest drift: ${sourceArtifact}`,
          )
          assert.equal(
            sourceAmended.profile.review.profile_sha256,
            sourceDigest,
            `Source-amended review digest drift: ${sourceArtifact}`,
          )
          outputFiles.push(
            sourceArtifact,
            `source-amendment-02/projection-replay/${lane}/${slot}/production-projection.json`,
          )
        }
      }
    }
    assert(existsSync(path.join(run, "final-seal.json")), "Incomplete replay: final-seal.json")
    const finalSeal = read<{ sha256: Record<string, string> }>(path.join(run, "final-seal.json"))
    for (const file of outputFiles) {
      assert(existsSync(path.join(run, file)), `Incomplete replay: ${file}`)
      assert.equal(
        finalSeal.sha256[file],
        hash(path.join(run, file)),
        `Final seal missing or stale: ${file}`,
      )
    }
    for (const [file, digest] of Object.entries(finalSeal.sha256)) {
      assert(
        !path.isAbsolute(file) && !file.split(/[\\/]/).includes(".."),
        `Invalid final seal path: ${file}`,
      )
      assert.equal(digest, hash(path.join(run, file)), `Final sealed byte drift: ${file}`)
    }
  }
  return {
    mode: complete ? "complete" : "prepared",
    rows: anonymous.rows.length,
    sources: named.source_registry.length,
    ...(frozenOnly
      ? { source_lineage_mode: "historical_frozen_only", current_source_drift: currentSourceDrift }
      : {}),
  }
}

if (process.argv[1]?.endsWith("verify-method-replay.ts")) {
  const index = process.argv.indexOf("--run")
  if (index !== -1 && !process.argv[index + 1]) throw new Error("--run requires a path")
  console.log(
    JSON.stringify(
      verifyMethodReplay(
        index === -1 ? undefined : process.argv[index + 1],
        process.argv.includes("--complete"),
        process.argv.includes("--frozen-only"),
      ),
    ),
  )
}
