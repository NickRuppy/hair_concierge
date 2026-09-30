import assert from "node:assert/strict"
import test from "node:test"

import {
  COMPARED_COLUMNS,
  TOLERATED_DIFFERENCES,
  detectHandEdits,
  oldWriterColumnsForArtifact,
  oldWriterColumnsForLead,
  type OldWriterColumns,
} from "../src/lib/user-facts/backfill/detect-hand-edits"
import {
  planUserFactsBackfill,
  type LegacyProfileColumns,
  type LoadedUserRow,
  type PlannedFactsWrite,
  type UserFactsBackfillPlan,
} from "../src/lib/user-facts/backfill/plan-row"
import { quizSupersedesFacts } from "../src/lib/user-facts/account-link"
import { deriveDiagnosticsColumns } from "../src/lib/user-facts/derive-legacy-columns"
import { mergeDiagnosticsPatch } from "../src/lib/user-facts/hand-edit"
import { projectLegacyLeadToFacts } from "../src/lib/user-facts/project-legacy-lead"
import { saveUserFacts as saveUserFactsRpc } from "../src/lib/user-facts/save"
import type { DiagnosticsV1, DomainProvenance, QuizContextV1 } from "../src/lib/user-facts/schema"
import { toStage1Source } from "../src/lib/user-facts/stage1-source"
import { adaptPersonalPlanAnswersForOffer } from "../src/lib/personal-plan-quiz/offer-adapter"
import { runUserFactsBackfill } from "../scripts/user-facts/backfill"
import {
  mobileFactsDatabase,
  pgliteRpcClient,
  readRow,
} from "./mobile-profile-facts-pglite.fixtures"
import {
  applyUserFactsLock,
  id,
  insertProfile,
  migratedPersonalPlanDatabase,
  type PersonalPlanTestDb,
} from "./personal-plan-pglite-migration.fixtures"

/**
 * Clean-switch task 7, part A: the backfill never undoes a hand edit made after the quiz it
 * projects (plan 2026-09-30 §3 "a hand edit that is newer than a quiz is kept"). Each fixture is
 * a production shape: the columns main's old writer left for the source, then what a user or a
 * migration changed afterwards.
 */

const NOW = "2026-09-30T12:00:00.000Z"

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
    currentConcerns: ["dry_lengths", "low_shine", "tangling"],
    primaryConcern: "low_shine",
    concernRecurrence: { concernId: "dry_lengths", frequency: "often" },
    hairLength: "long",
    hairSurface: "slightly_uneven",
    elasticResponse: "stretches_stays",
    chemicalTreatments: ["colored"],
    scalpOiliness: "oily",
    scalpConcerns: ["oily_dandruff", "irritated"],
    previousAttempts: "some_steps_helped",
    blockers: ["consistency"],
    routineStyle: "simple_reliable",
    meaningfulMoment: "everyday",
  },
} as const

const LEAD_ANSWERS = {
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
  primary_concern: "tangling",
  goals: ["moisture", "shape_definition"],
  treatment: ["natur"],
}

const EMPTY: LegacyProfileColumns = {
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
  primary_concern: null,
  towel_material: null,
  towel_technique: null,
  drying_method: null,
  styling_tools: null,
  heat_styling: null,
  uses_heat_protection: null,
  night_protection: null,
  brush_type: null,
}

/** The row main's old writer left: every column it wrote, NULL for the rest. */
function linked(
  written: OldWriterColumns | null,
  overrides: Partial<LegacyProfileColumns> = {},
): LegacyProfileColumns {
  assert.ok(written, "the old writer's output must be recomputable for this fixture")
  return { ...EMPTY, ...(written as Partial<LegacyProfileColumns>), ...overrides }
}

const ARTIFACT = {
  id: "artifact-1",
  leadId: "lead-pp-1",
  quizAnswers: V3_ENVELOPE,
  createdAt: "2026-08-01T09:00:00.000Z",
}
const LEAD = { id: "lead-1", quizAnswers: LEAD_ANSWERS, createdAt: "2026-07-01T09:00:00.000Z" }
const PAID_COLUMNS = linked(oldWriterColumnsForArtifact(ARTIFACT))
const LEAD_COLUMNS = linked(oldWriterColumnsForLead(LEAD_ANSWERS))

function row(overrides: Partial<LoadedUserRow>): LoadedUserRow {
  return {
    userId: "user-1",
    factsRevision: 0,
    factsProvenance: {},
    columns: EMPTY,
    storedDomains: { diagnostics: false, care_habits: false, quiz_context: false },
    storedDiagnostics: null,
    storedCareHabits: null,
    artifact: null,
    legacyLead: null,
    plan: null,
    needVersions: [],
    drafts: [],
    updatedAt: "2026-09-10T10:00:00.000Z",
    ...overrides,
  }
}

function plan(overrides: Partial<LoadedUserRow>): UserFactsBackfillPlan {
  return planUserFactsBackfill(row(overrides), { now: NOW, catchUp: false })
}

function diagnosticsWrite(planned: UserFactsBackfillPlan) {
  const write = planned.writes.find((entry) => entry.domain === "diagnostics")
  assert.ok(write, "a diagnostics write is planned")
  return write as Extract<PlannedFactsWrite, { domain: "diagnostics" }>
}

