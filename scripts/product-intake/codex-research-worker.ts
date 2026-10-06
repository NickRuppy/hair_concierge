import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { hostname } from "node:os"
import { createHash } from "node:crypto"
import { pathToFileURL } from "node:url"
import * as Sentry from "@sentry/node"

import {
  loadBrandResolutionContext,
  loadBrandResolutionCatalogForWorker,
  applyIdentityStage,
  approvedCanonicalBrandFromReview,
  type BrandResolutionPromptContext,
} from "@/lib/product-intake/pipeline/identity"
import { applyInciStage, type InciStageOptions } from "@/lib/product-intake/pipeline/inci"
import type { BrandResolutionCatalogInput } from "@/lib/product-identity/brand-resolution"
export type { BrandResolutionPromptContext } from "@/lib/product-intake/pipeline/identity"
import {
  cleanupStaleRembgContainers,
  processApprovedImageForReview,
  shouldAutoPrepareImage,
} from "@/lib/product-intake/pipeline/image"
import { runWorkerProcess, type WorkerSpawn } from "@/lib/product-intake/pipeline/process"
import {
  assertAllowedProductIntakeModel,
  boundedNumber,
  errorMessage,
  hasFinalResearchPayload,
  nonBlankEnv,
  normalizeRecord,
  optionalServiceTier,
  parseJsonObject,
  stringValue,
  truncateDiagnostic,
  type CodexResearchRuntimeConfig,
} from "@/lib/product-intake/pipeline/shared"

import {
  checkResearchReadiness,
  type ResearchReadinessSelfCheck,
} from "@/lib/product-intake/research-readiness-self-check"
import { LEAVE_IN_APPLICATION_STAGES } from "@/lib/leave-in/constants"
import {
  appendResearchArtifact as coreAppendResearchArtifact,
  claimResearchJobs,
  countResearchArtifacts,
  loadProductIntakeSubmissionDetail,
  normalizeCodexConcurrency,
  resolveReviewDecisionsForSubmission,
  saveSubmissionResearchPreview,
  updateResearchJob as coreUpdateResearchJob,
  PRODUCT_INTAKE_ARTIFACT_KINDS,
  PRODUCT_INTAKE_JOB_STAGES,
  type JsonRecord,
  type ProductIntakeArtifactKind,
  type ProductIntakeResearchJob,
  type ProductIntakeSubmissionDetail,
  type ProductIntakeJobStage,
  type ProductIntakeReviewDecisionRow,
} from "@chaarlie/product-intake-core"

import { createSupabaseClientFromEnv, flagBool, flagInt, parseArgs, printJson } from "./cli"
import {
  CATEGORY_RESEARCH_REGISTRY,
  CATEGORY_SPEC_KEYS,
  REQUIRED_CATEGORY_SPEC_KEYS,
  normalizeCategoryKey,
  researchEngineBindingMismatch,
  researchEngineBindingVersion,
  type ResearchJobEngineBinding,
  type CategoryContractKey,
} from "@/lib/product-intake/category-research-router"
import {
  createRetailerEnrichmentWarningReporter,
  parseRetailerEnrichmentPacket,
  type RetailerEnrichmentPacket,
  type ScannedIdentifierPacketValue,
} from "./retailer-enrichment-packet"

export {
  buildImageQualityJudgePrompt,
  cleanupStaleRembgContainers,
  finalizedImageOutputRoot,
  imageQualityJudgeRuntimeConfig,
  imageQualityPreparationDecision,
  loadImageQualityReferenceSet,
  normalizeImageQualityVerdict,
  rembgContainerArgs,
  rembgRuntimeConfig,
  runRembgContainer,
  shouldAutoPrepareImage,
  type ImageQualityDefect,
  type ImageQualityJudgeRuntimeConfig,
  type ImageQualityReference,
  type ImageQualityReferenceSet,
  type ImageQualityVerdict,
  type RembgRuntimeConfig,
} from "@/lib/product-intake/pipeline/image"
export { runWorkerProcess, type WorkerSpawn } from "@/lib/product-intake/pipeline/process"
export {
  assertAllowedProductIntakeModel,
  type CodexResearchRuntimeConfig,
} from "@/lib/product-intake/pipeline/shared"

type HeartbeatClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>
}

class WorkerLeaseLostError extends Error {
  constructor(jobId: string) {
    super(`Worker lease lost for ${jobId}`)
  }
}

export class WorkerJobLease {
  aborted = false
  private pending: Promise<unknown> = Promise.resolve()
  private readonly startedAt = Date.now()
  private readonly maxRuntimeMs = positiveDurationMs(
    process.env.PRODUCT_INTAKE_JOB_MAX_RUNTIME_MS,
    45 * 60_000,
  )

  private checkRuntime(): void {
    if (Date.now() - this.startedAt > this.maxRuntimeMs) this.aborted = true
  }

  constructor(
    readonly job: Pick<ProductIntakeResearchJob, "id" | "locked_by" | "locked_at">,
    private readonly client: HeartbeatClient,
  ) {}

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation)
    this.pending = result.catch(() => undefined)
    return result
  }

  renew(): Promise<void> {
    return this.serialize(async () => {
      this.checkRuntime()
      if (this.aborted) return
      const { data, error } = await this.client.rpc("product_intake_renew_research_job_lease", {
        target_job_id: this.job.id,
        expected_locked_by: this.job.locked_by,
      })
      if (error) throw error
      if (data === null) this.aborted = true
      else if (typeof data === "string") this.job.locked_at = data
      else throw new Error("Lease renewal returned an invalid timestamp")
    })
  }

  write<T>(operation: () => Promise<T>): Promise<T> {
    return this.serialize(async () => {
      this.checkRuntime()
      if (this.aborted) throw new WorkerLeaseLostError(this.job.id)
      return operation()
    })
  }
}

const workerLeases = new Map<string, WorkerJobLease>()

function withJobLease<T>(jobId: string | null | undefined, write: () => Promise<T>): Promise<T> {
  const lease = jobId ? workerLeases.get(jobId) : undefined
  return lease ? lease.write(write) : write()
}

function appendResearchArtifact(
  ...[client, params]: Parameters<typeof coreAppendResearchArtifact>
) {
  return withJobLease(params.jobId, () => coreAppendResearchArtifact(client, params))
}

function updateResearchJob(...[client, params]: Parameters<typeof coreUpdateResearchJob>) {
  return withJobLease(params.jobId, async () => {
    const lease = workerLeases.get(params.jobId)
    const updated = await coreUpdateResearchJob(client, {
      ...params,
      expectedLockedAt: lease?.job.locked_at ?? params.expectedLockedAt,
    })
    // All call-chain aliases share this object, including optional model lanes.
    if (lease) Object.assign(lease.job, updated)
    if (updated.status !== "running") workerLeases.delete(params.jobId)
    return lease ? (lease.job as ProductIntakeResearchJob) : updated
  })
}

/** Called before the production research run; the RPC fences concurrent/stale owners. */
export async function bindResearchJobEngine(
  client: HeartbeatClient,
  job: ProductIntakeResearchJob & ResearchJobEngineBinding,
  category: string | null | undefined,
): Promise<ProductIntakeResearchJob & ResearchJobEngineBinding> {
  const key = normalizeCategoryKey(category)
  if (!key) return job
  const engine = CATEGORY_RESEARCH_REGISTRY[key]
  if (engine.state !== "active") return job
  return withJobLease(job.id, async () => {
    const mismatch = researchEngineBindingMismatch(job, engine)
    if (mismatch) throw new Error(mismatch)
    const lease = workerLeases.get(job.id)
    const { data, error } = await client.rpc("product_intake_bind_research_job_engine", {
      target_job_id: job.id,
      next_engine_key: engine.engineId,
      next_engine_version: researchEngineBindingVersion(engine),
      expected_locked_by: job.locked_by,
      expected_locked_at: lease?.job.locked_at ?? job.locked_at,
    })
    if (error) {
      const rpcError = normalizeRecord(error)
      const message = stringValue(rpcError?.message) ?? "Engine binding RPC failed"
      if (rpcError?.code === "PGRST202" || /Could not find the function/i.test(message)) {
        const infrastructureError = new Error(
          `INFRA_ENGINE_BINDING: product_intake_bind_research_job_engine unavailable; continuing without binding for job ${job.id}: ${message}`,
        )
        try {
          console.error(infrastructureError.message)
        } catch {
          /* Observability must not gate research. */
        }
        try {
          if (Sentry.isInitialized()) Sentry.captureException(infrastructureError)
        } catch {
          /* Sentry is best effort. */
        }
        return job
      }
      throw new Error(message)
    }
    const bound = normalizeRecord(data)
    if (!bound) throw new Error("Engine binding RPC returned no job")
    Object.assign(job, bound)
    return job
  })
}

export function startWorkerHeartbeat(params: {
  client: HeartbeatClient
  workerId: string
  host: string
  pid: number
  releaseSha?: string
  intervalMs?: number
  leases: Map<string, WorkerJobLease>
  currentJobId: () => string | null
  authPaused?: () => boolean
  onError?: (error: unknown) => void
  checkIn?: (status: "ok" | "error") => void
}) {
  let stopped = false
  let inFlight: Promise<void> | undefined
  let heartbeatFailures = 0
  const report = (error: unknown) => {
    try {
      ;(params.onError ?? console.error)(error)
    } catch {
      /* Observability cannot crash work. */
    }
  }
  const tick = (): Promise<void> => {
    if (stopped) return Promise.resolve()
    if (inFlight) return inFlight
    inFlight = (async () => {
      // Renew even when the separate liveness RPC fails.
      await Promise.all([...params.leases.values()].map((lease) => lease.renew().catch(report)))
      try {
        const { error } = await params.client.rpc("product_intake_record_worker_heartbeat", {
          worker_id: params.workerId,
          host: params.host,
          pid: params.pid,
          release_sha: params.releaseSha ?? null,
          current_job_id: params.currentJobId(),
        })
        if (error) throw error
        heartbeatFailures = 0
      } catch (error) {
        heartbeatFailures++
        report(error)
      }
      try {
        params.checkIn?.(
          heartbeatFailures >= 2 ||
            params.authPaused?.() ||
            [...params.leases.values()].some((lease) => lease.aborted)
            ? "error"
            : "ok",
        )
      } catch (error) {
        report(error)
      }
    })().finally(() => {
      inFlight = undefined
    })
    return inFlight
  }
  const timer = setInterval(() => {
    void tick()
  }, params.intervalMs ?? 60_000)
  void tick()
  return {
    tick,
    stop: () => {
      stopped = true
      clearInterval(timer)
    },
  }
}

function initWorkerSentry(): boolean {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()
  if (!dsn) return false
  try {
    Sentry.init({ dsn, environment: process.env.NODE_ENV ?? "production", sendDefaultPii: false })
    return true
  } catch {
    return false
  }
}

function workerSentryCheckIn(enabled: boolean, intervalMs: number, status: "ok" | "error"): void {
  if (!enabled) return
  try {
    const checkInId = Sentry.captureCheckIn(
      { monitorSlug: "product-intake-worker", status: "in_progress" },
      {
        schedule: { type: "interval", value: Math.ceil(intervalMs / 60_000), unit: "minute" },
        checkinMargin: 10,
        maxRuntime: 1,
      },
    )
    Sentry.captureCheckIn({ monitorSlug: "product-intake-worker", status, checkInId })
  } catch {
    /* Match price-audit: Sentry is best effort. */
  }
}

type WorkerResult = {
  worker_id: string
  claimed: number
  watch: boolean
  poll_ms: number | null
  jobs: Array<{
    id: string
    submission_id: string
    status: string
    stage: string
    prompt_packet_path: string
    mode: "preview_only" | "codex_cli"
  }>
}

