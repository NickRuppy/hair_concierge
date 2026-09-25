import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"
import { renderToStaticMarkup } from "react-dom/server"

import { createDiscoveryPdfPage } from "../src/app/admin/beratung/[enrollmentId]/pdf/page"
import { createDiscoveryItemFrequencyHandler } from "../src/app/api/admin/beratung/[enrollmentId]/items/[itemId]/frequency/route"
import { createDiscoveryItemUsageHandler } from "../src/app/api/admin/beratung/[enrollmentId]/items/[itemId]/route"
import {
  discoveryIntakeProductUsageLine,
  saveDiscoveryItemFrequency,
  saveDiscoveryItemUsage,
} from "../src/components/discovery/cockpit/discovery-intake-products"
import {
  buildDiscoveryCockpitView,
  discoveryCategoryOpenItems,
  discoveryResearchOpenItems,
  loadDiscoveryCockpitItems,
  loadDiscoveryCockpitModel,
  setDiscoveryIntakeItemFrequency,
  type DiscoveryCallIntake,
  type DiscoveryCockpitDependencies,
  type DiscoveryCockpitModel,
} from "../src/lib/discovery/cockpit"
import type { DiscoveryEnrollment } from "../src/lib/discovery/enrollment"
import type { DiscoveryHeatStylingV1 } from "../src/lib/discovery/heat-styling"
import type { DiscoveryIdealStep } from "../src/lib/discovery/load-ideal-routine"
import {
  composeDiscoveryRefinedRoutine,
  reduceIntakeItemsToSteps,
  type DiscoveryIntakeItem,
} from "../src/lib/discovery/refined-routine"
import {
  DISCOVERY_RESEARCH_STATUS_COPY,
  discoveryResearchStatus,
  discoveryResearchSubmissionInput,
} from "../src/lib/discovery/research-status"
import { buildDiscoveryRoutineContext } from "../src/lib/discovery/routine-context"
import type { PlanRoutineContext } from "../src/lib/personal-plan/types"

/**
 * Batch 7 (plan plans/discovery-refinement-b7/plan.md Rev. 3, §2.3/§2.4): the cockpit reads
 * her new answers first and lets them shape the Idealroutine — but ONLY for an intake that has
 * them, so every finalised legacy call keeps its fingerprint through the cockpit AND the PDF.
 * Plus: D1 binding, D2 styling, „Hitzeschutz: im Call fragen", the frequency correction.
 */

const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  intake: "40000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
  shampoo: "30000000-0000-4000-8000-000000000003",
  conditioner: "30000000-0000-4000-8000-000000000004",
  shampooItem: "50000000-0000-4000-8000-000000000001",
  conditionerItem: "50000000-0000-4000-8000-000000000002",
  sprayItem: "50000000-0000-4000-8000-000000000003",
}

function step(overrides: Partial<DiscoveryIdealStep> = {}): DiscoveryIdealStep {
  return {
    decisionKey: "decision:shampoo:shampoo_everyday:gap",
    category: "shampoo",
    role: "shampoo_everyday",
    section: "basis",
    categoryLabel: "Shampoo",
    roleLabel: "Hauptreinigung",
    roleDescription: "Kopfhaut waschen",
    frequencyLabel: "3× / Woche",
    preview: null,
    ...overrides,
  }
}

const conditionerStep = step({
  decisionKey: "decision:conditioner:conditioner_rinse_out:gap",
  category: "conditioner",
  role: "conditioner_rinse_out",
  categoryLabel: "Conditioner",
  roleLabel: "Pflege",
  roleDescription: "Pflegt die Längen.",
})

function item(overrides: Partial<DiscoveryIntakeItem> = {}): DiscoveryIntakeItem {
  return {
    id: ids.shampooItem,
    category: "shampoo",
    source: "catalog_search",
    brandText: "Elvital",
    productNameText: "Hyaluron Pure",
    barcodeIdentifier: null,
    productId: ids.shampoo,
    productSubmissionId: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    ...overrides,
  }
}

const legacyItems: DiscoveryIntakeItem[] = [
  item(),
  item({
    id: ids.conditionerItem,
    category: "conditioner",
    productId: ids.conditioner,
    brandText: "Gliss",
    productNameText: "Aqua Revive",
    createdAt: "2026-09-20T10:01:00.000Z",
  }),
]

