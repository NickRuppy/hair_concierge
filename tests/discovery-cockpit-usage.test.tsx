import assert from "node:assert/strict"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { NextRequest } from "next/server"
import { renderToStaticMarkup } from "react-dom/server"

import { createDiscoveryCockpitPage } from "../src/app/admin/beratung/[enrollmentId]/page"
import { createDiscoveryFinalizeHandler } from "../src/app/api/admin/beratung/[enrollmentId]/finalize/route"
import { createDiscoveryItemUsageHandler } from "../src/app/api/admin/beratung/[enrollmentId]/items/[itemId]/route"
import {
  discoveryCategoryOpenHint,
  discoveryFinalizeWriteOutcome,
} from "../src/components/discovery/cockpit/discovery-call-cockpit"
import {
  discoveryIntakeProductUsageLine,
  discoveryUsageWriteOutcome,
} from "../src/components/discovery/cockpit/discovery-intake-products"
import {
  discoveryCockpitUsageOptions,
  discoveryDefaultUsageFor,
  discoveryUsageDifferenceLabel,
} from "../src/components/discovery/cockpit/usage-options"
import {
  buildDiscoveryCockpitView,
  discoveryStaleDecisionKeysForUsageChange,
  loadDiscoveryCockpitModel,
  type DiscoveryCallIntake,
  type DiscoveryCockpitModel,
  type DiscoveryItemUsageChange,
} from "../src/lib/discovery/cockpit"
import type { DiscoveryIdealStep } from "../src/lib/discovery/load-ideal-routine"
import {
  loadParticipantScanVerdicts,
  type DiscoveryVerdictDeps,
} from "../src/lib/discovery/load-participant-verdicts"
import type { DiscoveryResearchState } from "../src/lib/discovery/research-status"
import {
  composeDiscoveryRefinedRoutine,
  type DiscoveryCallDecision,
  type DiscoveryIntakeItem,
} from "../src/lib/discovery/refined-routine"
import type { PersonalPlanCategory } from "../src/lib/personal-plan/products/contracts"
import type { ScanEvaluationContext } from "../src/lib/scan/profile-context"
import type { ScanInCatalogVerdictPayload } from "../src/lib/scan/types"

/**
 * Batch 5 (plan Rev. 3 task 5): the cockpit side of „usage ≠ product type" — F2 verdicts,
 * „Kategorie offen", the admin usage correction (F3) and the finalize block (P1-5).
 */

const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  intake: "40000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
  conditionerProduct: "30000000-0000-4000-8000-000000000001",
  approved: "30000000-0000-4000-8000-000000000009",
  item: "50000000-0000-4000-8000-000000000001",
  other: "50000000-0000-4000-8000-000000000002",
  open: "50000000-0000-4000-8000-000000000003",
  submission: "60000000-0000-4000-8000-000000000001",
}

function step(category: PersonalPlanCategory, role: string): DiscoveryIdealStep {
  return {
    decisionKey: `decision:${category}:${role}:gap`,
    category,
    role: role as never,
    section: "basis",
    categoryLabel: category,
    roleLabel: role,
    roleDescription: null,
    frequencyLabel: "1×/Woche",
    preview: null,
  }
}

const STEPS = [
  step("conditioner", "conditioner_rinse_out"),
  step("mask", "intensive_conditioning_mask"),
  step("oil", "pre_wash_fibre_treatment"),
  step("oil", "dry_finish"),
]
const COND_KEY = STEPS[0]!.decisionKey
const MASK_KEY = STEPS[1]!.decisionKey
const OIL_PRE_KEY = STEPS[2]!.decisionKey
const OIL_DRY_KEY = STEPS[3]!.decisionKey

function item(overrides: Partial<DiscoveryIntakeItem> & { id: string }): DiscoveryIntakeItem {
  return {
    category: "conditioner",
    source: "catalog_search",
    brandText: "Marke",
    productNameText: "Pflege",
    barcodeIdentifier: null,
    productId: `p-${overrides.id}`,
    productSubmissionId: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    ...overrides,
  }
}

// --- F2: the verdict grades the product, not her usage ----------------------------

const verdictPayload = {
  kind: "in_catalog",
  verdict: "ideal",
  verdictLabel: "Passt",
  verdictTitle: "Passt",
  status: "ok",
  subtitle: "",
  evaluatedRole: null,
  evaluatedRoleLabel: null,
  dimensions: [],
  criteria: [],
  coverage: { matches: 1, total: 1 },
  fitNarrative: null,
  alternatives: [],
} as unknown as ScanInCatalogVerdictPayload

