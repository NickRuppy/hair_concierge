import assert from "node:assert/strict"
import test from "node:test"

import {
  applyCommerceWrites,
  runCommerceStage,
  type CommerceStageDeps,
  type CommerceStageResult,
} from "../src/lib/product-intake/pipeline/commerce"
import type { JsonRecord } from "../src/lib/product-intake/repository-types"

const NOW = "2026-10-06T12:00:00.000Z"
const ROSSMANN_URL = "https://www.rossmann.de/de/pflege-test/p/4015100813494"
const DM_URL = "https://www.dm.de/p/d/1670316/wahre-schaetze-shampoo"
const DM_ROW = {
  gtin: "3600542461030",
  dan: "1670316",
  title: "Shampoo Honig Schätze, 400 ml",
  price: "3,45 €",
  sellout: "false",
  purchasable: "true",
}

function final(product: JsonRecord = {}, identifiers: unknown = []): JsonRecord {
  return {
    product: {
      clean_name: "Ultimate Repair Spülung",
      canonical_brand: "Gliss",
      affiliate_link: ROSSMANN_URL,
      price_eur: 4.49,
      price_checked_at: "2026-10-01T00:00:00.000Z",
      purchase_link_status: "available",
      purchase_link_checked_at: "2026-10-01T00:00:00.000Z",
      currency: "EUR",
      ...product,
    },
    identifiers,
  }
}

