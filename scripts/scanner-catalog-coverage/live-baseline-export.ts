import { createHash } from "node:crypto"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, sep } from "node:path"

import { config as loadEnv } from "dotenv"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { canonicalizeGtin } from "../../src/lib/product-identity/normalize"

const OUTPUT_PATH = "data/scanner-catalog-coverage/2026-08-26/live-baseline.json"
const PAGE_SIZE = 500
const BARCODE_TYPES = new Set(["ean", "gtin", "barcode"])
const FACT_TABLES = [
  "product_shampoo_specs",
  "product_conditioner_specs",
  "product_conditioner_rerank_specs",
  "product_leave_in_specs",
  "product_leave_in_fit_specs",
  "product_leave_in_eligibility",
  "product_heat_protectant_specs",
  "product_oil_specs",
  "product_oil_eligibility",
  "product_mask_specs",
  "product_scalp_care_specs",
  "product_dry_shampoo_specs",
  "product_bondbuilder_specs",
  "product_deep_cleansing_shampoo_specs",
] as const

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
type Row = Record<string, unknown>

export type BaselineProduct = {
  product_id: string
  identity: {
    canonical_brand: string | null
    product_line: string | null
    clean_name: string | null
    category_key: string
  }
  lifecycle: { is_active: boolean; lifecycle_status: string | null; origin: string | null }
  recommendation: { is_chaarlie_recommended: boolean }
  commercial: {
    affiliate_link: string | null
    affiliate_link_present: boolean
    price_eur: number | string | null
    purchase_link_status: string | null
  }
  image: { image_url_present: boolean }
  identifiers: Array<{
    identifier_type: string
    identifier_value: string
    canonical_gtin14: string | null
    source: string | null
  }>
  disposition: { disposition: string; reason_code: string } | null
  readiness: {
    has_barcode: boolean
    has_category_facts: boolean
    has_protocol: boolean
    scan_candidate: boolean
  }
  category_primary_facts: Record<string, Array<Record<string, Json>>>
  protocols: Array<{
    category: string | null
    role: string | null
    application_family: string | null
    has_guidance_payload: boolean
  }>
}

export type LiveBaseline = {
  schema_version: 1
  exported_at: string
  source: { project_ref: string; read_only: true; supported_categories: string[] }
  reconciliation: {
    active_products: number
    barcode_linked_products: number
    barcode_rows: number
    by_category: Record<
      string,
      { active_products: number; barcode_linked_products: number; barcode_rows: number }
    >
  }
  open_submission_identity_candidates: {
    open_submission_count: number
    resolved_identity_candidates: Array<{
      submission_id: string
      status: string
      category: string | null
      canonical_brand: string | null
      product_line: string | null
      clean_name: string | null
      canonical_gtin14: string | null
    }>
  }
  products: BaselineProduct[]
  content_fingerprint: string
}