type CodexResearchArtifactOutput = {
  kind: ProductIntakeArtifactKind
  status?: string
  confidence?: number | null
  payload: JsonRecord
  source_urls?: string[] | null
}

type CodexResearchOutput = {
  summary: string
  researched_payload?: JsonRecord | null
  artifacts: CodexResearchArtifactOutput[]
  blockers: string[]
  next_stage?: ProductIntakeJobStage
}

export type ProductIntakeModelLane =
  | "production_low"
  | "challenger_medium"
  | "judge"
  | "image_judge"

export type ModelEvaluationRuntimeConfig = {
  enabled: boolean
  targetSuccessfulJudgments: number
  challenger: CodexResearchRuntimeConfig
  judge: CodexResearchRuntimeConfig
}

type BlindCandidateLabel = "A" | "B"
type ResearchLane = "production_low" | "challenger_medium"

export type BlindJudgePacket = {
  candidates: Record<BlindCandidateLabel, JsonRecord>
  laneByCandidate: Record<BlindCandidateLabel, ResearchLane>
}

type ModelJudgeDimensionScores = {
  identity: number
  evidence: number
  completeness: number
  uncertainty: number
}

export type ModelJudgeVerdict = {
  preferredCandidate: BlindCandidateLabel | "tie"
  preferredLane: ResearchLane | "tie"
  confidence: number
  scores: Record<BlindCandidateLabel, ModelJudgeDimensionScores>
  materialIssues: string[]
  rationale: string
}

type SuccessfulModelRun<T> = {
  success: true
  lane: ProductIntakeModelLane
  runtimeConfig: CodexResearchRuntimeConfig
  durationMs: number
  outputHash: string
  output: T
}

type FailedModelRun = {
  success: false
  lane: ProductIntakeModelLane
  runtimeConfig: CodexResearchRuntimeConfig
  durationMs: number
  error: string
}

type MeasuredModelRun<T> = SuccessfulModelRun<T> | FailedModelRun

type ModelEvaluationResult = {
  status:
    | "disabled"
    | "target_reached"
    | "completed"
    | "challenger_failed"
    | "judge_failed"
    | "telemetry_failed"
  successfulJudgments: number
  targetSuccessfulJudgments: number
  preferredLane?: ResearchLane | "tie"
}

type WorkerOptions = {
  executeCodex: boolean
  noComplete: boolean
  failTest: boolean
  json: boolean
  watch: boolean
  pollMs: number
  concurrency: number
  workerId: string
  supabase: ReturnType<typeof createSupabaseClientFromEnv>
  currentJobId?: string | null
  claimGate: WorkerClaimGate
}

// Shared by the watch loop and its heartbeat, so infrastructure outages stop claims.
export class WorkerClaimGate {
  private pauseUntil = 0

  get paused(): boolean {
    return Date.now() < this.pauseUntil
  }

  handleFailure(error: unknown): void {
    if (codexInfrastructureCode(error) !== "infra_auth") return
    const pauseMs = positiveDurationMs(process.env.PRODUCT_INTAKE_AUTH_PAUSE_MS, 15 * 60_000)
    this.pauseUntil = Date.now() + pauseMs
    try {
      console.error(
        `INFRA_AUTH: worker claims PAUSED for ${pauseMs}ms until ${new Date(this.pauseUntil).toISOString()}: ${errorMessage(error)}`,
      )
    } catch {
      /* Observability cannot prevent the pause. */
    }
    try {
      if (Sentry.isInitialized()) Sentry.captureException(error)
    } catch {
      /* Sentry is best effort. */
    }
  }

  claim(...args: Parameters<typeof claimResearchJobs>): ReturnType<typeof claimResearchJobs> {
    return this.paused ? Promise.resolve([]) : claimResearchJobs(...args)
  }
}

export type ScanIntakeSeed = {
  scannedIdentifier: ScannedIdentifierPacketValue
  retailerEnrichment: RetailerEnrichmentPacket | null
  retailerEnrichmentWarning: "gtin_mismatch" | null
}

const reportRetailerEnrichmentWarning = createRetailerEnrichmentWarningReporter({
  emit: (message, fields) => console.warn("[product-intake]", message, fields),
})

const CODEX_RESEARCH_TIMEOUT_MS = 5 * 60_000
const CODEX_APP_BINARY = "/Applications/Codex.app/Contents/Resources/codex"
const MODEL_EVALUATION_EXPERIMENT_ID = "product_intake_research_effort_v1"

const ARRAY_CATEGORY_SPEC_TABLES = new Set<string>([
  "product_shampoo_specs",
  "product_conditioner_specs",
  "product_leave_in_eligibility",
  "product_oil_eligibility",
  "product_application_protocols",
])

async function main() {
  const args = parseArgs()
  const executeCodex = flagBool(args, "execute-codex")
  const noComplete = flagBool(args, "no-complete")
  const failTest = flagBool(args, "fail-test")
  const json = flagBool(args, "json")
  const watch = flagBool(args, "watch")

  const concurrency = normalizeCodexConcurrency(
    process.env.PRODUCT_INTAKE_CODEX_CONCURRENCY,
    flagInt(args, "concurrency", 2),
  )
  const pollMs = normalizeWorkerPollMs(
    process.env.PRODUCT_INTAKE_CODEX_WORKER_POLL_MS,
    flagInt(args, "poll-ms", 30_000),
  )
  const workerId = `codex-worker:${hostname()}:${process.pid}`
  const supabase = createSupabaseClientFromEnv()

  const options: WorkerOptions = {
    executeCodex,
    noComplete,
    failTest,
    json,
    watch,
    pollMs,
    concurrency,
    workerId,
    supabase,
    claimGate: new WorkerClaimGate(),
  }

  if (watch && !json) {
    console.log(
      `Codex research worker ${workerId} watching every ${pollMs}ms with concurrency ${concurrency}.`,
    )
    console.log("Press Ctrl-C to stop.")
  }

  const heartbeatMs = normalizeWorkerPollMs(process.env.PRODUCT_INTAKE_WORKER_HEARTBEAT_MS, 60_000)
  const sentryEnabled = initWorkerSentry()
  const heartbeat = watch
    ? startWorkerHeartbeat({
        client: supabase,
        workerId,
        host: hostname(),
        pid: process.pid,
        releaseSha: process.env.PRODUCT_INTAKE_RELEASE_SHA?.trim() || undefined,
        intervalMs: heartbeatMs,
        leases: workerLeases,
        currentJobId: () => options.currentJobId ?? null,
        authPaused: () => options.claimGate.paused,
        checkIn: (status) => workerSentryCheckIn(sentryEnabled, heartbeatMs, status),
      })
    : undefined
  try {
    if (watch) await cleanupStaleRembgContainers()
    do {
      printWorkerResult(await runWorkerBatch(options), options)
      if (watch) await sleep(pollMs)
    } while (watch)
  } finally {
    heartbeat?.stop()
  }
}

/** Persist the production result before optional evaluation, then release it for review. */
export async function completeResearchPass(params: {
  supabase: ReturnType<typeof createSupabaseClientFromEnv>
  job: ProductIntakeResearchJob
  category: string | null | undefined
  submission: Pick<ProductIntakeSubmissionDetail, "id" | "source" | "status"> | null
  reworkRequest?: JsonRecord | null
  workerId: string
  promptPacketPath: string
  researchOutput: CodexResearchOutput
  researchModel: string
  executeCodex: boolean
  autoPrepareImages: boolean
  beforeCompletion?: () => Promise<{
    job: ProductIntakeResearchJob
    modelEvaluation: ModelEvaluationResult
  }>
}) {
  const { researchOutput, promptPacketPath } = params
  const reworkRequest =
    params.job.stage === "rework"
      ? (params.reworkRequest ?? activeReworkRequestFromProgress(params.job.progress))
      : null
  const hasFinalPayload = hasFinalResearchPayload(researchOutput.researched_payload)
  const blockers = researchOutput.blockers.filter(Boolean)
  let submissionContext = params.submission
    ? { ...params.submission, user_id: null as string | null }
    : undefined
  if (blockers.length === 0 && hasFinalPayload && submissionContext) {
    // The shared detail loader omits ownership. Supplement it from the stored
    // submission, never from model output or job progress.
    const { data, error } = await params.supabase
      .from("product_submissions")
      .select("user_id")
      .eq("id", submissionContext.id)
      .maybeSingle()
    if (error) throw new Error(`load product-intake readiness owner: ${error.message}`)
    submissionContext = { ...submissionContext, user_id: stringValue(data?.user_id) }
  }
  const readiness =
    blockers.length === 0 && hasFinalPayload
      ? checkResearchReadiness(
          researchOutput.researched_payload,
          params.category,
          submissionContext,
        )
      : null
  const progress = await persistResearchOutput({ ...params, readiness })
  const evaluated = await params.beforeCompletion?.()
  const leasedJob = evaluated?.job ?? params.job
  const evaluation = evaluated?.modelEvaluation ?? {
    status: "disabled",
    successfulJudgments: 0,
    targetSuccessfulJudgments: 0,
  }
  const autoPrepareImage = shouldAutoPrepareImage({
    enabled: params.autoPrepareImages && readiness?.ok === true,
    researchOutput,
  })
  const nextStatus = autoPrepareImage
    ? "queued"
    : readiness?.ok === true
      ? "waiting_for_review"
      : "blocked"
  const nextStage = autoPrepareImage
    ? "image_judging"
    : (researchOutput.next_stage ?? (hasFinalPayload ? "preview_build" : "source_research"))

  const readinessError =
    readiness && !readiness.ok
      ? `Katalog-Prüfung: ${readiness.researchGaps.length} Pflichtfelder fehlen: ${readiness.researchGaps.slice(0, 5).join(", ")}${readiness.researchGaps.length > 5 ? "…" : ""}`
      : null
  // A new pass replaces the prior readiness verdict, including on model blockers.
  const previousProgress = progressWithoutReadiness(leasedJob.progress)
  if (reworkRequest) {
    previousProgress.last_rework_request = reworkRequest
    for (const key of ["requested_by", "requested_at", "rework_type", "message"])
      delete previousProgress[key]
  }
  const updated = await updateResearchJob(params.supabase, {
    jobId: leasedJob.id,
    status: nextStatus,
    stage: nextStage,
    progress: {
      ...previousProgress,
      message: autoPrepareImage
        ? "Research ist bereit. Bildverarbeitung und visueller Bildcheck sind eingereiht."
        : nextStatus === "waiting_for_review"
          ? "Research preview ist bereit fuer Nick."
          : "Research braucht Aufmerksamkeit, bevor Nick final freigeben kann.",
      prompt_packet_path: promptPacketPath,
      worker_id: params.workerId,
      mode: params.executeCodex ? "codex_cli" : "preview_only",
      image_selection_mode: autoPrepareImage ? "agent_prepared" : null,
      next_step: autoPrepareImage ? "process_image_for_combined_review" : null,
      model_evaluation: evaluation,
      ...progress,
      ...(readiness
        ? {
            readiness_check: readiness.ok ? "passed" : "failed",
            readiness_missing_fields: readiness.researchGaps,
          }
        : {}),
    },
    lastError: blockers.length > 0 ? blockers.join("; ") : readinessError,
    expectedLockedBy: leasedJob.locked_by,
    expectedLockedAt: leasedJob.locked_at,
  })
  return updated
}

