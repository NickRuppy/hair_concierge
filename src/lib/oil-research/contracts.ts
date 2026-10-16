import { createHash } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import { z } from "zod"
import {
  OIL_FIT_POLICY_PINS,
  OIL_INTAKE_METHOD,
  OIL_LEGACY_INTAKE_METHOD,
  OIL_LOCAL_RESEARCH_METHOD,
  OIL_POLICY_PINS,
} from "./registry"

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }
const Json: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(Json),
    z.record(z.string(), Json),
  ]),
)
const JsonRecord = z.record(z.string(), Json)
const Text = z.string().refine((value) => value.trim().length > 0, "Expected nonblank text")
const Digest = z.string().regex(/^[a-f0-9]{64}$/)
const Rank = z.number().int().positive()
const Texts = z.array(Text)
const Notes = z.union([z.string(), z.array(Json)])
const ROLES = [
  "pre_wash_fibre_treatment",
  "leave_on_fibre_conditioning",
  "dry_finish",
  "scalp_application",
] as const
export const OilRoleSchema = z.enum(ROLES)
export type OilRole = z.infer<typeof OilRoleSchema>
export type OilFibreRole = Exclude<OilRole, "scalp_application">
const Roles = z
  .array(OilRoleSchema)
  .refine((a) => new Set(a).size === a.length, "Duplicate supported role")
const Weight = z.enum(["light", "medium", "rich", "unknown"])
const Confidence = z.enum(["high", "moderate", "low"])

export function sha256Utf8(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex")
}
export function orderedFormulaDigest(
  ranks: ReadonlyArray<{ rank: number; canonical_name: string }>,
): string {
  return sha256Utf8(
    JSON.stringify(ranks.map(({ rank, canonical_name }) => ({ rank, canonical_name }))),
  )
}
const Pins = z.record(z.string(), Digest)
const HistoricalMethod = z
  .object({ purpose: z.literal("consolidation_serialization"), policy_pins: Pins })
  .strict()
  .refine(
    (m) => isDeepStrictEqual(m.policy_pins, OIL_POLICY_PINS),
    "Stale or incomplete consolidation policy tuple",
  )
const IntakeMethod = z
  .object({
    purpose: z.literal("intake_research"),
    engine_id: z.literal("oil-standard"),
    methodology_version: z.literal("v0.8"),
    adapter_version: z.literal("oil-production-adapter-v1"),
    policy_pins: Pins,
  })
  .strict()
  .refine(
    (m) => isDeepStrictEqual(m, OIL_LEGACY_INTAKE_METHOD),
    "Stale or incomplete oil intake method tuple",
  )
const CurrentIntakeMethod = z
  .object({
    purpose: z.literal("intake_research"),
    engine_id: z.literal("oil-standard"),
    methodology_version: z.literal("v0.10"),
    adapter_version: z.literal("oil-production-adapter-v1"),
    policy_pins: Pins,
  })
  .strict()
  .refine(
    (m) => isDeepStrictEqual(m, OIL_INTAKE_METHOD),
    "Stale or incomplete current oil method tuple",
  )
const LocalResearchMethod = z
  .object({
    purpose: z.literal("local_research"),
    engine_id: z.literal("oil-standard"),
    methodology_version: z.literal("v0.9"),
    adapter_version: z.literal("oil-production-adapter-v1"),
    policy_pins: Pins,
  })
  .strict()
  .refine(
    (m) => isDeepStrictEqual(m, OIL_LOCAL_RESEARCH_METHOD),
    "Stale or incomplete local oil research method tuple",
  )
const Method = z.union([HistoricalMethod, IntakeMethod, LocalResearchMethod])
export type OilResearchMethod = z.infer<typeof Method> | z.infer<typeof CurrentIntakeMethod>
export const OilAuthoritySchema = z
  .object({ path: Text, sha256: Digest, record_key: Text, reason: Text })
  .catchall(Json)
const OriginalMethod = z
  .object({
    run_id: Text,
    path: Text,
    sha256: Digest,
    declared_version: Text.nullable(),
    unrecorded_note: Text.nullable(),
  })
  .strict()
  .refine(
    (x) => x.declared_version !== null || x.unrecorded_note !== null,
    "Missing original-method declaration note",
  )
const Provenance = z
  .object({
    import_kind: z.enum(["historical", "current", "local"]),
    original_method: OriginalMethod,
    original_record: JsonRecord,
    original_record_sha256: Digest,
    field_authorities: z.record(z.string(), OilAuthoritySchema),
    dependencies: z
      .array(z.object({ kind: Text, path: Text, sha256: Digest }).catchall(Json))
      .min(1),
    mapping_receipts: z.array(JsonRecord),
  })
  .strict()
