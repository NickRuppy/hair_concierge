/** Create-only serialization amendment; it never changes sealed replay inputs. */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { bondbuilderResearchEnvelopeSchema, type BondbuilderResearchEnvelope, type BondbuilderResearchProfile } from "../../src/lib/bondbuilder-research/contracts"
import { bondbuilderProfileSha256, projectBondbuilderForProduction } from "../../src/lib/bondbuilder-research/production-adapter"
import { BOND_OWNER_REGISTRY, BOND_REFERENCE_KEYS } from "../../src/lib/bondbuilder-research/registry"
import { runBondbuilderProductionAdapterCli } from "./project-production-adapter"

const ROOT = path.resolve(__dirname, "../..")
const DEFAULT_RUN = "data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3"
const SLOTS = ["P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08", "V01", "V02", "V03", "V04"]
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex")
const read = <T>(file: string) => JSON.parse(readFileSync(file, "utf8")) as T
const encode = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
type AssemblyReport = { profiles: Array<{ lane: string; slot_id: string; path: string; sha256: string }> }
type StageSeal = { lane_id: string; stage: "A" | "B"; sha256: Record<string, string> }
type ProjectionOutcome = { status: "projected" | "refused"; readiness: Record<string, boolean>; errors: string[] }

function verifyStageSeal(run: string, lane: "lane-a" | "lane-b", stage: "A" | "B") {
  const output = `stage-${stage.toLowerCase()}.json`
  const seal = read<StageSeal>(path.join(run, lane, `stage-${stage.toLowerCase()}-seal.json`))
  if (seal.lane_id !== lane || seal.stage !== stage || seal.sha256[output] !== hash(path.join(run, lane, output)))
    throw new Error(`Wire amendment refused: invalid ${lane} Stage ${stage} seal`)
}

function canonicalMarker(marker: string, profile: BondbuilderResearchProfile) {
  const reference = profile.technology_reference
  const row = BOND_OWNER_REGISTRY.find((entry) => BOND_REFERENCE_KEYS.includes(entry.research_key as never) && entry.research_key === reference.research_key)
  if (!row) throw new Error(`Wire amendment refused: untrusted technology reference ${reference.research_key}`)
  if (reference.formula_sha256 !== row.normalized_sha256 || reference.source_version !== row.source_version || reference.product_id !== null || !reference.source_ids.length || !reference.shared_markers.length || profile.assessment.technology_family !== row.technology_family)
    throw new Error(`Wire amendment refused: invalid trusted technology reference ${reference.research_key}`)
  const fold = (value: string) => value.toLocaleLowerCase("en-US")
  const formulaMatches = profile.formula.normalized_ingredients.filter((ingredient: string) => fold(ingredient) === fold(marker))
  const referenceMatches = row.normalized_ingredients.filter((ingredient: string) => fold(ingredient) === fold(marker))
  if (formulaMatches.length !== 1 || referenceMatches.length !== 1 || formulaMatches[0] !== referenceMatches[0])
    throw new Error(`Wire amendment refused: shared marker not canonical in both formulae: ${marker}`)
  if (!profile.formula.markers.some((entry) => entry.literal === formulaMatches[0] && entry.family === row.technology_family))
    throw new Error(`Wire amendment refused: shared marker is not an exact family marker: ${marker}`)
  return formulaMatches[0]
}
function amendEnvelope(envelope: BondbuilderResearchEnvelope) {
  const actualDigest = bondbuilderProfileSha256(envelope.profile)
  if (envelope.profile.method.output_sha256 !== actualDigest || envelope.profile.review.profile_sha256 !== actualDigest)
    throw new Error("Wire amendment refused: input profile digest mismatch")
  const output = structuredClone(envelope) as BondbuilderResearchEnvelope, profile = output.profile, reference = profile.technology_reference
  const before = [...reference.shared_markers]
  if (reference.status === "matched") reference.shared_markers = before.map((marker: string) => canonicalMarker(marker, profile))
  profile.method.output_sha256 = "0".repeat(64); profile.review.profile_sha256 = "0".repeat(64)
  const digest = bondbuilderProfileSha256(profile)
  profile.method.output_sha256 = digest; profile.review.profile_sha256 = digest
  const precheck = projectBondbuilderForProduction(output)
  if (precheck.errors.includes("technology_reference_binding_mismatch"))
    throw new Error("Wire amendment refused: canonicalized reference still fails production technology binding")
  return { envelope: output, changes: before.flatMap((marker: string, index: number) => marker === reference.shared_markers[index] ? [] : [{ path: "profile.technology_reference.shared_markers", before: marker, after: reference.shared_markers[index] }]) }
}

