import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { DiscoveryChoiceSheetBody } from "../src/components/discovery/intake/discovery-choice-sheet"
import type {
  DiscoveryIntakeItemView,
  DiscoveryIntakeProductCaptureInput,
} from "../src/components/discovery/intake/types"
import {
  beginAdd,
  beginChange,
  chooseType,
  chooseUsage,
  type DiscoveryFlowNext,
  type DiscoveryFlowSheet,
  type DiscoveryFlowSubject,
} from "../src/components/discovery/intake/usage-flow"

/**
 * The flat checklist's client mapping (batch 5): which sheet a capture or a pill tap opens,
 * what is highlighted in plum, and the ONE request the final answer becomes.
 */

const CATALOG: DiscoveryIntakeProductCaptureInput = {
  source: "catalog_search",
  productId: "20000000-0000-4000-8000-000000000001",
  brandText: "Balea",
  productNameText: "Professional Oil Repair Spülung",
}
const TYPED: DiscoveryIntakeProductCaptureInput = {
  source: "name_research",
  brandText: "Meine Friseurin",
  productNameText: "Geheimtipp Nr. 5",
}

function subject(name: string | null): DiscoveryFlowSubject {
  return { title: name ?? "Gescanntes Produkt", imageUrl: null, name }
}

function sheetOf(next: DiscoveryFlowNext): DiscoveryFlowSheet {
  assert.equal(next.kind, "sheet")
  return (next as Extract<DiscoveryFlowNext, { kind: "sheet" }>).sheet
}

function usageSheet(next: DiscoveryFlowNext) {
  const sheet = sheetOf(next)
  assert.equal(sheet.kind, "usage")
  return sheet as Extract<DiscoveryFlowSheet, { kind: "usage" }>
}

function whatIsItSheet(next: DiscoveryFlowNext) {
  const sheet = sheetOf(next)
  assert.equal(sheet.kind, "what_is_it")
  return sheet as Extract<DiscoveryFlowSheet, { kind: "what_is_it" }>
}

function option(sheet: Extract<DiscoveryFlowSheet, { kind: "usage" }>, key: string) {
  const found = sheet.question.options.find((candidate) => candidate.key === key)
  assert.ok(found, `option ${key}`)
  return found
}

function view(overrides: Partial<DiscoveryIntakeItemView>): DiscoveryIntakeItemView {
  return {
    id: "item-1",
    category: "conditioner",
    source: "catalog_search",
    brandText: "Balea",
    productNameText: "Spülung",
    barcodeIdentifier: null,
    productType: "conditioner",
    ...overrides,
  }
}

// --- Add time ------------------------------------------------------------------------

test("a catalog conditioner asks „Wie benutzt du das?“ with the detected usage preselected", () => {
  const sheet = usageSheet(
    beginAdd(CATALOG, subject("Professional Oil Repair Spülung"), "conditioner"),
  )
  assert.equal(sheet.question.prompt, "Wie benutzt du das?")
  assert.equal(sheet.highlighted, "conditioner")
  assert.equal(sheet.typeChosen, false)

  // One tap on the preselected option is the whole answer: one add, type + usage.
  assert.deepEqual(chooseUsage(sheet, option(sheet, "conditioner")), {
    kind: "add",
    body: {
      capture: CATALOG,
      productType: "conditioner",
      usage: { category: "conditioner", role: null },
    },
  })
  // She may say it is used as a mask — the product type stays a conditioner (identity ≠ usage).
  assert.deepEqual(chooseUsage(sheet, option(sheet, "mask")), {
    kind: "add",
    body: { capture: CATALOG, productType: "conditioner", usage: { category: "mask", role: null } },
  })
})

test("the catalog category decides the type, whatever the name says", () => {
  const sheet = usageSheet(beginAdd(CATALOG, subject("Irgendwas Shampoo"), "mask"))
  assert.equal(sheet.productType, "mask")
  assert.equal(sheet.highlighted, "mask")
})

