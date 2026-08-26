import { verifyScannerIdentifierBackfill } from "@/lib/product-intake/catalog-enrichment/scanner-identifier-backfill"
import { runScannerIdentifierBackfillPreflight } from "./scanner-identifier-backfill-preflight"

async function main() {
  const result = await runScannerIdentifierBackfillPreflight(process.argv.slice(2))
  if (!result.preflight.ok)
    throw new Error(`scanner identifier verify blocked: ${result.preflight.blockers.join("; ")}`)
  const verification = await verifyScannerIdentifierBackfill({
    manifest: result.manifest,
    read: result.adapters.read,
  })
  process.stdout.write(`${JSON.stringify(verification, null, 2)}\n`)
  process.exitCode = verification.ok ? 0 : 1
}
void main()
