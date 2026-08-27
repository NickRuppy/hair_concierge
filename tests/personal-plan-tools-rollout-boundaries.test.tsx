import assert from "node:assert/strict"
import test from "node:test"

import { resolveAnwendungPage, type AnwendungResolverDeps } from "@/app/anwendung/page"
import { resolveRoutinePage, type RoutinePageResolverDeps } from "@/app/routine/page"
import {
  handleStage1LoadOrCreate,
  type Stage1RouteDeps,
} from "@/app/api/personal-plan/stage-1/route"
import type { PersonalPlanJourneyAccess } from "@/lib/personal-plan/journey-access"
import {
  isRoutinePayloadV2,
  routineToolAssets,
  type PersonalPlanRoutineView,
  type RoutinePayload,
} from "@/lib/personal-plan/routine/contracts"
import {
  atDayAnchor,
  type ToolAsset,
  type ToolOccurrence,
} from "@/lib/personal-plan/tools/contracts"
import type { ApplicationDayTypeKey } from "@/lib/routines/personal-plan/application/contracts"
import { SHARED_APPLICATION_TEMPLATE_BY_KEY_V2 } from "@/lib/routines/personal-plan/application/shared-templates-v2"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

/**
 * The Tools rollout is server-owned and fails closed. These are the four
 * boundaries where a gated-off owner could otherwise still be SHOWN Tools:
 * the Routine page, the Anwendung page, and the Stage 1 API's stored snapshot.
 *
 * Stored FACTS are never touched — only the projection is removed.
 */

const PLAN_ID = "11111111-1111-4111-8111-111111111111"
const REFINED_ID = "22222222-2222-4222-8222-222222222222"

const COMB: ToolAsset = {
  assetKey: "asset:brushes_combs:wide_tooth_comb",
  family: "brushes_combs",
  productTypes: ["wide_tooth_comb"],
  capabilities: ["detangle", "distribute_product"],
  ownership: "owned_generic",
  presentationState: "use_yours",
  routeKeys: ["tool:brushes_combs:detangling_foundation"],
  labelKey: "Grobzinkiger Kamm",
  purposeKey: "Zum sanften Entwirren und Verteilen von Produkt",
  imageKey: "wide_tooth_comb",
}

const COMB_OCCURRENCE: ToolOccurrence = {
  occurrenceKey: "occurrence:tool:brushes_combs:detangling_foundation:post_wash",
  assetKey: COMB.assetKey,
  routeKey: "tool:brushes_combs:detangling_foundation",
  capability: "detangle",
  anchor: atDayAnchor("post_rinse_towel_dry"),
  sessionKey: null,
  executable: true,
  conditionalReason: null,
}

const V2_PAYLOAD = {
  schemaVersion: 2,
  planId: PLAN_ID,
  versionId: "routine-1",
  parentVersionId: null,
  source: {
    refinedVersionId: REFINED_ID,
    productPortfolioVersionId: "portfolio-1",
    sourceFingerprint: "a".repeat(64),
    compilerVersion: "test",
    authorityVersions: {},
  },
  intent: { schemaVersion: 1, categories: [] },
  sections: [
    { key: "basis", itemKeys: [] },
    { key: "optional", itemKeys: [] },
  ],
  items: [],
  createdAt: "2026-08-23T00:00:00.000Z",
  toolAssets: [COMB],
  toolOccurrences: [COMB_OCCURRENCE],
  toolGuidance: [],
} as unknown as RoutinePayload

const stage4Access: PersonalPlanJourneyAccess = {
  kind: "personal_plan",
  personalPlanId: PLAN_ID,
  frontier: "stage4",
  nextHref: "/routine",
  allowed: { stage1: true, stage2: true, stage3: true, stage4: true, stage5: false },
}

function toolsView(): PersonalPlanRoutineView {
  return {
    status: "active",
    personalPlanId: PLAN_ID,
    planRevision: 1,
    sourceRevision: 1,
    activeVersion: { id: "routine-1", payload: V2_PAYLOAD },
    pendingProposal: {
      id: "proposal-1",
      candidateVersionId: "routine-2",
      sourceRevision: 1,
      delta: { schemaVersion: 1, direct: [], consequential: [], unchangedItemCount: 0 },
      candidate: V2_PAYLOAD,
    },
    productPresentation: { catalogProducts: [] },
  }
}

function routineDeps(overrides: Partial<RoutinePageResolverDeps> = {}): RoutinePageResolverDeps {
  return {
    getUserId: async () => "user-1",
    loadJourneyAccess: async () => stage4Access,
    stage4Enabled: () => true,
    readView: async () => toolsView(),
    ...overrides,
  }
}

test("the Routine page strips every Tool payload when the rollout is off", async () => {
  const resolved = await resolveRoutinePage(routineDeps({ toolsEnabled: async () => false }))
  assert.equal(resolved.kind, "personal_plan")
  if (resolved.kind !== "personal_plan") throw new Error("unreachable")
  const active = resolved.view.activeVersion?.payload
  assert.ok(active)
  assert.equal(isRoutinePayloadV2(active), false, "no V2 Tool slice may reach the client")
  assert.deepEqual(routineToolAssets(active), [])
  const candidate = resolved.view.pendingProposal?.candidate
  assert.ok(candidate)
  assert.deepEqual(routineToolAssets(candidate), [], "the proposal candidate is gated too")
})

test("an unwired Routine page gate fails closed", async () => {
  const resolved = await resolveRoutinePage(routineDeps())
  if (resolved.kind !== "personal_plan") throw new Error("unreachable")
  assert.deepEqual(routineToolAssets(resolved.view.activeVersion!.payload), [])
})