const STRAIGHTENER: DiscoveryHeatStylingV1 = {
  dryingRoutes: ["air_dry"],
  additionalHeatTools: ["straightener"],
  heatEvents: { "heat:straightener": { frequency: "weekly_2x", protectionConsistency: "no" } },
}

type IdealCall = { options: { routineOverride?: PlanRoutineContext | null } | undefined }

function modelDeps(input: {
  items: DiscoveryIntakeItem[]
  heat?: DiscoveryHeatStylingV1 | null
  steps?: DiscoveryIdealStep[]
  heatProtectionDeferred?: boolean
  calls?: IdealCall[]
}): Partial<DiscoveryCockpitDependencies> {
  return {
    loadItems: async () => input.items,
    loadHeatStyling: async () => input.heat ?? null,
    loadIdealRoutine: async (_admin, _user, _intake, options) => {
      input.calls?.push({ options })
      return {
        status: "ready",
        steps: input.steps ?? [step(), conditionerStep],
        routineSource: options?.routineOverride ? "intake_answers" : "quiz_only",
        heatProtectionDeferred: input.heatProtectionDeferred ?? false,
        context: { snapshot: {} } as never,
        previewSource: { personalPlanId: "p", sourceNeedVersionId: "v" },
      }
    },
    loadVerdicts: async () => [],
    loadDecisions: async () => [],
    loadSwapProducts: async () => [],
    loadProductIdentities: async () => new Map(),
    loadResearchState: async () => ({
      submissions: new Map(),
      latestJobs: new Map(),
      eligible: new Set<string>(),
    }),
    loadApplication: async () => ({ print: { days: [] }, gaps: [] }) as never,
  }
}

async function model(input: Parameters<typeof modelDeps>[0]): Promise<DiscoveryCockpitModel> {
  const result = await loadDiscoveryCockpitModel(
    {} as never,
    { intakeId: ids.intake, userId: ids.user },
    modelDeps(input),
  )
  assert.equal(result.status, "ready")
  return result as DiscoveryCockpitModel
}

/** The hash a pre-batch-7 „Finalisieren" stored for these very inputs. */
const LEGACY_STORED_HASH = composeDiscoveryRefinedRoutine({
  steps: [step(), conditionerStep],
  items: legacyItems,
  decisions: [],
  swapProducts: [],
  ownedProducts: [],
  productLines: new Map(),
  productImages: new Map(),
}).sourceHash

// --- Legacy protection + the gate (Codex P1-2) ----------------------------------------

test("a legacy intake (no frequency, no heat) runs today's computation and keeps its stored hash", async () => {
  const calls: IdealCall[] = []
  const legacy = await model({ items: legacyItems, calls })
  assert.deepEqual(calls, [{ options: undefined }], "no routine override for a legacy intake")
  assert.equal(legacy.routine.sourceHash, LEGACY_STORED_HASH)
  assert.equal(legacy.routineSource, "quiz_only")
  assert.equal(buildDiscoveryCockpitView(legacy).sourceHash, LEGACY_STORED_HASH)
})

const enrollment: DiscoveryEnrollment = {
  enrollmentId: ids.enrollment,
  name: "Lena M.",
  email: "lena@example.test",
  tokenVersion: 1,
  claimedUserId: ids.user,
  claimedAt: "2026-09-19T10:00:00.000Z",
  createdAt: "2026-09-18T10:00:00.000Z",
}

const finalizedIntake: DiscoveryCallIntake = {
  id: ids.intake,
  enrollmentId: ids.enrollment,
  userId: ids.user,
  state: "submitted",
  submittedAt: "2026-09-20T18:41:00.000Z",
  callFinalizedAt: "2026-09-22T12:00:00.000Z",
  finalizedSourceHash: LEGACY_STORED_HASH,
}

