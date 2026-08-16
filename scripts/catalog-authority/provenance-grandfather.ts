// Grandfather internally curated catalogue provenance.
//
// Cohort: exactly the products the live catalogue-authority audit reports as
// provenance_missing. For each, one internal_verified evidence row records
// that the stored authority facts were curated and confirmed by Nick on the
// given date. Dry run by default; --apply performs a single atomic insert.

import { config as loadEnv } from "dotenv"

import { createClient } from "@supabase/supabase-js"

import { auditCatalogAuthority } from "../../src/lib/catalog-authority/audit"
import { readCatalogAuthorityAuditSnapshot } from "../../src/lib/catalog-authority/audit-reader"
import { catalogAuthorityValueFingerprint } from "../../src/lib/catalog-authority/repair"
import { createSupabaseCatalogAuditSource } from "../../src/lib/catalog-authority/supabase-audit-source"

const BATCH_ID = "GF-20260816-provenance-grandfather"
const CHECKED_AT = "2026-08-16"
const SOURCE_LABEL = "Interne Kuratierung (Nick)"
const SOURCE_URL =
  "https://github.com/NickRuppy/hair_concierge/blob/main/docs/ops/catalog-repairs/2026-08-16-provenance-grandfather/README.md"
const SOURCE_TEXT =
  "Katalog-Eigenschaften dieses Produkts wurden intern kuratiert und am 16.08.2026 von Nick bestätigt. " +
  "Grandfathering-Beleg mit vollständiger Produktliste: siehe Quelle. " +
  "Externe Produktseiten-Evidenz wird bei zukünftigen Änderungen oder Konflikten nachgezogen."

async function main() {
  loadEnv({ path: ".env.local" })
  const apply = process.argv.includes("--apply")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!url || !serviceKey) throw new Error("missing Supabase service configuration")
  const client = createClient(url, serviceKey)

  const snapshot = await readCatalogAuthorityAuditSnapshot(
    createSupabaseCatalogAuditSource(client as never),
  )
  const receipt = auditCatalogAuthority(snapshot)
  const cohortIds = [
    ...new Set(
      receipt.issues
        .filter((issue) => issue.code === "provenance_missing")
        .map((issue) => issue.productId)
        .filter((value): value is string => value !== null),
    ),
  ].sort()

  const productsById = new Map(snapshot.products.map((product) => [product.productId, product]))
  const batchFingerprint = catalogAuthorityValueFingerprint({
    batchId: BATCH_ID,
    productIds: cohortIds,
  })

  const rows = cohortIds.map((productId) => {
    const product = productsById.get(productId)
    if (!product?.categoryKey) throw new Error(`cohort product missing category: ${productId}`)
    const factValue = {
      category_key: product.categoryKey,
      canonical_thicknesses: product.canonicalThicknesses,
      curation: "internal",
      curated_by: "nick",
    }
    return {
      product_id: productId,
      fact_key: `${product.categoryKey}.authority_facts`,
      fact_value: factValue,
      source_label: SOURCE_LABEL,
      source_url: SOURCE_URL,
      source_text: SOURCE_TEXT,
      source_type: "internal_verified",
      checked_at: CHECKED_AT,
      batch_id: BATCH_ID,
      batch_fingerprint: batchFingerprint,
      content_fingerprint: catalogAuthorityValueFingerprint({
        factValue,
        sourceText: SOURCE_TEXT,
        sourceUrl: SOURCE_URL,
      }),
    }
  })

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry_run",
        cohortSize: rows.length,
        batchId: BATCH_ID,
        batchFingerprint,
        byCategory: rows.reduce<Record<string, number>>((counts, row) => {
          const category = row.fact_key.split(".")[0]!
          counts[category] = (counts[category] ?? 0) + 1
          return counts
        }, {}),
      },
      null,
      2,
    ),
  )
  if (rows.length === 0) {
    console.log("nothing to grandfather; audit reports no provenance_missing products")
    return
  }
  if (!apply) return

  const { error } = await client.from("personal_plan_catalog_fact_evidence").insert(rows)
  if (error) throw new Error(`insert failed: ${error.message}`)

  const verification = auditCatalogAuthority(
    await readCatalogAuthorityAuditSnapshot(createSupabaseCatalogAuditSource(client as never)),
  )
  const remaining = verification.issueCounts.provenance_missing ?? 0
  console.log(JSON.stringify({ applied: rows.length, provenanceMissingAfter: remaining }))
  if (remaining !== 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