function documentOf(planned: UserFactsBackfillPlan): DiagnosticsV1 {
  return mergeDiagnosticsPatch(null, diagnosticsWrite(planned).patch)
}

/** The 13 diagnostics columns, canonical (order-free, `[]` = NULL) for comparison. */
function canonical(columns: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const column of [...COMPARED_COLUMNS, "desired_volume"]) {
    const value = columns[column] ?? null
    out[column] = Array.isArray(value)
      ? value.length > 0
        ? [...value].sort()
        : null
      : value instanceof Date
        ? value.toISOString()
        : value
  }
  return out
}

// ---------------------------------------------------------------------------
// The old writers, recomputed
// ---------------------------------------------------------------------------

test("old writer (paid): main's link over the offer adapter — inferred goals, capped concerns, no legacy main problem", () => {
  assert.deepEqual(oldWriterColumnsForArtifact(ARTIFACT), {
    hair_texture: "wavy",
    thickness: "fine",
    density: "medium",
    hair_length: "long",
    cuticle_condition: "slightly_rough",
    protein_moisture_balance: "stretches_stays",
    chemical_treatment: ["colored"],
    scalp_type: "oily",
    scalp_condition: "irritated",
    // low_shine has no legacy concern; the adapter keeps the rest.
    concerns: ["dryness", "tangling"],
    primary_concern: null,
    // Picked: moisture, shine. Inferred by the adapter: less_frizz (tangling), healthy_scalp.
    goals: ["less_frizz", "moisture", "healthy_scalp", "shine"],
  })
})

test("old writer (paid): the artifact's STORED canonical_profile wins over recomputing it (the adapter changed over time)", () => {
  const stored = {
    modelVersion: "personal_plan_canonical_v1",
    structure: "wavy",
    thickness: "fine",
    density: "medium",
    hair_length: "long",
    fingertest: "leicht_uneben",
    pulltest: "stretches_stays",
    scalp_type: "fettig",
    has_scalp_issue: true,
    scalp_condition: "gereizt",
    concerns: ["dryness"],
    treatment: ["gefaerbt"],
    goals: ["moisture", "shine"],
  }
  const written = oldWriterColumnsForArtifact({ ...ARTIFACT, canonicalProfile: stored })
  assert.deepEqual(written?.goals, ["moisture", "shine"])
  assert.deepEqual(written?.concerns, ["dryness"])
})

test("old writer (lead): main's legacy link incl. the main problem and the projected goals", () => {
  assert.deepEqual(oldWriterColumnsForLead(LEAD_ANSWERS), {
    hair_texture: "curly",
    thickness: "coarse",
    density: "high",
    hair_length: "medium",
    cuticle_condition: "rough",
    protein_moisture_balance: "snaps",
    chemical_treatment: ["natural"],
    scalp_type: "dry",
    scalp_condition: "dry_flakes",
    concerns: ["dryness", "tangling"],
    primary_concern: "tangling",
    goals: ["moisture", "curl_definition"],
  })
  assert.equal(oldWriterColumnsForLead(null), null, "no record: main skipped the link")
})

// ---------------------------------------------------------------------------
// Fixtures of the brief
// ---------------------------------------------------------------------------

test("untouched paid row: the quiz's native values win; only the adapter-inferred goals disappear", () => {
  const planned = plan({ artifact: ARTIFACT, columns: PAID_COLUMNS })
  const write = diagnosticsWrite(planned)
  const document = documentOf(planned)

  assert.deepEqual(planned.report.editedGroups, [])
  assert.deepEqual(planned.report.ambiguousGroups, [])
  assert.deepEqual(planned.report.findings, [])
  assert.equal(write.provenance.editedAt, undefined)
  assert.equal(write.provenance.fields, undefined)
  // Quiz-only values survive: the picked goals only, low_shine, the main problem, recurrence,
  // both scalp concerns.
  assert.deepEqual(document.goals, ["moisture", "shine"])
  assert.deepEqual(document.currentConcerns, ["dry_lengths", "low_shine", "tangling"])
  assert.equal(document.primaryConcern, "low_shine")
  assert.deepEqual(document.concernRecurrence, { concernId: "dry_lengths", frequency: "often" })
  assert.deepEqual(document.scalpConcerns, ["oily_dandruff", "irritated"])
  assert.deepEqual(document.source.raw, V3_ENVELOPE, "source.raw stays the verbatim envelope")
  assert.deepEqual(planned.report.visibleChanges, [
    {
      domain: "diagnostics",
      column: "goals",
      before: "less_frizz,moisture,healthy_scalp,shine",
      after: "moisture,shine",
    },
  ])
})

