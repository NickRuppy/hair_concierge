import assert from "node:assert/strict"
import test from "node:test"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { NextRequest, NextResponse } from "next/server"
import { renderToStaticMarkup } from "react-dom/server"

import { createDiscoveryCockpitPage } from "../src/app/admin/beratung/[enrollmentId]/page"
import { createDiscoveryResearchHandler } from "../src/app/api/admin/beratung/[enrollmentId]/research/route"
import {
  discoveryDecisionWriteOutcome,
  discoveryFinalizeWriteOutcome,
} from "../src/components/discovery/cockpit/discovery-call-cockpit"
import {
  beginDiscoveryDecisionWrite,
  discoveryDecisionWritesPending,
  subscribeDiscoveryDecisionWrites,
} from "../src/components/discovery/cockpit/decision-writes"
import { discoveryResearchStartOutcome } from "../src/components/discovery/cockpit/discovery-intake-products"
import { discoveryCockpitStateKey } from "../src/components/discovery/cockpit/format"
import {
  buildDiscoveryCockpitView,
  loadDiscoveryCockpitModel,
  type DiscoveryCallIntake,
  type DiscoveryCockpitModel,
  type DiscoveryProductIdentity,
} from "../src/lib/discovery/cockpit"
import type { DiscoveryIdealStep } from "../src/lib/discovery/load-ideal-routine"
import type { DiscoveryParticipantVerdict } from "../src/lib/discovery/load-participant-verdicts"
import type { DiscoveryResearchState } from "../src/lib/discovery/research-status"
import type { DiscoveryIntakeItem } from "../src/lib/discovery/refined-routine"

/**
 * Batch 4, the research half: „Eingetragene Produkte" with each product's research state,
 * read-time auto-link of approved research (B), and „Recherche starten" (C).
 */

const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  intake: "40000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
  owned: "30000000-0000-4000-8000-000000000003",
  approved: "30000000-0000-4000-8000-000000000009",
  researchItem: "50000000-0000-4000-8000-000000000001",
  ownedItem: "50000000-0000-4000-8000-000000000002",
  barcodeItem: "50000000-0000-4000-8000-000000000003",
  foreignItem: "50000000-0000-4000-8000-0000000000ff",
  submission: "60000000-0000-4000-8000-000000000001",
  newSubmission: "60000000-0000-4000-8000-000000000002",
  job: "70000000-0000-4000-8000-000000000001",
}

const EAN = "4006381333931"

const intake: DiscoveryCallIntake = {
  id: ids.intake,
  enrollmentId: ids.enrollment,
  userId: ids.user,
  state: "submitted",
  submittedAt: "2026-09-20T18:41:00.000Z",
  callFinalizedAt: null,
  finalizedSourceHash: null,
}

const shampooStep: DiscoveryIdealStep = {
  decisionKey: "decision:shampoo:shampoo_everyday:gap",
  category: "shampoo",
  role: "shampoo_everyday",
  section: "basis",
  categoryLabel: "Shampoo",
  roleLabel: "Regelmäßige Reinigung",
  roleDescription: "Regelmäßige Reinigung für deine Kopfhaut.",
  frequencyLabel: "3×/Woche",
  preview: null,
  depth: {
    purpose: "Regelmäßige Reinigung für deine Kopfhaut.",
    targetType: "Ausgleichend reinigend",
    productCriteria: "Ausgeglichen reinigen, ohne unnötig stark zu entfetten.",
    fit: "Deine Kopfhaut fettet schneller nach.",
    timingLabel: "Haarwäsche",
  },
}

function item(overrides: Partial<DiscoveryIntakeItem> & { id: string }): DiscoveryIntakeItem {
  return {
    category: "shampoo",
    source: "name_research",
    brandText: "Balea",
    productNameText: "Frische Shampoo",
    barcodeIdentifier: null,
    productId: null,
    productSubmissionId: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    ...overrides,
  }
}

const researchItem = item({ id: ids.researchItem, productSubmissionId: ids.submission })
const barcodeItem = item({
  id: ids.barcodeItem,
  category: "mask",
  source: "barcode_unknown",
  brandText: null,
  productNameText: null,
  barcodeIdentifier: EAN,
  createdAt: "2026-09-20T10:05:00.000Z",
})

