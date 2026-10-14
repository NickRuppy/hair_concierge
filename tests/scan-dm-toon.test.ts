import assert from "node:assert/strict"
import test from "node:test"
import {
  parseSearchToonTables,
  parseToonTable,
  ToonParseError,
} from "../src/lib/scan/enrichment/toon"

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