function page(
  options: {
    price?: number | string
    gtin?: string
    availability?: string | null
    body?: string
  } = {},
): typeof fetch {
  return async () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "Product",
      name: "Gliss Ultimate Repair Spülung",
      ...(options.gtin ? { gtin13: options.gtin } : {}),
      offers: {
        price: options.price ?? 4.99,
        priceCurrency: "EUR",
        availability:
          options.availability === undefined ? "https://schema.org/InStock" : options.availability,
      },
    })}</script>${options.body ?? ""}`
    return Object.defineProperty(new Response(html), "url", { value: ROSSMANN_URL })
  }
}

function deps(overrides: Partial<CommerceStageDeps> = {}): CommerceStageDeps {
  return {
    now: () => new Date(NOW),
    hostAutoWriteEnabled: () => true,
    jsonLdFetch: page(),
    dmSearch: async () => [DM_ROW],
    ...overrides,
  }
}

function run(payload: JsonRecord = final(), overrides: Partial<CommerceStageDeps> = {}) {
  return runCommerceStage({ submissionId: "submission-1", final: payload, deps: deps(overrides) })
}

function assertPriceOnly(result: CommerceStageResult) {
  assert.ok(
    Object.keys(result.writes).every((key) => ["price_eur", "price_checked_at"].includes(key)),
  )
  assert.deepEqual(result.artifact.payload.writes, result.writes)
  assert.equal(result.artifact.kind, "commerce_check")
  assert.equal(result.artifact.payload.stage, "commerce")
}

test("commerce records missing, invalid and URL-gate-rejected links without blocking or fetching", async (t) => {
  for (const link of [
    null,
    "",
    42,
    "not a URL",
    "ftp://dm.de/product",
    "https://idealo.de/product",
    "https://untrusted.example/product",
    "https://ogxbeauty.com/p",
  ]) {
    await t.test(String(link), async () => {
      let fetched = false
      let probed = false
      const result = await run(final({ affiliate_link: link }), {
        hostAutoWriteEnabled: () => {
          probed = true
          return true
        },
        dmSearch: async () => {
          fetched = true
          return [DM_ROW]
        },
        jsonLdFetch: async () => {
          fetched = true
          return new Response("")
        },
      })
      assert.equal(result.artifact.status, "unconfirmed")
      assert.deepEqual(result.blockers, [])
      assert.equal((result.artifact.payload.link_gate as JsonRecord).pass, false)
      assert.equal(typeof (result.artifact.payload.link_gate as JsonRecord).reason, "string")
      assert.deepEqual(result.writes, {})
      assert.equal(result.artifact.payload.adapter_fetched, false)
      assert.equal(fetched, false)
      assert.equal(probed, false)
      assertPriceOnly(result)
    })
  }
})

test("commerce skips allowed and brand-direct hosts without adapters", async (t) => {
  for (const link of [
    "https://amazon.de/dp/test",
    "https://gliss.example/product",
    "https://gliss-hair.com/product",
  ]) {
    await t.test(link, async () => {
      let fetched = false
      const result = await run(final({ affiliate_link: link }), {
        jsonLdFetch: async () => {
          fetched = true
          return new Response("")
        },
      })
      assert.equal(result.artifact.status, "unconfirmed")
      assert.equal(result.artifact.payload.adapter_fetched, false)
      assert.deepEqual(result.blockers, [])
      assert.deepEqual(result.writes, {})
      assert.equal(fetched, false)
      assertPriceOnly(result)
    })
  }
})

test("commerce does not fetch either adapter when its host lacks an enabled probe", async (t) => {
  for (const [link, host] of [
    [ROSSMANN_URL, "rossmann.de"],
    [DM_URL, "dm.de"],
  ]) {
    await t.test(host, async () => {
      let fetched = false
      const result = await run(final({ affiliate_link: link }), {
        hostAutoWriteEnabled: (value) => {
          assert.equal(value, host)
          return false
        },
        dmSearch: async () => {
          fetched = true
          return [DM_ROW]
        },
        jsonLdFetch: async () => {
          fetched = true
          return new Response("")
        },
      })
      assert.equal(result.artifact.status, "unconfirmed")
      assert.equal(result.artifact.payload.host, host)
      assert.equal(result.artifact.payload.adapter_fetched, false)
      assert.deepEqual(result.blockers, [])
      assert.deepEqual(result.writes, {})
      assert.equal(fetched, false)
    })
  }
})

test("commerce failures retain model values and omit error secrets and bodies", async (t) => {
  const cases: Array<[string, Partial<CommerceStageDeps>, string]> = [
    [
      "HTTP failure",
      { jsonLdFetch: async () => new Response("secret body", { status: 403 }) },
      "bot_wall",
    ],
    [
      "dm outage",
      {
        dmSearch: async () => {
          throw new Error("secret token")
        },
      },
      "adapter_unavailable",
    ],
    [
      "adapter crash",
      { dmSearch: async () => [null as unknown as Record<string, string>] },
      "adapter_unavailable",
    ],
  ]
  for (const [name, overrides, reason] of cases) {
    await t.test(name, async () => {
      const payload =
        name === "HTTP failure"
          ? final()
          : final({ affiliate_link: DM_URL }, [{ type: "gtin", value: "3600542461030" }])
      const before = structuredClone(payload)
      const result = await run(payload, overrides)
      assert.equal(result.artifact.status, "unconfirmed")
      assert.deepEqual(result.artifact.payload.observation, { kind: "failed", reason })
      assert.equal(result.artifact.payload.adapter_fetched, true)
      assert.deepEqual(result.writes, {})
      assert.deepEqual(result.blockers, [])
      assert.deepEqual(payload, before)
      assert.doesNotMatch(JSON.stringify(result), /secret/)
      assertPriceOnly(result)
    })
  }
})

test("commerce reports identity and stored-link mismatches without writes", async (t) => {
  for (const reason of ["gtin_mismatch", "stored_link_mismatch"]) {
    await t.test(reason, async () => {
      const result = await run(
        final({ affiliate_link: DM_URL }, [
          { type: "ean", value: reason === "gtin_mismatch" ? "4015100813494" : "3600542461030" },
        ]),
        {
          dmSearch: async () => [
            { ...DM_ROW, dan: reason === "stored_link_mismatch" ? "9999999" : DM_ROW.dan },
          ],
        },
      )
      assert.equal(result.artifact.status, "conflict")
      assert.deepEqual(result.blockers, [`commerce_link_mismatch: ${reason} (${DM_URL})`])
      assert.deepEqual(result.writes, {})
      assert.equal(result.artifact.payload.adapter_fetched, true)
      assertPriceOnly(result)
    })
  }
})

test("commerce canonicalizes barcode, gtin and ean identifiers for dm identity", async (t) => {
  for (const type of ["barcode", "gtin", "ean"]) {
    await t.test(type, async () => {
      const queries: string[] = []
      const result = await run(
        final(
          {
            clean_name: "Shampoo Honig",
            canonical_brand: "Garnier",
            affiliate_link: DM_URL,
          },
          [
            { type: "retailer_sku", value: "4015100813494" },
            { type, value: "3600 542-461030" },
            { type, value: "03600542461030" },
            { type, value: "3600542461031" },
            null,
          ],
        ),
        {
          dmSearch: async (query) => {
            queries.push(query)
            return [DM_ROW]
          },
        },
      )
      assert.deepEqual(queries, ["Garnier Shampoo Honig"])
      assert.equal(result.artifact.status, "confirmed")
      assert.equal((result.artifact.payload.observation as JsonRecord).identity, "gtin_match")
      assert.deepEqual(result.writes, { price_eur: 3.45, price_checked_at: NOW })
      assert.deepEqual(result.blockers, [])
      assertPriceOnly(result)
    })
  }
})

test("commerce never uses retailer SKUs or invalid GTINs as barcode identity", async () => {
  let searched = false
  const result = await run(
    final({ affiliate_link: DM_URL }, [
      { type: "retailer_sku", value: "3600542461030" },
      { type: "barcode", value: "3600542461031" },
    ]),
    {
      dmSearch: async () => {
        searched = true
        return [DM_ROW]
      },
    },
  )
  assert.equal(result.artifact.status, "conflict")
  assert.match(result.blockers[0], /commerce_link_mismatch: gtin_mismatch/)
  assert.equal(searched, false)
  assert.deepEqual(result.writes, {})
})

test("commerce confirms an exact stored PDP and records the original model values", async () => {
  const payload = final()
  const before = structuredClone(payload)
  const result = await run(payload)
  assert.equal(result.artifact.status, "confirmed")
  assert.deepEqual(result.writes, { price_eur: 4.99, price_checked_at: NOW })
  assert.deepEqual(result.blockers, [])
  assert.deepEqual(result.artifact.payload.model_values, {
    affiliate_link: ROSSMANN_URL,
    price_eur: 4.49,
    purchase_link_status: "available",
  })
  assert.equal((result.artifact.payload.observation as JsonRecord).identity, "exact_stored_pdp")
  assert.equal(result.artifact.payload.host, "rossmann.de")
  assert.equal(result.artifact.payload.adapter_fetched, true)
  assert.deepEqual(payload, before)
  assertPriceOnly(result)
})

test("commerce accepts a structured price delta above 30 percent in either direction", async (t) => {
  for (const [price, delta] of [
    [20, 100],
    [5, 50],
    [13, 30],
  ]) {
    await t.test(String(price), async () => {
      const result = await run(final({ price_eur: 10 }), { jsonLdFetch: page({ price }) })
      assert.equal(result.artifact.status, "confirmed")
      assert.equal(result.writes.price_eur, price)
      assert.equal(result.artifact.payload.model_price_delta_pct, delta)
      assert.deepEqual(result.blockers, [])
      assertPriceOnly(result)
    })
  }
})

test("commerce leaves delta unknown for missing or unusable model prices", async (t) => {
  for (const price of [null, undefined, "4.49", 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    await t.test(String(price), async () => {
      const result = await run(final({ price_eur: price }))
      assert.equal(result.artifact.status, "confirmed")
      assert.equal(result.artifact.payload.model_price_delta_pct, null)
      assert.deepEqual(result.writes, { price_eur: 4.99, price_checked_at: NOW })
    })
  }
})

test("commerce rejects observed prices outside the sane range but accepts 500 EUR", async (t) => {
  for (const price of [-1, 0, 500.01, 500]) {
    await t.test(String(price), async () => {
      const result = await run(final(), { jsonLdFetch: page({ price }) })
      assert.equal(result.artifact.status, price === 500 ? "confirmed" : "conflict")
      assert.deepEqual(result.blockers, price === 500 ? [] : [`commerce_price_anomaly: ${price}`])
      assert.deepEqual(
        result.writes,
        price === 500 ? { price_eur: 500, price_checked_at: NOW } : {},
      )
      assertPriceOnly(result)
    })
  }
})

test("commerce flags only structured unavailability contradicting model availability", async (t) => {
  const cases = [
    { status: "available", availability: "https://schema.org/OutOfStock", conflict: true },
    { status: "unavailable", availability: "https://schema.org/OutOfStock", conflict: false },
    { status: null, availability: "https://schema.org/OutOfStock", conflict: false },
    { status: "available", availability: null, conflict: false },
  ]
  for (const entry of cases) {
    await t.test(`${entry.status}/${entry.availability}`, async () => {
      const result = await run(final({ purchase_link_status: entry.status }), {
        jsonLdFetch: page({ availability: entry.availability, body: "Ausverkauft" }),
      })
      assert.equal(result.artifact.status, "confirmed")
      assert.deepEqual(result.writes, { price_eur: 4.99, price_checked_at: NOW })
      assert.deepEqual(
        result.blockers,
        entry.conflict ? ["commerce_availability_conflict: shop reports not buyable"] : [],
      )
      assertPriceOnly(result)
    })
  }
})

test("commerce preserves both anomaly and structured availability blockers", async () => {
  const result = await run(final(), {
    jsonLdFetch: page({ price: 501, availability: "https://schema.org/OutOfStock" }),
  })
  assert.equal(result.artifact.status, "conflict")
  assert.deepEqual(result.blockers, [
    "commerce_availability_conflict: shop reports not buyable",
    "commerce_price_anomaly: 501",
  ])
  assert.deepEqual(result.writes, {})
})

test("applying commerce writes changes only supplied price fields", () => {
  const payload = final()
  const expected = structuredClone(payload)
  Object.assign(expected.product as JsonRecord, { price_eur: 4.99, price_checked_at: NOW })
  applyCommerceWrites(payload, {
    price_eur: 4.99,
    price_checked_at: NOW,
    purchase_link_status: "unavailable",
  } as CommerceStageResult["writes"])
  assert.deepEqual(payload, expected)
  applyCommerceWrites(payload, {})
  assert.deepEqual(payload, expected)
  applyCommerceWrites(payload, { price_eur: 5 })
  assert.equal((payload.product as JsonRecord).price_checked_at, NOW)
  const absent: JsonRecord = {}
  applyCommerceWrites(absent, {})
  assert.deepEqual(absent, {})
})
