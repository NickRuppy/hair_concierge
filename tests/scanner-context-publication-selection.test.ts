import assert from "node:assert/strict"
import test from "node:test"
import { prepareScannerContext, type ScannerSourceRead } from "../src/lib/scan/scanner-context"
import { hashPersonalPlanNeedVersionInput } from "../src/lib/personal-plan/persistence"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import { createRefinedNeedSnapshot } from "../src/lib/personal-plan/refinement/production-persistence-gateway"
import { deriveStage2TriggerContext } from "../src/lib/personal-plan/refinement/stage1-adapter"
import { resolveAssumedAnswers } from "../src/lib/personal-plan/refinement/assumed-defaults"
import { adaptPersonalPlanAnswersForOffer } from "../src/lib/personal-plan-quiz/offer-adapter"
import { buildProfileDataFromQuizAnswers } from "../src/lib/quiz/link-to-profile"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

/**
 * Facts rebase can return a plan to an earlier state (A -> B -> A): the refined version is reused,
 * so the historical draft on A and a newly cloned draft on A both name the same current refined
 * version. The scanner must pick the draft the refinement persistence would load (the in-progress
 * one, else the latest complete one; stale drafts never), not insist on exactly one match.
 */

const initialSource = COMPLETE_V3_PLAN_ENVELOPE
const computed = computeNeedPlan({
  rawEnvelope: initialSource,
  artifactId: "artifact",
  projection: "initial_quiz",
  computationVersion: "stage1-v1",
  createdAt: "2026-01-01T00:00:00Z",
})
if (computed.status !== "ready") throw new Error("fixture")
const initialSnapshot = computed.snapshot
const triggerContext = deriveStage2TriggerContext(initialSnapshot)
const resolved = resolveAssumedAnswers({
  triggerContext,
  answers: {
    wetWashFrequency: "weekly_3_4x",
    currentProductCategories: ["shampoo", "conditioner"],
  },
})
const refined = createRefinedNeedSnapshot({
  baseInitialNeedVersionId: "initial",
  preparedArtifactSourceId: "artifact",
  baseInputSnapshot: initialSource as never,
  triggerContext,
  answers: resolved.answers,
  completedQuestionIds: resolved.orderedQuestionIds,
  createdAt: initialSnapshot.createdAt,
})
const projected = adaptPersonalPlanAnswersForOffer(initialSource.answers).answers
const allUser = Object.fromEntries(resolved.orderedQuestionIds.map((id) => [id, "user"]))
const allAssumed = Object.fromEntries(resolved.orderedQuestionIds.map((id) => [id, "assumed"]))

type Draft = ScannerSourceRead["refinements"][number]
function draft(overrides: Partial<Draft>): Draft {
  return {
    base_initial_need_version_id: "initial",
    result_refined_need_version_id: null,
    revision: 1,
    status: "complete",
    updated_at: "2026-09-01T00:00:00Z",
    answers: resolved.answers,
    completed_question_ids: resolved.orderedQuestionIds,
    answer_provenance: allUser as never,
    ...overrides,
  }
}
const complete = (overrides: Partial<Draft> = {}) =>
  draft({ status: "complete", result_refined_need_version_id: "refined", ...overrides })
const projectsRefined = { products: { needVersionId: "refined", projectedAtRevision: 1 } }

function read(refinements: Draft[]): ScannerSourceRead {
  return {
    userId: "owner",
    sourceRevision: "1",
    profileRevision: "1",
    profile: { ...buildProfileDataFromQuizAnswers(projected), goals: projected.goals },
    plan: {
      id: "plan",
      current_initial_need_version_id: "initial",
      current_refined_need_version_id: "refined",
    },
    initial: {
      id: "initial",
      personal_plan_id: "plan",
      user_id: "owner",
      kind: "initial",
      input_snapshot: initialSource,
      output_snapshot: initialSnapshot,
      schema_version: 1,
      computation_version: "stage1-v1",
      input_hash: hashPersonalPlanNeedVersionInput({
        schemaVersion: 1,
        computationVersion: "stage1-v1",
        inputSnapshot: initialSource as never,
      }),
    },
    refined: {
      id: "refined",
      personal_plan_id: "plan",
      user_id: "owner",
      kind: "refined",
      input_snapshot: refined.inputSnapshot,
      output_snapshot: refined.outputSnapshot,
      schema_version: 1,
      computation_version: "stage1-v1",
      input_hash: refined.inputHash,
      parent_need_version_id: "initial",
    },
    refinements,
    leads: [],
  }
}

test("single complete match is unchanged (all answers user-provenance)", () => {
  const prepared = prepareScannerContext(read([complete()]))!
  assert.equal(prepared.snapshotSource, "refined")
  assert.ok(prepared.userRefinementQuestionIds.length > 0)
})

test("historical complete draft + new in-progress clone projecting the same version: in-progress is used", () => {
  const prepared = prepareScannerContext(
    read([
      complete({ answer_provenance: allAssumed as never }),
      draft({
        status: "in_progress",
        module_projections: projectsRefined,
        updated_at: "2026-09-02T00:00:00Z",
      }),
    ]),
  )!
  assert.equal(prepared.snapshotSource, "refined")
  // The in-progress clone carries user provenance; the historical draft would give none.
  assert.ok(prepared.userRefinementQuestionIds.length > 0)
})

test("historical stale draft projecting the version + new in-progress clone: builds from the clone", () => {
  const prepared = prepareScannerContext(
    read([
      draft({
        status: "stale",
        module_projections: projectsRefined,
        answer_provenance: allAssumed as never,
      }),
      draft({ status: "in_progress", module_projections: projectsRefined }),
    ]),
  )!
  assert.equal(prepared.snapshotSource, "refined")
  assert.ok(prepared.userRefinementQuestionIds.length > 0)
})

test("two complete drafts on the same refined version: the most recently updated one is used", () => {
  const older = complete({
    answer_provenance: allAssumed as never,
    updated_at: "2026-09-01T00:00:00Z",
  })
  const newer = complete({ updated_at: "2026-09-02T00:00:00Z" })
  for (const order of [
    [older, newer],
    [newer, older],
  ]) {
    assert.ok(prepareScannerContext(read(order))!.userRefinementQuestionIds.length > 0)
  }
  const flipped = [
    complete({ updated_at: "2026-09-01T00:00:00Z" }),
    complete({ answer_provenance: allAssumed as never, updated_at: "2026-09-02T00:00:00Z" }),
  ]
  assert.equal(prepareScannerContext(read(flipped))!.userRefinementQuestionIds.length, 0)
})

test("only stale matches stay unavailable", () => {
  assert.throws(
    () =>
      prepareScannerContext(
        read([
          draft({ status: "stale", module_projections: projectsRefined }),
          draft({ status: "stale", module_projections: projectsRefined }),
        ]),
      ),
    /scan_profile_context_unavailable/,
  )
  assert.throws(
    () =>
      prepareScannerContext(
        read([draft({ status: "stale", module_projections: projectsRefined })]),
      ),
    /scan_profile_context_unavailable/,
  )
})
