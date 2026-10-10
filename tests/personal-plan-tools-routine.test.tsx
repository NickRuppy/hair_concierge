import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { createPersonalPlanRoutineRouteHandlers } from "@/app/api/personal-plan/routine/route"
import { resolveKeepsakeRoutinePage, resolveRoutinePage } from "@/app/routine/page"
import { RoutinePage } from "@/components/routine/personal-plan/routine-page"
import { computeNeedPlan } from "@/lib/personal-plan/compute-stage1"
import {
  routinePayloadV1Schema,
  type PersonalPlanRoutineView,
  type RoutinePayloadV1,
} from "@/lib/personal-plan/routine/contracts"
import { loadPersonalPlanRoutineView } from "@/lib/personal-plan/routine/load-view"
import type { PersonalPlanRoutineReadClient } from "@/lib/personal-plan/routine/repository"
import type { ToolAsset } from "@/lib/personal-plan/tools/contracts"
import { TOOL_DERIVED_NOTE } from "@/lib/personal-plan/tools/presentation"
import type { ToolFactsSource, ToolRoutineSection } from "@/lib/personal-plan/tools/read-view"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

/**
 * Routine `Deine Tools`, derived at read time (plan `2026-10-09-hair-tools-port` §4): the
 * section is composed next to the active V1 payload from the member's current facts and the
 * routine-linked refined need snapshot. The payload itself never changes.
 */

const ids = {
  plan: "11111111-1111-4111-8111-111111111111",
  active: "22222222-2222-4222-8222-222222222222",
  refined: "55555555-5555-4555-8555-555555555555",
}

function refinedSnapshot() {
  const computed = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "artifact-1",
    projection: "initial_quiz",
    computationVersion: "test",
    createdAt: "2026-10-10T00:00:00.000Z",
  })
  assert.equal(computed.status, "ready")
  if (computed.status !== "ready") throw new Error("unreachable")
  return computed.snapshot
}

function v1Payload(): RoutinePayloadV1 {
  const snapshot = refinedSnapshot()
  return routinePayloadV1Schema.parse({
    schemaVersion: 1,
    planId: ids.plan,
    versionId: ids.active,
    parentVersionId: null,
    source: {
      refinedVersionId: ids.refined,
      productPortfolioVersionId: ids.active,
      sourceFingerprint: "a".repeat(64),
      compilerVersion: "v1",
      authorityVersions: {},
    },
    intent: {
      schemaVersion: 1,
      categories: snapshot.renderedOrder.map((category) => ({
        category,
        inclusion: "included",
        inclusionSource: "stage3",
        assignments: [],
      })),
    },
    sections: [
      { key: "basis", itemKeys: [] },
      { key: "optional", itemKeys: [] },
    ],
    items: [],
    createdAt: "2026-10-10T00:00:00.000Z",
  })
}

function fakeClient(input: {
  calls: string[]
  payload?: unknown
  refined?: unknown
}): PersonalPlanRoutineReadClient {
  return {
    from(table) {
      const query = {
        select() {
          return query
        },
        eq() {
          return query
        },
        async maybeSingle() {
          input.calls.push(table)
          if (table === "personal_plans") {
            return {
              data: {
                id: ids.plan,
                revision: 1,
                source_revision: 1,
                active_routine_version_id: ids.active,
                pending_routine_proposal_id: null,
              },
              error: null,
            }
          }
          if (table === "personal_plan_routine_versions") {
            return { data: { id: ids.active, payload: input.payload ?? v1Payload() }, error: null }
          }
          if (table === "personal_plan_need_versions") {
            return {
              data: { id: ids.refined, output_snapshot: input.refined ?? refinedSnapshot() },
              error: null,
            }
          }
          return { data: null, error: null }
        },
      }
      return query
    },
  }
}

const LENA_LIKE: ToolFactsSource = {
  careHabits: {
    toolFamiliesWithSomething: ["brushes_combs", "drying_textiles"],
    toolForms_brushes_combs_1: ["wide_tooth_comb"],
    toolForms_brushes_combs_2: [],
    toolForms_drying_textiles_1: ["microfiber_towel"],
    towel: { material: "mikrofaser", technique: "gentle_press" },
    dryingRoutes: ["ordinary_blow_dry"],
  },
  fieldProvenance: {
    toolFamiliesWithSomething: "user",
    toolForms_brushes_combs_1: "user",
    toolForms_brushes_combs_2: "user",
    toolForms_drying_textiles_1: "user",
    towel: "user",
    dryingRoutes: "user",
  },
}

/* ── load-view composition ───────────────────────────────────────────── */

test("flag off: no facts read, no section, the view is exactly today's", async () => {
  const calls: string[] = []
  const view = await loadPersonalPlanRoutineView({
    client: fakeClient({ calls }),
    userId: "user-1",
    enabled: true,
  })
  assert.equal(view.status, "active")
  assert.equal("toolSection" in view, false)
})

