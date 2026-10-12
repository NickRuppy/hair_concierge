import assert from "node:assert/strict"
import test from "node:test"

import { buildDirectAcceptanceStage2Defaults } from "@/lib/personal-plan/direct-acceptance/defaults"
import {
  STAGE2_ASSUMPTION_RULES,
  resolveAssumedAnswers,
  selectStage2Answers,
} from "@/lib/personal-plan/refinement/assumed-defaults"
import {
  getOrderedQuestionIds,
  getStage2QuestionModule,
  isStage2NightWearApplicable,
  isStage2QuestionAnswerValid,
  pruneStage2Answers,
  resolveStage2RefinementContract,
} from "@/lib/personal-plan/refinement/question-path"
import {
  createStage2RefinementSession,
  saveStage2SessionAnswer,
  stage2PrefillCareFromFacts,
} from "@/lib/personal-plan/refinement/session"
import { deriveStage2TriggerContext } from "@/lib/personal-plan/refinement/stage1-adapter"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "@/lib/personal-plan/refinement/types"
import { TOOL_FORM_PAGES } from "@/lib/personal-plan/tools/labels"
import {
  careFactsFromToolInventory,
  nightProtectionWithWear,
  nightWearFromNightProtection,
} from "@/lib/personal-plan/tools/facts"
import { buildRoutinePlan } from "@/lib/routines/planner"
import { deriveCareHabitsColumns } from "@/lib/user-facts/derive-legacy-columns"
import { toCareHabitsPatch, toFieldProvenance } from "@/lib/user-facts/from-refinement-draft"
import { careHabitsV1Schema } from "@/lib/user-facts/schema"
import { profileHabitsRows } from "@/lib/profile/section-config"
import {
  getAnswerForQuestion,
  getQuestionFamily,
  isLocalAnswerComplete,
} from "@/components/personal-plan-refinement/refinement-question"
import { NIGHT_WEAR_OPTIONS } from "@/components/personal-plan-refinement/refinement-options"
import type { HairProfile } from "@/lib/types"

function context(overrides: Partial<Stage2TriggerContext> = {}): Stage2TriggerContext {
  return {
    relevantCategories: ["shampoo", "conditioner"],
    hasReportedIrritatedScalp: false,
    dryShampooBridgeEligibility: "ineligible",
    ...overrides,
  }
}

const OFF = context()
const ON_MEDIUM = context({ toolsEnabled: true, hairLength: "medium" })
const ON_UNKNOWN = context({ toolsEnabled: true })

/** A flag-on draft settled up to the night question: night page = Kissenbezug + weiches Haargummi. */
function settledBeforeNight(): {
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: Stage2QuestionId[]
} {
  const answers: PersonalPlanRefinementAnswersV1 = {
    currentProductCategories: [],
    wetWashFrequency: "weekly_2x",
    toolFamiliesWithSomething: ["drying_textiles", "night_protection"],
    toolForms: {
      ...Object.fromEntries(TOOL_FORM_PAGES.map((page) => [page.pageKey, []])),
      "drying_textiles:1": ["microfiber_towel"],
      "night_protection:1": ["pillowcase", "soft_night_tie"],
    },
    towel: { material: "mikrofaser", technique: "gentle_press" },
    dryingRoutes: ["air_dry"],
  }
  const completedQuestionIds: Stage2QuestionId[] = [
    "current_product_categories",
    "wet_wash_frequency",
    "tools_overview",
    "tools:drying_textiles:1",
    "tools:night_protection:1",
    "towel_handling",
    "drying_routes",
  ]
  return { answers, completedQuestionIds }
}

/* ── path ───────────────────────────────────────────────────────────────── */

test("night_wear: absent with the rollout off, last on the habits path with it on", () => {
  const { answers } = settledBeforeNight()
  assert.equal(getOrderedQuestionIds(OFF, answers).includes("night_wear"), false)
  const on = getOrderedQuestionIds(ON_MEDIUM, {
    ...answers,
    dryingRoutes: ["ordinary_blow_dry"],
    toolFamiliesWithSomething: ["drying_textiles", "airflow", "night_protection"],
    toolForms: { ...answers.toolForms, "airflow:1": ["hair_dryer"] },
  })
  assert.equal(on.at(-1), "night_wear")
  assert.equal(on.at(-2), "heat:ordinary_blow_dry", "after the heat block")
  assert.equal(getStage2QuestionModule("night_wear"), "habits")
})

