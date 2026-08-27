import assert from "node:assert/strict"
import test from "node:test"

import { createRefinementPresentationRouteHandlers } from "@/app/api/personal-plan/refinement-presentation/route"
import { createSupabaseStage2RefinementPersistence } from "@/lib/personal-plan/persistence/stage2-refinement-supabase"
import { STAGE2_QUESTION_PATH_VERSION } from "@/lib/personal-plan/refinement/types"

const ids = {
  user: "11111111-1111-4111-8111-111111111111",
  plan: "22222222-2222-4222-8222-222222222222",
  refined: "44444444-4444-4444-8444-444444444444",
  initial: "55555555-5555-4555-8555-555555555555",
}

type Row = Record<string, unknown>

/** The columns `mapDraft` reads back, filled from whatever was inserted. */
function draftRow(overrides: Row = {}): Row {
  return {
    id: "draft-1",
    personal_plan_id: ids.plan,
    base_initial_need_version_id: ids.initial,
    schema_version: 1,
    answers: {},
    completed_question_ids: [],
    revision: 0,
    status: "in_progress",
    result_refined_need_version_id: null,
    ...overrides,
  }
}

/**
 * Minimal Supabase-shaped stub. `existingDraft` decides whether `loadOrCreate`
 * finds a row or inserts one; every insert payload is recorded.
 */
function stage2Client(input: { existingDraft: Row | null; inserts: Row[] }) {
  return {
    from(table: string) {
      let pendingInsert: Row | null = null
      const query: Record<string, unknown> = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => query,
        insert(values: Row) {
          pendingInsert = values
          input.inserts.push(values)
          return query
        },
        async maybeSingle() {
          if (table === "personal_plans") {
            return {
              data: { id: ids.plan, current_initial_need_version_id: ids.initial },
              error: null,
            }
          }
          if (table === "personal_plan_need_versions") {
            return {
              data: {
                id: ids.initial,
                prepared_artifact_source_id: "artifact-1",
                stage1_source_lead_id: null,
                input_snapshot: {},
                output_snapshot: {
                  decisions: [],
                  renderedOrder: [],
                  profile: { scalp: { concerns: [] } },
                },
              },
              error: null,
            }
          }
          if (table === "personal_plan_refinement_drafts") {
            return { data: input.existingDraft, error: null }
          }
          return { data: null, error: null }
        },
        async single() {
          if (pendingInsert) {
            return { data: draftRow(pendingInsert as Row), error: null }
          }
          return { data: input.existingDraft, error: null }
        },
      }
      return query
    },
  }
}

test("a new Stage 2 draft persists at the current question-path version", async () => {
  const inserts: Row[] = []
  const persistence = createSupabaseStage2RefinementPersistence(
    stage2Client({ existingDraft: null, inserts }) as never,
  )
  const draft = await persistence.loadOrCreate(ids.user)

  const insert = inserts.find((row) => "schema_version" in row)
  assert.ok(insert, "loadOrCreate must insert a draft")
  assert.equal(
    insert.schema_version,
    STAGE2_QUESTION_PATH_VERSION,
    "D8: the persisted version must follow the path version, not a frozen literal",
  )
  assert.equal(draft.schemaVersion, STAGE2_QUESTION_PATH_VERSION)
  assert.equal(draft.pathVersion, `stage2-v${STAGE2_QUESTION_PATH_VERSION}`)
})

test("an existing v1 row still loads and keeps its own derived path version", async () => {
  const persistence = createSupabaseStage2RefinementPersistence(
    stage2Client({
      existingDraft: draftRow({ schema_version: 1, status: "complete" }),
      inserts: [],
    }) as never,
  )
  const draft = await persistence.loadExisting(ids.user)
  assert.ok(draft)
  assert.equal(
    draft.schemaVersion,
    1,
    "completed rows validate against their completion-time contract",
  )
  assert.equal(draft.pathVersion, "stage2-v1")
})

/**
 * Finding 4: `/api/personal-plan/refinement-presentation` cast the stored draft
 * JSON straight into the answers type, so it could hand `/profile` the legacy
 * `toolSections` key and the `R1`-forbidden diffuser `protectionConsistency`.
 */
function presentationClient(answers: unknown) {
  return {
    from(table: string) {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => query,
        async maybeSingle() {
          if (table === "personal_plans") {
            return {
              data: {
                id: ids.plan,
                user_id: ids.user,
                revision: 1,
                source_revision: 1,
                current_refined_need_version_id: ids.refined,
                active_routine_version_id: null,
                pending_routine_proposal_id: null,
              },
              error: null,
            }
          }
          if (table === "personal_plan_refinement_drafts") {
            return {
              data: {
                id: "draft-legacy",
                personal_plan_id: ids.plan,
                status: "complete",
                result_refined_need_version_id: ids.refined,
                answers,
                completed_question_ids: ["tools_overview"],
                updated_at: "2026-08-23T00:00:00.000Z",
              },
              error: null,
            }
          }
          return { data: null, error: null }
        },
      }
      return query
    },
  }
}

test("the refinement-presentation route decodes a legacy answers payload", async () => {
  const response = await createRefinementPresentationRouteHandlers({
    getUserId: async () => ids.user,
    client: () =>
      presentationClient({
        toolSections: ["brushes_combs"],
        heatEvents: {
          "heat:diffuser_airflow_shaping": {
            frequency: "weekly_2x",
            protectionConsistency: "always",
          },
        },
      }) as never,
  }).GET()
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal("toolSections" in body.answers, false, "the legacy key never leaves the boundary")
  assert.deepEqual(body.answers.toolFamiliesWithSomething, ["brushes_combs"])
  assert.equal(
    "protectionConsistency" in body.answers.heatEvents["heat:diffuser_airflow_shaping"],
    false,
    "R1: the diffuser source's stored protection value is dropped on read",
  )
  assert.equal(body.answers.heatEvents["heat:diffuser_airflow_shaping"].frequency, "weekly_2x")
})

test("the refinement-presentation route leaves a current answers payload alone", async () => {
  const response = await createRefinementPresentationRouteHandlers({
    getUserId: async () => ids.user,
    client: () =>
      presentationClient({
        toolFamiliesWithSomething: ["brushes_combs"],
        towel: { material: "frottee", technique: "gentle_press" },
      }) as never,
  }).GET()
  const body = await response.json()
  assert.deepEqual(body.answers, {
    toolFamiliesWithSomething: ["brushes_combs"],
    towel: { material: "frottee", technique: "gentle_press" },
  })
})
