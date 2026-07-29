import assert from "node:assert/strict"
import test from "node:test"

import {
  PERSONAL_PLAN_QUIZ_DRAFT_STORAGE_KEY,
  clearPersonalPlanQuizDraft,
  derivePersonalPlanConflictPrompt,
  derivePersonalPlanProfileSummary,
  getNextPersonalPlanQuizScreen,
  getPersonalPlanLoadingProgress,
  getPersonalPlanQuizSectionId,
  loadPersonalPlanQuizDraft,
  savePersonalPlanQuizDraft,
} from "../src/lib/personal-plan-quiz"

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private data = new Map<string, string>()
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
}

test("approved flow inserts the analysis bridge, midpoint, admission ladder, and daily commitment", () => {
  assert.equal(getNextPersonalPlanQuizScreen("current_problems", {}), "analysis_bridge")
  assert.equal(getNextPersonalPlanQuizScreen("elastic_response", {}), "midpoint_profile")
  assert.equal(getNextPersonalPlanQuizScreen("midpoint_profile", {}), "chemical_treatments")
  assert.equal(
    getNextPersonalPlanQuizScreen("admission_recurrence", {}),
    "admission_practical_cost",
  )
  assert.equal(
    getNextPersonalPlanQuizScreen("admission_recurrence", {
      thickness: "fine",
      goals: ["moisture"],
    }),
    "admission_conflict",
  )
  assert.equal(getNextPersonalPlanQuizScreen("profile_summary", {}), "daily_time")
  assert.equal(getNextPersonalPlanQuizScreen("daily_time", {}), "plan_loading")
})

test("five stable checkpoint sections cover every semantic phase", () => {
  assert.equal(getPersonalPlanQuizSectionId("texture"), "hair_profile")
  assert.equal(getPersonalPlanQuizSectionId("goals"), "goals_and_context")
  assert.equal(getPersonalPlanQuizSectionId("admission_emotional_relevance"), "analysis")
  assert.equal(getPersonalPlanQuizSectionId("profile_summary"), "plan_direction")
  assert.equal(getPersonalPlanQuizSectionId("email_capture"), "completion")
})

test("scalp concerns use one optional multi-select screen without a medical warning branch", () => {
  assert.equal(getNextPersonalPlanQuizScreen("scalp_oiliness", {}), "scalp_concerns")
  assert.equal(getNextPersonalPlanQuizScreen("scalp_concerns", {}), "admission_recurrence")
})

test("conflicting-needs prompt is shown only for a supported trade-off", () => {
  assert.equal(derivePersonalPlanConflictPrompt({ texture: "straight" }), null)
  assert.equal(
    derivePersonalPlanConflictPrompt({
      scalpOiliness: "oily",
      currentConcerns: ["dry_dull_lengths"],
    })?.id,
    "oily_roots_dry_lengths",
  )
  assert.equal(
    derivePersonalPlanConflictPrompt({
      thickness: "fine",
      goals: ["moisture"],
    })?.question,
    "Braucht dein Haar Pflege, wirkt damit aber schnell schwer?",
  )
  assert.equal(
    derivePersonalPlanConflictPrompt({
      texture: "curly",
      goals: ["shape_definition"],
    })?.id,
    "definition_without_dryness",
  )
  assert.equal(
    derivePersonalPlanConflictPrompt({
      chemicalTreatments: ["lightened"],
      goals: ["strength_ends"],
    })?.id,
    "strength_without_stiffness",
  )
})

test("goals retain all eight selected domains without a cap", () => {
  const storage = new MemoryStorage()
  const goals = [
    "moisture",
    "frizz_surface",
    "shine",
    "shape_definition",
    "volume_balance",
    "strength_ends",
    "scalp_balance",
    "manageability_styling",
  ] as const
  savePersonalPlanQuizDraft(
    { screen: "goals", history: ["texture", "goals"], answers: { goals: [...goals] } },
    storage,
  )
  assert.deepEqual(loadPersonalPlanQuizDraft(storage)?.answers.goals, goals)
})

test("draft preserves an explicit no-concerns answer across reloads", () => {
  const storage = new MemoryStorage()
  savePersonalPlanQuizDraft(
    {
      screen: "analysis_bridge",
      history: ["texture", "current_problems", "analysis_bridge"],
      answers: { texture: "wavy", currentConcerns: [] },
    },
    storage,
  )

  assert.deepEqual(loadPersonalPlanQuizDraft(storage)?.answers.currentConcerns, [])
})

