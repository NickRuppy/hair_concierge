import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import { searchScanCatalog } from "@/app/api/scan/search/route"
import { buildBondbuilderDecision } from "@/lib/personal-plan/categories/bondbuilder"
import { buildPlanProfile } from "@/lib/personal-plan/input"
import { buildPlanNeedAssessment } from "@/lib/personal-plan/needs"
import {
  loadScanProductFacts,
  loadStage3RecommendationCandidatesByRole,
} from "@/lib/personal-plan/products/authority/catalog-facts"
import { lookupCatalogProductByIdentifier } from "@/lib/scan/identifier-lookup"
import { buildScanVerdict } from "@/lib/scan/resolve-verdict"

import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

type Row = Record<string, unknown>
type FrozenEnvelope = { profile: Row }

const FROZEN_ENVELOPE_ROOT = path.join(
  process.cwd(),
  "data/research/bondbuilder-inci/v1.0/owner-consolidation-2026-10-02",
)
const ACTIVE_GTIN = "4006381333931"

function frozenProfiles() {
  return ["P04", "P05", "P06", "P07", "P08"].map((researchKey, index) => {
    const envelope = JSON.parse(
      readFileSync(path.join(FROZEN_ENVELOPE_ROOT, `${researchKey}.json`), "utf8"),
    ) as FrozenEnvelope
    const identity = envelope.profile.identity as Row
    return {
      id: `bondbuilder-${researchKey.toLowerCase()}`,
      researchKey,
      profile: envelope.profile,
      name: identity.product_name as string,
      brand: identity.brand as string,
      sort_order: index + 1,
    }
  })
}

/** A PostgREST-shaped memory client whose filters change the returned rows. */
function strictCatalogClient(tables: Record<string, Row[]>) {
  const calls: Array<{ table: string; filters: Array<[string, unknown]> }> = []

  function from(table: string) {
    const filters: Array<[string, unknown]> = []
    const inFilters: Array<[string, unknown[]]> = []
    const call = { table, filters }
    calls.push(call)
    const rows = () => {
      let result = tables[table] ?? []
      for (const [column, value] of filters) result = result.filter((row) => row[column] === value)
      for (const [column, values] of inFilters)
        result = result.filter((row) => values.includes(row[column]))
      return result
    }
    const response = () => ({ data: rows(), error: null, count: rows().length })
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (column: string, value: unknown) => {
        filters.push([column, value])
        return chain
      },
      in: (column: string, values: unknown[]) => {
        inFilters.push([column, values])
        return chain
      },
      order: () => chain,
      limit: () => chain,
      range: async (fromIndex: number, toIndex: number) => {
        const value = response()
        return { ...value, data: value.data.slice(fromIndex, toIndex + 1) }
      },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      then: <T>(resolve: (value: ReturnType<typeof response>) => T | PromiseLike<T>) =>
        Promise.resolve(response()).then(resolve),
    }
    return chain
  }

  return { client: { from } as never, calls }
}

function catalogueTables() {
  const reviewed = frozenProfiles()
  const products = reviewed.map((row) => ({
    id: row.id,
    name: row.name,
    brand: row.brand,
    category_key: "bondbuilder",
    image_url: `https://images.example.test/${row.researchKey}.jpg`,
    sort_order: row.sort_order,
    is_active: true,
    lifecycle_status: "active",
    // The catalogue launch deliberately does not promote these research-only entries.
    is_chaarlie_recommended: false,
    suitable_thicknesses: [],
  }))
  return {
    reviewed,
    tables: {
      products,
      product_identifiers: [
        {
          product_id: reviewed[0]!.id,
          canonical_gtin14: "04006381333931",
          identifier_type: "gtin",
        },
      ],
      product_bondbuilder_specs: reviewed.map((row) => {
        const assessment = row.profile.assessment as Row
        return {
          product_id: row.id,
          application_mode: null,
          treatment_mode: null,
          product_format: null,
          usage_protocol: null,
          technology_family: assessment.technology_family,
          claim_trust_level: assessment.claim_trust_level,
          trust_basis: assessment.trust_basis,
          research_profile: row.profile,
        }
      }),
      product_relationships: [],
      product_application_protocols: [],
      application_guidance_protocols: [],
      personal_plan_product_search_dispositions: [],
    } satisfies Record<string, Row[]>,
  }
}

