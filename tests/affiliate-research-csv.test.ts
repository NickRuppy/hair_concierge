import assert from "node:assert/strict"
import test from "node:test"
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { parseCsv, stringifyCsv, readCsv, writeCsv } from "../src/lib/affiliate-research/csv"

test("parseCsv handles simple rows", () => {
  const rows = parseCsv("id,name\n1,foo\n2,bar\n")
  assert.deepEqual(rows, [
    { id: "1", name: "foo" },
    { id: "2", name: "bar" },
  ])
})

test("parseCsv handles quoted fields with commas and quotes", () => {
  const rows = parseCsv('id,name\n1,"foo, bar"\n2,"she said ""hi"""\n')
  assert.deepEqual(rows, [
    { id: "1", name: "foo, bar" },
    { id: "2", name: 'she said "hi"' },
  ])
})

test("parseCsv tolerates trailing newline and empty fields", () => {
  const rows = parseCsv("id,name\n1,\n")
  assert.deepEqual(rows, [{ id: "1", name: "" }])
})

test("stringifyCsv quotes only when necessary", () => {
  const out = stringifyCsv(
    ["id", "name"],
    [
      { id: "1", name: "foo" },
      { id: "2", name: "has, comma" },
      { id: "3", name: 'has "quotes"' },
    ],
  )
  assert.equal(out, 'id,name\n1,foo\n2,"has, comma"\n3,"has ""quotes"""\n')
})

test("round-trip: writeCsv then readCsv recovers data", () => {
  const dir = mkdtempSync(join(tmpdir(), "csv-test-"))
  const path = join(dir, "x.csv")
  const rows = [
    { id: "a", url: "https://x.example/p?q=1,2" },
    { id: "b", url: "https://y.example/p" },
  ]
  writeCsv(path, ["id", "url"], rows)
  const back = readCsv(path)
  assert.deepEqual(back, rows)
})

test("readCsv throws on header mismatch via callback", () => {
  const dir = mkdtempSync(join(tmpdir(), "csv-test-"))
  const path = join(dir, "x.csv")
  writeFileSync(path, "id,brand\n1,Pantene\n")
  assert.throws(() => readCsv(path, { expectedHeader: ["id", "name"] }), /header/i)
})
