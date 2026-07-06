import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { basename, dirname, extname, join, relative } from "node:path"

import { config as loadEnv } from "dotenv"
import sharp from "sharp"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const EXPECTED_SUPABASE_PROJECT_ID = "pqdkhefxsxkyeqelqegq"
const EXPECTED_SUPABASE_HOSTNAME = `${EXPECTED_SUPABASE_PROJECT_ID}.supabase.co`
const CONFIRM_PROJECT_FLAG = `--confirm-project=${EXPECTED_SUPABASE_PROJECT_ID}`
const RUN_DATE = "2026-06-27"
const PACKAGE_ROOT = join("ops", "product-intake-research", RUN_DATE)
const PRODUCT_IMAGE_BUCKET = "product-images"
const PRODUCT_IMAGE_PUBLIC_URL_PREFIX = `https://${EXPECTED_SUPABASE_HOSTNAME}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/`
const FINAL_IMAGE_BACKGROUND = { r: 243, g: 239, b: 232, alpha: 1 }

type CatalogCategoryKey = "conditioner" | "mask" | "leave_in"
type SourceType = "brand" | "retailer" | "unknown"

type ProductDraft = {
  slug: string
  name: string
  brand: string
  identityBrand: string
  productLine: string | null
  category: string
  category_key: CatalogCategoryKey
  description: string
  short_description: string | null
  tom_take: string | null
  affiliate_link: string
  purchase_link_status: "available" | "unavailable"
  source_urls: string[]
  source_notes: string[]
  price_eur: number
  currency: "EUR"
  size: string | null
  tags: string[]
  suitable_thicknesses: string[]
  suitable_concerns: string[]
  sort_order_hint: number
  spec:
    | {
        table: "product_conditioner_rerank_specs"
        value: {
          weight: "light" | "medium" | "rich"
          repair_level: "low" | "medium" | "high"
          balance_direction: "protein" | "moisture" | "balanced" | null
          ingredient_flags: string[]
        }
      }
    | {
        table: "product_mask_specs"
        value: {
          weight: "light" | "medium" | "rich"
          concentration: "low" | "medium" | "high"
          balance_direction: "protein" | "moisture" | "balanced" | null
          ingredient_flags: string[]
        }
      }
    | {
        table: "product_leave_in_fit_specs"
        value: {
          weight: "light" | "medium" | "rich"
          conditioner_relationship: "replacement_capable" | "booster_only"
          care_benefits: string[]
        }
        legacyLeaveInSpec: {
          format: "spray" | "milk" | "lotion" | "cream" | "serum"
          weight: "light" | "medium" | "rich"
          roles: string[]
          provides_heat_protection: boolean
          heat_protection_max_c: number | null
          heat_activation_required: boolean
          care_benefits: string[]
          ingredient_flags: string[]
          application_stage: string[]
        }
      }
  preferred_source_type: SourceType
  preferred_image_urls: string[]
  image_search_notes: string[]
}

type ProductPayload = Omit<
  ProductDraft,
  | "slug"
  | "identityBrand"
  | "productLine"
  | "source_urls"
  | "source_notes"
  | "size"
  | "spec"
  | "preferred_source_type"
  | "preferred_image_urls"
  | "image_search_notes"
  | "sort_order_hint"
> & {
  purchase_link_status: "available" | "unavailable"
  purchase_link_checked_at: string
  price_checked_at: string
  is_active: true
  lifecycle_status: "active"
  sort_order: number
  brand_id: string | null
  product_line_id: string | null
  origin: "curated"
  is_chaarlie_recommended: true
  image_url: string
}

type PackagePayload = {
  product: ProductPayload
  spec: ProductDraft["spec"]
  identity: {
    brand: string
    product_line: string | null
    resolved_brand_id: string | null
    resolved_product_line_id: string | null
  }
  sources: {
    urls: string[]
    notes: string[]
    size: string | null
  }
  review: {
    payload_sha256: string
    generated_at: string
    approval_required_before_image_upload: true
    approval_required_before_db_write: true
  }
}

type ImageCandidate = {
  source_page_url: string
  source_image_url: string
  source_type: SourceType
  confidence: "high" | "medium" | "low"
  local_file: string | null
}

