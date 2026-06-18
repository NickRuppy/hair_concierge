import { randomUUID } from "node:crypto"

import { cleanProductDisplayName } from "@/lib/product-identity"
import {
  buildBrandResolutionCatalog,
  resolveBrandFromText,
  type BrandResolutionCatalog,
  type ProductIdentityBrand,
  type ProductIdentityProductLine,
} from "@/lib/product-identity/brand-resolution"
import { matchProductIntake } from "@/lib/product-intake/product-matching"
import {
  ProductIntakePersistenceError,
  ProductIntakeUploadExpiredError,
} from "@/lib/product-intake/errors"
import { assertTemporaryUploadPathBelongsToUser } from "@/lib/product-intake/upload-paths"
import type {
  JsonRecord,
  ProductIntakeRepository,
  ProductIntakeSubmissionRow,
  ProductIntakeUsageRow,
} from "@/lib/product-intake/repository-types"
import type { ProductIntakeCategoryKey, ProductSubmissionSource } from "@/lib/types"
import type { ProductIntakeSubmissionInput } from "@/lib/product-intake/schemas"
import type { ProductIntakeSubmissionResult } from "@/lib/product-intake/types"

export type {
  ProductIntakeRepository,
  ProductIntakeSubmissionRow,
  ProductIntakeUsageRow,
} from "@/lib/product-intake/repository-types"

const REPLACEMENT_CONFLICT_MESSAGE =
  "Du hast für diese Kategorie bereits ein Produkt hinterlegt. Möchtest du es durch dieses Produkt ersetzen?"

const OPEN_SUBMISSION_STATUSES = [
  "pending_review",
  "researching",
  "ready_for_review",
  "needs_more_info",
] as const

export class ProductIntakeConflictError extends Error {
  readonly category: ProductIntakeCategoryKey
  readonly existingUsageId: string

  constructor(category: ProductIntakeCategoryKey, existingUsageId: string) {
    super(REPLACEMENT_CONFLICT_MESSAGE)
    this.name = "ProductIntakeConflictError"
    this.category = category
    this.existingUsageId = existingUsageId
  }
}

export class ProductIntakeOwnershipError extends Error {
  constructor() {
    super("Unterhaltung nicht gefunden")
    this.name = "ProductIntakeOwnershipError"
  }
}

export type SubmitProductIntakeParams = {
  userId: string
  source: ProductSubmissionSource
  input: ProductIntakeSubmissionInput
  repository: ProductIntakeRepository
  now?: () => string
}

function brandId(brand: ProductIdentityBrand | null): string | null {
  return brand?.id ?? brand?.key ?? null
}

function brandName(brand: ProductIdentityBrand | null): string | null {
  return brand?.canonicalName ?? brand?.canonical_name ?? brand?.name ?? brand?.key ?? null
}

function lineId(line: ProductIdentityProductLine | null): string | null {
  return line?.id ?? line?.key ?? null
}

function lineName(line: ProductIdentityProductLine | null): string | null {
  return line?.canonicalName ?? line?.canonical_name ?? line?.name ?? line?.key ?? null
}

function isTrackedUsage(row: ProductIntakeUsageRow): boolean {
  return Boolean(
    row.product_name?.trim() ||
    row.frequency_range ||
    row.brand_text?.trim() ||
    row.product_id ||
    row.product_submission_id ||
    row.match_status !== "text_only" ||
    row.intake_method ||
    row.source ||
    row.front_image_path,
  )
}

function previousSnapshot(row: ProductIntakeUsageRow | null): JsonRecord {
  if (!row) return {}

  return {
    id: row.id,
    category: row.category,
    product_name: row.product_name,
    frequency_range: row.frequency_range,
    brand_text: row.brand_text,
    product_id: row.product_id,
    product_submission_id: row.product_submission_id,
    match_status: row.match_status,
    intake_method: row.intake_method,
    source: row.source,
    front_image_path: row.front_image_path,
  }
}