const Identity = z
  .object({
    brand: Text,
    product: Text,
    market: Text,
    variant: Text.nullable(),
    package: z
      .object({
        size_text: Text.nullable(),
        size_ml: z.number().positive().nullable(),
        combined_declaration: Text.nullable(),
      })
      .strict(),
    identifier: Text.nullable(),
    category: z.enum(["hair_oil", "outside_hair_oil"]),
    original: JsonRecord,
    mapping_receipt: z.array(JsonRecord).min(1),
    source_ids: Texts.min(1),
    conflicts: Texts,
  })
  .strict()
const IngredientName = Text.refine(
  (value) => /[A-Za-z]/.test(value),
  "Ingredient name must contain alphabetic text",
)
const Ingredient = z
  .object({ rank: Rank, raw_name: IngredientName, canonical_name: IngredientName })
  .strict()
const Formula = z
  .object({
    raw_inci: Text,
    ingredients: z.array(Ingredient).min(1),
    raw_sha256: Digest,
    normalized_sha256: Digest,
    normalization_receipt: z.array(Ingredient.extend({ reason: Text })).min(1),
    contextual_declarations: z
      .array(
        z
          .object({
            literal: Text,
            kind: z.enum(["formula_code", "supplier_footnotes", "organic_annotation"]),
            source_id: Text,
            reason: Text,
          })
          .strict(),
      )
      .optional(),
    source_ids: Texts.min(1),
    declaration_status: z.enum(["complete", "incomplete", "conflicting"]),
    conflicts: Texts,
  })
  .strict()
const Direction = z.object({ direction_id: Text, text: Text }).strict()
const Source = z
  .object({
    source_id: Text,
    url: z.string().url().nullable(),
    url_note: Text.nullable(),
    original: JsonRecord,
    directions: z.array(Direction),
  })
  .strict()
  .refine((s) => s.url !== null || s.url_note !== null, "Missing source location note")
const Evidence = z.union([
  Text,
  z
    .object({
      rank: Rank.optional(),
      canonical_name: Text.optional(),
      source_id: Text.optional(),
      direction_id: Text.optional(),
    })
    .catchall(Json)
    .refine(
      (e) => e.rank !== undefined || e.source_id !== undefined || Object.keys(e).length > 0,
      "Empty evidence",
    ),
])
function property<T extends z.ZodTypeAny>(value: T) {
  return z
    .object({
      value,
      estimate: z.boolean(),
      confidence: Confidence,
      evidence: z.array(Evidence),
      counter_signal: Notes,
      nearest_alternative: Json,
      reason: Text,
      unresolved: Notes,
    })
    .strict()
}
const FitCell = z
  .object({
    value: z.enum(["suitable", "conditional", "unsuitable", "unknown"]),
    reason: Text,
    condition: Text.nullable().optional(),
  })
  .catchall(Json)
  .refine(
    (c) => c.value !== "conditional" || Boolean(c.condition),
    "Conditional fit needs a condition",
  )
const Axes = {
  thickness: z.object({ fine: FitCell, normal: FitCell, coarse: FitCell }).strict(),
  texture: z.object({ straight: FitCell, wavy: FitCell, curly: FitCell, coily: FitCell }).strict(),
  damage: z
    .object({ healthy: FitCell, moderately_damaged: FitCell, highly_damaged: FitCell })
    .strict(),
}
const Scenario = z
  .object({
    source_id: Text,
    direction_id: Text,
    supported_roles: Roles,
    site: Texts.min(1),
    stage: Text,
    dose: Text,
    contact_time: Text,
    removal: Text,
    restrictions: Text,
  })
  .catchall(Json)
const Ledger = z
  .object({
    rank: Rank,
    raw_name: Text,
    canonical_name: Text,
    dictionary_roles: Texts.min(1),
    formula_role: z.enum(["principal", "secondary", "auxiliary", "unresolved"]),
    role_reason: Text,
    ambiguity: Notes,
  })
  .catchall(Json)
const Auxiliary = z
  .object({
    reason: Text,
    markers: z.array(
      z.object({ rank: Rank, canonical_name: Text.optional(), function: Text }).catchall(Json),
    ),
    start_rank: z
      .union([Rank, z.literal("none")])
      .nullable()
      .optional(),
    ranks: z.array(Rank).optional(),
  })
  .catchall(Json)
  .refine((a) => "start_rank" in a || "status" in a, "Missing auxiliary boundary declaration")
