import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  buildExpansionApplyBatch,
  canonicalGtin14,
  expansionItemKey,
  type ExpansionApplyExistingItem,
  type ExpansionApplyItem,
  type ExpansionApplySupplement,
} from "@/lib/product-intake/expansion-apply"

import { scanExpansionExecutionBlockers } from "../scripts/product-intake/expansion/apply"

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

async function researchManifest(file: string) {
  return JSON.parse(
    await readFile(new URL(`plans/scan-db-expansion/research/${file}`, ROOT), "utf8"),
  ) as { products: Array<{ final: Record<string, unknown> }> }
}

async function maskManifest() {
  return researchManifest("mask-manifest.json")
}

/** The stamped protocol rows an emitted item carries into the publication boundary. */
function protocolRoles(item: ExpansionApplyItem | ExpansionApplyExistingItem): string[] {
  if (item.kind !== "new_product") return []
  const specs = item.final_payload.category_specs as
    | { product_application_protocols?: Array<{ role: string }> }
    | undefined
  return (specs?.product_application_protocols ?? []).map((row) => row.role).sort()
}

/**
 * The reviewed German wait-step copy for ONE mask product.
 *
 * A single shared string cannot be right here: TPL-MASK's copy has to name this
 * product's own sourced window (§2.5), and for a null/range window it must be a
 * range or maximum form. Whole-minute windows are left to the builder's own
 * derivation; everything else reuses the manifest's own sourced wait sentence.
 */
function maskWaitCopyDe(entry: { final: Record<string, unknown> }): string | undefined {
  const protocol = (
    entry.final.protocols as
      | Array<{
          template_id: string
          contact_time?: { seconds: number | null; source_text: string }
        }>
      | undefined
  )?.find((candidate) => candidate.template_id === "TPL-MASK")
  const seconds = protocol?.contact_time?.seconds ?? null
  if (seconds !== null && seconds % 60 === 0) return undefined
  return protocol?.contact_time?.source_text
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
    const waitCopyDe = maskWaitCopyDe(entry)
    const value = override(key, {
      image_url: `${IMAGE_PREFIX}${key}.png`,
      affiliate_link: "https://www.dm.de/p/d/1/x",
      purchase_link_status: "available",
      checked_at: "2026-09-02T09:00:00.000Z",
      evidence_source_texts: evidenceSourceTexts,
      ...(waitCopyDe ? { mask_wait_copy_de: waitCopyDe } : {}),
    })
    if (value) products[key] = value
  }
  return {
    batch_id: "scan-expansion-test",
    operator_profile_id: OPERATOR,
    reviewed_head: REVIEWED_HEAD,
    products,
  }
}

test("the reviewed mask manifest parks only its excluded-identifier product", async () => {
  const manifest = await maskManifest()
  const result = buildExpansionApplyBatch({ manifest, supplement: supplementFor(manifest) })

  // Ruling R-C cleared every deviation from this manifest, so the only product
  // that cannot publish is the one whose single EAN failed the two-source rule
  // and carries `excluded_from_apply: true`.
  assert.equal(result.batch.items.length + result.parked.length, manifest.products.length)
  assert.equal(result.parked.length, 1, JSON.stringify(result.parked))
  assert.ok(result.parked[0]!.gaps.includes("no_applicable_identifier"))
  assert.ok(
    result.batch.items.every((item) => !result.parked.some((p) => p.item_key === item.item_key)),
  )
})

