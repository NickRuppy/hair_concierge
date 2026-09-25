import assert from "node:assert/strict"
import test from "node:test"

import {
  answerFrequency,
  answerSpray,
  answerType,
  answerUsage,
  backStep,
  canGoBack,
  currentStep,
  draftCapsule,
  openAddEdit,
  openAddScan,
  openAddSearch,
  pickCapture,
  productSubject,
  startTyped,
  submitTypedName,
  type AddFlow,
  type AddStep,
} from "../src/components/discovery/intake/add-flow"
import type {
  DiscoveryIntakeItemView,
  DiscoveryIntakeProductCaptureInput,
} from "../src/components/discovery/intake/types"
import { DISCOVERY_FREQUENCY_SUGGESTION_HINT } from "../src/lib/discovery/frequency"

/**
 * The add sheet's step machine (batch 7, plan Rev. 3 §2.1 items 2–3): which step follows a
 * pick, a scan, a typed name or an edit; what is plum; and the ONE request the frequency
 * tap becomes.
 */

const CATALOG: DiscoveryIntakeProductCaptureInput = {
  source: "catalog_search",
  productId: "20000000-0000-4000-8000-000000000001",
  brandText: "Balea",
  productNameText: "Oil Repair Intensiv Spülung",
}

function view(overrides: Partial<DiscoveryIntakeItemView> = {}): DiscoveryIntakeItemView {
  return {
    id: "item-1",
    category: "conditioner",
    source: "catalog_search",
    brandText: "Balea",
    productNameText: "Spülung",
    barcodeIdentifier: null,
    productType: "conditioner",
    frequency: "weekly_2x",
    ...overrides,
  }
}

const SHAMPOO_3_4 = view({
  id: "shampoo-1",
  category: "shampoo",
  productType: "shampoo",
  productNameText: "Aqua Hyaluron Shampoo",
  frequency: "weekly_3_4x",
})

function step<K extends AddStep["kind"]>(flow: AddFlow, kind: K): Extract<AddStep, { kind: K }> {
  const top = currentStep(flow)
  assert.equal(top.kind, kind)
  return top as Extract<AddStep, { kind: K }>
}

function pick(name: string, category: string | null, items: DiscoveryIntakeItemView[] = []) {
  return pickCapture(
    openAddSearch(),
    { ...CATALOG, productNameText: name },
    productSubject({ brand: "Balea", name }),
    { catalogCategory: category, name },
    items,
  )
}

// --- Search pick ---------------------------------------------------------------------------

test("an ambiguous catalog conditioner asks its usage (detected in plum), then the frequency, then ONE add", () => {
  let flow = pick("Oil Repair Intensiv Spülung", "conditioner")
  const usage = step(flow, "usage")
  assert.equal(usage.question.kind, "care_use")
  assert.equal(usage.highlighted, "conditioner")
  assert.equal(draftCapsule(flow.draft!), "Conditioner")

  flow = answerUsage(flow, usage.question.options.find((option) => option.key === "mask")!, [])
  const frequency = step(flow, "frequency")
  assert.deepEqual(frequency, { kind: "frequency", current: null, suggestion: null })
  assert.equal(draftCapsule(flow.draft!), "Maske")

  assert.deepEqual(answerFrequency(flow, "weekly_1x"), {
    kind: "add",
    body: {
      capture: { ...CATALOG, productNameText: "Oil Repair Intensiv Spülung" },
      productType: "conditioner",
      usage: { category: "mask", role: null },
      frequency: "weekly_1x",
    },
  })
})

test("D1: the care question offers the pre-wash conditioner", () => {
  let flow = pick("Spülung", "conditioner")
  const usage = step(flow, "usage")
  const preWash = usage.question.options.find((option) => option.key === "conditioner_pre_wash")
  assert.ok(preWash)
  assert.equal(preWash.label, "Vor der Haarwäsche")
  flow = answerUsage(flow, preWash, [])
  assert.deepEqual(answerFrequency(flow, "weekly_1x")?.body, {
    capture: { ...CATALOG, productNameText: "Spülung" },
    productType: "conditioner",
    usage: { category: "conditioner", role: "pre_wash_conditioner" },
    frequency: "weekly_1x",
  })
})

