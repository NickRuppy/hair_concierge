import { readFile } from "node:fs/promises"

import {
  validateExpansionManifest,
  type ExpansionManifestItemReport,
} from "@/lib/product-intake/expansion-manifest"

/**
 * CLI validator for a research-engine "expansion manifest" (T2 of
 * plans/2026-09-01-scan-db-expansion-pilot.md). Pure local validation — this
 * script never calls Supabase or any network endpoint.
 *
 * Usage: npm run products:intake:expansion:validate -- --manifest <path>
 */

function parseArgs(argv: string[]): { manifestPath: string | null } {
  let manifestPath: string | null = null
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--manifest") {
      manifestPath = argv[index + 1] ?? null
      index += 1
    } else if (arg.startsWith("--manifest=")) {
      manifestPath = arg.slice("--manifest=".length)
    }
  }
  return { manifestPath }
}

function printItemReport(kind: string, item: ExpansionManifestItemReport) {
  const marker = item.status === "pass" ? "PASS" : "FAIL"
  process.stdout.write(`  [${marker}] ${kind}[${item.index}] ${item.label}\n`)
  for (const violation of item.violations) {
    process.stdout.write(`         - ${violation}\n`)
  }
}

async function main() {
  const { manifestPath } = parseArgs(process.argv.slice(2))
  if (!manifestPath) {
    process.stderr.write("Usage: products:intake:expansion:validate -- --manifest <path>\n")
    process.exitCode = 1
    return
  }

  let raw: unknown
  try {
    const contents = await readFile(manifestPath, "utf8")
    raw = JSON.parse(contents)
  } catch (error) {
    process.stderr.write(
      `Failed to read/parse manifest at ${manifestPath}: ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    )
    process.exitCode = 1
    return
  }

  const report = validateExpansionManifest(raw)

  process.stdout.write(`Expansion manifest: ${manifestPath}\n`)
  process.stdout.write(`Batch: ${report.batchId ?? "(unknown)"}\n\n`)

  if (report.envelopeViolations.length > 0) {
    process.stdout.write("Envelope violations:\n")
    for (const violation of report.envelopeViolations) {
      process.stdout.write(`  - ${violation}\n`)
    }
    process.stdout.write("\n")
  }

  process.stdout.write(`Products (${report.products.length}):\n`)
  for (const product of report.products) {
    printItemReport("products", product)
  }
  process.stdout.write("\n")

  process.stdout.write(`Existing-product updates (${report.existingProductUpdates.length}):\n`)
  for (const update of report.existingProductUpdates) {
    printItemReport("existing_product_updates", update)
  }
  process.stdout.write("\n")

  process.stdout.write(`Deviation-flagged products (${report.deviationFlagged.length}):\n`)
  for (const flagged of report.deviationFlagged) {
    process.stdout.write(
      `  - products[${flagged.index}] ${flagged.label}: ${flagged.templateIds.join(", ")}\n`,
    )
  }
  process.stdout.write("\n")

  process.stdout.write(`Excluded EANs (${report.excludedEans.length}):\n`)
  for (const excluded of report.excludedEans) {
    process.stdout.write(`  - products[${excluded.index}] ${excluded.label}: ${excluded.value}\n`)
  }
  process.stdout.write("\n")

  if (report.duplicateEans.length > 0) {
    process.stdout.write(`Duplicate EANs across the manifest (${report.duplicateEans.length}):\n`)
    for (const duplicate of report.duplicateEans) {
      process.stdout.write(`  - ${duplicate.value}: ${duplicate.occurrences.join(", ")}\n`)
    }
    process.stdout.write("\n")
  }

  const summary = report.summary
  process.stdout.write("Summary:\n")
  process.stdout.write(
    `  products: ${summary.productsPassed}/${summary.totalProducts} passed\n`,
  )
  process.stdout.write(
    `  existing_product_updates: ${summary.existingProductUpdatesPassed}/${summary.totalExistingProductUpdates} passed\n`,
  )
  process.stdout.write(`  deviation-flagged: ${summary.deviationFlaggedCount}\n`)
  process.stdout.write(`  excluded EANs: ${summary.excludedEanCount}\n`)
  process.stdout.write(`  duplicate EANs: ${summary.duplicateEanCount}\n`)
  process.stdout.write(`  overall: ${report.ok ? "PASS" : "FAIL"}\n`)

  process.exitCode = report.ok ? 0 : 1
}

void main()
