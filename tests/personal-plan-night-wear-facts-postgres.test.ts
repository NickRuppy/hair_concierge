import assert from "node:assert/strict"
import test from "node:test"

import { buildDirectAcceptanceStage2Defaults } from "../src/lib/personal-plan/direct-acceptance/defaults"
import {
  createStage2RefinementService,
  type Stage2PersistedDraft,
} from "../src/lib/personal-plan/persistence/stage2-refinement-service"
import { getStage2QuestionModule } from "../src/lib/personal-plan/refinement/question-path"
import type {
  NightProtection,
  NightWear,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "../src/lib/personal-plan/refinement/types"
import { toolSectionsForFamilies } from "../src/lib/personal-plan/tools/labels"
import type { SaveUserFactsResult } from "../src/lib/user-facts/save"
import type { CareHabitsV1, FieldProvenanceValue } from "../src/lib/user-facts/schema"
import {
  id,
  insertProfile,
  migratedPersonalPlanDatabase,
  readHairProfile,
  saveUserFacts,
  type PersonalPlanTestDb,
} from "./personal-plan-pglite-migration.fixtures"

/**
 * Rev. 6 review fix F1 (2026-10-12), over the REAL `user_facts_save_v1` (migrated PGlite chain):
 * a member who accepted the plan directly (the tools night page is assumed) changes „Nachts".
 * Her `nightWear` answer is hers, so the stored `nightProtection` list must follow its technique
 * — while the night THINGS stay what she confirmed, never the draft's assumption.
 */

const USER = id(1, 1)

const ON_MEDIUM: Stage2TriggerContext = {
  relevantCategories: ["shampoo", "conditioner"],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible",
  toolsEnabled: true,
  hairLength: "medium",
}

async function memberWithConfirmedNight(t: {
  after: (fn: () => Promise<void>) => void
}): Promise<PersonalPlanTestDb> {
  const pg = await migratedPersonalPlanDatabase(t)
  await insertProfile(pg, USER)
  const seeded = await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { nightProtection: ["silk_satin_pillow", "loose_tied"] },
    provenance: {
      source: { kind: "legacy_columns" },
      schemaVersion: 1,
      at: "2026-10-01T08:00:00.000Z",
      fields: { nightProtection: "user" },
    },
  })
  assert.equal(seeded.status, "ok")
  return pg
}

/** The direct-acceptance draft: every answer assumed, the known night answer kept. */
function directAcceptDraft(
  known: NightProtection[] | null = ["silk_satin_pillow", "loose_tied"],
): Stage2PersistedDraft {
  const defaults = buildDirectAcceptanceStage2Defaults(
    ON_MEDIUM,
    known
      ? { answers: { nightProtection: known }, questionIds: ["night_protection"] }
      : { answers: {}, questionIds: [] },
  )
  return {
    id: "draft-1",
    personalPlanId: "plan-1",
    baseInitialNeedVersionId: "initial-1",
    schemaVersion: 1,
    pathVersion: "stage2-v1",
    preparedArtifactSourceId: "artifact-1",
    baseInputSnapshot: {},
    triggerContext: ON_MEDIUM,
    answers: defaults.answers,
    completedQuestionIds: defaults.completedQuestionIds,
    answerProvenance: defaults.answerProvenance,
    moduleProjections: {},
    revision: 3,
    status: "complete",
    refinedVersionId: "refined-1",
  }
}

function serviceOver(pg: PersonalPlanTestDb, initial: Stage2PersistedDraft) {
  let stored = structuredClone(initial)
  return createStage2RefinementService({
    userId: USER,
    snapshotBuilder: () => ({
      inputSnapshot: {},
      outputSnapshot: {},
      inputHash: "a".repeat(64),
      schemaVersion: 1,
      computationVersion: "test",
    }),
    persistence: {
      loadOrCreate: async () => structuredClone(stored),
      reopen: async ({ draft }) => {
        stored = { ...draft, id: "draft-2", status: "in_progress", refinedVersionId: null }
        return structuredClone(stored)
      },
      save: async (input) => {
        stored = {
          ...input.draft,
          answers: input.answers,
          completedQuestionIds: input.completedQuestionIds,
          answerProvenance: input.answerProvenance,
          revision: input.expectedRevision + 1,
        }
        return { outcome: "saved", revision: stored.revision }
      },
      complete: async () => {
        throw new Error("the habits module does not close this draft")
      },
      completeModule: async ({ module }) => ({
        outcome: "completed",
        refinedVersionId: `refined-${module}`,
        stage3Handoff: false,
      }),
    },
    // The draft binding needs a real draft row; this test is about the field merge only.
    saveFacts: async (input) =>
      (await saveUserFacts(pg, {
        userId: input.userId,
        domain: input.domain,
        patch: input.patch,
        provenance: input.provenance,
      })) as SaveUserFactsResult,
    loadStoredCareHabits: async () => {
      const row = await readHairProfile(pg, USER)
      const provenance = row?.facts_provenance as
        | { care_habits?: { fields?: Record<string, FieldProvenanceValue> } }
        | undefined
      return {
        careHabits: (row?.care_habits ?? null) as Partial<CareHabitsV1> | null,
        fields: provenance?.care_habits?.fields,
      }
    },
  })
}