async function runWorkerBatch(options: WorkerOptions): Promise<WorkerResult> {
  const jobs = await options.claimGate.claim(options.supabase, {
    workerId: options.workerId,
    limit: options.concurrency,
  })

  const result: WorkerResult = {
    worker_id: options.workerId,
    claimed: jobs.length,
    watch: options.watch,
    poll_ms: options.watch ? options.pollMs : null,
    jobs: [],
  }

  for (const job of jobs) workerLeases.set(job.id, new WorkerJobLease(job, options.supabase))
  try {
    for (const job of jobs) {
      options.currentJobId = job.id
      const lease = workerLeases.get(job.id)!
      // Lease refreshes replace progress.message before completion; retain the
      // reviewer instruction as it was when this rework pass was claimed.
      const reworkRequest =
        job.stage === "rework" ? activeReworkRequestFromProgress(job.progress) : null
      try {
        if (lease.aborted) continue
        const detail = await loadProductIntakeSubmissionDetail(options.supabase, job.submission_id)
        const scanIntakeSeed = await loadScanIntakeSeedForSubmission(
          options.supabase,
          job.submission_id,
        )
        reportRetailerEnrichmentWarning(scanIntakeSeed.retailerEnrichmentWarning)
        const brandResolutionContext = await loadBrandResolutionContext(
          options.supabase,
          detail,
          scanIntakeSeed.scannedIdentifier,
        )
        const promptPacketPath = writePromptPacket(
          job,
          options.workerId,
          detail,
          brandResolutionContext,
          scanIntakeSeed.retailerEnrichment,
        )

        if (options.failTest) {
          const updated = await updateResearchJob(options.supabase, {
            jobId: job.id,
            status: "failed",
            stage: job.stage,
            progress: {
              message: "Codex worker skeleton marked this job failed for UI testing.",
              prompt_packet_path: promptPacketPath,
              worker_id: options.workerId,
              mode: options.executeCodex ? "codex_cli" : "preview_only",
            },
            lastError: "Phase 1 --fail-test requested",
            expectedLockedBy: job.locked_by,
            expectedLockedAt: job.locked_at,
          })
          result.jobs.push(projectJob(updated, promptPacketPath, options.executeCodex))
          continue
        }

        if (options.noComplete) {
          const updated = await updateResearchJob(options.supabase, {
            jobId: job.id,
            status: "running",
            stage: job.stage,
            progress: {
              message:
                "Codex worker skeleton claimed this job and left it running for lock testing.",
              prompt_packet_path: promptPacketPath,
              worker_id: options.workerId,
              mode: options.executeCodex ? "codex_cli" : "preview_only",
            },
            expectedLockedBy: job.locked_by,
            expectedLockedAt: job.locked_at,
          })
          result.jobs.push(projectJob(updated, promptPacketPath, options.executeCodex))
          continue
        }

        if (job.stage === "image_judging") {
          let imageLeasedJob = job
          try {
            const updated = await processApprovedImageForReview(
              {
                supabase: options.supabase,
                job,
                detail,
                workerId: options.workerId,
                promptPacketPath,
                executeCodex: options.executeCodex,
                onLeaseRefresh: (refreshedJob) => {
                  imageLeasedJob = refreshedJob
                },
              },
              {
                appendResearchArtifact,
                updateResearchJob,
                measureModelRun,
                refreshModelRunLease,
                captureOptionalTelemetryFailure,
                runCodexJson,
                outputPathForModelLane,
              },
            )
            result.jobs.push(projectJob(updated, promptPacketPath, options.executeCodex))
          } catch (error) {
            options.claimGate.handleFailure(error)
            if (lease.aborted || error instanceof WorkerLeaseLostError) continue
            const updated = await updateResearchJob(
              options.supabase,
              imageProcessingFailureUpdate({
                job: imageLeasedJob,
                error,
                promptPacketPath,
                workerId: options.workerId,
              }),
            )
            result.jobs.push(projectJob(updated, promptPacketPath, options.executeCodex))
          }
          continue
        }

        let leasedJob = job
        try {
          const researchRuntimeConfig = codexResearchRuntimeConfig(process.env)
          const evaluationRuntimeConfig = modelEvaluationRuntimeConfig(process.env)
          let evaluation: ModelEvaluationResult = {
            status: "disabled",
            successfulJudgments: 0,
            targetSuccessfulJudgments: 0,
          }
          let rawResearchOutput: CodexResearchOutput

          if (options.executeCodex) {
            leasedJob = await bindResearchJobEngine(options.supabase, leasedJob, detail?.category)
            const productionRun = await measureModelRun(
              "production_low",
              researchRuntimeConfig,
              () => runCodexResearch(promptPacketPath, researchRuntimeConfig, "production_low"),
            )
            leasedJob = await refreshModelRunLease({
              supabase: options.supabase,
              job: leasedJob,
              workerId: options.workerId,
              promptPacketPath,
              message: "Luna/low research returned; worker lease refreshed.",
            })
            await persistModelRunArtifact(options.supabase, leasedJob, productionRun)
            if (!productionRun.success) throw new Error(productionRun.error)

            rawResearchOutput = productionRun.output
          } else {
            rawResearchOutput = buildPreviewOnlyOutput(job, detail, promptPacketPath)
            leasedJob = await refreshModelRunLease({
              supabase: options.supabase,
              job: leasedJob,
              workerId: options.workerId,
              promptPacketPath,
              message: "Preview result returned; worker lease refreshed.",
            })
          }

          const researchOutput = normalizeResearchOutputForCategory(
            rawResearchOutput,
            detail?.category,
            brandResolutionContext,
            detail?.decisions ?? [],
            job.submission_id,
            {
              retailerPacket: scanIntakeSeed.retailerEnrichment,
              inciRetryAttempted: leasedJob.progress.inci_retry_attempted === true,
              brandCatalog:
                !brandResolutionContext.resolved_brand &&
                !approvedCanonicalBrandFromReview(detail?.decisions ?? [])
                  ? await loadBrandResolutionCatalogForWorker(options.supabase)
                  : undefined,
            },
          )
          const updated = await completeResearchPass({
            supabase: options.supabase,
            job: leasedJob,
            category: detail?.category,
            submission: detail,
            reworkRequest,
            workerId: options.workerId,
            promptPacketPath,
            researchOutput,
            researchModel: options.executeCodex
              ? researchRuntimeConfig.model
              : "codex-worker-preview",
            executeCodex: options.executeCodex,
            autoPrepareImages:
              options.executeCodex &&
              process.env.PRODUCT_INTAKE_AUTO_PREPARE_IMAGES?.trim().toLowerCase() === "true",
            beforeCompletion: async () => {
              if (options.executeCodex) {
                const evaluationRun = await runNonFatalModelEvaluation({
                  job: leasedJob,
                  currentJob: () => leasedJob,
                  targetSuccessfulJudgments: evaluationRuntimeConfig.targetSuccessfulJudgments,
                  run: () =>
                    runOptionalModelEvaluation({
                      supabase: options.supabase,
                      job: leasedJob,
                      workerId: options.workerId,
                      promptPacketPath,
                      productionOutput: rawResearchOutput,
                      config: evaluationRuntimeConfig,
                      onLeaseRefresh: (refreshedJob) => {
                        leasedJob = refreshedJob
                      },
                    }),
                  persistFailure: (message) =>
                    persistModelJudgmentFailure(options.supabase, leasedJob, message),
                })
                leasedJob = evaluationRun.job
                evaluation = evaluationRun.result
              }
              return { job: leasedJob, modelEvaluation: evaluation }
            },
          })
          result.jobs.push(projectJob(updated, promptPacketPath, options.executeCodex))
        } catch (error) {
          options.claimGate.handleFailure(error)
          if (lease.aborted || error instanceof WorkerLeaseLostError) continue
          const updated = await updateResearchJob(
            options.supabase,
            researchFailureUpdate({
              job: leasedJob,
              error,
              promptPacketPath,
              workerId: options.workerId,
              executeCodex: options.executeCodex,
            }),
          )
          result.jobs.push(projectJob(updated, promptPacketPath, options.executeCodex))
        }
      } catch (error) {
        options.claimGate.handleFailure(error)
        if (!(error instanceof WorkerLeaseLostError) && !lease.aborted) throw error
        console.error(`Worker stopped writes after lease loss: ${job.id}`)
      } finally {
        workerLeases.delete(job.id)
        options.currentJobId = null
      }
    }
  } finally {
    for (const job of jobs) workerLeases.delete(job.id)
    options.currentJobId = null
  }

  return result
}

function progressWithoutReadiness(progress: JsonRecord | null | undefined): JsonRecord {
  const next = { ...progress }
  delete next.readiness_check
  delete next.readiness_missing_fields
  return next
}

export function researchFailureUpdate(params: {
  job: Pick<
    ProductIntakeResearchJob,
    "id" | "stage" | "locked_by" | "locked_at" | "attempt_count" | "max_attempts"
  > & { progress?: JsonRecord }
  error: unknown
  promptPacketPath: string
  workerId: string
  executeCodex: boolean
}) {
  const message = truncateDiagnostic(
    params.error instanceof Error ? params.error.message : "Codex research worker failed.",
  )
  const code = codexInfrastructureCode(params.error)
  const retryable = code === "codex_timeout"
  const retryExhausted = retryable && params.job.attempt_count >= params.job.max_attempts
  const engineMismatch = /^engine_(version|key)_mismatch:/.test(message)
  const status =
    retryable && !retryExhausted ? "queued" : code || engineMismatch ? "blocked" : "failed"
  return {
    jobId: params.job.id,
    status: status as "queued" | "blocked" | "failed",
    stage: params.job.stage,
    progress: {
      ...progressWithoutReadiness(params.job.progress),
      message,
      prompt_packet_path: params.promptPacketPath,
      worker_id: params.workerId,
      mode: params.executeCodex ? "codex_cli" : "preview_only",
      ...(code ? { error_code: code, retryable, retry_exhausted: retryExhausted } : {}),
    },
    lastError: message,
    expectedLockedBy: params.job.locked_by,
    expectedLockedAt: params.job.locked_at,
  }
}

function printWorkerResult(result: WorkerResult, options: WorkerOptions) {
  if (options.json) {
    printJson(result)
  } else {
    console.log(`Codex worker ${options.workerId} claimed ${result.claimed} job(s).`)
    for (const job of result.jobs) {
      console.log(`- ${job.submission_id}: ${job.status}/${job.stage}`)
      console.log(`  mode: ${job.mode}`)
      console.log(`  prompt packet: ${job.prompt_packet_path}`)
    }
  }
}

function normalizeWorkerPollMs(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1_000) return fallback
  return Math.min(parsed, 5 * 60_000)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function measureModelRun<T>(
  lane: ProductIntakeModelLane,
  runtimeConfig: CodexResearchRuntimeConfig,
  execute: () => T | Promise<T>,
): Promise<MeasuredModelRun<T>> {
  const startedAt = Date.now()
  try {
    const output = await execute()
    return {
      success: true,
      lane,
      runtimeConfig,
      durationMs: Date.now() - startedAt,
      outputHash: createHash("sha256").update(JSON.stringify(output)).digest("hex"),
      output,
    }
  } catch (error) {
    const code = codexInfrastructureCode(error)
    if (code === "infra_auth" || (code === "codex_timeout" && lane === "production_low")) {
      throw error
    }
    return {
      success: false,
      lane,
      runtimeConfig,
      durationMs: Date.now() - startedAt,
      error: truncateDiagnostic(
        error instanceof Error ? error.message : "Unknown Codex model-run failure.",
      ),
    }
  }
}

