import { createHash } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { join, resolve } from "node:path"

import {
  catalogEnrichmentFingerprint,
  generateCatalogEnrichmentIndex,
  stableCatalogEnrichmentJson,
  validateCatalogEnrichmentManifest,
  type CatalogEnrichmentManifest,
} from "./index"

export const HEAT_SCHEMA_VERSION = "personal-plan-catalog-enrichment-heat-v1" as const
export const HEAT_BATCH_ID = "personal-plan-heat-launch-v1" as const
export const HEAT_SOURCE_BATCH_ID = "personal-plan-launch-v1" as const
export const HEAT_COHORT_INDEX_FINGERPRINT =
  "f4edd43d54f9604b6287a86e5187a18bd44b4084260b0458ccbcde56cb6ee5f7" as const
export const HEAT_EXPECTED_KEYS = {
  heat: [
    "balea-two-phase-200ml",
    "balea-ultralight-200ml",
    "got2b-schutzengel-200ml",
    "jean-len-beat-the-heat-100ml",
    "loreal-elvital-dream-length-defeat-the-heat-150ml",
    "taft-aloe-boost-hydra-protect-150ml",
    "taft-gliss-lovely-long-150ml",
  ],
} as const
export const HEAT_IDENTITY = {
  "balea-two-phase-200ml": {
    brandId: "58bcafd6-a884-4337-8c8d-8d8369f2117c",
    brandName: "Balea",
    lineId: null,
    lineName: null,
  },
  "balea-ultralight-200ml": {
    brandId: "58bcafd6-a884-4337-8c8d-8d8369f2117c",
    brandName: "Balea",
    lineId: null,
    lineName: null,
  },
  "got2b-schutzengel-200ml": {
    brandId: "a286e2c2-6b44-41f3-a37b-f57d4ed1e93c",
    brandName: "got2b",
    lineId: null,
    lineName: null,
  },
  "jean-len-beat-the-heat-100ml": {
    brandId: "d1a06eff-1c23-472e-908e-f5364edb1bec",
    brandName: "Jean&Len",
    lineId: null,
    lineName: null,
  },
  "loreal-elvital-dream-length-defeat-the-heat-150ml": {
    brandId: "525123e1-1376-4fca-91b0-4eeb99c0bc50",
    brandName: "L'Oréal Paris",
    lineId: "424f3e04-4a35-4b52-a23a-a33c06b996b7",
    lineName: "Elvital Dream Length",
  },
  "taft-aloe-boost-hydra-protect-150ml": {
    brandId: "7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1",
    brandName: "taft",
    lineId: "4cfd54ce-fd3f-4d5a-a06d-ff4b74163480",
    lineName: "Aloe Boost",
  },
  "taft-gliss-lovely-long-150ml": {
    brandId: "7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1",
    brandName: "taft",
    lineId: "33bb265a-f7a5-4fce-a2bb-9d6d1b24d9cf",
    lineName: "taft x Gliss Lovely Long",
  },
} as const

const HEAT_EXPECTED_KEY_LIST = [...HEAT_EXPECTED_KEYS.heat].sort()
const HEAT_UNAVAILABLE_KEYS = new Set([
  "balea-two-phase-200ml",
  "taft-aloe-boost-hydra-protect-150ml",
])

type UnknownRecord = Record<string, unknown>
export type HEATPackageProduct = {
  product_key: string
  content_fingerprint: string
  category_key: string
  product: UnknownRecord
  image_asset: UnknownRecord
  identifiers: UnknownRecord[]
  heat_spec: UnknownRecord
  protocols: UnknownRecord[]
}
export type HEATPackage = {
  schema_version: typeof HEAT_SCHEMA_VERSION
  batch_id: typeof HEAT_BATCH_ID
  cohort_index_fingerprint: string
  products: HEATPackageProduct[]
}

