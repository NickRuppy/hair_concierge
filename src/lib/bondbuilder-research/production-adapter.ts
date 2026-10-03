import { createHash } from "node:crypto"
import {
  bondbuilderResearchEnvelopeSchema,
  bondbuilderResearchProfileSchema,
  BOND_RESEARCH_PROPERTIES,
  type BondbuilderResearchProfile,
} from "./contracts"
import {
  BOND_ACCEPTED_METHOD_PINS,
  BOND_DEFAULT_POLICY,
  BOND_METHOD_PINS,
  BOND_OWNER_REGISTRY,
  BOND_REFERENCE_KEYS,
} from "./registry"

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex")
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonical(v)]),
    )
  return value
}
/** Digest omits only the two self-referential digest members. No authority is conferred by a digest. */
export function bondbuilderProfileSha256(profile: BondbuilderResearchProfile): string {
  const copy = structuredClone(profile) as unknown as Record<string, Record<string, unknown>>
  delete copy.method.output_sha256
  delete copy.review.profile_sha256
  return sha256(JSON.stringify(canonical(copy)))
}

/** Complete ordered normalization. Protect chemical locants and parenthesized commas. */
export function normalizeBondbuilderInci(raw: string): string[] {
  const clean = raw
    .replace(/<ILN[^>]*>\s*$/i, "")
    .replace(/\(F\.I\.L\.[^)]*\)\.?\s*$/i, "")
    .replace(/\(and\)/gi, ",")
    .replace(/(\d),\s+(?=\d-)/g, "$1,")
  const tokens: string[] = []
  let current = "",
    depth = 0
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (c === "(") depth++
    if (c === ")") depth--
    if (depth < 0) return []
    if (
      depth === 0 &&
      (c === "•" ||
        (c === "," && !(/\d/.test(clean[i - 1] ?? "") && /\d/.test(clean[i + 1] ?? ""))))
    ) {
      tokens.push(current)
      current = ""
    } else current += c
  }
  if (depth !== 0) return []
  tokens.push(current)
  return tokens
    .map((v) => v.replace(/[*†]/g, "").trim().replace(/\s+/g, " ").toLowerCase())
    .filter(Boolean)
}

export type BondbuilderProfileValidation =
  | { success: true; profile: BondbuilderResearchProfile }
  | { success: false; errors: string[] }