async function renderPdf(items: DiscoveryIntakeItem[], heat: DiscoveryHeatStylingV1 | null) {
  const Page = createDiscoveryPdfPage({
    flagEnabled: () => true,
    requireAdmin: async () => ({ userId: "admin-1" }) as never,
    createAdminClient: () => ({}) as never,
    loadEnrollment: async () => enrollment,
    loadIntake: async () => finalizedIntake,
    // The REAL read model, faked only at its loaders.
    loadModel: (admin, input) =>
      loadDiscoveryCockpitModel(admin, input, modelDeps({ items, heat })),
  })
  return renderToStaticMarkup(
    await Page({ params: Promise.resolve({ enrollmentId: ids.enrollment }) }),
  )
}

test("the PDF of a finalised legacy call shows no drift; the same call with new answers would", async () => {
  const legacy = await renderPdf(legacyItems, null)
  assert.ok(legacy.includes("Deine Routine, Lena M."))
  assert.ok(!legacy.includes("Stand hat sich geändert"), "a legacy call keeps its fingerprint")

  const withFrequency = await renderPdf(
    legacyItems.map((entry) => ({ ...entry, frequency: "weekly_3_4x" as const })),
    null,
  )
  assert.ok(withFrequency.includes("Stand hat sich geändert"))
})

test("a new intake's hash includes the new inputs: item frequency and heat answers", async () => {
  const calls: IdealCall[] = []
  const withFrequency = legacyItems.map((entry) => ({
    ...entry,
    frequency: "weekly_3_4x" as const,
  }))
  const byFrequency = await model({ items: withFrequency, calls })
  assert.notEqual(byFrequency.routine.sourceHash, LEGACY_STORED_HASH)
  // The override handed to the Idealroutine is exactly the pure builder's.
  assert.deepEqual(calls[0].options, {
    routineOverride: buildDiscoveryRoutineContext(withFrequency, null),
  })
  assert.equal(byFrequency.routineSource, "intake_answers")

  const byHeat = await model({ items: legacyItems, heat: STRAIGHTENER })
  assert.notEqual(byHeat.routine.sourceHash, LEGACY_STORED_HASH)
  const otherHeat = await model({
    items: legacyItems,
    heat: { dryingRoutes: ["air_dry"], additionalHeatTools: [], heatEvents: {} },
  })
  assert.notEqual(otherHeat.routine.sourceHash, byHeat.routine.sourceHash)
})

test("the cockpit read model carries a frequency only when she was asked", async () => {
  const rows = [
    { frequency: null, id: "a" },
    { frequency: "weekly_1x", id: "b" },
    { frequency: "unknown", id: "c" },
  ].map((extra) => ({
    category: "mask",
    source: "name_research",
    brand_text: "Balea",
    product_name_text: "Kur",
    barcode_identifier: null,
    product_id: null,
    product_submission_id: null,
    created_at: "2026-09-20T10:00:00.000Z",
    ...extra,
  }))
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
      resolve({ data: rows, error: null }),
  }
  const [legacy, asked, unknown] = await loadDiscoveryCockpitItems(ids.intake, {
    from: () => chain,
  } as never)
  assert.ok(!("frequency" in legacy), "a legacy row gets no new key")
  assert.equal(asked.frequency, "weekly_1x")
  assert.equal(unknown.frequency, "unknown")
})

// --- View: frequency, heat block, „Hitzeschutz: im Call fragen" ------------------------

test("the product list shows her frequency; the heat block her answers", async () => {
  const view = buildDiscoveryCockpitView(
    await model({
      items: [item({ frequency: "weekly_3_4x" }), { ...legacyItems[1] }],
      heat: STRAIGHTENER,
    }),
  )
  const [shampoo, conditioner] = view.intakeProducts
  assert.equal(shampoo.frequency, "weekly_3_4x")
  assert.equal(shampoo.frequencyLabel, "3–4× pro Woche")
  assert.equal(discoveryIntakeProductUsageLine(shampoo), "Shampoo · 3–4× pro Woche")
  assert.equal(conditioner.frequency, null)
  assert.equal(discoveryIntakeProductUsageLine(conditioner), "Conditioner")
  assert.deepEqual(view.heatStyling, {
    drying: "Lufttrocknen",
    tools: [{ label: "Glätteisen", frequency: "2× pro Woche", protection: "Hitzeschutz: nein" }],
  })
  assert.equal(view.routineSource, "intake_answers")
})

