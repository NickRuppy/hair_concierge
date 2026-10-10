import assert from "node:assert/strict"
import test from "node:test"

import { buildDirectAcceptanceStage2Defaults } from "../src/lib/personal-plan/direct-acceptance/defaults"
import { resolveAssumedAnswers } from "../src/lib/personal-plan/refinement/assumed-defaults"
import { resolveStage2RefinementContract } from "../src/lib/personal-plan/refinement/question-path"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2AnswerProvenance,
  Stage2QuestionId,
} from "../src/lib/personal-plan/refinement/types"
import { TOOL_FORM_PAGES, toolFormCareKey } from "../src/lib/personal-plan/tools/labels"
import { deriveCareHabitsColumns } from "../src/lib/user-facts/derive-legacy-columns"
import { toCareHabitsPatch, toFieldProvenance } from "../src/lib/user-facts/from-refinement-draft"
import { knownCareAnswers } from "../src/lib/user-facts/known-care-answers"
import { loadKnownCareAnswers, toRefinementAnswers } from "../src/lib/user-facts/read"
import {
  careHabitsPatchSchema,
  careHabitsV1Schema,
  type CareHabitsV1,
} from "../src/lib/user-facts/schema"

const toolsOn = {
  relevantCategories: [],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible" as const,
  toolsEnabled: true as const,
}

/** Lena's completed draft (§6): tools answered by her, Gewohnheiten answered by her. */
function lenaDraft() {
  const contract = resolveStage2RefinementContract({
    triggerContext: toolsOn,
    answers: {
      currentProductCategories: [],
      wetWashFrequency: "weekly_2x",
      toolFamiliesWithSomething: [
        "drying_textiles",
        "brushes_combs",
        "airflow",
        "heated_styling",
        "heatless_styling",
        "securing_sectioning",
        "night_protection",
      ],
      toolForms: {
        "wash_application:1": [],
        "drying_textiles:1": ["microfiber_towel"],
        "brushes_combs:1": ["wide_tooth_comb", "vent_brush"],
        "brushes_combs:2": ["round_brush"],
        "airflow:1": ["hair_dryer", "hot_air_brush"],
        "heated_styling:1": ["flat_iron"],
        "heatless_styling:1": [],
        "securing_sectioning:1": [],
        "securing_sectioning:2": [],
        "night_protection:1": ["pillowcase"],
      },
      towel: { technique: "gentle_press" } as never,
      dryingRoutes: ["air_dry", "ordinary_blow_dry"],
      heatEvents: {
        "heat:ordinary_blow_dry": { frequency: "weekly_2x" },
        "heat:dryer_brush": { frequency: "weekly_1x", protectionConsistency: "always" },
        "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "sometimes" },
      },
    },
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "tools_overview",
      "tools:drying_textiles:1",
      "tools:brushes_combs:1",
      "tools:brushes_combs:2",
      "tools:airflow:1",
      "tools:heated_styling:1",
      "tools:heatless_styling:1",
      "tools:securing_sectioning:1",
      "tools:securing_sectioning:2",
      "tools:night_protection:1",
      "towel_handling",
      "drying_routes",
      "heat:ordinary_blow_dry",
      "heat:dryer_brush",
      "heat:straightener",
    ],
  })
  assert.equal(contract.isComplete, true)
  return { answers: contract.answers, completedQuestionIds: contract.path.completedQuestionIds }
}

/* ── F. schema keys ──────────────────────────────────────────────────────── */

test("care_habits carries the overview and one strict key per page", () => {
  const parsed = careHabitsV1Schema.parse({
    toolFamiliesWithSomething: ["drying_textiles", "airflow"],
    toolForms_drying_textiles_1: ["microfiber_towel"],
    toolForms_airflow_1: [],
    toolForms_brushes_combs_1: ["wide_tooth_comb", "fingers"],
  })
  assert.deepEqual(parsed.toolForms_brushes_combs_1, ["wide_tooth_comb", "fingers"])
  for (const page of TOOL_FORM_PAGES) {
    assert.ok(toolFormCareKey(page.pageKey) in careHabitsV1Schema.shape, page.pageKey)
  }
  // A form from another page, the family-keyed August shape and the nested draft shape are refused.
  assert.equal(
    careHabitsV1Schema.safeParse({ toolForms_brushes_combs_1: ["round_brush"] }).success,
    false,
  )
  assert.equal(careHabitsV1Schema.safeParse({ toolForms_airflow: ["hair_dryer"] }).success, false)
  assert.equal(careHabitsV1Schema.safeParse({ toolForms: {} }).success, false)
  assert.equal(
    careHabitsV1Schema.safeParse({ toolFamiliesWithSomething: ["nachtschutz"] }).success,
    false,
  )
  assert.equal(careHabitsPatchSchema.safeParse({ toolForms_airflow_1: null }).success, true)
})

