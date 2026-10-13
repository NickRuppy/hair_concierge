import assert from "node:assert/strict"
import test from "node:test"

import { buildDirectAcceptanceStage2Defaults } from "../src/lib/personal-plan/direct-acceptance/defaults"
import {
  createStage2RefinementService,
  type LoadStoredCareHabits,
  type SaveCareHabitsFacts,
  type Stage2PersistedDraft,
} from "../src/lib/personal-plan/persistence/stage2-refinement-service"
import { Stage2RefinementError } from "../src/lib/personal-plan/refinement/gateway"
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
  createInitialNeed,
  id,
  insertOpenRefinementDraft,
  insertProfile,
  migratedPersonalPlanDatabase,
  readHairProfile,
  saveUserFacts,
  type PersonalPlanTestDb,
} from "./personal-plan-pglite-migration.fixtures"

/**
 * Rev. 6 review fix F1 (2026-10-12), over the REAL `user_facts_save_v1` (migrated PGlite chain)
 * with a REAL draft row, so every facts write carries the production draft binding: a member who
 * accepted the plan directly (the tools night page is assumed) changes „Nachts". Her `nightWear`
 * answer is hers, so the stored `nightProtection` list must follow its technique — while the
 * night THINGS stay what she confirmed, never the draft's assumption. Round 2: the stored list is
 * read only when the merge needs it, a failed read is recoverable, and the write is bound to the
 * facts revision it read.
 */

const USER = id(1, 1)
const DRAFT = id(3, 3)

const ON_MEDIUM: Stage2TriggerContext = {
  relevantCategories: ["shampoo", "conditioner"],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible",
  toolsEnabled: true,
  hairLength: "medium",
}

type Member = { pg: PersonalPlanTestDb; initialVersionId: string; planId: string }

async function confirmNight(pg: PersonalPlanTestDb, nightProtection: NightProtection[]) {
  const saved = await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { nightProtection },
    provenance: {
      source: { kind: "legacy_columns" },
      schemaVersion: 1,
      at: "2026-10-01T08:00:00.000Z",
      fields: { nightProtection: "user" },
    },
  })
  assert.equal(saved.status, "ok")
}

/** A member with an open Feinschliff draft row (revision 0), optionally with a confirmed night list. */
async function member(
  t: { after: (fn: () => Promise<void>) => void },
  confirmed: NightProtection[] | null = ["silk_satin_pillow", "loose_tied"],
): Promise<Member> {
  const pg = await migratedPersonalPlanDatabase(t)
  await insertProfile(pg, USER)
  if (confirmed) await confirmNight(pg, confirmed)
  const initial = await createInitialNeed(pg, { userId: USER, inputHash: "a".repeat(64) })
  await insertOpenRefinementDraft(pg, {
    draftId: DRAFT,
    userId: USER,
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial.needVersionId,
  })
  return { pg, initialVersionId: initial.needVersionId, planId: initial.personalPlanId }
}

/** The direct-acceptance answers, every one assumed, the known night answer kept. */
function directAcceptDraft(
  owner: Member,
  known: NightProtection[] | null = ["silk_satin_pillow", "loose_tied"],
): Stage2PersistedDraft {
  const defaults = buildDirectAcceptanceStage2Defaults(
    ON_MEDIUM,
    known
      ? { answers: { nightProtection: known }, questionIds: ["night_protection"] }
      : { answers: {}, questionIds: [] },
  )
  return {
    id: DRAFT,
    personalPlanId: owner.planId,
    baseInitialNeedVersionId: owner.initialVersionId,
    schemaVersion: 1,
    pathVersion: "stage2-v1",
    preparedArtifactSourceId: "artifact-1",
    baseInputSnapshot: {},
    triggerContext: ON_MEDIUM,
    answers: defaults.answers,
    completedQuestionIds: defaults.completedQuestionIds,
    answerProvenance: defaults.answerProvenance,
    moduleProjections: {},
    revision: 0,
    status: "in_progress",
    refinedVersionId: null,
  }
}

