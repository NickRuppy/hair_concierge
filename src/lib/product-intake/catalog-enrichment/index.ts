import { createHash } from "node:crypto"
import { relative, resolve } from "node:path"

import {
  PRODUCT_INTAKE_PRODUCT_ID_PLACEHOLDER,
  validateProductIntakeCategorySpecs,
  validateProductIntakeApprovalPayload,
  PRODUCT_INTAKE_REVIEW_CATEGORY_KEYS,
  type ProductIntakeTargetSpecOperation,
  type ProductIntakeTargetSpecTable,
  type ProductIntakeReviewCategoryKey,
  type ProductIntakeValidationProfile,
} from "@/lib/product-intake/category-validators"

export const CATALOG_ENRICHMENT_SCHEMA_VERSION = "personal-plan-launch-v1" as const

const LIFECYCLE_CLASSES = new Set([
  "new_product",
  "existing_product_enrichment",
  "verification_only",
  "provisional_candidate",
  "excluded",
])
const SPEC_TABLES = new Set<ProductIntakeTargetSpecTable>([
  "product_shampoo_specs",
  "product_conditioner_specs",
  "product_conditioner_rerank_specs",
  "product_mask_specs",
  "product_leave_in_specs",
  "product_leave_in_fit_specs",
  "product_leave_in_eligibility",
  "product_oil_eligibility",
  "product_dry_shampoo_specs",
  "product_deep_cleansing_shampoo_specs",
  "product_bondbuilder_specs",
  "product_heat_protectant_specs",
  "product_scalp_care_specs",
  "product_application_protocols",
])
/**
 * Tables a manifest may plan row deletions for. Deletion is deliberately not a
 * general capability: it exists because a recommended-only research projection
 * *replaces* a product's eligibility set, so live rows the projection no longer
 * contains have to go. Every other table stays upsert-only.
 */
const DELETE_TABLES = new Set<ProductIntakeTargetSpecTable>(["product_leave_in_eligibility"])

/** The full natural key a delete row must carry, per deletable table. */
const DELETE_NATURAL_KEYS: Partial<Record<ProductIntakeTargetSpecTable, readonly string[]>> = {
  product_leave_in_eligibility: ["product_id", "thickness", "need_bucket", "styling_context"],
}

const FORBIDDEN_KEYS =
  /(?:password|secret|token|authorization|cookie|user_id|email|phone|signed_url)/i
const FORBIDDEN_VALUES =
  /(?:[?&](?:token|signature|sig|x-amz-(?:signature|security-token|credential))=|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----)/i
const SAFE_KEY = /^[a-z0-9][a-z0-9-]*$/

/**
 * Removal of exactly-keyed rows from a deletable spec table. Only ever planned by
 * an `existing_product_enrichment` manifest, and only for a table in
 * `DELETE_TABLES`; the natural key must be complete so a delete can never widen
 * into a set operation.
 */
export type CatalogEnrichmentDeleteOperation = {
  type: "delete"
  table: "product_leave_in_eligibility"
  rows: Array<{
    product_id: string
    thickness: string
    need_bucket: string
    styling_context: string
  }>
}

export type CatalogEnrichmentOperation =
  | { type: "insert_product"; table: "products"; catalog_content: CatalogContentInput }
  | { type: "update_product"; table: "products" }
  | CatalogEnrichmentDeleteOperation
  | ProductIntakeTargetSpecOperation

export type CatalogEnrichmentManifest = Record<string, unknown> & {
  schema_version: typeof CATALOG_ENRICHMENT_SCHEMA_VERSION
  batch_id: string
  product_key: string
  lifecycle_classification: string
  planned_operations: CatalogEnrichmentOperation[]
}

export type CurrentCatalogTarget = { id: string; fingerprint: string }

export type CatalogContentInput = {
  name: string
  brand: string
  category: ProductIntakeReviewCategoryKey
  affiliate_link: string
  purchase_link_status: "available" | "unavailable"
  purchase_link_checked_at: string
  price_checked_at: string
  price_eur: number
  currency: "EUR"
  image_asset_path: string
  image_sha256: string
  origin: "curated"
  is_active: true
  lifecycle_status: "active"
  is_chaarlie_recommended: boolean
  brand_id: null
  product_line_id: null
  image_url: null
}

