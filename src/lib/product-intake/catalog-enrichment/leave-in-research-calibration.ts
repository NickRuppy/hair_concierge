import { createHash } from "node:crypto"

import {
  catalogEnrichmentFingerprint,
  generateCatalogEnrichmentIndex,
  orderCatalogEnrichmentOperations,
  stableCatalogEnrichmentJson,
  validateCatalogEnrichmentManifest,
  type CatalogEnrichmentDeleteOperation,
  type CatalogEnrichmentManifest,
  type CatalogEnrichmentOperation,
  type CurrentCatalogTarget,
} from "@/lib/product-intake/catalog-enrichment"

/**
 * Leave-In research calibration cohort: replaces the live leave-in envelope of
 * nine already-catalogued products with the frozen `leave-in-inci-v1.0`
 * projection.
 *
 * The cohort rides the shared `existing_product_enrichment` contract rather than
 * a bespoke manifest type (Nick's 2026-09-14 ruling 1), and is the first cohort
 * to use the contract's eligibility `delete` operation (ruling 2) — a
 * recommended-only projection *replaces* the eligibility set, so live rows the
 * projection no longer contains have to be removed, not just out-voted.
 *
 * This module is read-only: it builds the fingerprint a manifest pins itself to,
 * and preflights a manifest batch against live catalog rows. It performs no
 * writes and exposes no write adapter, by construction.
 */

export const LEAVE_IN_CALIBRATION_BATCH_ID = "leave-in-research-calibration-v1" as const
export const LEAVE_IN_CALIBRATION_PROJECT_ID = "pqdkhefxsxkyeqelqegq" as const
export const LEAVE_IN_CALIBRATION_RESEARCH_VERSION = "leave-in-inci-v1.0" as const
export const LEAVE_IN_CALIBRATION_ADAPTER_VERSION = "leave-in-production-adapter-v1" as const

/** The nine gold-set slots that already exist in the catalog, with their apply target. */
export const LEAVE_IN_CALIBRATION_TARGETS = [
  {
    slot: "slot-01",
    product_key: "leave-in-slot-01-alverde-express-7in1",
    product_id: "f9595d2c-d86d-4bdb-9758-c98d1e213f3c",
  },
  {
    slot: "slot-02",
    product_key: "leave-in-slot-02-isana-hyaluron-panthenol",
    product_id: "0b21f996-bb42-4b10-89bd-4881c4346d53",
  },
  {
    slot: "slot-03",
    product_key: "leave-in-slot-03-cantu-repair-cream",
    product_id: "e3c4b607-8f81-462c-8a2b-e45c8b3a2976",
  },
  {
    slot: "slot-05",
    product_key: "leave-in-slot-05-evo-head-mistress",
    product_id: "118ebae1-b7a9-4a89-a2ff-6c31df28c4dc",
  },
  {
    slot: "slot-06",
    product_key: "leave-in-slot-06-curlsmith-hydrate-plump",
    product_id: "648ba537-5180-440e-81ad-2b310b447d87",
  },
  {
    slot: "slot-08",
    product_key: "leave-in-slot-08-gliss-ultimate-repair",
    product_id: "5dc2fae3-a0ca-4e6c-9c30-02dd192772f0",
  },
  {
    slot: "slot-09",
    product_key: "leave-in-slot-09-redken-extreme-anti-snap",
    product_id: "2b7db7e3-2058-4178-8a03-7d05f4a1d447",
  },
  {
    slot: "slot-10",
    product_key: "leave-in-slot-10-olaplex-no6-bond-smoother",
    product_id: "4e99706a-2232-4ee6-ba1b-9ca1029a7364",
  },
  {
    slot: "slot-13",
    product_key: "leave-in-slot-13-neqi-diamond-glass",
    product_id: "42a2fe20-bd7e-49a3-a880-8ae89015a5c9",
  },
] as const

export type LeaveInCalibrationTarget = (typeof LEAVE_IN_CALIBRATION_TARGETS)[number]

/** Product columns the fingerprint watches — everything the apply reads or writes. */
export const LEAVE_IN_CALIBRATION_PRODUCT_COLUMNS = [
  "name",
  "brand",
  "category_key",
  "origin",
  "is_active",
  "lifecycle_status",
  "is_chaarlie_recommended",
  "suitable_thicknesses",
  "image_url",
] as const

/** `product_leave_in_specs` columns the fingerprint watches (live table, not the 13-column contract row). */
export const LEAVE_IN_CALIBRATION_SPEC_COLUMNS = [
  "format",
  "weight",
  "roles",
  "provides_heat_protection",
  "heat_protection_max_c",
  "heat_activation_required",
  "care_benefits",
  "ingredient_flags",
  "application_stage",
  "care_direction",
  "repair_support_level",
  "plan_roles",
  "functional_benefits",
  "category_key",
  "conditioner_relationship",
] as const

