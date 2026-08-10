import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import {
  applyHeat,
  assertHeatBatchSelection,
  loadHeatManifests,
  parseHeatApplyArgs,
  preflightHeat,
  sha256Bytes,
  heatProjectIdFromUrl,
} from "@/lib/product-intake/catalog-enrichment/heat"
import { heatClientAdapters, heatGitState } from "./heat-client"

async function main() {
  const argv = process.argv.slice(2)
  assertHeatBatchSelection(argv)
  const args = parseHeatApplyArgs(argv)
  const adapters = heatClientAdapters()
  const preflight = await preflightHeat({
    read: adapters.read,
    release: {
      reviewedHead: args.reviewed_head ?? "",
      projectId: heatProjectIdFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") ?? "",
      expectMigration: args.expect_migration ?? "applied",
    },
    gitState: heatGitState,
  })
  if (!args.apply) {
    process.stdout.write(`${JSON.stringify({ mode: "dry-run", preflight }, null, 2)}\n`)
    process.exitCode = preflight.ok ? 0 : 1
    return
  }
  const manifests = await loadHeatManifests()
  const images = await Promise.all(
    manifests.map(async ({ manifest }) => {
      const image = manifest.image as Record<string, unknown>
      const bytes = await readFile(resolve(String(image.local_asset_path)))
      return { path: String(image.expected_storage_path), bytes, sha256: sha256Bytes(bytes) }
    }),
  )
  const result = await applyHeat({
    args,
    preflight,
    preflightInput: {
      read: adapters.read,
      gitState: heatGitState,
    },
    images,
    write: adapters.write,
  })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}
void main()