async function refreshModelRunLease(params: {
  supabase: ReturnType<typeof createSupabaseClientFromEnv>
  job: ProductIntakeResearchJob
  workerId: string
  promptPacketPath: string
  message: string
}): Promise<ProductIntakeResearchJob> {
  return updateResearchJob(params.supabase, {
    jobId: params.job.id,
    status: "running",
    stage: params.job.stage,
    progress: {
      ...(params.job.progress ?? {}),
      message: params.message,
      prompt_packet_path: params.promptPacketPath,
      worker_id: params.workerId,
      mode: "codex_cli",
    },
    lastError: null,
    expectedLockedBy: params.job.locked_by,
    expectedLockedAt: params.job.locked_at,
  })
}

async function persistModelRunArtifact<T>(
  supabase: ReturnType<typeof createSupabaseClientFromEnv>,
  job: ProductIntakeResearchJob,
  run: MeasuredModelRun<T>,
) {
  return appendResearchArtifact(supabase, {
    jobId: job.id,
    submissionId: job.submission_id,
    kind: "model_run",
    status: run.success ? "completed" : "failed",
    payload: {
      lane: run.lane,
      experiment_id: MODEL_EVALUATION_EXPERIMENT_ID,
      role: run.lane === "judge" ? "judge" : "researcher",
      model: run.runtimeConfig.model,
      reasoning_effort: run.runtimeConfig.reasoningEffort,
      service_tier: run.runtimeConfig.serviceTier ?? "standard",
      duration_ms: run.durationMs,
      output_hash: run.success ? run.outputHash : null,
      output: run.success ? toJsonRecord(run.output) : null,
      error: run.success ? null : run.error,
      token_usage: null,
    },
    model: run.runtimeConfig.model,
    promptVersion:
      run.lane === "judge" ? "product_intake_model_judge_v1" : "product_intake_codex_research_v1",
  })
}

export async function captureOptionalTelemetryFailure(
  write: () => Promise<unknown>,
): Promise<string | null> {
  try {
    await write()
    return null
  } catch (error) {
    return errorMessage(error)
  }
}

export async function runNonFatalModelEvaluation<TJob>(params: {
  job: TJob
  currentJob?: () => TJob
  targetSuccessfulJudgments: number
  run: () => Promise<{ job: TJob; result: ModelEvaluationResult }>
  persistFailure: (message: string) => Promise<unknown>
}): Promise<{ job: TJob; result: ModelEvaluationResult }> {
  try {
    return await params.run()
  } catch (error) {
    if (codexInfrastructureCode(error) === "infra_auth") throw error
    await captureOptionalTelemetryFailure(() => params.persistFailure(errorMessage(error)))
    return {
      job: params.currentJob?.() ?? params.job,
      result: {
        status: "telemetry_failed",
        successfulJudgments: 0,
        targetSuccessfulJudgments: params.targetSuccessfulJudgments,
      },
    }
  }
}

async function runOptionalModelEvaluation(params: {
  supabase: ReturnType<typeof createSupabaseClientFromEnv>
  job: ProductIntakeResearchJob
  workerId: string
  promptPacketPath: string
  productionOutput: CodexResearchOutput
  config: ModelEvaluationRuntimeConfig
  onLeaseRefresh?: (job: ProductIntakeResearchJob) => void
}): Promise<{ job: ProductIntakeResearchJob; result: ModelEvaluationResult }> {
  let leasedJob = params.job
  let successfulJudgments = 0

  try {
    successfulJudgments = await countResearchArtifacts(params.supabase, {
      kind: "model_judgment",
      status: "completed",
      payloadContains: { experiment_id: MODEL_EVALUATION_EXPERIMENT_ID },
    })
  } catch (error) {
    await captureOptionalTelemetryFailure(() =>
      persistModelJudgmentFailure(
        params.supabase,
        leasedJob,
        `Could not count completed model judgments: ${errorMessage(error)}`,
      ),
    )
    return {
      job: leasedJob,
      result: {
        status: "judge_failed",
        successfulJudgments,
        targetSuccessfulJudgments: params.config.targetSuccessfulJudgments,
      },
    }
  }

  if (
    !shouldRunShadowExperiment({
      enabled: params.config.enabled,
      successfulJudgments,
      target: params.config.targetSuccessfulJudgments,
    })
  ) {
    return {
      job: leasedJob,
      result: {
        status: params.config.enabled ? "target_reached" : "disabled",
        successfulJudgments,
        targetSuccessfulJudgments: params.config.targetSuccessfulJudgments,
      },
    }
  }

  const challengerRun = await measureModelRun("challenger_medium", params.config.challenger, () =>
    runCodexResearch(params.promptPacketPath, params.config.challenger, "challenger_medium"),
  )
  leasedJob = await refreshModelRunLease({
    supabase: params.supabase,
    job: leasedJob,
    workerId: params.workerId,
    promptPacketPath: params.promptPacketPath,
    message: "Luna/medium shadow research returned; worker lease refreshed.",
  })
  params.onLeaseRefresh?.(leasedJob)
  const challengerArtifactError = await captureOptionalTelemetryFailure(() =>
    persistModelRunArtifact(params.supabase, leasedJob, challengerRun),
  )
  if (challengerArtifactError) {
    await captureOptionalTelemetryFailure(() =>
      persistModelJudgmentFailure(params.supabase, leasedJob, challengerArtifactError),
    )
    return {
      job: leasedJob,
      result: {
        status: "telemetry_failed",
        successfulJudgments,
        targetSuccessfulJudgments: params.config.targetSuccessfulJudgments,
      },
    }
  }

  if (!challengerRun.success) {
    await captureOptionalTelemetryFailure(() =>
      persistModelJudgmentFailure(params.supabase, leasedJob, challengerRun.error),
    )
    return {
      job: leasedJob,
      result: {
        status: "challenger_failed",
        successfulJudgments,
        targetSuccessfulJudgments: params.config.targetSuccessfulJudgments,
      },
    }
  }

  const blindPacket = buildBlindJudgePacket(
    toJsonRecord(params.productionOutput),
    toJsonRecord(challengerRun.output),
  )
  const judgeRun = await measureModelRun("judge", params.config.judge, () =>
    runCodexJudge(params.promptPacketPath, blindPacket, params.config.judge),
  )
  leasedJob = await refreshModelRunLease({
    supabase: params.supabase,
    job: leasedJob,
    workerId: params.workerId,
    promptPacketPath: params.promptPacketPath,
    message: "Sol/medium judgment returned; worker lease refreshed.",
  })
  params.onLeaseRefresh?.(leasedJob)
  const judgeArtifactError = await captureOptionalTelemetryFailure(() =>
    persistModelRunArtifact(params.supabase, leasedJob, judgeRun),
  )
  if (judgeArtifactError) {
    await captureOptionalTelemetryFailure(() =>
      persistModelJudgmentFailure(params.supabase, leasedJob, judgeArtifactError, blindPacket),
    )
    return {
      job: leasedJob,
      result: {
        status: "telemetry_failed",
        successfulJudgments,
        targetSuccessfulJudgments: params.config.targetSuccessfulJudgments,
      },
    }
  }

  if (!judgeRun.success) {
    await captureOptionalTelemetryFailure(() =>
      persistModelJudgmentFailure(params.supabase, leasedJob, judgeRun.error, blindPacket),
    )
    return {
      job: leasedJob,
      result: {
        status: "judge_failed",
        successfulJudgments,
        targetSuccessfulJudgments: params.config.targetSuccessfulJudgments,
      },
    }
  }

  const completedJudgmentError = await captureOptionalTelemetryFailure(() =>
    appendResearchArtifact(params.supabase, {
      jobId: leasedJob.id,
      submissionId: leasedJob.submission_id,
      kind: "model_judgment",
      status: "completed",
      payload: {
        anonymous_order: blindPacket.laneByCandidate,
        experiment_id: MODEL_EVALUATION_EXPERIMENT_ID,
        preferred_candidate: judgeRun.output.preferredCandidate,
        preferred_lane: judgeRun.output.preferredLane,
        confidence: judgeRun.output.confidence,
        scores: judgeRun.output.scores,
        material_issues: judgeRun.output.materialIssues,
        rationale: judgeRun.output.rationale,
        judge_output_hash: judgeRun.outputHash,
      },
      confidence: judgeRun.output.confidence,
      model: params.config.judge.model,
      promptVersion: "product_intake_model_judge_v1",
    }),
  )
  if (completedJudgmentError) {
    return {
      job: leasedJob,
      result: {
        status: "telemetry_failed",
        successfulJudgments,
        targetSuccessfulJudgments: params.config.targetSuccessfulJudgments,
      },
    }
  }

  return {
    job: leasedJob,
    result: {
      status: "completed",
      successfulJudgments: successfulJudgments + 1,
      targetSuccessfulJudgments: params.config.targetSuccessfulJudgments,
      preferredLane: judgeRun.output.preferredLane,
    },
  }
}

async function persistModelJudgmentFailure(
  supabase: ReturnType<typeof createSupabaseClientFromEnv>,
  job: ProductIntakeResearchJob,
  error: string,
  blindPacket?: BlindJudgePacket,
) {
  return appendResearchArtifact(supabase, {
    jobId: job.id,
    submissionId: job.submission_id,
    kind: "model_judgment",
    status: "failed",
    payload: {
      anonymous_order: blindPacket?.laneByCandidate ?? null,
      experiment_id: MODEL_EVALUATION_EXPERIMENT_ID,
      error,
    },
    model: null,
    promptVersion: "product_intake_model_judge_v1",
  })
}

function toJsonRecord(value: unknown): JsonRecord {
  const normalized = normalizeRecord(JSON.parse(JSON.stringify(value)) as unknown)
  if (!normalized) throw new Error("Expected a JSON object for model-run persistence.")
  return normalized
}

export function imageProcessingFailureUpdate(params: {
  job: Pick<ProductIntakeResearchJob, "id" | "stage" | "locked_by" | "locked_at"> &
    Partial<Pick<ProductIntakeResearchJob, "attempt_count" | "max_attempts">>
  error: unknown
  promptPacketPath: string
  workerId: string
}) {
  if (codexInfrastructureCode(params.error)) {
    const update = researchFailureUpdate({
      ...params,
      job: {
        ...params.job,
        attempt_count: params.job.attempt_count ?? 1,
        max_attempts: params.job.max_attempts ?? 1,
      },
      executeCodex: true,
    })
    return { ...update, progress: { ...update.progress, mode: "local_image_processing" } }
  }
  const message = truncateDiagnostic(
    params.error instanceof Error ? params.error.message : "Image processing worker failed.",
  )
  return {
    jobId: params.job.id,
    status: "failed" as const,
    stage: params.job.stage,
    progress: {
      message,
      prompt_packet_path: params.promptPacketPath,
      worker_id: params.workerId,
      mode: "local_image_processing",
    },
    lastError: message,
    expectedLockedBy: params.job.locked_by,
    expectedLockedAt: params.job.locked_at,
  }
}

async function persistResearchOutput(params: {
  supabase: ReturnType<typeof createSupabaseClientFromEnv>
  job: ProductIntakeResearchJob
  workerId: string
  promptPacketPath: string
  researchOutput: CodexResearchOutput
  researchModel: string
  readiness: ResearchReadinessSelfCheck | null
}) {
  const created = []
  for (const artifact of params.researchOutput.artifacts) {
    const row = await appendResearchArtifact(params.supabase, {
      jobId: params.job.id,
      submissionId: params.job.submission_id,
      kind: artifact.kind,
      status: artifact.status ?? "proposed",
      confidence: artifact.confidence ?? null,
      payload: artifact.payload,
      sourceUrls: artifact.source_urls ?? null,
      model: params.researchModel,
      promptVersion: "product_intake_codex_research_v1",
    })
    created.push(row.id)
  }

  let savedSubmissionStatus: string | null = null
  let resolvedDecisionCount = 0
  const researchedPayload = params.researchOutput.researched_payload
  if (hasFinalResearchPayload(researchedPayload)) {
    const updated = await withJobLease(params.job.id, () =>
      saveSubmissionResearchPreview(params.supabase, {
        submissionId: params.job.submission_id,
        researchedPayload,
        status: params.readiness?.ok === true ? "ready_for_review" : "researching",
      }),
    )
    savedSubmissionStatus = updated.status
    if (params.job.stage === "rework") {
      resolvedDecisionCount = await withJobLease(params.job.id, () =>
        resolveReviewDecisionsForSubmission(params.supabase, params.job.submission_id),
      )
    }
  }

  return {
    summary: params.researchOutput.summary,
    artifact_ids: created,
    artifacts_created: created.length,
    blockers: params.researchOutput.blockers,
    saved_submission_status: savedSubmissionStatus,
    resolved_review_decisions: resolvedDecisionCount,
  }
}

