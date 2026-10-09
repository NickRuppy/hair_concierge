import assert from "node:assert/strict"
import test from "node:test"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  normalizeBondbuilderInci,
  projectBondbuilderForProduction,
  validateBondbuilderResearchProfile,
} from "../src/lib/bondbuilder-research/production-adapter"
import {
  makeBondbuilderEnvelope,
  sealProfile,
  fact,
  unknownFact,
} from "./fixtures/bondbuilder-research/profile"
import {
  BOND_CURRENT_METHOD_PINS,
  BOND_DEFAULT_POLICY,
  BOND_METHOD_PINS,
  BOND_OWNER_REGISTRY,
} from "../src/lib/bondbuilder-research/registry"
import { runBondbuilderProductionAdapterCli } from "../scripts/bondbuilder-research/project-production-adapter"

const hash = (s: string) => createHash("sha256").update(s).digest("hex")

test("exact source-bound epres property projection preserves full research and does not claim global readiness", () => {
  const input = makeBondbuilderEnvelope()
  const before = structuredClone(input)
  const outcome = projectBondbuilderForProduction(input)
  assert.deepEqual(outcome.errors, [])
  assert.ok(outcome.productionProjection)
  assert.equal(outcome.readiness.property_lane_ready, true)
  assert.equal(outcome.readiness.global_recommendation_ready, false)
  assert.equal(
    outcome.productionProjection.category_specs.product_bondbuilder_specs.claim_trust_level,
    "high",
  )
  assert.deepEqual(
    outcome.productionProjection.category_specs.product_bondbuilder_specs.research_profile,
    before.profile,
  )
  assert.deepEqual(input, before)
  assert.deepEqual(projectBondbuilderForProduction(input), outcome)
  const specs = outcome.productionProjection.category_specs.product_bondbuilder_specs
  assert.equal("repair_axis" in specs, false)
  assert.equal("repair_intensity" in specs, false)
  assert.equal("suitable_thicknesses" in specs, false)
  assert.equal("usage_protocol" in specs, false)
})

test("new exact identity remains default low even when copying a high technology reference and pilot research key", () => {
  const input = makeBondbuilderEnvelope()
  input.profile.identity.product_name = "New exact maleate treatment"
  input.profile.assessment.claim_trust_level = "low"
  input.profile.assessment.trust_basis = "owner_default"
  input.profile.assessment.policy_reference = BOND_DEFAULT_POLICY
  sealProfile(input.profile)
  const result = projectBondbuilderForProduction(input)
  assert.equal(result.status, "projected")
  assert.equal(
    result.productionProjection?.category_specs.product_bondbuilder_specs.claim_trust_level,
    "low",
  )
  assert.equal(result.readiness.curated_research_candidate, false)
  input.profile.assessment.claim_trust_level = "high"
  input.profile.assessment.trust_basis = "owner_anchor"
  input.profile.assessment.policy_reference = "owner-review-2026-09-30:P03"
  sealProfile(input.profile)
  assert.match(projectBondbuilderForProduction(input).errors.join(" "), /unverified_owner_grade/)
})

test("accepts only complete historical or prepared-current method pin tuples", () => {
  for (const pins of [BOND_METHOD_PINS, BOND_CURRENT_METHOD_PINS]) {
    const profile = makeBondbuilderEnvelope().profile
    Object.assign(profile.method, pins)
    sealProfile(profile)
    assert.equal(validateBondbuilderResearchProfile(profile).success, true, pins.method_version)
  }

  const mixed = makeBondbuilderEnvelope().profile
  Object.assign(mixed.method, BOND_CURRENT_METHOD_PINS, {
    standard_sha256: BOND_METHOD_PINS.standard_sha256,
  })
  sealProfile(mixed)
  const result = validateBondbuilderResearchProfile(mixed)
  assert.equal(result.success, false)
  if (!result.success) assert.match(result.errors.join(" "), /unapproved pin/)
})

