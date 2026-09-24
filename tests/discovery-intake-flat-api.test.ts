import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { createDiscoveryIntakeItemsHandler } from "../src/app/api/beratung/intake/items/route"
import { createDiscoveryIntakeItemPatchHandler } from "../src/app/api/beratung/intake/items/[itemId]/route"
import { createDiscoveryIntakeSubmitHandler } from "../src/app/api/beratung/intake/submit/route"
import { loadDiscoveryCockpitItems } from "../src/lib/discovery/cockpit"
import type { DiscoveryEnrollment } from "../src/lib/discovery/enrollment"
import {
  loadDiscoveryCatalogProductType,
  projectDiscoveryIntakeItemRow,
  submitDiscoveryIntakeConfirmingNone,
  toDiscoveryIntakeItemView,
  type DiscoveryAdminClient,
  type DiscoveryIntake,
  type DiscoveryIntakeItem,
  type DiscoveryIntakeItemInsert,
  type DiscoveryIntakeItemUsageUpdate,
} from "../src/lib/discovery/intake"
import type { DiscoveryResearchSubmissionInput } from "../src/lib/discovery/research-status"

/**
 * Batch 5, task 3 (plan Rev. 3): the flat checklist's participant API — capture with product
 * type + usage (F1, P2-6), the usage PATCH, and „Stimmt so – abschicken" as one call. The
 * legacy tile shapes keep their own suite (`discovery-intake-api.test.ts`), which must stay
 * green unchanged; the guard ordering is re-proven here for the two new entry points.
 */

const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  intake: "40000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
  otherUser: "20000000-0000-4000-8000-000000000003",
  product: "20000000-0000-4000-8000-000000000009",
  researchMatch: "20000000-0000-4000-8000-00000000000a",
  item: "50000000-0000-4000-8000-000000000005",
  submission: "60000000-0000-4000-8000-000000000006",
}

// A valid EAN-13 (GS1 check digit).
const EAN = "4006381333931"

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
}

const submittedIntake: DiscoveryIntake = {
  ...draftIntake,
  state: "submitted",
  submittedAt: "2026-09-24T12:00:00.000Z",
}

type Deps = Record<string, unknown>

type Recorder = {
  inserted: DiscoveryIntakeItemInsert[]
  research: DiscoveryResearchSubmissionInput[]
  researchUsers: string[]
  cleared: unknown[]
  catalogReads: string[]
  updates: Array<{ itemId: string; update: DiscoveryIntakeItemUsageUpdate }>
}

function recorder(): Recorder {
  return {
    inserted: [],
    research: [],
    researchUsers: [],
    cleared: [],
    catalogReads: [],
    updates: [],
  }
}

/** Echoes the insert back as a stored item, the way `insertDiscoveryIntakeItem` projects it. */
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
    loadCatalogProductType: async (_client: unknown, productId: string) => {
      rec.catalogReads.push(productId)
      return productId === ids.researchMatch ? "leave_in" : "oil"
    },
    createResearchSubmission: async (
      _client: unknown,
      input: { userId: string; submission: DiscoveryResearchSubmissionInput },
    ) => {
      rec.research.push(input.submission)
      rec.researchUsers.push(input.userId)
      return { kind: "pending_submission", submissionId: ids.submission }
    },
    insertItem: async (row: DiscoveryIntakeItemInsert) => {
      rec.inserted.push(row)
      return storedFrom(row)
    },
    clearCategory: async (input: unknown) => {
      rec.cleared.push(input)
    },
    ...overrides,
  }
}