test("night_wear: hair that cannot be tied skips it; an unknown length asks", () => {
  for (const hairLength of ["very_short", "short"] as const) {
    assert.equal(isStage2NightWearApplicable(context({ toolsEnabled: true, hairLength })), false)
  }
  for (const hairLength of ["medium", "long", "very_long"] as const) {
    assert.equal(isStage2NightWearApplicable(context({ toolsEnabled: true, hairLength })), true)
  }
  assert.equal(isStage2NightWearApplicable(ON_UNKNOWN), true)
  assert.equal(isStage2NightWearApplicable(context({ hairLength: "long" })), false, "rollout off")
})

test("night_wear: validity accepts exactly the three values", () => {
  for (const nightWear of ["open", "loose_tied", "pineapple"] as const) {
    assert.equal(isStage2QuestionAnswerValid("night_wear", { nightWear }), true)
  }
  assert.equal(isStage2QuestionAnswerValid("night_wear", {}), false)
  assert.equal(isStage2QuestionAnswerValid("night_wear", { nightWear: "bonnet" as never }), false)
})

test("the trigger context carries the quiz length only while the rollout is on", () => {
  const snapshot = {
    renderedOrder: ["shampoo"],
    decisions: [],
    profile: { scalp: { concerns: [] }, hair: { length: "short" } },
  } as never
  const off = deriveStage2TriggerContext(snapshot, { toolsEnabled: false })
  assert.equal("hairLength" in off, false)
  assert.equal("toolsEnabled" in off, false)
  const on = deriveStage2TriggerContext(snapshot, { toolsEnabled: true })
  assert.equal(on.hairLength, "short")
})

test("prune: short hair drops a stored night answer; the rollout off keeps it hidden, not deleted", () => {
  const short = pruneStage2Answers({
    triggerContext: context({ toolsEnabled: true, hairLength: "short" }),
    answers: { nightWear: "pineapple" },
    completedQuestionIds: [],
  })
  assert.equal(short.answers.nightWear, undefined)
  assert.ok(short.prunedAnswerKeys.includes("nightWear"))
  const off = pruneStage2Answers({
    triggerContext: OFF,
    answers: { nightWear: "pineapple" },
    completedQuestionIds: [],
  })
  assert.equal(off.answers.nightWear, "pineapple")
})

/* ── derivation: things vs behaviour ────────────────────────────────────── */

test("the soft tie is a thing: alone it derives no technique", () => {
  assert.deepEqual(
    careFactsFromToolInventory({ night_protection: ["soft_night_tie"] }).nightProtection,
    [],
  )
})

test("nightProtection = night-page things + the night question's technique", () => {
  const base = settledBeforeNight()
  const expectations = [
    ["open", ["silk_satin_pillow"]],
    ["loose_tied", ["silk_satin_pillow", "loose_tied"]],
    ["pineapple", ["silk_satin_pillow", "pineapple"]],
  ] as const
  for (const [nightWear, expected] of expectations) {
    const contract = resolveStage2RefinementContract({
      triggerContext: ON_MEDIUM,
      answers: { ...base.answers, nightWear },
      completedQuestionIds: [...base.completedQuestionIds, "night_wear"],
    })
    assert.equal(contract.isComplete, true, nightWear)
    assert.deepEqual(contract.answers.nightProtection, expected, nightWear)
  }
})

test("until the night question is answered the member's earlier technique stays in place", () => {
  assert.deepEqual(nightProtectionWithWear(["silk_satin_bonnet"], undefined, ["pineapple"]), [
    "silk_satin_bonnet",
    "pineapple",
  ])
  assert.deepEqual(nightProtectionWithWear(["silk_satin_bonnet"], "open", ["pineapple"]), [
    "silk_satin_bonnet",
  ])
  const base = settledBeforeNight()
  const contract = resolveStage2RefinementContract({
    triggerContext: ON_MEDIUM,
    answers: { ...base.answers, nightProtection: ["silk_satin_pillow", "pineapple"] },
    completedQuestionIds: base.completedQuestionIds,
  })
  assert.equal(contract.path.firstUnresolvedQuestionId, "night_wear")
  assert.deepEqual(contract.answers.nightProtection, ["silk_satin_pillow", "pineapple"])
  // Idempotent: a second pass over the pruned answers changes nothing.
  const again = resolveStage2RefinementContract({
    triggerContext: ON_MEDIUM,
    answers: contract.answers,
    completedQuestionIds: contract.completedQuestionIds,
  })
  assert.deepEqual(again.answers, contract.answers)
})