test("conditional cadence, physical format unknowns, source scope and unsupported facts survive with coverage", () => {
  const input = makeBondbuilderEnvelope()
  input.profile.application.applied_format = unknownFact()
  input.profile.application.cadence = fact({
    status: "source_stated_conditional",
    initial: null,
    maintenance: null,
    branches: [
      {
        condition: "Lower porosity",
        initial: null,
        maintenance: { kind: "every_n_washes", minimum: 4, maximum: 5 },
        timing: { kind: "exact_seconds", seconds: 900, purpose: "contact" },
        source_ids: ["R07"],
      },
      {
        condition: "Higher porosity",
        initial: null,
        maintenance: { kind: "every_n_washes", minimum: 2, maximum: 3 },
        timing: { kind: "exact_seconds", seconds: 1800, purpose: "contact" },
        source_ids: ["R07"],
      },
    ],
  })
  sealProfile(input.profile)
  const output = projectBondbuilderForProduction(input)
  assert.equal(output.status, "projected")
  assert.deepEqual(
    output.productionProjection?.category_specs.product_bondbuilder_specs.research_profile,
    input.profile,
  )
  assert.equal(
    "product_format" in output.productionProjection!.category_specs.product_bondbuilder_specs,
    false,
  )
  assert.ok(output.warnings.includes("exact_product_cadence_unavailable"))
  assert.ok(
    output.propertyCoverage.properties.some(
      (p) => p.property === "application.cadence" && p.usable_status === "retained_only",
    ),
  )
  assert.ok(
    output.propertyCoverage.properties.some(
      (p) => p.property === "fit.fine" && p.usable_status === "held",
    ),
  )
})

test("explicit bedtime overnight leave-in directions map to the dedicated runtime mode only", () => {
  const input = makeBondbuilderEnvelope()
  input.profile.application.state_modifiers = fact(["at_bedtime"])
  input.profile.application.timing = fact({ kind: "overnight", purpose: "contact" })
  input.profile.application.rinse = fact({
    treatment_mode: "leave_in",
    standalone_treatment_rinse: false,
  })
  sealProfile(input.profile)

  const result = projectBondbuilderForProduction(input)
  assert.equal(result.status, "projected")
  assert.equal(
    result.productionProjection?.category_specs.product_bondbuilder_specs.application_mode,
    "bedtime_leave_in",
  )

  input.profile.application.timing = fact({
    kind: "exact_seconds",
    seconds: 600,
    purpose: "contact",
  })
  sealProfile(input.profile)
  assert.notEqual(
    projectBondbuilderForProduction(input).productionProjection?.category_specs
      .product_bondbuilder_specs.application_mode,
    "bedtime_leave_in",
  )
})

test("ordered INCI normalization preserves digit commas and parentheses; tampered complete lists refuse", () => {
  assert.deepEqual(
    normalizeBondbuilderInci(
      "Aqua, 1,2-Hexanediol, Olus Oil (Vegetable Oil, Huile Végétale), Polyquaternium-37,Glycerin",
    ),
    [
      "aqua",
      "1,2-hexanediol",
      "olus oil (vegetable oil, huile végétale)",
      "polyquaternium-37",
      "glycerin",
    ],
  )
  const input = makeBondbuilderEnvelope()
  input.profile.formula.normalized_ingredients.reverse()
  input.profile.formula.normalized_sha256 = hash(
    JSON.stringify(input.profile.formula.normalized_ingredients),
  )
  sealProfile(input.profile)
  assert.match(projectBondbuilderForProduction(input).errors.join(" "), /ordered sequence mismatch/)
})

