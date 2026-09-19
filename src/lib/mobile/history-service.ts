import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { canonicalizeGtin, gtinQueryVariants } from "@/lib/product-identity/normalize"
import { OPEN_SUBMISSION_STATUSES } from "@/lib/product-intake/submissions"
import { PERSONAL_PLAN_PRODUCT_CATEGORIES } from "@/lib/personal-plan/products/contracts"
import { loadQuarantinedProductIdsAmong } from "@/lib/scan/catalog-eligibility"
import { validateEanInput } from "@/lib/scan/identifier-lookup"
import { MobileError } from "./errors"
import type { MobileScanResolveInput } from "./scan-service"
import type { MobileScanResolveResult } from "./scan-contracts"

export type MobileHistoryEntry = {
  id: string
  barcodeGtin: string | null
  productId: string | null
  productName: string | null
  brand: string | null
  imageUrl: string | null
  lastSeenAt: string
  status: "available" | "not_in_catalog" | "in_research" | "unavailable"
}
type HistoryRow = {
  id: string
  barcode_ean: string | null
  barcode_gtin14: string | null
  product_id: string | null
  submission_id: string | null
  last_seen_at: string
}
type SubmissionRow = {
  id: string
  scanned_identifier_value: string
  status: string
  approved_product_id: string | null
}
type ProductRow = {
  id: string
  name: string
  brand: string | null
  image_url: string | null
  category_key: string
  is_active: boolean
  lifecycle_status: string
}
const PAGE_SIZE = 100
const cursorSchema = z.object({ time: z.iso.datetime({ offset: true }), id: z.uuid() }).strict()

