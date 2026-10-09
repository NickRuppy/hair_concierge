/** Create-only descriptive comparison of sealed replay envelopes and local adapter outcomes. */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { runBondbuilderProductionAdapterCli } from "./project-production-adapter"
import {
  bondbuilderResearchEnvelopeSchema,
  type BondbuilderResearchProfile,
} from "../../src/lib/bondbuilder-research/contracts"
import type { projectBondbuilderForProduction } from "../../src/lib/bondbuilder-research/production-adapter"

const ROOT = path.resolve(__dirname, "../..")
const DEFAULT_RUN = "data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3"
const SLOTS = ["P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08", "V01", "V02", "V03", "V04"]
const WRAPPER_FIELDS = [
  "placement",
  "applied_format",
  "treatment_role",
  "hair_state",
  "state_modifiers",
  "application_area",
  "distribution",
  "timing",
  "longer_wear",
  "amount",
  "dilution",
  "conditioner",
  "sequence",
  "rinse",
  "cadence",
  "partners",
] as const
const sha256 = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex")
const read = <T>(file: string) => JSON.parse(readFileSync(file, "utf8")) as T
const encode = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
const stable = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, child]) => [key, stable(child)]),
        )
      : value
const same = (left: unknown, right: unknown) =>
  JSON.stringify(stable(left)) === JSON.stringify(stable(right))
const readEnvelope = (file: string) => bondbuilderResearchEnvelopeSchema.parse(read<unknown>(file))

function comparison(left: unknown, right: unknown) {
  return same(left, right) ? null : { lane_a: left, lane_b: right }
}
function wrapperAgreement(a: BondbuilderResearchProfile, b: BondbuilderResearchProfile) {
  const fields: Record<string, unknown> = {}
  let knownKnown = 0,
    knownKnownAgreement = 0,
    nullNullUnknown = 0
  for (const field of WRAPPER_FIELDS) {
    const left = a.application[field],
      right = b.application[field]
    if (left.value !== null && right.value !== null) {
      knownKnown++
      if (same(left.value, right.value)) knownKnownAgreement++
    }
    if (left.value === null && right.value === null) nullNullUnknown++
    const difference = comparison(left, right)
    if (difference) fields[field] = difference
  }
  return {
    known_known: { denominator: knownKnown, agreement: knownKnownAgreement },
    null_null_unknown_agreement: nullNullUnknown,
    differing_wrappers: fields,
  }
}
function compareProfiles(a: BondbuilderResearchProfile, b: BondbuilderResearchProfile) {
  const assessmentFields = [
    "boundary_status",
    "technology_family",
    "claim_trust_level",
    "trust_basis",
    "policy_reference",
    "classification_confidence",
  ] as const
  const assessment: Record<string, unknown> = {}
  for (const field of assessmentFields) {
    const difference = comparison(a.assessment[field], b.assessment[field])
    if (difference) assessment[field] = difference
  }
  const application = wrapperAgreement(a, b)
  const applicationMeta: Record<string, unknown> = {}
  for (const field of [
    "direction_source_ids",
    "source_market",
    "market_applicability",
    "source_variants",
  ] as const) {
    const difference = comparison(a.application[field], b.application[field])
    if (difference) applicationMeta[field] = difference
  }
  const sourceClaims = comparison(
    a.sources.map((source) => ({
      id: source.id,
      url: source.url,
      authority: source.authority,
      scope: source.scope,
      access: source.access,
      observation: source.observation,
      limitations: source.limitations,
    })),
    b.sources.map((source) => ({
      id: source.id,
      url: source.url,
      authority: source.authority,
      scope: source.scope,
      access: source.access,
      observation: source.observation,
      limitations: source.limitations,
    })),
  )
  return {
    assessment_differences: assessment,
    application,
    application_metadata_differences: applicationMeta,
    source_claim_differences: sourceClaims,
  }
}
function categoryTuple(profile: BondbuilderResearchProfile) {
  const assessment = profile.assessment
  return {
    boundary_status: assessment.boundary_status,
    technology_family: assessment.technology_family,
    claim_trust_level: assessment.claim_trust_level,
    trust_basis: assessment.trust_basis,
    policy_reference: assessment.policy_reference,
  }
}
function replayRows(run: string) {
  return SLOTS.map((slot) => {
    const a = readEnvelope(path.join(run, "lane-a/assembled", `${slot}.json`)).profile
    const b = readEnvelope(path.join(run, "lane-b/assembled", `${slot}.json`)).profile
    return {
      slot_id: slot,
      independent_category_agreement:
        slot === "V04"
          ? "excluded_prior_S13_verdict_contamination"
          : same(categoryTuple(a), categoryTuple(b)),
      category_tuple: comparison(categoryTuple(a), categoryTuple(b)),
      classification_confidence: comparison(
        a.assessment.classification_confidence,
        b.assessment.classification_confidence,
      ),
      reasoning_prose: comparison(a.assessment.reasoning, b.assessment.reasoning),
      comparison: compareProfiles(a, b),
    }
  })
}