const context = {
  snapshot: { decisions: [{ category: "conditioner" }, { category: "mask" }, { category: "oil" }] },
} as unknown as ScanEvaluationContext

function verdictDeps(
  catalogCategory: PersonalPlanCategory,
  graded: string[],
): DiscoveryVerdictDeps {
  return {
    loadActiveProductById: async (_client, id) => ({ id, category: catalogCategory }),
    loadPresentationRows: async (_client, productIds) =>
      productIds.map((id) => ({
        id,
        name: "Pflege",
        brand: "Marke",
        category: catalogCategory,
        imageUrl: null,
        priceEur: null,
        currency: null,
        affiliateLink: null,
        purchaseLinkStatus: null,
        priceCheckedAt: null,
      })),
    isProductSearchQuarantined: async () => false,
    loadQuarantinedProductIdsAmong: async () => new Set<string>(),
    loadScanVerdict: async (_client, category) => {
      graded.push(category)
      return verdictPayload
    },
  }
}

test("F2: a catalog conditioner she uses as a mask is graded as a conditioner, with the difference named", async () => {
  const graded: string[] = []
  const [entry] = await loadParticipantScanVerdicts(
    {} as SupabaseClient,
    ids.user,
    [item({ id: ids.item, category: "mask", productType: "conditioner" })],
    context,
    verdictDeps("conditioner", graded),
  )
  assert.equal(entry?.status, "verdict")
  assert.deepEqual(graded, ["conditioner"])
  if (entry?.status !== "verdict") return
  assert.deepEqual(entry.usageDifference, {
    usageCategory: "mask",
    productCategory: "conditioner",
  })
})

test("F2: an oil used on the scalp is in-family; a mask used as shampoo is not", async () => {
  const graded: string[] = []
  const [scalp] = await loadParticipantScanVerdicts(
    {} as SupabaseClient,
    ids.user,
    [
      item({
        id: ids.item,
        category: "scalp_care",
        usageRole: "scalp_flake_oil_adjunct",
        productType: "oil",
      }),
    ],
    { snapshot: { decisions: [{ category: "oil" }] } } as unknown as ScanEvaluationContext,
    verdictDeps("oil", graded),
  )
  assert.equal(scalp?.status, "verdict")

  const [outOfFamily] = await loadParticipantScanVerdicts(
    {} as SupabaseClient,
    ids.user,
    [item({ id: ids.item, category: "shampoo", productType: "mask" })],
    context,
    verdictDeps("mask", []),
  )
  assert.equal(outOfFamily?.status, "target_mismatch")
})

test("F2: a legacy (tile) row keeps `target_mismatch` — no product type, no reinterpretation", async () => {
  const [entry] = await loadParticipantScanVerdicts(
    {} as SupabaseClient,
    ids.user,
    [item({ id: ids.item, category: "mask" })],
    context,
    verdictDeps("conditioner", []),
  )
  assert.equal(entry?.status, "target_mismatch")
})

test("F2: same category — no difference is reported", async () => {
  const [entry] = await loadParticipantScanVerdicts(
    {} as SupabaseClient,
    ids.user,
    [item({ id: ids.item, category: "conditioner", productType: "conditioner" })],
    context,
    verdictDeps("conditioner", []),
  )
  assert.equal(entry?.status, "verdict")
  assert.ok(entry && !("usageDifference" in entry))
})

test("F2: an item with unknown usage gets no verdict at all", async () => {
  const verdicts = await loadParticipantScanVerdicts(
    {} as SupabaseClient,
    ids.user,
    [item({ id: ids.item, category: null, productType: "conditioner" })],
    context,
    verdictDeps("conditioner", []),
  )
  assert.deepEqual(verdicts, [])
})

function approvedState(): DiscoveryResearchState {
  return {
    submissions: new Map([
      [ids.submission, { status: "approved", approvedProductId: ids.approved }],
    ]),
    latestJobs: new Map(),
    eligible: new Set([ids.approved]),
  }
}