export function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}
export function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex")
}
export function buildHeatPackage(
  input: Pick<HEATPackage, "batch_id" | "cohort_index_fingerprint" | "products">,
) {
  if (input.batch_id !== HEAT_BATCH_ID) throw new Error(`unknown Heat batch: ${input.batch_id}`)
  if (input.cohort_index_fingerprint !== HEAT_COHORT_INDEX_FINGERPRINT)
    throw new Error("Heat index fingerprint does not match the approved cohort")
  const products = [...input.products].sort((a, b) => a.product_key.localeCompare(b.product_key))
  if (
    products.length !== 7 ||
    products.map((product) => product.product_key).join("\n") !== HEAT_EXPECTED_KEY_LIST.join("\n")
  )
    throw new Error("Heat package must contain the exact 7 approved product keys")
  for (const product of products) {
    if (!product.product_key || !/^[a-f0-9]{64}$/.test(product.content_fingerprint))
      throw new Error("Heat product key and content fingerprint are required")
    if (!product.heat_spec || product.category_key !== "heat_protectant")
      throw new Error(`Heat category mismatch: ${product.product_key}`)
    if (product.product.is_chaarlie_recommended !== !HEAT_UNAVAILABLE_KEYS.has(product.product_key))
      throw new Error(`Heat recommendation mismatch: ${product.product_key}`)
  }
  const indexFingerprint = catalogEnrichmentFingerprint({
    schema_version: "personal-plan-launch-v1",
    products: products.map(({ product_key, content_fingerprint }) => ({
      product_key,
      content_fingerprint,
    })),
  })
  if (indexFingerprint !== HEAT_COHORT_INDEX_FINGERPRINT)
    throw new Error("Heat item fingerprints do not match the approved cohort index")
  const pkg: HEATPackage = {
    schema_version: HEAT_SCHEMA_VERSION,
    batch_id: HEAT_BATCH_ID,
    cohort_index_fingerprint: input.cohort_index_fingerprint,
    products,
  }
  const canonical_json = stableCatalogEnrichmentJson(pkg)
  return { package: pkg, canonical_json, fingerprint: sha256Utf8(canonical_json) }
}

export type HEATReadAdapter = {
  list: (table: string, offset: number, limit: number) => Promise<UnknownRecord[]>
  object: (bucket: string, path: string) => Promise<Uint8Array | null>
  hasTables?: (tables: readonly string[]) => Promise<string[]>
  migrationState?: (migration: string) => Promise<"absent" | "applied">
}
export type HeatReleaseContext = {
  reviewedHead: string
  projectId: string
  expectMigration: "absent" | "applied"
}
export const HEAT_MIGRATION = "20260810090000_catalog_enrichment_personal_plan_heat_v1_executor"
export const HEAT_SUPABASE_PROJECT_ID = "pqdkhefxsxkyeqelqegq"
export const HEAT_PUBLIC_SUPABASE_URL = "https://pqdkhefxsxkyeqelqegq.supabase.co"
export const HEAT_PACKAGE_FINGERPRINT =
  "b7b0148bdf59c723c15e7af0627c3acf8a8ff04fdf261d2fe6ad825cdf3ce91a"
export function heatProjectIdFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1] ?? null
  } catch {
    return null
  }
}
export async function readAllPages(
  read: Pick<HEATReadAdapter, "list">,
  table: string,
  pageSize = 100,
): Promise<UnknownRecord[]> {
  const all: UnknownRecord[] = []
  for (let offset = 0; ; offset += pageSize) {
    const page = await read.list(table, offset, pageSize)
    all.push(...page)
    if (page.length < pageSize) return all
  }
}

export type HEATPreflight = {
  ok: boolean
  blockers: string[]
  package?: ReturnType<typeof buildHeatPackage>
  cohort_index_fingerprint?: string
  release_context: HeatReleaseContext
  migration_state?: "absent" | "applied"
}
const requiredTables = [
  "products",
  "brands",
  "brand_aliases",
  "product_lines",
  "product_categories",
  "product_image_assets",
  "product_identifiers",
  "product_heat_protectant_specs",
  "product_application_protocols",
  "catalog_enrichment_applied_items",
] as const

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {}
}
function getFinal(manifest: UnknownRecord) {
  return record(record(manifest.product_payload).final)
}
function getProduct(manifest: UnknownRecord) {
  return record(getFinal(manifest).product)
}
function getImage(manifest: UnknownRecord) {
  return record(manifest.image)
}
function normalized(value: unknown) {
  return String(value ?? "")
    .toLocaleLowerCase("en")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}