export function writePromptPacket(
  job: ProductIntakeResearchJob,
  workerId: string,
  detail: ProductIntakeSubmissionDetail | null,
  brandResolutionContext: BrandResolutionPromptContext,
  retailerEnrichment: RetailerEnrichmentPacket | null,
): string {
  const dir = join(process.cwd(), "tmp", "product-intake-codex-worker")
  mkdirSync(dir, { recursive: true })

  const path = join(dir, `${job.id}.json`)
  writeFileSync(
    path,
    JSON.stringify(
      {
        job_id: job.id,
        submission_id: job.submission_id,
        status: job.status,
        stage: job.stage,
        worker_id: workerId,
        generated_at: new Date().toISOString(),
        instruction: "Research this product for the internal Product Intake Review Cockpit.",
        job_progress: job.progress ?? {},
        active_rework_request:
          job.stage === "rework" ? activeReworkRequestFromProgress(job.progress) : null,
        reviewer_request_contract: [
          "Treat active_rework_request.message as the latest reviewer instruction for this run.",
          "Latest reviewer instructions override stale blockers, stale no-result artifacts, and stale commercial search conclusions in current_payload or recent_artifacts.",
          "If active_rework_request names a concrete source URL, verify that URL directly before returning no-result for affiliate_link or price_eur.",
          "If a concrete reviewer-provided source URL is accepted, store the DB-ready URL, price, availability, identifiers, sources, and rationales in researched_payload.final.",
        ],
        product: {
          brand: detail?.brand ?? null,
          product_name: detail?.product_name ?? null,
          category: detail?.category ?? null,
          source: detail?.source ?? null,
        },
        brand_resolution_context: brandResolutionContext,
        retailer_enrichment: retailerEnrichment,
        retailer_enrichment_contract: retailerEnrichment
          ? [
              "This is a dm-provided research lead, not an approved catalog fact.",
              "The returned GTIN must equal scanned_identifier after canonical GTIN normalization; this packet omits mismatches.",
              "Use the verbatim ingredient text and product URL as a source lead, then independently verify identity, category, and properties.",
              "The raw retailer image is a candidate only: inspect it under image_source_contract and never use it as final.product.image_url.",
            ]
          : [],
        current_payload: detail?.payload ?? {},
        review_decisions: detail?.decisions ?? [],
        recent_artifacts: detail?.artifacts.slice(0, 20) ?? [],
        category_contract: categoryApprovalContract(detail?.category),
        image_source_contract: imageSourceContract(),
        commercial_source_contract: commercialSourceContract(),
        output_contract: {
          summary: "short human-readable summary",
          researched_payload:
            "complete product_submissions.researched_payload object with final.product and final.category_specs when enough evidence exists",
          approval_payload_schema: approvalPayloadContract(detail?.category),
          artifacts: `array using kind values: ${PRODUCT_INTAKE_ARTIFACT_KINDS.filter(isModelGeneratedArtifactKind).join(", ")}`,
          blockers:
            "array of strings; empty array only when ready for Nick review. Put review caveats in artifact payloads unless they block approval.",
          category_contract: categoryApprovalContract(detail?.category),
          image_source_contract: imageSourceContract(),
          commercial_source_contract: commercialSourceContract(),
        },
      },
      null,
      2,
    ),
  )
  return path
}

function activeReworkRequestFromProgress(progress: JsonRecord | null | undefined): JsonRecord {
  return {
    message: typeof progress?.message === "string" ? progress.message : null,
    requested_by: typeof progress?.requested_by === "string" ? progress.requested_by : null,
    requested_at: typeof progress?.requested_at === "string" ? progress.requested_at : null,
    rework_type: typeof progress?.rework_type === "string" ? progress.rework_type : null,
  }
}

function approvalPayloadContract(category: string | null | undefined): JsonRecord {
  return {
    researched_payload: {
      draft: "optional scratch object only; final review reads final.*",
      final: {
        product: {
          canonical_brand:
            "string; exact canonical brand table value from brand_resolution_context.resolved_brand.canonical_brand when present",
          product_line:
            "string or null; exact product_lines table value from brand_resolution_context.resolved_brand.product_line when present, otherwise researched stable product line/variant",
          clean_name: "string; product name without brand prefix when possible",
          category_key: normalizeCategoryKey(category) ?? "one supported product category key",
          suitable_thicknesses:
            "array containing every verified compatible hair diameter: fine, normal, coarse. Use [] only for heat_protectant, dry_shampoo, or scalp_care, whose authority does not use thickness.",
          affiliate_link:
            "string URL; chosen purchasable product-detail page following commercial_source_contract.purchase_url_preference. Must not be a search, listing, price-comparison, marketplace junk, or wrong-market page.",
          image_url: "string URL or null; raw candidate image before final processing",
          price_eur:
            "number; current EUR price from the chosen affiliate_link/PDP when available, or blocker if no acceptable price source exists",
          currency: "EUR",
          purchase_link_status: "available or unavailable",
          purchase_link_checked_at: "ISO timestamp with timezone",
          price_checked_at: "ISO timestamp with timezone",
        },
        identifiers:
          "array of {type,value,source}; type must be one of ean, gtin, barcode, retailer_sku, retailer_url. Use retailer_sku for manufacturer numbers, article numbers, product numbers, item numbers, or shop SKUs. Empty array is allowed if no identifier is available",
        category_specs:
          "object containing exactly the required category spec table(s) from category_contract.required_category_specs",
        sources: "array of {url,title,evidence}; must include at least one source",
        field_rationales:
          "object keyed by product.* and category_specs.* explaining the exact stored values",
        review:
          "omit or set manual_reviewed false; cockpit will stamp manual review only after Nick approves",
      },
    },
    strict_rules: [
      "Use brand_resolution_context.resolved_brand.canonical_brand exactly when it exists. Do not emit alternate spellings like Jean&Len if the catalog says Jean & Len.",
      "If resolved_brand is null and review_decisions includes an approved product.canonical_brand, use that approved reviewer_value.canonical_brand exactly as final.product.canonical_brand.",
      "Use reviewer-approved product identity fields exactly when review_decisions contains product identity approvals.",
      "If review_decisions includes approved product.product_line or product.clean_name, use reviewer-approved product identity fields exactly in final.product.",
      "If brand_resolution_context.resolved_brand is null, add a blocker explaining that canonical brand table resolution is missing before approval.",
      "Do not put product_mask_specs, product_leave_in_specs, product_shampoo_specs, or any other table-shaped category data inside final.product.",
      "Do not wrap category spec arrays in {rows: ...}. If a table is described as an array, final.category_specs.<table> itself must be the array.",
      "Use only approval-safe identifier types: ean, gtin, barcode, retailer_sku, retailer_url.",
      "Do not put source URLs as final.product.sources; use final.sources.",
      "Do not use search, category, brand listing, or price-comparison pages as affiliate_link.",
      "Choose affiliate_link and price_eur using commercial_source_contract, including the shared purchase URL preference for every category and denylisted hosts.",
      "Before blocking affiliate_link or price_eur, prove targeted_preferred_retailer_searches were attempted for the top preferred hosts.",
      "If any required final.product field cannot be researched, leave blockers non-empty and explain the missing field.",
      "The review cockpit shows final.product and final.category_specs exactly as they will be written to the database.",
    ],
  }
}

function commercialSourceContract(): JsonRecord {
  return {
    goal: "Choose the product URL and price source that should be reviewed and stored for this new product.",
    source_priority: [
      "Official brand/manufacturer product page",
      "Reputable retailer PDPs: dm, Rossmann, Müller, Douglas, Hagel-Shop, Flaconi, Notino, similar stable shops",
      "Barcode/GTIN lookup",
      "Secondary listings only when primary sources are missing",
      "User photo/OCR only as identity evidence",
    ],
    purchase_url_preference: "dm > Rossmann > Müller > brand-direct > Amazon DE",
    host_allowlist: [
      "dm.de",
      "rossmann.de",
      "mueller.de",
      "amazon.de",
      "douglas.de",
      "flaconi.de",
      "notino.de",
      "otto.de",
      "hagel-shop.de",
    ],
    targeted_preferred_retailer_searches: [
      "Before declaring no acceptable affiliate_link, run a mandatory search audit across the purchase_url_preference order and every host in host_allowlist using the submitted brand and submitted product name, then the researched canonical identity.",
      "Use explicit preferred-host queries including: site:dm.de <brand> <submitted product name>, site:rossmann.de <brand> <submitted product name>, site:mueller.de <brand> <submitted product name>, site:douglas.de <brand> <submitted product name>, site:hagel-shop.de <brand> <submitted product name>, site:flaconi.de <brand> <submitted product name>, site:notino.de <brand> <submitted product name>, site:otto.de <brand> <submitted product name>, site:amazon.de <brand> <submitted product name>.",
      "Also search brand-direct/official manufacturer sources using the brand name plus product name. Use official pages for identity/source evidence; choose affiliate_link using purchase_url_preference even when the official page is buyable.",
      "Repeat the mandatory search audit with stable researched identity terms if the submitted wording differs from the researched canonical identity.",
      "For every category, choose a matching purchasable PDP in this order: dm, Rossmann, Müller, brand-direct, Amazon DE. Manufacturer-first identity evidence does not change this purchase URL order. Other reputable retailers are fallbacks after the preferred sources have been checked.",
      "Record an inaccessible shop as unverified; do not treat a blocked page or search as evidence that the product is absent.",
      "If a preferred retailer has a matching PDP but the page is JavaScript-backed, use search-result snippets or page structured data as supporting evidence and include the PDP URL in final.sources.",
    ],
    host_denylist: [
      "idealo.de",
      "geizhals.de",
      "billiger.de",
      "preisvergleich.de",
      "ebay.de",
      "ebay.com",
      "kleinanzeigen.de",
      "aliexpress.com",
      "amazon.com for German market",
    ],
    reject_url_types: [
      "Reject price comparison pages.",
      "Reject search/category/brand listing pages.",
      "Reject eBay, Kleinanzeigen, AliExpress, and similar marketplace/secondhand listings.",
      "Reject amazon.com for German market; use amazon.de only as fallback.",
      "Reject non-German-market PDPs unless no German/EU source exists and the product identity evidence is still useful.",
    ],
    price_rules: [
      "Prefer price_eur from the same accepted purchasable PDP used as affiliate_link.",
      "Package size and price do not outrank the purchase URL preference. Keep the chosen URL, package size, and price aligned to one verified purchasable variant of the same product.",
      "If the best identity source is official brand but not purchasable, use it in final.sources and choose the best purchasable retailer PDP for affiliate_link.",
      "Set purchase_link_status to available only when the chosen PDP is purchase-capable/in stock; otherwise unavailable.",
      "If only identity evidence exists and no acceptable purchasable PDP with price exists, add a blocker instead of inventing price_eur.",
    ],
    rationale_rules: [
      "field_rationales.product.affiliate_link must explain the chosen shop's priority and the checks of any higher-priority shops, distinguishing unavailable offers from unverified shops.",
      "field_rationales.product.price_eur must name the exact source and availability state.",
      "final.sources should include the official/identity source and the chosen purchase/price source when they differ.",
    ],
  }
}

