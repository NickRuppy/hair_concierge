import { mkdirSync, writeFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { dirname } from "node:path"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  buildExpansionApplyBatch,
  canonicalGtin14,
  type ExpansionApplyBuildInput,
  type ExpansionApplySupplement,
} from "@/lib/product-intake/expansion-apply"
import { validateExpansionManifest } from "@/lib/product-intake/expansion-manifest"

import { createSupabaseClientFromEnv, flag, flagBool, parseArgs } from "../cli"

/**
 * Preflight for the Scan DB Expansion batch adapter (T5).
 *
 * READ-ONLY. It validates the reviewed manifest, prints the complete would-write
 * diff, runs the duplicate/identity guards against a live read-only query (or a
 * snapshot file), predicts strict readiness, and parks every product that would
 * not publish completely (F-04). Parked products are excluded from the emitted
 * apply payload — they are never sent to prod incomplete.
 *
 * Usage:
 *   npm run products:intake:expansion:preflight -- \
 *     --manifest <path> --supplement <path> [--snapshot <path>] [--out <path>]
 */

const PAGE_SIZE = 500

type Row = Record<string, unknown>

type Snapshot = {
  products: NonNullable<ExpansionApplyBuildInput["existingProducts"]>
  identifiers: NonNullable<ExpansionApplyBuildInput["existingIdentifiers"]>
  dispositionProductIds: string[]
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
    if (error) throw new Error(`expansion_preflight_read_failed:${table}:${error.message}`)
    rows.push(...((data ?? []) as unknown as Row[]))
    if ((data ?? []).length < PAGE_SIZE) return rows
  }
}

async function loadLiveSnapshot(): Promise<Snapshot> {
  const client = createSupabaseClientFromEnv()
  const [products, identifiers, dispositions] = await Promise.all([
    readAll(
      client,
      "products",
      "id,name,brand,category_key,is_active,lifecycle_status,is_chaarlie_recommended",
      "id",
    ),
    readAll(client, "product_identifiers", "product_id,identifier_type,identifier_value", "product_id"),
    readAll(client, "personal_plan_product_search_dispositions", "product_id", "product_id"),
  ])
  return {
    products: products.map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      brand: row.brand == null ? null : String(row.brand),
      category_key: row.category_key == null ? null : String(row.category_key),
      is_active: row.is_active === true,
      lifecycle_status: row.lifecycle_status == null ? null : String(row.lifecycle_status),
      is_chaarlie_recommended: row.is_chaarlie_recommended === true,
    })),
    identifiers: identifiers.map((row) => ({
      product_id: String(row.product_id),
      canonical_gtin14: canonicalGtin14(String(row.identifier_value ?? "")),
    })),
    dispositionProductIds: dispositions.map((row) => String(row.product_id)),
  }
}