function normalizedIdentifier(type: unknown, value: unknown) {
  const input = String(value ?? "")
    .trim()
    .toLocaleLowerCase("en")
  return ["ean", "gtin", "barcode"].includes(String(type ?? "").toLocaleLowerCase("en"))
    ? input.replace(/[^a-z0-9]+/g, "")
    : input.replace(/\s+/g, "")
}
function identifierSourceFallback(source: UnknownRecord): string {
  const url = String(source.url ?? "")
  try {
    const host = new URL(url).hostname.replace(/^www\./, "")
    const retailer = ["dm.de", "rossmann.de", "flaconi.de"].find(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    )
    if (retailer) return retailer.split(".")[0]!
  } catch {
    /* the manifest validator reports malformed source URLs */
  }
  return source.type === "manufacturer" ? "manufacturer" : "curated"
}
function isEnabledCategory(row: UnknownRecord, category: string) {
  return (
    String(row.key ?? row.category_key) === category &&
    row.is_catalog_supported === true &&
    row.is_intake_supported === true
  )
}
export function resolveHeatIdentity(key: string, brands: UnknownRecord[], lines: UnknownRecord[]) {
  const expected = HEAT_IDENTITY[key as keyof typeof HEAT_IDENTITY]
  if (!expected) return { error: `unknown approved identity: ${key}` }
  const brand = brands.filter(
    (row) =>
      String(row.id) === expected.brandId && String(row.canonical_name) === expected.brandName,
  )
  if (brand.length !== 1) return { error: `canonical brand identity mismatch: ${key}` }
  if (!expected.lineId) return { brand_id: expected.brandId, product_line_id: null }
  const line = lines.filter(
    (row) =>
      String(row.id) === expected.lineId &&
      String(row.brand_id) === expected.brandId &&
      String(row.canonical_name) === expected.lineName,
  )
  return line.length === 1
    ? { brand_id: expected.brandId, product_line_id: expected.lineId }
    : { error: `canonical product line identity mismatch: ${key}` }
}

export async function loadHeatManifests(root = "data/catalog-enrichment/personal-plan-launch-v1") {
  const result: Array<{
    group: "heat"
    manifest: CatalogEnrichmentManifest
    bytes: Uint8Array
  }> = []
  for (const group of ["heat"] as const) {
    for (const name of (await readdir(join(root, group)))
      .filter((name) => name.endsWith(".json"))
      .sort()) {
      const bytes = await readFile(join(root, group, name))
      result.push({
        group,
        manifest: JSON.parse(bytes.toString("utf8")) as CatalogEnrichmentManifest,
        bytes,
      })
    }
  }
  return result
}

