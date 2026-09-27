import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, dirname, join, resolve, sep } from "node:path"
import { hostname } from "node:os"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { pathToFileURL } from "node:url"
import sharp from "sharp"

import {
  buildBrandResolutionCatalog,
  resolveBrandFromText,
  type BrandResolutionCatalogInput,
  type ProductIdentityBrandAlias,
  type ProductIdentityBrand,
  type ProductIdentityProductLine,
} from "@/lib/product-identity/brand-resolution"
import { normalizeIdentityText } from "@/lib/product-identity/normalize"
import {
  CONDITIONER_INGREDIENT_FLAGS,
  CONDITIONER_REPAIR_LEVELS,
  CONDITIONER_WEIGHTS,
} from "@/lib/conditioner/constants"
import {
  DEEP_CLEANSING_COLOR_TREATED_SUITABILITIES,
  DEEP_CLEANSING_RESET_FOCUSES,
  DEEP_CLEANSING_RESET_INTENSITIES,
} from "@/lib/deep-cleansing-shampoo/constants"
import { LEAVE_IN_APPLICATION_STAGES } from "@/lib/leave-in/constants"
import { MASK_CONCENTRATIONS, MASK_INGREDIENT_FLAGS, MASK_WEIGHTS } from "@/lib/mask/constants"
import { OIL_INGREDIENT_FLAGS, OIL_PURPOSES, OIL_SUBTYPES } from "@/lib/oil/constants"
import {
  DRY_SHAMPOO_FORMATS,
  DRY_SHAMPOO_HAIR_COLOR_FITS,
  DRY_SHAMPOO_PRIMARY_EFFECTS,
  DRY_SHAMPOO_SCALP_SENSITIVITY_FITS,
  PRODUCT_BALANCE_TARGETS,
  PRODUCT_BOND_APPLICATION_MODES,
  PRODUCT_BOND_PRODUCT_FORMATS,
  PRODUCT_BOND_REPAIR_AXES,
  PRODUCT_BOND_REPAIR_INTENSITIES,
  PRODUCT_BOND_TREATMENT_MODES,
  PRODUCT_BOND_USAGE_PROTOCOLS,
  PRODUCT_SCALP_TYPE_FOCUSES,
} from "@/lib/product-specs/constants"
import { SHAMPOO_BUCKETS } from "@/lib/shampoo/constants"
import { HAIR_THICKNESSES, PROTEIN_MOISTURE_LEVELS } from "@/lib/vocabulary"
import {
  appendResearchArtifact,
  claimResearchJobs,
  countResearchArtifacts,
  loadProductIntakeSubmissionDetail,
  normalizeCodexConcurrency,
  resolveReviewDecisionsForSubmission,
  saveSubmissionResearchPreview,
  updateResearchJob,
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
import { finalizeProductImageAsset } from "./finalize-package-image"
import { applyConditionerResearchAdapter } from "@/lib/product-intake/conditioner-research-adapter"
import { conditionerResearchPromptContract } from "@/lib/product-intake/conditioner-research-prompt-contract"
import { applyLeaveInResearchAdapter } from "@/lib/product-intake/leave-in-research-adapter"
import { leaveInResearchPromptContract } from "@/lib/product-intake/leave-in-research-prompt-contract"
import {
  createRetailerEnrichmentWarningReporter,
  parseRetailerEnrichmentPacket,
  type RetailerEnrichmentPacket,
  type ScannedIdentifierPacketValue,
} from "./retailer-enrichment-packet"

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

export type CodexResearchRuntimeConfig = {
  model: string
  reasoningEffort: string
  serviceTier: string | null
}

export type ImageQualityJudgeRuntimeConfig = CodexResearchRuntimeConfig & {
  enabled: boolean
}

export type ImageQualityDefect = {
  kind: string
  region: string
  severity: "minor" | "material" | "critical"
  explanation: string
}

export type ImageQualityVerdict = {
  verdict: "pass" | "rework" | "needs_human_review"
  confidence: number
  defects: ImageQualityDefect[]
  rationale: string
}

export type ImageQualityReference = {
  id: string
  expectedVerdict: "pass" | "rework" | "needs_human_review"
  imagePath: string
  rationale: string
  defects: Array<{ kind: string; region: string }>
}

export type ImageQualityReferenceSet = {
  version: string | null
  references: ImageQualityReference[]
  warnings: string[]
}

export type RembgRuntimeConfig = {
  enabled: boolean
  dockerBin: string
  image: string
  model: "isnet-general-use"
  modelDir: string
  timeoutMs: number
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
}

export type BrandResolutionPromptContext = {
  submitted_brand_text: string | null
  submitted_product_name_text: string | null
  scanned_identifier: ScannedIdentifierPacketValue
  lookup_text: string
  resolved_brand: JsonRecord | null
  nearby_brand_options: JsonRecord[]
  catalog_summary: JsonRecord
  rules: string[]
}

export type ScanIntakeSeed = {
  scannedIdentifier: ScannedIdentifierPacketValue
  retailerEnrichment: RetailerEnrichmentPacket | null
  retailerEnrichmentWarning: "gtin_mismatch" | null
}

const reportRetailerEnrichmentWarning = createRetailerEnrichmentWarningReporter({
  emit: (message, fields) => console.warn("[product-intake]", message, fields),
})

type SupabaseQueryResult<T> = {
  data: T | null
  error: { message?: string } | null
}

const CATEGORY_SPEC_KEYS = {
  shampoo: ["product_shampoo_specs", "product_application_protocols"],
  conditioner: [
    "product_conditioner_specs",
    "product_conditioner_rerank_specs",
    "product_application_protocols",
  ],
  mask: ["product_mask_specs", "product_application_protocols"],
  leave_in: [
    "product_leave_in_specs",
    "product_leave_in_fit_specs",
    "product_leave_in_eligibility",
    "product_application_protocols",
  ],
  oil: ["product_oil_specs", "product_oil_eligibility", "product_application_protocols"],
  dry_shampoo: ["product_dry_shampoo_specs", "product_application_protocols"],
  deep_cleansing_shampoo: ["product_deep_cleansing_shampoo_specs", "product_application_protocols"],
  bondbuilder: [
    "product_bondbuilder_specs",
    "product_relationships",
    "product_application_protocols",
  ],
  heat_protectant: ["product_heat_protectant_specs", "product_application_protocols"],
  scalp_care: ["product_scalp_care_specs", "product_application_protocols"],
} as const
const CODEX_RESEARCH_TIMEOUT_MS = 5 * 60_000
const CODEX_APP_BINARY = "/Applications/Codex.app/Contents/Resources/codex"
const MODEL_EVALUATION_EXPERIMENT_ID = "product_intake_research_effort_v1"
const REMBG_IMAGE =
  "danielgatis/rembg@sha256:98e72b790093dec3b21967e22c8eb75a0a67d458fdba7ef5fcc1900cad76396b"
const REMBG_MODEL = "isnet-general-use" as const

const REQUIRED_CATEGORY_SPEC_KEYS = {
  shampoo: ["product_shampoo_specs", "product_application_protocols"],
  conditioner: [
    "product_conditioner_specs",
    "product_conditioner_rerank_specs",
    "product_application_protocols",
  ],
  mask: ["product_mask_specs", "product_application_protocols"],
  leave_in: [
    "product_leave_in_specs",
    "product_leave_in_fit_specs",
    "product_leave_in_eligibility",
    "product_application_protocols",
  ],
  oil: ["product_oil_specs", "product_oil_eligibility", "product_application_protocols"],
  dry_shampoo: ["product_dry_shampoo_specs", "product_application_protocols"],
  deep_cleansing_shampoo: ["product_deep_cleansing_shampoo_specs", "product_application_protocols"],
  bondbuilder: ["product_bondbuilder_specs", "product_application_protocols"],
  heat_protectant: ["product_heat_protectant_specs", "product_application_protocols"],
  scalp_care: ["product_scalp_care_specs", "product_application_protocols"],
} as const
const ARRAY_CATEGORY_SPEC_TABLES = new Set<string>([
  "product_shampoo_specs",
  "product_conditioner_specs",
  "product_leave_in_eligibility",
  "product_oil_eligibility",
  "product_application_protocols",
])

type CategoryContractKey = keyof typeof CATEGORY_SPEC_KEYS

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
  }

  if (watch && !json) {
    console.log(
      `Codex research worker ${workerId} watching every ${pollMs}ms with concurrency ${concurrency}.`,
    )
    console.log("Press Ctrl-C to stop.")
  }

  while (watch) {
    printWorkerResult(await runWorkerBatch(options), options)
    await sleep(pollMs)
  }

  if (!watch) {
    printWorkerResult(await runWorkerBatch(options), options)
  }
}