/* ── F. draft → patch + provenance ───────────────────────────────────────── */

test("the patch expands pages into keys and carries the derived thing-fields and brushes", () => {
  const draft = lenaDraft()
  const patch = toCareHabitsPatch(draft.answers, {
    completedQuestionIds: draft.completedQuestionIds,
  })
  assert.equal("toolForms" in patch, false, "the nested draft shape never reaches the facts")
  assert.deepEqual(patch.toolFamiliesWithSomething, draft.answers.toolFamiliesWithSomething)
  assert.deepEqual(patch.toolForms_drying_textiles_1, ["microfiber_towel"])
  assert.deepEqual(patch.toolForms_brushes_combs_1, ["wide_tooth_comb", "vent_brush"])
  assert.deepEqual(patch.toolForms_wash_application_1, [])
  assert.deepEqual(patch.toolForms_night_protection_1, ["pillowcase"])
  // Derived thing-fields (§6: Warmluftbürste + Glätteisen, Mikrofaser, Kissenbezug).
  assert.deepEqual(patch.additionalHeatTools, ["dryer_brush", "straightener"])
  assert.deepEqual(patch.towel, { material: "mikrofaser", technique: "gentle_press" })
  assert.deepEqual(patch.nightProtection, ["silk_satin_pillow"])
  // H2: brushes feed the legacy slot; the Vent-Bürste has no legacy value.
  assert.deepEqual(patch.brushesCombs, ["wide_tooth_comb", "round"])
  assert.equal(careHabitsPatchSchema.safeParse(patch).success, true)
})

test("unresolved pages are omitted from the patch and from the provenance", () => {
  const answers: PersonalPlanRefinementAnswersV1 = {
    toolFamiliesWithSomething: ["brushes_combs"],
    toolForms: { "brushes_combs:1": ["wide_tooth_comb"], "brushes_combs:2": ["round_brush"] },
  }
  const completedQuestionIds: Stage2QuestionId[] = ["tools_overview", "tools:brushes_combs:1"]
  const patch = toCareHabitsPatch(answers, { completedQuestionIds })
  assert.deepEqual(patch.toolForms_brushes_combs_1, ["wide_tooth_comb"])
  assert.equal("toolForms_brushes_combs_2" in patch, false)
  assert.equal("brushesCombs" in patch, false, "brushes need both pages")
  const fields = toFieldProvenance({ completedQuestionIds, answerProvenance: {}, answers })
  assert.equal(fields.toolForms_brushes_combs_1, "user")
  assert.equal("toolForms_brushes_combs_2" in fields, false)
  assert.equal("brushesCombs" in fields, false)
  // Unticked families are explicit nones with the overview's provenance.
  assert.deepEqual(patch.toolForms_night_protection_1, [])
  assert.equal(fields.toolForms_night_protection_1, "user")
})

test("derived fields take their source page's provenance", () => {
  const draft = lenaDraft()
  const answerProvenance: Stage2AnswerProvenance = {
    "tools:airflow:1": "user",
    "tools:heated_styling:1": "assumed",
    "tools:drying_textiles:1": "user",
    "tools:night_protection:1": "assumed",
    "tools:brushes_combs:1": "user",
    "tools:brushes_combs:2": "user",
  }
  const fields = toFieldProvenance({ ...draft, answerProvenance })
  assert.equal(fields.additionalHeatTools, "assumed", "one assumed source page")
  assert.equal(fields.nightProtection, "assumed")
  assert.equal(fields.towel, "user")
  assert.equal(fields.brushesCombs, "user", "user iff both brush pages are user")
  assert.equal(fields.toolForms_heated_styling_1, "assumed")
  assert.equal(fields.toolFamiliesWithSomething, "user")
  // The heat map is answered per event, so its own provenance stands.
  assert.equal(fields.heatEvents, "user")

  const brushes = toFieldProvenance({
    ...draft,
    answerProvenance: { "tools:brushes_combs:2": "assumed" },
  })
  assert.equal(brushes.brushesCombs, "assumed")
  // The towel technique is a Gewohnheiten answer; an assumed one makes the towel assumed.
  const towel = toFieldProvenance({ ...draft, answerProvenance: { towel_handling: "assumed" } })
  assert.equal(towel.towel, "assumed")
})

