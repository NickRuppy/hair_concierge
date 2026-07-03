export const PRODUCT_INTAKE_JOB_STATUSES = [
  "queued",
  "running",
  "waiting_for_review",
  "waiting_for_rework",
  "publish_preflight",
  "publishing",
  "blocked",
  "failed",
  "done",
  "cancelled",
] as const

export type ProductIntakeJobStatus = (typeof PRODUCT_INTAKE_JOB_STATUSES)[number]

export const PRODUCT_INTAKE_TERMINAL_JOB_STATUSES = ["done", "cancelled"] as const

export const PRODUCT_INTAKE_NON_TERMINAL_JOB_STATUSES = [
  "queued",
  "running",
  "waiting_for_review",
  "waiting_for_rework",
  "publish_preflight",
  "publishing",
  "blocked",
  "failed",
] as const satisfies readonly ProductIntakeJobStatus[]

export const PRODUCT_INTAKE_RETRYABLE_JOB_STATUSES = ["blocked", "failed"] as const

export const PRODUCT_INTAKE_OPEN_SUBMISSION_STATUSES = [
  "pending_review",
  "researching",
  "ready_for_review",
  "needs_more_info",
] as const

export const PRODUCT_INTAKE_JOB_STAGES = [
  "identity",
  "source_research",
  "property_research",
  "image_search",
  "image_judging",
  "preview_build",
  "rework",
  "publish_preflight",
  "publish",
  "notify",
] as const

export type ProductIntakeJobStage = (typeof PRODUCT_INTAKE_JOB_STAGES)[number]

export type JsonRecord = Record<string, unknown>

export const PRODUCT_INTAKE_ARTIFACT_KINDS = [
  "identity_candidate",
  "existing_product_match",
  "source_page",
  "property_extract",
  "property_synthesis",
  "image_candidate",
  "image_judgment",
  "processed_image",
  "publication_preview",
  "publish_result",
] as const

export type ProductIntakeArtifactKind = (typeof PRODUCT_INTAKE_ARTIFACT_KINDS)[number]

export const PRODUCT_INTAKE_REVIEW_DECISIONS = [
  "approved",
  "change_requested",
  "image_approved",
  "image_rejected",
  "publish_approved",
  "needs_more_info",
  "reject",
] as const

export type ProductIntakeReviewDecision = (typeof PRODUCT_INTAKE_REVIEW_DECISIONS)[number]

export type ProductIntakeResearchJob = {
  id: string
  submission_id: string
  status: ProductIntakeJobStatus
  stage: ProductIntakeJobStage
  priority: number
  attempt_count: number
  max_attempts: number
  locked_by: string | null
  locked_at: string | null
  started_at: string | null
  completed_at: string | null
  next_run_at: string
  last_error: string | null
  progress: JsonRecord
  created_at: string
  updated_at: string
}

export type ProductIntakeQueueRow = {
  submission_id: string
  submission_status: string
  category: string
  brand: string | null
  product_name: string | null
  source: string | null
  created_at: string
  updated_at: string
  job: ProductIntakeResearchJob | null
}

export type ProductIntakeResearchArtifact = {
  id: string
  job_id: string | null
  submission_id: string
  kind: ProductIntakeArtifactKind
  status: string
  payload: JsonRecord
  confidence: number | null
  source_urls: string[] | null
  model: string | null
  prompt_version: string | null
  created_at: string
}

export type ProductIntakeReviewDecisionRow = {
  id: string
  submission_id: string
  job_id: string | null
  field_path: string
  decision: ProductIntakeReviewDecision
  proposed_value: JsonRecord | null
  reviewer_value: JsonRecord | null
  comment: string | null
  reviewed_by: string
  reviewed_at: string
  resolved_at: string | null
  created_at: string
}

export type ProductIntakeSubmissionDetail = {
  id: string
  status: string
  category: string
  brand: string | null
  product_name: string | null
  source: string | null
  payload: JsonRecord | null
  created_at: string
  updated_at: string
  job: ProductIntakeResearchJob | null
  artifacts: ProductIntakeResearchArtifact[]
  decisions: ProductIntakeReviewDecisionRow[]
}

export function isProductIntakeJobStatus(value: string): value is ProductIntakeJobStatus {
  return PRODUCT_INTAKE_JOB_STATUSES.includes(value as ProductIntakeJobStatus)
}

export function isTerminalProductIntakeJobStatus(status: ProductIntakeJobStatus): boolean {
  return PRODUCT_INTAKE_TERMINAL_JOB_STATUSES.includes(
    status as (typeof PRODUCT_INTAKE_TERMINAL_JOB_STATUSES)[number],
  )
}

export function normalizeCodexConcurrency(raw: string | undefined, fallback = 2): number {
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(parsed, 4)
}
