import assert from "node:assert/strict"
import test from "node:test"

import {
  hasLegacyDiagnosticSignal,
  legacyColumnsToDiagnostics,
  type LegacyDiagnosticColumns,
} from "../src/lib/user-facts/backfill/legacy-columns-to-diagnostics"
import {
  legacyColumnsToCareHabits,
  type LegacyCareHabitColumns,
} from "../src/lib/user-facts/backfill/legacy-columns-to-care-habits"
import {
  STAGE3_COMPUTATION_VERSION,
  resolveStage2Head,
  type BackfillDraftRow,
  type BackfillNeedVersionRow,
} from "../src/lib/user-facts/backfill/resolve-stage2-head"
import { selectDiagnosticsSource } from "../src/lib/user-facts/backfill/select-diagnostics-source"
import {
  planUserFactsBackfill,
  type LegacyProfileColumns,
  type LoadedUserRow,
  type PlannedFactsWrite,
  type UserFactsBackfillPlan,
} from "../src/lib/user-facts/backfill/plan-row"
import { parseBackfillArguments, runUserFactsBackfill } from "../scripts/user-facts/backfill"

// ---------------------------------------------------------------------------
// legacyColumnsToDiagnostics
// ---------------------------------------------------------------------------

const FULL_DIAGNOSTIC_COLUMNS: LegacyDiagnosticColumns = {
  hair_texture: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "long",
  cuticle_condition: "slightly_rough",
  protein_moisture_balance: "stretches_stays",
  scalp_type: "oily",
  scalp_condition: "dandruff",
  chemical_treatment: ["bleached", "colored"],
  concerns: ["dryness", "frizz", "split_ends"],
  goals: ["moisture", "less_frizz", "volume"],
  desired_volume: null,
}

test("legacyColumnsToDiagnostics translates a complete column snapshot into native diagnostics", () => {
  const diagnostics = legacyColumnsToDiagnostics(FULL_DIAGNOSTIC_COLUMNS, { leadId: "lead-1" })

  assert.deepEqual(diagnostics, {
    texture: "wavy",
    thickness: "fine",
    density: "medium",
    hairLength: "long",
    hairSurface: "slightly_uneven",
    elasticResponse: "stretches_stays",
    scalpOiliness: "oily",
    scalpConcerns: ["oily_dandruff"],
    chemicalTreatments: ["lightened", "colored"],
    currentConcerns: ["dry_lengths", "frizz_flyaways", "split_ends"],
    goals: ["moisture", "frizz_surface", "volume_balance"],
    source: {
      kind: "legacy_columns",
      version: 1,
      leadId: "lead-1",
      raw: FULL_DIAGNOSTIC_COLUMNS,
    },
  })
})

test("legacyColumnsToDiagnostics omits null scalar columns instead of inventing a value", () => {
  const diagnostics = legacyColumnsToDiagnostics(
    {
      ...FULL_DIAGNOSTIC_COLUMNS,
      density: null,
      hair_length: null,
      protein_moisture_balance: null,
    },
    {},
  )

  assert.equal("density" in diagnostics, false)
  assert.equal("hairLength" in diagnostics, false)
  assert.equal("elasticResponse" in diagnostics, false)
  assert.equal("leadId" in diagnostics.source, false)
  assert.equal(diagnostics.texture, "wavy")
})

test("legacyColumnsToDiagnostics drops unmapped legacy values and dedupes many-to-one mappings", () => {
  const diagnostics = legacyColumnsToDiagnostics(
    {
      ...FULL_DIAGNOSTIC_COLUMNS,
      chemical_treatment: ["colored", "irgendwas"],
      concerns: ["hair_loss", "thinning", "dandruff", "oily_scalp", "tangling"],
      goals: [
        "anti_breakage",
        "strengthen",
        "less_split_ends",
        "healthier_hair",
        "color_protection",
      ],
    },
    {},
  )

  assert.deepEqual(diagnostics.chemicalTreatments, ["colored"])
  assert.deepEqual(diagnostics.currentConcerns, ["hair_loss_or_thinning", "tangling"])
  assert.deepEqual(diagnostics.goals, ["strength_ends"])
})

test("legacyColumnsToDiagnostics reads a null scalp_condition as no scalp concerns only when the scalp section was answered", () => {
  const answered = legacyColumnsToDiagnostics(
    { ...FULL_DIAGNOSTIC_COLUMNS, scalp_condition: null, goals: null, concerns: null },
    {},
  )
  assert.deepEqual(answered.scalpConcerns, [])
  assert.equal("goals" in answered, false)
  assert.equal("currentConcerns" in answered, false)

  // J2: with no `scalp_type` the row never answered the scalp section at all.
  const neverAnswered = legacyColumnsToDiagnostics(
    { ...FULL_DIAGNOSTIC_COLUMNS, scalp_condition: null, scalp_type: null },
    {},
  )
  assert.equal("scalpConcerns" in neverAnswered, false)
  assert.equal("scalpOiliness" in neverAnswered, false)

  // An unrecognised condition is unknown, never "none".
  const unrecognised = legacyColumnsToDiagnostics(
    { ...FULL_DIAGNOSTIC_COLUMNS, scalp_condition: "irgendwas" },
    {},
  )
  assert.equal("scalpConcerns" in unrecognised, false)
})

test("hasLegacyDiagnosticSignal separates an empty legacy row from one carrying any answer", () => {
  const empty: LegacyDiagnosticColumns = {
    hair_texture: null,
    thickness: null,
    density: null,
    hair_length: null,
    cuticle_condition: null,
    protein_moisture_balance: null,
    scalp_type: null,
    scalp_condition: null,
    chemical_treatment: [],
    concerns: [],
    goals: null,
    desired_volume: null,
  }

  assert.equal(hasLegacyDiagnosticSignal(empty), false)
  assert.equal(hasLegacyDiagnosticSignal({ ...empty, thickness: "fine" }), true)
  assert.equal(hasLegacyDiagnosticSignal({ ...empty, goals: ["moisture"] }), true)
  assert.equal(hasLegacyDiagnosticSignal({ ...empty, scalp_condition: "irritated" }), true)
})

// ---------------------------------------------------------------------------
// legacyColumnsToCareHabits
// ---------------------------------------------------------------------------

const EMPTY_CARE_HABIT_COLUMNS: LegacyCareHabitColumns = {
  towel_material: null,
  towel_technique: null,
  drying_method: null,
  styling_tools: null,
  heat_styling: null,
  uses_heat_protection: null,
  night_protection: null,
}

test("legacyColumnsToCareHabits unions drying routes and heat tools and fans the single heat_styling level out over every selected source", () => {
  const careHabits = legacyColumnsToCareHabits({
    towel_material: "frottee",
    towel_technique: "rubbeln",
    drying_method: "blow_dry",
    styling_tools: ["flat_iron", "diffuser"],
    heat_styling: "several_weekly",
    uses_heat_protection: true,
    night_protection: ["loose_braid", "silk_satin_pillow"],
  })

  assert.deepEqual(careHabits, {
    towel: { material: "frottee", technique: "rough_rubbing" },
    dryingRoutes: ["ordinary_blow_dry", "diffuser_or_airflow_shaping"],
    additionalHeatTools: ["straightener"],
    heatEvents: {
      "heat:ordinary_blow_dry": { frequency: "weekly_3_4x" },
      "heat:diffuser_airflow_shaping": {
        frequency: "weekly_3_4x",
        protectionConsistency: "always",
      },
      "heat:straightener": { frequency: "weekly_3_4x", protectionConsistency: "always" },
    },
    nightProtection: ["loose_tied", "silk_satin_pillow"],
  })
})

test("legacyColumnsToCareHabits drops the technique for no_towel, keeps an explicit empty tool list, and records never as zero heat events", () => {
  const careHabits = legacyColumnsToCareHabits({
    towel_material: "no_towel",
    towel_technique: "rubbeln",
    drying_method: "air_dry",
    styling_tools: [],
    heat_styling: "never",
    uses_heat_protection: false,
    night_protection: null,
  })

  assert.deepEqual(careHabits, {
    towel: { material: "no_towel" },
    dryingRoutes: ["air_dry"],
    additionalHeatTools: [],
    heatEvents: {},
  })
})

test("legacyColumnsToCareHabits omits every field a null column cannot answer", () => {
  assert.deepEqual(legacyColumnsToCareHabits(EMPTY_CARE_HABIT_COLUMNS), {})
})