export async function preflightHeat(options: {
  read: HEATReadAdapter
  release: HeatReleaseContext
  root?: string
  now?: Date
  commercialMaxAgeMs?: number
  cwd?: string
  publicSupabaseUrl?: string
  gitState?: () => Promise<{ head: string; clean: boolean }>
  mode?: "pre_apply" | "post_apply"
}): Promise<HEATPreflight> {
  const blockers: string[] = []
  const { release } = options
  if (!/^[a-f0-9]{40}$/.test(release.reviewedHead)) blockers.push("invalid reviewed head")
  if (release.projectId !== HEAT_SUPABASE_PROJECT_ID) blockers.push("Supabase project mismatch")
  const gitState = options.gitState ? await options.gitState() : undefined
  if (!gitState) blockers.push("missing current git state capability")
  else if (gitState.head !== release.reviewedHead)
    blockers.push("reviewed head does not equal current git HEAD")
  else if (!gitState.clean) blockers.push("current git worktree is not clean")
  const migration_state = options.read.migrationState
    ? await options.read.migrationState(HEAT_MIGRATION)
    : undefined
  if (!migration_state) blockers.push("missing migration-state capability")
  else if (migration_state !== release.expectMigration)
    blockers.push(
      `Heat migration state mismatch: expected ${release.expectMigration}, got ${migration_state}`,
    )
  const root = options.root ?? "data/catalog-enrichment/personal-plan-launch-v1"
  const manifests = await loadHeatManifests(root)
  const expected = new Set<string>([...HEAT_EXPECTED_KEYS.heat])
  const seen = new Set(manifests.map(({ manifest }) => manifest.product_key))
  if (
    seen.size !== 7 ||
    [...expected].some((key) => !seen.has(key)) ||
    [...seen].some((key) => !expected.has(key))
  )
    blockers.push("approved Heat cohort must be exactly 7 product keys")
  const valid = manifests.map(({ manifest }) => validateCatalogEnrichmentManifest(manifest))
  for (const [index, validation] of valid.entries())
    if (!validation.ok)
      blockers.push(
        `invalid cohort manifest ${manifests[index]?.manifest.product_key}: ${validation.errors.join("; ")}`,
      )
  const index = generateCatalogEnrichmentIndex(manifests.map(({ manifest }) => manifest))
  const cohort_index_fingerprint = catalogEnrichmentFingerprint(index)
  if (cohort_index_fingerprint !== HEAT_COHORT_INDEX_FINGERPRINT)
    blockers.push("cohort index fingerprint does not match the approved Heat cohort")
  const tables =
    release.expectMigration === "applied"
      ? requiredTables
      : requiredTables.filter((table) => table !== "catalog_enrichment_applied_items")
  const missingTables = options.read.hasTables ? await options.read.hasTables(tables) : []
  if (missingTables.length)
    blockers.push(`missing required Heat schema/table: ${missingTables.sort().join(", ")}`)
  const publicBase = (
    options.publicSupabaseUrl ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    ""
  ).replace(/\/$/, "")
  if (publicBase !== HEAT_PUBLIC_SUPABASE_URL) blockers.push("public Supabase base URL mismatch")
  const [products, identifiers, brandRows, productLines, categories] = await Promise.all([
    readAllPages(options.read, "products"),
    readAllPages(options.read, "product_identifiers"),
    readAllPages(options.read, "brands"),
    readAllPages(options.read, "product_lines"),
    readAllPages(options.read, "product_categories"),
  ])
  const now = (options.now ?? new Date()).getTime()
  const maxAge = options.commercialMaxAgeMs ?? 1000 * 60 * 60 * 24 * 7
  const packageProducts: HEATPackageProduct[] = []
  for (const [manifestIndex, { manifest }] of manifests.entries()) {
    const finalPayload = getFinal(manifest)
    const product = getProduct(manifest)
    const image = getImage(manifest)
    const checkedAt = String(
      record(manifest.commercial).checked_at ?? product.price_checked_at ?? "",
    )
    if (!Number.isFinite(Date.parse(checkedAt)) || now - Date.parse(checkedAt) > maxAge)
      blockers.push(`stale commercial observation: ${manifest.product_key}`)
    const resolved = resolveHeatIdentity(manifest.product_key, brandRows, productLines)
    if ("error" in resolved && resolved.error) blockers.push(resolved.error)
    const category = String(product.category_key)
    if (!categories.some((row) => isEnabledCategory(row, category)))
      blockers.push(`category readiness missing or disabled: ${category}`)
    const matching = products.filter(
      (row) =>
        String(row.brand_id) === ("brand_id" in resolved ? resolved.brand_id : "") &&
        normalized(row.name) === normalized(product.clean_name) &&
        String(row.category_key) === category,
    )
    if (matching.length && options.mode !== "post_apply")
      blockers.push(`exact product duplicate: ${manifest.product_key}`)
    const manifestIds = Array.isArray(finalPayload.identifiers) ? finalPayload.identifiers : []
    if (
      options.mode !== "post_apply" &&
      manifestIds.some((id) =>
        identifiers.some(
          (existing) =>
            String(existing.identifier_type) === String(record(id).type) &&
            normalizedIdentifier(existing.identifier_type, existing.identifier_value) ===
              normalizedIdentifier(record(id).type, record(id).value),
        ),
      )
    )
      blockers.push(`identifier duplicate: ${manifest.product_key}`)
    const path = String(image.expected_storage_path)
    const local = await readFile(
      resolve(options.cwd ?? process.cwd(), String(image.local_asset_path)),
    ).catch(() => null)
    if (!local) blockers.push(`missing local final image: ${manifest.product_key}`)
    else if (sha256Bytes(local) !== String(image.final_sha256))
      blockers.push(`local final image SHA mismatch: ${manifest.product_key}`)
    const remote = await options.read.object("product-images", path)
    if (remote && sha256Bytes(remote) !== String(image.final_sha256))
      blockers.push(`Storage object SHA mismatch: ${path}`)
    const categoryPayload = record(manifest.category_payload)
    const sources = Array.isArray(manifest.sources) ? manifest.sources.map(record) : []
    const sourcePage = String(image.source_page_url || sources[0]?.url || "")
    const source =
      sources.find((candidate) => String(candidate.url) === sourcePage) ?? sources[0] ?? {}
    if (!sourcePage) blockers.push(`missing image source page: ${manifest.product_key}`)
    const sourceType =
      source.type === "manufacturer" ? "brand" : source.type === "retailer" ? "retailer" : "unknown"
    const common: Omit<HEATPackageProduct, "heat_spec"> = {
      product_key: manifest.product_key,
      content_fingerprint: valid[manifestIndex]?.ok
        ? valid[manifestIndex].content_fingerprint
        : "invalid",
      category_key: category,
      product: {
        name: product.clean_name,
        brand: product.canonical_brand,
        category,
        category_key: category,
        affiliate_link: product.affiliate_link,
        image_url: `${publicBase}/storage/v1/object/public/product-images/${path}`,
        price_eur: product.price_eur,
        currency: product.currency,
        purchase_link_status: product.purchase_link_status,
        purchase_link_checked_at: product.purchase_link_checked_at,
        price_checked_at: product.price_checked_at,
        brand_id: "brand_id" in resolved ? resolved.brand_id : null,
        product_line_id: "product_line_id" in resolved ? resolved.product_line_id : null,
        origin: "curated",
        is_active: true,
        lifecycle_status: "active",
        is_chaarlie_recommended: record(manifest.catalog_state).is_chaarlie_recommended,
      },
      image_asset: {
        storage_bucket: "product-images",
        storage_path: path,
        public_url: `${publicBase}/storage/v1/object/public/product-images/${path}`,
        source_page_url: sourcePage,
        source_image_url: null,
        source_type: sourceType,
        quality_confidence: "high",
        processing_method: "local",
        asset_sha256: image.final_sha256,
        manifest_batch_id: HEAT_SOURCE_BATCH_ID,
        user_approved: true,
        notes: "Approved Heat final asset",
      },
      identifiers: manifestIds.map((identifier) => {
        const value = record(identifier)
        return { ...value, source: value.source ?? identifierSourceFallback(source) }
      }),
      protocols: Array.isArray(categoryPayload.product_application_protocols)
        ? categoryPayload.product_application_protocols.map(record)
        : [],
    }
    packageProducts.push({
      ...common,
      heat_spec: record(categoryPayload.product_heat_protectant_specs),
    })
  }
  if (packageProducts.filter((item) => item.product.is_chaarlie_recommended === true).length !== 5)
    blockers.push("Heat recommendation state must be exactly 5 true and 2 false")
  if (blockers.length === 0) {
    const approvedPackage = buildHeatPackage({
      batch_id: HEAT_BATCH_ID,
      cohort_index_fingerprint,
      products: packageProducts,
    })
    if (approvedPackage.fingerprint !== HEAT_PACKAGE_FINGERPRINT)
      blockers.push("resolved Heat package fingerprint does not match the approved release")
    else
      return {
        ok: true,
        blockers,
        cohort_index_fingerprint,
        release_context: release,
        migration_state,
        package: approvedPackage,
      }
  }
  return {
    ok: false,
    blockers,
    cohort_index_fingerprint,
    release_context: release,
    migration_state,
  }
}