/** Canonical, key-sorted JSON used for every catalog-enrichment fingerprint. */
export function stableCatalogEnrichmentJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableCatalogEnrichmentJson).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableCatalogEnrichmentJson(nested)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

export function catalogEnrichmentFingerprint(value: unknown): string {
  return createHash("sha256").update(stableCatalogEnrichmentJson(value), "utf8").digest("hex")
}

function catalogEnrichmentContentFingerprint(manifest: Record<string, unknown>): string {
  return catalogEnrichmentFingerprint({ ...manifest, validation: undefined, review: undefined })
}

export function isCatalogEnrichmentManifestPath(path: string, cwd = process.cwd()): boolean {
  const root = resolve(cwd, "data/catalog-enrichment")
  const candidate = resolve(cwd, path)
  const relativePath = relative(root, candidate)
  return (
    relativePath.length > 0 &&
    !relativePath.startsWith("..") &&
    !relativePath.includes("..\\") &&
    !relativePath.startsWith("/")
  )
}

function errorsForSensitiveData(value: unknown, path = "manifest"): string[] {
  if (typeof value === "string")
    return FORBIDDEN_VALUES.test(value) ? [`${path} contains signed or secret material`] : []
  if (!value || typeof value !== "object") return []
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
    const nestedPath = `${path}.${key}`
    return FORBIDDEN_KEYS.test(key)
      ? [`${nestedPath} is not allowed in a sanitized manifest`]
      : errorsForSensitiveData(nested, nestedPath)
  })
}

function isSafeRelativePath(value: unknown): boolean {
  return (
    typeof value === "string" &&
    !value.startsWith("/") &&
    !value.split("/").includes("..") &&
    !value.includes("\\")
  )
}

function catalogStateErrors(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return ["catalog_state is required"]
  const state = value as Record<string, unknown>
  const keys = ["origin", "is_active", "lifecycle_status", "is_chaarlie_recommended"]
  if (Object.keys(state).length !== keys.length || keys.some((key) => !(key in state)))
    return ["catalog_state must contain only the required curated lifecycle fields"]
  const errors: string[] = []
  if (state.origin !== "curated") errors.push("catalog_state.origin must be curated")
  if (state.is_active !== true) errors.push("catalog_state.is_active must be true")
  if (state.lifecycle_status !== "active")
    errors.push("catalog_state.lifecycle_status must be active")
  if (typeof state.is_chaarlie_recommended !== "boolean")
    errors.push("catalog_state.is_chaarlie_recommended must be boolean")
  return errors
}

function catalogContentFromApprovedPayload(
  productPayload: Record<string, unknown>,
  catalogState: Record<string, unknown>,
  image: Record<string, unknown>,
  validationProfile: ProductIntakeValidationProfile,
): CatalogContentInput | null {
  const approved = validateProductIntakeApprovalPayload(productPayload, validationProfile)
  if (!approved.ok) return null
  const product = approved.normalizedPayload.final.product
  return {
    name: product.clean_name,
    brand: product.canonical_brand,
    category: product.category_key,
    affiliate_link: product.affiliate_link,
    purchase_link_status: product.purchase_link_status,
    purchase_link_checked_at: product.purchase_link_checked_at,
    price_checked_at: product.price_checked_at,
    price_eur: product.price_eur,
    currency: product.currency,
    image_asset_path: image.expected_storage_path as string,
    image_sha256: image.final_sha256 as string,
    origin: catalogState.origin as "curated",
    is_active: catalogState.is_active as true,
    lifecycle_status: catalogState.lifecycle_status as "active",
    is_chaarlie_recommended: catalogState.is_chaarlie_recommended as boolean,
    brand_id: null,
    product_line_id: null,
    image_url: null,
  }
}