function bondbuilderDecision() {
  const profile = buildPlanProfile(
    {
      ...COMPLETE_V3_PLAN_ENVELOPE,
      answers: {
        ...COMPLETE_V3_PLAN_ENVELOPE.answers,
        chemicalTreatments: ["lightened"],
        currentConcerns: [],
        hairSurface: "smooth",
        elasticResponse: "stretches_bounces",
      },
    },
    { artifactId: "66666666-6666-4666-8666-666666666666", projection: "initial_quiz" },
  )
  return buildBondbuilderDecision(profile, buildPlanNeedAssessment(profile).damage)
}

test("active reviewed Bondbuilders stay searchable and identifier-bound while non-recommended", async () => {
  const { reviewed, tables } = catalogueTables()
  const { client, calls } = strictCatalogClient(tables)

  const searches = await Promise.all(reviewed.map((row) => searchScanCatalog(client, row.name)))
  assert.deepEqual(
    searches.map((search) => search.results.map((result) => result.id)),
    reviewed.map((row) => [row.id]),
  )

  const identifier = await lookupCatalogProductByIdentifier(client, {
    type: "ean",
    value: ACTIVE_GTIN,
  })
  assert.deepEqual(identifier, { productId: reviewed[0]!.id, category: "bondbuilder" })

  const productQuery = calls.find(
    (call) =>
      call.table === "products" &&
      call.filters.some(([column, value]) => column === "lifecycle_status" && value === "active"),
  )
  assert.ok(productQuery)
})

test("scan facts retain each frozen profile but recommendation candidates exclude non-recommended Bondbuilders", async () => {
  const { reviewed, tables } = catalogueTables()
  const { client, calls } = strictCatalogClient(tables)
  const selection = {
    hairThickness: "normal",
    role: "specialized_bond_treatment" as const,
    shampooTarget: null,
    conditionerTarget: null,
  }

  const [facts, byRole] = await Promise.all([
    Promise.all(
      reviewed.map((row) => loadScanProductFacts(client, "bondbuilder", row.id, selection)),
    ),
    loadStage3RecommendationCandidatesByRole(client, {
      category: "bondbuilder",
      ...selection,
      roles: ["specialized_bond_treatment"],
    }),
  ])

  assert.equal(byRole.specialized_bond_treatment?.length, 0)
  for (const [index, fact] of facts.entries()) {
    assert.equal(fact?.productId, reviewed[index]!.id)
    assert.equal(fact?.category, "bondbuilder")
    assert.ok(fact && fact.category === "bondbuilder")
    assert.equal(fact?.recommendable, false)
    assert.equal(fact?.spec.researchProfile?.identity.research_key, reviewed[index]!.researchKey)
    assert.equal(fact?.suitableThicknesses?.length, 0)
    assert.equal(fact?.protocols[0]?.status, "missing")
  }
  assert.ok(
    calls.some(
      (call) =>
        call.table === "products" &&
        call.filters.some(
          ([column, value]) => column === "is_chaarlie_recommended" && value === true,
        ),
    ),
  )
})

test("a real Bondbuilder category decision keeps a research-only scanned product unknown", async () => {
  const { reviewed, tables } = catalogueTables()
  const { client } = strictCatalogClient(tables)
  const facts = await loadScanProductFacts(client, "bondbuilder", reviewed[0]!.id, {
    hairThickness: "normal",
    role: "specialized_bond_treatment",
    shampooTarget: null,
    conditionerTarget: null,
  })
  const verdict = buildScanVerdict({
    category: "bondbuilder",
    decision: bondbuilderDecision(),
    productFacts: facts,
    recommendationCandidates: [],
    coverage: [],
    hairThickness: "normal",
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
    refinedVersionId: "frozen-bondbuilder-test",
    refinedInputHash: "frozen-bondbuilder-test",
  })

  assert.equal(verdict.kind, "in_catalog")
  if (verdict.kind !== "in_catalog") return
  assert.equal(verdict.verdict, "unknown")
  assert.notEqual(verdict.verdict, "ideal")
  assert.notEqual(verdict.verdict, "supportive")
  assert.ok(verdict.mobileAuthority)
  assert.ok(verdict.mobileAuthority.missingFacts.length > 0)
})