export const LEAVE_IN_CALIBRATION_FIT_COLUMNS = [
  "weight",
  "conditioner_relationship",
  "care_benefits",
] as const

export const LEAVE_IN_ELIGIBILITY_NATURAL_KEY = [
  "thickness",
  "need_bucket",
  "styling_context",
] as const

export type LeaveInCalibrationLiveRows = {
  product: Record<string, unknown> | null
  specs: Record<string, unknown> | null
  fitSpecs: Record<string, unknown> | null
  eligibility: Array<Record<string, unknown>>
  protocols: Array<Record<string, unknown>>
  /**
   * Personal-Plan search dispositions for this product. Read only for the
   * publication predicate's exemption (see `publicationDependencyBlockers`);
   * deliberately NOT part of the fingerprint snapshot, exactly like `protocols`.
   */
  dispositions: Array<Record<string, unknown>>
}

export type LeaveInCalibrationSnapshot = {
  product_id: string
  products: Record<string, unknown> | null
  product_leave_in_specs: Record<string, unknown> | null
  product_leave_in_fit_specs: Record<string, unknown> | null
  product_leave_in_eligibility: Array<Record<string, unknown>>
}

function pick(
  row: Record<string, unknown> | null,
  columns: readonly string[],
): Record<string, unknown> | null {
  if (!row) return null
  return Object.fromEntries(
    columns.map((column) => [
      column,
      Array.isArray(row[column]) ? [...(row[column] as unknown[])].sort() : (row[column] ?? null),
    ]),
  )
}

function sortRows(rows: Array<Record<string, unknown>>, columns: readonly string[]) {
  return rows
    .map((row) => Object.fromEntries(columns.map((column) => [column, row[column] ?? null])))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
}

/**
 * The exact live state a manifest pins itself to. Deliberately narrow: it covers
 * every row the apply reads or writes and nothing else, so the guard trips on
 * real drift and stays quiet on unrelated catalog churn.
 *
 * `product_application_protocols` is deliberately NOT part of it. The enrichment
 * apply neither reads nor writes protocol rows, and the Stage-5 protocol step
 * runs BEFORE it (the deferred curated-publication trigger requires that order);
 * including protocols would make that very step invalidate the pinned batch. The
 * protocol precondition is instead checked live, per run, by
 * `publicationDependencyBlockers`.
 */
export function buildLeaveInCalibrationSnapshot(
  productId: string,
  rows: LeaveInCalibrationLiveRows,
): LeaveInCalibrationSnapshot {
  return {
    product_id: productId,
    products: pick(rows.product, LEAVE_IN_CALIBRATION_PRODUCT_COLUMNS),
    product_leave_in_specs: pick(rows.specs, LEAVE_IN_CALIBRATION_SPEC_COLUMNS),
    product_leave_in_fit_specs: pick(rows.fitSpecs, LEAVE_IN_CALIBRATION_FIT_COLUMNS),
    product_leave_in_eligibility: sortRows(rows.eligibility, LEAVE_IN_ELIGIBILITY_NATURAL_KEY),
  }
}

/** The manifest's `target_fingerprint` — the shared lane hash over the snapshot above. */
export function leaveInCalibrationTargetFingerprint(snapshot: LeaveInCalibrationSnapshot): string {
  return catalogEnrichmentFingerprint(snapshot)
}

export function leaveInCalibrationCurrentTarget(
  productId: string,
  rows: LeaveInCalibrationLiveRows,
): CurrentCatalogTarget {
  return {
    id: productId,
    fingerprint: leaveInCalibrationTargetFingerprint(
      buildLeaveInCalibrationSnapshot(productId, rows),
    ),
  }
}

export type LeaveInCalibrationLedgerRow = {
  batch_id: string
  product_key: string
  batch_fingerprint: string
  content_fingerprint: string
  product_id: string
  reviewed_by: string
}

export type LeaveInCalibrationReadAdapter = {
  liveRows(productId: string): Promise<LeaveInCalibrationLiveRows>
  /** Ledger rows already written for this batch — the replay oracle. */
  appliedLedger(batchId: string): Promise<LeaveInCalibrationLedgerRow[]>
}

/**
 * Mirrors the DEFERRABLE curated-publication gate the apply has to survive at
 * COMMIT — both halves of it, evaluated against the state the apply WOULD leave
 * behind:
 *
 *  - `assert_personal_plan_curated_publication_v1_without_v2`: the leave-in fact
 *    completeness rules, and per required role a protocol row whose V1
 *    `guidance_payload` is a product-scoped object for this product, with a
 *    non-blank `source_text`, a `source_url`, and an `evidence[]` entry whose
 *    `sourceUrl` equals that `source_url`.
 *  - `assert_personal_plan_curated_publication`: the same roles again, each with
 *    a valid, unblocked V2 pointer.
 *
 * Both halves exempt a product that carries a Personal-Plan search disposition,
 * and so does this predicate.
 *
 * Required roles come from the PROJECTED `plan_roles` (with `pre_heat_application`
 * mapped to `pre_heat_protection`), because that is what the apply writes.
 */