export type HEATApplyArgs = {
  apply: boolean
  confirm: boolean
  confirm_batch?: string
  reviewed_by?: string
  reviewed_head?: string
  expect_migration?: "absent" | "applied"
  expected_batch_fingerprint?: string
  expected_content_fingerprint?: string
}
export function assertHeatBatchSelection(argv: readonly string[]): void {
  const inline = argv.find((arg) => arg.startsWith("--batch="))?.slice("--batch=".length)
  const index = argv.indexOf("--batch")
  const selected = inline ?? (index >= 0 ? argv[index + 1] : undefined)
  if (selected !== HEAT_BATCH_ID) throw new Error(`Heat command requires --batch ${HEAT_BATCH_ID}`)
}
export function parseHeatApplyArgs(argv: readonly string[]): HEATApplyArgs {
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
  const result: HEATApplyArgs = {
    apply: flags.apply === true,
    confirm: flags.confirm === true,
    confirm_batch: typeof flags["confirm-batch"] === "string" ? flags["confirm-batch"] : undefined,
    reviewed_by: typeof flags["reviewed-by"] === "string" ? flags["reviewed-by"] : undefined,
    reviewed_head: typeof flags["reviewed-head"] === "string" ? flags["reviewed-head"] : undefined,
    expect_migration:
      flags["expect-migration"] === "absent" || flags["expect-migration"] === "applied"
        ? flags["expect-migration"]
        : undefined,
    expected_batch_fingerprint:
      typeof flags["expected-batch-fingerprint"] === "string"
        ? flags["expected-batch-fingerprint"]
        : undefined,
    expected_content_fingerprint:
      typeof flags["expected-content-fingerprint"] === "string"
        ? flags["expected-content-fingerprint"]
        : undefined,
  }
  if (
    result.apply &&
    (!result.confirm ||
      result.confirm_batch !== HEAT_BATCH_ID ||
      result.reviewed_by !== "nick" ||
      !result.reviewed_head ||
      !/^[a-f0-9]{40}$/.test(result.reviewed_head) ||
      result.expect_migration !== "applied" ||
      !result.expected_batch_fingerprint ||
      !result.expected_content_fingerprint)
  )
    throw new Error(
      `Heat apply requires --apply --confirm --confirm-batch ${HEAT_BATCH_ID} --reviewed-by nick --reviewed-head <40-char-sha> --expect-migration=applied --expected-batch-fingerprint and --expected-content-fingerprint`,
    )
  if (
    result.apply &&
    (result.expected_batch_fingerprint !== HEAT_PACKAGE_FINGERPRINT ||
      result.expected_content_fingerprint !== HEAT_COHORT_INDEX_FINGERPRINT)
  )
    throw new Error("Heat apply fingerprints must match the approved lowercase SHA-256 contract")
  return result
}