test("schema, identity, method, owner and source attacks fail at public projection boundary", async (t) => {
  const attacks: Array<
    [string, (p: ReturnType<typeof makeBondbuilderEnvelope>["profile"]) => void, RegExp]
  > = [
    [
      "method pin",
      (p) => {
        p.method.standard_sha256 = "0".repeat(64)
      },
      /unapproved pin/,
    ],
    [
      "source URL owner forgery",
      (p) => {
        p.sources[0].url = "https://example.com/forged"
      },
      /unverified_owner_grade/,
    ],
    [
      "size owner forgery",
      (p) => {
        p.identity.size = "500 ml"
      },
      /unverified_owner_grade/,
    ],
    [
      "source version owner forgery",
      (p) => {
        p.identity.source_version = "different"
      },
      /unverified_owner_grade/,
    ],
    [
      "unresolved identity",
      (p) => {
        p.identity.status = "unresolved"
      },
      /identity_or_formula_unresolved/,
    ],
    [
      "boundary",
      (p) => {
        p.assessment.boundary_status = "category_review"
      },
      /boundary_not_resolved/,
    ],
    [
      "missing referenced source",
      (p) => {
        p.application.amount.source_ids = ["absent"]
      },
      /Missing or uninspected/,
    ],
    [
      "uninspected creator lead",
      (p) => {
        p.sources[0].access = "uninspected"
      },
      /Missing or uninspected/,
    ],
    [
      "null without reason",
      (p) => {
        p.fit.fine.unknown_reason = null
      },
      /Null fact requires/,
    ],
    [
      "extra property",
      (p) => {
        Object.assign(p.assessment, { potency: "high" })
      },
      /Unrecognized key/,
    ],
    [
      "oversize raw formula",
      (p) => {
        p.formula.raw_inci = "A".repeat(32001)
      },
      /32000/,
    ],
    [
      "range reversed",
      (p) => {
        p.application.timing = fact({
          kind: "range_seconds",
          minimum_seconds: 600,
          maximum_seconds: 300,
          purpose: "contact",
        })
      },
      /Reversed timing/,
    ],
    [
      "reference source mismatch",
      (p) => {
        p.technology_reference.source_version = "not-reviewed"
      },
      /reference_binding_mismatch/,
    ],
    [
      "reference efficacy inheritance",
      (p) => {
        p.technology_reference.research_key = "P01"
      },
      /reference_binding_mismatch/,
    ],
    [
      "nonliteral marker",
      (p) => {
        p.formula.markers[0].literal = "invented marker"
      },
      /marker_not_literal/,
    ],
    [
      "unresolved formula conflict",
      (p) => {
        p.formula.conflicts.push({
          source_ids: ["R07"],
          raw_inci: "Aqua",
          reason: "Conflicting selected pack.",
          resolved: false,
        })
      },
      /identity_or_formula_unresolved/,
    ],
  ]
  for (const [name, mutate, expected] of attacks)
    await t.test(name, () => {
      const input = makeBondbuilderEnvelope()
      mutate(input.profile)
      sealProfile(input.profile)
      const output = projectBondbuilderForProduction(input)
      assert.equal(output.status, "refused")
      assert.equal(output.productionProjection, null)
      assert.match(output.errors.join(" "), expected)
    })
})

test("resealed digest is necessary but not sufficient authority; stale digest cannot validate", () => {
  const input = makeBondbuilderEnvelope()
  input.profile.evidence.summary = "Changed after review"
  assert.match(projectBondbuilderForProduction(input).errors.join(" "), /profile_digest_mismatch/)
  assert.equal(validateBondbuilderResearchProfile(input.profile).success, false)
})