function codexBinaryForWorker(): string {
  const configured = process.env.PRODUCT_INTAKE_CODEX_BIN?.trim()
  if (configured) return configured
  if (process.platform === "darwin" && existsSync(CODEX_APP_BINARY)) return CODEX_APP_BINARY
  return "codex"
}

function imageSourceContract(): JsonRecord {
  return {
    goal: "Find an image Nick can approve as the raw source before Chaarlie background removal and final sizing.",
    ideal_candidate: [
      "Exact same product and variant: brand, line, product name, packaging type, and size must match when visible.",
      "Single saleable product unit only: the actual bottle, jar, tube, tub, spray, pouch, or sachet that the user buys.",
      "Front-facing packshot with the whole product visible and not cut off; no outer box, carton, bundle, or secondary packaging.",
      "Transparent alpha PNG/WebP preferred; otherwise plain white or very light background that can be cleanly removed.",
      "No visible shadow, halo, base reflection, mirrored floor, or dark product pedestal is the preferred standard.",
      "High enough resolution for review and final 1200x1200 processing; prefer at least 800px on the long side.",
      "Label should be readable enough to confirm product identity where possible.",
      "Only accept a mild removable base reflection or soft product shadow as a fallback after comparing cleaner exact candidates, and only when the image is exact, product-only, front-facing, high-resolution, and the processing pipeline can crop/normalize/QA it.",
    ],
    selection_priority: [
      "First prove exact identity: market/region, brand, line, product name, package type, size, and visible variant must match.",
      "Then prefer product-only front shots: the saleable product alone, full height, no box, no bundle, no hand, no lifestyle scene.",
      "Then prefer processing cleanliness: transparent alpha or clean white/light background with no shadow, halo, reflection, or watermarks.",
      "Then prefer resolution and legibility: at least 800px on the long side and readable enough to confirm the label.",
      "If the only exact high-resolution product-only source has a mild removable base reflection, choose it over a cleaner but wrong-region, wrong-variant, tiny, box-only, or product-plus-box image, and mark image_type mild_removable_reflection.",
    ],
    reject_candidates: [
      "Reject images with outer boxes, cartons, secondary packaging, bundle shots, multipacks, or product plus box. Do not use box-only or bottle-plus-box images as the approval candidate; list them only as rejected evidence.",
      "Reject lifestyle, model, bathroom, shelf, hand-held, editorial, before/after, or mood images.",
      "Reject dark backgrounds, heavy reflections, strong shadows, halos, watermarks, retailer badges, sale overlays, or cropped products. Mild removable base reflection on an otherwise exact product-only packshot can be accepted only as fallback mild_removable_reflection.",
      "Reject images that show a different variant, size, old packaging, regional label mismatch, or a generic brand-family image.",
      "Reject tiny thumbnails or images that cannot be visually inspected in the review cockpit.",
    ],
    fallback_rule:
      "Do not choose a mediocre image. If no candidate meets the standard, set an image_candidate artifact with status needs_image_search, explain exactly why, name the best rejected candidate, and add a blocker requesting manual/Codex web image search.",
    required_image_candidate_payload: {
      image_url:
        "direct renderable image URL for the best candidate, only if it meets the standard",
      source_page_url: "product page URL proving the image belongs to the exact product",
      image_type:
        "one of transparent_cutout, white_background_packshot, retailer_packshot_needs_processing, official_packshot_needs_processing, mild_removable_reflection, needs_manual_search",
      depicts: "short description of exactly what is visible",
      identity_match:
        "explain how brand, line, product name, package type, size, and variant match or which part is uncertain",
      background_quality:
        "transparent, plain_light, removable_white, dark_or_complex, lifestyle, or unknown",
      packaging_quality: "product_only, includes_outer_box, bundle, multipack, cropped, or unknown",
      processing_notes:
        "what background removal/finalization will need to do, or why the candidate should be rejected",
      rejected_alternatives:
        "short comparison of cleaner-looking candidates that were rejected because they were box-only, product-plus-box, wrong region, wrong variant, old packaging, too small, or otherwise worse",
    },
  }
}

export function categoryApprovalContract(category: string | null | undefined): JsonRecord {
  const categoryKey = normalizeCategoryKey(category)
  if (categoryKey) return CATEGORY_RESEARCH_REGISTRY[categoryKey].promptContract()
  return {
    category_key: category ?? null,
    instruction:
      "Research only the category_specs required by this product category's approval validator. Put them under researched_payload.final.category_specs, never inside researched_payload.final.product. Do not emit category_specs for other product categories.",
  }
}

export function normalizeResearchOutputForCategory(
  output: CodexResearchOutput,
  category: string | null | undefined,
  brandResolutionContext: BrandResolutionPromptContext,
  reviewDecisions: ProductIntakeReviewDecisionRow[],
  expectedResearchId: string,
  options: InciStageOptions & { brandCatalog?: BrandResolutionCatalogInput } = {},
): CodexResearchOutput {
  const categoryKey = normalizeCategoryKey(category)
  if (!categoryKey) return output

  const researchedPayload =
    normalizeCategoryResearchedPayload(output.researched_payload, categoryKey, output.artifacts) ??
    {}
  const artifacts = [...output.artifacts]
  let blockers = output.blockers.filter(
    (blocker) => !/^inci_(missing_first_pass|unavailable):/.test(blocker),
  )
  const final = normalizeRecord(researchedPayload?.final)
  const identityBlocker = applyIdentityStage({
    final,
    context: brandResolutionContext,
    reviewDecisions,
    artifacts,
    brandCatalog: options.brandCatalog,
  })
  if (identityBlocker) blockers.push(identityBlocker)
  else if (
    artifacts.some(
      (artifact) => artifact.kind === "identity_candidate" && artifact.status === "resolved",
    )
  ) {
    blockers = blockers.filter(
      (blocker) => !blocker.startsWith("canonical brand table resolution missing for:"),
    )
  }
  const categorySpecs = normalizeRecord(final?.category_specs)

  const engine = CATEGORY_RESEARCH_REGISTRY[categoryKey]
  let projected = false
  const projectionArtifact = artifacts.find(
    (artifact) =>
      artifact.kind === "property_synthesis" &&
      artifact.payload[`${categoryKey}_research_envelope`] != null,
  )
  if (final) {
    const adapterResult = engine.apply({ final, artifacts, expectedResearchId })
    blockers.push(...adapterResult.blockers)
    projected = adapterResult.blockers.length === 0
    // Model-authored provenance cannot override the running server registry.
    delete final.engine
    const draft = normalizeRecord(researchedPayload?.draft)
    if (engine.state === "active") {
      if (draft) delete draft.engine
    } else if (researchedPayload) {
      researchedPayload.draft = {
        ...draft,
        engine:
          engine.state === "pending_lock"
            ? { state: engine.state, id: engine.engineId, target: engine.methodology }
            : { state: engine.state },
      }
    }
  }
  if (
    engine.state === "active" &&
    final &&
    !artifacts.some((artifact) => artifact.kind === "property_synthesis")
  ) {
    artifacts.push({ kind: "property_synthesis", status: "needs_research", payload: {} })
  }
  for (const artifact of artifacts) {
    if (artifact.kind !== "property_synthesis") continue
    if (engine.state === "active" && final) {
      const projection =
        projected && artifact === projectionArtifact
          ? normalizeRecord(artifact.payload[`${categoryKey}_production_projection`])
          : null
      const profile = normalizeRecord(
        normalizeRecord(projection?.category_specs)?.product_bondbuilder_specs,
      )
      const researchProfile = normalizeRecord(profile?.research_profile)
      artifact.payload.engine = {
        id: engine.engineId,
        methodology: engine.methodology,
        adapter: engine.adapter,
        state: engine.state,
        input_hash:
          categoryKey === "bondbuilder"
            ? stringValue(normalizeRecord(researchProfile?.method)?.output_sha256)
            : stringValue(projection?.research_input_sha256),
        projection_hash:
          categoryKey === "bondbuilder"
            ? stringValue(normalizeRecord(researchProfile?.review)?.profile_sha256)
            : stringValue(projection?.projection_sha256),
      }
    } else delete artifact.payload.engine
  }

  // Read AFTER the category adapter: applyLeaveInResearchAdapter reassigns
  // `categorySpecs.product_leave_in_specs` to a brand-new projected object
  // (structuredClone) rather than mutating the original in place, so a
  // reference captured before it runs is stale — it still points at
  // whatever `product_leave_in_specs` looked like pre-adapter (e.g. `{}` on
  // an envelope submission), even though the adapter has since written a
  // fully valid table. Re-reading here validates the object the adapter
  // actually produced, for both the envelope path and the legacy/non-envelope
  // path (where the adapter never ran and this is unchanged from before).
  const leaveInSpecs = normalizeRecord(categorySpecs?.product_leave_in_specs)

  if (leaveInSpecs) {
    const normalizedStages = normalizeLeaveInApplicationStages(leaveInSpecs.application_stage)
    leaveInSpecs.application_stage = normalizedStages
    if (normalizedStages.length === 0) {
      blockers.push("leave_in application_stage has no valid value")
    }
  }
  const missingSpecTables = missingCategorySpecTables(categorySpecs, categoryKey)
  if (missingSpecTables.length > 0) {
    blockers.push(`missing category_specs for ${categoryKey}: ${missingSpecTables.join(", ")}`)
  }
  const missingProductFields = missingFinalProductFields(final)
  if (missingProductFields.length > 0) {
    blockers.push(`missing final.product fields: ${missingProductFields.join(", ")}`)
  }
  const missingFinalSections = missingFinalApprovalSections(final)
  if (missingFinalSections.length > 0) {
    blockers.push(`missing final payload sections: ${missingFinalSections.join(", ")}`)
  }
  const inciBlocker = applyInciStage(researchedPayload, artifacts, engine, options)
  if (inciBlocker) blockers.push(inciBlocker)

  return {
    ...output,
    researched_payload: researchedPayload,
    artifacts: artifacts.map((artifact) => ({
      ...artifact,
      payload: normalizeCategoryArtifactPayload(artifact.payload, categoryKey),
    })),
    blockers: dedupeStrings(blockers),
  }
}

/**
 * Scan-specific fields are fetched directly because ProductIntakeSubmissionDetail
 * deliberately does not select them. This keeps the shared core repository
 * contract unchanged while giving the worker an exact-GTIN-checked dm lead.
 */
export async function loadScanIntakeSeedForSubmission(
  supabase: ReturnType<typeof createSupabaseClientFromEnv>,
  submissionId: string,
): Promise<ScanIntakeSeed> {
  const { data, error } = await supabase
    .from("product_submissions")
    .select("scanned_identifier_type, scanned_identifier_value, intake_history")
    .eq("id", submissionId)
    .maybeSingle()
  if (error) {
    throw new Error(`load scanned identifier for product-intake Codex worker: ${error.message}`)
  }

  const row = data as {
    scanned_identifier_type: string | null
    scanned_identifier_value: string | null
    intake_history: unknown
  } | null
  const scannedIdentifier =
    row?.scanned_identifier_type && row.scanned_identifier_value
      ? { type: row.scanned_identifier_type, value: row.scanned_identifier_value }
      : null

  const retailerEnrichment = parseRetailerEnrichmentPacket(row?.intake_history, scannedIdentifier)
  return {
    scannedIdentifier,
    retailerEnrichment: retailerEnrichment.packet,
    retailerEnrichmentWarning: retailerEnrichment.warning,
  }
}