function catalogContentErrors(
  manifest: Record<string, unknown>,
  validationProfile: ProductIntakeValidationProfile,
): string[] {
  const productPayload = manifest.product_payload as Record<string, unknown>
  const catalogState = manifest.catalog_state as Record<string, unknown>
  const image = manifest.image as Record<string, unknown>
  if (!productPayload || !catalogState || !image) return []
  const approved = validateProductIntakeApprovalPayload(productPayload, validationProfile)
  if (!approved.ok)
    return approved.missingFields.map((field) => `product intake validation: ${field}`)
  if (manifest.commercial && typeof manifest.commercial === "object") {
    const commercial = manifest.commercial as Record<string, unknown>
    const commercialErrors: string[] = []
    const product = approved.normalizedPayload.final.product
    if (commercial.status !== product.purchase_link_status)
      commercialErrors.push(
        "commercial.status must match product_payload.final.product.purchase_link_status",
      )
    if (commercial.price_eur !== product.price_eur)
      commercialErrors.push(
        "commercial.price_eur must match product_payload.final.product.price_eur",
      )
    if (commercial.currency !== product.currency)
      commercialErrors.push("commercial.currency must match product_payload.final.product.currency")
    if (commercialErrors.length > 0) return commercialErrors
  }
  if (!isSafeRelativePath(image.expected_storage_path))
    return ["image.expected_storage_path must be a safe relative path"]
  if (typeof image.final_sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(image.final_sha256))
    return ["image.final_sha256 must be a SHA-256 hash"]
  if (approved.normalizedPayload.final.product.image_url !== null)
    return ["product_payload.final.product.image_url must remain unresolved in B0"]
  if (
    approved.normalizedPayload.final.product.purchase_link_status === "unavailable" &&
    catalogState.is_chaarlie_recommended === true
  ) {
    return ["unavailable products cannot be Chaarlie recommended"]
  }
  const expected = catalogContentFromApprovedPayload(
    productPayload,
    catalogState,
    image,
    validationProfile,
  )
  const insert = Array.isArray(manifest.planned_operations)
    ? (manifest.planned_operations.find(
        (operation) =>
          operation && typeof operation === "object" && operation.type === "insert_product",
      ) as Record<string, unknown> | undefined)
    : undefined
  if (
    !insert ||
    !insert.catalog_content ||
    typeof insert.catalog_content !== "object" ||
    Array.isArray(insert.catalog_content)
  ) {
    return ["new_product insert_product requires catalog_content"]
  }
  return expected &&
    stableCatalogEnrichmentJson(insert.catalog_content) === stableCatalogEnrichmentJson(expected)
    ? []
    : ["insert_product catalog_content must exactly match the approved catalog input"]
}

/**
 * Shape guard for a single delete operation: an allowlisted table, a non-empty
 * row list, and on every row exactly the table's natural key — no more keys (a
 * partial key would delete more than the manifest names), no fewer.
 */
function deleteOperationErrors(row: Record<string, unknown>, index: number): string[] {
  const path = `planned_operations.${index}`
  if (
    typeof row.table !== "string" ||
    !DELETE_TABLES.has(row.table as ProductIntakeTargetSpecTable)
  )
    return [`${path} is not an allowlisted catalog delete target`]
  const naturalKey = DELETE_NATURAL_KEYS[row.table as ProductIntakeTargetSpecTable]
  if (!naturalKey) return [`${path} has no declared natural key`]
  if (!Array.isArray(row.rows) || row.rows.length === 0)
    return [`${path}.rows must be a non-empty list`]
  const errors = row.rows.flatMap((candidate, rowIndex) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
      return [`${path}.rows.${rowIndex} must be an object`]
    const keys = Object.keys(candidate as Record<string, unknown>)
    const values = candidate as Record<string, unknown>
    return keys.length !== naturalKey.length ||
      naturalKey.some((key) => typeof values[key] !== "string" || values[key] === "")
      ? [`${path}.rows.${rowIndex} must carry exactly the ${row.table} natural key`]
      : []
  })
  const fingerprints = row.rows.map((candidate) => stableCatalogEnrichmentJson(candidate))
  return [
    ...errors,
    ...(new Set(fingerprints).size === fingerprints.length
      ? []
      : [`${path}.rows contains duplicate natural keys`]),
  ]
}

