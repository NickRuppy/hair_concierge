import { readdirSync } from "node:fs"
import { join } from "node:path"

import { readCsv, writeCsv, type CsvRow } from "../src/lib/affiliate-research/csv"
import {
  dedupeByConfidence,
  classifyForOutput,
  type ResultRow,
} from "../src/lib/affiliate-research/aggregate"
import { INPUT_HEADER, OUTPUT_HEADER } from "../src/lib/affiliate-research/slice-validator"

const DIR = "data/affiliate-research"
const RESULTS_GLOB = /^results-[a-z0-9-]+\.csv$/

const APPROVED_HEADER = [
  "id",
  "brand",
  "name",
  "chosen_url",
  "host",
  "matched_tokens",
  "notes",
] as const
const REVIEW_HEADER = [
  "id",
  "brand",
  "name",
  "chosen_url",
  "host",
  "confidence",
  "matched_tokens",
  "notes",
  "review_reason",
] as const

function toResultRow(r: CsvRow): ResultRow {
  return {
    id: r.id,
    brand: r.brand,
    name: r.name,
    chosen_url: r.chosen_url,
    host: r.host,
    confidence: r.confidence,
    matched_tokens: r.matched_tokens,
    notes: r.notes,
  }
}

function loadCategoryByIdFromMissing(): Map<string, string> {
  const path = join(DIR, "missing.csv")
  const rows = readCsv(path, { expectedHeader: [...INPUT_HEADER] })
  const map = new Map<string, string>()
  for (const r of rows) map.set(r.id, r.category)
  return map
}

function main(): void {
  const files = readdirSync(DIR).filter((f) => RESULTS_GLOB.test(f))
  if (files.length === 0) {
    console.error(`No results-*.csv found in ${DIR}. Did the subagents run?`)
    process.exit(2)
  }

  const categoryById = loadCategoryByIdFromMissing()

  const all: ResultRow[] = []
  for (const f of files) {
    const rows = readCsv(join(DIR, f), { expectedHeader: [...OUTPUT_HEADER] })
    for (const r of rows) all.push(toResultRow(r))
    console.log(`Loaded ${rows.length} rows from ${f}`)
  }

  const seenIds = new Set(all.map((r) => r.id))
  const missingIds = new Set(categoryById.keys())
  const notSeen = [...missingIds].filter((id) => !seenIds.has(id))
  const extras = [...seenIds].filter((id) => !missingIds.has(id))
  if (notSeen.length > 0 || extras.length > 0) {
    console.error(`ID accounting failed:`)
    if (notSeen.length > 0)
      console.error(
        `  ${notSeen.length} ids in missing.csv but not in any results-*.csv: ${notSeen.slice(0, 10).join(", ")}${notSeen.length > 10 ? ", ..." : ""}`,
      )
    if (extras.length > 0)
      console.error(
        `  ${extras.length} ids in results-*.csv but not in missing.csv: ${extras.slice(0, 10).join(", ")}${extras.length > 10 ? ", ..." : ""}`,
      )
    console.error("Aggregator refuses to proceed. Rerun the missing slices.")
    process.exit(1)
  }

  const deduped = dedupeByConfidence(all)
  console.log(`Deduped ${all.length} → ${deduped.length} unique ids.`)

  const approved: CsvRow[] = []
  const review: CsvRow[] = []
  for (const r of deduped) {
    const cls = classifyForOutput(r)
    if (cls.bucket === "approved") {
      approved.push({
        id: r.id,
        brand: r.brand,
        name: r.name,
        chosen_url: r.chosen_url,
        host: r.host,
        matched_tokens: r.matched_tokens,
        notes: r.notes,
      })
    } else {
      review.push({
        id: r.id,
        brand: r.brand,
        name: r.name,
        chosen_url: r.chosen_url,
        host: r.host,
        confidence: r.confidence,
        matched_tokens: r.matched_tokens,
        notes: r.notes,
        review_reason: cls.reason,
      })
    }
  }

  writeCsv(
    join(DIR, "results.csv"),
    [...OUTPUT_HEADER],
    deduped.map((r) => ({
      id: r.id,
      brand: r.brand,
      name: r.name,
      chosen_url: r.chosen_url,
      host: r.host,
      confidence: r.confidence,
      matched_tokens: r.matched_tokens,
      notes: r.notes,
    })),
  )
  writeCsv(join(DIR, "approved.csv"), [...APPROVED_HEADER], approved)
  writeCsv(join(DIR, "review-queue.csv"), [...REVIEW_HEADER], review)

  // Category × confidence summary (joined via missing.csv)
  type Tallies = { high: number; medium: number; none: number; approved: number; review: number }
  const summary = new Map<string, Tallies>()
  for (const r of deduped) {
    const cat = categoryById.get(r.id) ?? "(unknown)"
    const slot: Tallies = summary.get(cat) ?? {
      high: 0,
      medium: 0,
      none: 0,
      approved: 0,
      review: 0,
    }
    if (r.confidence === "high") slot.high++
    else if (r.confidence === "medium") slot.medium++
    else slot.none++
    summary.set(cat, slot)
  }
  for (const row of approved) {
    const cat = categoryById.get(row.id) ?? "(unknown)"
    const slot = summary.get(cat)
    if (slot) slot.approved++
  }
  for (const row of review) {
    const cat = categoryById.get(row.id) ?? "(unknown)"
    const slot = summary.get(cat)
    if (slot) slot.review++
  }

  console.log("\n=== Summary ===")
  console.log(`Total unique ids: ${deduped.length}`)
  console.log(`Approved:         ${approved.length}`)
  console.log(`Review queue:     ${review.length}`)
  console.log("\ncategory                 | high | medium | none | approved | review")
  for (const [cat, t] of [...summary.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(
      `${cat.padEnd(24)} | ${String(t.high).padStart(4)} | ${String(t.medium).padStart(6)} | ${String(t.none).padStart(4)} | ${String(t.approved).padStart(8)} | ${String(t.review).padStart(6)}`,
    )
  }
}

main()
