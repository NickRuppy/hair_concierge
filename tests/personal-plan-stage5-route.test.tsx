import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { ApplicationPage } from "../src/components/application/application-page"
import { resolveAnwendungPage, type AnwendungResolverDeps } from "../src/app/anwendung/page"
import type { ApplicationDayTypeKey } from "../src/lib/routines/personal-plan/application/contracts"
import { SHARED_APPLICATION_TEMPLATE_BY_KEY_V2 } from "../src/lib/routines/personal-plan/application/shared-templates-v2"
import { adaptAcceptedActiveRoutineForApplication } from "../src/lib/personal-plan/routine/application-adapter"
import { CatalogDatabaseReadError } from "../src/lib/catalog-authority/product-spec-relationships"
import { GATED_ANWENDUNG_EXAMPLE_VIEW } from "../src/lib/gated-preview/fixtures/anwendung-example"
import { lenaFacts, lenaNeedSnapshot } from "./personal-plan/tools-lena-fixture"

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
      degradedItems: [],
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
  // A driver or Zod message can carry key and received values, so it must never
  // reach a Sentry tag.
  assert.equal((failures[0] as { failureCode?: string }).failureCode, "unknown")

  const normalizedFailures: unknown[] = []
  const normalizedDatabase = await resolveAnwendungPage(
    readyDeps({
      loadRoutineVersion: async () => {
        throw new CatalogDatabaseReadError()
      },
      reportFailure: (details) => normalizedFailures.push(details),
    }),
  )
  assert.deepEqual(normalizedDatabase, { state: "unavailable" })
  assert.equal((normalizedFailures[0] as { reason: string }).reason, "database")
})

test("only our own stable throw codes reach the failure-code tag", async () => {
  for (const [thrown, expected] of [
    ["accepted_routine_product_unavailable", "accepted_routine_product_unavailable"],
    [
      "accepted_routine_product_identity_unavailable",
      "accepted_routine_product_identity_unavailable",
    ],
    ["refined_need_not_found", "refined_need_not_found"],
    ['invalid input syntax for type uuid: "secret-value"', "unknown"],
  ] as const) {
    const failures: Array<{ failureCode?: string }> = []
    const view = await resolveAnwendungPage(
      readyDeps({
        adaptRoutine: async () => {
          throw new Error(thrown)
        },
        reportFailure: (details) => failures.push(details),
      }),
    )

    assert.deepEqual(view, { state: "unavailable" })
    assert.equal(failures[0]?.failureCode, expected, thrown)
  }
})

test("a degraded catalog product keeps the page ready and reports one per-item warning", async () => {
  const degradedProductId = "10000000-0000-4000-8000-000000000077"
  const failures: Array<Record<string, unknown>> = []
  const base = readyDeps()
  const view = await resolveAnwendungPage(
    readyDeps({
      adaptRoutine: async (options) => ({
        ...(await base.adaptRoutine(options)),
        unresolvedRoutineItems: [
          {
            itemId: "item:leave-in",
            category: "leave_in" as const,
            role: "leave_in" as const,
            routineOrder: 1,
            applicationInstanceKey: "assignment:leave-in",
            reason: "catalog_unavailable" as const,
          },
        ],
        degradedItems: [
          {
            productId: degradedProductId,
            category: "leave_in",
            issue: "catalog_identity_mismatch" as const,
          },
        ],
      }),
      reportFailure: (details) => failures.push(details as unknown as Record<string, unknown>),
    }),
  )

  assert.equal(view.state, "ready")
  assert.equal(failures.length, 1, JSON.stringify(failures))
  assert.equal(failures[0]?.reason, "product_guidance_unresolved")
  assert.equal(failures[0]?.issueCode, "catalog_identity_mismatch")
  assert.equal(failures[0]?.productId, degradedProductId)
})

