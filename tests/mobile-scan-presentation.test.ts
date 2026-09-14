import assert from "node:assert/strict"
import test from "node:test"
import {
  mobileCriterionRows,
  mobileRowsFromScanDimensions,
  mobileMismatchSummary,
  scanDimensionsForProduct,
} from "../src/lib/mobile/result-presentation"
import type { Stage3FitComparisonDimension } from "../src/lib/personal-plan/products/comparison-dimensions"

const dimension = (id: string, target: string, product: string): Stage3FitComparisonDimension => ({
  dimensionId: id,
  label: id,
  presentationKind: "ordered",
  stops: ["light", "medium", "rich"].map((stopId) => ({ stopId, label: stopId })),
  targetPosition: { kind: "position", stopId: target },
  productPositions: [{ productId: "p", position: { kind: "position", stopId: product } }],
  reason: "internal reason must not become definition",
})

test("axis-specific status is green amber red even when the overall verdict is mismatch", () => {
  const source = [
    dimension("conditioner.weight", "light", "light"),
    dimension("leave_in.weight", "light", "medium"),
    dimension("conditioner.weight", "light", "rich"),
  ]
  const rows = source.flatMap((d) =>
    mobileRowsFromScanDimensions(scanDimensionsForProduct([d], "p"), null, "mismatch", [d]),
  )
  assert.deepEqual(
    rows.map((r) => r.displayStatus),
    ["green", "amber", "red"],
  )
})
test("malformed equal source positions never fabricate green", () => {
  const source = [dimension("conditioner.weight", "bogus", "bogus")]
  const rows = mobileRowsFromScanDimensions(
    scanDimensionsForProduct(source, "p"),
    null,
    "ideal",
    source,
  )
  assert.equal(rows[0].displayStatus, "neutral")
  assert.notEqual(mobileMismatchSummary([]), "Alles im Ziel.")
})
test("definitions use actual IDs across categories and never engine reason copy", () => {
  for (const id of [
    "shampoo.suitable_thicknesses",
    "conditioner.suitable_thicknesses",
    "oil.suitable_thicknesses",
    "mask.weight",
    "leave_in.heat_protection",
  ]) {
    const source = [dimension(id, "light", "light")]
    const [row] = mobileRowsFromScanDimensions(
      scanDimensionsForProduct(source, "p"),
      null,
      "ideal",
      source,
    )
    assert.ok(!row.definition.includes("internal reason"))
    assert.ok(!row.definition.includes("Produkt- und Zielwert"))
  }
})

test("authored glossary meanings apply to canonical axes and aliases while unknown stops fall back to labels", () => {
  const source = [
    {
      ...dimension("leave_in.repair_support", "medium", "high"),
      stops: [
        { stopId: "low", label: "niedrig" },
        { stopId: "medium", label: "mittel" },
        { stopId: "high", label: "hoch" },
      ],
    },
    {
      ...dimension("future.axis", "light", "mystery"),
      stops: [{ stopId: "mystery", label: "Unbekannt" }],
    },
  ]
  const rows = source.flatMap((entry) =>
    mobileRowsFromScanDimensions(scanDimensionsForProduct([entry], "p"), null, "unknown", [entry]),
  )

  assert.deepEqual(
    rows[0]?.stops.map((stop) => stop.meaning),
    [
      "Kaum Repair-Stoffe. Nicht auf strapazierte Längen ausgelegt.",
      "Etwas Repair-Anteil. Auf leicht strapazierte Längen ausgelegt.",
      "Deutlich auf strapazierte Längen ausgelegt, etwa nach Färben, Blondieren oder viel Hitze.",
    ],
  )
  assert.equal(rows[1]?.stops[0]?.meaning, "Unbekannt")
})

test("unknown axes cannot acquire copy through a familiar suffix or inherited object key", () => {
  for (const [id, stopId] of [
    ["future.weight", "light"],
    ["conditioner.weight", "constructor"],
    ["__proto__", "constructor"],
  ]) {
    const source = [
      { ...dimension(id, stopId, stopId), stops: [{ stopId, label: "Unbekannte Stufe" }] },
    ]
    const [row] = mobileRowsFromScanDimensions(scanDimensionsForProduct(source, "p"), null)
    assert.equal(row.stops[0].meaning, "Unbekannte Stufe")
  }
})

test("criterion-only producers retain nonblank label fallback meanings", () => {
  const [row] = mobileCriterionRows(
    "heat_protectant",
    "pre_heat_protection",
    [
      {
        criterionId: "heat_protectant.capability",
        label: "Hitzeschutz",
        result: "pass",
        explanation: "Bestätigt.",
      },
    ],
    null,
  )
  assert.deepEqual(
    row?.stops.map((stop) => stop.meaning),
    ["erfüllt", "teilweise", "nicht erfüllt"],
  )
})

