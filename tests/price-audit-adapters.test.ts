import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { observeViaDm } from "../src/lib/price-audit/adapters/dm"
import { observeViaJsonLd, type JsonLdFetch } from "../src/lib/price-audit/adapters/json-ld"
import { hostAutoWriteEnabled, PROBE_DIR } from "../src/lib/price-audit/adapters"
import type { PriceAuditCandidate } from "../src/lib/price-audit/contracts"

const ROSSMANN_URL = "https://www.rossmann.de/de/pflege-test/p/4015100813494"

function candidate(overrides: Partial<PriceAuditCandidate> = {}): PriceAuditCandidate {
  return {
    id: "product-1",
    name: "Gliss Ultimate Repair Spülung",
    brand: "Gliss",
    affiliateLink: ROSSMANN_URL,
    priceEur: 4.49,
    priceCheckedAt: "2026-06-09T00:00:00.000Z",
    purchaseLinkStatus: "available",
    isChaarlieRecommended: true,
    canonicalGtin14s: ["04015100813494"],
    ...overrides,
  }
}

function pageWithJsonLd(product: Record<string, unknown>, url = ROSSMANN_URL): JsonLdFetch {
  const html = `<html><head><script type="application/ld+json">${JSON.stringify(
    product,
  )}</script></head><body>In den Warenkorb</body></html>`
  return async () => ({ ok: true, status: 200, url, text: async () => html })
}

test("json-ld adapter confirms via gtin match with price and stock", async () => {
  const observation = await observeViaJsonLd(candidate(), {
    fetch: pageWithJsonLd({
      "@type": "Product",
      name: "GLISS Ultimate Repair Express-Repair-Spülung",
      gtin13: "4015100813494",
      offers: {
        "@type": "Offer",
        price: "4,99",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
      },
    }),
  })
  assert.deepEqual(observation, {
    kind: "confirmed",
    identity: "gtin_match",
    priceEur: 4.99,
    buyable: true,
    buyableSource: "structured",
    evidenceUrl: ROSSMANN_URL,
    observedName: "GLISS Ultimate Repair Express-Repair-Spülung",
  })
})

test("json-ld adapter reports out-of-stock as confirmed but not buyable", async () => {
  const observation = await observeViaJsonLd(candidate(), {
    fetch: pageWithJsonLd({
      "@type": "Product",
      name: "GLISS Ultimate Repair Express-Repair-Spülung",
      gtin13: "4015100813494",
      offers: { price: 4.99, priceCurrency: "EUR", availability: "https://schema.org/OutOfStock" },
    }),
  })
  assert.equal(observation.kind, "confirmed")
  assert.equal(observation.kind === "confirmed" ? observation.buyable : null, false)
})

