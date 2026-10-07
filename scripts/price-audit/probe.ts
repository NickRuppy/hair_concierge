import { config as loadEnv } from "dotenv"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { createDmMcpClient } from "../../src/lib/scan/enrichment/dm-mcp-client"
import {
  adapterHostFor,
  hasAdapter,
  observeCandidate,
  PROBE_DIR,
  type ProbeRecord,
} from "../../src/lib/price-audit/adapters"
import { evaluateProbeSamples, type ProbeSample } from "../../src/lib/price-audit/run-support"
import { orderAuditCandidates } from "../../src/lib/price-audit/select"
import { fetchCandidates } from "./run"
import { createClient } from "@supabase/supabase-js"

/**
 * Live per-host probe (plans/price-audit-lane.md T5). Samples up to
 * `--samples` (default 5) catalog products of `--host`, runs the real adapter
 * observation, prints observed vs stored values, and writes
 * `data/price-audit/probes/<host>.json`.
 *
 * The written record NEVER enables auto-writes by itself: `reviewedBy` stays
 * null until Nick has compared the printed samples with the live retailer
 * pages and re-runs with `--reviewed-by nick`. `enabledForAutoWrite` is true
 * only when every sample confirmed identity and read a price.
 */

const SAMPLE_DELAY_MS = 2_000

type CliOptions = { host: string; samples: number; reviewedBy: string | null }

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { host: "", samples: 5, reviewedBy: null }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === "--host") options.host = argv[++index] ?? ""
    else if (arg === "--samples") options.samples = Number.parseInt(argv[++index] ?? "", 10) || 5
    else if (arg === "--reviewed-by") options.reviewedBy = argv[++index] ?? null
    else throw new Error(`Unknown argument: ${arg}`)
  }
  if (!options.host)
    throw new Error("Usage: probe.ts --host <host> [--samples N] [--reviewed-by name]")
  if (!hasAdapter(options.host)) throw new Error(`No adapter for host ${options.host}`)
  return options
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  loadEnv({ path: ".env.local" })
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const dmClient = createDmMcpClient({ deadlineMs: 20_000 })

  const candidates = orderAuditCandidates(await fetchCandidates(supabase))
    .filter((candidate) => adapterHostFor(candidate) === options.host)
    .slice(0, options.samples)
  if (candidates.length === 0) throw new Error(`No active products with host ${options.host}`)

  const samples: ProbeSample[] = []
  for (const candidate of candidates) {
    const { observation } = await observeCandidate(candidate, {
      dmSearch: (query) => dmClient.searchProducts(query),
    })
    samples.push({ productId: candidate.id, storedPriceEur: candidate.priceEur, observation })
    console.log(
      JSON.stringify(
        {
          product: candidate.name,
          stored: { priceEur: candidate.priceEur, link: candidate.affiliateLink },
          observation,
        },
        null,
        2,
      ),
    )
    await delay(SAMPLE_DELAY_MS)
  }

  const record: ProbeRecord = {
    host: options.host,
    probedAt: new Date().toISOString(),
    enabledForAutoWrite: evaluateProbeSamples(samples),
    reviewedBy: options.reviewedBy,
    reviewedAt: options.reviewedBy ? new Date().toISOString() : null,
    samples,
  }
  mkdirSync(PROBE_DIR, { recursive: true })
  const path = join(PROBE_DIR, `${options.host}.json`)
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, "utf-8")
  console.log(
    `Wrote ${path}: enabledForAutoWrite=${record.enabledForAutoWrite}, reviewedBy=${record.reviewedBy ?? "NOT REVIEWED — auto-writes stay off"}`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