test("a product without a usage question (heat protectant) goes straight to the frequency", () => {
  const flow = pick("Hitzeschutzspray Ultralight", "heat_protectant")
  step(flow, "frequency")
  assert.equal(draftCapsule(flow.draft!), "Hitzeschutz")
  assert.deepEqual(answerFrequency(flow, "unknown")?.body, {
    capture: { ...CATALOG, productNameText: "Hitzeschutzspray Ultralight" },
    productType: "heat_protectant",
    usage: { category: "heat_protectant", role: null },
    frequency: "unknown",
  })
})

test("conditioner and leave-in preselect the LATEST shampoo's frequency; nothing else does", () => {
  const older = view({ ...SHAMPOO_3_4, id: "shampoo-0", frequency: "daily_1x" })
  const items = [older, SHAMPOO_3_4]
  let flow = pick("Spülung", "conditioner", items)
  flow = answerUsage(flow, step(flow, "usage").question.options[0], items)
  assert.equal(step(flow, "frequency").suggestion, "weekly_3_4x")
  assert.equal(DISCOVERY_FREQUENCY_SUGGESTION_HINT, "Wie dein Shampoo")

  // Used as a mask: no suggestion — the preselect follows her USAGE, not the product type.
  let mask = pick("Spülung", "conditioner", items)
  mask = answerUsage(mask, step(mask, "usage").question.options[1], items)
  assert.equal(step(mask, "frequency").suggestion, null)

  const heat = pick("Hitzeschutz", "heat_protectant", items)
  assert.equal(step(heat, "frequency").suggestion, null)
})

// --- D2 spray ------------------------------------------------------------------------------

test("D2: a dm spray without a clear type gets „Wofür nutzt du das Spray?“; styling adds a non-evaluated item", () => {
  let flow = pickCapture(
    openAddSearch(),
    {
      source: "dm_search",
      barcodeIdentifier: "4015100000001",
      brandText: "Taft",
      productNameText: "Haarspray Ultra Strong",
    },
    productSubject({ brand: "Taft", name: "Haarspray Ultra Strong" }),
    { name: "Haarspray Ultra Strong" },
    [],
  )
  const spray = step(flow, "spray")
  assert.equal(spray.question.prompt, "Wofür nutzt du das Spray?")
  assert.equal(spray.highlighted, "spray_styling")
  flow = answerSpray(
    flow,
    spray.question.options.find((option) => option.key === "spray_styling")!,
    [],
  )
  assert.equal(draftCapsule(flow.draft!), "Styling")
  step(flow, "frequency")
  assert.deepEqual(answerFrequency(flow, "daily_1x")?.body, {
    capture: {
      source: "dm_search",
      barcodeIdentifier: "4015100000001",
      brandText: "Taft",
      productNameText: "Haarspray Ultra Strong",
    },
    productType: "styling",
    usage: null,
    frequency: "daily_1x",
  })
})

test("D2: the leave-in spray answer types the product AND sets its usage", () => {
  let flow = pickCapture(
    openAddSearch(),
    {
      source: "dm_search",
      barcodeIdentifier: "4015100000002",
      brandText: "Gliss",
      productNameText: "Express-Repair-Spray",
    },
    productSubject({ brand: "Gliss", name: "Express-Repair-Spray" }),
    { name: "Express-Repair-Spray" },
    [],
  )
  const spray = step(flow, "spray")
  flow = answerSpray(
    flow,
    spray.question.options.find((option) => option.key === "spray_leave_in")!,
    [],
  )
  const commit = answerFrequency(flow, "weekly_3_4x")
  assert.equal(commit?.kind, "add")
  assert.equal(commit?.body.productType, "leave_in")
  assert.deepEqual(commit?.body.usage, { category: "leave_in", role: null })
})

// --- Typed path ----------------------------------------------------------------------------

test("typed path: „Selbst eintragen“ → „Wie heißt es?“ → „Was ist das?“ → usage → frequency, in one sheet", () => {
  let flow = startTyped(openAddSearch())
  step(flow, "name")
  assert.equal(canGoBack(flow), true, "back returns to the search")

  flow = submitTypedName(
    flow,
    { brandText: "Meine Friseurin", productNameText: "Geheimtipp Nr. 5" },
    [],
  )
  assert.deepEqual(step(flow, "type"), { kind: "type", current: null })
  flow = answerType(flow, "oil", [])
  const usage = step(flow, "usage")
  assert.equal(usage.question.kind, "oil_use")
  flow = answerUsage(flow, usage.question.options[0], [])
  assert.deepEqual(answerFrequency(flow, "weekly_1x"), {
    kind: "add",
    body: {
      capture: {
        source: "name_research",
        brandText: "Meine Friseurin",
        productNameText: "Geheimtipp Nr. 5",
      },
      productType: "oil",
      usage: { category: "oil", role: "pre_wash_fibre_treatment" },
      frequency: "weekly_1x",
    },
  })
})

