import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  buildExpansionApplyBatch,
  canonicalGtin14,
  expansionItemKey,
  type ExpansionApplySupplement,
} from "@/lib/product-intake/expansion-apply"

/**
 * Preflight/parking rules of the Scan DB Expansion batch adapter (T5, F-04).
 * A product that cannot be published completely is PARKED with named gaps and
 * excluded from the apply payload — never trimmed, never sent half-written.
 */

const ROOT = new URL("../", import.meta.url)
const OPERATOR = "11111111-1111-4111-8111-111111111111"
const REVIEWED_HEAD = "b".repeat(40)
const IMAGE_PREFIX =
  "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/"

async function maskManifest() {
  return JSON.parse(
    await readFile(new URL("plans/scan-db-expansion/research/mask-manifest.json", ROOT), "utf8"),
  ) as { products: Array<{ final: Record<string, unknown> }> }
}

function supplementFor(
  manifest: { products: Array<{ final: Record<string, unknown> }> },
  override: (
    key: string,
    entry: ExpansionApplySupplement["products"][string],
  ) => ExpansionApplySupplement["products"][string] | null = (_key, entry) => entry,
): ExpansionApplySupplement {
  const products: ExpansionApplySupplement["products"] = {}
  for (const entry of manifest.products) {
    const product = entry.final.product as { brand: string; name: string }
    const key = expansionItemKey(product.brand, product.name)
    const evidenceSourceTexts: Record<string, string> = {}
    for (const evidence of entry.final.evidence as Array<{
      fact_key: string
      source_url: string
    }>) {
      evidenceSourceTexts[`${evidence.fact_key}|${evidence.source_url}`] = "Belegtext"
    }
    const value = override(key, {
      image_url: `${IMAGE_PREFIX}${key}.png`,
      affiliate_link: "https://www.dm.de/p/d/1/x",
      purchase_link_status: "available",
      checked_at: "2026-09-02T09:00:00.000Z",
      evidence_source_texts: evidenceSourceTexts,
      mask_wait_copy_de: "7 Sekunden einwirken lassen.",
    })
    if (value) products[key] = value
  }
  return { batch_id: "scan-expansion-test", operator_profile_id: OPERATOR, reviewed_head: REVIEWED_HEAD, products }
}

test("a deviation-flagged protocol parks the product for Nick's review (R4/F-06)", async () => {
  const manifest = await maskManifest()
  const result = buildExpansionApplyBatch({ manifest, supplement: supplementFor(manifest) })

  assert.equal(result.batch.items.length + result.parked.length, manifest.products.length)
  assert.ok(result.parked.length > 0)
  for (const parked of result.parked) {
    assert.ok(
      parked.gaps.some((gap) => gap.startsWith("deviation_requires_review")),
      `${parked.item_key}: ${parked.gaps.join("; ")}`,
    )
  }
  assert.ok(
    result.batch.items.every((item) => !result.parked.some((p) => p.item_key === item.item_key)),
  )
})

test("a product without a finalized own-bucket image is parked, not published (R5/T4b)", async () => {
  const manifest = await maskManifest()
  const supplement = supplementFor(manifest, (_key, entry) => ({
    ...entry,
    image_url: "https://products.dm-static.com/images/candidate.jpg",
  }))
  const result = buildExpansionApplyBatch({ manifest, supplement })

  assert.equal(result.batch.items.length, 0)
  assert.ok(
    result.parked.every((parked) =>
      parked.gaps.some((gap) => gap.startsWith("missing_finalized_image")),
    ),
  )
})

test("a product with no operator supplement is parked with a named gap", async () => {
  const manifest = await maskManifest()
  const supplement = supplementFor(manifest, (key, entry) =>
    key.startsWith("garnier") ? null : entry,
  )
  const result = buildExpansionApplyBatch({ manifest, supplement })

  const parked = result.parked.find((entry) => entry.item_key?.startsWith("garnier"))
  assert.ok(parked)
  assert.deepEqual(parked.gaps, [
    "missing_operator_supplement (finalized image, purchase link, checked_at)",
  ])
})

test("evidence with no derivable source text is parked — the T2 contract gap is surfaced, not invented", async () => {
  const manifest = await maskManifest()
  const supplement = supplementFor(manifest, (_key, entry) => ({
    ...entry,
    evidence_source_texts: {},
  }))
  const result = buildExpansionApplyBatch({ manifest, supplement })

  // The mask manifest's manufacturer-claim evidence rows point at a URL no
  // protocol source covers, so their quoted text cannot be derived.
  const withGap = result.parked.filter((parked) =>
    parked.gaps.some((gap) => gap.startsWith("evidence_source_text_missing")),
  )
  assert.ok(withGap.length > 0)
})

test("a canonical GTIN already owned by another product parks the item", async () => {
  const manifest = await maskManifest()
  const target = manifest.products.find((entry) => {
    const product = entry.final.product as { brand: string; name: string }
    return expansionItemKey(product.brand, product.name).startsWith("garnier")
  })
  assert.ok(target)
  const gtin = (target.final.identifiers as Array<{ value: string }>)[0]!.value

  const result = buildExpansionApplyBatch({
    manifest,
    supplement: supplementFor(manifest),
    existingIdentifiers: [
      { product_id: "cccccccc-0000-4000-8000-000000000003", canonical_gtin14: canonicalGtin14(gtin) },
    ],
  })

  const parked = result.parked.find((entry) => entry.item_key?.startsWith("garnier"))
  assert.ok(parked)
  assert.ok(parked.gaps.some((gap) => gap.startsWith("canonical_gtin_already_owned")))
})

test("an active product with the same brand+name parks the item as an identity collision (F-09)", async () => {
  const manifest = await maskManifest()
  const target = manifest.products.find((entry) => {
    const product = entry.final.product as { brand: string; name: string }
    return expansionItemKey(product.brand, product.name).startsWith("garnier")
  })
  assert.ok(target)
  const product = target.final.product as { brand: string; name: string; category_key: string }

  const result = buildExpansionApplyBatch({
    manifest,
    supplement: supplementFor(manifest),
    existingProducts: [
      {
        id: "dddddddd-0000-4000-8000-000000000004",
        name: `${product.brand} ${product.name}`,
        brand: product.brand,
        category_key: product.category_key,
        is_active: true,
        lifecycle_status: "active",
        is_chaarlie_recommended: false,
      },
    ],
  })

  const parked = result.parked.find((entry) => entry.item_key?.startsWith("garnier"))
  assert.ok(parked)
  assert.ok(parked.gaps.some((gap) => gap.startsWith("identity_collision")))
})

test("the emitted batch never carries a recommendation flag (R3)", async () => {
  const manifest = await maskManifest()
  const result = buildExpansionApplyBatch({ manifest, supplement: supplementFor(manifest) })
  assert.ok(result.batch.items.length > 0)
  assert.doesNotMatch(result.batchJson, /is_chaarlie_recommended/)
})
