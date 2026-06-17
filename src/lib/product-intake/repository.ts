import { randomUUID } from "node:crypto"

import { createAdminClient } from "@/lib/supabase/admin"
import { PRODUCT_INTAKE_BUCKET } from "@/lib/product-intake/image-validation"
import { ProductIntakePersistenceError } from "@/lib/product-intake/errors"
import { assertTemporaryUploadPathBelongsToUser } from "@/lib/product-intake/upload-paths"
import type {
  ProductIntakeCatalog,
  ProductIntakeCatalogProduct,
} from "@/lib/product-intake/product-matching"
import type {
  ProductIntakeRepository,
  ProductIntakeSubmissionRow,
  ProductIntakeUsageRow,
} from "@/lib/product-intake/repository-types"
import type { ProductIntakeCategoryKey } from "@/lib/types"

function requireData<T>(
  result: { data: T | null; error: { message?: string } | null },
  label: string,
): T {
  if (result.error) {
    throw new ProductIntakePersistenceError(`${label}: ${result.error.message ?? "unknown error"}`)
  }
  if (!result.data) {
    throw new ProductIntakePersistenceError(`${label}: no data returned`)
  }
  return result.data
}

function optionalData<T>(
  result: { data: T | null; error: { code?: string; message?: string } | null },
  label: string,
): T | null {
  if (!result.error) return result.data ?? null
  if (result.error.code === "PGRST116") return null
  throw new ProductIntakePersistenceError(`${label}: ${result.error.message ?? "unknown error"}`)
}

function extensionFromPath(path: string): string {
  const filename = path.split("/").pop() ?? ""
  const extension = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : null
  return extension && /^[a-z0-9]+$/.test(extension) ? extension : "jpg"
}

type StorageErrorLike = {
  message?: string
  status?: number
  statusCode?: string
  code?: string
  error?: string
}

function storageErrorStatus(error: StorageErrorLike): number | null {
  if (typeof error.status === "number") return error.status
  if (typeof error.statusCode === "string" && /^\d+$/.test(error.statusCode)) {
    return Number.parseInt(error.statusCode, 10)
  }
  return null
}

export function isMissingProductIntakeUploadError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const storageError = error as StorageErrorLike
  const status = storageErrorStatus(storageError)
  const signature = [
    storageError.statusCode,
    storageError.code,
    storageError.error,
    storageError.message,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase()

  if (signature.includes("bucket")) return false

  return (
    status === 404 &&
    (signature.includes("object") ||
      signature.includes("key") ||
      signature.includes("resource") ||
      signature.includes("not found") ||
      signature.includes("nosuchkey"))
  )
}

