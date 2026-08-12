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

type UnknownRecord = Record<string, unknown>

export const SCALP_SCHEMA_VERSION = "personal-plan-catalog-enrichment-scalp-v1" as const
export const SCALP_BATCH_ID = "personal-plan-scalp-launch-v1" as const
export const SCALP_SOURCE_BATCH_ID = "personal-plan-launch-v1" as const
export const SCALP_COHORT_INDEX_FINGERPRINT =
  "8ed553db305cf715058eece4b364565b3552df2505516657c9d2cf67437aa01f" as const
export const SCALP_EXPECTED_KEYS = {
  scalp: [
    "balea-professional-aha-scalp-peeling",
    "balea-professional-sensitive-scalp-serum",
    "eucerin-dermocapillaire-urea-intensive-tonic",
    "gliss-scalp-balance-clarifying-serum",
    "head-shoulders-derma-x-pro-scalp-leave-in",
    "isana-professional-aha-pha-scalp-peeling",
    "loreal-elvital-fiber-booster-scalp-serum",
    "the-ordinary-multi-peptide-hair-density-serum",
  ],
} as const

/** Live identities; historical B1 UUIDs are retained only as deterministic IDs. */
export const SCALP_IDENTITY = {
  "balea-professional-aha-scalp-peeling": {
    brandId: "58bcafd6-a884-4337-8c8d-8d8369f2117c",
    brandName: "Balea",
    lineId: "7acc1a31-fe34-4e3a-8ee9-634a0761943c",
    lineName: "Professional",
  },
  "balea-professional-sensitive-scalp-serum": {
    brandId: "58bcafd6-a884-4337-8c8d-8d8369f2117c",
    brandName: "Balea",
    lineId: "7acc1a31-fe34-4e3a-8ee9-634a0761943c",
    lineName: "Professional",
  },
  "eucerin-dermocapillaire-urea-intensive-tonic": {
    brandId: "eb2c78a1-bb96-4d64-9fb3-4e2c0d0c2a01",
    brandName: "Eucerin",
    lineId: "be663588-e88c-48e2-ae10-cfd320ffd444",
    lineName: "DermoCapillaire Urea",
  },
  "gliss-scalp-balance-clarifying-serum": {
    brandId: "1c460ddf-75b8-4db6-9a33-748dfe7a5da0",
    brandName: "Gliss",
    lineId: "f1d4f755-ed3c-4762-a15e-8b905e3d1a8b",
    lineName: "Scalp Balance",
  },
  "head-shoulders-derma-x-pro-scalp-leave-in": {
    brandId: "354b561c-5a0f-400c-8d89-39bc7231876b",
    brandName: "Head & Shoulders",
    lineId: "ab40e16d-0fc1-44c5-b6c6-ae59f81ef7c8",
    lineName: "Derma X Pro",
  },
  "isana-professional-aha-pha-scalp-peeling": {
    brandId: "c3481711-82bb-436b-8ae8-654f013387c6",
    brandName: "Isana",
    lineId: "e117d1fb-1398-42da-9bcb-669b9696f6b1",
    lineName: "Professional",
  },
  "loreal-elvital-fiber-booster-scalp-serum": {
    brandId: "525123e1-1376-4fca-91b0-4eeb99c0bc50",
    brandName: "L'Oréal Paris",
    lineId: "cfb409a0-c4d3-4d8f-b605-69f23e68dd1a",
    lineName: "Elvital Fiber Booster",
  },
  "the-ordinary-multi-peptide-hair-density-serum": {
    brandId: "c7e8f24b-f765-4d2d-a0d9-45f0d6d2d4a9",
    brandName: "The Ordinary",
    lineId: null,
    lineName: null,
  },
} as const

/**
 * Only rows the Scalp migration owns. Existing live identities stay read-only
 * prerequisites; these fixed IDs make a collision fail closed at migration time.
 */
export const SCALP_MIGRATION_IDENTITY_SEEDS = {
  brands: [
    {
      id: "eb2c78a1-bb96-4d64-9fb3-4e2c0d0c2a01",
      canonical_name: "Eucerin",
      normalized_name: "eucerin",
    },
    {
      id: "354b561c-5a0f-400c-8d89-39bc7231876b",
      canonical_name: "Head & Shoulders",
      normalized_name: "head shoulders",
    },
    {
      id: "c7e8f24b-f765-4d2d-a0d9-45f0d6d2d4a9",
      canonical_name: "The Ordinary",
      normalized_name: "the ordinary",
    },
  ],
  lines: [
    {
      id: "be663588-e88c-48e2-ae10-cfd320ffd444",
      brand_id: "eb2c78a1-bb96-4d64-9fb3-4e2c0d0c2a01",
      canonical_name: "DermoCapillaire Urea",
      normalized_name: "dermocapillaire urea",
    },
    {
      id: "ab40e16d-0fc1-44c5-b6c6-ae59f81ef7c8",
      brand_id: "354b561c-5a0f-400c-8d89-39bc7231876b",
      canonical_name: "Derma X Pro",
      normalized_name: "derma x pro",
    },
    {
      id: "cfb409a0-c4d3-4d8f-b605-69f23e68dd1a",
      brand_id: "525123e1-1376-4fca-91b0-4eeb99c0bc50",
      canonical_name: "Elvital Fiber Booster",
      normalized_name: "elvital fiber booster",
    },
  ],
} as const