test("F2: an approved-research conditioner she uses as a mask binds to the mask step with a product verdict", async () => {
  const graded: string[] = []
  const researched = item({
    id: ids.item,
    category: "mask",
    productType: "conditioner",
    source: "name_research",
    productId: null,
    productSubmissionId: ids.submission,
  })
  const result = await loadDiscoveryCockpitModel(
    {} as never,
    { intakeId: ids.intake, userId: ids.user },
    {
      loadIdealRoutine: async () => ({
        status: "ready" as const,
        steps: STEPS,
        context,
        previewSource: { personalPlanId: `discovery:${ids.intake}`, sourceNeedVersionId: "v1" },
      }),
      loadItems: async () => [researched],
      loadResearchState: async () => approvedState(),
      loadVerdicts: (client, userId, items, ctx) =>
        loadParticipantScanVerdicts(client, userId, items, ctx, verdictDeps("conditioner", graded)),
      loadDecisions: async () => [],
      loadSwapProducts: async () => [],
      loadProductIdentities: async () =>
        new Map([[ids.approved, { name: "Pflege", brand: "Marke", productLine: null }]]),
    },
  )
  assert.equal(result.status, "ready")
  if (result.status !== "ready") return
  assert.deepEqual(graded, ["conditioner"])
  const view = buildDiscoveryCockpitView(result)
  const mask = view.steps.find((entry) => entry.decisionKey === MASK_KEY)
  assert.equal(mask?.intakeItemId, ids.item)
  assert.equal(mask?.verdict?.status, "verdict")
  assert.deepEqual(mask?.usageDifference, { usageCategory: "mask", productCategory: "conditioner" })
  // The paper says it too, and the fingerprint covers it (F6).
  assert.equal(mask?.ownedUsageLabel, "als Haarmaske benutzt")
})

test("the usage-difference and usage lines read as Nick expects", () => {
  assert.equal(
    discoveryUsageDifferenceLabel("mask", "conditioner"),
    "Benutzt als Maske · Produkt: Conditioner",
  )
  assert.equal(discoveryUsageDifferenceLabel("mask", "mask"), null)
  assert.equal(discoveryUsageDifferenceLabel("mask", null), null)
  assert.equal(
    discoveryIntakeProductUsageLine({ category: null, usageRole: null, productType: "oil" }),
    "Kategorie offen",
  )
  assert.equal(
    discoveryIntakeProductUsageLine({
      category: "oil",
      usageRole: "dry_finish",
      productType: "oil",
    }),
    "Öl · Als Finish ins trockene Haar",
  )
  assert.equal(
    discoveryIntakeProductUsageLine({
      category: "mask",
      usageRole: null,
      productType: "conditioner",
    }),
    "Benutzt als Maske · Produkt: Conditioner",
  )
})

test("the usage select offers every category, the three oil roles and the scalp oil — not a role-less oil", () => {
  const values = discoveryCockpitUsageOptions().map((option) => option.value)
  assert.ok(values.includes("oil:pre_wash_fibre_treatment"))
  assert.ok(values.includes("oil:leave_on_fibre_conditioning"))
  assert.ok(values.includes("oil:dry_finish"))
  assert.ok(values.includes("scalp_care"))
  assert.ok(values.includes("scalp_care:scalp_flake_oil_adjunct"))
  assert.ok(!values.includes("oil"))
  assert.equal(values.length, 13)
  // A legacy role-less oil keeps its own entry while it is the current value.
  assert.ok(
    discoveryCockpitUsageOptions({ category: "oil", role: null })
      .map((option) => option.value)
      .includes("oil"),
  )
})

test("a newly set product type preselects the usage her own question would (F5)", () => {
  assert.deepEqual(discoveryDefaultUsageFor("conditioner", "Repair Spülung"), {
    category: "conditioner",
    role: null,
  })
  assert.deepEqual(discoveryDefaultUsageFor("oil", "Kopfhaut-Öl"), {
    category: "scalp_care",
    role: "scalp_flake_oil_adjunct",
  })
  assert.deepEqual(discoveryDefaultUsageFor("oil", "Argan Öl"), {
    category: "oil",
    role: "leave_on_fibre_conditioning",
  })
  assert.deepEqual(discoveryDefaultUsageFor("heat_protectant", null), {
    category: "heat_protectant",
    role: null,
  })
  assert.equal(discoveryDefaultUsageFor(null, "Irgendwas"), null)
})

// --- F3: which decisions a move makes stale ----------------------------------------