function publicationDependencyBlockers(
  rows: LeaveInCalibrationLiveRows,
  projectedSpecs: Record<string, unknown>,
  projectedThicknesses: readonly string[],
): string[] {
  const product = rows.product
  if (!product) return ["live product row is missing"]
  const gated =
    (product.origin === "curated" &&
      product.is_active === true &&
      product.lifecycle_status === "active") ||
    product.is_chaarlie_recommended === true
  if (!gated) return []

  // Search-disposition exemption. BOTH SQL halves return early for a product
  // that has a `personal_plan_product_search_dispositions` row — the V1
  // assertion right after its own gated check, and the V2 wrapper likewise —
  // so a dispositioned product is never asked for fact completeness or protocol
  // coverage. Without this the CLI preflight would block an apply that the
  // database would happily commit.
  if (rows.dispositions.length > 0) return []

  const blockers: string[] = []
  const planRoles = Array.isArray(projectedSpecs.plan_roles)
    ? (projectedSpecs.plan_roles as string[])
    : []
  const applicationStage = Array.isArray(projectedSpecs.application_stage)
    ? (projectedSpecs.application_stage as string[])
    : []
  const functionalBenefits = Array.isArray(projectedSpecs.functional_benefits)
    ? (projectedSpecs.functional_benefits as string[])
    : []

  // --- V1 category-fact completeness (leave_in branch) ---
  const factProblems = [
    projectedSpecs.weight == null ? "weight" : null,
    projectedSpecs.care_direction == null ? "care_direction" : null,
    projectedSpecs.repair_support_level == null ? "repair_support_level" : null,
    planRoles.length === 0 ? "plan_roles" : null,
    functionalBenefits.length === 0 ? "functional_benefits" : null,
    projectedThicknesses.length === 0 ? "products.suitable_thicknesses" : null,
  ].filter((field): field is string => field !== null)
  const stageCoversARole =
    (planRoles.includes("post_wash_leave_in") && applicationStage.includes("towel_dry")) ||
    (planRoles.includes("pre_heat_application") &&
      projectedSpecs.provides_heat_protection === true &&
      applicationStage.includes("pre_heat"))
  if (!stageCoversARole) factProblems.push("application_stage does not cover any plan_role")
  for (const field of factProblems)
    blockers.push(
      `publication dependency: projected ${field} fails the curated-publication fact check`,
    )

  // --- V1 + V2 protocol coverage per required role ---
  const requiredRoles = [
    ...new Set(
      planRoles.map((role) => (role === "pre_heat_application" ? "pre_heat_protection" : role)),
    ),
  ].sort()

  for (const role of requiredRoles) {
    const candidates = rows.protocols.filter(
      (protocol) => protocol.role === role && protocol.category === "leave_in",
    )
    const v1Ok = candidates.some((protocol) => {
      const payload = protocol.guidance_payload as Record<string, unknown> | null
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false
      const scope = payload.scope as Record<string, unknown> | undefined
      const sourceUrl = protocol.source_url
      const sourceText = protocol.source_text
      const evidence = Array.isArray(payload.evidence)
        ? (payload.evidence as Array<Record<string, unknown>>)
        : []
      return (
        scope?.kind === "product" &&
        scope.productId === protocol.product_id &&
        scope.category === "leave_in" &&
        typeof sourceUrl === "string" &&
        sourceUrl.length > 0 &&
        typeof sourceText === "string" &&
        sourceText.trim().length > 0 &&
        evidence.some((entry) => entry.sourceUrl === sourceUrl)
      )
    })
    const v2Ok = candidates.some((protocol) => {
      const pointer = protocol.guidance_payload_v2 as Record<string, unknown> | null
      if (!pointer || typeof pointer !== "object" || Array.isArray(pointer)) return false
      const scope = pointer.scope as Record<string, unknown> | undefined
      return (
        String(pointer.schemaVersion) === "2" &&
        pointer.contractKind === "product_pointer" &&
        scope?.kind === "product" &&
        scope.productId === protocol.product_id &&
        scope.category === "leave_in" &&
        pointer.runtimeBlockerCode === null
      )
    })
    if (!v1Ok)
      blockers.push(
        `publication dependency: role "${role}" has no protocol row with a complete V1 guidance_payload (product scope, source_url, non-blank source_text, matching evidence)`,
      )
    if (!v2Ok)
      blockers.push(
        `publication dependency: role "${role}" has no protocol row with a valid guidance_payload_v2 pointer; the deferred curated-publication trigger will reject this apply`,
      )
  }
  return blockers
}

export type LeaveInCalibrationProductReport = {
  product_key: string
  slot: string
  target_product_id: string
  ok: boolean
  errors: string[]
  publication_blockers: string[]
  target_fingerprint_matches: boolean
  live_fingerprint: string
  operation_counts: { update_product: number; upsert: number; delete: number }
  upsert_rows_by_table: Record<string, number>
  delete_rows: CatalogEnrichmentDeleteOperation["rows"]
  execution_order: Array<{ type: string; table: string; rows: number }>
}