async function runWorkerBatch(options: WorkerOptions): Promise<WorkerResult> {
  const jobs = await claimResearchJobs(options.supabase, {
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

  for (const job of jobs) {
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
          message: "Codex worker skeleton claimed this job and left it running for lock testing.",
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
        const updated = await processApprovedImageForReview({
          supabase: options.supabase,
          job,
          detail,
          workerId: options.workerId,
          promptPacketPath,
          executeCodex: options.executeCodex,
          onLeaseRefresh: (refreshedJob) => {
            imageLeasedJob = refreshedJob
          },
        })
        result.jobs.push(projectJob(updated, promptPacketPath, options.executeCodex))
      } catch (error) {
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
        const productionRun = measureModelRun("production_low", researchRuntimeConfig, () =>
          runCodexResearch(promptPacketPath, researchRuntimeConfig, "production_low"),
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
      )
      const progress = await persistResearchOutput({
        supabase: options.supabase,
        job: leasedJob,
        workerId: options.workerId,
        promptPacketPath,
        researchOutput,
        researchModel: options.executeCodex ? researchRuntimeConfig.model : "codex-worker-preview",
      })
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
      const hasFinalPayload = hasFinalResearchPayload(researchOutput.researched_payload)
      const blockers = researchOutput.blockers.filter(Boolean)
      const autoPrepareImage = shouldAutoPrepareImage({
        enabled:
          options.executeCodex &&
          process.env.PRODUCT_INTAKE_AUTO_PREPARE_IMAGES?.trim().toLowerCase() === "true",
        researchOutput,
      })
      const nextStatus = autoPrepareImage
        ? "queued"
        : blockers.length === 0 && hasFinalPayload
          ? "waiting_for_review"
          : "blocked"
      const nextStage = autoPrepareImage
        ? "image_judging"
        : (researchOutput.next_stage ?? (hasFinalPayload ? "preview_build" : "source_research"))

      const updated = await updateResearchJob(options.supabase, {
        jobId: job.id,
        status: nextStatus,
        stage: nextStage,
        progress: {
          message: autoPrepareImage
            ? "Research ist bereit. Bildverarbeitung und visueller Bildcheck sind eingereiht."
            : nextStatus === "waiting_for_review"
              ? "Research preview ist bereit fuer Nick."
              : "Research braucht Aufmerksamkeit, bevor Nick final freigeben kann.",
          prompt_packet_path: promptPacketPath,
          worker_id: options.workerId,
          mode: options.executeCodex ? "codex_cli" : "preview_only",
          image_selection_mode: autoPrepareImage ? "agent_prepared" : null,
          next_step: autoPrepareImage ? "process_image_for_combined_review" : null,
          model_evaluation: evaluation,
          ...progress,
        },
        lastError: blockers.length > 0 ? blockers.join("; ") : null,
        expectedLockedBy: leasedJob.locked_by,
        expectedLockedAt: leasedJob.locked_at,
      })
      result.jobs.push(projectJob(updated, promptPacketPath, options.executeCodex))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Codex research worker failed."
      const updated = await updateResearchJob(options.supabase, {
        jobId: job.id,
        status: "failed",
        stage: job.stage,
        progress: {
          message,
          prompt_packet_path: promptPacketPath,
          worker_id: options.workerId,
          mode: options.executeCodex ? "codex_cli" : "preview_only",
        },
        lastError: message,
        expectedLockedBy: leasedJob.locked_by,
        expectedLockedAt: leasedJob.locked_at,
      })
      result.jobs.push(projectJob(updated, promptPacketPath, options.executeCodex))
    }
  }

  return result
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

function measureModelRun<T>(
  lane: ProductIntakeModelLane,
  runtimeConfig: CodexResearchRuntimeConfig,
  execute: () => T,
): MeasuredModelRun<T> {
  const startedAt = Date.now()
  try {
    const output = execute()
    return {
      success: true,
      lane,
      runtimeConfig,
      durationMs: Date.now() - startedAt,
      outputHash: createHash("sha256").update(JSON.stringify(output)).digest("hex"),
      output,
    }
  } catch (error) {
    return {
      success: false,
      lane,
      runtimeConfig,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown Codex model-run failure.",
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

  const challengerRun = measureModelRun("challenger_medium", params.config.challenger, () =>
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
  const judgeRun = measureModelRun("judge", params.config.judge, () =>
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown model evaluation failure."
}

async function processApprovedImageForReview(params: {
  supabase: ReturnType<typeof createSupabaseClientFromEnv>
  job: ProductIntakeResearchJob
  detail: ProductIntakeSubmissionDetail | null
  workerId: string
  promptPacketPath: string
  executeCodex: boolean
  onLeaseRefresh?: (job: ProductIntakeResearchJob) => void
}) {
  let leasedJob = params.job
  const sourceImageUrl = findApprovedSourceImageUrl(params.detail)
  if (!sourceImageUrl) {
    throw new Error("No approved source image URL found for image processing.")
  }

  const response = await fetch(sourceImageUrl, {
    headers: {
      // Some CDNs serve AVIF/HEIF variants for .jpg URLs when asked, and the
      // local Sharp/libvips build can read metadata but fail during pixel decode.
      accept: "image/jpeg,image/png,image/webp,*/*;q=0.8",
      "user-agent": "ChaarlieProductIntakeReview/1.0",
    },
  })
  if (!response.ok) {
    throw new Error(`Download approved image failed: HTTP ${response.status}`)
  }

  const sourceBytes = Buffer.from(await response.arrayBuffer())
  const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex")
  const sourceAlphaStats = await processedImageAlphaStats(sourceBytes)
  const sourceAlreadyTransparent = sourceAlphaStats.transparentRatio > 0.05
  const workDir = join(
    process.cwd(),
    "tmp",
    "product-intake-image-processing",
    params.job.submission_id,
  )
  const sourceDir = join(workDir, "source")
  const cutoutDir = join(workDir, "selected-nobg")
  mkdirSync(sourceDir, { recursive: true })
  mkdirSync(cutoutDir, { recursive: true })
  const sourceExt = imageExtension(response.headers.get("content-type"), sourceImageUrl)
  const sourceSlug = slugForProcessedImage(params.detail)
  const sourceFile = join(sourceDir, `${sourceSlug}-${sourceSha256.slice(0, 12)}.${sourceExt}`)
  writeFileSync(sourceFile, sourceBytes)

  const preparedCutout = sourceAlreadyTransparent
    ? null
    : runAutomaticBackgroundRemoval({
        sourceFile,
        outputDir: cutoutDir,
        outputSlug: sourceSlug,
      })
  const preparedCutoutFile = preparedCutout?.file ?? null
  const transparentBackgroundDetected = sourceAlreadyTransparent || Boolean(preparedCutoutFile)
  const backgroundRemovalRequired = !sourceAlreadyTransparent && !preparedCutoutFile
  if (backgroundRemovalRequired) {
    const artifact = await appendResearchArtifact(params.supabase, {
      jobId: params.job.id,
      submissionId: params.job.submission_id,
      kind: "processed_image",
      status: "needs_image_work",
      confidence: 0.2,
      payload: {
        source_image_url: sourceImageUrl,
        source_sha256: sourceSha256,
        final_image_ready: false,
        background_action: "background_removal_required",
        source_transparent_background_detected: false,
        transparent_background_detected: false,
        source_transparent_pixel_ratio: sourceAlphaStats.transparentRatio,
        source_opaque_pixel_ratio: sourceAlphaStats.opaqueRatio,
        notes:
          "Source image has no usable alpha and automatic Vision background removal did not produce a cutout. Use Vision/rembg manually or select a cleaner image before final image review.",
      },
      sourceUrls: [sourceImageUrl],
      model: "local-image-finalizer",
      promptVersion: "product_intake_image_finalization_v1",
    })

    return updateResearchJob(params.supabase, {
      jobId: params.job.id,
      status: "waiting_for_review",
      stage: "preview_build",
      progress: {
        ...params.job.progress,
        message: "Bildverarbeitung braucht manuelle Hintergrundentfernung.",
        prompt_packet_path: params.promptPacketPath,
        worker_id: params.workerId,
        mode: "local_image_processing",
        processed_image_artifact_id: artifact.id,
        processed_image_ready: false,
        background_action: "background_removal_required",
        processed_at: new Date().toISOString(),
      },
      lastError: null,
      expectedLockedBy: params.job.locked_by,
      expectedLockedAt: params.job.locked_at,
    })
  }

  const backgroundAction = sourceAlreadyTransparent
    ? "source_already_transparent"
    : preparedCutout?.method === "rembg_isnet_general_use"
      ? "rembg_isnet_general_use"
      : "vision_background_removed"
  const finalized = await finalizeProductImageAsset({
    sourceFile,
    preparedCutoutFile,
    label: productLabelForImage(params.detail),
    outputDir: join(finalizedImageOutputRoot(process.env), params.job.submission_id),
    publicPathPrefix: `/product-intake-finalized/${params.job.submission_id}`,
    dateFolder: dateFolderForJob(params.job),
    submissionId: params.job.submission_id,
    sourceImageUrl,
    sourcePageUrl: findApprovedSourcePageUrl(params.detail),
    sourceType: "retailer",
    reviewedBy: "codex",
  })
  const deterministicReady = finalized.qualityGate.status === "pass"
  const judgeConfig = imageQualityJudgeRuntimeConfig(process.env)
  const visualJudgeEnabled = judgeConfig.enabled && params.executeCodex
  let visualVerdict: ImageQualityVerdict | null = null
  let visualJudgeError: string | null = null
  let referenceSet: ImageQualityReferenceSet = { version: null, references: [], warnings: [] }

  if (visualJudgeEnabled) {
    const manifestPath =
      optionalNonBlankString(process.env.PRODUCT_INTAKE_IMAGE_QA_REFERENCE_MANIFEST) ??
      join(process.cwd(), "config", "product-intake-image-qa-references.v1.json")
    const referenceRoot =
      optionalNonBlankString(process.env.PRODUCT_INTAKE_IMAGE_QA_REFERENCE_ROOT) ??
      finalizedImageOutputRoot(process.env)
    const visualRun = measureModelRun("image_judge", judgeConfig, () => {
      referenceSet = loadImageQualityReferenceSet({
        manifestPath,
        rootDir: referenceRoot,
        maxReferences: 5,
      })
      return runCodexImageQualityJudge({
        promptPacketPath: params.promptPacketPath,
        currentImagePaths: [sourceFile, finalized.qaFile, finalized.finalFile],
        runtimeConfig: judgeConfig,
        referenceSet,
      })
    })
    leasedJob = await refreshModelRunLease({
      supabase: params.supabase,
      job: leasedJob,
      workerId: params.workerId,
      promptPacketPath: params.promptPacketPath,
      message: "Sol/medium visual image judgment returned; worker lease refreshed.",
    })
    params.onLeaseRefresh?.(leasedJob)
    if (visualRun.success) {
      visualVerdict = visualRun.output
    } else {
      visualJudgeError = visualRun.error
    }
    await captureOptionalTelemetryFailure(() =>
      appendResearchArtifact(params.supabase, {
        jobId: leasedJob.id,
        submissionId: leasedJob.submission_id,
        kind: "image_judgment",
        status: visualRun.success ? "completed" : "failed",
        confidence: visualRun.success ? visualRun.output.confidence : null,
        payload: {
          verdict: visualRun.success ? visualRun.output.verdict : "needs_human_review",
          confidence: visualRun.success ? visualRun.output.confidence : null,
          defects: visualRun.success ? visualRun.output.defects : [],
          rationale: visualRun.success
            ? visualRun.output.rationale
            : "Visual image judge failed; Nick must inspect the prepared image.",
          error: visualRun.success ? null : visualRun.error,
          duration_ms: visualRun.durationMs,
          output_hash: visualRun.success ? visualRun.outputHash : null,
          reference_set_version: referenceSet.version,
          reference_ids: referenceSet.references.map((reference) => reference.id),
          reference_warnings: referenceSet.warnings,
          deterministic_quality_gate: finalized.qualityGate,
          human_approval_required: true,
        },
        sourceUrls: [sourceImageUrl],
        model: judgeConfig.model,
        promptVersion: "product_intake_image_quality_judge_v1",
      }),
    )
  }

  const preparation = imageQualityPreparationDecision({
    deterministicReady,
    judgeEnabled: visualJudgeEnabled,
    verdict: visualVerdict?.verdict ?? (visualJudgeEnabled ? "needs_human_review" : null),
  })
  const finalImageReady = preparation.finalImageReady

  const artifact = await appendResearchArtifact(params.supabase, {
    jobId: params.job.id,
    submissionId: params.job.submission_id,
    kind: "processed_image",
    status: preparation.status,
    confidence: visualVerdict?.confidence ?? (finalImageReady ? 0.9 : 0.4),
    payload: {
      public_review_url: finalized.finalReviewUrl,
      final_review_url: finalized.finalReviewUrl,
      qa_review_url: finalized.qaReviewUrl,
      source_image_url: sourceImageUrl,
      source_page_url: findApprovedSourcePageUrl(params.detail),
      source_sha256: sourceSha256,
      asset_sha256: finalized.sha256,
      thumbnail_file: finalized.thumbnailFile,
      thumbnail_storage_path: finalized.thumbnailStoragePath,
      thumbnail_public_url: finalized.thumbnailPublicUrl,
      thumbnail_asset_sha256: finalized.thumbnailSha256,
      processing_method: "local_chaarlie_neutral_background_v1",
      selection_mode: stringValue(params.job.progress?.image_selection_mode) ?? "reviewer_selected",
      final_image_ready: finalImageReady,
      background_action: backgroundAction,
      background_removed: !sourceAlreadyTransparent,
      source_transparent_background_detected: sourceAlreadyTransparent,
      transparent_background_detected: transparentBackgroundDetected,
      source_transparent_pixel_ratio: sourceAlphaStats.transparentRatio,
      source_opaque_pixel_ratio: sourceAlphaStats.opaqueRatio,
      final_file: finalized.finalFile,
      qa_file: finalized.qaFile,
      selected_nobg_file: finalized.selectedNoBgFile,
      storage_bucket: "product-images",
      storage_path: finalized.storagePath,
      planned_public_url: finalized.publicUrl,
      quality_gate: finalized.qualityGate,
      visual_quality_judgment: visualJudgeEnabled
        ? {
            verdict: visualVerdict?.verdict ?? "needs_human_review",
            confidence: visualVerdict?.confidence ?? null,
            defects: visualVerdict?.defects ?? [],
            rationale:
              visualVerdict?.rationale ??
              "Visual image judge failed; inspect the raw source, magenta QA, and final render.",
            error: visualJudgeError,
            reference_set_version: referenceSet.version,
            human_approval_required: true,
          }
        : null,
      chaarlie_neutral_background: true,
      notes: sourceAlreadyTransparent
        ? "Source image already had a transparent cutout. Final Chaarlie review asset was cropped, size-normalized, QA-rendered on magenta, and composited onto the neutral product background."
        : preparedCutout?.method === "rembg_isnet_general_use"
          ? "The isolated Hetzner rembg worker produced an isnet-general-use cutout. The final Chaarlie review asset was cropped, size-normalized, QA-rendered on magenta, and composited onto the neutral product background."
          : "Vision produced a transparent cutout. Final Chaarlie review asset was cropped, size-normalized, QA-rendered on magenta, and composited onto the neutral product background.",
    },
    sourceUrls: [sourceImageUrl],
    model: "local-image-finalizer",
    promptVersion: "product_intake_image_finalization_v1",
  })

  return updateResearchJob(params.supabase, {
    jobId: params.job.id,
    status: "waiting_for_review",
    stage: "preview_build",
    progress: {
      ...params.job.progress,
      message: "Bildverarbeitung ist bereit fuer den finalen Bildcheck.",
      prompt_packet_path: params.promptPacketPath,
      worker_id: params.workerId,
      mode: "local_image_processing",
      processed_image_artifact_id: artifact.id,
      processed_image_url: finalized.finalReviewUrl,
      qa_image_url: finalized.qaReviewUrl,
      processed_image_ready: finalImageReady,
      background_action: backgroundAction,
      processed_at: new Date().toISOString(),
    },
    lastError: null,
    expectedLockedBy: leasedJob.locked_by,
    expectedLockedAt: leasedJob.locked_at,
  })
}

export function imageProcessingFailureUpdate(params: {
  job: Pick<ProductIntakeResearchJob, "id" | "stage" | "locked_by" | "locked_at">
  error: unknown
  promptPacketPath: string
  workerId: string
}) {
  const message =
    params.error instanceof Error ? params.error.message : "Image processing worker failed."
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

async function processedImageAlphaStats(bytes: Buffer) {
  const { data, info } = await sharp(bytes, { failOn: "none" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let transparent = 0
  let opaque = 0

  for (let index = 3; index < data.length; index += info.channels) {
    const alpha = data[index]
    if (alpha < 8) transparent += 1
    if (alpha > 247) opaque += 1
  }

  const total = info.width * info.height
  return {
    transparentRatio: total > 0 ? transparent / total : 0,
    opaqueRatio: total > 0 ? opaque / total : 0,
  }
}

async function persistResearchOutput(params: {
  supabase: ReturnType<typeof createSupabaseClientFromEnv>
  job: ProductIntakeResearchJob
  workerId: string
  promptPacketPath: string
  researchOutput: CodexResearchOutput
  researchModel: string
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
  if (hasFinalResearchPayload(params.researchOutput.researched_payload)) {
    const updated = await saveSubmissionResearchPreview(params.supabase, {
      submissionId: params.job.submission_id,
      researchedPayload: params.researchOutput.researched_payload,
      status: params.researchOutput.blockers.length === 0 ? "ready_for_review" : "researching",
    })
    savedSubmissionStatus = updated.status
    if (params.job.stage === "rework") {
      resolvedDecisionCount = await resolveReviewDecisionsForSubmission(
        params.supabase,
        params.job.submission_id,
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
        commercial_source_contract: commercialSourceContract(detail?.category),
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
          commercial_source_contract: commercialSourceContract(detail?.category),
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
      "Choose affiliate_link and price_eur using commercial_source_contract, including category-specific purchase URL preference and denylisted hosts.",
      "Before blocking affiliate_link or price_eur, prove targeted_preferred_retailer_searches were attempted for the top preferred hosts.",
      "If any required final.product field cannot be researched, leave blockers non-empty and explain the missing field.",
      "The review cockpit shows final.product and final.category_specs exactly as they will be written to the database.",
    ],
  }
}

function commercialSourceContract(category: string | null | undefined): JsonRecord {
  const categoryKey = normalizeCategoryKey(category)
  return {
    goal: "Choose the product URL and price source that should be reviewed and stored for this new product.",
    source_priority: [
      "Official brand/manufacturer product page",
      "Reputable retailer PDPs: dm, Rossmann, Müller, Douglas, Hagel-Shop, Flaconi, Notino, similar stable shops",
      "Barcode/GTIN lookup",
      "Secondary listings only when primary sources are missing",
      "User photo/OCR only as identity evidence",
    ],
    purchase_url_preference: purchaseUrlPreferenceForCategory(categoryKey),
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
      "Also search brand-direct/official manufacturer sources using the brand name plus product name; use official pages for identity/source evidence and a purchasable preferred retailer PDP for affiliate_link when the official page is not buyable.",
      "Repeat the mandatory search audit with stable researched identity terms if the submitted wording differs from the researched canonical identity.",
      "For leave_in and drogerie categories, a matching dm.de PDP with EUR price and purchasable availability beats international exact-identity sources for affiliate_link and price_eur.",
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
      "If the best identity source is official brand but not purchasable, use it in final.sources and choose the best purchasable retailer PDP for affiliate_link.",
      "Set purchase_link_status to available only when the chosen PDP is purchase-capable/in stock; otherwise unavailable.",
      "If only identity evidence exists and no acceptable purchasable PDP with price exists, add a blocker instead of inventing price_eur.",
    ],
    rationale_rules: [
      "field_rationales.product.affiliate_link must name why this PDP beat lower-priority sources.",
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

function purchaseUrlPreferenceForCategory(categoryKey: CategoryContractKey | null): string {
  switch (categoryKey) {
    case "leave_in":
      return "dm > brand-direct > Rossmann > Amazon DE"
    case "oil":
      return "brand-direct > Amazon DE > dm > Rossmann"
    case "shampoo":
    case "conditioner":
    case "mask":
    case "dry_shampoo":
    case "deep_cleansing_shampoo":
      return "dm > Rossmann > Müller > brand-direct > Amazon DE"
    case "bondbuilder":
      return "brand-direct or reputable specialist retailer can beat dm/Rossmann when that is the stable canonical PDP"
    default:
      return "Use source_priority first, then choose the most stable reputable German/EU product-detail page with price and availability."
  }
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

function categoryApprovalContract(category: string | null | undefined): JsonRecord {
  const categoryKey = normalizeCategoryKey(category)
  if (!categoryKey) {
    return {
      category_key: category ?? null,
      instruction:
        "Research only the category_specs required by this product category's approval validator. Put them under researched_payload.final.category_specs, never inside researched_payload.final.product. Do not emit category_specs for other product categories.",
    }
  }

  if (categoryKey === "shampoo") {
    return {
      category_key: "shampoo",
      instruction:
        "Research and emit only shampoo approval specs under researched_payload.final.category_specs.",
      required_category_specs: [...CATEGORY_SPEC_KEYS.shampoo],
      product_shampoo_specs:
        "array with one row per relevant hair thickness; each row has thickness, shampoo_bucket, scalp_route, optional cleansing_intensity. shampoo_bucket is a scalp/route bucket, not a dry-hair or damaged-lengths claim. Use trocken only when sources support dry scalp; dry/damaged hair alone should usually stay normal + balanced unless another scalp claim is proven.",
      allowed_product_shampoo_specs_values: {
        thickness: [...HAIR_THICKNESSES],
        shampoo_bucket: [...SHAMPOO_BUCKETS],
        scalp_route: ["oily", "balanced", "dry", "dandruff", "dry_flakes", "irritated"],
        cleansing_intensity: ["gentle", "regular", "clarifying", null],
      },
      shampoo_bucket_to_scalp_route_contract: {
        normal: "balanced",
        trocken: "dry",
        "dehydriert-fettig": "oily",
        schuppen: "dandruff or dry_flakes",
        irritationen: "irritated",
      },
      product_application_protocols: applicationProtocolResearchContract(
        "shampoo",
        ["shampoo_everyday", "shampoo_dandruff"],
        "Derive Shampoo protocol roles from the reviewed Shampoo buckets: include shampoo_dandruff when any row uses schuppen, and include shampoo_everyday only when at least one source-supported row uses a non-schuppen bucket. A schuppen-only Shampoo is complete without shampoo_everyday. When an exact source supports ordinary or daily use, research the matching non-schuppen scalp-route facts before adding shampoo_everyday; daily-use wording alone must not invent a bucket or cadence.",
      ),
    }
  }

  if (categoryKey === "conditioner") {
    return {
      category_key: "conditioner",
      instruction:
        "Complete the full Conditioner Standard v1.6 research envelope first. Emit it under a property_synthesis artifact and let the deterministic adapter produce current database fields. Research only the exact rinse-out protocol separately.",
      conditioner_research: conditionerResearchPromptContract(),
      required_category_specs: [...CATEGORY_SPEC_KEYS.conditioner],
      product_conditioner_specs:
        "array with one row per relevant hair thickness; each row has thickness and protein_moisture_balance",
      allowed_product_conditioner_specs_values: {
        thickness: [...HAIR_THICKNESSES],
        protein_moisture_balance: [...PROTEIN_MOISTURE_LEVELS],
      },
      product_conditioner_rerank_specs: {
        weight: [...CONDITIONER_WEIGHTS],
        repair_level: [...CONDITIONER_REPAIR_LEVELS],
        balance_direction: [...PRODUCT_BALANCE_TARGETS, null],
        ingredient_flags: [...CONDITIONER_INGREDIENT_FLAGS],
      },
      product_application_protocols: applicationProtocolResearchContract("conditioner", [
        "conditioner_rinse_out",
      ]),
    }
  }

  if (categoryKey === "mask") {
    return {
      category_key: "mask",
      instruction:
        "Research and emit only mask approval specs under researched_payload.final.category_specs.",
      required_category_specs: [...CATEGORY_SPEC_KEYS.mask],
      product_mask_specs: {
        weight: [...MASK_WEIGHTS],
        concentration: [...MASK_CONCENTRATIONS],
        balance_direction: [...PRODUCT_BALANCE_TARGETS, null],
        ingredient_flags: [...MASK_INGREDIENT_FLAGS],
        repair_support_level: ["low", "medium", "high"],
        functional_benefits: ["smoothing_frizz_control", "detangling_slip", "shine"],
      },
      product_application_protocols: {
        category: ["mask"],
        role: ["intensive_conditioning_mask"],
        required_fields: [
          "cadence",
          "application_stage",
          "placement",
          "contact_time_seconds",
          "rinse_action",
          "source_label",
          "source_url",
          "source_text",
          "guidance_payload",
        ],
        note: "The exact manufacturer protocol must be complete enough to derive the Stage 5 product pointer.",
      },
    }
  }

  if (categoryKey === "oil") return oilApprovalContract()
  if (categoryKey === "dry_shampoo") return dryShampooApprovalContract()
  if (categoryKey === "deep_cleansing_shampoo") return deepCleansingShampooApprovalContract()
  if (categoryKey === "bondbuilder") return bondbuilderApprovalContract()
  if (categoryKey === "heat_protectant") return heatProtectantApprovalContract()
  if (categoryKey === "scalp_care") return scalpCareApprovalContract()

  return {
    category_key: "leave_in",
    instruction:
      "Complete the full Leave-In Standard v1.0 research envelope first. Emit it under a property_synthesis artifact and let the deterministic adapter produce current database fields. Research only the exact leave-in application protocol separately.",
    leave_in_research: leaveInResearchPromptContract(),
    required_category_specs: [...CATEGORY_SPEC_KEYS.leave_in],
    aliases: {
      post_wash:
        "Do not use post_wash for leave-ins. If evidence says after washing, damp hair, no-rinse, or towel-dried hair, use towel_dry in identity.applicationStage.",
    },
    product_application_protocols: applicationProtocolResearchContract(
      "leave_in",
      ["post_wash_leave_in", "pre_heat_protection"],
      "Always include post_wash_leave_in; include pre_heat_protection only when the product claims heat protection.",
    ),
  }
}

function oilApprovalContract(): JsonRecord {
  return {
    category_key: "oil",
    instruction:
      "Research and emit only oil approval specs under researched_payload.final.category_specs.",
    required_category_specs: [...CATEGORY_SPEC_KEYS.oil],
    product_oil_specs: {
      weight: ["light", "medium", "rich"],
      role_support: ["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"],
      provides_heat_protection:
        "boolean; true only when a product source explicitly claims heat protection; false only after the reviewed producer/shop sources have been checked and make no heat-protection claim",
    },
    product_oil_eligibility:
      "array with one or more user-fit rows; each row has thickness, oil_subtype, oil_purpose, and ingredient_flags",
    allowed_product_oil_eligibility_values: {
      thickness: [...HAIR_THICKNESSES],
      oil_subtype: [...OIL_SUBTYPES],
      oil_purpose: [...OIL_PURPOSES, null],
      ingredient_flags: [...OIL_INGREDIENT_FLAGS],
    },
    product_application_protocols: applicationProtocolResearchContract(
      "oil",
      ["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"],
      "Include one exact protocol for every role declared in product_oil_specs.role_support. Heat protection is not a role: set provides_heat_protection=true and include a sourced leave_on_fibre_conditioning protocol when the oil protects from heat.",
    ),
  }
}

function dryShampooApprovalContract(): JsonRecord {
  return {
    category_key: "dry_shampoo",
    instruction:
      "Research and emit only dry-shampoo approval specs under researched_payload.final.category_specs.",
    required_category_specs: [...CATEGORY_SPEC_KEYS.dry_shampoo],
    product_dry_shampoo_specs: {
      primary_effect: [...DRY_SHAMPOO_PRIMARY_EFFECTS],
      hair_color_fit: [...DRY_SHAMPOO_HAIR_COLOR_FITS],
      scalp_sensitivity_fit: [...DRY_SHAMPOO_SCALP_SENSITIVITY_FITS],
      format: [...DRY_SHAMPOO_FORMATS],
    },
    product_application_protocols: applicationProtocolResearchContract("dry_shampoo", [
      "root_refresh_bridge",
    ]),
  }
}

function deepCleansingShampooApprovalContract(): JsonRecord {
  return {
    category_key: "deep_cleansing_shampoo",
    instruction:
      "Research and emit only deep-cleansing-shampoo approval specs under researched_payload.final.category_specs.",
    required_category_specs: [...CATEGORY_SPEC_KEYS.deep_cleansing_shampoo],
    product_deep_cleansing_shampoo_specs: {
      scalp_type_focus: [...PRODUCT_SCALP_TYPE_FOCUSES],
      reset_intensity: [...DEEP_CLEANSING_RESET_INTENSITIES],
      reset_focus: [...DEEP_CLEANSING_RESET_FOCUSES],
      color_treated_suitability: [...DEEP_CLEANSING_COLOR_TREATED_SUITABILITIES],
    },
    product_application_protocols: applicationProtocolResearchContract(
      "deep_cleansing_shampoo",
      ["residue_reset", "mineral_reset"],
      "Use mineral_reset for metal_mineral_hard_water, residue_reset for product_sebum_buildup, and both for broad_spectrum_detox.",
    ),
  }
}

function bondbuilderApprovalContract(): JsonRecord {
  return {
    category_key: "bondbuilder",
    instruction:
      "Research and emit only bondbuilder approval specs under researched_payload.final.category_specs.",
    required_category_specs: [...REQUIRED_CATEGORY_SPEC_KEYS.bondbuilder],
    product_bondbuilder_specs: {
      bond_repair_intensity: [...PRODUCT_BOND_REPAIR_INTENSITIES],
      application_mode: [...PRODUCT_BOND_APPLICATION_MODES],
      bond_repair_axis: [...PRODUCT_BOND_REPAIR_AXES],
      treatment_mode: [...PRODUCT_BOND_TREATMENT_MODES],
      product_format: [...PRODUCT_BOND_PRODUCT_FORMATS],
      usage_protocol: [...PRODUCT_BOND_USAGE_PROTOCOLS],
    },
    product_relationships: "optional; emit only when needed by the approval payload",
    product_application_protocols: applicationProtocolResearchContract("bondbuilder", [
      "specialized_bond_treatment",
    ]),
  }
}

function applicationProtocolResearchContract(
  category: CategoryContractKey,
  roles: readonly string[],
  requiredRoleRule = "Include every listed role.",
): JsonRecord {
  return {
    category: [category],
    roles: [...roles],
    required_role_rule: requiredRoleRule,
    required_fields: [
      "cadence",
      "application_stage",
      "application_state",
      "placement",
      "contact_time_seconds",
      "rinse_action",
      "reapplication",
      "instruction_modifiers",
      "source_label",
      "source_url",
      "source_text",
      "guidance_payload",
    ],
    guidance_payload:
      "Canonical schemaVersion 1 product-scoped guidance payload using productId __PRODUCT_ID__; it must be complete enough to derive the Stage 5 V2 product pointer.",
  }
}

function heatProtectantApprovalContract(): JsonRecord {
  return {
    category_key: "heat_protectant",
    instruction:
      "Research only explicit finished-product heat-protection evidence and exact manufacturer application instructions. Do not infer heat protection from a name, format, ingredient, or adjacent care claim.",
    required_category_specs: [...REQUIRED_CATEGORY_SPEC_KEYS.heat_protectant],
    product_heat_protectant_specs: {
      format: ["spray"],
      provides_heat_protection:
        "true, false, or null when the finished-product evidence is unresolved",
    },
    product_application_protocols: {
      category: ["heat_protectant"],
      role: ["pre_heat_protection"],
      required_fields: ["application_state", "reapplication"],
      application_state: ["damp", "dry", "either"],
      reapplication: ["required", "optional", "not_stated"],
    },
  }
}

function scalpCareApprovalContract(): JsonRecord {
  return {
    category_key: "scalp_care",
    instruction:
      "Research only cosmetic scalp-care product facts and exact manufacturer instructions. Preserve medical boundaries: do not turn flake, oil, density, shedding, or comfort claims into diagnosis or treatment claims.",
    required_category_specs: [...REQUIRED_CATEGORY_SPEC_KEYS.scalp_care],
    product_scalp_care_specs: {
      primary_role: [
        "scalp_comfort",
        "scalp_flake_oil_adjunct",
        "density_claim_tonic",
        "scalp_exfoliant",
      ],
      presentation_format: [
        "serum",
        "tonic",
        "lotion_or_fluid",
        "oil",
        "scrub",
        "other",
        "unknown",
      ],
      rinse_mode: ["leave_on", "rinse_off"],
      application_instructions: "exact reviewed manufacturer instruction text",
    },
    product_application_protocols: {
      category: ["scalp_care"],
      role: ["scalp_comfort", "scalp_flake_oil_adjunct", "density_claim_tonic", "scalp_exfoliant"],
      note: "The protocol role must equal product_scalp_care_specs.primary_role.",
    },
  }
}

function normalizeResearchOutputForCategory(
  output: CodexResearchOutput,
  category: string | null | undefined,
  brandResolutionContext: BrandResolutionPromptContext,
  reviewDecisions: ProductIntakeReviewDecisionRow[],
  expectedResearchId: string,
): CodexResearchOutput {
  const categoryKey = normalizeCategoryKey(category)
  if (!categoryKey) return output

  const researchedPayload = normalizeCategoryResearchedPayload(
    output.researched_payload,
    categoryKey,
    output.artifacts,
  )
  const blockers = [...output.blockers]
  const final = normalizeRecord(researchedPayload?.final)
  applyApprovedCanonicalBrand(final, brandResolutionContext, reviewDecisions)
  enforceCanonicalBrandResolution(final, brandResolutionContext)
  applyApprovedProductIdentity(final, brandResolutionContext, reviewDecisions)
  const categorySpecs = normalizeRecord(final?.category_specs)

  if (categoryKey === "conditioner" && final) {
    const adapterResult = applyConditionerResearchAdapter({
      final,
      artifacts: output.artifacts,
      expectedResearchId,
    })
    blockers.push(...adapterResult.blockers)
  }

  if (categoryKey === "leave_in" && final) {
    const adapterResult = applyLeaveInResearchAdapter({
      final,
      artifacts: output.artifacts,
      expectedResearchId,
    })
    blockers.push(...adapterResult.blockers)
  }

  // Read AFTER the adapter branches: applyLeaveInResearchAdapter reassigns
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
  const missingBrandResolution = canonicalBrandResolutionBlocker(
    final,
    brandResolutionContext,
    reviewDecisions,
  )
  if (missingBrandResolution) blockers.push(missingBrandResolution)

  return {
    ...output,
    researched_payload: researchedPayload,
    artifacts: output.artifacts.map((artifact) => ({
      ...artifact,
      payload: normalizeCategoryArtifactPayload(artifact.payload, categoryKey),
    })),
    blockers: dedupeStrings(blockers),
  }
}

async function loadBrandResolutionContext(
  supabase: ReturnType<typeof createSupabaseClientFromEnv>,
  detail: ProductIntakeSubmissionDetail | null,
  scannedIdentifier: ScannedIdentifierPacketValue,
): Promise<BrandResolutionPromptContext> {
  const catalogInput = await loadBrandResolutionCatalogForWorker(supabase)
  return buildBrandResolutionPromptContext(detail, catalogInput, scannedIdentifier)
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

async function loadBrandResolutionCatalogForWorker(
  supabase: ReturnType<typeof createSupabaseClientFromEnv>,
): Promise<BrandResolutionCatalogInput> {
  const [brandsResult, productLinesResult, brandAliasesResult] = await Promise.all([
    supabase.from("brands").select("id, canonical_name, normalized_name"),
    supabase.from("product_lines").select("id, brand_id, canonical_name, normalized_name"),
    supabase.from("brand_aliases").select("brand_id, product_line_id, alias, normalized_alias"),
  ])

  return {
    brands: requireSupabaseData<ProductIdentityBrand[]>(
      brandsResult as unknown as SupabaseQueryResult<ProductIdentityBrand[]>,
      "load brands for product-intake Codex worker",
    ),
    productLines: requireSupabaseData<ProductIdentityProductLine[]>(
      productLinesResult as unknown as SupabaseQueryResult<ProductIdentityProductLine[]>,
      "load product lines for product-intake Codex worker",
    ),
    brandAliases: requireSupabaseData<ProductIdentityBrandAlias[]>(
      brandAliasesResult as unknown as SupabaseQueryResult<ProductIdentityBrandAlias[]>,
      "load brand aliases for product-intake Codex worker",
    ),
  }
}

function requireSupabaseData<T>(result: SupabaseQueryResult<T>, label: string): T {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message ?? "unknown Supabase error"}`)
  }
  if (result.data === null) {
    throw new Error(`${label}: no data returned`)
  }
  return result.data
}

function buildBrandResolutionPromptContext(
  detail: ProductIntakeSubmissionDetail | null,
  catalogInput: BrandResolutionCatalogInput,
  scannedIdentifier: ScannedIdentifierPacketValue,
): BrandResolutionPromptContext {
  const catalog = buildBrandResolutionCatalog(catalogInput)
  const submittedBrand = detail?.brand ?? null
  const submittedProductName = detail?.product_name ?? null
  const lookupText = [submittedBrand, submittedProductName].filter(Boolean).join(" ").trim()
  const resolution = lookupText ? resolveBrandFromText(lookupText, catalog) : null
  const resolvedBrand =
    resolution && resolution.match !== "none" && resolution.brand
      ? {
          match: resolution.match,
          confidence: resolution.confidence,
          reason: resolution.reason,
          matched_text: resolution.matchedText,
          canonical_brand_id: brandIdValue(resolution.brand),
          canonical_brand: brandLabel(resolution.brand),
          product_line_id: resolution.productLine
            ? productLineIdValue(resolution.productLine)
            : null,
          product_line: resolution.productLine ? productLineLabel(resolution.productLine) : null,
        }
      : null

  return {
    submitted_brand_text: submittedBrand,
    submitted_product_name_text: submittedProductName,
    scanned_identifier: scannedIdentifier,
    lookup_text: lookupText,
    resolved_brand: resolvedBrand,
    nearby_brand_options: resolvedBrand ? [] : nearbyBrandOptions(lookupText, catalogInput.brands),
    catalog_summary: {
      brand_count: catalogInput.brands.length,
      product_line_count: catalogInput.productLines?.length ?? 0,
      brand_alias_count: catalogInput.brandAliases?.length ?? 0,
      alias_conflict_count: catalog.conflicts.length,
    },
    rules: [
      "Use resolved_brand.canonical_brand exactly for final.product.canonical_brand when resolved_brand is present.",
      "Use resolved_brand.product_line exactly for final.product.product_line when resolved_brand.product_line is present.",
      "If resolved_brand is null and review_decisions includes an approved product.canonical_brand, use that reviewed DB-ready brand spelling exactly.",
      "If review_decisions includes approved product.product_line or product.clean_name, use those reviewed DB-ready product identity fields exactly.",
      "If resolved_brand is null, do not invent a canonical brand spelling. Add a blocker requesting canonical brand resolution or new-brand approval.",
      "The review cockpit must show DB-ready brand values, not prose explanations.",
    ],
  }
}

function enforceCanonicalBrandResolution(
  final: JsonRecord | null | undefined,
  brandResolutionContext: BrandResolutionPromptContext,
): void {
  const product = normalizeRecord(final?.product)
  const resolved = normalizeRecord(brandResolutionContext.resolved_brand)
  const canonicalBrand = stringValue(resolved?.canonical_brand)
  if (!product || !canonicalBrand) return

  product.canonical_brand = canonicalBrand
  const productLine = stringValue(resolved?.product_line)
  if (productLine) product.product_line = productLine
}

function applyApprovedCanonicalBrand(
  final: JsonRecord | null | undefined,
  brandResolutionContext: BrandResolutionPromptContext,
  reviewDecisions: ProductIntakeReviewDecisionRow[],
): void {
  if (normalizeRecord(brandResolutionContext.resolved_brand)) return
  const product = normalizeRecord(final?.product)
  if (!product) return

  const approvedBrand = approvedCanonicalBrandFromReview(reviewDecisions)
  if (!approvedBrand) return

  product.canonical_brand = approvedBrand
}

function applyApprovedProductIdentity(
  final: JsonRecord | null | undefined,
  brandResolutionContext: BrandResolutionPromptContext,
  reviewDecisions: ProductIntakeReviewDecisionRow[],
): void {
  const product = normalizeRecord(final?.product)
  if (!product) return

  const identity = approvedProductIdentityFromReview(reviewDecisions)
  if (!normalizeRecord(brandResolutionContext.resolved_brand) && identity.canonicalBrand) {
    product.canonical_brand = identity.canonicalBrand
  }
  if (identity.hasProductLine) {
    product.product_line = identity.productLine
  }
  if (identity.cleanName) {
    product.clean_name = identity.cleanName
  }
}

function approvedCanonicalBrandFromReview(
  reviewDecisions: ProductIntakeReviewDecisionRow[],
): string | null {
  for (const decision of reviewDecisions) {
    if (decision.field_path !== "product.canonical_brand") continue
    if (decision.decision !== "approved") continue

    const reviewerValue = normalizeRecord(decision.reviewer_value)
    const proposedValue = normalizeRecord(decision.proposed_value)
    const approvedBrand =
      stringValue(reviewerValue?.canonical_brand) ??
      stringValue(reviewerValue?.canonicalName) ??
      stringValue(proposedValue?.canonical_brand) ??
      stringValue(proposedValue?.canonicalName)
    if (approvedBrand) return approvedBrand
  }

  return null
}

function approvedProductIdentityFromReview(reviewDecisions: ProductIntakeReviewDecisionRow[]): {
  canonicalBrand: string | null
  hasProductLine: boolean
  productLine: string | null
  cleanName: string | null
} {
  const identity = {
    canonicalBrand: null as string | null,
    hasProductLine: false,
    productLine: null as string | null,
    cleanName: null as string | null,
  }

  for (const decision of reviewDecisions) {
    if (decision.decision !== "approved") continue
    const reviewerValue = normalizeRecord(decision.reviewer_value)
    const proposedValue = normalizeRecord(decision.proposed_value)

    if (decision.field_path === "product.canonical_brand") {
      identity.canonicalBrand =
        stringValue(reviewerValue?.canonical_brand) ??
        stringValue(reviewerValue?.canonicalName) ??
        stringValue(proposedValue?.canonical_brand) ??
        stringValue(proposedValue?.canonicalName) ??
        identity.canonicalBrand
    }

    if (decision.field_path === "product.product_line") {
      identity.hasProductLine = true
      identity.productLine =
        stringValue(reviewerValue?.product_line) ?? stringValue(proposedValue?.product_line)
    }

    if (decision.field_path === "product.clean_name") {
      identity.cleanName =
        stringValue(reviewerValue?.clean_name) ??
        stringValue(reviewerValue?.cleanName) ??
        stringValue(proposedValue?.clean_name) ??
        stringValue(proposedValue?.cleanName) ??
        identity.cleanName
    }
  }

  return identity
}

function canonicalBrandResolutionBlocker(
  final: JsonRecord | null | undefined,
  brandResolutionContext: BrandResolutionPromptContext,
  reviewDecisions: ProductIntakeReviewDecisionRow[],
): string | null {
  const product = normalizeRecord(final?.product)
  if (!product) return null
  if (normalizeRecord(brandResolutionContext.resolved_brand)) return null
  if (approvedCanonicalBrandFromReview(reviewDecisions)) return null
  if (!brandResolutionContext.lookup_text) return null
  return `canonical brand table resolution missing for: ${brandResolutionContext.lookup_text}`
}

function nearbyBrandOptions(
  lookupText: string,
  brands: readonly ProductIdentityBrand[],
): JsonRecord[] {
  const lookupTokens = new Set(
    normalizeIdentityText(lookupText)
      .split(" ")
      .filter((token) => token.length >= 3),
  )
  if (lookupTokens.size === 0) return []

  return brands
    .map((brand) => {
      const label = brandLabel(brand)
      const normalized = normalizeIdentityText(label)
      const score = normalized.split(" ").filter((token) => lookupTokens.has(token)).length
      return { brand, label, score }
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .slice(0, 20)
    .map((candidate) => ({
      canonical_brand_id: brandIdValue(candidate.brand),
      canonical_brand: candidate.label,
    }))
}

function brandIdValue(brand: ProductIdentityBrand): string | null {
  return brand.id ?? brand.key ?? brand.canonical_name ?? brand.canonicalName ?? brand.name ?? null
}

function productLineIdValue(line: ProductIdentityProductLine): string | null {
  return line.id ?? line.key ?? line.canonical_name ?? line.canonicalName ?? line.name ?? null
}

function brandLabel(brand: ProductIdentityBrand): string {
  return brand.canonical_name ?? brand.canonicalName ?? brand.name ?? brand.key ?? brand.id ?? ""
}

function productLineLabel(line: ProductIdentityProductLine): string {
  return line.canonical_name ?? line.canonicalName ?? line.name ?? line.key ?? line.id ?? ""
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

function normalizeCategoryKey(category: string | null | undefined): CategoryContractKey | null {
  if (typeof category !== "string") return null
  const normalized = category
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[-\s]+/g, "_")

  switch (normalized) {
    case "shampoo":
    case "shampoo_profi":
      return "shampoo"
    case "conditioner":
    case "conditioner_profi":
    case "conditioner_(drogerie)":
      return "conditioner"
    case "mask":
    case "maske":
      return "mask"
    case "leave_in":
      return "leave_in"
    case "oil":
    case "ole":
    case "oele":
      return "oil"
    case "dry_shampoo":
    case "trockenshampoo":
      return "dry_shampoo"
    case "deep_cleansing_shampoo":
    case "tiefenreinigungsshampoo":
      return "deep_cleansing_shampoo"
    case "bondbuilder":
    case "bond_builder":
      return "bondbuilder"
    case "heat_protectant":
    case "hitzeschutz":
      return "heat_protectant"
    case "scalp_care":
    case "kopfhautpflege":
      return "scalp_care"
    default:
      return null
  }
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

function runCodexResearch(
  promptPacketPath: string,
  runtimeConfig: CodexResearchRuntimeConfig,
  lane: Extract<ProductIntakeModelLane, "production_low" | "challenger_medium">,
): CodexResearchOutput {
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
    runCodexJson({
      outputPath: outputPathForModelLane(promptPacketPath, lane),
      prompt,
      runtimeConfig,
    }),
  )
}

function runCodexJudge(
  promptPacketPath: string,
  blindPacket: BlindJudgePacket,
  runtimeConfig: CodexResearchRuntimeConfig,
): ModelJudgeVerdict {
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

  const value = runCodexJson({
    outputPath: outputPathForModelLane(promptPacketPath, "judge"),
    prompt,
    runtimeConfig,
    webSearch: "disabled",
  })
  return normalizeModelJudgeVerdict(value, blindPacket.laneByCandidate)
}

function runCodexImageQualityJudge(params: {
  promptPacketPath: string
  currentImagePaths: [string, string, string]
  runtimeConfig: CodexResearchRuntimeConfig
  referenceSet: ImageQualityReferenceSet
}): ImageQualityVerdict {
  const value = runCodexJson({
    outputPath: outputPathForModelLane(params.promptPacketPath, "image_judge"),
    prompt: buildImageQualityJudgePrompt({ referenceSet: params.referenceSet }),
    runtimeConfig: params.runtimeConfig,
    webSearch: "disabled",
    imagePaths: [
      ...params.currentImagePaths,
      ...params.referenceSet.references.map((reference) => reference.imagePath),
    ],
  })
  return normalizeImageQualityVerdict(value)
}

function runCodexJson(params: {
  outputPath: string
  prompt: string
  runtimeConfig: CodexResearchRuntimeConfig
  webSearch?: "disabled" | "live"
  imagePaths?: string[]
}): JsonRecord {
  const codexBinary = codexBinaryForWorker()

  const run = spawnSync(
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
      maxBuffer: 1024 * 1024 * 20,
      timeout: CODEX_RESEARCH_TIMEOUT_MS,
    },
  )

  if (run.error) {
    throw new Error(`Codex CLI failed to start (${codexBinary}): ${run.error.message}`)
  }
  if (run.signal) {
    throw new Error(
      `Codex CLI terminated by ${run.signal} after up to ${CODEX_RESEARCH_TIMEOUT_MS / 1000}s: ${
        run.stderr || run.stdout || "no output"
      }`,
    )
  }
  if (run.status !== 0) {
    throw new Error(
      `Codex CLI failed (${codexBinary}, exit ${run.status}): ${
        run.stderr || run.stdout || "no output"
      }`,
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

export function imageQualityJudgeRuntimeConfig(
  env: Readonly<Record<string, string | undefined>>,
): ImageQualityJudgeRuntimeConfig {
  const config = {
    enabled: env.PRODUCT_INTAKE_CODEX_IMAGE_JUDGE_ENABLED?.trim().toLowerCase() === "true",
    model: nonBlankEnv(env.PRODUCT_INTAKE_CODEX_IMAGE_JUDGE_MODEL, "gpt-6-sol"),
    reasoningEffort: nonBlankEnv(env.PRODUCT_INTAKE_CODEX_IMAGE_JUDGE_REASONING_EFFORT, "medium"),
    serviceTier: optionalServiceTier(env.PRODUCT_INTAKE_CODEX_IMAGE_JUDGE_SERVICE_TIER),
  }
  assertAllowedProductIntakeModel(config.model, "image quality judge")
  return config
}

export function shouldAutoPrepareImage(params: {
  enabled: boolean
  researchOutput: CodexResearchOutput
}): boolean {
  if (!params.enabled || params.researchOutput.blockers.length > 0) return false
  if (!hasFinalResearchPayload(params.researchOutput.researched_payload)) return false

  const final = normalizeRecord(params.researchOutput.researched_payload?.final)
  const product = normalizeRecord(final?.product)
  if (stringValue(product?.image_url)) return true

  return params.researchOutput.artifacts.some(
    (artifact) =>
      artifact.kind === "image_candidate" && Boolean(stringValue(artifact.payload.image_url)),
  )
}

export function assertAllowedProductIntakeModel(model: string, lane: string): void {
  if (model.trim().toLowerCase().startsWith("gpt-6-astra")) {
    throw new Error(`GPT-6 Astra is disabled for Product Intake (${lane}).`)
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

export function normalizeImageQualityVerdict(value: JsonRecord): ImageQualityVerdict {
  const verdict = value.verdict
  if (verdict !== "pass" && verdict !== "rework" && verdict !== "needs_human_review") {
    throw new Error("Image quality verdict requires verdict pass, rework, or needs_human_review.")
  }
  const confidence = boundedNumber(value.confidence, 0, 1, "image_quality.confidence")
  if (typeof value.rationale !== "string" || value.rationale.trim().length === 0) {
    throw new Error("Image quality verdict requires a non-empty rationale.")
  }
  if (!Array.isArray(value.defects)) {
    throw new Error("Image quality verdict requires a defects array.")
  }

  const defects = value.defects.map((item, index): ImageQualityDefect => {
    const defect = normalizeRecord(item)
    if (!defect) throw new Error(`Image quality defect ${index} must be an object.`)
    const kind = nonBlankString(defect.kind, `image_quality.defects[${index}].kind`)
    const region = nonBlankString(defect.region, `image_quality.defects[${index}].region`)
    const severity = defect.severity
    if (severity !== "minor" && severity !== "material" && severity !== "critical") {
      throw new Error(`Image quality defect ${index} has invalid severity.`)
    }
    const explanation = nonBlankString(
      defect.explanation,
      `image_quality.defects[${index}].explanation`,
    )
    return { kind, region, severity, explanation }
  })

  if (verdict === "pass" && defects.some((defect) => defect.severity !== "minor")) {
    throw new Error("Image quality pass cannot contain material or critical defects.")
  }

  return {
    verdict,
    confidence,
    defects,
    rationale: value.rationale.trim(),
  }
}

export function loadImageQualityReferenceSet(params: {
  manifestPath: string
  rootDir: string
  maxReferences?: number
}): ImageQualityReferenceSet {
  if (!existsSync(params.manifestPath)) {
    return {
      version: null,
      references: [],
      warnings: [`Reference manifest not found: ${params.manifestPath}`],
    }
  }

  const manifest = parseJsonObject(readFileSync(params.manifestPath, "utf8"))
  const version = nonBlankString(manifest.version, "image reference manifest version")
  if (!Array.isArray(manifest.references)) {
    throw new Error("Image reference manifest requires a references array.")
  }

  const root = resolve(params.rootDir)
  const limit = Math.min(Math.max(params.maxReferences ?? 5, 0), 5)
  const references: ImageQualityReference[] = []
  const warnings: string[] = []

  for (const [index, item] of manifest.references.entries()) {
    if (references.length >= limit) break
    const entry = normalizeRecord(item)
    if (!entry) throw new Error(`Image reference ${index} must be an object.`)
    const id = nonBlankString(entry.id, `image reference ${index} id`)
    const expectedVerdict = entry.expected_verdict
    if (
      expectedVerdict !== "pass" &&
      expectedVerdict !== "rework" &&
      expectedVerdict !== "needs_human_review"
    ) {
      throw new Error(`Image reference ${id} has an invalid expected verdict.`)
    }
    const relativePath = nonBlankString(entry.relative_path, `image reference ${id} relative_path`)
    const imagePath = resolve(root, relativePath)
    if (imagePath !== root && !imagePath.startsWith(`${root}${sep}`)) {
      throw new Error(`Image reference ${id} resolves outside the configured root.`)
    }
    if (!existsSync(imagePath)) {
      warnings.push(`Image reference ${id} is missing: ${imagePath}`)
      continue
    }
    const expectedSha256 = optionalNonBlankString(entry.sha256)
    if (expectedSha256) {
      const actualSha256 = createHash("sha256").update(readFileSync(imagePath)).digest("hex")
      if (actualSha256 !== expectedSha256.toLowerCase()) {
        warnings.push(`Image reference ${id} failed SHA-256 validation.`)
        continue
      }
    }
    const rawDefects = Array.isArray(entry.defects) ? entry.defects : []
    const defects = rawDefects.map((rawDefect, defectIndex) => {
      const defect = normalizeRecord(rawDefect)
      if (!defect) throw new Error(`Image reference ${id} defect ${defectIndex} is invalid.`)
      return {
        kind: nonBlankString(defect.kind, `image reference ${id} defect kind`),
        region: nonBlankString(defect.region, `image reference ${id} defect region`),
      }
    })
    references.push({
      id,
      expectedVerdict,
      imagePath,
      rationale: nonBlankString(entry.rationale, `image reference ${id} rationale`),
      defects,
    })
  }

  return { version, references, warnings }
}

export function imageQualityPreparationDecision(params: {
  deterministicReady: boolean
  judgeEnabled: boolean
  verdict: ImageQualityVerdict["verdict"] | null
}): { finalImageReady: boolean; status: "pending_review" | "needs_image_work" } {
  const finalImageReady = params.judgeEnabled
    ? params.verdict === "pass"
    : params.deterministicReady
  return {
    finalImageReady,
    status: finalImageReady ? "pending_review" : "needs_image_work",
  }
}

export function buildImageQualityJudgePrompt(params: {
  referenceSet: ImageQualityReferenceSet
}): string {
  return [
    "You are the read-only visual quality judge for one processed Chaarlie product image.",
    "Do not edit files, write databases, approve the image, or approve publication.",
    "The first three attached images are, in order: (1) raw researched source, (2) transparent cutout rendered on magenta QA, and (3) final neutral-background render.",
    "Any remaining attached images are labeled references described in the JSON below.",
    "Inspect the whole product perimeter at high attention, especially the bottom and corners.",
    "Return rework for removable floor shadows or reflections, outer box or secondary packaging, bundles or extra objects, edge residue or halos, rectangular background remnants, jagged edges, detached pixels, or product content cut away by the mask.",
    "Do not mistake an intrinsic dark bottle base, cap, pump, label edge, or transparent packaging content for removable background residue.",
    "Return needs_human_review when image identity or edge quality cannot be determined confidently.",
    "Return exactly one JSON object with verdict (pass, rework, or needs_human_review), confidence (0..1), defects, and rationale.",
    "Each defect must include kind, region, severity (minor, material, or critical), and explanation. A pass may contain only minor observations.",
    "Reference examples:",
    JSON.stringify({
      version: params.referenceSet.version,
      examples: params.referenceSet.references.map((reference, index) => ({
        attachment_index: index + 4,
        id: reference.id,
        expected_verdict: reference.expectedVerdict,
        rationale: reference.rationale,
        defects: reference.defects,
      })),
      warnings: params.referenceSet.warnings,
    }),
  ].join("\n")
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

function boundedNumber(value: unknown, min: number, max: number, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Model judge verdict has invalid ${field}.`)
  }
  return value
}

function nonBlankEnv(value: string | undefined, fallback: string): string {
  const normalized = value?.trim()
  return normalized ? normalized : fallback
}

function optionalServiceTier(value: string | undefined): string | null {
  const normalized = value?.trim()
  return normalized && normalized !== "standard" ? normalized : null
}

function nonBlankString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`)
  }
  return value.trim()
}

function optionalNonBlankString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
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

function parseJsonObject(raw: string): JsonRecord {
  try {
    const parsed = JSON.parse(raw) as unknown
    const record = normalizeRecord(parsed)
    if (record) return record
  } catch {
    // Fall through to fenced/object extraction.
  }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) {
    const parsed = JSON.parse(fenced[1]) as unknown
    const record = normalizeRecord(parsed)
    if (record) return record
  }

  const firstBrace = raw.indexOf("{")
  const lastBrace = raw.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as unknown
    const record = normalizeRecord(parsed)
    if (record) return record
  }

  throw new Error("Codex output was not a JSON object.")
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

function hasFinalResearchPayload(value: JsonRecord | null | undefined): value is JsonRecord {
  return Boolean(normalizeRecord(value)?.final && normalizeRecord(normalizeRecord(value)?.final))
}

function findApprovedSourceImageUrl(detail: ProductIntakeSubmissionDetail | null): string | null {
  const final = normalizeRecord(detail?.payload?.final)
  const product = normalizeRecord(final?.product)
  const productImageUrl = stringValue(product?.image_url)
  if (productImageUrl) return productImageUrl

  for (const artifact of detail?.artifacts ?? []) {
    if (artifact.kind !== "image_candidate") continue
    const imageUrl = stringValue(artifact.payload.image_url)
    if (imageUrl) return imageUrl
  }

  return null
}

function findApprovedSourcePageUrl(detail: ProductIntakeSubmissionDetail | null): string | null {
  const final = normalizeRecord(detail?.payload?.final)
  const sources = Array.isArray(final?.sources) ? final.sources : []
  for (const source of sources) {
    const record = normalizeRecord(source)
    const url = stringValue(record?.url)
    if (url) return url
  }

  for (const artifact of detail?.artifacts ?? []) {
    if (artifact.kind !== "image_candidate") continue
    const url = stringValue(artifact.payload.source_page_url)
    if (url) return url
  }

  return null
}

function productLabelForImage(detail: ProductIntakeSubmissionDetail | null): string {
  return (
    [detail?.brand, detail?.product_name]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .join(" ")
      .trim() || "product-image"
  )
}

function slugForProcessedImage(detail: ProductIntakeSubmissionDetail | null): string {
  const raw = productLabelForImage(detail)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return raw || "product-image"
}

function dateFolderForJob(job: ProductIntakeResearchJob): string {
  const iso = job.created_at || new Date().toISOString()
  return iso.slice(0, 10)
}

function imageExtension(
  contentType: string | null,
  imageUrl: string,
): "avif" | "webp" | "png" | "jpg" {
  const normalized = contentType?.toLowerCase() ?? ""
  if (normalized.includes("avif")) return "avif"
  if (normalized.includes("webp")) return "webp"
  if (normalized.includes("png")) return "png"
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg"

  try {
    const path = new URL(imageUrl).pathname.toLowerCase()
    const name = basename(path)
    if (name.endsWith(".avif")) return "avif"
    if (name.endsWith(".webp")) return "webp"
    if (name.endsWith(".png")) return "png"
  } catch {
    // Fall through to the broadly supported default.
  }
  return "jpg"
}

function runVisionBackgroundRemoval(params: {
  sourceFile: string
  outputDir: string
  outputSlug: string
}): string | null {
  const direct = spawnSync(
    "swift",
    ["scripts/product-images/removebg.swift", params.outputDir, params.sourceFile],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10,
    },
  )
  const sourceBase = basename(params.sourceFile).replace(/\.[^.]+$/, "")
  const directOutput = join(params.outputDir, `${sourceBase}.png`)
  if (!direct.error && direct.status === 0 && existsSync(directOutput)) return directOutput

  const paddedOutput = join(params.outputDir, `${params.outputSlug}-vision-padded.png`)
  const padded = spawnSync(
    "swift",
    ["scripts/product-images/removebg-padded.swift", params.sourceFile, paddedOutput],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10,
    },
  )

  if (!padded.error && padded.status === 0 && existsSync(paddedOutput)) return paddedOutput
  return null
}

function runAutomaticBackgroundRemoval(params: {
  sourceFile: string
  outputDir: string
  outputSlug: string
}): { file: string; method: "vision" | "rembg_isnet_general_use" } | null {
  if (process.platform === "darwin") {
    const visionFile = runVisionBackgroundRemoval(params)
    if (visionFile) return { file: visionFile, method: "vision" }
  }

  const rembg = runRembgContainer({
    sourceFile: params.sourceFile,
    outputFile: join(params.outputDir, `${params.outputSlug}-rembg-isnet.png`),
    config: rembgRuntimeConfig(process.env),
  })
  return rembg ? { file: rembg, method: "rembg_isnet_general_use" } : null
}

export function rembgRuntimeConfig(env: Record<string, string | undefined>): RembgRuntimeConfig {
  const enabled = /^(1|true|yes|on)$/i.test(env.PRODUCT_INTAKE_REMBG_ENABLED?.trim() ?? "")
  const parsedTimeout = Number.parseInt(env.PRODUCT_INTAKE_REMBG_TIMEOUT_MS ?? "", 10)
  const timeoutMs = Number.isFinite(parsedTimeout)
    ? Math.max(30_000, Math.min(parsedTimeout, 10 * 60_000))
    : 3 * 60_000

  return {
    enabled,
    dockerBin: env.PRODUCT_INTAKE_REMBG_DOCKER_BIN?.trim() || "docker",
    image: REMBG_IMAGE,
    model: REMBG_MODEL,
    modelDir:
      env.PRODUCT_INTAKE_REMBG_MODEL_DIR?.trim() ||
      join(process.cwd(), "tmp", "product-intake-rembg-models"),
    timeoutMs,
  }
}

export function finalizedImageOutputRoot(
  env: Readonly<Record<string, string | undefined>>,
  cwd = process.cwd(),
): string {
  return (
    env.PRODUCT_INTAKE_FINALIZED_IMAGE_DIR?.trim() ||
    join(cwd, "apps/product-intake-review/public/product-intake-finalized")
  )
}

export function rembgContainerArgs(params: {
  config: RembgRuntimeConfig
  sourceFile: string
  outputFile: string
}): string[] {
  const sourceDir = resolve(dirname(params.sourceFile))
  const outputDir = resolve(dirname(params.outputFile))
  const modelDir = resolve(params.config.modelDir)

  return [
    "run",
    "--rm",
    "--network=none",
    "--memory=2500m",
    "--memory-swap=3g",
    "--cpus=2",
    "--pids-limit=256",
    "--read-only",
    "--tmpfs=/tmp:rw,nosuid,nodev,size=256m",
    "--tmpfs=/root/.cache:rw,nosuid,nodev,size=128m",
    "--env",
    "NUMBA_CACHE_DIR=/tmp/numba",
    "--env",
    "XDG_CACHE_HOME=/tmp/cache",
    "-v",
    `${sourceDir}:/input:ro`,
    "-v",
    `${outputDir}:/output`,
    "-v",
    `${modelDir}:/root/.rembg:ro`,
    params.config.image,
    "i",
    "-m",
    params.config.model,
    `/input/${basename(params.sourceFile)}`,
    `/output/${basename(params.outputFile)}`,
  ]
}

function runRembgContainer(params: {
  config: RembgRuntimeConfig
  sourceFile: string
  outputFile: string
}): string | null {
  if (!params.config.enabled) return null
  mkdirSync(dirname(params.outputFile), { recursive: true })
  mkdirSync(params.config.modelDir, { recursive: true })

  const result = spawnSync(params.config.dockerBin, rembgContainerArgs(params), {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
    timeout: params.config.timeoutMs,
  })
  if (!result.error && result.status === 0 && existsSync(params.outputFile)) {
    return params.outputFile
  }

  const detail = [result.error?.message, result.stderr?.trim()]
    .filter((value): value is string => Boolean(value))
    .join("; ")
  console.error(`rembg background removal failed${detail ? `: ${detail}` : "."}`)
  return null
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

function normalizeRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null
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
