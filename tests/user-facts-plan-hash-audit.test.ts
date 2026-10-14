import assert from "node:assert/strict"
import test from "node:test"

import {
  auditPlanUser,
  summarizeAudit,
  type AuditedPlanUser,
} from "../scripts/user-facts/plan-hash-audit"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import {
  hashPersonalPlanNeedVersionInput,
  type JsonValue,
} from "../src/lib/personal-plan/persistence/index"
import { PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION } from "../src/lib/personal-plan/persistence/stage1-service"
import { projectArtifactToFacts } from "../src/lib/user-facts/project-artifact"
import type { UserFacts } from "../src/lib/user-facts/read"
import type { DiagnosticsV1 } from "../src/lib/user-facts/schema"

const V3_ENVELOPE = {
  kind: "personal_plan",
  version: 3,
  answers: {
    texture: "wavy",
    thickness: "normal",
    density: "medium",
    goals: ["moisture", "shine"],
    routineClarity: "partial",
    resultReliability: "sometimes",
    adaptationConfidence: "partly",
    currentConcerns: ["dry_lengths", "split_ends"],
    hairLength: "medium",
    hairSurface: "slightly_uneven",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["colored", "permed"],
    scalpOiliness: "balanced",
    scalpConcerns: ["dry_dandruff", "irritated"],
    previousAttempts: "mostly_works",
    blockers: ["consistency", "product_fit"],
    routineStyle: "intentional_caring",
    meaningfulMoment: "social",
  },
} as const

/** What a plan's current initial version holds, computed through Stage 1's own path. */
function currentInitialFor(envelope: unknown) {
  const computed = computeNeedPlan({
    rawEnvelope: envelope,
    artifactId: "artifact-1",
    projection: "initial_quiz",
    computationVersion: PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION,
    createdAt: "2026-01-01T00:00:00.000Z",
  })
  assert.equal(computed.status, "ready")
  if (computed.status !== "ready") throw new Error("unreachable")
  const inputSnapshot = computed.snapshot.sourceQuiz as unknown as JsonValue
  return {
    inputHash: hashPersonalPlanNeedVersionInput({
      schemaVersion: computed.snapshot.schemaVersion,
      computationVersion: computed.snapshot.computationVersion,
      inputSnapshot,
    }),
    inputSnapshot,
    preparedArtifactSourceId: "artifact-1",
    stage1SourceLeadId: null,
  }
}

function factsFor(
  diagnostics: DiagnosticsV1,
  quizContext: UserFacts["quizContext"],
  provenance: UserFacts["provenance"] = {},
): UserFacts {
  return {
    userId: "user-1",
    diagnostics,
    careHabits: null,
    quizContext,
    shoppingPreferences: null,
    provenance,
    revision: 1,
  }
}

test("audit: facts projected from the same envelope hash identically to the plan's initial version", () => {
  const { diagnostics, quizContext } = projectArtifactToFacts({
    envelope: V3_ENVELOPE,
    artifactId: "artifact-1",
    leadId: "lead-1",
  })
  const result = auditPlanUser({
    facts: factsFor(diagnostics, quizContext),
    currentInitial: currentInitialFor(V3_ENVELOPE),
  })
  assert.deepEqual(result, { status: "identical" })
})

test("audit: a hand-edited field differs and is named in changedFields", () => {
  const { diagnostics, quizContext } = projectArtifactToFacts({
    envelope: V3_ENVELOPE,
    artifactId: "artifact-1",
    leadId: "lead-1",
  })
  const edited: DiagnosticsV1 = {
    ...diagnostics,
    thickness: "coarse",
    goals: ["shine", "volume_balance"],
  }
  const result = auditPlanUser({
    facts: factsFor(edited, quizContext, {
      diagnostics: {
        source: { kind: "profile_editor" },
        schemaVersion: 1,
        at: "2026-09-01T10:00:00.000Z",
        editedAt: "2026-09-01T10:00:00.000Z",
        fields: {},
      },
    }),
    currentInitial: currentInitialFor(V3_ENVELOPE),
  })
  assert.equal(result.status, "differs")
  assert.deepEqual(result.changedFields, ["goals", "thickness"])
})