export const HEAT_MIGRATION =
  "20260810090000_catalog_enrichment_personal_plan_heat_v1_executor" as const
export const SCALP_MIGRATION =
  "20260811055932_catalog_enrichment_personal_plan_scalp_v1_executor" as const
export const SCALP_SUPABASE_PROJECT_ID = "pqdkhefxsxkyeqelqegq" as const
export const SCALP_PUBLIC_SUPABASE_URL = `https://${SCALP_SUPABASE_PROJECT_ID}.supabase.co` as const
export const SCALP_PACKAGE_FINGERPRINT =
  "e6cbbe9ce2dc3d3b29655741cfe7572dd29d8b5bb5bea1a7225fd58359328e50" as const
export const SCALP_MIGRATION_IDENTITY_SEED_FINGERPRINT =
  "1c00ecfe39b88940e81fecd93331eec4701ca4edac82afb9d030f78bbb15681b" as const
export const SCALP_MIGRATION_SEED_BLOCK_SHA256 =
  "91e2c668fc19c59499debeed2e3c28092abe131a9a9cea4366887db6e3fe3ae1" as const

export function scalpProjectIdFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1] ?? null
  } catch {
    return null
  }
}

const EXPECTED_KEYS = [...SCALP_EXPECTED_KEYS.scalp].sort()
const ALLOWED_ROLES = new Set([
  "scalp_exfoliant",
  "scalp_comfort",
  "scalp_flake_oil_adjunct",
  "density_claim_tonic",
])

export type SCALPPackageProduct = {
  product_key: string
  content_fingerprint: string
  category_key: "scalp_care"
  product: UnknownRecord
  image_asset: UnknownRecord
  identifiers: UnknownRecord[]
  scalp_spec: UnknownRecord
  protocols: UnknownRecord[]
}
export type SCALPPackage = {
  schema_version: typeof SCALP_SCHEMA_VERSION
  batch_id: typeof SCALP_BATCH_ID
  cohort_index_fingerprint: string
  products: SCALPPackageProduct[]
}

export function sha256Utf8(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}
export function sha256Bytes(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex")
}

export function normalizedScalpIdentifier(type: unknown, value: unknown): string {
  const normalizedType = String(type ?? "").toLowerCase()
  const input = String(value ?? "")
    .trim()
    .toLowerCase()
  // Matches the database normalizer for this reviewed ASCII-only cohort.
  return ["ean", "gtin", "barcode"].includes(normalizedType)
    ? input.replace(/[^a-z0-9]+/g, "")
    : input.replace(/\s+/g, "")
}

export function buildScalpPackage(
  input: Pick<SCALPPackage, "batch_id" | "cohort_index_fingerprint" | "products">,
) {
  if (input.batch_id !== SCALP_BATCH_ID) throw new Error(`unknown Scalp batch: ${input.batch_id}`)
  if (input.cohort_index_fingerprint !== SCALP_COHORT_INDEX_FINGERPRINT)
    throw new Error("Scalp index fingerprint does not match the approved cohort")
  const products = [...input.products].sort((a, b) => a.product_key.localeCompare(b.product_key))
  if (
    products.length !== 8 ||
    products.map((item) => item.product_key).join("\n") !== EXPECTED_KEYS.join("\n")
  )
    throw new Error("Scalp package must contain the exact 8 approved product keys")
  for (const item of products) {
    if (!/^[a-f0-9]{64}$/.test(item.content_fingerprint))
      throw new Error("Scalp content fingerprint is required")
    if (item.category_key !== "scalp_care" || !item.scalp_spec || "heat_spec" in item)
      throw new Error(`Scalp category/spec mismatch: ${item.product_key}`)
    if (item.product.is_chaarlie_recommended !== true)
      throw new Error(`Scalp recommendation mismatch: ${item.product_key}`)
    if (
      !item.identifiers.length ||
      item.identifiers.some((identifier) => !/^[a-z0-9][a-z0-9-]*$/.test(String(identifier.source)))
    )
      throw new Error(`Scalp identifier source mismatch: ${item.product_key}`)
    const specRole = String(item.scalp_spec.primary_role)
    if (
      !ALLOWED_ROLES.has(specRole) ||
      item.protocols.length !== 1 ||
      item.protocols.some(
        (p) =>
          String(p.category) !== "scalp_care" ||
          String(p.role) !== specRole ||
          !ALLOWED_ROLES.has(String(p.role)),
      )
    )
      throw new Error(`Scalp protocol role mismatch: ${item.product_key}`)
  }
  const index = catalogEnrichmentFingerprint({
    schema_version: "personal-plan-launch-v1",
    products: products.map(({ product_key, content_fingerprint }) => ({
      product_key,
      content_fingerprint,
    })),
  })
  if (index !== SCALP_COHORT_INDEX_FINGERPRINT)
    throw new Error("Scalp item fingerprints do not match the approved cohort index")
  const packageValue: SCALPPackage = {
    schema_version: SCALP_SCHEMA_VERSION,
    batch_id: SCALP_BATCH_ID,
    cohort_index_fingerprint: input.cohort_index_fingerprint,
    products,
  }
  const canonical_json = stableCatalogEnrichmentJson(packageValue)
  return { package: packageValue, canonical_json, fingerprint: sha256Utf8(canonical_json) }
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {}
}
function normalizedName(value: unknown) {
  return String(value ?? "")
    .toLocaleLowerCase("en")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}
