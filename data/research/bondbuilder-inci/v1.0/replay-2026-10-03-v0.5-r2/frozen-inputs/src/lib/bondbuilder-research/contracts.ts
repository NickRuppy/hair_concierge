import { z } from "zod"

export const BOND_TECHNOLOGY_FAMILIES = [
  "sulfur_targeting_dimaleate",
  "designed_peptide",
  "maleate_ester",
  "acid_calcium_management",
  "gluconamide_gluconate",
] as const
const key = z.string().min(1).max(200)
const note = z.string().min(1).max(1000)
const notes = z.array(note).max(30)
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date",
  )
const confidence = z.enum(["high", "moderate", "low"])
const family = z.enum(BOND_TECHNOLOGY_FAMILIES)
const ids = z
  .array(key)
  .max(30)
  .refine((v) => new Set(v).size === v.length, "Duplicate source IDs")
const seconds = z.number().int().min(0).max(604800)
const obj = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict()
const reasoning = obj({
  confidence,
  rationale: note,
  source_ids: ids,
  limitations: notes,
  assumptions: notes,
})

/** A null fact is retained with its reason; a factual value requires inspected sources. */
export function bondbuilderFactSchema<T extends z.ZodTypeAny>(value: T) {
  return obj({
    value: value.nullable(),
    source_ids: ids,
    confidence,
    rationale: note,
    limitations: notes,
    unknown_reason: note.nullable(),
  }).superRefine((v, ctx) => {
    const factValue = "value" in v ? v.value : undefined
    if (factValue === null && !v.unknown_reason)
      ctx.addIssue({ code: "custom", message: "Null fact requires unknown_reason" })
    if (factValue !== null && (v.source_ids.length === 0 || v.unknown_reason !== null))
      ctx.addIssue({
        code: "custom",
        message: "Established fact requires sources and null unknown_reason",
      })
  })
}

export const bondbuilderTimingSchema = z
  .discriminatedUnion("kind", [
    obj({
      kind: z.literal("exact_seconds"),
      seconds,
      purpose: z.enum(["contact", "wait_before_next_step", "working_time"]),
    }),
    obj({
      kind: z.literal("range_seconds"),
      minimum_seconds: seconds,
      maximum_seconds: seconds,
      purpose: z.enum(["contact", "wait_before_next_step", "working_time"]),
    }),
    obj({
      kind: z.literal("minimum_seconds"),
      minimum_seconds: seconds,
      purpose: z.enum(["contact", "wait_before_next_step", "working_time"]),
    }),
    obj({ kind: z.literal("overnight"), purpose: z.literal("contact") }),
    obj({
      kind: z.literal("no_extra_wait"),
      purpose: z.enum(["contact", "wait_before_next_step", "working_time"]),
    }),
  ])
  .refine(
    (v) => v.kind !== "range_seconds" || v.minimum_seconds <= v.maximum_seconds,
    "Reversed timing range",
  )
const quantity = obj({
  quantity: z.number().positive().max(100000),
  unit: z.enum(["ml", "g", "pump", "vial", "drop"]),
})
const clause = z
  .discriminatedUnion("kind", [
    obj({ kind: z.literal("consecutive_washes"), count: z.number().int().min(1).max(100) }),
    obj({
      kind: z.literal("every_n_washes"),
      minimum: z.number().int().min(1).max(100),
      maximum: z.number().int().min(1).max(100),
    }),
    obj({
      kind: z.literal("times_per_week"),
      minimum: z.number().min(0.1).max(14),
      maximum: z.number().min(0.1).max(14),
    }),
  ])
  .refine(
    (v) => v.kind === "consecutive_washes" || v.minimum <= v.maximum,
    "Reversed cadence range",
  )
