import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  readApplicationCatalogRows,
  type ApplicationRoutineReadClient,
} from "../src/lib/personal-plan/routine/application-adapter"
import { adaptReviewedProductApplicationPointersV2 } from "../src/lib/routines/personal-plan/application/product-protocol-adapter"

/**
 * Regression (Nomi consult finish, 2026-10-09): the five Bondbuilders made recommendable in
 * #652 carry the generic `bondbuilder_verified_product` workflow, whose pointer the adapter
 * keeps only with the row's reviewed `source_text`. The V2 protocol read did not select that
 * column, so every one of them compiled as `missing_pointer` — no „So wendest du es an" on
 * `/anwendung`, and an application gap that blocks finalising a discovery call.
 *
 * The fake client honours the select list like PostgREST does: a column that is not selected
 * is not in the row.
 */

const packet = JSON.parse(
  readFileSync(
    new URL(
      "../data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-06/P04.json",
      import.meta.url,
    ),
    "utf8",
  ),
)

const storedRow: Record<string, unknown> = {
  product_id: packet.productId,
  category: "bondbuilder",
  role: "specialized_bond_treatment",
  guidance_payload: packet.protocolV1 ?? null,
  guidance_payload_v2: packet.protocolV2,
  application_state: null,
  reapplication: null,
  source_url: packet.source.source_url,
  source_text: packet.source.source_text,
  updated_at: "2026-10-07T09:00:00.000Z",
}

function projectingClient(): ApplicationRoutineReadClient {
  return {
    from(table: string) {
      let columns: string[] = []
      const query = {
        select(selected: string) {
          columns = selected.split(",").map((column) => column.trim())
          return query
        },
        eq() {
          return query
        },
        async in() {
          if (table !== "product_application_protocols") return { data: [], error: null }
          const projected = Object.fromEntries(
            columns.map((column) => [column, storedRow[column]] as const),
          )
          return { data: [projected], error: null }
        },
        async maybeSingle() {
          return { data: null, error: null }
        },
      }
      return query
    },
  }
}

test("V2 read keeps a reviewed generic Bondbuilder protocol (L'Oréal Elvital Pre-Shampoo)", async () => {
  assert.equal(packet.protocolV2.workflowId, "bondbuilder_verified_product")
  const catalog = await readApplicationCatalogRows({
    client: projectingClient(),
    productIds: [packet.productId],
    contractVersion: 2,
  })
  const pointers = adaptReviewedProductApplicationPointersV2(catalog.protocolRows)
  assert.deepEqual(
    pointers.map((pointer) => [pointer.scope.productId, pointer.sourceRole]),
    [[packet.productId, "specialized_bond_treatment"]],
  )
})