export const PRODUCT_DRAFTS: ProductDraft[] = [
  {
    slug: "gliss-ultimate-repair-spuelung",
    name: "Ultimate Repair Spülung",
    brand: "Gliss",
    identityBrand: "Gliss",
    productLine: null,
    category: "Conditioner (Drogerie)",
    category_key: "conditioner",
    description:
      "Repair-Conditioner fuer strapaziertes, geschaedigtes Haar, der die Laengen glaettet und Haarbruch-Kontext abdeckt.",
    short_description: null,
    tom_take: null,
    affiliate_link:
      "https://www.rossmann.de/de/pflege-und-duft-gliss-ultimate-repair-spuelung/p/4015100812237",
    purchase_link_status: "available",
    source_urls: [
      "https://www.rossmann.de/de/pflege-und-duft-gliss-ultimate-repair-spuelung/p/4015100812237",
      "https://www.ohfeliz.ch/de-CH/schwarzkopf/gliss-kur-spuelung-ultimate-repair",
    ],
    source_notes: [
      "Rossmann product page for EAN 4015100812237; source page can be bot-protected, so price/image need review confirmation.",
      "oh feliz page confirms 200 ml, EAN 4015100812237, product-line text, INCI, and exposes a stable front packshot candidate.",
      "Existing live catalog already maps Gliss repair conditioners to protein/repair with silicone flag. No new Gliss product line is proposed for this row.",
    ],
    price_eur: 2.99,
    currency: "EUR",
    size: "200 ml",
    tags: ["conditioner (drogerie)", "repair"],
    suitable_thicknesses: ["normal"],
    suitable_concerns: ["protein", "hair_damage", "breakage"],
    sort_order_hint: 37,
    spec: {
      table: "product_conditioner_rerank_specs",
      value: {
        weight: "medium",
        repair_level: "high",
        balance_direction: "protein",
        ingredient_flags: ["silicones"],
      },
    },
    preferred_source_type: "retailer",
    preferred_image_urls: [
      "https://of.nice-cdn.com/upload/image/product/large/default/schwarzkopf-gliss-kur-spuelung-ultimate-repair-200-ml-581516-de.jpg",
      "https://media.rossmann.de/products/4015100812237_1-1200.jpg",
    ],
    image_search_notes: [
      "Prefer Rossmann packshot for EAN 4015100812237 if the product page exposes it during review.",
    ],
  },
  {
    slug: "syoss-intense-curls-haarmaske",
    name: "Intense Curls Haarmaske",
    brand: "Syoss",
    identityBrand: "Syoss",
    productLine: null,
    category: "Maske",
    category_key: "mask",
    description:
      "Haarmaske fuer welliges bis lockiges Haar, die Feuchtigkeit, Entwirrung und Anti-Frizz in den Laengen unterstuetzt.",
    short_description: null,
    tom_take: null,
    affiliate_link:
      "https://www.rossmann.de/de/pflege-und-duft-syoss-haarmaske-intense-curls/p/4015100866100",
    purchase_link_status: "available",
    source_urls: [
      "https://www.dm.de/p/d/3099668/syoss-haarmaske-intense-curls",
      "https://www.syoss.net/care/mask/syoss-intense-curls-hair-mask.html",
      "https://www.rossmann.de/de/pflege-und-duft-syoss-haarmaske-intense-curls/p/4015100866100",
    ],
    source_notes: [
      "Syoss official page positions the mask for wavy/curly hair and exposes a high-confidence product image.",
      "Rossmann product page is the preferred buyable German purchase path; dm page exists but may be unavailable.",
    ],
    price_eur: 4.99,
    currency: "EUR",
    size: "440 ml",
    tags: ["maske", "locken", "feuchtigkeit", "silikone"],
    suitable_thicknesses: ["coarse"],
    suitable_concerns: ["feuchtigkeit", "dryness", "frizz", "tangling"],
    sort_order_hint: 116,
    spec: {
      table: "product_mask_specs",
      value: {
        weight: "medium",
        concentration: "medium",
        balance_direction: "moisture",
        ingredient_flags: ["silicones", "proteins", "humectants"],
      },
    },
    preferred_source_type: "brand",
    preferred_image_urls: [
      "https://media.rossmann.de/products/4015100866100_1-1200.jpg",
      "https://dm.henkel-dam.com/is/image/henkel/SY_Curl_Mask_400ml_front-MA_4096x4143",
    ],
    image_search_notes: ["Official Syoss OG image is a direct Henkel DAM packshot."],
  },
  {
    slug: "garnier-wahre-schaetze-haarmaske-aktivkohle",
    name: "Haarmaske Aktivkohle",
    brand: "Garnier Wahre Schätze",
    identityBrand: "Garnier",
    productLine: "Wahre Schätze",
    category: "Maske",
    category_key: "mask",
    description:
      "Ausgleichende Maske aus der Aktivkohle-Linie fuer schnell fettenden Ansatz-Kontext und gepflegte Laengen.",
    short_description: null,
    tom_take: null,
    affiliate_link:
      "https://www.dm.de/p/d/1679241/wahre-schaetze-haarkur-1-minute-aktivkohle-fettige-kopfhaut",
    purchase_link_status: "unavailable",
    source_urls: [
      "https://www.garnier.de/haarpflege/haarpflege-marken/wahre-schaetze/aktivkohle",
      "https://www.dm.de/p/d/1679241/wahre-schaetze-haarkur-1-minute-aktivkohle-fettige-kopfhaut",
    ],
    source_notes: [
      "Garnier official Aktivkohle line page confirms the range and image context; retailer purchase URL still needs final preference if available.",
      "Existing live catalog has the Aktivkohle shampoo as active; this is a distinct mask row.",
      "Current exact dm page appears unavailable, so this package must not be applied unless Nick approves unavailable status or a buyable exact retailer is found.",
    ],
    price_eur: 4.95,
    currency: "EUR",
    size: "340 ml",
    tags: ["maske", "aktivkohle", "feuchtigkeit", "silikonfrei"],
    suitable_thicknesses: ["fine", "normal"],
    suitable_concerns: ["feuchtigkeit", "dryness"],
    sort_order_hint: 117,
    spec: {
      table: "product_mask_specs",
      value: {
        weight: "light",
        concentration: "low",
        balance_direction: "moisture",
        ingredient_flags: ["oils", "humectants"],
      },
    },
    preferred_source_type: "brand",
    preferred_image_urls: [],
    image_search_notes: [
      "Official Garnier page exposes a line sharing image; exact mask packshot may require a retailer/image-search candidate before approval.",
    ],
  },
  {
    slug: "neqi-the-beautiful-people-leave-in-moisturizing-mist",
    name: "Leave-In Moisturizing Mist",
    brand: "Neqi",
    identityBrand: "Neqi",
    productLine: "NEQI x @_the.beautiful.people",
    category: "Leave-in",
    category_key: "leave_in",
    description:
      "Leichtes Detangling- und Anti-Frizz-Spray aus der NEQI x THE BEAUTIFUL PEOPLE Linie fuer geschmeidigere Laengen.",
    short_description: null,
    tom_take: null,
    affiliate_link: "https://www.rossmann.de/de/pflege-und-duft-neqi-leave-in-mist/p/4063528103222",
    purchase_link_status: "available",
    source_urls: [
      "https://neqi-hair.com/products/neqi-x-the-beautiful-people-leave-in-mist",
      "https://www.rossmann.de/de/pflege-und-duft-neqi-leave-in-mist/p/4063528103222",
    ],
    source_notes: [
      "NEQI direct product page names the collab line, product, Detangling, Anti-Frizz, and heat-protection positioning.",
      "Rossmann is the preferred German purchase URL for the exact GTIN 4063528103222.",
    ],
    price_eur: 12.99,
    currency: "EUR",
    size: "180 ml",
    tags: ["leave-in", "spray", "hitzeschutz", "feuchtigkeit", "anti-frizz"],
    suitable_thicknesses: ["fine", "normal", "coarse"],
    suitable_concerns: ["moisture_anti_frizz", "dryness", "tangling", "frizz"],
    sort_order_hint: 69,
    spec: {
      table: "product_leave_in_fit_specs",
      value: {
        weight: "light",
        conditioner_relationship: "booster_only",
        care_benefits: ["heat_protect", "detangle_smooth"],
      },
      legacyLeaveInSpec: {
        format: "spray",
        weight: "light",
        roles: ["extension_conditioner", "styling_prep"],
        provides_heat_protection: true,
        heat_protection_max_c: null,
        heat_activation_required: false,
        care_benefits: ["moisture", "detangling", "anti_frizz", "shine"],
        ingredient_flags: ["silicones", "proteins", "humectants", "oils"],
        application_stage: ["towel_dry", "dry_hair", "pre_heat"],
      },
    },
    preferred_source_type: "brand",
    preferred_image_urls: [
      "https://neqi-hair.com/cdn/shop/files/NQ_TBP_Onlineshop_Single_Spray_001.png?v=1778057006&width=1024",
    ],
    image_search_notes: ["NEQI Shopify page exposes a direct 2000x2000 PNG packshot."],
  },
]