test("typed path from a ghost slot: the slot IS the type (no „Was ist das?“)", () => {
  let flow = startTyped(openAddSearch("heat_protectant"))
  flow = submitTypedName(flow, { brandText: "Salon", productNameText: "Geheimtipp" }, [])
  step(flow, "frequency")
  assert.equal(answerFrequency(flow, "weekly_2x")?.body.productType, "heat_protectant")

  let mask = startTyped(openAddSearch("mask"))
  mask = submitTypedName(mask, { brandText: "Salon", productNameText: "Geheimtipp" }, [])
  assert.equal(step(mask, "usage").highlighted, "mask")
})

test("typed path: „Weiß ich nicht“ still asks the frequency, then stores the product type-open", () => {
  let flow = startTyped(openAddSearch())
  flow = submitTypedName(flow, { brandText: "X", productNameText: "Y" }, [])
  flow = answerType(flow, null, [])
  step(flow, "frequency")
  assert.equal(draftCapsule(flow.draft!), null)
  assert.deepEqual(answerFrequency(flow, "monthly_1x")?.body, {
    capture: { source: "name_research", brandText: "X", productNameText: "Y" },
    productType: null,
    usage: null,
    frequency: "monthly_1x",
  })
})

// --- Barcode -------------------------------------------------------------------------------

test("barcode: the read lands at the pinned-header step, and back goes to the search (not the camera)", () => {
  const scan = openAddScan()
  step(scan, "scan")
  const flow = pickCapture(
    scan,
    {
      source: "barcode",
      productId: CATALOG.productId,
      barcodeIdentifier: "4066447107524",
      brandText: "Balea",
      productNameText: "Aqua Hyaluron Shampoo",
    },
    productSubject({ brand: "Balea", name: "Aqua Hyaluron Shampoo" }),
    { catalogCategory: "shampoo", name: "Aqua Hyaluron Shampoo" },
    [],
  )
  assert.deepEqual(
    flow.steps.map((entry) => entry.kind),
    ["search", "usage"],
  )
  const back = backStep(flow)
  step(back, "search")
  assert.equal(back.draft, null, "the search forgets the product")
  assert.equal(back.direction, -1)
})

test("an unknown barcode asks „Was ist das?“ under „Gescanntes Produkt“", () => {
  const flow = pickCapture(
    openAddScan(),
    { source: "barcode_unknown", barcodeIdentifier: "4005808858149" },
    productSubject({ barcode: "4005808858149" }),
    { name: null },
    [],
  )
  step(flow, "type")
  assert.deepEqual(flow.draft?.subject, {
    brandLine: "4005808858149",
    name: "Gescanntes Produkt",
    imageUrl: null,
  })
})

test("back from the frequency shows her usage answer in plum, not the first preselection", () => {
  let flow = pick("Spülung", "conditioner")
  const usage = step(flow, "usage")
  flow = answerUsage(flow, usage.question.options.find((option) => option.key === "leave_in")!, [])
  const back = backStep(flow)
  assert.equal(step(back, "usage").highlighted, "leave_in")
})

// --- Edit ----------------------------------------------------------------------------------

test("edit: a card tap opens its usage question with her answer in plum, then PATCHes usage + frequency", () => {
  let flow = openAddEdit(view({ category: "mask" }), [])!
  assert.equal(flow.mode, "edit")
  assert.equal(canGoBack(flow), false)
  assert.equal(step(flow, "usage").highlighted, "mask")
  flow = answerUsage(flow, step(flow, "usage").question.options[0], [])
  assert.equal(step(flow, "frequency").current, "weekly_2x")
  assert.deepEqual(answerFrequency(flow, "weekly_1x"), {
    kind: "patch",
    itemId: "item-1",
    body: { usage: { category: "conditioner", role: null }, frequency: "weekly_1x" },
  })
})