test("paid row with edited goals: the edited goals win as user facts with editedAt; everything else is the quiz's", () => {
  const planned = plan({
    artifact: ARTIFACT,
    // The old Ziele editor wrote the goals and their derived volume direction.
    columns: { ...PAID_COLUMNS, goals: ["volume", "moisture"], desired_volume: "more" },
    updatedAt: "2026-09-10T10:00:00.000Z",
  })
  const write = diagnosticsWrite(planned)
  const document = documentOf(planned)

  assert.deepEqual(planned.report.editedGroups, ["goals"])
  assert.deepEqual(planned.report.findings, [
    {
      group: "goals",
      column: "goals",
      verdict: "edited",
      columnValue: "volume,moisture",
      oldWriterValue: "less_frizz,moisture,healthy_scalp,shine",
    },
  ])
  assert.deepEqual(document.goals, ["moisture", "volume_balance"])
  assert.equal(document.volumeDirection, "more")
  assert.deepEqual(write.provenance.fields, { goals: "user", volumeDirection: "user" })
  assert.equal(write.provenance.editedAt, "2026-09-10T10:00:00.000Z")
  assert.deepEqual(planned.report.editedAt, {
    at: "2026-09-10T10:00:00.000Z",
    basis: "profile_updated_at",
  })
  assert.deepEqual(document.currentConcerns, ["dry_lengths", "low_shine", "tangling"])
  assert.deepEqual(planned.report.visibleChanges, [], "the user sees exactly what she saw")
})

test("edited hair length only: that one field is the user's, every other field stays the lead's", () => {
  const planned = plan({ legacyLead: LEAD, columns: { ...LEAD_COLUMNS, hair_length: "long" } })
  const write = diagnosticsWrite(planned)
  const document = documentOf(planned)
  const lead = projectLegacyLeadToFacts({
    leadId: LEAD.id,
    quizAnswers: LEAD_ANSWERS as never,
    takenAt: LEAD.createdAt,
  }).diagnostics

  assert.deepEqual(planned.report.editedGroups, ["hair_length"])
  assert.deepEqual(write.provenance.fields, { hairLength: "user" })
  assert.deepEqual({ ...document, hairLength: lead.hairLength }, lead)
  assert.equal(document.hairLength, "long")
  assert.deepEqual(planned.report.visibleChanges, [])
})

test("edited concerns with a quiz-only concern in the source: the edit wins, low_shine (never shown by the old editor) stays, a stale recurrence goes", () => {
  const planned = plan({
    artifact: ARTIFACT,
    columns: { ...PAID_COLUMNS, concerns: ["frizz"] },
  })
  const write = diagnosticsWrite(planned)
  const document = documentOf(planned)

  assert.deepEqual(planned.report.editedGroups, ["concerns"])
  assert.deepEqual(document.currentConcerns, ["frizz_flyaways", "low_shine"])
  assert.equal(document.primaryConcern, "low_shine", "her pick is still one of her concerns")
  assert.equal(document.concernRecurrence, undefined, "dry_lengths is no longer selected")
  assert.deepEqual(planned.report.notes, ["kept quiz-only concerns beside the edit: low_shine"])
  assert.deepEqual(write.provenance.fields, { currentConcerns: "user" })
  assert.deepEqual(
    planned.report.visibleChanges.map((change) => change.column),
    ["goals"],
    "the concerns the user sees are unchanged; only the paid row's inferred goals go",
  )
})

test("iOS-edited row: editedAt is the iOS edit's publication time (scanner_profile_edits), not updated_at", () => {
  const planned = plan({
    legacyLead: LEAD,
    columns: { ...LEAD_COLUMNS, thickness: "fine" },
    lastProfileEditAt: "2026-09-20T08:00:00.000Z",
    updatedAt: "2026-09-25T08:00:00.000Z",
  })
  const write = diagnosticsWrite(planned)
  assert.deepEqual(planned.report.editedGroups, ["thickness"])
  assert.equal(write.provenance.editedAt, "2026-09-20T08:00:00.000Z")
  assert.deepEqual(planned.report.editedAt, {
    at: "2026-09-20T08:00:00.000Z",
    basis: "ios_profile_edit",
  })

  // Per the existing precedence rule: a quiz taken after the edit replaces it, an older one not.
  const facts = {
    diagnostics: documentOf(planned),
    provenance: { diagnostics: write.provenance as DomainProvenance },
  }
  assert.equal(quizSupersedesFacts(facts, "2026-09-21T00:00:00.000Z"), true)
  assert.equal(quizSupersedesFacts(facts, "2026-09-19T00:00:00.000Z"), false)
})

test("legacy-lead row edited in the Haar-Check editor (it saves every field at once): the changed columns win, the unchanged ones keep the lead's values", () => {
  const planned = plan({
    legacyLead: LEAD,
    columns: {
      ...LEAD_COLUMNS,
      hair_texture: "wavy",
      scalp_type: "oily",
      scalp_condition: null,
      chemical_treatment: ["colored"],
    },
  })
  const document = documentOf(planned)

  assert.deepEqual(planned.report.editedGroups, ["structure", "treatment", "scalp_type"])
  assert.equal(document.texture, "wavy")
  assert.deepEqual(document.chemicalTreatments, ["colored"])
  assert.equal(document.scalpOiliness, "oily")
  assert.deepEqual(document.scalpConcerns, [], "„no scalp issue“ is an answer")
  assert.equal(document.thickness, "coarse")
  assert.deepEqual(document.goals, ["moisture", "shape_definition"])
  assert.deepEqual(planned.report.visibleChanges, [])
})

