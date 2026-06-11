import { config as loadEnv } from "dotenv"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { writeCsv, type CsvRow } from "../src/lib/affiliate-research/csv"
import { isUsableUrl, passesBrandDirect } from "../src/lib/affiliate-research/url-gate"
import {
  auditProductMetadata,
  type ExpectedPriceCheck,
  type ProductMetadataAuditInput,
  type ProductMetadataFinding,
} from "../src/lib/product-metadata/health"

const SELECT_COLUMNS =
  "id, name, brand, category, affiliate_link, image_url, price_eur, purchase_link_status, is_active"

const OUT_DIR = "tmp/product-metadata-audit"
const KNOWN_PRICE_CHECKS_PATH = "data/product-metadata-audit/known-price-checks.json"
const GUHL_ID = "11d42d9d-b8d8-42ae-a432-9a3d0f9d3504"
const GUHL_REPLACEMENT_URL =
  "https://www.mueller.de/p/guhl-panthenol-reparatur-2in1-kur-spuelung-IPN3052207/"
const USER_AGENT =
  "ChaarlieProductMetadataAudit/1.0 (+read-only purchase link review; contact: product metadata audit)"

type KnownPriceCheck = ExpectedPriceCheck & {
  source_name?: string
}

type BuyabilityStatus = "available" | "unavailable" | null

type ProductRow = ProductMetadataAuditInput

type AuditOutputRow = ProductRow & {
  finding_types: string[]
  findings: ProductMetadataFinding[]
}

type PurchaseLinkReviewProposalRow = {
  id: string
  category: string | null
  brand: string | null
  name: string | null
  affiliate_link: string | null
  price_eur: number | string | null
  checked_purchase_link_status: BuyabilityStatus
  replacement_affiliate_link: string | null
  replacement_price_eur: number | null
  replacement_purchase_link_status: BuyabilityStatus
  replacement_evidence: string | null
  review_action: "keep_link" | "replace_link" | "manual_review"
}

const AUDIT_CSV_HEADER = [
  "id",
  "category",
  "brand",
  "name",
  "affiliate_link",
  "image_url",
  "price_eur",
  "purchase_link_status",
  "is_active",
  "finding_types",
  "findings_json",
]

const PROPOSAL_CSV_HEADER = [
  "id",
  "category",
  "brand",
  "name",
  "affiliate_link",
  "price_eur",
  "checked_purchase_link_status",
  "replacement_affiliate_link",
  "replacement_price_eur",
  "replacement_purchase_link_status",
  "replacement_evidence",
  "review_action",
]

function readKnownPriceChecks(): KnownPriceCheck[] {
  const text = readFileSync(KNOWN_PRICE_CHECKS_PATH, "utf-8")
  return JSON.parse(text) as KnownPriceCheck[]
}

function isMissingColumnError(error: { code?: string; message?: string }): boolean {
  const message = error.message?.toLowerCase() ?? ""
  return (
    error.code === "42703" ||
    message.includes("purchase_link_status") ||
    message.includes("column") ||
    message.includes("schema cache")
  )
}

function createSupabaseClientFromEnv(): SupabaseClient {
  loadEnv({ path: ".env.local" })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function fetchProducts(supabase: SupabaseClient): Promise<ProductRow[]> {
  const pageSize = 1000
  let from = 0
  const all: ProductRow[] = []

  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select(SELECT_COLUMNS)
      .order("category", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      if (isMissingColumnError(error)) {
        throw new Error(
          [
            "Product metadata audit requires the Task 1 schema migration before it can run.",
            `Supabase could not select one of: ${SELECT_COLUMNS}.`,
            `Original error: ${error.message}`,
          ].join(" "),
        )
      }
      throw error
    }

    if (!data || data.length === 0) break
    all.push(...(data as ProductRow[]))
    if (data.length < pageSize) break
    from += pageSize
  }

  return all
}

function normalizeBodyText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ")
}

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle))
}