test("rollout off: the patch is the answers object as before", () => {
  const answers: PersonalPlanRefinementAnswersV1 = {
    towel: { material: "frottee", technique: "rough_rubbing" },
    additionalHeatTools: ["straightener"],
    nightProtection: [],
  }
  assert.deepEqual(toCareHabitsPatch(answers), answers)
  assert.deepEqual(
    toCareHabitsPatch(answers, {
      completedQuestionIds: ["towel_handling", "additional_heat_tools", "night_protection"],
    }),
    answers,
  )
})

/* ── F. derived fields feed the same legacy columns ──────────────────────── */

test("the derived thing-fields feed the legacy columns exactly like the old answers", () => {
  const draft = lenaDraft()
  const patch = toCareHabitsPatch(draft.answers, {
    completedQuestionIds: draft.completedQuestionIds,
  })
  const fromTools = deriveCareHabitsColumns(careHabitsV1Schema.parse(patch))
  const fromOldQuestions = deriveCareHabitsColumns({
    towel: { material: "mikrofaser", technique: "gentle_press" },
    dryingRoutes: ["air_dry", "ordinary_blow_dry"],
    additionalHeatTools: ["dryer_brush", "straightener"],
    heatEvents: draft.answers.heatEvents,
    nightProtection: ["silk_satin_pillow"],
    brushesCombs: ["wide_tooth_comb", "round"],
  })
  assert.deepEqual(fromTools, fromOldQuestions)
})

/* ── F. facts → answers ──────────────────────────────────────────────────── */

function storedFacts(): { careHabits: CareHabitsV1; fields: Record<string, "user" | "assumed"> } {
  const draft = lenaDraft()
  const answerProvenance: Stage2AnswerProvenance = { "tools:brushes_combs:2": "assumed" }
  const careHabits = careHabitsV1Schema.parse(
    toCareHabitsPatch(draft.answers, { completedQuestionIds: draft.completedQuestionIds }),
  )
  const fields = toFieldProvenance({ ...draft, answerProvenance }) as Record<
    string,
    "user" | "assumed"
  >
  return { careHabits, fields }
}

test("toRefinementAnswers rebuilds the nested per-page answers", () => {
  const { careHabits } = storedFacts()
  const answers = toRefinementAnswers({ careHabits })
  assert.deepEqual(answers.toolForms, lenaDraft().answers.toolForms)
  assert.equal("brushesCombs" in answers, false)
  assert.equal(
    Object.keys(answers).some((key) => key.startsWith("toolForms_")),
    false,
  )
})

test("known care answers: a user page is known, its assumed sibling is not", () => {
  const { careHabits, fields } = storedFacts()
  const known = knownCareAnswers({ careHabits, fields })
  assert.deepEqual(known.answers.toolForms?.["brushes_combs:1"], ["wide_tooth_comb", "vent_brush"])
  assert.equal(known.answers.toolForms?.["brushes_combs:2"], undefined)
  assert.ok(known.questionIds.includes("tools:brushes_combs:1"))
  assert.equal(known.questionIds.includes("tools:brushes_combs:2"), false)
  assert.ok(known.questionIds.includes("tools_overview"))
  assert.deepEqual(known.answers.toolFamiliesWithSomething, careHabits.toolFamiliesWithSomething)
  // The derived thing-fields are known because their source pages are the user's.
  assert.deepEqual(known.answers.additionalHeatTools, ["dryer_brush", "straightener"])
  assert.deepEqual(known.answers.nightProtection, ["silk_satin_pillow"])
})

test("known care answers: stored pages are put into canonical order before validation", () => {
  const known = knownCareAnswers({
    careHabits: { toolForms_brushes_combs_1: ["fingers", "wide_tooth_comb"] },
    fields: { toolForms_brushes_combs_1: "user" },
  })
  assert.deepEqual(known.answers.toolForms, { "brushes_combs:1": ["wide_tooth_comb", "fingers"] })
  assert.deepEqual(known.questionIds, ["tools:brushes_combs:1"])
})

test("known care answers: a derived field is known only while its source page is the user's", () => {
  const known = knownCareAnswers({
    careHabits: {
      toolForms_night_protection_1: ["bonnet"],
      nightProtection: ["silk_satin_bonnet"],
      toolForms_airflow_1: ["hot_air_brush"],
      toolForms_heated_styling_1: [],
      additionalHeatTools: ["dryer_brush"],
    },
    fields: {
      toolForms_night_protection_1: "assumed",
      nightProtection: "user",
      toolForms_airflow_1: "user",
      toolForms_heated_styling_1: "user",
      additionalHeatTools: "user",
    },
  })
  assert.equal(known.answers.nightProtection, undefined)
  assert.equal(known.questionIds.includes("night_protection"), false)
  assert.deepEqual(known.answers.additionalHeatTools, ["dryer_brush"])
})