test("row normalised by a column migration: density 'medium' set by 20260429120000 is no edit and is kept, not defaulted", () => {
  // An older, incomplete legacy lead (no density, no treatment answer): main's link wrote no
  // density, and 20260429120000 later set 'medium' on every profile without one.
  const answers: Record<string, unknown> = { ...LEAD_ANSWERS }
  delete answers.density
  delete answers.treatment
  const written = oldWriterColumnsForLead(answers)
  assert.equal(written && "density" in written, false, "main's link wrote no density")
  const planned = plan({
    legacyLead: { ...LEAD, quizAnswers: answers },
    columns: linked(written, { density: "medium" }),
  })
  const write = diagnosticsWrite(planned)

  assert.deepEqual(planned.report.editedGroups, [])
  assert.deepEqual(planned.report.ambiguousGroups, [])
  assert.deepEqual(planned.report.tolerated, [
    { column: "density", id: "density_default_migration" },
  ])
  assert.equal(write.patch.density, "medium")
  assert.deepEqual(write.provenance.fields, { density: "unknown_historical" })
  assert.equal(write.provenance.editedAt, undefined)
})

test("multi-lead user: the lead TAKEN last wins; an older one is only a fallback", () => {
  const older = {
    id: "lead-old",
    quizAnswers: { ...LEAD_ANSWERS, goals: ["moisture"] },
    createdAt: "2026-05-01T00:00:00.000Z",
  }
  const newest = { ...LEAD, id: "lead-new", createdAt: "2026-08-15T00:00:00.000Z" }

  const planned = plan({ legacyLead: newest, olderLegacyLeads: [older], columns: LEAD_COLUMNS })
  assert.equal(diagnosticsWrite(planned).provenance.source.id, "lead-new")
  assert.deepEqual(planned.report.editedGroups, [])

  // The newest quiz is unusable -> the next one by quiz time, never a guess.
  const fallback = plan({
    legacyLead: { ...newest, quizAnswers: {} },
    olderLegacyLeads: [older],
    columns: linked(oldWriterColumnsForLead(older.quizAnswers)),
  })
  assert.equal(diagnosticsWrite(fallback).provenance.source.id, "lead-old")
  assert.match(
    fallback.skips[0] ?? "",
    /lead lead-new could not be projected \(no_diagnostic_signal\)/,
  )
})

test("latest own quiz wins across kinds: a legacy lead taken after the attached artifact beats it, and the report says so", () => {
  const later = { ...LEAD, id: "lead-later", createdAt: "2026-09-01T00:00:00.000Z" }
  const planned = plan({ artifact: ARTIFACT, legacyLead: later, columns: LEAD_COLUMNS })
  const write = diagnosticsWrite(planned)
  assert.equal(write.provenance.source.kind, "legacy_lead")
  assert.equal(write.provenance.source.id, "lead-later")
  assert.equal(
    planned.report.sourceNote,
    "legacy lead lead-later (2026-09-01T00:00:00.000Z) was taken after artifact artifact-1 (2026-08-01T09:00:00.000Z): the lead wins",
  )
  assert.equal(
    planned.writes.some((entry) => entry.domain === "quiz_context"),
    false,
    "a legacy lead carries no quiz context",
  )

  // Without both quiz times the precedence stays artifact first.
  const unknownTime = plan({
    artifact: { ...ARTIFACT, createdAt: null },
    legacyLead: later,
    columns: PAID_COLUMNS,
  })
  assert.equal(diagnosticsWrite(unknownTime).provenance.source.kind, "personal_plan_artifact")
})

test("ambiguous: goals equal an OLDER own quiz's (main kept existing goals on relink) — the column wins and the row is listed", () => {
  const older = {
    id: "lead-old",
    quizAnswers: { ...LEAD_ANSWERS, goals: ["shine"] },
    createdAt: "2026-05-01T00:00:00.000Z",
  }
  const planned = plan({
    legacyLead: LEAD,
    olderLegacyLeads: [older],
    columns: { ...LEAD_COLUMNS, goals: ["shine"] },
  })
  assert.deepEqual(planned.report.editedGroups, [])
  assert.deepEqual(planned.report.ambiguousGroups, ["goals"])
  assert.match(planned.report.findings[0]?.reason ?? "", /OLDER own quiz/)
  assert.deepEqual(documentOf(planned).goals, ["shine"])
  assert.ok(diagnosticsWrite(planned).provenance.editedAt, "treated as a hand edit")
})

test("ambiguous: a main problem no editor wrote — the column wins", () => {
  const planned = plan({
    legacyLead: LEAD,
    columns: { ...LEAD_COLUMNS, primary_concern: "dryness" },
  })
  assert.deepEqual(planned.report.ambiguousGroups, ["concerns"])
  assert.equal(documentOf(planned).primaryConcern, "dry_lengths")
  assert.deepEqual(diagnosticsWrite(planned).provenance.fields, { primaryConcern: "user" })
})

test("a row with no source at all is imported from its columns, with nothing to detect", () => {
  const planned = plan({ columns: { ...EMPTY, hair_texture: "straight", goals: ["shine"] } })
  const write = diagnosticsWrite(planned)
  assert.equal(write.provenance.source.kind, "legacy_columns")
  assert.equal(write.provenance.editedAt, undefined)
  assert.deepEqual(planned.report.findings, [])
  assert.deepEqual(planned.report.editedGroups, [])
})

