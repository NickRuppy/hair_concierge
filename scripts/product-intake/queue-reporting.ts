type QueueSubmissionStatus =
  | "pending_review"
  | "researching"
  | "ready_for_review"
  | "needs_more_info"
  | "matched_existing"
  | "approved"
  | "rejected"
  | "cancelled_by_user"
  | string

export type ProductIntakeQueueRow = {
  id: string
  created_at: string
  updated_at?: string | null
  user_id: string
  source: string
  category: string
  brand_text: string | null
  product_name_text: string | null
  front_image_path: string | null
  barcode_image_path: string | null
  status: QueueSubmissionStatus
  reviewed_at?: string | null
  approved_product_id?: string | null
  notification_sent_at?: string | null
  cleanup_after?: string | null
  photos_deleted_at?: string | null
  researched_payload?: Record<string, unknown> | null
}

export type QueueFilters = {
  minAgeDays?: number | null
  maxAgeDays?: number | null
}

export type QueueProjectedRow = {
  id: string
  age_days: number
  created_at: string
  updated_at: string
  user: string
  source: string
  category: string
  brand: string
  name: string
  front_image: string
  barcode_image: string
  status: string
  research_state: string
  notification_status: string
  approval_outcome: string
  photo_retention: string
}

export function queueResultLimit(params: {
  report: boolean
  format: string
  limit: number
  limitExplicit: boolean
}): number | null {
  if (params.report) {
    return null
  }
  if ((params.format === "json" || params.format === "csv") && !params.limitExplicit) return null
  return params.limit
}

const CLOSED_NOTIFICATION_STATUSES = new Set([
  "approved",
  "matched_existing",
  "needs_more_info",
  "rejected",
])
const CLOSED_OUTCOME_STATUSES = new Set([
  "approved",
  "matched_existing",
  "needs_more_info",
  "rejected",
  "cancelled_by_user",
])

export function ageDays(createdAt: string, now: Date): number {
  const created = new Date(createdAt)
  const ageMs = now.getTime() - created.getTime()
  if (!Number.isFinite(ageMs) || ageMs <= 0) return 0
  return Math.floor(ageMs / (24 * 60 * 60 * 1000))
}

export function notificationStatus(row: ProductIntakeQueueRow): "" | "pending" | "sent" {
  if (!CLOSED_NOTIFICATION_STATUSES.has(row.status)) return ""
  return row.notification_sent_at ? "sent" : "pending"
}

export function approvalOutcome(row: ProductIntakeQueueRow): string {
  return CLOSED_OUTCOME_STATUSES.has(row.status) ? row.status : ""
}

export function researchState(payload: Record<string, unknown> | null | undefined): string {
  if (!payload || Object.keys(payload).length === 0) return "none"
  const hasDraft = Boolean(payload.draft)
  const hasFinal = Boolean(payload.final)
  if (hasDraft && hasFinal) return "draft_and_final"
  if (hasDraft) return "draft_only"
  if (hasFinal) return "final_only"
  return "payload_other"
}

export function photoRetention(row: ProductIntakeQueueRow, now: Date): string {
  if (row.photos_deleted_at) return "photos_deleted"
  if (!row.cleanup_after) return "no_cleanup_date"
  return new Date(row.cleanup_after).getTime() <= now.getTime() ? "cleanup_due" : "pending_cleanup"
}

export function matchesQueueFilters(row: ProductIntakeQueueRow, filters: QueueFilters, now: Date) {
  const age = ageDays(row.created_at, now)
  if (filters.minAgeDays !== null && filters.minAgeDays !== undefined && age < filters.minAgeDays) {
    return false
  }
  if (filters.maxAgeDays !== null && filters.maxAgeDays !== undefined && age > filters.maxAgeDays) {
    return false
  }

  return true
}

export function projectQueueRow(
  row: ProductIntakeQueueRow,
  now: Date,
  hashUserId: (userId: string) => string,
): QueueProjectedRow {
  return {
    id: row.id,
    age_days: ageDays(row.created_at, now),
    created_at: row.created_at,
    updated_at: row.updated_at ?? "",
    user: hashUserId(row.user_id),
    source: row.source,
    category: row.category,
    brand: row.brand_text ?? "",
    name: row.product_name_text ?? "",
    front_image: row.front_image_path ? "yes" : "",
    barcode_image: row.barcode_image_path ? "yes" : "",
    status: row.status,
    research_state: researchState(row.researched_payload),
    notification_status: notificationStatus(row),
    approval_outcome: approvalOutcome(row),
    photo_retention: photoRetention(row, now),
  }
}

export function compactQueueRow(row: QueueProjectedRow) {
  return {
    id: row.id,
    age_days: row.age_days,
    source: row.source,
    category: row.category,
    brand: row.brand,
    name: row.name,
    status: row.status,
    research_state: row.research_state,
    notification_status: row.notification_status,
  }
}

export function buildQueueReport(rows: ProductIntakeQueueRow[], now: Date) {
  return {
    total: rows.length,
    by_status: countBy(rows, (row) => row.status),
    by_age_bucket: countBy(rows, (row) => ageBucket(ageDays(row.created_at, now))),
    by_category: countBy(rows, (row) => row.category),
    by_source: countBy(rows, (row) => row.source),
    by_notification_status: countBy(rows, notificationStatus),
    by_approval_outcome: countBy(rows, approvalOutcome),
    by_research_state: countBy(rows, (row) => researchState(row.researched_payload)),
    by_photo_retention: countBy(rows, (row) => photoRetention(row, now)),
  }
}

export function formatQueueCsv(rows: QueueProjectedRow[]): string {
  const columns: Array<keyof QueueProjectedRow> = [
    "id",
    "age_days",
    "created_at",
    "updated_at",
    "user",
    "source",
    "category",
    "brand",
    "name",
    "front_image",
    "barcode_image",
    "status",
    "research_state",
    "notification_status",
    "approval_outcome",
    "photo_retention",
  ]
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n")
}

export function renderQueueOutput(params: {
  rows: ProductIntakeQueueRow[]
  now: Date
  hashUserId: (userId: string) => string
  report: boolean
  format: string
  compact: boolean
}):
  | { kind: "json"; value: unknown }
  | { kind: "csv"; value: string }
  | { kind: "table"; value: unknown[] }
  | { kind: "empty_text"; value: string } {
  if (params.report) {
    return { kind: "json", value: buildQueueReport(params.rows, params.now) }
  }

  const projected = params.rows.map((row) => projectQueueRow(row, params.now, params.hashUserId))
  if (params.format === "json") {
    return { kind: "json", value: projected }
  }
  if (params.format === "csv") {
    return { kind: "csv", value: formatQueueCsv(projected) }
  }
  if (params.rows.length === 0) {
    return { kind: "empty_text", value: "No product intake submissions found." }
  }

  return { kind: "table", value: params.compact ? projected.map(compactQueueRow) : projected }
}

function ageBucket(age: number): string {
  if (age <= 1) return "0-1d"
  if (age <= 3) return "2-3d"
  if (age <= 7) return "4-7d"
  return "8+d"
}

function countBy<T>(rows: T[], getKey: (row: T) => string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const key = getKey(row) || "none"
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value)
  if (!/[",\n]/.test(raw)) return raw
  return `"${raw.replaceAll('"', '""')}"`
}
