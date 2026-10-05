import assert from "node:assert/strict"
import test from "node:test"

import type { PersonalPlanRebaseOnFactsParams } from "@/lib/personal-plan/facts-recompute/types"

import { refusalReason } from "../scripts/user-facts/plan-rebase-dry-run"

const HASH = "a".repeat(64)
const BASE: PersonalPlanRebaseOnFactsParams = {
  p_user_id: "user",
  p_personal_plan_id: "plan",
  p_expected_plan_revision: 1,
  p_expected_facts_revision: 1,
  p_initial_id: "initial",
  p_schema_version: 1,
  p_computation_version: "stage1-v1",
  p_initial_input_hash: HASH,
  p_initial_input_snapshot: {},
  p_initial_output_snapshot: {},
}
const CLONE = {
  p_source_draft_id: "draft",
  p_expected_draft_revision: 2,
  p_clone_answers: {},
  p_clone_completed_question_ids: [],
  p_clone_answer_provenance: {},
}
const REFINED = {
  p_care_habits_patch: {},
  p_care_habits_provenance: {},
  p_refined_schema_version: 1,
  p_refined_computation_version: "v",
  p_refined_input_hash: HASH,
  p_refined_input_snapshot: {},
  p_refined_output_snapshot: {},
}
const head = { currentRefinedNeedVersionId: "refined" }
const noHead = { currentRefinedNeedVersionId: null }

test("the dry run's refusal rules mirror the function's state-dependent invalid_source rules (W03)", () => {
  // Accepted shapes.
  assert.equal(
    refusalReason({
      plan: head,
      sourceDraft: { status: "in_progress" },
      params: { ...BASE, ...CLONE, ...REFINED },
    }),
    null,
  )
  assert.equal(
    refusalReason({
      plan: head,
      sourceDraft: { status: "complete" },
      params: { ...BASE, ...CLONE, ...REFINED },
    }),
    null,
  )
  assert.equal(
    refusalReason({
      plan: noHead,
      sourceDraft: { status: "in_progress" },
      params: { ...BASE, ...CLONE },
    }),
    null,
  )
  assert.equal(refusalReason({ plan: noHead, sourceDraft: null, params: BASE }), null)

  // Refused shapes, with the function's reason codes.
  assert.equal(
    refusalReason({ plan: head, sourceDraft: null, params: BASE }),
    "refined_parameters_required",
  )
  assert.equal(
    refusalReason({ plan: head, sourceDraft: null, params: { ...BASE, ...REFINED } }),
    "refined_head_without_draft",
  )
  assert.equal(
    refusalReason({
      plan: noHead,
      sourceDraft: { status: "in_progress" },
      params: { ...BASE, ...CLONE, ...REFINED },
    }),
    "refined_parameters_forbidden",
  )
  assert.equal(
    refusalReason({
      plan: head,
      sourceDraft: { status: "in_progress" },
      params: { ...BASE, ...REFINED },
    }),
    "clone_parameters_required",
  )
  assert.equal(
    refusalReason({ plan: noHead, sourceDraft: null, params: { ...BASE, ...CLONE } }),
    "clone_parameters_forbidden",
  )
  assert.equal(
    refusalReason({
      plan: noHead,
      sourceDraft: { status: "complete" },
      params: { ...BASE, ...CLONE },
    }),
    "complete_source_without_refined",
  )
  const {
    p_care_habits_patch: _patch,
    p_care_habits_provenance: _provenance,
    ...refinedOnly
  } = REFINED
  void _patch
  void _provenance
  assert.equal(
    refusalReason({
      plan: head,
      sourceDraft: { status: "in_progress" },
      params: { ...BASE, ...CLONE, ...refinedOnly },
    }),
    "care_habits_parameters_required",
  )
})
