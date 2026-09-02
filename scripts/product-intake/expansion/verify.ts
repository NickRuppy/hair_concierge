import { readFile } from "node:fs/promises"

import type { SupabaseClient } from "@supabase/supabase-js"

import { loadScanProductFacts } from "@/lib/personal-plan/products/authority/catalog-facts"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { evaluateScanCatalogReadiness } from "@/lib/scan/catalog-readiness"
import { canonicalizeGtin } from "@/lib/product-identity/normalize"

import { createSupabaseClientFromEnv, flag, parseArgs } from "../cli"

/**
 * Verify for the Scan DB Expansion batch adapter (T5/T6).
 *
 * Runs the SAME readiness oracle the coverage export uses
 * (`evaluateScanCatalogReadiness` + the strict `scan_result_ready` definition in
 * scripts/scanner-catalog-coverage/readiness-export.ts) over the applied product
 * ids and prints the per-SKU strict report. Acceptance is 100% of applied.
 *
 * Usage:
 *   npm run products:intake:expansion:verify -- --batch <path> [--product-id <uuid> ...]
 */

type Blocker =
  | "has_disposition"
  | "missing_presentation_image"
  | "missing_product_facts"
  | "missing_required_protocol"
  | "missing_barcode"
  | "verdict_unknown"
  | "verdict_error"

async function resolveProductIds(
  client: SupabaseClient,
  batchPath: string | null,
  explicit: string[],
): Promise<string[]> {
  if (explicit.length > 0) return explicit
  if (!batchPath) throw new Error("expansion_verify_requires_batch_or_product_ids")
  const batch = JSON.parse(await readFile(batchPath, "utf8")) as {
    batch_id: string
    items: Array<{ item_key: string }>
  }
  const { data, error } = await client
    .from("catalog_enrichment_applied_items")
    .select("product_key,product_id")
    .eq("batch_id", batch.batch_id)
  if (error) throw new Error(`expansion_verify_ledger_read_failed:${error.message}`)
  return (data ?? []).map((row) => String((row as { product_id: unknown }).product_id))
}

async function main() {
  const args = parseArgs()
  const batchPath = flag(args, "batch")
  const explicit = args.positional.filter((value) => /^[0-9a-f-]{36}$/i.test(value))
  const client = createSupabaseClientFromEnv()
  const productIds = await resolveProductIds(client, batchPath, explicit)

  if (productIds.length === 0) {
    process.stderr.write("No applied product ids found for this batch.\n")
    process.exitCode = 1
    return
  }

  const { data: products, error } = await client
    .from("products")
    .select("id,name,category_key,is_active,lifecycle_status,image_url")
    .in("id", productIds)
  if (error) throw new Error(`expansion_verify_product_read_failed:${error.message}`)

  const { data: identifiers } = await client
    .from("product_identifiers")
    .select("product_id,identifier_type,identifier_value")
    .in("product_id", productIds)
  const { data: dispositions } = await client
    .from("personal_plan_product_search_dispositions")
    .select("product_id")
    .in("product_id", productIds)

  const barcodeOwners = new Set(
    (identifiers ?? [])
      .filter(
        (row) =>
          ["ean", "gtin", "barcode"].includes(String((row as Record<string, unknown>).identifier_type)) &&
          canonicalizeGtin(String((row as Record<string, unknown>).identifier_value ?? "")) !== null,
      )
      .map((row) => String((row as Record<string, unknown>).product_id)),
  )
  const dispositionOwners = new Set(
    (dispositions ?? []).map((row) => String((row as Record<string, unknown>).product_id)),
  )

  let ready = 0
  process.stdout.write(`Strict scan-readiness report (${productIds.length} applied SKUs)\n\n`)

  for (const row of (products ?? []) as Array<Record<string, unknown>>) {
    const productId = String(row.id)
    const category = String(row.category_key) as PersonalPlanCategory
    const evaluated = await evaluateScanCatalogReadiness({
      category,
      productId,
      loadFacts: (targetCategory, targetProductId, selectionContext) =>
        loadScanProductFacts(client, targetCategory, targetProductId, selectionContext),
    })
    const blockers: Blocker[] = []
    if (dispositionOwners.has(productId)) blockers.push("has_disposition")
    if (typeof row.image_url !== "string" || row.image_url.trim() === "")
      blockers.push("missing_presentation_image")
    if (!barcodeOwners.has(productId)) blockers.push("missing_barcode")
    if (!evaluated.factsPresent) blockers.push("missing_product_facts")
    if (!evaluated.protocolsComplete) blockers.push("missing_required_protocol")
    if (evaluated.verdicts.some((verdict) => verdict.verdict === "unknown"))
      blockers.push("verdict_unknown")
    if (evaluated.verdicts.some((verdict) => verdict.verdict === "error"))
      blockers.push("verdict_error")

    const status = blockers.length === 0 ? "scan_result_ready" : "blocked"
    if (status === "scan_result_ready") ready += 1
    process.stdout.write(
      `[${status === "scan_result_ready" ? "READY  " : "BLOCKED"}] ${String(row.name)} (${category})\n`,
    )
    if (blockers.length > 0) process.stdout.write(`          blockers: ${blockers.join(", ")}\n`)
    for (const verdict of evaluated.verdicts) {
      process.stdout.write(
        `          ${verdict.profile.padEnd(6)} ${verdict.role.padEnd(30)} ${verdict.verdict}\n`,
      )
    }
  }

  process.stdout.write(
    `\nAcceptance: ${ready}/${productIds.length} strict scan-ready (${
      ready === productIds.length ? "PASS" : "FAIL — 100% required"
    })\n`,
  )
  if (ready !== productIds.length) process.exitCode = 1
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