function sourceFallback(source: UnknownRecord) {
  try {
    return (
      new URL(String(source.url ?? "")).hostname.replace(/^www\./, "").split(".")[0] || "curated"
    )
  } catch {
    return source.type === "manufacturer" ? "manufacturer" : "curated"
  }
}
function normalizedIdentifierSource(value: unknown, fallback: UnknownRecord) {
  const source = String(value ?? "")
    .trim()
    .toLowerCase()
  if (!source) return sourceFallback(fallback)
  if (source.includes("rossmann")) return "rossmann"
  if (source.includes("flaconi")) return "flaconi"
  if (source.includes("ordinary")) return "the-ordinary"
  if (source.includes("eucerin")) return "eucerin"
  if (source.includes("dm")) return source.includes("med") ? "dm-med" : "dm"
  if (source.includes("l'oreal") || source.includes("l’oréal")) return "loreal-paris"
  return source.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || sourceFallback(fallback)
}
function enabledCategory(row: UnknownRecord) {
  return (
    String(row.key ?? row.category_key) === "scalp_care" &&
    row.is_catalog_supported === true &&
    row.is_intake_supported === true
  )
}

function exactSeed(row: UnknownRecord, seed: UnknownRecord, fields: readonly string[]) {
  return fields.every((field) => String(row[field] ?? "") === String(seed[field] ?? ""))
}

export function scalpMigrationIdentitySeedBlockers(input: {
  brands: UnknownRecord[]
  lines: UnknownRecord[]
  migrationState: "absent" | "applied"
  migrationSql: string | null
}): string[] {
  const blockers: string[] = []
  if (
    catalogEnrichmentFingerprint(SCALP_MIGRATION_IDENTITY_SEEDS) !==
    SCALP_MIGRATION_IDENTITY_SEED_FINGERPRINT
  )
    blockers.push("Scalp identity seed definition fingerprint drift")
  const seedBlock = input.migrationSql?.match(/DO \$seeds\$[\s\S]*?\$seeds\$;/)?.[0] ?? null
  if (!seedBlock || sha256Utf8(seedBlock) !== SCALP_MIGRATION_SEED_BLOCK_SHA256)
    blockers.push("Scalp migration identity seed block drift")
  for (const seed of SCALP_MIGRATION_IDENTITY_SEEDS.brands) {
    const byId = input.brands.filter((row) => String(row.id) === seed.id)
    const byName = input.brands.filter(
      (row) =>
        String(row.normalized_name ?? normalizedName(row.canonical_name)) === seed.normalized_name,
    )
    const exact = byId.filter((row) =>
      exactSeed(row, seed, ["id", "canonical_name", "normalized_name"]),
    )
    if (byName.some((row) => String(row.id) !== seed.id))
      blockers.push(`Scalp identity seed collision: brand ${seed.canonical_name}`)
    if (byId.length > 1 || byName.length > 1)
      blockers.push(`Scalp identity seed partial state: brand ${seed.canonical_name}`)
    if (byId.some((row) => !exact.includes(row)))
      blockers.push(`Scalp identity seed mismatch: brand ${seed.canonical_name}`)
    if (exact.length !== 1 && input.migrationState === "applied")
      blockers.push(`Scalp identity seed missing after migration: brand ${seed.canonical_name}`)
  }
  for (const seed of SCALP_MIGRATION_IDENTITY_SEEDS.lines) {
    const byId = input.lines.filter((row) => String(row.id) === seed.id)
    const byName = input.lines.filter(
      (row) =>
        String(row.brand_id) === seed.brand_id &&
        String(row.normalized_name ?? normalizedName(row.canonical_name)) === seed.normalized_name,
    )
    const exact = byId.filter((row) =>
      exactSeed(row, seed, ["id", "brand_id", "canonical_name", "normalized_name"]),
    )
    if (byName.some((row) => String(row.id) !== seed.id))
      blockers.push(`Scalp identity seed collision: line ${seed.canonical_name}`)
    if (byId.length > 1 || byName.length > 1)
      blockers.push(`Scalp identity seed partial state: line ${seed.canonical_name}`)
    if (byId.some((row) => !exact.includes(row)))
      blockers.push(`Scalp identity seed mismatch: line ${seed.canonical_name}`)
    if (exact.length === 1 && !input.brands.some((row) => String(row.id) === seed.brand_id))
      blockers.push(`Scalp identity seed partial state: line ${seed.canonical_name} has no parent`)
    if (exact.length !== 1 && input.migrationState === "applied")
      blockers.push(`Scalp identity seed missing after migration: line ${seed.canonical_name}`)
  }
  return blockers
}

