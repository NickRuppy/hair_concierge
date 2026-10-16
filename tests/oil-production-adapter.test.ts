import { strict as assert } from "node:assert"
import { test } from "node:test"
import {
  projectOilForProduction,
  renderOilProjectionSummary,
} from "../src/lib/oil-research/production-adapter"
import {
  makeOilEnvelope,
  makeOilExclusion,
  preserveFixtureProfile,
} from "./fixtures/oil-research/fixture"

test("projects exactly the owned singleton and preserves all research and conditional caveats", () => {
  const e = makeOilEnvelope()
  e.profile.weight.reason = "Light retained coating decision"
  e.profile.use_evidence.reason = "Explicit dry finishing instructions"
  e.profile.provides_heat_protection.reason = "Accepted manufacturer heat claim"
  preserveFixtureProfile(e)
  const before = structuredClone(e)
  const out = projectOilForProduction(e)
  assert.equal(out.status, "property_projection_ready")
  if (out.status !== "property_projection_ready") return
  assert.deepEqual(out.category_specs, {
    product_oil_specs: {
      weight: "light",
      role_support: ["dry_finish"],
      provides_heat_protection: true,
    },
  })
  assert.deepEqual(out.field_rationales, {
    "category_specs.product_oil_specs.weight": "Light retained coating decision",
    "category_specs.product_oil_specs.role_support": "Explicit dry finishing instructions",
    "category_specs.product_oil_specs.provides_heat_protection": "Accepted manufacturer heat claim",
  })
  assert.deepEqual(out.required_protocol_roles, ["dry_finish"])
  assert.deepEqual(e, before)
  assert.equal(out.catalog_ready, false)
  assert.equal(out.global_recommendation_ready, false)
  assert.equal(out.publish_ready, false)
  assert.ok(out.retained_only_fields.includes("persistence_potential"))
  assert.ok(out.manual_review_required.includes("product_oil_eligibility"))
  const summary = renderOilProjectionSummary(e, out)
  assert.match(summary, /When a lighter finish is desired/)
  assert.match(summary, /moderate/)
  assert.match(summary, /not derived or approved/)
  const renderedProfile = [...summary.matchAll(/```json\n([\s\S]+?)\n```/g)]
    .map((match) => JSON.parse(match[1]))
    .find((value) => value.product_key === "synthetic")
  assert.deepEqual(
    renderedProfile,
    e.profile,
    "The complete preserved profile remains visible for manual review",
  )
})

test("unknown weight refuses but other allowed gaps and every persistence scalar serialize", () => {
  const e = makeOilEnvelope()
  e.profile.base.value = "unknown"
  for (const value of ["low", "moderate", "high"] as const) {
    e.profile.persistence_potential = value
    preserveFixtureProfile(e)
    assert.equal(projectOilForProduction(e).status, "property_projection_ready")
  }
  e.profile.weight.value = "unknown"
  preserveFixtureProfile(e)
  const out = projectOilForProduction(e)
  assert.equal(out.status, "needs_research")
  assert.ok(out.issues.some((x) => x.includes("weight")))
  assert.equal("category_specs" in out, false)
})

test("admission conflicts and malformed evidence never expose a spec payload", () => {
  for (const mutate of [
    (e: ReturnType<typeof makeOilEnvelope>) => {
      e.formula.declaration_status = "incomplete"
    },
    (e: ReturnType<typeof makeOilEnvelope>) => {
      e.identity.conflicts = ["two variants"]
    },
    (e: ReturnType<typeof makeOilEnvelope>) => {
      e.formula.conflicts = ["two declarations"]
    },
  ]) {
    const e = makeOilEnvelope()
    mutate(e)
    const out = projectOilForProduction(e)
    assert.equal(out.status, "needs_research")
    assert.equal("category_specs" in out, false)
  }
  for (const input of [null, {}, "text", makeOilEnvelope().profile]) {
    const out = projectOilForProduction(input)
    assert.equal(out.status, "needs_research")
    assert.equal("category_specs" in out, false)
    assert.doesNotThrow(() => renderOilProjectionSummary(input, out))
  }
})

test("verified pre-wash exclusion has no persistence answer or applicable catalog payload", () => {
  const e = makeOilExclusion()
  const out = projectOilForProduction(e)
  assert.equal(out.status, "not_applicable")
  assert.equal("category_specs" in out, false)
  e.reviewed_directions[0].supported_roles = ["dry_finish"]
  assert.equal(projectOilForProduction(e).status, "needs_research")
})