test("an oil asks „Wann benutzt du das Öl?“ and the name preselects the answer (F5)", () => {
  const scalp = usageSheet(beginAdd(CATALOG, subject("Kopfhaut Öl"), "oil"))
  assert.equal(scalp.question.prompt, "Wann benutzt du das Öl?")
  assert.equal(scalp.highlighted, "oil_scalp")
  assert.deepEqual(chooseUsage(scalp, option(scalp, "oil_scalp")), {
    kind: "add",
    body: {
      capture: CATALOG,
      productType: "oil",
      usage: { category: "scalp_care", role: "scalp_flake_oil_adjunct" },
    },
  })

  assert.equal(usageSheet(beginAdd(CATALOG, subject("Bonding Oil"), "oil")).highlighted, "oil_damp")
})

test("a shampoo asks „Wie oft benutzt du das?“", () => {
  const sheet = usageSheet(beginAdd(CATALOG, subject("Shampoo"), "shampoo"))
  assert.equal(sheet.question.prompt, "Wie oft benutzt du das?")
  assert.equal(sheet.highlighted, "shampoo")
})

test("a type without a question adds directly — no sheet", () => {
  assert.deepEqual(beginAdd(CATALOG, subject("Hitzeschutz-Spray"), "heat_protectant"), {
    kind: "add",
    body: {
      capture: CATALOG,
      productType: "heat_protectant",
      usage: { category: "heat_protectant", role: null },
    },
  })
})

test("an unclassifiable name asks „Was ist das?“ with nothing preselected", () => {
  const sheet = whatIsItSheet(beginAdd(TYPED, subject("Geheimtipp Nr. 5")))
  assert.equal(sheet.current, null)
  assert.equal(sheet.target.kind, "add")
})

test("an unknown barcode (no name) asks „Was ist das?“", () => {
  const capture: DiscoveryIntakeProductCaptureInput = {
    source: "barcode_unknown",
    barcodeIdentifier: "4005808858149",
  }
  whatIsItSheet(beginAdd(capture, subject(null)))
})

test("„Weiß ich nicht“ stores the product without type, usage or research", () => {
  const sheet = whatIsItSheet(beginAdd(TYPED, subject("Geheimtipp Nr. 5")))
  assert.deepEqual(chooseType(sheet, null), {
    kind: "add",
    body: { capture: TYPED, productType: null, usage: null },
  })
})

test("a chip sets the type, then that type's usage question follows", () => {
  const whatIsIt = whatIsItSheet(beginAdd(TYPED, subject("Geheimtipp Nr. 5")))

  const oil = usageSheet(chooseType(whatIsIt, "oil"))
  assert.equal(oil.question.prompt, "Wann benutzt du das Öl?")
  assert.equal(oil.typeChosen, true)
  assert.deepEqual(chooseUsage(oil, option(oil, "oil_pre_wash")), {
    kind: "add",
    body: {
      capture: TYPED,
      productType: "oil",
      usage: { category: "oil", role: "pre_wash_fibre_treatment" },
    },
  })

  // A chip without a question adds at once.
  assert.deepEqual(chooseType(whatIsIt, "dry_shampoo"), {
    kind: "add",
    body: {
      capture: TYPED,
      productType: "dry_shampoo",
      usage: { category: "dry_shampoo", role: null },
    },
  })
})

// --- Pill tap (change) ----------------------------------------------------------------

test("a typed product's pill re-asks its type's question with her CURRENT answer in plum", () => {
  const item = view({ category: "mask", productType: "conditioner" })
  const sheet = beginChange(item)
  assert.ok(sheet && sheet.kind === "usage")
  assert.equal(sheet.highlighted, "mask")
  // A usage change never sends a type: the product stays what it is.
  assert.deepEqual(chooseUsage(sheet, option(sheet, "leave_in")), {
    kind: "patch",
    itemId: "item-1",
    body: { usage: { category: "leave_in", role: null } },
  })
})

test("an oil's current role is what is highlighted", () => {
  const sheet = beginChange(
    view({ category: "oil", productType: "oil", usageRole: "dry_finish", productNameText: "Öl" }),
  )
  assert.ok(sheet && sheet.kind === "usage")
  assert.equal(sheet.highlighted, "oil_dry_finish")
})