function researchState(submissionStatus: string, eligible: string[] = []): DiscoveryResearchState {
  return {
    submissions: new Map([
      [
        ids.submission,
        {
          status: submissionStatus,
          approvedProductId: ["approved", "matched_existing"].includes(submissionStatus)
            ? ids.approved
            : null,
        },
      ],
    ]),
    latestJobs: new Map(),
    eligible: new Set(eligible),
  }
}

function readyIdeal(steps: DiscoveryIdealStep[]) {
  return async () => ({
    status: "ready" as const,
    steps,
    context: {} as never,
    previewSource: { personalPlanId: `discovery:${ids.intake}`, sourceNeedVersionId: "v1" },
  })
}

const identities = new Map<string, DiscoveryProductIdentity>([
  [
    ids.approved,
    {
      name: "Frische Shampoo",
      brand: "Balea",
      productLine: "Men",
      imageUrl: "https://catalog.example/balea.jpg",
    },
  ],
])

async function model(input: {
  items: DiscoveryIntakeItem[]
  state: () => Promise<DiscoveryResearchState>
  verdictsFor?: (items: readonly DiscoveryIntakeItem[]) => DiscoveryParticipantVerdict[]
}) {
  const seen: { verdictItems: readonly DiscoveryIntakeItem[] } = { verdictItems: [] }
  const result = await loadDiscoveryCockpitModel(
    {} as never,
    { intakeId: ids.intake, userId: ids.user },
    {
      loadIdealRoutine: readyIdeal([shampooStep]),
      loadHeatStyling: async () => null,
      loadItems: async () => input.items,
      loadResearchState: input.state,
      loadVerdicts: async (_client, _user, items) => {
        seen.verdictItems = items
        return input.verdictsFor?.(items) ?? []
      },
      loadDecisions: async () => [],
      loadSwapProducts: async () => [],
      loadProductIdentities: async () => identities,
    },
  )
  if (result.status !== "ready") throw new Error("not ready")
  return { result, seen }
}

// --- B: auto-link ---------------------------------------------------------------

test("approved, eligible research becomes her product for the verdicts, the routine and the hash", async () => {
  const { result, seen } = await model({
    items: [researchItem],
    state: async () => researchState("approved", [ids.approved]),
  })
  // The verdict pass sees the linked product — so does the binding.
  assert.equal(seen.verdictItems[0]?.productId, ids.approved)
  assert.equal(result.routine.steps[0]!.item?.productId, ids.approved)
  assert.equal(result.routine.steps[0]!.outcome, "undecided")
  assert.deepEqual(result.routine.unassignedIntakeProducts, [])
  assert.equal(result.recommendationBrandsAvailable, true)

  const view = buildDiscoveryCockpitView(result)
  assert.equal(view.intakeProducts[0]!.statusLabel, "Freigegeben")
  assert.equal(view.intakeProducts[0]!.label, "Balea Men Frische Shampoo")
  assert.equal(view.intakeProducts[0]!.imageUrl, "https://catalog.example/balea.jpg")

  // Before the approval the same intake fingerprints differently: an approval after
  // finalising shows up as drift, which is the point.
  const { result: pending } = await model({
    items: [researchItem],
    state: async () => researchState("ready_for_review"),
  })
  assert.notEqual(pending.routine.sourceHash, result.routine.sourceHash)
  assert.equal(pending.routine.unassignedIntakeProducts[0]?.reason, "research_pending")
})

test("rejected, pending and approved-but-ineligible research link nothing", async () => {
  for (const [status, eligible] of [
    ["rejected", [ids.approved]],
    ["pending_review", []],
    ["approved", []],
  ] as const) {
    const { result } = await model({
      items: [researchItem],
      state: async () => researchState(status, [...eligible]),
    })
    assert.equal(result.routine.steps[0]!.item, null, status)
    assert.equal(result.routine.unassignedIntakeProducts[0]?.reason, "research_pending", status)
    assert.equal(result.recommendationBrandsAvailable, true, status)
  }
})

test("a failed research read degrades: nothing linked, finalize blocked, statuses honest", async () => {
  const { result } = await model({
    items: [researchItem, barcodeItem],
    state: async () => {
      throw new Error("discovery_research_jobs_lookup_failed")
    },
  })
  assert.equal(result.routine.steps[0]!.item, null)
  // The same gate finalize and the PDF already read: no degraded fingerprint, no false drift.
  assert.equal(result.recommendationBrandsAvailable, false)
  const view = buildDiscoveryCockpitView(result)
  assert.equal(view.researchStatusAvailable, false)
  assert.equal(view.recommendationBrandsAvailable, false)
  assert.deepEqual(
    view.intakeProducts.map((entry) => [entry.statusLabel, entry.canStartResearch]),
    [
      ["Status gerade nicht lesbar", false],
      // No submission, no lookup needed: a barcode-only item can still be started.
      ["Nur Barcode – keine Recherche", true],
    ],
  )
})