/**
 * Cross-operation guard: every delete row must name the manifest's own target
 * product, and must not collide with a row the same manifest upserts into that
 * table (a row that is both deleted and re-inserted is a contradiction, not a
 * replacement).
 */
function deleteTargetErrors(manifest: Record<string, unknown>, lifecycle: unknown): string[] {
  const operations = Array.isArray(manifest.planned_operations) ? manifest.planned_operations : []
  const deletes = operations.filter(
    (operation) => operation && typeof operation === "object" && operation.type === "delete",
  ) as Array<Record<string, unknown>>
  if (deletes.length === 0) return []
  if (lifecycle !== "existing_product_enrichment")
    return ["only existing_product_enrichment may plan catalog deletes"]

  const targetProductId = manifest.target_product_id
  const errors: string[] = []

  /**
   * Natural key with `product_id` resolved to the manifest's target. Both the
   * placeholder and the literal UUID address the same row, so comparing them
   * verbatim let a delete written with `__PRODUCT_ID__` slip past a contradicting
   * upsert written with the UUID (and vice versa).
   */
  const identity = (row: Record<string, unknown>, table: unknown) => {
    const naturalKey = DELETE_NATURAL_KEYS[table as ProductIntakeTargetSpecTable] ?? []
    return stableCatalogEnrichmentJson(
      Object.fromEntries(
        naturalKey.map((key) => [
          key,
          key === "product_id" && row[key] === PRODUCT_INTAKE_PRODUCT_ID_PLACEHOLDER
            ? targetProductId
            : row[key],
        ]),
      ),
    )
  }

  for (const operation of deletes) {
    const rows = Array.isArray(operation.rows) ? operation.rows : []
    const upsertedKeys = new Set(
      operations
        .filter(
          (candidate) =>
            candidate &&
            typeof candidate === "object" &&
            candidate.type === "upsert" &&
            candidate.table === operation.table &&
            Array.isArray(candidate.rows),
        )
        .flatMap((candidate) => (candidate as { rows: unknown[] }).rows)
        .map((row) =>
          row && typeof row === "object"
            ? identity(row as Record<string, unknown>, operation.table)
            : "",
        ),
    )
    for (const row of rows) {
      if (!row || typeof row !== "object") continue
      const record = row as Record<string, unknown>
      if (
        record.product_id !== targetProductId &&
        record.product_id !== PRODUCT_INTAKE_PRODUCT_ID_PLACEHOLDER
      ) {
        errors.push(`delete rows must target ${String(targetProductId)}`)
        continue
      }
      if (upsertedKeys.has(identity(record, operation.table)))
        errors.push(`${String(operation.table)} plans a delete and an upsert for the same row`)
    }
  }
  return [...new Set(errors)]
}

/**
 * Execution order for a validated manifest: the product row first, then every
 * delete, then every upsert. Deletes run before upserts so a replaced row set is
 * cleared before the projection's rows land, and a row that survives the
 * projection is never briefly absent.
 */
export function orderCatalogEnrichmentOperations(
  operations: readonly CatalogEnrichmentOperation[],
): CatalogEnrichmentOperation[] {
  const rank = (operation: CatalogEnrichmentOperation) =>
    operation.type === "insert_product" || operation.type === "update_product"
      ? 0
      : operation.type === "delete"
        ? 1
        : 2
  return [...operations]
    .map((operation, index) => ({ operation, index }))
    .sort((left, right) => rank(left.operation) - rank(right.operation) || left.index - right.index)
    .map(({ operation }) => operation)
}

