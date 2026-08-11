import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import {
  applyScalp,
  assertScalpBatchSelection,
  loadScalpManifests,
  parseScalpApplyArgs,
  preflightScalp,
  scalpProjectIdFromUrl,
  sha256Bytes,
} from "@/lib/product-intake/catalog-enrichment/scalp"
import { scalpClientAdapters, scalpGitState } from "./scalp-client"

async function main() {
  const argv = process.argv.slice(2)
  assertScalpBatchSelection(argv)
  const args = parseScalpApplyArgs(argv)
  const adapters = scalpClientAdapters()
  const preflight = await preflightScalp({
    read: adapters.read,
    release: {
      reviewedHead: args.reviewed_head ?? "",
      projectId: scalpProjectIdFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") ?? "",
      expectScalpMigration: args.expect_scalp_migration ?? "applied",
    },
    gitState: scalpGitState,
  })
  if (!args.apply) {
    process.stdout.write(`${JSON.stringify({ mode: "dry-run", preflight }, null, 2)}\n`)
    process.exitCode = preflight.ok ? 0 : 1
    return
  }
  const manifests = await loadScalpManifests()
  const images = await Promise.all(
    manifests.map(async ({ manifest }) => {
      const image = manifest.image as Record<string, unknown>
      const bytes = await readFile(resolve(String(image.local_asset_path)))
      return { path: String(image.expected_storage_path), bytes, sha256: sha256Bytes(bytes) }
    }),
  )
  const result = await applyScalp({
    args,
    preflight,
    preflightInput: { read: adapters.read, gitState: scalpGitState },
    images,
    write: adapters.write,
  })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}
void main()
