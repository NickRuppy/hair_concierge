import assert from "node:assert/strict"
import test from "node:test"
import { createClient } from "@supabase/supabase-js"
import {
  loadMobileHistory,
  parseHistoryCursor,
  recordMobileHistory,
  saveMobileHistory,
} from "../src/lib/mobile/history-service"
import {
  mobileScanResolveRequestSchema,
  mobileScanResolveResultSchema,
} from "../src/lib/mobile/scan-contracts"

const owner = "11111111-1111-4111-8111-111111111111"
const product = "22222222-2222-4222-8222-222222222222"
const submission = "33333333-3333-4333-8333-333333333333"
const row = {
  id: owner,
  barcode_ean: "4012345678901",
  barcode_gtin14: "04012345678901",
  product_id: null,
  submission_id: null,
  last_seen_at: "2026-09-18T10:00:00.123456+00:00",
}
const productRow = {
  id: product,
  name: "Test Shampoo",
  brand: "Marke",
  image_url: "https://example.test/image.jpg",
  category_key: "shampoo",
  is_active: true,
  lifecycle_status: "active",
}
function client(handler: (url: URL, body: unknown) => unknown) {
  return createClient("https://db.example.test", "synthetic-service", {
    auth: { persistSession: false },
    global: {
      fetch: async (input, init) => {
        const response = handler(
          new URL(String(input)),
          init?.body ? JSON.parse(String(init.body)) : null,
        )
        return response instanceof Response ? response : Response.json(response)
      },
    },
  })
}

test("history writes only resolved openings, keeps old request compatibility and fail-open result semantics", async () => {
  const writes: unknown[] = []
  const db = client((url, body) => {
    assert.equal(url.pathname, "/rest/v1/rpc/mobile_scan_history_touch")
    writes.push(body)
    return owner
  })
  const input = mobileScanResolveRequestSchema.parse({
    identifier: { type: "ean", value: "4012345678901" },
  })
  const unknown = {
    contractVersion: 1 as const,
    kind: "submission_required" as const,
    productId: null,
    missingFacts: ["unknown_product"],
  }
  assert.equal(await recordMobileHistory(db, owner, input, unknown), true)
  assert.deepEqual(writes, [
    { p_user_id: owner, p_barcode_ean: "4012345678901", p_product_id: null, p_submission_id: null },
  ])
  assert.equal(
    await recordMobileHistory(db, owner, { ...input, recordHistory: false }, unknown),
    undefined,
  )
  assert.equal(await recordMobileHistory(db, owner, { productId: product }, unknown), undefined)
  assert.equal(
    await recordMobileHistory(db, owner, input, { contractVersion: 1, kind: "profile_required" }),
    undefined,
  )
  assert.equal(
    await recordMobileHistory(db, owner, input, {
      contractVersion: 1,
      kind: "retryable_error",
      code: "offline",
    }),
    undefined,
  )
  assert.equal(
    await recordMobileHistory(db, owner, input, {
      contractVersion: 1,
      kind: "authority_unavailable",
      productId: product,
      reason: "temporarily_unavailable",
      missingFacts: ["authority"],
    }),
    undefined,
  )
  assert.equal(writes.length, 1)
  assert.equal(
    await recordMobileHistory(
      db,
      owner,
      { productId: product },
      {
        contractVersion: 1,
        kind: "authority_unavailable",
        productId: product,
        reason: "personal_target_unavailable",
        missingFacts: ["personal_target"],
      },
    ),
    true,
  )
  assert.equal(
    await recordMobileHistory(
      db,
      owner,
      { productId: product },
      { ...unknown, productId: product },
    ),
    true,
  )
  assert.deepEqual(writes[2], {
    p_user_id: owner,
    p_barcode_ean: null,
    p_product_id: product,
    p_submission_id: null,
  })
  assert.equal(
    await saveMobileHistory(
      client(() => new Response("unavailable", { status: 503 })),
      owner,
      input.identifier!.value,
      null,
    ),
    false,
  )
  assert.deepEqual(mobileScanResolveResultSchema.parse(unknown), unknown)
  assert.equal(
    mobileScanResolveResultSchema.parse({ ...unknown, historySaved: false }).historySaved,
    false,
  )
  assert.equal(
    mobileScanResolveRequestSchema.safeParse({ ...input, userId: "someone_else" }).success,
    false,
  )
})