function operationErrors(operations: unknown, lifecycle: unknown): string[] {
  if (!Array.isArray(operations)) return ["planned_operations must be an allowlisted list"]
  if (operations.length === 0) {
    return lifecycle === "excluded" ||
      lifecycle === "provisional_candidate" ||
      lifecycle === "verification_only"
      ? []
      : ["planned_operations must be a non-empty allowlisted list"]
  }
  if (
    lifecycle === "excluded" ||
    lifecycle === "provisional_candidate" ||
    lifecycle === "verification_only"
  ) {
    return [`${String(lifecycle)} cannot plan catalog writes`]
  }
  const errors =
    lifecycle === "new_product" &&
    operations.filter((operation) => {
      if (!operation || typeof operation !== "object") return false
      const row = operation as Record<string, unknown>
      return row.type === "insert_product" && row.table === "products"
    }).length !== 1
      ? ["new_product must plan exactly one insert_product"]
      : []
  return [
    ...errors,
    ...operations.flatMap((operation, index) => {
      if (!operation || typeof operation !== "object")
        return [`planned_operations.${index} must be an object`]
      const row = operation as Record<string, unknown>
      if (row.type === "insert_product" || row.type === "update_product") {
        if (row.table !== "products")
          return [`planned_operations.${index} may only target products`]
        if (lifecycle === "new_product" && row.type !== "insert_product")
          return [`new_product must plan insert_product`]
        if (lifecycle !== "new_product" && row.type === "insert_product")
          return [`existing manifests cannot insert products`]
        return []
      }
      if (
        row.type === "upsert" &&
        typeof row.table === "string" &&
        SPEC_TABLES.has(row.table as ProductIntakeTargetSpecTable) &&
        Array.isArray(row.rows)
      )
        return []
      if (row.type === "delete") return deleteOperationErrors(row, index)
      return [`planned_operations.${index} is not an allowlisted catalog operation`]
    }),
  ]
}

function categoryOperationErrors(
  manifest: Record<string, unknown>,
  lifecycle: unknown,
  validationProfile: ProductIntakeValidationProfile,
): string[] {
  if (lifecycle !== "new_product" && lifecycle !== "existing_product_enrichment") {
    return []
  }
  if (!PRODUCT_INTAKE_REVIEW_CATEGORY_KEYS.includes(manifest.category_key as never)) {
    return []
  }

  const plannedSpecOperations = Array.isArray(manifest.planned_operations)
    ? (manifest.planned_operations.filter(
        (operation) => operation && typeof operation === "object" && operation.type === "upsert",
      ) as Array<Record<string, unknown>>)
    : []
  if (lifecycle === "existing_product_enrichment" && plannedSpecOperations.length === 0) {
    return []
  }

  const errors: string[] = []
  const finalPayload = (manifest.product_payload as Record<string, unknown> | undefined)?.final as
    | Record<string, unknown>
    | undefined
  if (
    !finalPayload ||
    stableCatalogEnrichmentJson(finalPayload.category_specs) !==
      stableCatalogEnrichmentJson(manifest.category_payload)
  ) {
    errors.push("product_payload.final.category_specs must exactly match category_payload")
  }

  const categoryValidation = validateProductIntakeCategorySpecs(
    manifest.category_key as ProductIntakeReviewCategoryKey,
    manifest.category_payload,
    validationProfile,
  )
  if (!categoryValidation.ok) {
    errors.push(
      ...categoryValidation.missingFields.map(
        (field) => `product intake category validation: ${field}`,
      ),
    )
  }

  if (lifecycle === "new_product") {
    if (
      !categoryValidation.ok ||
      stableCatalogEnrichmentJson(plannedSpecOperations) !==
        stableCatalogEnrichmentJson(categoryValidation.targetSpecOperations)
    ) {
      errors.push("new_product planned spec operations do not match shared category validation")
    }
    return errors
  }

  const targetProductId = manifest.target_product_id
  const existingOperationsMatch =
    categoryValidation.ok &&
    plannedSpecOperations.every((operation) => {
      const expected = categoryValidation.targetSpecOperations.find(
        (candidate) => candidate.table === operation.table,
      )
      if (!expected || !Array.isArray(operation.rows)) return false
      const normalizedRows = operation.rows.map((row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null
        const record = row as Record<string, unknown>
        if (
          record.product_id !== targetProductId &&
          record.product_id !== PRODUCT_INTAKE_PRODUCT_ID_PLACEHOLDER
        ) {
          return null
        }
        return {
          ...record,
          product_id: PRODUCT_INTAKE_PRODUCT_ID_PLACEHOLDER,
        }
      })
      return (
        !normalizedRows.includes(null) &&
        stableCatalogEnrichmentJson({ ...operation, rows: normalizedRows }) ===
          stableCatalogEnrichmentJson(expected)
      )
    })
  if (!existingOperationsMatch) {
    errors.push(
      "existing_product_enrichment planned spec operations do not match shared category validation",
    )
  }
  return errors
}

