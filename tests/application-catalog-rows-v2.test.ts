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

// ---------------------------------------------------------------------------------------------
// S3 §5.1 — `heat_activated_verified_product` binds like the generic Bondbuilder workflow: the
// pointer/payload stays only with its reviewed source text and a manufacturer source URL that is
// the row's own `source_url`, under the `pre_heat_protection` role (T3.7).

import {
  buildHeatActivatedProtocolRow,
  NEQI_DIAMOND_GLASS_ULTIMATE_HEAT_ACTIVATED_ROW_INPUT,
} from "../src/lib/product-intake/catalog-enrichment/heat-activated-protocols"
import { adaptReviewedProductApplicationProtocols } from "../src/lib/routines/personal-plan/application/product-protocol-adapter"
import { normalizeApplicationRoutineProducts } from "../src/lib/personal-plan/routine/application-adapter"
import { compileApplicationView } from "../src/lib/routines/personal-plan/application/compiler"
import { APPLICATION_DAY_TYPE_KEYS } from "../src/lib/routines/personal-plan/application/contracts"

function heatActivatedRow(overrides: Record<string, unknown> = {}) {
  return {
    ...buildHeatActivatedProtocolRow(NEQI_DIAMOND_GLASS_ULTIMATE_HEAT_ACTIVATED_ROW_INPUT),
    updated_at: "2026-10-11T00:00:00.000Z",
    ...overrides,
  }
}

test("heat-activated binding filter keeps the reviewed row and drops unbound copies", () => {
  const kept = heatActivatedRow()
  assert.equal(adaptReviewedProductApplicationPointersV2([kept]).length, 1)
  assert.equal(adaptReviewedProductApplicationProtocols([kept]).length, 1)

  for (const dropped of [
    heatActivatedRow({ source_text: null }),
    heatActivatedRow({ source_text: "   " }),
    heatActivatedRow({ source_url: "https://example.com/other-source" }),
    heatActivatedRow({
      source_url: "https://www.dm.de/p/d/3080142/neqi-leave-in-spray-diamond-glass-ultimate",
    }),
    heatActivatedRow({ role: "post_wash_leave_in" }),
  ]) {
    assert.deepEqual(adaptReviewedProductApplicationPointersV2([dropped]), [], String(dropped.role))
    assert.deepEqual(adaptReviewedProductApplicationProtocols([dropped]), [], String(dropped.role))
  }
})

// Pin (must not move): the live Redken Extreme Anti-Snap pre-heat row (S5-14 carry-forward) is an
// ordinary, non-activated V1 `pre_heat_damp` payload. Its runtime family resolution against the
// heat-occurrence materialiser stays exactly as before S3 for each heat route.
test("V1 Redken pre-heat row keeps its family resolution per heat event (non-activated)", () => {
  const carryForward = JSON.parse(
    readFileSync(
      new URL(
        "../data/catalog-enrichment/personal-plan-stage5-v1/S5R-05-leave-in-calibration-protocol-carry-forward.json",
        import.meta.url,
      ),
      "utf8",
    ),
  )
  const item = carryForward.items[0]
  const redken = item.expected_product.id as string
  assert.equal(redken, "2b7db7e3-2058-4178-8a03-7d05f4a1d447")
  const compile = (heatEvents: Array<{ id: string; tool: string; route: string }>) => {
    const normalized = normalizeApplicationRoutineProducts({
      contractVersion: 1,
      candidates: [
        {
          itemId: "item-redken",
          applicationInstanceKey: "assign-redken",
          routineOrder: 0,
          category: "leave_in",
          routineRole: "pre_heat_application",
          productId: redken,
          productName: "Redken Extreme Anti-Snap",
          kind: "owned",
          executable: true,
          effectiveCadenceDe: "Vor dem Hitzestyling",
        },
      ],
      products: new Map([
        [
          redken,
          {
            id: redken,
            image_url: null,
            category: "leave_in",
            category_key: "leave_in",
            is_active: true,
            lifecycle_status: "active",
            product_leave_in_specs: {
              format: "spray",
              roles: ["styling_prep"],
              provides_heat_protection: true,
              heat_activation_required: false,
              application_stage: ["towel_dry", "pre_heat"],
            },
          },
        ],
      ]) as never,
      protocolRows: [
        {
          product_id: redken,
          category: "leave_in",
          role: "pre_heat_protection",
          guidance_payload: item.protocol.guidance_payload,
          application_state: "damp",
          reapplication: "required",
          source_url: item.sources[0].url,
          source_text: item.sources[0].text,
          updated_at: "2026-09-14T00:00:00.000Z",
        },
      ],
    })
    assert.deepEqual(
      normalized.exactGuidanceProtocols.map((protocol) => protocol.applicationFamily),
      ["pre_heat_damp"],
    )
    const view = compileApplicationView({
      input: {
        routineItems: normalized.routineItems,
        unresolvedRoutineItems: [],
        profile: { heatEvents: heatEvents as never },
        dayTypes: APPLICATION_DAY_TYPE_KEYS.map((key, index) => ({ key, sortOrder: index + 1 })),
      },
      protocols: normalized.exactGuidanceProtocols,
    })
    return view.days
      .filter((day) => day.key !== "rest_day")
      .map((day) => [
        day.key,
        day.outerSequence.map((entry) =>
          entry.kind === "product"
            ? [
                "product",
                entry.block.applicationInstanceKey,
                entry.block.steps.map((s) => s.stepKey),
              ]
            : entry.kind === "unresolved_product"
              ? ["unresolved", entry.block.applicationInstanceKey]
              : ["transition", entry.copyDe],
        ),
      ])
  }

  // Hair dryer: damp occurrence materialises as `damp_hair_protection` on wash-family days; no
  // cleanse in this routine, so no wash day forms.
  assert.deepEqual(compile([{ id: "dryer", tool: "hair_dryer", route: "airflow_shaping" }]), [])
  // Straightener only: no damp-compatible event, the item keeps its reviewed `pre_heat_damp`
  // family and renders on its Styling-Tag.
  assert.deepEqual(compile([{ id: "iron", tool: "straightener", route: "direct_contact_heat" }]), [
    ["styling_day", [["product", "assign-redken", ["apply-pre-heat", "tool-pre-heat"]]]],
  ])
  // Dryer brush (Styling-Tag airflow): the runtime family `damp_hair_protection` does not match
  // the stored `pre_heat_damp` payload → an unresolved slot on the Styling-Tag.
  assert.deepEqual(compile([{ id: "brush", tool: "dryer_brush", route: "airflow_shaping" }]), [
    ["styling_day", [["unresolved", "assign-redken:brush"]]],
  ])
})
