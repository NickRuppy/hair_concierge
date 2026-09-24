import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { renderToStaticMarkup } from "react-dom/server"

import { createDiscoveryPdfPage } from "../src/app/admin/beratung/[enrollmentId]/pdf/page"
import { createDiscoveryFinalizeHandler } from "../src/app/api/admin/beratung/[enrollmentId]/finalize/route"
import {
  DiscoveryCallCockpit,
  discoveryApplicationMissingHint,
  discoveryFinalizeWriteOutcome,
  discoveryResearchOpenHint,
} from "../src/components/discovery/cockpit/discovery-call-cockpit"
import {
  compileDiscoveryApplication,
  discoveryApplicationCandidates,
  discoveryApplicationProfile,
  loadDiscoveryApplication,
  type DiscoveryApplication,
} from "../src/lib/discovery/application"
import {
  buildDiscoveryCockpitView,
  discoveryResearchOpenItems,
  loadDiscoveryCockpitModel,
  type DiscoveryCallIntake,
  type DiscoveryCockpitModel,
} from "../src/lib/discovery/cockpit"
import type { DiscoveryIdealStep } from "../src/lib/discovery/load-ideal-routine"
import {
  composeDiscoveryRefinedRoutine,
  withDiscoveryApplicationHash,
  type DiscoveryCallDecision,
  type DiscoveryIntakeItem,
} from "../src/lib/discovery/refined-routine"
import type { ApplicationCatalogRows } from "../src/lib/personal-plan/routine/application-adapter"
import { APPLICATION_DAY_TYPE_KEYS } from "../src/lib/routines/personal-plan/application/contracts"
import type { ProductApplicationPointerV2 } from "../src/lib/routines/personal-plan/application/contracts-v2"
import type { ApplicationDayTypeDefinition } from "../src/lib/routines/personal-plan/application/repository"
import { SHARED_APPLICATION_TEMPLATES_V2 } from "../src/lib/routines/personal-plan/application/shared-templates-v2"
import type { ScanCatalogPresentationRow } from "../src/lib/scan/product-presentation"
import type { ScanEvaluationContext } from "../src/lib/scan/profile-context"

/**
 * Batch 6, part 3: „So wendest du es an" on the participant's sheet, from the PRODUCTION
 * application pipeline — the verified per-product guidance research stored, composed with
 * the shared family templates by the same compiler `/anwendung` runs. Nothing is invented:
 * a printed product without complete guidance is a gap, and finalising waits for it, like
 * it waits for every product still in research.
 */

const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  intake: "40000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
  keptShampoo: "30000000-0000-4000-8000-000000000001",
  ownedConditioner: "30000000-0000-4000-8000-000000000002",
  swapConditioner: "30000000-0000-4000-8000-000000000003",
  idealLeaveIn: "30000000-0000-4000-8000-000000000004",
  ownedMask: "30000000-0000-4000-8000-000000000005",
}

// --- the routine the call composed ---------------------------------------------------

function step(
  overrides: Partial<DiscoveryIdealStep> & Pick<DiscoveryIdealStep, "decisionKey" | "category">,
): DiscoveryIdealStep {
  return {
    role: "shampoo_everyday",
    section: "basis",
    categoryLabel: "Shampoo",
    roleLabel: "Hauptreinigung",
    roleDescription: "Reinigt Kopfhaut und Ansatz.",
    frequencyLabel: "3× pro Woche",
    preview: null,
    ...overrides,
  }
}

