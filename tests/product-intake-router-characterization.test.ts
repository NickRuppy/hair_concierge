import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  categoryApprovalContract,
  normalizeResearchOutputForCategory,
  type BrandResolutionPromptContext,
} from "../scripts/product-intake/codex-research-worker"
import type { ProductIntakeReviewDecisionRow } from "@chaarlie/product-intake-core"

type ResearchOutput = Parameters<typeof normalizeResearchOutputForCategory>[0]
type Capture = {
  submission_id: string
  category: string
  output: ResearchOutput
  review_decisions: ProductIntakeReviewDecisionRow[]
}

const fixtureRoot = new URL("./fixtures/product-intake-router/", import.meta.url)
const captures = JSON.parse(
  readFileSync(new URL("real-production-outputs.json", fixtureRoot), "utf8"),
) as { cases: Capture[] }
const brandContext: BrandResolutionPromptContext = {
  submitted_brand_text: "Characterization Brand",
  submitted_product_name_text: "Characterization Product",
  scanned_identifier: null,
  lookup_text: "Characterization Brand Characterization Product",
  resolved_brand: {
    canonical_brand_id: "11111111-1111-4111-8111-111111111111",
    canonical_brand: "Characterization Brand",
    product_line: null,
  },
  nearby_brand_options: [],
  catalog_summary: { brand_count: 1, product_line_count: 0, brand_alias_count: 0 },
  rules: [],
}
const categoryKeys = [
  "shampoo",
  "conditioner",
  "mask",
  "leave_in",
  "oil",
  "dry_shampoo",
  "deep_cleansing_shampoo",
  "bondbuilder",
  "heat_protectant",
  "scalp_care",
]

function adapterOwnedResult(capture: Capture) {
  const result = normalizeResearchOutputForCategory(
    structuredClone(capture.output),
    capture.category,
    structuredClone(brandContext),
    structuredClone(capture.review_decisions),
    capture.submission_id,
  )
  const final = result.researched_payload?.final as Record<string, unknown> | undefined
  const product = final?.product as Record<string, unknown> | undefined
  return {
    submission_id: capture.submission_id,
    category: capture.category,
    category_specs: final?.category_specs ?? null,
    suitable_thicknesses: product?.suitable_thicknesses ?? null,
    adapter_blockers: result.blockers.filter((blocker) =>
      /^(conditioner research adapter:|leave-in research adapter:|bondbuilder research adapter:|bondbuilder research engine)/.test(
        blocker,
      ),
    ),
    engine_projection_metadata: result.artifacts
      // Engine-only receipts are new routing provenance, not adapter projections.
      .filter(
        (artifact) =>
          artifact.kind === "property_synthesis" &&
          Object.keys(artifact.payload).some((key) => key !== "engine"),
      )
      .map((artifact) =>
        Object.fromEntries(
          Object.entries(artifact.payload).filter(([key]) =>
            /production_projection|adapter_warnings|omitted_research_properties|required_protocol_role|bondbuilder_property_coverage|^readiness$/.test(
              key,
            ),
          ),
        ),
      ),
  }
}

function normalizationSnapshot() {
  return {
    brand_context: brandContext,
    prompt_contract_sha256: Object.fromEntries(
      categoryKeys.map((key) => [
        key,
        createHash("sha256")
          .update(JSON.stringify(categoryApprovalContract(key)))
          .digest("hex"),
      ]),
    ),
    cases: captures.cases.map(adapterOwnedResult),
  }
}

// Frozen from the pre-router worker; never regenerate during verification.
const frozen = JSON.parse(
  readFileSync(new URL("frozen-normalization.json", fixtureRoot), "utf8"),
) as ReturnType<typeof normalizationSnapshot>

test("all 52 captured production outputs retain the pre-router adapter-owned results", () => {
  assert.equal(captures.cases.length, 52)
  assert.deepEqual(brandContext, frozen.brand_context)
  assert.deepEqual(captures.cases.map(adapterOwnedResult), frozen.cases)
})

test("every category retains its pre-router prompt contract byte for byte", () => {
  assert.deepEqual(normalizationSnapshot().prompt_contract_sha256, frozen.prompt_contract_sha256)
})
