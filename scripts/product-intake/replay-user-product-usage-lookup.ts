import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"

import { createSupabaseProductIntakeRepository } from "@/lib/product-intake/repository"
import {
  lookupProductCandidate,
  type ProductLookupInput,
  type ProductLookupStatus,
} from "@/lib/product-intake/product-lookup"

import { createSupabaseClientFromEnv, flagInt, parseArgs } from "./cli"

const USAGE_SELECT_COLUMNS = [
  "category",
  "product_name",
  "brand_text",
  "frequency_range",
  "match_status",
  "product_id",
].join(",")
const PAGE_SIZE = 1000
const DEFAULT_LIMIT = 500
const DEFAULT_EXAMPLES_PER_STATUS = 10

export type UserProductUsageReplayRow = {
  category: string | null
  product_name: string | null
  brand_text: string | null
  frequency_range: string | null
  match_status: string | null
  product_id: string | null
}

export type ReplayLookupMapping =
  | {
      status: "mapped"
      input: Pick<ProductLookupInput, "category" | "product_name_text" | "brand_text">
    }
  | {
      status: "skipped_missing_product_name"
      input: null
    }

export type ReplayLookupExample = {
  category: string | null
  product_name: string | null
  brand_text: string | null
  frequency_range: string | null
  match_status: string | null
  lookup_status: string
  candidate_count: number
  product_id_present_before_replay: boolean
}

export type ReplayLookupReport = {
  generated_at: string
  total_rows: number
  tested_rows: number
  skipped_missing_product_name: number
  status_counts: Record<ProductLookupStatus | "skipped_missing_product_name", number>
  category_counts: Record<string, number>
  examples_by_status: Record<string, ReplayLookupExample[]>
}

export function mapUsageRowToReplayLookup(row: UserProductUsageReplayRow): ReplayLookupMapping {
  const productName = trimToNull(row.product_name)
  if (!productName) {
    return {
      status: "skipped_missing_product_name",
      input: null,
    }
  }

  return {
    status: "mapped",
    input: {
      category: row.category,
      product_name_text: productName,
      brand_text: trimToNull(row.brand_text),
    },
  }
}

export function projectReplayExample(params: {
  row: UserProductUsageReplayRow
  lookupStatus: string
  candidateCount: number
}): ReplayLookupExample {
  return {
    category: params.row.category,
    product_name: params.row.product_name,
    brand_text: params.row.brand_text,
    frequency_range: params.row.frequency_range,
    match_status: params.row.match_status,
    lookup_status: params.lookupStatus,
    candidate_count: params.candidateCount,
    product_id_present_before_replay: Boolean(params.row.product_id),
  }
}

export function buildEmptyReplayReport(generatedAt = new Date().toISOString()): ReplayLookupReport {
  return {
    generated_at: generatedAt,
    total_rows: 0,
    tested_rows: 0,
    skipped_missing_product_name: 0,
    status_counts: {
      found_exact: 0,
      found_linkable_existing: 0,
      ambiguous: 0,
      needs_variant_selection: 0,
      category_mismatch: 0,
      not_found: 0,
      insufficient_identity: 0,
      unsupported_category: 0,
      skipped_missing_product_name: 0,
    },
    category_counts: {},
    examples_by_status: {},
  }
}

async function main() {
  const args = parseArgs()
  const supabase = createSupabaseClientFromEnv()
  const limit = flagInt(args, "limit", DEFAULT_LIMIT)
  const examplesPerStatus = flagInt(args, "examples-per-status", DEFAULT_EXAMPLES_PER_STATUS)
  const rows = await fetchUsageRows({ supabase, limit })
  const repository = createSupabaseProductIntakeRepository(supabase)
  const [catalog, brandCatalog] = await Promise.all([
    repository.loadCatalog({ eligibilityMode: "intake_dedupe" }),
    repository.loadBrandResolutionCatalog(),
  ])
  const report = buildEmptyReplayReport()
  report.total_rows = rows.length

  for (const row of rows) {
    const mapping = mapUsageRowToReplayLookup(row)
    incrementCount(report.category_counts, row.category ?? "unknown")

    if (mapping.status === "skipped_missing_product_name") {
      report.skipped_missing_product_name += 1
      report.status_counts.skipped_missing_product_name += 1
      pushExample(
        report,
        mapping.status,
        projectReplayExample({
          row,
          lookupStatus: mapping.status,
          candidateCount: 0,
        }),
        examplesPerStatus,
      )
      continue
    }

    report.tested_rows += 1
    const result = lookupProductCandidate({
      input: mapping.input,
      catalog,
      brandCatalog,
      offerId: `replay-${report.tested_rows}`,
      eligibilityMode: "intake_dedupe",
    })

    report.status_counts[result.status] += 1
    pushExample(
      report,
      result.status,
      projectReplayExample({
        row,
        lookupStatus: result.status,
        candidateCount: result.candidates.length,
      }),
      examplesPerStatus,
    )
  }

  const reportPath = writeReplayReport(report)
  console.log("Product usage lookup replay status counts:")
  console.table(report.status_counts)
  console.log(`Replay report written to ${reportPath}`)
}

async function fetchUsageRows(params: {
  supabase: SupabaseClient
  limit: number
}): Promise<UserProductUsageReplayRow[]> {
  const rows: UserProductUsageReplayRow[] = []

  for (let offset = 0; rows.length < params.limit; ) {
    const remaining = params.limit - rows.length
    const pageSize = Math.min(PAGE_SIZE, remaining)
    const { data, error } = await params.supabase
      .from("user_product_usage")
      .select(USAGE_SELECT_COLUMNS)
      .order("category", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw new Error(
        [
          "Failed to replay user_product_usage lookup.",
          "This query intentionally selects only anonymized product fields, never user ids.",
          `Original error: ${error.message}`,
        ].join(" "),
      )
    }

    const page = ((data ?? []) as unknown as Array<Record<string, unknown>>).map(projectUsageRow)
    rows.push(...page)
    if (page.length < pageSize) break
    offset += pageSize
  }

  return rows
}

function projectUsageRow(row: Record<string, unknown>): UserProductUsageReplayRow {
  return {
    category: nullableString(row.category),
    product_name: nullableString(row.product_name),
    brand_text: nullableString(row.brand_text),
    frequency_range: nullableString(row.frequency_range),
    match_status: nullableString(row.match_status),
    product_id: nullableString(row.product_id),
  }
}

function writeReplayReport(report: ReplayLookupReport): string {
  const stamp = report.generated_at.replace(/[:.]/g, "-")
  const outPath = `tmp/product-lookup-replay-${stamp}.json`
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(join(process.cwd(), outPath), `${JSON.stringify(report, null, 2)}\n`, "utf-8")
  return outPath
}

function pushExample(
  report: ReplayLookupReport,
  status: string,
  example: ReplayLookupExample,
  examplesPerStatus: number,
) {
  report.examples_by_status[status] ??= []
  if (report.examples_by_status[status].length < examplesPerStatus) {
    report.examples_by_status[status].push(example)
  }
}

function incrementCount(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1
}

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  return trimmed || null
}

function nullableString(value: unknown): string | null {
  if (typeof value !== "string") return null
  return value
}

function isDirectExecution(): boolean {
  const scriptPath = process.argv[1] ?? ""
  return (
    scriptPath.endsWith("replay-user-product-usage-lookup.ts") ||
    scriptPath.endsWith("replay-user-product-usage-lookup.js")
  )
}

if (isDirectExecution()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