test("loadKnownCareAnswers: stored user page 1 + assumed page 2 resolve to a complete tools module", async () => {
  const { careHabits } = storedFacts()
  const fields = {
    ...storedFacts().fields,
    toolForms_brushes_combs_1: "user",
    toolForms_brushes_combs_2: "assumed",
  }
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              user_id: "user-1",
              diagnostics: null,
              care_habits: careHabits,
              quiz_context: null,
              facts_provenance: {
                care_habits: {
                  source: { kind: "feinschliff_draft", id: "draft-1" },
                  schemaVersion: 1,
                  at: "2026-10-09T10:00:00.000Z",
                  fields,
                },
              },
              facts_revision: 3,
            },
            error: null,
          }),
        }),
      }),
    }),
  }
  const known = await loadKnownCareAnswers(client as never, "user-1")
  assert.deepEqual(known.answers.toolForms?.["brushes_combs:1"], ["wide_tooth_comb", "vent_brush"])
  assert.equal(known.answers.toolForms?.["brushes_combs:2"], undefined)

  // Direct acceptance on these facts: page 2 is re-assumed, page 1 and the rest stay hers.
  const resolution = resolveAssumedAnswers({
    triggerContext: toolsOn,
    answers: known.answers,
    userAnsweredQuestionIds: known.questionIds,
  })
  assert.deepEqual(
    resolution.assumedQuestionIds.filter((id) => id.startsWith("tools")),
    ["tools:brushes_combs:2"],
  )
  assert.deepEqual(resolution.answers.toolForms?.["brushes_combs:1"], [
    "wide_tooth_comb",
    "vent_brush",
  ])
  const contract = resolveStage2RefinementContract({
    triggerContext: toolsOn,
    answers: resolution.answers,
    completedQuestionIds: resolution.orderedQuestionIds,
  })
  assert.equal(contract.isComplete, true)
})

/* ── fix round 3: assumed brush pages never write the legacy brush slot ─────── */

test("an assumed tool inventory writes no brushesCombs (brush_type stays as today)", () => {
  const off = buildDirectAcceptanceStage2Defaults({ ...toolsOn, toolsEnabled: undefined })
  const on = buildDirectAcceptanceStage2Defaults(toolsOn)
  const patchOff = toCareHabitsPatch(off.answers, off)
  const patchOn = toCareHabitsPatch(on.answers, on)
  assert.equal("brushesCombs" in patchOn, false)
  assert.equal("brushesCombs" in toFieldProvenance(on), false)
  // The legacy columns derive exactly as with the rollout off.
  assert.deepEqual(
    deriveCareHabitsColumns(careHabitsV1Schema.parse(patchOn)),
    deriveCareHabitsColumns(careHabitsV1Schema.parse(patchOff)),
  )
})

test("brushesCombs is written once a brush page is the user's; assumed if the other is not", () => {
  const answers: PersonalPlanRefinementAnswersV1 = {
    toolFamiliesWithSomething: ["brushes_combs"],
    toolForms: { "brushes_combs:1": ["paddle_brush"], "brushes_combs:2": [] },
  }
  const completedQuestionIds: Stage2QuestionId[] = [
    "tools_overview",
    "tools:brushes_combs:1",
    "tools:brushes_combs:2",
  ]
  const mixed: Stage2AnswerProvenance = {
    tools_overview: "user",
    "tools:brushes_combs:1": "user",
    "tools:brushes_combs:2": "assumed",
  }
  const patch = toCareHabitsPatch(answers, { completedQuestionIds, answerProvenance: mixed })
  assert.deepEqual(patch.brushesCombs, ["paddle"])
  assert.equal(
    toFieldProvenance({ completedQuestionIds, answerProvenance: mixed, answers }).brushesCombs,
    "assumed",
  )
  const assumed: Stage2AnswerProvenance = {
    tools_overview: "user",
    "tools:brushes_combs:1": "assumed",
    "tools:brushes_combs:2": "assumed",
  }
  assert.equal(
    "brushesCombs" in
      toCareHabitsPatch(answers, { completedQuestionIds, answerProvenance: assumed }),
    false,
  )
  assert.equal(
    "brushesCombs" in
      toFieldProvenance({ completedQuestionIds, answerProvenance: assumed, answers }),
    false,
  )
  // An unticked family is the user's explicit none when the overview is hers.
  const unticked = toCareHabitsPatch(
    { toolFamiliesWithSomething: [], toolForms: {} },
    { completedQuestionIds: ["tools_overview"], answerProvenance: { tools_overview: "user" } },
  )
  assert.deepEqual(unticked.brushesCombs, [])
})
