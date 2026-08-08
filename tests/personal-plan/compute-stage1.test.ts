import assert from "node:assert/strict"
import test from "node:test"

import { computeNeedPlan } from "../../src/lib/personal-plan/compute-stage1"
import type { PersonalPlanQuizSubmissionEnvelope } from "../../src/lib/personal-plan-quiz/types"
import { canonicalizeInitialSnapshotPayload } from "../../src/lib/personal-plan/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./fixtures"

const neutralEnvelope: PersonalPlanQuizSubmissionEnvelope = {
  ...COMPLETE_V3_PLAN_ENVELOPE,
  answers: {
    ...COMPLETE_V3_PLAN_ENVELOPE.answers,
    texture: "straight",
    thickness: "normal",
    density: "medium",
    goals: ["scalp_balance"],
    currentConcerns: [],
    concernRecurrence: undefined,
    hairLength: "medium",
    hairSurface: "smooth",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
    scalpOiliness: "balanced",
    scalpConcerns: [],
  },
}

test("INITIAL-01 and INITIAL-10: quiz-only computation is ready and omits an empty Optional page", () => {
  const result = computeNeedPlan({
    rawEnvelope: neutralEnvelope,
    artifactId: "55555555-5555-4555-8555-555555555555",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-07T12:00:00.000Z",
  })

  assert.equal(result.status, "ready")
  if (result.status !== "ready") return
  assert.equal(result.snapshot.decisions.length, 10)
  assert.deepEqual(result.snapshot.renderedOrder, ["shampoo", "conditioner"])
  assert.equal(result.snapshot.productPreviews.length, 0)
  assert.ok(result.snapshot.deferredFacts.includes("heat_tool_use"))
  assert.ok(result.snapshot.deferredFacts.includes("current_product_load"))
})

test("canonical quiz-only computation is byte-stable apart from createdAt", () => {
  const common = {
    rawEnvelope: neutralEnvelope,
    artifactId: "66666666-6666-4666-8666-666666666666",
    projection: "initial_quiz" as const,
    computationVersion: "stage1-v1",
  }
  const first = computeNeedPlan({ ...common, createdAt: "2026-08-07T12:00:00.000Z" })
  const second = computeNeedPlan({ ...common, createdAt: "2026-08-08T12:00:00.000Z" })
  assert.equal(first.status, "ready")
  assert.equal(second.status, "ready")
  if (first.status !== "ready" || second.status !== "ready") return
  assert.deepEqual(
    canonicalizeInitialSnapshotPayload(first.snapshot),
    canonicalizeInitialSnapshotPayload(second.snapshot),
  )
})

test("unsupported or malformed paid input fails closed with a typed error", () => {
  assert.deepEqual(
    computeNeedPlan({
      rawEnvelope: { kind: "personal_plan", version: 9, answers: {} },
      artifactId: "77777777-7777-4777-8777-777777777777",
      projection: "initial_quiz",
      computationVersion: "stage1-v1",
      createdAt: "2026-08-07T12:00:00.000Z",
    }),
    {
      status: "incomplete_input",
      error: { code: "unsupported_quiz_version", quizVersion: 9 },
    },
  )
})

test("refined projection without Shampoo frequency returns a typed clarification", () => {
  assert.deepEqual(
    computeNeedPlan({
      rawEnvelope: neutralEnvelope,
      artifactId: "88888888-8888-4888-8888-888888888888",
      projection: "refined_post_plan",
      computationVersion: "stage1-v1",
      createdAt: "2026-08-07T12:00:00.000Z",
    }),
    { status: "needs_clarification", missingFacts: ["shampoo_frequency"] },
  )
})

test("shared presentation boundary keeps every category to at most two primary reasons", () => {
  const result = computeNeedPlan({
    rawEnvelope: {
      ...neutralEnvelope,
      answers: {
        ...neutralEnvelope.answers,
        hairSurface: "rough",
        currentConcerns: ["dry_lengths", "hair_damage", "breakage", "tangling"],
        chemicalTreatments: ["lightened"],
      },
    },
    artifactId: "99999999-9999-4999-8999-999999999999",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-07T12:00:00.000Z",
  })

  assert.equal(result.status, "ready")
  if (result.status !== "ready") return
  for (const decision of result.snapshot.decisions) {
    assert.ok(
      decision.reasons.filter((reason) => reason.salience === "primary").length <= 2,
      `${decision.category} exposes more than two primary reasons`,
    )
  }
})

test("refined projection does not defer a known Shampoo frequency", () => {
  const result = computeNeedPlan({
    rawEnvelope: neutralEnvelope,
    artifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    projection: "refined_post_plan",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-07T12:00:00.000Z",
    routine: {
      shampooFrequency: { state: "known", value: "weekly_2x" },
      heatToolUse: { state: "unknown", reason: "heat_tool_use" },
      dryShampooBridgePreference: {
        state: "unknown",
        reason: "dry_shampoo_bridge_preference",
      },
      scalpIrritationState: { state: "unknown", reason: "scalp_irritation_detail" },
    },
  })

  assert.equal(result.status, "ready")
  if (result.status !== "ready") return
  assert.ok(!result.snapshot.assessments.resetLoad.missingInputs.includes("shampoo_frequency"))
  assert.ok(!result.snapshot.deferredFacts.includes("shampoo_frequency"))
})