function string(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}
function bool(value: unknown): boolean {
  return value === true
}
function numberLike(value: unknown): number | string | null {
  return typeof value === "number" || typeof value === "string" ? value : null
}
export function sanitizeEvidenceRoute(value: unknown): string | null {
  const raw = string(value)
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === "https:" || url.protocol === "http:"
      ? `${url.origin}${url.pathname}`
      : null
  } catch {
    return null
  }
}
function stable(value: Json): Json {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key]!)]),
    )
  return value
}
export function fingerprint(
  value: Omit<LiveBaseline, "content_fingerprint" | "exported_at">,
): string {
  return createHash("sha256")
    .update(JSON.stringify(stable(value as unknown as Json)))
    .digest("hex")
}
function safeFact(row: Row): Record<string, Json> {
  const blocked = new Set([
    "id",
    "product_id",
    "created_at",
    "updated_at",
    "user_id",
    "source_url",
    "source_text",
  ])
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key, value]) => !blocked.has(key) && isJson(value))
      .sort(([a], [b]) => a.localeCompare(b)),
  ) as Record<string, Json>
}
function isJson(value: unknown): value is Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return true
  if (Array.isArray(value)) return value.every(isJson)
  return Boolean(value && typeof value === "object" && Object.values(value as Row).every(isJson))
}
function payloadIdentity(
  value: unknown,
): {
  canonical_brand: string | null
  product_line: string | null
  clean_name: string | null
  canonical_gtin14: string | null
} | null {
  if (!value || typeof value !== "object") return null
  const final = (value as Row).final
  if (!final || typeof final !== "object") return null
  const product = (final as Row).product
  if (!product || typeof product !== "object") return null
  const row = product as Row
  const canonical_brand = string(row.canonical_brand)
  const clean_name = string(row.clean_name)
  if (!canonical_brand && !clean_name) return null
  const identifiers = Array.isArray((final as Row).identifiers)
    ? ((final as Row).identifiers as Row[])
    : []
  const canonical_gtin14 =
    identifiers
      .map((item) => canonicalizeGtin(string(item.identifier_value) ?? ""))
      .find((item) => item !== null) ?? null
  return { canonical_brand, product_line: string(row.product_line), clean_name, canonical_gtin14 }
}