export type LeaveInCalibrationPreflightReport = {
  mode: "preflight"
  writes: false
  batch_id: string
  project_id: string
  ok: boolean
  products: LeaveInCalibrationProductReport[]
  summary: {
    products: number
    productsOk: number
    staleFingerprints: number
    publicationBlockers: number
    totalUpsertRows: number
    totalDeleteRows: number
  }
}

function countRows(operation: CatalogEnrichmentOperation): number {
  return "rows" in operation && Array.isArray(operation.rows) ? operation.rows.length : 0
}

/**
 * Read-only preflight: re-validates every per-product manifest against the live
 * catalog target (so a stale `target_fingerprint` fails here, not at apply time)
 * and reports the delete/upsert plan in execution order.
 */
export async function preflightLeaveInCalibration(input: {
  read: LeaveInCalibrationReadAdapter
  batch: unknown
}): Promise<LeaveInCalibrationPreflightReport> {
  const batch = (input.batch ?? {}) as Record<string, unknown>
  const manifests = Array.isArray(batch.products) ? batch.products : []
  const products: LeaveInCalibrationProductReport[] = []

  for (const target of LEAVE_IN_CALIBRATION_TARGETS) {
    const manifest = manifests.find(
      (candidate) =>
        candidate &&
        typeof candidate === "object" &&
        (candidate as Record<string, unknown>).product_key === target.product_key,
    ) as Record<string, unknown> | undefined

    if (!manifest) {
      products.push({
        product_key: target.product_key,
        slot: target.slot,
        target_product_id: target.product_id,
        ok: false,
        errors: [`batch is missing a manifest for ${target.product_key}`],
        publication_blockers: [],
        target_fingerprint_matches: false,
        live_fingerprint: "",
        operation_counts: { update_product: 0, upsert: 0, delete: 0 },
        upsert_rows_by_table: {},
        delete_rows: [],
        execution_order: [],
      })
      continue
    }

    const rows = await input.read.liveRows(target.product_id)
    const currentTarget = leaveInCalibrationCurrentTarget(target.product_id, rows)
    const validation = validateCatalogEnrichmentManifest(manifest, currentTarget)
    const operations = orderCatalogEnrichmentOperations(
      (Array.isArray(manifest.planned_operations)
        ? manifest.planned_operations
        : []) as CatalogEnrichmentOperation[],
    )
    const deleteRows = operations
      .filter(
        (operation): operation is CatalogEnrichmentDeleteOperation => operation.type === "delete",
      )
      .flatMap((operation) => operation.rows)
    const upsertRowsByTable: Record<string, number> = {}
    for (const operation of operations) {
      if (operation.type !== "upsert") continue
      upsertRowsByTable[operation.table] =
        (upsertRowsByTable[operation.table] ?? 0) + countRows(operation)
    }

    const projectedSpecs = ((
      manifest.category_payload as { product_leave_in_specs?: Record<string, unknown> }
    )?.product_leave_in_specs ?? {}) as Record<string, unknown>
    const projectedThicknesses = ((
      manifest.products_field_updates as
        | { suitable_thicknesses?: { projected?: unknown } }
        | null
        | undefined
    )?.suitable_thicknesses?.projected ??
      (manifest.current_catalog_target as LeaveInCalibrationSnapshot | undefined)?.products
        ?.suitable_thicknesses ??
      []) as string[]
    const publicationBlockers = publicationDependencyBlockers(
      rows,
      projectedSpecs,
      projectedThicknesses,
    )

    products.push({
      product_key: target.product_key,
      slot: target.slot,
      target_product_id: target.product_id,
      ok: validation.ok && publicationBlockers.length === 0,
      errors: validation.ok ? [] : validation.errors,
      publication_blockers: publicationBlockers,
      target_fingerprint_matches: manifest.target_fingerprint === currentTarget.fingerprint,
      live_fingerprint: currentTarget.fingerprint,
      operation_counts: {
        update_product: operations.filter((operation) => operation.type === "update_product")
          .length,
        upsert: operations.filter((operation) => operation.type === "upsert").length,
        delete: operations.filter((operation) => operation.type === "delete").length,
      },
      upsert_rows_by_table: upsertRowsByTable,
      delete_rows: deleteRows,
      execution_order: operations.map((operation) => ({
        type: operation.type,
        table: operation.table,
        rows: countRows(operation),
      })),
    })
  }

  const productsOk = products.filter((product) => product.ok).length
  const staleFingerprints = products.filter((product) => !product.target_fingerprint_matches).length

  return {
    mode: "preflight",
    writes: false,
    batch_id: String(batch.batch_id ?? ""),
    project_id: LEAVE_IN_CALIBRATION_PROJECT_ID,
    ok:
      batch.batch_id === LEAVE_IN_CALIBRATION_BATCH_ID &&
      products.length === LEAVE_IN_CALIBRATION_TARGETS.length &&
      productsOk === products.length &&
      staleFingerprints === 0,
    products,
    summary: {
      products: products.length,
      productsOk,
      staleFingerprints,
      publicationBlockers: products.reduce(
        (total, product) => total + product.publication_blockers.length,
        0,
      ),
      totalUpsertRows: products.reduce(
        (total, product) =>
          total + Object.values(product.upsert_rows_by_table).reduce((sum, rows) => sum + rows, 0),
        0,
      ),
      totalDeleteRows: products.reduce((total, product) => total + product.delete_rows.length, 0),
    },
  }
}

