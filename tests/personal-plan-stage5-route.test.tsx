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
    assert.match(source, /canAccessPersonalPlanJourneyStage/)
    assert.match(source, /loadCachedPersonalPlanJourneyAccessForUser/)
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

  assert.doesNotMatch(source, /<Header/)
  assert.doesNotMatch(source, /PersonalPlanNavigation/)
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
  effectiveCadenceDe: "Bei Bedarf",
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
    loadJourneyAccess: async () => ({
      kind: "personal_plan" as const,
      personalPlanId: "plan-1",
      frontier: "stage5" as const,
      nextHref: "/anwendung" as const,
      allowed: { stage1: true, stage2: true, stage3: true, stage4: true, stage5: true },
    }),
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
      unresolvedRoutineItems: [],
      exactGuidanceProtocols: [],
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
      loadJourneyAccess: async () => ({
        kind: "personal_plan" as const,
        personalPlanId: "plan-1",
        frontier: "stage4" as const,
        nextHref: "/routine" as const,
        allowed: { stage1: true, stage2: true, stage3: true, stage4: true, stage5: false },
      }),
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

test("journey frontier denial happens before any Routine, profile, catalog, or content read", async () => {
  let privilegedReads = 0
  const view = await resolveAnwendungPage(
    readyDeps({
      loadJourneyAccess: async () => ({
        kind: "personal_plan",
        personalPlanId: "plan-1",
        frontier: "stage4",
        nextHref: "/routine",
        allowed: { stage1: true, stage2: true, stage3: true, stage4: true, stage5: false },
      }),
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
    } as never),
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
  if (active.state === "ready") {
    assert.equal(active.days.find((day) => day.dayType === "wash_day")?.cadenceDe, "Bei Bedarf")
  }

  const unavailableDay = await resolveAnwendungPage(readyDeps(), "refresh_day")
  assert.deepEqual(unavailableDay, { state: "day_unavailable", overviewHref: "/anwendung" })

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

test("a rendered partial day is usable and does not emit a route failure", async () => {
  const failures: unknown[] = []
  const view = await resolveAnwendungPage(
    readyDeps({
      adaptRoutine: async () => ({
        routineVersionId: "routine-1",
        planId: "plan-1",
        routineItems: [{ ...shampooItem, availability: "planned", executable: false }],
        unresolvedRoutineItems: [],
        exactGuidanceProtocols: [],
      }),
      reportFailure: (details) => failures.push(details),
    }),
    "wash_day",
  )

  assert.equal(view.state, "ready")
  assert.equal(view.state === "ready" ? view.days[0]?.isPartial : false, true)
  assert.deepEqual(failures, [])
})

test("route composes a planned Heat item with its reviewed exact product instructions", async () => {
  const productId = "10000000-0000-4000-8000-000000000009"
  const heatProtocol = {
    ...shampooProtocol,
    guidanceKey: "exact-dry-heat",
    scope: { kind: "product" as const, category: "heat_protectant" as const, productId },
    role: "heat_protection" as const,
    applicationFamily: "dry_hair_protection" as const,
    compatibleDayTypes: ["styling_day" as const],
    exactGuidanceRequired: true,
    sequence: { ...shampooProtocol.sequence, anchor: "dry_pre_heat" as const },
    requirements: {
      requiredCatalogFacts: ["applicationState", "reapplication", "formatResolution"],
      requiredProtocolFacts: [],
      requiredProfileFacts: ["heatEvents"],
    },
    steps: [
      {
        stepKey: "apply-dry-heat",
        action: "apply_product" as const,
        copyTemplateDe: "Vor dem Glätteisen gleichmäßig auftragen.",
      },
    ],
  }
  const view = await resolveAnwendungPage(
    readyDeps({
      adaptRoutine: async () => ({
        routineVersionId: "routine-1",
        planId: "plan-1",
        routineItems: [
          {
            ...shampooItem,
            itemId: "item:heat",
            productId,
            productName: "Vorgemerkter Hitzeschutz",
            category: "heat_protectant",
            role: "heat_protection",
            sourceRoutineRole: "pre_heat_protection",
            availability: "planned",
            executable: false,
            applicationInstanceKey: "assignment:heat",
            catalogFacts: { applicationState: "dry", reapplication: "not_stated" },
          },
        ],
        unresolvedRoutineItems: [],
        exactGuidanceProtocols: [heatProtocol],
      }),
      loadProfile: async () => ({
        heatEvents: [
          { id: "heat:dryer", tool: "hair_dryer", route: "airflow_shaping" },
          { id: "heat:iron", tool: "straightener", route: "direct_contact_heat" },
        ],
      }),
    }),
  )

  assert.equal(view.state, "ready")
  if (view.state !== "ready") return
  const stylingDay = view.days.find((day) => day.dayType === "styling_day")
  assert.ok(stylingDay)
  assert.equal(stylingDay.isPartial, true)
  assert.equal(stylingDay.provisionalProductCount, 1)
  assert.equal(
    stylingDay.steps.find((step) => step.kind === "product")?.actions[0]?.copyDe,
    "Vor dem Glätteisen gleichmäßig auftragen.",
  )
})

test("direct day route validates the canonical key and never renders an arbitrary segment", () => {
  const source = readFileSync("src/app/anwendung/[dayType]/page.tsx", "utf8")
  assert.match(source, /applicationDayTypeKeySchema\.safeParse/)
  assert.match(source, /notFound\(\)/)
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/)
})
