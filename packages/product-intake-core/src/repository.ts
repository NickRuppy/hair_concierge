import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  JsonRecord,
  ProductIntakeJobStatus,
  ProductIntakeJobStage,
  ProductIntakeQueueRow,
  ProductIntakeResearchArtifact,
  ProductIntakeResearchJob,
  ProductIntakeReviewDecision,
  ProductIntakeReviewDecisionRow,
  ProductIntakeSubmissionDetail,
} from "./jobs"
import {
  PRODUCT_INTAKE_NON_TERMINAL_JOB_STATUSES,
  PRODUCT_INTAKE_OPEN_SUBMISSION_STATUSES,
} from "./jobs"

type RpcClient = Pick<SupabaseClient, "rpc" | "from">

export type ClaimResearchJobsParams = {
  workerId: string
  limit?: number
  staleAfter?: string
}

export type UpdateResearchJobParams = {
  jobId: string
  status: ProductIntakeJobStatus
  stage: ProductIntakeJobStage
  progress?: JsonRecord | null
  lastError?: string | null
  expectedLockedBy?: string | null
  expectedLockedAt?: string | null
}

export type AppendResearchArtifactParams = {
  jobId?: string | null
  submissionId: string
  kind: ProductIntakeResearchArtifact["kind"]
  status?: string
  payload: JsonRecord
  confidence?: number | null
  sourceUrls?: string[] | null
  model?: string | null
  promptVersion?: string | null
}

export type SaveReviewDecisionParams = {
  submissionId: string
  jobId?: string | null
  fieldPath: string
  decision: ProductIntakeReviewDecision
  proposedValue?: JsonRecord | null
  reviewerValue?: JsonRecord | null
  comment?: string | null
  reviewedBy?: string
}

export type SaveSubmissionResearchPreviewParams = {
  submissionId: string
  researchedPayload: JsonRecord
  status?: "researching" | "ready_for_review" | "needs_more_info"
}

export type PublishPreflightResult = {
  submission_id: string
  ok: boolean
  blockers: string[]
  unresolved_decisions: number
  latest_image_decision: ProductIntakeReviewDecision | null
  latest_publish_decision: ProductIntakeReviewDecision | null
  proposed_product: JsonRecord | null
  publish_requires_confirm: true
  publish_route_enabled: boolean
  next_action: string
}

export async function enqueueResearchJob(
  client: RpcClient,
  submissionId: string,
  requestedStage: ProductIntakeJobStage = "identity",
): Promise<ProductIntakeResearchJob> {
  const { data, error } = await client.rpc("product_intake_enqueue_research_job", {
    target_submission_id: submissionId,
    requested_stage: requestedStage,
  })

  if (error) throw error
  return data as ProductIntakeResearchJob
}

export async function claimResearchJobs(
  client: RpcClient,
  params: ClaimResearchJobsParams,
): Promise<ProductIntakeResearchJob[]> {
  const { data, error } = await client.rpc("product_intake_claim_research_jobs", {
    worker_id: params.workerId,
    claim_limit: params.limit ?? 2,
    stale_after: params.staleAfter ?? "00:10:00",
  })

  if (error) throw error
  return (data ?? []) as ProductIntakeResearchJob[]
}

export async function updateResearchJob(
  client: RpcClient,
  params: UpdateResearchJobParams,
): Promise<ProductIntakeResearchJob> {
  const { data, error } = await client.rpc("product_intake_update_research_job", {
    target_job_id: params.jobId,
    next_status: params.status,
    next_stage: params.stage,
    next_progress: params.progress ?? null,
    next_last_error: params.lastError ?? null,
    expected_locked_by: params.expectedLockedBy ?? null,
    expected_locked_at: params.expectedLockedAt ?? null,
  })

  if (error) throw error
  return data as ProductIntakeResearchJob
}

export async function retryResearchJob(
  client: RpcClient,
  jobId: string,
  progress?: JsonRecord | null,
): Promise<ProductIntakeResearchJob> {
  const { data, error } = await client.rpc("product_intake_retry_research_job", {
    target_job_id: jobId,
    retry_progress: progress ?? null,
  })

  if (error) throw error
  return data as ProductIntakeResearchJob
}

export async function requestReworkJob(
  client: RpcClient,
  submissionId: string,
  progress?: JsonRecord | null,
): Promise<ProductIntakeResearchJob> {
  const { data, error } = await client.rpc("product_intake_request_rework_job", {
    target_submission_id: submissionId,
    rework_progress: progress ?? null,
  })

  if (error) throw error
  return data as ProductIntakeResearchJob
}

export async function appendResearchArtifact(
  client: RpcClient,
  params: AppendResearchArtifactParams,
): Promise<ProductIntakeResearchArtifact> {
  const { data, error } = await client
    .from("product_intake_research_artifacts")
    .insert({
      job_id: params.jobId ?? null,
      submission_id: params.submissionId,
      kind: params.kind,
      status: params.status ?? "proposed",
      payload: params.payload,
      confidence: params.confidence ?? null,
      source_urls: params.sourceUrls ?? null,
      model: params.model ?? null,
      prompt_version: params.promptVersion ?? null,
    })
    .select("*")
    .single()

  if (error) throw error
  return data as ProductIntakeResearchArtifact
}