test("legacyColumnsToCareHabits omits heatEvents when heat_styling is null even though heat sources are selected", () => {
  const careHabits = legacyColumnsToCareHabits({
    ...EMPTY_CARE_HABIT_COLUMNS,
    styling_tools: ["curling_iron"],
    uses_heat_protection: true,
  })

  assert.deepEqual(careHabits, {
    dryingRoutes: [],
    additionalHeatTools: ["curling_or_wave_iron"],
  })
  assert.equal("wetWashFrequency" in careHabits, false)
})

// ---------------------------------------------------------------------------
// resolveStage2Head (F24/F25 traversal + F27 provenance attribution)
// ---------------------------------------------------------------------------

const STAGE2_COMPUTATION_VERSION = "stage1-v1"

const HEAD_ANSWERS = {
  currentProductCategories: ["shampoo", "conditioner"],
  wetWashFrequency: "weekly_3_4x",
  towel: { material: "mikrofaser", technique: "gentle_press" },
  dryingRoutes: ["ordinary_blow_dry"],
  additionalHeatTools: [],
  heatEvents: { "heat:ordinary_blow_dry": { frequency: "weekly_2x" } },
  nightProtection: ["silk_satin_pillow"],
}

const HEAD_COMPLETED_IDS = [
  "current_product_categories",
  "wet_wash_frequency",
  "towel_handling",
  "drying_routes",
  "additional_heat_tools",
  "heat:ordinary_blow_dry",
  "night_protection",
]

function stage2Version(overrides: Partial<BackfillNeedVersionRow> = {}): BackfillNeedVersionRow {
  return {
    id: "version-stage2",
    kind: "refined",
    parent_need_version_id: "version-initial",
    computation_version: STAGE2_COMPUTATION_VERSION,
    input_snapshot: {
      triggerContext: { relevantCategories: ["shampoo"] },
      answers: HEAD_ANSWERS,
      completedQuestionIds: HEAD_COMPLETED_IDS,
    },
    output_snapshot: { inputHash: "a".repeat(64) },
    ...overrides,
  }
}

function stage3Version(overrides: Partial<BackfillNeedVersionRow> = {}): BackfillNeedVersionRow {
  return {
    id: "version-stage3",
    kind: "refined",
    parent_need_version_id: "version-initial",
    computation_version: STAGE3_COMPUTATION_VERSION,
    input_snapshot: {
      computationVersion: STAGE3_COMPUTATION_VERSION,
      refinedInputHash: "a".repeat(64),
      decisions: [],
      coverage: [],
    },
    output_snapshot: { inputHash: "b".repeat(64) },
    ...overrides,
  }
}

function completedDraft(overrides: Partial<BackfillDraftRow> = {}): BackfillDraftRow {
  return {
    id: "draft-1",
    revision: 9,
    answer_provenance: { night_protection: "assumed", wet_wash_frequency: "user" },
    completed_question_ids: [...HEAD_COMPLETED_IDS],
    module_projections: {},
    result_refined_need_version_id: "version-stage2",
    ...overrides,
  }
}

/** Section A ids only — what a products-first draft has actually completed. */
const PRODUCTS_ONLY_DRAFT_IDS = ["current_product_categories", "wet_wash_frequency"]

/**
 * A products-first draft that projected a module receipt: the VERSION's snapshot carries the
 * resolver-filled habits answers too, but the draft itself never completed those questions
 * and has no provenance entry for them.
 */
function productsFirstReceiptDraft(overrides: Partial<BackfillDraftRow> = {}): BackfillDraftRow {
  return completedDraft({
    result_refined_need_version_id: null,
    revision: 4,
    answer_provenance: { current_product_categories: "user", wet_wash_frequency: "user" },
    completed_question_ids: [...PRODUCTS_ONLY_DRAFT_IDS],
    module_projections: {
      products: { needVersionId: "version-stage2", projectedAtRevision: 4, stage3Handoff: true },
    },
    ...overrides,
  })
}

/**
 * Fix round 2, P2 (F27): on the receipt path the snapshot's `completedQuestionIds` include
 * every question the projection's assumption resolver filled in. Reading them through
 * `toFieldProvenance`'s missing-entry default would import resolver assumptions as "user"
 * facts. The DRAFT's own completed list is the only provable evidence of a user answer.
 */
test("resolveStage2Head marks receipt-path answers the draft never completed as assumed", () => {
  const resolved = resolveStage2Head({
    plan: { id: "plan-1", current_refined_need_version_id: "version-stage2" },
    needVersions: [stage2Version()],
    drafts: [productsFirstReceiptDraft()],
  })

  assert.equal(resolved.kind, "refined")
  if (resolved.kind !== "refined") return
  assert.equal(resolved.provenanceSource, "receipt_at_current_revision")
  assert.deepEqual(resolved.provenance, {
    current_product_categories: "user",
    wet_wash_frequency: "user",
    towel_handling: "assumed",
    drying_routes: "assumed",
    additional_heat_tools: "assumed",
    "heat:ordinary_blow_dry": "assumed",
    night_protection: "assumed",
  })
})

test("resolveStage2Head still trusts an explicit receipt-path provenance entry over the draft's completed list", () => {
  const resolved = resolveStage2Head({
    plan: { id: "plan-1", current_refined_need_version_id: "version-stage2" },
    needVersions: [stage2Version()],
    drafts: [
      productsFirstReceiptDraft({
        answer_provenance: {
          current_product_categories: "assumed",
          wet_wash_frequency: "user",
          night_protection: "user",
        },
      }),
    ],
  })

  assert.equal(
    resolved.kind === "refined" && resolved.provenance.current_product_categories,
    "assumed",
  )
  assert.equal(resolved.kind === "refined" && resolved.provenance.night_protection, "user")
  assert.equal(resolved.kind === "refined" && resolved.provenance.towel_handling, "assumed")
})

test("resolveStage2Head reports none when the plan has no refined head at all", () => {
  assert.deepEqual(resolveStage2Head({ plan: null, needVersions: [], drafts: [] }), {
    kind: "none",
  })
  assert.deepEqual(
    resolveStage2Head({
      plan: { id: "plan-1", current_refined_need_version_id: null },
      needVersions: [],
      drafts: [],
    }),
    { kind: "none" },
  )
})

test("resolveStage2Head decodes the Stage-2 head and freezes the completed draft's own provenance", () => {
  const resolved = resolveStage2Head({
    plan: { id: "plan-1", current_refined_need_version_id: "version-stage2" },
    needVersions: [stage2Version()],
    drafts: [completedDraft()],
  })

  assert.equal(resolved.kind, "refined")
  if (resolved.kind !== "refined") return
  assert.equal(resolved.version.id, "version-stage2")
  assert.equal(resolved.provenanceSource, "completed_draft")
  assert.equal(resolved.draftId, "draft-1")
  assert.deepEqual(resolved.completedQuestionIds, HEAD_COMPLETED_IDS)
  assert.deepEqual(resolved.answers, {
    currentProductCategories: ["shampoo", "conditioner"],
    wetWashFrequency: "weekly_3_4x",
    towel: { material: "mikrofaser", technique: "gentle_press" },
    dryingRoutes: ["ordinary_blow_dry"],
    additionalHeatTools: [],
    heatEvents: { "heat:ordinary_blow_dry": { frequency: "weekly_2x" } },
    nightProtection: ["silk_satin_pillow"],
  })
  assert.deepEqual(resolved.provenance, {
    current_product_categories: "user",
    wet_wash_frequency: "user",
    towel_handling: "user",
    drying_routes: "user",
    additional_heat_tools: "user",
    "heat:ordinary_blow_dry": "user",
    night_protection: "assumed",
  })
})

test("resolveStage2Head walks a Stage-3-revised head back to its Stage-2 sibling by refinedInputHash", () => {
  const resolved = resolveStage2Head({
    plan: { id: "plan-1", current_refined_need_version_id: "version-stage3" },
    needVersions: [stage3Version(), stage2Version()],
    drafts: [completedDraft()],
  })

  assert.equal(resolved.kind, "refined")
  if (resolved.kind !== "refined") return
  assert.equal(resolved.version.id, "version-stage2")
  assert.equal(resolved.provenanceSource, "completed_draft")
})