test("edit: a type-open product answers „Was ist das?“ — type, usage and frequency in one PATCH", () => {
  const typeOpen = view({
    source: "name_research",
    category: null,
    productType: undefined,
    productNameText: "Geheimtipp",
    frequency: "unknown",
  })
  let flow = openAddEdit(typeOpen, [])!
  assert.deepEqual(step(flow, "type"), { kind: "type", current: "unknown" })
  flow = answerType(flow, "shampoo", [])
  flow = answerUsage(flow, step(flow, "usage").question.options[0], [])
  assert.deepEqual(answerFrequency(flow, "weekly_3_4x")?.body, {
    productType: "shampoo",
    usage: { category: "shampoo", role: null },
    frequency: "weekly_3_4x",
  })
})

test("edit: a type-open spray re-asks the spray question", () => {
  const flow = openAddEdit(
    view({
      source: "dm_search",
      category: null,
      productType: undefined,
      productNameText: "Glanzspray",
    }),
    [],
  )!
  assert.equal(step(flow, "spray").highlighted, "spray_unknown")
})

test("„Wie oft?“ on a draft from the old checklist opens ONLY the frequency (with the shampoo hint) and PATCHes only it", () => {
  const legacy = view({ frequency: undefined })
  const flow = openAddEdit(legacy, [SHAMPOO_3_4, legacy], { frequencyOnly: true })!
  assert.deepEqual(flow.steps, [{ kind: "frequency", current: null, suggestion: "weekly_3_4x" }])
  assert.deepEqual(answerFrequency(flow, "weekly_3_4x"), {
    kind: "patch",
    itemId: "item-1",
    body: { frequency: "weekly_3_4x" },
  })
})

test("edit: a styling product and a fixed type only change their frequency", () => {
  for (const item of [
    view({ category: null, productType: "styling", productNameText: "Haarspray" }),
    view({ category: "heat_protectant", productType: "heat_protectant" }),
  ]) {
    const flow = openAddEdit(item, [])!
    assert.deepEqual(
      flow.steps.map((entry) => entry.kind),
      ["frequency"],
    )
    assert.deepEqual(answerFrequency(flow, "daily_1x")?.body, { frequency: "daily_1x" })
  }
})

test("a „benutzt sie nicht“ row opens nothing", () => {
  assert.equal(openAddEdit(view({ source: "none" }), []), null)
})

// --- Spray answers are correctable (Codex review 7b, P2) -----------------------------------

const TAFT = view({
  id: "spray-1",
  source: "dm_search",
  brandText: "Taft",
  productNameText: "Taft Haarspray Ultra Strong",
  barcodeIdentifier: "4015100000001",
  category: null,
  productType: "styling",
  frequency: "daily_1x",
})

test("edit: a saved styling spray re-opens the spray question with „Styling & Halt“ in plum", () => {
  let flow = openAddEdit(TAFT, [])!
  const spray = step(flow, "spray")
  assert.equal(spray.highlighted, "spray_styling")
  flow = answerSpray(
    flow,
    spray.question.options.find((option) => option.key === "spray_heat_protectant")!,
    [],
  )
  assert.equal(step(flow, "frequency").current, "daily_1x")
  assert.deepEqual(answerFrequency(flow, "weekly_2x"), {
    kind: "patch",
    itemId: "spray-1",
    body: {
      productType: "heat_protectant",
      usage: { category: "heat_protectant", role: null },
      frequency: "weekly_2x",
    },
  })
})

test("edit: a saved heat-protectant spray can go back to styling", () => {
  const heat = {
    ...TAFT,
    category: "heat_protectant" as const,
    productType: "heat_protectant" as const,
  }
  let flow = openAddEdit(heat, [])!
  const spray = step(flow, "spray")
  assert.equal(spray.highlighted, "spray_heat_protectant")
  flow = answerSpray(
    flow,
    spray.question.options.find((option) => option.key === "spray_styling")!,
    [],
  )
  assert.deepEqual(answerFrequency(flow, "daily_1x")?.body, {
    productType: "styling",
    frequency: "daily_1x",
  })
})

test("edit: a catalog heat protectant is no spray answer — frequency only, as before", () => {
  const flow = openAddEdit(
    view({
      category: "heat_protectant",
      productType: "heat_protectant",
      productNameText: "Hitzeschutzspray",
    }),
    [],
  )!
  assert.deepEqual(
    flow.steps.map((entry) => entry.kind),
    ["frequency"],
  )
})