function restoreUsagePatch(params: {
  userId: string
  category: ProductIntakeCategoryKey
  previousUsage: ProductIntakeUsageRow | null
  now: string
}): Partial<ProductIntakeUsageRow> & { user_id: string; category: ProductIntakeCategoryKey } {
  const previous = params.previousUsage
  return {
    user_id: params.userId,
    category: params.category,
    product_name: previous?.product_name ?? null,
    frequency_range: previous?.frequency_range ?? null,
    brand_text: previous?.brand_text ?? null,
    product_id: previous?.product_id ?? null,
    product_submission_id: previous?.product_submission_id ?? null,
    match_status: previous?.match_status ?? "text_only",
    intake_method: previous?.intake_method ?? null,
    source: previous?.source ?? null,
    front_image_path: previous?.front_image_path ?? null,
    updated_at: params.now,
  }
}

async function commitSubmissionImages(params: {
  repository: ProductIntakeRepository
  userId: string
  submissionId: string
  frontImagePath: string | null
  barcodeImagePath: string | null
  onCommitted?: (path: string) => void
}): Promise<{ frontImagePath: string | null; barcodeImagePath: string | null }> {
  const frontImagePath = params.frontImagePath
    ? await params.repository.commitUploadedImage({
        sourcePath: params.frontImagePath,
        userId: params.userId,
        submissionId: params.submissionId,
        kind: "front",
      })
    : null
  if (frontImagePath) params.onCommitted?.(frontImagePath)

  const barcodeImagePath = params.barcodeImagePath
    ? await params.repository.commitUploadedImage({
        sourcePath: params.barcodeImagePath,
        userId: params.userId,
        submissionId: params.submissionId,
        kind: "barcode",
      })
    : null
  if (barcodeImagePath) params.onCommitted?.(barcodeImagePath)

  return { frontImagePath, barcodeImagePath }
}

async function cleanupFailedPendingSubmission(params: {
  repository: ProductIntakeRepository
  submissionId: string | null
  committedImagePaths: readonly string[]
  linkedUsageId: string | null
  restoreUsagePatch:
    | (Partial<ProductIntakeUsageRow> & {
        user_id: string
        category: ProductIntakeCategoryKey
      })
    | null
}) {
  if (params.linkedUsageId && params.restoreUsagePatch) {
    try {
      await params.repository.updateUserProductUsage(params.linkedUsageId, params.restoreUsagePatch)
    } catch (error) {
      console.warn("[product-intake] failed submission usage rollback failed", error)
      return
    }
  }

  if (params.submissionId) {
    try {
      await params.repository.deleteProductSubmission(params.submissionId)
    } catch (error) {
      console.warn("[product-intake] failed submission row cleanup failed", error)
      return
    }
  }

  if (params.committedImagePaths.length > 0) {
    try {
      await params.repository.removeCommittedImages(params.committedImagePaths)
    } catch (error) {
      console.warn("[product-intake] failed submission image cleanup failed", error)
    }
  }
}

async function cleanupTemporarySubmissionImages(params: {
  repository: ProductIntakeRepository
  frontImagePath: string | null
  barcodeImagePath: string | null
}) {
  const paths = [params.frontImagePath, params.barcodeImagePath].filter((path): path is string =>
    Boolean(path),
  )
  if (paths.length === 0) return

  try {
    await params.repository.removeCommittedImages(paths)
  } catch (error) {
    console.warn("[product-intake] matched submission tmp image cleanup failed", error)
  }
}

async function verifySubmissionImages(params: {
  repository: ProductIntakeRepository
  userId: string
  frontImagePath: string | null
  barcodeImagePath: string | null
}) {
  if (params.frontImagePath) {
    const exists = await params.repository.verifyUploadedImage({
      sourcePath: params.frontImagePath,
      userId: params.userId,
      kind: "front",
    })
    if (!exists) {
      throw new ProductIntakeUploadExpiredError()
    }
  }

  if (params.barcodeImagePath) {
    const exists = await params.repository.verifyUploadedImage({
      sourcePath: params.barcodeImagePath,
      userId: params.userId,
      kind: "barcode",
    })
    if (!exists) {
      throw new ProductIntakeUploadExpiredError()
    }
  }
}