test("resolveStage2Head chains through a Stage-3 revision that revises another Stage-3 revision", () => {
  const second = stage3Version({
    id: "version-stage3-b",
    input_snapshot: {
      computationVersion: STAGE3_COMPUTATION_VERSION,
      refinedInputHash: "b".repeat(64),
    },
    output_snapshot: { inputHash: "c".repeat(64) },
  })

  const resolved = resolveStage2Head({
    plan: { id: "plan-1", current_refined_need_version_id: "version-stage3-b" },
    needVersions: [second, stage3Version(), stage2Version()],
    drafts: [],
  })

  assert.equal(resolved.kind, "refined")
  if (resolved.kind !== "refined") return
  assert.equal(resolved.version.id, "version-stage2")
})

test("resolveStage2Head uses a module receipt only while it matches the draft's current revision", () => {
  const projectedDraft = completedDraft({
    result_refined_need_version_id: null,
    revision: 4,
    module_projections: {
      products: { needVersionId: "version-stage2", projectedAtRevision: 4, stage3Handoff: true },
    },
  })

  const atRevision = resolveStage2Head({
    plan: { id: "plan-1", current_refined_need_version_id: "version-stage2" },
    needVersions: [stage2Version()],
    drafts: [projectedDraft],
  })
  assert.equal(
    atRevision.kind === "refined" && atRevision.provenanceSource,
    "receipt_at_current_revision",
  )
  assert.deepEqual(
    atRevision.kind === "refined" ? atRevision.provenance.night_protection : null,
    "assumed",
  )

  const afterUnprojectedEdit = resolveStage2Head({
    plan: { id: "plan-1", current_refined_need_version_id: "version-stage2" },
    needVersions: [stage2Version()],
    drafts: [{ ...projectedDraft, revision: 5 }],
  })
  assert.equal(
    afterUnprojectedEdit.kind === "refined" && afterUnprojectedEdit.provenanceSource,
    "unknown_historical",
  )
  if (afterUnprojectedEdit.kind !== "refined") return
  assert.equal(afterUnprojectedEdit.draftId, null)
  // R1: the unprojected draft edit stays in the draft — answers come from the VERSION.
  assert.deepEqual(afterUnprojectedEdit.answers.nightProtection, ["silk_satin_pillow"])
  assert.deepEqual(
    Object.values(afterUnprojectedEdit.provenance),
    HEAD_COMPLETED_IDS.map(() => "unknown_historical"),
  )
})

test("resolveStage2Head marks every answer unknown_historical when no draft can prove provenance", () => {
  const resolved = resolveStage2Head({
    plan: { id: "plan-1", current_refined_need_version_id: "version-stage2" },
    needVersions: [stage2Version()],
    drafts: [],
  })

  assert.equal(resolved.kind === "refined" && resolved.provenanceSource, "unknown_historical")
})

test("resolveStage2Head refuses to guess when the head row or its Stage-2 sibling is missing", () => {
  assert.deepEqual(
    resolveStage2Head({
      plan: { id: "plan-1", current_refined_need_version_id: "version-gone" },
      needVersions: [stage2Version()],
      drafts: [],
    }),
    { kind: "unresolvable", reason: "current_refined_need_version_missing (version-gone)" },
  )

  assert.deepEqual(
    resolveStage2Head({
      plan: { id: "plan-1", current_refined_need_version_id: "version-stage3" },
      needVersions: [stage3Version()],
      drafts: [],
    }),
    {
      kind: "unresolvable",
      reason: `stage2_sibling_not_found (stage3 version-stage3, refinedInputHash ${"a".repeat(64)})`,
    },
  )
})

test("resolveStage2Head refuses a Stage-2 head whose snapshot carries no usable answers", () => {
  assert.deepEqual(
    resolveStage2Head({
      plan: { id: "plan-1", current_refined_need_version_id: "version-stage2" },
      needVersions: [stage2Version({ input_snapshot: { triggerContext: {} } })],
      drafts: [],
    }),
    { kind: "unresolvable", reason: "stage2_head_without_answers (version-stage2)" },
  )

  const invalid = resolveStage2Head({
    plan: { id: "plan-1", current_refined_need_version_id: "version-stage2" },
    needVersions: [
      stage2Version({
        input_snapshot: { answers: { wetWashFrequency: "jeden_tag" }, completedQuestionIds: [] },
      }),
    ],
    drafts: [],
  })
  assert.equal(invalid.kind, "unresolvable")
  assert.match(
    invalid.kind === "unresolvable" ? invalid.reason : "",
    /^stage2_head_answers_invalid \(version-stage2\)/,
  )
})

// ---------------------------------------------------------------------------
// selectDiagnosticsSource (P4 precedence + conflict evidence)
// ---------------------------------------------------------------------------

const V3_ENVELOPE = {
  kind: "personal_plan",
  version: 3,
  answers: {
    texture: "wavy",
    thickness: "fine",
    density: "medium",
    goals: ["moisture", "shine"],
    routineClarity: "clear",
    resultReliability: "mostly",
    adaptationConfidence: "yes",
    currentConcerns: ["dry_lengths"],
    hairLength: "long",
    hairSurface: "slightly_uneven",
    elasticResponse: "stretches_stays",
    chemicalTreatments: ["colored"],
    scalpOiliness: "oily",
    scalpConcerns: ["oily_dandruff"],
    previousAttempts: "some_steps_helped",
    blockers: ["consistency"],
    routineStyle: "simple_reliable",
    meaningfulMoment: "everyday",
  },
} as const

const LEGACY_QUIZ_ANSWERS = {
  structure: "curly",
  thickness: "coarse",
  density: "high",
  hair_length: "medium",
  fingertest: "rau",
  pulltest: "snaps",
  scalp_type: "trocken",
  has_scalp_issue: true,
  scalp_condition: "trockene_schuppen",
  concerns: ["dry_lengths", "tangling"],
  goals: ["moisture", "shape_definition"],
  treatment: ["natur", "gefaerbt"],
}

test("selectDiagnosticsSource prefers the attached artifact over lead and columns and carries the quiz context with it", () => {
  const selected = selectDiagnosticsSource({
    artifact: { id: "artifact-1", leadId: "lead-1", quizAnswers: V3_ENVELOPE },
    legacyLead: { id: "lead-legacy", quizAnswers: LEGACY_QUIZ_ANSWERS },
    columns: FULL_DIAGNOSTIC_COLUMNS,
  })

  assert.equal(selected.sourceKind, "artifact")
  assert.equal(selected.sourceId, "artifact-1")
  assert.equal(selected.diagnostics.source.kind, "personal_plan_v3")
  assert.equal(selected.diagnostics.texture, "wavy")
  assert.deepEqual(selected.quizContext, {
    routineClarity: "clear",
    resultReliability: "mostly",
    adaptationConfidence: "yes",
    previousAttempts: "some_steps_helped",
    blockers: ["consistency"],
    routineStyle: "simple_reliable",
    meaningfulMoment: "everyday",
  })
  assert.equal(selected.conflict, undefined)
  assert.deepEqual(selected.unusableSources, [])
})

test("selectDiagnosticsSource falls back to the legacy lead, then to the legacy columns", () => {
  const fromLead = selectDiagnosticsSource({
    artifact: null,
    legacyLead: { id: "lead-legacy", quizAnswers: LEGACY_QUIZ_ANSWERS },
    columns: FULL_DIAGNOSTIC_COLUMNS,
  })
  assert.equal(fromLead.sourceKind, "lead")
  assert.equal(fromLead.sourceId, "lead-legacy")
  assert.equal(fromLead.diagnostics.source.kind, "legacy_quiz")
  assert.equal(fromLead.diagnostics.texture, "curly")
  assert.equal(fromLead.quizContext, undefined)

  const fromColumns = selectDiagnosticsSource({
    artifact: null,
    legacyLead: null,
    columns: FULL_DIAGNOSTIC_COLUMNS,
  })
  assert.equal(fromColumns.sourceKind, "columns")
  assert.equal(fromColumns.sourceId, undefined)
  assert.equal(fromColumns.diagnostics.source.kind, "legacy_columns")
  assert.equal(fromColumns.conflict, undefined)
})