export const OilProfileSchema = z
  .object({
    product_key: Text,
    case_id: Text,
    ingredient_ledger: z.array(Ledger).min(1),
    auxiliary_suffix: Auxiliary,
    base: property(
      z.enum([
        "pure_plant_oil",
        "plant_oil_blend",
        "silicone_led",
        "ester_alkane_led",
        "hybrid",
        "water_based",
        "unknown",
      ]),
    ),
    weight: property(Weight),
    penetration_potential: property(z.enum(["penetration_potential", "surface_led", "unknown"])),
    named_oils: z.array(
      z
        .object({
          hero_id: Text,
          hero_name: Text,
          matched_ranks: z.array(Rank),
          prominence: property(z.enum(["leading", "supporting", "trace", "absent", "unknown"])),
        })
        .catchall(Json),
    ),
    dispenser: property(
      z.enum(["dropper", "pump", "spray", "pour", "metered_drop", "other", "unknown"]),
    ),
    provides_heat_protection: property(z.boolean()),
    provides_uv_protection: property(z.boolean()),
    supported_uses: Roles,
    use_evidence: property(Roles),
    application_scenarios: z.array(Scenario),
    persistence_potential: z.enum(["low", "moderate", "high"]),
    ingredient_flags: z
      .object({
        silicones: property(z.boolean()),
        mineral_oil: property(z.boolean()),
        drying_alcohol: property(z.boolean()),
        fragrance: property(z.boolean()),
        scalp_active_botanicals: property(z.boolean()),
      })
      .strict(),
    fit: z.object(Axes).strict(),
    completion_status: z.enum(["complete", "complete_research_with_permitted_gaps", "incomplete"]),
    issues: z.array(Json).optional(),
  })
  .catchall(Json)
const CurrentEvidence = z
  .object({
    rank: Rank.optional(),
    canonical_name: Text.optional(),
    source_id: Text.optional(),
    direction_id: Text.optional(),
  })
  .catchall(Json)
  .refine(
    (e) => e.rank !== undefined || e.source_id !== undefined,
    "Current evidence must bind an ingredient rank or source",
  )

/** Lean current product truth. Optional confidence is trace metadata, never a decision input. */
function currentProperty<T extends z.ZodTypeAny>(value: T) {
  return property(value)
    .omit({ confidence: true })
    .extend({ confidence: Confidence.optional(), evidence: z.array(CurrentEvidence).min(1) })
}
export const CurrentOilProfileSchema = OilProfileSchema.omit({
  named_oils: true,
  dispenser: true,
  penetration_potential: true,
  fit: true,
})
  .extend({
    base: currentProperty(
      z.enum([
        "pure_plant_oil",
        "plant_oil_blend",
        "silicone_led",
        "ester_alkane_led",
        "hybrid",
        "water_based",
      ]),
    ),
    weight: currentProperty(z.enum(["light", "medium", "rich"])),
    provides_heat_protection: currentProperty(z.boolean()),
    provides_uv_protection: currentProperty(z.boolean()),
    use_evidence: currentProperty(Roles),
    ingredient_flags: z
      .object({
        silicones: currentProperty(z.boolean()),
        mineral_oil: currentProperty(z.boolean()),
        drying_alcohol: currentProperty(z.boolean()),
        fragrance: currentProperty(z.boolean()),
        scalp_active_botanicals: currentProperty(z.boolean()),
      })
      .strict(),
    completion_status: z.literal("complete"),
    // Optional future research is preserved but never enters required review or projection.
    supplementary_research: JsonRecord.optional(),
    // Server-authored preservation mirrors, not additional researched properties.
    identity: JsonRecord.optional(),
    formula: JsonRecord.optional(),
    field_authority: z.record(z.string(), OilAuthoritySchema).optional(),
  })
  .strict()
const Trace = z
  .object({
    reason: Text,
    evidence: z.array(z.object({ rank: Rank, canonical_name: Text }).strict()).min(1),
    considered_ranks: z.array(Rank).min(1),
    tipping_assumption: Text.nullable(),
    tipping_assumption_note: Text.nullable(),
    context: z
      .object({
        source_id: Text,
        direction_id: Text,
        role: z.enum(["leave_on_fibre_conditioning", "dry_finish"]),
      })
      .strict(),
    original: JsonRecord,
  })
  .strict()