const shampooStep = step({ decisionKey: "d:shampoo", category: "shampoo" })
const conditionerStep = step({
  decisionKey: "d:conditioner",
  category: "conditioner",
  role: "conditioner_rinse_out",
  categoryLabel: "Conditioner",
  frequencyLabel: "nach jeder Haarwäsche",
})
const leaveInStep = step({
  decisionKey: "d:leave_in",
  category: "leave_in",
  role: "post_wash_leave_in",
  categoryLabel: "Leave-in",
  frequencyLabel: "wird im nächsten Schritt verfeinert",
  preview: {
    kind: "recommendation",
    category: "leave_in",
    role: "post_wash_leave_in",
    decisionKey: "d:leave_in",
    productId: ids.idealLeaveIn,
    productName: "Leichtes Leave-in",
    imageUrl: "https://catalog.example/preview.png",
    verdict: "ideal",
    authorityVersion: "v1",
    factFingerprint: "fp",
    commerce: {
      priceEur: null,
      purchaseLinkStatus: null,
      netContentValue: null,
      netContentUnit: null,
      priceLabel: null,
      netContentLabel: null,
      availabilityLabel: null,
      productUrl: null,
      affiliateDisclosure: null,
    },
    reasoning: { productCriteria: "Leicht.", fit: "Passt.", frequency: "nach jeder Wäsche" },
  },
})
const maskStep = step({
  decisionKey: "d:mask",
  category: "mask",
  role: "intensive_conditioning_mask",
  categoryLabel: "Maske",
  frequencyLabel: "1× pro Woche",
})

const steps = [shampooStep, conditionerStep, leaveInStep, maskStep]

function item(overrides: Partial<DiscoveryIntakeItem> & Pick<DiscoveryIntakeItem, "id">) {
  return {
    category: "shampoo" as const,
    source: "catalog_search" as const,
    brandText: null,
    productNameText: null,
    barcodeIdentifier: null,
    productId: null,
    productSubmissionId: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    ...overrides,
  } satisfies DiscoveryIntakeItem
}

const items: DiscoveryIntakeItem[] = [
  item({ id: "i-shampoo", productId: ids.keptShampoo, brandText: "A", productNameText: "Pure" }),
  item({
    id: "i-conditioner",
    category: "conditioner",
    productId: ids.ownedConditioner,
    brandText: "B",
    productNameText: "Alt",
  }),
  // Her mask: bound, but the call has not decided — the sheet prints „Noch offen".
  item({
    id: "i-mask",
    category: "mask",
    productId: ids.ownedMask,
    brandText: "M",
    productNameText: "Maske",
  }),
]

const decisions: DiscoveryCallDecision[] = [
  { decisionKey: "d:shampoo", decision: "keep", swapProductId: null, intakeItemId: "i-shampoo" },
  {
    decisionKey: "d:conditioner",
    decision: "swap",
    swapProductId: ids.swapConditioner,
    intakeItemId: "i-conditioner",
  },
]

function catalogRow(id: string, name: string, brand: string, category: string) {
  return {
    id,
    name,
    brand,
    category,
    imageUrl: null,
    priceEur: null,
    currency: null,
    affiliateLink: null,
    purchaseLinkStatus: null,
    priceCheckedAt: null,
  } as ScanCatalogPresentationRow
}

function composeRoutine() {
  return composeDiscoveryRefinedRoutine({
    steps,
    items,
    decisions,
    swapProducts: [catalogRow(ids.swapConditioner, "Feuchtigkeit Spülung", "Guhl", "conditioner")],
    recommendationProducts: [
      catalogRow(ids.idealLeaveIn, "Leichtes Leave-in", "Garnier", "leave_in"),
    ],
    ownedProducts: [{ itemId: "i-shampoo", brand: "Elvital", name: "Hyaluron Pure Shampoo" }],
  })
}

// --- A: printed products → routine candidates -----------------------------------------

