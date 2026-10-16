import { basename, resolve } from "node:path"
import { readFile, realpath } from "node:fs/promises"
import { isDeepStrictEqual } from "node:util"
import {
  loadReviewAuthorityPreflight,
  reviewRpc,
  type ReviewBinding,
  type ReviewPublicationReceipt,
  type ProductIntakeReviewAssetInput,
} from "@chaarlie/product-intake-core"
import {
  loadReviewPublicationPreflight,
  publishReviewedProduct,
  executeReviewAction,
  stableReviewRequestId,
  reviewBinding,
} from "../../src/lib/product-intake/review-publication"
import {
  imageSha256,
  uploadLegacyReviewImage,
  validateFinalImageBytes,
} from "../../src/lib/product-intake/publication-images"

import {
  createSupabaseClientFromEnv,
  flag,
  flagBool,
  parseArgs,
  printJson,
  requireFlag,
} from "./cli"
import { validateProductIntakeImageFinalization } from "./image-finalization"
import { validateResearchPackage } from "./prepare-research"
import {
  appendProductAdditionRecord,
  dryRunResearchedPayload,
  loadSubmission,
  saveResearchedPayload,
  validateSubmissionReady,
  type ReviewActionSubmission,
} from "./review-actions"

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

function researchedPayloadWithFinalImageMetadata(pack: ResearchPackage): Record<string, unknown> {
  if (
    (pack.imageFinalization as { status?: unknown } | null)?.status === "no_image_approved_for_now"
  ) {
    const payload = structuredClone(pack.researchedPayload)
    const product = (payload.final as { product?: Record<string, unknown> } | undefined)?.product
    // Absence is an explicit reviewed choice, never inferred from a missing file.
    if (product && product.image_url == null) {
      product.image_url = null
      product.canonical_image_sha256 = null
      product.thumbnail_image_url = null
    }
    return payload
  }
  if (
    !pack.imageFinalization ||
    typeof pack.imageFinalization !== "object" ||
    Array.isArray(pack.imageFinalization) ||
    (pack.imageFinalization as { status?: unknown }).status !== "approved_asset"
  ) {
    return pack.researchedPayload
  }

  const decision = pack.imageFinalization as {
    asset_sha256?: unknown
    thumbnail_public_url?: unknown
  }
  const cloned = JSON.parse(JSON.stringify(pack.researchedPayload)) as Record<string, unknown>
  const final = cloned.final as Record<string, unknown> | undefined
  const product = final?.product as Record<string, unknown> | undefined
  if (!product) return cloned
  product.canonical_image_sha256 = decision.asset_sha256
  product.thumbnail_image_url = decision.thumbnail_public_url
  return cloned
}