// --- A: the page section ------------------------------------------------------

function pageModel(): DiscoveryCockpitModel {
  const ownedItem = item({
    id: ids.ownedItem,
    source: "catalog_search",
    productId: ids.owned,
    brandText: "Elvital",
    productNameText: "Hyaluron Pure",
  })
  const declined = item({
    id: "50000000-0000-4000-8000-0000000000dd",
    category: "oil",
    source: "none",
    brandText: null,
    productNameText: null,
  })
  const items = [ownedItem, researchItem, barcodeItem, declined]
  const base = {
    status: "ready" as const,
    steps: [shampooStep],
    verdicts: [],
    previewSource: { personalPlanId: `discovery:${ids.intake}`, sourceNeedVersionId: "v1" },
    recommendationProducts: [],
    recommendationBrandsAvailable: true,
    productIdentities: new Map<string, DiscoveryProductIdentity>([
      [
        ids.owned,
        {
          name: "Hyaluron Pure Shampoo",
          brand: "Elvital",
          productLine: null,
          imageUrl: "https://catalog.example/elvital.jpg",
        },
      ],
    ]),
    research: {
      items,
      state: {
        submissions: new Map([
          [ids.submission, { status: "researching", approvedProductId: null }],
        ]),
        latestJobs: new Map([
          [ids.submission, { id: ids.job, status: "running", attemptCount: 1, maxAttempts: 3 }],
        ]),
        eligible: new Set<string>(),
      },
    },
  }
  return {
    ...base,
    routine: {
      steps: [],
      unassignedIntakeProducts: [],
      declinedCategories: ["oil"],
      unansweredCategories: [],
      sourceHash: "hash",
    },
  }
}

async function renderPage(model: DiscoveryCockpitModel) {
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
    loadQuizLead: async () => null,
    loadPreflight: async () => ({ status: "ready" }),
  })
  const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} }
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={router as never}>
      {await Page({ params: Promise.resolve({ enrollmentId: ids.enrollment }) })}
    </AppRouterContext.Provider>,
  )
}

test("„Eingetragene Produkte“ opens the cockpit: image, name, shelf and research state per product", async () => {
  const markup = await renderPage(pageModel())
  const section = markup.indexOf("Eingetragene Produkte")
  assert.ok(section >= 0)
  assert.ok(section < markup.indexOf("Idealroutine"), "the list comes before the routine")

  assert.ok(markup.includes("https://catalog.example/elvital.jpg"))
  assert.ok(markup.includes("Elvital Hyaluron Pure Shampoo"))
  assert.ok(markup.includes("Im Katalog"))
  assert.ok(markup.includes("Balea Frische Shampoo"))
  assert.ok(markup.includes("In Recherche – läuft"))
  assert.ok(markup.includes("Gescanntes Produkt · 4006381333931"))
  assert.ok(markup.includes("Nur Barcode – keine Recherche"))
  // Shelf labels as her checklist named them.
  assert.ok(markup.includes(">Maske<"))
  // Exactly one start button: the barcode-only product. The running one has none.
  assert.equal(markup.split("Recherche starten").length - 1, 1)
  assert.ok(markup.includes("npm run products:intake:review-center"))
  // „benutze ich nicht" stays on its own grey line below, not in the list.
  assert.ok(markup.includes("Öl — benutzt sie nicht."))
})

test("the step shows why, type, criteria, fit, and rhythm with timing", async () => {
  const model = pageModel()
  const markup = await renderPage({
    ...model,
    routine: {
      ...model.routine,
      steps: [
        {
          step: shampooStep,
          outcome: "ideal",
          item: null,
          swapProductId: null,
          swapProduct: null,
          recommendationLabel: null,
          ownedLabel: null,
          swapProductLabel: null,
        },
      ],
    },
  })
  for (const text of [
    "Warum dieser Schritt",
    "Produkttyp",
    "Ausgleichend reinigend",
    "Worauf es ankommt",
    "Warum das zu ihrem Haar passt",
    "Deine Kopfhaut fettet schneller nach.",
    "3×/Woche · Haarwäsche",
  ]) {
    assert.ok(markup.includes(text), text)
  }
})