const ScenarioFit = z
  .object({
    source_id: Text,
    direction_id: Text,
    role: OilRoleSchema,
    ...Axes,
    weight_authority: OilAuthoritySchema,
    policy_pins: Pins,
    original: JsonRecord,
  })
  .strict()
  .refine((f) => isDeepStrictEqual(f.policy_pins, OIL_FIT_POLICY_PINS), "Stale fit policy tuple")
const Common = {
  research_id: Text.refine((value) => /^oil:.+/.test(value), "Expected oil research key"),
  submission_id: z.string().uuid().nullable(),
  research_method: Method,
  identity: Identity,
  formula: Formula,
  sources: z.array(Source).min(1),
  provenance: Provenance,
}
const Envelope = z
  .object({
    ...Common,
    version: z.literal("oil-research-envelope-v1"),
    profile: OilProfileSchema,
    persistence_trace: Trace,
    scenario_fit: z.array(ScenarioFit).min(1),
  })
  .strict()
const Exclusion = z
  .object({
    ...Common,
    version: z.literal("oil-scope-exclusion-v1"),
    reviewed_directions: z.array(Scenario).min(1),
    directions_review_complete: z.literal(true),
    exclusion: z
      .object({
        reason: z.enum(["pre_wash_only", "scalp_only", "outside_hair_oil_category"]),
        explanation: Text,
        source_ids: Texts.min(1),
      })
      .strict(),
  })
  .strict()
const CurrentEnvelope = z
  .object({
    ...Common,
    version: z.literal("oil-research-envelope-v2"),
    research_method: CurrentIntakeMethod,
    profile: CurrentOilProfileSchema,
    persistence_trace: Trace,
  })
  .strict()
export const CurrentFreshOilResearchDraftSchema = CurrentEnvelope.omit({
  research_method: true,
  formula: true,
  provenance: true,
})
  .extend({
    formula: Formula.omit({ raw_sha256: true, normalized_sha256: true }),
    provenance: Provenance.pick({
      original_method: true,
      dependencies: true,
      mapping_receipts: true,
    }),
  })
  .strict()
export type LegacyOilResearchEnvelope = z.infer<typeof Envelope>
export type CurrentOilResearchEnvelope = z.infer<typeof CurrentEnvelope>
export type OilResearchEnvelope = LegacyOilResearchEnvelope | CurrentOilResearchEnvelope
export type OilScopeExclusion = z.infer<typeof Exclusion>
export type OilResearchInput = OilResearchEnvelope | OilScopeExclusion
type AuthoredOilDraft<E extends OilResearchEnvelope> = Omit<
  E,
  "research_method" | "provenance" | "formula"
> & {
  /** Hash fields are intentionally omitted: they are derived from these authored values. */
  formula: Omit<E["formula"], "raw_sha256" | "normalized_sha256">
  provenance: Pick<E["provenance"], "original_method" | "dependencies" | "mapping_receipts">
}

export type LegacyFreshOilResearchDraft = AuthoredOilDraft<LegacyOilResearchEnvelope>
export type CurrentFreshOilResearchDraft = AuthoredOilDraft<CurrentOilResearchEnvelope>
export type FreshOilResearchDraft = LegacyFreshOilResearchDraft | CurrentFreshOilResearchDraft

type ValidationFailure = (message: string, path?: (string | number)[]) => void

function formulaSeparatorIsPermitted(data: OilResearchInput, value: string): boolean {
  // Exact legacy punctuation remains frozen for historical and current Intake
  // records. The local v0.9 research lane additionally preserves the bullet
  // and ASCII-hyphen delimiters found in its maker declarations.
  return data.research_method.purpose === "local_research" ||
    data.version === "oil-research-envelope-v2"
    ? /^[\s,;.•-]*$/.test(value)
    : /^[\s,;.]*$/.test(value)
}