test("draft excludes lead PII and all conversion-only answers", () => {
  const storage = new MemoryStorage()
  savePersonalPlanQuizDraft(
    {
      screen: "email_capture",
      history: ["texture", "admission_practical_cost", "daily_time", "email_capture"],
      answers: {
        texture: "wavy",
        goals: ["shine"],
        email: "lea@example.com",
        marketingConsent: true,
        admissionPracticalCost: "often",
        dailyTime: "10_minutes",
        microcommitments: ["understand"],
      } as never,
    },
    storage,
  )

  const raw = storage.getItem(PERSONAL_PLAN_QUIZ_DRAFT_STORAGE_KEY)
  assert.ok(raw)
  assert.equal(raw.includes("lea@example.com"), false)
  assert.equal(raw.includes("marketingConsent"), false)
  assert.equal(raw.includes("admissionPracticalCost"), false)
  assert.equal(raw.includes("dailyTime"), false)
  assert.equal(raw.includes("microcommitments"), false)
  assert.deepEqual(loadPersonalPlanQuizDraft(storage)?.answers, {
    texture: "wavy",
    goals: ["shine"],
  })
})

test("draft ignores removed rough-flow fields and malformed storage", () => {
  const storage = new MemoryStorage()
  savePersonalPlanQuizDraft(
    {
      screen: "profile_summary",
      history: ["texture", "profile_summary"],
      answers: {
        texture: "coily",
        washCadence: "daily",
        safetySignals: ["persistent_itch_or_burning"],
        heatExposure: "daily_or_almost_daily",
        heatProtection: "no",
        weeklyTime: "over_two_hours",
        challengeAnswers: ["fully_yes"],
      } as never,
    },
    storage,
  )
  assert.deepEqual(loadPersonalPlanQuizDraft(storage)?.answers, { texture: "coily" })

  storage.setItem(PERSONAL_PLAN_QUIZ_DRAFT_STORAGE_KEY, "not json")
  assert.equal(loadPersonalPlanQuizDraft(storage), null)
})

test("draft persistence tolerates restricted storage", () => {
  const throwingStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota")
    },
    removeItem: () => {
      throw new Error("blocked")
    },
  }
  assert.doesNotThrow(() =>
    savePersonalPlanQuizDraft(
      { screen: "texture", history: [], answers: { texture: "wavy" } },
      throwingStorage,
    ),
  )
  assert.doesNotThrow(() => clearPersonalPlanQuizDraft(throwingStorage))
})

test("profile summary stays positive and derives four useful rows from durable answers", () => {
  const summary = derivePersonalPlanProfileSummary({
    texture: "wavy",
    thickness: "fine",
    density: "medium",
    goals: ["moisture"],
    scalpOiliness: "dry",
    scalpConcerns: ["dry_dandruff"],
    routineStyle: "flexible_versatile",
    meaningfulMoment: "everyday",
  })

  assert.equal(summary.length, 4)
  assert.match(summary[0].value, /Wellig/)
  assert.match(summary[1].value, /Feuchtigkeit/)
  assert.match(summary[2].value, /trocken/)
  assert.match(summary[3].value, /Flexibel/)
  assert.doesNotMatch(summary.map((row) => row.value).join(" "), /Abklärung|ärztlich|medizinisch/i)
})

test("materially different profiles produce recognizably different positive receipts", () => {
  const straightFine = derivePersonalPlanProfileSummary({
    texture: "straight",
    thickness: "fine",
    density: "low",
    goals: ["volume_balance"],
    scalpOiliness: "oily",
    routineStyle: "simple_reliable",
    meaningfulMoment: "work",
  })
  const curlyTreated = derivePersonalPlanProfileSummary({
    texture: "curly",
    thickness: "coarse",
    density: "high",
    goals: ["shape_definition", "strength_ends"],
    elasticResponse: "snaps",
    chemicalTreatments: ["lightened"],
    scalpOiliness: "dry",
    routineStyle: "precise_goal_oriented",
    meaningfulMoment: "special_occasions",
  })
  const coilyScalp = derivePersonalPlanProfileSummary({
    texture: "coily",
    thickness: "normal",
    density: "medium",
    goals: ["moisture", "scalp_balance"],
    currentConcerns: ["dry_dull_lengths", "scalp_imbalance"],
    scalpOiliness: "balanced",
    scalpConcerns: ["irritated"],
    routineStyle: "intentional_caring",
    meaningfulMoment: "everyday",
  })

  assert.notDeepEqual(straightFine, curlyTreated)
  assert.notDeepEqual(curlyTreated, coilyScalp)
  assert.match(straightFine[0].value, /Glatt · fein · wenige Haare/)
  assert.match(curlyTreated[1].value, /Stärkung der Längen · Form & Definition/)
  assert.match(coilyScalp[2].value, /gereizt oder empfindlich/)
})

test("loading progress is monotonic across its three stages", () => {
  const values = [
    getPersonalPlanLoadingProgress([], 10),
    getPersonalPlanLoadingProgress(["evaluate_profile"], 5),
    getPersonalPlanLoadingProgress(["evaluate_profile", "compare_goals"], 10),
    getPersonalPlanLoadingProgress(["evaluate_profile", "compare_goals", "fit_everyday"], 0),
  ]
  assert.deepEqual(values, [10, 34, 67, 100])
  assert.equal(
    values.every((value, index) => index === 0 || value >= values[index - 1]),
    true,
  )
})
