import assert from "node:assert/strict"
import test from "node:test"
import { LOW_DAMAGE_PROFILE } from "./recommendation-engine-foundation.fixtures"
import { hairProfileFullSchema } from "../src/lib/validators"
import { buildRecommendationEngineRuntimeFromPersistence } from "../src/lib/recommendation-engine/runtime"
import { buildRoutinePlan } from "../src/lib/routines/planner"
import { projectQuizAnswersToLegacyVocabulary } from "../src/lib/quiz/normalization"
import { getConcernOptions, getGoalOptions } from "../src/components/personal-plan-quiz/quiz-data"
import { buildUserContextProjection } from "../src/lib/agent/tools/get-user-context"
import { buildQuizAnswersFromHairProfile } from "../src/lib/reactivation/profile-quiz-answers"
import { currentLegacyAnswers } from "../src/lib/scan/scanner-context"
import { buildDiscoveryQuizAnswers } from "../src/lib/discovery/quiz-answers"
import { oldWriterColumnsForLead } from "../src/lib/user-facts/backfill/detect-hand-edits"
import { legacyColumnsToDiagnostics } from "../src/lib/user-facts/backfill/legacy-columns-to-diagnostics"
import { buildQuizResultNarrative } from "../src/lib/quiz/result-narrative"
import type { QuizAnswers } from "../src/lib/quiz/types"
import type { HairProfile } from "../src/lib/types"

test("NR2/NR3: profile validation, engine and routine retain the expanded vocabulary with quiz labels", () => {
  const profile: HairProfile = {
    ...LOW_DAMAGE_PROFILE,
    concerns: ["low_shine", "lost_shape", "low_volume_or_weighed_down"],
    goals: ["volume_balance"],
    primary_concern: "lost_shape",
  }
  assert.equal(hairProfileFullSchema.safeParse(profile).success, true)
  const engine = buildRecommendationEngineRuntimeFromPersistence(profile, [])
  assert.deepEqual(engine.rawInput.profile.concerns, profile.concerns)
  assert.deepEqual(engine.normalized.concerns, profile.concerns)
  assert.deepEqual(engine.normalized.goals, ["volume_balance"])
  assert.equal(engine.careNeeds.volumeDirection, "neutral")
  const plan = buildRoutinePlan(profile, "Welche Routine passt zu mir?")
  const options = [...getConcernOptions(undefined), ...getGoalOptions(undefined)]
  for (const code of [...profile.concerns, ...profile.goals]) {
    const focus = plan.primary_focuses.find((entry) => entry.code === code)
    assert.ok(focus, `missing focus ${code}`)
    assert.equal(focus.label, options.find((entry) => entry.value === code)?.label)
  }
  assert.deepEqual(
    projectQuizAnswersToLegacyVocabulary({ concerns: profile.concerns, goals: profile.goals }),
    { concerns: profile.concerns, goals: profile.goals },
  )
})

test("NR2/NR3: chat signals and scanner/reactivation/cockpit readers keep the new answers", () => {
  const profile: HairProfile = {
    ...LOW_DAMAGE_PROFILE,
    concerns: ["low_shine", "lost_shape", "low_volume_or_weighed_down"],
    goals: ["volume_balance"],
    primary_concern: "lost_shape",
  }
  const context = buildUserContextProjection({
    hairProfile: profile,
    routineItems: [],
    memoryEntries: [],
  })
  for (const option of [...getConcernOptions(undefined), ...getGoalOptions(undefined)].filter(
    (entry) => [...profile.concerns, ...profile.goals].includes(entry.value as never),
  )) {
    assert.ok(
      context.derived_signals.some((signal) => signal.includes(option.label)),
      `missing signal ${option.label}`,
    )
  }
  for (const answers of [
    currentLegacyAnswers(profile as unknown as Record<string, unknown>),
    buildQuizAnswersFromHairProfile(profile),
  ]) {
    assert.deepEqual(answers.concerns, profile.concerns)
    assert.deepEqual(answers.goals, profile.goals)
    assert.equal(answers.primary_concern, "lost_shape")
  }
  const cockpit = buildDiscoveryQuizAnswers({
    id: "lead",
    quiz_kind: "legacy",
    quiz_answers: {
      structure: "wavy",
      concerns: profile.concerns,
      goals: profile.goals,
      primary_concern: "lost_shape",
    },
  })
  assert.equal(cockpit.status, "ready")
  if (cockpit.status === "ready") {
    assert.deepEqual(cockpit.concerns, profile.concerns)
    assert.equal(cockpit.mainConcern, "lost_shape")
  }
})