test("care habits follow the owner's decisions, and every column the write changes — erasures included — is listed", () => {
  // „Nie" next to a selected tool (decision 1, Nick 2026-09-30): she uses no heat tools — the
  // tool list goes, the level stays „Nie", and the report names the dropped tool and the rule.
  const planned = plan({
    legacyLead: LEAD,
    columns: {
      ...LEAD_COLUMNS,
      heat_styling: "never",
      styling_tools: ["flat_iron"],
      uses_heat_protection: false,
    },
  })
  assert.deepEqual(
    planned.report.visibleChanges.filter((change) => change.domain === "care_habits"),
    [{ domain: "care_habits", column: "styling_tools", before: "flat_iron", after: "[]" }],
  )
  assert.deepEqual(planned.report.careRules, ["never_with_tools"])

  // Decision 3 (intended): a heat level with no heat source is dropped — listed as an erasure.
  const levelOnly = plan({
    legacyLead: LEAD,
    columns: {
      ...LEAD_COLUMNS,
      heat_styling: "daily",
      styling_tools: null,
      drying_method: null,
      uses_heat_protection: true,
    },
  })
  assert.deepEqual(
    levelOnly.report.visibleChanges.filter((change) => change.domain === "care_habits"),
    [
      { domain: "care_habits", column: "heat_styling", before: "daily", after: "NULL" },
      { domain: "care_habits", column: "uses_heat_protection", before: "true", after: "false" },
    ],
  )
  assert.deepEqual(levelOnly.report.careRules, [])

  // Decision 4 (intended): nothing representable at all (a towel technique without a
  // material): no document is written, and the row is named instead of silently skipped.
  const unrepresentable = plan({
    legacyLead: LEAD,
    columns: { ...LEAD_COLUMNS, towel_material: null, towel_technique: "gentle_press" },
  })
  assert.equal(
    unrepresentable.writes.some((write) => write.domain === "care_habits"),
    false,
  )
  assert.deepEqual(unrepresentable.skips, [
    "care_habits: the care columns carry values the conversion cannot represent (towel_technique=gentle_press); no document written — the next care write replaces them",
  ])
})

// ---------------------------------------------------------------------------
// The tolerated differences, one by one
// ---------------------------------------------------------------------------

test("tolerated: every entry of TOLERATED_DIFFERENCES has a test below", () => {
  assert.deepEqual(Object.keys(TOLERATED_DIFFERENCES).sort(), [
    "array_order",
    "density_default_migration",
    "desired_volume_derived",
    "empty_array_vs_null",
    "hair_length_recovery",
    "never_projected",
    "primary_concern_unwritten",
    "scalp_condition_none_migration",
  ])
})

test("tolerated array_order: the same set in another order is no edit", () => {
  const planned = plan({
    legacyLead: LEAD,
    columns: {
      ...LEAD_COLUMNS,
      goals: ["curl_definition", "moisture"],
      concerns: ["tangling", "dryness"],
    },
  })
  assert.deepEqual(planned.report.findings, [])
})

test("tolerated empty_array_vs_null: [] and NULL are the same answer", () => {
  const answers = { ...LEAD_ANSWERS, concerns: [], goals: [] }
  const written = oldWriterColumnsForLead(answers)
  assert.deepEqual(written?.concerns, [])
  const planned = plan({
    legacyLead: { ...LEAD, quizAnswers: answers },
    columns: linked(written, { concerns: null }),
  })
  assert.deepEqual(planned.report.findings, [])
})

test("tolerated hair_length_recovery: a hair length the quiz lacked (the purchase-time form) is kept, not an edit", () => {
  const answers: Record<string, unknown> = { ...LEAD_ANSWERS }
  delete answers.hair_length
  const planned = plan({
    legacyLead: { ...LEAD, quizAnswers: answers },
    columns: linked(oldWriterColumnsForLead(answers), { hair_length: "short" }),
  })
  assert.deepEqual(planned.report.tolerated, [
    { column: "hair_length", id: "hair_length_recovery" },
  ])
  assert.equal(diagnosticsWrite(planned).patch.hairLength, "short")
  assert.deepEqual(diagnosticsWrite(planned).provenance.fields, {
    hairLength: "unknown_historical",
  })
})

test("tolerated scalp_condition_none_migration: an old 'none' the migration turned into NULL is no edit", () => {
  const native = projectLegacyLeadToFacts({
    leadId: "l",
    quizAnswers: LEAD_ANSWERS as never,
  }).diagnostics
  const analysis = detectHandEdits({
    native,
    columns: { ...LEAD_COLUMNS, scalp_condition: null },
    oldWriter: { ...oldWriterColumnsForLead(LEAD_ANSWERS), scalp_condition: "none" },
  })
  assert.deepEqual(analysis.tolerated, [
    { column: "scalp_condition", id: "scalp_condition_none_migration" },
  ])
  assert.deepEqual(analysis.findings, [])
})

test("tolerated desired_volume_derived: the editors' derived desired_volume is never compared", () => {
  const planned = plan({ legacyLead: LEAD, columns: { ...LEAD_COLUMNS, desired_volume: "less" } })
  assert.deepEqual(planned.report.findings, [])
})

