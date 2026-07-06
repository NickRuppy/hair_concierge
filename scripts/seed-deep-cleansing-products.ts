import { config as loadEnv } from "dotenv"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import {
  DEEP_CLEANSING_SHAMPOO_DB_CATEGORIES,
  isDeepCleansingShampooCategory,
  type ProductDeepCleansingShampooSpecs,
} from "@/lib/deep-cleansing-shampoo/constants"

type DeepCleansingSeedProduct = {
  slug: string
  name: string
  brand: string
  product_line: string | null
  legacy_brands: readonly string[]
  legacy_names: readonly string[]
  legacy_affiliate_links: readonly string[]
  description: string
  short_description: string
  affiliate_link: string
  source_url: string
  source_note: string
  mapping_reason: string
  identifiers: readonly { type: "gtin" | "retailer_sku" | "retailer_url"; value: string }[]
  price_eur: number
  currency: "EUR"
  purchase_link_status: "available"
  purchase_link_checked_at: string
  price_checked_at: string
  image_url: string
  sort_order: number
  specs: Omit<ProductDeepCleansingShampooSpecs, "product_id">
}

type DeepCleansingCatalogRow = {
  id: string
  brand: string | null
  name: string | null
  category: string | null
  is_active: boolean | null
  affiliate_link?: string | null
  brand_id?: string | null
  product_line_id?: string | null
  image_url?: string | null
  tags?: string[] | null
  suitable_thicknesses?: string[] | null
  suitable_concerns?: string[] | null
}

type IdentityRows = {
  brands: { id: string; canonical_name: string; normalized_name: string | null }[]
  lines: { id: string; brand_id: string; canonical_name: string; normalized_name: string | null }[]
}

const CATEGORY = "Tiefenreinigungsshampoo"
const DEEP_CLEANSING_CATEGORY_ALIASES = [...DEEP_CLEANSING_SHAMPOO_DB_CATEGORIES]
const EXPECTED_SUPABASE_PROJECT_ID = "pqdkhefxsxkyeqelqegq"
const EXPECTED_SUPABASE_HOSTNAME = `${EXPECTED_SUPABASE_PROJECT_ID}.supabase.co`
const CONFIRM_PROJECT_FLAG = `--confirm-project=${EXPECTED_SUPABASE_PROJECT_ID}`
const CONFIRM_REVIEWED_IMAGES_FLAG = "--confirm-reviewed-images"
const PRODUCT_IMAGE_BUCKET = "product-images"
const PRODUCT_IMAGE_PUBLIC_URL_PREFIX = `https://${EXPECTED_SUPABASE_HOSTNAME}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/`
const PRODUCT_IMAGE_RUN_DATE = "2026-07-03"
const COMMERCIAL_CHECKED_AT = "2026-07-03T00:00:00.000Z"

function expectedProductImageUrl(slug: string): string {
  return `${PRODUCT_IMAGE_PUBLIC_URL_PREFIX}catalog-additions/${PRODUCT_IMAGE_RUN_DATE}/deep-cleansing/${slug}.webp`
}

export const STALE_DEEP_CLEANSING_DEACTIVATION_PATCH = {
  is_active: false,
  lifecycle_status: "discontinued",
} as const

