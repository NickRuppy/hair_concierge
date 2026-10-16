/** Reproducible local-only assembly. No Intake, database or approval writes. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import {
  OilResearchEnvelopeSchema,
  orderedFormulaDigest,
  sha256Utf8,
} from "../../../../src/lib/oil-research/contracts"
import {
  OIL_LOCAL_RESEARCH_METHOD,
  OIL_FIT_POLICY_PINS,
} from "../../../../src/lib/oil-research/registry"
import { createOilLabCandidatePackage } from "../../../../src/lib/oil-research/candidate-package"
const root = process.cwd(),
  work = "plans/oil-inci/research/eu-full-profiles-2026-10-15",
  trial = "data/research/oil-inci/v1.0/corpus/holdout/persistence-contrast-v0.1",
  out = "data/research/oil-inci/v1.0/eu-full-profiles-v0.1"
const json = (p: string) => JSON.parse(readFileSync(join(root, p), "utf8"))
const hash = (p: string) => sha256Utf8(readFileSync(join(root, p), "utf8"))
const sourcePacket = json(`${work}/source-unblind/unblind-source-packet.json`),
  neutral = json(`${trial}/neutral-packet-v0.2.json`),
  bindings = json(`${trial}/source-bindings-v0.2.json`),
  persistence = json(`${trial}/parent-adjudication.json`),
  adjudication = json(`${work}/adjudication.json`)
const prop = (
  value: unknown,
  reason: string,
  evidence: unknown[],
  unresolved: unknown[] = [],
  estimate = false,
  confidence = "high",
  alternative: unknown = null,
) => ({
  value,
  estimate,
  confidence,
  evidence,
  counter_signal: [],
  nearest_alternative: alternative,
  reason,
  unresolved,
})
const auth = (path: string, key: string, reason: string) => ({
  path,
  sha256: hash(path),
  record_key: key,
  reason,
})
const profiles: any[] = [],
  envelopes: any[] = [],
  bundles: any[] = []
mkdirSync(join(root, out, "envelopes"), { recursive: true })
mkdirSync(join(root, out, "bundles"), { recursive: true })
for (const src of sourcePacket.records) {
  const id = src.neutral_id,
    frozen = neutral.records.find((r: any) => r.neutral_id === id),
    binding = bindings.records.find((r: any) => r.neutral_id === id),
    retained = persistence.records.find((r: any) => r.neutral_id === id),
    assessed = adjudication.records.find((r: any) => r.neutral_id === id)
  const identity = {
    brand: src.identity.brand,
    product: src.identity.product_name ?? src.identity.product,
    market: src.identity.market,
    size_ml: src.identity.size_ml,
    gtin_if_verified: src.identity.gtin ?? null,
    variant: null,
  }
  const normalization = frozen.ingredients.map((r: any) => ({
    ...r,
    reason:
      "Exact frozen per-rank normalization receipt retained; source display wrappers/footnotes do not change ingredient identity.",
  }))
  const formula = {
    raw_inci: src.raw_inci,
    ingredients: frozen.ingredients,
    raw_sha256: sha256Utf8(src.raw_inci),
    normalized_sha256: orderedFormulaDigest(frozen.ingredients),
    normalization_receipt: normalization,
    source_ids: src.source_ids.filter((s: string) => !s.includes("-I")),
    declaration_status: "complete",
    conflicts: [],
    contextual_declarations: [],
  }
  const scenarios = src.application_scenarios.map((s: any) => ({
    ...s,
    source_original: s,
    site: s.site.includes("scalp")
      ? ["scalp"]
      : s.site.includes("mid-lengths")
        ? ["mid_lengths", "ends"]
        : s.site.includes("lengths")
          ? ["lengths", "ends"]
          : s.site.includes("ends")
            ? ["ends"]
            : ["hair"],
    removal:
      s.removal.kind === "explicit_wash_after_contact" ||
      s.removal.kind === "explicit_wash_on_waking"
        ? "wash"
        : s.removal.kind === "explicit_do_not_rinse" ||
            s.removal.kind === "explicit_do_not_wash_out"
          ? "explicit_no_rinse"
          : "retained_styling_context",
    restrictions: s.restrictions.length
      ? s.restrictions.join("; ")
      : "None specified in this branch.",
  }))
  const roles = [...new Set(scenarios.flatMap((s: any) => s.supported_roles))]
  const authorities: any = {}
  for (const field of [
    "base",
    "weight",
    "penetration_potential",
    "ingredient_ledger",
    "auxiliary_suffix",
    "ingredient_flags",
  ])
    authorities[field] = auth(
      `${work}/adjudication.json`,
      id,
      "Parent adjudication of sealed independent remaining-property assessments under v0.9; no marketing-driven formula rewrite.",
    )
  for (const field of [
    "named_oils",
    "dispenser",
    "provides_heat_protection",
    "provides_uv_protection",
    "supported_uses",
    "use_evidence",
    "application_scenarios",
  ])
    authorities[field] = auth(
      `${work}/source-unblind/unblind-source-packet.json`,
      id,
      "Exact European maker source stage, applied after formula assessment seal.",
    )
  authorities.persistence_potential = auth(
    `${trial}/parent-adjudication.json`,
    id,
    "Preserve prior approved persistence scalar and full rank trace; not a new assessment.",
  )
  const named = src.heroes.map((hero: any) => {
    const rows = hero.matched_ranks.map((rank: number) => assessed.ingredient_ledger[rank - 1])
    let value = "unknown"
    if (!rows.length) value = "absent"
    else if (rows.some((r: any) => r.formula_role === "principal")) value = "leading"
    else if (rows.some((r: any) => r.formula_role === "secondary")) value = "supporting"
    else if (
      rows.every((r: any) => r.formula_role === "auxiliary") &&
      assessed.auxiliary_suffix.markers.length >= 2 &&
      hero.matched_ranks.every(
        (r: number) =>
          typeof assessed.auxiliary_suffix.start_rank === "number" &&
          r >= assessed.auxiliary_suffix.start_rank,
      )
    )
      value = "trace"
    return {
      hero_id: hero.hero_id,
      hero_name: hero.hero_name,
      matched_ranks: hero.matched_ranks,
      prominence: prop(
        value,
        value === "absent"
          ? "Advertised oil has no exact recognized match in the complete current declaration; source-copy mismatch preserved."
          : value === "unknown"
            ? "Exact advertised oil is mapped, but its unresolved preparation or auxiliary role outside a qualified suffix cannot establish prominence. No mass share inferred."
            : `Prominence follows the sealed formula-role ledger (${value}); no concentration threshold inferred.`,
        [
          { source_id: hero.source_id },
          ...rows.map((r: any) => ({ rank: r.rank, canonical_name: r.canonical_name })),
        ],
        [
          ...(hero.ambiguity ? [hero.ambiguity] : []),
          ...(value === "unknown"
            ? [
                "No qualified suffix-based trace or principal/secondary role supports a committed prominence value.",
              ]
            : []),
        ],
        value !== "absent" && value !== "unknown",
        value === "absent" ? "high" : "low",
      ),
      hero_kind: hero.hero_kind,
      mapping_receipt: hero,
    }
  })
  const axes = (role: string, weight = assessed.weight.value) => {
    const scalp = role === "scalp_application",
      pre = role === "pre_wash_fibre_treatment"
    const cell = (value: string, reason: string, condition: string | null = null) => ({
      value,
      reason,
      condition,
    })
    const thickness = Object.fromEntries(
      ["fine", "normal", "coarse"].map((t) => [
        t,
        scalp
          ? cell("unknown", "scalp_role_not_fibre_fit")
          : pre
            ? cell("suitable", "no_weight_only_pre_wash_gate")
            : (weight === "light" && t === "coarse") ||
                (weight === "medium" && t === "fine") ||
                (weight === "rich" && t !== "coarse")
              ? cell(
                  "conditional",
                  weight === "light"
                    ? "limited_richness_for_coarse_hair"
                    : "greater_load_or_flattening_concern",
                  weight === "light"
                    ? "Wenn ein leichteres Finish gewünscht ist. Es kann weniger reichhaltig ausfallen; daraus folgt keine Empfehlung, mehr Öl aufzutragen oder weitere Produkte zu schichten."
                    : "Sparsam innerhalb der veröffentlichten Anwendung und Haarpartie dosieren; mögliche Beschwerung beachten. Keine zusätzliche Mengenangabe abgeleitet.",
                )
              : cell("suitable", "thickness_weight_preference"),
      ]),
    )
    const neutralAxis = (keys: string[], reason: string) =>
      Object.fromEntries(
        keys.map((k) => [
          k,
          scalp ? cell("unknown", "scalp_role_not_fibre_fit") : cell("suitable", reason),
        ]),
      )
    return {
      thickness,
      texture: neutralAxis(["straight", "wavy", "curly", "coily"], "no_additional_pattern_gate"),
      damage: neutralAxis(
        ["healthy", "moderately_damaged", "highly_damaged"],
        "no_additional_damage_gate",
      ),
    }
  }
  const scenarioFit = scenarios.flatMap((s: any) =>
    s.supported_roles.map((role: string) => {
      const values = {
        source_id: s.source_id,
        direction_id: s.direction_id,
        role,
        ...axes(role),
        weight_authority: authorities.weight,
        policy_pins: OIL_FIT_POLICY_PINS,
      }
      return {
        ...values,
        original: {
          ...values,
          supported_role: role,
          scenario: s,
          weight: assessed.weight.value,
          estimate: true,
          weight_confidence: assessed.weight.confidence,
          alternative_weight: assessed.weight.nearest_alternative,
          alternative_thickness: axes(role, assessed.weight.nearest_alternative).thickness,
          sensitivity_note:
            "Alternative weight sensitivity only; no averaged class or extra application permission.",
        },
      }
    }),
  )
  const observed = src.packaging_observation
  const primary = src.source_ids[0]
  const profile = {
    product_key: `oil-eu-full-${id.toLowerCase()}`,
    case_id: id,
    identity,
    formula,
    ...Object.fromEntries(
      [
        "ingredient_ledger",
        "auxiliary_suffix",
        "base",
        "weight",
        "penetration_potential",
        "ingredient_flags",
      ].map((k) => [k, assessed[k]]),
    ),
    named_oils: named,
    dispenser: prop(
      observed.permitted_dispenser_value,
      observed.observation,
      observed.source_ids.map((source_id: string) => ({ source_id })),
      observed.unresolved ?? [],
      false,
      observed.permitted_dispenser_value === "unknown" ? "low" : "high",
    ),
    provides_heat_protection: prop(
      src.heat_claim_review.accepted_manufacturer_explicit_heat_claim,
      src.heat_claim_review.accepted_manufacturer_explicit_heat_claim
        ? "Accepted explicit exact-product manufacturer heat-protection claim."
        : "Completed review found no accepted explicit maker heat-protection claim.",
      src.heat_claim_review.source_ids.map((source_id: string) => ({ source_id })),
    ),
    provides_uv_protection: prop(
      false,
      "No accepted explicit hair-UV claim in the reviewed exact maker sources; therefore the filter AND claim gate is false. This does not measure zero protection.",
      src.uv_claim_review.source_ids.map((source_id: string) => ({ source_id })),
    ),
    supported_uses: roles,
    use_evidence: prop(
      roles,
      "Only coherent source-supported application branches; no dose, site, timing or removal imported from another branch.",
      scenarios.map((s: any) => ({ source_id: s.source_id, direction_id: s.direction_id })),
    ),
    application_scenarios: scenarios,
    persistence_potential: retained.persistence_potential,
    persistence_trace_reference: {
      path: `${trial}/parent-adjudication.json`,
      neutral_id: id,
      sha256: hash(`${trial}/parent-adjudication.json`),
    },
    field_authority: authorities,
    fit: Object.fromEntries(
      Object.entries(axes("leave_on_fibre_conditioning")).map(([axis, cells]) => [
        axis,
        Object.fromEntries(
          Object.keys(cells).map((key) => [
            key,
            { value: "unknown", reason: "scenario_specific_fit" },
          ]),
        ),
      ]),
    ),
    completion_status: "complete_research_with_permitted_gaps",
    issues: [
      ...assessed.issues,
      ...src.formula_conflicts,
      ...src.source_limits,
      ...(observed.unresolved ?? []),
    ],
    source_stage: src,
    formula_context_notes: frozen.contextual_declarations ?? [],
    reviewed_inputs: [
      "blind-method.md",
      "blind-input.json",
      "lane-a/results.json",
      "lane-b/results.json",
      "source-unblind/unblind-source-packet.json",
      "adjudication.json",
    ].map((path) => ({ path: `${work}/${path}`, sha256: hash(`${work}/${path}`) })),
    matching_policy: "manual_review_only; draft proposals are not engine-derived matching rules",
  }
  const selected = scenarios.find((s: any) =>
    s.supported_roles.includes("leave_on_fibre_conditioning"),
  )
  const evidence = retained.evidence.map(({ rank, canonical_name }: any) => ({
    rank,
    canonical_name,
  }))
  const traceOriginal = {
    ...retained,
    evidence,
    context_rebinding: {
      original_source_id: retained.source_id,
      original_direction_id: retained.direction_id,
      source_id: selected.source_id,
      direction_id: selected.direction_id,
      reason:
        "Same exact product/formula and retained application branch; full-source stage now carries all coherent scenarios.",
    },
  }
  const trace = {
    reason: retained.reason,
    evidence,
    considered_ranks: retained.considered_ranks,
    tipping_assumption: retained.tipping_assumption,
    tipping_assumption_note: null,
    context: {
      source_id: selected.source_id,
      direction_id: selected.direction_id,
      role: "leave_on_fibre_conditioning",
    },
    original: traceOriginal,
  }
  const sources = sourcePacket.source_registry
    .filter((s: any) => src.source_ids.includes(s.source_id))
    .map((s: any) => ({
      source_id: s.source_id,
      url: s.url,
      url_note: null,
      original: s,
      directions: [
        ...new Set(
          [...scenarios, ...src.supplemental_directions]
            .filter((x: any) => x.source_id === s.source_id)
            .map((x: any) => x.direction_id),
        ),
      ].map((direction_id) => ({
        direction_id,
        text: JSON.stringify(
          [...scenarios, ...src.supplemental_directions].filter(
            (x: any) => x.source_id === s.source_id && x.direction_id === direction_id,
          ),
        ),
      })),
    }))
  sources.push({
    source_id: binding.source_id,
    url: binding.source_url,
    url_note: null,
    original: binding,
    directions: [{ direction_id: binding.direction_id, text: binding.selected_direction }],
  })
  const dependencies = [
    `${work}/adjudication.json`,
    `${work}/assemble.ts`,
    `${work}/matching-drafts.json`,
    `${work}/blind-input.json`,
    `${work}/blind-method.md`,
    `${work}/lane-a/results.json`,
    `${work}/lane-b/results.json`,
    `${work}/source-unblind/unblind-source-packet.json`,
    `${trial}/parent-adjudication.json`,
    `${trial}/source-bindings-v0.2.json`,
    ...Object.keys(OIL_LOCAL_RESEARCH_METHOD.policy_pins),
  ].map((path) => ({ kind: "local_research_authority", path, sha256: hash(path) }))
  const envelope = OilResearchEnvelopeSchema.parse({
    version: "oil-research-envelope-v1",
    research_id: `oil:${profile.product_key}`,
    submission_id: null,
    research_method: OIL_LOCAL_RESEARCH_METHOD,
    identity: {
      brand: identity.brand,
      product: identity.product,
      market: identity.market,
      variant: null,
      package: { size_text: null, size_ml: identity.size_ml, combined_declaration: null },
      identifier: identity.gtin_if_verified,
      category: "hair_oil",
      original: identity,
      mapping_receipt: [
        {
          reason:
            "Literal exact European maker identity; no EU-wide formula equivalence or variant inference.",
          source_id: primary,
        },
      ],
      source_ids: src.source_ids,
      conflicts: [],
    },
    formula,
    sources,
    profile,
    persistence_trace: trace,
    scenario_fit: scenarioFit,
    provenance: {
      import_kind: "local",
      original_method: {
        run_id: "eu-full-profiles-v0.1",
        path: `${work}/adjudication.json`,
        sha256: hash(`${work}/adjudication.json`),
        declared_version: "v0.9",
        unrecorded_note: null,
      },
      original_record: profile,
      original_record_sha256: sha256Utf8(JSON.stringify(profile)),
      field_authorities: authorities,
      dependencies,
      mapping_receipts: [
        {
          kind: "declaration_admission",
          basis:
            "Complete exact European maker declaration rechecked; frozen raw string and all original ranks retained.",
          source_id: primary,
        },
        {
          kind: "persistence_carry_forward",
          path: `${trial}/parent-adjudication.json`,
          record_key: id,
          reason:
            "Previously approved scalar and rank trace unchanged; only source context binding documented.",
        },
      ],
    },
  })
  const matching = json(`${work}/matching-drafts.json`).records.find(
    (r: any) => r.neutral_id === id,
  ).suggestions
  const bundle = createOilLabCandidatePackage({
    envelope,
    matchingSuggestions: matching,
    sourceManifest: { records: dependencies.map(({ path, sha256 }) => ({ path, sha256 })) },
  })
  writeFileSync(
    join(root, out, "envelopes", `${id}.json`),
    JSON.stringify(envelope, null, 2) + "\n",
  )
  writeFileSync(join(root, out, "bundles", `${id}.json`), JSON.stringify(bundle, null, 2) + "\n")
  profiles.push(profile)
  envelopes.push(envelope)
  bundles.push(bundle)
}
writeFileSync(
  join(root, out, "profiles.json"),
  JSON.stringify({ method: OIL_LOCAL_RESEARCH_METHOD, records: profiles }, null, 2) + "\n",
)
writeFileSync(
  join(root, out, "summary.json"),
  JSON.stringify(
    {
      scope:
        "Four local European research candidates; pending human property/matching approval; no Intake handoff or catalog publication.",
      records: envelopes.map((e, i) => ({
        neutral_id: e.profile.case_id,
        product: e.identity.product,
        market: e.identity.market,
        size_ml: e.identity.package.size_ml,
        weight: e.profile.weight.value,
        base: e.profile.base.value,
        persistence: e.profile.persistence_potential,
        dispenser: e.profile.dispenser.value,
        penetration: e.profile.penetration_potential.value,
        heat: e.profile.provides_heat_protection.value,
        uv: e.profile.provides_uv_protection.value,
        packageFingerprint: bundles[i].packageFingerprint,
      })),
    },
    null,
    2,
  ) + "\n",
)
console.log(
  JSON.stringify({
    count: envelopes.length,
    out,
    records: envelopes.map((e) => ({
      id: e.profile.case_id,
      weight: e.profile.weight.value,
      persistence: e.profile.persistence_potential,
    })),
  }),
)