export function resolveScalpIdentity(
  key: string,
  brands: UnknownRecord[],
  lines: UnknownRecord[],
  migrationState: "absent" | "applied" = "applied",
) {
  const identity = SCALP_IDENTITY[key as keyof typeof SCALP_IDENTITY]
  if (!identity) return { error: `unknown approved identity: ${key}` }
  const brand = brands.filter(
    (row) =>
      String(row.id) === identity.brandId && String(row.canonical_name) === identity.brandName,
  )
  const seededBrand = SCALP_MIGRATION_IDENTITY_SEEDS.brands.some(
    (seed) => seed.id === identity.brandId,
  )
  if (brand.length !== 1 && !(migrationState === "absent" && seededBrand && brand.length === 0))
    return { error: `canonical brand identity mismatch: ${key}` }
  if (!identity.lineId) return { brand_id: identity.brandId, product_line_id: null }
  const line = lines.filter(
    (row) =>
      String(row.id) === identity.lineId &&
      String(row.brand_id) === identity.brandId &&
      String(row.canonical_name) === identity.lineName,
  )
  const seededLine = SCALP_MIGRATION_IDENTITY_SEEDS.lines.some(
    (seed) => seed.id === identity.lineId,
  )
  return line.length === 1 || (migrationState === "absent" && seededLine && line.length === 0)
    ? { brand_id: identity.brandId, product_line_id: identity.lineId }
    : { error: `canonical product line identity mismatch: ${key}` }
}

export async function loadScalpManifests(root = "data/catalog-enrichment/personal-plan-launch-v1") {
  const directory = join(root, "scalp")
  return Promise.all(
    (await readdir(directory))
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map(async (name) => {
        const bytes = await readFile(join(directory, name))
        return {
          group: "scalp" as const,
          manifest: JSON.parse(bytes.toString("utf8")) as CatalogEnrichmentManifest,
          bytes,
        }
      }),
  )
}

export type SCALPReadAdapter = {
  list: (table: string, offset: number, limit: number) => Promise<UnknownRecord[]>
  object: (bucket: string, path: string) => Promise<Uint8Array | null>
  hasTables?: (tables: readonly string[]) => Promise<string[]>
  migrationState?: (migration: string) => Promise<"absent" | "applied">
}
export async function readAllScalpPages(
  read: Pick<SCALPReadAdapter, "list">,
  table: string,
  pageSize = 100,
): Promise<UnknownRecord[]> {
  const result: UnknownRecord[] = []
  for (let offset = 0; ; offset += pageSize) {
    const page = await read.list(table, offset, pageSize)
    result.push(...page)
    if (page.length < pageSize) return result
  }
}
export type ScalpReleaseContext = {
  reviewedHead: string
  projectId: string
  expectScalpMigration: "absent" | "applied"
}
export type SCALPPreflight = {
  ok: boolean
  blockers: string[]
  package?: ReturnType<typeof buildScalpPackage>
  cohort_index_fingerprint?: string
  release_context: ScalpReleaseContext
  heat_migration_state?: "absent" | "applied"
  scalp_migration_state?: "absent" | "applied"
}

