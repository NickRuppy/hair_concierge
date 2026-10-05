import assert from "node:assert/strict"
import test from "node:test"

import {
  createStage1PersistenceService,
  type CreateInitialNeedRequest,
  type Stage1LegacyLead,
  type Stage1PersistenceDependencies,
} from "../../../src/lib/personal-plan/persistence/stage1-service"
import { projectArtifactToFacts } from "../../../src/lib/user-facts/project-artifact"
import { projectLegacyLeadToFacts } from "../../../src/lib/user-facts/project-legacy-lead"
import type { UserFacts } from "../../../src/lib/user-facts/read"
import type { FactsProvenance } from "../../../src/lib/user-facts/schema"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"

const USER_ID = "user-1"
const ARTIFACT_ID = "11111111-1111-4111-8111-111111111111"
const LEAD_ID = "lead-legacy"
const EDITED_AT = "2026-09-01T10:00:00.000Z"

const V2_ENVELOPE = {
  kind: "personal_plan",
  version: 2,
  answers: {
    texture: "coily",
    thickness: "coarse",
    density: "high",
    goals: ["scalp_balance"],
    routineClarity: "trial_and_error",
    resultReliability: "mostly",
    adaptationConfidence: "yes",
    currentConcerns: ["scalp_imbalance", "breakage_or_split_ends"],
    hairLength: "very_long",
    hairSurface: "rough",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
    scalpOiliness: "oily",
    scalpConcerns: ["oily_dandruff"],
    previousAttempts: "little_targeted_trial",
    blockers: ["routine_too_complex"],
    routineStyle: "precise_goal_oriented",
    meaningfulMoment: "special_occasions",
  },
}

const LEGACY_LEAD: Stage1LegacyLead = {
  id: LEAD_ID,
  quizAnswers: {
    structure: "wavy",
    thickness: "normal",
    density: "medium",
    hair_length: "medium",
    fingertest: "leicht_uneben",
    pulltest: "stretches_bounces",
    treatment: ["natur"],
    scalp_type: "ausgeglichen",
    has_scalp_issue: false,
    goals: ["moisture"],
    concerns: ["dryness"],
  },
}

function baseDeps(
  overrides: Partial<Stage1PersistenceDependencies> = {},
): Stage1PersistenceDependencies {
  return {
    isEnabled: () => true,
    cohortCutoff: () => new Date("2026-08-08T00:00:00.000Z"),
    findEntitlement: async () => ({
      accessState: "active",
      enrollmentSourceId: "22222222-2222-4222-8222-222222222222",
      qualifiedAt: "2026-08-08T01:00:00.000Z",
      artifactLeadId: "44444444-4444-4444-8444-444444444444",
    }),
    loadArtifact: async () => ({ id: ARTIFACT_ID, quizAnswers: COMPLETE_V3_PLAN_ENVELOPE }),
    createOrReuseInitialNeed: async (request) => ({
      outcome: "completed",
      personalPlanId: request.userId,
      needVersionId: "33333333-3333-4333-8333-333333333333",
      outputSnapshot: request.outputSnapshot,
    }),
    now: () => new Date("2026-08-08T02:00:00.000Z"),
    ...overrides,
  }
}

const LEGACY_ENTITLEMENT_OVERRIDES: Partial<Stage1PersistenceDependencies> = {
  findEntitlement: async () => ({
    accessState: "active",
    enrollmentSourceId: "purchase-legacy",
    qualifiedAt: "2026-08-08T01:00:00.000Z",
    artifactLeadId: LEAD_ID,
    quizSourceKind: "legacy",
  }),
  loadArtifact: async () => {
    throw new Error("legacy users never load an artifact")
  },
  loadLegacyLead: async () => LEGACY_LEAD,
}

/** Runs `loadOrCreate` and returns the request the fake `createOrReuseInitialNeed` received. */
async function runRequest(
  overrides: Partial<Stage1PersistenceDependencies> = {},
): Promise<CreateInitialNeedRequest> {
  let received: CreateInitialNeedRequest | null = null
  const service = createStage1PersistenceService(
    baseDeps({
      ...overrides,
      createOrReuseInitialNeed: async (request) => {
        received = request
        return {
          outcome: "completed",
          personalPlanId: "plan-1",
          needVersionId: "need-1",
          outputSnapshot: request.outputSnapshot,
        }
      },
    }),
  )
  const result = await service.loadOrCreate({ userId: USER_ID })
  assert.equal(result.status, "completed")
  assert.ok(received, "createOrReuseInitialNeed was not called")
  return received
}