export const bondbuilderApplicationSchema = obj({
  direction_source_ids: ids,
  source_market: key,
  market_applicability: z.enum(["exact_market", "cross_market_complement", "unresolved"]),
  applicability_note: note,
  placement: bondbuilderFactSchema(z.enum(["pre_shampoo", "post_shampoo", "between_washes"])),
  applied_format: bondbuilderFactSchema(z.enum(["cream", "gel_cream", "liquid_spray", "serum"])),
  treatment_role: bondbuilderFactSchema(z.enum(["pre_shampoo_treatment", "leave_in_treatment"])),
  hair_state: bondbuilderFactSchema(z.enum(["wet", "damp", "dry", "either", "pre_wash_dry"])),
  state_modifiers: bondbuilderFactSchema(
    z.array(z.enum(["thoroughly_towel_dried", "unwashed", "at_bedtime"])).max(3),
  ),
  application_area: bondbuilderFactSchema(
    z.enum(["lengths_ends", "root_to_tip", "ends_upward", "hair"]),
  ),
  distribution: bondbuilderFactSchema(note),
  timing: bondbuilderFactSchema(bondbuilderTimingSchema),
  longer_wear: bondbuilderFactSchema(
    obj({ overnight_allowed: z.boolean(), maximum_seconds: seconds.nullable() }),
  ),
  amount: bondbuilderFactSchema(
    z.discriminatedUnion("kind", [
      obj({ kind: z.literal("qualitative"), instruction: note }),
      obj({ kind: z.literal("numeric"), amount: quantity }),
      obj({ kind: z.literal("starting_dose"), amount: quantity, add_as_needed: z.boolean() }),
    ]),
  ),
  dilution: bondbuilderFactSchema(
    obj({
      concentrate: quantity,
      finished_volume_ml: z.number().positive().max(100000),
      intended_container: note,
      method: note,
      mixed_use_by_days: z.number().int().positive().max(365).nullable(),
    }),
  ),
  conditioner: bondbuilderFactSchema(
    obj({
      before: z.enum(["allowed", "not_allowed", "not_stated"]),
      after: z.enum(["required", "recommended", "optional", "not_stated"]),
      minimum_wait_seconds: seconds.nullable(),
      guidance_reference: key.nullable(),
    }),
  ),
  sequence: bondbuilderFactSchema(
    z
      .array(
        obj({
          action: z.enum([
            "shampoo",
            "layer_shampoo",
            "rinse",
            "towel_dry",
            "apply_treatment",
            "distribute",
            "wait",
            "apply_conditioner",
            "style",
            "dilute",
          ]),
          optional: z.boolean(),
          timing: bondbuilderTimingSchema.nullable(),
          source_ids: ids.min(1),
          note: note,
        }),
      )
      .min(1)
      .max(30),
  ),
  rinse: bondbuilderFactSchema(
    obj({
      treatment_mode: z.enum(["rinse_out", "leave_in"]),
      standalone_treatment_rinse: z.boolean(),
    }),
  ),
  cadence: bondbuilderFactSchema(
    obj({
      status: z.enum(["source_stated", "source_stated_conditional", "not_stated", "conflicting"]),
      initial: clause.nullable(),
      maintenance: clause.nullable(),
      branches: z
        .array(
          obj({
            condition: note,
            initial: clause.nullable(),
            maintenance: clause.nullable(),
            timing: bondbuilderTimingSchema.nullable(),
            source_ids: ids.min(1),
          }),
        )
        .max(30),
    }),
  ),
  partners: bondbuilderFactSchema(
    z
      .array(
        obj({
          name: key,
          requirement: z.enum(["required", "recommended", "optional"]),
          exclusivity_established: z.boolean(),
          source_ids: ids.min(1),
        }),
      )
      .max(30),
  ),
  source_variants: z
    .array(obj({ source_ids: ids.min(1), market: key, differences: note, selected: z.boolean() }))
    .max(30),
})

export const BOND_RESEARCH_PROPERTIES = [
  "boundary_status",
  "technology_family",
  "claim_trust_level",
  "trust_basis",
  "supported_outcome",
  "evidence_profile",
  "application_mode",
  "product_format",
  "treatment_mode",
  "application_facts",
  "fit_assessment",
  "intended_role",
] as const
const propertyReasoning = obj({
  boundary_status: reasoning,
  technology_family: reasoning,
  claim_trust_level: reasoning,
  trust_basis: reasoning,
  supported_outcome: reasoning,
  evidence_profile: reasoning,
  application_mode: reasoning,
  product_format: reasoning,
  treatment_mode: reasoning,
  application_facts: reasoning,
  fit_assessment: reasoning,
  intended_role: reasoning,
})
const evidenceLane = obj({
  supporting_source_ids: ids,
  counter_source_ids: ids,
  limitations: notes,
})
const fit = bondbuilderFactSchema(z.boolean())
const hold = obj({ code: key, reason: note, field: key.nullable(), source_ids: ids })
const holds = z.array(hold).max(30)