export function validateBondbuilderResearchProfile(input: unknown): BondbuilderProfileValidation {
  const parsed = bondbuilderResearchProfileSchema.safeParse(input)
  if (!parsed.success)
    return {
      success: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    }
  const p = parsed.data,
    errors: string[] = []
  const methodPinKeys = Object.keys(BOND_METHOD_PINS) as Array<keyof typeof BOND_METHOD_PINS>
  if (
    !BOND_ACCEPTED_METHOD_PINS.some((pins) =>
      methodPinKeys.every((key) => p.method[key] === pins[key]),
    )
  )
    errors.push("method: unapproved pin tuple")
  const digest = bondbuilderProfileSha256(p)
  if (p.review.profile_sha256 !== digest || p.method.output_sha256 !== digest)
    errors.push("profile_digest_mismatch")
  if (sha256(p.formula.raw_inci) !== p.formula.raw_sha256)
    errors.push("formula.raw_sha256: mismatch")
  if (sha256(JSON.stringify(p.formula.normalized_ingredients)) !== p.formula.normalized_sha256)
    errors.push("formula.normalized_sha256: mismatch")
  // Documented historical translation/punctuation repairs are admitted only for the exact frozen raw/list pair.
  const pinnedFormula = BOND_OWNER_REGISTRY.find(
    (r) =>
      r.raw_sha256 === p.formula.raw_sha256 && r.normalized_sha256 === p.formula.normalized_sha256,
  )
  const expected = pinnedFormula
    ? [...pinnedFormula.normalized_ingredients]
    : normalizeBondbuilderInci(p.formula.raw_inci)
  if (JSON.stringify(expected) !== JSON.stringify(p.formula.normalized_ingredients))
    errors.push("formula.normalized_ingredients: complete ordered sequence mismatch")
  if (
    p.identity.status !== "resolved" ||
    p.formula.status !== "complete" ||
    p.formula.conflicts.some((c) => !c.resolved) ||
    p.holds.identity.length
  )
    errors.push("identity_or_formula_unresolved")
  if (
    p.assessment.boundary_status !== "in_scope" ||
    !p.assessment.technology_family ||
    p.holds.boundary.length
  )
    errors.push("boundary_not_resolved_in_scope")
  if (p.assessment.reasoning.boundary_status.confidence === "low")
    errors.push("boundary_confidence_low")
  const owner = BOND_OWNER_REGISTRY.find(
    (r) =>
      r.product_name === p.identity.product_name &&
      r.brand === p.identity.brand &&
      r.market === p.identity.market &&
      r.size === p.identity.size &&
      r.source_version === p.identity.source_version &&
      r.raw_sha256 === p.formula.raw_sha256 &&
      r.normalized_sha256 === p.formula.normalized_sha256 &&
      p.formula.source_ids.some((id) =>
        p.sources.some((s) => s.id === id && s.url === r.source_url),
      ),
  )
  if (owner) {
    if (
      p.assessment.claim_trust_level !== owner.claim_trust_level ||
      p.assessment.trust_basis !== owner.trust_basis ||
      p.assessment.policy_reference !== owner.policy_reference ||
      p.assessment.technology_family !== owner.technology_family
    )
      errors.push("owner_decision_mismatch")
  } else if (
    p.assessment.claim_trust_level !== "low" ||
    p.assessment.trust_basis !== "owner_default" ||
    p.assessment.policy_reference !== BOND_DEFAULT_POLICY
  )
    errors.push("unverified_owner_grade: new identities require low owner_default")
  if (p.holds.claim_trust.length) errors.push("claim_trust_held")
  const tokens = p.formula.normalized_ingredients
  const has = (s: string) => tokens.some((t) => t.replace(/\s+/g, "") === s.replace(/\s+/g, ""))
  const supported = {
    sulfur_targeting_dimaleate: has("bis-aminopropyl diglycol dimaleate"),
    designed_peptide: has("sh-oligopeptide-78"),
    maleate_ester: has("diethylhexyl maleate"),
    acid_calcium_management: has("citric acid"),
    gluconamide_gluconate:
      has("hydroxypropylgluconamide") && has("hydroxypropylammonium gluconate"),
  }
  const markerLexicon: Record<keyof typeof supported, string[]> = {
    sulfur_targeting_dimaleate: ["bis-aminopropyl diglycol dimaleate"],
    designed_peptide: ["sh-oligopeptide-78"],
    maleate_ester: ["diethylhexyl maleate"],
    acid_calcium_management: ["citric acid", "sodium citrate", "glycine", "arginine", "betaine"],
    gluconamide_gluconate: ["hydroxypropylgluconamide", "hydroxypropylammonium gluconate"],
  }
  if (
    p.assessment.technology_family &&
    (!supported[p.assessment.technology_family] ||
      !p.formula.candidate_families.includes(p.assessment.technology_family) ||
      !p.formula.markers.some((m) => m.family === p.assessment.technology_family))
  )
    errors.push("technology_marker_or_candidate_mismatch")
  if (p.formula.markers.some((m) => !tokens.includes(m.literal)))
    errors.push("marker_not_literal_formula_observation")
  if (
    p.formula.markers.some(
      (m) =>
        !markerLexicon[m.family].some(
          (literal) => literal.replace(/\s/g, "") === m.literal.replace(/\s/g, ""),
        ),
    )
  )
    errors.push("marker_family_lexicon_mismatch")
  if (
    p.application.treatment_role.value === null ||
    p.assessment.reasoning.boundary_status.source_ids.length === 0
  )
    errors.push("specialized_treatment_boundary_evidence_missing")
  const ref = p.technology_reference
  if (ref.status === "matched") {
    const row = BOND_OWNER_REGISTRY.find(
      (r) =>
        BOND_REFERENCE_KEYS.some((k) => k === r.research_key) &&
        r.research_key === ref.research_key,
    )
    if (
      !row ||
      row.technology_family !== p.assessment.technology_family ||
      row.normalized_sha256 !== ref.formula_sha256 ||
      row.source_version !== ref.source_version ||
      ref.product_id !== null ||
      !ref.source_ids.length ||
      !ref.shared_markers.length ||
      ref.shared_markers.some(
        (m) =>
          !tokens.includes(m) ||
          !row.normalized_ingredients.some((t) => t === m) ||
          !p.formula.markers.some(
            (marker) => marker.literal === m && marker.family === row.technology_family,
          ),
      )
    )
      errors.push("technology_reference_binding_mismatch")
  } else if (
    ref.research_key !== null ||
    ref.product_id !== null ||
    ref.formula_sha256 !== null ||
    ref.source_version !== null ||
    ref.shared_markers.length
  )
    errors.push("unmatched_reference_contains_binding")
  return errors.length ? { success: false, errors } : { success: true, profile: p }
}