test("vocabulary widening does not reinterpret historical dropped answers as hand edits", () => {
  const old = oldWriterColumnsForLead({
    structure: "straight",
    thickness: "normal",
    density: "medium",
    concerns: ["dry_lengths", "low_shine", "lost_shape", "low_volume_or_weighed_down"],
    primary_concern: "low_shine",
    goals: ["volume_balance", "moisture"],
  })
  assert.deepEqual(old?.concerns, ["dryness"])
  assert.equal(old?.primary_concern, null)
  assert.deepEqual(old?.goals, ["moisture"])
})

test("new engine column values round-trip to diagnostics without a volume direction", () => {
  const facts = legacyColumnsToDiagnostics(
    {
      ...LOW_DAMAGE_PROFILE,
      concerns: ["low_shine", "lost_shape", "low_volume_or_weighed_down"],
      primary_concern: "lost_shape",
      goals: ["volume_balance"],
    },
    {},
  )
  assert.deepEqual(facts.currentConcerns, ["low_shine", "lost_shape", "low_volume_or_weighed_down"])
  assert.equal(facts.primaryConcern, "lost_shape")
  assert.deepEqual(facts.goals, ["volume_balance"])
  assert.equal(facts.volumeDirection, undefined)
})

test("engine-only neutral volume leaves quiz-result copy unchanged (concern vocabulary widening, ruled 2026-10-11)", () => {
  const answers = { structure: "straight", thickness: "normal", density: "medium", concerns: [] }
  const goalCases: Array<NonNullable<QuizAnswers["goals"]>> = [[], ["moisture"]]
  for (const originalGoals of goalCases) {
    const original = buildQuizResultNarrative({ ...answers, goals: originalGoals })
    const neutral = buildQuizResultNarrative({
      ...answers,
      goals: [...originalGoals, "volume_balance"],
    })
    assert.equal(neutral.primaryGoal, original.primaryGoal)
    assert.deepEqual(neutral, original)
  }
})

test("scanner column reader does not turn an inferred sole concern into a stated facts pick", () => {
  const profile = {
    ...LOW_DAMAGE_PROFILE,
    concerns: ["dryness"],
    primary_concern: "dryness",
    diagnostics: {
      source: { kind: "legacy_columns", version: 1, raw: {} },
      currentConcerns: ["dry_lengths"],
      goals: ["moisture"],
    },
  }
  assert.equal(currentLegacyAnswers(profile).primary_concern, undefined)
  assert.equal(
    currentLegacyAnswers({
      ...profile,
      diagnostics: { ...profile.diagnostics, primaryConcern: "dry_lengths" },
    }).primary_concern,
    "dryness",
  )
})

test("scanner widening keeps historical column-only primary slugs unchanged (concern vocabulary widening, ruled 2026-10-11)", () => {
  for (const concern of ["dryness", "hair_damage", "tangling"] as const) {
    assert.equal(
      currentLegacyAnswers({
        ...LOW_DAMAGE_PROFILE,
        concerns: [concern],
        primary_concern: concern,
      }).primary_concern,
      undefined,
    )
  }
  for (const concern of ["low_shine", "lost_shape", "low_volume_or_weighed_down"] as const) {
    assert.equal(
      currentLegacyAnswers({
        ...LOW_DAMAGE_PROFILE,
        concerns: [concern],
        primary_concern: concern,
      }).primary_concern,
      concern,
    )
  }
})