/** The production loader's shape over PGlite: care_habits, field provenance, facts revision. */
function pgliteLoader(pg: PersonalPlanTestDb): LoadStoredCareHabits {
  return async () => {
    const row = await readHairProfile(pg, USER)
    if (!row) return null
    const provenance = row.facts_provenance as
      | { care_habits?: { fields?: Record<string, FieldProvenanceValue> } }
      | undefined
    return {
      careHabits: (row.care_habits ?? null) as Partial<CareHabitsV1> | null,
      fields: provenance?.care_habits?.fields,
      revision: Number((row as { facts_revision?: unknown }).facts_revision),
    }
  }
}

function serviceOver(
  owner: Member,
  initial: Stage2PersistedDraft,
  options: { loadStoredCareHabits?: LoadStoredCareHabits } = {},
) {
  const { pg } = owner
  let stored = structuredClone(initial)
  const factsWrites: Parameters<SaveCareHabitsFacts>[0][] = []
  const service = createStage2RefinementService({
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
      reopen: async () => {
        throw new Error("the draft is in progress")
      },
      save: async (input) => {
        stored = {
          ...input.draft,
          answers: input.answers,
          completedQuestionIds: input.completedQuestionIds,
          answerProvenance: input.answerProvenance,
          revision: input.expectedRevision + 1,
        }
        // The real row follows, so the facts write's draft binding is checked for real.
        await pg.query(
          "UPDATE public.personal_plan_refinement_drafts SET revision = $1 WHERE id = $2",
          [stored.revision, DRAFT],
        )
        return { outcome: "saved", revision: stored.revision }
      },
      complete: async () => {
        throw new Error("a single module does not close this draft")
      },
      completeModule: async ({ module }) => ({
        outcome: "completed",
        refinedVersionId: `refined-${module}`,
        stage3Handoff: false,
      }),
    },
    saveFacts: async (input) => {
      factsWrites.push(structuredClone(input))
      return (await saveUserFacts(pg, {
        userId: input.userId,
        domain: input.domain,
        patch: input.patch,
        provenance: input.provenance,
        expectedRevision: input.expectedRevision ?? null,
        sourceDraftId: input.draftBinding?.sourceDraftId ?? null,
        expectedDraftRevision: input.draftBinding?.expectedDraftRevision ?? null,
        expectedInitialVersionId: input.draftBinding?.expectedInitialVersionId ?? null,
      })) as SaveUserFactsResult
    },
    loadStoredCareHabits: options.loadStoredCareHabits ?? pgliteLoader(pg),
  })
  return { service, factsWrites }
}

type Service = ReturnType<typeof serviceOver>["service"]

/** Walks the Gewohnheiten edit visit (every question confirmed), „Nachts" = `nightWear`. */
async function walkHabits(service: Service, nightWear: NightWear): Promise<void> {
  await completeHabits(service, await answerHabits(service, nightWear))
}

async function answerHabits(service: Service, nightWear: NightWear): Promise<number> {
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
  return session.revision
}

async function completeHabits(service: Service, revision: number): Promise<void> {
  const completion = await service.completeModule({ module: "habits", expectedRevision: revision })
  assert.equal(completion.status, "in_progress", "tools stay assumed, so habits does not close")
}

/** Walks the Deine Tools edit visit, every page confirmed as it is, the night page = `night`. */
async function walkTools(service: Service, night: string[]): Promise<void> {
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
  const owner = await member(t)
  const { pg } = owner
  const { service, factsWrites } = serviceOver(owner, directAcceptDraft(owner))

  await walkHabits(service, "pineapple")
  assert.equal(typeof factsWrites.at(-1)?.expectedRevision, "number", "bound to the read")
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
  const owner = await member(t)
  const { pg } = owner
  const { service } = serviceOver(owner, directAcceptDraft(owner))

  await walkTools(service, ["pillowcase", "bonnet"])
  const stored = await storedNight(pg)
  assert.deepEqual(stored.nightProtection, ["silk_satin_pillow", "silk_satin_bonnet", "loose_tied"])
  assert.equal(stored.fields.nightProtection, "user")
  assert.deepEqual(stored.legacy, ["silk_satin_pillow", "silk_satin_bonnet", "loose_tied"])
})

