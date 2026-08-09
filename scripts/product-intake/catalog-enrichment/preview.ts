import { readFile } from "node:fs/promises"

import {
  isCatalogEnrichmentManifestPath,
  previewCatalogEnrichment,
} from "@/lib/product-intake/catalog-enrichment"

async function main() {
  const path = process.argv[2]
  if (!path || path.startsWith("-"))
    throw new Error("Usage: products:intake:catalog-enrichment:preview <manifest.json>")
  if (!isCatalogEnrichmentManifestPath(path))
    throw new Error("Manifest path must stay under data/catalog-enrichment")
  const result = previewCatalogEnrichment(JSON.parse(await readFile(path, "utf8")))
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exitCode = "errors" in result ? 1 : 0
}

void main()