export function validateCatalogEnrichmentManifest(
  value: unknown,
  currentTarget?: CurrentCatalogTarget,
  validationProfile: ProductIntakeValidationProfile = "current",
):
  | { ok: true; planned_operations: CatalogEnrichmentOperation[]; content_fingerprint: string }
  | { ok: false; errors: string[] } {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { ok: false, errors: ["manifest must be an object"] }
  const manifest = value as Record<string, unknown>
  const errors: string[] = []
  if (manifest.schema_version !== CATALOG_ENRICHMENT_SCHEMA_VERSION)
    errors.push("unsupported schema_version")
  if (typeof manifest.batch_id !== "string" || !SAFE_KEY.test(manifest.batch_id))
    errors.push("batch_id must be a sanitized identifier")
  if (typeof manifest.product_key !== "string" || !SAFE_KEY.test(manifest.product_key))
    errors.push("product_key must be a sanitized identifier")
  if (!LIFECYCLE_CLASSES.has(String(manifest.lifecycle_classification)))
    errors.push("unknown lifecycle_classification")
  if (!PRODUCT_INTAKE_REVIEW_CATEGORY_KEYS.includes(manifest.category_key as never))
    errors.push("category_key must be a supported Product Intake category")
  if (!manifest.identity || typeof manifest.identity !== "object")
    errors.push("identity is required")
  if (!manifest.duplicate_check || typeof manifest.duplicate_check !== "object")
    errors.push("duplicate_check is required")
  if (!Array.isArray(manifest.sources) || manifest.sources.length === 0)
    errors.push("sources are required")
  if (
    !manifest.commercial ||
    typeof manifest.commercial !== "object" ||
    Array.isArray(manifest.commercial)
  )
    errors.push("commercial is required")
  if (!manifest.image || typeof manifest.image !== "object" || Array.isArray(manifest.image))
    errors.push("image is required")
  else {
    const image = manifest.image as Record<string, unknown>
    if (!isSafeRelativePath(image.local_asset_path))
      errors.push("image.local_asset_path must be a safe relative path")
    if (
      image.expected_storage_path !== undefined &&
      !isSafeRelativePath(image.expected_storage_path)
    )
      errors.push("image.expected_storage_path must be a safe relative path")
    if (
      image.final_sha256 !== undefined &&
      (typeof image.final_sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(image.final_sha256))
    )
      errors.push("image.final_sha256 must be a SHA-256 hash")
  }
  for (const field of [
    "product_payload",
    "category_payload",
    "validation",
    "review",
    "disposition",
  ] as const) {
    if (!manifest[field] || typeof manifest[field] !== "object" || Array.isArray(manifest[field]))
      errors.push(`${field} is required`)
  }
  errors.push(...errorsForSensitiveData(manifest))
  const lifecycle = manifest.lifecycle_classification
  const hasTarget =
    typeof manifest.target_product_id === "string" ||
    typeof manifest.target_fingerprint === "string"
  if (
    lifecycle === "new_product" &&
    PRODUCT_INTAKE_REVIEW_CATEGORY_KEYS.includes(manifest.category_key as never)
  ) {
    errors.push(...catalogStateErrors(manifest.catalog_state))
    if (hasTarget)
      errors.push("new_product must not include target_product_id or target_fingerprint")
    const duplicateCandidates = (manifest.duplicate_check as Record<string, unknown>).candidates
    if (!Array.isArray(duplicateCandidates))
      errors.push("new_product requires duplicate candidate evidence")
    if (Array.isArray(duplicateCandidates) && duplicateCandidates.length > 0)
      errors.push("new_product is blocked by duplicate candidates")
  } else if (lifecycle === "existing_product_enrichment" || lifecycle === "verification_only") {
    if (
      typeof manifest.target_product_id !== "string" ||
      typeof manifest.target_fingerprint !== "string"
    )
      errors.push("existing enrichment requires target_product_id and target_fingerprint")
    if (
      currentTarget &&
      (currentTarget.id !== manifest.target_product_id ||
        currentTarget.fingerprint !== manifest.target_fingerprint)
    )
      errors.push("target fingerprint is stale")
  }
  errors.push(...operationErrors(manifest.planned_operations, lifecycle))
  errors.push(...deleteTargetErrors(manifest, lifecycle))
  errors.push(...categoryOperationErrors(manifest, lifecycle, validationProfile))
  if (
    lifecycle === "new_product" &&
    PRODUCT_INTAKE_REVIEW_CATEGORY_KEYS.includes(manifest.category_key as never)
  ) {
    errors.push(...catalogContentErrors(manifest, validationProfile))
  }
  const contentFingerprint = catalogEnrichmentContentFingerprint(manifest)
  const review = manifest.review as Record<string, unknown> | undefined
  if (review?.state === "approved" && review.reviewed_content_fingerprint !== contentFingerprint)
    errors.push("reviewed content fingerprint does not match manifest")
  return errors.length > 0
    ? { ok: false, errors }
    : {
        ok: true,
        planned_operations: manifest.planned_operations as CatalogEnrichmentOperation[],
        content_fingerprint: contentFingerprint,
      }
}

