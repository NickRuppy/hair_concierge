import { pathToFileURL } from "node:url"

import { applyScannerIdentifierBackfill } from "@/lib/product-intake/catalog-enrichment/scanner-identifier-backfill"
import { runScannerIdentifierBackfillPreflight } from "./scanner-identifier-backfill-preflight"

async function main() {
  const result = await runScannerIdentifierBackfillPreflight(process.argv.slice(2))
  const applied = await applyScannerIdentifierBackfill({
    manifest: result.manifest,
    args: result.args,
    preflight: result.preflight,
    write: result.adapters.write,
    executionEnabled: process.env.SCANNER_IDENTIFIER_BACKFILL_ENABLED,
  })
  process.stdout.write(
    `${JSON.stringify(
      {
        ...applied,
        batch_fingerprint: result.manifest.batch_fingerprint,
        preflight: result.preflight,
      },
      null,
      2,
    )}\n`,
  )
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main()