function checkFormula(data: OilResearchInput, fail: ValidationFailure): void {
  const { formula } = data
  if (formula.raw_sha256 !== sha256Utf8(formula.raw_inci))
    fail("Raw formula digest mismatch", ["formula", "raw_sha256"])
  if (formula.normalized_sha256 !== orderedFormulaDigest(formula.ingredients))
    fail("Ordered normalized formula digest mismatch", ["formula", "normalized_sha256"])
  if (formula.ingredients.some((r, i) => r.rank !== i + 1))
    fail("Formula ranks must be contiguous and ordered", ["formula", "ingredients"])
  if (
    formula.normalization_receipt.length !== formula.ingredients.length ||
    formula.ingredients.some((r, i) => {
      const n = formula.normalization_receipt[i]
      return (
        !n ||
        r.rank !== n.rank ||
        r.raw_name !== n.raw_name ||
        r.canonical_name !== n.canonical_name
      )
    })
  )
    fail("Normalization receipt must bind every exact rank", ["formula", "normalization_receipt"])
  // Match recorded raw names literally, including their internal numerical commas.
  // The ingredient-name guard separately rejects bare numeric fragments.
  let offset = 0
  for (const r of formula.ingredients) {
    const index = formula.raw_inci.indexOf(r.raw_name, offset)
    if (index < 0 || !formulaSeparatorIsPermitted(data, formula.raw_inci.slice(offset, index))) {
      fail("Raw declaration and ordered raw ranks differ", ["formula", "ingredients"])
      break
    }
    offset = index + r.raw_name.length
  }
  let remainder = formula.raw_inci.slice(offset).trim()
  for (const code of [...(formula.contextual_declarations ?? [])].reverse()) {
    if (!remainder.endsWith(code.literal))
      fail("Contextual formula code does not match exact declaration suffix")
    else remainder = remainder.slice(0, -code.literal.length).trim()
  }
  if (!formulaSeparatorIsPermitted(data, remainder))
    fail("Raw declaration contains unrepresented ingredients", ["formula", "ingredients"])
}

function checkIdentityAndProvenance(data: OilResearchInput, fail: ValidationFailure): void {
  const { provenance } = data
  if (provenance.original_record_sha256 !== sha256Utf8(JSON.stringify(provenance.original_record)))
    fail("Original record digest mismatch", ["provenance"])
  if (!isDeepStrictEqual(data.identity.original, provenance.original_record.identity))
    fail("Original identity preservation mismatch", ["identity", "original"])
  const originalIdentity = data.identity.original
  if (
    data.identity.brand !== originalIdentity.brand ||
    data.identity.product !== originalIdentity.product ||
    data.identity.market !== (originalIdentity.market ?? originalIdentity.market_size)
  )
    fail("Canonical identity differs from original declared identity", ["identity"])
  if (data.identity.variant !== (originalIdentity.variant ?? null))
    fail("Variant may not be inferred from missing metadata", ["identity", "variant"])
  const originalIdentifiers = [
    originalIdentity.gtin_if_verified,
    originalIdentity.identifier_if_verified,
  ].filter((x) => typeof x === "string")
  if (
    new Set(originalIdentifiers).size > 1 ||
    data.identity.identifier !== (originalIdentifiers[0] ?? null)
  )
    fail("Canonical identifier differs from original verified identifier", [
      "identity",
      "identifier",
    ])
  const expectedPackage =
    originalIdentity.size_ml !== undefined
      ? { size_text: null, size_ml: originalIdentity.size_ml, combined_declaration: null }
      : originalIdentity.size !== undefined
        ? { size_text: originalIdentity.size, size_ml: null, combined_declaration: null }
        : {
            size_text: null,
            size_ml: null,
            combined_declaration: originalIdentity.market_size ?? null,
          }
  if (!isDeepStrictEqual(data.identity.package, expectedPackage))
    fail("Canonical package must preserve the original declaration without inference", [
      "identity",
      "package",
    ])
  if (data.research_id !== `oil:${provenance.original_record.product_key}`)
    fail("Research identity differs from preserved product key", ["research_id"])
  if (
    data.formula.declaration_status === "complete" &&
    provenance.import_kind === "historical" &&
    !provenance.mapping_receipts.some(
      (receipt) =>
        receipt.kind === "declaration_admission" &&
        typeof receipt.basis === "string" &&
        receipt.basis.trim().length > 0,
    )
  )
    fail("Historical complete declaration requires its recorded admission basis", [
      "provenance",
      "mapping_receipts",
    ])
  if (data.research_method.purpose === "intake_research") {
    if (provenance.import_kind !== "current")
      fail("Intake method cannot relabel historical research", ["provenance", "import_kind"])
    if (data.submission_id === null)
      fail("Current intake research requires its Product Intake submission binding", [
        "submission_id",
      ])
    if (
      provenance.original_method.declared_version !== data.research_method.methodology_version ||
      provenance.original_method.unrecorded_note !== null
    )
      fail("Current intake research requires its exact declared source method", [
        "provenance",
        "original_method",
      ])
    if (
      data.formula.declaration_status === "complete" &&
      !provenance.mapping_receipts.some(
        (receipt) =>
          receipt.kind === "declaration_admission" &&
          typeof receipt.basis === "string" &&
          receipt.basis.trim().length > 0,
      )
    )
      fail("Current complete declaration requires an admission basis", [
        "provenance",
        "mapping_receipts",
      ])
  }
  if (data.research_method.purpose === "local_research") {
    if (provenance.import_kind !== "local")
      fail("Local research cannot relabel historical or current provenance", [
        "provenance",
        "import_kind",
      ])
    if (data.submission_id !== null)
      fail("Local research must not carry a Product Intake submission binding", ["submission_id"])
    if (
      provenance.original_method.declared_version !== "v0.9" ||
      provenance.original_method.unrecorded_note !== null
    )
      fail("Local research requires a declared v0.9 source method", [
        "provenance",
        "original_method",
      ])
    if (
      data.formula.declaration_status === "complete" &&
      !provenance.mapping_receipts.some(
        (receipt) =>
          receipt.kind === "declaration_admission" &&
          typeof receipt.basis === "string" &&
          receipt.basis.trim().length > 0,
      )
    )
      fail("Local complete declaration requires an admission basis", [
        "provenance",
        "mapping_receipts",
      ])
  }
  if (
    data.research_method.purpose === "consolidation_serialization" &&
    provenance.import_kind !== "historical"
  )
    fail("Historical consolidation cannot relabel current or local provenance", [
      "provenance",
      "import_kind",
    ])
}