// ---------------------------------------------------------------------------
// Apply package, guard flags, executor bridge
//
// Mirrors the Heat cohort (heat.ts `buildHeatPackage` / `parseHeatApplyArgs` /
// `applyHeat`): the manifests are reduced to a compact apply package, the
// package is canonicalised with the shared stable-JSON serialiser, and its
// SHA-256 is the batch fingerprint the executor RPC pins itself to.
// ---------------------------------------------------------------------------

export const LEAVE_IN_CALIBRATION_PACKAGE_SCHEMA_VERSION =
  "personal-plan-catalog-enrichment-leave-in-calibration-v1" as const
export const LEAVE_IN_CALIBRATION_RPC = "apply_catalog_enrichment_leave_in_calibration_v1" as const
export const LEAVE_IN_CALIBRATION_MIGRATION = "20260914163000" as const
export const LEAVE_IN_CALIBRATION_REVIEWER = "nick" as const

/**
 * The approved package fingerprints, pinned in the executor migration too. A
 * regenerated manifest changes these, and the RPC then refuses the batch — that
 * is the guard, not a nuisance: a new batch needs a new reviewed migration.
 */
export const LEAVE_IN_CALIBRATION_APPROVED_BATCH_FINGERPRINT =
  "eaffe5481438c6639de05040c48937a17280fc6c2e9e192f64d3d8d569979ba6" as string
export const LEAVE_IN_CALIBRATION_COHORT_INDEX_FINGERPRINT =
  "78260563c2e818f23a14b74096c7b7c0e423a176cbe8327a93651357df98c06d" as string

export type LeaveInEligibilityKey = {
  thickness: string
  need_bucket: string
  styling_context: string
}

export type LeaveInCalibrationPackageProduct = {
  product_key: string
  product_id: string
  content_fingerprint: string
  target_fingerprint: string
  current_catalog_target: LeaveInCalibrationSnapshot
  suitable_thicknesses: string[]
  leave_in_specs: Record<string, unknown>
  leave_in_fit_specs: Record<string, unknown>
  eligibility_delete: LeaveInEligibilityKey[]
  eligibility_upsert: LeaveInEligibilityKey[]
}

export type LeaveInCalibrationPackage = {
  schema_version: typeof LEAVE_IN_CALIBRATION_PACKAGE_SCHEMA_VERSION
  batch_id: typeof LEAVE_IN_CALIBRATION_BATCH_ID
  cohort_index_fingerprint: string
  products: LeaveInCalibrationPackageProduct[]
}

export function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function eligibilityKey(row: Record<string, unknown>): LeaveInEligibilityKey {
  return {
    thickness: String(row.thickness),
    need_bucket: String(row.need_bucket),
    styling_context: String(row.styling_context),
  }
}

function sortKeys(rows: LeaveInEligibilityKey[]) {
  return [...rows].sort((left, right) =>
    `${left.thickness}|${left.need_bucket}|${left.styling_context}`.localeCompare(
      `${right.thickness}|${right.need_bucket}|${right.styling_context}`,
    ),
  )
}

/**
 * Reduces the reviewed manifest batch to the payload the executor consumes.
 * Research prose (field_rationales, projection warnings) is deliberately left
 * out: the executor writes catalog rows, and the package is what gets hashed.
 */
