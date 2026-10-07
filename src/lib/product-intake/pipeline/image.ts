import { mkdirSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"
import { createHash } from "node:crypto"
import sharp from "sharp"
import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  appendResearchArtifact,
  updateResearchJob,
  JsonRecord,
  ProductIntakeResearchJob,
  ProductIntakeSubmissionDetail,
} from "@chaarlie/product-intake-core"

import { finalizeProductImageAsset } from "../../../../scripts/product-intake/finalize-package-image"
import { finalizedImageOutputRoot, runAutomaticBackgroundRemoval } from "./image-background"
import {
  imageQualityJudgeRuntimeConfig,
  imageQualityPreparationDecision,
  loadImageQualityReferenceSet,
  runCodexImageQualityJudge,
  type ImageQualityJudgeDeps,
  type ImageQualityJudgeRuntimeConfig,
  type ImageQualityReferenceSet,
  type ImageQualityVerdict,
} from "./image-quality"
import {
  hasFinalResearchPayload,
  normalizeRecord,
  optionalNonBlankString,
  stringValue,
} from "./shared"

export * from "./image-background"
export * from "./image-quality"

export type ImageStageDeps = ImageQualityJudgeDeps & {
  appendResearchArtifact: typeof appendResearchArtifact
  updateResearchJob: typeof updateResearchJob
  measureModelRun: (
    lane: "image_judge",
    runtimeConfig: ImageQualityJudgeRuntimeConfig,
    execute: () => Promise<ImageQualityVerdict>,
  ) => Promise<
    | { success: true; durationMs: number; outputHash: string; output: ImageQualityVerdict }
    | { success: false; durationMs: number; error: string }
  >
  refreshModelRunLease: (params: {
    supabase: SupabaseClient
    job: ProductIntakeResearchJob
    workerId: string
    promptPacketPath: string
    message: string
  }) => Promise<ProductIntakeResearchJob>
  captureOptionalTelemetryFailure: (write: () => Promise<unknown>) => Promise<string | null>
}

export async function processApprovedImageForReview(
  params: {
    supabase: SupabaseClient
    job: ProductIntakeResearchJob
    detail: ProductIntakeSubmissionDetail | null
    workerId: string
    promptPacketPath: string
    executeCodex: boolean
    onLeaseRefresh?: (job: ProductIntakeResearchJob) => void
  },
  deps: ImageStageDeps,
) {
  const {
    appendResearchArtifact,
    updateResearchJob,
    measureModelRun,
    refreshModelRunLease,
    captureOptionalTelemetryFailure,
  } = deps
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
    : await runAutomaticBackgroundRemoval({
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
    const visualRun = await measureModelRun("image_judge", judgeConfig, () => {
      referenceSet = loadImageQualityReferenceSet({
        manifestPath,
        rootDir: referenceRoot,
        maxReferences: 5,
      })
      return runCodexImageQualityJudge(
        {
          promptPacketPath: params.promptPacketPath,
          currentImagePaths: [sourceFile, finalized.qaFile, finalized.finalFile],
          runtimeConfig: judgeConfig,
          referenceSet,
        },
        deps,
      )
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

export async function processedImageAlphaStats(bytes: Buffer) {
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

export function shouldAutoPrepareImage(params: {
  enabled: boolean
  researchOutput: {
    researched_payload?: JsonRecord | null
    artifacts: Array<{ kind: string; payload: JsonRecord }>
    blockers: string[]
  }
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

export function findApprovedSourceImageUrl(
  detail: ProductIntakeSubmissionDetail | null,
): string | null {
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

export function findApprovedSourcePageUrl(
  detail: ProductIntakeSubmissionDetail | null,
): string | null {
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

export function productLabelForImage(detail: ProductIntakeSubmissionDetail | null): string {
  return (
    [detail?.brand, detail?.product_name]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .join(" ")
      .trim() || "product-image"
  )
}

export function slugForProcessedImage(detail: ProductIntakeSubmissionDetail | null): string {
  const raw = productLabelForImage(detail)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return raw || "product-image"
}

export function dateFolderForJob(job: ProductIntakeResearchJob): string {
  const iso = job.created_at || new Date().toISOString()
  return iso.slice(0, 10)
}

export function imageExtension(
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
