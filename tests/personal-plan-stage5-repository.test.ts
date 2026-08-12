import assert from "node:assert/strict"
import test from "node:test"

import {
  createApplicationGuidanceRepository,
  type ApplicationContentQueryClient,
} from "../src/lib/routines/personal-plan/application/repository"

type QueryCall = {
  table: string
  select: string | null
  eq: Array<{ column: string; value: unknown }>
  order: Array<{ column: string; ascending: boolean }>
}

function createClient(rowsByTable: Record<string, unknown[]>) {
  const calls: QueryCall[] = []
  const client = {
    from(table: string) {
      const call: QueryCall = { table, select: null, eq: [], order: [] }
      calls.push(call)
      const query = {
        select(columns: string) {
          call.select = columns
          return query
        },
        eq(column: string, value: unknown) {
          call.eq.push({ column, value })
          return query
        },
        order(column: string, options?: { ascending?: boolean }) {
          call.order.push({ column, ascending: options?.ascending ?? true })
          return query
        },
        then<TResult1 = unknown, TResult2 = never>(
          onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) {
          return Promise.resolve({ data: rowsByTable[table] ?? [], error: null }).then(
            onfulfilled,
            onrejected,
          )
        },
      }
      return query
    },
  }

  return { client: client as ApplicationContentQueryClient, calls }
}

const protocolPayload = {
  schemaVersion: 1,
  guidanceKey: "shampoo-base",
  protocolVersion: 1,
  locale: "de",
  scope: { kind: "application_family", category: "shampoo" },
  role: "cleanse",
  applicationFamily: "standard_rinse_out_cleanse",
  compatibleDayTypes: ["wash_day"],
  exactGuidanceRequired: false,
  sequence: { anchor: "wet_cleanse", before: [], after: [], conflictsWith: [] },
  requirements: { requiredCatalogFacts: [], requiredProtocolFacts: [], requiredProfileFacts: [] },
  protocolFacts: {
    applicationArea: "scalp_roots",
    rinse: "rinse_out",
    contactTimeSeconds: null,
    conditionerRelationship: "not_applicable",
    reapplication: "none",
    amount: { kind: "qualitative", copyDe: "Eine kleine Menge verwenden." },
    cautions: [],
  },
  steps: [
    { stepKey: "cleanse", action: "apply_product", copyTemplateDe: "Auf die Kopfhaut geben." },
  ],
  evidence: [
    {
      sourceUrl: "https://example.com/shampoo",
      sourceType: "manufacturer",
      checkedAt: "2026-08-08",
    },
  ],
}

test("loads only active German canonical rows in database order", async () => {
  const { client, calls } = createClient({
    application_day_type_definitions: [
      {
        day_type_key: "wash_day",
        definition_version: 1,
        locale: "de",
        label: "Waschtag",
        summary: "Deine Basiswäsche.",
        sort_order: 10,
        status: "active",
      },
    ],
    application_guidance_protocols: [
      {
        id: "8dbeab63-c10d-4c21-8eef-4e1782d0ad12",
        guidance_key: "shampoo-base",
        protocol_version: 1,
        locale: "de",
        scope_kind: "application_family",
        category_key: "shampoo",
        role_key: "cleanse",
        product_id: null,
        application_family: "standard_rinse_out_cleanse",
        contract_version: 1,
        payload: protocolPayload,
        status: "active",
        verified_at: "2026-08-08T00:00:00.000Z",
      },
    ],
  })

  const repository = createApplicationGuidanceRepository(client)
  const [dayTypes, protocols] = await Promise.all([
    repository.loadActiveDayTypeDefinitions(),
    repository.loadActiveGuidanceProtocols(),
  ])

  assert.deepEqual(dayTypes, [
    {
      key: "wash_day",
      definitionVersion: 1,
      locale: "de",
      label: "Waschtag",
      summary: "Deine Basiswäsche.",
      sortOrder: 10,
    },
  ])
  assert.equal(protocols[0]?.payload.guidanceKey, "shampoo-base")
  assert.deepEqual(
    calls.map((call) => ({ table: call.table, eq: call.eq, order: call.order })),
    [
      {
        table: "application_day_type_definitions",
        eq: [
          { column: "status", value: "active" },
          { column: "locale", value: "de" },
        ],
        order: [{ column: "sort_order", ascending: true }],
      },
      {
        table: "application_guidance_protocols",
        eq: [
          { column: "status", value: "active" },
          { column: "locale", value: "de" },
          { column: "contract_version", value: 1 },
        ],
        order: [{ column: "guidance_key", ascending: true }],
      },
    ],
  )
})