test("selectDiagnosticsSource records the P4 conflict when the winning source disagrees with a non-null legacy column", () => {
  const selected = selectDiagnosticsSource({
    artifact: { id: "artifact-1", leadId: "lead-1", quizAnswers: V3_ENVELOPE },
    legacyLead: null,
    columns: {
      ...FULL_DIAGNOSTIC_COLUMNS,
      hair_texture: "curly",
      scalp_condition: "irritated",
      density: null,
      desired_volume: "more",
    },
  })

  assert.equal(selected.sourceKind, "artifact")
  assert.deepEqual(selected.conflict, {
    fields: [
      { field: "hair_texture", column: "curly", derived: "wavy" },
      { field: "scalp_condition", column: "irritated", derived: "dandruff" },
    ],
    erasures: [{ field: "desired_volume", column: "more" }],
  })
})

test("selectDiagnosticsSource lists every diagnostics-owned column a partial winner would blank out", () => {
  const selected = selectDiagnosticsSource({
    artifact: null,
    // An incomplete legacy lead is a legitimate winner (task 5a ruling) but projects PARTIAL
    // diagnostics, and `user_facts_save_v1` rewrites every diagnostics-owned column from the
    // merged document — so these columns would be nulled without anyone seeing it.
    legacyLead: {
      id: "lead-partial",
      quizAnswers: {
        structure: "curly",
        thickness: "coarse",
        density: "high",
        hair_length: "medium",
        fingertest: "rau",
        pulltest: "snaps",
        concerns: ["dry_lengths"],
      },
    },
    columns: { ...FULL_DIAGNOSTIC_COLUMNS, desired_volume: "more" },
  })

  assert.equal(selected.sourceKind, "lead")
  assert.deepEqual(selected.conflict?.erasures, [
    { field: "scalp_type", column: "oily" },
    { field: "scalp_condition", column: "dandruff" },
    { field: "chemical_treatment", column: "bleached,colored" },
    { field: "goals", column: "moisture,less_frizz,volume" },
    { field: "desired_volume", column: "more" },
  ])
  // The value conflicts are reported independently of the erasures.
  assert.deepEqual(selected.conflict?.fields, [
    { field: "hair_texture", column: "wavy", derived: "curly" },
    { field: "thickness", column: "fine", derived: "coarse" },
    { field: "density", column: "medium", derived: "high" },
    { field: "hair_length", column: "long", derived: "medium" },
  ])
})

test("selectDiagnosticsSource steps past an unusable source instead of guessing, and reports it", () => {
  const selected = selectDiagnosticsSource({
    artifact: {
      id: "artifact-broken",
      leadId: "lead-1",
      quizAnswers: { kind: "personal_plan", version: 1 },
    },
    legacyLead: { id: "lead-legacy", quizAnswers: LEGACY_QUIZ_ANSWERS },
    columns: FULL_DIAGNOSTIC_COLUMNS,
  })

  assert.equal(selected.sourceKind, "lead")
  assert.equal(selected.unusableSources.length, 1)
  assert.equal(selected.unusableSources[0]?.kind, "artifact")
  assert.equal(selected.unusableSources[0]?.id, "artifact-broken")
  assert.match(selected.unusableSources[0]?.reason ?? "", /Unsupported personal plan quiz envelope/)
})

test("selectDiagnosticsSource keeps the legacy lead id on a columns import when a lead exists but cannot project", () => {
  const selected = selectDiagnosticsSource({
    artifact: null,
    legacyLead: { id: "lead-broken", quizAnswers: null },
    columns: FULL_DIAGNOSTIC_COLUMNS,
  })

  assert.equal(selected.sourceKind, "columns")
  assert.equal(selected.diagnostics.source.kind, "legacy_columns")
  assert.equal(
    selected.diagnostics.source.kind === "legacy_columns"
      ? selected.diagnostics.source.leadId
      : null,
    "lead-broken",
  )
  assert.equal(selected.unusableSources[0]?.kind, "lead")
  assert.match(selected.unusableSources[0]?.reason ?? "", /Unable to project legacy lead/)
})

test("selectDiagnosticsSource refuses to let a signal-free projection overwrite real legacy columns", () => {
  const selected = selectDiagnosticsSource({
    artifact: null,
    // An empty lead projects into a diagnostics document carrying nothing but empty arrays;
    // letting it win would erase the row's concerns/goals/chemical_treatment columns.
    legacyLead: { id: "lead-empty", quizAnswers: {} },
    columns: FULL_DIAGNOSTIC_COLUMNS,
  })

  assert.equal(selected.sourceKind, "columns")
  assert.deepEqual(selected.unusableSources, [
    { kind: "lead", id: "lead-empty", reason: "no_diagnostic_signal" },
  ])
})

// ---------------------------------------------------------------------------
// planUserFactsBackfill
// ---------------------------------------------------------------------------

const NOW = "2026-09-16T08:00:00.000Z"

const EMPTY_COLUMNS: LegacyProfileColumns = {
  hair_texture: null,
  thickness: null,
  density: null,
  hair_length: null,
  cuticle_condition: null,
  protein_moisture_balance: null,
  scalp_type: null,
  scalp_condition: null,
  chemical_treatment: null,
  concerns: null,
  goals: null,
  desired_volume: null,
  towel_material: null,
  towel_technique: null,
  drying_method: null,
  styling_tools: null,
  heat_styling: null,
  uses_heat_protection: null,
  night_protection: null,
  brush_type: null,
}

function userRow(overrides: Partial<LoadedUserRow> = {}): LoadedUserRow {
  return {
    userId: "user-1",
    factsRevision: 0,
    factsProvenance: {},
    columns: EMPTY_COLUMNS,
    storedDomains: { diagnostics: false, care_habits: false, quiz_context: false },
    storedDiagnostics: null,
    storedCareHabits: null,
    artifact: null,
    legacyLead: null,
    plan: null,
    needVersions: [],
    drafts: [],
    ...overrides,
  }
}

function writeFor<Domain extends PlannedFactsWrite["domain"]>(
  plan: UserFactsBackfillPlan,
  domain: Domain,
): Extract<PlannedFactsWrite, { domain: Domain }> {
  const write = plan.writes.find((entry) => entry.domain === domain)
  assert.ok(write, `expected a ${domain} write`)
  return write as Extract<PlannedFactsWrite, { domain: Domain }>
}

test("planUserFactsBackfill writes diagnostics, quiz_context and the immutable Stage-2 head's habits, with the brush lifted from the legacy column", () => {
  const plan = planUserFactsBackfill(
    userRow({
      columns: { ...EMPTY_COLUMNS, brush_type: ["paddle", "fingers"] },
      artifact: { id: "artifact-1", leadId: "lead-1", quizAnswers: V3_ENVELOPE },
      plan: { id: "plan-1", current_refined_need_version_id: "version-stage2" },
      needVersions: [stage2Version()],
      drafts: [completedDraft()],
    }),
    { now: NOW, catchUp: false },
  )

  assert.deepEqual(
    plan.writes.map((write) => write.domain),
    ["diagnostics", "quiz_context", "care_habits"],
  )

  const diagnostics = writeFor(plan, "diagnostics")
  assert.deepEqual(diagnostics.provenance, {
    source: { kind: "personal_plan_artifact", id: "artifact-1" },
    schemaVersion: 1,
    at: NOW,
  })
  assert.equal(diagnostics.patch.source?.kind, "personal_plan_v3")

  const quizContext = writeFor(plan, "quiz_context")
  assert.deepEqual(quizContext.provenance.source, {
    kind: "personal_plan_artifact",
    id: "artifact-1",
  })

  const careHabits = writeFor(plan, "care_habits")
  assert.deepEqual(careHabits.provenance, {
    source: { kind: "refined_version", id: "version-stage2" },
    schemaVersion: 1,
    at: NOW,
    fields: {
      currentProductCategories: "user",
      wetWashFrequency: "user",
      towel: "user",
      dryingRoutes: "user",
      additionalHeatTools: "user",
      heatEvents: "user",
      nightProtection: "assumed",
      brushesCombs: "unknown_historical",
    },
  })
  assert.deepEqual(careHabits.patch, {
    currentProductCategories: ["shampoo", "conditioner"],
    wetWashFrequency: "weekly_3_4x",
    towel: { material: "mikrofaser", technique: "gentle_press" },
    dryingRoutes: ["ordinary_blow_dry"],
    additionalHeatTools: [],
    heatEvents: { "heat:ordinary_blow_dry": { frequency: "weekly_2x" } },
    nightProtection: ["silk_satin_pillow"],
    brushesCombs: ["paddle", "fingers"],
  })
  assert.deepEqual(plan.skips, [])
  assert.deepEqual(plan.unresolvable, [])
})

