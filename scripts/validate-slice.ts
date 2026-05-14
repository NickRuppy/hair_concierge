import { appendFileSync, existsSync } from "node:fs"
import { join } from "node:path"

import { validateSlice } from "../src/lib/affiliate-research/slice-validator"

function usage(): never {
  console.error(
    "Usage: tsx scripts/validate-slice.ts <slug>\n" +
      "  Reads data/affiliate-research/missing-<slug>.csv and results-<slug>.csv.\n" +
      "  Appends one line to data/affiliate-research/validation.log.\n" +
      "  Exits 0 on success, 1 on validation failure, 2 on missing files.",
  )
  process.exit(2)
}

const slug = process.argv[2]
if (!slug) usage()
if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error(`Invalid slug '${slug}' — must match [a-z0-9-]+`)
  process.exit(2)
}

const DIR = "data/affiliate-research"
const inputPath = join(DIR, `missing-${slug}.csv`)
const outputPath = join(DIR, `results-${slug}.csv`)
const logPath = join(DIR, "validation.log")

if (!existsSync(inputPath)) {
  console.error(`Missing input file: ${inputPath}`)
  process.exit(2)
}
if (!existsSync(outputPath)) {
  console.error(`Missing output file: ${outputPath} — subagent has not produced results yet.`)
  process.exit(2)
}

const res = validateSlice({ inputPath, outputPath })
const timestamp = new Date().toISOString()
const summary = `${timestamp} slice=${slug} ok=${res.ok} rows=${res.rowCount} missing=${res.missing.length} duplicated=${res.duplicated.length}`
appendFileSync(logPath, summary + "\n")
console.log(summary)
if (!res.ok) {
  for (const err of res.errors) console.error("  - " + err)
  process.exit(1)
}
process.exit(0)