export const bondbuilderResearchProfileSchema = obj({
  version: z.literal("bondbuilder-research-profile-v1"),
  method: obj({
    method_id: z.literal("bondbuilder-inci"),
    method_version: key,
    standard_sha256: hash,
    runbook_sha256: hash,
    prompt_sha256: hash,
    blind_guide_sha256: hash,
    reference_registry_sha256: hash,
    run_reference: key,
    artifact_reference: z.string().min(1).max(1000),
    output_sha256: hash,
  }),
  identity: obj({
    research_key: key,
    product_name: key,
    brand: key,
    market: key,
    size: key,
    source_version: key,
    gtin: z
      .string()
      .regex(/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/)
      .nullable(),
    status: z.enum(["resolved", "unresolved"]),
    product_id: z.string().uuid().nullable(),
  }),
  formula: obj({
    raw_inci: z.string().min(1).max(32000),
    normalized_ingredients: z.array(key).min(1).max(300),
    raw_sha256: hash,
    normalized_sha256: hash,
    normalization_version: z.literal("bondbuilder-inci-normalization-v1"),
    status: z.enum(["complete", "incomplete", "conflicting"]),
    source_ids: ids.min(1),
    conflicts: z
      .array(
        obj({
          source_ids: ids.min(1),
          raw_inci: z.string().min(1).max(32000),
          reason: note,
          resolved: z.boolean(),
        }),
      )
      .max(30),
    markers: z.array(obj({ literal: key, family, source_ids: ids.min(1) })).max(30),
    candidate_families: z.array(family).max(5),
    candidate_to_final_trace: notes,
  }),
  assessment: obj({
    boundary_status: z.enum(["in_scope", "out_of_scope", "category_review", "research_hold"]),
    technology_family: family.nullable(),
    claim_trust_level: z.enum(["high", "medium", "low"]).nullable(),
    trust_basis: z.enum(["owner_anchor", "owner_calibration", "owner_default"]).nullable(),
    classification_confidence: confidence,
    limiting_factors: notes,
    policy_reference: key,
    reasoning: propertyReasoning,
  }),
  technology_reference: obj({
    status: z.enum(["matched", "no_existing_match", "not_assessed"]),
    research_key: key.nullable(),
    product_id: z.string().uuid().nullable(),
    formula_sha256: hash.nullable(),
    source_version: key.nullable(),
    shared_markers: z.array(key).max(30),
    source_ids: ids,
    limitation: note,
  }),
  application: bondbuilderApplicationSchema,
  evidence: obj({
    supported_outcome: note,
    summary: note,
    detail: z.string().min(1).max(6000),
    scientific: evidenceLane,
    practical: evidenceLane,
    applicability: z
      .array(
        obj({
          scope: z.enum(["product", "technology", "system", "predecessor", "practice"]),
          source_ids: ids.min(1),
          bridge: note,
          limitations: notes,
        }),
      )
      .max(30),
    manufacturer_positioning: notes,
    cautions: notes,
  }),
  explanations_de: obj({ concise: note, deeper: z.string().min(1).max(6000) }),
  sources: z
    .array(
      obj({
        id: key,
        url: z.string().url().max(2048),
        checked_date: date,
        authority: z.enum([
          "pack",
          "manufacturer",
          "distributor",
          "retailer",
          "peer_reviewed",
          "supplier",
          "patent",
          "professional",
          "creator",
          "other",
        ]),
        type: key,
        scope: z.enum(["product", "technology", "system", "predecessor", "practice"]),
        access: z.enum(["full_text", "abstract", "inspected_excerpt", "uninspected"]),
        author: note.nullable(),
        affiliation: note.nullable(),
        commercial_context: note.nullable(),
        observation: note,
        limitations: notes,
      }),
    )
    .min(1)
    .max(100),
  fit: obj({ fine: fit, normal: fit, coarse: fit }),
  holds: obj({ identity: holds, boundary: holds, claim_trust: holds, protocol: holds, fit: holds }),
  review: obj({
    checked_date: date,
    reviewed_date: date.nullable(),
    profile_sha256: hash,
    decision_references: z.array(key).max(30),
  }),
}).superRefine((profile, ctx) => {
  if (new TextEncoder().encode(JSON.stringify(profile)).length > 262144)
    ctx.addIssue({ code: "custom", message: "Profile exceeds 256 KiB" })
  const known = new Map(profile.sources.map((s) => [s.id, s]))
  if (known.size !== profile.sources.length)
    ctx.addIssue({ code: "custom", message: "Duplicate source registry IDs" })
  function walk(value: unknown, path: (string | number)[] = []) {
    if (!value || typeof value !== "object") return
    for (const [k, v] of Object.entries(value)) {
      if (k.endsWith("source_ids") && Array.isArray(v))
        for (const id of v) {
          const source = known.get(id)
          if (!source || source.access === "uninspected")
            ctx.addIssue({
              code: "custom",
              path: [...path, k],
              message: `Missing or uninspected factual source: ${id}`,
            })
        }
      walk(v, [...path, k])
    }
  }
  walk(profile)
})
export type BondbuilderResearchProfile = z.infer<typeof bondbuilderResearchProfileSchema>
export const bondbuilderResearchEnvelopeSchema = obj({
  version: z.literal("bondbuilder-research-envelope-v1"),
  submission_id: z.string().uuid().nullable(),
  profile: bondbuilderResearchProfileSchema,
})
export type BondbuilderResearchEnvelope = z.infer<typeof bondbuilderResearchEnvelopeSchema>