export async function preflightScalp(options: {
  read: SCALPReadAdapter
  release: ScalpReleaseContext
  root?: string
  cwd?: string
  now?: Date
  commercialMaxAgeMs?: number
  publicSupabaseUrl?: string
  gitState?: () => Promise<{ head: string; clean: boolean }>
  migrationSql?: () => Promise<string>
  mode?: "pre_apply" | "post_apply"
}): Promise<SCALPPreflight> {
  const blockers: string[] = []
  const { release } = options
  if (!/^[a-f0-9]{40}$/.test(release.reviewedHead)) blockers.push("invalid reviewed head")
  if (release.projectId !== SCALP_SUPABASE_PROJECT_ID) blockers.push("Supabase project mismatch")
  const git = options.gitState ? await options.gitState() : undefined
  if (!git) blockers.push("missing current git state capability")
  else if (git.head !== release.reviewedHead)
    blockers.push("reviewed head does not equal current git HEAD")
  else if (!git.clean) blockers.push("current git worktree is not clean")
  const heat_migration_state = options.read.migrationState
    ? await options.read.migrationState(HEAT_MIGRATION)
    : undefined
  const scalp_migration_state = options.read.migrationState
    ? await options.read.migrationState(SCALP_MIGRATION)
    : undefined
  if (heat_migration_state !== "applied") blockers.push("Heat migration must already be applied")
  if (!scalp_migration_state) blockers.push("missing migration-state capability")
  else if (scalp_migration_state !== release.expectScalpMigration)
    blockers.push(
      `Scalp migration state mismatch: expected ${release.expectScalpMigration}, got ${scalp_migration_state}`,
    )
  const required = [
    "products",
    "brands",
    "product_lines",
    "product_categories",
    "product_image_assets",
    "product_identifiers",
    "product_scalp_care_specs",
    "product_application_protocols",
    "catalog_enrichment_applied_items",
  ]
  const missing = options.read.hasTables ? await options.read.hasTables(required) : []
  if (missing.length)
    blockers.push(`missing required Scalp schema/table: ${missing.sort().join(", ")}`)
  const [manifests, products, identifiers, brands, lines, categories, ledger, migrationSql] =
    await Promise.all([
      loadScalpManifests(options.root),
      readAllScalpPages(options.read, "products"),
      readAllScalpPages(options.read, "product_identifiers"),
      readAllScalpPages(options.read, "brands"),
      readAllScalpPages(options.read, "product_lines"),
      readAllScalpPages(options.read, "product_categories"),
      readAllScalpPages(options.read, "catalog_enrichment_applied_items"),
      options.migrationSql
        ? options.migrationSql().catch(() => null)
        : readFile(
            resolve(options.cwd ?? process.cwd(), `supabase/migrations/${SCALP_MIGRATION}.sql`),
            "utf8",
          ).catch(() => null),
    ])
  if (scalp_migration_state)
    blockers.push(
      ...scalpMigrationIdentitySeedBlockers({
        brands,
        lines,
        migrationState: scalp_migration_state,
        migrationSql,
      }),
    )
  const keys = manifests.map(({ manifest }) => manifest.product_key).sort()
  if (keys.length !== 8 || keys.join("\n") !== EXPECTED_KEYS.join("\n"))
    blockers.push("approved Scalp cohort must be exactly 8 product keys")
  if (
    ledger.filter((row) => String(row.batch_id) === SCALP_BATCH_ID).length !== 0 &&
    options.mode !== "post_apply"
  )
    blockers.push("Scalp batch ledger must have zero rows before apply")
  const validations = manifests.map(({ manifest }) =>
    validateCatalogEnrichmentManifest(manifest, undefined, "legacy_personal_plan_launch_v1"),
  )
  validations.forEach((validation, index) => {
    if (!validation.ok)
      blockers.push(
        `invalid Scalp manifest ${manifests[index]?.manifest.product_key}: ${validation.errors.join("; ")}`,
      )
  })
  const cohort_index_fingerprint = catalogEnrichmentFingerprint(
    generateCatalogEnrichmentIndex(manifests.map(({ manifest }) => manifest)),
  )
  if (cohort_index_fingerprint !== SCALP_COHORT_INDEX_FINGERPRINT)
    blockers.push("cohort index fingerprint does not match the approved Scalp cohort")
  const now = (options.now ?? new Date()).getTime()
  const maxAge = options.commercialMaxAgeMs ?? 7 * 24 * 60 * 60 * 1000
  const publicBase = (
    options.publicSupabaseUrl ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    ""
  ).replace(/\/$/, "")
  if (publicBase !== SCALP_PUBLIC_SUPABASE_URL) blockers.push("public Supabase base URL mismatch")
  const packageProducts: SCALPPackageProduct[] = []
  for (let index = 0; index < manifests.length; index += 1) {
    const manifest = manifests[index]!.manifest as UnknownRecord
    const finalPayload = record(record(manifest.product_payload).final)
    const product = record(finalPayload.product)
    const image = record(manifest.image)
    const categoryPayload = record(manifest.category_payload)
    if (String(product.category_key) !== "scalp_care")
      blockers.push(`Scalp category mismatch: ${manifest.product_key}`)
    if (record(manifest.catalog_state).is_chaarlie_recommended !== true)
      blockers.push(`Scalp recommendation mismatch: ${manifest.product_key}`)
    const checkedAt = String(
      record(manifest.commercial).checked_at ?? product.price_checked_at ?? "",
    )
    if (!Number.isFinite(Date.parse(checkedAt)) || now - Date.parse(checkedAt) > maxAge)
      blockers.push(`stale commercial observation: ${manifest.product_key}`)
    const identity = resolveScalpIdentity(
      String(manifest.product_key),
      brands,
      lines,
      scalp_migration_state ?? release.expectScalpMigration,
    )
    if ("error" in identity && identity.error) blockers.push(identity.error)
    if (!categories.some(enabledCategory))
      blockers.push("category readiness missing or disabled: scalp_care")
    if (
      products.some(
        (row) =>
          String(row.brand_id) === ("brand_id" in identity ? identity.brand_id : "") &&
          String(row.category_key) === "scalp_care" &&
          normalizedName(row.name) === normalizedName(product.clean_name),
      ) &&
      options.mode !== "post_apply"
    )
      blockers.push(`exact product duplicate: ${manifest.product_key}`)
    const manifestIds = Array.isArray(finalPayload.identifiers)
      ? finalPayload.identifiers.map(record)
      : []
    if (
      options.mode !== "post_apply" &&
      manifestIds.some((id) =>
        identifiers.some(
          (existing) =>
            String(existing.identifier_type) === String(id.type) &&
            normalizedScalpIdentifier(existing.identifier_type, existing.identifier_value) ===
              normalizedScalpIdentifier(id.type, id.value),
        ),
      )
    )
      blockers.push(`identifier duplicate: ${manifest.product_key}`)
    const local = await readFile(
      resolve(options.cwd ?? process.cwd(), String(image.local_asset_path)),
    ).catch(() => null)
    if (!local) blockers.push(`missing local final image: ${manifest.product_key}`)
    else if (sha256Bytes(local) !== String(image.final_sha256))
      blockers.push(`local final image SHA mismatch: ${manifest.product_key}`)
    const path = String(image.expected_storage_path)
    const remote = await options.read.object("product-images", path)
    if (remote && sha256Bytes(remote) !== String(image.final_sha256))
      blockers.push(`Storage object SHA mismatch: ${path}`)
    const spec = record(categoryPayload.product_scalp_care_specs)
    const protocols = Array.isArray(categoryPayload.product_application_protocols)
      ? categoryPayload.product_application_protocols.map(record)
      : []
    const role = String(spec.primary_role)
    if (
      !ALLOWED_ROLES.has(role) ||
      !protocols.length ||
      protocols.some(
        (protocol) => String(protocol.category) !== "scalp_care" || String(protocol.role) !== role,
      )
    )
      blockers.push(`Scalp protocol role mismatch: ${manifest.product_key}`)
    const sources = Array.isArray(manifest.sources) ? manifest.sources.map(record) : []
    const source =
      sources.find((candidate) => String(candidate.url) === String(image.source_page_url)) ??
      sources[0] ??
      {}
    const validation = validations[index]
    const content_fingerprint =
      validation && validation.ok ? validation.content_fingerprint : "invalid"
    packageProducts.push({
      product_key: String(manifest.product_key),
      content_fingerprint,
      category_key: "scalp_care",
      product: {
        name: product.clean_name,
        brand: (SCALP_IDENTITY[String(manifest.product_key) as keyof typeof SCALP_IDENTITY] ?? {})
          .brandName,
        category: "scalp_care",
        category_key: "scalp_care",
        affiliate_link: product.affiliate_link,
        image_url: `${publicBase}/storage/v1/object/public/product-images/${path}`,
        price_eur: product.price_eur,
        currency: product.currency,
        purchase_link_status: product.purchase_link_status,
        purchase_link_checked_at: product.purchase_link_checked_at,
        price_checked_at: product.price_checked_at,
        brand_id: "brand_id" in identity ? identity.brand_id : null,
        product_line_id: "product_line_id" in identity ? identity.product_line_id : null,
        origin: "curated",
        is_active: true,
        lifecycle_status: "active",
        is_chaarlie_recommended: true,
      },
      image_asset: {
        storage_bucket: "product-images",
        storage_path: path,
        public_url: `${publicBase}/storage/v1/object/public/product-images/${path}`,
        source_page_url: image.source_page_url ?? source.url ?? null,
        source_image_url: null,
        source_type:
          source.type === "manufacturer"
            ? "brand"
            : source.type === "retailer"
              ? "retailer"
              : "unknown",
        quality_confidence: "high",
        processing_method: "local",
        asset_sha256: image.final_sha256,
        manifest_batch_id: SCALP_SOURCE_BATCH_ID,
        user_approved: true,
        notes: "Approved Scalp final asset",
      },
      identifiers: manifestIds.map((identifier) => ({
        ...identifier,
        source: normalizedIdentifierSource(identifier.source, source),
      })),
      scalp_spec: spec,
      protocols,
    })
  }
  if (!blockers.length) {
    const packageValue = buildScalpPackage({
      batch_id: SCALP_BATCH_ID,
      cohort_index_fingerprint,
      products: packageProducts,
    })
    if (SCALP_PACKAGE_FINGERPRINT && packageValue.fingerprint !== SCALP_PACKAGE_FINGERPRINT)
      blockers.push("resolved Scalp package fingerprint does not match the approved release")
    else
      return {
        ok: true,
        blockers,
        package: packageValue,
        cohort_index_fingerprint,
        release_context: release,
        heat_migration_state,
        scalp_migration_state,
      }
  }
  return {
    ok: false,
    blockers,
    cohort_index_fingerprint,
    release_context: release,
    heat_migration_state,
    scalp_migration_state,
  }
}