function parseArgs(argv: string[]) {
  return {
    prepareReview: argv.includes("--prepare-review"),
    dryRun: argv.includes("--dry-run"),
    apply: argv.includes("--apply"),
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function normalize(value: string | null | undefined): string {
  return slugify(value ?? "").replaceAll("-", " ")
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T
}

function loadLocalEnv(): void {
  loadEnv({ path: ".env.local" })
}

function createSupabaseClient(): SupabaseClient {
  loadLocalEnv()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function assertApplyTarget(argv = process.argv): void {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
  const hostname = new URL(supabaseUrl).hostname
  if (hostname !== EXPECTED_SUPABASE_HOSTNAME) {
    throw new Error(
      `Refusing to apply catalog additions to ${hostname}. Expected ${EXPECTED_SUPABASE_HOSTNAME}.`,
    )
  }
  if (!argv.includes(CONFIRM_PROJECT_FLAG)) {
    throw new Error(`Refusing to apply without ${CONFIRM_PROJECT_FLAG}.`)
  }
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

async function runLiveSchemaPreflight(supabase: SupabaseClient) {
  const checks = [
    {
      table: "products",
      columns: [
        "id",
        "name",
        "brand",
        "description",
        "short_description",
        "tom_take",
        "category",
        "category_key",
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
      ],
    },
    { table: "brands", columns: ["id", "canonical_name", "normalized_name"] },
    { table: "brand_aliases", columns: ["id", "brand_id", "product_line_id", "alias"] },
    { table: "product_lines", columns: ["id", "brand_id", "canonical_name", "normalized_name"] },
    {
      table: "product_conditioner_specs",
      columns: ["product_id", "thickness", "protein_moisture_balance"],
    },
    {
      table: "product_conditioner_rerank_specs",
      columns: ["product_id", "weight", "repair_level", "balance_direction", "ingredient_flags"],
    },
    {
      table: "product_mask_specs",
      columns: ["product_id", "weight", "concentration", "balance_direction", "ingredient_flags"],
    },
    {
      table: "product_leave_in_fit_specs",
      columns: ["product_id", "weight", "conditioner_relationship", "care_benefits"],
    },
    {
      table: "product_leave_in_specs",
      columns: [
        "product_id",
        "format",
        "weight",
        "roles",
        "provides_heat_protection",
        "heat_protection_max_c",
        "heat_activation_required",
        "care_benefits",
        "ingredient_flags",
        "application_stage",
      ],
    },
  ]

  for (const check of checks) {
    await assertSelectableColumns(supabase, check.table, check.columns)
  }

  return {
    checked_at: new Date().toISOString(),
    project: EXPECTED_SUPABASE_PROJECT_ID,
    tables: checks,
  }
}

async function fetchExistingProducts(supabase: SupabaseClient) {
  const brands = [...new Set(PRODUCT_DRAFTS.flatMap((draft) => [draft.brand, draft.identityBrand]))]
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,name,brand,category,category_key,affiliate_link,image_url,price_eur,currency,tags,suitable_thicknesses,suitable_concerns,is_active,sort_order,brand_id,product_line_id,origin,is_chaarlie_recommended",
    )
    .in("brand", brands)
    .order("category", { ascending: true })
    .order("name", { ascending: true })

  if (error) throw error
  return data ?? []
}

async function fetchCategorySortOrders(supabase: SupabaseClient): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  for (const category of [...new Set(PRODUCT_DRAFTS.map((draft) => draft.category))]) {
    const { data, error } = await supabase
      .from("products")
      .select("sort_order")
      .eq("category", category)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    result.set(category, Math.max(Number(data?.sort_order ?? 0), 0))
  }
  return result
}

async function fetchIdentityRows(supabase: SupabaseClient) {
  const { data: brands, error: brandError } = await supabase
    .from("brands")
    .select("id,canonical_name,normalized_name")
    .in("canonical_name", [...new Set(PRODUCT_DRAFTS.map((draft) => draft.identityBrand))])
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

export function resolveIdentity(
  draft: ProductDraft,
  identityRows: Awaited<ReturnType<typeof fetchIdentityRows>>,
) {
  const brand = identityRows.brands.find(
    (row) => normalize(row.canonical_name) === normalize(draft.identityBrand),
  )
  const productLine =
    draft.productLine && brand
      ? identityRows.lines.find(
          (row) =>
            row.brand_id === brand.id &&
            normalize(row.canonical_name) === normalize(draft.productLine),
        )
      : null

  return {
    brand_id: brand?.id ?? null,
    product_line_id: productLine?.id ?? null,
    missing_brand: brand ? null : draft.identityBrand,
    missing_product_line: draft.productLine && !productLine ? draft.productLine : null,
  }
}

export function expectedPublicImageUrl(draft: Pick<ProductDraft, "slug">): {
  storagePath: string
  publicUrl: string
} {
  const storagePath = `catalog-additions/${RUN_DATE}/${draft.slug}/${draft.slug}.webp`
  return {
    storagePath,
    publicUrl: `${PRODUCT_IMAGE_PUBLIC_URL_PREFIX}${storagePath}`,
  }
}

export function buildProductPayload(params: {
  draft: ProductDraft
  sortOrder: number
  identity: ReturnType<typeof resolveIdentity>
  generatedAt: string
}): ProductPayload {
  return {
    name: params.draft.name,
    brand: params.draft.identityBrand,
    description: params.draft.description,
    short_description: params.draft.short_description,
    tom_take: params.draft.tom_take,
    category: params.draft.category,
    category_key: params.draft.category_key,
    affiliate_link: params.draft.affiliate_link,
    image_url: expectedPublicImageUrl(params.draft).publicUrl,
    price_eur: params.draft.price_eur,
    currency: params.draft.currency,
    tags: params.draft.tags,
    suitable_thicknesses: params.draft.suitable_thicknesses,
    suitable_concerns: params.draft.suitable_concerns,
    is_active: true,
    lifecycle_status: "active",
    purchase_link_status: params.draft.purchase_link_status,
    purchase_link_checked_at: params.generatedAt,
    price_checked_at: params.generatedAt,
    sort_order: params.sortOrder,
    brand_id: params.identity.brand_id,
    product_line_id: params.identity.product_line_id,
    origin: "curated",
    is_chaarlie_recommended: true,
  }
}

export function buildPackagePayload(params: {
  draft: ProductDraft
  product: ProductPayload
  identity: ReturnType<typeof resolveIdentity>
  generatedAt: string
}): PackagePayload {
  const unsigned = {
    product: params.product,
    spec: params.draft.spec,
    identity: {
      brand: params.draft.identityBrand,
      product_line: params.draft.productLine,
      resolved_brand_id: params.identity.brand_id,
      resolved_product_line_id: params.identity.product_line_id,
    },
    sources: {
      urls: params.draft.source_urls,
      notes: params.draft.source_notes,
      size: params.draft.size,
    },
  }

  return {
    ...unsigned,
    review: {
      payload_sha256: sha256(JSON.stringify(unsigned)),
      generated_at: params.generatedAt,
      approval_required_before_image_upload: true,
      approval_required_before_db_write: true,
    },
  }
}

export function collisionReport(draft: ProductDraft, existingProducts: any[]) {
  const draftName = normalize(draft.name)
  const exact = existingProducts.filter(
    (row) => normalize(row.name) === draftName && row.category === draft.category,
  )
  const near = existingProducts
    .filter((row) => row.category === draft.category)
    .filter((row) => {
      const rowName = normalize(row.name)
      return (
        rowName.includes(draftName) ||
        draftName.includes(rowName) ||
        rowName.split(" ").some((part: string) => part.length > 5 && draftName.includes(part))
      )
    })
    .filter((row) => !exact.some((exactRow) => exactRow.id === row.id))

  return {
    product: draft.name,
    category: draft.category,
    blocking_exact_matches: exact,
    near_matches_for_review: near,
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
      },
    })
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  }
}