async function verifyAndCleanupMatchedPhotoUploads(params: {
  repository: ProductIntakeRepository
  userId: string
  input: ProductIntakeSubmissionInput
}) {
  if (params.input.intake_method !== "photo") return

  const frontImagePath =
    "front_image_path" in params.input ? (params.input.front_image_path ?? null) : null
  const barcodeImagePath =
    "barcode_image_path" in params.input ? (params.input.barcode_image_path ?? null) : null

  await verifySubmissionImages({
    repository: params.repository,
    userId: params.userId,
    frontImagePath,
    barcodeImagePath,
  })
  await cleanupTemporarySubmissionImages({
    repository: params.repository,
    frontImagePath,
    barcodeImagePath,
  })
}

function toSubmittedUsage(row: ProductIntakeUsageRow) {
  return {
    id: row.id,
    category: row.category,
    product_id: row.product_id,
    product_submission_id: row.product_submission_id,
    match_status: row.match_status,
    front_image_path: row.front_image_path,
  }
}

function committedSubmissionImagePath(params: {
  path: string | null
  userId: string
  submissionId: string
}) {
  return Boolean(params.path?.startsWith(`${params.userId}/${params.submissionId}/`))
}

function collectObsoleteCommittedImagePaths(params: {
  userId: string
  submissionId: string
  previousPaths: readonly (string | null)[]
  nextPaths: readonly (string | null)[]
}) {
  const nextPaths = new Set(params.nextPaths.filter((path): path is string => Boolean(path)))
  const previousPaths = params.previousPaths.filter((path): path is string => Boolean(path))
  return Array.from(
    new Set(
      previousPaths.filter(
        (path) =>
          committedSubmissionImagePath({
            path,
            userId: params.userId,
            submissionId: params.submissionId,
          }) && !nextPaths.has(path),
      ),
    ),
  )
}

function isSamePendingUsageEdit(params: {
  input: ProductIntakeSubmissionInput
  existingUsage: ProductIntakeUsageRow | null
}) {
  const expectedSubmissionId =
    params.input && "existing_submission_id" in params.input
      ? (params.input.existing_submission_id ?? null)
      : null

  return Boolean(
    params.existingUsage &&
    params.existingUsage.product_submission_id &&
    (!expectedSubmissionId ||
      expectedSubmissionId === params.existingUsage.product_submission_id) &&
    (params.existingUsage.match_status === "pending_review" ||
      params.existingUsage.match_status === "needs_more_info") &&
    "existing_usage_id" in params.input &&
    params.input.existing_usage_id === params.existingUsage.id,
  )
}

function isSameOnboardingUsageReference(params: {
  source: ProductSubmissionSource
  input: ProductIntakeSubmissionInput
  existingUsage: ProductIntakeUsageRow | null
}) {
  return Boolean(
    params.source === "onboarding" &&
    params.existingUsage &&
    "existing_usage_id" in params.input &&
    params.input.existing_usage_id === params.existingUsage.id,
  )
}

function buildIntakeHistory(
  input: ProductIntakeSubmissionInput,
  source: ProductSubmissionSource,
  now: string,
) {
  return [
    {
      at: now,
      source,
      intake_method: input.intake_method,
      category: input.category,
      frequency_range: input.frequency_range,
      fields: {
        brand_text: input.brand_text ?? null,
        brand_id: input.brand_id ?? null,
        product_line_id: input.product_line_id ?? null,
        product_name_text: input.product_name_text ?? null,
        front_image_path: "front_image_path" in input ? input.front_image_path : null,
        barcode_image_path:
          "barcode_image_path" in input ? (input.barcode_image_path ?? null) : null,
        front_image_validation_status:
          "front_image_validation_status" in input ? "uncertain" : null,
        barcode_image_validation_status:
          "barcode_image_validation_status" in input && input.barcode_image_path
            ? "uncertain"
            : null,
        source_conversation_id:
          "source_conversation_id" in input ? (input.source_conversation_id ?? null) : null,
      },
    },
  ]
}

