import {
  catalogEnrichmentFingerprint,
  generateCatalogEnrichmentIndex,
  orderCatalogEnrichmentOperations,
  stableCatalogEnrichmentJson,
  validateCatalogEnrichmentManifest,
  type CatalogEnrichmentManifest,
} from "@/lib/product-intake/catalog-enrichment"
import {
  LEAVE_IN_CALIBRATION_PROJECT_ID,
  LEAVE_IN_CALIBRATION_REVIEWER,
  buildLeaveInCalibrationSnapshot,
  leaveInCalibrationCurrentTarget,
  publicationDependencyBlockers,
  sha256Utf8,
  type LeaveInCalibrationLedgerRow,
  type LeaveInCalibrationReadAdapter,
  type LeaveInCalibrationSnapshot,
  type LeaveInEligibilityKey,
} from "@/lib/product-intake/catalog-enrichment/leave-in-research-calibration"

/**
 * Leave-In calibration batch v2 — the Standard v1.1 / T20 delta (2026-09-29).
 *
 * Batch v1 (`leave-in-research-calibration-v1`, applied 2026-09-14) wrote the
 * v1.0 projection for nine products. T20 and the AD-3a revision move exactly
 * three `product_leave_in_specs` columns — `care_direction`, `care_benefits`,
 * `functional_benefits` — on exactly five of them (EVO, Gliss, Redken, Olaplex
 * No.6, Neqi), and nothing else: fit specs, eligibility rows and
 * `suitable_thicknesses` are unchanged (plans/leave-in-moisture-balanced/
 * t20-catalog-delta.md). This batch therefore:
 *
 *  - targets only those five products, pinned to their CURRENT live state
 *    (batch v1's output);
 *  - plans one `product_leave_in_specs` upsert per product and no other
 *    operation — no eligibility delete or upsert, no fit upsert, no product
 *    update;
 *  - carries the full v1.1 projection so the executor can prove, row by row,
 *    that only the three allowlisted spec columns differ from the pinned state
 *    and that fit, eligibility and thicknesses are identical.
 *
 * Read-only except `applyLeaveInCalibrationV2T20`, whose only write path is the
 * fingerprint-pinned executor RPC.
 */

export const LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID = "leave-in-research-calibration-v2-t20" as const
export const LEAVE_IN_CALIBRATION_V2_T20_RESEARCH_VERSION = "leave-in-inci-v1.1" as const
export const LEAVE_IN_CALIBRATION_V2_T20_ADAPTER_VERSION = "leave-in-production-adapter-v1" as const
export const LEAVE_IN_CALIBRATION_V2_T20_PACKAGE_SCHEMA_VERSION =
  "personal-plan-catalog-enrichment-leave-in-calibration-v2-t20" as const
export const LEAVE_IN_CALIBRATION_V2_T20_RPC =
  "apply_catalog_enrichment_leave_in_calibration_v2_t20" as const
export const LEAVE_IN_CALIBRATION_V2_T20_MIGRATION = "20260929214731" as const
export const LEAVE_IN_CALIBRATION_V2_T20_MANIFEST =
  "plans/leave-in-moisture-balanced/leave-in-research-enrichment-manifest-v2-t20.json" as const
export const LEAVE_IN_CALIBRATION_V2_T20_PROJECTIONS =
  "data/research/leave-in-inci/v1.1/calibration-expected-projections.json" as const

/**
 * The approved package fingerprints, hardwired in the executor migration too.
 * A regenerated manifest changes them and the RPC then refuses the batch: a new
 * batch needs a new reviewed migration.
 */
export const LEAVE_IN_CALIBRATION_V2_T20_APPROVED_BATCH_FINGERPRINT =
  "059cdca2fb98bde5b4c3b70d0920e93f78bb22eb993f0f207e669b848b1ddd4c" as string
export const LEAVE_IN_CALIBRATION_V2_T20_COHORT_INDEX_FINGERPRINT =
  "3a63acc89c081080bda4e4157254836103336a9490d067dd3cf148203727baed" as string

