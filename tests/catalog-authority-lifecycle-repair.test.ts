import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const repairDir = join(
  process.cwd(),
  "docs",
  "ops",
  "catalog-repairs",
  "2026-08-15-catalog-authority-lifecycle",
)
const preflight = readFileSync(join(repairDir, "preflight.sql"), "utf8")
const repair = readFileSync(join(repairDir, "repair.sql"), "utf8")

const SOURCE_IDS = [
  "917786d2-cf02-43d4-8a9f-7f872528d581",
  "d105d245-5993-4b89-b45d-1bf0a86650e3",
  "caa94951-57d9-441d-bd46-5d7debbf365f",
  "e937c8aa-fc99-4731-b848-e5bd988fcc17",
  "a1d705b4-b973-486d-b853-2c795b6db681",
  "6513692a-b54f-4acc-9c77-5799d3dd200c",
  "1a6e731e-8fb2-43b4-9f4c-2d7f6dd06dca",
  "3f9328d8-1f6a-44e9-affd-fc219d1e691a",
  "514ffd65-e4a5-4f7f-96c5-0f194e3b3b36",
  "d0936238-7412-40bc-ba7a-3c268f17d0f4",
  "6d6c3ff2-9d12-4f27-a56f-b5b72cf53318",
  "7bd5f94a-fb02-4505-a53a-2b100c265a5b",
  "7db2bb60-0af6-4198-adec-28fad13251a6",
  "996eaa2a-ea4c-4dfb-b455-2782e82d9a44",
  "4417217b-2843-47aa-8815-04a125b08341",
  "4e76bb70-b521-48e1-9708-4edc48b17c73",
  "686df4f6-4e8f-48e7-b823-5b1e89dd9cf2",
  "3c769f60-283f-48c3-9549-cf84b73115d7",
  "4fd5f4c3-83b2-4893-be8c-ada29b8ca718",
] as const

test("lifecycle repair preflight pins every approved source row", () => {
  assert.equal(SOURCE_IDS.length, 19)
  for (const id of SOURCE_IDS) {
    assert.match(preflight, new RegExp(id, "g"))
    assert.match(repair, new RegExp(id, "g"))
  }
  assert.match(preflight, /driftRows/)
  assert.match(preflight, /targetDefects/)
  assert.match(preflight, /conflictingRelationships/)
})

test("lifecycle repair is one guarded transaction with bounded table writes", () => {
  assert.match(repair, /BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;/)
  assert.match(repair, /pg_advisory_xact_lock/)
  assert.match(repair, /GET DIAGNOSTICS v_count = ROW_COUNT;/)
  assert.match(repair, /IF v_count <> 19/)
  assert.match(repair, /IF v_count <> 6/)
  assert.match(repair, /COMMIT;/)
  assert.doesNotMatch(repair, /\b(?:DELETE|TRUNCATE)\b/i)

  const writtenTables = [
    ...repair.matchAll(/(?:UPDATE|INSERT INTO)\s+public\.([a-z_]+)/g),
  ].map((match) => match[1])
  assert.deepEqual(
    [...new Set(writtenTables)].sort(),
    ["product_relationships", "products"],
  )
})
