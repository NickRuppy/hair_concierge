/**
 * Builds the Standard v1.1 calibration set from two frozen inputs:
 *
 *   - data/research/leave-in-inci/v1.0/calibration-envelopes/  — the v1.0
 *     envelopes (byte-frozen; derived from reference-key-v4 + the packet)
 *   - data/research/leave-in-inci/v1.1/corpus/t20-rederived/t20-care-direction-records.json
 *     — the T20 re-derivation of `care_direction` for every in-category record
 *
 * T20 reopened `care_direction` only (§16). Each v1.1 envelope is therefore the
 * v1.0 envelope with (a) the v1.1 research method stamp, (b) the T20
 * `careDirection` evidence object transcribed from its record, (c)
 * `care_direction` added to `uncertainFields` where the T20 read is `low` and
 * routes to review, and (d) one assumption note naming the overlay. Every other
 * field is carried byte-for-byte. Nothing is researched or re-judged here, and
 * the script refuses to run if a record disagrees with its v1.0 envelope on an
 * unchanged value.
 *
 * It then projects every envelope through the production adapter and writes the
 * golden expectation file the calibration test pins.
 *
 * Usage (from the repo root):
 *   node --import ./tests/server-only-register.cjs --import tsx scripts/leave-in-research/build-v1.1-calibration.ts
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"

import {
  LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD,
  LEAVE_IN_PRODUCTION_ADAPTER_VERSION,
  projectLeaveInForProduction,
  type LeaveInProductionAdapterOutcome,
  type LeaveInResearchEnvelope,
} from "@/lib/leave-in-research/production-adapter"

const ROOT = process.cwd()
const V10_ENVELOPES = path.join(ROOT, "data/research/leave-in-inci/v1.0/calibration-envelopes")
const T20_RECORDS = path.join(
  ROOT,
  "data/research/leave-in-inci/v1.1/corpus/t20-rederived/t20-care-direction-records.json",
)
const OUT_ROOT = path.join(ROOT, "data/research/leave-in-inci/v1.1")
const OUT_ENVELOPES = path.join(OUT_ROOT, "calibration-envelopes")
const OUT_EXPECTED = path.join(OUT_ROOT, "calibration-expected-projections.json")
const RECORDS_RELATIVE = path.relative(ROOT, T20_RECORDS)

type T20Record = {
  slot: number | string
  tail_marker: { ingredient: string | null; rank: number | null; marker_status: string }
  care_direction: {
    value: "moisture" | "balanced" | "protein"
    confidence: "low" | "moderate"
    row: string
    film_lead_margin: number | null
    changed: boolean
    note: string
    mandatory_counter_signal?: string
    routes_to_review: boolean
    review_triggers: string[]
  }
}

function careDirectionEvidence(
  record: T20Record,
): LeaveInResearchEnvelope["profile"]["careDirection"] {
  const cd = record.care_direction
  const marker = record.tail_marker.rank
    ? `${record.tail_marker.ingredient} r${record.tail_marker.rank} (${record.tail_marker.marker_status})`
    : `none_visible — ordinal read`
  const evidenceSignals = [
    `T20 re-derivation record slot ${record.slot} (${RECORDS_RELATIVE})`,
    "evidence_level: E2",
    "evidence_scope: formula",
    `anchor row: ${cd.row}`,
    `tail marker: ${marker}`,
    ...(cd.film_lead_margin !== null ? [`film-lead margin: ${cd.film_lead_margin} rank(s)`] : []),
    ...(cd.mandatory_counter_signal ? [cd.mandatory_counter_signal] : []),
    cd.note,
    ...(cd.review_triggers.length ? [`review triggers: ${cd.review_triggers.join(", ")}`] : []),
  ]
  return {
    value: cd.value,
    confidence: cd.confidence,
    rationale: `§9 as amended by the v1.1 overlay (T20) resolved care_direction to \`${cd.value}\` on the \`${cd.row}\` row at E2 (T20 record, slot ${record.slot}).`,
    evidenceSignals,
    derivation:
      "§10.1: `care_direction` <- §9 as amended by Standard v1.1 (T20, §9-O1–O7): only settled humectants and medium/rich-band lipids above the tail set a moisture leg; a persistent film that outranks them makes the leg subordinate.",
    thresholdReasoning: [
      `T20 recorded \`${cd.value}\` on the \`${cd.row}\` row with confidence \`${cd.confidence}\`.`,
      "§9 constraint 3: positioning corroborates a direction but never creates one.",
      "§9-O6: a thin read (adjacent-rank film lead, a glycol outranking the film, an unreliable marker) is capped at low and routes to review.",
    ],
    limitations: [
      "§9's ceiling caps a formula-only direction at moderate confidence.",
      "T20 compares ranks on one list only; it states no percentage, ratio or dose (G4).",
    ],
  }
}

function main() {
  const records = (JSON.parse(readFileSync(T20_RECORDS, "utf8")) as { records: T20Record[] })
    .records
  const files = readdirSync(V10_ENVELOPES)
    .filter((file) => file.endsWith(".json"))
    .sort()

  rmSync(OUT_ENVELOPES, { recursive: true, force: true })
  mkdirSync(OUT_ENVELOPES, { recursive: true })

  const projections: Record<string, LeaveInProductionAdapterOutcome> = {}
  for (const file of files) {
    const slot = Number(file.replace(/^slot-|\.json$/g, ""))
    const record = records.find((candidate) => candidate.slot === slot)
    if (!record) throw new Error(`${file}: no T20 record for slot ${slot}`)
    const base = JSON.parse(
      readFileSync(path.join(V10_ENVELOPES, file), "utf8"),
    ) as LeaveInResearchEnvelope

    if (
      !record.care_direction.changed &&
      base.profile.careDirection.value !== record.care_direction.value
    ) {
      throw new Error(
        `${file}: T20 record marks care_direction unchanged but v1.0 has ${base.profile.careDirection.value} vs ${record.care_direction.value}`,
      )
    }
    if (
      record.care_direction.changed &&
      base.profile.careDirection.value === record.care_direction.value
    ) {
      throw new Error(`${file}: T20 record marks care_direction changed but the value is identical`)
    }

    const uncertainFields = [...base.profile.uncertainFields]
    if (
      record.care_direction.confidence === "low" &&
      record.care_direction.routes_to_review &&
      !uncertainFields.includes("care_direction")
    ) {
      uncertainFields.push("care_direction")
    }

    const envelope: LeaveInResearchEnvelope = {
      ...base,
      researchMethod: { ...LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD },
      profile: {
        ...base.profile,
        careDirection: careDirectionEvidence(record),
        uncertainFields,
        assumptionNotes: [
          ...base.profile.assumptionNotes,
          `Standard v1.1 (T20, 2026-09-29): care_direction re-derived in ${RECORDS_RELATIVE}; every other field is carried unchanged from the v1.0 envelope (§16 — only the fields whose rules changed reopen).`,
        ],
      },
    }
    writeFileSync(path.join(OUT_ENVELOPES, file), `${JSON.stringify(envelope, null, 2)}\n`)

    const outcome = projectLeaveInForProduction(envelope)
    if (outcome.status !== "projection_ready") {
      throw new Error(`${file}: projection ${outcome.status} — ${outcome.reasons.join("; ")}`)
    }
    projections[file] = outcome
  }

  writeFileSync(
    OUT_EXPECTED,
    `${JSON.stringify({ adapter_version: LEAVE_IN_PRODUCTION_ADAPTER_VERSION, projections }, null, 2)}\n`,
  )
  process.stdout.write(
    `${JSON.stringify({ envelopes: files.length, outDir: path.relative(ROOT, OUT_ROOT) }, null, 2)}\n`,
  )
}

main()
