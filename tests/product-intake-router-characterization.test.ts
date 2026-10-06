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
  assert.deepEqual(normalizationSnapshot().prompt_contract_sha256, {
    conditioner: "80e730060b72274e244c9932165e25cd9054fd1d3597fad9a8e9a3391ae50a41",
    leave_in: "87a66e0d341aa044a7630d93ca12e85a23e84f9acbae7230f69a0b5c4fa4de62",
    bondbuilder: "f5e94f8ee0ea1e7b6010c43e912f5c29566537b46b3872b11e52d93acb7022f5",
    shampoo: "fcaec2462f97163753ecff5410a0d9db75188a6daaf53ef572cfd70fdf930f78",
    mask: "d5f706b24163d3342407c5844dcd100dbefa328ff0e2f0b8bf63d34bac90fef3",
    oil: "791bcf5bb09027170468ca17020df242b5e3f38c40d82d57d6eca9d30fea0d54",
    dry_shampoo: "b83adcdac65c1b5b90acf859b53cc3e592f8fb0364094cee9f53db816bdc583b",
    deep_cleansing_shampoo: "6f0b700d503ce13691120d1f15cd87a0c54fedf1221034d2978dc6742c047dcc",
    heat_protectant: "810273e00ce7332cbd26810eb29ceaef87072cbc84a487fa75312a5d63cd301b",
    scalp_care: "ef5808c0b92c4f3d5d8f49bd863ba91e08c8ec5e5761eac7914c11d76d6843d1",
  })
})