export function buildLeaveInCalibrationPackage(batch: unknown) {
  const envelope = (batch ?? {}) as Record<string, unknown>
  if (envelope.batch_id !== LEAVE_IN_CALIBRATION_BATCH_ID)
    throw new Error(`unknown Leave-In calibration batch: ${String(envelope.batch_id)}`)
  const manifests = Array.isArray(envelope.products) ? envelope.products : []
  if (manifests.length !== LEAVE_IN_CALIBRATION_TARGETS.length)
    throw new Error(
      `Leave-In calibration package must contain exactly ${LEAVE_IN_CALIBRATION_TARGETS.length} products`,
    )

  const products: LeaveInCalibrationPackageProduct[] = []
  for (const target of LEAVE_IN_CALIBRATION_TARGETS) {
    const manifest = manifests.find(
      (candidate) =>
        candidate &&
        typeof candidate === "object" &&
        (candidate as Record<string, unknown>).product_key === target.product_key,
    ) as Record<string, unknown> | undefined
    if (!manifest) throw new Error(`Leave-In calibration package is missing ${target.product_key}`)

    const validation = validateCatalogEnrichmentManifest(manifest)
    if (!validation.ok)
      throw new Error(
        `${target.product_key} is not a valid manifest: ${validation.errors.join("; ")}`,
      )
    if (manifest.target_product_id !== target.product_id)
      throw new Error(`${target.product_key} targets the wrong product id`)

    const operations = orderCatalogEnrichmentOperations(validation.planned_operations)
    const upsertRows = (table: string) =>
      operations
        .filter((operation) => operation.type === "upsert" && operation.table === table)
        .flatMap((operation) => (operation as { rows: Record<string, unknown>[] }).rows)
    const specs = upsertRows("product_leave_in_specs")
    const fit = upsertRows("product_leave_in_fit_specs")
    if (specs.length !== 1 || fit.length !== 1)
      throw new Error(`${target.product_key} must plan exactly one spec and one fit row`)

    /** The executor addresses rows by `product_id` itself, so it is not repeated per row. */
    const strip = (row: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(row).filter(([key]) => key !== "product_id"))

    const fieldUpdates = manifest.products_field_updates as
      | { suitable_thicknesses?: { projected?: unknown } }
      | null
      | undefined
    const projectedThicknesses = Array.isArray(fieldUpdates?.suitable_thicknesses?.projected)
      ? (fieldUpdates.suitable_thicknesses.projected as string[])
      : (((manifest.current_catalog_target as LeaveInCalibrationSnapshot).products
          ?.suitable_thicknesses as string[] | undefined) ?? [])

    products.push({
      product_key: target.product_key,
      product_id: target.product_id,
      content_fingerprint: validation.content_fingerprint,
      target_fingerprint: String(manifest.target_fingerprint),
      current_catalog_target: manifest.current_catalog_target as LeaveInCalibrationSnapshot,
      suitable_thicknesses: [...projectedThicknesses].sort(),
      leave_in_specs: strip(specs[0]!),
      leave_in_fit_specs: strip(fit[0]!),
      eligibility_delete: sortKeys(
        operations
          .filter((operation) => operation.type === "delete")
          .flatMap((operation) => (operation as CatalogEnrichmentDeleteOperation).rows)
          .map(eligibilityKey),
      ),
      eligibility_upsert: sortKeys(upsertRows("product_leave_in_eligibility").map(eligibilityKey)),
    })
  }

  const cohort_index_fingerprint = catalogEnrichmentFingerprint(
    generateCatalogEnrichmentIndex(manifests as CatalogEnrichmentManifest[]),
  )
  const pkg: LeaveInCalibrationPackage = {
    schema_version: LEAVE_IN_CALIBRATION_PACKAGE_SCHEMA_VERSION,
    batch_id: LEAVE_IN_CALIBRATION_BATCH_ID,
    cohort_index_fingerprint,
    products,
  }
  const canonical_json = stableCatalogEnrichmentJson(pkg)
  return {
    package: pkg,
    canonical_json,
    fingerprint: sha256Utf8(canonical_json),
    cohort_index_fingerprint,
  }
}

export type LeaveInCalibrationApplyArgs = {
  apply: boolean
  confirm: boolean
  confirm_batch?: string
  reviewed_by?: string
  reviewed_head?: string
  expect_migration?: "absent" | "applied"
  expected_batch_fingerprint?: string
  expected_content_fingerprint?: string
}

/** Same flag shape and same fail-closed gate as `parseHeatApplyArgs` (heat.ts). */
export function parseLeaveInCalibrationApplyArgs(
  argv: readonly string[],
): LeaveInCalibrationApplyArgs {
  const flags: Record<string, string | boolean> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index]!
    if (!raw.startsWith("--")) continue
    const equals = raw.indexOf("=")
    const key = raw.slice(2, equals === -1 ? undefined : equals)
    const inline = equals === -1 ? undefined : raw.slice(equals + 1)
    const next = argv[index + 1]
    flags[key] = inline ?? (next && !next.startsWith("--") ? argv[++index]! : true)
  }
  const text = (key: string) =>
    typeof flags[key] === "string" ? (flags[key] as string) : undefined
  const result: LeaveInCalibrationApplyArgs = {
    apply: flags.apply === true,
    confirm: flags.confirm === true,
    confirm_batch: text("confirm-batch"),
    reviewed_by: text("reviewed-by"),
    reviewed_head: text("reviewed-head"),
    expect_migration:
      flags["expect-migration"] === "absent" || flags["expect-migration"] === "applied"
        ? flags["expect-migration"]
        : undefined,
    expected_batch_fingerprint: text("expected-batch-fingerprint"),
    expected_content_fingerprint: text("expected-content-fingerprint"),
  }
  if (
    result.apply &&
    (!result.confirm ||
      result.confirm_batch !== LEAVE_IN_CALIBRATION_BATCH_ID ||
      result.reviewed_by !== LEAVE_IN_CALIBRATION_REVIEWER ||
      !result.reviewed_head ||
      !/^[a-f0-9]{40}$/.test(result.reviewed_head) ||
      result.expect_migration !== "applied" ||
      !result.expected_batch_fingerprint ||
      !result.expected_content_fingerprint)
  )
    throw new Error(
      `Leave-In calibration apply requires --apply --confirm --confirm-batch ${LEAVE_IN_CALIBRATION_BATCH_ID} --reviewed-by ${LEAVE_IN_CALIBRATION_REVIEWER} --reviewed-head <40-char-sha> --expect-migration=applied --expected-batch-fingerprint <sha256> --expected-content-fingerprint <sha256>`,
    )
  return result
}