function htmlAttr(value: string): string {
  return value.replaceAll("&quot;", '"').replaceAll("&#x2F;", "/").replaceAll("\\/", "/")
}

export function isBrandSourceUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "")
    return ["neqi-hair.com", "syoss.net", "garnier.de"].some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    )
  } catch {
    return false
  }
}

function extractMeta(html: string, keys: string[]): string[] {
  const results: string[] = []
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "gi"),
      new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "gi"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`, "gi"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["']`, "gi"),
    ]
    for (const pattern of patterns) {
      for (const match of html.matchAll(pattern)) {
        results.push(htmlAttr(match[1]))
      }
    }
  }
  return [...new Set(results)]
}

function extractImageUrls(html: string, baseUrl: string): string[] {
  const candidates = [
    ...extractMeta(html, ["og:image", "og:image:secure_url", "twitter:image"]),
    ...[...html.matchAll(/"image"\s*:\s*"([^"]+)"/gi)].map((match) => htmlAttr(match[1])),
    ...[
      ...html.matchAll(/https?:\\?\/\\?\/[^"'\\\s]+?\.(?:png|jpe?g|webp)(?:\?[^"'\\\s]*)?/gi),
    ].map((match) => htmlAttr(match[0])),
  ]
    .map((candidate) => {
      try {
        return new URL(candidate.replaceAll("\\/", "/"), baseUrl).toString()
      } catch {
        return null
      }
    })
    .filter((candidate): candidate is string => Boolean(candidate))
    .filter((candidate) => !candidate.includes("favicon"))
    .filter((candidate) => !candidate.includes("icon"))

  return [...new Set(candidates)]
}

function extensionFromUrl(url: string): string {
  const cleanPath = new URL(url).pathname
  const extension = extname(cleanPath).toLowerCase()
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(extension)) return extension
  return ".jpg"
}

async function downloadImage(url: string, filePath: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "image/avif,image/webp,image/png,image/jpeg",
      },
    })
    if (!response.ok) return false
    const contentType = response.headers.get("content-type") ?? ""
    if (!contentType.startsWith("image/")) return false
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, Buffer.from(await response.arrayBuffer()))
    return true
  } catch {
    return false
  }
}