test("the Routine page keeps its Tool payload when the rollout is on", async () => {
  const resolved = await resolveRoutinePage(routineDeps({ toolsEnabled: async () => true }))
  if (resolved.kind !== "personal_plan") throw new Error("unreachable")
  const active = resolved.view.activeVersion!.payload
  assert.equal(isRoutinePayloadV2(active), true)
  assert.deepEqual(routineToolAssets(active), [COMB])
  assert.deepEqual(routineToolAssets(resolved.view.pendingProposal!.candidate), [COMB])
})

// The smallest Anwendung fixture that compiles to a ready wash day, mirroring
// `tests/personal-plan-stage5-route.test.tsx`.
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
  evidence: [
    {
      sourceUrl: "https://example.com",
      sourceType: "manufacturer" as const,
      checkedAt: "2026-08-08",
    },
  ],
}

function anwendungDeps(overrides: Partial<AnwendungResolverDeps> = {}): AnwendungResolverDeps {
  return {
    getUserId: async () => "user-1",
    loadJourneyAccess: async (): Promise<PersonalPlanJourneyAccess> => ({
      kind: "personal_plan",
      personalPlanId: PLAN_ID,
      activeRoutineVersionId: "routine-1",
      frontier: "stage5",
      nextHref: "/anwendung",
      allowed: { stage1: true, stage2: true, stage3: true, stage4: true, stage5: true },
    }),
    loadRoutineVersion: async () => ({ id: "routine-1", payload: V2_PAYLOAD as never }),
    adaptRoutine: async () =>
      ({
        routineVersionId: "routine-1",
        planId: PLAN_ID,
        routineItems: [shampooItem],
        unresolvedRoutineItems: [],
        degradedItems: [],
        exactGuidanceProtocols: [],
        applicationPointersV2: [shampooPointer],
      }) as never,
    loadProfile: async () => ({}) as never,
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

function toolStepCount(view: Awaited<ReturnType<typeof resolveAnwendungPage>>): number {
  if (view.state !== "ready") return 0
  return view.days.reduce(
    (total, day) => total + day.steps.filter((step) => step.kind === "tool_use").length,
    0,
  )
}

test("the Anwendung page renders no Tool step when the rollout is off", async () => {
  assert.equal(
    toolStepCount(await resolveAnwendungPage(anwendungDeps({ toolsEnabled: async () => false }))),
    0,
  )
  assert.equal(
    toolStepCount(await resolveAnwendungPage(anwendungDeps())),
    0,
    "unwired fails closed",
  )
})

test("the Anwendung page renders its Tool steps when the rollout is on", async () => {
  const view = await resolveAnwendungPage(anwendungDeps({ toolsEnabled: async () => true }))
  assert.ok(toolStepCount(view) > 0, "a gated-on owner still sees their Tools")
})

const STAGE1_SNAPSHOT = {
  schemaVersion: 3,
  decisions: [],
  renderedOrder: [],
  toolPlan: {
    schemaVersion: 3,
    routes: [],
    choiceGroups: [],
    assets: [COMB],
    occurrences: [COMB_OCCURRENCE],
    guidance: [],
  },
}

function stage1Deps(overrides: Partial<Stage1RouteDeps> = {}): Stage1RouteDeps {
  return {
    getAuthenticatedUser: async () => ({ id: "user-1" }),
    loadJourneyAccess: async () => ({
      kind: "personal_plan_start",
      frontier: "stage1",
      nextHref: "/plan-start",
      allowed: { stage1: true, stage2: false, stage3: false, stage4: false, stage5: false },
    }),
    persistence: {
      isEnabled: () => true,
      cohortCutoff: () => new Date("2026-08-08T00:00:00.000Z"),
      findEntitlement: async () => ({
        accessState: "active",
        enrollmentSourceId: "purchase-1",
        qualifiedAt: "2026-08-08T01:00:00.000Z",
        artifactLeadId: "lead-1",
      }),
      loadArtifact: async () => ({ id: "artifact-1", quizAnswers: COMPLETE_V3_PLAN_ENVELOPE }),
      createOrReuseInitialNeed: async () => ({
        outcome: "completed",
        personalPlanId: PLAN_ID,
        needVersionId: "need-1",
        outputSnapshot: STAGE1_SNAPSHOT as never,
      }),
    },
    ...overrides,
  }
}

function snapshotOf(body: unknown): Record<string, unknown> {
  return (body as { outputSnapshot: Record<string, unknown> }).outputSnapshot
}

test("the Stage 1 API filters the stored snapshot server-side when the rollout is off", async () => {
  for (const deps of [stage1Deps({ toolsEnabled: async () => false }), stage1Deps()]) {
    const result = await handleStage1LoadOrCreate(deps)
    assert.equal(result.status, 200)
    assert.equal((result.body as { toolsEnabled: boolean }).toolsEnabled, false)
    assert.equal(
      "toolPlan" in snapshotOf(result.body),
      false,
      "the browser never receives a Tool plan it is not entitled to",
    )
    assert.equal(
      "toolPlan" in STAGE1_SNAPSHOT,
      true,
      "the stored fact itself is preserved untouched",
    )
  }
})

test("the Stage 1 API returns the stored snapshot unchanged when the rollout is on", async () => {
  const result = await handleStage1LoadOrCreate(stage1Deps({ toolsEnabled: async () => true }))
  assert.equal((result.body as { toolsEnabled: boolean }).toolsEnabled, true)
  assert.deepEqual(snapshotOf(result.body), STAGE1_SNAPSHOT)
})