export function buildApprovePackageDryRun(params: {
  pack: ResearchPackage
  submission: ReviewActionSubmission
  reviewedBy: string
  reviewNotes: string | null
}) {
  const approvalPayload = researchedPayloadWithFinalImageMetadata(params.pack)
  const researchSave = dryRunResearchedPayload({
    submission: params.submission,
    researchedPayload: approvalPayload,
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
      will_use_guarded_publication_service: true,
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
  if (submission.status !== "approved" && submission.status !== "matched_existing") {
    if (
      dryRun.research_save.next_status !== "ready_for_review" ||
      !dryRun.research_save.dry_run.ok
    ) {
      throw new Error("Approve-package requires a complete ready_for_review payload before writes")
    }
    if (!dryRun.image_finalization.ok) {
      throw new Error(dryRun.image_finalization.reason)
    }
  }
  const publicationRequestId = stableReviewRequestId([
    "approve-package",
    pack.submissionId,
    params.reviewedBy,
    pack.researchedPayload,
    pack.imageFinalization,
  ])
  // Reconcile before saving the payload again: publication itself rotates its revision.
  const existing = await supabase
    .from("product_intake_publication_receipts")
    .select("*")
    .eq("request_id", publicationRequestId)
    .maybeSingle()
  if (existing.error) throw new Error("review_receipt_unavailable")
  if (existing.data) {
    const receipt = existing.data as ReviewPublicationReceipt
    const approval = await publishReviewedProduct(supabase, {
      ...reviewBinding(receipt),
      request_id: publicationRequestId,
      reviewed_by: params.reviewedBy,
      data_decision_id: receipt.data_decision_id,
      image_decision_id: receipt.image_decision_id,
      confirm: true,
    })
    const additionRecordPath = await recordPackagePublication(
      pack,
      approval.publication,
      params.reviewedBy,
      submission,
    )
    return {
      ...dryRun,
      mode: "applied" as const,
      approval,
      addition_record_path: additionRecordPath,
    }
  }
  if (dryRun.research_save.next_status !== "ready_for_review" || !dryRun.research_save.dry_run.ok) {
    throw new Error("Approve-package requires a complete ready_for_review payload before writes")
  }
  if (!dryRun.image_finalization.ok) {
    throw new Error(dryRun.image_finalization.reason)
  }

  const authority = await loadReviewAuthorityPreflight(supabase, pack.submissionId)
  if (authority.publication) throw new Error("review_already_published_with_another_package")
  const decision = dryRun.image_finalization.decision
  const imageBytes =
    decision.status === "approved_asset" ? await loadPackageReviewImages(pack, decision) : []
  const approvalPayload = researchedPayloadWithFinalImageMetadata(pack)
  const validated = dryRunResearchedPayload({
    submission,
    researchedPayload: approvalPayload,
    markReady: true,
  }).dry_run
  if (!validated.ok) throw new Error("review_payload_invalid")
  const normalized = structuredClone(validated.normalizedPayload) as unknown as Record<
    string,
    unknown
  >
  const final = normalized.final as { product: Record<string, unknown> }
  if (decision.status === "no_image_approved_for_now") {
    final.product.image_url = null
    final.product.canonical_image_sha256 = null
    final.product.thumbnail_image_url = null
  }
  let currentBinding = reviewBinding(authority)
  if (authority.job_id) {
    // A worker owns this saved revision. A local package may approve its exact
    // committed evidence but may never overwrite or replace it.
    const storedValidation = dryRunResearchedPayload({
      submission,
      researchedPayload: submission.researched_payload ?? {},
      markReady: true,
    }).dry_run
    if (
      !storedValidation.ok ||
      !isDeepStrictEqual(
        storedValidation.normalizedPayload.final,
        validated.normalizedPayload.final,
      )
    )
      throw new Error("review_worker_package_mismatch")
    if (
      decision.status === "approved_asset" &&
      (authority.final_asset?.sha256 !== decision.asset_sha256 ||
        authority.thumbnail_asset?.sha256 !== decision.thumbnail_asset_sha256)
    )
      throw new Error("review_worker_image_mismatch")
    for (const action of ["approve_data", "approve_image"] as const) {
      const input = {
        ...currentBinding,
        reviewed_by: params.reviewedBy,
        action,
        ...(action === "approve_image"
          ? {
              approved_asset_sha256:
                decision.status === "approved_asset" ? decision.asset_sha256 : null,
              reviewer_value: { no_image: decision.status === "no_image_approved_for_now" },
              comment: decision.notes ?? params.reviewNotes,
            }
          : {}),
      }
      await executeReviewAction(supabase, {
        ...input,
        request_id: stableReviewRequestId([publicationRequestId, input]),
      })
    }
  } else {
    normalized.draft = {
      ...(typeof normalized.draft === "object" && normalized.draft ? normalized.draft : {}),
      review_image_finalization: pack.imageFinalization,
    }
    if (
      !isDeepStrictEqual(submission.researched_payload, normalized) ||
      submission.status !== "ready_for_review"
    ) {
      await deps.savePayload({
        supabase,
        submission,
        researchedPayload: normalized,
        markReady: true,
      })
    }
    const saved = (await deps.loadSubmissionById(
      supabase,
      pack.submissionId,
    )) as ReviewActionSubmission & { payload_revision: number; payload_sha256: string }
    currentBinding = {
      submission_id: saved.id,
      payload_revision: saved.payload_revision,
      payload_sha256: saved.payload_sha256,
      job_id: null,
      review_cycle_id: null,
    }
    const assets: ProductIntakeReviewAssetInput[] = []
    for (const image of imageBytes)
      assets.push(await uploadLegacyReviewImage(supabase, currentBinding, image.kind, image.bytes))
    await reviewRpc(supabase, "product_intake_register_legacy_review", {
      p_request: {
        ...currentBinding,
        request_id: stableReviewRequestId([publicationRequestId, "legacy-review"]),
        reviewed_by: params.reviewedBy,
        approve_data: true,
        approve_image: true,
        no_image: decision.status === "no_image_approved_for_now",
        review_assets: assets,
        comment: decision.notes ?? params.reviewNotes,
      },
    })
  }
  const ready = await loadReviewPublicationPreflight(supabase, pack.submissionId)
  if (!ready.ok || !ready.data_decision_id || !ready.image_decision_id)
    throw new Error(`review_preflight_failed: ${ready.blockers.join(", ")}`)
  const approval = await publishReviewedProduct(supabase, {
    ...reviewBinding(ready),
    request_id: publicationRequestId,
    reviewed_by: params.reviewedBy,
    data_decision_id: ready.data_decision_id,
    image_decision_id: ready.image_decision_id,
    confirm: true,
  })
  const additionRecordPath = await recordPackagePublication(
    pack,
    approval.publication,
    params.reviewedBy,
    submission,
  )
  return { ...dryRun, mode: "applied" as const, approval, addition_record_path: additionRecordPath }
}

async function recordPackagePublication(
  pack: ResearchPackage,
  receipt: ReviewPublicationReceipt,
  reviewedBy: string,
  submission: ReviewActionSubmission,
) {
  // This local audit record is recoverable from the durable receipt. A file write
  // failure must never misreport the already committed catalog handoff as failed.
  try {
    const validation = validateSubmissionReady({
      ...submission,
      status: "ready_for_review",
      researched_payload: researchedPayloadWithFinalImageMetadata(pack),
    })
    if (!validation.ok) return null
    const final = structuredClone(validation.normalizedPayload.final)
    if (receipt.approved_asset_sha256) {
      final.product.image_url = `https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/product-intake/review/${receipt.approved_asset_sha256}.webp`
      final.product.canonical_image_sha256 = receipt.approved_asset_sha256
      final.product.thumbnail_image_url = `https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/thumbnails/search-v1/${receipt.approved_asset_sha256}.webp`
    }
    return await appendProductAdditionRecord({
      submission_id: pack.submissionId,
      product_id: receipt.product_id,
      category_key: final.product.category_key,
      brand_id: receipt.brand_id,
      product_line_id: receipt.product_line_id,
      approved_at: receipt.created_at,
      reviewed_by: reviewedBy,
      final_payload: final,
      spec_operations: validation.targetSpecOperations,
    })
  } catch {
    return null
  }
}

async function loadPackageReviewImages(
  pack: ResearchPackage,
  decision: Extract<
    import("./image-finalization").ProductIntakeImageFinalizationDecision,
    { status: "approved_asset" }
  >,
) {
  const evidence = pack.imageFinalization as Record<string, unknown>
  if ((evidence.quality_gate as { status?: unknown } | undefined)?.status !== "pass")
    throw new Error("review_image_finalizer_invalid")
  const root = await realpath(pack.packageDir)
  async function bytes(relative: unknown) {
    if (typeof relative !== "string" || !relative) throw new Error("review_package_image_missing")
    const file = await realpath(resolve(root, relative))
    if (!file.startsWith(`${root}/`)) throw new Error("review_package_image_outside_package")
    return readFile(file)
  }
  const final = await bytes(decision.final_file)
  const thumbnail = await bytes(decision.thumbnail_final_file)
  if (
    imageSha256(final) !== decision.asset_sha256 ||
    imageSha256(thumbnail) !== decision.thumbnail_asset_sha256
  )
    throw new Error("review_package_image_bytes_changed")
  await validateFinalImageBytes(final)
  await validateFinalImageBytes(thumbnail, true)
  return [
    { kind: "raw" as const, bytes: await bytes(evidence.selected_source_file) },
    { kind: "magenta" as const, bytes: await bytes(evidence.qa_file) },
    { kind: "neutral" as const, bytes: final },
    { kind: "final" as const, bytes: final },
    { kind: "search_thumbnail" as const, bytes: thumbnail },
  ]
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
