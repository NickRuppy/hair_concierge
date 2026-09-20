import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  parseSearchToonTables,
  parseToonTable,
  ToonParseError,
} from "../src/lib/scan/enrichment/toon"

const fixture = readFileSync(
  new URL("./fixtures/dm-mcp/details-all-gtins.txt", import.meta.url),
  "utf8",
)
const searchFixture = readFileSync(
  new URL("./fixtures/dm-mcp/search-ogx-argan-oil-shampoo.json", import.meta.url),
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
test("dm search probe parses all 15 rows from a name-prefixed, comma-delimited table", () => {
  const rows = parseSearchToonTables(searchFixture)
  assert.equal(rows.length, 15)
  const ogx = rows[0]
  assert.equal(ogx.gtin, "3574661799438")
  assert.equal(ogx.dan, "1442074")
  assert.equal(ogx.brand, "OGX")
  assert.equal(ogx.title, "Shampoo renewing, Argan Oil of marocco, 385 ml")
  assert.equal(ogx.details, "")
  assert.equal(ogx.price, "6,95 €")
  assert.equal(
    ogx.appLink,
    "https://www.dm.de/applink/p/d/1442074/ogx-shampoo-renewing-argan-oil-of-marocco?appPageType=productdetails&appProductId=1442074&wt_mc=dm-mcp",
  )
  assert.equal(ogx.category, "Shampoo > Haarpflege")
  assert.equal(
    ogx.highlights,
    "Haarshampoo, Mit marrokanischem Arganöl, Nährt und belebt das Haar, Feuchtigkeitsspendend, Mit LipiPro Shield Technologi",
  )
  assert.equal(ogx.alcoholFree, "true")
  assert.equal(ogx.sulfateFree, "false")
  assert.equal(ogx.purchasable, "true")
  const last = rows[14]
  assert.equal(last.gtin, "4072600282281")
  assert.equal(last.brand, "GUHL")
  assert.equal(last.title, "Shampoo Farbglanz Blond Faszination, 250 ml")
})
test("empty search result yields no rows", () => {
  assert.deepEqual(parseSearchToonTables("[]"), [])
})
test("malformed inner JSON on the search result fails closed", () => {
  for (const input of ["not json", '{"not":"an array"}', "[1]", '["oops"'])
    assert.throws(() => parseSearchToonTables(input), ToonParseError)
})
test("malformed search TOON (bad header, width, quoting or short row count) fails closed", () => {
  for (const table of [
    "oops",
    "products{gtin}:\n  1",
    "products[1]{gtin,gtin}:\n  1,2",
    "products[2]{gtin,title}:\n  1,only-one-row",
    'products[1]{gtin,title}:\n  1,"unterminated',
    "products[1]{gtin,title}:\n  1,too,many,cells",
  ])
    assert.throws(() => parseSearchToonTables(JSON.stringify([table])), ToonParseError)
})
test("declaring fewer rows than the table actually contains fails closed instead of truncating", () => {
  // The extra row is well-formed (same cell count as the header), so a cell-count mismatch
  // alone would not catch it; only the shared two-space row indent distinguishes it from
  // genuine footer text.
  const table = "products[1]{gtin,title}:\n  1,a\n  2,b"
  assert.throws(() => parseSearchToonTables(JSON.stringify([table])), ToonParseError)
})
test("a genuine trailing footer (blank line + unindented tip) does not trip the extra-row check", () => {
  const table = "products[1]{gtin,title}:\n  1,a\n\n💡 tip text, with a comma"
  assert.deepEqual(parseSearchToonTables(JSON.stringify([table])), [{ gtin: "1", title: "a" }])
})