export function compareMethodReplay(runArgument?: string) {
  const run = path.resolve(ROOT, runArgument || DEFAULT_RUN)
  const comparisonPath = path.join(run, "comparison.json"),
    projectionRoot = path.join(run, "projection-replay")
  if (existsSync(comparisonPath) || existsSync(projectionRoot))
    throw new Error("Refusing existing comparison or projection replay target")
  const inputs = [
    ...(["lane-a", "lane-b"] as const).flatMap((lane) =>
      SLOTS.map((slot) => ({
        cohort: lane,
        slot,
        input: path.join(run, lane, "assembled", `${slot}.json`),
        output: path.join(projectionRoot, lane, slot),
      })),
    ),
    ...SLOTS.slice(0, 8).map((slot) => ({
      cohort: "history",
      slot,
      input: path.join(
        ROOT,
        "data/research/bondbuilder-inci/v1.0/owner-consolidation-2026-10-02",
        `${slot}.json`,
      ),
      output: path.join(projectionRoot, "history", slot),
    })),
  ]
  for (const item of inputs)
    if (!existsSync(item.input) || existsSync(item.output))
      throw new Error(`Missing input or existing output: ${item.cohort}/${item.slot}`)
  const inputHashes = new Map(inputs.map((item) => [item.input, sha256(item.input)]))
  const rows = replayRows(run)
  mkdirSync(projectionRoot)
  const projections = inputs.map((item) => {
    const exit_code = runBondbuilderProductionAdapterCli([
      "--input",
      item.input,
      "--output",
      item.output,
    ])
    const outcome = read<ReturnType<typeof projectBondbuilderForProduction>>(
      path.join(item.output, "production-projection.json"),
    )
    return {
      cohort: item.cohort,
      slot_id: item.slot,
      exit_code,
      status: outcome.status,
      readiness: outcome.readiness,
      errors: outcome.errors,
    }
  })
  for (const [file, before] of inputHashes)
    if (sha256(file) !== before) throw new Error(`Input byte drift: ${path.relative(ROOT, file)}`)
  const projected = projections.filter((entry) => entry.status === "projected").length
  const report = {
    version: "bondbuilder-method-replay-comparison-v1",
    run: path.relative(ROOT, run),
    purpose:
      "descriptive replay comparison only; not an unseen holdout, efficacy claim, ranking, method lock, or activation",
    cohorts: {
      calibration_products: 8,
      calibration_families: 5,
      previously_researched_products: 4,
      previously_researched_positive_families: 1,
      newly_unseen_here: 0,
      note: "Eight pilot and four previously researched products are known regression material. V04 is descriptive only and excluded from independent category agreement because of prior S13 verdict contamination.",
    },
    lane_rows: rows,
    independent_category_agreement: {
      denominator: rows.filter((row) => row.slot_id !== "V04").length,
      agreement: rows.filter(
        (row) => row.slot_id !== "V04" && row.independent_category_agreement === true,
      ).length,
      excluded: ["V04"],
    },
    projection_replay: {
      total: projections.length,
      projected,
      refused: projections.length - projected,
      outcomes: projections,
    },
  }
  writeFileSync(comparisonPath, encode(report), { flag: "wx" })
  return {
    rows: rows.length,
    projections: projections.length,
    projected,
    refused: projections.length - projected,
    comparison: path.relative(ROOT, comparisonPath),
  }
}

export function correctMethodReplayComparison(runArgument?: string) {
  const run = path.resolve(ROOT, runArgument || DEFAULT_RUN)
  const originalPath = path.join(run, "comparison.json"),
    correctionPath = path.join(run, "comparison-correction-01.json")
  if (!existsSync(originalPath)) throw new Error("Missing original comparison for correction")
  if (existsSync(correctionPath)) throw new Error("Refusing existing comparison correction target")
  const original = read<{ independent_category_agreement: unknown; projection_replay: unknown }>(
    originalPath,
  )
  const rows = replayRows(run)
  const independent = rows.filter((row) => row.slot_id !== "V04")
  const correction = {
    version: "bondbuilder-method-replay-comparison-correction-v1",
    run: path.relative(ROOT, run),
    supersedes: {
      path: "comparison.json",
      sha256: sha256(originalPath),
      corrections: [
        "Independent-category denominator is 11 slot pairs, not individual envelopes.",
        "Independent category agreement compares only boundary_status, technology_family, claim_trust_level, trust_basis, and policy_reference; classification confidence and reasoning prose are reported separately.",
      ],
    },
    old_report_counts_not_classified_as_engine_errors: {
      independent_category_agreement: original.independent_category_agreement,
      projection_replay: original.projection_replay,
    },
    independent_category_agreement: {
      denominator: independent.length,
      agreement: independent.filter((row) => row.independent_category_agreement === true).length,
      excluded: [{ slot_id: "V04", reason: "prior_S13_verdict_contamination" }],
    },
    lane_rows: rows,
    projection_replay_reused_without_rerun: original.projection_replay,
  }
  writeFileSync(correctionPath, encode(correction), { flag: "wx" })
  return {
    rows: rows.length,
    denominator: independent.length,
    agreement: correction.independent_category_agreement.agreement,
    correction: path.relative(ROOT, correctionPath),
  }
}

if (process.argv[1]?.endsWith("compare-method-replay.ts")) {
  const index = process.argv.indexOf("--run")
  if (index !== -1 && !process.argv[index + 1]) throw new Error("--run requires a path")
  const run = index === -1 ? undefined : process.argv[index + 1]
  console.log(
    JSON.stringify(
      process.argv.includes("--correct")
        ? correctMethodReplayComparison(run)
        : compareMethodReplay(run),
    ),
  )
}
