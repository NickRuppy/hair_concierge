import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import {
  applyB1,
  assertB1BatchSelection,
  loadB1Manifests,
  parseB1ApplyArgs,
  preflightB1,
  sha256Bytes,
} from "@/lib/product-intake/catalog-enrichment/b1"
import { b1ClientAdapters } from "./b1-client"

async function main() {
  const argv = process.argv.slice(2)
  assertB1BatchSelection(argv)
  const args = parseB1ApplyArgs(argv)
  const adapters = b1ClientAdapters()
  const preflight = await preflightB1({ read: adapters.read })
  if (!args.apply) {
    process.stdout.write(`${JSON.stringify({ mode: "dry-run", preflight }, null, 2)}\n`)
    process.exitCode = preflight.ok ? 0 : 1
    return
  }
  const manifests = await loadB1Manifests()
  const images = await Promise.all(
    manifests.map(async ({ manifest }) => {
      const image = manifest.image as Record<string, unknown>
      const bytes = await readFile(resolve(String(image.local_asset_path)))
      return { path: String(image.expected_storage_path), bytes, sha256: sha256Bytes(bytes) }
    }),
  )
  const result = await applyB1({ args, preflight, images, write: adapters.write })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}
void main()
