import { findStage5V2PointerCoverageGaps } from "@/lib/product-intake/catalog-enrichment/stage5-v2-pointer-delta"
import { loadLocalEnv, printJson } from "../cli"
import { stage5ProtocolClientAdapters } from "./stage5-protocol-client"

/**
 * Pointer-coverage audit — the invariant that replaces the retired artifact's
 * reverse-coverage claim.
 *
 * The runtime (`src/lib/routines/personal-plan/application/product-protocol-adapter.ts`)
 * reads `guidance_payload_v2` and nothing else. So the only thing that has to be
 * true is: every live curated protocol row that carries V1 guidance must also
 * carry a V2 pointer. Rows the frozen artifact never listed are irrelevant here —
 * that is precisely the claim the catalog outgrew.
 *
 * Read-only. Exits 1 when any row is uncovered.
 */

async function main() {
  loadLocalEnv()
  const rows = await stage5ProtocolClientAdapters().v2.listPointerCoverage()
  const gaps = findStage5V2PointerCoverageGaps(rows)
  printJson({
    mode: "read-only",
    observed: { curated_protocol_rows: rows.length, uncovered_rows: gaps.length },
    uncovered: gaps.map((row) => ({
      product_id: row.product_id,
      product: [row.brand, row.product_name].filter(Boolean).join(" ") || null,
      category: row.category,
      role: row.role,
      application_family: row.application_family ?? null,
    })),
  })
  process.exitCode = gaps.length === 0 ? 0 : 1
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
