import { basename, resolve } from "node:path"
import { readFile } from "node:fs/promises"

import {
  createSupabaseClientFromEnv,
  flag,
  flagBool,
  parseArgs,
  printJson,
  requireFlag,
} from "./cli"
import { approveSubmissionById } from "./approve"
import { validateProductIntakeImageFinalization } from "./image-finalization"
import { validateResearchPackage } from "./prepare-research"
import {
  dryRunResearchedPayload,
  loadSubmission,
  saveResearchedPayload,
  type ReviewActionSubmission,
} from "./review-actions"
import { uploadApprovedPackageImage } from "./upload-package-image"

type ResearchPackageSubmissionSnapshot = {
  id?: unknown
  submission?: { id?: unknown }
  package_metadata?: { submission_id?: unknown }
}

export type ResearchPackage = {
  packageDir: string
  submissionId: string
  submissionPath: string
  payloadPath: string
  researchedPayload: Record<string, unknown>
  imageFinalizationPath: string
  imageFinalization: unknown | null
}

type ApprovePackageDeps = {
  createSupabaseClient?: typeof createSupabaseClientFromEnv
  loadSubmissionById?: typeof loadSubmission
  savePayload?: typeof saveResearchedPayload
  approveById?: typeof approveSubmissionById
  uploadFinalImage?: typeof uploadApprovedPackageImage
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown
}

async function readOptionalJson(path: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}

function submissionIdFromSnapshot(snapshot: ResearchPackageSubmissionSnapshot): string | null {
  if (typeof snapshot.id === "string" && snapshot.id.trim()) return snapshot.id.trim()
  const nested = snapshot.submission?.id
  return typeof nested === "string" && nested.trim() ? nested.trim() : null
}

export async function readResearchPackage(packageDir: string): Promise<ResearchPackage> {
  const resolvedPackageDir = resolve(packageDir)
  const packageCompleteness = await validateResearchPackage(resolvedPackageDir)
  if (!packageCompleteness.ok) {
    throw new Error(
      `Research package is missing required files: ${packageCompleteness.missingFiles.join(", ")}`,
    )
  }

  const submissionPath = resolve(resolvedPackageDir, "submission.json")
  const payloadPath = resolve(resolvedPackageDir, "payload.json")
  const imageFinalizationPath = resolve(resolvedPackageDir, "image-finalization.json")
  const submissionSnapshot = (await readJson(submissionPath)) as ResearchPackageSubmissionSnapshot
  const researchedPayload = await readJson(payloadPath)
  const imageFinalization = await readOptionalJson(imageFinalizationPath)
  const submissionId = submissionIdFromSnapshot(submissionSnapshot)
  const metadataSubmissionId = submissionSnapshot.package_metadata?.submission_id

  if (!submissionId) {
    throw new Error(`Research package is missing submission id: ${submissionPath}`)
  }
  if (
    typeof metadataSubmissionId === "string" &&
    metadataSubmissionId.trim() &&
    metadataSubmissionId.trim() !== submissionId
  ) {
    throw new Error(
      `Research package metadata submission ${metadataSubmissionId.trim()} does not match submission ${submissionId}`,
    )
  }
  if (basename(resolvedPackageDir) !== submissionId) {
    throw new Error(
      `Research package folder id ${basename(resolvedPackageDir)} does not match submission ${submissionId}`,
    )
  }
  if (
    !researchedPayload ||
    typeof researchedPayload !== "object" ||
    Array.isArray(researchedPayload)
  ) {
    throw new Error(`Research package payload must be an object: ${payloadPath}`)
  }

  return {
    packageDir: resolvedPackageDir,
    submissionId,
    submissionPath,
    payloadPath,
    researchedPayload: researchedPayload as Record<string, unknown>,
    imageFinalizationPath,
    imageFinalization,
  }
}

function finalProductImageUrl(researchedPayload: Record<string, unknown>): unknown {
  const final = researchedPayload.final
  if (!final || typeof final !== "object" || Array.isArray(final)) return null
  const product = (final as { product?: unknown }).product
  if (!product || typeof product !== "object" || Array.isArray(product)) return null
  return (product as { image_url?: unknown }).image_url
}