test("F1: without a confirmed night list the merged list is assumed and still carries her technique", async (t) => {
  const owner = await member(t, null)
  const { pg } = owner
  const { service, factsWrites } = serviceOver(owner, directAcceptDraft(owner, null))

  await walkHabits(service, "pineapple")
  assert.equal("expectedRevision" in factsWrites.at(-1)!, false, "an absence binds nothing")
  const stored = await storedNight(pg)
  assert.deepEqual(stored.nightProtection, ["pineapple"])
  assert.equal(stored.nightWear, "pineapple")
  assert.deepEqual(stored.fields, { nightProtection: "assumed", nightWear: "user" })
})

/* ── round 2: read only when needed, fail recoverably, bind the write to the read ── */

test("round 2: a newer confirmed edit between the read and the write is a facts conflict, never lost", async (t) => {
  const owner = await member(t)
  const { pg } = owner
  const read = pgliteLoader(pg)
  let interleave = true
  const { service } = serviceOver(owner, directAcceptDraft(owner), {
    loadStoredCareHabits: async () => {
      const seen = await read()
      if (interleave) {
        interleave = false
        // Another surface confirms a newer night list after this read.
        await confirmNight(pg, ["silk_satin_bonnet", "loose_tied"])
      }
      return seen
    },
  })

  const revision = await answerHabits(service, "pineapple")
  await assert.rejects(
    service.completeModule({ module: "habits", expectedRevision: revision }),
    (error: unknown) =>
      error instanceof Stage2RefinementError &&
      error.code === "revision_conflict" &&
      error.detail?.source === "facts",
  )
  assert.deepEqual((await storedNight(pg)).nightProtection, ["silk_satin_bonnet", "loose_tied"])

  // The member reloads; the retry reads the newer list and puts her technique onto it.
  await completeHabits(service, revision)
  const stored = await storedNight(pg)
  assert.deepEqual(stored.nightProtection, ["silk_satin_bonnet", "pineapple"])
  assert.equal(stored.fields.nightProtection, "user")
  assert.deepEqual(stored.legacy, ["silk_satin_bonnet", "pineapple"])
})

test("round 2: a failed read stops the completion recoverably and writes nothing", async (t) => {
  const owner = await member(t)
  const { pg } = owner
  const read = pgliteLoader(pg)
  let fail = true
  const { service, factsWrites } = serviceOver(owner, directAcceptDraft(owner), {
    loadStoredCareHabits: async () => {
      if (fail) throw new Error("facts read failed")
      return read()
    },
  })

  const revision = await answerHabits(service, "pineapple")
  const before = await readHairProfile(pg, USER)
  await assert.rejects(
    service.completeModule({ module: "habits", expectedRevision: revision }),
    (error: unknown) =>
      error instanceof Stage2RefinementError && error.code === "temporarily_unavailable",
  )
  assert.equal(factsWrites.length, 0)
  assert.deepEqual(await readHairProfile(pg, USER), before)

  fail = false
  await completeHabits(service, revision)
  assert.deepEqual((await storedNight(pg)).nightProtection, ["silk_satin_pillow", "pineapple"])
})

test("round 2: a completion whose night parts share a provenance reads no stored facts", async (t) => {
  const owner = await member(t)
  const { pg } = owner
  let reads = 0
  const read = pgliteLoader(pg)
  const { service, factsWrites } = serviceOver(owner, directAcceptDraft(owner), {
    loadStoredCareHabits: async () => {
      reads += 1
      return read()
    },
  })

  // Produkte: the night page and „Nachts" both stay assumed.
  let session = await service.load()
  for (const questionId of ["current_product_categories", "wet_wash_frequency"] as const) {
    session = await service.saveAnswer({
      questionId,
      answer:
        questionId === "current_product_categories"
          ? session.answers.currentProductCategories
          : session.answers.wetWashFrequency,
      expectedRevision: session.revision,
    })
  }
  await service.completeModule({ module: "products", expectedRevision: session.revision })
  assert.equal(reads, 0)
  assert.equal(factsWrites.length, 1)
  assert.equal("expectedRevision" in factsWrites[0]!, false)
  assert.deepEqual((await storedNight(pg)).nightProtection, ["silk_satin_pillow", "loose_tied"])
})