test("nightWearFromNightProtection: Pineapple wins, no technique = undefined", () => {
  assert.equal(nightWearFromNightProtection(["loose_tied", "pineapple"]), "pineapple")
  assert.equal(nightWearFromNightProtection(["loose_tied"]), "loose_tied")
  assert.equal(nightWearFromNightProtection(["silk_satin_pillow"]), undefined)
  assert.equal(nightWearFromNightProtection([]), undefined)
  assert.equal(nightWearFromNightProtection(undefined), undefined)
})

/* ── session ────────────────────────────────────────────────────────────── */

test("session: night_wear saves as the closing habits answer and rejects other values", () => {
  const base = settledBeforeNight()
  const session = createStage2RefinementSession({
    pathVersion: "test",
    triggerContext: ON_MEDIUM,
    answers: base.answers,
    completedQuestionIds: base.completedQuestionIds,
  })
  assert.equal(session.path.firstUnresolvedQuestionId, "night_wear")
  assert.throws(
    () => saveStage2SessionAnswer(session, { questionId: "night_wear", answer: "bonnet" }),
    /invalid/,
  )
  const saved = saveStage2SessionAnswer(session, { questionId: "night_wear", answer: "pineapple" })
  assert.equal(saved.answers.nightWear, "pineapple")
  assert.deepEqual(saved.answers.nightProtection, ["silk_satin_pillow", "pineapple"])
  assert.equal(saved.path.firstUnresolvedQuestionId, null)
})

/* ── assumptions and parity ─────────────────────────────────────────────── */

test("rule assume:night_wear:open assumes „Offen“ when no technique is known", () => {
  const resolution = resolveAssumedAnswers({ triggerContext: ON_MEDIUM, answers: {} })
  const index = resolution.assumedQuestionIds.indexOf("night_wear")
  assert.ok(index >= 0)
  assert.equal(resolution.appliedRuleIds[index], "assume:night_wear:open")
  assert.equal(resolution.answers.nightWear, "open")
  assert.deepEqual(resolution.answers.nightProtection, [])
  assert.equal(resolution.orderedQuestionIds.at(-1), "night_wear")
})

test("rule assume:night_wear:derived_from_care keeps the member's earlier technique", () => {
  const resolution = resolveAssumedAnswers({
    triggerContext: ON_MEDIUM,
    answers: { nightProtection: ["pineapple"] },
    userAnsweredQuestionIds: ["night_protection"],
  })
  const index = resolution.assumedQuestionIds.indexOf("night_wear")
  assert.equal(resolution.appliedRuleIds[index], "assume:night_wear:derived_from_care")
  assert.equal(resolution.answers.nightWear, "pineapple")
  assert.deepEqual(resolution.answers.nightProtection, ["pineapple"])
})

test("both night_wear rules are documented and the open rule never names a technique", () => {
  const rules = STAGE2_ASSUMPTION_RULES.filter((rule) => rule.questionId === "night_wear")
  assert.deepEqual(
    rules.map((rule) => rule.ruleId),
    ["assume:night_wear:derived_from_care", "assume:night_wear:open"],
  )
})

for (const nightProtection of [[], ["pineapple"], ["silk_satin_bonnet", "loose_tied"]] as const) {
  test(`parity: the rollout keeps a known night answer (${JSON.stringify(nightProtection)})`, () => {
    const known = {
      answers: { nightProtection: [...nightProtection] },
      questionIds: ["night_protection"] as Stage2QuestionId[],
    }
    const off = buildDirectAcceptanceStage2Defaults(OFF, known)
    const on = buildDirectAcceptanceStage2Defaults(ON_MEDIUM, known)
    assert.deepEqual(on.answers.nightProtection, off.answers.nightProtection)
    assert.equal("nightWear" in off.answers, false, "rollout off: no night_wear answer")
  })
}

test("parity: no care facts — the rollout changes no night assumption, for any length", () => {
  const off = buildDirectAcceptanceStage2Defaults(OFF)
  for (const hairLength of [undefined, "short", "long"] as const) {
    const on = buildDirectAcceptanceStage2Defaults(
      context({ toolsEnabled: true, ...(hairLength ? { hairLength } : {}) }),
    )
    assert.deepEqual(on.answers.nightProtection, off.answers.nightProtection, String(hairLength))
  }
})

test("selectStage2Answers: night_wear owns nightWear", () => {
  assert.deepEqual(
    selectStage2Answers({ nightWear: "open", nightProtection: [] }, ["night_wear"]),
    {
      nightWear: "open",
    },
  )
})

/* ── facts ──────────────────────────────────────────────────────────────── */