async function updatePendingSubmissionInPlace(params: {
  repository: ProductIntakeRepository
  userId: string
  source: ProductSubmissionSource
  input: ProductIntakeSubmissionInput
  existingUsage: ProductIntakeUsageRow
  now: string
  sourceConversationId: string | null
  frontUploadPath: string | null
  barcodeUploadPath: string | null
}): Promise<{
  submission: ProductIntakeSubmissionRow
  usage: ProductIntakeUsageRow
} | null> {
  const submissionId = params.existingUsage.product_submission_id
  if (!submissionId) return null

  const previousSubmission = await params.repository.findProductSubmission(
    submissionId,
    params.userId,
  )
  if (
    !previousSubmission ||
    (previousSubmission.status !== "pending_review" &&
      previousSubmission.status !== "needs_more_info")
  ) {
    return null
  }

  if (params.input.intake_method === "photo") {
    await verifySubmissionImages({
      repository: params.repository,
      userId: params.userId,
      frontImagePath: params.frontUploadPath,
      barcodeImagePath: params.barcodeUploadPath,
    })
  }

  const committedImagePaths: string[] = []
  const previousUsage = params.existingUsage
  let usageUpdated = false
  let submissionUpdated = false

  try {
    const committedImages =
      params.input.intake_method === "photo"
        ? await commitSubmissionImages({
            repository: params.repository,
            userId: params.userId,
            submissionId,
            frontImagePath: params.frontUploadPath,
            barcodeImagePath: params.barcodeUploadPath,
            onCommitted: (path) => committedImagePaths.push(path),
          })
        : { frontImagePath: null, barcodeImagePath: null }

    const frontImagePath =
      params.input.intake_method === "photo"
        ? (committedImages.frontImagePath ??
          previousSubmission.front_image_path ??
          previousUsage.front_image_path)
        : null
    const barcodeImagePath =
      params.input.intake_method === "photo"
        ? (committedImages.barcodeImagePath ?? previousSubmission.barcode_image_path)
        : null

    if (params.input.intake_method === "photo" && !frontImagePath) {
      throw new ProductIntakePersistenceError("Vorderseitenfoto fehlt.")
    }

    const usage = await params.repository.updateUserProductUsage(previousUsage.id, {
      user_id: params.userId,
      category: params.input.category,
      product_name: params.input.product_name_text ?? null,
      frequency_range: params.input.frequency_range,
      brand_text: params.input.brand_text ?? null,
      product_id: null,
      product_submission_id: submissionId,
      match_status: "pending_review",
      intake_method: params.input.intake_method,
      source: params.source,
      front_image_path: frontImagePath,
      updated_at: params.now,
    })
    usageUpdated = true

    const submission = await params.repository.updateProductSubmission(submissionId, {
      user_product_usage_id: usage.id,
      source: params.source,
      source_conversation_id: params.sourceConversationId,
      intake_method: params.input.intake_method,
      category: params.input.category,
      brand_text: params.input.brand_text ?? null,
      product_name_text: params.input.product_name_text ?? null,
      frequency_range: params.input.frequency_range,
      front_image_path: frontImagePath,
      barcode_image_path: barcodeImagePath,
      front_image_validation_status: params.input.intake_method === "photo" ? "uncertain" : null,
      front_image_validation_metadata: {},
      barcode_image_validation_status:
        params.input.intake_method === "photo" && barcodeImagePath ? "uncertain" : null,
      barcode_image_validation_metadata: {},
      status: "pending_review",
      reviewed_at: null,
      reviewed_by: null,
      review_notes: null,
      user_facing_resolution_reason: null,
      user_facing_next_step: null,
      user_facing_missing_fields: [],
      notification_sent_at: null,
      intake_history: [
        ...(Array.isArray(previousSubmission.intake_history)
          ? previousSubmission.intake_history
          : []),
        ...buildIntakeHistory(params.input, params.source, params.now),
      ],
      updated_at: params.now,
    })
    submissionUpdated = true

    const obsoleteImagePaths =
      params.input.intake_method === "photo"
        ? collectObsoleteCommittedImagePaths({
            userId: params.userId,
            submissionId,
            previousPaths: [
              committedImages.frontImagePath ? previousSubmission.front_image_path : null,
              committedImages.frontImagePath ? previousUsage.front_image_path : null,
              committedImages.barcodeImagePath ? previousSubmission.barcode_image_path : null,
            ],
            nextPaths: [frontImagePath, barcodeImagePath],
          })
        : []

    if (obsoleteImagePaths.length > 0) {
      try {
        await params.repository.removeCommittedImages(obsoleteImagePaths)
      } catch (removeError) {
        console.warn("[product-intake] old pending edit image cleanup failed", removeError)
      }
    }

    return { submission, usage }
  } catch (error) {
    if (submissionUpdated) {
      try {
        await params.repository.updateProductSubmission(submissionId, previousSubmission)
      } catch (restoreError) {
        console.warn("[product-intake] pending submission rollback failed", restoreError)
      }
    }
    if (usageUpdated) {
      try {
        await params.repository.updateUserProductUsage(
          previousUsage.id,
          restoreUsagePatch({
            userId: params.userId,
            category: params.input.category,
            previousUsage,
            now: params.now,
          }),
        )
      } catch (restoreError) {
        console.warn("[product-intake] pending usage rollback failed", restoreError)
      }
    }
    if (committedImagePaths.length > 0) {
      try {
        await params.repository.removeCommittedImages(committedImagePaths)
      } catch (removeError) {
        console.warn("[product-intake] pending edit image cleanup failed", removeError)
      }
    }
    throw error
  }
}

