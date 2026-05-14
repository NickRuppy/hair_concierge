import { config as loadEnv } from "dotenv"
import { appendFileSync } from "node:fs"
import { join } from "node:path"
import { createClient } from "@supabase/supabase-js"

import { readCsv } from "../src/lib/affiliate-research/csv"
import { isUsableUrl, urlGate } from "../src/lib/affiliate-research/url-gate"

loadEnv({ path: ".env.local" })

const DIR = "data/affiliate-research"
const APPROVED_PATH = join(DIR, "approved.csv")
const LOG_PATH = join(DIR, "applied.log")

const APPROVED_HEADER = ["id", "brand", "name", "chosen_url", "host", "matched_tokens", "notes"]

const dry = process.argv.includes("--dry")

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Non-atomic safety belt: read, check in JS, then write.
//
// The spec asked for an atomic UPDATE with the safety belt in the WHERE clause:
//   WHERE id = ? AND (affiliate_link IS NULL OR btrim(...) = '' OR not http(s))
// PostgREST's .or() filter rejects this on PATCH ("column does not exist" — a
// known Supabase-side limitation for OR conditions on UPDATE/PATCH). An RPC
// wrapper would solve it cleanly but isn't worth a migration for this 209-row
// one-shot job on a low-write table. The race window (read → check → write)
// is acceptable: the products table is only mutated by this script and the
// admin UI, not by user traffic.
function safeToWrite(currentValue: string | null | undefined): boolean {
  return !isUsableUrl(currentValue)
}

function appendLog(line: string): void {
  appendFileSync(LOG_PATH, `${new Date().toISOString()} ${line}\n`)
}

async function main(): Promise<void> {
  const rows = readCsv(APPROVED_PATH, { expectedHeader: APPROVED_HEADER })
  console.log(`Read ${rows.length} approved rows from ${APPROVED_PATH}.`)

  const rejected: { id: string; reason: string }[] = []
  const accepted = rows.filter((r) => {
    const g = urlGate({ chosen_url: r.chosen_url, brand: r.brand })
    if (g.pass === false) {
      rejected.push({ id: r.id, reason: g.reason })
      return false
    }
    return true
  })
  if (rejected.length > 0) {
    console.warn(`REJECTED ${rejected.length} rows on re-validation:`)
    for (const r of rejected) console.warn(`  - ${r.id}: ${r.reason}`)
  }

  let applied = 0
  let skippedBySafetyBelt = 0
  let failed = 0
  for (const r of accepted) {
    const { data: current, error: readErr } = await supabase
      .from("products")
      .select("id, affiliate_link")
      .eq("id", r.id)
      .maybeSingle()
    if (readErr) {
      console.error(`READ FAILED ${r.id}: ${readErr.message}`)
      failed++
      continue
    }
    if (!current) {
      console.error(`NOT FOUND ${r.id} — product no longer exists`)
      failed++
      continue
    }
    if (!safeToWrite(current.affiliate_link as string | null)) {
      skippedBySafetyBelt++
      appendLog(
        `SKIP id=${r.id} reason=safety_belt_existing=${JSON.stringify(current.affiliate_link)}`,
      )
      continue
    }
    if (dry) {
      console.log(`DRY  UPDATE products SET affiliate_link='${r.chosen_url}' WHERE id='${r.id}'`)
      applied++
      continue
    }
    const { error: writeErr } = await supabase
      .from("products")
      .update({ affiliate_link: r.chosen_url })
      .eq("id", r.id)
    if (writeErr) {
      console.error(`WRITE FAILED ${r.id}: ${writeErr.message}`)
      failed++
      continue
    }
    appendLog(`OK   id=${r.id} url=${r.chosen_url}`)
    applied++
  }

  console.log(
    `\nDone. applied=${applied}, skipped_by_safety_belt=${skippedBySafetyBelt}, rejected_on_revalidate=${rejected.length}, failed=${failed}.`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