export async function saveReviewDecision(
  client: RpcClient,
  params: SaveReviewDecisionParams,
): Promise<ProductIntakeReviewDecisionRow> {
  const { data, error } = await client
    .from("product_intake_review_decisions")
    .insert({
      submission_id: params.submissionId,
      job_id: params.jobId ?? null,
      field_path: params.fieldPath,
      decision: params.decision,
      proposed_value: params.proposedValue ?? null,
      reviewer_value: params.reviewerValue ?? null,
      comment: params.comment ?? null,
      reviewed_by: params.reviewedBy ?? "nick",
      reviewed_at: new Date().toISOString(),
    })
    .select("*")
    .single()

  if (error) throw error
  return data as ProductIntakeReviewDecisionRow
}

export async function resolveReviewDecisionsForSubmission(
  client: RpcClient,
  submissionId: string,
): Promise<number> {
  const resolvedAt = new Date().toISOString()
  const { data, error } = await client
    .from("product_intake_review_decisions")
    .update({ resolved_at: resolvedAt })
    .eq("submission_id", submissionId)
    .eq("decision", "change_requested")
    .is("resolved_at", null)
    .select("id")

  if (error) throw error
  return (data ?? []).length
}

export async function saveSubmissionResearchPreview(
  client: RpcClient,
  params: SaveSubmissionResearchPreviewParams,
): Promise<{ id: string; status: string }> {
  const nextStatus = params.status ?? "ready_for_review"
  const { data, error } = await client
    .from("product_submissions")
    .update({
      researched_payload: params.researchedPayload,
      status: nextStatus,
    })
    .eq("id", params.submissionId)
    .in("status", [...PRODUCT_INTAKE_OPEN_SUBMISSION_STATUSES])
    .select("id,status")
    .single()

  if (error) throw error
  return data as { id: string; status: string }
}

export async function buildPublishPreflight(
  client: RpcClient,
  submissionId: string,
  options: { publishRouteEnabled?: boolean } = {},
): Promise<PublishPreflightResult> {
  const detail = await loadProductIntakeSubmissionDetail(client, submissionId)
  if (!detail) {
    throw new Error(`Submission ${submissionId} wurde nicht gefunden.`)
  }

  const unresolved = detail.decisions.filter(
    (decision) => decision.decision === "change_requested" && !decision.resolved_at,
  )
  const latestImageDecision = latestDecisionForField(detail.decisions, "final.image")
  const latestPublishDecision = latestDecisionForField(detail.decisions, "final.product")
  const finalPayload = normalizeRecord(detail.payload?.final)
  const blockers: string[] = []

  if (!finalPayload) blockers.push("Kein finaler Research-Payload vorhanden.")
  if (detail.status !== "ready_for_review") {
    blockers.push(`Submission ist noch nicht ready_for_review (${detail.status}).`)
  }
  if (unresolved.length > 0) blockers.push(`${unresolved.length} Review-Kommentar(e) sind offen.`)
  if (latestImageDecision !== "image_approved") {
    blockers.push("Finales Bild wurde noch nicht freigegeben.")
  }
  if (latestPublishDecision !== "publish_approved") {
    blockers.push("Finaler Produkt-Handoff wurde noch nicht freigegeben.")
  }
  if (detail.job?.status !== "waiting_for_review") {
    blockers.push("Aktueller Job ist noch nicht review-bereit.")
  }

  return {
    submission_id: submissionId,
    ok: blockers.length === 0,
    blockers,
    unresolved_decisions: unresolved.length,
    latest_image_decision: latestImageDecision,
    latest_publish_decision: latestPublishDecision,
    proposed_product: finalPayload,
    publish_requires_confirm: true,
    publish_route_enabled: options.publishRouteEnabled ?? false,
    next_action:
      blockers.length === 0
        ? options.publishRouteEnabled
          ? "Publish ist fachlich vorbereitet. Finales Schreiben braucht explizite Bestaetigung."
          : "Publish ist fachlich vorbereitet, aber serverseitig noch gesperrt."
        : "Blocker klaeren und Preflight erneut starten.",
  }
}