export type HEATWriteAdapter = {
  upload: (bucket: string, path: string, bytes: Uint8Array) => Promise<void>
  object: (bucket: string, path: string) => Promise<Uint8Array | null>
  rpc: (
    name: "apply_catalog_enrichment_personal_plan_heat_v1",
    args: { p_batch_json: string; p_expected_batch_fingerprint: string; p_reviewed_by: "nick" },
  ) => Promise<void>
}

/**
 * The only mutation surface in Heat.  It intentionally exposes neither tables nor
 * arbitrary RPC names: the database worker remains the single transactional writer.
 */
export async function applyHeat(options: {
  args: HEATApplyArgs
  preflight: HEATPreflight
  preflightInput: Omit<Parameters<typeof preflightHeat>[0], "release">
  images: ReadonlyArray<{ path: string; bytes: Uint8Array; sha256: string }>
  write: HEATWriteAdapter
}) {
  const { args, preflight, images, write } = options
  if (!args.apply)
    return { applied: false as const, reason: "dry-run", uploaded_paths: [] as string[] }
  const rerun = await preflightHeat({
    ...options.preflightInput,
    release: preflight.release_context,
  })
  if (
    !preflight.ok ||
    !preflight.package ||
    !rerun.ok ||
    !rerun.package ||
    JSON.stringify(rerun.release_context) !== JSON.stringify(preflight.release_context) ||
    rerun.package.fingerprint !== preflight.package.fingerprint ||
    rerun.cohort_index_fingerprint !== preflight.cohort_index_fingerprint ||
    args.expected_batch_fingerprint !== preflight.package.fingerprint ||
    args.expected_content_fingerprint !== preflight.cohort_index_fingerprint
  )
    throw new Error("Heat apply guard rejected preflight drift")
  const expectedImages = new Map(
    preflight.package.package.products.map((item) => [
      String(item.image_asset.storage_path),
      String(item.image_asset.asset_sha256),
    ]),
  )
  if (
    images.length !== 7 ||
    new Set(images.map((image) => image.path)).size !== 7 ||
    images.some((image) => expectedImages.get(image.path) !== image.sha256) ||
    [...expectedImages.keys()].some((path) => !images.some((image) => image.path === path))
  )
    throw new Error("Heat apply images must exactly match the 7 resolved package paths and hashes")
  if (images.some((image) => !/^[a-f0-9]{64}$/.test(image.sha256)))
    throw new Error("Heat apply image hash must be lowercase SHA-256")
  const uploaded_paths: string[] = []
  for (const image of images) {
    if (sha256Bytes(image.bytes) !== image.sha256)
      throw new Error(`local image SHA mismatch: ${image.path}`)
    const existing = await write.object("product-images", image.path)
    if (existing) {
      if (sha256Bytes(existing) !== image.sha256)
        throw new Error(`existing Storage object SHA mismatch: ${image.path}`)
      continue
    }
    await write.upload("product-images", image.path, image.bytes)
    const verified = await write.object("product-images", image.path)
    if (!verified || sha256Bytes(verified) !== image.sha256)
      throw new Error(`uploaded Storage object verification failed: ${image.path}`)
    uploaded_paths.push(image.path)
  }
  try {
    await write.rpc("apply_catalog_enrichment_personal_plan_heat_v1", {
      p_batch_json: preflight.package.canonical_json,
      p_expected_batch_fingerprint: preflight.package.fingerprint,
      p_reviewed_by: "nick",
    })
  } catch (error) {
    const suffix = uploaded_paths.length
      ? ` Newly uploaded unreferenced paths: ${uploaded_paths.join(", ")}`
      : ""
    throw new Error(`apply_catalog_enrichment_personal_plan_heat_v1 failed.${suffix}`, {
      cause: error,
    })
  }
  return { applied: true as const, uploaded_paths }
}