test("candidates are exactly the printed products: kept, swapped-in, new — never the undecided one", () => {
  const candidates = discoveryApplicationCandidates(composeRoutine())
  assert.deepEqual(
    candidates.map((entry) => [
      entry.productId,
      entry.productName,
      entry.category,
      entry.routineRole,
      entry.kind,
      entry.effectiveCadenceDe,
      entry.routineOrder,
    ]),
    [
      [
        ids.keptShampoo,
        "Elvital Hyaluron Pure Shampoo",
        "shampoo",
        "shampoo_everyday",
        "owned",
        "3× pro Woche",
        0,
      ],
      [
        ids.swapConditioner,
        "Guhl Feuchtigkeit Spülung",
        "conditioner",
        "conditioner_rinse_out",
        "planned",
        "nach jeder Haarwäsche",
        1,
      ],
      // Plan-internal cadence wording never reaches the sheet.
      [
        ids.idealLeaveIn,
        "Garnier Leichtes Leave-in",
        "leave_in",
        "post_wash_leave_in",
        "planned",
        "nach Bedarf",
        2,
      ],
    ],
  )
  // Her own conditioner was swapped away and the undecided mask prints „Noch offen".
  assert.ok(!candidates.some((entry) => entry.productId === ids.ownedConditioner))
  assert.ok(!candidates.some((entry) => entry.productId === ids.ownedMask))
})

// --- B: the profile, from an initial-only context ---------------------------------------

const initialContext = {
  snapshot: {
    snapshotKind: "initial_need",
    profile: { hair: { length: "long", density: "high", thickness: "fine", texture: "wavy" } },
    assessments: {
      heatExposure: {
        events: [
          { id: "heat-1", tool: "straightener", route: "direct_contact_heat" },
          { id: "heat-2", tool: "hair_dryer", route: "airflow_shaping" },
        ],
      },
    },
  },
} as unknown as ScanEvaluationContext

test("the profile comes from the context the cockpit holds — an initial snapshot works", () => {
  assert.deepEqual(discoveryApplicationProfile(initialContext), {
    length: "long",
    density: "high",
    thickness: "fine",
    dryingRoute: "heat_tool",
    heatEvents: [
      { id: "heat-1", tool: "straightener", route: "direct_contact_heat" },
      { id: "heat-2", tool: "hair_dryer", route: "airflow_shaping" },
    ],
  })
})

// --- C: the production compile over those candidates ---------------------------------

const DAY_LABELS: Record<string, [string, string]> = {
  wash_day: ["Waschtag", "Reinigen und pflegen."],
  intensive_care_day: ["Intensivpflegetag", "Mit Maske."],
  bond_repair_day: ["Bond-Repair-Tag", "Mit Bond-Repair."],
  clarifying_wash_day: ["Klärende Wäsche", "Rückstände lösen."],
  refresh_day: ["Auffrischtag", "Zwischen den Wäschen."],
  between_wash_care_day: ["Pflege zwischendurch", "Ohne Wäsche."],
  styling_day: ["Stylingtag", "Mit Hitze."],
  rest_day: ["Pausentag", "Nichts nötig."],
}

const dayDefinitions: ApplicationDayTypeDefinition[] = APPLICATION_DAY_TYPE_KEYS.map(
  (key, index) => ({
    key,
    definitionVersion: 1,
    locale: "de",
    label: DAY_LABELS[key]![0],
    summary: DAY_LABELS[key]![1],
    sortOrder: index + 1,
  }),
)

function pointer(
  productId: string,
  overrides: Partial<ProductApplicationPointerV2> &
    Pick<ProductApplicationPointerV2, "sourceRole" | "role" | "applicationFamily">,
  category: string,
): ProductApplicationPointerV2 {
  return {
    schemaVersion: 2,
    contractKind: "product_pointer",
    scope: { kind: "product", category: category as never, productId },
    workflowId: null,
    requiredCompanionProductId: null,
    runtimeBlockerCode: null,
    exactSteps: [],
    cautionCodes: [],
    evidence: [
      { sourceUrl: "https://example.com/p", sourceType: "manufacturer", checkedAt: "2026-08-12" },
    ],
    facts: {
      applicationState: "wet_hair",
      applicationArea: "scalp_roots",
      rinse: "rinse_out",
      contactTime: null,
      amount: null,
      heat: null,
      conditionerPolicy: "not_applicable",
    },
    ...overrides,
  }
}

