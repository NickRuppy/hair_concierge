import { pathToFileURL } from "node:url"

import { createSupabaseClientFromEnv, flag, flagBool, flagInt, hashUserId, parseArgs } from "./cli"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  matchesQueueFilters,
  queueResultLimit,
  renderQueueOutput,
  type ProductIntakeQueueRow,
} from "./queue-reporting"

const REVIEW_LANE_STATUSES = ["researching", "ready_for_review", "needs_more_info"] as const
const QUEUE_SELECT = [
  "id",
  "created_at",
  "updated_at",
  "user_id",
  "source",
  "category",
  "brand_text",
  "product_name_text",
  "front_image_path",
  "barcode_image_path",
  "status",
  "reviewed_at",
  "approved_product_id",
  "notification_sent_at",
  "cleanup_after",
  "photos_deleted_at",
  "researched_payload",
].join(", ")
const QUEUE_EXPORT_PAGE_SIZE = 1000

async function main() {
  const args = parseArgs()
  const supabase = createSupabaseClientFromEnv()
  const limit = flagInt(args, "limit", 50)
  const limitExplicit = args.flags.has("limit")
  const statusFilter = flag(args, "status")
  const categoryFilter = flag(args, "category")
  const sourceFilter = flag(args, "source")
  const format = flag(args, "format") ?? "table"
  const compact = flagBool(args, "compact")
  const report = flagBool(args, "report")
  const includeClosed = flagBool(args, "include-closed")
  const minAgeDays = optionalPositiveInt(args, "min-age-days")
  const maxAgeDays = optionalPositiveInt(args, "max-age-days")
  const now = new Date()

  if (report && limitExplicit) {
    throw new Error(
      "--report cannot be combined with --limit because report counts must be complete",
    )
  }

  const resultLimit = queueResultLimit({ report, format, limit, limitExplicit })
  const rows = await loadQueueRows({
    supabase,
    statusFilter,
    categoryFilter,
    sourceFilter,
    includeClosed,
    minAgeDays,
    maxAgeDays,
    resultLimit,
    now,
  })
  const output = renderQueueOutput({ rows, now, hashUserId, report, format, compact })
  if (output.kind === "json") {
    console.log(JSON.stringify(output.value, null, 2))
  } else if (output.kind === "csv" || output.kind === "empty_text") {
    console.log(output.value)
  } else {
    console.table(output.value)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}

export async function loadQueueRows(params: {
  supabase: SupabaseClient
  statusFilter: string | null
  categoryFilter: string | null
  sourceFilter: string | null
  includeClosed: boolean
  minAgeDays: number | null
  maxAgeDays: number | null
  resultLimit: number | null
  now: Date
}): Promise<ProductIntakeQueueRow[]> {
  const rows: ProductIntakeQueueRow[] = []
  for (let offset = 0; ; ) {
    const remaining =
      params.resultLimit === null ? QUEUE_EXPORT_PAGE_SIZE : params.resultLimit - rows.length
    if (remaining <= 0) break

    const pageSize = Math.min(QUEUE_EXPORT_PAGE_SIZE, remaining)
    const { data, error } = await buildQueueQuery(params).range(offset, offset + pageSize - 1)
    if (error) throw new Error(`load product intake queue: ${error.message}`)

    const page = (data ?? []) as unknown as ProductIntakeQueueRow[]
    rows.push(...page)
    offset += pageSize
    if (page.length < pageSize) break
  }

  return filterLoadedRows(rows, params)
}

function buildQueueQuery(params: {
  supabase: SupabaseClient
  statusFilter: string | null
  categoryFilter: string | null
  sourceFilter: string | null
  includeClosed: boolean
  minAgeDays: number | null
  maxAgeDays: number | null
  now: Date
}) {
  let query = params.supabase
    .from("product_submissions")
    .select(QUEUE_SELECT)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })

  if (params.statusFilter) {
    query = query.eq("status", params.statusFilter)
  } else if (!params.includeClosed) {
    query = query.in("status", [...REVIEW_LANE_STATUSES])
  }
  if (params.categoryFilter) {
    query = query.eq("category", params.categoryFilter)
  }
  if (params.sourceFilter) {
    query = query.eq("source", params.sourceFilter)
  }
  if (params.minAgeDays !== null) {
    query = query.lte("created_at", ageCutoffIso(params.now, params.minAgeDays))
  }
  if (params.maxAgeDays !== null) {
    query = query.gte("created_at", ageCutoffIso(params.now, params.maxAgeDays + 1))
  }

  return query
}

function filterLoadedRows(
  data: ProductIntakeQueueRow[] | null,
  filters: {
    minAgeDays: number | null
    maxAgeDays: number | null
    now: Date
  },
): ProductIntakeQueueRow[] {
  return ((data ?? []) as ProductIntakeQueueRow[]).filter((row) =>
    matchesQueueFilters(
      row,
      {
        minAgeDays: filters.minAgeDays,
        maxAgeDays: filters.maxAgeDays,
      },
      filters.now,
    ),
  )
}

function optionalPositiveInt(args: ReturnType<typeof parseArgs>, name: string): number | null {
  const raw = flag(args, name)
  if (!raw) return null
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 0 || String(parsed) !== raw.trim()) {
    throw new Error(`--${name} must be a non-negative integer`)
  }
  return parsed
}

function ageCutoffIso(now: Date, days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}