export type SCALPApplyArgs = {
  apply: boolean
  confirm: boolean
  confirm_batch?: string
  reviewed_by?: string
  reviewed_head?: string
  expect_scalp_migration?: "absent" | "applied"
  expected_batch_fingerprint?: string
  expected_content_fingerprint?: string
}
export function assertScalpBatchSelection(argv: readonly string[]) {
  const direct = argv.find((arg) => arg.startsWith("--batch="))?.slice(8)
  const index = argv.indexOf("--batch")
  if ((direct ?? (index >= 0 ? argv[index + 1] : undefined)) !== SCALP_BATCH_ID)
    throw new Error(`Scalp command requires --batch ${SCALP_BATCH_ID}`)
}
export function parseScalpApplyArgs(argv: readonly string[]): SCALPApplyArgs {
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i]!
    if (!raw.startsWith("--")) continue
    const equals = raw.indexOf("=")
    const key = raw.slice(2, equals < 0 ? undefined : equals)
    flags[key] =
      equals < 0
        ? argv[i + 1] && !argv[i + 1]!.startsWith("--")
          ? argv[++i]!
          : true
        : raw.slice(equals + 1)
  }
  const value: SCALPApplyArgs = {
    apply: flags.apply === true,
    confirm: flags.confirm === true,
    confirm_batch: typeof flags["confirm-batch"] === "string" ? flags["confirm-batch"] : undefined,
    reviewed_by: typeof flags["reviewed-by"] === "string" ? flags["reviewed-by"] : undefined,
    reviewed_head: typeof flags["reviewed-head"] === "string" ? flags["reviewed-head"] : undefined,
    expect_scalp_migration:
      flags["expect-scalp-migration"] === "absent" || flags["expect-scalp-migration"] === "applied"
        ? flags["expect-scalp-migration"]
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
    value.apply &&
    (!value.confirm ||
      value.confirm_batch !== SCALP_BATCH_ID ||
      value.reviewed_by !== "nick" ||
      !/^[a-f0-9]{40}$/.test(value.reviewed_head ?? "") ||
      value.expect_scalp_migration !== "applied" ||
      !value.expected_batch_fingerprint ||
      !value.expected_content_fingerprint)
  )
    throw new Error(
      `Scalp apply requires --apply --confirm --confirm-batch ${SCALP_BATCH_ID} --reviewed-by nick --reviewed-head <40-char-sha> --expect-scalp-migration=applied and both fingerprints`,
    )
  if (
    value.apply &&
    (!SCALP_PACKAGE_FINGERPRINT ||
      value.expected_batch_fingerprint !== SCALP_PACKAGE_FINGERPRINT ||
      value.expected_content_fingerprint !== SCALP_COHORT_INDEX_FINGERPRINT)
  )
    throw new Error("Scalp apply fingerprints are not generated and approved")
  return value
}