test("every known scan-axis stop has a nonblank authored meaning or its label fallback", () => {
  const knownDimensions = {
    "shampoo.cleansing_intensity": ["gentle", "regular", "clarifying"],
    "shampoo.scalp_route": ["oily", "balanced", "dry", "dandruff", "dry_flakes", "irritated"],
    "shampoo.suitable_thicknesses": ["fine", "normal", "coarse"],
    "conditioner.weight": ["light", "medium", "rich"],
    "conditioner.care_direction": ["moisture", "balanced", "protein"],
    "conditioner.repair_support": ["low", "medium", "high"],
    "conditioner.suitable_thicknesses": ["fine", "normal", "coarse"],
    "leave_in.weight": ["light", "medium", "rich"],
    "leave_in.care_direction": ["moisture", "balanced", "protein"],
    "leave_in.repair_support": ["low", "medium", "high"],
    "leave_in.heat_protection": ["true", "false"],
    "mask.weight": ["light", "medium", "rich"],
    "mask.care_direction": ["moisture", "balanced", "protein"],
    "mask.repair_support": ["low", "medium", "high"],
    "oil.role_support": ["true", "false"],
    "oil.weight": ["light", "medium", "rich"],
    "oil.suitable_thicknesses": ["fine", "normal", "coarse"],
    "oil.heat_protection": ["true", "false"],
    "bondbuilder.suitable_thicknesses": ["fine", "normal", "coarse"],
    "bondbuilder.relationship": ["standalone", "add_on"],
  }
  const rows = mobileRowsFromScanDimensions(
    Object.entries(knownDimensions).map(([dimensionId, stopIds]) => ({
      dimensionId,
      label: dimensionId,
      stops: stopIds.map((stopId) => ({ stopId, label: `${dimensionId}:${stopId}` })),
      targetStopIds: [],
      productStopIds: [],
      state: "no_target" as const,
    })),
    null,
  )
  assert.ok(rows.every((row) => row.stops.every((stop) => stop.meaning.trim().length > 0)))
  assert.equal(
    rows.find((row) => row.dimensionId === "bondbuilder.relationship")?.stops[0]?.meaning,
    "bondbuilder.relationship:standalone",
  )
})

test("mask criteria retain category compatibility instead of generic ordered distance", () => {
  const source = [dimension("mask.weight", "light", "rich")]
  const rows = mobileRowsFromScanDimensions(
    scanDimensionsForProduct(source, "p"),
    null,
    "ideal",
    source,
    [
      {
        criterionId: "mask.weight",
        label: "Gewicht",
        result: "caution",
        explanation: "Masken-Rolle",
      },
    ],
  )
  assert.equal(rows[0].displayStatus, "amber")
})

test("set table uses matching target or jede only for complete catalog coverage, while deviations retain full sets", () => {
  const source: Stage3FitComparisonDimension = {
    dimensionId: "shampoo.scalp_route",
    label: "Kopfhaut-Fokus",
    presentationKind: "set",
    stops: ["oily", "dry", "irritated"].map((stopId) => ({ stopId, label: stopId })),
    targetPosition: { kind: "supported_stops", stopIds: ["oily"] },
    productPositions: [
      { productId: "p", position: { kind: "supported_stops", stopIds: ["oily", "dry"] } },
    ],
    reason: "",
  }
  let [row] = mobileRowsFromScanDimensions(scanDimensionsForProduct([source], "p"), null, "ideal", [
    source,
  ])
  assert.equal(row.label, "Kopfhaut")
  assert.equal(row.productValue, "oily")
  assert.deepEqual(row.productStopIds, ["oily", "dry"])
  source.productPositions[0].position = {
    kind: "supported_stops",
    stopIds: ["oily", "dry", "irritated"],
  }
  ;[row] = mobileRowsFromScanDimensions(scanDimensionsForProduct([source], "p"), null, "ideal", [
    source,
  ])
  assert.equal(row.productValue, "jede")
  source.productPositions[0].position = { kind: "supported_stops", stopIds: ["dry", "irritated"] }
  ;[row] = mobileRowsFromScanDimensions(scanDimensionsForProduct([source], "p"), null, "mismatch", [
    source,
  ])
  assert.equal(mobileMismatchSummary([row]), "Kopfhaut: dry, irritated statt oily")
})

test("unbound future dimension is neutral even if raw stops coincide", () => {
  const source = [dimension("future.axis", "light", "light")]
  const [row] = mobileRowsFromScanDimensions(
    scanDimensionsForProduct(source, "p"),
    null,
    "ideal",
    source,
  )
  assert.equal(row.displayStatus, "neutral")
})