function resolveInputIdentity(params: {
  input: ProductIntakeSubmissionInput
  brandCatalog: BrandResolutionCatalog
}): {
  brandId: string | null
  productLineId: string | null
  cleanProductName: string
} {
  if (params.input.brand_id) {
    const brand =
      params.brandCatalog.brands.find(
        (candidate) => brandId(candidate) === params.input.brand_id,
      ) ?? null
    const productLine =
      params.input.product_line_id && params.brandCatalog.productLines
        ? (params.brandCatalog.productLines.find(
            (candidate) => lineId(candidate.line) === params.input.product_line_id,
          )?.line ?? null)
        : null

    return {
      brandId: params.input.brand_id,
      productLineId: params.input.product_line_id ?? null,
      cleanProductName: params.input.product_name_text
        ? cleanProductDisplayName(params.input.product_name_text, {
            brand: brandName(brand),
            productLine: lineName(productLine),
          })
        : "",
    }
  }

  const resolved = params.input.brand_text
    ? resolveBrandFromText(params.input.brand_text, params.brandCatalog)
    : null

  return {
    brandId: brandId(resolved?.brand ?? null),
    productLineId: params.input.product_line_id ?? lineId(resolved?.productLine ?? null),
    cleanProductName: params.input.product_name_text
      ? cleanProductDisplayName(params.input.product_name_text, {
          brand: brandName(resolved?.brand ?? null),
          productLine: lineName(resolved?.productLine ?? null),
        })
      : "",
  }
}

async function upsertMatchedUsage(params: {
  repository: ProductIntakeRepository
  userId: string
  source: ProductSubmissionSource
  input: ProductIntakeSubmissionInput
  existingUsage: ProductIntakeUsageRow | null
  productId: string
  now: string
}): Promise<ProductIntakeUsageRow> {
  return params.repository.replaceUsageWithMatchedProduct({
    userId: params.userId,
    category: params.input.category,
    existingUsageId: params.existingUsage?.id ?? null,
    productId: params.productId,
    productName: params.input.product_name_text ?? null,
    frequencyRange: params.input.frequency_range,
    brandText: params.input.brand_text ?? null,
    intakeMethod: params.input.intake_method,
    source: params.source,
    now: params.now,
  })
}

