import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { parseToonTable, ToonParseError } from "../src/lib/scan/enrichment/toon"

const fixture = readFileSync(
  new URL("./fixtures/dm-mcp/details-all-gtins.txt", import.meta.url),
  "utf8",
)
test("dm probe parses all ten rows without losing identity, URLs or ingredient text", () => {
  const rows = parseToonTable(fixture)
  assert.equal(rows.length, 10)
  assert.equal(rows.filter((row) => row.found === "true").length, 6)
  assert.equal(rows.find((row) => row.gtin === "4006381333931")?.found, "false")
  const balea = rows.find((row) => row.gtin === "4066447982695")!
  assert.equal(balea.productName, "Shampoo Pure Frische, 300 ml")
  assert.equal(balea.brand, "Balea")
  assert.equal(
    balea.productUrl,
    "https://www.dm.de/applink/p/d/1703587/balea-shampoo-pure-frische?appPageType=productdetails&appProductId=1703587&wt_mc=dm-mcp",
  )
  assert.equal(
    balea.nonFoodIngredients,
    "Ingredients: Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Sodium Chloride, Panthenol, Menthol, Niacinamide, Parfum, Glycerin, Glycol Distearate, Hydroxypropyl Guar Hydroxypropyltrimonium Chloride, Laureth-4, Sodium Benzoate, Potassium Sorbate, Citric Acid, Sodium Hydroxide, Lactic Acid",
  )
})
test("quoted pipes, quotes, escapes, empty cells and CRLF stay intact", () => {
  assert.deepEqual(
    parseToonTable('[2]{a|b|c}:\r\n  "a|b"|"say \\"hi\\""|\r\n  |"line\\nnext"|["x|y";z]'),
    [
      { a: "a|b", b: 'say "hi"', c: "" },
      { a: "", b: "line\nnext", c: '["x|y";z]' },
    ],
  )
})
test("malformed headers, width, quoting and row counts fail closed", () => {
  for (const input of [
    "oops",
    "[1]{a|b}:\n  one",
    "[2]{a}:\n  one",
    '[1]{a}:\n  "unterminated',
    '[1]{a}:\n  "ok"tail',
    "[1]{a|a}:\n  x|y",
  ]) {
    assert.throws(() => parseToonTable(input), ToonParseError)
  }
  assert.deepEqual(parseToonTable("[0]{a}:"), [])
})
