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

const templatedCategories = new Set(["shampoo", "conditioner", "mask", "leave_in", "oil"])

function normalizeCapture(capture: Capture) {
  return normalizeResearchOutputForCategory(
    structuredClone(capture.output),
    capture.category,
    structuredClone(brandContext),
    structuredClone(capture.review_decisions),
    capture.submission_id,
  )
}

function adapterOwnedResult(capture: Capture) {
  const result = normalizeCapture(capture)
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

function withoutTemplatedProtocols(result: ReturnType<typeof adapterOwnedResult>) {
  if (!templatedCategories.has(result.category) || !result.category_specs) return result
  const { product_application_protocols: _protocols, ...category_specs } =
    result.category_specs as Record<string, unknown>
  return { ...result, category_specs }
}

test("all 52 captured production outputs retain adapter-owned results apart from templated protocols", () => {
  assert.equal(captures.cases.length, 52)
  assert.deepEqual(brandContext, frozen.brand_context)
  assert.deepEqual(
    captures.cases.map(adapterOwnedResult).map(withoutTemplatedProtocols),
    frozen.cases.map(withoutTemplatedProtocols),
  )
  for (const [index, capture] of captures.cases.entries()) {
    const result = normalizeCapture(capture)
    const stage = result.artifacts.find((artifact) => artifact.kind === "protocol_template")
    assert.ok(stage, capture.submission_id)
    if (templatedCategories.has(capture.category)) {
      assert.ok(["templated", "blocked"].includes(stage.status!), capture.submission_id)
      assert.equal(stage.payload.status, stage.status)
      const blockers = stage.payload.blockers as string[]
      assert.ok(Array.isArray(blockers))
      assert.ok(blockers.every((blocker) => blocker.startsWith("protocol_")))
      assert.deepEqual(
        result.blockers.filter((blocker) => blocker.startsWith("protocol_")),
        blockers,
      )
    } else {
      assert.deepEqual(
        (result.researched_payload?.final as Record<string, Record<string, unknown>>)
          ?.category_specs?.product_application_protocols,
        (frozen.cases[index]!.category_specs as Record<string, unknown> | null)
          ?.product_application_protocols,
        capture.submission_id,
      )
    }
  }
})

test("every category retains its pre-router prompt contract byte for byte", () => {
  assert.deepEqual(normalizationSnapshot().prompt_contract_sha256, {
    conditioner: "9d74593bf792adba92e8f789fabae02eddd2e013df1f680035508660cf80a3ae",
    leave_in: "39f26cb7201439140c9273e2e16411f3cb5957729e3caf9b31250e16b462cda6",
    bondbuilder: "f5e94f8ee0ea1e7b6010c43e912f5c29566537b46b3872b11e52d93acb7022f5",
    shampoo: "dc511c24cb88c76fe66fbb60dadda2bbe52f246314bc582c7278af1ad97c99a7",
    mask: "68c7c7ad750e70add3d28bf7333fcddaa1154234d8a2fe1b2351450e0c79fe0d",
    oil: "b07faaf152f390227c6980959c89075f60f75e28403cd2546a050edba142be15",
    dry_shampoo: "b83adcdac65c1b5b90acf859b53cc3e592f8fb0364094cee9f53db816bdc583b",
    deep_cleansing_shampoo: "6f0b700d503ce13691120d1f15cd87a0c54fedf1221034d2978dc6742c047dcc",
    heat_protectant: "810273e00ce7332cbd26810eb29ceaef87072cbc84a487fa75312a5d63cd301b",
    scalp_care: "ef5808c0b92c4f3d5d8f49bd863ba91e08c8ec5e5761eac7914c11d76d6843d1",
  })
})
