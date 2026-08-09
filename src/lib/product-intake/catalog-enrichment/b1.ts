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

export const B1_SCHEMA_VERSION = "personal-plan-catalog-enrichment-b1" as const
export const B1_BATCH_ID = "personal-plan-launch-v1" as const
export const B1_ACCEPTED_BASE_SHA = "580c3c118bc979679aee7b5782ad29c3dd0622ca" as const
export const B1_B0_INDEX_FINGERPRINT =
  "6347a416f47dd48615bcfbf82863c99823028b3c83dffc9b1a63c8bcf490342e" as const
export const B1_EXPECTED_KEYS = {
  heat: [
    "balea-two-phase-200ml",
    "balea-ultralight-200ml",
    "got2b-schutzengel-200ml",
    "jean-len-beat-the-heat-100ml",
    "loreal-elvital-dream-length-defeat-the-heat-150ml",
    "taft-aloe-boost-hydra-protect-150ml",
    "taft-gliss-lovely-long-150ml",
  ],
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
export const B1_IDENTITY = {
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

const B1_EXPECTED_KEY_LIST = [...B1_EXPECTED_KEYS.heat, ...B1_EXPECTED_KEYS.scalp].sort()
const B1_HEAT_KEYS = new Set<string>(B1_EXPECTED_KEYS.heat)
const B1_UNAVAILABLE_KEYS = new Set([
  "balea-two-phase-200ml",
  "taft-aloe-boost-hydra-protect-150ml",
])

type UnknownRecord = Record<string, unknown>
export type B1PackageProduct = {
  product_key: string
  content_fingerprint: string
  category_key: string
  product: UnknownRecord
  image_asset: UnknownRecord
  identifiers: UnknownRecord[]
  heat_spec?: UnknownRecord
  scalp_spec?: UnknownRecord
  protocols: UnknownRecord[]
}
export type B1Package = {
  schema_version: typeof B1_SCHEMA_VERSION
  batch_id: typeof B1_BATCH_ID
  accepted_base_sha: typeof B1_ACCEPTED_BASE_SHA
  b0_index_fingerprint: string
  products: B1PackageProduct[]
}

export function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}
export function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex")
}
export function buildB1Package(
  input: Pick<B1Package, "batch_id" | "b0_index_fingerprint" | "products">,
) {
  if (input.batch_id !== B1_BATCH_ID) throw new Error(`unknown B1 batch: ${input.batch_id}`)
  if (input.b0_index_fingerprint !== B1_B0_INDEX_FINGERPRINT)
    throw new Error("B1 index fingerprint does not match the approved cohort")
  const products = [...input.products].sort((a, b) => a.product_key.localeCompare(b.product_key))
  if (
    products.length !== 15 ||
    products.map((product) => product.product_key).join("\n") !== B1_EXPECTED_KEY_LIST.join("\n")
  )
    throw new Error("B1 package must contain the exact 15 approved product keys")
  for (const product of products) {
    if (!product.product_key || !/^[a-f0-9]{64}$/.test(product.content_fingerprint))
      throw new Error("B1 product key and content fingerprint are required")
    if (Boolean(product.heat_spec) === Boolean(product.scalp_spec))
      throw new Error(`B1 product ${product.product_key} needs exactly one category spec`)
    const expectedCategory = B1_HEAT_KEYS.has(product.product_key)
      ? "heat_protectant"
      : "scalp_care"
    if (product.category_key !== expectedCategory)
      throw new Error(`B1 category mismatch: ${product.product_key}`)
    if (product.product.is_chaarlie_recommended !== !B1_UNAVAILABLE_KEYS.has(product.product_key))
      throw new Error(`B1 recommendation mismatch: ${product.product_key}`)
  }
  const indexFingerprint = catalogEnrichmentFingerprint({
    schema_version: "personal-plan-launch-v1",
    products: products.map(({ product_key, content_fingerprint }) => ({
      product_key,
      content_fingerprint,
    })),
  })
  if (indexFingerprint !== B1_B0_INDEX_FINGERPRINT)
    throw new Error("B1 item fingerprints do not match the approved cohort index")
  const pkg: B1Package = {
    schema_version: B1_SCHEMA_VERSION,
    batch_id: B1_BATCH_ID,
    accepted_base_sha: B1_ACCEPTED_BASE_SHA,
    b0_index_fingerprint: input.b0_index_fingerprint,
    products,
  }
  const canonical_json = stableCatalogEnrichmentJson(pkg)
  return { package: pkg, canonical_json, fingerprint: sha256Utf8(canonical_json) }
}