const POINTERS = {
  shampoo: pointer(
    ids.keptShampoo,
    {
      sourceRole: "shampoo_everyday",
      role: "cleanse",
      applicationFamily: "standard_rinse_out_cleanse",
    },
    "shampoo",
  ),
  conditioner: pointer(
    ids.swapConditioner,
    {
      sourceRole: "conditioner_rinse_out",
      role: "condition",
      applicationFamily: "standard_rinse_out_conditioning",
      facts: {
        applicationState: "wet_hair",
        applicationArea: "hair_lengths_ends",
        rinse: "rinse_out",
        contactTime: null,
        amount: null,
        heat: null,
        conditionerPolicy: "not_applicable",
      },
    },
    "conditioner",
  ),
  leaveIn: pointer(
    ids.idealLeaveIn,
    {
      sourceRole: "post_wash_leave_in",
      role: "leave_in",
      applicationFamily: "post_wash_booster",
      facts: {
        applicationState: "damp_hair",
        applicationArea: "hair_lengths_ends",
        rinse: "leave_in",
        contactTime: null,
        amount: null,
        heat: null,
        conditionerPolicy: "not_applicable",
      },
    },
    "leave_in",
  ),
}

function productRow(id: string, category: string, imageUrl: string | null = null) {
  return {
    id,
    image_url: imageUrl,
    category,
    category_key: category,
    is_active: true,
    lifecycle_status: "active",
    is_chaarlie_recommended: true,
  }
}

function protocolRow(value: ProductApplicationPointerV2) {
  return {
    product_id: value.scope.productId,
    category: value.scope.category,
    role: value.sourceRole,
    guidance_payload_v2: value,
    application_state: null,
    reapplication: null,
    source_url: null,
    source_text: null,
    updated_at: "2026-09-01T00:00:00.000Z",
  }
}

function catalog(
  pointers: ProductApplicationPointerV2[] = Object.values(POINTERS),
  products = [
    productRow(ids.keptShampoo, "shampoo", "https://catalog.example/shampoo.png"),
    productRow(ids.swapConditioner, "conditioner"),
    productRow(ids.idealLeaveIn, "leave_in", "https://catalog.example/leave-in.png"),
  ],
): ApplicationCatalogRows {
  return {
    products: new Map(products.map((row) => [row.id, row as never])),
    protocolRows: pointers.map(protocolRow),
  }
}

function compile(overrides: { catalog?: ApplicationCatalogRows } = {}): DiscoveryApplication {
  return compileDiscoveryApplication({
    candidates: discoveryApplicationCandidates(composeRoutine()),
    catalog: overrides.catalog ?? catalog(),
    dayDefinitions,
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    profile: discoveryApplicationProfile(initialContext),
  })
}

test("the production compiler turns the printed products into days with verified steps", () => {
  const { print, gaps } = compile()
  assert.deepEqual(gaps, [])
  const wash = print.days.find((day) => day.dayType === "wash_day")
  assert.ok(wash)
  assert.equal(wash.label, "Waschtag")
  assert.equal(wash.summary, "Reinigen und pflegen.")
  // The kept shampoo is her owned wash-day product: its sheet cadence names the day.
  assert.equal(wash.cadence, "3× pro Woche")
  const products = wash.steps.flatMap((entry) => (entry.kind === "product" ? [entry] : []))
  assert.deepEqual(
    products.map((entry) => entry.name),
    ["Elvital Hyaluron Pure Shampoo", "Guhl Feuchtigkeit Spülung", "Garnier Leichtes Leave-in"],
  )
  // The shared template's copy, not an invention.
  assert.deepEqual(products[0]!.actions, [
    "Haare und Kopfhaut vollständig anfeuchten.",
    "Eine kleine Menge auf die Kopfhaut geben und sanft einmassieren. Die Längen werden beim Ausspülen mitgereinigt.",
    "Gründlich ausspülen.",
  ])
  assert.equal(products[0]!.imageUrl, "https://catalog.example/shampoo.png")
  assert.equal(products[0]!.categoryLabel, "Shampoo")
  assert.equal(products[0]!.purpose, "Reinigt Kopfhaut und Ansatz.")
  // The rest day has nothing to print.
  assert.ok(!print.days.some((day) => day.dayType === "rest_day"))
})

