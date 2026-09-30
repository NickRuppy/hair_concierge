import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { createDiscoveryIntakeHeatStylingHandler } from "../src/app/api/beratung/intake/heat-styling/route"
import { createDiscoveryIntakeItemsHandler } from "../src/app/api/beratung/intake/items/route"
import { createDiscoveryIntakeItemPatchHandler } from "../src/app/api/beratung/intake/items/[itemId]/route"
import type { DiscoveryEnrollment } from "../src/lib/discovery/enrollment"
import type { DiscoveryHeatStylingV1 } from "../src/lib/discovery/heat-styling"
import {
  projectDiscoveryHeatStyling,
  projectDiscoveryIntakeItemRow,
  toDiscoveryIntakeItemView,
  type DiscoveryIntake,
  type DiscoveryIntakeItem,
  type DiscoveryIntakeItemInsert,
  type DiscoveryIntakeItemUsageUpdate,
} from "../src/lib/discovery/intake"

/**
 * Batch 7 (plan plans/discovery-refinement-b7/plan.md Rev. 3, §2.2): the participant API the
 * new flow calls — frequency on the item add and PATCH, the styling type (D2), the pre-wash
 * conditioner (D1) and `PUT /api/beratung/intake/heat-styling`. Every request carries our
 * own Origin, like the pages do.
 */

const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  intake: "40000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
  otherUser: "20000000-0000-4000-8000-000000000003",
  product: "20000000-0000-4000-8000-000000000009",
  item: "50000000-0000-4000-8000-000000000005",
  submission: "60000000-0000-4000-8000-000000000006",
}

const enrollment: DiscoveryEnrollment = {
  enrollmentId: ids.enrollment,
  name: "Lea Sommer",
  email: "lea@example.test",
  tokenVersion: 1,
  claimedUserId: ids.user,
  claimedAt: "2026-09-22T10:00:00.000Z",
  createdAt: "2026-09-22T09:00:00.000Z",
}

const draftIntake: DiscoveryIntake = {
  id: ids.intake,
  enrollmentId: ids.enrollment,
  userId: ids.user,
  state: "draft",
  submittedAt: null,
  heatStyling: null,
}

const submittedIntake: DiscoveryIntake = {
  ...draftIntake,
  state: "submitted",
  submittedAt: "2026-09-25T12:00:00.000Z",
}

type Deps = Record<string, unknown>

type Recorder = {
  inserted: DiscoveryIntakeItemInsert[]
  research: unknown[]
  updates: DiscoveryIntakeItemUsageUpdate[]
  saved: Array<{ intakeId: string; heatStyling: DiscoveryHeatStylingV1 }>
}

function recorder(): Recorder {
  return { inserted: [], research: [], updates: [], saved: [] }
}

function storedFrom(row: DiscoveryIntakeItemInsert): DiscoveryIntakeItem {
  return {
    id: ids.item,
    category: row.category,
    source: row.source,
    brandText: row.brand_text,
    productNameText: row.product_name_text,
    barcodeIdentifier: row.barcode_identifier,
    productId: row.product_id,
    productSubmissionId: row.product_submission_id,
    productType: row.product_type ?? null,
    usageRole: row.usage_role ?? null,
    frequency: row.frequency ?? null,
    catalog: null,
  }
}

function baseDeps(rec: Recorder, overrides: Deps = {}): Deps {
  return {
    flagEnabled: () => true,
    getUserId: async () => ids.user,
    loadEnrollment: async (userId: string) => (userId === ids.user ? enrollment : null),
    createAdminClient: () => ({}) as never,
    getOrCreateIntake: async () => draftIntake,
    checkIdentity: async () => ({ ok: true }),
    loadCatalogProductType: async () => "shampoo",
    createResearchSubmission: async (_client: unknown, input: unknown) => {
      rec.research.push(input)
      return { kind: "pending_submission", submissionId: ids.submission }
    },
    insertItem: async (row: DiscoveryIntakeItemInsert) => {
      rec.inserted.push(row)
      return storedFrom(row)
    },
    clearCategory: async () => {},
    saveHeatStyling: async (input: { intakeId: string; heatStyling: DiscoveryHeatStylingV1 }) => {
      rec.saved.push(input)
      return { ...draftIntake, heatStyling: input.heatStyling }
    },
    ...overrides,
  }
}