/**
 * Which run this is. A committed apply whose response was lost leaves the ledger
 * written and every `target_fingerprint` stale — so a naive retry preflights red
 * and refuses with zero RPC calls, and the executor's own replay verification
 * becomes unreachable. Reading the ledger first distinguishes "not applied yet"
 * from "already applied, verify it", instead of treating both as failure.
 */
export type LeaveInCalibrationRunMode =
  | { mode: "first_apply" }
  | { mode: "replay"; ledgerRows: number }
  | { mode: "blocked"; reasons: string[] }

export function classifyLeaveInCalibrationRun(input: {
  built: ReturnType<typeof buildLeaveInCalibrationPackage>
  preflight: LeaveInCalibrationPreflightReport
  ledger: readonly LeaveInCalibrationLedgerRow[]
}): LeaveInCalibrationRunMode {
  const { built, preflight, ledger } = input
  const forBatch = ledger.filter((row) => row.batch_id === LEAVE_IN_CALIBRATION_BATCH_ID)
  if (forBatch.length === 0) {
    return preflight.ok
      ? { mode: "first_apply" }
      : {
          mode: "blocked",
          reasons: ["preflight is not green and the ledger holds no applied rows for this batch"],
        }
  }

  const reasons: string[] = []
  if (forBatch.length !== built.package.products.length)
    reasons.push(
      `ledger holds ${forBatch.length} of ${built.package.products.length} products for this batch — partial state, resolve by hand`,
    )
  const byKey = new Map(forBatch.map((row) => [row.product_key, row]))
  for (const product of built.package.products) {
    const row = byKey.get(product.product_key)
    if (!row) {
      reasons.push(`ledger is missing ${product.product_key}`)
      continue
    }
    if (row.batch_fingerprint !== built.fingerprint)
      reasons.push(`${product.product_key} was applied by a different batch fingerprint`)
    if (row.content_fingerprint !== product.content_fingerprint)
      reasons.push(`${product.product_key} was applied from different reviewed content`)
    if (row.product_id !== product.product_id)
      reasons.push(`${product.product_key} ledger row targets another product`)
    if (row.reviewed_by !== LEAVE_IN_CALIBRATION_REVIEWER)
      reasons.push(`${product.product_key} was applied by ${row.reviewed_by}`)
  }

  // On a replay the fingerprints are stale BY DESIGN — that is what the previous
  // apply changed. Any other validation error still blocks.
  const unexpected = preflight.products.flatMap((product) =>
    product.errors.filter((error) => error !== "target fingerprint is stale"),
  )
  reasons.push(...unexpected.map((error) => `unexpected preflight error: ${error}`))

  return reasons.length > 0
    ? { mode: "blocked", reasons: [...new Set(reasons)] }
    : { mode: "replay", ledgerRows: forBatch.length }
}

export type LeaveInCalibrationWriteAdapter = {
  rpc: (
    name: typeof LEAVE_IN_CALIBRATION_RPC,
    args: {
      p_batch_json: string
      p_expected_batch_fingerprint: string
      p_reviewed_by: typeof LEAVE_IN_CALIBRATION_REVIEWER
    },
  ) => Promise<void>
}

/**
 * Every write in this cohort goes through the one fingerprint-pinned RPC, the
 * same posture as `applyHeat`: no generic table writer is reachable from here.
 */