test("a deviation-flagged protocol parks the product for Nick's review (R4/F-06)", async () => {
  const manifest = await maskManifest()
  // The reviewed manifest no longer carries a deviation, so inject one: the rule
  // is what is under test, not the current contents of the research lane.
  const withDeviation = structuredClone(manifest)
  const target = withDeviation.products[0]!
  const protocol = (target.final.protocols as Array<Record<string, unknown>>)[0]!
  protocol.deviation = {
    reason: "Packungstext nennt eine andere Einwirkzeit als die Herstellerseite.",
    packaging_text: "1-2 Minuten einwirken lassen.",
  }

  const result = buildExpansionApplyBatch({
    manifest: withDeviation,
    supplement: supplementFor(withDeviation),
  })

  const product = target.final.product as { brand: string; name: string }
  const parked = result.parked.find(
    (entry) => entry.item_key === expansionItemKey(product.brand, product.name),
  )
  assert.ok(parked, JSON.stringify(result.parked))
  assert.ok(
    parked.gaps.some((gap) => gap.startsWith("deviation_requires_review")),
    parked.gaps.join("; "),
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

test("evidence with no quote anywhere is parked — a source text is never invented", async () => {
  const manifest = await maskManifest()
  const supplement = supplementFor(manifest, (_key, entry) => ({
    ...entry,
    evidence_source_texts: {},
  }))
  const result = buildExpansionApplyBatch({ manifest, supplement })

  // The mask manifest's manufacturer-claim evidence rows carry no `source_text`
  // and point at a URL no protocol source covers, so no quote can be derived.
  const withGap = result.parked.filter((parked) =>
    parked.gaps.some((gap) => gap.startsWith("evidence_source_text_missing")),
  )
  assert.ok(withGap.length > 0)
})

test("the manifest's own evidence source_text wins over every fallback", async () => {
  const manifest = await maskManifest()
  const quoted = structuredClone(manifest)
  for (const entry of quoted.products) {
    for (const evidence of entry.final.evidence as Array<Record<string, unknown>>) {
      evidence.source_text = `Zitat aus dem Manifest für ${String(evidence.fact_key)}.`
    }
  }

  // Both fallbacks are present and both are wrong: the operator supplement says
  // something else, and the protocol source on the same URL says something else
  // again. The researcher's own quote must survive.
  const result = buildExpansionApplyBatch({
    manifest: quoted,
    supplement: supplementFor(quoted, (_key, entry) => ({
      ...entry,
      evidence_source_texts: Object.fromEntries(
        Object.keys(entry.evidence_source_texts ?? {}).map((key) => [key, "Operator-Fallback"]),
      ),
    })),
  })

  assert.ok(result.batch.items.length > 0)
  for (const item of result.batch.items) {
    if (item.kind !== "new_product") continue
    for (const evidence of item.evidence) {
      assert.equal(evidence.source_text, `Zitat aus dem Manifest für ${evidence.fact_key}.`)
    }
  }
})

test("a manifest quote rescues a product the operator supplement would have parked", async () => {
  const manifest = await maskManifest()
  const quoted = structuredClone(manifest)
  for (const entry of quoted.products) {
    for (const evidence of entry.final.evidence as Array<Record<string, unknown>>) {
      evidence.source_text = "Verbatim vom Hersteller."
    }
  }

  // Same empty supplement that parks products on the unquoted manifest above.
  const empty = supplementFor(quoted, (_key, entry) => ({ ...entry, evidence_source_texts: {} }))
  const result = buildExpansionApplyBatch({ manifest: quoted, supplement: empty })

  assert.equal(
    result.parked.filter((parked) =>
      parked.gaps.some((gap) => gap.startsWith("evidence_source_text_missing")),
    ).length,
    0,
    JSON.stringify(result.parked),
  )
  assert.ok(result.batch.items.length > 0)
})

test("an existing-product update whose target is quarantined is parked (disposition guard)", async () => {
  const productId = "22222222-2222-4222-8222-222222222222"
  const manifest = {
    batch_id: "scan-expansion-existing",
    generated_at: "2026-09-02T09:00:00.000Z",
    products: [],
    existing_product_updates: [
      {
        product_id: productId,
        rename: {
          from: "Ultimate Shampoo",
          to: "Elvital Glycolic Gloss Shampoo",
          reason: "Katalogname war der Platzhalter der Erstaufnahme.",
        },
      },
    ],
  }
  const existingProducts = [
    {
      id: productId,
      name: "Ultimate Shampoo",
      brand: "L'Oréal Paris Elvital",
      category_key: "shampoo",
      is_active: true,
      lifecycle_status: "active",
      is_chaarlie_recommended: false,
    },
  ]
  const supplement: ExpansionApplySupplement = {
    batch_id: "scan-expansion-existing",
    operator_profile_id: OPERATOR,
    reviewed_head: REVIEWED_HEAD,
    products: {},
  }

  const clean = buildExpansionApplyBatch({ manifest, supplement, existingProducts })
  assert.equal(clean.batch.items.length, 1, "control: the update publishes without a disposition")

  const quarantined = buildExpansionApplyBatch({
    manifest,
    supplement,
    existingProducts,
    dispositionProductIds: [productId],
  })
  assert.equal(quarantined.batch.items.length, 0)
  assert.equal(quarantined.parked.length, 1)
  assert.ok(
    quarantined.parked[0]!.gaps.some((gap) => gap.startsWith("existing_product_has_disposition")),
    JSON.stringify(quarantined.parked),
  )
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
      {
        product_id: "cccccccc-0000-4000-8000-000000000003",
        canonical_gtin14: canonicalGtin14(gtin),
      },
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

// ---------------------------------------------------------------------------
// Non-mask templates (B1). `contactTimeSeconds` / `waitCopyDe` are TPL-MASK-only
// slots and the builder rejects them on every other template — including a
// `null` contact time, which is not `undefined`. Fixturing masks alone hid a
// caller that stamped those slots on EVERY template, so no oil, leave-in,
// shampoo or conditioner protocol could publish at all.
// ---------------------------------------------------------------------------

test("an oil product's non-mask protocols stamp instead of parking (B1)", async () => {
  const manifest = await researchManifest("oil-manifest.json")
  const result = buildExpansionApplyBatch({ manifest, supplement: supplementFor(manifest) })

  assert.deepEqual(
    result.parked.filter((parked) =>
      parked.gaps.some((gap) => gap.startsWith("protocol_stamp_failed")),
    ),
    [],
  )

  const key = expansionItemKey("Schwarzkopf Gliss", "Haaröl Tägliches Öl Elixier")
  const item = result.batch.items.find((entry) => entry.item_key === key)
  assert.ok(item, `${key} must publish — parked: ${JSON.stringify(result.parked)}`)
  // TPL-OIL-DRYFINISH + TPL-OIL-LEAVEON, the manifest's two reviewed templates.
  assert.deepEqual(protocolRoles(item), ["dry_finish", "leave_on_fibre_conditioning"])
  assert.equal(
    result.parked.filter((parked) =>
      parked.gaps.some((gap) => gap.startsWith("missing_protocol_for_derived_role")),
    ).length,
    0,
    JSON.stringify(result.parked),
  )
})

test("a stray mask wait copy in the supplement cannot break a non-mask stamp (B1)", async () => {
  const manifest = await researchManifest("oil-manifest.json")
  const result = buildExpansionApplyBatch({
    manifest,
    supplement: supplementFor(manifest, (_key, entry) => ({
      ...entry,
      mask_wait_copy_de: "5–10 Minuten einwirken lassen.",
    })),
  })

  assert.deepEqual(
    result.parked.filter((parked) =>
      parked.gaps.some((gap) => gap.startsWith("protocol_stamp_failed")),
    ),
    [],
  )
  const item = result.batch.items.find(
    (entry) =>
      entry.item_key === expansionItemKey("Schwarzkopf Gliss", "Haaröl Tägliches Öl Elixier"),
  )
  assert.ok(item, JSON.stringify(result.parked))
  assert.deepEqual(protocolRoles(item), ["dry_finish", "leave_on_fibre_conditioning"])
})

test("a leave-in product's TPL-LEAVEIN-DAMP protocol stamps instead of parking (B1)", async () => {
  const manifest = await researchManifest("leave-in-manifest.json")
  const result = buildExpansionApplyBatch({ manifest, supplement: supplementFor(manifest) })

  assert.deepEqual(
    result.parked.filter((parked) =>
      parked.gaps.some((gap) => gap.startsWith("protocol_stamp_failed")),
    ),
    [],
  )

  const key = expansionItemKey("Garnier Fructis", "Leave-In Creme Aloe Air Dry")
  const item = result.batch.items.find((entry) => entry.item_key === key)
  assert.ok(item, `${key} must publish — parked: ${JSON.stringify(result.parked)}`)
  assert.deepEqual(protocolRoles(item), ["post_wash_leave_in"])
})

test("the emitted batch never carries a recommendation flag (R3)", async () => {
  const manifest = await maskManifest()
  const result = buildExpansionApplyBatch({ manifest, supplement: supplementFor(manifest) })
  assert.ok(result.batch.items.length > 0)
  assert.doesNotMatch(result.batchJson, /is_chaarlie_recommended/)
})

// ---------------------------------------------------------------------------
// The apply script's own execution gate (F-05, CLI half).
// ---------------------------------------------------------------------------

const ARMED = {
  reviewedHead: "a".repeat(40),
  executionEnabled: "true",
  git: { head: "a".repeat(40), clean: true },
}

test("the apply gate opens only when the switch is armed on the exact reviewed head", () => {
  assert.deepEqual(scanExpansionExecutionBlockers(ARMED), [])
})

test("--confirm alone cannot execute: the environment switch is independent", () => {
  for (const value of [undefined, "", "1", "TRUE", "yes", "false"]) {
    const blockers = scanExpansionExecutionBlockers({ ...ARMED, executionEnabled: value })
    assert.ok(
      blockers.some((blocker) => blocker.includes("kill switch is disabled")),
      `${String(value)} must not arm the run — got ${JSON.stringify(blockers)}`,
    )
  }
})

test("a well-formed but stale --reviewed-head is refused", () => {
  const blockers = scanExpansionExecutionBlockers({
    ...ARMED,
    reviewedHead: "b".repeat(40),
  })
  assert.ok(
    blockers.some((blocker) => blocker.includes("git HEAD must equal --reviewed-head")),
    JSON.stringify(blockers),
  )
})

test("a dirty worktree is refused even on the right head", () => {
  const blockers = scanExpansionExecutionBlockers({
    ...ARMED,
    git: { head: ARMED.reviewedHead, clean: false },
  })
  assert.ok(
    blockers.some((blocker) => blocker.includes("git worktree must be clean")),
    JSON.stringify(blockers),
  )
})