function modelOf(items: DiscoveryIntakeItem[], decisions: DiscoveryCallDecision[] = []) {
  const routine = composeDiscoveryRefinedRoutine({
    steps: STEPS,
    items,
    decisions,
    swapProducts: [],
  })
  return {
    status: "ready",
    routine,
    steps: STEPS,
    verdicts: [],
    previewSource: { personalPlanId: "discovery:x", sourceNeedVersionId: "v1" },
    recommendationProducts: [],
    recommendationBrandsAvailable: true,
    productIdentities: new Map(),
    research: {
      items,
      state: { submissions: new Map(), latestJobs: new Map(), eligible: new Set<string>() },
    },
  } satisfies DiscoveryCockpitModel
}

function change(overrides: Partial<DiscoveryItemUsageChange>): DiscoveryItemUsageChange {
  return { itemId: ids.item, category: "mask", role: null, productType: null, ...overrides }
}

test("F3: moving a bound conditioner to the mask step makes both steps' decisions stale", () => {
  const model = modelOf([
    item({ id: ids.item, category: "conditioner", productType: "conditioner" }),
  ])
  assert.deepEqual(
    discoveryStaleDecisionKeysForUsageChange(model, change({})),
    [COND_KEY, MASK_KEY].sort(),
  )
})

test("F3: a move that displaces another item stales the displaced step too, and nothing else", () => {
  // The mask step holds `other` (created later); the moved barcode item outranks it.
  const model = modelOf([
    item({ id: ids.item, category: "conditioner", source: "barcode", productType: "conditioner" }),
    item({ id: ids.other, category: "mask", createdAt: "2026-09-20T12:00:00.000Z" }),
    item({ id: "oil-1", category: "oil", productType: "oil" }),
  ])
  assert.deepEqual(
    discoveryStaleDecisionKeysForUsageChange(model, change({})),
    [COND_KEY, MASK_KEY].sort(),
  )
})

test("F3: an oil role change stales the old and the new oil step", () => {
  const model = modelOf([
    item({
      id: ids.item,
      category: "oil",
      productType: "oil",
      usageRole: "pre_wash_fibre_treatment",
    }),
  ])
  assert.deepEqual(
    discoveryStaleDecisionKeysForUsageChange(
      model,
      change({ category: "oil", role: "dry_finish" }),
    ),
    [OIL_DRY_KEY, OIL_PRE_KEY].sort(),
  )
})

test("F3: setting the usage of a research-pending item stales nothing (it binds nowhere yet)", () => {
  const model = modelOf([
    item({ id: ids.open, category: null, productId: null, source: "name_research" }),
  ])
  assert.deepEqual(
    discoveryStaleDecisionKeysForUsageChange(
      model,
      change({ itemId: ids.open, productType: "conditioner" }),
    ),
    [],
  )
})

// --- The usage-correction route ------------------------------------------------------

const submittedIntake: DiscoveryCallIntake = {
  id: ids.intake,
  enrollmentId: ids.enrollment,
  userId: ids.user,
  state: "submitted",
  submittedAt: "2026-09-20T18:41:00.000Z",
  callFinalizedAt: null,
  finalizedSourceHash: null,
}

type UsageRouteDeps = Parameters<typeof createDiscoveryItemUsageHandler>[0]

function usageDeps(overrides: UsageRouteDeps = {}) {
  const calls: unknown[] = []
  const deps: UsageRouteDeps = {
    flagEnabled: () => true,
    requireAdmin: async () => ({ userId: "admin-1" }),
    createAdminClient: () => ({}) as never,
    loadIntake: async () => submittedIntake,
    loadModel: async () =>
      modelOf([
        item({ id: ids.item, category: "conditioner", productType: "conditioner" }),
        item({ id: ids.open, category: null, productId: null, source: "name_research" }),
      ]),
    setUsage: async (input) => {
      calls.push(input)
      return { outcome: "updated", noneInserted: true, noneRemoved: false, decisionsCleared: 1 }
    },
    ...overrides,
  }
  return { deps, calls }
}