function comparableValue(key: string, value: unknown): unknown {
  if (value === undefined) return null
  if (key.endsWith("_at") && typeof value === "string" && Number.isFinite(Date.parse(value)))
    return new Date(value).toISOString()
  if (Array.isArray(value)) return value.map((entry) => comparableValue("", entry))
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as UnknownRecord).map(([nestedKey, nested]) => [
        nestedKey,
        comparableValue(nestedKey, nested),
      ]),
    )
  return value
}

function projectedRowMatches(actual: UnknownRecord, expected: UnknownRecord): boolean {
  return mismatchedProjectedKeys(actual, expected).length === 0
}

function mismatchedProjectedKeys(actual: UnknownRecord, expected: UnknownRecord): string[] {
  return Object.entries(expected)
    .filter(
      ([key, value]) =>
        stableCatalogEnrichmentJson(comparableValue(key, actual[key])) !==
        stableCatalogEnrichmentJson(comparableValue(key, value)),
    )
    .map(([key]) => key)
}

function projectedRowsMatch(actual: UnknownRecord[], expected: UnknownRecord[]): boolean {
  const actualCanonical = actual.map((row) => stableCatalogEnrichmentJson(row)).sort()
  const expectedCanonical = expected.map((row) => stableCatalogEnrichmentJson(row)).sort()
  return (
    stableCatalogEnrichmentJson(actualCanonical) === stableCatalogEnrichmentJson(expectedCanonical)
  )
}