test("„Hitzeschutz: im Call fragen“ is display only: it never moves the fingerprint", async () => {
  const asks = await model({ items: legacyItems, heatProtectionDeferred: true })
  const quiet = await model({ items: legacyItems, heatProtectionDeferred: false })
  assert.equal(buildDiscoveryCockpitView(asks).heatProtectionAsk, true)
  assert.equal(buildDiscoveryCockpitView(quiet).heatProtectionAsk, false)
  assert.equal(asks.routine.sourceHash, quiet.routine.sourceHash)
  assert.equal(asks.routine.sourceHash, LEGACY_STORED_HASH)
  assert.equal(buildDiscoveryCockpitView(quiet).heatStyling, null)
})

// --- D2 styling --------------------------------------------------------------------------

const sprayItem = item({
  id: ids.sprayItem,
  category: null,
  productType: "styling",
  productId: null,
  source: "name_research",
  brandText: "Taft",
  productNameText: "Haarspray",
  frequency: "daily_1x",
  createdAt: "2026-09-20T10:02:00.000Z",
})

test("D2: a styling product is „Styling (nicht bewertet)“ — never category_unknown, never blocking", async () => {
  const reduction = reduceIntakeItemsToSteps([step()], [sprayItem])
  assert.deepEqual(
    reduction.unassignedIntakeProducts.map((entry) => entry.reason),
    ["styling_not_evaluated"],
  )
  const view = buildDiscoveryCockpitView(await model({ items: [...legacyItems, sprayItem] }))
  assert.deepEqual(discoveryCategoryOpenItems(view), [])
  assert.deepEqual(discoveryResearchOpenItems(view), [])
  const spray = view.intakeProducts.find((entry) => entry.itemId === ids.sprayItem)
  assert.ok(spray, "listed in the cockpit")
  assert.equal(spray.productType, "styling")
  assert.equal(spray.typeOpen, false)
  assert.equal(spray.canStartResearch, false)
  assert.equal(spray.status, "styling_not_evaluated")
  assert.equal(discoveryIntakeProductUsageLine(spray), "Styling (nicht bewertet) · Täglich")
  assert.deepEqual(
    view.unassigned.map((entry) => [entry.label, entry.reason]),
    [["Taft Haarspray", "styling_not_evaluated"]],
  )
})

test("D2: research never starts for a styling product", () => {
  assert.equal(discoveryResearchSubmissionInput(sprayItem), null)
  assert.deepEqual(discoveryResearchStatus(sprayItem, null), {
    kind: "styling_not_evaluated",
    action: null,
  })
  assert.equal(DISCOVERY_RESEARCH_STATUS_COPY.styling_not_evaluated, "Styling – nicht bewertet")
})

// --- D1 binding ---------------------------------------------------------------------------

test("D1: a pre-wash conditioner binds like a role-less conditioner — never left unassigned", () => {
  const preWash = item({
    id: ids.conditionerItem,
    category: "conditioner",
    usageRole: "pre_wash_conditioner",
    productId: ids.conditioner,
  })
  const reduction = reduceIntakeItemsToSteps([step(), conditionerStep], [legacyItems[0], preWash])
  assert.equal(reduction.bindings[1].item?.id, ids.conditionerItem)
  assert.deepEqual(reduction.unassignedIntakeProducts, [])
})

// --- Admin frequency correction -----------------------------------------------------

function adminRequest(body: unknown, origin = "https://chaarlie.de") {
  return new NextRequest(
    `https://chaarlie.de/api/admin/beratung/${ids.enrollment}/items/${ids.shampooItem}/frequency`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify(body),
    },
  )
}

function frequencyDeps(
  intake: Partial<DiscoveryCallIntake>,
  calls: unknown[],
  outcome: "updated" | "item_not_found" | "finalized" = "updated",
) {
  return {
    flagEnabled: () => true,
    requireAdmin: async () => ({ userId: "admin-1" }) as never,
    createAdminClient: () => ({}) as never,
    loadIntake: async () => ({
      ...finalizedIntake,
      callFinalizedAt: null,
      finalizedSourceHash: null,
      ...intake,
    }),
    setFrequency: async (input: unknown) => {
      calls.push(input)
      return { outcome }
    },
  }
}