function asFacts(
  projected: Pick<UserFacts, "diagnostics" | "quizContext">,
  provenance: FactsProvenance = {},
): UserFacts {
  return {
    userId: USER_ID,
    diagnostics: projected.diagnostics,
    careHabits: null,
    quizContext: projected.quizContext,
    provenance,
    revision: 1,
  }
}

function editedProvenance(fields?: Record<string, "user" | "assumed">): FactsProvenance {
  return {
    diagnostics: {
      source: { kind: "profile_editor" },
      schemaVersion: 1,
      at: EDITED_AT,
      editedAt: EDITED_AT,
      ...(fields ? { fields } : {}),
    },
  }
}

function v3Facts(provenance?: FactsProvenance): UserFacts {
  return asFacts(
    projectArtifactToFacts({
      envelope: COMPLETE_V3_PLAN_ENVELOPE,
      artifactId: ARTIFACT_ID,
      leadId: "44444444-4444-4444-8444-444444444444",
    }),
    provenance,
  )
}

function legacyFacts(provenance?: FactsProvenance): UserFacts {
  const projected = projectLegacyLeadToFacts({
    leadId: LEAD_ID,
    quizAnswers: LEGACY_LEAD.quizAnswers,
  })
  return asFacts({ diagnostics: projected.diagnostics, quizContext: null }, provenance)
}

test("unedited v3 facts give the same inputHash and inputSnapshot as the artifact path", async () => {
  const baseline = await runRequest()
  const viaFacts = await runRequest({ loadFacts: async () => v3Facts() })

  assert.equal(viaFacts.inputHash, baseline.inputHash)
  assert.deepEqual(viaFacts.inputSnapshot, baseline.inputSnapshot)
})

test("unedited v2 facts give the same inputHash and inputSnapshot as the artifact path", async () => {
  const artifactDeps = { loadArtifact: async () => ({ id: ARTIFACT_ID, quizAnswers: V2_ENVELOPE }) }
  const baseline = await runRequest(artifactDeps)
  const facts = asFacts(
    projectArtifactToFacts({ envelope: V2_ENVELOPE, artifactId: ARTIFACT_ID, leadId: "lead-v2" }),
  )
  const viaFacts = await runRequest({ ...artifactDeps, loadFacts: async () => facts })

  assert.equal(viaFacts.inputHash, baseline.inputHash)
  assert.deepEqual(viaFacts.inputSnapshot, baseline.inputSnapshot)
})

test("unedited legacy-lead facts give the same inputHash and inputSnapshot as the lead path", async () => {
  const baseline = await runRequest(LEGACY_ENTITLEMENT_OVERRIDES)
  const viaFacts = await runRequest({
    ...LEGACY_ENTITLEMENT_OVERRIDES,
    loadFacts: async () => legacyFacts(),
  })

  assert.equal(viaFacts.inputHash, baseline.inputHash)
  assert.deepEqual(viaFacts.inputSnapshot, baseline.inputSnapshot)
  assert.equal(viaFacts.stage1SourceKind, "legacy_quiz_lead")
  assert.equal(viaFacts.stage1SourceLeadId, LEAD_ID)
})

test("hand-edited facts feed the plan: edited snapshot, new hash, source ids unchanged", async () => {
  const baseline = await runRequest()
  const unedited = v3Facts()
  const edited = {
    ...unedited,
    diagnostics: { ...unedited.diagnostics!, texture: "coily" as const },
    provenance: editedProvenance(),
  }
  const viaFacts = await runRequest({ loadFacts: async () => edited })

  assert.notEqual(viaFacts.inputHash, baseline.inputHash)
  assert.equal(
    (viaFacts.inputSnapshot as { answers: { texture: string } }).answers.texture,
    "coily",
  )
  assert.equal((baseline.inputSnapshot as { answers: { texture: string } }).answers.texture, "wavy")
  assert.equal(viaFacts.preparedArtifactSourceId, baseline.preparedArtifactSourceId)
  assert.equal(viaFacts.preparedArtifactSourceId, ARTIFACT_ID)
  assert.equal(viaFacts.stage1SourceKind, baseline.stage1SourceKind)
  assert.equal(viaFacts.stage1SourceLeadId, baseline.stage1SourceLeadId)
})