export const DEEP_CLEANSING_SEED_PRODUCTS = [
  {
    slug: "neqi-x-the-beautiful-people-deep-cleansing-shampoo",
    name: "Deep Cleansing Shampoo",
    brand: "NEQI",
    product_line: "x @_the.beautiful.people",
    legacy_brands: [],
    legacy_names: ["NEQI x @_the.beautiful.people Deep Cleansing Shampoo"],
    legacy_affiliate_links: [],
    description:
      "Creator-Source Tiefenreinigungsshampoo fuer Produktreste, Talg und Ablagerungen auf Haar und Kopfhaut.",
    short_description: "Creator-Source Reset fuer Rueckstaende, Talg und Ablagerungen.",
    affiliate_link:
      "https://www.rossmann.de/de/pflege-und-duft-neqi-deep-cleansing-shampoo/p/4063528103192",
    source_url: "https://neqi-hair.com/products/neqi-x-the-beautiful-people-deep-cleansing-shampoo",
    source_note:
      "Creator source list includes NEQI Stylist Edition Tiefenreinigung; NEQI and Rossmann position this as targeted deep cleansing with salicylic acid and removal support for deposits, excess sebum and product residues.",
    mapping_reason:
      "Explicit deep-cleansing positioning plus product, sebum and deposit claims make this a creator-source product/sebum buildup reset.",
    identifiers: [
      { type: "gtin", value: "4063528103192" },
      { type: "retailer_sku", value: "216611" },
      {
        type: "retailer_url",
        value:
          "https://www.rossmann.de/de/pflege-und-duft-neqi-deep-cleansing-shampoo/p/4063528103192",
      },
    ],
    price_eur: 12.99,
    currency: "EUR",
    purchase_link_status: "available",
    purchase_link_checked_at: COMMERCIAL_CHECKED_AT,
    price_checked_at: COMMERCIAL_CHECKED_AT,
    image_url: expectedProductImageUrl("neqi-x-the-beautiful-people-deep-cleansing-shampoo"),
    sort_order: 9301,
    specs: {
      scalp_type_focus: "balanced",
      reset_intensity: "medium",
      reset_focus: "product_sebum_buildup",
      color_treated_suitability: "unsuitable_or_unknown",
    },
  },
  {
    slug: "swiss-o-par-tiefenreinigung-shampoo",
    name: "Tiefenreinigung Shampoo",
    brand: "Swiss-O-Par",
    product_line: null,
    legacy_brands: [],
    legacy_names: [],
    legacy_affiliate_links: [],
    description:
      "Drogerie-Tiefenreinigungsshampoo gegen Stylingreste, Fett und Ablagerungen durch Umwelteinfluesse oder hartes Wasser.",
    short_description: "Reset fuer Stylingreste, Fett und hartes Wasser.",
    affiliate_link: "https://www.dm.de/p/d/2555198/swiss-o-par-shampoo-tiefenreinigung",
    source_url: "https://swissopar.de/produkt/tiefenreinigung-shampoo/",
    source_note:
      "Creator source list includes Swiss-O-Par Tiefenreinigung; brand and dm pages position it for styling residues, fats, environmental deposits and hard-water/lime context.",
    mapping_reason:
      "The product is explicitly positioned as Tiefenreinigung and combines styling/fat residue with hard-water context, so it fits a broad reset.",
    identifiers: [
      { type: "gtin", value: "4104260073500" },
      { type: "retailer_sku", value: "2555198" },
      {
        type: "retailer_url",
        value: "https://www.dm.de/p/d/2555198/swiss-o-par-shampoo-tiefenreinigung",
      },
    ],
    price_eur: 2.45,
    currency: "EUR",
    purchase_link_status: "available",
    purchase_link_checked_at: COMMERCIAL_CHECKED_AT,
    price_checked_at: COMMERCIAL_CHECKED_AT,
    image_url: expectedProductImageUrl("swiss-o-par-tiefenreinigung-shampoo"),
    sort_order: 9302,
    specs: {
      scalp_type_focus: "balanced",
      reset_intensity: "medium",
      reset_focus: "broad_spectrum_detox",
      color_treated_suitability: "unsuitable_or_unknown",
    },
  },
  {
    slug: "balea-professional-shampoo-tiefenreinigung",
    name: "Shampoo Tiefenreinigung",
    brand: "Balea",
    product_line: "Professional",
    legacy_brands: [],
    legacy_names: ["Balea Tiefenreinigung", "Balea Professional Shampoo Tiefenreinigung"],
    legacy_affiliate_links: [
      "https://www.dm.de/balea-professional-shampoo-tiefenreinigung-p4010355426239.html",
    ],
    description:
      "Drogerie-Tiefenreinigungsshampoo mit Menthol fuer Stylingreste und ueberschuessiges Fett auf Haar und Kopfhaut.",
    short_description: "Reset fuer Stylingreste und fettigen Ansatz.",
    affiliate_link: "https://www.dm.de/p/d/1536339/balea-professional-shampoo-tiefenreinigung",
    source_url: "https://www.dm.de/p/d/1536339/balea-professional-shampoo-tiefenreinigung",
    source_note:
      "Creator source list includes Balea Professional Tiefenreinigung; dm describes intensive cleansing with menthol that removes styling residues and excess fat from hair and scalp.",
    mapping_reason:
      "Explicit Tiefenreinigung positioning and styling/fat removal make this an oily-scalp product/sebum buildup reset.",
    identifiers: [
      { type: "gtin", value: "4070765001020" },
      { type: "retailer_sku", value: "1536339" },
      {
        type: "retailer_url",
        value: "https://www.dm.de/p/d/1536339/balea-professional-shampoo-tiefenreinigung",
      },
    ],
    price_eur: 1.25,
    currency: "EUR",
    purchase_link_status: "available",
    purchase_link_checked_at: COMMERCIAL_CHECKED_AT,
    price_checked_at: COMMERCIAL_CHECKED_AT,
    image_url: expectedProductImageUrl("balea-professional-shampoo-tiefenreinigung"),
    sort_order: 9303,
    specs: {
      scalp_type_focus: "oily",
      reset_intensity: "medium",
      reset_focus: "product_sebum_buildup",
      color_treated_suitability: "unsuitable_or_unknown",
    },
  },
  {
    slug: "isana-professional-shampoo-tiefenreinigung",
    name: "Professional Shampoo Tiefenreinigung",
    brand: "ISANA",
    product_line: null,
    legacy_brands: [],
    legacy_names: ["ISANA Professional Shampoo Tiefenreinigung", "Shampoo Tiefenreinigung"],
    legacy_affiliate_links: [],
    description:
      "Drogerie-Tiefenreinigungsshampoo fuer Stylingreste und Ablagerungen bei allen Haartypen.",
    short_description: "Reset fuer Stylingreste und Ablagerungen.",
    affiliate_link:
      "https://www.rossmann.de/de/pflege-und-duft-isana-professional-shampoo-tiefenreinigung/p/4068134135490",
    source_url:
      "https://www.rossmann.de/de/pflege-und-duft-isana-professional-shampoo-tiefenreinigung/p/4068134135490",
    source_note:
      "Creator source list includes ISANA Professional Tiefenreinigung; Rossmann positions it as intensive cleansing that removes styling residues and deposits for all hair types.",
    mapping_reason:
      "Explicit Tiefenreinigung positioning and styling/deposit removal fit a balanced product buildup reset.",
    identifiers: [
      { type: "gtin", value: "4068134135490" },
      { type: "retailer_sku", value: "190292" },
      {
        type: "retailer_url",
        value:
          "https://www.rossmann.de/de/pflege-und-duft-isana-professional-shampoo-tiefenreinigung/p/4068134135490",
      },
    ],
    price_eur: 1.29,
    currency: "EUR",
    purchase_link_status: "available",
    purchase_link_checked_at: COMMERCIAL_CHECKED_AT,
    price_checked_at: COMMERCIAL_CHECKED_AT,
    image_url: expectedProductImageUrl("isana-professional-shampoo-tiefenreinigung"),
    sort_order: 9304,
    specs: {
      scalp_type_focus: "balanced",
      reset_intensity: "medium",
      reset_focus: "product_sebum_buildup",
      color_treated_suitability: "unsuitable_or_unknown",
    },
  },
  {
    slug: "gliss-scalp-balance-tiefenreinigungs-shampoo",
    name: "Tiefenreinigungs-Shampoo",
    brand: "Gliss",
    product_line: "Scalp Balance",
    legacy_brands: ["GLISS"],
    legacy_names: ["Scalp Balance Tiefenreinigung Shampoo"],
    legacy_affiliate_links: [],
    description:
      "Tiefenreinigungsshampoo fuer fettige Kopfhaut, ueberschuessiges Oel und Produktreste.",
    short_description: "Reset fuer fettige Kopfhaut, Oel und Produktreste.",
    affiliate_link:
      "https://www.dm.de/p/d/3119217/schwarzkopf-gliss-shampoo-scalp-balance-tiefenreinigung",
    source_url:
      "https://www.schwarzkopf.de/marken/haarpflege/gliss/produktlinien/scalp-balance/tiefenreinigungs-shampoo.html",
    source_note:
      "Creator source list includes GLISS Scalp Balance Tiefenreinigung; Schwarzkopf, dm and Rossmann position it for oily scalp, excess oil and product residue, used one to two times per week.",
    mapping_reason:
      "Explicit Tiefenreinigung and oily-scalp/product-residue claims make this an oily-scalp product/sebum buildup reset.",
    identifiers: [
      { type: "gtin", value: "4015100893007" },
      { type: "retailer_sku", value: "3119217" },
      {
        type: "retailer_url",
        value:
          "https://www.dm.de/p/d/3119217/schwarzkopf-gliss-shampoo-scalp-balance-tiefenreinigung",
      },
    ],
    price_eur: 5.95,
    currency: "EUR",
    purchase_link_status: "available",
    purchase_link_checked_at: COMMERCIAL_CHECKED_AT,
    price_checked_at: COMMERCIAL_CHECKED_AT,
    image_url: expectedProductImageUrl("gliss-scalp-balance-tiefenreinigungs-shampoo"),
    sort_order: 9305,
    specs: {
      scalp_type_focus: "oily",
      reset_intensity: "medium",
      reset_focus: "product_sebum_buildup",
      color_treated_suitability: "unsuitable_or_unknown",
    },
  },
] as const satisfies readonly DeepCleansingSeedProduct[]

