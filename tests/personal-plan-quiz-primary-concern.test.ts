import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { sanitizePersonalPlanQuizAnswers } from "../src/lib/personal-plan-quiz/draft"
import { adaptPersonalPlanAnswersForOffer } from "../src/lib/personal-plan-quiz/offer-adapter"
import {
  canonicalizePersonalPlanAnswers,
  hashPersonalPlanAnswers,
  personalPlanDurableAnswersSchema,
  personalPlanPrepareRequestSchema,
} from "../src/lib/personal-plan-quiz/persistence"
import { resolveStatedPersonalPlanConcern } from "../src/lib/personal-plan-quiz/primary-concern"
import { parsePersonalPlanQuizServerDraft } from "../src/lib/personal-plan-quiz/server-draft"
import type { PersonalPlanQuizAnswers } from "../src/lib/personal-plan-quiz/types"
import { parseSupportedPersonalPlanQuizEnvelope } from "../src/lib/personal-plan/input"
import { buildProfileDataFromPersonalPlanCanonicalProfile } from "../src/lib/quiz/link-to-profile"

/**
 * F1 in the personal-plan quiz (plan Rev. 3 §1.1): the `current_problems` screen asks
 * for the main problem when two or more concerns are selected, stores it as
 * `primaryConcern`, and the recurrence follow-up asks about THAT concern.
 */

const ANSWERS: PersonalPlanQuizAnswers = {
  texture: "wavy",
  thickness: "fine",
  density: "medium",
  goals: ["shine", "moisture"],
  routineClarity: "partial",
  resultReliability: "sometimes",
  adaptationConfidence: "partly",
  currentConcerns: ["low_shine", "frizz_flyaways", "breakage"],
  hairLength: "medium",
  hairSurface: "slightly_uneven",
  elasticResponse: "stretches_stays",
  chemicalTreatments: ["colored"],
  scalpOiliness: "balanced",
  scalpConcerns: [],
  previousAttempts: "some_steps_helped",
  blockers: ["product_fit"],
  routineStyle: "simple_reliable",
  meaningfulMoment: "everyday",
}

test("stated concern: pick, single concern, several without a pick, stale pick", () => {
  assert.equal(
    resolveStatedPersonalPlanConcern({
      currentConcerns: ["low_shine", "breakage"],
      primaryConcern: "low_shine",
    }),
    "low_shine",
  )
  assert.equal(resolveStatedPersonalPlanConcern({ currentConcerns: ["breakage"] }), "breakage")
  assert.equal(
    resolveStatedPersonalPlanConcern({ currentConcerns: ["low_shine", "breakage"] }),
    null,
  )
  assert.equal(
    resolveStatedPersonalPlanConcern({
      currentConcerns: ["low_shine", "breakage"],
      primaryConcern: "tangling",
    }),
    null,
  )
  assert.equal(resolveStatedPersonalPlanConcern({}), null)
})

test("durable schema accepts the pick and still accepts answers without it", () => {
  const withPick = personalPlanDurableAnswersSchema.safeParse({
    ...ANSWERS,
    primaryConcern: "frizz_flyaways",
  })
  assert.equal(withPick.success, true)
  assert.equal(personalPlanDurableAnswersSchema.safeParse(ANSWERS).success, true)
  assert.equal(
    personalPlanDurableAnswersSchema.safeParse({ ...ANSWERS, primaryConcern: "dandruff" }).success,
    false,
  )
})

test("a stale pick is never a validation failure; canonicalisation drops it", () => {
  const parsed = personalPlanPrepareRequestSchema.parse({
    answers: { ...ANSWERS, primaryConcern: "tangling" },
  })
  const envelope = canonicalizePersonalPlanAnswers(parsed.answers)
  assert.equal("primaryConcern" in envelope.answers, false)
  // …so the stale pick does not even change the answers hash.
  assert.equal(
    hashPersonalPlanAnswers(envelope),
    hashPersonalPlanAnswers(
      canonicalizePersonalPlanAnswers(
        personalPlanPrepareRequestSchema.parse({ answers: ANSWERS }).answers,
      ),
    ),
  )
})

test("canonicalisation keeps a contained pick", () => {
  const parsed = personalPlanPrepareRequestSchema.parse({
    answers: { ...ANSWERS, primaryConcern: "frizz_flyaways" },
  })
  assert.equal(
    canonicalizePersonalPlanAnswers(parsed.answers).answers.primaryConcern,
    "frizz_flyaways",
  )
})

