import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import AnwendungPage, {
  resolveAnwendungPage,
  type AnwendungResolverDeps,
} from "../src/app/anwendung/page"
import type { ApplicationDayTypeKey } from "../src/lib/routines/personal-plan/application/contracts"

test("direct Anwendung route stays compact and non-exposing while the rollout is off", async () => {
  const previous = process.env.PERSONAL_PLAN_STAGE5_ROLLOUT
  process.env.PERSONAL_PLAN_STAGE5_ROLLOUT = "off"

  try {
    const html = renderToStaticMarkup(await AnwendungPage())

    assert.match(html, /Anwendung gerade nicht verfügbar/)
    assert.match(html, /Deine Routine bleibt verfügbar/)
    assert.match(html, /href="\/routine"/)
    assert.doesNotMatch(html, /Waschtag|Bond-Repair-Tag|Auffrisch-Tag/)
    assert.doesNotMatch(html, /K18|Olaplex|Batiste|Moroccanoil/i)
    assert.doesNotMatch(html, /checkbox|Kalender|heute|erledigt|Fortschritt/i)
  } finally {
    if (previous === undefined) delete process.env.PERSONAL_PLAN_STAGE5_ROLLOUT
    else process.env.PERSONAL_PLAN_STAGE5_ROLLOUT = previous
  }
})

test("route source composes the accepted Stage 4 Routine adapter", async () => {
  const previous = process.env.PERSONAL_PLAN_STAGE5_ROLLOUT
  process.env.PERSONAL_PLAN_STAGE5_ROLLOUT = "all"

  try {
    const source = readFileSync("src/app/anwendung/page.tsx", "utf8")
    assert.match(source, /loadPersonalPlanRoutineView/)
    assert.match(source, /adaptAcceptedActiveRoutineForApplication/)
    assert.match(source, /canAccessPersonalPlanStage5/)
  } finally {
    if (previous === undefined) delete process.env.PERSONAL_PLAN_STAGE5_ROLLOUT
    else process.env.PERSONAL_PLAN_STAGE5_ROLLOUT = previous
  }
})