test("fails closed when a supposedly active protocol has an invalid payload", async () => {
  const { client } = createClient({
    application_guidance_protocols: [
      {
        id: "8dbeab63-c10d-4c21-8eef-4e1782d0ad12",
        guidance_key: "shampoo-base",
        protocol_version: 1,
        locale: "de",
        scope_kind: "application_family",
        category_key: "shampoo",
        role_key: "cleanse",
        product_id: null,
        application_family: "standard_rinse_out_cleanse",
        contract_version: 1,
        payload: { ...protocolPayload, protocolVersion: 0 },
        status: "active",
        verified_at: "2026-08-08T00:00:00.000Z",
      },
    ],
  })

  await assert.rejects(
    createApplicationGuidanceRepository(client).loadActiveGuidanceProtocols(),
    /invalid application guidance protocol shampoo-base/,
  )
})

test("fails closed when active guidance has no verification timestamp", async () => {
  const { client } = createClient({
    application_guidance_protocols: [
      {
        id: "8dbeab63-c10d-4c21-8eef-4e1782d0ad12",
        guidance_key: "shampoo-base",
        protocol_version: 1,
        locale: "de",
        scope_kind: "application_family",
        category_key: "shampoo",
        role_key: "cleanse",
        product_id: null,
        application_family: "standard_rinse_out_cleanse",
        contract_version: 1,
        payload: protocolPayload,
        status: "active",
        verified_at: null,
      },
    ],
  })

  await assert.rejects(
    createApplicationGuidanceRepository(client).loadActiveGuidanceProtocols(),
    /active application guidance protocol shampoo-base is not verified/,
  )
})

test("selects exactly one requested guidance contract generation", async () => {
  const v2Payload = {
    schemaVersion: 2,
    contractKind: "family_template",
    guidanceKey: "shampoo-base-v2",
    protocolVersion: 2,
    locale: "de",
    scope: { kind: "application_family", category: "shampoo" },
    role: "cleanse",
    applicationFamily: "standard_rinse_out_cleanse",
    compatibleDayTypes: ["wash_day"],
    sequence: { anchor: "wet_cleanse", before: [], after: [], conflictsWith: [] },
    steps: [
      {
        stepKey: "cleanse",
        action: "apply_product",
        copyTemplateDe: "Auf die Kopfhaut geben.",
      },
    ],
    evidence: protocolPayload.evidence,
  }
  const { client, calls } = createClient({
    application_guidance_protocols: [
      {
        id: "8dbeab63-c10d-4c21-8eef-4e1782d0ad13",
        guidance_key: "shampoo-base-v2",
        protocol_version: 2,
        locale: "de",
        scope_kind: "application_family",
        category_key: "shampoo",
        role_key: "cleanse",
        product_id: null,
        application_family: "standard_rinse_out_cleanse",
        contract_version: 2,
        payload: v2Payload,
        status: "active",
        verified_at: "2026-08-12T00:00:00.000Z",
      },
    ],
  })

  const protocols = await createApplicationGuidanceRepository(client, {
    contractVersion: 2,
  }).loadActiveGuidanceProtocols()

  assert.equal(protocols[0]?.payload.schemaVersion, 2)
  assert.deepEqual(calls[0]?.eq, [
    { column: "status", value: "active" },
    { column: "locale", value: "de" },
    { column: "contract_version", value: 2 },
  ])
})