test("tolerated primary_concern_unwritten: a NULL main problem (column younger than the link, iOS writers) is no edit", () => {
  const planned = plan({ legacyLead: LEAD, columns: { ...LEAD_COLUMNS, primary_concern: null } })
  assert.deepEqual(planned.report.tolerated, [
    { column: "primary_concern", id: "primary_concern_unwritten" },
  ])
  assert.equal(documentOf(planned).primaryConcern, "tangling", "the quiz's pick stays")
})

test("tolerated never_projected: a row that never received its quiz is filled from it and every change is listed", () => {
  const planned = plan({ artifact: ARTIFACT, columns: EMPTY })
  assert.deepEqual(planned.report.findings, [])
  assert.equal(
    planned.report.tolerated.every((entry) => entry.id === "never_projected"),
    true,
  )
  assert.equal(diagnosticsWrite(planned).provenance.editedAt, undefined)
  assert.deepEqual(
    planned.report.visibleChanges.find((change) => change.column === "hair_texture"),
    { domain: "diagnostics", column: "hair_texture", before: "NULL", after: "wavy" },
  )
})

// ---------------------------------------------------------------------------
// Stage 1 for a hand-edited backfilled row
// ---------------------------------------------------------------------------

test("Stage 1: an untouched backfilled row re-emits its verbatim envelope; a hand-edited one emits a native envelope built from the edited facts", () => {
  const quizContext = planUserFactsBackfill(row({ artifact: ARTIFACT, columns: PAID_COLUMNS }), {
    now: NOW,
    catchUp: false,
  }).writes.find((write) => write.domain === "quiz_context")?.patch as QuizContextV1

  const untouched = plan({ artifact: ARTIFACT, columns: PAID_COLUMNS })
  assert.deepEqual(
    toStage1Source({
      diagnostics: documentOf(untouched),
      quizContext,
      editedAt: diagnosticsWrite(untouched).provenance.editedAt,
      fields: diagnosticsWrite(untouched).provenance.fields,
    }),
    V3_ENVELOPE,
  )

  const edited = plan({
    artifact: ARTIFACT,
    columns: { ...PAID_COLUMNS, goals: ["volume", "moisture"], desired_volume: "more" },
  })
  const document = documentOf(edited)
  assert.deepEqual(document.source.raw, V3_ENVELOPE, "raw stays the verbatim quiz envelope")
  const emitted = toStage1Source({
    diagnostics: document,
    quizContext,
    editedAt: diagnosticsWrite(edited).provenance.editedAt,
    fields: diagnosticsWrite(edited).provenance.fields,
  }) as { kind: string; version: number; answers: Record<string, unknown> }
  assert.equal(emitted.kind, "personal_plan")
  assert.equal(emitted.version, 3)
  assert.deepEqual(emitted.answers.goals, ["moisture", "volume_balance"])
  assert.equal(emitted.answers.primaryConcern, "low_shine")

  const editedLead = plan({ legacyLead: LEAD, columns: { ...LEAD_COLUMNS, hair_length: "long" } })
  const legacy = toStage1Source({
    diagnostics: documentOf(editedLead),
    editedAt: diagnosticsWrite(editedLead).provenance.editedAt,
    fields: diagnosticsWrite(editedLead).provenance.fields,
  }) as { kind: string; answers: { hairLength: string } }
  assert.equal(legacy.kind, "legacy_quiz")
  assert.equal(legacy.answers.hairLength, "long")
})

// ---------------------------------------------------------------------------
// Through the real door (PGlite, lock applied after the legacy seed — the rollout order)
// ---------------------------------------------------------------------------

const DIAGNOSTIC_COLUMN_NAMES = [...COMPARED_COLUMNS, "desired_volume"] as const

async function seedLegacyRow(
  pg: PersonalPlanTestDb,
  userId: string,
  columns: LegacyProfileColumns,
) {
  const values = Object.fromEntries(
    DIAGNOSTIC_COLUMN_NAMES.map((column) => [column, columns[column] ?? null]),
  )
  // A NULL for a `'{}'`-default array column is written as the default, like production rows.
  for (const column of ["chemical_treatment", "concerns", "goals"]) values[column] ??= []
  const names = Object.keys(values)
  await pg.query(
    `INSERT INTO public.hair_profiles (user_id, ${names.join(", ")})
     VALUES ($1, ${names.map((_, index) => `$${index + 2}`).join(", ")})`,
    [userId, ...Object.values(values)],
  )
}

async function applyPlanThroughDoor(
  pg: PersonalPlanTestDb,
  userId: string,
  planned: UserFactsBackfillPlan,
) {
  let expectedRevision = 0
  for (const write of planned.writes) {
    const result = await saveUserFactsRpc(
      pgliteRpcClient(pg) as never,
      {
        userId,
        domain: write.domain,
        patch: write.patch,
        provenance: write.provenance,
        expectedRevision,
        mode: "upsert",
      } as Parameters<typeof saveUserFactsRpc>[1],
    )
    assert.equal(result.status, "ok", write.domain)
    expectedRevision = (result as { revision: number }).revision
  }
  return (await readRow(pg, userId))!
}

