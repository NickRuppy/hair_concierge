import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  PRODUCT_INTAKE_OPEN_SUBMISSION_STATUSES,
  type ProductIntakeResearchArtifact,
  type ProductIntakeResearchJob,
  type ProductIntakeReviewDecisionRow,
} from "@chaarlie/product-intake-core"
import {
  latestProductReviewJob,
  productReviewGroup,
  type ProductReviewQueueEntry,
  type ProductReviewSubmission,
} from "./admin-review-model"

export type ProductReviewReadClient = Pick<SupabaseClient, "from">
export type ProductReviewDetail = {
  submission: ProductReviewSubmission
  job: ProductIntakeResearchJob | null
  artifacts: ProductIntakeResearchArtifact[]
  decisions: ProductIntakeReviewDecisionRow[]
}

// Keyset pagination avoids offset shifts when an earlier submission closes.
// Fail rather than silently present a DB row limit as a complete queue.
async function allRows<T extends { id: string }>(
  client: ProductReviewReadClient,
  table: string,
  configure: (
    query: ReturnType<ReturnType<ProductReviewReadClient["from"]>["select"]>,
  ) => ReturnType<ReturnType<ProductReviewReadClient["from"]>["select"]>,
  columns = "*",
): Promise<T[]> {
  const rows: T[] = []
  let cursor: string | null = null
  for (let page = 0; page < 100; page++) {
    let query = configure(client.from(table).select(columns))
      .order("id", { ascending: true })
      .limit(200)
    if (cursor) query = query.gt("id", cursor)
    const { data, error } = await query
    if (error) throw error
    const batch = (data ?? []) as T[]
    rows.push(...batch)
    if (batch.length < 200) return rows
    const next = String(batch.at(-1)!.id)
    if (next === cursor) throw new Error("product_review_pagination_stalled")
    cursor = next
  }
  throw new Error("product_review_read_limit_exceeded")
}

export async function loadAdminProductReviewQueue(
  client: ProductReviewReadClient,
): Promise<ProductReviewQueueEntry[]> {
  const submissions = await allRows<ProductReviewSubmission>(
    client,
    "product_submissions",
    (query) => query.in("status", [...PRODUCT_INTAKE_OPEN_SUBMISSION_STATUSES]),
    "id,status,category,brand_text,product_name_text,created_at,updated_at",
  )
  const jobs: ProductIntakeResearchJob[] = []
  for (let offset = 0; offset < submissions.length; offset += 100) {
    const ids = submissions.slice(offset, offset + 100).map((row) => row.id)
    jobs.push(
      ...(await allRows<ProductIntakeResearchJob>(client, "product_intake_research_jobs", (query) =>
        query.in("submission_id", ids),
      )),
    )
  }
  const jobsBySubmission = new Map<string, ProductIntakeResearchJob[]>()
  for (const job of jobs) {
    const bucket = jobsBySubmission.get(job.submission_id) ?? []
    bucket.push(job)
    jobsBySubmission.set(job.submission_id, bucket)
  }
  return submissions
    .map((submission) => {
      const job = latestProductReviewJob(jobsBySubmission.get(submission.id) ?? [])
      return { ...submission, job, group: productReviewGroup(submission.status, job) }
    })
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}

export async function loadAdminProductReviewDetail(
  client: ProductReviewReadClient,
  id: string,
): Promise<ProductReviewDetail | null> {
  const { data, error } = await client
    .from("product_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const [jobs, artifacts, decisions] = await Promise.all([
    allRows<ProductIntakeResearchJob>(client, "product_intake_research_jobs", (query) =>
      query.eq("submission_id", id),
    ),
    allRows<ProductIntakeResearchArtifact>(client, "product_intake_research_artifacts", (query) =>
      query.eq("submission_id", id),
    ),
    allRows<ProductIntakeReviewDecisionRow>(client, "product_intake_review_decisions", (query) =>
      query.eq("submission_id", id),
    ),
  ])
  // Explicit allow-list: never serialize the submission's user/conversation IDs.
  const submission: ProductReviewSubmission = {
    id: data.id,
    status: data.status,
    category: data.category,
    brand_text: data.brand_text,
    product_name_text: data.product_name_text,
    created_at: data.created_at,
    updated_at: data.updated_at,
    researched_payload: data.researched_payload,
    ...(typeof data.payload_revision === "number"
      ? { payload_revision: data.payload_revision }
      : {}),
  }
  return {
    submission,
    job: latestProductReviewJob(jobs),
    artifacts: artifacts.sort(
      (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    ),
    decisions: decisions.sort(
      (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    ),
  }
}