test("planUserFactsBackfill marks every habit field unknown_historical when a direct-accept draft assumed them all", () => {
  const plan = planUserFactsBackfill(
    userRow({
      plan: { id: "plan-1", current_refined_need_version_id: "version-stage2" },
      needVersions: [stage2Version()],
      drafts: [
        completedDraft({
          answer_provenance: Object.fromEntries(
            HEAD_COMPLETED_IDS.map((id) => [id, "assumed" as const]),
          ),
        }),
      ],
    }),
    { now: NOW, catchUp: false },
  )

  assert.deepEqual(writeFor(plan, "care_habits").provenance.fields, {
    currentProductCategories: "assumed",
    wetWashFrequency: "assumed",
    towel: "assumed",
    dryingRoutes: "assumed",
    additionalHeatTools: "assumed",
    heatEvents: "assumed",
    nightProtection: "assumed",
  })
})

test("planUserFactsBackfill falls back to the legacy care columns only when the user has no refined version", () => {
  const plan = planUserFactsBackfill(
    userRow({
      legacyLead: { id: "lead-legacy", quizAnswers: LEGACY_QUIZ_ANSWERS },
      columns: {
        ...EMPTY_COLUMNS,
        towel_material: "no_towel",
        towel_technique: "rubbeln",
        drying_method: "blow_dry_diffuser",
        styling_tools: ["curling_iron"],
        heat_styling: "daily",
        uses_heat_protection: false,
        brush_type: ["wide_tooth_comb"],
      },
    }),
    { now: NOW, catchUp: false },
  )

  assert.deepEqual(writeFor(plan, "diagnostics").provenance.source, {
    kind: "legacy_lead",
    id: "lead-legacy",
  })

  const careHabits = writeFor(plan, "care_habits")
  assert.deepEqual(careHabits.provenance.source, { kind: "legacy_columns" })
  assert.deepEqual(careHabits.patch, {
    towel: { material: "no_towel" },
    dryingRoutes: ["diffuser_or_airflow_shaping"],
    additionalHeatTools: ["curling_or_wave_iron"],
    heatEvents: {
      "heat:diffuser_airflow_shaping": { frequency: "daily_1x", protectionConsistency: "no" },
      "heat:curling_or_wave_iron": { frequency: "daily_1x", protectionConsistency: "no" },
    },
    brushesCombs: ["wide_tooth_comb"],
  })
  assert.deepEqual(careHabits.provenance.fields, {
    towel: "unknown_historical",
    dryingRoutes: "unknown_historical",
    additionalHeatTools: "unknown_historical",
    heatEvents: "unknown_historical",
    brushesCombs: "unknown_historical",
  })
  assert.equal(
    plan.writes.some((write) => write.domain === "quiz_context"),
    false,
  )
})

test("planUserFactsBackfill imports an incomplete column-only row without inventing values, and can write the brush alone", () => {
  const plan = planUserFactsBackfill(
    userRow({
      columns: {
        ...EMPTY_COLUMNS,
        hair_texture: "coily",
        thickness: "coarse",
        brush_type: ["fingers"],
      },
    }),
    { now: NOW, catchUp: false },
  )

  const diagnostics = writeFor(plan, "diagnostics")
  assert.deepEqual(diagnostics.provenance.source, { kind: "legacy_columns" })
  assert.deepEqual(diagnostics.patch, {
    texture: "coily",
    thickness: "coarse",
    source: {
      kind: "legacy_columns",
      version: 1,
      raw: {
        ...EMPTY_COLUMNS,
        hair_texture: "coily",
        thickness: "coarse",
        brush_type: ["fingers"],
      },
    },
  })

  assert.deepEqual(writeFor(plan, "care_habits").patch, { brushesCombs: ["fingers"] })
})

test("planUserFactsBackfill plans nothing at all for a row with no artifact, no lead and no legacy answers", () => {
  const plan = planUserFactsBackfill(userRow(), { now: NOW, catchUp: false })

  assert.deepEqual(plan.writes, [])
  assert.deepEqual(plan.skips, [])
  assert.deepEqual(plan.unresolvable, [])
})

test("planUserFactsBackfill surfaces the v2 artifact source and the P4 column conflict on the same row", () => {
  const v2Envelope = {
    kind: "personal_plan",
    version: 2,
    answers: {
      ...V3_ENVELOPE.answers,
      currentConcerns: ["dry_dull_lengths", "scalp_imbalance"],
    },
  }

  const plan = planUserFactsBackfill(
    userRow({
      artifact: { id: "artifact-v2", leadId: "lead-2", quizAnswers: v2Envelope },
      columns: { ...EMPTY_COLUMNS, hair_texture: "coily", thickness: "fine" },
    }),
    { now: NOW, catchUp: false },
  )

  assert.equal(writeFor(plan, "diagnostics").patch.source?.kind, "personal_plan_v2")
  assert.deepEqual(writeFor(plan, "diagnostics").patch.currentConcerns, ["dry_lengths"])
  assert.deepEqual(plan.conflict, {
    sourceKind: "artifact",
    sourceId: "artifact-v2",
    fields: [{ field: "hair_texture", column: "coily", derived: "wavy" }],
    erasures: [],
  })
})

test("planUserFactsBackfill attributes a Stage-3-revised head to the Stage-2 version it revises, via a still-current module receipt", () => {
  const projectedDraft = completedDraft({
    result_refined_need_version_id: null,
    revision: 4,
    module_projections: {
      products: { needVersionId: "version-stage2", projectedAtRevision: 4, stage3Handoff: true },
    },
  })

  const plan = planUserFactsBackfill(
    userRow({
      plan: { id: "plan-1", current_refined_need_version_id: "version-stage3" },
      needVersions: [stage3Version(), stage2Version()],
      drafts: [projectedDraft],
    }),
    { now: NOW, catchUp: false },
  )

  const careHabits = writeFor(plan, "care_habits")
  assert.deepEqual(careHabits.provenance.source, {
    kind: "refined_version",
    id: "version-stage2",
  })
  assert.equal(careHabits.detail, "provenance receipt_at_current_revision")
  assert.equal(careHabits.provenance.fields?.nightProtection, "assumed")
  assert.deepEqual(plan.unresolvable, [])
})

test("planUserFactsBackfill imports a products-first receipt's resolver-filled habits as assumed, not user", () => {
  const plan = planUserFactsBackfill(
    userRow({
      columns: { ...EMPTY_COLUMNS, brush_type: ["paddle"] },
      plan: { id: "plan-1", current_refined_need_version_id: "version-stage2" },
      needVersions: [stage2Version()],
      drafts: [productsFirstReceiptDraft()],
    }),
    { now: NOW, catchUp: false },
  )

  const careHabits = writeFor(plan, "care_habits")
  assert.equal(careHabits.detail, "provenance receipt_at_current_revision")
  assert.deepEqual(careHabits.provenance.fields, {
    currentProductCategories: "user",
    wetWashFrequency: "user",
    towel: "assumed",
    dryingRoutes: "assumed",
    additionalHeatTools: "assumed",
    // The `heat:*` aggregate rule from `toFieldProvenance` still applies: the one completed
    // heat event is assumed, so the aggregate is assumed.
    heatEvents: "assumed",
    nightProtection: "assumed",
    brushesCombs: "unknown_historical",
  })
})

test("planUserFactsBackfill downgrades every habit field to unknown_historical after an unprojected draft edit", () => {
  const plan = planUserFactsBackfill(
    userRow({
      columns: { ...EMPTY_COLUMNS, brush_type: ["round"] },
      plan: { id: "plan-1", current_refined_need_version_id: "version-stage2" },
      needVersions: [stage2Version()],
      drafts: [
        completedDraft({
          result_refined_need_version_id: null,
          revision: 6,
          module_projections: {
            habits: {
              needVersionId: "version-stage2",
              projectedAtRevision: 5,
              stage3Handoff: false,
            },
          },
        }),
      ],
    }),
    { now: NOW, catchUp: false },
  )

  const careHabits = writeFor(plan, "care_habits")
  assert.equal(careHabits.detail, "provenance unknown_historical")
  assert.deepEqual(careHabits.provenance.fields, {
    currentProductCategories: "unknown_historical",
    wetWashFrequency: "unknown_historical",
    towel: "unknown_historical",
    dryingRoutes: "unknown_historical",
    additionalHeatTools: "unknown_historical",
    heatEvents: "unknown_historical",
    nightProtection: "unknown_historical",
    brushesCombs: "unknown_historical",
  })
  // R1: the version's answers win; the unprojected edit stays in the draft.
  assert.deepEqual(careHabits.patch.nightProtection, ["silk_satin_pillow"])
})