for (const [label, overrides] of [
  [
    "paid row with edited goals",
    {
      artifact: ARTIFACT,
      columns: { ...PAID_COLUMNS, goals: ["volume", "moisture"], desired_volume: "more" },
    },
  ],
  [
    "lead row edited in the Haar-Check editor",
    {
      legacyLead: LEAD,
      columns: {
        ...LEAD_COLUMNS,
        hair_texture: "wavy",
        scalp_type: "oily",
        scalp_condition: null,
        chemical_treatment: ["colored"],
      },
    },
  ],
  [
    "paid row with edited concerns",
    { artifact: ARTIFACT, columns: { ...PAID_COLUMNS, concerns: ["frizz"] } },
  ],
  ["iOS-edited lead row", { legacyLead: LEAD, columns: { ...LEAD_COLUMNS, thickness: "fine" } }],
] as const) {
  test(`through the door under the lock (${label}): the derived columns equal the TS oracle and the pre-backfill columns`, async (t) => {
    const pg = await migratedPersonalPlanDatabase(t, { lock: false })
    const userId = id(7, 1)
    await insertProfile(pg, userId)
    const before = overrides.columns as LegacyProfileColumns
    await seedLegacyRow(pg, userId, before)
    await applyUserFactsLock(pg)

    const planned = plan({ ...(overrides as Partial<LoadedUserRow>), userId })
    const after = await applyPlanThroughDoor(pg, userId, planned)
    const oracle = deriveDiagnosticsColumns(documentOf(planned))

    assert.deepEqual(canonical(after), canonical(oracle), "SQL door = TS oracle")
    const intended = new Set(planned.report.visibleChanges.map((change) => change.column))
    for (const column of DIAGNOSTIC_COLUMN_NAMES) {
      if (intended.has(column)) continue
      assert.deepEqual(
        canonical(after)[column],
        canonical(before as unknown as Record<string, unknown>)[column],
        `${column} unchanged`,
      )
    }
    assert.deepEqual(after.diagnostics, JSON.parse(JSON.stringify(documentOf(planned))))
  })
}

// ---------------------------------------------------------------------------
// The real `runUserFactsBackfill` loop, end to end on PGlite under the lock
// ---------------------------------------------------------------------------

const ARTIFACT_STUB = `
CREATE TABLE public.personal_plan_prepared_artifacts (
  id uuid PRIMARY KEY,
  lead_id uuid NOT NULL,
  user_id uuid,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  quiz_answers jsonb NOT NULL,
  canonical_profile jsonb NOT NULL
);
`

/** A PostgREST-shaped read client over PGlite — exactly the builder surface the backfill script
 * uses (`select`, `eq`, `in`, `gt`, `order`, `limit`, awaited) — plus the door's `rpc`. Values
 * come back as PostgREST serialises them (timestamps as ISO strings). */
function pgliteRestClient(pg: PersonalPlanTestDb) {
  const rpc = pgliteRpcClient(pg)
  const safe = (name: string) => {
    if (!/^[a-z_]+$/.test(name)) throw new Error(`unsupported identifier ${name}`)
    return name
  }
  return {
    rpc: rpc.rpc,
    from(table: string) {
      let columns = "*"
      const where: string[] = []
      const params: unknown[] = []
      let orderBy = ""
      let limit = ""
      const builder = {
        select(selected: string) {
          columns = selected
            .split(",")
            .map((column) => safe(column.trim()))
            .join(", ")
          return builder
        },
        eq(column: string, value: unknown) {
          params.push(value)
          where.push(`${safe(column)}::text = $${params.length}::text`)
          return builder
        },
        in(column: string, values: unknown[]) {
          params.push(values.map(String))
          where.push(`${safe(column)}::text = ANY($${params.length}::text[])`)
          return builder
        },
        gt(column: string, value: unknown) {
          params.push(value)
          where.push(`${safe(column)}::text > $${params.length}::text`)
          return builder
        },
        order(column: string) {
          orderBy = ` ORDER BY ${safe(column)}`
          return builder
        },
        limit(count: number) {
          limit = ` LIMIT ${Number(count)}`
          return builder
        },
        then(
          resolve: (result: { data: unknown[]; error: null }) => unknown,
          reject: (e: unknown) => unknown,
        ) {
          const sql = `SELECT ${columns} FROM public.${safe(table)}${where.length ? ` WHERE ${where.join(" AND ")}` : ""}${orderBy}${limit}`
          return pg
            .query<Record<string, unknown>>(sql, params)
            .then(({ rows }) =>
              resolve({
                data: rows.map((dbRow) =>
                  Object.fromEntries(
                    Object.entries(dbRow).map(([key, value]) => [
                      key,
                      value instanceof Date ? value.toISOString() : value,
                    ]),
                  ),
                ),
                error: null,
              }),
            )
            .catch(reject)
        },
      }
      return builder
    },
  }
}