function normalizeCategoryResearchedPayload(
  value: JsonRecord | null | undefined,
  categoryKey: CategoryContractKey,
  artifacts: CodexResearchArtifactOutput[] = [],
): JsonRecord | null | undefined {
  if (!value) return value
  const cloned = cloneJsonRecord(value)
  const final = normalizeRecord(cloned.final)
  const categorySpecs = ensureCategorySpecs(final)
  if (final && categorySpecs) {
    hoistCategorySpecsFromRecord(categorySpecs, normalizeRecord(final.product), categoryKey)
    for (const artifact of artifacts) {
      hoistCategorySpecsFromRecord(categorySpecs, artifact.payload, categoryKey)
      const artifactSpecs = normalizeRecord(artifact.payload.category_specs)
      hoistCategorySpecsFromRecord(categorySpecs, artifactSpecs, categoryKey)
    }
    sanitizeCategorySpecs(categorySpecs, categoryKey)
  }
  return cloned
}

function ensureCategorySpecs(final: JsonRecord | null | undefined): JsonRecord | null {
  if (!final) return null
  const existing = normalizeRecord(final.category_specs)
  if (existing) return existing
  const created: JsonRecord = {}
  final.category_specs = created
  return created
}

function hoistCategorySpecsFromRecord(
  target: JsonRecord,
  source: JsonRecord | null | undefined,
  categoryKey: CategoryContractKey,
): void {
  if (!source) return
  for (const key of CATEGORY_SPEC_KEYS[categoryKey]) {
    if (source[key] === undefined || target[key] !== undefined) continue
    target[key] = cloneJsonValue(source[key])
    delete source[key]
  }
}

function missingCategorySpecTables(
  categorySpecs: JsonRecord | null | undefined,
  categoryKey: CategoryContractKey,
): string[] {
  if (!categorySpecs) return [...REQUIRED_CATEGORY_SPEC_KEYS[categoryKey]]
  return REQUIRED_CATEGORY_SPEC_KEYS[categoryKey].filter((key) => categorySpecs[key] === undefined)
}

function missingFinalProductFields(final: JsonRecord | null | undefined): string[] {
  const product = normalizeRecord(final?.product)
  if (!product) {
    return [
      "canonical_brand",
      "clean_name",
      "category_key",
      "suitable_thicknesses",
      "affiliate_link",
      "image_url",
      "price_eur",
      "currency",
      "purchase_link_status",
      "purchase_link_checked_at",
      "price_checked_at",
    ]
  }

  return [
    "canonical_brand",
    "clean_name",
    "category_key",
    "suitable_thicknesses",
    "affiliate_link",
    "image_url",
    "price_eur",
    "currency",
    "purchase_link_status",
    "purchase_link_checked_at",
    "price_checked_at",
  ].filter((key) => product[key] === undefined || product[key] === null || product[key] === "")
}

function missingFinalApprovalSections(final: JsonRecord | null | undefined): string[] {
  const missing: string[] = []
  if (!Array.isArray(final?.sources) || final.sources.length === 0) missing.push("sources")
  const rationales = normalizeRecord(final?.field_rationales)
  if (!rationales || Object.keys(rationales).length === 0) missing.push("field_rationales")
  return missing
}

function sanitizeCategorySpecs(
  categorySpecs: JsonRecord,
  categoryKey: CategoryContractKey,
): JsonRecord {
  const allowed = new Set<string>(CATEGORY_SPEC_KEYS[categoryKey])
  for (const key of Object.keys(categorySpecs)) {
    if (!allowed.has(key)) delete categorySpecs[key]
  }
  normalizeCategorySpecTableShapes(categorySpecs)

  return categorySpecs
}

function normalizeCategorySpecTableShapes(categorySpecs: JsonRecord): void {
  for (const [key, value] of Object.entries(categorySpecs)) {
    const record = normalizeRecord(value)
    if (!record || !Array.isArray(record.rows)) continue
    categorySpecs[key] = ARRAY_CATEGORY_SPEC_TABLES.has(key)
      ? cloneJsonValue(record.rows)
      : cloneJsonValue(record.rows[0])
  }
}

function normalizeCategoryArtifactPayload(
  value: JsonRecord,
  categoryKey: CategoryContractKey,
): JsonRecord {
  const cloned = cloneJsonRecord(value)
  const categorySpecs = normalizeRecord(cloned.category_specs)
  if (categorySpecs) sanitizeCategorySpecs(categorySpecs, categoryKey)
  if (categoryKey === "leave_in") normalizeLeaveInSpecRecord(cloned)
  return cloned
}

function normalizeLeaveInSpecRecord(value: JsonRecord): void {
  const categorySpecs = normalizeRecord(value.category_specs)
  const leaveInSpecs =
    normalizeRecord(categorySpecs?.product_leave_in_specs) ??
    normalizeRecord(value.product_leave_in_specs)
  if (leaveInSpecs) {
    leaveInSpecs.application_stage = normalizeLeaveInApplicationStages(
      leaveInSpecs.application_stage,
    )
  }
}

function normalizeLeaveInApplicationStages(value: unknown): string[] {
  const source = Array.isArray(value) ? value : typeof value === "string" ? [value] : []
  const allowed = new Set<string>(LEAVE_IN_APPLICATION_STAGES)
  return dedupeStrings(
    source.flatMap((item) => {
      if (typeof item !== "string") return []
      const normalized = item.trim().toLowerCase()
      const mapped = normalized === "post_wash" ? "towel_dry" : normalized
      return allowed.has(mapped) ? [mapped] : []
    }),
  )
}

function cloneJsonRecord(value: JsonRecord): JsonRecord {
  return JSON.parse(JSON.stringify(value)) as JsonRecord
}

function cloneJsonValue(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))]
}

function buildPreviewOnlyOutput(
  job: ProductIntakeResearchJob,
  detail: ProductIntakeSubmissionDetail | null,
  promptPacketPath: string,
): CodexResearchOutput {
  const productLabel = [detail?.brand, detail?.product_name].filter(Boolean).join(" ").trim()
  const basePayload = {
    submission_id: job.submission_id,
    product_label: productLabel || "Unbekanntes Produkt",
    category: detail?.category ?? null,
    prompt_packet_path: promptPacketPath,
  }

  return {
    summary: "Preview-only mode: Codex CLI research was not executed.",
    researched_payload: null,
    artifacts: [
      {
        kind: "identity_candidate",
        status: "needs_review",
        confidence: productLabel ? 0.55 : 0.2,
        payload: {
          ...basePayload,
          proposed_identity: {
            brand: detail?.brand ?? null,
            product_name: detail?.product_name ?? null,
            category: detail?.category ?? null,
          },
        },
      },
      {
        kind: "property_synthesis",
        status: "needs_research",
        confidence: 0.1,
        payload: {
          ...basePayload,
          fields: [],
          note: "Run the worker with --execute-codex to synthesize properties.",
        },
      },
      {
        kind: "image_candidate",
        status: "needs_image_search",
        confidence: 0,
        payload: {
          ...basePayload,
          candidates: [],
          note: "Run the worker with --execute-codex to search and judge image candidates.",
        },
      },
    ],
    blockers: ["Codex CLI research was not executed. Run the worker with --execute-codex."],
    next_stage: "source_research",
  }
}

async function runCodexResearch(
  promptPacketPath: string,
  runtimeConfig: CodexResearchRuntimeConfig,
  lane: Extract<ProductIntakeModelLane, "production_low" | "challenger_medium">,
): Promise<CodexResearchOutput> {
  const prompt = [
    "You are researching one user-submitted hair product for Chaarlie's internal Product Intake Review Cockpit.",
    "Read the JSON prompt packet below. Do not edit repository files, do not write to databases, and do not approve or publish anything.",
    "Find high-confidence evidence for identity, product properties, and a suitable product image when possible.",
    "Follow image_source_contract strictly. Do not choose a mediocre image just to avoid a blocker.",
    "Follow commercial_source_contract strictly for affiliate_link, price_eur, purchase_link_status, and price/purchase rationales.",
    "Return only the JSON object required by the output schema. Use blockers for uncertainty or missing image/property evidence.",
    "",
    readFileSync(promptPacketPath, "utf8"),
  ].join("\n")

  return normalizeCodexOutput(
    await runCodexJson({
      outputPath: outputPathForModelLane(promptPacketPath, lane),
      prompt,
      runtimeConfig,
    }),
  )
}

async function runCodexJudge(
  promptPacketPath: string,
  blindPacket: BlindJudgePacket,
  runtimeConfig: CodexResearchRuntimeConfig,
): Promise<ModelJudgeVerdict> {
  const prompt = [
    "You are the read-only quality judge for two anonymized Product Intake research drafts.",
    "Do not research the product again, edit files, write databases, or approve publication.",
    "Compare only the supplied candidates against this rubric:",
    "- identity: exact product/package identity and identifier consistency",
    "- evidence: source authority, traceability, and claim support",
    "- completeness: required identity, commercial, property, category, and image evidence",
    "- uncertainty: honest blockers and no false-ready claims",
    "Return one JSON object with preferred_candidate (A, B, or tie), confidence (0..1), scores for A and B with identity/evidence/completeness/uncertainty each 0..5, material_issues as strings, and a non-empty rationale.",
    "Candidates are intentionally anonymous; never infer which model produced either candidate.",
    "",
    JSON.stringify({ candidates: blindPacket.candidates }),
  ].join("\n")

  const value = await runCodexJson({
    outputPath: outputPathForModelLane(promptPacketPath, "judge"),
    prompt,
    runtimeConfig,
    webSearch: "disabled",
  })
  return normalizeModelJudgeVerdict(value, blindPacket.laneByCandidate)
}

type CodexInfrastructureCode = "codex_timeout" | "infra_auth"

class CodexInfrastructureError extends Error {
  constructor(
    readonly code: CodexInfrastructureCode,
    detail: string,
  ) {
    super(truncateDiagnostic(`${code}: ${detail}`))
    this.name = "CodexInfrastructureError"
  }
}

function codexInfrastructureCode(error: unknown): CodexInfrastructureCode | null {
  if (!(error instanceof Error)) return null
  if (error.message.startsWith("codex_timeout:")) return "codex_timeout"
  if (error.message.startsWith("infra_auth:")) return "infra_auth"
  return null
}

function positiveDurationMs(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

export async function runCodexJson(
  params: {
    outputPath: string
    prompt: string
    runtimeConfig: CodexResearchRuntimeConfig
    webSearch?: "disabled" | "live"
    imagePaths?: string[]
  },
  spawn: WorkerSpawn = runWorkerProcess,
): Promise<JsonRecord> {
  const codexBinary = codexBinaryForWorker()

  const run = await spawn(
    codexBinary,
    codexResearchExecArgs({
      cwd: process.cwd(),
      outputPath: params.outputPath,
      prompt: params.prompt,
      runtimeConfig: params.runtimeConfig,
      webSearch: params.webSearch,
      imagePaths: params.imagePaths,
    }),
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1024 * 1024 * 20,
      timeout: CODEX_RESEARCH_TIMEOUT_MS,
    },
  )

  if (run.error && "code" in run.error && run.error.code === "ETIMEDOUT") {
    throw new CodexInfrastructureError(
      "codex_timeout",
      `Codex CLI timed out after ${CODEX_RESEARCH_TIMEOUT_MS / 1000}s (${codexBinary}): ${run.error.message}`,
    )
  }
  if (
    (run.error || run.signal || run.status !== 0) &&
    /\bnot logged in\b|\blog[ -]?in required\b|\b401\b|\bunauthori[sz]ed\b|\btoken (?:has )?expired\b(?! or nearly expired)/i.test(
      run.stderr,
    )
  ) {
    throw new CodexInfrastructureError(
      "infra_auth",
      `Codex CLI authentication failed (${codexBinary}): ${run.stderr || "no output"}`,
    )
  }
  if (run.error) {
    throw new Error(
      truncateDiagnostic(`Codex CLI failed to start (${codexBinary}): ${run.error.message}`),
    )
  }
  if (run.signal) {
    throw new Error(
      truncateDiagnostic(
        `Codex CLI terminated by ${run.signal} after up to ${CODEX_RESEARCH_TIMEOUT_MS / 1000}s: ${
          run.stderr || run.stdout || "no output"
        }`,
      ),
    )
  }
  if (run.status !== 0) {
    throw new Error(
      truncateDiagnostic(
        `Codex CLI failed (${codexBinary}, exit ${run.status}): ${
          run.stderr || run.stdout || "no output"
        }`,
      ),
    )
  }
  if (!existsSync(params.outputPath)) {
    throw new Error(`Codex CLI did not write ${params.outputPath}`)
  }

  return parseJsonObject(readFileSync(params.outputPath, "utf8"))
}

