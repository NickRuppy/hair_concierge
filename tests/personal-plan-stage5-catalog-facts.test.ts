import assert from "node:assert/strict"
import test from "node:test"

import { adaptCatalogApplicationFacts } from "../src/lib/routines/personal-plan/application/catalog-facts"

test("adapts Leave-in catalog fields with catalog-spec provenance", () => {
  const result = adaptCatalogApplicationFacts({
    category: "leave_in",
    spec: {
      format: "spray",
      roles: ["styling_prep", "extension_conditioner"],
      provides_heat_protection: true,
      heat_protection_max_c: 230,
      heat_activation_required: false,
      application_stage: ["towel_dry", "pre_heat"],
    },
  })

  assert.deepEqual(result.facts, {
    format: "spray",
    roles: ["styling_prep", "extension_conditioner"],
    providesHeatProtection: true,
    heatProtectionMaxC: 230,
    heatActivationRequired: false,
    applicationStage: ["towel_dry", "pre_heat"],
  })
  assert.deepEqual(result.provenance, {
    format: "catalog_spec",
    roles: "catalog_spec",
    providesHeatProtection: "catalog_spec",
    heatProtectionMaxC: "catalog_spec",
    heatActivationRequired: "catalog_spec",
    applicationStage: "catalog_spec",
  })
})

test("keeps Dry-Shampoo foam_or_liquid coarse without selecting a physical action", () => {
  const result = adaptCatalogApplicationFacts({
    category: "dry_shampoo",
    spec: { format: "foam_or_liquid" },
  })

  assert.equal(result.facts.format, "foam_or_liquid")
  assert.deepEqual(result.facts.formatResolution, {
    status: "requires_exact_protocol",
    candidates: ["foam", "liquid_to_dry"],
  })
  assert.equal(result.provenance.format, "catalog_spec")
  assert.equal(result.provenance.formatResolution, "catalog_spec")
})

test("maps unambiguous Dry-Shampoo formats to their catalog-backed application family", () => {
  const result = adaptCatalogApplicationFacts({
    category: "dry_shampoo",
    spec: { format: "powder" },
  })

  assert.deepEqual(result.facts.formatResolution, {
    status: "resolved",
    applicationFamily: "powder",
  })
})

test("adapts Bondbuilder discriminators without copying legacy hint copy or timing", () => {
  const result = adaptCatalogApplicationFacts({
    category: "bondbuilder",
    spec: {
      application_mode: "post_wash_leave_in",
      treatment_mode: "leave_in",
      product_format: "leave_in_mask",
      usage_protocol: "k18_leave_in",
    },
  })

  assert.deepEqual(result.facts, {
    applicationMode: "post_wash_leave_in",
    treatmentMode: "leave_in",
    productFormat: "leave_in_mask",
    usageProtocol: "k18_leave_in",
  })
  assert.deepEqual(result.provenance, {
    applicationMode: "catalog_spec",
    treatmentMode: "catalog_spec",
    productFormat: "catalog_spec",
    usageProtocol: "bond_usage_protocol",
  })
  assert.equal("usageHint" in result.facts, false)
  assert.equal("contactTimeSeconds" in result.facts, false)
})