async function createPreviewImage(params: {
  sourceFile: string | null
  outputFile: string
  label: string
}): Promise<void> {
  await mkdir(join(params.outputFile, ".."), { recursive: true })
  if (params.sourceFile && existsSync(params.sourceFile)) {
    const source = await sharp(params.sourceFile)
      .resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true })
      .toBuffer()
    await sharp({
      create: {
        width: 1200,
        height: 1200,
        channels: 4,
        background: FINAL_IMAGE_BACKGROUND,
      },
    })
      .composite([{ input: source, gravity: "center" }])
      .webp({ quality: 92 })
      .toFile(params.outputFile)
    return
  }

  const svg = Buffer.from(`
    <svg width="1200" height="1200" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="1200" fill="rgb(243,239,232)"/>
      <text x="600" y="560" text-anchor="middle" font-family="Arial" font-size="42" fill="#333">Image candidate pending</text>
      <text x="600" y="630" text-anchor="middle" font-family="Arial" font-size="28" fill="#666">${params.label}</text>
    </svg>
  `)
  await sharp(svg).webp({ quality: 92 }).toFile(params.outputFile)
}

async function prepareImageCandidates(draft: ProductDraft, packageDir: string) {
  const candidates: ImageCandidate[] = draft.preferred_image_urls.map((imageUrl) => ({
    source_page_url: draft.source_urls[0],
    source_image_url: imageUrl,
    source_type: draft.preferred_source_type,
    confidence: "high",
    local_file: null,
  }))
  for (const sourceUrl of draft.source_urls) {
    const html = await fetchHtml(sourceUrl)
    if (!html) continue
    for (const imageUrl of extractImageUrls(html, sourceUrl).slice(0, 8)) {
      candidates.push({
        source_page_url: sourceUrl,
        source_image_url: imageUrl,
        source_type: isBrandSourceUrl(sourceUrl) ? "brand" : "retailer",
        confidence: imageUrl.includes("og:image") ? "medium" : "high",
        local_file: null,
      })
    }
  }

  let selected = candidates[0] ?? null
  let selectedLocalFile: string | null = null
  for (const candidate of candidates) {
    const extension = extensionFromUrl(candidate.source_image_url)
    const localFile = join(packageDir, "images", "source", `${draft.slug}${extension}`)
    const downloaded = await downloadImage(candidate.source_image_url, localFile)
    if (downloaded) {
      candidate.local_file = relative(packageDir, localFile)
      selected = candidate
      selectedLocalFile = localFile
      break
    }
  }

  const previewFile = join(packageDir, "images", "final", `${draft.slug}-review-preview.webp`)
  await createPreviewImage({
    sourceFile: selectedLocalFile,
    outputFile: previewFile,
    label: draft.name,
  })

  return {
    candidates,
    selected,
    selectedLocalFile,
    previewFile,
  }
}

