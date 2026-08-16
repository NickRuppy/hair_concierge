import assert from "node:assert/strict"
import test from "node:test"

import { auditCatalogAuthority } from "../src/lib/catalog-authority/audit"
import {
  catalogAuthorityAuditReadRequests,
  readCatalogAuthorityAuditSnapshot,
  type CatalogAuditDataSource,
} from "../src/lib/catalog-authority/audit-reader"
import { CATALOG_AUTHORITY_REQUIRED_SCHEMA_OBJECTS } from "../src/lib/catalog-authority/contracts"
import {
  createSupabaseCatalogAuditSource,
  type CatalogAuditSupabaseClient,
} from "../src/lib/catalog-authority/supabase-audit-source"

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111"

test("the snapshot reader exhaustively requests only the declared read relations", async () => {
  const requests: string[] = []
  const rows = new Map<string, Record<string, unknown>[]>([
    [
      "products",
      [
        {
          id: PRODUCT_ID,
          origin: "curated",
          category_key: "shampoo",
          category: "shampoo",
          is_active: true,
          lifecycle_status: "active",
          is_chaarlie_recommended: true,
          suitable_thicknesses: ["normal"],
          suitable_concerns: ["dryness"],
        },
      ],
    ],
    [
      "product_shampoo_specs",
      [
        {
          product_id: PRODUCT_ID,
          thickness: "normal",
          shampoo_bucket: "standard",
          scalp_route: "balanced",
          cleansing_intensity: "gentle",
        },
      ],
    ],
    [
      "product_thickness_eligibility",
      [{ product_id: PRODUCT_ID, category_key: "shampoo", thickness: "normal" }],
    ],
    [
      "product_concern_eligibility",
      [{ product_id: PRODUCT_ID, category_key: "shampoo", concern_key: "dryness" }],
    ],
    [
      "product_application_protocols",
      [
        {
          product_id: PRODUCT_ID,
          category: "shampoo",
          role: "shampoo_everyday",
          source_url: "https://example.com/shampoo",
          source_text: "Verified source text",
          guidance_payload: {
            schemaVersion: 1,
            scope: { kind: "product", productId: PRODUCT_ID, category: "shampoo" },
            evidence: [{ sourceUrl: "https://example.com/shampoo" }],
          },
          guidance_payload_v2: {
            schemaVersion: 2,
            contractKind: "product_pointer",
            scope: { kind: "product", productId: PRODUCT_ID, category: "shampoo" },
            sourceRole: "shampoo_everyday",
            applicationFamily: "everyday_cleanse",
            runtimeBlockerCode: null,
          },
        },
      ],
    ],
    [
      "personal_plan_catalog_fact_evidence",
      [
        {
          product_id: PRODUCT_ID,
          fact_key: "shampoo.authority_facts",
          source_url: "https://example.com/shampoo",
          content_fingerprint: "fingerprint",
        },
      ],
    ],
  ])
  const source: CatalogAuditDataSource = {
    async readAll(request) {
      requests.push(request.table)
      const relationRows = rows.get(request.table) ?? []
      return { rows: relationRows, exactCount: relationRows.length }
    },
  }

  const snapshot = await readCatalogAuthorityAuditSnapshot(source, {
    inspectedAt: "2026-08-15T12:00:00.000Z",
    schemaObjects: CATALOG_AUTHORITY_REQUIRED_SCHEMA_OBJECTS.map((name) => ({
      kind: name.endsWith("_idx") ? ("index" as const) : ("constraint" as const),
      name,
      valid: true,
      definition: "verified fixture constraint",
    })),
  })
  const receipt = auditCatalogAuthority(snapshot)

  assert.deepEqual(
    requests.sort(),
    catalogAuthorityAuditReadRequests()
      .map(({ table }) => table)
      .sort(),
  )
  assert.equal(receipt.clean, true)
  assert.equal(snapshot.products[0]?.requiredRoles[0], "shampoo_everyday")
  assert.equal(receipt.countsByRelation.products, 1)
  assert.equal(receipt.countsByRelation.product_shampoo_specs, 1)
  assert.equal(receipt.countsByRelation.product_application_protocols, 1)
  assert.equal(receipt.countsByRelation.product_thickness_eligibility, 1)
  assert.deepEqual(snapshot.products[0]?.canonicalThicknesses, ["normal"])
  assert.equal(snapshot.products[0]?.canonicalConcerns, null)
  assert.equal(snapshot.products[0]?.superseded, false)
  assert.equal(
    snapshot.facts.some(
      (fact) =>
        fact.table === "product_thickness_eligibility" &&
        fact.productId === PRODUCT_ID &&
        fact.contextualKey === "normal",
    ),
    true,
  )
  assert.equal(receipt.countsByRelation.product_oil_specs, 0)
})