export function generateCatalogEnrichmentIndex(manifests: readonly CatalogEnrichmentManifest[]) {
  const sorted = [...manifests].sort((left, right) =>
    left.product_key.localeCompare(right.product_key),
  )
  const duplicate = sorted.find(
    (item, index) => index > 0 && item.product_key === sorted[index - 1]?.product_key,
  )
  if (duplicate) throw new Error(`duplicate product_key: ${duplicate.product_key}`)
  return {
    schema_version: CATALOG_ENRICHMENT_SCHEMA_VERSION,
    products: sorted.map((item) => ({
      product_key: item.product_key,
      content_fingerprint: catalogEnrichmentContentFingerprint(item),
    })),
  }
}

export function previewCatalogEnrichment(manifest: unknown, currentTarget?: CurrentCatalogTarget) {
  const validation = validateCatalogEnrichmentManifest(manifest, currentTarget)
  if (!validation.ok) {
    return {
      mode: "preview" as const,
      writes: false,
      schema_ok: false,
      ready_for_handoff: false,
      errors: validation.errors,
    }
  }

  const record = manifest as Record<string, unknown>
  const validationState = (record.validation as Record<string, unknown>).state
  const reviewState = (record.review as Record<string, unknown>).state
  const disposition = record.disposition as Record<string, unknown>
  const dispositionState = disposition.state
  const validationRecord = record.validation as Record<string, unknown>
  const blockers = [validationRecord.blockers, validationRecord.errors]
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .filter((value): value is string => typeof value === "string")

  return {
    mode: "preview" as const,
    writes: false,
    schema_ok: true,
    ready_for_handoff:
      validationState === "ready_for_handoff" &&
      reviewState === "approved" &&
      disposition.may_enter_deliverable_b === true &&
      blockers.length === 0,
    validation_state: validationState,
    review_state: reviewState,
    disposition_state: dispositionState,
    blockers,
    operations: orderCatalogEnrichmentOperations(validation.planned_operations),
    deletes: validation.planned_operations
      .filter(
        (operation): operation is CatalogEnrichmentDeleteOperation => operation.type === "delete",
      )
      .map((operation) => ({ table: operation.table, rows: operation.rows })),
    catalog_content: (
      validation.planned_operations.find((operation) => operation.type === "insert_product") as
        | Extract<CatalogEnrichmentOperation, { type: "insert_product" }>
        | undefined
    )?.catalog_content,
    pending_b1_resolutions: ["brand_id", "product_line_id", "image_url"],
    content_fingerprint: validation.content_fingerprint,
  }
}