function sourceReferences(value: string): string[] {
  return [...value.matchAll(/source_id\s*=\s*([^\s;,\]]*)/g)].map((match) => match[1])
}

function checkSourcesAndEvidence(data: OilResearchInput, fail: ValidationFailure) {
  const { formula } = data
  const sourceMap = new Map(data.sources.map((s) => [s.source_id, s]))
  if (sourceMap.size !== data.sources.length) fail("Duplicate source IDs", ["sources"])
  for (const s of data.sources)
    if (new Set(s.directions.map((d) => d.direction_id)).size !== s.directions.length)
      fail("Duplicate direction IDs within source", ["sources"])
  const checkSource = (id: string) => {
    if (!sourceMap.has(id)) fail(`Unresolved source ID: ${id}`)
  }
  const checkDirection = (source: string, direction: string) => {
    checkSource(source)
    if (!sourceMap.get(source)?.directions.some((d) => d.direction_id === direction))
      fail(`Unresolved source/direction: ${source}/${direction}`)
  }
  ;[
    ...data.identity.source_ids,
    ...formula.source_ids,
    ...(formula.contextual_declarations ?? []).map((c) => c.source_id),
  ].forEach(checkSource)
  // Structured evidence and source_id= legacy strings remain auditable without rewriting originals.
  const walkEvidence = (value: unknown): void => {
    if (typeof value === "string") {
      for (const id of sourceReferences(value)) checkSource(id)
      for (const match of value.matchAll(/\/ingredients\/(\d+)(?=$|[^\d])/g)) {
        if (!formula.ingredients[Number(match[1]) - 1])
          fail(`Unresolved ingredient rank in evidence reference: ${match[1]}`)
      }
    } else if (Array.isArray(value)) value.forEach(walkEvidence)
    else if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>
      for (const [key, value] of Object.entries(obj)) {
        if (key.endsWith("_source_id") && typeof value === "string") checkSource(value)
        if (key.endsWith("source_ids") && Array.isArray(value))
          value.filter((id): id is string => typeof id === "string").forEach(checkSource)
      }
      if (typeof obj.source_id === "string") {
        checkSource(obj.source_id)
        if (typeof obj.direction_id === "string") checkDirection(obj.source_id, obj.direction_id)
      }
      if (typeof obj.rank === "number") {
        const ingredient = formula.ingredients[obj.rank - 1]
        if (!Number.isInteger(obj.rank) || !ingredient)
          fail(`Unresolved ingredient rank: ${obj.rank}`)
        else if (
          typeof obj.canonical_name === "string" &&
          ingredient.canonical_name !== obj.canonical_name
        )
          fail(`Ingredient evidence mismatch at rank ${obj.rank}`)
      }
      for (const [key, ranks] of Object.entries(obj)) {
        if (
          key.endsWith("_rank") &&
          typeof ranks === "number" &&
          (!Number.isInteger(ranks) || !formula.ingredients[ranks - 1])
        )
          fail(`Unresolved ingredient rank in ${key}: ${ranks}`)
        if ((key === "ranks" || key.endsWith("_ranks")) && Array.isArray(ranks)) {
          for (const rank of ranks)
            if (
              typeof rank !== "number" ||
              !Number.isInteger(rank) ||
              !formula.ingredients[rank - 1]
            )
              fail(`Unresolved ingredient rank in ${key}: ${String(rank)}`)
        }
      }
      Object.values(obj).forEach(walkEvidence)
    }
  }
  const hasSourceReference = (evidence: unknown) =>
    typeof evidence === "string"
      ? sourceReferences(evidence).some((id) => sourceMap.has(id))
      : Boolean(
          evidence &&
          typeof evidence === "object" &&
          "source_id" in evidence &&
          sourceMap.has(String(evidence.source_id)),
        )
  return { checkSource, checkDirection, walkEvidence, hasSourceReference }
}