test("flag on: the section is derived from facts + refined snapshot; the V1 payload is untouched", async () => {
  const calls: string[] = []
  let factReads = 0
  const payload = v1Payload()
  const view = (await loadPersonalPlanRoutineView({
    client: fakeClient({ calls, payload }),
    userId: "user-1",
    enabled: true,
    tools: {
      loadFacts: async (userId) => {
        assert.equal(userId, "user-1")
        factReads += 1
        return LENA_LIKE
      },
    },
  })) as PersonalPlanRoutineView
  assert.equal(factReads, 1)
  assert.deepEqual(view.activeVersion?.payload, payload, "payload unchanged")
  assert.equal(view.activeVersion?.payload.schemaVersion, 1)
  for (const key of ["toolAssets", "toolOccurrences", "toolGuidance"]) {
    assert.equal(key in (view.activeVersion!.payload as object), false, key)
  }
  const section = view.toolSection
  assert.ok(section, "a section is composed")
  const keys = section!.assets.map((asset) => asset.assetKey)
  assert.ok(keys.includes("asset:brushes_combs:wide_tooth_comb"))
  assert.ok(keys.includes("asset:drying_textiles:microfiber_towel"))
  // „du föhnst" without an airflow page: a derived Föhn, marked.
  assert.ok(section!.derivedAssetKeys.includes("asset:airflow:hair_dryer"))
  // The category-order check and the tool section share one refined-snapshot read.
  assert.equal(calls.filter((table) => table === "personal_plan_need_versions").length, 1)
})

test("flag on, keepsake read (enabled false): tools come from current facts too", async () => {
  const calls: string[] = []
  const view = (await loadPersonalPlanRoutineView({
    client: fakeClient({ calls }),
    userId: "user-1",
    enabled: false,
    tools: { loadFacts: async () => LENA_LIKE },
  })) as PersonalPlanRoutineView
  assert.equal(view.status, "active")
  assert.ok(view.toolSection)
})

test("flag on, failed facts read or unusable refined snapshot: no section, Routine unaffected", async () => {
  const failing = (await loadPersonalPlanRoutineView({
    client: fakeClient({ calls: [] }),
    userId: "user-1",
    enabled: true,
    tools: {
      loadFacts: async () => {
        throw new Error("facts unavailable")
      },
    },
  })) as PersonalPlanRoutineView
  assert.equal(failing.status, "active")
  assert.equal("toolSection" in failing, false)

  const snapshot = refinedSnapshot()
  const broken = (await loadPersonalPlanRoutineView({
    client: fakeClient({
      calls: [],
      refined: { renderedOrder: snapshot.renderedOrder, decisions: [] },
    }),
    userId: "user-1",
    enabled: true,
    tools: { loadFacts: async () => LENA_LIKE },
  })) as PersonalPlanRoutineView
  assert.equal(broken.status, "active")
  assert.equal("toolSection" in broken, false)
})

/* ── resolvers and the reload API ────────────────────────────────────── */

function resolverBase(seen: Array<boolean | undefined>) {
  return {
    getUserId: async () => "user-1",
    loadJourneyAccess: async () =>
      ({
        kind: "personal_plan_start",
        frontier: "stage4",
        nextHref: "/routine",
        allowed: { stage1: true, stage2: true, stage3: true, stage4: true, stage5: true },
      }) as never,
    stage4Enabled: () => true,
    readView: async (input: { userId: string; enabled: boolean; toolsEnabled?: boolean }) => {
      seen.push(input.toolsEnabled)
      return { status: "no_personal_plan" as const }
    },
  }
}

test("the Routine page hands the server-resolved flag to the view read (fail closed)", async () => {
  const seen: Array<boolean | undefined> = []
  const base = resolverBase(seen)
  await resolveRoutinePage({ ...base, toolsEnabled: async () => true })
  await resolveRoutinePage(base)
  await resolveRoutinePage({
    ...base,
    toolsEnabled: async () => {
      throw new Error("flag lookup failed")
    },
  })
  assert.deepEqual(seen, [true, false, false])
})

test("the keepsake Routine reads tools from current facts while the flag is on", async () => {
  const seen: Array<boolean | undefined> = []
  const readView = async (input: { userId: string; enabled: boolean; toolsEnabled?: boolean }) => {
    seen.push(input.toolsEnabled)
    assert.equal(input.enabled, false)
    return { status: "no_personal_plan" as const }
  }
  const base = {
    getUserId: async () => "user-1",
    loadKeepsakeContent: async () => ({}) as never,
    readView,
  }
  await resolveKeepsakeRoutinePage({ ...base, toolsEnabled: async () => true })
  await resolveKeepsakeRoutinePage(base)
  assert.deepEqual(seen, [true, false])
})