export type B1ReadAdapter = {
  list: (table: string, offset: number, limit: number) => Promise<UnknownRecord[]>
  object: (bucket: string, path: string) => Promise<Uint8Array | null>
  hasTables?: (tables: readonly string[]) => Promise<string[]>
}
export async function readAllPages(
  read: Pick<B1ReadAdapter, "list">,
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

export type B1Preflight = {
  ok: boolean
  blockers: string[]
  package?: ReturnType<typeof buildB1Package>
  b0_index_fingerprint?: string
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
  "product_scalp_care_specs",
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
export function resolveB1Identity(key: string, brands: UnknownRecord[], lines: UnknownRecord[]) {
  const expected = B1_IDENTITY[key as keyof typeof B1_IDENTITY]
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

export async function loadB1Manifests(root = "data/catalog-enrichment/personal-plan-launch-v1") {
  const result: Array<{
    group: "heat" | "scalp"
    manifest: CatalogEnrichmentManifest
    bytes: Uint8Array
  }> = []
  for (const group of ["heat", "scalp"] as const) {
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

export async function preflightB1(options: {
  read: B1ReadAdapter
  root?: string
  now?: Date
  commercialMaxAgeMs?: number
  cwd?: string
  publicSupabaseUrl?: string
  mode?: "pre_apply" | "post_apply"
}): Promise<B1Preflight> {
  const blockers: string[] = []
  const root = options.root ?? "data/catalog-enrichment/personal-plan-launch-v1"
  const manifests = await loadB1Manifests(root)
  const expected = new Set<string>([...B1_EXPECTED_KEYS.heat, ...B1_EXPECTED_KEYS.scalp])
  const seen = new Set(manifests.map(({ manifest }) => manifest.product_key))
  if (
    seen.size !== 15 ||
    [...expected].some((key) => !seen.has(key)) ||
    [...seen].some((key) => !expected.has(key))
  )
    blockers.push("approved B1 cohort must be exactly 7 Heat and 8 Scalp product keys")
  const valid = manifests.map(({ manifest }) => validateCatalogEnrichmentManifest(manifest))
  for (const [index, validation] of valid.entries())
    if (!validation.ok)
      blockers.push(
        `invalid B0 manifest ${manifests[index]?.manifest.product_key}: ${validation.errors.join("; ")}`,
      )
  const index = generateCatalogEnrichmentIndex(manifests.map(({ manifest }) => manifest))
  const b0_index_fingerprint = catalogEnrichmentFingerprint(index)
  if (b0_index_fingerprint !== B1_B0_INDEX_FINGERPRINT)
    blockers.push("B0 index fingerprint does not match the approved B1 cohort")
  const missingTables = options.read.hasTables ? await options.read.hasTables(requiredTables) : []
  if (missingTables.length)
    blockers.push(`missing required B1 schema/table: ${missingTables.sort().join(", ")}`)
  const publicBase = (
    options.publicSupabaseUrl ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    ""
  ).replace(/\/$/, "")
  if (!publicBase) blockers.push("missing public Supabase base URL")
  const [products, identifiers, brandRows, productLines, categories] = await Promise.all([
    readAllPages(options.read, "products"),
    readAllPages(options.read, "product_identifiers"),
    readAllPages(options.read, "brands"),
    readAllPages(options.read, "product_lines"),
    readAllPages(options.read, "product_categories"),
  ])
  const now = (options.now ?? new Date()).getTime()
  const maxAge = options.commercialMaxAgeMs ?? 1000 * 60 * 60 * 24 * 7
  const packageProducts: B1PackageProduct[] = []
  for (const [manifestIndex, { group, manifest }] of manifests.entries()) {
    const finalPayload = getFinal(manifest)
    const product = getProduct(manifest)
    const image = getImage(manifest)
    const checkedAt = String(
      record(manifest.commercial).checked_at ?? product.price_checked_at ?? "",
    )
    if (!Number.isFinite(Date.parse(checkedAt)) || now - Date.parse(checkedAt) > maxAge)
      blockers.push(`stale commercial observation: ${manifest.product_key}`)
    const resolved = resolveB1Identity(manifest.product_key, brandRows, productLines)
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
    const common: Omit<B1PackageProduct, "heat_spec" | "scalp_spec"> = {
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
        manifest_batch_id: B1_BATCH_ID,
        user_approved: true,
        notes: "Approved B1 final asset",
      },
      identifiers: manifestIds.map((identifier) => {
        const value = record(identifier)
        return { ...value, source: value.source ?? identifierSourceFallback(source) }
      }),
      protocols: Array.isArray(categoryPayload.product_application_protocols)
        ? categoryPayload.product_application_protocols.map(record)
        : [],
    }
    packageProducts.push(
      group === "heat"
        ? { ...common, heat_spec: record(categoryPayload.product_heat_protectant_specs) }
        : { ...common, scalp_spec: record(categoryPayload.product_scalp_care_specs) },
    )
  }
  if (packageProducts.filter((item) => item.product.is_chaarlie_recommended === true).length !== 13)
    blockers.push("B1 recommendation state must be exactly 13 true and 2 false")
  return blockers.length
    ? { ok: false, blockers, b0_index_fingerprint }
    : {
        ok: true,
        blockers,
        b0_index_fingerprint,
        package: buildB1Package({
          batch_id: B1_BATCH_ID,
          b0_index_fingerprint,
          products: packageProducts,
        }),
      }
}

export type B1ApplyArgs = {
  apply: boolean
  confirm: boolean
  confirm_batch?: string
  reviewed_by?: string
  expected_batch_fingerprint?: string
  expected_content_fingerprint?: string
}
export function assertB1BatchSelection(argv: readonly string[]): void {
  const inline = argv.find((arg) => arg.startsWith("--batch="))?.slice("--batch=".length)
  const index = argv.indexOf("--batch")
  const selected = inline ?? (index >= 0 ? argv[index + 1] : undefined)
  if (selected !== B1_BATCH_ID) throw new Error(`B1 command requires --batch ${B1_BATCH_ID}`)
}
export function parseB1ApplyArgs(argv: readonly string[]): B1ApplyArgs {
  const flags: Record<string, string | boolean> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index]!
    if (!raw.startsWith("--")) continue
    const equals = raw.indexOf("=")
    const key = raw.slice(2, equals === -1 ? undefined : equals)
    const inline = equals === -1 ? undefined : raw.slice(equals + 1)
    flags[key] = inline ?? (!argv[index + 1]?.startsWith("--") ? argv[++index]! : true)
  }
  const result: B1ApplyArgs = {
    apply: flags.apply === true,
    confirm: flags.confirm === true,
    confirm_batch: typeof flags["confirm-batch"] === "string" ? flags["confirm-batch"] : undefined,
    reviewed_by: typeof flags["reviewed-by"] === "string" ? flags["reviewed-by"] : undefined,
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
      result.confirm_batch !== B1_BATCH_ID ||
      result.reviewed_by !== "nick" ||
      !result.expected_batch_fingerprint ||
      !result.expected_content_fingerprint)
  )
    throw new Error(
      "B1 apply requires --apply --confirm --confirm-batch personal-plan-launch-v1 --reviewed-by nick --expected-batch-fingerprint and --expected-content-fingerprint",
    )
  if (
    result.apply &&
    (!/^[a-f0-9]{64}$/.test(result.expected_batch_fingerprint ?? "") ||
      result.expected_content_fingerprint !== B1_B0_INDEX_FINGERPRINT)
  )
    throw new Error("B1 apply fingerprints must match the approved lowercase SHA-256 contract")
  return result
}

export type B1WriteAdapter = {
  upload: (bucket: string, path: string, bytes: Uint8Array) => Promise<void>
  object: (bucket: string, path: string) => Promise<Uint8Array | null>
  rpc: (
    name: "catalog_enrichment_apply_batch",
    args: { p_batch_json: string; p_expected_batch_fingerprint: string; p_reviewed_by: "nick" },
  ) => Promise<void>
}

/**
 * The only mutation surface in B1.  It intentionally exposes neither tables nor
 * arbitrary RPC names: the database worker remains the single transactional writer.
 */
export async function applyB1(options: {
  args: B1ApplyArgs
  preflight: B1Preflight
  images: ReadonlyArray<{ path: string; bytes: Uint8Array; sha256: string }>
  write: B1WriteAdapter
}) {
  const { args, preflight, images, write } = options
  if (!args.apply)
    return { applied: false as const, reason: "dry-run", uploaded_paths: [] as string[] }
  if (
    !preflight.ok ||
    !preflight.package ||
    args.expected_batch_fingerprint !== preflight.package.fingerprint ||
    args.expected_content_fingerprint !== preflight.b0_index_fingerprint
  )
    throw new Error("B1 apply guard rejected preflight drift")
  const expectedImages = new Map(
    preflight.package.package.products.map((item) => [
      String(item.image_asset.storage_path),
      String(item.image_asset.asset_sha256),
    ]),
  )
  if (
    images.length !== 15 ||
    new Set(images.map((image) => image.path)).size !== 15 ||
    images.some((image) => expectedImages.get(image.path) !== image.sha256) ||
    [...expectedImages.keys()].some((path) => !images.some((image) => image.path === path))
  )
    throw new Error("B1 apply images must exactly match the 15 resolved package paths and hashes")
  if (images.some((image) => !/^[a-f0-9]{64}$/.test(image.sha256)))
    throw new Error("B1 apply image hash must be lowercase SHA-256")
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
    await write.rpc("catalog_enrichment_apply_batch", {
      p_batch_json: preflight.package.canonical_json,
      p_expected_batch_fingerprint: preflight.package.fingerprint,
      p_reviewed_by: "nick",
    })
  } catch (error) {
    const suffix = uploaded_paths.length
      ? ` Newly uploaded unreferenced paths: ${uploaded_paths.join(", ")}`
      : ""
    throw new Error(`catalog_enrichment_apply_batch failed.${suffix}`, { cause: error })
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

export async function verifyB1Relations(
  read: Pick<B1ReadAdapter, "list" | "object">,
  expected: ReturnType<typeof buildB1Package>,
) {
  const errors: string[] = []
  const [products, assets, identifiers, heatSpecs, scalpSpecs, protocols, ledger] =
    await Promise.all([
      readAllPages(read, "products"),
      readAllPages(read, "product_image_assets"),
      readAllPages(read, "product_identifiers"),
      readAllPages(read, "product_heat_protectant_specs"),
      readAllPages(read, "product_scalp_care_specs"),
      readAllPages(read, "product_application_protocols"),
      readAllPages(read, "catalog_enrichment_applied_items"),
    ])
  const expectedKeys = expected.package.products.map((item) => item.product_key).sort()
  const batchLedger = ledger.filter((row) => String(row.batch_id) === B1_BATCH_ID)
  if (
    batchLedger.length !== 15 ||
    batchLedger
      .map((row) => String(row.product_key))
      .sort()
      .join("\n") !== expectedKeys.join("\n")
  )
    errors.push("ledger batch must contain exactly the approved 15 product keys")
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
    const actualScalpSpecs = scalpSpecs.filter((candidate) => String(candidate.product_id) === id)
    if (
      item.heat_spec &&
      (actualHeatSpecs.length !== 1 ||
        !projectedRowMatches(actualHeatSpecs[0] ?? {}, item.heat_spec) ||
        actualScalpSpecs.length !== 0)
    )
      errors.push(`heat spec relation mismatch: ${item.product_key}`)
    if (
      item.scalp_spec &&
      (actualScalpSpecs.length !== 1 ||
        !projectedRowMatches(actualScalpSpecs[0] ?? {}, item.scalp_spec) ||
        actualHeatSpecs.length !== 0)
    )
      errors.push(`scalp spec relation mismatch: ${item.product_key}`)
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
