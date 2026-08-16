import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const sourcePath = new URL(
  "../scripts/product-intake/catalog-enrichment/stage5-protocol-client.ts",
  import.meta.url,
)

test("Stage 5 protocol tooling uses the canonical product-spec relationship helper", async () => {
  const source = await readFile(sourcePath, "utf8")

  assert.match(source, /embedProductSpec/)
  for (const table of [
    "product_shampoo_specs",
    "product_leave_in_specs",
    "product_mask_specs",
    "product_oil_specs",
    "product_scalp_care_specs",
    "product_deep_cleansing_shampoo_specs",
  ]) {
    assert.match(source, new RegExp(`embedProductSpec\\(\"${table}\"`))
    assert.doesNotMatch(source, new RegExp(`${table}\\(`))
  }
})
