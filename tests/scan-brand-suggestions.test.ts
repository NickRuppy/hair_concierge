import assert from "node:assert/strict"
import test from "node:test"

import { suggestScanBrands } from "../src/lib/scan/brand-suggestions"

const BRANDS = [
  "OGX",
  "Olaplex",
  "Garnier",
  "L'Oréal Paris Elvital",
  "Balea Professional",
  "Moroccanoil",
  "K18",
  "Kérastase",
]

function stubClient(names: string[] = BRANDS, error: unknown = null) {
  let limitValue: number | null = null
  const client = {
    from(table: string) {
      assert.equal(table, "brands")
      const chain = {
        select: () => chain,
        order: () => chain,
        limit: (value: number) => {
          limitValue = value
          return chain
        },
        then: (resolve: (value: unknown) => unknown) =>
          resolve({
            data: error
              ? null
              : names.map((name, index) => ({ id: `b-${index}`, canonical_name: name })),
            error,
          }),
      }
      return chain
    },
  }
  return { client, limit: () => limitValue }
}

test("prefix match wins over substring match", async () => {
  const { client } = stubClient()
  const result = await suggestScanBrands(client as never, "ker")
  // "Kérastase" starts with "ker" (accent-folded); no other match contains it earlier.
  assert.deepEqual(result, ["Kérastase"])
})

test("case- and accent-insensitive matching", async () => {
  const { client } = stubClient()
  assert.deepEqual(await suggestScanBrands(client as never, "OLAP"), ["Olaplex"])
  assert.deepEqual(await suggestScanBrands(client as never, "oreal"), ["L'Oréal Paris Elvital"])
})

test("substring matches follow prefix matches", async () => {
  const { client } = stubClient(["Moroccanoil", "OGX", "Oil Brand"])
  // "o" prefixes OGX and Oil Brand; Moroccanoil only contains it.
  const result = await suggestScanBrands(client as never, "oi")
  assert.deepEqual(result, ["Oil Brand", "Moroccanoil"])
})

test("caps results at six", async () => {
  const names = Array.from({ length: 10 }, (_, index) => `Marke ${index}`)
  const { client } = stubClient(names)
  const result = await suggestScanBrands(client as never, "marke")
  assert.equal(result.length, 6)
})

test("query shorter than two characters yields nothing without querying", async () => {
  const { client } = stubClient()
  assert.deepEqual(await suggestScanBrands(client as never, "o"), [])
  assert.deepEqual(await suggestScanBrands(client as never, "  "), [])
})

test("a database error surfaces as a thrown error", async () => {
  const { client } = stubClient(BRANDS, { message: "boom" })
  await assert.rejects(suggestScanBrands(client as never, "ogx"), /scan_brand_suggestions_failed/)
})