test("the real runUserFactsBackfill loop on PGlite under the lock: dry-run report, --apply through the door, idempotent rerun", async (t) => {
  const pg = await mobileFactsDatabase(t, { lock: false })
  await pg.exec(ARTIFACT_STUB)

  const edited = id(3, 1) // legacy lead, Haar-Check edit
  const ios = id(3, 2) // legacy lead, iOS edit with a scanner_profile_edits record
  const paid = id(3, 3) // untouched paid row
  for (const userId of [edited, ios, paid]) await insertProfile(pg, userId)

  const leadAt = "2026-07-01T09:00:00.000Z"
  for (const [userId, leadId] of [
    [edited, id(4, 1)],
    [ios, id(4, 2)],
  ]) {
    await pg.query(
      `INSERT INTO public.leads (id, email, quiz_answers, quiz_kind, status, user_id, created_at)
       VALUES ($1, 'lead@example.test', $2, 'legacy', 'linked', $3, $4)`,
      [leadId, JSON.stringify(LEAD_ANSWERS), userId, leadAt],
    )
  }
  await pg.query(
    `INSERT INTO public.personal_plan_prepared_artifacts
       (id, lead_id, user_id, status, created_at, quiz_answers, canonical_profile)
     VALUES ($1, $2, $3, 'attached', $4, $5, $6)`,
    [
      id(5, 3),
      id(4, 3),
      paid,
      ARTIFACT.createdAt,
      JSON.stringify(V3_ENVELOPE),
      JSON.stringify({ modelVersion: "personal_plan_canonical_v1", ...adaptedCanonical() }),
    ],
  )

  await seedLegacyRow(pg, edited, { ...LEAD_COLUMNS, hair_texture: "wavy" })
  await seedLegacyRow(pg, ios, { ...LEAD_COLUMNS, thickness: "fine" })
  await seedLegacyRow(pg, paid, PAID_COLUMNS)
  // The iOS edit: its context version's created_at is the edit time.
  const versionId = id(6, 2)
  await pg.query(
    `INSERT INTO public.scanner_context_versions
       (id, user_id, source_revision, profile_revision, source_hash, engine_version, snapshot_source,
        input_snapshot, output_snapshot, created_at)
     VALUES ($1, $2, 1, 1, $3, 'v1', 'initial', '{}', '{}', '2026-09-20T08:00:00.000Z')`,
    [versionId, ios, "a".repeat(64)],
  )
  await pg.query(
    `INSERT INTO public.scanner_profile_edits (user_id, profile_revision, context_version_id, quiz_answers, profile_snapshot)
     VALUES ($1, 1, $2, '{}', '{}')`,
    [ios, versionId],
  )
  await applyUserFactsLock(pg)

  const client = pgliteRestClient(pg)
  const dryLines: string[] = []
  const dry = await runUserFactsBackfill([], {
    supabase: client as never,
    now: NOW,
    log: (line) => dryLines.push(line),
  })
  // `PRINT_BACKFILL_REPORT=1` prints the fixture report (the sample the owner signs off).
  if (process.env.PRINT_BACKFILL_REPORT) console.log(dryLines.join("\n"))
  assert.equal(dry.usersExamined, 3)
  assert.equal(dry.handEditedRows, 2)
  assert.equal(dry.ambiguousRows, 0)
  assert.ok(
    dryLines.includes(
      `  ${"rows with hand-edited groups".padEnd(42)} 2 (structure 1, thickness 1)`,
    ),
  )
  assert.ok(
    dryLines.includes(
      `  ${ios} [legacy_lead ${id(4, 2)}] thickness — editedAt 2026-09-20T08:00:00.000Z (ios_profile_edit)`,
    ),
  )
  assert.ok(dryLines.includes("    hair_texture: column=wavy old writer=curly"))
  assert.ok(
    dryLines.includes(
      "    diagnostics.goals: less_frizz,moisture,healthy_scalp,shine -> moisture,shine",
    ),
  )
  const before = await readRow(pg, edited)
  assert.equal(before?.facts_revision, 0, "a dry run writes nothing")

  const applyLines: string[] = []
  const applied = await runUserFactsBackfill(["--apply"], {
    supabase: client as never,
    now: NOW,
    log: (line) => applyLines.push(line),
  })
  assert.equal(applied.failures.length, 0, JSON.stringify(applied.failures))
  assert.equal(applied.applied, applied.writesPlanned)

  const editedRow = (await readRow(pg, edited))!
  assert.equal(editedRow.hair_texture, "wavy", "the hand edit survives the backfill")
  assert.equal(editedRow.thickness, "coarse")
  const provenance = editedRow.facts_provenance as { diagnostics: DomainProvenance }
  assert.deepEqual(provenance.diagnostics.fields, { texture: "user" })
  const iosRow = (await readRow(pg, ios))!
  assert.equal(iosRow.thickness, "fine")
  assert.equal(
    (iosRow.facts_provenance as { diagnostics: DomainProvenance }).diagnostics.editedAt,
    "2026-09-20T08:00:00.000Z",
  )
  const paidRow = (await readRow(pg, paid))!
  assert.deepEqual([...(paidRow.goals as string[])].sort(), ["moisture", "shine"])
  assert.ok(paidRow.quiz_context)

  const rerun = await runUserFactsBackfill(["--apply"], {
    supabase: client as never,
    now: NOW,
    log: () => {},
  })
  assert.equal(rerun.writesPlanned, 0, "idempotent: every domain already holds a document")
})

/** What the paid preparation stored as `canonical_profile`: the offer adapter over the answers. */
function adaptedCanonical(): Record<string, unknown> {
  return { ...adaptPersonalPlanAnswersForOffer(V3_ENVELOPE.answers as never).answers }
}