export function createSupabaseProductIntakeRepository(
  admin = createAdminClient(),
): ProductIntakeRepository {
  return {
    async loadCatalog() {
      const [productsResult, identifiersResult] = await Promise.all([
        admin
          .from("products")
          .select(
            "id, name, brand_id, product_line_id, category_key, is_active, is_chaarlie_recommended",
          ),
        admin
          .from("product_identifiers")
          .select(
            "product_id, identifier_type, identifier_value, normalized_identifier_value, source",
          ),
      ])

      const products = requireData<ProductIntakeCatalogProduct[]>(
        productsResult,
        "load products for intake matching",
      )
      const identifiers = requireData<ProductIntakeCatalog["identifiers"]>(
        identifiersResult,
        "load product identifiers for intake matching",
      )

      return { products, identifiers }
    },

    async loadBrandResolutionCatalog() {
      const [brandsResult, linesResult, aliasesResult] = await Promise.all([
        admin.from("brands").select("id, canonical_name, normalized_name"),
        admin.from("product_lines").select("id, brand_id, canonical_name, normalized_name"),
        admin.from("brand_aliases").select("brand_id, product_line_id, alias, normalized_alias"),
      ])

      return {
        brands: requireData(brandsResult, "load brands for intake"),
        productLines: requireData(linesResult, "load product lines for intake"),
        brandAliases: requireData(aliasesResult, "load brand aliases for intake"),
      }
    },

    async findUserProductUsage(userId, category) {
      return optionalData<ProductIntakeUsageRow>(
        await admin
          .from("user_product_usage")
          .select("*")
          .eq("user_id", userId)
          .eq("category", category)
          .maybeSingle(),
        "load user product usage",
      )
    },

    async insertUserProductUsage(row) {
      return requireData<ProductIntakeUsageRow>(
        await admin.from("user_product_usage").insert(row).select("*").single(),
        "insert user product usage",
      )
    },

    async updateUserProductUsage(id, patch) {
      return requireData<ProductIntakeUsageRow>(
        await admin.from("user_product_usage").update(patch).eq("id", id).select("*").single(),
        "update user product usage",
      )
    },

    async deleteUserProductUsage(id) {
      const { error } = await admin.from("user_product_usage").delete().eq("id", id)
      if (error) {
        throw new ProductIntakePersistenceError(
          `delete user product usage: ${error.message ?? "unknown error"}`,
        )
      }
    },

    async replaceUsageWithMatchedProduct({
      userId,
      category,
      existingUsageId,
      productId,
      productName,
      frequencyRange,
      brandText,
      intakeMethod,
      source,
      now,
    }) {
      return requireData<ProductIntakeUsageRow>(
        await admin.rpc("product_intake_replace_usage_with_matched_product", {
          p_user_id: userId,
          p_category: category,
          p_existing_usage_id: existingUsageId,
          p_product_id: productId,
          p_product_name: productName,
          p_frequency_range: frequencyRange,
          p_brand_text: brandText,
          p_intake_method: intakeMethod,
          p_source: source,
          p_updated_at: now,
        }),
        "replace product usage with matched product",
      )
    },

    async replaceUsageWithPendingSubmission({
      userId,
      category,
      existingUsageId,
      submissionId,
      productName,
      frequencyRange,
      brandText,
      intakeMethod,
      source,
      frontImagePath,
      now,
    }) {
      const payload = requireData<{
        usage?: ProductIntakeUsageRow
        submission?: ProductIntakeSubmissionRow
      }>(
        await admin.rpc("product_intake_replace_usage_with_pending_submission", {
          p_user_id: userId,
          p_category: category,
          p_existing_usage_id: existingUsageId,
          p_submission_id: submissionId,
          p_product_name: productName,
          p_frequency_range: frequencyRange,
          p_brand_text: brandText,
          p_intake_method: intakeMethod,
          p_source: source,
          p_front_image_path: frontImagePath,
          p_updated_at: now,
        }),
        "replace product usage with pending submission",
      )

      if (!payload.usage || !payload.submission) {
        throw new ProductIntakePersistenceError(
          "replace product usage with pending submission: incomplete payload",
        )
      }

      return { usage: payload.usage, submission: payload.submission }
    },

    async cancelProductIntakeUsageForCategory({ userId, category, now }) {
      return requireData(
        await admin
          .rpc("product_intake_cancel_usage_for_category", {
            p_user_id: userId,
            p_category: category,
            p_updated_at: now,
          })
          .single(),
        "cancel product intake usage",
      ) as {
        category: ProductIntakeCategoryKey
        usage_id: string | null
        submission_id: string | null
      }
    },

    async findProductSubmission(id, userId) {
      return optionalData<ProductIntakeSubmissionRow>(
        await admin
          .from("product_submissions")
          .select("*")
          .eq("id", id)
          .eq("user_id", userId)
          .maybeSingle(),
        "load product submission",
      )
    },

    async insertProductSubmission(row) {
      return requireData<ProductIntakeSubmissionRow>(
        await admin.from("product_submissions").insert(row).select("*").single(),
        "insert product submission",
      )
    },

    async updateProductSubmission(id, patch) {
      return requireData<ProductIntakeSubmissionRow>(
        await admin.from("product_submissions").update(patch).eq("id", id).select("*").single(),
        "update product submission",
      )
    },

    async deleteProductSubmission(id) {
      const { error } = await admin.from("product_submissions").delete().eq("id", id)
      if (error) {
        throw new ProductIntakePersistenceError(
          `delete failed product submission: ${error.message ?? "unknown error"}`,
        )
      }
    },

    async verifyUploadedImage({ sourcePath, userId, kind }) {
      assertTemporaryUploadPathBelongsToUser(sourcePath, userId)
      const { data, error } = await admin.storage.from(PRODUCT_INTAKE_BUCKET).info(sourcePath)

      if (error) {
        if (isMissingProductIntakeUploadError(error)) return false
        throw new ProductIntakePersistenceError(
          `verify product intake image: ${error.message ?? "unknown error"}`,
        )
      }
      if (!data) return false

      const metadata = data.metadata as Record<string, unknown> | null | undefined
      if (metadata?.user_id && metadata.user_id !== userId) return false
      if (metadata?.image_kind && metadata.image_kind !== kind) return false

      return true
    },

    async commitUploadedImage({ sourcePath, userId, submissionId, kind }) {
      assertTemporaryUploadPathBelongsToUser(sourcePath, userId)
      const destinationPath = `${userId}/${submissionId}/${kind}-${randomUUID()}.${extensionFromPath(sourcePath)}`
      const { error } = await admin.storage
        .from(PRODUCT_INTAKE_BUCKET)
        .copy(sourcePath, destinationPath)

      if (error) {
        throw new ProductIntakePersistenceError(
          `commit product intake image: ${error.message ?? "unknown error"}`,
        )
      }

      const { error: removeError } = await admin.storage
        .from(PRODUCT_INTAKE_BUCKET)
        .remove([sourcePath])
      if (removeError) {
        console.warn("[product-intake] committed image tmp cleanup failed", removeError)
      }

      return destinationPath
    },

    async removeCommittedImages(paths) {
      if (paths.length === 0) return
      const { error } = await admin.storage.from(PRODUCT_INTAKE_BUCKET).remove([...paths])
      if (error) {
        throw new ProductIntakePersistenceError(
          `remove failed product intake images: ${error.message ?? "unknown error"}`,
        )
      }
    },

    async verifyConversationOwnership(conversationId, userId) {
      const row = await optionalData<{ id: string }>(
        await admin
          .from("conversations")
          .select("id")
          .eq("id", conversationId)
          .eq("user_id", userId)
          .maybeSingle(),
        "verify conversation ownership",
      )

      return Boolean(row)
    },
  }
}