/** Walks the Gewohnheiten edit visit (every question confirmed), „Nachts" = `nightWear`. */
async function walkHabits(
  service: ReturnType<typeof serviceOver>,
  nightWear: NightWear,
): Promise<number> {
  let session = await service.load()
  const habits = session.path.orderedQuestionIds.filter(
    (questionId) => getStage2QuestionModule(questionId) === "habits",
  )
  assert.equal(habits.at(-1), "night_wear")
  for (const questionId of habits) {
    session = await service.saveAnswer({
      questionId,
      answer: answerOf(session.answers, questionId, nightWear),
      expectedRevision: session.revision,
    })
  }
  const completion = await service.completeModule({
    module: "habits",
    expectedRevision: session.revision,
  })
  assert.equal(completion.status, "in_progress", "tools stay assumed, so habits does not close")
  return session.revision
}

/** Walks the Deine Tools edit visit, every page confirmed as it is, the night page = `night`. */
async function walkTools(service: ReturnType<typeof serviceOver>, night: string[]): Promise<void> {
  let session = await service.load()
  const done = new Set<Stage2QuestionId>()
  for (;;) {
    const questionId = session.path.orderedQuestionIds.find(
      (candidate) => getStage2QuestionModule(candidate) === "tools" && !done.has(candidate),
    )
    if (!questionId) break
    const pageKey = questionId.slice("tools:".length) as keyof NonNullable<
      Stage2PersistedDraft["answers"]["toolForms"]
    >
    const answer =
      questionId === "tools_overview"
        ? toolSectionsForFamilies(session.answers.toolFamiliesWithSomething ?? [])
        : questionId === "tools:night_protection:1"
          ? night
          : (session.answers.toolForms?.[pageKey] ?? [])
    session = await service.saveAnswer({
      questionId,
      answer,
      expectedRevision: session.revision,
    })
    done.add(questionId)
  }
  const completion = await service.completeModule({
    module: "tools",
    expectedRevision: session.revision,
  })
  assert.equal(completion.status, "in_progress", "habits stay assumed, so tools do not close")
}

function answerOf(
  answers: Stage2PersistedDraft["answers"],
  questionId: Stage2QuestionId,
  nightWear: NightWear,
): unknown {
  if (questionId === "night_wear") return nightWear
  if (questionId === "towel_handling") return answers.towel
  if (questionId === "drying_routes") return answers.dryingRoutes
  if (questionId.startsWith("heat:")) return answers.heatEvents?.[questionId]
  throw new Error(`unexpected habits question ${questionId}`)
}

async function storedNight(pg: PersonalPlanTestDb) {
  const row = await readHairProfile(pg, USER)
  assert.ok(row)
  const careHabits = row.care_habits as Record<string, unknown>
  const fields = (row.facts_provenance as { care_habits: { fields: Record<string, string> } })
    .care_habits.fields
  return {
    nightProtection: careHabits.nightProtection,
    nightWear: careHabits.nightWear,
    fields: { nightProtection: fields.nightProtection, nightWear: fields.nightWear },
    legacy: row.night_protection,
  }
}

test("F1: a confirmed „Nachts“ change reaches nightProtection; the confirmed things stay", async (t) => {
  const pg = await memberWithConfirmedNight(t)
  const service = serviceOver(pg, directAcceptDraft())

  await walkHabits(service, "pineapple")
  assert.deepEqual(await storedNight(pg), {
    nightProtection: ["silk_satin_pillow", "pineapple"],
    nightWear: "pineapple",
    fields: { nightProtection: "user", nightWear: "user" },
    legacy: ["silk_satin_pillow", "pineapple"],
  })

  await walkHabits(service, "open")
  assert.deepEqual(await storedNight(pg), {
    nightProtection: ["silk_satin_pillow"],
    nightWear: "open",
    fields: { nightProtection: "user", nightWear: "user" },
    legacy: ["silk_satin_pillow"],
  })
})

test("F1: a confirmed night-page change keeps her confirmed technique", async (t) => {
  const pg = await memberWithConfirmedNight(t)
  const service = serviceOver(pg, directAcceptDraft())

  await walkTools(service, ["pillowcase", "bonnet"])
  const stored = await storedNight(pg)
  assert.deepEqual(stored.nightProtection, ["silk_satin_pillow", "silk_satin_bonnet", "loose_tied"])
  assert.equal(stored.fields.nightProtection, "user")
  assert.deepEqual(stored.legacy, ["silk_satin_pillow", "silk_satin_bonnet", "loose_tied"])
})

test("F1: without a confirmed night list the merged list is assumed and still carries her technique", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await insertProfile(pg, USER)
  const service = serviceOver(pg, directAcceptDraft(null))

  await walkHabits(service, "pineapple")
  const stored = await storedNight(pg)
  assert.deepEqual(stored.nightProtection, ["pineapple"])
  assert.equal(stored.nightWear, "pineapple")
  assert.deepEqual(stored.fields, { nightProtection: "assumed", nightWear: "user" })
})