test("planUserFactsBackfill reports an unresolvable Stage-2 head and writes no care_habits for that row", () => {
  const plan = planUserFactsBackfill(
    userRow({
      columns: { ...EMPTY_COLUMNS, brush_type: ["paddle"], hair_texture: "wavy" },
      plan: { id: "plan-1", current_refined_need_version_id: "version-stage3" },
      needVersions: [stage3Version()],
    }),
    { now: NOW, catchUp: false },
  )

  assert.deepEqual(
    plan.writes.map((write) => write.domain),
    ["diagnostics"],
  )
  assert.deepEqual(plan.unresolvable, [
    `care_habits: stage2_sibling_not_found (stage3 version-stage3, refinedInputHash ${"a".repeat(64)})`,
  ])
})

test("planUserFactsBackfill is idempotent: a fully written row is skipped domain by domain without --catch-up", () => {
  const plan = planUserFactsBackfill(
    userRow({
      factsRevision: 1,
      columns: { ...EMPTY_COLUMNS, hair_texture: "wavy" },
      storedDomains: { diagnostics: true, care_habits: true, quiz_context: false },
      factsProvenance: {
        diagnostics: {
          source: { kind: "legacy_columns" },
          schemaVersion: 1,
          at: "2026-09-15T00:00:00.000Z",
        },
      },
    }),
    { now: NOW, catchUp: false },
  )

  assert.deepEqual(plan.writes, [])
  assert.deepEqual(plan.skips, [
    "diagnostics: already written (re-run with --catch-up to re-check changed legacy columns)",
    "care_habits: already written (re-run with --catch-up to re-check changed legacy columns)",
  ])
})

/**
 * Fix round 2, P2: the guard is PER DOMAIN, not per row. A run that died between two domain
 * writes used to leave the row unrepairable: every rerun skipped it on `facts_revision > 0`,
 * and `--catch-up` refused the still-missing domain for having no provenance.
 */
test("planUserFactsBackfill repairs the NULL domains of a partly written row without --catch-up", () => {
  const plan = planUserFactsBackfill(
    userRow({
      factsRevision: 1,
      columns: { ...EMPTY_COLUMNS, towel_material: "frottee", brush_type: ["paddle"] },
      storedDomains: { diagnostics: true, care_habits: false, quiz_context: false },
      storedDiagnostics: null,
      artifact: { id: "artifact-1", leadId: "lead-1", quizAnswers: V3_ENVELOPE },
      factsProvenance: {
        diagnostics: {
          source: { kind: "personal_plan_artifact", id: "artifact-1" },
          schemaVersion: 1,
          at: "2026-09-15T00:00:00.000Z",
        },
      },
    }),
    { now: NOW, catchUp: false },
  )

  assert.deepEqual(
    plan.writes.map((write) => write.domain),
    ["quiz_context", "care_habits"],
  )
  assert.deepEqual(plan.skips, [
    "diagnostics: already written (re-run with --catch-up to re-check changed legacy columns)",
  ])
})

test("planUserFactsBackfill closes the authority gap for a row a live writer touched in another domain", () => {
  const plan = planUserFactsBackfill(
    userRow({
      factsRevision: 4,
      columns: { ...EMPTY_COLUMNS, towel_material: "frottee" },
      storedDomains: { diagnostics: false, care_habits: true, quiz_context: false },
      storedCareHabits: { towel: { material: "frottee" } },
      legacyLead: { id: "lead-1", quizAnswers: LEGACY_QUIZ_ANSWERS },
      factsProvenance: {
        care_habits: {
          source: { kind: "feinschliff_draft", id: "draft-9" },
          schemaVersion: 1,
          at: "2026-09-15T00:00:00.000Z",
        },
      },
    }),
    { now: NOW, catchUp: false },
  )

  assert.deepEqual(
    plan.writes.map((write) => write.domain),
    ["diagnostics"],
  )
  assert.deepEqual(plan.skips, [
    "care_habits: already written (re-run with --catch-up to re-check changed legacy columns)",
  ])
})

test("planUserFactsBackfill never fills an empty domain a live writer owns", () => {
  const plan = planUserFactsBackfill(
    userRow({
      factsRevision: 4,
      columns: { ...EMPTY_COLUMNS, towel_material: "frottee" },
      storedDomains: { diagnostics: false, care_habits: false, quiz_context: false },
      legacyLead: { id: "lead-1", quizAnswers: LEGACY_QUIZ_ANSWERS },
      factsProvenance: {
        care_habits: {
          source: { kind: "feinschliff_draft", id: "draft-9" },
          schemaVersion: 1,
          at: "2026-09-15T00:00:00.000Z",
        },
      },
    }),
    { now: NOW, catchUp: false },
  )

  assert.deepEqual(
    plan.writes.map((write) => write.domain),
    ["diagnostics"],
  )
  assert.deepEqual(plan.skips, [
    "care_habits: empty but last written by feinschliff_draft (a live writer; never filled in by the backfill)",
  ])
})

// The catch-up signal is CONTENT-based (I1): `user_facts_save_v1` stamps
// `hair_profiles.updated_at` itself, so a timestamp could never distinguish "the backfill
// wrote this" from "a legacy writer changed this". The stored document is re-derived into
// legacy columns and compared with the columns as they stand.

const BACKFILLED_COLUMNS: LegacyProfileColumns = {
  ...EMPTY_COLUMNS,
  hair_texture: "wavy",
  thickness: "fine",
  scalp_type: "oily",
  scalp_condition: "dandruff",
  chemical_treatment: [],
  concerns: [],
  goals: [],
  towel_material: "frottee",
  towel_technique: "gentle_press",
  uses_heat_protection: false,
  brush_type: ["paddle"],
}

function backfilledRow(overrides: Partial<LoadedUserRow> = {}): LoadedUserRow {
  return userRow({
    factsRevision: 1,
    columns: BACKFILLED_COLUMNS,
    storedDomains: { diagnostics: true, care_habits: true, quiz_context: false },
    // Exactly what the backfill would have written, so the derived columns round-trip.
    storedDiagnostics: legacyColumnsToDiagnostics(BACKFILLED_COLUMNS, {}),
    storedCareHabits: {
      ...legacyColumnsToCareHabits(BACKFILLED_COLUMNS),
      brushesCombs: ["paddle"],
    },
    factsProvenance: {
      diagnostics: {
        source: { kind: "legacy_columns" },
        schemaVersion: 1,
        at: "2026-09-15T00:00:00.000Z",
      },
      care_habits: {
        source: { kind: "legacy_columns" },
        schemaVersion: 1,
        at: "2026-09-15T00:00:00.000Z",
      },
    },
    ...overrides,
  })
}

test("catch-up leaves a backfilled row alone while its legacy columns still match the stored facts", () => {
  const plan = planUserFactsBackfill(backfilledRow(), { now: NOW, catchUp: true })

  assert.deepEqual(plan.writes, [])
  assert.deepEqual(plan.skips, [
    "diagnostics: legacy columns still match the stored facts (nothing changed since the backfill)",
    "care_habits: legacy columns still match the stored facts (nothing changed since the backfill)",
  ])
})

test("catch-up re-plans only the domain whose columns a legacy writer changed", () => {
  const towelChanged = planUserFactsBackfill(
    backfilledRow({ columns: { ...BACKFILLED_COLUMNS, towel_material: "mikrofaser" } }),
    { now: NOW, catchUp: true },
  )
  assert.deepEqual(
    towelChanged.writes.map((write) => write.domain),
    ["care_habits"],
  )
  assert.deepEqual(writeFor(towelChanged, "care_habits").patch, {
    towel: { material: "mikrofaser", technique: "gentle_press" },
    brushesCombs: ["paddle"],
  })
  assert.deepEqual(towelChanged.skips, [
    "diagnostics: legacy columns still match the stored facts (nothing changed since the backfill)",
  ])

  const textureChanged = planUserFactsBackfill(
    backfilledRow({ columns: { ...BACKFILLED_COLUMNS, hair_texture: "curly" } }),
    { now: NOW, catchUp: true },
  )
  assert.deepEqual(
    textureChanged.writes.map((write) => write.domain),
    ["diagnostics"],
  )
  assert.equal(writeFor(textureChanged, "diagnostics").patch.texture, "curly")
  assert.deepEqual(textureChanged.skips, [
    "care_habits: legacy columns still match the stored facts (nothing changed since the backfill)",
  ])
})