type Coverage = {
  property: string
  destination: string
  usable_status: "direct" | "mapped" | "retained_only" | "held"
  reason: string | null
}
export type BondbuilderProductionProjection = {
  category_specs: {
    product_bondbuilder_specs: {
      technology_family: NonNullable<BondbuilderResearchProfile["assessment"]["technology_family"]>
      claim_trust_level: NonNullable<BondbuilderResearchProfile["assessment"]["claim_trust_level"]>
      trust_basis: NonNullable<BondbuilderResearchProfile["assessment"]["trust_basis"]>
      research_profile: BondbuilderResearchProfile
      application_mode?: "pre_shampoo" | "post_wash_leave_in"
      treatment_mode?: "rinse_out" | "leave_in"
      product_format?: "cream_treatment" | "spray_treatment"
    }
  }
  field_rationales: Record<string, string>
}
export type BondbuilderProductionAdapterOutcome = {
  status: "projected" | "refused"
  readiness: {
    property_lane_ready: boolean
    property_projection_ready: boolean
    protocol_projection_ready: false
    curated_research_candidate: boolean
    catalog_intake_ready: false
    global_recommendation_ready: false
    publish_ready: false
  }
  productionProjection: BondbuilderProductionProjection | null
  propertyCoverage: { version: "bondbuilder-property-coverage-v1"; properties: Coverage[] }
  warnings: string[]
  errors: string[]
  requiredProtocolRoles: ["specialized_bond_treatment"]
}
export function projectBondbuilderForProduction(
  input: unknown,
): BondbuilderProductionAdapterOutcome {
  const parsed = bondbuilderResearchEnvelopeSchema.safeParse(input)
  const validation = parsed.success
    ? validateBondbuilderResearchProfile(parsed.data.profile)
    : {
        success: false as const,
        errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      }
  const base: BondbuilderProductionAdapterOutcome = {
    status: "refused",
    readiness: {
      property_lane_ready: false,
      property_projection_ready: false,
      protocol_projection_ready: false,
      curated_research_candidate: false,
      catalog_intake_ready: false,
      global_recommendation_ready: false,
      publish_ready: false,
    },
    productionProjection: null,
    propertyCoverage: { version: "bondbuilder-property-coverage-v1", properties: [] },
    warnings: ["provisional_method_not_locked_or_intake_active"],
    errors: [],
    requiredProtocolRoles: ["specialized_bond_treatment"],
  }
  if (!validation.success) return { ...base, errors: validation.errors }
  const p = validation.profile
  const specs: BondbuilderProductionProjection["category_specs"]["product_bondbuilder_specs"] = {
    technology_family: p.assessment.technology_family!,
    claim_trust_level: p.assessment.claim_trust_level!,
    trust_basis: p.assessment.trust_basis!,
    research_profile: p,
  }
  if (p.application.placement.value === "pre_shampoo") specs.application_mode = "pre_shampoo"
  if (
    p.application.placement.value === "post_shampoo" &&
    p.application.rinse.value?.treatment_mode === "leave_in"
  )
    specs.application_mode = "post_wash_leave_in"
  if (p.application.rinse.value) specs.treatment_mode = p.application.rinse.value.treatment_mode
  if (p.application.applied_format.value === "cream") specs.product_format = "cream_treatment"
  if (p.application.applied_format.value === "liquid_spray")
    specs.product_format = "spray_treatment"
  const destinations: Record<(typeof BOND_RESEARCH_PROPERTIES)[number], string> = {
    boundary_status: "assessment.boundary_status",
    technology_family: "assessment.technology_family",
    claim_trust_level: "assessment.claim_trust_level",
    trust_basis: "assessment.trust_basis",
    supported_outcome: "evidence.supported_outcome",
    evidence_profile: "evidence",
    application_mode: "application.placement",
    product_format: "application.applied_format",
    treatment_mode: "application.rinse",
    application_facts: "application",
    fit_assessment: "fit",
    intended_role: "application.treatment_role",
  }
  const properties: Coverage[] = BOND_RESEARCH_PROPERTIES.map((property) => ({
    property,
    destination: `research_profile.${destinations[property]}`,
    usable_status: ["technology_family", "claim_trust_level", "trust_basis"].includes(property)
      ? "direct"
      : Object.hasOwn(specs, property)
        ? "mapped"
        : "retained_only",
    reason:
      ["technology_family", "claim_trust_level", "trust_basis"].includes(property) ||
      Object.hasOwn(specs, property)
        ? null
        : "Retained as researched; no independent runtime/eligibility authority granted.",
  }))
  for (const property of [
    "method",
    "identity",
    "formula",
    "technology_reference",
    "explanations_de",
    "sources",
    "holds",
    "review",
    "assessment.classification_confidence",
    "assessment.limiting_factors",
    "assessment.reasoning",
  ])
    properties.push({
      property,
      destination: `research_profile.${property}`,
      usable_status: "retained_only",
      reason: "Complete provenance and reasoning retained without additional runtime authority.",
    })
  for (const [key, fact] of Object.entries(p.application))
    if (fact && typeof fact === "object" && "value" in fact)
      properties.push({
        property: `application.${key}`,
        destination: `research_profile.application.${key}`,
        usable_status: fact.value === null ? "held" : "retained_only",
        reason:
          fact.value === null
            ? fact.unknown_reason
            : "Exact protocol projection is a separate source-bound boundary.",
      })
    else
      properties.push({
        property: `application.${key}`,
        destination: `research_profile.application.${key}`,
        usable_status: "retained_only",
        reason: "Source applicability and variants retained for exact protocol review.",
      })
  for (const [key, fact] of Object.entries(p.fit))
    properties.push({
      property: `fit.${key}`,
      destination: `research_profile.fit.${key}`,
      usable_status: fact.value === null ? "held" : "retained_only",
      reason: fact.unknown_reason ?? "Eligibility changes require separate reviewed authority.",
    })
  const warnings = [
    ...base.warnings,
    "protocol_projection_required",
    ...Object.entries(p.holds).flatMap(([group, holds]) =>
      holds.map((h) => `${group}:${h.code}: ${h.reason}`),
    ),
  ]
  if (!specs.application_mode) warnings.push("application_mode_not_legacy_representable")
  if (!specs.product_format) warnings.push("product_format_not_legacy_representable")
  if (
    p.application.cadence.value?.status !== "source_stated" ||
    p.application.cadence.value.branches.length
  )
    warnings.push("exact_product_cadence_unavailable")
  return {
    ...base,
    status: "projected",
    readiness: {
      ...base.readiness,
      property_lane_ready: true,
      property_projection_ready: true,
      curated_research_candidate:
        p.assessment.claim_trust_level !== "low" &&
        p.assessment.trust_basis !== "owner_default" &&
        p.assessment.classification_confidence !== "low" &&
        !p.holds.protocol.length &&
        p.application.direction_source_ids.length > 0 &&
        [
          p.application.placement,
          p.application.sequence,
          p.application.timing,
          p.application.hair_state,
        ].every((fact) => fact.value !== null && fact.confidence !== "low") &&
        p.application.market_applicability === "exact_market",
    },
    productionProjection: {
      category_specs: { product_bondbuilder_specs: specs },
      field_rationales: Object.fromEntries(
        Object.keys(specs).map((k) => [
          `category_specs.product_bondbuilder_specs.${k}`,
          k === "research_profile"
            ? "Complete validated product-level research; provisional method, no activation authority."
            : (p.assessment.reasoning[k as keyof typeof p.assessment.reasoning]?.rationale ??
              "Source-backed compatible application mapping."),
        ]),
      ),
    },
    propertyCoverage: { version: "bondbuilder-property-coverage-v1", properties },
    warnings,
  }
}
