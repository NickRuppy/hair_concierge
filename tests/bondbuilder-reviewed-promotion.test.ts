import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import {
  buildBondbuilderReviewedPromotion,
  buildPremiereReviewedPromotion,
} from "../src/lib/product-intake/catalog-enrichment/bondbuilder-reviewed-promotion"
import { sealProfile } from "./fixtures/bondbuilder-research/profile"
import { projectBondbuilderProtocol } from "../src/lib/bondbuilder-research/protocol-projection"

const baselinePath = new URL(
  "../data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-06/baseline.json",
  import.meta.url,
)

test("reviewed promotion retains research unknowns while releasing only ancillary protocol holds", async () => {
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"))
  const result = buildBondbuilderReviewedPromotion(baseline)
  assert.deepEqual(
    result.items.map((item) => item.researchKey),
    ["P04", "P05", "P07"],
  )
  for (const item of result.items) {
    assert.equal(item.profile.identity.product_id, item.productId)
    assert.equal(item.profile.holds.fit[0]?.code, "diameter_fit_unknown")
    assert.equal(item.profile.review.reviewed_date, "2026-10-06")
    assert.equal(item.spec.application_mode, "pre_shampoo")
    assert.equal(item.spec.treatment_mode, "rinse_out")
    assert.equal(item.spec.usage_protocol, "verified_product_protocol")
    assert.deepEqual(item.eligibleThicknesses, ["fine", "normal", "coarse"])
    assert.equal(item.protocolV2.scope.productId, item.productId)
    assert.ok(item.source.source_url.startsWith("https://"))
    assert.ok(item.source.source_text.length > 20)
  }
  assert.equal(result.items.find((item) => item.researchKey === "P05")!.cadence, null)
  assert.ok(result.preimageSha256.match(/^[a-f0-9]{64}$/))
  const tampered = structuredClone(baseline)
  tampered.products[0].bundle.spec.research_profile.review.profile_sha256 = "0".repeat(64)
  assert.throws(() => buildBondbuilderReviewedPromotion(tampered), /baseline_profile_invalid:/)
})

test("P08 partner overlay preserves selected formula, unknowns and exact wash sequence", async () => {
  const directory = new URL(
    "../data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-07-premiere/",
    import.meta.url,
  )
  const baseline = JSON.parse(await readFile(new URL("baseline.json", directory), "utf8"))
  const source = JSON.parse(
    await readFile(new URL("partner-source.json", directory), "utf8"),
  ).source
  const before = structuredClone(baseline)
  const item = buildPremiereReviewedPromotion(baseline, source)
  const original = baseline.products[0].bundle.spec.research_profile
  assert.equal(item.researchKey, "P08")
  assert.equal(item.profile.identity.source_version, "2026-09-30:N01")
  assert.deepEqual(item.profile.formula, original.formula)
  assert.deepEqual(item.profile.assessment, original.assessment)
  assert.deepEqual(item.profile.fit, original.fit)
  assert.deepEqual(item.profile.holds.fit, original.holds.fit)
  for (const key of [
    "applied_format",
    "state_modifiers",
    "longer_wear",
    "amount",
    "dilution",
    "cadence",
  ] as const)
    assert.deepEqual(item.profile.application[key], original.application[key])
  assert.ok(item.profile.application.partners.value)
  assert.equal(item.profile.application.partners.value[0].requirement, "recommended")
  assert.equal(item.profile.application.partners.value[0].exclusivity_established, false)
  assert.deepEqual(item.profile.application.timing, original.application.timing)
  assert.deepEqual(item.profile.application.hair_state, original.application.hair_state)
  assert.equal(item.protocolV2.facts.shampooAfterTreatment, "layer_without_rinsing")
  assert.equal(item.protocolV2.facts.applicationState, "wet_hair")
  assert.deepEqual(item.protocolV2.facts.contactTime, { kind: "seconds", seconds: 300 })
  assert.equal(item.protocolV2.facts.amount, null)
  assert.equal(item.cadence, null)
  assert.equal(item.protocolV2.requiredCompanionProductId, null)
  assert.equal(item.protocolV2.runtimeBlockerCode, null)
  assert.equal(
    item.protocolV2.exactSteps.some((step) => step.action === "rinse"),
    false,
  )
  assert.match(
    item.protocolV2.exactSteps.map((step) => step.copyDe).join(" "),
    /feuchten Längen einmassieren/,
  )
  assert.deepEqual(baseline, before)
  const required = structuredClone(item.profile)
  required.application.partners.value![0]!.requirement = "required"
  sealProfile(required)
  assert.deepEqual(projectBondbuilderProtocol(required, item.productId), {
    status: "hold",
    reasons: ["required_companion_not_bound"],
  })
  const tampered = structuredClone(baseline)
  tampered.products[0].bundle.spec.research_profile.review.profile_sha256 = "0".repeat(64)
  assert.throws(() => buildPremiereReviewedPromotion(tampered, source), /premiere_baseline_invalid/)
  assert.throws(
    () =>
      buildPremiereReviewedPromotion(baseline, { ...source, observation: "Unsupported assertion" }),
    /premiere_source_binding/,
  )
})
