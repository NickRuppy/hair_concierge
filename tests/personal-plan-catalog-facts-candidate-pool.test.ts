import assert from "node:assert/strict"
import test from "node:test"

import {
  deriveStage3RecommendationCandidates,
  loadStage3RecommendationCandidatePool,
  loadStage3RecommendationCandidates,
  loadStage3RecommendationCandidatesByRole,
  type Stage3RecommendationCandidatePool,
} from "@/lib/personal-plan/products/authority/catalog-facts"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import type { PlanProductRole } from "@/lib/personal-plan/types"

/**
 * F12 of plans/2026-09-04-scan-hardening.md: the recommendation-candidate POOL (product
 * rows + their spec/protocol rows) is role-independent; only Shampoo's per-product spec
 * selection depends on the role. These tests pin that deriving per-role facts from one
 * pool is indistinguishable from the per-role loaders — for both the batch (`in`-capable)
 * client and the per-product fallback client — while the pool itself is loaded once.
 *
 * The equivalence oracle is the LEGACY loader (`completeCatalog` omitted): it still runs
 * the pre-F12 per-product path (`normalizeProductFacts` → `loadCategorySpec` +
 * `loadProtocols`) and shares none of the pool's loading or aggregation code (only the
 * leaf spec/protocol interpreters), so agreeing with it is not
 * tautological. The fixtures stay under its 12-product cap.
 */

type Row = Record<string, unknown>

const product = (id: string, name: string, category: PersonalPlanCategory, sortOrder: number) => ({
  id,
  name,
  image_url: null,
  category_key: category,
  is_active: true,
  lifecycle_status: "active",
  is_chaarlie_recommended: true,
  suitable_thicknesses: ["fine", "normal", "coarse"],
  sort_order: sortOrder,
  updated_at: "2026-09-02T09:00:00.000Z",
  price_eur: 9.95,
  price_checked_at: "2026-09-02T09:00:00.000Z",
  purchase_link_status: "available",
  net_content_value: 250,
  net_content_unit: "ml",
  affiliate_link: `https://www.dm.de/p/d/1/${id.slice(0, 8)}`,
  currency: "EUR",
})

const SHAMPOO_A = product("aaaaaaaa-0000-4000-8000-000000000001", "Alltagsshampoo A", "shampoo", 1)
const SHAMPOO_B = product("bbbbbbbb-0000-4000-8000-000000000002", "Schuppenshampoo B", "shampoo", 2)
const BOND_A = product("cccccccc-0000-4000-8000-000000000003", "Bondbuilder A", "bondbuilder", 1)
const BOND_B = product("dddddddd-0000-4000-8000-000000000004", "Bondbuilder B", "bondbuilder", 2)

/**
 * Both shampoos carry one spec row per shampoo route so that `shampoo_everyday`
 * (bucket `normal` / route `balanced`) and `shampoo_dandruff` (bucket `schuppen` /
 * route `dandruff`) select DIFFERENT rows — the per-role difference F12 must preserve.
 */
const shampooSpecRows = (productId: string): Row[] => [
  {
    product_id: productId,
    thickness: "normal",
    shampoo_bucket: "normal",
    scalp_route: "balanced",
    cleansing_intensity: "regular",
  },
  {
    product_id: productId,
    thickness: "normal",
    shampoo_bucket: "schuppen",
    scalp_route: "dandruff",
    cleansing_intensity: "regular",
  },
]

const protocolRow = (
  productId: string,
  category: PersonalPlanCategory,
  role: string,
  guidanceComplete: boolean,
): Row => ({
  product_id: productId,
  role,
  application_family: "wet_scalp_massage_rinse",
  application_stage: null,
  application_state: null,
  placement: "scalp",
  contact_time_seconds: 60,
  rinse_action: "rinse_out",
  reapplication: null,
  source_label: null,
  source_url: null,
  updated_at: "2026-09-02T09:00:00.000Z",
  guidance_payload: guidanceComplete
    ? {
        schemaVersion: 2,
        contractKind: "product_pointer",
        scope: { kind: "product", category, productId },
        sourceRole: role,
        runtimeBlockerCode: null,
      }
    : { legacy: true },
})

const SHAMPOO_TABLES: Record<string, Row[]> = {
  products: [SHAMPOO_A, SHAMPOO_B],
  product_shampoo_specs: [SHAMPOO_A, SHAMPOO_B].flatMap((row) => shampooSpecRows(row.id)),
  product_application_protocols: [
    protocolRow(SHAMPOO_A.id, "shampoo", "shampoo_everyday", true),
    protocolRow(SHAMPOO_A.id, "shampoo", "shampoo_dandruff", false),
    protocolRow(SHAMPOO_B.id, "shampoo", "shampoo_everyday", true),
  ],
  application_guidance_protocols: [
    {
      product_id: SHAMPOO_B.id,
      id: "guidance-b-dandruff",
      role_key: "shampoo_dandruff",
      protocol_version: 3,
      verified_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-01T00:00:00.000Z",
      scope_kind: "product",
      status: "active",
      locale: "de",
    },
  ],
}