async function patch(
  deps: UsageRouteDeps,
  body: unknown,
  { itemId = ids.item, origin = "https://chaarlie.de" } = {},
) {
  const response = await createDiscoveryItemUsageHandler(deps)(
    new NextRequest(`https://chaarlie.de/api/admin/beratung/${ids.enrollment}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", origin },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ enrollmentId: ids.enrollment, itemId }) },
  )
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

const MASK_USAGE = { usage: { category: "mask", role: null } }

test("usage route: cross-origin first, then the kill switch, then the admin gate", async () => {
  let adminChecked = false
  const { deps, calls } = usageDeps({
    requireAdmin: async () => {
      adminChecked = true
      return { userId: "admin-1" }
    },
  })
  assert.equal((await patch(deps, MASK_USAGE, { origin: "https://evil.example" })).status, 403)
  assert.equal(adminChecked, false)
  assert.equal((await patch({ ...deps, flagEnabled: () => false }, MASK_USAGE)).status, 404)
  const refused = await patch(
    {
      ...deps,
      requireAdmin: async () => ({
        response: Response.json({ code: "forbidden" }, { status: 403 }) as never,
      }),
    },
    MASK_USAGE,
  )
  assert.equal(refused.status, 403)
  assert.equal((await patch({ ...deps, loadIntake: async () => null }, MASK_USAGE)).status, 404)
  assert.deepEqual(calls, [])
})

test("usage route: refused while finalized („Erst Finalisierung aufheben“) and while a draft", async () => {
  const { deps, calls } = usageDeps()
  const finalized = await patch(
    {
      ...deps,
      loadIntake: async () => ({ ...submittedIntake, callFinalizedAt: "2026-09-21T10:00:00.000Z" }),
    },
    MASK_USAGE,
  )
  assert.deepEqual(finalized, { status: 409, body: { code: "finalized" } })
  assert.equal(
    discoveryUsageWriteOutcome(false, { code: "finalized" }).error,
    "Erst Finalisierung aufheben.",
  )

  const draft = await patch(
    { ...deps, loadIntake: async () => ({ ...submittedIntake, state: "draft" }) },
    MASK_USAGE,
  )
  assert.deepEqual(draft, { status: 409, body: { code: "not_submitted" } })
  assert.deepEqual(calls, [])
})

test("usage route: bad bodies, invalid pairs and foreign items are refused before any write", async () => {
  const { deps, calls } = usageDeps()
  assert.equal((await patch(deps, { usage: { category: "nope", role: null } })).status, 400)
  assert.equal((await patch(deps, { ...MASK_USAGE, extra: true })).status, 400)
  const pair = await patch(deps, { usage: { category: "mask", role: "dry_finish" } })
  assert.deepEqual(pair, { status: 400, body: { code: "invalid_usage" } })
  const foreign = await patch(deps, MASK_USAGE, { itemId: "50000000-0000-4000-8000-0000000000ff" })
  assert.equal(foreign.status, 404)
  assert.deepEqual(calls, [])
})

test("usage route: a type only for a type-open item, and a type-open item needs one", async () => {
  const { deps, calls } = usageDeps()
  const typed = await patch(deps, { ...MASK_USAGE, productType: "mask" })
  assert.deepEqual(typed, { status: 409, body: { code: "type_known" } })
  const untyped = await patch(deps, MASK_USAGE, { itemId: ids.open })
  assert.deepEqual(untyped, { status: 400, body: { code: "product_type_required" } })
  assert.deepEqual(calls, [])

  const set = await patch(deps, { ...MASK_USAGE, productType: "conditioner" }, { itemId: ids.open })
  assert.equal(set.status, 200)
  assert.deepEqual(calls, [
    {
      itemId: ids.open,
      category: "mask",
      role: null,
      productType: "conditioner",
      intakeId: ids.intake,
      staleDecisionKeys: [],
    },
  ])
})

test("usage route: the correction is one call carrying the stale decision keys", async () => {
  const { deps, calls } = usageDeps()
  const result = await patch(deps, MASK_USAGE)
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, {
    outcome: "updated",
    noneInserted: true,
    noneRemoved: false,
    decisionsCleared: 1,
  })
  assert.deepEqual(calls, [
    {
      itemId: ids.item,
      category: "mask",
      role: null,
      productType: null,
      intakeId: ids.intake,
      staleDecisionKeys: [COND_KEY, MASK_KEY].sort(),
    },
  ])
})

test("usage route: the database's own refusals come back with their codes", async () => {
  for (const [outcome, status] of [
    ["finalized", 409],
    ["not_submitted", 409],
    ["item_not_found", 404],
    ["type_known", 409],
    ["product_type_required", 400],
  ] as const) {
    const { deps } = usageDeps({ setUsage: async () => ({ outcome }) })
    assert.deepEqual(await patch(deps, MASK_USAGE), { status, body: { code: outcome } })
  }
  const { deps } = usageDeps({
    setUsage: async () => {
      throw new Error("boom")
    },
  })
  assert.equal((await patch(deps, MASK_USAGE)).status, 503)
})

// --- P1-5: finalize waits for every usage -------------------------------------------

test("finalize is refused while a product's usage is open („Erst Kategorie festlegen“)", async () => {
  let finalized = false
  const handler = createDiscoveryFinalizeHandler({
    flagEnabled: () => true,
    requireAdmin: async () => ({ userId: "admin-1" }),
    createAdminClient: () => ({}) as never,
    loadIntake: async () => submittedIntake,
    loadModel: async () =>
      modelOf([item({ id: ids.open, category: null, productId: null, source: "name_research" })]),
    finalize: async () => {
      finalized = true
      return null
    },
  })
  const response = await handler(
    new NextRequest(`https://chaarlie.de/api/admin/beratung/${ids.enrollment}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finalized: true }),
    }),
    { params: Promise.resolve({ enrollmentId: ids.enrollment }) },
  )
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { code: "category_open" })
  assert.equal(finalized, false)
  assert.equal(
    discoveryFinalizeWriteOutcome(false, { code: "category_open" }).error,
    "Erst Kategorie festlegen.",
  )
  assert.equal(
    discoveryCategoryOpenHint(2),
    "Erst Kategorie festlegen — 2 Produkte mit offener Kategorie.",
  )
})