async function main() {
  const args = parseArgs()
  const manifestPath = flag(args, "manifest")
  const supplementPath = flag(args, "supplement")
  const snapshotPath = flag(args, "snapshot")
  const outPath = flag(args, "out")

  if (!manifestPath || !supplementPath) {
    process.stderr.write(
      "Usage: products:intake:expansion:preflight -- --manifest <path> --supplement <path> [--snapshot <path>] [--out <path>]\n",
    )
    process.exitCode = 1
    return
  }

  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as unknown
  const supplement = JSON.parse(
    await readFile(supplementPath, "utf8"),
  ) as ExpansionApplySupplement

  const manifestReport = validateExpansionManifest(manifest)
  process.stdout.write(`Manifest: ${manifestPath}\n`)
  process.stdout.write(
    `Manifest validation: ${manifestReport.ok ? "PASS" : "FAIL"} (${manifestReport.summary.productsPassed}/${manifestReport.summary.totalProducts} products)\n\n`,
  )
  for (const product of manifestReport.products.filter((item) => item.status === "fail")) {
    process.stdout.write(`  [FAIL] ${product.label}\n`)
    for (const violation of product.violations) process.stdout.write(`         - ${violation}\n`)
  }

  const snapshot: Snapshot = snapshotPath
    ? (JSON.parse(await readFile(snapshotPath, "utf8")) as Snapshot)
    : await loadLiveSnapshot()
  process.stdout.write(
    `Identity snapshot: ${snapshotPath ?? "live read-only query"} — ${snapshot.products.length} products, ${snapshot.identifiers.length} identifiers, ${snapshot.dispositionProductIds.length} dispositions\n\n`,
  )

  const result = buildExpansionApplyBatch({
    manifest,
    supplement,
    existingProducts: snapshot.products,
    existingIdentifiers: snapshot.identifiers,
    dispositionProductIds: snapshot.dispositionProductIds,
  })

  process.stdout.write(`Would-write diff (${result.batch.items.length} items):\n`)
  for (const item of result.batch.items) {
    if (item.kind === "existing_product_update") {
      process.stdout.write(`  [existing] ${item.item_key}\n`)
      if (item.rename) {
        process.stdout.write(`      rename: "${item.rename.from}" → "${item.rename.to}"\n`)
        process.stdout.write(`      reason: ${item.rename.reason}\n`)
      }
      for (const identifier of item.identifiers) {
        process.stdout.write(`      + identifier ${identifier.value} (${identifier.source_url})\n`)
      }
      continue
    }
    const product = item.final_payload.product as Record<string, unknown>
    process.stdout.write(`  [new] ${item.item_key} — ${item.category_key}\n`)
    process.stdout.write(
      `      products: "${String(product.canonical_brand)} ${String(product.clean_name)}", origin=curated, is_chaarlie_recommended=false\n`,
    )
    process.stdout.write(`      image_url: ${String(product.image_url)}\n`)
    process.stdout.write(
      `      identifiers: ${item.identifiers.map((identifier) => identifier.value).join(", ")}\n`,
    )
    for (const operation of item.spec_operations) {
      process.stdout.write(`      ${operation.table}: ${operation.rows.length} row(s)\n`)
      if (operation.table === "product_application_protocols") {
        for (const row of operation.rows as Array<Record<string, unknown>>) {
          process.stdout.write(
            `          role=${String(row.role)} contact_time=${String(row.contact_time_seconds)} rinse=${String(row.rinse_action)} source=${String(row.source_url)}\n`,
          )
        }
      }
    }
    process.stdout.write(
      `      suitable_thicknesses: ${item.product_updates.suitable_thicknesses.join(", ")}\n`,
    )
    process.stdout.write(
      `      suitable_concerns: ${item.product_updates.suitable_concerns.join(", ") || "(none)"}\n`,
    )
    process.stdout.write(`      fact evidence rows: ${item.evidence.length}\n`)
  }
  process.stdout.write("\n")

  process.stdout.write(`Strict-readiness prediction (${result.readinessPrediction.length}):\n`)
  for (const prediction of result.readinessPrediction) {
    process.stdout.write(
      `  [${prediction.predicted === "scan_result_ready" ? "READY" : "BLOCKED"}] ${prediction.item_key}${
        prediction.blockers.length > 0 ? ` — ${prediction.blockers.join(", ")}` : ""
      }\n`,
    )
  }
  process.stdout.write("\n")

  process.stdout.write(`Parked (${result.parked.length}) — excluded from the apply payload:\n`)
  for (const parked of result.parked) {
    process.stdout.write(`  - ${parked.label} (${parked.item_key ?? "no item key"})\n`)
    for (const gap of parked.gaps) process.stdout.write(`      · ${gap}\n`)
  }
  process.stdout.write("\n")

  process.stdout.write(`Batch fingerprint (sha256 of the raw UTF-8 payload):\n  ${result.batchFingerprint}\n`)
  process.stdout.write(`Items to apply: ${result.batch.items.length}\n`)

  if (outPath) {
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, result.batchJson)
    process.stdout.write(`\nWrote apply payload → ${outPath}\n`)
    process.stdout.write(
      "Register this exact fingerprint in a migration row of public.scan_expansion_approved_batches before applying.\n",
    )
  }

  const blocked = result.readinessPrediction.filter((item) => item.predicted !== "scan_result_ready")
  if (blocked.length > 0 || result.batch.items.length === 0) process.exitCode = 1
  if (flagBool(args, "strict") && result.parked.length > 0) process.exitCode = 1
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
