import type { ProductIntakeResearchJob } from "@chaarlie/product-intake-core"

export const PRODUCT_REVIEW_GROUPS = ["ready", "decisions", "errors", "processing"] as const
export type ProductReviewGroup = (typeof PRODUCT_REVIEW_GROUPS)[number]
export const PRODUCT_REVIEW_GROUP_LABELS: Record<ProductReviewGroup, string> = {
  ready: "Bereit zur Prüfung",
  decisions: "Entscheidung nötig",
  errors: "Technischer Fehler",
  processing: "Recherche läuft",
}

export type ProductReviewSubmission = {
  id: string
  status: string
  category: string
  brand_text: string | null
  product_name_text: string | null
  created_at: string
  updated_at: string
  researched_payload?: Record<string, unknown> | null
  payload_revision?: number
  payload_sha256?: string
}

export type ProductReviewQueueEntry = ProductReviewSubmission & {
  group: ProductReviewGroup
  job: ProductIntakeResearchJob | null
}

export function latestProductReviewJob(jobs: ProductIntakeResearchJob[]) {
  return (
    [...jobs].sort(
      (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    )[0] ?? null
  )
}

export function productReviewGroup(
  status: string,
  job: ProductIntakeResearchJob | null,
): ProductReviewGroup {
  if (
    job &&
    ["queued", "running", "waiting_for_rework", "publishing", "publish_preflight"].includes(
      job.status,
    )
  )
    return "processing"
  if (job?.status === "failed") return "errors"
  if (status === "ready_for_review" && job?.status === "waiting_for_review") return "ready"
  return "decisions"
}

export function productReviewRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** Navigation only; no remote URL is fetched or embedded by this read-only surface. */
export function productReviewSourceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  try {
    const url = new URL(value)
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}

export function productReviewValues(
  value: unknown,
  prefix = "final",
): { path: string; value: string }[] {
  const object = productReviewRecord(value)
  if (!object || Object.keys(object).length === 0 || prefix.split(".").length > 12)
    return [{ path: prefix, value: JSON.stringify(value) ?? "—" }]
  return Object.entries(object).flatMap(([key, item]) =>
    productReviewValues(item, `${prefix}.${key}`),
  )
}
