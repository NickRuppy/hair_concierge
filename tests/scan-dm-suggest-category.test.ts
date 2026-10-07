import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { suggestCategoryFromRetailerName } from "../src/lib/scan/enrichment/suggest-category"
import { parseToonTable } from "../src/lib/scan/enrichment/toon"

test("only unambiguous name keywords suggest one supported category", () => {
  const cases = [
    ["Shampoo Rosmarin Revitalising, 250 ml", "shampoo"],
    ["Shampoo Glow & Shine", "shampoo"],
    ["Conditioner Moisturing", "conditioner"],
    ["Spülung", "conditioner"],
    ["Balsam", "conditioner"],
    ["Maske", "mask"],
    ["Haarkur", "mask"],
    ["Kur", "mask"],
    ["Treatment", "mask"],
    ["Leave-in", "leave_in"],
    ["Leave in", "leave_in"],
    ["Sprühkur", "leave_in"],
    ["Sprühpflege", "leave_in"],
    ["Öl", "oil"],
    ["Oil", "oil"],
    ["Haaröl", "oil"],
    ["Hitzeschutz", "heat_protectant"],
    ["Heat Protect", "heat_protectant"],
    ["Trockenshampoo", "dry_shampoo"],
    ["Dry Shampoo", "dry_shampoo"],
    ["Shampoo Tiefenreinigung", "deep_cleansing_shampoo"],
    ["Clarifying Shampoo", "deep_cleansing_shampoo"],
    ["Detox Shampoo", "deep_cleansing_shampoo"],
    ["Kopfhaut-Serum", "scalp_care"],
    ["Kopfhaut-Peeling", "scalp_care"],
    ["Scalp", "scalp_care"],
    ["Shampoo & Spülung 2in1", null],
    ["Shampoo & Conditioner", null],
    ["2 in 1 Shampoo", null],
    ["Peeling Shampoo", null],
    ["Shampoo Tönung", null],
    ["Color Shampoo", null],
    ["Farbe", null],
    ["Bondbuilder", null],
    ["Bodyoil", null],
    ["Shampoobar", null],
    ["", null],
    ["Shampoo mit Oil", null],
  ] as const
  for (const [name, expected] of cases)
    assert.equal(suggestCategoryFromRetailerName(name.toUpperCase()), expected, name)
})
test("all found products from the real probe have the expected suggestion", () => {
  const rows = parseToonTable(
    readFileSync(new URL("./fixtures/dm-mcp/details-all-gtins.txt", import.meta.url), "utf8"),
  )
  for (const row of rows.filter((row) => row.found === "true")) {
    assert.equal(
      suggestCategoryFromRetailerName(row.productName),
      row.gtin === "4262391991626" ? "conditioner" : "shampoo",
    )
  }
})
