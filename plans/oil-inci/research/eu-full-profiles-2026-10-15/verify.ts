import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { LegacyOilResearchEnvelopeSchema } from "../../../../src/lib/oil-research/contracts"
import { readOilLabCandidatePackage } from "../../../../src/lib/oil-research/candidate-package"
import { OIL_LOCAL_RESEARCH_METHOD } from "../../../../src/lib/oil-research/registry"
import { projectOilForProduction } from "../../../../src/lib/oil-research/production-adapter"
import { oilLabSources } from "../../../../src/lib/labs/oil-research-access"
import { getOilSharedLab } from "../../../../src/lib/labs/research/oil"
const root = process.cwd(),
  w = "plans/oil-inci/research/eu-full-profiles-2026-10-15",
  out = "data/research/oil-inci/v1.0/eu-full-profiles-v0.1",
  trial = "data/research/oil-inci/v1.0/corpus/holdout/persistence-contrast-v0.1"
const read = (path: string) => JSON.parse(readFileSync(join(root, path), "utf8"))
const digest = (path: string) =>
  createHash("sha256")
    .update(readFileSync(join(root, path)))
    .digest("hex")
const preservation = read(`${w}/preservation.json`)
for (const [path, hash] of Object.entries(preservation.files))
  assert.equal(digest(path), hash, `prior file changed ${path}`)
const inputs = read(`${w}/input-manifest.json`)
for (const [path, hash] of Object.entries(inputs.files))
  assert.equal(digest(path), hash, `sealed input changed ${path}`)
for (const [path, hash] of Object.entries(OIL_LOCAL_RESEARCH_METHOD.policy_pins))
  assert.equal(digest(path), hash, `method pin ${path}`)
const binding = read(`${trial}/source-bindings-v0.2.json`),
  prior = read(`${trial}/parent-adjudication.json`),
  neutral = read(`${trial}/neutral-packet-v0.2.json`),
  source = read(`${w}/source-unblind/unblind-source-packet.json`)
const expected = [
  ["PC01", "DE", 100, "medium", "high", true],
  ["PC02", "NL", 50, "medium", "high", true],
  ["PC03", "DE", 75, "medium", "moderate", false],
  ["PC04", "FR", 50, "light", "moderate", false],
]
let ranks = 0
for (const [id, market, size, weight, persistence, heat] of expected) {
  const e = LegacyOilResearchEnvelopeSchema.parse(read(`${out}/envelopes/${id}.json`))
  const original = prior.records.find((r: { neutral_id: unknown }) => r.neutral_id === id)
  const src = source.records.find((r: { neutral_id: unknown }) => r.neutral_id === id)
  assert.deepEqual(e.research_method, OIL_LOCAL_RESEARCH_METHOD)
  assert.equal(e.submission_id, null)
  assert.equal(e.provenance.import_kind, "local")
  assert.equal(e.identity.market, market)
  assert.equal(e.identity.package.size_ml, size)
  assert.equal(e.profile.weight.value, weight)
  assert.equal(e.profile.persistence_potential, persistence)
  assert.equal(e.profile.provides_heat_protection.value, heat)
  assert.equal(e.profile.provides_uv_protection.value, false)
  assert.equal(
    e.formula.raw_inci,
    binding.records.find((r: { neutral_id: unknown }) => r.neutral_id === id).raw_inci,
  )
  assert.deepEqual(
    e.formula.ingredients,
    neutral.records.find((r: { neutral_id: unknown }) => r.neutral_id === id).ingredients,
  )
  assert.deepEqual(e.profile.source_stage, src)
  assert.deepEqual(
    e.profile.application_scenarios.map((s) => s.source_original),
    src.application_scenarios,
  )
  assert.equal(e.persistence_trace.reason, original.reason)
  assert.equal(e.persistence_trace.tipping_assumption, original.tipping_assumption)
  assert.deepEqual(e.persistence_trace.considered_ranks, original.considered_ranks)
  assert.deepEqual(
    e.persistence_trace.evidence,
    original.evidence.map(({ rank, canonical_name }: { rank: number; canonical_name: string }) => ({
      rank,
      canonical_name,
    })),
  )
  for (const cells of Object.values(e.profile.fit))
    for (const cell of Object.values(cells)) {
      assert.equal(cell.value, "unknown")
      assert.equal(cell.reason, "scenario_specific_fit")
    }
  for (const s of e.scenario_fit) {
    assert.equal(s.original.alternative_weight, e.profile.weight.nearest_alternative)
    assert.ok(s.original.alternative_thickness)
    if (s.role === "scalp_application")
      assert.ok(Object.values(s.thickness).every((c) => c.value === "unknown"))
  }
  assert.equal(e.profile.ingredient_flags.scalp_active_botanicals.value, id === "PC03")
  assert.equal(e.profile.ingredient_flags.drying_alcohol.value, id === "PC02" || id === "PC03")
  assert.equal(e.profile.ingredient_flags.silicones.value, id === "PC01" || id === "PC02")
  assert.equal(e.profile.ingredient_flags.mineral_oil.value, false)
  assert.equal(e.profile.ingredient_flags.fragrance.value, true)
  const bundle = readOilLabCandidatePackage(join(root, out, "bundles", `${id}.json`))
  assert.deepEqual(JSON.parse(bundle.envelopeJson), e)
  assert.ok(bundle.matchingSuggestions.product_oil_eligibility.length)
  for (const receipt of bundle.sourceManifest.records)
    assert.equal(digest(receipt.path), receipt.sha256, `authority ${receipt.path}`)
  assert.equal(projectOilForProduction(e).status, "property_projection_ready")
  ranks += e.formula.ingredients.length
}
assert.equal(ranks, 89)
assert.equal(readdirSync(join(root, out, "bundles")).filter((p) => p.endsWith(".json")).length, 4)
const candidates = oilLabSources("candidate")
assert.equal(candidates.length, 4)
assert.equal(oilLabSources("default").length, 37)
for (const s of candidates) {
  assert.equal(s.blockers.length, 0)
  assert.ok(s.requiredPropertyIds.includes("matching"))
  assert.equal(s.bundle, undefined)
  const data = getOilSharedLab("candidate", s.id)
  assert.equal(data.detail.status, "open")
  assert.equal(data.detail.properties.length, 17)
  assert.equal(data.detail.properties.find((p) => p.id === "matching")?.status, "open")
  assert.ok(data.detail.properties.find((p) => p.id === "matching")?.actions.length)
  assert.equal(data.standard, "Öl-Standard v0.9")
}
const receipt = {
  status: "pass",
  profiles: 4,
  ordered_ingredients: ranks,
  historical_profiles: 37,
  prior_files_unchanged: Object.keys(preservation.files).length,
  all_four_projection_ready: true,
  matching: "pending_manual_review",
  intake_bindings: 0,
  critical_owner_decisions: 0,
}
writeFileSync(join(root, w, "data-verification.json"), JSON.stringify(receipt, null, 2) + "\n")
console.log(JSON.stringify(receipt))