function jsonRequest(method: string, body: unknown, path = "/api/beratung/intake/items") {
  return new NextRequest(`https://chaarlie.de${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function addProduct(deps: Deps, body: unknown) {
  const response = await createDiscoveryIntakeItemsHandler(deps)(jsonRequest("POST", body))
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

// --- POST: the flat checklist capture ---------------------------------------------

const catalogBody = {
  capture: {
    source: "catalog_search",
    productId: ids.product,
    brandText: "Kérastase",
    productNameText: "Elixir Ultime Kopfhaut-Öl",
  },
  // The client guessed; the catalog decides (P2-6).
  productType: "mask",
  usage: { category: "scalp_care", role: "scalp_flake_oil_adjunct" },
}

test("catalog capture: the type comes from the catalog, the usage (with role) from her answer", async () => {
  const rec = recorder()
  const result = await addProduct(baseDeps(rec), catalogBody)
  assert.equal(result.status, 201)
  assert.deepEqual(rec.catalogReads, [ids.product])
  assert.equal(rec.research.length, 0, "a catalog product needs no research")
  assert.deepEqual(rec.inserted, [
    {
      intake_id: ids.intake,
      category: "scalp_care",
      usage_role: "scalp_flake_oil_adjunct",
      product_type: "oil",
      source: "catalog_search",
      brand_text: "Kérastase",
      product_name_text: "Elixir Ultime Kopfhaut-Öl",
      barcode_identifier: null,
      product_id: ids.product,
      product_submission_id: null,
    },
  ])
  assert.deepEqual(result.body, {
    item: {
      id: ids.item,
      category: "scalp_care",
      source: "catalog_search",
      brandText: "Kérastase",
      productNameText: "Elixir Ultime Kopfhaut-Öl",
      barcodeIdentifier: null,
      imageUrl: null,
      productLine: null,
      productType: "oil",
      usageRole: "scalp_flake_oil_adjunct",
    },
  })
  // A standing legacy „benutze ich nicht" in her usage category is displaced, after the insert.
  assert.deepEqual(rec.cleared, [
    { intakeId: ids.intake, category: "scalp_care", sources: ["none"], exceptItemId: ids.item },
  ])
})

test("catalog capture of a product that is not scan-eligible is a 422 and writes nothing", async () => {
  const rec = recorder()
  const result = await addProduct(
    baseDeps(rec, { checkIdentity: async () => ({ ok: false, reason: "unknown_product" }) }),
    catalogBody,
  )
  assert.equal(result.status, 422)
  assert.equal(result.body.code, "unknown_product")
  assert.deepEqual([rec.inserted, rec.catalogReads, rec.research], [[], [], []])
})

test("typed product: research opens from the PRODUCT TYPE, as her, on the add that carries the usage (F1)", async () => {
  const rec = recorder()
  const result = await addProduct(baseDeps(rec), {
    capture: { source: "name_research", brandText: "Balea", productNameText: "Repair Spülung" },
    productType: "conditioner",
    // She uses her conditioner as a mask.
    usage: { category: "mask", role: null },
  })
  assert.equal(result.status, 201)
  assert.deepEqual(rec.research, [
    {
      category: "conditioner",
      identifier: null,
      brandText: "Balea",
      productNameText: "Repair Spülung",
    },
  ])
  assert.deepEqual(rec.researchUsers, [ids.user])
  assert.equal(rec.inserted[0].category, "mask")
  assert.equal(rec.inserted[0].product_type, "conditioner")
  assert.equal(rec.inserted[0].product_submission_id, ids.submission)
  assert.equal(rec.inserted[0].product_id, null)
})

test("dm capture researches on the EAN lane, with the dm name as prefill", async () => {
  const rec = recorder()
  const result = await addProduct(baseDeps(rec), {
    capture: {
      source: "dm_search",
      barcodeIdentifier: EAN,
      brandText: "Guhl",
      productNameText: "Glanzöl",
    },
    productType: "oil",
    usage: { category: "oil", role: "dry_finish" },
  })
  assert.equal(result.status, 201)
  assert.deepEqual(rec.research, [
    { category: "oil", identifier: EAN, brandText: "Guhl", productNameText: "Glanzöl" },
  ])
  assert.equal(rec.inserted[0].usage_role, "dry_finish")
  assert.equal(rec.inserted[0].barcode_identifier, EAN)
})

test("research that finds the product in the catalog stores the product — and the catalog's type", async () => {
  const rec = recorder()
  const result = await addProduct(
    baseDeps(rec, {
      createResearchSubmission: async () => ({
        kind: "already_in_catalog",
        productId: ids.researchMatch,
      }),
    }),
    {
      capture: { source: "name_research", brandText: "Balea", productNameText: "Haarkur" },
      productType: "mask",
      usage: { category: "mask", role: null },
    },
  )
  assert.equal(result.status, 201)
  assert.deepEqual(rec.catalogReads, [ids.researchMatch])
  assert.equal(rec.inserted[0].product_id, ids.researchMatch)
  assert.equal(rec.inserted[0].product_submission_id, null)
  assert.equal(rec.inserted[0].product_type, "leave_in")
  // Her usage is hers: the catalog's type does not move it.
  assert.equal(rec.inserted[0].category, "mask")
})

test("a research submission that fails to open leaves the item stored without one", async () => {
  const rec = recorder()
  const result = await addProduct(
    baseDeps(rec, {
      createResearchSubmission: async () => {
        throw new Error("scan lane down")
      },
    }),
    {
      capture: { source: "name_research", brandText: "Balea", productNameText: "Shampoo" },
      productType: "shampoo",
      usage: { category: "shampoo", role: null },
    },
  )
  assert.equal(result.status, 201)
  assert.equal(rec.inserted.length, 1)
  assert.equal(rec.inserted[0].product_submission_id, null)
  assert.equal(rec.inserted[0].product_type, "shampoo")
})

test("„Weiß ich nicht“: stored with no type, no usage and NO research submission (F1)", async () => {
  const rec = recorder()
  const result = await addProduct(baseDeps(rec), {
    capture: { source: "name_research", brandText: "Olaplex", productNameText: "No. 0" },
    productType: null,
    usage: null,
  })
  assert.equal(result.status, 201)
  assert.deepEqual(rec.research, [])
  assert.deepEqual(rec.cleared, [])
  assert.equal(rec.inserted[0].category, null)
  assert.equal(rec.inserted[0].product_type, null)
  assert.equal(rec.inserted[0].usage_role, null)
  assert.equal(rec.inserted[0].product_submission_id, null)
  const item = result.body.item as Record<string, unknown>
  assert.equal(item.category, null)
  assert.ok(!("productType" in item) && !("usageRole" in item))
})

test("an unknown barcode without a name and „Weiß ich nicht“ keeps the barcode as its identity", async () => {
  const rec = recorder()
  const result = await addProduct(baseDeps(rec), {
    capture: { source: "barcode_unknown", barcodeIdentifier: EAN },
    usage: null,
  })
  assert.equal(result.status, 201)
  assert.deepEqual(rec.research, [])
  assert.equal(rec.inserted[0].barcode_identifier, EAN)
})

test("a typed product with too little to research is stored without asking the scan lane", async () => {
  const rec = recorder()
  // 8 digits pass the column CHECK but not the EAN check digit, and there is no name.
  const result = await addProduct(baseDeps(rec), {
    capture: { source: "barcode_unknown", barcodeIdentifier: "12345678" },
    productType: "mask",
    usage: { category: "mask", role: null },
  })
  assert.equal(result.status, 201)
  assert.deepEqual(rec.research, [])
  assert.equal(rec.inserted[0].product_type, "mask")
})

test("a usage without a product type is refused before anything is written", async () => {
  const rec = recorder()
  const result = await addProduct(baseDeps(rec), {
    capture: { source: "name_research", brandText: "Olaplex", productNameText: "No. 0" },
    productType: null,
    usage: { category: "mask", role: null },
  })
  assert.equal(result.status, 400)
  assert.equal(result.body.code, "product_type_required")
  assert.deepEqual([rec.inserted, rec.research], [[], []])
})

test("an invalid usage pair is a 400 invalid_usage (the DB CHECK, restated)", async () => {
  for (const usage of [
    { category: "oil", role: "scalp_flake_oil_adjunct" },
    { category: "mask", role: "dry_finish" },
    { category: "scalp_care", role: "leave_on_fibre_conditioning" },
  ]) {
    const rec = recorder()
    const result = await addProduct(baseDeps(rec), { ...catalogBody, usage })
    assert.equal(result.status, 400, JSON.stringify(usage))
    assert.equal(result.body.code, "invalid_usage")
    assert.equal(rec.inserted.length, 0)
  }
})

test("the flat shape never accepts a client-supplied submission id or an unknown key", async () => {
  for (const body of [
    {
      capture: {
        source: "name_research",
        brandText: "Balea",
        productNameText: "Shampoo",
        productSubmissionId: ids.submission,
      },
      productType: "shampoo",
      usage: null,
    },
    { capture: { source: "none" }, usage: null },
    { ...catalogBody, usage: { category: "oil", role: "scalp_comfort" } },
    { ...catalogBody, extra: true },
    { capture: catalogBody.capture },
  ]) {
    const rec = recorder()
    const result = await addProduct(baseDeps(rec), body)
    assert.equal(result.status, 400, JSON.stringify(body))
    assert.equal(result.body.code, "invalid_body")
    assert.equal(rec.inserted.length, 0)
  }
})

test("the flat shape is frozen after submit like every write", async () => {
  const rec = recorder()
  const result = await addProduct(
    baseDeps(rec, { getOrCreateIntake: async () => submittedIntake }),
    catalogBody,
  )
  assert.equal(result.status, 409)
  assert.equal(result.body.code, "already_submitted")
  assert.equal(rec.inserted.length, 0)
})

test("a failing insert is a 503", async () => {
  const rec = recorder()
  const result = await addProduct(
    baseDeps(rec, {
      insertItem: async () => {
        throw new Error("db down")
      },
    }),
    catalogBody,
  )
  assert.equal(result.status, 503)
})

test("the legacy tile shape still writes exactly the row it wrote before", async () => {
  const rec = recorder()
  const result = await addProduct(baseDeps(rec), {
    category: "shampoo",
    capture: {
      source: "catalog_search",
      productId: ids.product,
      brandText: "Elvital",
      productNameText: "Hyaluron Pure",
    },
  })
  assert.equal(result.status, 201)
  assert.deepEqual(rec.inserted, [
    {
      intake_id: ids.intake,
      category: "shampoo",
      source: "catalog_search",
      brand_text: "Elvital",
      product_name_text: "Hyaluron Pure",
      barcode_identifier: null,
      product_id: ids.product,
      product_submission_id: null,
    },
  ])
  assert.deepEqual(rec.catalogReads, [])
})

// --- PATCH: her usage -------------------------------------------------------------

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
  catalog: null,
}

const openItem: DiscoveryIntakeItem = {
  ...typedItem,
  category: null,
  brandText: "Olaplex",
  productNameText: "No. 0",
  productSubmissionId: null,
  productType: null,
}

function patchDeps(rec: Recorder, item: DiscoveryIntakeItem | null, overrides: Deps = {}) {
  return baseDeps(rec, {
    loadItem: async (input: { intakeId: string; itemId: string }) =>
      input.intakeId === ids.intake && input.itemId === ids.item ? item : null,
    updateItem: async (input: {
      intakeId: string
      itemId: string
      update: DiscoveryIntakeItemUsageUpdate
    }) => {
      rec.updates.push({ itemId: input.itemId, update: input.update })
      if (!item) return null
      return {
        ...item,
        category: input.update.category,
        usageRole: input.update.usage_role,
        productType: input.update.product_type ?? item.productType,
        productId: input.update.product_id ?? item.productId,
        productSubmissionId: input.update.product_submission_id ?? item.productSubmissionId,
      }
    },
    ...overrides,
  })
}

async function patchUsage(deps: Deps, body: unknown, itemId = ids.item) {
  const response = await createDiscoveryIntakeItemPatchHandler(deps)(
    jsonRequest("PATCH", body, `/api/beratung/intake/items/${itemId}`),
    { params: Promise.resolve({ itemId }) },
  )
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

test("PATCH changes only her usage — the product type and its research stay (identity ≠ usage)", async () => {
  const rec = recorder()
  const result = await patchUsage(patchDeps(rec, typedItem), {
    usage: { category: "mask", role: null },
  })
  assert.equal(result.status, 200)
  assert.deepEqual(rec.updates, [
    { itemId: ids.item, update: { category: "mask", usage_role: null } },
  ])
  assert.deepEqual(rec.research, [])
  const item = result.body.item as Record<string, unknown>
  assert.equal(item.category, "mask")
  assert.equal(item.productType, "conditioner")
  assert.deepEqual(rec.cleared, [
    { intakeId: ids.intake, category: "mask", sources: ["none"], exceptItemId: ids.item },
  ])
})

test("PATCH may set the usage to unknown; the research submission is untouched", async () => {
  const rec = recorder()
  const result = await patchUsage(patchDeps(rec, typedItem), { usage: null })
  assert.equal(result.status, 200)
  assert.deepEqual(rec.updates[0].update, { category: null, usage_role: null })
  assert.deepEqual(rec.cleared, [])
  assert.deepEqual(rec.research, [])
})

test("PATCH writes an oil role with the usage", async () => {
  const rec = recorder()
  const result = await patchUsage(patchDeps(rec, { ...typedItem, productType: "oil" }), {
    usage: { category: "oil", role: "pre_wash_fibre_treatment" },
  })
  assert.equal(result.status, 200)
  assert.deepEqual(rec.updates[0].update, {
    category: "oil",
    usage_role: "pre_wash_fibre_treatment",
  })
})

test("PATCH answering „Was ist das?“ on a type-open item opens its research from the type", async () => {
  const rec = recorder()
  const result = await patchUsage(patchDeps(rec, openItem), {
    productType: "oil",
    usage: { category: "scalp_care", role: "scalp_flake_oil_adjunct" },
  })
  assert.equal(result.status, 200)
  assert.deepEqual(rec.research, [
    { category: "oil", identifier: null, brandText: "Olaplex", productNameText: "No. 0" },
  ])
  assert.deepEqual(rec.updates[0].update, {
    category: "scalp_care",
    usage_role: "scalp_flake_oil_adjunct",
    product_type: "oil",
    product_submission_id: ids.submission,
  })
  const item = result.body.item as Record<string, unknown>
  assert.equal(item.productType, "oil")
})

test("PATCH may type an open item without a usage yet", async () => {
  const rec = recorder()
  const result = await patchUsage(patchDeps(rec, openItem), { productType: "mask", usage: null })
  assert.equal(result.status, 200)
  assert.equal(rec.research.length, 1)
  assert.equal(rec.updates[0].update.product_type, "mask")
  assert.equal(rec.updates[0].update.category, null)
})

test("PATCH refuses a type change on an item whose type is known (409 product_type_locked)", async () => {
  for (const item of [typedItem, { ...openItem, productId: ids.product }]) {
    const rec = recorder()
    const result = await patchUsage(patchDeps(rec, item), {
      productType: "mask",
      usage: { category: "mask", role: null },
    })
    assert.equal(result.status, 409)
    assert.equal(result.body.code, "product_type_locked")
    assert.deepEqual([rec.updates, rec.research], [[], []])
  }
})

test("PATCH refuses a usage on a type-open item without a type (400 product_type_required)", async () => {
  const rec = recorder()
  const result = await patchUsage(patchDeps(rec, openItem), {
    usage: { category: "mask", role: null },
  })
  assert.equal(result.status, 400)
  assert.equal(result.body.code, "product_type_required")
  assert.equal(rec.updates.length, 0)
  // Keeping it unknown is fine.
  const keep = await patchUsage(patchDeps(recorder(), openItem), { usage: null })
  assert.equal(keep.status, 200)
})

test("PATCH is scoped: a foreign, missing or „none“ row is 404 and nothing is written", async () => {
  const rec = recorder()
  const foreign = await patchUsage(patchDeps(rec, typedItem), { usage: null }, ids.submission)
  assert.equal(foreign.status, 404)
  const noneRow = await patchUsage(
    patchDeps(rec, { ...typedItem, source: "none", productSubmissionId: null }),
    { usage: null },
  )
  assert.equal(noneRow.status, 404)
  assert.equal(noneRow.body.code, "not_found")
  assert.equal(rec.updates.length, 0)
})

test("PATCH answers 404 when the conditional update matched nothing (a concurrent write won)", async () => {
  const rec = recorder()
  const result = await patchUsage(patchDeps(rec, openItem, { updateItem: async () => null }), {
    productType: "mask",
    usage: null,
  })
  assert.equal(result.status, 404)
})

test("PATCH validates the body and the usage pair", async () => {
  for (const [body, code] of [
    [{}, "invalid_body"],
    [{ usage: { category: "styling_gel", role: null } }, "invalid_body"],
    [{ usage: null, category: "mask" }, "invalid_body"],
    [{ usage: { category: "mask", role: "dry_finish" } }, "invalid_usage"],
  ] as const) {
    const rec = recorder()
    const result = await patchUsage(patchDeps(rec, typedItem), body)
    assert.equal(result.status, 400, JSON.stringify(body))
    assert.equal(result.body.code, code)
    assert.equal(rec.updates.length, 0)
  }
})

test("PATCH is draft-only", async () => {
  const rec = recorder()
  const result = await patchUsage(
    patchDeps(rec, typedItem, { getOrCreateIntake: async () => submittedIntake }),
    { usage: null },
  )
  assert.equal(result.status, 409)
  assert.equal(result.body.code, "already_submitted")
  assert.equal(rec.updates.length, 0)
})

test("PATCH runs the same guard as every intake endpoint", async () => {
  const cases: Array<[Deps, number]> = [
    [{ flagEnabled: () => false }, 404],
    [{ getUserId: async () => null }, 401],
    [{ loadEnrollment: async () => null }, 404],
    [{ getOrCreateIntake: async () => ({ ...draftIntake, userId: ids.otherUser }) }, 403],
  ]
  for (const [overrides, status] of cases) {
    const rec = recorder()
    const result = await patchUsage(patchDeps(rec, typedItem, overrides), { usage: null })
    assert.equal(result.status, status)
    assert.equal(rec.updates.length, 0)
  }
})

test("PATCH failing to write is a 503", async () => {
  const result = await patchUsage(
    patchDeps(recorder(), typedItem, {
      updateItem: async () => {
        throw new Error("db down")
      },
    }),
    { usage: null },
  )
  assert.equal(result.status, 503)
})

// --- Submit with confirmation ------------------------------------------------------

function submitRequest(body?: unknown) {
  return new Request("https://chaarlie.de/api/beratung/intake/submit", {
    method: "POST",
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  })
}

function submitDeps(overrides: Deps = {}) {
  const calls: string[] = []
  const deps = baseDeps(recorder(), {
    submitConfirmingNone: async (intakeId: string) => {
      calls.push(`rpc:${intakeId}`)
      return {
        outcome: "submitted",
        submittedAt: "2026-09-24T12:00:00.000Z",
        confirmedNone: ["dry_shampoo", "bondbuilder"],
      }
    },
    loadItems: async () => {
      calls.push("legacy-load")
      return [{ ...typedItem }]
    },
    clearCoexistingNone: async () => {
      calls.push("legacy-heal")
      return []
    },
    submitIntake: async () => {
      calls.push("legacy-submit")
      return submittedIntake
    },
    ...overrides,
  })
  return { deps, calls }
}

async function postSubmit(deps: Deps, body?: unknown) {
  const response = await createDiscoveryIntakeSubmitHandler(deps)(submitRequest(body))
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

test("„Stimmt so – abschicken“ is ONE server call that confirms the empty categories and freezes", async () => {
  const { deps, calls } = submitDeps()
  const result = await postSubmit(deps, { confirmNoneForMissing: true })
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, {
    state: "submitted",
    submittedAt: "2026-09-24T12:00:00.000Z",
    confirmedNone: ["dry_shampoo", "bondbuilder"],
  })
  // Nothing of the legacy path runs: the RPC is the whole submit.
  assert.deepEqual(calls, [`rpc:${ids.intake}`])
})

test("submit with confirmation maps the RPC's refusals", async () => {
  const outcomes: Array<[string, number, string]> = [
    ["no_products", 400, "no_products"],
    ["not_draft", 409, "already_submitted"],
    ["not_found", 503, "unavailable"],
  ]
  for (const [outcome, status, code] of outcomes) {
    const { deps } = submitDeps({ submitConfirmingNone: async () => ({ outcome }) })
    const result = await postSubmit(deps, { confirmNoneForMissing: true })
    assert.equal(result.status, status, outcome)
    assert.equal(result.body.code, code)
  }
  const { deps } = submitDeps({
    submitConfirmingNone: async () => {
      throw new Error("rpc down")
    },
  })
  assert.equal((await postSubmit(deps, { confirmNoneForMissing: true })).status, 503)
})

test("any body other than the confirmation is a 400, and reaches nothing", async () => {
  for (const body of [{ confirmNoneForMissing: false }, { confirm: true }, {}]) {
    const { deps, calls } = submitDeps()
    const result = await postSubmit(deps, body)
    assert.equal(result.status, 400, JSON.stringify(body))
    assert.equal(result.body.code, "invalid_body")
    assert.deepEqual(calls, [])
  }
})

test("a submitted intake answers 409 before the RPC", async () => {
  const { deps, calls } = submitDeps({ getOrCreateIntake: async () => submittedIntake })
  const result = await postSubmit(deps, { confirmNoneForMissing: true })
  assert.equal(result.status, 409)
  assert.deepEqual(calls, [])
})

test("no body keeps the legacy submit (the tile checklist until task 4 replaces it)", async () => {
  const { deps, calls } = submitDeps()
  const result = await postSubmit(deps)
  assert.equal(result.status, 200)
  assert.deepEqual(calls, ["legacy-load", "legacy-heal", "legacy-submit"])
})

// --- Data-layer wrappers ------------------------------------------------------------

test("the submit RPC wrapper passes the intake id and maps every outcome", async () => {
  const calls: unknown[] = []
  const client = (data: unknown, error: unknown = null) =>
    ({
      rpc: async (name: string, args: unknown) => {
        calls.push([name, args])
        return { data, error }
      },
    }) as unknown as DiscoveryAdminClient

  assert.deepEqual(
    await submitDiscoveryIntakeConfirmingNone(
      ids.intake,
      client({
        outcome: "submitted",
        submitted_at: "2026-09-24T12:00:00+00:00",
        confirmed_none: ["oil", "styling_gel"],
      }),
    ),
    {
      outcome: "submitted",
      submittedAt: "2026-09-24T12:00:00+00:00",
      confirmedNone: ["oil"],
    },
  )
  assert.deepEqual(calls[0], [
    "discovery_intake_submit_confirming_none",
    { target_intake_id: ids.intake },
  ])
  for (const outcome of ["not_draft", "no_products", "not_found"]) {
    assert.deepEqual(await submitDiscoveryIntakeConfirmingNone(ids.intake, client({ outcome })), {
      outcome,
    })
  }
  await assert.rejects(submitDiscoveryIntakeConfirmingNone(ids.intake, client({ outcome: "?" })))
  await assert.rejects(
    submitDiscoveryIntakeConfirmingNone(ids.intake, client(null, new Error("denied"))),
  )
})

function productsClient(categoryKey: string | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: categoryKey === null ? null : { category_key: categoryKey },
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as DiscoveryAdminClient
}

test("the catalog type read answers a supported category, else null", async () => {
  assert.equal(await loadDiscoveryCatalogProductType(productsClient("mask"), ids.product), "mask")
  assert.equal(await loadDiscoveryCatalogProductType(productsClient("serum"), ids.product), null)
  assert.equal(await loadDiscoveryCatalogProductType(productsClient(null), ids.product), null)
})

test("rows project usage, role and type; the browser view carries type/role only when set", () => {
  const base = {
    id: ids.item,
    intake_id: ids.intake,
    source: "name_research",
    brand_text: "Olaplex",
    product_name_text: "No. 0",
    barcode_identifier: null,
    product_id: null,
    product_submission_id: null,
    created_at: "2026-09-24T10:00:00.000Z",
  }
  const unknown = projectDiscoveryIntakeItemRow({
    ...base,
    category: null,
    product_type: null,
    usage_role: null,
  })
  assert.equal(unknown.category, null)
  assert.equal(unknown.productType, null)
  assert.equal(unknown.usageRole, null)
  assert.deepEqual(Object.keys(toDiscoveryIntakeItemView(unknown)).sort(), [
    "barcodeIdentifier",
    "brandText",
    "category",
    "id",
    "imageUrl",
    "productLine",
    "productNameText",
    "source",
  ])

  const oil = projectDiscoveryIntakeItemRow({
    ...base,
    category: "oil",
    product_type: "oil",
    usage_role: "dry_finish",
  })
  const view = toDiscoveryIntakeItemView(oil)
  assert.equal(view.productType, "oil")
  assert.equal(view.usageRole, "dry_finish")
})

function cockpitItemsClient(rows: unknown[]) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
      resolve({ data: rows, error: null }),
  }
  return { from: () => chain } as unknown as Parameters<typeof loadDiscoveryCockpitItems>[1]
}

test("F4: the cockpit read model carries productType only when set, so legacy objects are unchanged", async () => {
  const row = {
    id: ids.item,
    category: "mask",
    source: "name_research",
    brand_text: "Balea",
    product_name_text: "Repair Spülung",
    barcode_identifier: null,
    product_id: null,
    product_submission_id: ids.submission,
    created_at: "2026-09-20T10:00:00.000Z",
  }
  const [legacy, typed] = await loadDiscoveryCockpitItems(
    ids.intake,
    cockpitItemsClient([
      { ...row, product_type: null },
      { ...row, product_type: "conditioner" },
    ]),
  )
  assert.ok(!("productType" in legacy), "a legacy row gets no new key")
  assert.deepEqual(Object.keys(legacy).sort(), [
    "barcodeIdentifier",
    "brandText",
    "category",
    "createdAt",
    "id",
    "productId",
    "productNameText",
    "productSubmissionId",
    "source",
  ])
  assert.equal(typed.productType, "conditioner")
})