function productKey(product: Pick<DeepCleansingCatalogRow, "brand" | "name">): string {
  return `${product.brand ?? ""}\u0000${product.name ?? ""}`
}

const PLANNED_PRODUCT_KEYS = new Set(DEEP_CLEANSING_SEED_PRODUCTS.map(productKey))

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(values.map((value) => value?.trim()).filter((value): value is string => !!value)),
  ]
}

export function productImageStoragePath(
  product: Pick<DeepCleansingSeedProduct, "brand" | "name" | "image_url">,
): string {
  if (!product.image_url.startsWith(PRODUCT_IMAGE_PUBLIC_URL_PREFIX)) {
    throw new Error(
      `${product.brand} ${product.name} image_url must use ${PRODUCT_IMAGE_PUBLIC_URL_PREFIX}`,
    )
  }
  const storagePath = product.image_url.slice(PRODUCT_IMAGE_PUBLIC_URL_PREFIX.length)
  if (!storagePath.endsWith(".webp")) {
    throw new Error(`${product.brand} ${product.name} image_url must point to a WebP asset`)
  }
  return storagePath
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function findMatchingDeepCleansingCatalogRows(params: {
  product: DeepCleansingSeedProduct
  rows: DeepCleansingCatalogRow[]
  identity: { brandId: string; productLineId: string | null }
}): DeepCleansingCatalogRow[] {
  const candidateNames = uniqueNonEmpty([params.product.name, ...params.product.legacy_names])
  const candidateBrands = uniqueNonEmpty([params.product.brand, ...params.product.legacy_brands])
  const normalizedBrands = new Set(candidateBrands.map(normalize))
  const normalizedNames = new Set(candidateNames.map(normalize))

  return params.rows.filter((row) => {
    const lineMatches = params.identity.productLineId
      ? row.product_line_id === params.identity.productLineId
      : !row.product_line_id
    const identityMatches = row.brand_id === params.identity.brandId && lineMatches
    const textMatches =
      normalizedBrands.has(normalize(row.brand)) && normalizedNames.has(normalize(row.name))
    return identityMatches || textMatches
  })
}

function resolveIdentity(product: DeepCleansingSeedProduct, identityRows: IdentityRows) {
  const brand = identityRows.brands.find(
    (row) => normalize(row.canonical_name) === normalize(product.brand),
  )
  const productLine =
    product.product_line && brand
      ? identityRows.lines.find(
          (row) =>
            row.brand_id === brand.id &&
            normalize(row.canonical_name) === normalize(product.product_line),
        )
      : null

  return {
    brand_id: brand?.id ?? null,
    product_line_id: productLine?.id ?? null,
  }
}

async function fetchIdentityRows(supabase: SupabaseClient): Promise<IdentityRows> {
  const { data: brands, error: brandError } = await supabase
    .from("brands")
    .select("id,canonical_name,normalized_name")
  if (brandError) throw brandError

  const brandIds = (brands ?? []).map((brand) => brand.id)
  const { data: lines, error: lineError } =
    brandIds.length > 0
      ? await supabase
          .from("product_lines")
          .select("id,brand_id,canonical_name,normalized_name")
          .in("brand_id", brandIds)
      : { data: [], error: null }
  if (lineError) throw lineError

  return { brands: brands ?? [], lines: lines ?? [] }
}

async function assertSelectableColumns(
  supabase: SupabaseClient,
  table: string,
  columns: string[],
): Promise<void> {
  const { error } = await supabase.from(table).select(columns.join(",")).limit(1)
  if (error) {
    throw new Error(`Live schema preflight failed for ${table}: ${error.message}`)
  }
}

async function runLiveSchemaPreflight(supabase: SupabaseClient): Promise<void> {
  await assertSelectableColumns(supabase, "products", [
    "id",
    "name",
    "brand",
    "description",
    "short_description",
    "category",
    "affiliate_link",
    "image_url",
    "price_eur",
    "currency",
    "tags",
    "suitable_thicknesses",
    "suitable_concerns",
    "is_active",
    "lifecycle_status",
    "purchase_link_status",
    "purchase_link_checked_at",
    "price_checked_at",
    "sort_order",
    "brand_id",
    "product_line_id",
    "origin",
    "is_chaarlie_recommended",
  ])
  await assertSelectableColumns(supabase, "brands", ["id", "canonical_name", "normalized_name"])
  await assertSelectableColumns(supabase, "product_lines", [
    "id",
    "brand_id",
    "canonical_name",
    "normalized_name",
  ])
  await assertSelectableColumns(supabase, "product_deep_cleansing_shampoo_specs", [
    "product_id",
    "scalp_type_focus",
    "reset_intensity",
    "reset_focus",
    "color_treated_suitability",
  ])
}

async function assertReviewedProductImagesExist(supabase: SupabaseClient): Promise<void> {
  for (const product of DEEP_CLEANSING_SEED_PRODUCTS) {
    const storagePath = productImageStoragePath(product)
    const lastSlash = storagePath.lastIndexOf("/")
    const directory = storagePath.slice(0, lastSlash)
    const filename = storagePath.slice(lastSlash + 1)
    const { data, error } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .list(directory, { search: filename, limit: 100 })
    if (error) {
      throw new Error(
        `Image storage preflight failed for ${product.brand} ${product.name}: ${error.message}`,
      )
    }
    if (!data?.some((entry) => entry.name === filename)) {
      throw new Error(
        `Reviewed product image is missing from ${PRODUCT_IMAGE_BUCKET}/${storagePath}. ` +
          "Upload and review final Chaarlie image assets before applying the seed.",
      )
    }
  }
}

async function findOrCreateBrand(supabase: SupabaseClient, canonicalName: string): Promise<string> {
  const normalizedName = normalize(canonicalName)
  const { data: existing, error: lookupError } = await supabase
    .from("brands")
    .select("id")
    .eq("normalized_name", normalizedName)
    .maybeSingle()
  if (lookupError) throw lookupError
  if (existing?.id) return existing.id

  const { data, error } = await supabase
    .from("brands")
    .insert({ canonical_name: canonicalName, normalized_name: normalizedName })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

async function findOrCreateProductLine(
  supabase: SupabaseClient,
  brandId: string,
  canonicalName: string,
): Promise<string> {
  const normalizedName = normalize(canonicalName)
  const { data: existing, error: lookupError } = await supabase
    .from("product_lines")
    .select("id")
    .eq("brand_id", brandId)
    .eq("normalized_name", normalizedName)
    .maybeSingle()
  if (lookupError) throw lookupError
  if (existing?.id) return existing.id

  const { data, error } = await supabase
    .from("product_lines")
    .insert({ brand_id: brandId, canonical_name: canonicalName, normalized_name: normalizedName })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

async function findExistingCatalogRow(
  supabase: SupabaseClient,
  product: DeepCleansingSeedProduct,
  identity: { brandId: string; productLineId: string | null },
): Promise<DeepCleansingCatalogRow | null> {
  const productSelect =
    "id,brand,name,category,is_active,affiliate_link,brand_id,product_line_id,tags,suitable_thicknesses,suitable_concerns,image_url"
  const candidateAffiliateLinks = uniqueNonEmpty([
    product.affiliate_link,
    ...product.legacy_affiliate_links,
    ...product.identifiers
      .filter((identifier) => identifier.type === "retailer_url")
      .map((identifier) => identifier.value),
  ])
  const { data: affiliateMatches, error: affiliateError } = await supabase
    .from("products")
    .select(productSelect)
    .in("category", DEEP_CLEANSING_CATEGORY_ALIASES)
    .in("affiliate_link", candidateAffiliateLinks)
    .limit(2)
  if (affiliateError) throw affiliateError
  if ((affiliateMatches ?? []).length > 1) {
    throw new Error(
      `Multiple existing rows share affiliate/retailer URLs for ${product.brand} ${product.name}`,
    )
  }
  if ((affiliateMatches ?? []).length === 1) {
    return affiliateMatches?.[0] as DeepCleansingCatalogRow
  }

  const { data, error } = await supabase
    .from("products")
    .select(productSelect)
    .in("category", DEEP_CLEANSING_CATEGORY_ALIASES)
  if (error) throw error

  const matches = findMatchingDeepCleansingCatalogRows({
    product,
    rows: (data ?? []) as DeepCleansingCatalogRow[],
    identity,
  })

  if (matches.length > 1) {
    const candidateNames = uniqueNonEmpty([product.name, ...product.legacy_names])
    throw new Error(`Multiple existing rows match ${product.brand} / ${candidateNames.join(", ")}`)
  }
  return matches[0] ?? null
}

export function buildDeepCleansingProductPayload(params: {
  product: DeepCleansingSeedProduct
  existingCatalogRow: DeepCleansingCatalogRow | null
  brandId: string
  productLineId: string | null
}) {
  const tags = uniqueNonEmpty([
    ...(params.existingCatalogRow?.tags ?? []),
    "tiefenreinigung",
    "clarifying",
    params.product.specs.reset_focus,
  ])
  const suitableThicknesses = uniqueNonEmpty([
    ...(params.existingCatalogRow?.suitable_thicknesses ?? []),
    "fine",
    "normal",
    "coarse",
  ])
  const suitableConcerns = uniqueNonEmpty([
    ...(params.existingCatalogRow?.suitable_concerns ?? []),
    "healthy_scalp",
  ])

  return {
    name: params.product.name,
    brand: params.product.brand,
    description: params.product.description,
    short_description: params.product.short_description,
    category: CATEGORY,
    affiliate_link: params.product.affiliate_link,
    image_url: params.product.image_url,
    price_eur: params.product.price_eur,
    currency: params.product.currency,
    tags,
    suitable_thicknesses: suitableThicknesses,
    suitable_concerns: suitableConcerns,
    is_active: true,
    lifecycle_status: "active",
    purchase_link_status: params.product.purchase_link_status,
    purchase_link_checked_at: params.product.purchase_link_checked_at,
    price_checked_at: params.product.price_checked_at,
    sort_order: params.product.sort_order,
    brand_id: params.brandId,
    product_line_id: params.productLineId,
    origin: "curated",
    is_chaarlie_recommended: true,
  }
}

export function findUnexpectedActiveDeepCleansingProducts(
  products: DeepCleansingCatalogRow[],
): string[] {
  return products
    .filter((product) => isDeepCleansingShampooCategory(product.category) && product.is_active)
    .filter((product) => !PLANNED_PRODUCT_KEYS.has(productKey(product)))
    .map((product) => product.id)
}

export function assertDeepCleansingSeedApplyTarget(params: {
  supabaseUrl: string
  argv?: readonly string[]
}): void {
  const argv = params.argv ?? process.argv
  const hostname = new URL(params.supabaseUrl).hostname

  if (hostname !== EXPECTED_SUPABASE_HOSTNAME) {
    throw new Error(
      `Refusing to apply deep-cleansing seed to unexpected Supabase project: ${hostname}. ` +
        `Expected ${EXPECTED_SUPABASE_HOSTNAME}.`,
    )
  }

  if (!argv.includes(CONFIRM_PROJECT_FLAG)) {
    throw new Error(
      `Refusing to apply deep-cleansing seed without ${CONFIRM_PROJECT_FLAG}. ` +
        "Dry-run output is still available without confirmation.",
    )
  }

  if (!argv.includes(CONFIRM_REVIEWED_IMAGES_FLAG)) {
    throw new Error(
      `Refusing to apply deep-cleansing seed without ${CONFIRM_REVIEWED_IMAGES_FLAG}. ` +
        "Every product image must be reviewed, processed, and uploaded before product activation.",
    )
  }
}

function printSeedMatrix() {
  console.table(
    DEEP_CLEANSING_SEED_PRODUCTS.map((product) => ({
      brand: product.brand,
      line: product.product_line ?? "(none)",
      product: product.name,
      affiliate_link: product.affiliate_link,
      source_url: product.source_url,
      identifiers: product.identifiers
        .map((identifier) => `${identifier.type}:${identifier.value}`)
        .join("; "),
      source_note: product.source_note,
      price: `${product.price_eur} ${product.currency}`,
      purchase_link_status: product.purchase_link_status,
      purchase_link_checked_at: product.purchase_link_checked_at,
      price_checked_at: product.price_checked_at,
      image_url: product.image_url,
      image_status: "requires uploaded reviewed product-images asset before apply",
      origin: "curated",
      is_chaarlie_recommended: true,
      scalp_type_focus: product.specs.scalp_type_focus,
      reset_intensity: product.specs.reset_intensity,
      reset_focus: product.specs.reset_focus,
      mapping_reason: product.mapping_reason,
    })),
  )
}

async function main() {
  const apply = process.argv.includes("--apply")
  const deactivateStale = process.argv.includes("--deactivate-stale")
  printSeedMatrix()

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply after Nick confirms the seed matrix.")
    if (deactivateStale) {
      console.log("--deactivate-stale is ignored without --apply.")
    }
    return
  }

  loadEnv({ path: ".env.local" })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  assertDeepCleansingSeedApplyTarget({ supabaseUrl })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  await runLiveSchemaPreflight(supabase)
  await assertReviewedProductImagesExist(supabase)

  const seededProductIds: string[] = []
  const identityRows = await fetchIdentityRows(supabase)

  for (const product of DEEP_CLEANSING_SEED_PRODUCTS) {
    const resolvedIdentity = resolveIdentity(product, identityRows)
    const brandId = resolvedIdentity.brand_id ?? (await findOrCreateBrand(supabase, product.brand))
    const productLineId = product.product_line
      ? (resolvedIdentity.product_line_id ??
        (await findOrCreateProductLine(supabase, brandId, product.product_line)))
      : null
    const existingCatalogRow = await findExistingCatalogRow(supabase, product, {
      brandId,
      productLineId,
    })

    const payload = buildDeepCleansingProductPayload({
      product,
      existingCatalogRow,
      brandId,
      productLineId,
    })

    const { data: saved, error: productError } = existingCatalogRow
      ? await supabase
          .from("products")
          .update(payload)
          .eq("id", existingCatalogRow.id)
          .select("id")
          .single()
      : await supabase.from("products").insert(payload).select("id").single()

    if (productError) throw productError
    seededProductIds.push(saved.id)

    const { error: specError } = await supabase.from("product_deep_cleansing_shampoo_specs").upsert(
      {
        product_id: saved.id,
        ...product.specs,
      },
      { onConflict: "product_id" },
    )

    if (specError) throw specError
  }

  const { data: activeDeepCleansingProducts, error: activeLookupError } = await supabase
    .from("products")
    .select("id,brand,name,category,is_active")
    .in("category", DEEP_CLEANSING_CATEGORY_ALIASES)
    .eq("is_active", true)

  if (activeLookupError) throw activeLookupError

  const unexpectedActiveIds = findUnexpectedActiveDeepCleansingProducts(
    (activeDeepCleansingProducts ?? []) as DeepCleansingCatalogRow[],
  )

  if (unexpectedActiveIds.length > 0 && deactivateStale) {
    const { error: deactivateError } = await supabase
      .from("products")
      .update(STALE_DEEP_CLEANSING_DEACTIVATION_PATCH)
      .in("id", unexpectedActiveIds)

    if (deactivateError) throw deactivateError
    console.log(`Deactivated ${unexpectedActiveIds.length} unexpected deep-cleansing products.`)
  } else if (unexpectedActiveIds.length > 0) {
    console.warn(
      `Found ${unexpectedActiveIds.length} active deep-cleansing products outside the reviewed seed matrix. ` +
        "Leaving them active. Re-run with --apply --deactivate-stale only after reviewing those rows.",
    )
  }

  const { count: activeCount, error: countError } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .in("category", DEEP_CLEANSING_CATEGORY_ALIASES)
    .eq("is_active", true)

  if (countError) throw countError
  if (deactivateStale && activeCount !== seededProductIds.length) {
    throw new Error(
      `Expected ${seededProductIds.length} active deep-cleansing products, found ${
        activeCount ?? 0
      }`,
    )
  }

  console.log(`Seeded ${DEEP_CLEANSING_SEED_PRODUCTS.length} deep-cleansing products.`)
}

if (process.argv[1]?.endsWith("seed-deep-cleansing-products.ts")) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
