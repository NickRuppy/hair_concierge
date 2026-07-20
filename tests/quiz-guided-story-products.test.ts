import assert from "node:assert/strict"
import test from "node:test"

import {
  buildGuidedStoryProductCards,
  deriveGuidedStoryNeedProfile,
} from "../src/lib/quiz/guided-story-products"
import type { GuidedStoryPriority } from "../src/lib/quiz/guided-story-priorities"
import type { QuizAnswers } from "../src/lib/quiz/types"

type Evidence = Pick<
  GuidedStoryPriority,
  "family" | "tier" | "matchedConcerns" | "matchedGoals" | "isFallback"
>

function priority(
  family: Evidence["family"],
  tier: Evidence["tier"],
  matchedConcerns: Evidence["matchedConcerns"] = [],
  matchedGoals: Evidence["matchedGoals"] = [],
  isFallback = false,
): Evidence {
  return { family, tier, matchedConcerns, matchedGoals, ...(isFallback ? { isFallback } : {}) }
}

const base: QuizAnswers = {
  structure: "straight",
  thickness: "normal",
  density: "medium",
  scalp_type: "ausgeglichen",
  concerns: [],
  treatment: ["natur"],
}

test("derives every shampoo route and thickness, including the neutral coarse-oily fallback", () => {
  const routes: Array<[QuizAnswers, string]> = [
    [{ scalp_condition: "schuppen", has_scalp_issue: true }, "dandruff"],
    [{ scalp_condition: "gereizt", has_scalp_issue: true }, "irritated"],
    [{ scalp_condition: "trockene_schuppen", has_scalp_issue: true }, "dry"],
    [{ scalp_type: "fettig" }, "oily"],
    [{ scalp_type: "trocken" }, "dry"],
    [{ scalp_type: "ausgeglichen" }, "balanced"],
  ]
  for (const [routeAnswers, route] of routes) {
    for (const thickness of ["fine", "normal", "coarse"] as const) {
      const needs = deriveGuidedStoryNeedProfile({ ...base, ...routeAnswers, thickness }, [])
      assert.equal(needs.shampoo.scalpRoute, route)
      assert.equal(needs.shampoo.thickness, thickness)
      assert.ok(buildGuidedStoryProductCards({ ...base, ...routeAnswers, thickness }, [])[0]?.name)
    }
  }
  const coarseOily = buildGuidedStoryProductCards(
    { ...base, scalp_type: "fettig", thickness: "coarse" },
    [],
  )
  assert.equal(coarseOily[0]?.key, "sh-oily-coarse-neutral")
})

test("preserves direct conditioner balance from the pull test", () => {
  assert.equal(
    deriveGuidedStoryNeedProfile({ ...base, pulltest: "stretches_stays" }, []).conditioner.balance,
    "protein",
  )
  assert.equal(
    deriveGuidedStoryNeedProfile({ ...base, pulltest: "snaps" }, []).conditioner.balance,
    "moisture",
  )
  assert.equal(
    deriveGuidedStoryNeedProfile({ ...base, pulltest: "stretches_bounces" }, []).conditioner
      .balance,
    "balanced",
  )
})

test("does not add a mask from the pull test alone or unrelated priorities", () => {
  const needs = deriveGuidedStoryNeedProfile(
    { ...base, pulltest: "stretches_stays", scalp_condition: "schuppen", has_scalp_issue: true },
    [priority("scalp_flakes", 1)],
  )
  assert.equal(needs.extra, null)
})

test("bond care wins for Tier-1 damage plus chemical treatment", () => {
  const needs = deriveGuidedStoryNeedProfile(
    { ...base, pulltest: "stretches_stays", concerns: ["breakage"], treatment: ["blondiert"] },
    [priority("strength_damage", 1, ["breakage"], ["anti_breakage"])],
  )
  assert.equal(needs.extra?.category, "bondbuilder")
})

test("matching priorities unlock protein and moisture masks", () => {
  const protein = deriveGuidedStoryNeedProfile(
    { ...base, pulltest: "stretches_stays", concerns: ["hair_damage"] },
    [priority("strength_damage", 2, ["hair_damage"])],
  )
  assert.equal(protein.extra?.category, "protein_mask")
  assert.deepEqual(protein.extra?.cadence, {
    label: "Gelegentlich",
    qualifier: "Rhythmus nach Produktangabe",
  })

  const moisture = deriveGuidedStoryNeedProfile(
    { ...base, pulltest: "snaps", concerns: ["dryness"] },
    [priority("moisture_dryness", 2, ["dryness"])],
  )
  assert.equal(moisture.extra?.category, "moisture_mask")
  assert.deepEqual(moisture.extra?.cadence, {
    label: "Gelegentlich",
    qualifier: "Rhythmus nach Produktangabe",
  })
})

test("rough surface unlocks a complementary leave-in and texture chooses its variant", () => {
  const wavy = deriveGuidedStoryNeedProfile(
    { ...base, structure: "wavy", fingertest: "rau", pulltest: "snaps", concerns: ["dryness"] },
    [priority("moisture_dryness", 2, ["dryness"])],
  )
  assert.equal(wavy.extra?.category, "leave_in")
  assert.equal(wavy.extra?.variant, "curl")
  assert.equal(
    deriveGuidedStoryNeedProfile({ ...base, structure: "curly", fingertest: "rau" }, []).extra
      ?.variant,
    "curl",
  )
  assert.equal(
    deriveGuidedStoryNeedProfile({ ...base, structure: undefined, concerns: ["frizz"] }, [
      priority("surface_manageability", 2, ["frizz"]),
    ]).extra?.variant,
    "general",
  )
})

test("oil requires an ends priority; shine alone does not create it", () => {
  assert.equal(
    deriveGuidedStoryNeedProfile({ ...base, goals: ["shine"] }, [
      priority("surface_manageability", 3, [], ["shine"]),
    ]).extra,
    null,
  )
  assert.equal(
    deriveGuidedStoryNeedProfile({ ...base, concerns: ["split_ends"], goals: ["shine"] }, [
      priority("ends_protection", 2, ["split_ends"], ["shine"]),
    ]).extra?.category,
    "oil",
  )
})

test("returns two cards when no truthful extra exists and three when one does", () => {
  assert.equal(buildGuidedStoryProductCards(base, []).length, 2)
  assert.equal(
    buildGuidedStoryProductCards({ ...base, concerns: ["frizz"] }, [
      priority("surface_manageability", 2, ["frizz"]),
    ]).length,
    3,
  )
})

test("incomplete profiles keep fallback priorities out of the targeted-product decision", () => {
  const fallbackPriorities = [
    priority("scalp_comfort", "positive", [], [], true),
    priority("surface_manageability", "positive", [], ["shine"], true),
    priority("strength_damage", "positive", [], ["healthier_hair"], true),
  ]
  const needs = deriveGuidedStoryNeedProfile({}, fallbackPriorities)

  assert.equal(needs.extra, null)
  assert.deepEqual(
    buildGuidedStoryProductCards({}, fallbackPriorities).map((card) => card.category),
    ["shampoo", "conditioner"],
  )
})