export function amendMethodWire(runArgument?: string) {
  const run = path.resolve(ROOT, runArgument || DEFAULT_RUN), target = path.join(run, "wire-amendment-01")
  if (existsSync(target)) throw new Error("Wire amendment refused: existing wire amendment target")
  for (const lane of ["lane-a", "lane-b"] as const) {
    verifyStageSeal(run, lane, "A")
    verifyStageSeal(run, lane, "B")
  }
  const inputs = (["lane-a", "lane-b"] as const).flatMap((lane) => SLOTS.map((slot) => ({ lane, slot, input: path.join(run, lane, "assembled", `${slot}.json`), output: path.join(target, lane, `${slot}.json`), projection: path.join(target, "projection-replay", lane, slot) })))
  const assembly = read<AssemblyReport>(path.join(run, "assembly-report.json")), expectedHashes = new Map(assembly.profiles.map((entry) => [entry.path, entry.sha256]))
  for (const item of inputs) {
    const relative = path.relative(run, item.input)
    if (!existsSync(item.input) || existsSync(item.output) || existsSync(item.projection) || expectedHashes.get(relative) !== hash(item.input)) throw new Error(`Wire amendment refused: missing, unsealed, or existing output ${item.lane}/${item.slot}`)
  }
  const inputHashes = new Map(inputs.map((item) => [item.input, hash(item.input)]))
  const amended = inputs.map((item) => ({ ...item, ...amendEnvelope(bondbuilderResearchEnvelopeSchema.parse(read<unknown>(item.input))) }))
  mkdirSync(target)
  const receiptRows: Array<Record<string, unknown>> = [], outcomes: Array<{ lane: string; slot_id: string; exit_code: number; status: "projected" | "refused"; readiness: Record<string, boolean>; errors: string[] }> = []
  for (const item of amended) {
    mkdirSync(path.dirname(item.output), { recursive: true }); writeFileSync(item.output, encode(item.envelope), { flag: "wx" })
    const exit_code = runBondbuilderProductionAdapterCli(["--input", item.output, "--output", item.projection]), outcome = read<ProjectionOutcome>(path.join(item.projection, "production-projection.json"))
    receiptRows.push({ lane: item.lane, slot_id: item.slot, original_path: path.relative(run, item.input), original_sha256: inputHashes.get(item.input), amended_path: path.relative(run, item.output), amended_sha256: hash(item.output), changes: item.changes })
    outcomes.push({ lane: item.lane, slot_id: item.slot, exit_code, status: outcome.status, readiness: outcome.readiness, errors: outcome.errors })
  }
  for (const [file, digest] of inputHashes) if (hash(file) !== digest) throw new Error(`Wire amendment refused: input byte drift ${path.relative(ROOT, file)}`)
  const receipt = { version: "bondbuilder-method-wire-amendment-receipt-v1", purpose: "transparent serialization repair only; not fresh blind validation, efficacy evidence, ranking, default-tier decision, or activation", run: path.relative(ROOT, run), original_seal_lineage: ["lane-a/stage-a-seal.json", "lane-a/stage-b-seal.json", "lane-b/stage-a-seal.json", "lane-b/stage-b-seal.json"], envelopes: receiptRows, projection_replay: { total: outcomes.length, projected: outcomes.filter((outcome) => outcome.status === "projected").length, refused: outcomes.filter((outcome) => outcome.status === "refused").length, outcomes } }
  writeFileSync(path.join(target, "receipt.json"), encode(receipt), { flag: "wx" })
  return { total: amended.length, changed: receiptRows.filter((row) => (row.changes as unknown[]).length > 0).length, projected: receipt.projection_replay.projected, refused: receipt.projection_replay.refused, target: path.relative(ROOT, target) }
}

if (process.argv[1]?.endsWith("amend-method-wire.ts")) {
  const index = process.argv.indexOf("--run")
  if (index !== -1 && !process.argv[index + 1]) throw new Error("--run requires a path")
  console.log(JSON.stringify(amendMethodWire(index === -1 ? undefined : process.argv[index + 1])))
}