// --- The page ---------------------------------------------------------------------

async function renderPage(model: DiscoveryCockpitModel, intake = submittedIntake) {
  const Page = createDiscoveryCockpitPage({
    flagEnabled: () => true,
    requireAdmin: async () => ({ userId: "admin-1" }),
    createAdminClient: () => ({}) as never,
    loadEnrollment: async () => ({
      enrollmentId: ids.enrollment,
      name: "Lena M.",
      email: "lena@example.test",
      tokenVersion: 1,
      claimedUserId: ids.user,
      claimedAt: null,
      createdAt: "2026-09-18T10:00:00.000Z",
    }),
    loadIntake: async () => intake,
    loadModel: async () => model,
    loadPreflight: async () => ({ status: "ready" }),
  })
  const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} }
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={router as never}>
      {await Page({ params: Promise.resolve({ enrollmentId: ids.enrollment }) })}
    </AppRouterContext.Provider>,
  )
}

test("page: „Kategorie offen“ in the list with type + usage selects, in the summary, and blocking finalize", async () => {
  const markup = await renderPage(
    modelOf([
      item({ id: ids.item, category: "mask", productType: "conditioner" }),
      item({
        id: ids.open,
        category: null,
        productId: null,
        source: "name_research",
        brandText: "Balea",
        productNameText: "Wunderpflege",
      }),
    ]),
  )
  // The list names the open item and opens its editor straight away.
  assert.ok(markup.includes("Kategorie offen"))
  assert.ok(markup.includes("Produkttyp offen"))
  assert.ok(markup.includes("Was ist das?"))
  assert.ok(markup.includes("Benutzt als"))
  // The moved conditioner reads with both answers and can be corrected.
  assert.ok(markup.includes("Benutzt als Maske · Produkt: Conditioner"))
  assert.ok(markup.includes("Kategorie ändern"))
  // Summary + finalize block.
  assert.ok(
    markup.includes("Kategorie offen: Balea Wunderpflege — oben festlegen, dann finalisieren."),
  )
  assert.ok(markup.includes("Erst Kategorie festlegen — 1 Produkt mit offener Kategorie."))
})

test("page: a draft shows no correction controls; a finalized call disables them", async () => {
  const items = [item({ id: ids.item, category: "conditioner", productType: "conditioner" })]
  const draft = await renderPage(modelOf(items), { ...submittedIntake, state: "draft" })
  assert.ok(!draft.includes("Kategorie ändern"))

  const finalized = await renderPage(modelOf(items), {
    ...submittedIntake,
    callFinalizedAt: "2026-09-21T10:00:00.000Z",
    finalizedSourceHash: "hash",
  })
  assert.ok(finalized.includes("Kategorie ändern"))
  assert.ok(finalized.includes('title="Erst Finalisierung aufheben."'))
})