test("a rendered partial day is usable and does not emit a route failure", async () => {
  const failures: unknown[] = []
  const view = await resolveAnwendungPage(
    readyDeps({
      adaptRoutine: async () => ({
        routineVersionId: "routine-1",
        planId: "plan-1",
        // A confirmed shampoo plus a genuinely unresolved conditioner slot (no
        // product chosen) is what makes a day partial now — a planned product
        // alone no longer does, since a selected catalog product is instantly
        // a full routine member.
        routineItems: [shampooItem],
        unresolvedRoutineItems: [
          {
            itemId: "item:conditioner-gap",
            category: "conditioner",
            role: "condition",
            routineOrder: 1,
            applicationInstanceKey: "assignment:conditioner-gap",
          },
        ],
        degradedItems: [],
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
          degradedItems: [],
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
        degradedItems: [],
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
  // A planned Heat item with a chosen product is instantly a full routine
  // member: the day is confirmed, not partial.
  assert.equal(stylingDay.isPartial, false)
  assert.equal(stylingDay.provisionalProductCount, 0)
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

// --- Hair Tools: read-time tool blocks in the Anwendung ------------------------------

const toolPayload = { source: { refinedVersionId: "refined-1" }, items: [] } as never

function toolDeps(overrides: Partial<AnwendungResolverDeps> = {}) {
  const reads = { enabled: 0, facts: 0, refined: 0 }
  const lena = lenaFacts()
  const deps = readyDeps({
    loadRoutineVersion: async () => ({ id: "routine-1", payload: toolPayload }),
    toolsEnabled: async () => {
      reads.enabled += 1
      return true
    },
    tools: {
      loadFacts: async () => {
        reads.facts += 1
        return lena
      },
      loadRefinedOutputSnapshot: async () => {
        reads.refined += 1
        return lenaNeedSnapshot()
      },
    },
    ...overrides,
  })
  return { deps, reads }
}

function toolKinds(view: Awaited<ReturnType<typeof resolveAnwendungPage>>) {
  if (view.state !== "ready") return []
  return view.days.flatMap((day) => day.steps.filter((step) => step.kind === "tool_use"))
}

test("flag on: the Anwendung derives tool blocks from the member's current facts", async () => {
  const { deps, reads } = toolDeps()
  const view = await resolveAnwendungPage(deps)
  assert.equal(view.state, "ready")
  if (view.state !== "ready") return
  const wash = view.days.find((day) => day.dayType === "wash_day")!
  const toolOrder = wash.steps.flatMap((step, index) =>
    step.kind === "tool_use" ? [[index, step.typeLabelDe] as const] : [],
  )
  assert.deepEqual(
    toolOrder.map(([, label]) => label),
    ["Grobzinkiger Kamm", "Mikrofaser-Handtuch", "Föhn", "Glätteisen", "Glatter Kissenbezug"],
  )
  assert.equal(wash.shelf.filter((slot) => slot.kind === "tool").length, 5)
  assert.deepEqual(reads, { enabled: 1, facts: 1, refined: 1 })
})

test("flag on and off differ only by the tool steps and shelf slots", async () => {
  const off = await resolveAnwendungPage(
    readyDeps({ loadRoutineVersion: async () => ({ id: "routine-1", payload: toolPayload }) }),
  )
  const on = await resolveAnwendungPage(toolDeps().deps)
  assert.equal(on.state, "ready")
  assert.equal(off.state, "ready")
  if (on.state !== "ready" || off.state !== "ready") return
  const withoutTools = (day: (typeof on.days)[number]) => ({
    ...day,
    steps: day.steps.filter((step) => step.kind !== "tool_use"),
    shelf: day.shelf.filter((slot) => slot.kind !== "tool"),
  })
  assert.deepEqual(on.days.map(withoutTools), off.days)
})

test("flag off: no flag-dependent read, no facts read, the view is byte-identical", async () => {
  const baseline = await resolveAnwendungPage(readyDeps())
  for (const toolsEnabled of [undefined, async () => false]) {
    const { deps, reads } = toolDeps({
      toolsEnabled,
      loadRoutineVersion: readyDeps().loadRoutineVersion,
    })
    const view = await resolveAnwendungPage(deps)
    assert.deepStrictEqual(view, baseline)
    assert.equal(reads.facts, 0)
    assert.equal(reads.refined, 0)
  }
})

test("keepsake mode derives tools from current facts too", async () => {
  const { deps, reads } = toolDeps({
    loadKeepsakeContent: async () => ({
      personalPlanId: "plan-1",
      activeRoutineVersionId: "routine-1",
    }),
    loadJourneyAccess: async () => {
      throw new Error("journey access must not be consulted in keepsake mode")
    },
  })
  const view = await resolveAnwendungPage(deps, undefined, { keepsake: true })
  assert.ok(toolKinds(view).length > 0)
  assert.equal(reads.facts, 1)
})

test("a member without Stage 5 access reads no Tool facts (the free tier's example never shows tools)", async () => {
  const { deps, reads } = toolDeps({
    loadJourneyAccess: async () => ({
      kind: "personal_plan" as const,
      personalPlanId: "plan-1",
      frontier: "stage4" as const,
      nextHref: "/routine" as const,
      allowed: { stage1: true, stage2: true, stage3: true, stage4: true, stage5: false },
    }),
  })
  assert.deepEqual(await resolveAnwendungPage(deps), { state: "feature_disabled" })
  assert.deepEqual(reads, { enabled: 0, facts: 0, refined: 0 })

  const source = readFileSync("src/app/anwendung/page.tsx", "utf8")
  assert.match(source, /if \(renderGatedExample\) return <GatedAnwendungExample \/>/)
  const exampleView = JSON.stringify(GATED_ANWENDUNG_EXAMPLE_VIEW)
  assert.doesNotMatch(exampleView, /tool_use|"kind":"tool"/)
})

test("a failing Tool read leaves the Anwendung exactly as it renders without Tools", async () => {
  const baseline = await resolveAnwendungPage(
    readyDeps({ loadRoutineVersion: async () => ({ id: "routine-1", payload: toolPayload }) }),
  )
  const failures: unknown[] = []
  for (const overrides of [
    {
      tools: {
        loadFacts: async () => {
          throw new Error("facts down")
        },
        loadRefinedOutputSnapshot: async () => lenaNeedSnapshot(),
      },
    },
    {
      tools: {
        loadFacts: async () => lenaFacts(),
        loadRefinedOutputSnapshot: async () => {
          throw new Error("snapshot down")
        },
      },
    },
    {
      tools: {
        loadFacts: async () => lenaFacts(),
        loadRefinedOutputSnapshot: async () => ({ not: "a snapshot" }),
      },
    },
    {
      toolsEnabled: async () => {
        throw new Error("flag down")
      },
    },
  ]) {
    const { deps } = toolDeps({ ...overrides, reportFailure: (d) => failures.push(d) })
    assert.deepStrictEqual(await resolveAnwendungPage(deps), baseline)
  }
  assert.equal(failures.length, 0, "a Tool problem is not an Anwendung failure")
})
