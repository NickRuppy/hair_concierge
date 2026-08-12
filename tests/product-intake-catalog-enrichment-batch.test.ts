import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import test from "node:test"

import {
  catalogEnrichmentFingerprint,
  generateCatalogEnrichmentIndex,
  validateCatalogEnrichmentManifest,
} from "../src/lib/product-intake/catalog-enrichment"

const root = "data/catalog-enrichment/personal-plan-launch-v1/heat"

test("the approved Heat source cohort contains exactly seven valid manifests with a stable index", async () => {
  const files = (await readdir(root)).filter((file) => file.endsWith(".json")).sort()
  assert.equal(files.length, 7)
  const manifests = await Promise.all(
    files.map(async (file) => JSON.parse(await readFile(`${root}/${file}`, "utf8"))),
  )
  for (const manifest of manifests) {
    const validation = validateCatalogEnrichmentManifest(
      manifest,
      undefined,
      "legacy_personal_plan_launch_v1",
    )
    assert.equal(validation.ok, true)
    assert.equal(manifest.category_key, "heat_protectant")
  }
  const index = generateCatalogEnrichmentIndex(manifests)
  assert.equal(index.products.length, 7)
  assert.equal(
    catalogEnrichmentFingerprint(index),
    "f4edd43d54f9604b6287a86e5187a18bd44b4084260b0458ccbcde56cb6ee5f7",
  )
})