async function prepareReviewPackages(params: {
  supabase: SupabaseClient
  preflight: unknown
  existingProducts: any[]
  identityRows: Awaited<ReturnType<typeof fetchIdentityRows>>
  sortOrders: Map<string, number>
}) {
  const generatedAt = new Date().toISOString()
  const duplicateReports = PRODUCT_DRAFTS.map((draft) =>
    collisionReport(draft, params.existingProducts),
  )
  const packageSummaries = []
  const categoryCounters = new Map<string, number>()

  for (const draft of PRODUCT_DRAFTS) {
    const packageDir = join(PACKAGE_ROOT, `internal-${draft.slug}`)
    await mkdir(packageDir, { recursive: true })
    const identity = resolveIdentity(draft, params.identityRows)
    const currentMaxSortOrder = params.sortOrders.get(draft.category) ?? 0
    const offset = categoryCounters.get(draft.category) ?? 0
    categoryCounters.set(draft.category, offset + 1)

    const product = buildProductPayload({
      draft,
      identity,
      generatedAt,
      sortOrder: Math.max(currentMaxSortOrder + offset + 1, draft.sort_order_hint),
    })
    const payload = buildPackagePayload({ draft, product, identity, generatedAt })
    const imageResult = await prepareImageCandidates(draft, packageDir)
    const finalImage = expectedPublicImageUrl(draft)

    await writeFile(
      join(packageDir, "research.md"),
      [
        `# ${draft.name}`,
        "",
        `Brand display: ${draft.brand}`,
        `Identity brand: ${draft.identityBrand}`,
        `Product line: ${draft.productLine ?? "(none)"}`,
        `Category: ${draft.category} / ${draft.category_key}`,
        `Size: ${draft.size ?? "unknown"}`,
        `Price: ${draft.price_eur} ${draft.currency}`,
        "",
        "## Sources",
        ...draft.source_urls.map((url) => `- ${url}`),
        "",
        "## Notes",
        ...draft.source_notes.map((note) => `- ${note}`),
        "",
        "## Image Notes",
        ...draft.image_search_notes.map((note) => `- ${note}`),
        "",
        "## Review Gate",
        "Nick must approve this package's property-review.json, image-review.json, local preview, and payload.json before image upload or database write.",
        "",
      ].join("\n"),
    )
    await writeJson(join(packageDir, "payload.json"), payload)
    await writeJson(join(packageDir, "property-review.json"), {
      status: "pending_user_review",
      product: payload.product,
      spec: payload.spec,
      identity: payload.identity,
      confidence: {
        commercial_metadata: draft.slug === "gliss-ultimate-repair-spuelung" ? "medium" : "high",
        category_specs:
          draft.slug === "garnier-wahre-schaetze-haarmaske-aktivkohle" ? "medium" : "high",
      },
      caveats: [
        identity.missing_brand
          ? `Brand identity will be created on apply: ${identity.missing_brand}`
          : null,
        identity.missing_product_line
          ? `Product line will be created on apply: ${identity.missing_product_line}`
          : null,
        draft.slug === "garnier-wahre-schaetze-haarmaske-aktivkohle"
          ? "Purchase URL may need replacing with a retailer URL before final apply."
          : null,
        draft.slug === "gliss-ultimate-repair-spuelung"
          ? "Rossmann source can be bot-protected; price/image should be checked in review."
          : null,
      ].filter(Boolean),
    })
    await writeJson(join(packageDir, "image-candidates.json"), {
      status: imageResult.candidates.length > 0 ? "candidates_found" : "needs_manual_candidate",
      candidates: imageResult.candidates,
    })
    await writeJson(join(packageDir, "image-review.json"), {
      status: "pending_user_review",
      selected_candidate: imageResult.selected,
      local_preview: relative(packageDir, imageResult.previewFile),
      final_image_requirement:
        "Approve only after background removal/final preview is visually acceptable.",
    })
    await writeJson(join(packageDir, "image-finalization.json"), {
      status: "pending_user_approval",
      storage_bucket: PRODUCT_IMAGE_BUCKET,
      storage_path: finalImage.storagePath,
      public_url: finalImage.publicUrl,
      final_file: relative(packageDir, imageResult.previewFile),
      user_approved: false,
      notes: "Do not upload or write this image URL until Nick approves the local preview.",
    })
    await writeJson(join(packageDir, "package-approval.json"), {
      status: "pending_user_approval",
      payload_sha256: payload.review.payload_sha256,
      approved_by: null,
      approved_at: null,
      notes:
        "Set status to approved only after Nick approves properties, image, and dry-run payload.",
    })

    packageSummaries.push({
      product: draft.name,
      package_dir: packageDir,
      payload_sha256: payload.review.payload_sha256,
      preview: imageResult.previewFile,
      candidates: imageResult.candidates.length,
      identity,
    })
  }

  await writeJson(join(PACKAGE_ROOT, "schema-preflight.json"), params.preflight)
  await writeJson(join(PACKAGE_ROOT, "duplicate-collision-report.json"), duplicateReports)
  await writeJson(join(PACKAGE_ROOT, "package-summary.json"), {
    generated_at: generatedAt,
    stop_line:
      "No image upload or database write has been performed. Nick approval is required before apply.",
    packages: packageSummaries,
  })

  console.log(`Prepared ${packageSummaries.length} review packages under ${PACKAGE_ROOT}`)
  console.table(
    packageSummaries.map((summary) => ({
      product: summary.product,
      package: summary.package_dir,
      candidates: summary.candidates,
      preview: summary.preview,
    })),
  )
}