/** The five live products whose production projection moved under T20 / AD-3a. */
export const LEAVE_IN_CALIBRATION_V2_T20_TARGETS = [
  {
    slot: "slot-05",
    product_key: "leave-in-slot-05-evo-head-mistress",
    product_id: "118ebae1-b7a9-4a89-a2ff-6c31df28c4dc",
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

/** The only `product_leave_in_specs` columns this batch may change. */
export const LEAVE_IN_CALIBRATION_V2_T20_CHANGEABLE_SPEC_COLUMNS = [
  "care_benefits",
  "care_direction",
  "functional_benefits",
] as const

/** The projection's `product_leave_in_specs` columns (the adapter's 12-column row). */
export const LEAVE_IN_CALIBRATION_V2_T20_PROJECTED_SPEC_COLUMNS = [
  "application_stage",
  "care_benefits",
  "care_direction",
  "format",
  "functional_benefits",
  "heat_activation_required",
  "ingredient_flags",
  "plan_roles",
  "provides_heat_protection",
  "repair_support_level",
  "roles",
  "weight",
] as const

export const LEAVE_IN_CALIBRATION_V2_T20_FIT_COLUMNS = [
  "care_benefits",
  "conditioner_relationship",
  "weight",
] as const

/** Arrays compare as sets (sorted), scalars as-is — the snapshot's own convention. */
export function comparableValue(value: unknown): unknown {
  return Array.isArray(value) ? [...(value as unknown[])].map(String).sort() : (value ?? null)
}

function same(left: unknown, right: unknown): boolean {
  return (
    stableCatalogEnrichmentJson(comparableValue(left)) ===
    stableCatalogEnrichmentJson(comparableValue(right))
  )
}

function sortKeys(rows: LeaveInEligibilityKey[]): LeaveInEligibilityKey[] {
  return [...rows]
    .map((row) => ({
      thickness: String(row.thickness),
      need_bucket: String(row.need_bucket),
      styling_context: String(row.styling_context),
    }))
    .sort((left, right) =>
      `${left.thickness}|${left.need_bucket}|${left.styling_context}`.localeCompare(
        `${right.thickness}|${right.need_bucket}|${right.styling_context}`,
      ),
    )
}

export type LeaveInV2T20Delta = {
  changed_spec_columns: string[]
  invariant_violations: string[]
}

/**
 * Compares a v1.1 projection with a pinned live snapshot. The batch may only
 * move the three allowlisted spec columns; every other projected spec column,
 * the fit row, the eligibility set and `suitable_thicknesses` must be identical.
 */
export function leaveInV2T20Delta(input: {
  snapshot: LeaveInCalibrationSnapshot
  projectedSpecs: Record<string, unknown>
  projectedFit: Record<string, unknown>
  projectedEligibility: LeaveInEligibilityKey[]
  projectedThicknesses: readonly string[]
}): LeaveInV2T20Delta {
  const liveSpecs = input.snapshot.product_leave_in_specs ?? {}
  const liveFit = input.snapshot.product_leave_in_fit_specs ?? {}
  const changed = LEAVE_IN_CALIBRATION_V2_T20_PROJECTED_SPEC_COLUMNS.filter(
    (column) => !same(input.projectedSpecs[column], liveSpecs[column]),
  )
  const violations: string[] = []
  for (const column of changed) {
    if (
      !(LEAVE_IN_CALIBRATION_V2_T20_CHANGEABLE_SPEC_COLUMNS as readonly string[]).includes(column)
    )
      violations.push(`product_leave_in_specs.${column} would change but is not allowlisted`)
  }
  for (const column of LEAVE_IN_CALIBRATION_V2_T20_FIT_COLUMNS) {
    if (!same(input.projectedFit[column], liveFit[column]))
      violations.push(`product_leave_in_fit_specs.${column} would change`)
  }
  if (
    stableCatalogEnrichmentJson(sortKeys(input.projectedEligibility)) !==
    stableCatalogEnrichmentJson(
      sortKeys(input.snapshot.product_leave_in_eligibility as LeaveInEligibilityKey[]),
    )
  )
    violations.push("product_leave_in_eligibility would change")
  if (!same(input.projectedThicknesses, input.snapshot.products?.suitable_thicknesses))
    violations.push("products.suitable_thicknesses would change")
  if (changed.length === 0) violations.push("no spec column changes — the product has no delta")
  return { changed_spec_columns: [...changed], invariant_violations: violations }
}

// ---------------------------------------------------------------------------
// Apply package
// ---------------------------------------------------------------------------

export type LeaveInV2T20PackageProduct = {
  product_key: string
  product_id: string
  content_fingerprint: string
  target_fingerprint: string
  current_catalog_target: LeaveInCalibrationSnapshot
  changed_spec_columns: string[]
  projected_leave_in_specs: Record<string, unknown>
  projected_leave_in_fit_specs: Record<string, unknown>
  projected_eligibility: LeaveInEligibilityKey[]
  projected_suitable_thicknesses: string[]
}

export type LeaveInV2T20Package = {
  schema_version: typeof LEAVE_IN_CALIBRATION_V2_T20_PACKAGE_SCHEMA_VERSION
  batch_id: typeof LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID
  cohort_index_fingerprint: string
  products: LeaveInV2T20PackageProduct[]
}

function findManifest(manifests: unknown[], productKey: string) {
  return manifests.find(
    (candidate) =>
      candidate &&
      typeof candidate === "object" &&
      (candidate as Record<string, unknown>).product_key === productKey,
  ) as Record<string, unknown> | undefined
}

function stripProductId(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).filter(([key]) => key !== "product_id"))
}

