"use client"

import { useCallback } from "react"
import { SUPPORTED_PRODUCT_CATEGORY_KEYS } from "@/lib/product-identity"
import {
  buildProductIntakeSubmissionPayload,
  cancelOnboardingProductIntakeCategories,
  submitOnboardingProductIntake,
  uploadProductIntakeImage,
  type ProductIntakeImageKind,
} from "@/lib/product-intake/client"
import type {
  OnboardingProductDrilldown,
  OnboardingProductIntakeBarcodeImageValidationStatus,
  OnboardingProductIntakeFrontImageValidationStatus,
} from "@/lib/onboarding/store"
import type { ProductFrequency } from "@/lib/vocabulary"

const SUPPORTED_PRODUCT_INTAKE_CATEGORY_SET = new Set<string>(SUPPORTED_PRODUCT_CATEGORY_KEYS)

type ProductUsageRowLike = Record<string, unknown>

function temporaryUploadPath(path: unknown): string | null {
  return typeof path === "string" && path.startsWith("tmp/") ? path : null
}

function committedUploadPath(path: unknown): string | null {
  return typeof path === "string" && path.length > 0 && !path.startsWith("tmp/") ? path : null
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function frontValidationStatus(
  value: unknown,
): OnboardingProductIntakeFrontImageValidationStatus | null {
  return value === "valid_product_front" ||
    value === "uncertain" ||
    value === "not_a_product_photo" ||
    value === "unsafe_or_inappropriate"
    ? value
    : null
}

function barcodeValidationStatus(
  value: unknown,
): OnboardingProductIntakeBarcodeImageValidationStatus | null {
  return value === "valid_barcode" ||
    value === "uncertain" ||
    value === "not_a_product_photo" ||
    value === "unsafe_or_inappropriate"
    ? value
    : null
}

export function useOnboardingProductIntakeController(productIntakeEnabled: boolean) {
  const isSupportedCategory = useCallback(
    (category: string) => SUPPORTED_PRODUCT_INTAKE_CATEGORY_SET.has(category),
    [],
  )

  const drilldownFromUsageRow = useCallback(
    (row: ProductUsageRowLike, productName: string, frequency: ProductFrequency | null) => {
      const rowIntakeMethod =
        row.intake_method === "photo" || row.front_image_path ? "photo" : "manual"

      return {
        intakeMethod: rowIntakeMethod,
        productName,
        existingUsageId: typeof row.id === "string" ? row.id : null,
        brandText: typeof row.brand_text === "string" ? row.brand_text : "",
        brandId: null,
        productLineId: null,
        frequency,
        frontImagePath: temporaryUploadPath(row.front_image_path),
        committedFrontImagePath: committedUploadPath(row.front_image_path),
        barcodeImagePath: temporaryUploadPath(row.barcode_image_path),
        frontImageValidationStatus: frontValidationStatus(row.front_image_validation_status),
        frontImageValidationMetadata: metadataRecord(row.front_image_validation_metadata),
        barcodeImageValidationStatus: barcodeValidationStatus(row.barcode_image_validation_status),
        barcodeImageValidationMetadata: metadataRecord(row.barcode_image_validation_metadata),
      } satisfies Partial<OnboardingProductDrilldown>
    },
    [],
  )

  const cancelDeselectedCategories = useCallback(
    async (
      existingRows: ProductUsageRowLike[],
      selectedCategories: string[],
      signal?: AbortSignal,
    ) => {
      const toDeleteRows = existingRows.filter((row) => {
        const category = row.category as string
        return category !== "shampoo" && !selectedCategories.includes(category)
      })
      const intakeCancelCategories = toDeleteRows
        .map((row) => row.category as string)
        .filter((category) => isSupportedCategory(category))
      const directDeleteIds = toDeleteRows
        .filter((row) => {
          const category = row.category as string
          return !productIntakeEnabled || !isSupportedCategory(category)
        })
        .map((row) => row.id as string)

      if (productIntakeEnabled && intakeCancelCategories.length > 0) {
        await cancelOnboardingProductIntakeCategories(intakeCancelCategories, signal)
      }

      return directDeleteIds
    },
    [isSupportedCategory, productIntakeEnabled],
  )

  const submitDrilldown = useCallback(
    (
      category: string,
      drilldown: OnboardingProductDrilldown,
      replaceExistingConfirmed: boolean | undefined,
      signal?: AbortSignal,
    ) => {
      if (!drilldown.intakeMethod || !drilldown.frequency) {
        return Promise.resolve(null)
      }

      const payload = buildProductIntakeSubmissionPayload({
        method: drilldown.intakeMethod,
        category,
        frequency: drilldown.frequency,
        brandText: drilldown.brandText,
        brandId: drilldown.brandId,
        productLineId: drilldown.productLineId,
        productName: drilldown.productName,
        frontImagePath: drilldown.frontImagePath,
        committedFrontImagePath: drilldown.committedFrontImagePath,
        frontImageValidationStatus: drilldown.frontImageValidationStatus,
        frontImageValidationMetadata: drilldown.frontImageValidationMetadata,
        barcodeImagePath: drilldown.barcodeImagePath,
        barcodeImageValidationStatus: drilldown.barcodeImageValidationStatus,
        barcodeImageValidationMetadata: drilldown.barcodeImageValidationMetadata,
        existingUsageId: drilldown.existingUsageId,
        replaceExistingConfirmed,
      })

      return submitOnboardingProductIntake(payload, signal)
    },
    [],
  )

  const uploadImagePatch = useCallback(async (kind: ProductIntakeImageKind, file: File) => {
    const upload = await uploadProductIntakeImage(kind, file)
    return {
      [kind === "front" ? "frontImagePath" : "barcodeImagePath"]: upload.path,
      ...(kind === "front" ? { committedFrontImagePath: null } : {}),
      [kind === "front" ? "frontImageValidationStatus" : "barcodeImageValidationStatus"]:
        upload.validationStatus,
      [kind === "front" ? "frontImageValidationMetadata" : "barcodeImageValidationMetadata"]:
        upload.validationMetadata,
      intakeMethod: "photo" as const,
    } satisfies Partial<OnboardingProductDrilldown>
  }, [])

  return {
    isSupportedCategory,
    drilldownFromUsageRow,
    cancelDeselectedCategories,
    submitDrilldown,
    uploadImagePatch,
  }
}
