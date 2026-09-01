import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("the Stage 5 V2 artifact carries forward every approved oil authority protocol", () => {
  const source = JSON.parse(
    readFileSync("data/catalog-enrichment/oil-authority-enrichment-v1/manifest.json", "utf8"),
  )
  const artifact = JSON.parse(
    readFileSync(
      "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json",
      "utf8",
    ),
  )
  const protocols = source.entries.flatMap(
    (entry: {
      productId: string
      intendedAuthority: {
        protocols: Array<{ role: string; applicationFamily: string }>
      }
    }) =>
      entry.intendedAuthority.protocols.map((protocol) => ({
        productId: entry.productId,
        role: protocol.role,
        applicationFamily: protocol.applicationFamily,
      })),
  )

  assert.equal(source.review.state, "approved")
  assert.equal(source.review.reviewedBy, "nick")
  assert.equal(protocols.length, 18)
  for (const protocol of protocols) {
    const matches = artifact.items.filter(
      (item: {
        product_id: string
        source_role: string
        guidance_payload_v2: { applicationFamily: string }
      }) =>
        item.product_id === protocol.productId &&
        item.source_role === protocol.role &&
        item.guidance_payload_v2.applicationFamily === protocol.applicationFamily,
    )
    assert.equal(matches.length, 1, JSON.stringify(protocol))
    assert.equal(matches[0].guidance_payload_v2.runtimeBlockerCode, null)
  }
})
