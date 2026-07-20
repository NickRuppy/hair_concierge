import assert from "node:assert/strict"
import test from "node:test"

import { buildQuizGuidedStoryPreview } from "../src/lib/quiz/guided-story-preview"

test("builds one canonical analysis, routine, and analytics preview", () => {
  const preview = buildQuizGuidedStoryPreview({
    structure: "wavy",
    thickness: "normal",
    density: "medium",
    hair_length: "long",
    fingertest: "rau",
    pulltest: "snaps",
    scalp_type: "trocken",
    has_scalp_issue: false,
    concerns: ["breakage", "dryness", "frizz"],
    treatment: ["blondiert"],
    goals: ["anti_breakage", "moisture", "less_frizz"],
  })

  assert.equal(preview.priorities.length, 3)
  assert.equal(preview.priorities[0]?.family, "strength_damage")
  assert.equal(preview.needs.conditioner.balance, "moisture")
  assert.equal(preview.needs.extra?.category, "bondbuilder")
  assert.deepEqual(
    preview.products.map((product) => product.category),
    ["shampoo", "conditioner", "bondbuilder"],
  )
  assert.deepEqual(preview.analytics, {
    needLane: "strength_damage",
    shampooModuleId: preview.products[0]?.key,
    conditionerModuleId: preview.products[1]?.key,
    suggestedCategory: "bondbuilder",
  })
})

test("incomplete legacy answers keep three honest insights and a two-product foundation", () => {
  const preview = buildQuizGuidedStoryPreview({ concerns_other_text: "nicht klassifizieren" })

  assert.equal(preview.priorities.length, 3)
  assert.ok(preview.priorities.every((priority) => priority.isFallback))
  assert.equal(preview.needs.extra, null)
  assert.deepEqual(
    preview.products.map((product) => product.category),
    ["shampoo", "conditioner"],
  )
  assert.equal(preview.analytics.needLane, "positive_foundation")
  assert.equal(preview.analytics.suggestedCategory, null)
})

test("rough surface keeps the approved leave-in complement ahead of a moisture mask", () => {
  for (const structure of ["straight", "wavy"] as const) {
    const preview = buildQuizGuidedStoryPreview({
      structure,
      thickness: "normal",
      density: "medium",
      fingertest: "rau",
      pulltest: "snaps",
      scalp_type: "ausgeglichen",
      concerns: ["dryness"],
      treatment: ["natur"],
      goals: ["moisture"],
    })

    assert.equal(preview.needs.extra?.category, "leave_in")
    assert.equal(preview.products[2]?.category, "leave_in")
    assert.equal(preview.analytics.suggestedCategory, "leave_in")
  }
})

test("the scoped preview does not mutate legacy preview behavior", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../src/lib/quiz/guided-story-preview.ts", import.meta.url), "utf8"),
  )

  assert.doesNotMatch(source, /deriveOfferPreviewNeedProfile|resolveQuizNeed|buildQuizOfferPreview/)
})