test("a failed research read is said above the list", async () => {
  const model = pageModel()
  const markup = await renderPage({
    ...model,
    recommendationBrandsAvailable: false,
    research: { ...model.research!, state: null },
  })
  assert.ok(markup.includes("Recherche-Stand ist gerade nicht lesbar"))
  assert.ok(markup.includes("Status gerade nicht lesbar"))
})

// --- C: the research route -----------------------------------------------------

type RouteDeps = Parameters<typeof createDiscoveryResearchHandler>[0]

function routeDeps(overrides: RouteDeps = {}) {
  const calls: string[] = []
  const deps: RouteDeps = {
    flagEnabled: () => true,
    requireAdmin: async () => ({ userId: "admin-1" }),
    createAdminClient: () => ({}) as never,
    loadIntake: async () => intake,
    loadItems: async () => [researchItem, barcodeItem],
    loadResearchState: async () => researchState("pending_review"),
    enqueue: async (_client, submissionId) => {
      calls.push(`enqueue:${submissionId}`)
    },
    retry: async (_client, jobId) => {
      calls.push(`retry:${jobId}`)
    },
    createSubmission: async (_client, input) => {
      calls.push(`create:${input.userId}:${input.submission.identifier}`)
      return { kind: "pending_submission", submissionId: ids.newSubmission }
    },
    attachSubmission: async (_client, input) => {
      calls.push(`attach:${input.itemId}:${input.submissionId}`)
      return true
    },
    assignCatalogProduct: async (_client, input) => {
      calls.push(`assign:${input.itemId}:${input.productId}`)
      return true
    },
    ...overrides,
  }
  return { deps, calls }
}