async function createPendingSubmission(params: {
  repository: ProductIntakeRepository
  userId: string
  source: ProductSubmissionSource
  input: ProductIntakeSubmissionInput
  existingUsage: ProductIntakeUsageRow | null
  now: string
}): Promise<{
  submission: ProductIntakeSubmissionRow
  usage: ProductIntakeUsageRow
}> {
  const sourceConversationId =
    params.source === "chat" && "source_conversation_id" in params.input
      ? (params.input.source_conversation_id ?? null)
      : null
  const frontUploadPath =
    "front_image_path" in params.input ? (params.input.front_image_path ?? null) : null
  const barcodeUploadPath =
    "barcode_image_path" in params.input ? (params.input.barcode_image_path ?? null) : null

  if (
    params.existingUsage &&
    isSamePendingUsageEdit({
      input: params.input,
      existingUsage: params.existingUsage,
    })
  ) {
    const updated = await updatePendingSubmissionInPlace({
      repository: params.repository,
      userId: params.userId,
      source: params.source,
      input: params.input,
      existingUsage: params.existingUsage,
      now: params.now,
      sourceConversationId,
      frontUploadPath: frontUploadPath ?? null,
      barcodeUploadPath,
    })
    if (updated) return updated
  }

  if (params.input.intake_method === "photo" && !frontUploadPath) {
    throw new ProductIntakePersistenceError("Vorderseitenfoto fehlt.")
  }

  if (params.input.intake_method === "photo") {
    await verifySubmissionImages({
      repository: params.repository,
      userId: params.userId,
      frontImagePath: frontUploadPath,
      barcodeImagePath: barcodeUploadPath,
    })
  }

  const submissionId = randomUUID()
  const committedImagePaths: string[] = []
  let insertedSubmissionId: string | null = null

  try {
    const committedImages =
      params.input.intake_method === "photo"
        ? await commitSubmissionImages({
            repository: params.repository,
            userId: params.userId,
            submissionId,
            frontImagePath: frontUploadPath,
            barcodeImagePath: barcodeUploadPath,
            onCommitted: (path) => committedImagePaths.push(path),
          })
        : { frontImagePath: null, barcodeImagePath: null }

    const submission = await params.repository.insertProductSubmission({
      id: submissionId,
      user_id: params.userId,
      user_product_usage_id: null,
      source: params.source,
      source_conversation_id: sourceConversationId,
      intake_method: params.input.intake_method,
      category: params.input.category,
      brand_text: params.input.brand_text ?? null,
      product_name_text: params.input.product_name_text ?? null,
      frequency_range: params.input.frequency_range,
      front_image_path: committedImages.frontImagePath,
      barcode_image_path: committedImages.barcodeImagePath,
      front_image_validation_status: params.input.intake_method === "photo" ? "uncertain" : null,
      front_image_validation_metadata: {},
      barcode_image_validation_status:
        params.input.intake_method === "photo" && barcodeUploadPath ? "uncertain" : null,
      barcode_image_validation_metadata: {},
      previous_product_id: params.existingUsage?.product_id ?? null,
      previous_product_snapshot: previousSnapshot(params.existingUsage),
      status: "pending_review",
      researched_payload: {},
      intake_history: buildIntakeHistory(params.input, params.source, params.now),
      approved_product_id: null,
    })
    insertedSubmissionId = submission.id

    const { usage, submission: linkedSubmission } =
      await params.repository.replaceUsageWithPendingSubmission({
        userId: params.userId,
        category: params.input.category,
        existingUsageId: params.existingUsage?.id ?? null,
        submissionId: submission.id,
        productName: params.input.product_name_text ?? null,
        frequencyRange: params.input.frequency_range,
        brandText: params.input.brand_text ?? null,
        intakeMethod: params.input.intake_method,
        source: params.source,
        frontImagePath: committedImages.frontImagePath,
        now: params.now,
      })

    return { submission: linkedSubmission, usage }
  } catch (error) {
    await cleanupFailedPendingSubmission({
      repository: params.repository,
      submissionId: insertedSubmissionId,
      committedImagePaths,
      linkedUsageId: null,
      restoreUsagePatch: null,
    })
    throw error
  }
}