export async function applyLeaveInCalibration(input: {
  args: LeaveInCalibrationApplyArgs
  preflight: LeaveInCalibrationPreflightReport
  built: ReturnType<typeof buildLeaveInCalibrationPackage>
  run: LeaveInCalibrationRunMode
  gitState: () => Promise<{ head: string; clean: boolean }>
  write: LeaveInCalibrationWriteAdapter
}) {
  const { args, built, run } = input
  if (!args.apply) throw new Error("Leave-In calibration apply requires --apply")
  if (run.mode === "blocked")
    throw new Error(`Leave-In calibration apply is blocked: ${run.reasons.join("; ")}`)
  if (run.mode === "first_apply" && !input.preflight.ok)
    throw new Error("Leave-In calibration preflight is not green")
  if (built.fingerprint !== args.expected_batch_fingerprint)
    throw new Error("Leave-In calibration batch fingerprint does not match the reviewed batch")
  if (built.cohort_index_fingerprint !== args.expected_content_fingerprint)
    throw new Error("Leave-In calibration cohort index does not match the reviewed batch")
  if (built.fingerprint !== LEAVE_IN_CALIBRATION_APPROVED_BATCH_FINGERPRINT)
    throw new Error("Leave-In calibration batch is not the approved, migration-pinned batch")
  const state = await input.gitState()
  if (!state.clean || state.head !== args.reviewed_head)
    throw new Error("Leave-In calibration apply requires the exact clean reviewed head")

  // Both paths go through the same RPC. On a replay the executor short-circuits
  // per product after re-asserting that the live state still equals the batch,
  // so "verify what already landed" is a real check, not a no-op.
  await input.write.rpc(LEAVE_IN_CALIBRATION_RPC, {
    p_batch_json: built.canonical_json,
    p_expected_batch_fingerprint: built.fingerprint,
    p_reviewed_by: LEAVE_IN_CALIBRATION_REVIEWER,
  })
  return {
    applied: true as const,
    replay: run.mode === "replay",
    batch_id: LEAVE_IN_CALIBRATION_BATCH_ID,
    fingerprint: built.fingerprint,
    products: built.package.products.length,
    deleted_rows:
      run.mode === "replay"
        ? 0
        : built.package.products.reduce(
            (total, product) => total + product.eligibility_delete.length,
            0,
          ),
  }
}

export type LeaveInCalibrationVerifyProduct = {
  product_key: string
  slot: string
  product_id: string
  ok: boolean
  mismatches: string[]
}

export type LeaveInCalibrationVerifyReport = {
  mode: "verify"
  writes: false
  batch_id: string
  ok: boolean
  products: LeaveInCalibrationVerifyProduct[]
}

/** Read-only post-apply assertion: live rows must equal the package's intent. */
export async function verifyLeaveInCalibration(input: {
  read: LeaveInCalibrationReadAdapter
  built: ReturnType<typeof buildLeaveInCalibrationPackage>
}): Promise<LeaveInCalibrationVerifyReport> {
  const products: LeaveInCalibrationVerifyProduct[] = []
  for (const expected of input.built.package.products) {
    const target = LEAVE_IN_CALIBRATION_TARGETS.find(
      (candidate) => candidate.product_key === expected.product_key,
    )!
    const rows = await input.read.liveRows(expected.product_id)
    const mismatches: string[] = []

    const liveThicknesses = [
      ...(((rows.product?.suitable_thicknesses as string[] | null) ?? []) as string[]),
    ].sort()
    if (
      stableCatalogEnrichmentJson(liveThicknesses) !==
      stableCatalogEnrichmentJson(expected.suitable_thicknesses)
    )
      mismatches.push("products.suitable_thicknesses")

    for (const [field, value] of Object.entries(expected.leave_in_specs)) {
      const live = rows.specs?.[field]
      const normalize = (input_: unknown) =>
        Array.isArray(input_) ? [...(input_ as unknown[])].sort() : (input_ ?? null)
      if (
        stableCatalogEnrichmentJson(normalize(live)) !==
        stableCatalogEnrichmentJson(normalize(value))
      )
        mismatches.push(`product_leave_in_specs.${field}`)
    }
    for (const [field, value] of Object.entries(expected.leave_in_fit_specs)) {
      const live = rows.fitSpecs?.[field]
      const normalize = (input_: unknown) =>
        Array.isArray(input_) ? [...(input_ as unknown[])].sort() : (input_ ?? null)
      if (
        stableCatalogEnrichmentJson(normalize(live)) !==
        stableCatalogEnrichmentJson(normalize(value))
      )
        mismatches.push(`product_leave_in_fit_specs.${field}`)
    }

    const liveEligibility = sortKeys(rows.eligibility.map(eligibilityKey))
    if (
      stableCatalogEnrichmentJson(liveEligibility) !==
      stableCatalogEnrichmentJson(expected.eligibility_upsert)
    )
      mismatches.push("product_leave_in_eligibility set")
    for (const deleted of expected.eligibility_delete) {
      if (
        liveEligibility.some(
          (row) =>
            row.thickness === deleted.thickness &&
            row.need_bucket === deleted.need_bucket &&
            row.styling_context === deleted.styling_context,
        )
      )
        mismatches.push(
          `deleted row still present: ${deleted.thickness}/${deleted.need_bucket}/${deleted.styling_context}`,
        )
    }

    products.push({
      product_key: expected.product_key,
      slot: target.slot,
      product_id: expected.product_id,
      ok: mismatches.length === 0,
      mismatches,
    })
  }

  return {
    mode: "verify",
    writes: false,
    batch_id: LEAVE_IN_CALIBRATION_BATCH_ID,
    ok: products.every((product) => product.ok),
    products,
  }
}