export type SCALPWriteAdapter = {
  upload: (bucket: string, path: string, bytes: Uint8Array) => Promise<void>
  object: (bucket: string, path: string) => Promise<Uint8Array | null>
  rpc: (
    name: "apply_catalog_enrichment_personal_plan_scalp_v1",
    args: { p_batch_json: string; p_expected_batch_fingerprint: string; p_reviewed_by: "nick" },
  ) => Promise<void>
}
export async function applyScalp(options: {
  args: SCALPApplyArgs
  preflight: SCALPPreflight
  preflightInput: Omit<Parameters<typeof preflightScalp>[0], "release">
  images: ReadonlyArray<{ path: string; bytes: Uint8Array; sha256: string }>
  write: SCALPWriteAdapter
}) {
  if (!options.args.apply)
    return { applied: false as const, reason: "dry-run", uploaded_paths: [] as string[] }
  if (!options.preflight.ok || !options.preflight.package || !SCALP_PACKAGE_FINGERPRINT)
    throw new Error("Scalp apply guard rejected preflight drift")
  const rerun = await preflightScalp({
    ...options.preflightInput,
    release: options.preflight.release_context,
  })
  if (
    !rerun.ok ||
    !rerun.package ||
    rerun.package.fingerprint !== options.preflight.package.fingerprint ||
    options.args.expected_batch_fingerprint !== options.preflight.package.fingerprint ||
    options.args.expected_content_fingerprint !== options.preflight.cohort_index_fingerprint
  )
    throw new Error("Scalp apply guard rejected preflight drift")
  const expected = new Map(
    options.preflight.package.package.products.map((item) => [
      String(item.image_asset.storage_path),
      String(item.image_asset.asset_sha256),
    ]),
  )
  if (
    options.images.length !== 8 ||
    new Set(options.images.map((image) => image.path)).size !== 8 ||
    options.images.some(
      (image) =>
        expected.get(image.path) !== image.sha256 || sha256Bytes(image.bytes) !== image.sha256,
    )
  )
    throw new Error("Scalp apply images must exactly match the 8 resolved package paths and hashes")
  const uploaded_paths: string[] = []
  for (const image of options.images) {
    const existing = await options.write.object("product-images", image.path)
    if (existing) {
      if (sha256Bytes(existing) !== image.sha256)
        throw new Error(`existing Storage object SHA mismatch: ${image.path}`)
      continue
    }
    await options.write.upload("product-images", image.path, image.bytes)
    const verified = await options.write.object("product-images", image.path)
    if (!verified || sha256Bytes(verified) !== image.sha256)
      throw new Error(`uploaded Storage object verification failed: ${image.path}`)
    uploaded_paths.push(image.path)
  }
  try {
    await options.write.rpc("apply_catalog_enrichment_personal_plan_scalp_v1", {
      p_batch_json: options.preflight.package.canonical_json,
      p_expected_batch_fingerprint: options.preflight.package.fingerprint,
      p_reviewed_by: "nick",
    })
  } catch (error) {
    throw new Error(
      `apply_catalog_enrichment_personal_plan_scalp_v1 failed.${uploaded_paths.length ? ` Newly uploaded unreferenced paths: ${uploaded_paths.join(", ")}` : ""}`,
      { cause: error },
    )
  }
  return { applied: true as const, uploaded_paths }
}