async function putFrequency(
  deps: ReturnType<typeof frequencyDeps>,
  body: unknown,
  origin?: string,
) {
  const response = await createDiscoveryItemFrequencyHandler(deps)(adminRequest(body, origin), {
    params: Promise.resolve({ enrollmentId: ids.enrollment, itemId: ids.shampooItem }),
  })
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

test("admin frequency correction: updated on a submitted, unfinalised call", async () => {
  const calls: unknown[] = []
  const result = await putFrequency(frequencyDeps({}, calls), { frequency: "weekly_1x" })
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, { outcome: "updated" })
  assert.deepEqual(calls, [
    { intakeId: ids.intake, itemId: ids.shampooItem, frequency: "weekly_1x" },
  ])
})

test("admin frequency correction: same guard as the usage correction", async () => {
  const cases: Array<[Partial<DiscoveryCallIntake>, unknown, string | undefined, number, string]> =
    [
      [{}, { frequency: "weekly_1x" }, "https://evil.example", 403, "cross_origin"],
      [
        { callFinalizedAt: "2026-09-22T12:00:00.000Z", finalizedSourceHash: "h" },
        { frequency: "weekly_1x" },
        undefined,
        409,
        "finalized",
      ],
      [
        { state: "draft", submittedAt: null },
        { frequency: "weekly_1x" },
        undefined,
        409,
        "not_submitted",
      ],
      [{}, { frequency: "often" }, undefined, 400, "invalid_body"],
      [{}, { frequency: "weekly_1x", itemId: "x" }, undefined, 400, "invalid_body"],
    ]
  for (const [intake, body, origin, status, code] of cases) {
    const calls: unknown[] = []
    const result = await putFrequency(frequencyDeps(intake, calls), body, origin)
    assert.equal(result.status, status, code)
    assert.equal(result.body.code, code)
    assert.deepEqual(calls, [])
  }
  const missing = await putFrequency(frequencyDeps({}, [], "item_not_found"), {
    frequency: "unknown",
  })
  assert.equal(missing.status, 404)
  assert.equal(missing.body.code, "not_found")
  const raced = await putFrequency(frequencyDeps({}, [], "finalized"), { frequency: "unknown" })
  assert.equal(raced.status, 409)
})

test("the frequency RPC wrapper passes its arguments and refuses an unknown outcome", async () => {
  const rpcCalls: unknown[] = []
  const client = (outcome: string) =>
    ({
      rpc: async (name: string, args: unknown) => {
        rpcCalls.push([name, args])
        return { data: { outcome }, error: null }
      },
    }) as never
  assert.deepEqual(
    await setDiscoveryIntakeItemFrequency(
      { intakeId: ids.intake, itemId: ids.shampooItem, frequency: "daily_1x" },
      client("updated"),
    ),
    { outcome: "updated" },
  )
  assert.deepEqual(rpcCalls, [
    [
      "discovery_admin_set_intake_item_frequency",
      { target_intake_id: ids.intake, target_item_id: ids.shampooItem, new_frequency: "daily_1x" },
    ],
  ])
  await assert.rejects(
    setDiscoveryIntakeItemFrequency(
      { intakeId: ids.intake, itemId: ids.shampooItem, frequency: "daily_1x" },
      client("maybe"),
    ),
  )
})

test("the cockpit's frequency save calls the route and reloads on success", async () => {
  const requests: Array<[string, RequestInit | undefined]> = []
  const ok = await saveDiscoveryItemFrequency(
    { enrollmentId: ids.enrollment, itemId: ids.shampooItem, frequency: "weekly_2x" },
    async (url, init) => {
      requests.push([url, init])
      return new Response(JSON.stringify({ outcome: "updated" }), { status: 200 })
    },
  )
  assert.deepEqual(ok, { error: null, refresh: true })
  assert.equal(
    requests[0][0],
    `/api/admin/beratung/${ids.enrollment}/items/${ids.shampooItem}/frequency`,
  )
  assert.equal(requests[0][1]?.method, "PUT")
  assert.equal(requests[0][1]?.body, JSON.stringify({ frequency: "weekly_2x" }))
  const refused = await saveDiscoveryItemFrequency(
    { enrollmentId: ids.enrollment, itemId: ids.shampooItem, frequency: "weekly_2x" },
    async () => new Response(JSON.stringify({ code: "finalized" }), { status: 409 }),
  )
  assert.deepEqual(refused, { error: "Erst Finalisierung aufheben.", refresh: false })
})

