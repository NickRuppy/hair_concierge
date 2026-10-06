import assert from "node:assert/strict"
import test from "node:test"

import { buildBrandResolutionPromptContext } from "../src/lib/product-intake/pipeline/identity"
import { normalizeResearchOutputForCategory } from "../scripts/product-intake/codex-research-worker"
import type { BrandResolutionCatalogInput } from "../src/lib/product-identity/brand-resolution"
import type { ProductIntakeReviewDecisionRow } from "@chaarlie/product-intake-core"

const catalog: BrandResolutionCatalogInput = {
  brands: [
    { id: "loreal", canonical_name: "L'Oréal Professionnel" },
    { id: "wella", canonical_name: "Wella Professionals" },
    { id: "other", canonical_name: "Other Brand" },
  ],
  productLines: [{ id: "line", brand_id: "loreal", canonical_name: "Serie Expert" }],
  brandAliases: [
    { brand_id: "loreal", product_line_id: "line", alias: "Expert" },
    { brand_id: "loreal", alias: "Shared Brand" },
    { brand_id: "other", alias: "Shared Brand" },
  ],
}

function run(
  proposed: string,
  submitted = "",
  decisions: ProductIntakeReviewDecisionRow[] = [],
  blockers: string[] = [],
) {
  const context = buildBrandResolutionPromptContext(null, catalog, null)
  if (submitted) {
    context.resolved_brand = { canonical_brand: submitted, canonical_brand_id: "wella" }
  }
  return normalizeResearchOutputForCategory(
    {
      summary: "Research",
      blockers,
      artifacts: [{ kind: "identity_candidate", payload: { stage: "identity", invented: true } }],
      researched_payload: {
        final: {
          product: { canonical_brand: proposed, net_content_value: 250, net_content_unit: "ml" },
          identifiers: [
            { type: "ean", value: "4005808816422" },
            { type: "gtin", value: "04005808816422" },
            { type: "retailer_sku", value: "12345678" },
            { type: "barcode", value: "invalid" },
          ],
        },
      },
    },
    "mask",
    context,
    decisions,
    "submission",
    { brandCatalog: catalog },
  )
}

function identity(result: ReturnType<typeof run>) {
  const artifacts = result.artifacts.filter((artifact) => artifact.kind === "identity_candidate")
  assert.equal(artifacts.length, 1)
  return artifacts[0]!
}

for (const [proposal, expected, line] of [
  ["L'Oreal Professionnel", "L'Oréal Professionnel", null],
  ["Expert", "L'Oréal Professionnel", "Serie Expert"],
] as const) {
  test(`exact model proposal ${proposal} resolves to the existing catalog brand`, () => {
    const result = run(proposal)
    const product = (result.researched_payload!.final as Record<string, Record<string, unknown>>)
      .product!
    assert.equal(product.canonical_brand, expected)
    if (line) assert.equal(product.product_line, line)
    assert.ok(
      !result.blockers.some((reason) => reason.includes("canonical brand table resolution")),
    )
    const artifact = identity(result)
    assert.equal(artifact.status, "resolved")
    const brand = artifact.payload.brand_resolution as Record<string, unknown>
    assert.equal(brand.source, "model_proposal")
    assert.equal(brand.canonical_brand_id, "loreal")
    assert.equal(brand.proposed_brand, proposal)
    assert.deepEqual(artifact.payload.gtins, ["04005808816422"])
    assert.deepEqual(artifact.payload.net_content, { value: 250, unit: "ml" })
  })
}

for (const proposal of ["Shared Brand", "Wella", "Unknown Brand"]) {
  test(`${proposal} remains blocked without a unique exact catalog match`, () => {
    const result = run(proposal)
    assert.ok(
      result.blockers.some((reason) => reason.includes("canonical brand table resolution missing")),
    )
    const artifact = identity(result)
    assert.equal(artifact.status, "needs_review")
    const brand = artifact.payload.brand_resolution as Record<string, unknown>
    assert.equal(brand.canonical_brand_id, null)
    if (proposal !== "Unknown Brand")
      assert.ok((brand.nearby_brand_options as unknown[]).length > 0)
    const product = (result.researched_payload!.final as Record<string, Record<string, unknown>>)
      .product!
    assert.equal(product.canonical_brand, proposal)
  })
}

test("an approved brand decision wins over the model proposal", () => {
  const result = run("Expert", "", [
    {
      field_path: "product.canonical_brand",
      decision: "approved",
      reviewer_value: { canonical_brand: "Reviewed Brand" },
      proposed_value: {},
    } as ProductIntakeReviewDecisionRow,
  ])
  const brand = identity(result).payload.brand_resolution as Record<string, unknown>
  assert.equal(brand.source, "review_decision")
  assert.equal(brand.canonical_brand, "Reviewed Brand")
  assert.ok(!result.blockers.some((reason) => reason.includes("canonical brand table resolution")))
})

test("submitted-text resolution retains precedence over the model proposal", () => {
  const result = run("Expert", "Wella Professionals")
  const brand = identity(result).payload.brand_resolution as Record<string, unknown>
  assert.equal(brand.source, "submitted_text")
  assert.equal(brand.canonical_brand, "Wella Professionals")
})

test("a deterministic missing-resolution blocker is cleared when the catalog proposal resolves", () => {
  const result = run(
    "Expert",
    "",
    [],
    [
      "canonical brand table resolution missing for: Original text",
      "retain this unrelated blocker",
    ],
  )
  assert.ok(
    !result.blockers.some((reason) =>
      reason.startsWith("canonical brand table resolution missing for:"),
    ),
  )
  assert.ok(result.blockers.includes("retain this unrelated blocker"))
})