export function buildBaseline(input: {
  products: Row[]
  brands?: Row[]
  productLines?: Row[]
  categories: Row[]
  identifiers: Row[]
  facts: Record<string, Row[]>
  protocols: Row[]
  dispositions: Row[]
  submissions: Row[]
  exportedAt: string
  projectRef: string
}): LiveBaseline {
  const supported = new Set(
    input.categories
      .filter((row) => bool(row.is_catalog_supported))
      .map((row) => string(row.key))
      .filter((value): value is string => value !== null),
  )
  const active = input.products.filter(
    (row) =>
      bool(row.is_active) &&
      string(row.lifecycle_status) === "active" &&
      supported.has(string(row.category_key) ?? ""),
  )
  const activeIds = new Set(active.map((row) => String(row.id)))
  const identifiers = input.identifiers.filter(
    (row) =>
      activeIds.has(String(row.product_id)) && BARCODE_TYPES.has(string(row.identifier_type) ?? ""),
  )
  const identifiersByProduct = new Map<string, Row[]>()
  for (const row of identifiers) {
    const key = String(row.product_id)
    identifiersByProduct.set(key, [...(identifiersByProduct.get(key) ?? []), row])
  }
  const factsByProduct = new Map<string, Record<string, Row[]>>()
  for (const [table, rows] of Object.entries(input.facts))
    for (const row of rows) {
      const key = String(row.product_id)
      if (activeIds.has(key)) {
        const current = factsByProduct.get(key) ?? {}
        current[table] = [...(current[table] ?? []), row]
        factsByProduct.set(key, current)
      }
    }
  const protocolByProduct = new Map<string, Row[]>()
  for (const row of input.protocols) {
    const key = String(row.product_id)
    if (activeIds.has(key)) protocolByProduct.set(key, [...(protocolByProduct.get(key) ?? []), row])
  }
  const dispositionByProduct = new Map(
    input.dispositions.map((row) => [String(row.product_id), row]),
  )
  const brands = new Map(
    (input.brands ?? []).map((row) => [String(row.id), string(row.canonical_name)]),
  )
  const productLines = new Map(
    (input.productLines ?? []).map((row) => [String(row.id), string(row.canonical_name)]),
  )
  const products = active
    .map((row): BaselineProduct => {
      const productId = String(row.id)
      const productIdentifiers = (identifiersByProduct.get(productId) ?? [])
        .map((item) => ({
          identifier_type: string(item.identifier_type) ?? "",
          identifier_value: string(item.identifier_value) ?? "",
          canonical_gtin14: canonicalizeGtin(string(item.identifier_value) ?? ""),
          source: string(item.source),
        }))
        .sort((a, b) =>
          `${a.identifier_type}\u0000${a.identifier_value}`.localeCompare(
            `${b.identifier_type}\u0000${b.identifier_value}`,
          ),
        )
      const factEntries: Array<[string, Array<Record<string, Json>>]> = Object.entries(
        factsByProduct.get(productId) ?? {},
      ).map(([table, rows]) => [
        table,
        rows.map(safeFact).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      ])
      const facts = Object.fromEntries(
        factEntries.sort(([a], [b]) => a.localeCompare(b)),
      ) as Record<string, Array<Record<string, Json>>>
      const protocolRows = (protocolByProduct.get(productId) ?? [])
        .map((item) => ({
          category: string(item.category),
          role: string(item.role),
          application_family: string(item.application_family),
          has_guidance_payload: Boolean(item.guidance_payload ?? item.guidance_payload_v2),
        }))
        .sort((a, b) =>
          `${a.category}\u0000${a.role}\u0000${a.application_family}`.localeCompare(
            `${b.category}\u0000${b.role}\u0000${b.application_family}`,
          ),
        )
      const dispositionRow = dispositionByProduct.get(productId)
      const disposition = dispositionRow
        ? {
            disposition: string(dispositionRow.disposition) ?? "",
            reason_code: string(dispositionRow.reason_code) ?? "",
          }
        : null
      const hasBarcode = productIdentifiers.some((item) => item.canonical_gtin14 !== null)
      const hasFacts = Object.keys(facts).length > 0
      const affiliate_link = sanitizeEvidenceRoute(row.affiliate_link)
      return {
        product_id: productId,
        identity: {
          canonical_brand:
            brands.get(String(row.brand_id)) ?? string(row.canonical_brand) ?? string(row.brand),
          product_line: productLines.get(String(row.product_line_id)) ?? string(row.product_line),
          clean_name: string(row.clean_name) ?? string(row.name),
          category_key: string(row.category_key) ?? "",
        },
        lifecycle: {
          is_active: true,
          lifecycle_status: string(row.lifecycle_status),
          origin: string(row.origin),
        },
        recommendation: { is_chaarlie_recommended: bool(row.is_chaarlie_recommended) },
        commercial: {
          affiliate_link,
          affiliate_link_present: affiliate_link !== null,
          price_eur: numberLike(row.price_eur),
          purchase_link_status: string(row.purchase_link_status),
        },
        image: { image_url_present: Boolean(string(row.image_url)) },
        identifiers: productIdentifiers,
        disposition,
        readiness: {
          has_barcode: hasBarcode,
          has_category_facts: hasFacts,
          has_protocol: protocolRows.length > 0,
          scan_candidate: hasBarcode && hasFacts && protocolRows.length > 0 && disposition === null,
        },
        category_primary_facts: facts,
        protocols: protocolRows,
      }
    })
    .sort((a, b) =>
      `${a.identity.category_key}\u0000${a.identity.canonical_brand ?? ""}\u0000${a.identity.clean_name ?? ""}\u0000${a.product_id}`.localeCompare(
        `${b.identity.category_key}\u0000${b.identity.canonical_brand ?? ""}\u0000${b.identity.clean_name ?? ""}\u0000${b.product_id}`,
      ),
    )
  const byCategory: LiveBaseline["reconciliation"]["by_category"] = {}
  for (const product of products) {
    const bucket = byCategory[product.identity.category_key] ?? {
      active_products: 0,
      barcode_linked_products: 0,
      barcode_rows: 0,
    }
    bucket.active_products++
    if (product.readiness.has_barcode) bucket.barcode_linked_products++
    bucket.barcode_rows += product.identifiers.length
    byCategory[product.identity.category_key] = bucket
  }
  const candidates = input.submissions
    .filter((row) => ["pending_review", "researching"].includes(string(row.status) ?? ""))
    .flatMap((row) => {
      const identity = payloadIdentity(row.researched_payload)
      if (!identity) return []
      return [
        {
          submission_id: String(row.id),
          status: string(row.status) ?? "",
          category: string(row.category),
          ...identity,
        },
      ]
    })
    .sort((a, b) => a.submission_id.localeCompare(b.submission_id))
  const content = {
    schema_version: 1 as const,
    source: {
      project_ref: input.projectRef,
      read_only: true as const,
      supported_categories: [...supported].sort(),
    },
    reconciliation: {
      active_products: products.length,
      barcode_linked_products: products.filter((product) => product.readiness.has_barcode).length,
      barcode_rows: identifiers.length,
      by_category: Object.fromEntries(
        Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b)),
      ),
    },
    open_submission_identity_candidates: {
      open_submission_count: input.submissions.filter((row) =>
        ["pending_review", "researching"].includes(string(row.status) ?? ""),
      ).length,
      resolved_identity_candidates: candidates,
    },
    products,
  }
  return { exported_at: input.exportedAt, ...content, content_fingerprint: fingerprint(content) }
}