async function patchUsage(
  usageModel: DiscoveryCockpitModel,
  itemId: string,
  body: unknown,
  calls: unknown[],
) {
  const response = await createDiscoveryItemUsageHandler({
    flagEnabled: () => true,
    requireAdmin: async () => ({ userId: "admin-1" }) as never,
    createAdminClient: () => ({}) as never,
    loadIntake: async () => ({
      ...finalizedIntake,
      callFinalizedAt: null,
      finalizedSourceHash: null,
    }),
    loadModel: async () => usageModel,
    setUsage: async (input) => {
      calls.push(input)
      return { outcome: "updated", noneInserted: false, noneRemoved: false, decisionsCleared: 0 }
    },
  })(
    new NextRequest(`https://chaarlie.de/api/admin/beratung/${ids.enrollment}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Origin: "https://chaarlie.de" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ enrollmentId: ids.enrollment, itemId }) },
  )
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

test("D2: a styling product can be corrected into an evaluated type — type and usage together", async () => {
  const usageModel = await model({ items: [...legacyItems, sprayItem] })
  const calls: Array<Record<string, unknown>> = []
  const result = await patchUsage(
    usageModel,
    ids.sprayItem,
    { usage: { category: "leave_in", role: null }, productType: "leave_in" },
    calls,
  )
  assert.equal(result.status, 200)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].itemId, ids.sprayItem)
  assert.equal(calls[0].category, "leave_in")
  assert.equal(calls[0].role, null)
  assert.equal(calls[0].productType, "leave_in")
})

test("D2: an evaluated product can be moved into „Styling (nicht bewertet)“ — no usage", async () => {
  const usageModel = await model({ items: [...legacyItems, sprayItem] })
  const calls: Array<Record<string, unknown>> = []
  const result = await patchUsage(
    usageModel,
    ids.conditionerItem,
    { usage: null, productType: "styling" },
    calls,
  )
  assert.equal(result.status, 200)
  assert.equal(calls[0].category, null)
  assert.equal(calls[0].role, null)
  assert.equal(calls[0].productType, "styling")
  // Its old step loses its bound item: that decision is stale.
  assert.ok(Array.isArray(calls[0].staleDecisionKeys))
})

test("D2: styling corrections refuse what the CHECK would refuse", async () => {
  const usageModel = await model({ items: [...legacyItems, sprayItem] })
  const cases: Array<[string, unknown, number, string]> = [
    // A styling item leaving styling needs its type.
    [ids.sprayItem, { usage: { category: "leave_in", role: null } }, 400, "product_type_required"],
    // Already styling.
    [ids.sprayItem, { usage: null, productType: "styling" }, 409, "type_known"],
    // Styling carries no usage…
    [
      ids.conditionerItem,
      { usage: { category: "leave_in", role: null }, productType: "styling" },
      400,
      "invalid_usage",
    ],
    // …and everything else needs one.
    [ids.conditionerItem, { usage: null }, 400, "invalid_body"],
  ]
  for (const [itemId, body, status, code] of cases) {
    const calls: unknown[] = []
    const result = await patchUsage(usageModel, itemId, body, calls)
    assert.equal(result.status, status, code)
    assert.equal(result.body.code, code)
    assert.deepEqual(calls, [])
  }
})

test("D2: saving „Styling (nicht bewertet)“ from the cockpit never starts research", async () => {
  const requests: string[] = []
  const outcome = await saveDiscoveryItemUsage(
    {
      enrollmentId: ids.enrollment,
      itemId: ids.conditionerItem,
      usage: null,
      productType: "styling",
    },
    async (url, init) => {
      requests.push(`${init?.method} ${url} ${init?.body}`)
      return new Response(JSON.stringify({ outcome: "updated" }), { status: 200 })
    },
  )
  assert.deepEqual(outcome, { error: null, refresh: true, researchStarted: false })
  assert.deepEqual(requests, [
    `PATCH /api/admin/beratung/${ids.enrollment}/items/${ids.conditionerItem} {"usage":null,"productType":"styling"}`,
  ])
})