test("catch-up never re-plans a domain a live writer owns, however far its columns have drifted", () => {
  const plan = planUserFactsBackfill(
    backfilledRow({
      columns: { ...BACKFILLED_COLUMNS, towel_material: "mikrofaser", hair_texture: "curly" },
      factsProvenance: {
        diagnostics: {
          source: { kind: "legacy_columns" },
          schemaVersion: 1,
          at: "2026-09-15T00:00:00.000Z",
        },
        care_habits: {
          source: { kind: "feinschliff_draft", id: "draft-9" },
          schemaVersion: 1,
          at: "2026-09-15T00:00:00.000Z",
        },
      },
    }),
    { now: NOW, catchUp: true },
  )

  assert.deepEqual(
    plan.writes.map((write) => write.domain),
    ["diagnostics"],
  )
  assert.deepEqual(plan.skips, [
    "care_habits: last written by feinschliff_draft (a live writer; never overwritten by the backfill)",
  ])
})

test("catch-up leaves a row whose stored document is missing or unreadable for review", () => {
  const plan = planUserFactsBackfill(
    backfilledRow({
      columns: { ...BACKFILLED_COLUMNS, hair_texture: "curly" },
      storedDiagnostics: null,
    }),
    { now: NOW, catchUp: true },
  )

  assert.deepEqual(plan.writes, [])
  assert.deepEqual(plan.skips, [
    "diagnostics: provenance says the backfill wrote it, but the stored document is missing or unreadable; left for review",
    "care_habits: legacy columns still match the stored facts (nothing changed since the backfill)",
  ])
})

test("catch-up leaves an already-written row with no provenance for that domain for review", () => {
  const plan = planUserFactsBackfill(backfilledRow({ factsProvenance: {} }), {
    now: NOW,
    catchUp: true,
  })

  assert.deepEqual(plan.writes, [])
  assert.deepEqual(plan.skips, [
    "diagnostics: facts_revision=1 but no diagnostics provenance (not a backfill row; left for review)",
    "care_habits: facts_revision=1 but no care_habits provenance (not a backfill row; left for review)",
  ])
})

// ---------------------------------------------------------------------------
// scripts/user-facts/backfill.ts
// ---------------------------------------------------------------------------

test("parseBackfillArguments defaults to a bounded dry run and names every flag it rejects", () => {
  assert.deepEqual(parseBackfillArguments([]), {
    apply: false,
    catchUp: false,
    limit: 500,
    userId: undefined,
  })
  assert.deepEqual(parseBackfillArguments(["--dry-run", "--limit=3"]), {
    apply: false,
    catchUp: false,
    limit: 3,
    userId: undefined,
  })
  assert.deepEqual(
    parseBackfillArguments([
      "--apply",
      "--catch-up",
      "--user=11111111-1111-4111-8111-111111111111",
    ]),
    {
      apply: true,
      catchUp: true,
      limit: 500,
      userId: "11111111-1111-4111-8111-111111111111",
    },
  )

  assert.throws(() => parseBackfillArguments(["--force"]), /--force/)
  assert.throws(() => parseBackfillArguments(["--apply", "--dry-run"]), /--apply/)
  assert.throws(() => parseBackfillArguments(["--limit=0"]), /--limit/)
  assert.throws(() => parseBackfillArguments(["--user=nicht-eine-uuid"]), /--user/)
})

type FakeRow = Record<string, unknown>

function fakeSupabase(
  tables: Record<string, FakeRow[]>,
  rpcResult?:
    | Record<string, unknown>
    | ((call: { params: Record<string, unknown>; index: number }) => Record<string, unknown>),
) {
  const selects: { table: string; columns: string; filters: unknown[] }[] = []
  const rpcs: { name: string; params: Record<string, unknown> }[] = []

  const client = {
    from(table: string) {
      const record = { table, columns: "", filters: [] as unknown[] }
      selects.push(record)
      const builder = {
        select(columns: string) {
          record.columns = columns
          return builder
        },
        eq(column: string, value: unknown) {
          record.filters.push(["eq", column, value])
          return builder
        },
        in(column: string, values: unknown[]) {
          record.filters.push(["in", column, values])
          return builder
        },
        gt(column: string, value: unknown) {
          record.filters.push(["gt", column, value])
          return builder
        },
        order(column: string) {
          record.filters.push(["order", column])
          return builder
        },
        limit(count: number) {
          record.filters.push(["limit", count])
          return builder
        },
        then(resolve: (result: { data: FakeRow[]; error: null }) => unknown) {
          return resolve({ data: tables[table] ?? [], error: null })
        },
      }
      return builder
    },
    async rpc(name: string, params: Record<string, unknown>) {
      const index = rpcs.length
      rpcs.push({ name, params })
      const data =
        typeof rpcResult === "function"
          ? rpcResult({ params, index })
          : (rpcResult ?? { status: "ok", revision: 1, changed: true, diagnosticsHash: null })
      return { data, error: null }
    },
  }

  return { client, selects, rpcs }
}

const SCRIPT_USER = "22222222-2222-4222-8222-222222222222"

function scriptTables(): Record<string, FakeRow[]> {
  return {
    hair_profiles: [
      {
        user_id: SCRIPT_USER,
        facts_revision: 0,
        facts_provenance: {},
        ...EMPTY_COLUMNS,
        brush_type: ["paddle"],
      },
    ],
    personal_plan_prepared_artifacts: [
      {
        id: "artifact-1",
        lead_id: "lead-1",
        user_id: SCRIPT_USER,
        created_at: "2026-08-01T00:00:00.000Z",
        quiz_answers: V3_ENVELOPE,
      },
    ],
    leads: [],
    personal_plans: [
      { id: "plan-1", user_id: SCRIPT_USER, current_refined_need_version_id: "version-stage2" },
    ],
    personal_plan_need_versions: [
      { ...stage2Version(), user_id: SCRIPT_USER, personal_plan_id: "plan-1" },
    ],
    personal_plan_refinement_drafts: [
      { ...completedDraft(), user_id: SCRIPT_USER, personal_plan_id: "plan-1" },
    ],
  }
}

test("runUserFactsBackfill prints a per-domain diff and writes nothing in the default dry run", async () => {
  const fake = fakeSupabase(scriptTables())
  const lines: string[] = []

  const summary = await runUserFactsBackfill([], {
    supabase: fake.client as never,
    now: NOW,
    log: (line) => lines.push(line),
  })

  assert.deepEqual(fake.rpcs, [])
  assert.equal(summary.mode, "dry-run")
  assert.equal(summary.usersExamined, 1)
  assert.equal(summary.writesPlanned, 3)
  assert.deepEqual(summary.writesByDomain, { diagnostics: 1, care_habits: 1, quiz_context: 1 })
  assert.deepEqual(summary.writesBySource, { personal_plan_artifact: 2, refined_version: 1 })
  assert.equal(summary.applied, 0)
  assert.equal(summary.preserved, 0)
  assert.equal(summary.conflicts, 0)
  assert.equal(summary.erasures, 0)
  assert.equal(summary.pageComplete, true)

  assert.deepEqual(lines.slice(0, 3), [
    `[dry] ${SCRIPT_USER} diagnostics <- personal_plan_artifact artifact-1 (11 fields)`,
    `[dry] ${SCRIPT_USER} quiz_context <- personal_plan_artifact artifact-1 (7 fields)`,
    `[dry] ${SCRIPT_USER} care_habits <- refined_version version-stage2 (8 fields; provenance completed_draft)`,
  ])
  assert.equal(
    lines.some((line) => line.startsWith("P4 CONFLICTS")),
    true,
  )
  assert.equal(
    lines.some((line) => line.startsWith("UNRESOLVABLE")),
    true,
  )
  assert.equal(
    lines.some((line) => line.startsWith("SKIPPED")),
    true,
  )

  const profilePage = fake.selects.find((entry) => entry.table === "hair_profiles")
  assert.deepEqual(profilePage?.filters, [
    ["order", "user_id"],
    ["limit", 200],
  ])
  const artifactQuery = fake.selects.find(
    (entry) => entry.table === "personal_plan_prepared_artifacts",
  )
  assert.deepEqual(artifactQuery?.filters, [
    ["in", "user_id", [SCRIPT_USER]],
    ["eq", "status", "attached"],
  ])
  // F27 (fix round 2): the receipt-path provenance rule reads the DRAFT's own completed
  // list, so the loader has to select it.
  const draftQuery = fake.selects.find((entry) => entry.table === "personal_plan_refinement_drafts")
  assert.equal(draftQuery?.columns.includes("completed_question_ids"), true)
})