test("the Routine reload API composes the section only while the flag is on", async () => {
  const run = async (toolsEnabled: boolean) => {
    let factReads = 0
    const handlers = createPersonalPlanRoutineRouteHandlers({
      enabled: () => true,
      getUserId: async () => "user-1",
      loadJourneyAccess: async () =>
        ({
          kind: "personal_plan_start",
          frontier: "stage4",
          nextHref: "/routine",
          allowed: { stage1: true, stage2: true, stage3: true, stage4: true, stage5: true },
        }) as never,
      client: () => fakeClient({ calls: [] }),
      toolsEnabled: async () => toolsEnabled,
      tools: {
        loadFacts: async () => {
          factReads += 1
          return LENA_LIKE
        },
      },
    })
    const response = await handlers.GET()
    return { body: (await response.json()) as PersonalPlanRoutineView, factReads }
  }
  const on = await run(true)
  assert.ok(on.body.toolSection)
  assert.equal(on.factReads, 1)
  const off = await run(false)
  assert.equal("toolSection" in off.body, false)
  assert.equal(off.factReads, 0)
})

/* ── rendering ───────────────────────────────────────────────────────── */

const COMB: ToolAsset = {
  assetKey: "asset:brushes_combs:wide_tooth_comb",
  family: "brushes_combs",
  productTypes: ["wide_tooth_comb"],
  capabilities: ["detangle", "distribute_product"],
  ownership: "owned_generic",
  presentationState: "use_yours",
  routeKeys: [
    "tool:brushes_combs:detangling_foundation",
    "tool:brushes_combs:specialized_brush_job",
  ],
  labelKey: "Grobzinkiger Kamm",
  purposeKey: "Zum sanften Entwirren und Verteilen von Produkt",
  imageKey: "wide_tooth_comb",
}

const DRYER: ToolAsset = {
  assetKey: "asset:airflow:hair_dryer",
  family: "airflow",
  productTypes: ["hair_dryer"],
  capabilities: ["dry_hair"],
  ownership: "owned_generic",
  presentationState: "use_yours",
  routeKeys: ["tool:airflow:drying_standard"],
  labelKey: "Föhn",
  purposeKey: "Zum Trocknen",
  imageKey: "hair_dryer",
}

function viewWith(toolSection?: ToolRoutineSection): PersonalPlanRoutineView {
  return {
    status: "active",
    personalPlanId: ids.plan,
    planRevision: 1,
    sourceRevision: 1,
    activeVersion: { id: ids.active, payload: v1Payload() },
    pendingProposal: null,
    productPresentation: { catalogProducts: [] },
    ...(toolSection ? { toolSection } : {}),
  }
}

test("Deine Tools renders after the product sections and never as a consumable", () => {
  const markup = renderToStaticMarkup(
    <RoutinePage view={viewWith({ assets: [COMB], derivedAssetKeys: [] })} />,
  )
  assert.ok(markup.includes("data-routine-tool-section"))
  assert.ok(markup.includes("Deine Tools"))
  assert.ok(markup.includes("Grobzinkiger Kamm"))
  assert.ok(markup.includes("Nutze deins"))
  assert.ok(markup.indexOf("Deine Basis") < markup.indexOf("Deine Tools"), "products stay first")
  const toolSection = markup.slice(markup.indexOf("data-routine-tool-section"))
  for (const forbidden of ["läuft bald aus", "Nachbestellen", "Nachkaufen", "Vorrat"]) {
    assert.equal(toolSection.includes(forbidden), false, `${forbidden} must not appear on a Tool`)
  }
  assert.equal(toolSection.includes(TOOL_DERIVED_NOTE), false)
})

test("without a tool view the Routine renders exactly as today", () => {
  const markup = renderToStaticMarkup(<RoutinePage view={viewWith()} />)
  assert.equal(markup.includes("data-routine-tool-section"), false)
  assert.equal(markup.includes("Deine Tools"), false)
})

test("one physical Tool appears once in Routine even with several routes", () => {
  const markup = renderToStaticMarkup(
    <RoutinePage view={viewWith({ assets: [COMB], derivedAssetKeys: [] })} />,
  )
  assert.equal((markup.match(/data-routine-tool-row=/g) ?? []).length, 1)
})

test("a derived row carries its marking", () => {
  const markup = renderToStaticMarkup(
    <RoutinePage view={viewWith({ assets: [DRYER, COMB], derivedAssetKeys: [DRYER.assetKey] })} />,
  )
  assert.equal((markup.match(/data-routine-tool-derived="true"/g) ?? []).length, 1)
  assert.ok(markup.includes(TOOL_DERIVED_NOTE))
})