function classifyKnownRetailerContent(
  host: string,
  brand: string | null,
  text: string,
): BuyabilityStatus {
  if (host === "rossmann.de" || host.endsWith(".rossmann.de")) {
    if (text.includes("online momentan nicht verfügbar")) return "unavailable"
    if (includesAny(text, ["in den warenkorb", "zum warenkorb"])) return "available"
    return null
  }

  if (host === "mueller.de" || host.endsWith(".mueller.de")) {
    if (text.includes("lieferbar") && text.includes("in den warenkorb")) return "available"
    return null
  }

  if (host === "dm.de" || host.endsWith(".dm.de")) {
    if (
      includesAny(text, [
        "online momentan nicht verfügbar",
        "online nicht verfügbar",
        "nicht online verfügbar",
      ])
    ) {
      return "unavailable"
    }
    if (includesAny(text, ["lieferbar", "online verfügbar", "in den warenkorb"])) return "available"
    return null
  }

  const usesGenericBeautyRule =
    host === "douglas.de" ||
    host.endsWith(".douglas.de") ||
    host === "notino.de" ||
    host.endsWith(".notino.de") ||
    host === "flaconi.de" ||
    host.endsWith(".flaconi.de") ||
    host === "hagel-shop.de" ||
    host.endsWith(".hagel-shop.de") ||
    host === "epres-hair.de" ||
    host.endsWith(".epres-hair.de") ||
    passesBrandDirect(host, brand)

  if (!usesGenericBeautyRule) return null

  if (
    includesAny(text, [
      "ausverkauft",
      "nicht verfügbar",
      "nicht lieferbar",
      "out of stock",
      "sold out",
    ])
  ) {
    return "unavailable"
  }

  if (
    includesAny(text, [
      "in den warenkorb",
      "zum warenkorb",
      "in den einkaufswagen",
      "auf lager",
      "vorrätig",
      "lieferbar",
      "in stock",
      "add to cart",
      "add to bag",
    ])
  ) {
    return "available"
  }

  return null
}

export async function checkStoredLinkBuyability(row: ProductRow): Promise<BuyabilityStatus> {
  if (typeof row.affiliate_link !== "string" || !isUsableUrl(row.affiliate_link)) {
    return "unavailable"
  }

  const url = row.affiliate_link.trim()
  const host = new URL(url).hostname.toLowerCase()

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.6",
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) return null

    const text = normalizeBodyText(await response.text())
    return classifyKnownRetailerContent(host, row.brand, text)
  } catch {
    return null
  }
}

function toCsvValue(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value
  return String(value)
}

function auditToCsvRow(row: AuditOutputRow): CsvRow {
  return {
    id: row.id,
    category: toCsvValue(row.category),
    brand: toCsvValue(row.brand),
    name: toCsvValue(row.name),
    affiliate_link: toCsvValue(row.affiliate_link),
    image_url: toCsvValue(row.image_url),
    price_eur: toCsvValue(row.price_eur),
    purchase_link_status: toCsvValue(row.purchase_link_status),
    is_active: toCsvValue(row.is_active),
    finding_types: row.finding_types.join("|"),
    findings_json: JSON.stringify(row.findings),
  }
}

function proposalToCsvRow(row: PurchaseLinkReviewProposalRow): CsvRow {
  return {
    id: row.id,
    category: toCsvValue(row.category),
    brand: toCsvValue(row.brand),
    name: toCsvValue(row.name),
    affiliate_link: toCsvValue(row.affiliate_link),
    price_eur: toCsvValue(row.price_eur),
    checked_purchase_link_status: toCsvValue(row.checked_purchase_link_status),
    replacement_affiliate_link: toCsvValue(row.replacement_affiliate_link),
    replacement_price_eur: toCsvValue(row.replacement_price_eur),
    replacement_purchase_link_status: toCsvValue(row.replacement_purchase_link_status),
    replacement_evidence: toCsvValue(row.replacement_evidence),
    review_action: row.review_action,
  }
}