test("a printed product without a verified guide is a gap — named, never filled in", () => {
  const { gaps, print } = compile({ catalog: catalog([POINTERS.shampoo, POINTERS.conditioner]) })
  assert.deepEqual(gaps, [{ productId: ids.idealLeaveIn, name: "Garnier Leichtes Leave-in" }])
  const printed = print.days.flatMap((day) =>
    day.steps.flatMap((entry) => (entry.kind === "product" ? [entry.name] : [])),
  )
  assert.ok(!printed.includes("Garnier Leichtes Leave-in"))
})

test("a printed product the catalog no longer serves is a gap as well", () => {
  const { gaps } = compile({
    catalog: catalog(undefined, [
      productRow(ids.keptShampoo, "shampoo"),
      productRow(ids.swapConditioner, "conditioner"),
      { ...productRow(ids.idealLeaveIn, "leave_in"), is_chaarlie_recommended: false },
    ]),
  })
  assert.deepEqual(
    gaps.map((gap) => gap.productId),
    [ids.idealLeaveIn],
  )
})

// --- D: the loader reads catalog + content only ------------------------------------------

function fakeAdmin() {
  const tables: string[] = []
  const rows: Record<string, unknown[]> = {
    products: [
      productRow(ids.keptShampoo, "shampoo"),
      productRow(ids.swapConditioner, "conditioner"),
      productRow(ids.idealLeaveIn, "leave_in"),
    ],
    product_application_protocols: Object.values(POINTERS).map(protocolRow),
    application_day_type_definitions: dayDefinitions.map((day) => ({
      day_type_key: day.key,
      definition_version: 1,
      locale: "de",
      label: day.label,
      summary: day.summary,
      sort_order: day.sortOrder,
      status: "active",
    })),
    application_guidance_protocols: SHARED_APPLICATION_TEMPLATES_V2.map((template, index) => ({
      id: `protocol-${index}`,
      guidance_key: template.guidanceKey,
      protocol_version: template.protocolVersion,
      locale: "de",
      scope_kind: template.scope.kind,
      category_key: template.scope.category,
      role_key: template.role,
      product_id: null,
      application_family: template.applicationFamily,
      contract_version: 2,
      payload: template,
      status: "active",
      verified_at: "2026-09-01T00:00:00.000Z",
    })),
  }
  const client = {
    from(table: string) {
      tables.push(table)
      const result = { data: rows[table] ?? null, error: rows[table] ? null : { message: "no" } }
      const query = {
        select: () => query,
        eq: () => query,
        in: async () => result,
        order: async () => result,
      }
      return query
    },
  }
  return { client, tables }
}

test("the loader reads the catalog and the guidance content — never a Personal Plan artifact", async () => {
  const { client, tables } = fakeAdmin()
  const application = await loadDiscoveryApplication(client as never, {
    routine: composeRoutine(),
    context: initialContext,
  })
  assert.deepEqual(application.gaps, [])
  assert.ok(application.print.days.some((day) => day.dayType === "wash_day"))
  assert.deepEqual([...new Set(tables)].sort(), [
    "application_day_type_definitions",
    "application_guidance_protocols",
    "product_application_protocols",
    "products",
  ])
})

test("nothing printed → no reads, no section", async () => {
  const { client, tables } = fakeAdmin()
  const empty = await loadDiscoveryApplication(client as never, {
    routine: { steps: [] },
    context: initialContext,
  })
  assert.deepEqual(empty, { print: { days: [] }, gaps: [] })
  assert.deepEqual(tables, [])
})

// --- E: the fingerprint -----------------------------------------------------------