test("runUserFactsBackfill --apply hands every planned write to user_facts_save_v1 with upsert semantics", async () => {
  const fake = fakeSupabase(scriptTables())
  const lines: string[] = []

  const summary = await runUserFactsBackfill(["--apply"], {
    supabase: fake.client as never,
    now: NOW,
    log: (line) => lines.push(line),
  })

  assert.equal(summary.mode, "apply")
  assert.equal(summary.applied, 3)
  assert.deepEqual(summary.failures, [])
  assert.deepEqual(
    fake.rpcs.map((call) => [call.name, call.params.p_domain, call.params.p_mode]),
    [
      ["user_facts_save_v1", "diagnostics", "upsert"],
      ["user_facts_save_v1", "quiz_context", "upsert"],
      ["user_facts_save_v1", "care_habits", "upsert"],
    ],
  )

  const careHabits = fake.rpcs[2]!
  assert.equal(careHabits.params.p_user_id, SCRIPT_USER)
  assert.equal(careHabits.params.p_source_draft_id, null)
  assert.deepEqual(careHabits.params.p_provenance, {
    source: { kind: "refined_version", id: "version-stage2" },
    schemaVersion: 1,
    at: NOW,
    fields: {
      currentProductCategories: "user",
      wetWashFrequency: "user",
      towel: "user",
      dryingRoutes: "user",
      additionalHeatTools: "user",
      heatEvents: "user",
      nightProtection: "assumed",
      brushesCombs: "unknown_historical",
    },
  })
  assert.equal(
    lines[0],
    `[apply] ${SCRIPT_USER} diagnostics <- personal_plan_artifact artifact-1 (11 fields) -> ok rev 1`,
  )
})

/**
 * Fix round 2, P1: every backfill write is a compare-and-swap. Without
 * `p_expected_revision` the backfill silently overwrites a concurrent live writer and only
 * notices afterwards, from a revision that has already moved.
 */
test("runUserFactsBackfill pins every write to the revision it loaded for that row", async () => {
  const fake = fakeSupabase(scriptTables(), ({ index }) => ({
    status: "ok",
    revision: index + 1,
    changed: true,
    diagnosticsHash: null,
  }))

  await runUserFactsBackfill(["--apply"], {
    supabase: fake.client as never,
    now: NOW,
    log: () => {},
  })

  // The row loads at facts_revision 0; each successful write hands back the revision the
  // next write of the same row must be pinned to.
  assert.deepEqual(
    fake.rpcs.map((call) => call.params.p_expected_revision),
    [0, 1, 2],
  )
})

test("a revision_conflict stops that row for the whole run and is reported as a concurrent writer", async () => {
  const fake = fakeSupabase(scriptTables(), ({ index }) =>
    index === 1
      ? { status: "revision_conflict", revision: 7 }
      : { status: "ok", revision: index + 1, changed: true, diagnosticsHash: null },
  )
  const lines: string[] = []

  const summary = await runUserFactsBackfill(["--apply"], {
    supabase: fake.client as never,
    now: NOW,
    log: (line) => lines.push(line),
  })

  // diagnostics wrote, quiz_context conflicted, care_habits is never attempted: the loaded
  // snapshot (and every revision derived from it) is stale.
  assert.deepEqual(
    fake.rpcs.map((call) => call.params.p_domain),
    ["diagnostics", "quiz_context"],
  )
  assert.equal(summary.revisionConflicts, 1)
  assert.equal(summary.applied, 1)
  assert.deepEqual(summary.failures, [])
  const skippedIndex = lines.findIndex((line) => line.startsWith("SKIPPED ("))
  assert.ok(skippedIndex >= 0)
  const skippedBlock = lines.slice(skippedIndex)
  assert.equal(skippedBlock.includes("  CONFLICTS (concurrent writer) (1)"), true)
  assert.equal(
    skippedBlock.some(
      (line) =>
        line.includes(SCRIPT_USER) &&
        line.includes("quiz_context") &&
        line.includes("revision_conflict"),
    ),
    true,
  )
  assert.equal(
    skippedBlock.some(
      (line) =>
        line.includes(SCRIPT_USER) && line.includes("care_habits") && line.includes("stale"),
    ),
    true,
  )
})

test("runUserFactsBackfill prints conflicts and erasures on separate labelled lines and counts them apart", async () => {
  const fake = fakeSupabase({
    hair_profiles: [
      {
        user_id: SCRIPT_USER,
        facts_revision: 0,
        facts_provenance: {},
        ...FULL_DIAGNOSTIC_COLUMNS,
        desired_volume: "more",
        towel_material: null,
        towel_technique: null,
        drying_method: null,
        styling_tools: null,
        heat_styling: null,
        uses_heat_protection: null,
        night_protection: null,
        brush_type: null,
      },
    ],
    personal_plan_prepared_artifacts: [],
    leads: [
      {
        id: "lead-partial",
        user_id: SCRIPT_USER,
        created_at: "2026-07-01T00:00:00.000Z",
        quiz_answers: {
          structure: "curly",
          thickness: "coarse",
          density: "high",
          hair_length: "medium",
          fingertest: "rau",
          pulltest: "snaps",
          concerns: ["dry_lengths"],
        },
      },
    ],
    personal_plans: [],
  })
  const lines: string[] = []

  const summary = await runUserFactsBackfill([], {
    supabase: fake.client as never,
    now: NOW,
    log: (line) => lines.push(line),
  })

  assert.equal(summary.conflicts, 1)
  assert.equal(summary.erasures, 1)
  assert.equal(lines.includes("P4 CONFLICTS (1 conflicts, 1 erasures)"), true)
  assert.equal(
    lines.includes(
      `  ${SCRIPT_USER} diagnostics from lead lead-partial: hair_texture columns=wavy derived=curly; thickness columns=fine derived=coarse; density columns=medium derived=high; hair_length columns=long derived=medium`,
    ),
    true,
  )
  assert.equal(
    lines.includes(
      `  ${SCRIPT_USER} diagnostics from lead lead-partial: erasure scalp_type columns=oily derived=<none>; erasure scalp_condition columns=dandruff derived=<none>; erasure chemical_treatment columns=bleached,colored derived=<none>; erasure goals columns=moisture,less_frizz,volume derived=<none>; erasure desired_volume columns=more derived=<none>`,
    ),
    true,
  )
})

test("runUserFactsBackfill counts a preserved RPC result apart from an applied change", async () => {
  const fake = fakeSupabase(scriptTables(), {
    status: "preserved",
    revision: 4,
    changed: false,
    diagnosticsHash: null,
  })
  const lines: string[] = []

  const summary = await runUserFactsBackfill(["--apply"], {
    supabase: fake.client as never,
    now: NOW,
    log: (line) => lines.push(line),
  })

  assert.equal(summary.applied, 0)
  assert.equal(summary.preserved, 3)
  assert.deepEqual(summary.failures, [])
  assert.equal(lines[0]?.endsWith("-> preserved rev 4"), true)
})

test("runUserFactsBackfill honours --user and --limit and reports a resume cursor when a page fills up", async () => {
  const fake = fakeSupabase(scriptTables())

  const summary = await runUserFactsBackfill([`--user=${SCRIPT_USER}`, "--limit=1"], {
    supabase: fake.client as never,
    now: NOW,
    log: () => {},
  })

  assert.equal(summary.usersExamined, 1)
  assert.equal(summary.nextCursor, null)
  const profilePage = fake.selects.find((entry) => entry.table === "hair_profiles")
  assert.deepEqual(profilePage?.filters, [
    ["eq", "user_id", SCRIPT_USER],
    ["order", "user_id"],
    ["limit", 1],
  ])
})