export function parseHistoryCursor(raw: string | null) {
  if (!raw) return null
  try {
    if (raw.length > 256 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error()
    return cursorSchema.parse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")))
  } catch {
    throw new MobileError("invalid_request", 400)
  }
}

/** Successful domain result stays usable even if optional History persistence fails. */
export async function recordMobileHistory(
  client: SupabaseClient,
  userId: string,
  input: MobileScanResolveInput & { recordHistory?: boolean },
  result: MobileScanResolveResult,
): Promise<boolean | undefined> {
  if (input.recordHistory === false) return undefined
  let productId: string | null
  switch (result.kind) {
    case "assessment":
    case "not_needed":
    case "profile_decision_deferred":
      productId = result.product.id
      break
    case "submission_required":
      productId = result.productId
      break
    case "authority_unavailable":
      if (result.reason === "temporarily_unavailable") return undefined
      productId = result.productId
      break
    default:
      return undefined
  }
  // A stale/nonexistent product id is not an opened catalog result.
  if (!input.identifier && !productId) return undefined
  return saveMobileHistory(client, userId, input.identifier?.value ?? null, productId)
}

export async function saveMobileHistory(
  client: SupabaseClient,
  userId: string,
  barcode: string | null,
  productId: string | null,
  submissionId: string | null = null,
): Promise<boolean> {
  try {
    const { data, error } = await client.rpc("mobile_scan_history_touch", {
      p_user_id: userId,
      p_barcode_ean: barcode,
      p_product_id: productId,
      p_submission_id: submissionId,
    })
    if (error || typeof data !== "string") throw new Error("history_write_failed")
    return true
  } catch {
    // No bearer, barcode or account identifier in diagnostics.
    console.warn("[mobile] history persistence unavailable")
    return false
  }
}

export async function clearMobileHistory(client: SupabaseClient, userId: string) {
  const { error } = await client.rpc("mobile_scan_history_clear", { p_user_id: userId })
  if (error) throw new MobileError("temporarily_unavailable", 503)
}

export async function loadMobileHistory(
  client: SupabaseClient,
  userId: string,
  rawCursor: string | null = null,
  barcode: string | null = null,
) {
  const cursor = parseHistoryCursor(rawCursor)
  const validation = barcode === null ? null : validateEanInput(barcode)
  if (validation && !validation.ok) throw new MobileError("invalid_identifier", 400)
  let query = client
    .from("mobile_scan_history")
    .select("id,barcode_ean,barcode_gtin14,product_id,submission_id,last_seen_at")
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1)
  if (validation?.ok) query = query.eq("barcode_gtin14", canonicalizeGtin(validation.value)!)
  // Both values have been strictly validated, not interpolated from raw client text.
  if (cursor)
    query = query.or(
      `last_seen_at.lt.${cursor.time},and(last_seen_at.eq.${cursor.time},id.lt.${cursor.id})`,
    )
  const { data, error } = await query
  if (error) throw new MobileError("temporarily_unavailable", 503)
  const allRows = (data ?? []) as HistoryRow[]
  const rows = allRows.slice(0, PAGE_SIZE)
  if (!rows.length) return { contractVersion: 1 as const, entries: [], nextCursor: null }

  const gtins = rows.flatMap((row) => (row.barcode_gtin14 ? [row.barcode_gtin14] : []))
  const submissionIds = rows.flatMap((row) => (row.submission_id ? [row.submission_id] : []))
  const barcodeVariants = [
    ...new Set(rows.flatMap((row) => (row.barcode_ean ? gtinQueryVariants(row.barcode_ean) : []))),
  ]
  const submissionFilters = [
    ...(submissionIds.length ? [`id.in.(${submissionIds.join(",")})`] : []),
    ...(barcodeVariants.length
      ? [
          `and(scanned_identifier_value.in.(${barcodeVariants.join(",")}),status.in.(${OPEN_SUBMISSION_STATUSES.join(",")}))`,
        ]
      : []),
  ]
  const [identifiers, submissions] = await Promise.all([
    gtins.length
      ? client
          .from("product_identifiers")
          .select("product_id,canonical_gtin14")
          .in("canonical_gtin14", gtins)
      : { data: [], error: null },
    submissionFilters.length
      ? client
          .from("product_submissions")
          .select("id,scanned_identifier_value,status,approved_product_id")
          .eq("user_id", userId)
          .eq("source", "scan")
          .or(submissionFilters.join(","))
          .order("created_at", { ascending: false })
      : { data: [], error: null },
  ])
  if (identifiers.error || submissions.error) throw new MobileError("temporarily_unavailable", 503)
  const identifierRows = (identifiers.data ?? []) as {
    product_id: string
    canonical_gtin14: string
  }[]
  const submissionRows = (submissions.data ?? []) as SubmissionRow[]
  const ids = [
    ...new Set([
      ...rows.flatMap((row) => (row.product_id ? [row.product_id] : [])),
      ...identifierRows.map((row) => row.product_id),
      ...submissionRows.flatMap((row) =>
        row.approved_product_id ? [row.approved_product_id] : [],
      ),
    ]),
  ]
  const [products, quarantined] = await Promise.all([
    ids.length
      ? client
          .from("products")
          .select("id,name,brand,image_url,category_key,is_active,lifecycle_status")
          .in("id", ids)
      : { data: [], error: null },
    loadQuarantinedProductIdsAmong(client, ids),
  ])
  if (products.error) throw new MobileError("temporarily_unavailable", 503)
  const productMap = new Map(
    ((products.data ?? []) as ProductRow[]).map((product) => [product.id, product]),
  )
  const entries: MobileHistoryEntry[] = rows.map((row) => {
    const matches = identifierRows.filter(
      (identifier) => identifier.canonical_gtin14 === row.barcode_gtin14,
    )
    // Linked request first. If its History write failed, the same owner's real open
    // request can still be shown when the barcode is rescanned; no inferred submission.
    const candidates = submissionRows.filter(
      (s) =>
        s.id === row.submission_id ||
        (row.barcode_gtin14 && canonicalizeGtin(s.scanned_identifier_value) === row.barcode_gtin14),
    )
    const pending = candidates.find((s) =>
      (OPEN_SUBMISSION_STATUSES as readonly string[]).includes(s.status),
    )
    const submitted = pending ?? candidates.find((s) => s.id === row.submission_id) ?? candidates[0]
    const productId =
      matches.length === 1
        ? matches[0].product_id
        : (row.product_id ?? submitted?.approved_product_id ?? null)
    const product = productId ? productMap.get(productId) : undefined
    // Disposition quarantine excludes catalog content from all scanner surfaces.
    // Retain the user's history identity/status, without redisplaying the hidden
    // catalog name, brand or image (including while a real request is pending).
    const displayProduct = product && !quarantined.has(product.id) ? product : undefined
    const available = Boolean(
      product &&
      product.is_active &&
      product.lifecycle_status === "active" &&
      !quarantined.has(product.id) &&
      (PERSONAL_PLAN_PRODUCT_CATEGORIES as readonly string[]).includes(product.category_key) &&
      // Barcode reopening uses live identifier lookup. A remembered product_id
      // cannot make a removed/corrected identifier mapping look available.
      (row.barcode_gtin14 === null || matches.length === 1),
    )
    return {
      id: row.id,
      barcodeGtin: row.barcode_ean,
      productId,
      productName: displayProduct?.name ?? null,
      brand: displayProduct?.brand ?? null,
      imageUrl: safeImageUrl(displayProduct?.image_url ?? null),
      lastSeenAt: row.last_seen_at,
      status: pending
        ? "in_research"
        : available
          ? "available"
          : productId || submitted
            ? "unavailable"
            : "not_in_catalog",
    }
  })
  const last = rows.at(-1)!
  const nextCursor =
    allRows.length > PAGE_SIZE
      ? Buffer.from(JSON.stringify({ time: last.last_seen_at, id: last.id })).toString("base64url")
      : null
  return { contractVersion: 1 as const, entries, nextCursor }
}

function safeImageUrl(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      ? url.toString()
      : null
  } catch {
    return null
  }
}
