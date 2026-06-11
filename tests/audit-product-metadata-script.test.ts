import assert from "node:assert/strict"
import test from "node:test"

import { checkStoredLinkBuyability } from "../scripts/audit-product-metadata"
import type { ProductMetadataAuditInput } from "../src/lib/product-metadata/health"

function buildProduct(overrides: Partial<ProductMetadataAuditInput>): ProductMetadataAuditInput {
  return {
    id: "product-1",
    name: "Test Product",
    brand: "Test Brand",
    category: "Conditioner",
    affiliate_link: "https://www.rossmann.de/de/test/p/123",
    image_url: null,
    price_eur: null,
    purchase_link_status: null,
    is_active: true,
    ...overrides,
  }
}

test("checkStoredLinkBuyability returns unavailable for missing or unusable links", async () => {
  assert.equal(
    await checkStoredLinkBuyability(buildProduct({ affiliate_link: null })),
    "unavailable",
  )
  assert.equal(
    await checkStoredLinkBuyability(buildProduct({ affiliate_link: "kein-link" })),
    "unavailable",
  )
})

test("checkStoredLinkBuyability classifies known retailer content", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    new Response("<html><body>Online momentan nicht verfügbar</body></html>", { status: 200 })

  try {
    const status = await checkStoredLinkBuyability(
      buildProduct({ affiliate_link: "https://www.rossmann.de/de/pflege-und-duft-test/p/123" }),
    )
    assert.equal(status, "unavailable")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("checkStoredLinkBuyability lets unavailable dm text win over cart markup", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    new Response("<html><body>Nicht lieferbar In den Warenkorb</body></html>", { status: 200 })

  try {
    const status = await checkStoredLinkBuyability(
      buildProduct({ affiliate_link: "https://www.dm.de/p/d/123/test-product" }),
    )
    assert.equal(status, "unavailable")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("checkStoredLinkBuyability lets unavailable Mueller text win over cart markup", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    new Response("<html><body>Nicht lieferbar In den Warenkorb</body></html>", { status: 200 })

  try {
    const status = await checkStoredLinkBuyability(
      buildProduct({ affiliate_link: "https://www.mueller.de/p/test-product-PPN123/" }),
    )
    assert.equal(status, "unavailable")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("checkStoredLinkBuyability lets generic unavailable Rossmann text win over cart markup", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    new Response("<html><body>Nicht verfügbar Zum Warenkorb</body></html>", { status: 200 })

  try {
    const status = await checkStoredLinkBuyability(
      buildProduct({ affiliate_link: "https://www.rossmann.de/de/test-product/p/123456789" }),
    )
    assert.equal(status, "unavailable")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("checkStoredLinkBuyability returns manual-review null for inconclusive fetch results", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    new Response("<html><body>Bitte aktivieren Sie JavaScript</body></html>")

  try {
    const status = await checkStoredLinkBuyability(
      buildProduct({ affiliate_link: "https://www.rossmann.de/de/pflege-und-duft-test/p/123" }),
    )
    assert.equal(status, null)
  } finally {
    globalThis.fetch = originalFetch
  }
})
