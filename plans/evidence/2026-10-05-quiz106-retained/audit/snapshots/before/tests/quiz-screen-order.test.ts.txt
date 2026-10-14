import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { getLegacyQuizScreenPosition } from "../src/lib/quiz/browser-history"
import { getQuizQuestionNumber, QUIZ_QUESTION_STEPS } from "../src/lib/quiz/questions"
import {
  getQuizHistoryScreenOrder,
  getQuizMotionOrder,
  getQuizProgressStep,
  getQuizQuestionStepOrder,
  getQuizScreenOrder,
  getQuizStepOrder,
  isQuizInsertStep,
  normalizeQuizStepForPackage,
  SCAN_FUNNEL_PACKAGE_KEY,
  shouldTrackQuizStepViewed,
} from "../src/lib/quiz/screen-order"
import { useQuizStore } from "../src/lib/quiz/store"
import type { LeadCaptureSubStep, QuizStep } from "../src/lib/quiz/types"

/**
 * Literal copies of the constants the package-aware projections replaced:
 * `STEP_ORDER` (store), `QUIZ_MOTION_ORDER` (quiz shell) and
 * `REGULAR_QUIZ_SCREEN_ORDER` / `PARTNER_QUIZ_SCREEN_ORDER` (browser history).
 * Organic traffic must keep running through exactly these screens.
 */
const TODAYS_STEP_ORDER: QuizStep[] = [2, 3, 13, 15, 4, 5, 7, 6, 8, 12, 9, 10, 11, 14]
const TODAYS_MOTION_ORDER: QuizStep[] = [2, 3, 13, 15, 4, 5, 7, 6, 8, 12, 9, 10, 11, 14]
const TODAYS_REGULAR_HISTORY_ORDER: { step: QuizStep; leadCaptureSubStep?: LeadCaptureSubStep }[] =
  [
    { step: 2 },
    { step: 3 },
    { step: 13 },
    { step: 15 },
    { step: 4 },
    { step: 5 },
    { step: 7 },
    { step: 6 },
    { step: 8 },
    { step: 12 },
    { step: 9, leadCaptureSubStep: "name" },
    { step: 9, leadCaptureSubStep: "email" },
    { step: 9, leadCaptureSubStep: "consent" },
    { step: 10 },
    { step: 11 },
    { step: 14 },
  ]
const TODAYS_PARTNER_HISTORY_ORDER = TODAYS_REGULAR_HISTORY_ORDER.filter(
  (entry) =>
    entry.step !== 9 ||
    entry.leadCaptureSubStep === undefined ||
    entry.leadCaptureSubStep === "consent",
)

const SCAN_STEP_ORDER: QuizStep[] = [2, 3, 13, 16, 15, 4, 5, 7, 6, 17, 8, 12, 18, 9, 10, 11, 14]

const quizPageSource = readFileSync(new URL("../src/app/quiz/page.tsx", import.meta.url), "utf8")

function resetStore(packageKey: string | null) {
  useQuizStore.getState().reset()
  useQuizStore.getState().setFunnelPackageKey(packageKey)
}

test("the organic screen order is byte-identical to the constants it replaced", () => {
  for (const packageKey of [null, "default_organic", "some_unknown_package"]) {
    assert.deepEqual([...getQuizScreenOrder(packageKey)], TODAYS_STEP_ORDER, `key ${packageKey}`)
    assert.deepEqual([...getQuizStepOrder(packageKey)], TODAYS_STEP_ORDER, `key ${packageKey}`)
    assert.deepEqual([...getQuizMotionOrder(packageKey)], TODAYS_MOTION_ORDER, `key ${packageKey}`)
    assert.deepEqual(
      [...getQuizHistoryScreenOrder(packageKey, "regular")],
      TODAYS_REGULAR_HISTORY_ORDER,
      `key ${packageKey}`,
    )
    assert.deepEqual(
      [...getQuizHistoryScreenOrder(packageKey, "partner")],
      TODAYS_PARTNER_HISTORY_ORDER,
      `key ${packageKey}`,
    )
  }
})

