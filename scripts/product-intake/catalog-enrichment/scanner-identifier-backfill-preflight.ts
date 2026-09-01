import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"

import {
  parseScannerIdentifierBackfillArgs,
  parseScannerIdentifierBackfillManifest,
  preflightScannerIdentifierBackfill,
  SCANNER_IDENTIFIER_BACKFILL_PROJECT_ID,
} from "@/lib/product-intake/catalog-enrichment/scanner-identifier-backfill"
import {
  scannerIdentifierBackfillAdapters,
  scannerIdentifierBackfillGitState,
  scannerIdentifierBackfillProjectIdFromUrl,
} from "./scanner-identifier-backfill-client"

export async function runScannerIdentifierBackfillPreflight(argv: readonly string[]) {
  const args = parseScannerIdentifierBackfillArgs(argv)
  if (!args.manifest || !args.reviewed_head)
    throw new Error("preflight requires --manifest=<path> and --reviewed-head=<40-char-sha>")
  const raw = await readFile(args.manifest, "utf8")
  const manifest = parseScannerIdentifierBackfillManifest(raw)
  const adapters = scannerIdentifierBackfillAdapters()
  const projectId = scannerIdentifierBackfillProjectIdFromUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  )
  const preflight = await preflightScannerIdentifierBackfill({
    manifest,
    args,
    read: adapters.read,
    gitState: scannerIdentifierBackfillGitState,
    projectId,
  })
  return { manifest, args, adapters, projectId, preflight }
}

async function main() {
  const result = await runScannerIdentifierBackfillPreflight(process.argv.slice(2))
  process.stdout.write(
    `${JSON.stringify(
      {
        mode: "dry-run",
        project_id: result.projectId,
        expected_project_id: SCANNER_IDENTIFIER_BACKFILL_PROJECT_ID,
        batch: result.manifest.batch,
        batch_fingerprint: result.manifest.batch_fingerprint,
        preflight: result.preflight,
      },
      null,
      2,
    )}\n`,
  )
  process.exitCode = result.preflight.ok ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main()