test("history status comes from live owner research and catalog state without cached verdict", async () => {
  let requestStatus: string | null = null,
    active = false,
    linked = false,
    quarantine = false
  const db = client((url) => {
    switch (url.pathname) {
      case "/rest/v1/mobile_scan_history":
        assert.equal(url.searchParams.get("user_id"), `eq.${owner}`)
        return [{ ...row, submission_id: linked ? submission : null }]
      case "/rest/v1/product_identifiers":
        return active ? [{ product_id: product, canonical_gtin14: row.barcode_gtin14 }] : []
      case "/rest/v1/product_submissions":
        assert.equal(url.searchParams.get("user_id"), `eq.${owner}`)
        assert.equal(url.searchParams.get("source"), "eq.scan")
        return requestStatus
          ? [
              {
                id: submission,
                scanned_identifier_value: row.barcode_ean,
                status: requestStatus,
                approved_product_id: active ? product : null,
              },
            ]
          : []
      case "/rest/v1/products":
        return [productRow]
      case "/rest/v1/personal_plan_product_search_dispositions":
        return quarantine ? [{ product_id: product }] : []
      default:
        assert.fail(url.toString())
    }
  })
  assert.equal((await loadMobileHistory(db, owner)).entries[0].status, "not_in_catalog")
  requestStatus = "researching"
  // Confirmed request remains visible even when its History linkage failed.
  assert.equal((await loadMobileHistory(db, owner)).entries[0].status, "in_research")
  linked = true
  active = true
  assert.equal((await loadMobileHistory(db, owner)).entries[0].status, "in_research")
  requestStatus = "approved"
  const available = (await loadMobileHistory(db, owner)).entries[0]
  assert.equal(available.status, "available")
  assert.equal(available.productName, "Test Shampoo")
  assert.equal(available.barcodeGtin, row.barcode_ean)
  assert.equal("verdict" in available, false)
  quarantine = true
  const quarantined = (await loadMobileHistory(db, owner)).entries[0]
  assert.equal(quarantined.status, "unavailable")
  assert.equal(quarantined.productName, null)
  assert.equal(quarantined.brand, null)
  assert.equal(quarantined.imageUrl, null)
  assert.equal(quarantined.barcodeGtin, row.barcode_ean)
  assert.equal(quarantined.productId, product)
  requestStatus = "researching"
  const research = (await loadMobileHistory(db, owner)).entries[0]
  assert.equal(research.status, "in_research")
  assert.equal(research.productName, null)
  assert.equal(research.brand, null)
  assert.equal(research.imageUrl, null)
  quarantine = false
  requestStatus = "approved"
  assert.equal((await loadMobileHistory(db, owner)).entries[0].productName, "Test Shampoo")
  active = false
  requestStatus = "rejected"
  assert.equal((await loadMobileHistory(db, owner)).entries[0].status, "unavailable")
})

test("history pages preserve timestamp precision, use owner keyset boundary and exact canonical barcode filter", async () => {
  const seen: URL[] = []
  const rows = Array.from({ length: 101 }, (_, i) => ({
    ...row,
    id: `00000000-0000-4000-8000-${String(200 - i).padStart(12, "0")}`,
  }))
  const db = client((url) => {
    if (url.pathname === "/rest/v1/mobile_scan_history") {
      seen.push(url)
      return url.searchParams.has("or") ? [rows[100]] : rows
    }
    return []
  })
  const first = await loadMobileHistory(db, owner)
  assert.equal(first.entries.length, 100)
  assert.ok(first.nextCursor)
  assert.deepEqual(parseHistoryCursor(first.nextCursor), {
    time: row.last_seen_at,
    id: rows[99].id,
  })
  const second = await loadMobileHistory(db, owner, first.nextCursor)
  assert.equal(second.entries.length, 1)
  assert.equal(second.nextCursor, null)
  assert.ok(seen[1].searchParams.get("or")?.includes(row.last_seen_at))
  await loadMobileHistory(db, owner, null, "4012345678901")
  assert.equal(seen[2].searchParams.get("barcode_gtin14"), "eq.04012345678901")
  await assert.rejects(loadMobileHistory(db, owner, null, "4012345678902"), /invalid_identifier/)
  assert.throws(
    () =>
      parseHistoryCursor(
        Buffer.from(JSON.stringify({ time: "bad)or(user_id.eq.other", id: owner })).toString(
          "base64url",
        ),
      ),
    /invalid_request/,
  )
})

test("barcode history availability follows its current mapping, while product-only history remains available", async () => {
  const replacement = "44444444-4444-4444-8444-444444444444"
  let historyRow = {
    ...row,
    product_id: product,
    barcode_ean: row.barcode_ean as string | null,
    barcode_gtin14: row.barcode_gtin14 as string | null,
  }
  let mappedProduct: string | null = null
  const db = client((url) => {
    switch (url.pathname) {
      case "/rest/v1/mobile_scan_history":
        return [historyRow]
      case "/rest/v1/product_identifiers":
        return mappedProduct
          ? [{ canonical_gtin14: row.barcode_gtin14, product_id: mappedProduct }]
          : []
      case "/rest/v1/product_submissions":
        return []
      case "/rest/v1/personal_plan_product_search_dispositions":
        return []
      case "/rest/v1/products":
        return [productRow, { ...productRow, id: replacement, name: "Corrected Shampoo" }]
      default:
        assert.fail(url.toString())
    }
  })
  const stale = (await loadMobileHistory(db, owner)).entries[0]
  assert.equal(stale.status, "unavailable")
  assert.equal(stale.productId, product)
  assert.equal(stale.productName, "Test Shampoo")
  assert.equal(stale.barcodeGtin, row.barcode_ean)
  mappedProduct = replacement
  const corrected = (await loadMobileHistory(db, owner)).entries[0]
  assert.equal(corrected.status, "available")
  assert.equal(corrected.productId, replacement)
  assert.equal(corrected.productName, "Corrected Shampoo")
  historyRow = { ...historyRow, barcode_ean: null, barcode_gtin14: null }
  mappedProduct = null
  const productOnly = (await loadMobileHistory(db, owner)).entries[0]
  assert.equal(productOnly.status, "available")
  assert.equal(productOnly.productId, product)
})

test("history data failures are errors, never an empty-history success", async () => {
  await assert.rejects(
    loadMobileHistory(
      client(() => new Response("unavailable", { status: 503 })),
      owner,
    ),
    /temporarily_unavailable/,
  )
})