test("hand-edited legacy facts keep the legacy source ids", async () => {
  const baseline = await runRequest(LEGACY_ENTITLEMENT_OVERRIDES)
  const unedited = legacyFacts()
  const edited = {
    ...unedited,
    diagnostics: { ...unedited.diagnostics!, thickness: "coarse" as const },
    provenance: editedProvenance(),
  }
  const viaFacts = await runRequest({
    ...LEGACY_ENTITLEMENT_OVERRIDES,
    loadFacts: async () => edited,
  })

  assert.notEqual(viaFacts.inputHash, baseline.inputHash)
  assert.equal(viaFacts.preparedArtifactSourceId, null)
  assert.equal(viaFacts.stage1SourceKind, "legacy_quiz_lead")
  assert.equal(viaFacts.stage1SourceLeadId, LEAD_ID)
})

test("facts from a legacy_columns source fall back to the artifact envelope", async () => {
  const baseline = await runRequest()
  const facts = v3Facts()
  const legacyColumns = {
    ...facts,
    diagnostics: { ...facts.diagnostics!, source: { kind: "legacy_columns" as const } },
  }
  const viaFacts = await runRequest({ loadFacts: async () => legacyColumns as UserFacts })

  assert.equal(viaFacts.inputHash, baseline.inputHash)
  assert.deepEqual(viaFacts.inputSnapshot, baseline.inputSnapshot)
})

test("incomplete edited facts (assumed required field) fall back to the artifact envelope", async () => {
  const baseline = await runRequest()
  const facts = v3Facts(editedProvenance({ hairLength: "assumed" }))
  const viaFacts = await runRequest({ loadFacts: async () => facts })

  assert.equal(viaFacts.inputHash, baseline.inputHash)
  assert.deepEqual(viaFacts.inputSnapshot, baseline.inputSnapshot)
})

test("missing facts fall back to the artifact envelope", async () => {
  const baseline = await runRequest()
  const viaFacts = await runRequest({ loadFacts: async () => null })

  assert.equal(viaFacts.inputHash, baseline.inputHash)
  assert.deepEqual(viaFacts.inputSnapshot, baseline.inputSnapshot)
})

test("facts without diagnostics fall back to the artifact envelope", async () => {
  const baseline = await runRequest()
  const noDiagnostics: UserFacts = { ...v3Facts(), diagnostics: null }
  const viaFacts = await runRequest({ loadFacts: async () => noDiagnostics })

  assert.equal(viaFacts.inputHash, baseline.inputHash)
})

test("a failing facts read is temporarily_unavailable and writes nothing", async () => {
  let writes = 0
  const service = createStage1PersistenceService(
    baseDeps({
      loadFacts: async () => {
        throw new Error("hair_profiles unavailable")
      },
      createOrReuseInitialNeed: async () => {
        writes += 1
        return { outcome: "temporarily_unavailable" }
      },
    }),
  )

  assert.deepEqual(await service.loadOrCreate({ userId: USER_ID }), {
    status: "temporarily_unavailable",
  })
  assert.equal(writes, 0)
})

test("the migration short-circuit returns before facts are read", async () => {
  const persisted = {
    status: "completed" as const,
    personalPlanId: "plan",
    needVersionId: "original",
    outputSnapshot: { original: true },
  }
  const service = createStage1PersistenceService(
    baseDeps({
      findEntitlement: async () => ({
        accessState: "active",
        enrollmentSourceId: "migration",
        sourceKind: "migration",
        qualifiedAt: "2026-01-01T00:00:00Z",
        artifactLeadId: "old-lead",
        quizSourceKind: "legacy",
      }),
      loadExistingMigrationPlan: async () => persisted,
      loadFacts: async () => {
        throw new Error("must not read facts")
      },
      createOrReuseInitialNeed: async () => {
        throw new Error("must not recompute")
      },
    }),
  )

  assert.deepEqual(await service.loadOrCreate({ userId: USER_ID }), persisted)
})