test("audit: null facts are not computable", () => {
  const result = auditPlanUser({ facts: null, currentInitial: currentInitialFor(V3_ENVELOPE) })
  assert.equal(result.status, "not_computable")
  assert.equal(result.reason, "no_facts")
})

test("audit: facts without diagnostics are not computable", () => {
  const result = auditPlanUser({
    facts: { ...factsFor({} as DiagnosticsV1, null), diagnostics: null },
    currentInitial: currentInitialFor(V3_ENVELOPE),
  })
  assert.equal(result.status, "not_computable")
  assert.equal(result.reason, "no_diagnostics")
})

test("audit: a legacy_columns source is not computable", () => {
  const { diagnostics, quizContext } = projectArtifactToFacts({
    envelope: V3_ENVELOPE,
    artifactId: "artifact-1",
    leadId: "lead-1",
  })
  const legacyColumns: DiagnosticsV1 = {
    ...diagnostics,
    source: { kind: "legacy_columns", version: 1, raw: {} },
  } as DiagnosticsV1
  const result = auditPlanUser({
    facts: factsFor(legacyColumns, quizContext),
    currentInitial: currentInitialFor(V3_ENVELOPE),
  })
  assert.equal(result.status, "not_computable")
  assert.equal(result.reason, "legacy_columns")
})

test("audit: an edited profile missing a required answer is not computable (incomplete)", () => {
  const { diagnostics, quizContext } = projectArtifactToFacts({
    envelope: V3_ENVELOPE,
    artifactId: "artifact-1",
    leadId: "lead-1",
  })
  const { hairSurface, ...withoutSurface } = diagnostics
  void hairSurface
  const result = auditPlanUser({
    facts: factsFor(withoutSurface as DiagnosticsV1, quizContext, {
      diagnostics: {
        source: { kind: "profile_editor" },
        schemaVersion: 1,
        at: "2026-09-01T10:00:00.000Z",
        editedAt: "2026-09-01T10:00:00.000Z",
      },
    }),
    currentInitial: currentInitialFor(V3_ENVELOPE),
  })
  assert.equal(result.status, "not_computable")
  assert.equal(result.reason, "incomplete_facts")
})

test("audit: a plan without any source id is not computable", () => {
  const { diagnostics, quizContext } = projectArtifactToFacts({
    envelope: V3_ENVELOPE,
    artifactId: "artifact-1",
    leadId: "lead-1",
  })
  const result = auditPlanUser({
    facts: factsFor(diagnostics, quizContext),
    currentInitial: {
      ...currentInitialFor(V3_ENVELOPE),
      preparedArtifactSourceId: null,
      stage1SourceLeadId: null,
    },
  })
  assert.equal(result.status, "not_computable")
  assert.equal(result.reason, "no_source_id")
})

test("summary: counts per status and per changed-field combination, split by routine and edit state", () => {
  const rows: AuditedPlanUser[] = [
    { userId: "a", result: { status: "identical" }, hasActiveRoutine: true, handEdited: false },
    {
      userId: "b",
      result: { status: "differs", changedFields: ["goals", "thickness"] },
      hasActiveRoutine: true,
      handEdited: true,
    },
    {
      userId: "c",
      result: { status: "differs", changedFields: ["goals", "thickness"] },
      hasActiveRoutine: false,
      handEdited: true,
    },
    {
      userId: "d",
      result: { status: "differs", changedFields: ["texture"] },
      hasActiveRoutine: false,
      handEdited: false,
    },
    {
      userId: "e",
      result: { status: "not_computable", reason: "legacy_columns" },
      hasActiveRoutine: false,
      handEdited: false,
    },
  ]
  const summary = summarizeAudit(rows)
  assert.equal(summary.total, 5)
  assert.deepEqual(summary.byStatus, { identical: 1, differs: 3, not_computable: 1 })
  assert.deepEqual(summary.differs.byChangedFields, { "goals,thickness": 2, texture: 1 })
  assert.equal(summary.differs.withActiveRoutine, 1)
  assert.equal(summary.differs.handEdited, 2)
  assert.equal(summary.differs.notHandEdited, 1)
  assert.deepEqual(summary.notComputable.byReason, { legacy_columns: 1 })
  // No user ids anywhere in the printable summary.
  assert.ok(!JSON.stringify(summary).match(/"[a-e]"/))
})