test("a type-open item („Weiß ich nicht“) opens „Was ist das?“ with „Weiß ich nicht“ current", () => {
  const item = view({ category: null, productType: undefined, source: "name_research" })
  const sheet = beginChange(item)
  assert.ok(sheet && sheet.kind === "what_is_it")
  assert.equal(sheet.current, "unknown")

  // Staying unknown changes nothing.
  assert.deepEqual(chooseType(sheet, null), { kind: "close" })
  // A type goes WITH the usage in one PATCH — that is what opens its research.
  const mask = usageSheet(chooseType(sheet, "mask"))
  assert.deepEqual(chooseUsage(mask, option(mask, "mask")), {
    kind: "patch",
    itemId: "item-1",
    body: { usage: { category: "mask", role: null }, productType: "mask" },
  })
  assert.deepEqual(chooseType(sheet, "bondbuilder"), {
    kind: "patch",
    itemId: "item-1",
    body: { usage: { category: "bondbuilder", role: null }, productType: "bondbuilder" },
  })
})

test("a product type without a usage question has nothing to change", () => {
  assert.equal(
    beginChange(view({ category: "heat_protectant", productType: "heat_protectant" })),
    null,
  )
  assert.equal(beginChange(view({ category: "scalp_care", productType: "scalp_care" })), null)
})

test("a legacy (tile) row: its category stands in for the type, and only the usage is sent", () => {
  const legacy = view({ category: "shampoo", productType: undefined })
  const sheet = beginChange(legacy)
  assert.ok(sheet && sheet.kind === "usage")
  assert.equal(sheet.highlighted, "shampoo")
  assert.deepEqual(chooseUsage(sheet, option(sheet, "deep_cleansing_shampoo")), {
    kind: "patch",
    itemId: "item-1",
    body: { usage: { category: "deep_cleansing_shampoo", role: null } },
  })
  assert.equal(beginChange(view({ source: "none", category: "mask" })), null)
})

// --- Sheet markup ----------------------------------------------------------------------

function render(sheet: DiscoveryFlowSheet) {
  return renderToStaticMarkup(
    <DiscoveryChoiceSheetBody
      sheet={sheet}
      busy={false}
      error={null}
      onChooseType={() => {}}
      onChooseUsage={() => {}}
    />,
  )
}

test("the usage sheet shows the prompt, every option, and exactly the preselected one pressed", () => {
  const html = render(usageSheet(beginAdd(CATALOG, subject("Spülung"), "conditioner")))
  assert.match(html, /Wie benutzt du das\?/)
  assert.match(html, /Spülung/)
  for (const label of [
    "Kurz einwirken &amp; ausspülen",
    "Länger einwirken als Kur",
    "Bleibt im Haar",
  ]) {
    assert.match(html, new RegExp(label))
  }
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1)
  assert.match(html, /aria-pressed="true"[^>]*>Kurz einwirken/)
})

test("„Was ist das?“ offers the ten categories plus „Weiß ich nicht“", () => {
  const html = render(whatIsItSheet(beginAdd(TYPED, subject("Geheimtipp Nr. 5"))))
  assert.match(html, /Was ist das\?/)
  for (const label of [
    "Shampoo",
    "Tiefenreinigung",
    "Conditioner",
    "Maske",
    "Leave-in",
    "Öl",
    "Bondbuilder",
    "Kopfhautpflege",
    "Hitzeschutz",
    "Trockenshampoo",
    "Weiß ich nicht",
  ]) {
    assert.match(html, new RegExp(`>${label}</button>`), label)
  }
  assert.equal((html.match(/<button/g) ?? []).length, 11)
  assert.doesNotMatch(html, /aria-pressed="true"/)
})

test("on a type-open item „Weiß ich nicht“ is the current (plum) chip", () => {
  const sheet = beginChange(view({ category: null, productType: undefined }))
  assert.ok(sheet)
  assert.match(render(sheet), /aria-pressed="true"[^>]*>Weiß ich nicht</)
})
