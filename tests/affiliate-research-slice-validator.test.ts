import assert from "node:assert/strict"
import test from "node:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { validateSlice } from "../src/lib/affiliate-research/slice-validator"

const INPUT_HEADER = "id,brand,name,description,category,price_eur"
const OUTPUT_HEADER = "id,brand,name,chosen_url,host,confidence,matched_tokens,notes"

function fixtureDir() {
  return mkdtempSync(join(tmpdir(), "slice-val-"))
}

test("valid slice: ids match exactly, no duplicates", () => {
  const dir = fixtureDir()
  writeFileSync(
    join(dir, "in.csv"),
    `${INPUT_HEADER}\na,Brand,Name,Desc,Shampoo,5\nb,Brand,Name2,Desc2,Shampoo,6\n`,
  )
  writeFileSync(
    join(dir, "out.csv"),
    `${OUTPUT_HEADER}\na,Brand,Name,https://x.de/p,x.de,high,Foo,ok\nb,Brand,Name2,,,none,,not found\n`,
  )
  const res = validateSlice({ inputPath: join(dir, "in.csv"), outputPath: join(dir, "out.csv") })
  assert.equal(res.ok, true)
  assert.deepEqual(res.missing, [])
  assert.deepEqual(res.duplicated, [])
})

test("missing id reported", () => {
  const dir = fixtureDir()
  writeFileSync(
    join(dir, "in.csv"),
    `${INPUT_HEADER}\na,Brand,Name,Desc,Shampoo,5\nb,Brand,Name2,Desc2,Shampoo,6\n`,
  )
  writeFileSync(join(dir, "out.csv"), `${OUTPUT_HEADER}\na,Brand,Name,,,none,,\n`)
  const res = validateSlice({ inputPath: join(dir, "in.csv"), outputPath: join(dir, "out.csv") })
  assert.equal(res.ok, false)
  assert.deepEqual(res.missing, ["b"])
})

test("duplicate id reported", () => {
  const dir = fixtureDir()
  writeFileSync(join(dir, "in.csv"), `${INPUT_HEADER}\na,Brand,Name,Desc,Shampoo,5\n`)
  writeFileSync(
    join(dir, "out.csv"),
    `${OUTPUT_HEADER}\na,Brand,Name,,,none,,\na,Brand,Name,,,none,,\n`,
  )
  const res = validateSlice({ inputPath: join(dir, "in.csv"), outputPath: join(dir, "out.csv") })
  assert.equal(res.ok, false)
  assert.deepEqual(res.duplicated, ["a"])
})

test("wrong output header reported as schemaError", () => {
  const dir = fixtureDir()
  writeFileSync(join(dir, "in.csv"), `${INPUT_HEADER}\na,Brand,Name,Desc,Shampoo,5\n`)
  writeFileSync(join(dir, "out.csv"), `id,brand,name,url\na,Brand,Name,https://x.de\n`)
  const res = validateSlice({ inputPath: join(dir, "in.csv"), outputPath: join(dir, "out.csv") })
  assert.equal(res.ok, false)
  assert.match(res.errors.join("\n"), /header/i)
})

test("invalid confidence value reported", () => {
  const dir = fixtureDir()
  writeFileSync(join(dir, "in.csv"), `${INPUT_HEADER}\na,Brand,Name,Desc,Shampoo,5\n`)
  writeFileSync(
    join(dir, "out.csv"),
    `${OUTPUT_HEADER}\na,Brand,Name,https://x.de,x.de,SUPER,Foo,ok\n`,
  )
  const res = validateSlice({ inputPath: join(dir, "in.csv"), outputPath: join(dir, "out.csv") })
  assert.equal(res.ok, false)
  assert.match(res.errors.join("\n"), /confidence/i)
})