test("outside-category exclusion allows reviewed non-hair directions, while negated wash evidence refuses", () => {
  const outside = makeOilExclusion()
  outside.identity.category = "outside_hair_oil"
  outside.exclusion.reason = "outside_hair_oil_category"
  outside.reviewed_directions[0].supported_roles = []
  outside.reviewed_directions[0].site = ["body_skin"]
  outside.reviewed_directions[0].removal = "explicit_leave_in"
  outside.sources[0].directions[0].text = "Apply to body skin after bathing."
  assert.equal(projectOilForProduction(outside).status, "not_applicable")
  outside.identity.category = "hair_oil"
  assert.equal(projectOilForProduction(outside).status, "needs_research")
  for (const removal of ["no rinse", "shampoo not required", "unestablished", "no shampoo"]) {
    const e = makeOilExclusion()
    e.reviewed_directions[0].removal = removal
    assert.equal(projectOilForProduction(e).status, "needs_research", removal)
  }
})

test("scope exclusions require the declared application site without restricting outside categories", () => {
  const scalp = makeOilExclusion()
  scalp.exclusion.reason = "scalp_only"
  scalp.reviewed_directions[0].supported_roles = ["scalp_application"]
  assert.equal(projectOilForProduction(scalp).status, "needs_research")
  scalp.reviewed_directions[0].site = ["scalp"]
  assert.equal(projectOilForProduction(scalp).status, "not_applicable")
  scalp.reviewed_directions[0].site = ["scalp", "ends"]
  assert.equal(projectOilForProduction(scalp).status, "needs_research")
  const prewash = makeOilExclusion()
  prewash.reviewed_directions[0].site = ["scalp"]
  assert.equal(projectOilForProduction(prewash).status, "needs_research")
  const conditioner = makeOilExclusion()
  conditioner.identity.category = "outside_hair_oil"
  conditioner.exclusion.reason = "outside_hair_oil_category"
  assert.equal(projectOilForProduction(conditioner).status, "not_applicable")
})

test("unestablished retained directions never expose applicable specs", () => {
  const changes = [
    (e: ReturnType<typeof makeOilEnvelope>) => {
      e.profile.application_scenarios[0].removal = "unspecified"
    },
    (e: ReturnType<typeof makeOilEnvelope>) => {
      e.profile.application_scenarios[0].site = ["body_skin"]
    },
    (e: ReturnType<typeof makeOilEnvelope>) => {
      e.profile.supported_uses = []
      e.profile.use_evidence.value = []
      e.profile.application_scenarios[0].supported_roles = []
      e.scenario_fit = []
    },
  ]
  for (const change of changes) {
    const e = makeOilEnvelope()
    change(e)
    preserveFixtureProfile(e)
    const out = projectOilForProduction(e)
    assert.equal(out.status, "needs_research")
    assert.equal("category_specs" in out, false)
  }
})

test("dual-use oils require fibre and wash-out evidence for every projected pre-wash role", () => {
  const e = JSON.parse(JSON.stringify(makeOilEnvelope())) as ReturnType<typeof makeOilEnvelope>
  const prewash = structuredClone(e.profile.application_scenarios[0])
  prewash.direction_id = "prewash"
  prewash.supported_roles = ["pre_wash_fibre_treatment"]
  prewash.stage = "before_shampoo"
  prewash.removal = "shampoo"
  e.profile.application_scenarios.push(prewash)
  e.profile.supported_uses = ["dry_finish", "pre_wash_fibre_treatment"]
  e.profile.use_evidence.value = [...e.profile.supported_uses]
  e.sources[0].directions.push({
    direction_id: "prewash",
    text: "Apply to hair fibre, then shampoo.",
  })
  const fit = structuredClone(e.scenario_fit[0])
  fit.direction_id = "prewash"
  fit.role = "pre_wash_fibre_treatment"
  fit.original.direction_id = "prewash"
  fit.original.supported_role = "pre_wash_fibre_treatment"
  e.scenario_fit.push(fit)
  preserveFixtureProfile(e)
  assert.equal(projectOilForProduction(e).status, "property_projection_ready")
  for (const [site, removal] of [
    [["scalp"], "shampoo"],
    [["hair_fibre"], "explicit_leave_in"],
  ] as const) {
    prewash.site = [...site]
    prewash.removal = removal
    preserveFixtureProfile(e)
    const out = projectOilForProduction(e)
    assert.equal(out.status, "needs_research", `${site}/${removal}`)
    assert.ok(out.issues.some((issue) => issue.includes("Pre-wash role")))
    assert.equal("category_specs" in out, false)
  }
})