export function codexResearchRuntimeConfig(
  env: Readonly<Record<string, string | undefined>>,
): CodexResearchRuntimeConfig {
  const config = {
    model: nonBlankEnv(env.PRODUCT_INTAKE_CODEX_RESEARCH_MODEL, "gpt-6-luna"),
    reasoningEffort: nonBlankEnv(env.PRODUCT_INTAKE_CODEX_RESEARCH_REASONING_EFFORT, "low"),
    serviceTier: optionalServiceTier(env.PRODUCT_INTAKE_CODEX_SERVICE_TIER),
  }
  assertAllowedProductIntakeModel(config.model, "production research")
  return config
}

export function modelEvaluationRuntimeConfig(
  env: Readonly<Record<string, string | undefined>>,
): ModelEvaluationRuntimeConfig {
  const challenger = {
    model: nonBlankEnv(env.PRODUCT_INTAKE_CODEX_CHALLENGER_MODEL, "gpt-6-luna"),
    reasoningEffort: nonBlankEnv(env.PRODUCT_INTAKE_CODEX_CHALLENGER_REASONING_EFFORT, "medium"),
    serviceTier: optionalServiceTier(env.PRODUCT_INTAKE_CODEX_CHALLENGER_SERVICE_TIER),
  }
  const judge = {
    model: nonBlankEnv(env.PRODUCT_INTAKE_CODEX_JUDGE_MODEL, "gpt-6-sol"),
    reasoningEffort: nonBlankEnv(env.PRODUCT_INTAKE_CODEX_JUDGE_REASONING_EFFORT, "medium"),
    serviceTier: optionalServiceTier(env.PRODUCT_INTAKE_CODEX_JUDGE_SERVICE_TIER),
  }
  assertAllowedProductIntakeModel(challenger.model, "shadow challenger")
  assertAllowedProductIntakeModel(judge.model, "judge")

  return {
    enabled: env.PRODUCT_INTAKE_CODEX_SHADOW_ENABLED?.trim().toLowerCase() !== "false",
    targetSuccessfulJudgments: positiveIntegerEnv(env.PRODUCT_INTAKE_CODEX_SHADOW_TARGET, 10),
    challenger,
    judge,
  }
}

function positiveIntegerEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value?.trim() ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function shouldRunShadowExperiment(params: {
  enabled: boolean
  successfulJudgments: number
  target: number
}): boolean {
  return params.enabled && params.successfulJudgments < params.target
}

export function outputPathForModelLane(
  promptPacketPath: string,
  lane: ProductIntakeModelLane,
): string {
  return promptPacketPath.replace(/\.json$/, `.${lane}.codex-output.json`)
}

export function buildBlindJudgePacket(
  production: JsonRecord,
  challenger: JsonRecord,
  swap = Math.random() >= 0.5,
): BlindJudgePacket {
  if (swap) {
    return {
      candidates: { A: challenger, B: production },
      laneByCandidate: { A: "challenger_medium", B: "production_low" },
    }
  }
  return {
    candidates: { A: production, B: challenger },
    laneByCandidate: { A: "production_low", B: "challenger_medium" },
  }
}

export function normalizeModelJudgeVerdict(
  value: JsonRecord,
  laneByCandidate: BlindJudgePacket["laneByCandidate"],
): ModelJudgeVerdict {
  const preferred = value.preferred_candidate
  if (preferred !== "A" && preferred !== "B" && preferred !== "tie") {
    throw new Error("Model judge verdict requires preferred_candidate A, B, or tie.")
  }
  const confidence = boundedNumber(value.confidence, 0, 1, "confidence")
  const rawScores = normalizeRecord(value.scores)
  if (!rawScores) throw new Error("Model judge verdict requires scores.")
  const scores = {
    A: normalizeJudgeDimensionScores(rawScores.A, "A"),
    B: normalizeJudgeDimensionScores(rawScores.B, "B"),
  }
  const materialIssues = normalizeStringArray(value.material_issues) ?? []
  if (typeof value.rationale !== "string" || value.rationale.trim().length === 0) {
    throw new Error("Model judge verdict requires rationale.")
  }

  return {
    preferredCandidate: preferred,
    preferredLane: preferred === "tie" ? "tie" : laneByCandidate[preferred],
    confidence,
    scores,
    materialIssues,
    rationale: value.rationale.trim(),
  }
}

function normalizeJudgeDimensionScores(
  value: unknown,
  candidate: BlindCandidateLabel,
): ModelJudgeDimensionScores {
  const scores = normalizeRecord(value)
  if (!scores) throw new Error(`Model judge verdict requires scores for candidate ${candidate}.`)
  return {
    identity: boundedNumber(scores.identity, 0, 5, `${candidate}.identity`),
    evidence: boundedNumber(scores.evidence, 0, 5, `${candidate}.evidence`),
    completeness: boundedNumber(scores.completeness, 0, 5, `${candidate}.completeness`),
    uncertainty: boundedNumber(scores.uncertainty, 0, 5, `${candidate}.uncertainty`),
  }
}

export function codexResearchExecArgs(params: {
  cwd: string
  outputPath: string
  prompt: string
  runtimeConfig: CodexResearchRuntimeConfig
  webSearch?: "disabled" | "live"
  imagePaths?: string[]
}): string[] {
  return [
    "exec",
    "--skip-git-repo-check",
    "-m",
    params.runtimeConfig.model,
    "-c",
    `model_reasoning_effort="${params.runtimeConfig.reasoningEffort}"`,
    ...(params.runtimeConfig.serviceTier
      ? ["-c", `service_tier="${params.runtimeConfig.serviceTier}"`]
      : []),
    ...(params.webSearch ? ["-c", `web_search="${params.webSearch}"`] : []),
    ...(params.imagePaths && params.imagePaths.length > 0 ? ["-i", ...params.imagePaths] : []),
    "--cd",
    params.cwd,
    "--sandbox",
    "read-only",
    "--output-last-message",
    params.outputPath,
    params.prompt,
  ]
}

function normalizeCodexOutput(value: JsonRecord): CodexResearchOutput {
  const artifacts = Array.isArray(value.artifacts)
    ? value.artifacts.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return []
        const record = item as JsonRecord
        const kind = normalizeArtifactKind(record.kind ?? record.type)
        if (!isModelGeneratedArtifactKind(kind)) return []
        const payload = normalizeRecord(record.payload) ?? artifactPayloadFromRecord(record)
        return [
          {
            kind,
            status: typeof record.status === "string" ? record.status : "proposed",
            confidence: normalizeConfidence(record.confidence),
            payload,
            source_urls: normalizeStringArray(record.source_urls),
          },
        ]
      })
    : []
  const blockers = normalizeBlockers(value.blockers)
  const nextStage =
    typeof value.next_stage === "string" && isJobStage(value.next_stage)
      ? value.next_stage
      : undefined

  return {
    summary: typeof value.summary === "string" ? value.summary : "Codex research completed.",
    researched_payload: normalizeResearchPayload(value.researched_payload),
    artifacts,
    blockers,
    next_stage: nextStage,
  }
}

function projectJob(
  job: ProductIntakeResearchJob,
  promptPacketPath: string,
  executeCodex: boolean,
): WorkerResult["jobs"][number] {
  return {
    id: job.id,
    submission_id: job.submission_id,
    status: job.status,
    stage: job.stage,
    prompt_packet_path: promptPacketPath,
    mode: executeCodex ? "codex_cli" : "preview_only",
  }
}

function normalizeResearchPayload(value: unknown): JsonRecord | null {
  const record = normalizeRecord(value)
  if (!record) return null
  if (normalizeRecord(record.final)) return sanitizedResearchPayload(record)
  const draft = normalizeRecord(record.draft)
  if (draft) return sanitizedResearchPayload({ ...record, final: draft })
  return sanitizedResearchPayload(record)
}

function sanitizedResearchPayload(record: JsonRecord): JsonRecord {
  const payload: JsonRecord = {}
  if (record.draft !== undefined) payload.draft = record.draft
  if (record.final !== undefined) payload.final = record.final
  return payload
}

function normalizeConfidence(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value))
  }
  if (typeof value !== "string") return null

  switch (value.trim().toLowerCase()) {
    case "high":
      return 0.85
    case "medium":
      return 0.6
    case "low":
      return 0.3
    default:
      return null
  }
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : []
}

function normalizeBlockers(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim().length > 0) return [item.trim()]
    const record = normalizeRecord(item)
    if (!record) return []
    const message = [record.code, record.severity, record.message]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .join(": ")
    return message ? [message] : []
  })
}

function normalizeArtifactKind(value: unknown): string {
  if (typeof value !== "string") return ""
  switch (value) {
    case "identity":
      return "identity_candidate"
    case "source":
      return "source_page"
    case "property":
      return "property_synthesis"
    case "image":
      return "image_candidate"
    case "preview":
      return "publication_preview"
    case "identifier":
      return "identity_candidate"
    default:
      return value
  }
}

function artifactPayloadFromRecord(record: JsonRecord): JsonRecord {
  const {
    kind: _kind,
    type: _type,
    status: _status,
    confidence: _confidence,
    source_urls: _sourceUrls,
    source_url: _sourceUrl,
    ...payload
  } = record

  if (typeof _sourceUrl === "string" && !Array.isArray(payload.source_urls)) {
    payload.source_url = _sourceUrl
  }

  return payload
}

export function isModelGeneratedArtifactKind(value: string): value is ProductIntakeArtifactKind {
  return (
    PRODUCT_INTAKE_ARTIFACT_KINDS.includes(value as ProductIntakeArtifactKind) &&
    value !== "model_run" &&
    value !== "model_judgment"
  )
}

function isJobStage(value: string): value is ProductIntakeJobStage {
  return PRODUCT_INTAKE_JOB_STAGES.includes(value as ProductIntakeJobStage)
}

/**
 * Task 5 (null-identifier worker proof): guards the CLI entry point so this module can be
 * `import`-ed by a test (to reach the exported `loadScanIntakeSeedForSubmission` /
 * `writePromptPacket` seam below) without executing `main()` — which claims real jobs and
 * needs `createSupabaseClientFromEnv()`'s env vars. Strictly behavior-preserving: run
 * directly (`tsx scripts/product-intake/codex-research-worker.ts`, the
 * `products:intake:codex-worker` npm script), `process.argv[1]` is this file and the guard
 * is true, so `main()` still fires exactly as before. Same pattern already used by every
 * other CLI script in `scripts/` that also needs to be import-safe (e.g.
 * `scripts/catalog-authority/audit.ts`).
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