test("the printed section is part of sourceHash — only when it prints anything", () => {
  const routine = composeRoutine()
  assert.equal(withDiscoveryApplicationHash(routine, null).sourceHash, routine.sourceHash)
  assert.equal(withDiscoveryApplicationHash(routine, { days: [] }).sourceHash, routine.sourceHash)
  const { print } = compile()
  const hashed = withDiscoveryApplicationHash(routine, print)
  assert.notEqual(hashed.sourceHash, routine.sourceHash)
  // A change in the printed guidance moves it.
  const edited = structuredClone(print)
  const firstProduct = edited.days[0]!.steps.find((entry) => entry.kind === "product")
  if (firstProduct?.kind === "product") firstProduct.actions[0] = "Anders."
  assert.notEqual(withDiscoveryApplicationHash(routine, edited).sourceHash, hashed.sourceHash)
})

// --- F: the cockpit model threads it -------------------------------------------------

function modelDeps(loadApplication: (...args: never[]) => Promise<DiscoveryApplication>) {
  return {
    loadIdealRoutine: async () => ({
      status: "ready" as const,
      steps,
      context: initialContext,
      previewSource: { personalPlanId: "discovery:x", sourceNeedVersionId: "v1" },
    }),
    loadItems: async () => items,
    loadVerdicts: async () => [],
    loadDecisions: async () => decisions,
    loadSwapProducts: async () => [
      catalogRow(ids.swapConditioner, "Feuchtigkeit Spülung", "Guhl", "conditioner"),
      catalogRow(ids.idealLeaveIn, "Leichtes Leave-in", "Garnier", "leave_in"),
    ],
    loadProductIdentities: async () => new Map(),
    loadResearchState: async () => ({
      submissions: new Map(),
      latestJobs: new Map(),
      eligible: new Set<string>(),
    }),
    loadApplication: loadApplication as never,
  }
}

test("the model hands the composed routine and the prepared context to the application loader", async () => {
  const seen: Array<{ products: string[]; context: unknown }> = []
  const section = compile()
  const model = await loadDiscoveryCockpitModel(
    {} as never,
    { intakeId: ids.intake, userId: ids.user },
    modelDeps((async (_admin: unknown, input: { routine: never; context: unknown }) => {
      seen.push({
        products: discoveryApplicationCandidates(input.routine).map((entry) => entry.productId),
        context: input.context,
      })
      return section
    }) as never),
  )
  assert.equal(model.status, "ready")
  if (model.status !== "ready") return
  assert.deepEqual(seen, [
    { products: [ids.keptShampoo, ids.swapConditioner, ids.idealLeaveIn], context: initialContext },
  ])
  const view = buildDiscoveryCockpitView(model)
  assert.equal(view.applicationAvailable, true)
  assert.deepEqual(view.application, section.print)
  // The same composition without a section fingerprints differently: the section is hashed.
  const without = await loadDiscoveryCockpitModel(
    {} as never,
    { intakeId: ids.intake, userId: ids.user },
    modelDeps(async () => ({ print: { days: [] }, gaps: [] })),
  )
  assert.equal(without.status, "ready")
  if (without.status !== "ready") return
  assert.equal(buildDiscoveryCockpitView(without).application, null)
  assert.notEqual(without.routine.sourceHash, model.routine.sourceHash)
})

test("an unreadable application section degrades: no section, finalising and the PDF wait", async () => {
  const model = await loadDiscoveryCockpitModel(
    {} as never,
    { intakeId: ids.intake, userId: ids.user },
    modelDeps(async () => {
      throw new Error("application_guidance_protocols query failed")
    }),
  )
  assert.equal(model.status, "ready")
  if (model.status !== "ready") return
  const view = buildDiscoveryCockpitView(model)
  assert.equal(view.applicationAvailable, false)
  assert.equal(view.application, null)
  assert.deepEqual(view.applicationGaps, [])
})

// --- G: finalising waits ---------------------------------------------------------------