type SourceChecks = ReturnType<typeof checkSourcesAndEvidence>
function checkProfileAndFit(
  data: OilResearchEnvelope,
  fail: ValidationFailure,
  sources: SourceChecks,
): void {
  const { formula, provenance } = data
  const { checkDirection } = sources
  const p = data.profile
  if (data.research_id !== `oil:${p.product_key}`)
    fail("Research identity does not match product key", ["research_id"])
  const originalFormula = p.formula as JsonObject
  if (
    !originalFormula ||
    !isDeepStrictEqual(originalFormula.ingredients, formula.ingredients) ||
    originalFormula.raw_inci !== formula.raw_inci
  )
    fail("Canonical formula must preserve original raw declaration and ranks")
  if (!isDeepStrictEqual(p, provenance.original_record))
    fail("Profile must preserve original complete research record", ["profile"])
  if (!isDeepStrictEqual(provenance.field_authorities, p.field_authority))
    fail("Field-authority preservation mismatch", ["provenance", "field_authorities"])
  if (
    p.ingredient_ledger.length !== formula.ingredients.length ||
    p.ingredient_ledger.some((r, i) => {
      const f = formula.ingredients[i]
      return (
        !f ||
        r.rank !== f.rank ||
        r.raw_name !== f.raw_name ||
        r.canonical_name !== f.canonical_name
      )
    })
  )
    fail("Mechanism ledger must cover exact ordered formula", ["profile", "ingredient_ledger"])
  if (!isDeepStrictEqual(p.supported_uses, p.use_evidence.value))
    fail("Use evidence differs from supported uses")
  const roles = new Set(p.application_scenarios.flatMap((s) => s.supported_roles))
  if (roles.size !== p.supported_uses.length || p.supported_uses.some((r) => !roles.has(r)))
    fail("Supported uses must equal source scenario roles")
  p.application_scenarios.forEach((s) => checkDirection(s.source_id, s.direction_id))
  if (data.version === "oil-research-envelope-v2") return
  const expectedFit = p.application_scenarios.flatMap((s) =>
    s.supported_roles.map((r) => `${s.source_id}/${s.direction_id}/${r}`),
  )
  const actualFit = data.scenario_fit.map((f) => `${f.source_id}/${f.direction_id}/${f.role}`)
  const expectedFitKeys = new Set(expectedFit)
  if (expectedFitKeys.size !== expectedFit.length)
    fail("Duplicate source/direction/role scenario binding")
  if (
    new Set(actualFit).size !== actualFit.length ||
    expectedFitKeys.size !== actualFit.length ||
    actualFit.some((key) => !expectedFitKeys.has(key))
  )
    fail("Scenario fit must cover every scenario/role exactly once")
  data.scenario_fit.forEach((f) => {
    checkDirection(f.source_id, f.direction_id)
    if (!isDeepStrictEqual(f.weight_authority, provenance.field_authorities.weight))
      fail("Fit weight authority differs from profile authority")
    for (const key of [
      "source_id",
      "direction_id",
      "thickness",
      "texture",
      "damage",
      "weight_authority",
    ] as const) {
      if (!isDeepStrictEqual(f[key], f.original[key]))
        fail(`Canonical scenario fit differs from original ${key}`)
    }
    if (f.role !== f.original.supported_role)
      fail("Canonical scenario role differs from original supported role")
  })
}