test("the scan package inserts three screens after density, scalp and goals", () => {
  assert.deepEqual([...getQuizScreenOrder(SCAN_FUNNEL_PACKAGE_KEY)], SCAN_STEP_ORDER)
  assert.deepEqual([...getQuizStepOrder(SCAN_FUNNEL_PACKAGE_KEY)], SCAN_STEP_ORDER)
  assert.deepEqual([...getQuizMotionOrder(SCAN_FUNNEL_PACKAGE_KEY)], SCAN_STEP_ORDER)
})

test("the scan history order expands lead capture and keeps the partner filter", () => {
  assert.deepEqual(
    [...getQuizHistoryScreenOrder(SCAN_FUNNEL_PACKAGE_KEY, "regular")],
    [
      { step: 2 },
      { step: 3 },
      { step: 13 },
      { step: 16 },
      { step: 15 },
      { step: 4 },
      { step: 5 },
      { step: 7 },
      { step: 6 },
      { step: 17 },
      { step: 8 },
      { step: 12 },
      { step: 18 },
      { step: 9, leadCaptureSubStep: "name" },
      { step: 9, leadCaptureSubStep: "email" },
      { step: 9, leadCaptureSubStep: "consent" },
      { step: 10 },
      { step: 11 },
      { step: 14 },
    ],
  )

  const partner = getQuizHistoryScreenOrder(SCAN_FUNNEL_PACKAGE_KEY, "partner")
  assert.equal(
    partner.filter((entry) => entry.step === 9).length,
    1,
    "partner history keeps only the consent screen of lead capture",
  )
  assert.deepEqual(
    partner.map((entry) => entry.step),
    [2, 3, 13, 16, 15, 4, 5, 7, 6, 17, 8, 12, 18, 9, 10, 11, 14],
  )
})

test("browser history positions strictly increase along the scan screen order", () => {
  const order = getQuizHistoryScreenOrder(SCAN_FUNNEL_PACKAGE_KEY, "regular")
  let previous = -1
  for (const entry of order) {
    const position = getLegacyQuizScreenPosition(
      entry.step,
      entry.leadCaptureSubStep ?? "name",
      "regular",
      SCAN_FUNNEL_PACKAGE_KEY,
    )
    assert.ok(position > previous, `position of step ${entry.step} must increase`)
    previous = position
  }

  assert.ok(
    getLegacyQuizScreenPosition(16, "name", "regular", SCAN_FUNNEL_PACKAGE_KEY) >
      getLegacyQuizScreenPosition(13, "name", "regular", SCAN_FUNNEL_PACKAGE_KEY),
  )
  assert.ok(
    getLegacyQuizScreenPosition(15, "name", "regular", SCAN_FUNNEL_PACKAGE_KEY) >
      getLegacyQuizScreenPosition(16, "name", "regular", SCAN_FUNNEL_PACKAGE_KEY),
  )
})

test("the question sequence is untouched by the inserts", () => {
  assert.deepEqual([...QUIZ_QUESTION_STEPS], [2, 3, 13, 15, 4, 5, 7, 6, 8, 12])
  const expectedNumbers: [QuizStep, number][] = [
    [2, 1],
    [3, 2],
    [13, 3],
    [15, 4],
    [4, 5],
    [5, 6],
    [7, 7],
    [6, 8],
    [8, 9],
    [12, 10],
  ]
  for (const [step, number] of expectedNumbers) {
    assert.equal(getQuizQuestionNumber(step), number, `question number of step ${step}`)
  }
  for (const step of [16, 17, 18] as QuizStep[]) {
    assert.equal(getQuizQuestionNumber(step), undefined, `insert ${step} is not a question`)
    assert.equal(isQuizInsertStep(step), true)
  }
  assert.equal(isQuizInsertStep(13), false)

  for (const packageKey of [null, SCAN_FUNNEL_PACKAGE_KEY]) {
    assert.deepEqual([...getQuizQuestionStepOrder(packageKey)], [...QUIZ_QUESTION_STEPS])
  }
})

test("progress on an insert stays on the state of the preceding question", () => {
  assert.equal(getQuizProgressStep(16, SCAN_FUNNEL_PACKAGE_KEY), 13)
  assert.equal(getQuizProgressStep(17, SCAN_FUNNEL_PACKAGE_KEY), 6)
  assert.equal(getQuizProgressStep(18, SCAN_FUNNEL_PACKAGE_KEY), 12)

  for (const step of QUIZ_QUESTION_STEPS) {
    assert.equal(getQuizProgressStep(step, SCAN_FUNNEL_PACKAGE_KEY), step)
    assert.equal(getQuizProgressStep(step, null), step)
  }
  for (const step of [9, 10, 11, 14] as QuizStep[]) {
    assert.equal(getQuizProgressStep(step, null), step)
  }
})