test("facts: nightWear is a strict care_habits key; the patch carries it and the merged list", () => {
  const base = settledBeforeNight()
  const contract = resolveStage2RefinementContract({
    triggerContext: ON_MEDIUM,
    answers: { ...base.answers, nightWear: "pineapple" },
    completedQuestionIds: [...base.completedQuestionIds, "night_wear"],
  })
  const patch = toCareHabitsPatch(contract.answers, {
    completedQuestionIds: contract.completedQuestionIds,
  })
  assert.equal(patch.nightWear, "pineapple")
  assert.deepEqual(patch.nightProtection, ["silk_satin_pillow", "pineapple"])
  assert.equal(careHabitsV1Schema.safeParse(patch).success, true)
  assert.equal(careHabitsV1Schema.safeParse({ nightWear: "bun" }).success, false)

  const user = toFieldProvenance({
    completedQuestionIds: contract.completedQuestionIds,
    answerProvenance: {},
    answers: contract.answers,
  })
  assert.equal(user.nightWear, "user")
  assert.equal(user.nightProtection, "user")
  const assumedWear = toFieldProvenance({
    completedQuestionIds: contract.completedQuestionIds,
    answerProvenance: { night_wear: "assumed" },
    answers: contract.answers,
  })
  assert.equal(assumedWear.nightWear, "assumed")
  assert.equal(assumedWear.nightProtection, "assumed", "the merged list is only hers when both are")
})

test("facts: with the rollout off at write time nightWear never reaches the facts", () => {
  const patch = toCareHabitsPatch(
    { ...settledBeforeNight().answers, nightWear: "pineapple" },
    { completedQuestionIds: ["current_product_categories"], toolsEnabled: false },
  )
  assert.equal("nightWear" in patch, false)
})

test("a pineapple answer reaches the routine planner as selected night protection", () => {
  const base = settledBeforeNight()
  const columnsFor = (nightWear: "open" | "pineapple", forms: string[]) => {
    const contract = resolveStage2RefinementContract({
      triggerContext: ON_MEDIUM,
      answers: {
        ...base.answers,
        toolForms: { ...base.answers.toolForms, "night_protection:1": forms as never },
        nightWear,
      },
      completedQuestionIds: [...base.completedQuestionIds, "night_wear"],
    })
    return deriveCareHabitsColumns(
      careHabitsV1Schema.parse(
        toCareHabitsPatch(contract.answers, {
          completedQuestionIds: contract.completedQuestionIds,
        }),
      ),
    )
  }
  const pineapple = columnsFor("pineapple", ["soft_night_tie"])
  assert.deepEqual(pineapple.night_protection, ["pineapple"])
  const open = columnsFor("open", ["soft_night_tie"])
  assert.deepEqual(open.night_protection, [])

  const slotFor = (night_protection: string[] | null) =>
    buildRoutinePlan(
      plannerProfile({ night_protection: night_protection as HairProfile["night_protection"] }),
      "Welche Routine passt zu mir?",
    )
      .sections.flatMap((section) => section.slots)
      .find((slot) => slot.id === "maintenance-night-protection")
  // Pineapple is current night protection → „prüfen/anpassen", never „add".
  assert.equal(slotFor(pineapple.night_protection)?.action, "adjust")
  // „Offen" with no night things → the planner adds night protection.
  assert.equal(slotFor(open.night_protection)?.action, "add")
})

function plannerProfile(overrides: Partial<HairProfile>): HairProfile {
  return {
    id: "profile-1",
    user_id: "user-1",
    hair_texture: "wavy",
    thickness: "fine",
    hair_length: "long",
    density: "medium",
    concerns: ["breakage"],
    products_used: null,
    shampoo_frequency: "weekly_3_4x",
    heat_styling: "never",
    styling_tools: [],
    goals: [],
    cuticle_condition: "smooth",
    protein_moisture_balance: "stretches_bounces",
    scalp_type: "balanced",
    scalp_condition: null,
    chemical_treatment: ["natural"],
    desired_volume: "balanced",
    routine_preference: "advanced",
    current_routine_products: ["shampoo", "conditioner"],
    towel_material: null,
    towel_technique: null,
    drying_method: "air_dry",
    brush_type: null,
    night_protection: [],
    uses_heat_protection: false,
    additional_notes: null,
    conversation_memory: null,
    created_at: "2026-04-09T00:00:00.000Z",
    updated_at: "2026-04-09T00:00:00.000Z",
    ...overrides,
  } as HairProfile
}

/* ── pre-fill ───────────────────────────────────────────────────────────── */