test("all eight frozen exact owner decisions preserve their independently approved grades", () => {
  const packet = JSON.parse(
    readFileSync(
      new URL(
        "../data/research/bondbuilder-inci/v1.0/replay-2026-09-30-v0.3/evidence-packet.v0.3.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    products: Array<{
      pilot_id: string
      raw_inci_capture: string
      alternative_capture?: { raw_inci_capture: string }
    }>
  }
  const expected = {
    P01: "high",
    P02: "high",
    P03: "high",
    P04: "medium",
    P05: "medium",
    P06: "low",
    P07: "low",
    P08: "medium",
  }
  const markers = {
    sulfur_targeting_dimaleate: ["bis-aminopropyl diglycol dimaleate"],
    designed_peptide: ["sh-oligopeptide-78"],
    maleate_ester: ["diethylhexyl maleate"],
    acid_calcium_management: ["citric acid"],
    gluconamide_gluconate: ["hydroxypropylgluconamide", "hydroxypropylammonium gluconate"],
  }
  for (const row of BOND_OWNER_REGISTRY) {
    const input = makeBondbuilderEnvelope(),
      p = input.profile
    const frozen = packet.products.find((product) => product.pilot_id === row.research_key)!
    Object.assign(p.identity, {
      research_key: row.research_key,
      product_name: row.product_name,
      brand: row.brand,
      market: row.market,
      size: row.size,
      source_version: row.source_version,
    })
    Object.assign(p.formula, {
      raw_inci:
        row.research_key === "P05"
          ? frozen.alternative_capture!.raw_inci_capture
          : frozen.raw_inci_capture,
      raw_sha256: row.raw_sha256,
      normalized_ingredients: [...row.normalized_ingredients],
      normalized_sha256: row.normalized_sha256,
      candidate_families: [row.technology_family],
      markers: markers[row.technology_family].map((literal) => ({
        literal,
        family: row.technology_family,
        source_ids: ["R07"],
      })),
    })
    Object.assign(p.assessment, {
      technology_family: row.technology_family,
      claim_trust_level: row.claim_trust_level,
      trust_basis: row.trust_basis,
      policy_reference: row.policy_reference,
    })
    p.sources[0].url = row.source_url
    p.technology_reference = {
      status: "not_assessed",
      research_key: null,
      product_id: null,
      formula_sha256: null,
      source_version: null,
      shared_markers: [],
      source_ids: [],
      limitation: "Synthetic projection test does not assess comparison.",
    }
    sealProfile(p)
    const projected = projectBondbuilderForProduction(input)
    assert.deepEqual(projected.errors, [], row.research_key)
    assert.equal(
      projected.productionProjection?.category_specs.product_bondbuilder_specs.claim_trust_level,
      expected[row.research_key],
    )
    // Synthetic complete application isolates owner approval from efficacy trust.
    // Actual pilot profiles keep their unresolved application/fit holds.
    assert.equal(projected.readiness.curated_research_candidate, true, row.research_key)
    assert.equal(projected.readiness.global_recommendation_ready, false, row.research_key)
    p.assessment.classification_confidence = "low"
    sealProfile(p)
    assert.equal(
      projectBondbuilderForProduction(input).readiness.curated_research_candidate,
      false,
      `${row.research_key}: uncertain classification is not the same as low efficacy trust`,
    )
  }
})

test("UTF-8 total size limit refuses otherwise bounded nested evidence without truncation", () => {
  const input = makeBondbuilderEnvelope()
  input.profile.sources = Array.from({ length: 100 }, (_, i) => ({
    ...input.profile.sources[0],
    id: i === 0 ? "R07" : `S${i}`,
    limitations: Array.from({ length: 3 }, () => "ä".repeat(500)),
  }))
  sealProfile(input.profile)
  assert.match(projectBondbuilderForProduction(input).errors.join(" "), /exceeds 256 KiB/)
})

test("local CLI retains complete input and refuses nonempty output without overwriting artifacts", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "bondbuilder-adapter-"))
  try {
    const input = path.join(dir, "input.json"),
      output = path.join(dir, "result")
    writeFileSync(input, JSON.stringify(makeBondbuilderEnvelope()))
    assert.equal(runBondbuilderProductionAdapterCli(["--input", input, "--output", output]), 0)
    assert.deepEqual(
      JSON.parse(readFileSync(path.join(output, "research-envelope.json"), "utf8")),
      makeBondbuilderEnvelope(),
    )
    const before = readFileSync(path.join(output, "production-projection.json"), "utf8")
    assert.throws(
      () => runBondbuilderProductionAdapterCli(["--input", input, "--output", output]),
      /Refusing nonempty/,
    )
    assert.equal(readFileSync(path.join(output, "production-projection.json"), "utf8"), before)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