test("stored v3 envelopes with and without the pick both stay readable", () => {
  for (const answers of [ANSWERS, { ...ANSWERS, primaryConcern: "breakage" }]) {
    const envelope = canonicalizePersonalPlanAnswers(
      personalPlanPrepareRequestSchema.parse({ answers }).answers,
    )
    assert.equal(parseSupportedPersonalPlanQuizEnvelope(envelope).ok, true)
  }
})

test("server draft accepts the pick; the sanitizer drops a stale one", () => {
  const withPick = parsePersonalPlanQuizServerDraft({
    version: 4,
    screen: "admission_recurrence",
    history: [],
    answers: { currentConcerns: ["low_shine", "breakage"], primaryConcern: "breakage" },
  })
  assert.equal(withPick?.draft.answers.primaryConcern, "breakage")

  const stale = parsePersonalPlanQuizServerDraft({
    version: 4,
    screen: "admission_recurrence",
    history: [],
    answers: { currentConcerns: ["low_shine", "breakage"], primaryConcern: "tangling" },
  })
  assert.ok(stale, "a stale pick must not reject the whole draft")
  assert.equal(stale?.draft.answers.primaryConcern, undefined)
})

test("browser draft sanitizer keeps a contained pick and drops a stale or unknown one", () => {
  assert.equal(
    sanitizePersonalPlanQuizAnswers({
      currentConcerns: ["low_shine", "breakage"],
      primaryConcern: "low_shine",
    }).primaryConcern,
    "low_shine",
  )
  assert.equal(
    sanitizePersonalPlanQuizAnswers({ currentConcerns: ["breakage"], primaryConcern: "low_shine" })
      .primaryConcern,
    undefined,
  )
  assert.equal(
    sanitizePersonalPlanQuizAnswers({ currentConcerns: ["breakage"], primaryConcern: "nope" })
      .primaryConcern,
    undefined,
  )
})

test("the canonical profile carries a legacy-mappable pick into hair_profiles.primary_concern", () => {
  const adapted = adaptPersonalPlanAnswersForOffer({
    ...ANSWERS,
    currentConcerns: ["frizz_flyaways", "breakage"],
    primaryConcern: "frizz_flyaways",
  })
  assert.equal(adapted.answers.primary_concern, "frizz")

  const nonLegacy = adaptPersonalPlanAnswersForOffer({ ...ANSWERS, primaryConcern: "low_shine" })
  assert.equal(nonLegacy.answers.primary_concern, undefined)

  const profile = buildProfileDataFromPersonalPlanCanonicalProfile({
    modelVersion: "personal_plan_canonical_v1",
    ...adapted.answers,
  })
  assert.equal("primary_concern" in profile, false, "the shared projection stays column-stable")
})

const quizSource = readFileSync(
  new URL("../src/components/personal-plan-quiz/personal-plan-quiz.tsx", import.meta.url),
  "utf8",
)

test("the recurrence prompt and write use the stated pick, never an inferred ranking", () => {
  assert.doesNotMatch(quizSource, /resolvePrimaryPersonalPlanConcern/)
  assert.equal(quizSource.match(/resolveStatedPersonalPlanConcern\(answers\)/g)?.length, 2)
})

test("the concerns screen opens the shared main-problem sheet for two or more concerns", () => {
  assert.match(quizSource, /<QuizMainProblemSheet/)
  assert.match(quizSource, /requiresPrimaryConcernPick\(answers\.currentConcerns \?\? \[\]\)/)
})

test("the adapter's three-concern cap keeps a stated pick that sorts outside the first three", () => {
  // Fixed adapter order: hair_damage, breakage, split_ends, dryness, tangling, frizz.
  const adapted = adaptPersonalPlanAnswersForOffer({
    ...ANSWERS,
    currentConcerns: ["hair_damage", "breakage", "split_ends", "tangling", "frizz_flyaways"],
    primaryConcern: "frizz_flyaways",
  })
  assert.deepEqual(adapted.answers.concerns, ["hair_damage", "breakage", "frizz"])
  assert.equal(adapted.answers.primary_concern, "frizz")

  // Without a pick (or with one already inside the cap) nothing changes.
  const unstated = adaptPersonalPlanAnswersForOffer({
    ...ANSWERS,
    currentConcerns: ["hair_damage", "breakage", "split_ends", "tangling", "frizz_flyaways"],
  })
  assert.deepEqual(unstated.answers.concerns, ["hair_damage", "breakage", "split_ends"])
  assert.equal(unstated.answers.primary_concern, undefined)
})