function comparable(value: unknown): unknown {
  if (value === undefined) return null
  if (Array.isArray(value)) return value.map(comparable)
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as UnknownRecord).map(([key, nested]) => [key, comparable(nested)]),
    )
  return value
}
function rowsEqual(left: UnknownRecord[], right: UnknownRecord[]) {
  return (
    stableCatalogEnrichmentJson(left.map(comparable).map(stableCatalogEnrichmentJson).sort()) ===
    stableCatalogEnrichmentJson(right.map(comparable).map(stableCatalogEnrichmentJson).sort())
  )
}
function projectedRow(actual: UnknownRecord, expected: UnknownRecord) {
  return Object.fromEntries(
    Object.keys(expected).map((key) => {
      const value = actual[key]
      if (key.endsWith("_at") && typeof value === "string" && Number.isFinite(Date.parse(value)))
        return [key, new Date(value).toISOString()]
      return [key, value]
    }),
  )
}
function productProjection(expected: UnknownRecord) {
  return projectedRow(expected, expected)
}
function relationMismatch(actual: UnknownRecord, expected: UnknownRecord) {
  return !rowsEqual([projectedRow(actual, expected)], [projectedRow(expected, expected)])
}
export async function verifyScalpRelations(
  read: Pick<SCALPReadAdapter, "list" | "object">,
  expected: ReturnType<typeof buildScalpPackage>,
) {
  const errors: string[] = []
  const [products, assets, identifiers, specs, protocols, ledger] = await Promise.all(
    [
      "products",
      "product_image_assets",
      "product_identifiers",
      "product_scalp_care_specs",
      "product_application_protocols",
      "catalog_enrichment_applied_items",
    ].map((table) => readAllScalpPages(read, table)),
  )
  const batch = ledger.filter((row) => String(row.batch_id) === SCALP_BATCH_ID)
  if (
    batch.length !== 8 ||
    batch
      .map((row) => String(row.product_key))
      .sort()
      .join("\n") !== EXPECTED_KEYS.join("\n")
  )
    errors.push("ledger batch must contain exactly the approved 8 product keys")
  for (const item of expected.package.products) {
    const product = products.filter(
      (row) =>
        String(row.brand_id) === String(item.product.brand_id) &&
        String(row.category_key) === "scalp_care" &&
        normalizedName(row.name) === normalizedName(item.product.name),
    )
    if (product.length !== 1) {
      errors.push(`product relation missing or duplicate: ${item.product_key}`)
      continue
    }
    const row = product[0]!
    const id = String(row.id)
    if (relationMismatch(row, productProjection(item.product)))
      errors.push(`product relation mismatch: ${item.product_key}`)
    const asset = assets.filter((candidate) => String(candidate.product_id) === id)
    if (asset.length !== 1 || relationMismatch(asset[0] ?? {}, item.image_asset))
      errors.push(`image asset relation mismatch: ${item.product_key}`)
    if (
      !rowsEqual(
        identifiers
          .filter((candidate) => String(candidate.product_id) === id)
          .map((candidate) => ({
            type: candidate.identifier_type,
            value: candidate.identifier_value,
            source: candidate.source,
          })),
        item.identifiers,
      )
    )
      errors.push(`identifier relation mismatch: ${item.product_key}`)
    const scalpSpec = specs.filter((candidate) => String(candidate.product_id) === id)
    if (scalpSpec.length !== 1 || relationMismatch(scalpSpec[0] ?? {}, item.scalp_spec))
      errors.push(`scalp spec relation mismatch: ${item.product_key}`)
    const actualProtocols = protocols.filter((candidate) => String(candidate.product_id) === id)
    const unmatchedProtocols = [...actualProtocols]
    for (const protocol of item.protocols) {
      const match = unmatchedProtocols.findIndex(
        (candidate) => !relationMismatch(candidate, protocol),
      )
      if (match < 0) {
        errors.push(`protocol relation mismatch: ${item.product_key}`)
        break
      }
      unmatchedProtocols.splice(match, 1)
    }
    if (actualProtocols.length !== item.protocols.length)
      errors.push(`protocol relation mismatch: ${item.product_key}`)
    if (
      batch.filter(
        (candidate) =>
          String(candidate.product_key) === item.product_key &&
          String(candidate.product_id) === id &&
          String(candidate.batch_fingerprint) === expected.fingerprint &&
          String(candidate.content_fingerprint) === item.content_fingerprint &&
          String(candidate.reviewed_by) === "nick",
      ).length !== 1
    )
      errors.push(`ledger relation mismatch: ${item.product_key}`)
    const bytes = await read.object("product-images", String(item.image_asset.storage_path))
    if (!bytes || sha256Bytes(bytes) !== String(item.image_asset.asset_sha256))
      errors.push(`Storage hash mismatch: ${item.product_key}`)
  }
  return { ok: errors.length === 0, errors }
}