function loadLocalEnv() {
  const cwd = process.cwd()
  const root = cwd.includes(`${sep}.worktrees${sep}`)
    ? cwd.slice(0, cwd.indexOf(`${sep}.worktrees${sep}`))
    : cwd
  for (const path of [join(root, ".env.local"), join(cwd, ".env.local")])
    if (existsSync(path)) loadEnv({ path, override: false })
}
async function readAll(
  client: SupabaseClient,
  table: string,
  columns: string,
  orderBy: string,
): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`baseline_read_failed:${table}:${error.message}`)
    const page = (data ?? []) as unknown as Row[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}
async function main() {
  loadLocalEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("baseline_credentials_missing")
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const [
    products,
    brands,
    productLines,
    categories,
    identifiers,
    protocols,
    dispositions,
    submissions,
    ...factArrays
  ] = await Promise.all([
    readAll(
      client,
      "products",
      "id,brand,name,brand_id,product_line_id,category_key,origin,is_active,lifecycle_status,is_chaarlie_recommended,image_url,affiliate_link,price_eur,purchase_link_status",
      "id",
    ),
    readAll(client, "brands", "id,canonical_name", "id"),
    readAll(client, "product_lines", "id,canonical_name", "id"),
    readAll(client, "product_categories", "key,is_catalog_supported", "key"),
    readAll(
      client,
      "product_identifiers",
      "product_id,identifier_type,identifier_value,source",
      "product_id",
    ),
    readAll(
      client,
      "product_application_protocols",
      "product_id,category,role,application_family,guidance_payload,guidance_payload_v2",
      "product_id",
    ),
    readAll(
      client,
      "personal_plan_product_search_dispositions",
      "product_id,disposition,reason_code",
      "product_id",
    ),
    readAll(client, "product_submissions", "id,status,category,researched_payload", "id"),
    ...FACT_TABLES.map((table) => readAll(client, table, "*", "product_id")),
  ])
  const facts = Object.fromEntries(
    FACT_TABLES.map((table, index) => [table, factArrays[index] ?? []]),
  )
  const projectRef = new URL(url).hostname.split(".")[0] ?? "unknown"
  const baseline = buildBaseline({
    products,
    brands,
    productLines,
    categories,
    identifiers,
    facts,
    protocols,
    dispositions,
    submissions,
    exportedAt: new Date().toISOString(),
    projectRef,
  })
  const path = join(process.cwd(), OUTPUT_PATH)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(baseline, null, 2)}\n`)
  process.stdout.write(
    `${JSON.stringify({ path: OUTPUT_PATH, ...baseline.reconciliation, open_submission_count: baseline.open_submission_identity_candidates.open_submission_count, content_fingerprint: baseline.content_fingerprint })}\n`,
  )
}
if ((process.argv[1] ?? "").endsWith("live-baseline-export.ts"))
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
