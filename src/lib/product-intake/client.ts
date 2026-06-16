"use client"

import { prepareProductIntakeImageForUpload } from "@/lib/product-intake/client-image-compression"
import type { ProductFrequency } from "@/lib/vocabulary"
import type { ProductIntakeCategoryKey } from "@/lib/types"

export type ProductIntakeMethod = "photo" | "manual"
export type ProductIntakeImageKind = "front" | "barcode"
export type ProductIntakeValidationMetadata = Record<string, unknown>

export type ProductIntakeBrandOption = {
  id: string
  label: string
  brand_id: string
  product_line_id: string | null
}

export type ProductIntakeResponseBody = {
  code?: string
  error?: string
  path?: string
  status?: "matched" | "pending_review"
  validation_status?: string
  validation_metadata?: ProductIntakeValidationMetadata
  usage?: {
    id?: string
    front_image_path?: string | null
  }
}

export type ProductIntakeUploadResult = {
  path: string
  validationStatus: string
  validationMetadata: ProductIntakeValidationMetadata
}

export type OnboardingProductIntakeSubmitResult =
  | { status: "saved"; usageId: string | null; frontImagePath: string | null }
  | { status: "replace_conflict" }

export const PRODUCT_INTAKE_REPLACE_CODE = "product_category_already_filled"

export function selectedProductIntakeBrandOptionForText(
  options: ProductIntakeBrandOption[],
  text: string,
): ProductIntakeBrandOption | null {
  const normalizedText = text.trim().toLocaleLowerCase("de")
  if (!normalizedText) return null

  const matches = options.filter(
    (option) => option.label.trim().toLocaleLowerCase("de") === normalizedText,
  )
  return matches.length === 1 ? matches[0] : null
}

export async function uploadProductIntakeImage(
  kind: ProductIntakeImageKind,
  file: File,
): Promise<ProductIntakeUploadResult> {
  const uploadFile = await prepareProductIntakeImageForUpload(file)
  const formData = new FormData()
  formData.set("kind", kind)
  formData.set("file", uploadFile)

  const response = await fetch("/api/product-intake/upload", {
    method: "POST",
    body: formData,
  })
  const body = (await response.json().catch(() => ({}))) as ProductIntakeResponseBody

  if (!response.ok || !body.path) {
    throw new Error(body.error ?? "Bild konnte nicht hochgeladen werden.")
  }

  return {
    path: body.path,
    validationStatus: body.validation_status ?? "uncertain",
    validationMetadata: body.validation_metadata ?? {},
  }
}

export function canSubmitProductIntake(params: {
  method: ProductIntakeMethod | null
  category?: ProductIntakeCategoryKey | string | null
  frequency: ProductFrequency | "" | null
  brandText: string
  productName: string
  frontImagePath?: string | null
  committedFrontImagePath?: string | null
}) {
  if (!params.category || !params.frequency) return false
  if (params.method === "photo") {
    return Boolean(params.frontImagePath || params.committedFrontImagePath)
  }
  if (params.method === "manual") {
    return params.brandText.trim().length > 0 && params.productName.trim().length > 0
  }
  return false
}

export function buildProductIntakeSubmissionPayload(params: {
  method: ProductIntakeMethod
  category: ProductIntakeCategoryKey | string
  frequency: ProductFrequency
  brandText: string
  brandId?: string | null
  productLineId?: string | null
  productName: string
  frontImagePath?: string | null
  frontImageValidationStatus?: string | null
  frontImageValidationMetadata?: ProductIntakeValidationMetadata
  barcodeImagePath?: string | null
  barcodeImageValidationStatus?: string | null
  barcodeImageValidationMetadata?: ProductIntakeValidationMetadata
  sourceConversationId?: string | null
  existingUsageId?: string | null
  replaceExistingConfirmed?: boolean
}): Record<string, unknown> {
  const common = {
    category: params.category,
    frequency_range: params.frequency,
    ...(params.brandId ? { brand_id: params.brandId } : {}),
    ...(params.productLineId ? { product_line_id: params.productLineId } : {}),
    ...(params.sourceConversationId ? { source_conversation_id: params.sourceConversationId } : {}),
    ...(params.existingUsageId ? { existing_usage_id: params.existingUsageId } : {}),
    ...(params.replaceExistingConfirmed ? { replace_existing_confirmed: true } : {}),
  }

  if (params.method === "photo") {
    return {
      intake_method: "photo",
      ...common,
      ...(params.frontImagePath
        ? {
            front_image_path: params.frontImagePath,
            front_image_validation_status: params.frontImageValidationStatus ?? "uncertain",
            front_image_validation_metadata: params.frontImageValidationMetadata ?? {},
          }
        : {}),
      ...(params.barcodeImagePath ? { barcode_image_path: params.barcodeImagePath } : {}),
      ...(params.barcodeImagePath
        ? {
            barcode_image_validation_status: params.barcodeImageValidationStatus ?? "uncertain",
            barcode_image_validation_metadata: params.barcodeImageValidationMetadata ?? {},
          }
        : {}),
      ...(params.brandText.trim() ? { brand_text: params.brandText.trim() } : {}),
      ...(params.productName.trim() ? { product_name_text: params.productName.trim() } : {}),
    }
  }

  return {
    intake_method: "manual",
    ...common,
    brand_text: params.brandText.trim(),
    product_name_text: params.productName.trim(),
  }
}

export async function submitOnboardingProductIntake(
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<OnboardingProductIntakeSubmitResult> {
  const response = await fetch("/api/product-intake/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  })
  const body = (await response.json().catch(() => ({}))) as ProductIntakeResponseBody

  if (response.status === 409 && body.code === PRODUCT_INTAKE_REPLACE_CODE) {
    return { status: "replace_conflict" }
  }

  if (!response.ok) {
    throw new Error(body.error ?? "Fehler beim Speichern. Bitte versuche es erneut.")
  }

  return {
    status: "saved",
    usageId: body.usage?.id ?? null,
    frontImagePath: body.usage?.front_image_path ?? null,
  }
}

export async function cancelOnboardingProductIntakeCategories(
  categories: string[],
  signal?: AbortSignal,
) {
  const response = await fetch("/api/product-intake/onboarding/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categories }),
    signal,
  })
  const body = (await response.json().catch(() => ({}))) as ProductIntakeResponseBody

  if (!response.ok) {
    throw new Error(body.error ?? "Fehler beim Speichern. Bitte versuche es erneut.")
  }
}