/**
 * Reduces the reviewed manifest batch to the executor payload. Refuses any
 * manifest that plans anything but one `product_leave_in_specs` upsert, and any
 * product whose projection would move more than the allowlisted spec columns.
 */
export function buildLeaveInCalibrationV2T20Package(batch: unknown) {
  const envelope = (batch ?? {}) as Record<string, unknown>
  if (envelope.batch_id !== LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID)
    throw new Error(`unknown Leave-In calibration batch: ${String(envelope.batch_id)}`)
  const manifests = Array.isArray(envelope.products) ? envelope.products : []
  if (manifests.length !== LEAVE_IN_CALIBRATION_V2_T20_TARGETS.length)
    throw new Error(
      `Leave-In calibration v2-t20 package must contain exactly ${LEAVE_IN_CALIBRATION_V2_T20_TARGETS.length} products`,
    )

  const products: LeaveInV2T20PackageProduct[] = []
  for (const target of LEAVE_IN_CALIBRATION_V2_T20_TARGETS) {
    const manifest = findManifest(manifests, target.product_key)
    if (!manifest) throw new Error(`v2-t20 package is missing ${target.product_key}`)
    const validation = validateCatalogEnrichmentManifest(manifest)
    if (!validation.ok)
      throw new Error(
        `${target.product_key} is not a valid manifest: ${validation.errors.join("; ")}`,
      )
    if (manifest.target_product_id !== target.product_id)
      throw new Error(`${target.product_key} targets the wrong product id`)

    const operations = orderCatalogEnrichmentOperations(validation.planned_operations)
    if (
      operations.length !== 1 ||
      operations[0]!.type !== "upsert" ||
      operations[0]!.table !== "product_leave_in_specs"
    )
      throw new Error(
        `${target.product_key} must plan exactly one product_leave_in_specs upsert and nothing else (no eligibility, fit or product operation)`,
      )
    const specRows = (operations[0] as { rows: Record<string, unknown>[] }).rows
    if (specRows.length !== 1)
      throw new Error(`${target.product_key} must upsert exactly one spec row`)

    const categoryPayload = manifest.category_payload as {
      product_leave_in_specs: Record<string, unknown>
      product_leave_in_fit_specs: Record<string, unknown>
      product_leave_in_eligibility: LeaveInEligibilityKey[]
    }
    const snapshot = manifest.current_catalog_target as LeaveInCalibrationSnapshot
    const projectedSpecs = stripProductId(specRows[0]!)
    const projectedThicknesses = [
      ...(((
        manifest.product_payload as { final?: { product?: { suitable_thicknesses?: string[] } } }
      )?.final?.product?.suitable_thicknesses ?? []) as string[]),
    ].sort()
    const delta = leaveInV2T20Delta({
      snapshot,
      projectedSpecs,
      projectedFit: categoryPayload.product_leave_in_fit_specs,
      projectedEligibility: categoryPayload.product_leave_in_eligibility,
      projectedThicknesses,
    })
    if (delta.invariant_violations.length > 0)
      throw new Error(`${target.product_key}: ${delta.invariant_violations.join("; ")}`)

    products.push({
      product_key: target.product_key,
      product_id: target.product_id,
      content_fingerprint: validation.content_fingerprint,
      target_fingerprint: String(manifest.target_fingerprint),
      current_catalog_target: snapshot,
      changed_spec_columns: delta.changed_spec_columns,
      projected_leave_in_specs: projectedSpecs,
      projected_leave_in_fit_specs: categoryPayload.product_leave_in_fit_specs,
      projected_eligibility: sortKeys(categoryPayload.product_leave_in_eligibility),
      projected_suitable_thicknesses: projectedThicknesses,
    })
  }

  const cohort_index_fingerprint = catalogEnrichmentFingerprint(
    generateCatalogEnrichmentIndex(manifests as CatalogEnrichmentManifest[]),
  )
  const pkg: LeaveInV2T20Package = {
    schema_version: LEAVE_IN_CALIBRATION_V2_T20_PACKAGE_SCHEMA_VERSION,
    batch_id: LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID,
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

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

export type LeaveInV2T20PreflightProduct = {
  product_key: string
  slot: string
  target_product_id: string
  ok: boolean
  errors: string[]
  publication_blockers: string[]
  target_fingerprint_matches: boolean
  live_fingerprint: string
  changed_spec_columns: string[]
  invariant_violations: string[]
  execution_order: Array<{ type: string; table: string; rows: number }>
}

export type LeaveInV2T20PreflightReport = {
  mode: "preflight"
  writes: false
  batch_id: string
  project_id: string
  ok: boolean
  products: LeaveInV2T20PreflightProduct[]
  summary: {
    products: number
    productsOk: number
    staleFingerprints: number
    publicationBlockers: number
    invariantViolations: number
    eligibilityOperations: number
  }
}

/**
 * Read-only preflight: re-validates every manifest against the live target, and
 * re-derives the T20 delta against LIVE rows (not only the pinned snapshot), so
 * a live row that already moved — or would move beyond the allowlist — fails here.
 */
export async function preflightLeaveInCalibrationV2T20(input: {
  read: LeaveInCalibrationReadAdapter
  batch: unknown
}): Promise<LeaveInV2T20PreflightReport> {
  const batch = (input.batch ?? {}) as Record<string, unknown>
  const manifests = Array.isArray(batch.products) ? batch.products : []
  const products: LeaveInV2T20PreflightProduct[] = []

  for (const target of LEAVE_IN_CALIBRATION_V2_T20_TARGETS) {
    const manifest = findManifest(manifests, target.product_key)
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
        changed_spec_columns: [],
        invariant_violations: [],
        execution_order: [],
      })
      continue
    }
    const rows = await input.read.liveRows(target.product_id)
    const currentTarget = leaveInCalibrationCurrentTarget(target.product_id, rows)
    const validation = validateCatalogEnrichmentManifest(manifest, currentTarget)
    const operations = orderCatalogEnrichmentOperations(
      (Array.isArray(manifest.planned_operations) ? manifest.planned_operations : []) as never[],
    )
    const categoryPayload = (manifest.category_payload ?? {}) as {
      product_leave_in_specs?: Record<string, unknown>
      product_leave_in_fit_specs?: Record<string, unknown>
      product_leave_in_eligibility?: LeaveInEligibilityKey[]
    }
    const projectedSpecs = categoryPayload.product_leave_in_specs ?? {}
    const projectedThicknesses = ((
      manifest.product_payload as { final?: { product?: { suitable_thicknesses?: string[] } } }
    )?.final?.product?.suitable_thicknesses ?? []) as string[]
    const delta = leaveInV2T20Delta({
      snapshot: buildLeaveInCalibrationSnapshot(target.product_id, rows),
      projectedSpecs,
      projectedFit: categoryPayload.product_leave_in_fit_specs ?? {},
      projectedEligibility: categoryPayload.product_leave_in_eligibility ?? [],
      projectedThicknesses,
    })
    const operationErrors =
      operations.length === 1 &&
      operations[0]!.type === "upsert" &&
      operations[0]!.table === "product_leave_in_specs"
        ? []
        : ["manifest must plan exactly one product_leave_in_specs upsert and nothing else"]
    const publicationBlockers = publicationDependencyBlockers(
      rows,
      projectedSpecs,
      projectedThicknesses,
    )
    const errors = [...(validation.ok ? [] : validation.errors), ...operationErrors]

    products.push({
      product_key: target.product_key,
      slot: target.slot,
      target_product_id: target.product_id,
      ok:
        errors.length === 0 &&
        publicationBlockers.length === 0 &&
        delta.invariant_violations.length === 0,
      errors,
      publication_blockers: publicationBlockers,
      target_fingerprint_matches: manifest.target_fingerprint === currentTarget.fingerprint,
      live_fingerprint: currentTarget.fingerprint,
      changed_spec_columns: delta.changed_spec_columns,
      invariant_violations: delta.invariant_violations,
      execution_order: operations.map((operation) => ({
        type: operation.type,
        table: operation.table,
        rows: "rows" in operation && Array.isArray(operation.rows) ? operation.rows.length : 0,
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
      batch.batch_id === LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID &&
      products.length === LEAVE_IN_CALIBRATION_V2_T20_TARGETS.length &&
      productsOk === products.length &&
      staleFingerprints === 0,
    products,
    summary: {
      products: products.length,
      productsOk,
      staleFingerprints,
      publicationBlockers: products.reduce(
        (sum, product) => sum + product.publication_blockers.length,
        0,
      ),
      invariantViolations: products.reduce(
        (sum, product) => sum + product.invariant_violations.length,
        0,
      ),
      eligibilityOperations: products.reduce(
        (sum, product) =>
          sum +
          product.execution_order.filter(
            (operation) => operation.table === "product_leave_in_eligibility",
          ).length,
        0,
      ),
    },
  }
}

// ---------------------------------------------------------------------------
// Apply guard, run classification, executor bridge, verify
// ---------------------------------------------------------------------------

export type LeaveInV2T20ApplyArgs = {
  apply: boolean
  confirm: boolean
  confirm_batch?: string
  reviewed_by?: string
  reviewed_head?: string
  expect_migration?: "absent" | "applied"
  expected_batch_fingerprint?: string
  expected_content_fingerprint?: string
}

/** Same flag shape and fail-closed gate as the v1 lane (`parseLeaveInCalibrationApplyArgs`). */
export function parseLeaveInCalibrationV2T20ApplyArgs(
  argv: readonly string[],
): LeaveInV2T20ApplyArgs {
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
  const result: LeaveInV2T20ApplyArgs = {
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
      result.confirm_batch !== LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID ||
      result.reviewed_by !== LEAVE_IN_CALIBRATION_REVIEWER ||
      !result.reviewed_head ||
      !/^[a-f0-9]{40}$/.test(result.reviewed_head) ||
      result.expect_migration !== "applied" ||
      !result.expected_batch_fingerprint ||
      !result.expected_content_fingerprint)
  )
    throw new Error(
      `Leave-In calibration v2-t20 apply requires --apply --confirm --confirm-batch ${LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID} --reviewed-by ${LEAVE_IN_CALIBRATION_REVIEWER} --reviewed-head <40-char-sha> --expect-migration=applied --expected-batch-fingerprint <sha256> --expected-content-fingerprint <sha256>`,
    )
  return result
}

export type LeaveInV2T20RunMode =
  | { mode: "first_apply" }
  | { mode: "replay"; ledgerRows: number }
  | { mode: "blocked"; reasons: string[] }

/** Ledger-first run classification — same semantics as the v1 lane. */
export function classifyLeaveInCalibrationV2T20Run(input: {
  built: ReturnType<typeof buildLeaveInCalibrationV2T20Package>
  preflight: LeaveInV2T20PreflightReport
  ledger: readonly LeaveInCalibrationLedgerRow[]
}): LeaveInV2T20RunMode {
  const { built, preflight, ledger } = input
  const forBatch = ledger.filter((row) => row.batch_id === LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID)
  if (forBatch.length === 0)
    return preflight.ok
      ? { mode: "first_apply" }
      : {
          mode: "blocked",
          reasons: ["preflight is not green and the ledger holds no applied rows for this batch"],
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
  // On a replay the fingerprints are stale by design, and the delta against live
  // rows is empty by design ("no spec column changes"). Anything else blocks.
  const unexpected = preflight.products.flatMap((product) => [
    ...product.errors.filter((error) => error !== "target fingerprint is stale"),
    ...product.invariant_violations.filter(
      (violation) => violation !== "no spec column changes — the product has no delta",
    ),
  ])
  reasons.push(...unexpected.map((error) => `unexpected preflight error: ${error}`))
  return reasons.length > 0
    ? { mode: "blocked", reasons: [...new Set(reasons)] }
    : { mode: "replay", ledgerRows: forBatch.length }
}

export type LeaveInV2T20WriteAdapter = {
  rpc: (
    name: typeof LEAVE_IN_CALIBRATION_V2_T20_RPC,
    args: {
      p_batch_json: string
      p_expected_batch_fingerprint: string
      p_reviewed_by: typeof LEAVE_IN_CALIBRATION_REVIEWER
    },
  ) => Promise<void>
}

export async function applyLeaveInCalibrationV2T20(input: {
  args: LeaveInV2T20ApplyArgs
  preflight: LeaveInV2T20PreflightReport
  built: ReturnType<typeof buildLeaveInCalibrationV2T20Package>
  run: LeaveInV2T20RunMode
  gitState: () => Promise<{ head: string; clean: boolean }>
  write: LeaveInV2T20WriteAdapter
}) {
  const { args, built, run } = input
  if (!args.apply) throw new Error("Leave-In calibration v2-t20 apply requires --apply")
  if (run.mode === "blocked")
    throw new Error(`Leave-In calibration v2-t20 apply is blocked: ${run.reasons.join("; ")}`)
  if (run.mode === "first_apply" && !input.preflight.ok)
    throw new Error("Leave-In calibration v2-t20 preflight is not green")
  if (built.fingerprint !== args.expected_batch_fingerprint)
    throw new Error(
      "Leave-In calibration v2-t20 batch fingerprint does not match the reviewed batch",
    )
  if (built.cohort_index_fingerprint !== args.expected_content_fingerprint)
    throw new Error("Leave-In calibration v2-t20 cohort index does not match the reviewed batch")
  if (built.fingerprint !== LEAVE_IN_CALIBRATION_V2_T20_APPROVED_BATCH_FINGERPRINT)
    throw new Error("Leave-In calibration v2-t20 batch is not the approved, migration-pinned batch")
  if (built.cohort_index_fingerprint !== LEAVE_IN_CALIBRATION_V2_T20_COHORT_INDEX_FINGERPRINT)
    throw new Error("Leave-In calibration v2-t20 cohort index is not the migration-pinned index")
  const state = await input.gitState()
  if (!state.clean || state.head !== args.reviewed_head)
    throw new Error("Leave-In calibration v2-t20 apply requires the exact clean reviewed head")

  await input.write.rpc(LEAVE_IN_CALIBRATION_V2_T20_RPC, {
    p_batch_json: built.canonical_json,
    p_expected_batch_fingerprint: built.fingerprint,
    p_reviewed_by: LEAVE_IN_CALIBRATION_REVIEWER,
  })
  return {
    applied: true as const,
    replay: run.mode === "replay",
    batch_id: LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID,
    fingerprint: built.fingerprint,
    products: built.package.products.length,
    eligibility_rows_written: 0,
  }
}

export type LeaveInV2T20VerifyReport = {
  mode: "verify"
  writes: false
  batch_id: string
  ok: boolean
  products: Array<{ product_key: string; product_id: string; ok: boolean; mismatches: string[] }>
}

/** Read-only post-apply assertion: live rows equal the full v1.1 projection. */
export async function verifyLeaveInCalibrationV2T20(input: {
  read: LeaveInCalibrationReadAdapter
  built: ReturnType<typeof buildLeaveInCalibrationV2T20Package>
}): Promise<LeaveInV2T20VerifyReport> {
  const products: LeaveInV2T20VerifyReport["products"] = []
  for (const expected of input.built.package.products) {
    const rows = await input.read.liveRows(expected.product_id)
    const mismatches: string[] = []
    for (const [column, value] of Object.entries(expected.projected_leave_in_specs)) {
      if (!same(rows.specs?.[column], value)) mismatches.push(`product_leave_in_specs.${column}`)
    }
    for (const [column, value] of Object.entries(expected.projected_leave_in_fit_specs)) {
      if (!same(rows.fitSpecs?.[column], value))
        mismatches.push(`product_leave_in_fit_specs.${column}`)
    }
    if (
      stableCatalogEnrichmentJson(
        sortKeys(rows.eligibility as unknown as LeaveInEligibilityKey[]),
      ) !== stableCatalogEnrichmentJson(expected.projected_eligibility)
    )
      mismatches.push("product_leave_in_eligibility set")
    if (!same(rows.product?.suitable_thicknesses, expected.projected_suitable_thicknesses))
      mismatches.push("products.suitable_thicknesses")
    products.push({
      product_key: expected.product_key,
      product_id: expected.product_id,
      ok: mismatches.length === 0,
      mismatches,
    })
  }
  return {
    mode: "verify",
    writes: false,
    batch_id: LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID,
    ok: products.every((product) => product.ok),
    products,
  }
}