const submittedIntake: DiscoveryCallIntake = {
  id: ids.intake,
  enrollmentId: ids.enrollment,
  userId: ids.user,
  state: "submitted",
  submittedAt: "2026-09-20T18:41:00.000Z",
  callFinalizedAt: null,
  finalizedSourceHash: null,
}

function readyModel(overrides: Partial<DiscoveryCockpitModel> = {}): DiscoveryCockpitModel {
  const section = compile()
  return {
    status: "ready",
    steps,
    verdicts: [],
    previewSource: { personalPlanId: "discovery:x", sourceNeedVersionId: "v1" },
    routine: withDiscoveryApplicationHash(composeRoutine(), section.print),
    recommendationProducts: [],
    recommendationBrandsAvailable: true,
    application: { status: "ready", section },
    ...overrides,
  }
}

function finalizeWith(model: DiscoveryCockpitModel) {
  let stored: string | null = null
  const handler = createDiscoveryFinalizeHandler({
    flagEnabled: () => true,
    requireAdmin: async () => ({ userId: "admin-1" }) as never,
    createAdminClient: () => ({}) as never,
    loadIntake: async () => submittedIntake,
    loadModel: async () => model,
    finalize: async (input) => {
      stored = input.sourceHash
      return {
        ...submittedIntake,
        callFinalizedAt: "2026-09-24T12:00:00.000Z",
        finalizedSourceHash: input.sourceHash,
      }
    },
  })
  return {
    run: () =>
      handler(
        new NextRequest(`https://chaarlie.de/api/admin/beratung/${ids.enrollment}/finalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ finalized: true }),
        }),
        { params: Promise.resolve({ enrollmentId: ids.enrollment }) },
      ),
    stored: () => stored,
  }
}

test("finalize stores the fingerprint that includes the printed application section", async () => {
  const model = readyModel()
  const call = finalizeWith(model)
  const response = await call.run()
  assert.equal(response.status, 200)
  assert.equal(call.stored(), model.routine.sourceHash)
})

test("finalize refuses while a product is still in research (409 research_open)", async () => {
  const researching = [
    ...items,
    item({
      id: "i-research",
      category: "oil",
      source: "name_research",
      brandText: "Öl",
      productNameText: "Unbekannt",
      productSubmissionId: "s-1",
    }),
  ]
  const routine = composeDiscoveryRefinedRoutine({
    steps,
    items: researching,
    decisions,
    swapProducts: [],
  })
  const call = finalizeWith(readyModel({ routine }))
  const response = await call.run()
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { code: "research_open" })
  assert.equal(call.stored(), null)
  assert.equal(
    discoveryResearchOpenItems(buildDiscoveryCockpitView(readyModel({ routine }))).length,
    1,
  )
})

test("finalize refuses while a printed product has no verified guide (409 application_missing)", async () => {
  const section = compile({ catalog: catalog([POINTERS.shampoo, POINTERS.conditioner]) })
  const call = finalizeWith(readyModel({ application: { status: "ready", section } }))
  const response = await call.run()
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { code: "application_missing" })
  assert.equal(call.stored(), null)
})

test("finalize refuses (503) while the application section cannot be read", async () => {
  const call = finalizeWith(readyModel({ application: { status: "unavailable" } }))
  const response = await call.run()
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { code: "unavailable" })
  assert.equal(call.stored(), null)
})

test("the cockpit disables „Finalisieren“ and names what it waits for", () => {
  const router = { refresh() {}, push() {}, replace() {}, prefetch() {}, back() {}, forward() {} }
  const markup = renderToStaticMarkup(
    <AppRouterContext.Provider value={router as never}>
      <DiscoveryCallCockpit
        enrollmentId={ids.enrollment}
        steps={[]}
        submitted
        initialFinalizedAt={null}
        researchOpenCount={2}
        applicationGaps={["Garnier Leichtes Leave-in"]}
      />
    </AppRouterContext.Provider>,
  )
  assert.match(markup, /<button type="button" disabled=""[^>]*>Finalisieren</)
  assert.ok(markup.includes("Erst Recherche abschließen — 2 Produkte noch in Recherche."))
  assert.ok(markup.includes("Anwendung fehlt für Garnier Leichtes Leave-in."))
  assert.equal(
    discoveryResearchOpenHint(1),
    "Erst Recherche abschließen — 1 Produkt noch in Recherche.",
  )
  assert.equal(discoveryApplicationMissingHint(["A", "B"]), "Anwendung fehlt für A · B.")
  assert.equal(
    discoveryFinalizeWriteOutcome(false, { code: "research_open" }).error,
    "Erst Recherche abschließen.",
  )
  assert.equal(
    discoveryFinalizeWriteOutcome(false, { code: "application_missing" }).error,
    "Anwendung fehlt für mindestens ein Produkt.",
  )
})

// --- H: the printed sheet ----------------------------------------------------------------

async function renderPdf(model: DiscoveryCockpitModel, finalizedSourceHash: string | null) {
  const Page = createDiscoveryPdfPage({
    flagEnabled: () => true,
    requireAdmin: async () => ({ userId: "admin-1" }) as never,
    createAdminClient: () => ({}) as never,
    loadEnrollment: async () => ({
      enrollmentId: ids.enrollment,
      name: "Lena M.",
      email: null,
      tokenVersion: 1,
      claimedUserId: ids.user,
      claimedAt: null,
      createdAt: "2026-09-18T10:00:00.000Z",
    }),
    loadIntake: async () => ({
      ...submittedIntake,
      callFinalizedAt: "2026-09-24T12:00:00.000Z",
      finalizedSourceHash,
    }),
    loadModel: async () => model,
  })
  return renderToStaticMarkup(
    await Page({ params: Promise.resolve({ enrollmentId: ids.enrollment }) }),
  )
}

test("the PDF prints „So wendest du es an“ after the routine, by day, with image, steps and order", async () => {
  const model = readyModel()
  const markup = await renderPdf(model, model.routine.sourceHash)
  // Finalised as printed: no drift banner.
  assert.doesNotMatch(markup, /Stand hat sich geändert/)
  const routineAt = markup.indexOf("So gehst du vor")
  const applyAt = markup.indexOf("So wendest du es an")
  assert.ok(routineAt > 0 && applyAt > routineAt)
  const section = markup.slice(applyAt)
  assert.match(section, /class="dcp-day-title">Waschtag</)
  assert.match(section, /3× pro Woche/)
  assert.match(section, /<img class="dcp-thumb" src="https:\/\/catalog.example\/shampoo.png"/)
  assert.ok(section.includes("Haare und Kopfhaut vollständig anfeuchten."))
  // Shampoo before conditioner before leave-in, as the compiler ordered them.
  const order = [
    "Elvital Hyaluron Pure Shampoo",
    "Guhl Feuchtigkeit Spülung",
    "Garnier Leichtes Leave-in",
  ].map((name) => section.indexOf(`class="dcp-apply-name">${name}<`))
  assert.ok(order.every((index) => index > 0))
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    order,
  )
  // Print-safe: product blocks never break across pages; the section starts a new page.
  assert.match(markup, /\.dcp-apply-product, \.dcp-apply-transition \{[^}]*break-inside: avoid/)
  assert.match(markup, /\.dcp-apply \{ break-before: page;/)
})

test("a sheet finalised before batch 6 shows the drift banner once (the section is new)", async () => {
  const model = readyModel()
  const markup = await renderPdf(model, composeRoutine().sourceHash)
  assert.match(markup, /Stand hat sich geändert/)
})

test("the PDF sends Nick back to the cockpit while the section cannot be read", async () => {
  const model = readyModel({ application: { status: "unavailable" } })
  await assert.rejects(
    () => renderPdf(model, model.routine.sourceHash),
    (error: unknown) =>
      String((error as { digest?: string }).digest ?? "").startsWith("NEXT_REDIRECT"),
  )
})