test("json-ld adapter flags a different gtin as mismatch", async () => {
  const observation = await observeViaJsonLd(candidate(), {
    fetch: pageWithJsonLd({
      "@type": "Product",
      name: "Ganz anderes Produkt",
      gtin13: "4072600703403",
      offers: { price: "3,99", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
    }),
  })
  assert.equal(observation.kind, "mismatch")
  assert.equal(observation.kind === "mismatch" ? observation.reason : null, "gtin_mismatch")
})

test("json-ld adapter accepts the stored pdp by name when no gtin is published", async () => {
  const observation = await observeViaJsonLd(candidate(), {
    fetch: pageWithJsonLd({
      "@type": "Product",
      name: "Gliss Ultimate Repair Express-Repair-Spülung 200 ml",
      offers: { price: "4,49", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
    }),
  })
  assert.equal(observation.kind, "confirmed")
  assert.equal(observation.kind === "confirmed" ? observation.identity : null, "exact_stored_pdp")
})

test("json-ld adapter rejects a dissimilar name without gtin", async () => {
  const observation = await observeViaJsonLd(candidate(), {
    fetch: pageWithJsonLd({
      "@type": "Product",
      name: "Balea Aqua Spülung",
      offers: { price: "1,95", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
    }),
  })
  assert.equal(observation.kind, "mismatch")
  assert.equal(observation.kind === "mismatch" ? observation.reason : null, "name_mismatch")
})

test("json-ld adapter treats a maintenance redirect as bot wall", async () => {
  const observation = await observeViaJsonLd(candidate(), {
    fetch: async () => ({
      ok: true,
      status: 200,
      url: "https://www.rossmann.de/wartung/index.html",
      text: async () => "<html>Wartung</html>",
    }),
  })
  assert.deepEqual(observation, { kind: "failed", reason: "bot_wall" })
})

test("json-ld adapter reports missing price data instead of guessing", async () => {
  const observation = await observeViaJsonLd(candidate(), {
    fetch: async () => ({
      ok: true,
      status: 200,
      url: ROSSMANN_URL,
      text: async () => "<html><body>Bitte JavaScript aktivieren</body></html>",
    }),
  })
  assert.equal(observation.kind, "mismatch")
  assert.equal(observation.kind === "mismatch" ? observation.reason : null, "no_price_found")
})

const DM_ROW = {
  gtin: "3600542461030",
  dan: "1670316",
  brand: "Wahre Schätze",
  title: "Shampoo Honig Schätze, 400 ml",
  price: "3,45 €",
  appLink: "https://www.dm.de/applink/p/d/1670316/x?wt_mc=dm-mcp",
  sellout: "false",
  purchasable: "true",
}

test("dm adapter queries by brand+name (never raw gtin) and matches the row by gtin", async () => {
  const queries: string[] = []
  const observation = await observeViaDm(
    candidate({
      name: "Wahre Schätze Shampoo Honig",
      brand: "Garnier",
      affiliateLink: "https://www.dm.de/p/d/1670316/wahre-schaetze-shampoo",
      canonicalGtin14s: ["03600542461030"],
    }),
    {
      search: async (query) => {
        queries.push(query)
        return [DM_ROW]
      },
    },
  )
  assert.deepEqual(queries, ["Garnier Wahre Schätze Shampoo Honig"])
  assert.deepEqual(observation, {
    kind: "confirmed",
    identity: "gtin_match",
    priceEur: 3.45,
    buyable: true,
    buyableSource: "structured",
    evidenceUrl: "https://www.dm.de/p/d/1670316/wahre-schaetze-shampoo",
    observedName: "Shampoo Honig Schätze, 400 ml",
  })
})

test("dm adapter ties identity to the legacy gtin-in-url link shape too", async () => {
  const observation = await observeViaDm(
    candidate({
      affiliateLink: "https://www.dm.de/wahre-schaetze-shampoo-p3600542461030.html",
      canonicalGtin14s: ["03600542461030"],
    }),
    { search: async () => [DM_ROW] },
  )
  assert.equal(observation.kind, "confirmed")
})

test("dm adapter treats a diverging stored link as a review case, never a write", async () => {
  const observation = await observeViaDm(
    candidate({
      affiliateLink: "https://www.dm.de/p/d/9999999/anderes-produkt",
      canonicalGtin14s: ["03600542461030"],
    }),
    { search: async () => [DM_ROW] },
  )
  assert.equal(observation.kind, "mismatch")
  assert.equal(observation.kind === "mismatch" ? observation.reason : null, "stored_link_mismatch")
})

test("dm adapter reports sellout as structured unavailability", async () => {
  const observation = await observeViaDm(
    candidate({
      affiliateLink: "https://www.dm.de/p/d/1670316/wahre-schaetze-shampoo",
      canonicalGtin14s: ["03600542461030"],
    }),
    { search: async () => [{ ...DM_ROW, sellout: "true" }] },
  )
  assert.equal(observation.kind, "confirmed")
  assert.equal(observation.kind === "confirmed" ? observation.buyable : null, false)
  assert.equal(observation.kind === "confirmed" ? observation.buyableSource : null, "structured")
})

test("dm adapter recovers a dropped leading zero in the search gtin", async () => {
  const observation = await observeViaDm(
    candidate({
      affiliateLink: "https://www.dm.de/p/d/1442074/x",
      canonicalGtin14s: ["00022796972200"],
    }),
    { search: async () => [{ ...DM_ROW, gtin: "22796972200", dan: "1442074" }] },
  )
  assert.equal(observation.kind, "confirmed")
})

test("dm adapter reports an empty search result as not_found", async () => {
  const observation = await observeViaDm(
    candidate({
      affiliateLink: "https://www.dm.de/p/d/123/test",
      canonicalGtin14s: ["03600542461030"],
    }),
    { search: async () => [] },
  )
  assert.equal(observation.kind, "mismatch")
  assert.equal(observation.kind === "mismatch" ? observation.reason : null, "not_found")
})

test("probe gate needs a passing, reviewed, unexpired probe", () => {
  const base = mkdtempSync(join(tmpdir(), "price-audit-probe-"))
  mkdirSync(join(base, PROBE_DIR), { recursive: true })
  const now = Date.parse("2026-09-30T12:00:00.000Z")
  writeFileSync(
    join(base, PROBE_DIR, "dm.de.json"),
    JSON.stringify({
      host: "dm.de",
      probedAt: "2026-09-29T00:00:00.000Z",
      enabledForAutoWrite: true,
      reviewedBy: "nick",
      reviewedAt: "2026-09-29T10:00:00.000Z",
    }),
  )
  writeFileSync(
    join(base, PROBE_DIR, "rossmann.de.json"),
    JSON.stringify({
      host: "rossmann.de",
      probedAt: "2026-09-29T00:00:00.000Z",
      enabledForAutoWrite: false,
      reviewedBy: "nick",
      reviewedAt: "2026-09-29T10:00:00.000Z",
    }),
  )
  writeFileSync(
    join(base, PROBE_DIR, "mueller.de.json"),
    JSON.stringify({
      host: "mueller.de",
      probedAt: "2026-09-29T00:00:00.000Z",
      enabledForAutoWrite: true,
      reviewedBy: null,
      reviewedAt: null,
    }),
  )
  writeFileSync(
    join(base, PROBE_DIR, "douglas.de.json"),
    JSON.stringify({
      host: "douglas.de",
      probedAt: "2026-06-01T00:00:00.000Z",
      enabledForAutoWrite: true,
      reviewedBy: "nick",
      reviewedAt: "2026-06-01T10:00:00.000Z",
    }),
  )
  assert.equal(hostAutoWriteEnabled("dm.de", base, now), true)
  assert.equal(hostAutoWriteEnabled("rossmann.de", base, now), false, "probe failed")
  assert.equal(hostAutoWriteEnabled("mueller.de", base, now), false, "not reviewed")
  assert.equal(hostAutoWriteEnabled("douglas.de", base, now), false, "probe expired")
  assert.equal(hostAutoWriteEnabled("flaconi.de", base, now), false, "no probe file")
  assert.equal(hostAutoWriteEnabled(null, base, now), false)
})