test("pre-fill: a confirmed stored technique becomes the starting value, never an assumed one", () => {
  assert.deepEqual(
    stage2PrefillCareFromFacts({ nightProtection: ["pineapple"] }, { nightProtection: "user" }),
    { nightWear: "pineapple" },
  )
  assert.deepEqual(
    stage2PrefillCareFromFacts(
      { nightProtection: ["loose_tied", "silk_satin_pillow"] },
      { nightProtection: "unknown_historical" },
    ),
    { nightWear: "loose_tied" },
  )
  assert.equal(
    stage2PrefillCareFromFacts({ nightProtection: ["pineapple"] }, { nightProtection: "assumed" }),
    undefined,
  )
  assert.equal(
    stage2PrefillCareFromFacts(
      { nightProtection: ["silk_satin_pillow"] },
      { nightProtection: "user" },
    ),
    undefined,
  )
  assert.deepEqual(
    stage2PrefillCareFromFacts(
      { brushesCombs: ["paddle"], nightProtection: ["pineapple"] },
      { brushesCombs: "user", nightProtection: "user" },
    ),
    { brushesCombs: ["paddle"], nightWear: "pineapple" },
  )
})

test("pre-fill: the question shows the earlier technique; a saved answer wins; „Offen“ is never pre-selected", () => {
  assert.equal(
    getAnswerForQuestion({ nightWear: "open" }, "night_wear", { nightWear: "pineapple" }),
    "open",
  )
  assert.equal(
    getAnswerForQuestion({ nightProtection: ["silk_satin_pillow", "loose_tied"] }, "night_wear"),
    "loose_tied",
  )
  assert.equal(getAnswerForQuestion({}, "night_wear", { nightWear: "pineapple" }), "pineapple")
  assert.equal(getAnswerForQuestion({ nightProtection: [] }, "night_wear"), undefined)
})

/* ── UI contract ────────────────────────────────────────────────────────── */

test("UI: the night question's options, completeness and analytics family", () => {
  assert.deepEqual(
    NIGHT_WEAR_OPTIONS.map((option) => [
      option.value,
      option.label,
      "description" in option ? option.description : null,
    ]),
    [
      ["open", "Offen", null],
      ["loose_tied", "Locker zusammengebunden", null],
      ["pineapple", "Pineapple", "locker oben auf dem Kopf"],
    ],
  )
  assert.equal(isLocalAnswerComplete("night_wear", undefined, { toolsEnabled: true }), false)
  assert.equal(isLocalAnswerComplete("night_wear", "open", { toolsEnabled: true }), true)
  assert.equal(getQuestionFamily("night_wear"), "night_behavior")
})

/* ── Profil ─────────────────────────────────────────────────────────────── */

test("Profil: Gewohnheiten gets a fifth row „Nachts“ after the heat rows", () => {
  const plan: PersonalPlanRefinementAnswersV1 = {
    towel: { material: "mikrofaser", technique: "gentle_press" },
    dryingRoutes: ["ordinary_blow_dry"],
    additionalHeatTools: [],
    heatEvents: { "heat:ordinary_blow_dry": { frequency: "weekly_2x" } },
    nightWear: "pineapple",
  }
  const rows = profileHabitsRows(null, plan)
  assert.deepEqual(
    rows.map((row) => row.label),
    ["Abtrocknen", "Trocknen", "Hitze-Häufigkeit", "Hitzeschutz", "Nachts"],
  )
  assert.equal(rows.at(-1)?.value, "Pineapple")
  assert.deepEqual(rows.at(-1)?.editTarget, { kind: "refine", module: "habits" })
})

test("Profil: „Keine Hitze“ collapse is unchanged and „Nachts“ stays last", () => {
  const rows = profileHabitsRows(null, {
    dryingRoutes: ["air_dry"],
    additionalHeatTools: [],
    nightWear: "open",
  })
  assert.deepEqual(
    rows.map((row) => [row.label, row.value]),
    [
      ["Abtrocknen", null],
      ["Trocknen", "Lufttrocknen"],
      ["Hitze", "Keine Hitze"],
      ["Nachts", "Offen"],
    ],
  )
})

test("Profil: „Nachts“ reads an earlier technique, is open without one, and is absent for short hair", () => {
  const row = (plan: PersonalPlanRefinementAnswersV1) =>
    profileHabitsRows(null, plan).find((candidate) => candidate.key === "night_wear")
  assert.equal(
    row({ nightProtection: ["silk_satin_pillow", "loose_tied"] })?.value,
    "Locker zusammengebunden",
  )
  assert.equal(row({ nightProtection: ["silk_satin_pillow"] })?.value, null)
  const shortHair = plannerProfile({ hair_length: "short", night_protection: null })
  assert.equal(
    profileHabitsRows(shortHair, { nightWear: "open" }).some((r) => r.key === "night_wear"),
    false,
  )
})
