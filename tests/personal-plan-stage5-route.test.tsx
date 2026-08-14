import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { ApplicationPage } from "../src/components/application/application-page"
import { resolveAnwendungPage, type AnwendungResolverDeps } from "../src/app/anwendung/page"
import type { ApplicationDayTypeKey } from "../src/lib/routines/personal-plan/application/contracts"
import { SHARED_APPLICATION_TEMPLATE_BY_KEY_V2 } from "../src/lib/routines/personal-plan/application/shared-templates-v2"
import { adaptAcceptedActiveRoutineForApplication } from "../src/lib/personal-plan/routine/application-adapter"

test("direct Anwendung route stays compact and non-exposing without an eligible owner", async () => {
  const view = await resolveAnwendungPage(readyDeps({ getUserId: async () => null }))
  const html = renderToStaticMarkup(<ApplicationPage view={view} />)

  assert.match(html, /Anwendung gerade nicht verfügbar/)
  assert.match(html, /Deine Routine bleibt verfügbar/)
  assert.match(html, /href="\/routine"/)
  assert.doesNotMatch(html, /Waschtag|Bond-Repair-Tag|Auffrisch-Tag/)
  assert.doesNotMatch(html, /K18|Olaplex|Batiste|Moroccanoil/i)
  assert.doesNotMatch(html, /checkbox|Kalender|heute|erledigt|Fortschritt/i)
  assert.doesNotMatch(html, /data-personal-plan-application-compute-ms/)
})

test("application compute timing is exposed only behind the diagnostic marker", () => {
  const source = readFileSync("src/app/anwendung/page.tsx", "utf8")
  assert.match(source, /PERSONAL_PLAN_APPLICATION_PERFORMANCE_MARKER_ENABLED === "true"/)
  const html = renderToStaticMarkup(
    <ApplicationPage view={{ state: "feature_disabled" }} internalComputeMs={1.25} />,
  )
  assert.match(html, /data-personal-plan-application-root="true"/)
  assert.match(html, /data-personal-plan-application-compute-ms="1.25"/)
})

test("route source composes the accepted Stage 4 Routine adapter", () => {
  const source = readFileSync("src/app/anwendung/page.tsx", "utf8")
  assert.match(source, /loadPersonalPlanActiveRoutineVersion/)
  assert.match(source, /adaptAcceptedActiveRoutineForApplication/)
  assert.match(source, /canAccessPersonalPlanJourneyStage/)
  assert.match(source, /loadCachedPersonalPlanJourneyAccessForUser/)
})