function researchRequest(body: unknown, origin = "https://chaarlie.de") {
  return new NextRequest(`https://chaarlie.de/api/admin/beratung/${ids.enrollment}/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin },
    body: JSON.stringify(body),
  })
}

const params = () => ({ params: Promise.resolve({ enrollmentId: ids.enrollment }) })

async function post(deps: RouteDeps, body: unknown, origin?: string) {
  const response = await createDiscoveryResearchHandler(deps)(
    researchRequest(body, origin),
    params(),
  )
  return {
    status: response.status,
    body: (await response.json()) as {
      code?: string
      status?: { kind: string; label: string; canStartResearch: boolean }
    },
  }
}

test("the research route refuses cross-origin first, then the kill switch, then non-admins", async () => {
  let adminChecked = false
  const { deps, calls } = routeDeps({
    requireAdmin: async () => {
      adminChecked = true
      return { userId: "admin-1" }
    },
  })
  const crossOrigin = await post(deps, { itemId: ids.researchItem }, "https://evil.example")
  assert.equal(crossOrigin.status, 403)
  assert.equal(adminChecked, false)

  const off = await post({ ...deps, flagEnabled: () => false }, { itemId: ids.researchItem })
  assert.equal(off.status, 404)

  for (const status of [401, 403]) {
    const refused = await post(
      {
        ...deps,
        requireAdmin: async () => ({
          response: NextResponse.json({ error: "Nicht erlaubt." }, { status }),
        }),
      },
      { itemId: ids.researchItem },
    )
    assert.equal(refused.status, status)
  }
  assert.deepEqual(calls, [])
})

test("an item of another intake is not found, and a bad body is a 400", async () => {
  const { deps, calls } = routeDeps()
  const foreign = await post(deps, { itemId: ids.foreignItem })
  assert.equal(foreign.status, 404)
  const bad = await post(deps, { itemId: "nope" })
  assert.equal(bad.status, 400)
  assert.deepEqual(calls, [])
})

test("an open submission without a live job is enqueued, and the new status comes back", async () => {
  let reads = 0
  const { deps, calls } = routeDeps({
    loadResearchState: async () => {
      reads += 1
      if (reads === 1) return researchState("pending_review")
      return {
        ...researchState("pending_review"),
        latestJobs: new Map([
          [ids.submission, { id: ids.job, status: "queued", attemptCount: 1, maxAttempts: 3 }],
        ]),
      }
    },
  })
  const result = await post(deps, { itemId: ids.researchItem })
  assert.equal(result.status, 200)
  assert.deepEqual(calls, [`enqueue:${ids.submission}`])
  assert.deepEqual(result.body.status, {
    kind: "research_queued",
    label: "In Recherche – wartet",
    canStartResearch: false,
  })
})

test("a failed job is retried, not enqueued", async () => {
  const { deps, calls } = routeDeps({
    loadResearchState: async () => ({
      ...researchState("researching"),
      latestJobs: new Map([
        [ids.submission, { id: ids.job, status: "failed", attemptCount: 1, maxAttempts: 3 }],
      ]),
    }),
  })
  const result = await post(deps, { itemId: ids.researchItem })
  assert.equal(result.status, 200)
  assert.deepEqual(calls, [`retry:${ids.job}`])
})

test("an item without a submission gets one, opened as the participant and attached to the row", async () => {
  const { deps, calls } = routeDeps()
  const result = await post(deps, { itemId: ids.barcodeItem })
  assert.equal(result.status, 200)
  assert.deepEqual(calls, [
    `create:${ids.user}:${EAN}`,
    `attach:${ids.barcodeItem}:${ids.newSubmission}`,
  ])
})

test("F1: the route opens the submission as the PRODUCT TYPE, not her usage; legacy rows as their tile", async () => {
  const categories: string[] = []
  const recordCategory = async (_client: unknown, input: { submission: { category: string } }) => {
    categories.push(input.submission.category)
    return { kind: "pending_submission" as const, submissionId: ids.newSubmission }
  }
  // Filed (used) as a mask, but the product is a conditioner.
  const typed = routeDeps({
    loadItems: async () => [{ ...barcodeItem, productType: "conditioner" }],
    createSubmission: recordCategory,
  })
  assert.equal((await post(typed.deps, { itemId: ids.barcodeItem })).status, 200)
  // Legacy row: no product type — its tile is what research gets, as before.
  const legacy = routeDeps({ createSubmission: recordCategory })
  assert.equal((await post(legacy.deps, { itemId: ids.barcodeItem })).status, 200)
  assert.deepEqual(categories, ["conditioner", "mask"])

  // „Weiß ich nicht": no type and no usage — nothing to research yet.
  const unknown = routeDeps({
    loadItems: async () => [{ ...barcodeItem, category: null as never }],
    createSubmission: async () => {
      throw new Error("must not be reached")
    },
  })
  const refused = await post(unknown.deps, { itemId: ids.barcodeItem })
  assert.equal(refused.status, 409)
  assert.equal(refused.body.code, "not_researchable")
})

test("a submit that finds the product in the catalog lands it on the row instead", async () => {
  const { deps, calls } = routeDeps({
    createSubmission: async () => ({ kind: "already_in_catalog", productId: ids.approved }),
  })
  const result = await post(deps, { itemId: ids.barcodeItem })
  assert.equal(result.status, 200)
  assert.deepEqual(calls, [`assign:${ids.barcodeItem}:${ids.approved}`])
})

test("nothing to start is a 409 carrying the current status — running, catalog, too thin", async () => {
  const running = routeDeps({
    loadResearchState: async () => ({
      ...researchState("researching"),
      latestJobs: new Map([
        [ids.submission, { id: ids.job, status: "running", attemptCount: 1, maxAttempts: 3 }],
      ]),
    }),
  })
  const busy = await post(running.deps, { itemId: ids.researchItem })
  assert.equal(busy.status, 409)
  assert.equal(busy.body.code, "not_researchable")
  assert.equal(busy.body.status?.label, "In Recherche – läuft")
  assert.deepEqual(running.calls, [])

  const thin = routeDeps({
    loadItems: async () => [
      item({ id: ids.barcodeItem, brandText: null, barcodeIdentifier: "12345678" }),
    ],
  })
  const tooThin = await post(thin.deps, { itemId: ids.barcodeItem })
  assert.equal(tooThin.status, 409)
  assert.equal(tooThin.body.status?.label, "Zu wenig Angaben für eine Recherche")
  assert.deepEqual(thin.calls, [])
})

test("a failing enqueue is a 503, never a silent success", async () => {
  const { deps } = routeDeps({
    enqueue: async () => {
      throw new Error("Product submission is not open for research")
    },
  })
  const result = await post(deps, { itemId: ids.researchItem })
  assert.equal(result.status, 503)
})

// --- review fixes: exhausted jobs, concurrent starts, stale cockpit ------------

test("a failed job out of attempts is not retried — the route answers with the exhausted state", async () => {
  const { deps, calls } = routeDeps({
    loadResearchState: async () => ({
      ...researchState("researching"),
      latestJobs: new Map([
        [ids.submission, { id: ids.job, status: "failed", attemptCount: 3, maxAttempts: 3 }],
      ]),
    }),
  })
  const result = await post(deps, { itemId: ids.researchItem })
  assert.equal(result.status, 409)
  assert.equal(result.body.status?.label, "Recherche ausgeschöpft – im Review-Center neu anstoßen")
  assert.equal(result.body.status?.canStartResearch, false)
  assert.deepEqual(calls, [])
})

/**
 * Two starts on the same submission-less item both read „no identity" before either writes.
 * The conditional writes (both identity columns still empty) let only the first land; the
 * loser must report what the row holds now — never claim its own write happened.
 */
test("race: a submission attached first wins over a later catalog match", async () => {
  let reads = 0
  const { deps, calls } = routeDeps({
    loadItems: async () => {
      reads += 1
      return reads === 1
        ? [barcodeItem]
        : [{ ...barcodeItem, productSubmissionId: ids.newSubmission }]
    },
    loadResearchState: async (_client, items) => ({
      submissions: new Map(
        items[0]?.productSubmissionId
          ? [[ids.newSubmission, { status: "pending_review", approvedProductId: null }]]
          : [],
      ),
      latestJobs: new Map(
        items[0]?.productSubmissionId
          ? [
              [
                ids.newSubmission,
                { id: ids.job, status: "queued", attemptCount: 0, maxAttempts: 3 },
              ],
            ]
          : [],
      ),
      eligible: new Set<string>(),
    }),
    createSubmission: async () => ({ kind: "already_in_catalog", productId: ids.approved }),
    // The other request's attach got there first: our assign matches no row.
    assignCatalogProduct: async (_client, input) => {
      calls.push(`assign-lost:${input.itemId}`)
      return false
    },
  })
  const result = await post(deps, { itemId: ids.barcodeItem })
  assert.equal(result.status, 200)
  assert.deepEqual(calls, [`assign-lost:${ids.barcodeItem}`])
  assert.equal(result.body.status?.label, "In Recherche – wartet")
  assert.equal((result.body as { identityChanged?: boolean }).identityChanged, true)
})

test("race: a catalog match assigned first wins over a later submission attach", async () => {
  let reads = 0
  const { deps, calls } = routeDeps({
    loadItems: async () => {
      reads += 1
      return reads === 1 ? [barcodeItem] : [{ ...barcodeItem, productId: ids.approved }]
    },
    attachSubmission: async (_client, input) => {
      calls.push(`attach-lost:${input.itemId}`)
      return false
    },
  })
  const result = await post(deps, { itemId: ids.barcodeItem })
  assert.equal(result.status, 200)
  assert.deepEqual(calls, [`create:${ids.user}:${EAN}`, `attach-lost:${ids.barcodeItem}`])
  assert.equal(result.body.status?.label, "Im Katalog")
  assert.equal((result.body as { identityChanged?: boolean }).identityChanged, true)
})

test("an enqueue changes no identity, so the cockpit only updates the badge", async () => {
  const { deps } = routeDeps()
  const result = await post(deps, { itemId: ids.researchItem })
  assert.equal(result.status, 200)
  assert.equal((result.body as { identityChanged?: boolean }).identityChanged, false)
})

test("a second-tab retry the RPC refuses reports the job the first tab queued", async () => {
  let reads = 0
  const { deps } = routeDeps({
    loadResearchState: async () => {
      reads += 1
      return {
        ...researchState("researching"),
        latestJobs: new Map([
          [
            ids.submission,
            reads === 1
              ? { id: ids.job, status: "failed", attemptCount: 1, maxAttempts: 3 }
              : { id: ids.job, status: "queued", attemptCount: 1, maxAttempts: 3 },
          ],
        ]),
      }
    },
    retry: async () => {
      throw new Error("Product intake research job is not retryable from status queued")
    },
  })
  const result = await post(deps, { itemId: ids.researchItem })
  assert.equal(result.status, 200)
  assert.equal(result.body.status?.label, "In Recherche – wartet")
})

test("the list refreshes the whole cockpit exactly when an item's identity changed", () => {
  const status = {
    kind: "research_queued" as const,
    label: "In Recherche – wartet",
    canStartResearch: false,
  }
  assert.deepEqual(discoveryResearchStartOutcome(true, { status, identityChanged: true }), {
    row: {
      status: "research_queued",
      statusLabel: "In Recherche – wartet",
      canStartResearch: false,
    },
    refresh: true,
    failed: false,
  })
  assert.equal(
    discoveryResearchStartOutcome(true, { status, identityChanged: false }).refresh,
    false,
  )
  // A 409 carries the current status and refreshes nothing.
  const conflict = discoveryResearchStartOutcome(false, { status })
  assert.equal(conflict.failed, false)
  assert.equal(conflict.refresh, false)
  assert.deepEqual(discoveryResearchStartOutcome(false, null), {
    row: null,
    refresh: false,
    failed: true,
  })
})

test("a refreshed routine remounts the decision island so its state re-syncs", () => {
  // The page keys both client islands with this; a new routine or finalize state is a new key.
  assert.notEqual(
    discoveryCockpitStateKey("hash-a", null),
    discoveryCockpitStateKey("hash-b", null),
  )
  assert.notEqual(
    discoveryCockpitStateKey("hash-a", null),
    discoveryCockpitStateKey("hash-a", "2026-09-22T12:00:00.000Z"),
  )
  assert.equal(discoveryCockpitStateKey("hash-a", null), discoveryCockpitStateKey("hash-a", null))
})

// --- confirm-pass fixes: decision writes vs research refresh ------------------

test("every successful decision or finalize write refreshes; a refusal rolls back and explains", () => {
  assert.deepEqual(discoveryDecisionWriteOutcome(true, null), {
    rollback: false,
    error: null,
    refresh: true,
  })
  const frozen = discoveryDecisionWriteOutcome(false, { code: "finalized" })
  assert.equal(frozen.rollback, true)
  assert.equal(frozen.refresh, false)
  assert.match(frozen.error ?? "", /finalisiert/)
  assert.equal(
    discoveryDecisionWriteOutcome(false, null).error,
    "Nicht gespeichert. Bitte noch einmal.",
  )

  assert.deepEqual(discoveryFinalizeWriteOutcome(true, { code: undefined }), {
    error: null,
    refresh: true,
  })
  assert.deepEqual(discoveryFinalizeWriteOutcome(false, { code: "not_submitted" }), {
    error: "Die Checkliste ist noch nicht abgeschickt.",
    refresh: false,
  })
})

test("research starts wait while a decision write is pending — including a remounted panel's", () => {
  const seen: boolean[] = []
  const unsubscribe = subscribeDiscoveryDecisionWrites(() =>
    seen.push(discoveryDecisionWritesPending()),
  )
  assert.equal(discoveryDecisionWritesPending(), false)
  const endFirst = beginDiscoveryDecisionWrite()
  const endSecond = beginDiscoveryDecisionWrite()
  assert.equal(discoveryDecisionWritesPending(), true)
  endFirst()
  endFirst() // ending twice never undercounts the other write
  assert.equal(discoveryDecisionWritesPending(), true)
  endSecond()
  assert.equal(discoveryDecisionWritesPending(), false)
  unsubscribe()
  assert.deepEqual(seen, [true, true, true, false])
})

test("a lost submission attach answers with the winner's state, not an error", async () => {
  let reads = 0
  const { deps, calls } = routeDeps({
    loadItems: async () => {
      reads += 1
      return reads === 1
        ? [barcodeItem]
        : [{ ...barcodeItem, productSubmissionId: ids.newSubmission }]
    },
    loadResearchState: async (_client, items) => ({
      submissions: new Map(
        items[0]?.productSubmissionId
          ? [[ids.newSubmission, { status: "pending_review", approvedProductId: null }]]
          : [],
      ),
      latestJobs: new Map(
        items[0]?.productSubmissionId
          ? [
              [
                ids.newSubmission,
                { id: ids.job, status: "running", attemptCount: 1, maxAttempts: 3 },
              ],
            ]
          : [],
      ),
      eligible: new Set<string>(),
    }),
    attachSubmission: async (_client, input) => {
      calls.push(`attach-lost:${input.itemId}`)
      return false
    },
  })
  const result = await post(deps, { itemId: ids.barcodeItem })
  assert.equal(result.status, 200)
  assert.deepEqual(calls, [`create:${ids.user}:${EAN}`, `attach-lost:${ids.barcodeItem}`])
  assert.equal(result.body.status?.label, "In Recherche – läuft")
  assert.equal((result.body as { identityChanged?: boolean }).identityChanged, true)
})