test("a step that the current package does not run falls back to the preceding question", () => {
  assert.equal(normalizeQuizStepForPackage(16, null), 13)
  assert.equal(normalizeQuizStepForPackage(17, null), 6)
  assert.equal(normalizeQuizStepForPackage(18, null), 12)

  for (const step of SCAN_STEP_ORDER) {
    assert.equal(normalizeQuizStepForPackage(step, SCAN_FUNNEL_PACKAGE_KEY), step)
  }
  for (const step of TODAYS_STEP_ORDER) {
    assert.equal(normalizeQuizStepForPackage(step, null), step)
  }

  // The fallback is a walk back through the order that owns the step, not a
  // rule about inserts: whatever comes out has to be a screen the target
  // package actually runs.
  for (const packageKey of [null, SCAN_FUNNEL_PACKAGE_KEY]) {
    const order = getQuizStepOrder(packageKey)
    for (const step of [...SCAN_STEP_ORDER, ...TODAYS_STEP_ORDER]) {
      assert.ok(
        order.includes(normalizeQuizStepForPackage(step, packageKey)),
        `step ${step} under ${packageKey}`,
      )
    }
  }
})

test("the scan store walks forward through the inserts", () => {
  resetStore(SCAN_FUNNEL_PACKAGE_KEY)

  const transitions: [QuizStep, QuizStep][] = [
    [13, 16],
    [16, 15],
    [6, 17],
    [17, 8],
    [12, 18],
    [18, 9],
  ]
  for (const [from, to] of transitions) {
    useQuizStore.getState().setStep(from)
    useQuizStore.getState().goNext()
    assert.equal(useQuizStore.getState().step, to, `goNext from ${from}`)
  }
})

test("the scan store walks back through the inserts", () => {
  resetStore(SCAN_FUNNEL_PACKAGE_KEY)

  const transitions: [QuizStep, QuizStep][] = [
    [15, 16],
    [16, 13],
    [8, 17],
    [17, 6],
    [9, 18],
    [18, 12],
  ]
  for (const [from, to] of transitions) {
    useQuizStore.getState().setStep(from)
    useQuizStore.getState().goBack()
    assert.equal(useQuizStore.getState().step, to, `goBack from ${from}`)
  }
})

test("an organic store never produces an insert screen", () => {
  resetStore(null)

  useQuizStore.getState().setStep(13)
  useQuizStore.getState().goNext()
  assert.equal(useQuizStore.getState().step, 15)

  useQuizStore.getState().setStep(15)
  useQuizStore.getState().goBack()
  assert.equal(useQuizStore.getState().step, 13)

  const seen: QuizStep[] = [useQuizStore.getState().step]
  useQuizStore.getState().setStep(2)
  for (let i = 0; i < TODAYS_STEP_ORDER.length + 4; i++) {
    useQuizStore.getState().goNext()
    seen.push(useQuizStore.getState().step)
  }
  assert.equal(
    seen.some((step) => isQuizInsertStep(step)),
    false,
  )
})

test("changing the package key normalizes an incompatible current step", () => {
  resetStore(SCAN_FUNNEL_PACKAGE_KEY)
  useQuizStore.getState().setStep(17)

  useQuizStore.getState().setFunnelPackageKey(null)

  assert.equal(useQuizStore.getState().step, 6)
  assert.equal(useQuizStore.getState().funnelPackageKey, null)
})

test("insert screens are excluded from the per-step quiz_step_viewed event", () => {
  for (const step of [16, 17, 18] as QuizStep[]) {
    assert.equal(shouldTrackQuizStepViewed(step), false)
  }
  for (const step of TODAYS_STEP_ORDER) {
    assert.equal(shouldTrackQuizStepViewed(step), true)
  }

  assert.match(quizPageSource, /if \(shouldTrackQuizStepViewed\(step\)\)/)
  assert.match(quizPageSource, /16: "scan_insert_problem"/)
  assert.match(quizPageSource, /17: "scan_insert_solution"/)
  assert.match(quizPageSource, /18: "scan_insert_home"/)
})
