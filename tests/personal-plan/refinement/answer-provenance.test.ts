import assert from "node:assert/strict"
import test from "node:test"

import {
  applyUserAnswerProvenance,
  buildAssumedAnswerProvenance,
  effectiveAnsweredQuestionIds,
  pruneAnswerProvenance,
  userAnsweredQuestionIds,
} from "@/lib/personal-plan/refinement/answer-provenance"
import type { Stage2AnswerProvenance, Stage2QuestionId } from "@/lib/personal-plan/refinement/types"

/* ── buildAssumedAnswerProvenance: the direct-acceptance synthetic write ── */

test("buildAssumedAnswerProvenance marks every given id assumed", () => {
  const ids: Stage2QuestionId[] = ["current_product_categories", "wet_wash_frequency"]
  assert.deepEqual(buildAssumedAnswerProvenance(ids), {
    current_product_categories: "assumed",
    wet_wash_frequency: "assumed",
  })
})

test("buildAssumedAnswerProvenance returns an empty map for an empty id list", () => {
  assert.deepEqual(buildAssumedAnswerProvenance([]), {})
})

/* ── pruneAnswerProvenance: dropped ids lose their provenance entry ── */

test("pruneAnswerProvenance drops entries whose id is no longer completed", () => {
  const provenance: Stage2AnswerProvenance = {
    current_product_categories: "user",
    dry_shampoo_visible_hair_color: "assumed",
  }
  const pruned = pruneAnswerProvenance(provenance, ["current_product_categories"])
  assert.deepEqual(pruned, { current_product_categories: "user" })
})

test("pruneAnswerProvenance keeps every entry still in the completed set", () => {
  const provenance: Stage2AnswerProvenance = {
    current_product_categories: "user",
    wet_wash_frequency: "assumed",
  }
  const pruned = pruneAnswerProvenance(provenance, [
    "current_product_categories",
    "wet_wash_frequency",
  ])
  assert.deepEqual(pruned, provenance)
})

/* ── applyUserAnswerProvenance: the normal Stage-2 saveAnswer write ── */

test("applyUserAnswerProvenance marks the newly answered id user", () => {
  const next = applyUserAnswerProvenance({
    previous: {},
    answeredQuestionId: "current_product_categories",
    completedQuestionIds: ["current_product_categories"],
  })
  assert.deepEqual(next, { current_product_categories: "user" })
})

test("applyUserAnswerProvenance flips an existing assumed answer to user when the user re-answers it", () => {
  const next = applyUserAnswerProvenance({
    previous: { wet_wash_frequency: "assumed" },
    answeredQuestionId: "wet_wash_frequency",
    completedQuestionIds: ["wet_wash_frequency"],
  })
  assert.deepEqual(next, { wet_wash_frequency: "user" })
})

test("applyUserAnswerProvenance preserves other untouched entries", () => {
  const next = applyUserAnswerProvenance({
    previous: { current_product_categories: "assumed" },
    answeredQuestionId: "wet_wash_frequency",
    completedQuestionIds: ["current_product_categories", "wet_wash_frequency"],
  })
  assert.deepEqual(next, {
    current_product_categories: "assumed",
    wet_wash_frequency: "user",
  })
})

test("applyUserAnswerProvenance prunes entries a path change dropped from completedQuestionIds", () => {
  const next = applyUserAnswerProvenance({
    previous: {
      current_product_categories: "assumed",
      dry_shampoo_visible_hair_color: "assumed",
    },
    answeredQuestionId: "current_product_categories",
    // Answering current_product_categories without dry_shampoo dropped the
    // now-inapplicable dry_shampoo_visible_hair_color from the path.
    completedQuestionIds: ["current_product_categories"],
  })
  assert.deepEqual(next, { current_product_categories: "user" })
})

/* ── userAnsweredQuestionIds: the progress/module-status read path ── */

test("userAnsweredQuestionIds keeps only ids explicitly marked user", () => {
  const provenance: Stage2AnswerProvenance = {
    current_product_categories: "user",
    wet_wash_frequency: "assumed",
  }
  assert.deepEqual(
    userAnsweredQuestionIds(["current_product_categories", "wet_wash_frequency"], provenance),
    ["current_product_categories"],
  )
})

test("userAnsweredQuestionIds treats a completed id with no provenance entry as user (legacy default)", () => {
  assert.deepEqual(userAnsweredQuestionIds(["current_product_categories"], {}), [
    "current_product_categories",
  ])
})

test("userAnsweredQuestionIds returns an empty list when everything is assumed", () => {
  const provenance: Stage2AnswerProvenance = {
    current_product_categories: "assumed",
    wet_wash_frequency: "assumed",
  }
  assert.deepEqual(
    userAnsweredQuestionIds(["current_product_categories", "wet_wash_frequency"], provenance),
    [],
  )
})

/* ── effectiveAnsweredQuestionIds: the projection-completeness read path ── */

test("effectiveAnsweredQuestionIds is the full completed set regardless of provenance", () => {
  assert.deepEqual(
    effectiveAnsweredQuestionIds(["current_product_categories", "wet_wash_frequency"]),
    ["current_product_categories", "wet_wash_frequency"],
  )
})

test("effectiveAnsweredQuestionIds is empty when nothing is completed", () => {
  assert.deepEqual(effectiveAnsweredQuestionIds([]), [])
})