function buildGuhlReplacement(check: KnownPriceCheck | undefined): {
  replacement_affiliate_link: string
  replacement_price_eur: number
  replacement_purchase_link_status: "available"
  replacement_evidence: string
} {
  return {
    replacement_affiliate_link: GUHL_REPLACEMENT_URL,
    replacement_price_eur: check?.expected_price_eur ?? 4.95,
    replacement_purchase_link_status: "available",
    replacement_evidence:
      "Reviewed Müller product page for Guhl Panthenol Reparatur 2in1 Kur & Spülung; expected price 4.95 EUR.",
  }
}

async function buildProposalRows(
  products: ProductRow[],
  knownPriceChecksById: Map<string, KnownPriceCheck>,
): Promise<PurchaseLinkReviewProposalRow[]> {
  const proposalRows: PurchaseLinkReviewProposalRow[] = []

  for (const product of products) {
    const checkedStatus = await checkStoredLinkBuyability(product)
    const knownCheck = knownPriceChecksById.get(product.id)

    if (product.id === GUHL_ID) {
      const replacement = buildGuhlReplacement(knownCheck)
      proposalRows.push({
        id: product.id,
        category: product.category,
        brand: product.brand,
        name: product.name,
        affiliate_link: product.affiliate_link,
        price_eur: product.price_eur,
        checked_purchase_link_status: checkedStatus,
        replacement_affiliate_link: replacement.replacement_affiliate_link,
        replacement_price_eur: replacement.replacement_price_eur,
        replacement_purchase_link_status: replacement.replacement_purchase_link_status,
        replacement_evidence: replacement.replacement_evidence,
        review_action: "replace_link",
      })
      continue
    }

    proposalRows.push({
      id: product.id,
      category: product.category,
      brand: product.brand,
      name: product.name,
      affiliate_link: product.affiliate_link,
      price_eur: product.price_eur,
      checked_purchase_link_status: checkedStatus,
      replacement_affiliate_link: null,
      replacement_price_eur: null,
      replacement_purchase_link_status: null,
      replacement_evidence: null,
      review_action: checkedStatus === "available" ? "keep_link" : "manual_review",
    })
  }

  return proposalRows
}

async function main() {
  const supabase = createSupabaseClientFromEnv()
  const knownPriceChecks = readKnownPriceChecks()
  const knownPriceChecksById = new Map(knownPriceChecks.map((check) => [check.id, check]))
  const products = await fetchProducts(supabase)

  const auditRows: AuditOutputRow[] = products.flatMap((product) => {
    const findings = auditProductMetadata(product, knownPriceChecksById.get(product.id))
    if (findings.length === 0) return []
    return [
      {
        ...product,
        finding_types: findings.map((finding) => finding.type),
        findings,
      },
    ]
  })

  const proposalRows = await buildProposalRows(products, knownPriceChecksById)

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(
    join(OUT_DIR, "product-metadata-audit.json"),
    `${JSON.stringify(auditRows, null, 2)}\n`,
    "utf-8",
  )
  writeCsv(
    join(OUT_DIR, "product-metadata-audit.csv"),
    AUDIT_CSV_HEADER,
    auditRows.map(auditToCsvRow),
  )

  writeFileSync(
    join(OUT_DIR, "purchase-link-review-proposal.json"),
    `${JSON.stringify(proposalRows, null, 2)}\n`,
    "utf-8",
  )
  writeCsv(
    join(OUT_DIR, "purchase-link-review-proposal.csv"),
    PROPOSAL_CSV_HEADER,
    proposalRows.map(proposalToCsvRow),
  )

  console.log(`Fetched ${products.length} products.`)
  console.log(`Wrote ${auditRows.length} audit rows with findings to ${OUT_DIR}.`)
  console.log(`Wrote ${proposalRows.length} purchase-link review proposal rows to ${OUT_DIR}.`)
  console.log("No Supabase writes were performed.")
}

function isDirectExecution(): boolean {
  const scriptPath = process.argv[1] ?? ""
  return (
    scriptPath.endsWith("audit-product-metadata.ts") ||
    scriptPath.endsWith("audit-product-metadata.js")
  )
}

if (isDirectExecution()) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