async function generateDryRun(params: {
  preflight: unknown
  existingProducts: any[]
  identityRows: Awaited<ReturnType<typeof fetchIdentityRows>>
  sortOrders: Map<string, number>
}) {
  const generatedAt = new Date().toISOString()
  const categoryCounters = new Map<string, number>()
  const payloads = PRODUCT_DRAFTS.map((draft) => {
    const identity = resolveIdentity(draft, params.identityRows)
    const currentMaxSortOrder = params.sortOrders.get(draft.category) ?? 0
    const offset = categoryCounters.get(draft.category) ?? 0
    categoryCounters.set(draft.category, offset + 1)
    const product = buildProductPayload({
      draft,
      identity,
      generatedAt,
      sortOrder: Math.max(currentMaxSortOrder + offset + 1, draft.sort_order_hint),
    })
    return buildPackagePayload({ draft, product, identity, generatedAt })
  })

  const report = {
    generated_at: generatedAt,
    mode: "dry-run",
    stop_line:
      "No writes executed. Apply requires approved package files and --apply --confirm-project=pqdkhefxsxkyeqelqegq.",
    schema_preflight: params.preflight,
    duplicate_collision_report: PRODUCT_DRAFTS.map((draft) =>
      collisionReport(draft, params.existingProducts),
    ),
    payloads,
  }

  await mkdir(PACKAGE_ROOT, { recursive: true })
  await writeJson(join(PACKAGE_ROOT, "dry-run-output.json"), report)
  console.log(`Dry run only. Wrote ${join(PACKAGE_ROOT, "dry-run-output.json")}`)
  console.table(
    payloads.map((payload) => ({
      product: payload.product.name,
      category: payload.product.category,
      image_url: payload.product.image_url,
      spec_table: payload.spec.table,
      brand_id: payload.product.brand_id ?? "(create/resolve on apply)",
      product_line_id:
        payload.identity.product_line == null
          ? "(none)"
          : (payload.product.product_line_id ?? "(create/resolve on apply)"),
    })),
  )
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

function assertLocalApprovals(packageDir: string, payload: PackagePayload): void {
  const approvalPath = join(packageDir, "package-approval.json")
  const imagePath = join(packageDir, "image-finalization.json")
  if (!existsSync(approvalPath) || !existsSync(imagePath)) {
    throw new Error(`Missing approval files in ${packageDir}`)
  }

  const approval = readJson<any>(approvalPath)
  const image = readJson<any>(imagePath)
  if (approval.status !== "approved" || approval.payload_sha256 !== payload.review.payload_sha256) {
    throw new Error(`Package is not approved or payload hash changed: ${packageDir}`)
  }
  if (image.status !== "approved_asset" || image.user_approved !== true) {
    throw new Error(`Image is not approved for upload: ${packageDir}`)
  }
}

async function uploadApprovedImage(
  supabase: SupabaseClient,
  packageDir: string,
  payload: PackagePayload,
): Promise<void> {
  const image = readJson<any>(join(packageDir, "image-finalization.json"))
  if (image.status !== "approved_asset" || image.user_approved !== true) {
    throw new Error(`Image is not approved for upload: ${packageDir}`)
  }
  if (image.public_url !== payload.product.image_url) {
    throw new Error(`Approved image URL does not match product payload image_url: ${packageDir}`)
  }
  if (image.storage_bucket !== PRODUCT_IMAGE_BUCKET) {
    throw new Error(`Approved image bucket must be ${PRODUCT_IMAGE_BUCKET}: ${packageDir}`)
  }
  if (!image.storage_path || typeof image.storage_path !== "string") {
    throw new Error(`Approved image storage_path is missing: ${packageDir}`)
  }
  if (!image.final_file || typeof image.final_file !== "string") {
    throw new Error(`Approved image final_file is missing: ${packageDir}`)
  }

  const localFinalFile = join(packageDir, image.final_file)
  if (!existsSync(localFinalFile)) {
    throw new Error(`Approved final image file does not exist: ${localFinalFile}`)
  }

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(image.storage_path, readFileSync(localFinalFile), {
      contentType: "image/webp",
      upsert: true,
    })
  if (error) throw error
}

async function applyApprovedPackages(supabase: SupabaseClient): Promise<void> {
  assertApplyTarget()
  for (const draft of PRODUCT_DRAFTS) {
    const packageDir = join(PACKAGE_ROOT, `internal-${draft.slug}`)
    const payloadPath = join(packageDir, "payload.json")
    if (!existsSync(payloadPath)) {
      throw new Error(`Missing payload. Run --prepare-review first: ${payloadPath}`)
    }
    const payload = readJson<PackagePayload>(payloadPath)
    assertLocalApprovals(packageDir, payload)
    await uploadApprovedImage(supabase, packageDir, payload)

    const brandId = await findOrCreateBrand(supabase, draft.identityBrand)
    const productLineId = draft.productLine
      ? await findOrCreateProductLine(supabase, brandId, draft.productLine)
      : null

    const productPayload = {
      ...payload.product,
      brand_id: brandId,
      product_line_id: productLineId,
    }

    const { data: affiliateMatches, error: affiliateMatchError } = await supabase
      .from("products")
      .select("id")
      .eq("affiliate_link", productPayload.affiliate_link)
      .limit(2)
    if (affiliateMatchError) throw affiliateMatchError
    if ((affiliateMatches ?? []).length > 1) {
      throw new Error(`Multiple existing products share affiliate_link for ${productPayload.name}`)
    }

    const { data: nameCategoryMatch, error: nameCategoryMatchError } =
      (affiliateMatches ?? []).length === 0
        ? await supabase
            .from("products")
            .select("id")
            .eq("name", productPayload.name)
            .eq("category", productPayload.category)
            .maybeSingle()
        : { data: null, error: null }
    if (nameCategoryMatchError) throw nameCategoryMatchError

    const existing = (affiliateMatches ?? [])[0] ?? nameCategoryMatch
    const productWritePayload = existing?.id
      ? productPayload
      : { ...productPayload, is_active: false }

    const { data: saved, error: productError } = existing?.id
      ? await supabase
          .from("products")
          .update(productWritePayload)
          .eq("id", existing.id)
          .select("id")
          .single()
      : await supabase.from("products").insert(productWritePayload).select("id").single()
    if (productError) throw productError

    const specPayload = { product_id: saved.id, ...payload.spec.value }
    const { error: specError } = await supabase
      .from(payload.spec.table)
      .upsert(specPayload, { onConflict: "product_id" })
    if (specError) throw specError

    if (draft.spec.table === "product_leave_in_fit_specs") {
      const { error: legacySpecError } = await supabase
        .from("product_leave_in_specs")
        .upsert(
          { product_id: saved.id, ...draft.spec.legacyLeaveInSpec },
          { onConflict: "product_id" },
        )
      if (legacySpecError) throw legacySpecError
    }

    if (!existing?.id && productPayload.is_active) {
      const { error: activateError } = await supabase
        .from("products")
        .update({ is_active: true })
        .eq("id", saved.id)
      if (activateError) throw activateError
    }

    console.log(`Applied ${productPayload.name} (${saved.id})`)
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.prepareReview && !args.dryRun && !args.apply) {
    throw new Error(
      "Usage: tsx scripts/catalog-additions/prepare-2026-06-27-products.ts --prepare-review|--dry-run|--apply",
    )
  }

  const supabase = createSupabaseClient()
  const preflight = await runLiveSchemaPreflight(supabase)
  const [existingProducts, identityRows, sortOrders] = await Promise.all([
    fetchExistingProducts(supabase),
    fetchIdentityRows(supabase),
    fetchCategorySortOrders(supabase),
  ])

  if (args.prepareReview) {
    await prepareReviewPackages({ supabase, preflight, existingProducts, identityRows, sortOrders })
  }

  if (args.dryRun) {
    await generateDryRun({ preflight, existingProducts, identityRows, sortOrders })
  }

  if (args.apply) {
    await applyApprovedPackages(supabase)
  }
}

if (basename(process.argv[1] ?? "") === "prepare-2026-06-27-products.ts") {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
