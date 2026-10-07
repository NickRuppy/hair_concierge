import assert from "node:assert/strict"
import test from "node:test"

import {
  presentScanVerdictPayload,
  toScanProductHeader,
  type ScanCatalogPresentationRow,
} from "../src/lib/scan/product-presentation"
import type {
  ScanInCatalogVerdictPayload,
  ScanNotNeededVerdictPayload,
} from "../src/lib/scan/types"

const scannedId = "22222222-2222-4222-8222-222222222222"
const alternativeId = "33333333-3333-4333-8333-333333333333"

function row(overrides: Partial<ScanCatalogPresentationRow> = {}): ScanCatalogPresentationRow {
  return {
    id: scannedId,
    name: "Repair Shampoo",
    brand: "Olaplex",
    category: "shampoo",
    imageUrl: "https://example.test/a.jpg",
    priceEur: 24.9,
    currency: "EUR",
    affiliateLink: "https://shop.test/a",
    purchaseLinkStatus: "available",
    priceCheckedAt: "2026-08-19T00:00:00.000Z",
    ...overrides,
  }
}

const inCatalog: ScanInCatalogVerdictPayload = {
  kind: "in_catalog",
  verdict: "mismatch",
  verdictLabel: "Passt nicht",
  verdictTitle: "Passt nicht zu deinem Haar",
  status: "danger",
  subtitle: "1 von 3 Zielbereichen getroffen",
  evaluatedRole: null,
  evaluatedRoleLabel: null,
  dimensions: [],
  criteria: [],
  coverage: { matches: 1, total: 3 },
  fitNarrative: null,
  alternatives: [
    {
      productId: alternativeId,
      displayName: "Sanftes Shampoo",
      imageUrl: null,
      priceLabel: "18,00\u00a0€",
      netContentLabel: "250 ml",
      verdict: "ideal",
      verdictLabel: "Passt",
    },
  ],
}

const notNeeded: ScanNotNeededVerdictPayload = {
  kind: "not_needed",
  mode: "not_needed",
  status: "neutral",
  headline: "Du brauchst aktuell keine Maske",
  subtitle: "Keine Maske in deinem Bedarf",
  reasons: [],
  dimensions: [],
  coveredBy: [],
}

test("product header renders name, brand, category label and commerce", () => {
  const header = toScanProductHeader(row())
  assert.deepEqual(header, {
    productId: scannedId,
    name: "Repair Shampoo",
    brand: "Olaplex",
    category: "shampoo",
    categoryLabel: "Shampoo",
    imageUrl: "https://example.test/a.jpg",
    priceLabel: "24,90\u00a0€",
    purchaseUrl: "https://shop.test/a",
  })
})

test("product header hides the purchase link when the link is not available", () => {
  const header = toScanProductHeader(row({ purchaseLinkStatus: "unavailable" }))
  assert.equal(header.purchaseUrl, null)
  // A known price stays visible even without a buyable link.
  assert.equal(header.priceLabel, "24,90\u00a0€")
})

test("product header drops a price without a currency instead of assuming EUR", () => {
  assert.equal(toScanProductHeader(row({ currency: null })).priceLabel, null)
})

test("presented verdict joins brand and purchase url onto alternatives", () => {
  const presented = presentScanVerdictPayload(inCatalog, [
    row(),
    row({
      id: alternativeId,
      name: "Sanftes Shampoo",
      brand: "Kérastase",
      affiliateLink: "https://shop.test/b",
    }),
  ])
  assert.equal(presented.kind, "in_catalog")
  if (presented.kind !== "in_catalog") return
  assert.equal(presented.alternatives[0].brand, "Kérastase")
  assert.equal(presented.alternatives[0].purchaseUrl, "https://shop.test/b")
  // Verdict-core fields pass through untouched.
  assert.equal(presented.alternatives[0].priceLabel, "18,00\u00a0€")
  assert.equal(presented.verdictTitle, "Passt nicht zu deinem Haar")
})

test("presented verdict leaves alternatives without a catalog row quiet, not broken", () => {
  const presented = presentScanVerdictPayload(inCatalog, [row()])
  if (presented.kind !== "in_catalog") throw new Error("expected in_catalog")
  assert.equal(presented.alternatives[0].brand, null)
  assert.equal(presented.alternatives[0].purchaseUrl, null)
})

test("presented verdict passes the not_needed payload through unchanged", () => {
  const presented = presentScanVerdictPayload(notNeeded, [row()])
  assert.deepEqual(presented, notNeeded)
})