export async function submitProductIntake(
  params: SubmitProductIntakeParams,
): Promise<ProductIntakeSubmissionResult> {
  if ("front_image_path" in params.input) {
    assertTemporaryUploadPathBelongsToUser(params.input.front_image_path, params.userId)
  }
  if ("barcode_image_path" in params.input) {
    assertTemporaryUploadPathBelongsToUser(params.input.barcode_image_path, params.userId)
  }

  if (
    params.source === "chat" &&
    "source_conversation_id" in params.input &&
    params.input.source_conversation_id
  ) {
    const ownsConversation = await params.repository.verifyConversationOwnership(
      params.input.source_conversation_id,
      params.userId,
    )
    if (!ownsConversation) throw new ProductIntakeOwnershipError()
  }

  const [catalog, brandCatalogInput, existingUsage] = await Promise.all([
    params.repository.loadCatalog({ eligibilityMode: "intake_dedupe" }),
    params.repository.loadBrandResolutionCatalog(),
    params.repository.findUserProductUsage(params.userId, params.input.category),
  ])

  if (
    existingUsage &&
    isTrackedUsage(existingUsage) &&
    !(
      isSameOnboardingUsageReference({
        source: params.source,
        input: params.input,
        existingUsage,
      }) ||
      isSamePendingUsageEdit({
        input: params.input,
        existingUsage,
      })
    ) &&
    params.input.replace_existing_confirmed !== true
  ) {
    throw new ProductIntakeConflictError(params.input.category, existingUsage.id)
  }

  const identity = resolveInputIdentity({
    input: params.input,
    brandCatalog: buildBrandResolutionCatalog(brandCatalogInput),
  })

  const match = matchProductIntake(
    {
      selectedCategoryKey: params.input.category,
      brandId: identity.brandId,
      productLineId: identity.productLineId,
      cleanProductName: identity.cleanProductName,
      productName: params.input.product_name_text ?? null,
    },
    catalog,
  )

  const now = params.now?.() ?? new Date().toISOString()

  if (match.status === "matched" && match.productId) {
    await verifyAndCleanupMatchedPhotoUploads({
      repository: params.repository,
      userId: params.userId,
      input: params.input,
    })

    const usage = await upsertMatchedUsage({
      repository: params.repository,
      userId: params.userId,
      source: params.source,
      input: params.input,
      existingUsage,
      productId: match.productId,
      now,
    })

    return {
      status: "matched",
      source: params.source,
      intake_method: params.input.intake_method,
      category: params.input.category,
      frequency_range: params.input.frequency_range,
      usage: toSubmittedUsage(usage),
      submission: null,
      matched_product_id: match.productId,
      match,
    }
  }

  const { submission, usage } = await createPendingSubmission({
    repository: params.repository,
    userId: params.userId,
    source: params.source,
    input: params.input,
    existingUsage,
    now,
  })

  return {
    status: "pending_review",
    source: params.source,
    intake_method: params.input.intake_method,
    category: params.input.category,
    frequency_range: params.input.frequency_range,
    usage: toSubmittedUsage(usage),
    submission: {
      id: submission.id,
      status: "pending_review",
      category: submission.category,
    },
    matched_product_id: null,
    match,
  }
}

export async function cancelProductIntakeUsage(params: {
  userId: string
  category: ProductIntakeCategoryKey
  repository: ProductIntakeRepository
  now?: () => string
}): Promise<{
  category: ProductIntakeCategoryKey
  usage_id: string | null
  submission_id: string | null
}> {
  const now = params.now?.() ?? new Date().toISOString()
  const result = await params.repository.cancelProductIntakeUsageForCategory({
    userId: params.userId,
    category: params.category,
    now,
  })

  return result
}

export function isOpenProductSubmissionStatus(status: string): boolean {
  return OPEN_SUBMISSION_STATUSES.includes(status as (typeof OPEN_SUBMISSION_STATUSES)[number])
}