test("the snapshot reader recognizes only explicit replaced-by tombstones", async () => {
  const source: CatalogAuditDataSource = {
    async readAll(request) {
      const rows: Record<string, unknown>[] =
        request.table === "products"
          ? [
              {
                id: PRODUCT_ID,
                origin: "curated",
                category_key: "shampoo",
                category: "shampoo",
                is_active: false,
                lifecycle_status: "discontinued",
                is_chaarlie_recommended: false,
                suitable_thicknesses: [],
                suitable_concerns: [],
              },
            ]
          : request.table === "product_relationships"
            ? [
                {
                  source_product_id: PRODUCT_ID,
                  target_product_id: "22222222-2222-4222-8222-222222222222",
                  relationship_type: "replaced_by",
                },
              ]
            : []
      return { rows, exactCount: rows.length }
    },
  }

  const snapshot = await readCatalogAuthorityAuditSnapshot(source)

  assert.equal(snapshot.products[0]?.superseded, true)
  assert.equal(snapshot.rowCounts.product_relationships, 1)
})

test("normalized thickness authority is category-scoped for every applicable product", async () => {
  const source: CatalogAuditDataSource = {
    async readAll(request) {
      const rows: Record<string, unknown>[] =
        request.table === "products"
          ? [
              {
                id: PRODUCT_ID,
                origin: "curated",
                category_key: "oil",
                category: "Öle",
                is_active: false,
                lifecycle_status: "active",
                is_chaarlie_recommended: false,
                suitable_thicknesses: ["fine", "coarse"],
                suitable_concerns: ["dryness"],
              },
            ]
          : request.table === "product_oil_eligibility"
            ? [{ product_id: PRODUCT_ID, thickness: "normal", oil_subtype: "styling-oel" }]
            : request.table === "product_thickness_eligibility"
              ? [
                  { product_id: PRODUCT_ID, category_key: "oil", thickness: "coarse" },
                  { product_id: PRODUCT_ID, category_key: "shampoo", thickness: "fine" },
                ]
              : request.table === "product_concern_eligibility"
                ? [{ product_id: PRODUCT_ID, category_key: "oil", concern_key: "repair" }]
                : []
      return { rows, exactCount: rows.length }
    },
  }

  const snapshot = await readCatalogAuthorityAuditSnapshot(source)

  assert.deepEqual(snapshot.products[0]?.canonicalThicknesses, ["coarse"])
  assert.equal(snapshot.products[0]?.canonicalConcerns, null)
  assert.equal(snapshot.facts.filter((fact) => fact.table.endsWith("_eligibility")).length, 4)
})

test("the Supabase read source follows every page with stable ordering and exposes no writer", async () => {
  const rows = Array.from({ length: 5 }, (_, index) => ({ id: index + 1 }))
  const ranges: Array<[number, number]> = []
  const orders: string[][] = []
  const client = {
    from(table: string) {
      assert.equal(table, "products")
      const order: string[] = []
      const query = {
        select(columns: string, options: { count: "exact" }) {
          assert.equal(columns, "*")
          assert.deepEqual(options, { count: "exact" })
          return query
        },
        order(column: string) {
          order.push(column)
          return query
        },
        async range(from: number, to: number) {
          ranges.push([from, to])
          orders.push([...order])
          return { data: rows.slice(from, to + 1), count: rows.length, error: null }
        },
      }
      return query
    },
  } as CatalogAuditSupabaseClient

  const source = createSupabaseCatalogAuditSource(client, { pageSize: 2 })
  const result = await source.readAll({ table: "products", orderBy: ["sort_order", "id"] })

  assert.deepEqual(result, { rows, exactCount: rows.length })
  assert.deepEqual(ranges, [
    [0, 1],
    [2, 3],
    [4, 5],
  ])
  assert.deepEqual(orders, [
    ["sort_order", "id"],
    ["sort_order", "id"],
    ["sort_order", "id"],
  ])
  assert.equal("insert" in source, false)
  assert.equal("update" in source, false)
  assert.equal("delete" in source, false)
})

test("the Supabase read source fails closed when exact count and fetched pages diverge", async () => {
  const client = {
    from() {
      const query = {
        select() {
          return query
        },
        order() {
          return query
        },
        async range(from: number) {
          return { data: from === 0 ? [{ id: 1 }] : [], count: 2, error: null }
        },
      }
      return query
    },
  } as CatalogAuditSupabaseClient

  const source = createSupabaseCatalogAuditSource(client, { pageSize: 1 })

  await assert.rejects(
    source.readAll({ table: "products", orderBy: ["id"] }),
    /catalog_audit_count_mismatch:products/,
  )
})