export function buildApprovePackageDryRun(params: {
  pack: ResearchPackage
  submission: ReviewActionSubmission
  reviewedBy: string
  reviewNotes: string | null
}) {
  const researchSave = dryRunResearchedPayload({
    submission: params.submission,
    researchedPayload: params.pack.researchedPayload,
    markReady: true,
  })
  const imageFinalization =
    params.pack.imageFinalization === null
      ? {
          ok: false as const,
          reason: "Approve-package requires approved product image finalization before writes",
        }
      : validateProductIntakeImageFinalization({
          value: params.pack.imageFinalization,
          finalProductImageUrl: finalProductImageUrl(params.pack.researchedPayload),
        })

  return {
    package_dir: params.pack.packageDir,
    submission_id: params.pack.submissionId,
    reviewed_by: params.reviewedBy,
    review_notes: params.reviewNotes,
    current_status: params.submission.status,
    research_save: {
      next_status: researchSave.next_status,
      dry_run: researchSave.dry_run,
    },
    image_finalization: imageFinalization,
    approval: {
      will_reload_submission_after_research_save: true,
      will_call_existing_approve_submission_by_id: true,
      apply_requires_confirm: true,
    },
    image_upload: {
      will_upload_or_verify_before_db_approval: imageFinalization.ok,
      apply_requires_confirm: true,
    },
  }
}

export async function approveResearchPackage(params: {
  packageDir: string
  reviewedBy: string
  reviewNotes: string | null
  apply: boolean
  confirm: boolean
  deps?: ApprovePackageDeps
}) {
  const deps = {
    createSupabaseClient: createSupabaseClientFromEnv,
    loadSubmissionById: loadSubmission,
    savePayload: saveResearchedPayload,
    approveById: approveSubmissionById,
    uploadFinalImage: uploadApprovedPackageImage,
    ...params.deps,
  }
  const pack = await readResearchPackage(params.packageDir)
  const supabase = deps.createSupabaseClient()
  const submission = await deps.loadSubmissionById(supabase, pack.submissionId)
  const dryRun = buildApprovePackageDryRun({
    pack,
    submission,
    reviewedBy: params.reviewedBy,
    reviewNotes: params.reviewNotes,
  })

  if (!params.apply) {
    return {
      ...dryRun,
      mode: "dry_run" as const,
      message: "Dry-run only. Re-run with --apply --confirm to save, approve, and notify.",
    }
  }
  if (!params.confirm) {
    throw new Error("Approve-package writes require --confirm")
  }
  if (dryRun.research_save.next_status !== "ready_for_review" || !dryRun.research_save.dry_run.ok) {
    throw new Error("Approve-package requires a complete ready_for_review payload before writes")
  }
  if (!dryRun.image_finalization.ok) {
    throw new Error(dryRun.image_finalization.reason)
  }

  const imageUpload = await deps.uploadFinalImage({
    supabase,
    packageDir: pack.packageDir,
    imageFinalization: pack.imageFinalization,
    apply: true,
    confirm: true,
  })
  const researchSave = await deps.savePayload({
    supabase,
    submission,
    researchedPayload: pack.researchedPayload,
    markReady: true,
  })
  const approval = await deps.approveById({
    submissionId: pack.submissionId,
    reviewedBy: params.reviewedBy,
    reviewNotes: params.reviewNotes,
    apply: true,
    confirm: true,
  })

  return {
    ...dryRun,
    mode: "applied" as const,
    image_upload: imageUpload,
    research_save: {
      next_status: researchSave.next_status,
      dry_run: researchSave.dry_run,
    },
    approval,
  }
}

async function main() {
  const args = parseArgs()
  const packageDir = requireFlag(args, "package")
  const reviewedBy = requireFlag(args, "reviewed-by")
  const result = await approveResearchPackage({
    packageDir,
    reviewedBy,
    reviewNotes: flag(args, "review-notes"),
    apply: flagBool(args, "apply"),
    confirm: flagBool(args, "confirm"),
  })

  printJson(result)
}

if (process.argv[1]?.endsWith("approve-package.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