/**
 * Bondbuilder exercises the two source shapes Shampoo does not: a `cardinality: "one"`
 * spec table (B has NO row → nulls, not an error) and the `source_product_id`-keyed
 * relationship source (A is an add-on).
 */
const BOND_TABLES: Record<string, Row[]> = {
  products: [BOND_A, BOND_B],
  product_bondbuilder_specs: [
    {
      product_id: BOND_A.id,
      application_mode: "rinse_out",
      treatment_mode: "standalone_treatment",
      product_format: "liquid",
      usage_protocol: "weekly",
    },
  ],
  product_relationships: [
    { id: "rel-1", source_product_id: BOND_A.id, relationship_type: "add_on_for" },
    { id: "rel-2", source_product_id: BOND_B.id, relationship_type: "pairs_with" },
  ],
  product_application_protocols: [
    protocolRow(BOND_A.id, "bondbuilder", "specialized_bond_treatment", true),
  ],
  application_guidance_protocols: [],
}

/**
 * PostgREST-shaped in-memory client. `eq`/`in` genuinely filter. With `supportsIn: false`
 * the chain has no `in`, which sends the loaders down their per-product fallback path
 * (`loadCatalogBatchSnapshot` returns null when the client cannot batch). Every `from()`
 * call is counted per table.
 */
function catalogClient(tables: Record<string, Row[]>, options: { supportsIn: boolean }) {
  const queries: Record<string, number> = {}

  function from(table: string) {
    queries[table] = (queries[table] ?? 0) + 1
    const filters: Array<[string, unknown]> = []
    let inFilter: [string, unknown[]] | null = null
    const rows = () => {
      let result = tables[table] ?? []
      for (const [column, value] of filters) {
        result = result.filter((row) => row[column] === value)
      }
      if (inFilter) {
        const [column, values] = inFilter
        result = result.filter((row) => values.includes(row[column]))
      }
      return result
    }
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (column: string, value: unknown) => {
        filters.push([column, value])
        return chain
      },
      order: () => chain,
      limit: () => chain,
      range: () => chain,
      maybeSingle: async () => {
        const found = rows()
        return { data: found[0] ?? null, error: null }
      },
      then: <T>(resolve: (value: unknown) => T | PromiseLike<T>) =>
        Promise.resolve({ data: rows(), error: null, count: rows().length }).then(resolve),
    }
    if (options.supportsIn) {
      chain.in = (column: string, values: unknown[]) => {
        inFilter = [column, values]
        return chain
      }
    }
    return chain
  }

  return { client: { from } as never, queries }
}

const SHAMPOO_TARGET = {
  category: "shampoo" as const,
  roles: ["shampoo_everyday" as const, "shampoo_dandruff" as const],
  scalpRoute: "balanced" as const,
  everydayConstraint: "standard" as const,
  requiresTargetedDandruffCapability: false,
}

type Lane = {
  category: PersonalPlanCategory
  tables: Record<string, Row[]>
  roles: readonly PlanProductRole[]
  selection: {
    hairThickness: string
    shampooTarget: typeof SHAMPOO_TARGET | null
    conditionerTarget: null
  }
}

const LANES: Lane[] = [
  {
    category: "shampoo",
    tables: SHAMPOO_TABLES,
    roles: ["shampoo_everyday", "shampoo_dandruff"],
    selection: { hairThickness: "normal", shampooTarget: SHAMPOO_TARGET, conditionerTarget: null },
  },
  {
    category: "bondbuilder",
    tables: BOND_TABLES,
    roles: ["specialized_bond_treatment"],
    selection: { hairThickness: "normal", shampooTarget: null, conditionerTarget: null },
  },
]

/** Independent oracle: the legacy per-product loader (see file comment). */
async function legacyCandidates(client: never, lane: Lane, role: PlanProductRole) {
  return loadStage3RecommendationCandidates(client, {
    category: lane.category,
    ...lane.selection,
    role,
  })
}

/** `JSON.stringify` renders a Map as `{}`, so unfold both map levels first. */
function poolFingerprint(pool: Stage3RecommendationCandidatePool): string {
  return JSON.stringify([
    pool.category,
    pool.products,
    [...pool.snapshot.entries()].map(([table, byProduct]) => [table, [...byProduct.entries()]]),
  ])
}