function jsonRequest(method: string, path: string, body: unknown, origin = "https://chaarlie.de") {
  return new NextRequest(`https://chaarlie.de${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body),
  })
}

async function addProduct(deps: Deps, body: unknown) {
  const response = await createDiscoveryIntakeItemsHandler(deps)(
    jsonRequest("POST", "/api/beratung/intake/items", body),
  )
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

const typedCapture = {
  source: "name_research",
  brandText: "Balea",
  productNameText: "Repair Spülung",
}

// --- POST: frequency ---------------------------------------------------------------

test("POST stores her frequency and echoes it on the item", async () => {
  const rec = recorder()
  const result = await addProduct(baseDeps(rec), {
    capture: { source: "catalog_search", productId: ids.product, productNameText: "Pure Shampoo" },
    usage: { category: "shampoo", role: null },
    frequency: "weekly_3_4x",
  })
  assert.equal(result.status, 201)
  assert.equal(rec.inserted[0].frequency, "weekly_3_4x")
  assert.equal((result.body.item as Record<string, unknown>).frequency, "weekly_3_4x")
})

test("POST accepts „Weiß ich nicht“ as a frequency; without one the row is exactly the old one", async () => {
  const rec = recorder()
  await addProduct(baseDeps(rec), {
    capture: typedCapture,
    productType: "conditioner",
    usage: { category: "conditioner", role: null },
    frequency: "unknown",
  })
  assert.equal(rec.inserted[0].frequency, "unknown")

  const legacy = recorder()
  const result = await addProduct(baseDeps(legacy), {
    capture: typedCapture,
    productType: "conditioner",
    usage: { category: "conditioner", role: null },
  })
  assert.equal(result.status, 201)
  assert.equal("frequency" in legacy.inserted[0], false)
  assert.equal("frequency" in (result.body.item as Record<string, unknown>), false)
})

test("POST refuses a frequency outside the vocabulary before anything is written", async () => {
  for (const frequency of ["weekly", "", null, 3]) {
    const rec = recorder()
    const result = await addProduct(baseDeps(rec), {
      capture: typedCapture,
      productType: "conditioner",
      usage: { category: "conditioner", role: null },
      frequency,
    })
    assert.equal(result.status, 400, JSON.stringify(frequency))
    assert.equal(result.body.code, "invalid_body")
    assert.deepEqual([rec.inserted, rec.research], [[], []])
  }
})

// --- POST: D1 + D2 ---------------------------------------------------------------------

test("D1: POST stores the pre-wash conditioner role with the conditioner usage", async () => {
  const rec = recorder()
  const result = await addProduct(baseDeps(rec), {
    capture: typedCapture,
    productType: "conditioner",
    usage: { category: "conditioner", role: "pre_wash_conditioner" },
    frequency: "weekly_1x",
  })
  assert.equal(result.status, 201)
  assert.equal(rec.inserted[0].usage_role, "pre_wash_conditioner")
  const refused = await addProduct(baseDeps(recorder()), {
    capture: typedCapture,
    productType: "mask",
    usage: { category: "mask", role: "pre_wash_conditioner" },
  })
  assert.equal(refused.status, 400)
  assert.equal(refused.body.code, "invalid_usage")
})

test("D2: „Styling & Halt“ stores a styling product with no usage and NO research", async () => {
  const rec = recorder()
  const result = await addProduct(baseDeps(rec), {
    capture: { source: "name_research", brandText: "Taft", productNameText: "Haarspray" },
    productType: "styling",
    usage: null,
    frequency: "daily_1x",
  })
  assert.equal(result.status, 201)
  assert.deepEqual(rec.research, [], "a styling product is never researched")
  assert.equal(rec.inserted[0].product_type, "styling")
  assert.equal(rec.inserted[0].category, null)
  assert.equal(rec.inserted[0].usage_role, null)
  assert.equal(rec.inserted[0].product_submission_id, null)
  assert.equal((result.body.item as Record<string, unknown>).productType, "styling")
})

test("D2: a styling product with a usage is refused (400 invalid_usage)", async () => {
  const rec = recorder()
  const result = await addProduct(baseDeps(rec), {
    capture: { source: "name_research", brandText: "Taft", productNameText: "Haarspray" },
    productType: "styling",
    usage: { category: "leave_in", role: null },
  })
  assert.equal(result.status, 400)
  assert.equal(result.body.code, "invalid_usage")
  assert.deepEqual(rec.inserted, [])
})

// --- PATCH ---------------------------------------------------------------------------------

const typedItem: DiscoveryIntakeItem = {
  id: ids.item,
  category: "conditioner",
  source: "name_research",
  brandText: "Balea",
  productNameText: "Repair Spülung",
  barcodeIdentifier: null,
  productId: null,
  productSubmissionId: ids.submission,
  productType: "conditioner",
  usageRole: null,
  frequency: null,
  catalog: null,
}

const openItem: DiscoveryIntakeItem = {
  ...typedItem,
  category: null,
  brandText: "Got2b",
  productNameText: "Glued Spray",
  productSubmissionId: null,
  productType: null,
}

const stylingItem: DiscoveryIntakeItem = { ...openItem, productType: "styling" }

function patchDeps(rec: Recorder, item: DiscoveryIntakeItem | null, overrides: Deps = {}) {
  return baseDeps(rec, {
    loadItem: async (input: { intakeId: string; itemId: string }) =>
      input.intakeId === ids.intake && input.itemId === ids.item ? item : null,
    updateItem: async (input: { update: DiscoveryIntakeItemUsageUpdate }) => {
      rec.updates.push(input.update)
      if (!item) return null
      return {
        ...item,
        ...("category" in input.update ? { category: input.update.category ?? null } : {}),
        ...("usage_role" in input.update ? { usageRole: input.update.usage_role ?? null } : {}),
        ...(input.update.product_type ? { productType: input.update.product_type } : {}),
        ...(input.update.frequency ? { frequency: input.update.frequency } : {}),
      }
    },
    ...overrides,
  })
}

async function patch(deps: Deps, body: unknown) {
  const response = await createDiscoveryIntakeItemPatchHandler(deps)(
    jsonRequest("PATCH", `/api/beratung/intake/items/${ids.item}`, body),
    { params: Promise.resolve({ itemId: ids.item }) },
  )
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

test("PATCH { frequency } alone changes only the frequency — the usage stays", async () => {
  const rec = recorder()
  const result = await patch(patchDeps(rec, typedItem), { frequency: "weekly_2x" })
  assert.equal(result.status, 200)
  assert.deepEqual(rec.updates, [{ frequency: "weekly_2x" }])
  const item = result.body.item as Record<string, unknown>
  assert.equal(item.frequency, "weekly_2x")
  assert.equal(item.category, "conditioner")
  assert.deepEqual(rec.research, [])
})

test("PATCH usage + frequency writes both", async () => {
  const rec = recorder()
  await patch(patchDeps(rec, typedItem), {
    usage: { category: "conditioner", role: "pre_wash_conditioner" },
    frequency: "biweekly_1x",
  })
  assert.deepEqual(rec.updates, [
    { category: "conditioner", usage_role: "pre_wash_conditioner", frequency: "biweekly_1x" },
  ])
})

test("PATCH refuses an empty body and a frequency outside the vocabulary", async () => {
  for (const body of [{}, { frequency: "often" }, { frequency: null }]) {
    const rec = recorder()
    const result = await patch(patchDeps(rec, typedItem), body)
    assert.equal(result.status, 400, JSON.stringify(body))
    assert.equal(result.body.code, "invalid_body")
    assert.deepEqual(rec.updates, [])
  }
})

test("D2: PATCH types an open item as styling — no usage, no research", async () => {
  const rec = recorder()
  const result = await patch(patchDeps(rec, openItem), {
    productType: "styling",
    usage: null,
    frequency: "weekly_5_6x",
  })
  assert.equal(result.status, 200)
  assert.deepEqual(rec.research, [])
  assert.deepEqual(rec.updates, [
    { category: null, usage_role: null, frequency: "weekly_5_6x", product_type: "styling" },
  ])
})

test("D2: styling with a usage, a usage on a styling item, styling on a typed item are refused", async () => {
  const cases: Array<[DiscoveryIntakeItem, unknown, number, string]> = [
    [
      openItem,
      { productType: "styling", usage: { category: "leave_in", role: null } },
      400,
      "invalid_usage",
    ],
    [stylingItem, { usage: { category: "leave_in", role: null } }, 400, "invalid_usage"],
    [typedItem, { productType: "styling" }, 409, "product_type_locked"],
  ]
  for (const [item, body, status, code] of cases) {
    const rec = recorder()
    const result = await patch(patchDeps(rec, item), body)
    assert.equal(result.status, status, JSON.stringify(body))
    assert.equal(result.body.code, code)
    assert.deepEqual(rec.updates, [])
  }
  // A styling item's frequency may still be answered.
  const rec = recorder()
  assert.equal((await patch(patchDeps(rec, stylingItem), { frequency: "daily_1x" })).status, 200)
  assert.deepEqual(rec.updates, [{ frequency: "daily_1x" }])
})

test("PATCH frequency is frozen after submit like every write", async () => {
  const rec = recorder()
  const result = await patch(
    patchDeps(rec, typedItem, { getOrCreateIntake: async () => submittedIntake }),
    { frequency: "weekly_1x" },
  )
  assert.equal(result.status, 409)
  assert.equal(result.body.code, "already_submitted")
  assert.deepEqual(rec.updates, [])
})

// --- PUT heat-styling -------------------------------------------------------------------

const answers: DiscoveryHeatStylingV1 = {
  dryingRoutes: ["ordinary_blow_dry"],
  additionalHeatTools: ["straightener"],
  heatEvents: {
    "heat:ordinary_blow_dry": { frequency: "weekly_3_4x" },
    "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "sometimes" },
  },
}

async function putHeat(deps: Deps, body: unknown, origin?: string) {
  const response = await createDiscoveryIntakeHeatStylingHandler(deps)(
    jsonRequest("PUT", "/api/beratung/intake/heat-styling", body, origin),
  )
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

test("PUT heat-styling saves the whole validated answer on her own draft", async () => {
  const rec = recorder()
  const result = await putHeat(baseDeps(rec), answers)
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, { heatStyling: answers })
  assert.deepEqual(rec.saved, [{ intakeId: ids.intake, heatStyling: answers }])
})

test("PUT heat-styling: „Keiner dieser Wege“ + „Keine weiteren Tools“ is a valid answer", async () => {
  const rec = recorder()
  const none = { dryingRoutes: [], additionalHeatTools: [], heatEvents: {} }
  assert.equal((await putHeat(baseDeps(rec), none)).status, 200)
  assert.deepEqual(rec.saved[0].heatStyling, none)
})

test("PUT heat-styling rejects bad shapes and broken cross-field answers before any write", async () => {
  const cases: Array<[unknown, string]> = [
    [null, "invalid_body"],
    [{ ...answers, towel: "rough" }, "invalid_body"],
    [{ ...answers, dryingRoutes: ["sun"] }, "invalid_body"],
    [
      {
        ...answers,
        heatEvents: { ...answers.heatEvents, "heat:towel": { frequency: "weekly_1x" } },
      },
      "invalid_body",
    ],
    // The straightener was selected but has no event.
    [
      { ...answers, heatEvents: { "heat:ordinary_blow_dry": { frequency: "weekly_3_4x" } } },
      "invalid_heat_events",
    ],
    // An event for a tool she did not select.
    [
      {
        ...answers,
        heatEvents: {
          ...answers.heatEvents,
          "heat:thermal_rollers": { frequency: "weekly_1x", protectionConsistency: "no" },
        },
      },
      "invalid_heat_events",
    ],
    // Plain föhnen never asks about heat protection …
    [
      {
        ...answers,
        heatEvents: {
          ...answers.heatEvents,
          "heat:ordinary_blow_dry": { frequency: "weekly_3_4x", protectionConsistency: "always" },
        },
      },
      "invalid_heat_events",
    ],
    // … a straightener always does.
    [
      {
        ...answers,
        heatEvents: { ...answers.heatEvents, "heat:straightener": { frequency: "weekly_1x" } },
      },
      "invalid_heat_events",
    ],
  ]
  for (const [body, code] of cases) {
    const rec = recorder()
    const result = await putHeat(baseDeps(rec), body)
    assert.equal(result.status, 400, JSON.stringify(body))
    assert.equal(result.body.code, code, JSON.stringify(body))
    assert.deepEqual(rec.saved, [])
  }
})

test("PUT heat-styling after submit is 409 and writes nothing", async () => {
  const rec = recorder()
  const result = await putHeat(
    baseDeps(rec, { getOrCreateIntake: async () => submittedIntake }),
    answers,
  )
  assert.equal(result.status, 409)
  assert.equal(result.body.code, "already_submitted")
  assert.deepEqual(rec.saved, [])
})

test("PUT heat-styling racing the submit: the compare-and-set lost → 409", async () => {
  const result = await putHeat(baseDeps(recorder(), { saveHeatStyling: async () => null }), answers)
  assert.equal(result.status, 409)
  assert.equal(result.body.code, "already_submitted")
})

test("PUT heat-styling runs the same guard as every intake endpoint, and a failing write is 503", async () => {
  const cases: Array<[Deps, number]> = [
    [{ flagEnabled: () => false }, 404],
    [{ getUserId: async () => null }, 401],
    [{ loadEnrollment: async () => null }, 404],
    [{ getOrCreateIntake: async () => ({ ...draftIntake, userId: ids.otherUser }) }, 403],
    [
      {
        saveHeatStyling: async () => {
          throw new Error("db down")
        },
      },
      503,
    ],
  ]
  for (const [overrides, status] of cases) {
    const rec = recorder()
    const result = await putHeat(baseDeps(rec, overrides), answers)
    assert.equal(result.status, status)
    assert.deepEqual(rec.saved, [])
  }
})

test("PUT heat-styling refuses a foreign or missing Origin before the guard (same-origin)", async () => {
  let guardCalls = 0
  const deps = baseDeps(recorder(), {
    flagEnabled: () => {
      guardCalls += 1
      return true
    },
  })
  for (const origin of ["https://evil.example", ""]) {
    const result = await putHeat(deps, answers, origin)
    assert.equal(result.status, 403)
    assert.equal(result.body.code, "cross_origin")
  }
  assert.equal(guardCalls, 0)
})

// --- Projections -----------------------------------------------------------------------

test("row projection keeps the styling marker and the frequency; the view carries them only when set", () => {
  const base = {
    id: ids.item,
    intake_id: ids.intake,
    category: null,
    source: "name_research",
    brand_text: "Taft",
    product_name_text: "Haarspray",
    barcode_identifier: null,
    product_id: null,
    product_submission_id: null,
    usage_role: null,
    created_at: "2026-09-25T10:00:00.000Z",
  }
  const styling = projectDiscoveryIntakeItemRow({
    ...base,
    product_type: "styling",
    frequency: "daily_1x",
  })
  assert.equal(styling.productType, "styling")
  assert.equal(styling.frequency, "daily_1x")
  const view = toDiscoveryIntakeItemView(styling)
  assert.equal(view.productType, "styling")
  assert.equal(view.frequency, "daily_1x")

  const legacy = projectDiscoveryIntakeItemRow({ ...base, product_type: null, frequency: null })
  assert.equal(legacy.frequency, null)
  assert.equal("frequency" in toDiscoveryIntakeItemView(legacy), false)
  // A value the vocabulary does not know is no frequency.
  assert.equal(projectDiscoveryIntakeItemRow({ ...base, frequency: "often" }).frequency, null)
})

test("a stored heat answer that no longer validates reads as not asked", () => {
  assert.deepEqual(projectDiscoveryHeatStyling(answers), answers)
  assert.equal(projectDiscoveryHeatStyling(null), null)
  assert.equal(projectDiscoveryHeatStyling({ dryingRoutes: ["sun"] }), null)
})

// --- Spray answers are correctable (Codex review 7b, P2) -------------------------------------

const heatSprayItem: DiscoveryIntakeItem = {
  ...openItem,
  source: "dm_search",
  brandText: "Taft",
  productNameText: "Taft Haarspray Ultra Strong",
  barcodeIdentifier: "4015100000001",
  category: "heat_protectant",
  productType: "heat_protectant",
  productSubmissionId: ids.submission,
}
const stylingSprayItem: DiscoveryIntakeItem = {
  ...heatSprayItem,
  category: null,
  productType: "styling",
  productSubmissionId: null,
}

function sprayPatchDeps(rec: Recorder, item: DiscoveryIntakeItem, expected: unknown[]) {
  return patchDeps(rec, item, {
    updateItem: async (input: {
      update: DiscoveryIntakeItemUsageUpdate
      expectedProductType?: unknown
    }) => {
      rec.updates.push(input.update)
      expected.push(input.expectedProductType)
      return {
        ...item,
        ...("category" in input.update ? { category: input.update.category ?? null } : {}),
        ...(input.update.product_type ? { productType: input.update.product_type } : {}),
      }
    },
  })
}

test("spray: a saved styling spray is corrected to heat protectant — usage set, research opened", async () => {
  const rec = recorder()
  const expected: unknown[] = []
  const result = await patch(sprayPatchDeps(rec, stylingSprayItem, expected), {
    productType: "heat_protectant",
    usage: { category: "heat_protectant", role: null },
    frequency: "weekly_2x",
  })
  assert.equal(result.status, 200)
  assert.equal(rec.research.length, 1, "leaving styling opens research like „Was ist das?“")
  assert.deepEqual(rec.updates, [
    {
      category: "heat_protectant",
      usage_role: null,
      frequency: "weekly_2x",
      product_type: "heat_protectant",
      product_id: null,
      product_submission_id: ids.submission,
    },
  ])
  assert.deepEqual(expected, ["styling"], "compare-and-set on the type she corrected")
})

test("spray: a saved heat-protectant spray goes back to styling — no usage, research link dropped", async () => {
  const rec = recorder()
  const expected: unknown[] = []
  const result = await patch(sprayPatchDeps(rec, heatSprayItem, expected), {
    productType: "styling",
    frequency: "daily_1x",
  })
  assert.equal(result.status, 200)
  assert.deepEqual(rec.research, [])
  assert.deepEqual(rec.updates, [
    {
      category: null,
      usage_role: null,
      frequency: "daily_1x",
      product_type: "styling",
      product_submission_id: null,
    },
  ])
  assert.deepEqual(expected, ["heat_protectant"])
})

test("spray: the same answer again changes only usage + frequency (no new research)", async () => {
  const rec = recorder()
  const expected: unknown[] = []
  const result = await patch(sprayPatchDeps(rec, heatSprayItem, expected), {
    productType: "heat_protectant",
    usage: { category: "heat_protectant", role: null },
    frequency: "weekly_1x",
  })
  assert.equal(result.status, 200)
  assert.deepEqual(rec.research, [])
  assert.deepEqual(rec.updates, [
    { category: "heat_protectant", usage_role: null, frequency: "weekly_1x" },
  ])
})

test("spray: type changes outside the spray answers — and on non-spray products — stay locked", async () => {
  const cases: Array<[DiscoveryIntakeItem, unknown]> = [
    // A conditioner (not a spray) never changes its type.
    [typedItem, { productType: "leave_in", usage: { category: "leave_in", role: null } }],
    [typedItem, { productType: "styling" }],
    // A spray answer only moves among the spray answers.
    [heatSprayItem, { productType: "conditioner", usage: { category: "conditioner", role: null } }],
  ]
  for (const [item, body] of cases) {
    const rec = recorder()
    const result = await patch(patchDeps(rec, item), body)
    assert.equal(result.status, 409, JSON.stringify(body))
    assert.equal(result.body.code, "product_type_locked")
    assert.deepEqual(rec.updates, [])
    assert.deepEqual(rec.research, [])
  }
  // A spray answer that is not styling needs its own usage.
  const rec = recorder()
  const mismatch = await patch(patchDeps(rec, stylingSprayItem), {
    productType: "leave_in",
    usage: { category: "heat_protectant", role: null },
  })
  assert.equal(mismatch.status, 400)
  assert.equal(mismatch.body.code, "invalid_usage")
})

test("spray: a corrected spray answer is frozen after submit like every write", async () => {
  const rec = recorder()
  const result = await patch(
    patchDeps(rec, stylingSprayItem, { getOrCreateIntake: async () => submittedIntake }),
    { productType: "heat_protectant", usage: { category: "heat_protectant", role: null } },
  )
  assert.equal(result.status, 409)
  assert.equal(result.body.code, "already_submitted")
  assert.deepEqual(rec.updates, [])
})