function checkTraceAndClaims(
  data: OilResearchEnvelope,
  fail: ValidationFailure,
  sources: SourceChecks,
): void {
  const { formula, provenance, profile: p } = data
  const { checkDirection } = sources
  const trace = data.persistence_trace
  checkDirection(trace.context.source_id, trace.context.direction_id)
  const context = p.application_scenarios.find(
    (s) =>
      s.source_id === trace.context.source_id &&
      s.direction_id === trace.context.direction_id &&
      s.supported_roles.includes(trace.context.role),
  )
  if (!context?.supported_roles.includes(trace.context.role))
    fail("Persistence context lacks matching retained fibre scenario")
  if (
    trace.considered_ranks.length !== formula.ingredients.length ||
    trace.considered_ranks.some((r, i) => r !== i + 1)
  )
    fail("Persistence trace must consider all ordered ranks")
  if (
    trace.tipping_assumption === null &&
    (provenance.import_kind !== "historical" ||
      !trace.tipping_assumption_note ||
      "tipping_assumption" in trace.original)
  )
    fail("Only an explicitly unrecorded historical tipping assumption may be null")
  for (const key of ["reason", "evidence", "considered_ranks"] as const) {
    if (!isDeepStrictEqual(trace[key], trace.original[key]))
      fail(`Canonical persistence trace differs from original ${key}`)
  }
  if (!isDeepStrictEqual(trace.tipping_assumption, trace.original.tipping_assumption ?? null))
    fail("Canonical tipping assumption differs from original trace")
  if (
    "persistence_potential" in trace.original &&
    trace.original.persistence_potential !== p.persistence_potential
  )
    fail("Original persistence trace disagrees with profile scalar")
  for (const field of ["provides_heat_protection", "provides_uv_protection"] as const) {
    if (!p[field].evidence.some(sources.hasSourceReference))
      fail(`Claim review requires a bound source: ${field}`)
  }
  sources.walkEvidence(p)
  sources.walkEvidence(trace.evidence)
}

function checkInput(data: OilResearchInput, ctx: z.RefinementCtx): void {
  const fail: ValidationFailure = (message, path = []) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path })
  checkFormula(data, fail)
  checkIdentityAndProvenance(data, fail)
  const sources = checkSourcesAndEvidence(data, fail)
  if (data.version === "oil-scope-exclusion-v1") {
    data.exclusion.source_ids.forEach(sources.checkSource)
    data.reviewed_directions.forEach((s) => sources.checkDirection(s.source_id, s.direction_id))
  } else {
    checkProfileAndFit(data, fail, sources)
    checkTraceAndClaims(data, fail, sources)
  }
}
export const LegacyOilResearchEnvelopeSchema = Envelope.superRefine(checkInput)
export const CurrentOilResearchEnvelopeSchema = CurrentEnvelope.superRefine(checkInput)
export const OilResearchEnvelopeSchema = z.union([
  LegacyOilResearchEnvelopeSchema,
  CurrentOilResearchEnvelopeSchema,
])
export const OilScopeExclusionSchema = Exclusion.superRefine(checkInput)
export const OilResearchInputSchema = z.union([OilResearchEnvelopeSchema, OilScopeExclusionSchema])

/**
 * Builds a current intake record from the researcher-authored content. In
 * particular, no caller-provided formula or original-record digest is trusted.
 * The historical source record remains a separate envelope shape and is never
 * upgraded by this helper.
 */
export function assembleFreshOilResearchEnvelope(
  draft: LegacyFreshOilResearchDraft,
): LegacyOilResearchEnvelope
export function assembleFreshOilResearchEnvelope(
  draft: CurrentFreshOilResearchDraft,
): CurrentOilResearchEnvelope
export function assembleFreshOilResearchEnvelope(draft: FreshOilResearchDraft): OilResearchEnvelope
export function assembleFreshOilResearchEnvelope(
  draft: FreshOilResearchDraft,
): OilResearchEnvelope {
  const current = draft.version === "oil-research-envelope-v2"
  const method = current ? OIL_INTAKE_METHOD : OIL_LEGACY_INTAKE_METHOD
  const profileInput = current
    ? {
        ...draft.profile,
        identity: structuredClone(draft.identity.original),
        formula: {
          raw_inci: draft.formula.raw_inci,
          ingredients: structuredClone(draft.formula.ingredients),
        },
        field_authority: draft.profile.field_authority ?? {},
      }
    : draft.profile
  const canonicalProfile = current
    ? CurrentOilProfileSchema.parse(profileInput)
    : OilProfileSchema.parse(profileInput)
  const originalRecord = structuredClone(canonicalProfile) as unknown as JsonObject
  return OilResearchEnvelopeSchema.parse({
    ...draft,
    profile: canonicalProfile,
    research_method: method,
    formula: {
      ...draft.formula,
      raw_sha256: sha256Utf8(draft.formula.raw_inci),
      normalized_sha256: orderedFormulaDigest(draft.formula.ingredients),
    },
    provenance: {
      ...draft.provenance,
      import_kind: "current",
      original_record: originalRecord,
      original_record_sha256: sha256Utf8(JSON.stringify(originalRecord)),
      field_authorities: structuredClone(canonicalProfile.field_authority),
    },
  })
}