for (const lane of LANES) {
  for (const supportsIn of [true, false]) {
    const label = `${lane.category}, ${supportsIn ? "batch client" : "per-product fallback client"}`

    test(`candidate pool: derived facts equal the legacy per-role loader (${label})`, async () => {
      const { client } = catalogClient(lane.tables, { supportsIn })
      const pool = await loadStage3RecommendationCandidatePool(client, lane.category)

      for (const role of lane.roles) {
        const derived = deriveStage3RecommendationCandidates(pool, { ...lane.selection, role })
        const legacy = await legacyCandidates(client, lane, role)
        assert.equal(derived.length, 2, `${role}: both recommendable products expected`)
        assert.deepEqual(
          derived,
          legacy,
          `derived facts diverge from the legacy loader for ${role}`,
        )
      }
    })

    test(`candidate pool: deriving does not mutate the pool (${label})`, async () => {
      const { client } = catalogClient(lane.tables, { supportsIn })
      const pool = await loadStage3RecommendationCandidatePool(client, lane.category)
      const before = poolFingerprint(pool)
      for (const role of [...lane.roles].reverse()) {
        deriveStage3RecommendationCandidates(pool, { ...lane.selection, role })
      }
      assert.equal(poolFingerprint(pool), before)
    })

    test(`candidates by role: every table is queried once per pool, facts match the legacy loader (${label})`, async () => {
      const { client, queries } = catalogClient(lane.tables, { supportsIn })
      const byRole = await loadStage3RecommendationCandidatesByRole(client, {
        category: lane.category,
        ...lane.selection,
        roles: lane.roles,
      })
      assert.equal(queries.products, 1, "the product page must be loaded exactly once")
      const factTables = Object.keys(lane.tables).filter((table) => table !== "products")
      for (const table of factTables) {
        // Batch: one set query per table. Fallback: one query per recommendable product
        // per table. Both lanes pay one probe `select` on the first spec table (that is how
        // `loadCatalogBatchSnapshot` detects `.in` support). Never a query per role.
        const perProduct = lane.tables.products!.length
        const probe = table === factTables[0] ? 1 : 0
        assert.equal(
          queries[table],
          (supportsIn ? 1 : perProduct) + probe,
          `${table} must not be re-queried per role`,
        )
      }
      assert.deepEqual([...Object.keys(byRole)].sort(), [...lane.roles].sort())
      for (const role of lane.roles) {
        assert.deepEqual(byRole[role], await legacyCandidates(client, lane, role))
      }
    })
  }
}

test("candidate pool: Shampoo roles still select different spec rows from one pool", async () => {
  const { client } = catalogClient(SHAMPOO_TABLES, { supportsIn: true })
  const pool = await loadStage3RecommendationCandidatePool(client, "shampoo")
  const selection = LANES[0]!.selection
  const [everyday] = deriveStage3RecommendationCandidates(pool, {
    ...selection,
    role: "shampoo_everyday",
  })
  const [dandruff] = deriveStage3RecommendationCandidates(pool, {
    ...selection,
    role: "shampoo_dandruff",
  })
  assert.equal(everyday!.productId, dandruff!.productId)
  assert.equal((everyday!.spec as { scalpRoute: string }).scalpRoute, "balanced")
  assert.equal((dandruff!.spec as { scalpRoute: string }).scalpRoute, "dandruff")
  assert.notEqual(everyday!.factFingerprint, dandruff!.factFingerprint)
})

test("candidate pool: Bondbuilder singleton and relationship sources survive the pool", async () => {
  const { client } = catalogClient(BOND_TABLES, { supportsIn: true })
  const pool = await loadStage3RecommendationCandidatePool(client, "bondbuilder")
  const facts = deriveStage3RecommendationCandidates(pool, {
    ...LANES[1]!.selection,
    role: "specialized_bond_treatment",
  })
  const byId = new Map(facts.map((fact) => [fact.productId, fact]))
  const specA = byId.get(BOND_A.id)!.spec as { applicationMode: string; relationship: string }
  const specB = byId.get(BOND_B.id)!.spec as { applicationMode: null; relationship: string }
  assert.equal(specA.applicationMode, "rinse_out")
  assert.equal(specA.relationship, "add_on")
  assert.equal(specB.applicationMode, null)
  assert.equal(specB.relationship, "standalone")
})

test("candidates by role: an empty catalog yields an empty list for every role", async () => {
  const { client } = catalogClient({ products: [] }, { supportsIn: true })
  const byRole = await loadStage3RecommendationCandidatesByRole(client, {
    category: "shampoo",
    ...LANES[0]!.selection,
    roles: ["shampoo_everyday", "shampoo_dandruff"],
  })
  assert.deepEqual(byRole, { shampoo_everyday: [], shampoo_dandruff: [] })
})