export async function verifyHeatRelations(
  read: Pick<HEATReadAdapter, "list" | "object">,
  expected: ReturnType<typeof buildHeatPackage>,
) {
  const errors: string[] = []
  const [products, assets, identifiers, heatSpecs, protocols, ledger] = await Promise.all([
    readAllPages(read, "products"),
    readAllPages(read, "product_image_assets"),
    readAllPages(read, "product_identifiers"),
    readAllPages(read, "product_heat_protectant_specs"),
    readAllPages(read, "product_application_protocols"),
    readAllPages(read, "catalog_enrichment_applied_items"),
  ])
  const expectedKeys = expected.package.products.map((item) => item.product_key).sort()
  const batchLedger = ledger.filter((row) => String(row.batch_id) === HEAT_BATCH_ID)
  if (
    batchLedger.length !== 7 ||
    batchLedger
      .map((row) => String(row.product_key))
      .sort()
      .join("\n") !== expectedKeys.join("\n")
  )
    errors.push("ledger batch must contain exactly the approved 7 product keys")
  for (const item of expected.package.products) {
    const product = products.filter(
      (row) =>
        normalized(row.name) === normalized(item.product.name) &&
        String(row.brand_id) === String(item.product.brand_id) &&
        String(row.category_key) === item.category_key,
    )
    if (product.length !== 1) {
      errors.push(`product relation missing or duplicate: ${item.product_key}`)
      continue
    }
    const row = product[0]!
    for (const key of mismatchedProjectedKeys(row, item.product))
      errors.push(`product value mismatch ${key}: ${item.product_key}`)
    const id = String(row.id)
    const asset = assets.filter((candidate) => String(candidate.product_id) === id)
    if (asset.length !== 1 || !projectedRowMatches(asset[0] ?? {}, item.image_asset))
      errors.push(`image asset relation mismatch: ${item.product_key}`)
    const actualIdentifiers = identifiers
      .filter((candidate) => String(candidate.product_id) === id)
      .map((candidate) => ({
        type: candidate.identifier_type,
        value: candidate.identifier_value,
        source: candidate.source,
      }))
    if (!projectedRowsMatch(actualIdentifiers, item.identifiers))
      errors.push(`identifier relation mismatch: ${item.product_key}`)
    const actualHeatSpecs = heatSpecs.filter((candidate) => String(candidate.product_id) === id)
    if (
      actualHeatSpecs.length !== 1 ||
      !projectedRowMatches(actualHeatSpecs[0] ?? {}, item.heat_spec)
    )
      errors.push(`heat spec relation mismatch: ${item.product_key}`)
    const actualProtocols = protocols
      .filter((candidate) => String(candidate.product_id) === id)
      .map((candidate) =>
        Object.fromEntries(
          Object.keys(item.protocols[0] ?? {}).map((key) => [
            key,
            comparableValue(key, candidate[key]),
          ]),
        ),
      )
    const expectedProtocols = item.protocols.map((protocol) =>
      Object.fromEntries(
        Object.entries(protocol).map(([key, value]) => [key, comparableValue(key, value)]),
      ),
    )
    if (!projectedRowsMatch(actualProtocols, expectedProtocols))
      errors.push(`protocol relation mismatch: ${item.product_key}`)
    const applied = batchLedger.filter(
      (candidate) =>
        String(candidate.product_key) === item.product_key &&
        String(candidate.product_id) === id &&
        String(candidate.batch_fingerprint) === expected.fingerprint &&
        String(candidate.content_fingerprint) === item.content_fingerprint &&
        String(candidate.reviewed_by) === "nick",
    )
    if (applied.length !== 1) errors.push(`ledger relation mismatch: ${item.product_key}`)
    const bytes = await read.object("product-images", String(item.image_asset.storage_path))
    if (!bytes || sha256Bytes(bytes) !== String(item.image_asset.asset_sha256))
      errors.push(`Storage hash mismatch: ${item.product_key}`)
  }
  return { ok: errors.length === 0, errors }
}
