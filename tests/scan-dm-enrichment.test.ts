import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { DmMcpError, type DmProductDetailsRow } from "../src/lib/scan/enrichment/dm-mcp-client"
import { resolveRetailerEnrichment } from "../src/lib/scan/enrichment/resolve-enrichment"
import {
  isRetailerEnrichmentEnabled,
  retailerEnrichmentTimeoutMs,
} from "../src/lib/scan/enrichment/flag"
import { parseToonTable } from "../src/lib/scan/enrichment/toon"

const rows = parseToonTable(
  readFileSync(new URL("./fixtures/dm-mcp/details-all-gtins.txt", import.meta.url), "utf8"),
)
const weleda = rows.find((row) => row.gtin === "4001638530378")!
function deps(result: DmProductDetailsRow[] = [weleda]) {
  let calls = 0
  let clock = 0
  const warnings: unknown[] = []
  const args: unknown[] = []
  return {
    client: {
      async getProductDetails(gtins: string[]) {
        calls++
        args.push(gtins)
        clock += 73
        return result
      },
    },
    flag: () => true,
    now: () => "2026-09-17T12:00:00.000Z",
    monotonicNow: () => clock,
    deadlineMs: 1500,
    route: "resolve" as const,
    reportUnexpected: (warning: unknown) => {
      warnings.push(warning)
    },
    calls: () => calls,
    warnings,
    args,
  }
}
test("exact canonical hit maps the trusted draft and measured lookup", async () => {
  const d = deps()
  const result = await resolveRetailerEnrichment("4001638530378", d)
  assert.equal(result.outcome, "hit")
  assert.equal(result.durationMs, 73)
  assert.equal(result.deadlineMs, 1500)
  assert.deepEqual(d.args, [["04001638530378"]])
  assert.deepEqual(result.enrichment, {
    source: "dm",
    fetchedAt: "2026-09-17T12:00:00.000Z",
    gtin: "04001638530378",
    dan: "2973187",
    productName: "Shampoo Rosmarin Revitalising, 250 ml",
    brand: "WELEDA",
    imageUrl: weleda.image,
    productUrl: weleda.productUrl,
    ingredientsText: weleda.nonFoodIngredients,
    description: weleda.description,
    keyBenefits: weleda.keyBenefits,
    suggestedCategory: "shampoo",
  })
  assert.deepEqual(d.warnings, [])
})
test("EAN-13/GTIN-14 and EAN-8 spellings match; false rows remain not found", async () => {
  assert.equal((await resolveRetailerEnrichment("04001638530378", deps())).outcome, "hit")
  assert.equal(
    (await resolveRetailerEnrichment("96385074", deps([{ ...weleda, gtin: "00000096385074" }])))
      .enrichment?.gtin,
    "00000096385074",
  )
  const d = deps([{ gtin: "4001638530378", found: "false" }])
  assert.equal((await resolveRetailerEnrichment("4001638530378", d)).outcome, "not_found")
  assert.deepEqual(d.warnings, [])
})
test("wrong generation GTIN cannot seed identity; warning carries only route and reason", async () => {
  const d = deps([{ ...weleda, gtin: "4262391991626" }])
  assert.equal((await resolveRetailerEnrichment("4001638530378", d)).outcome, "gtin_mismatch")
  assert.deepEqual(d.warnings, [{ route: "resolve", reason: "gtin_mismatch" }])
})
test("flag off and invalid check digit skip the outbound call and all timing", async () => {
  const disabled = deps()
  assert.deepEqual(
    await resolveRetailerEnrichment("4001638530378", { ...disabled, flag: () => false }),
    { enrichment: null, outcome: "disabled", durationMs: null, deadlineMs: null },
  )
  assert.equal(disabled.calls(), 0)
  const invalid = deps()
  assert.deepEqual(await resolveRetailerEnrichment("4001638530379", invalid), {
    enrichment: null,
    outcome: "invalid_gtin",
    durationMs: null,
    deadlineMs: null,
  })
  assert.equal(invalid.calls(), 0)
})
test("all failures fail open and expected timeout does not alert", async () => {
  for (const reason of [
    "timeout",
    "transport",
    "malformed",
    "session_expired",
    "unexpected",
  ] as const) {
    const d = deps()
    d.client.getProductDetails = async () => {
      throw reason === "unexpected" ? new Error("SECRET URL GTIN") : new DmMcpError(reason)
    }
    const result = await resolveRetailerEnrichment("4001638530378", d)
    assert.equal(result.enrichment, null)
    assert.equal(result.outcome, reason)
    assert.deepEqual(d.warnings, reason === "timeout" ? [] : [{ route: "resolve", reason }])
  }
})
test("invalid image hosts, protocol, path, credentials and port become a placeholder", async () => {
  for (const image of [
    "",
    "javascript:alert(1)",
    "http://products.dm-static.com/images/a",
    "https://products.dm-static.com.evil.test/images/a",
    "https://products.dm-static.com/other/a",
    "https://user:pass@products.dm-static.com/images/a",
    "https://products.dm-static.com:444/images/a",
    "https://products.dm-static.com/images/../other/a",
  ]) {
    const result = await resolveRetailerEnrichment("4001638530378", deps([{ ...weleda, image }]))
    assert.equal(result.outcome, "hit", image)
    assert.equal(result.enrichment?.imageUrl, null, image)
  }
})
test("required identity and row shape must be valid, optional empty cells map to null", async () => {
  for (const row of [
    { ...weleda, productName: "" },
    { ...weleda, dan: "12" },
    { ...weleda, found: "maybe" },
  ]) {
    assert.equal(
      (await resolveRetailerEnrichment("4001638530378", deps([row]))).outcome,
      "malformed",
    )
  }
  const result = await resolveRetailerEnrichment(
    "4001638530378",
    deps([
      {
        ...weleda,
        brand: "",
        nonFoodIngredients: "",
        description: "",
        keyBenefits: "",
        productUrl: "",
      },
    ]),
  )
  assert.equal(result.enrichment?.brand, null)
  assert.equal(result.enrichment?.ingredientsText, null)
  assert.equal(result.enrichment?.description, null)
  assert.equal(result.enrichment?.keyBenefits, null)
  assert.equal(result.enrichment?.productUrl, null)
})
test("reporting failure cannot turn enrichment failure into a scan failure", async () => {
  const d = deps([{ ...weleda, gtin: "4262391991626" }])
  d.reportUnexpected = () => {
    throw new Error("sink unavailable")
  }
  assert.equal((await resolveRetailerEnrichment("4001638530378", d)).enrichment, null)
})
test("timeout configuration is bounded and feature flag is exact opt-in", () => {
  for (const value of [undefined, "", "abc", "NaN", "Infinity", "-1", "0", "10001", "1.5"])
    assert.equal(retailerEnrichmentTimeoutMs(value), 1500)
  for (const value of ["1", "1500", "10000"])
    assert.equal(retailerEnrichmentTimeoutMs(value), Number(value))
  const previous = process.env.SCAN_RETAILER_ENRICHMENT_ENABLED
  try {
    for (const value of ["true", "false", "TRUE", "1", ""]) {
      process.env.SCAN_RETAILER_ENRICHMENT_ENABLED = value
      assert.equal(isRetailerEnrichmentEnabled(), value === "true")
    }
  } finally {
    if (previous === undefined) delete process.env.SCAN_RETAILER_ENRICHMENT_ENABLED
    else process.env.SCAN_RETAILER_ENRICHMENT_ENABLED = previous
  }
})