test("Anwendung page has no production fixture import or sample product path", () => {
  const source = readFileSync("src/app/anwendung/page.tsx", "utf8")

  assert.doesNotMatch(source, /fixture|mock|sample/i)
  assert.doesNotMatch(source, /K18|Olaplex|Batiste|Moroccanoil/i)
  assert.match(source, /compileApplicationViewV2\(/)
})

test("retained portfolio presentation data cannot create an Anwendung item", async () => {
  const adapted = await adaptAcceptedActiveRoutineForApplication({
    client: {
      from: () => {
        throw new Error("no catalog read expected")
      },
    },
    activeVersion: {
      id: "routine-1",
      payload: {
        planId: "plan-1",
        items: [],
        retainedOwnedProducts: [{ displayName: "Altes Shampoo" }],
      } as never,
    },
  })
  assert.deepEqual(adapted.routineItems, [])
  assert.doesNotMatch(
    readFileSync("src/lib/personal-plan/routine/application-adapter.ts", "utf8"),
    /retainedOwnedProducts/,
  )
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

const shampooTemplate = SHARED_APPLICATION_TEMPLATE_BY_KEY_V2.get(
  "shampoo.standard-scalp-cleanse.v2",
)!

const shampooPointer = {
  schemaVersion: 2 as const,
  contractKind: "product_pointer" as const,
  scope: {
    kind: "product" as const,
    category: "shampoo" as const,
    productId: shampooItem.productId,
  },
  sourceRole: "shampoo_everyday",
  role: "cleanse" as const,
  applicationFamily: "standard_rinse_out_cleanse" as const,
  facts: {
    applicationState: "wet_hair" as const,
    applicationArea: "scalp_roots" as const,
    rinse: "rinse_out" as const,
    contactTime: null,
    amount: null,
    heat: null,
    conditionerPolicy: "not_applicable" as const,
  },
  workflowId: null,
  requiredCompanionProductId: null,
  runtimeBlockerCode: null,
  exactSteps: [],
  cautionCodes: [],
  evidence: shampooProtocol.evidence,
}

function readyDeps(overrides: Partial<AnwendungResolverDeps> = {}): AnwendungResolverDeps {
  return {
    getUserId: async () => "user-1",
    loadJourneyAccess: async () => ({
      kind: "personal_plan" as const,
      personalPlanId: "plan-1",
      activeRoutineVersionId: "routine-1",
      frontier: "stage5" as const,
      nextHref: "/anwendung" as const,
      allowed: { stage1: true, stage2: true, stage3: true, stage4: true, stage5: true },
    }),
    loadRoutineVersion: async () => ({
      id: "routine-1",
      payload: { source: { refinedVersionId: "refined-1" } } as never,
    }),
    adaptRoutine: async () => ({
      routineVersionId: "routine-1",
      planId: "plan-1",
      routineItems: [shampooItem],
      unresolvedRoutineItems: [],
      exactGuidanceProtocols: [],
      applicationPointersV2: [shampooPointer],
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
        loadActiveGuidanceProtocols: async () => [{ id: "guidance-v2", payload: shampooTemplate }],
      }) as never,
    createReadClient: () => ({}) as never,
    appEnabled: () => true,
    stage4Enabled: () => true,
    reportFailure: () => undefined,
    ...overrides,
  }
}

test("journey denial happens before any Routine, profile, catalog, or content read", async () => {
  let privilegedReads = 0
  const view = await resolveAnwendungPage(
    readyDeps({
      loadJourneyAccess: async () => ({
        kind: "personal_plan" as const,
        personalPlanId: "plan-1",
        frontier: "stage4" as const,
        nextHref: "/routine" as const,
        allowed: { stage1: true, stage2: true, stage3: true, stage4: true, stage5: false },
      }),
      loadRoutineVersion: async () => {
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
      loadRoutineVersion: async () => {
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

test("authorized Stage 5 overlaps the active Routine and shared content reads", async () => {
  const calls: string[] = []
  let releaseRoutine!: (value: {
    id: string
    payload: { source: { refinedVersionId: string } }
  }) => void
  const routinePending = new Promise<{
    id: string
    payload: { source: { refinedVersionId: string } }
  }>((resolve) => {
    releaseRoutine = resolve
  })
  const base = readyDeps()
  const viewPending = resolveAnwendungPage(
    readyDeps({
      loadJourneyAccess: async (userId: string) => {
        calls.push("journey")
        return base.loadJourneyAccess(userId)
      },
      loadRoutineVersion: async () => {
        calls.push("routine")
        return routinePending as never
      },
      loadContent: () => ({
        loadActiveDayTypeDefinitions: async () => {
          calls.push("days")
          return (await base.loadContent(2).loadActiveDayTypeDefinitions()) as never
        },
        loadActiveGuidanceProtocols: async () => {
          calls.push("protocols")
          return (await base.loadContent(2).loadActiveGuidanceProtocols()) as never
        },
      }),
    } as never),
  )

  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(calls, ["journey", "routine", "days", "protocols"])

  releaseRoutine({
    id: "routine-1",
    payload: { source: { refinedVersionId: "refined-1" } },
  })
  assert.equal((await viewPending).state, "ready")
})

test("route has explicit no-active recovery, active success, unavailable direct day, and database recovery", async () => {
  const noActive = await resolveAnwendungPage(
    readyDeps({
      loadRoutineVersion: async () => null,
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
      loadRoutineVersion: async () => {
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
        applicationPointersV2: [shampooPointer],
      }),
      reportFailure: (details) => failures.push(details),
    }),
    "wash_day",
  )

  assert.equal(view.state, "ready")
  assert.equal(view.state === "ready" ? view.days[0]?.isPartial : false, true)
  assert.deepEqual(failures, [])
})

test("V2 route uses one generation for product and family reads and ignores V1 exact prose", async () => {
  let adaptedContractVersion: number | undefined
  const template = SHARED_APPLICATION_TEMPLATE_BY_KEY_V2.get("shampoo.standard-scalp-cleanse.v2")!
  const view = await resolveAnwendungPage(
    readyDeps({
      adaptRoutine: async (options) => {
        adaptedContractVersion = options.contractVersion
        return {
          routineVersionId: "routine-1",
          planId: "plan-1",
          routineItems: [{ ...shampooItem, sourceRoutineRole: "shampoo_everyday" }],
          unresolvedRoutineItems: [],
          exactGuidanceProtocols: [
            {
              ...shampooProtocol,
              scope: {
                kind: "product" as const,
                category: "shampoo" as const,
                productId: shampooItem.productId,
              },
              exactGuidanceRequired: true,
              steps: [
                {
                  stepKey: "old-bespoke",
                  action: "apply_product" as const,
                  copyTemplateDe: "Old bespoke manufacturer prose.",
                },
              ],
            },
          ],
          applicationPointersV2: [
            {
              schemaVersion: 2,
              contractKind: "product_pointer",
              scope: {
                kind: "product",
                category: "shampoo",
                productId: shampooItem.productId,
              },
              sourceRole: "shampoo_everyday",
              role: "cleanse",
              applicationFamily: "standard_rinse_out_cleanse",
              facts: {
                applicationState: "wet_hair",
                applicationArea: "scalp_roots",
                rinse: "rinse_out",
                contactTime: null,
                amount: null,
                heat: null,
                conditionerPolicy: "not_applicable",
              },
              workflowId: null,
              requiredCompanionProductId: null,
              runtimeBlockerCode: null,
              exactSteps: [],
              cautionCodes: [],
              evidence: shampooProtocol.evidence,
            },
          ],
        }
      },
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
          loadActiveGuidanceProtocols: async () => [{ id: "guidance-v2", payload: template }],
        }) as never,
    }),
  )

  assert.equal(adaptedContractVersion, 2)
  assert.equal(view.state, "ready")
  assert.doesNotMatch(JSON.stringify(view), /Old bespoke manufacturer prose/)
  assert.match(JSON.stringify(view), /Haare und Kopfhaut vollständig anfeuchten/)
})

test("route composes a planned Heat item with its canonical family instructions", async () => {
  const productId = "10000000-0000-4000-8000-000000000009"
  const heatTemplate = SHARED_APPLICATION_TEMPLATE_BY_KEY_V2.get("heat.dry.heat-protectant.v2")!
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
        exactGuidanceProtocols: [],
        applicationPointersV2: [
          {
            schemaVersion: 2,
            contractKind: "product_pointer",
            scope: { kind: "product", category: "heat_protectant", productId },
            sourceRole: "pre_heat_protection",
            role: "heat_protection",
            applicationFamily: "pre_heat_dry",
            facts: {
              applicationState: "dry_hair",
              applicationArea: "hair_lengths_ends",
              rinse: "leave_in",
              contactTime: null,
              amount: null,
              heat: {
                supportedStates: ["dry_hair"],
                activationRequired: false,
                maximumClaimedTemperatureC: null,
                reapplication: "each_separate_heat_event",
              },
              conditionerPolicy: "not_applicable",
            },
            workflowId: null,
            requiredCompanionProductId: null,
            runtimeBlockerCode: null,
            exactSteps: [],
            cautionCodes: [],
            evidence: shampooProtocol.evidence,
          },
        ],
      }),
      loadProfile: async () => ({
        heatEvents: [
          { id: "heat:dryer", tool: "hair_dryer", route: "airflow_shaping" },
          { id: "heat:iron", tool: "straightener", route: "direct_contact_heat" },
        ],
      }),
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
          loadActiveGuidanceProtocols: async () => [{ id: "guidance-v2", payload: heatTemplate }],
        }) as never,
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
    "Gleichmäßig auf vollständig trockenem Haar verteilen. Erst danach das heiße Tool verwenden.",
  )
})

test("direct day route validates the canonical key and never renders an arbitrary segment", () => {
  const source = readFileSync("src/app/anwendung/[dayType]/page.tsx", "utf8")
  assert.match(source, /applicationDayTypeKeySchema\.safeParse/)
  assert.match(source, /notFound\(\)/)
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/)
})