export async function loadResearchJob(
  client: RpcClient,
  jobId: string,
): Promise<ProductIntakeResearchJob | null> {
  const { data, error } = await client
    .from("product_intake_research_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle()

  if (error) throw error
  return (data as ProductIntakeResearchJob | null) ?? null
}

export async function loadProductIntakeSubmissionDetail(
  client: RpcClient,
  submissionId: string,
): Promise<ProductIntakeSubmissionDetail | null> {
  const { data, error } = await client
    .from("product_submissions")
    .select(
      "id,status,category,brand:brand_text,product_name:product_name_text,source,payload:researched_payload,created_at,updated_at",
    )
    .eq("id", submissionId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const jobsBySubmissionId = await loadOpenJobsBySubmissionId(client, [submissionId])
  const [artifacts, decisions] = await Promise.all([
    loadArtifactsBySubmissionId(client, submissionId),
    loadReviewDecisionsBySubmissionId(client, submissionId),
  ])
  const record = data as Record<string, unknown>

  return {
    id: String(record.id),
    status: String(record.status),
    category: String(record.category),
    brand: nullableString(record.brand),
    product_name: nullableString(record.product_name),
    source: nullableString(record.source),
    payload: normalizeRecord(record.payload),
    created_at: String(record.created_at),
    updated_at: String(record.updated_at),
    job: jobsBySubmissionId.get(submissionId) ?? null,
    artifacts,
    decisions,
  }
}

export async function loadProductIntakeQueue(
  client: RpcClient,
  options: { includeCompleted?: boolean; limit?: number } = {},
): Promise<ProductIntakeQueueRow[]> {
  const limit = options.limit ?? 100
  const submissionStatuses = options.includeCompleted
    ? [...PRODUCT_INTAKE_OPEN_SUBMISSION_STATUSES, "approved"]
    : [...PRODUCT_INTAKE_OPEN_SUBMISSION_STATUSES]

  const { data: submissions, error: submissionError } = await client
    .from("product_submissions")
    .select(
      "id,status,category,brand:brand_text,product_name:product_name_text,source,created_at,updated_at",
    )
    .in("status", submissionStatuses)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (submissionError) throw submissionError

  const submissionRows = (submissions ?? []) as Array<Record<string, unknown>>
  const submissionIds = submissionRows.map((row) => String(row.id))
  const jobsBySubmissionId = await loadOpenJobsBySubmissionId(client, submissionIds)

  return submissionRows.map((row) => {
    const record = row as Record<string, unknown>
    const submissionId = String(record.id)
    const job = jobsBySubmissionId.get(submissionId) ?? null

    return {
      submission_id: submissionId,
      submission_status: String(record.status),
      category: String(record.category),
      brand: nullableString(record.brand),
      product_name: nullableString(record.product_name),
      source: nullableString(record.source),
      created_at: String(record.created_at),
      updated_at: String(record.updated_at),
      job: job ?? null,
    }
  })
}

async function loadOpenJobsBySubmissionId(
  client: RpcClient,
  submissionIds: string[],
): Promise<Map<string, ProductIntakeResearchJob>> {
  if (submissionIds.length === 0) return new Map()

  const { data, error } = await client
    .from("product_intake_research_jobs")
    .select("*")
    .in("submission_id", submissionIds)
    .in("status", [...PRODUCT_INTAKE_NON_TERMINAL_JOB_STATUSES])
    .order("updated_at", { ascending: false })

  if (isMissingResearchJobsTableError(error)) return new Map()
  if (error) throw error

  const jobsBySubmissionId = new Map<string, ProductIntakeResearchJob>()
  for (const job of (data ?? []) as ProductIntakeResearchJob[]) {
    if (!jobsBySubmissionId.has(job.submission_id)) {
      jobsBySubmissionId.set(job.submission_id, job)
    }
  }
  return jobsBySubmissionId
}

async function loadArtifactsBySubmissionId(
  client: RpcClient,
  submissionId: string,
): Promise<ProductIntakeResearchArtifact[]> {
  const { data, error } = await client
    .from("product_intake_research_artifacts")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (isMissingProductIntakeReviewTableError(error)) return []
  if (error) throw error
  return (data ?? []) as ProductIntakeResearchArtifact[]
}

async function loadReviewDecisionsBySubmissionId(
  client: RpcClient,
  submissionId: string,
): Promise<ProductIntakeReviewDecisionRow[]> {
  const { data, error } = await client
    .from("product_intake_review_decisions")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (isMissingProductIntakeReviewTableError(error)) return []
  if (error) throw error
  return (data ?? []) as ProductIntakeReviewDecisionRow[]
}

function isMissingResearchJobsTableError(
  error: { code?: string; message?: string } | null,
): boolean {
  return Boolean(
    error &&
    (error.code === "PGRST205" ||
      error.message?.includes("product_intake_research_jobs") ||
      error.message?.includes("schema cache")),
  )
}

function isMissingProductIntakeReviewTableError(
  error: { code?: string; message?: string } | null,
): boolean {
  return Boolean(
    error &&
    (error.code === "PGRST205" ||
      error.message?.includes("product_intake_research_artifacts") ||
      error.message?.includes("product_intake_review_decisions") ||
      error.message?.includes("schema cache")),
  )
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function normalizeRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null
}

function latestDecisionForField(
  decisions: ProductIntakeReviewDecisionRow[],
  fieldPath: string,
): ProductIntakeReviewDecision | null {
  return decisions.find((decision) => decision.field_path === fieldPath)?.decision ?? null
}
