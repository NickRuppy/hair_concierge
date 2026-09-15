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

test("legacyColumnsToDiagnostics reads a null scalp_condition as no scalp concerns and a null array column as absent", () => {
  const diagnostics = legacyColumnsToDiagnostics(
    { ...FULL_DIAGNOSTIC_COLUMNS, scalp_condition: null, goals: null, concerns: null },
    {},
  )

  assert.deepEqual(diagnostics.scalpConcerns, [])
  assert.equal("goals" in diagnostics, false)
  assert.equal("currentConcerns" in diagnostics, false)
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
    module_projections: {},
    result_refined_need_version_id: "version-stage2",
    ...overrides,
  }
}

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
    },
  })

  assert.equal(selected.sourceKind, "artifact")
  assert.deepEqual(selected.conflict, {
    fields: [
      { field: "hair_texture", column: "curly", derived: "wavy" },
      { field: "scalp_condition", column: "irritated", derived: "dandruff" },
    ],
  })
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
    updatedAt: "2026-09-01T00:00:00.000Z",
    factsProvenance: {},
    columns: EMPTY_COLUMNS,
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
    scalpConcerns: [],
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

test("planUserFactsBackfill is idempotent: a row the backfill already wrote is skipped without --catch-up", () => {
  const plan = planUserFactsBackfill(
    userRow({
      factsRevision: 1,
      columns: { ...EMPTY_COLUMNS, hair_texture: "wavy" },
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
    "facts_revision=1 (already written; re-run with --catch-up to re-check changed legacy columns)",
  ])
})

test("planUserFactsBackfill re-plans a catch-up row a legacy writer changed, and never one a live writer owns", () => {
  const changedAfterBackfill = userRow({
    factsRevision: 1,
    updatedAt: "2026-09-15T12:00:00.000Z",
    columns: { ...EMPTY_COLUMNS, hair_texture: "wavy", brush_type: ["round"] },
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
  })

  const replanned = planUserFactsBackfill(changedAfterBackfill, { now: NOW, catchUp: true })
  assert.deepEqual(
    replanned.writes.map((write) => write.domain),
    ["diagnostics", "care_habits"],
  )

  const unchanged = planUserFactsBackfill(
    { ...changedAfterBackfill, updatedAt: "2026-09-15T00:00:00.000Z" },
    { now: NOW, catchUp: true },
  )
  assert.deepEqual(unchanged.writes, [])
  assert.deepEqual(unchanged.skips, [
    "diagnostics: legacy columns unchanged since the backfill wrote them (2026-09-15T00:00:00.000Z)",
    "care_habits: legacy columns unchanged since the backfill wrote them (2026-09-15T00:00:00.000Z)",
  ])

  const liveWriter = planUserFactsBackfill(
    {
      ...changedAfterBackfill,
      factsProvenance: {
        ...changedAfterBackfill.factsProvenance,
        care_habits: {
          source: { kind: "feinschliff_draft", id: "draft-9" },
          schemaVersion: 1,
          at: "2026-09-15T00:00:00.000Z",
        },
      },
    },
    { now: NOW, catchUp: true },
  )
  assert.deepEqual(
    liveWriter.writes.map((write) => write.domain),
    ["diagnostics"],
  )
  assert.deepEqual(liveWriter.skips, [
    "care_habits: last written by feinschliff_draft (a live writer; never overwritten by the backfill)",
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

function fakeSupabase(tables: Record<string, FakeRow[]>) {
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
      rpcs.push({ name, params })
      return {
        data: { status: "ok", revision: 1, changed: true, diagnosticsHash: null },
        error: null,
      }
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
        updated_at: "2026-09-01T00:00:00.000Z",
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
  assert.equal(careHabits.params.p_expected_revision, null)
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