test("Anwendung page has no production fixture import or sample product path", () => {
  const source = readFileSync("src/app/anwendung/page.tsx", "utf8")

  assert.doesNotMatch(source, /fixture|mock|sample/i)
  assert.doesNotMatch(source, /K18|Olaplex|Batiste|Moroccanoil/i)
  assert.match(source, /compileApplicationView\(/)
})

test("loading does not flash Anwendung navigation before owner eligibility is known", () => {
  const source = readFileSync("src/app/anwendung/loading.tsx", "utf8")

  assert.match(source, /<Header/)
})

const DAY_KEYS: ApplicationDayTypeKey[] = [
  "wash_day",
  "intensive_care_day",
  "bond_repair_day",
  "clarifying_wash_day",
  "refresh_day",
  "between_wash_care_day",
  "styling_day",
  "rest_day",
]

const shampooItem = {
  itemId: "item:shampoo",
  productId: "10000000-0000-4000-8000-000000000001",
  productName: "Not included in event payload",
  category: "shampoo" as const,
  role: "cleanse" as const,
  inclusion: "included" as const,
  availability: "owned" as const,
  executable: true as const,
  catalogFacts: {},
}

const shampooProtocol = {
  schemaVersion: 1 as const,
  guidanceKey: "wash",
  protocolVersion: 1,
  locale: "de" as const,
  scope: { kind: "application_family" as const, category: "shampoo" as const },
  role: "cleanse" as const,
  applicationFamily: "standard_rinse_out_cleanse" as const,
  compatibleDayTypes: ["wash_day" as const],
  exactGuidanceRequired: false,
  sequence: { anchor: "wet_cleanse" as const, before: [], after: [], conflictsWith: [] },
  requirements: { requiredCatalogFacts: [], requiredProtocolFacts: [], requiredProfileFacts: [] },
  protocolFacts: {
    applicationArea: "scalp_roots" as const,
    rinse: "rinse_out" as const,
    contactTimeSeconds: null,
    conditionerRelationship: "not_applicable" as const,
    reapplication: "none" as const,
    amount: null,
    cautions: [],
  },
  steps: [{ stepKey: "apply", action: "apply_product" as const, copyTemplateDe: "Auftragen." }],
  evidence: [
    {
      sourceUrl: "https://example.com",
      sourceType: "manufacturer" as const,
      checkedAt: "2026-08-08",
    },
  ],
}

function readyDeps(overrides: Partial<AnwendungResolverDeps> = {}): AnwendungResolverDeps {
  return {
    getUserId: async () => "user-1",
    isInternal: async () => true,
    loadRoutine: async () => ({
      status: "active",
      personalPlanId: "plan-1",
      planRevision: 1,
      sourceRevision: 1,
      pendingProposal: null,
      activeVersion: {
        id: "routine-1",
        payload: { source: { refinedVersionId: "refined-1" } } as never,
      },
    }),
    adaptRoutine: async () => ({
      routineVersionId: "routine-1",
      planId: "plan-1",
      routineItems: [shampooItem],
    }),
    loadProfile: async () => ({}),
    loadContent: () =>
      ({
        loadActiveDayTypeDefinitions: async () =>
          DAY_KEYS.map((key, index) => ({
            key,
            definitionVersion: 1,
            locale: "de" as const,
            label: key,
            summary: key,
            sortOrder: index + 1,
          })),
        loadActiveGuidanceProtocols: async () => [{ id: "guidance-1", payload: shampooProtocol }],
      }) as never,
    createReadClient: () => ({}) as never,
    appEnabled: () => true,
    stage4Enabled: () => true,
    rollout: () => "all",
    reportFailure: () => undefined,
    ...overrides,
  }
}

test("internal rollout denial happens before any Routine, profile, catalog, or content read", async () => {
  let privilegedReads = 0
  const view = await resolveAnwendungPage(
    readyDeps({
      rollout: () => "internal",
      isInternal: async () => false,
      loadRoutine: async () => {
        privilegedReads += 1
        throw new Error("must not read")
      },
      adaptRoutine: async () => {
        privilegedReads += 1
        throw new Error("must not read")
      },
      loadProfile: async () => {
        privilegedReads += 1
        throw new Error("must not read")
      },
      loadContent: () => {
        privilegedReads += 1
        throw new Error("must not read")
      },
    }),
  )
  assert.deepEqual(view, { state: "feature_disabled" })
  assert.equal(privilegedReads, 0)
})

test("route has explicit no-active recovery, active success, unavailable direct day, and database recovery", async () => {
  const noActive = await resolveAnwendungPage(
    readyDeps({
      loadRoutine: async () => ({ status: "no_personal_plan" }),
    }),
  )
  assert.deepEqual(noActive, { state: "no_active_routine" })

  const activeFailures: unknown[] = []
  const active = await resolveAnwendungPage(
    readyDeps({ reportFailure: (details) => activeFailures.push(details) }),
  )
  assert.equal(activeFailures.length, 0, JSON.stringify(activeFailures))
  assert.equal(active.state, "ready")

  const unavailableDay = await resolveAnwendungPage(readyDeps(), "refresh_day")
  assert.deepEqual(unavailableDay, { state: "unavailable" })

  const failures: unknown[] = []
  const database = await resolveAnwendungPage(
    readyDeps({
      loadRoutine: async () => {
        throw new Error("database query failed")
      },
      reportFailure: (details) => failures.push(details),
    }),
  )
  assert.deepEqual(database, { state: "unavailable" })
  assert.equal(failures.length, 1)
  assert.equal((failures[0] as { reason: string }).reason, "database")
  assert.equal(typeof (failures[0] as { durationMs: unknown }).durationMs, "number")
})
