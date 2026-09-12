import { QUIZ_QUESTION_STEPS } from "./questions"
import type { LeadCaptureMode, LeadCaptureSubStep, QuizStep } from "./types"

/**
 * Which screens a quiz runs through, in which order — the single source for the
 * store, the shell transitions, the browser history and the draft.
 *
 * Organic traffic keeps exactly the screen sequence it has always had. A funnel
 * package may add screens; `scan_v1` adds three scanner inserts, each directly
 * after the question it builds on.
 */

/** Funnel package whose quiz carries the scanner inserts. */
export const SCAN_FUNNEL_PACKAGE_KEY = "scan_v1"

const LEAD_CAPTURE_STEP: QuizStep = 9
const LEAD_CAPTURE_SUB_STEPS: readonly LeadCaptureSubStep[] = ["name", "email", "consent"]

/** The organic quiz: every question, then lead capture, analysis, result, welcome. */
const ORGANIC_SCREEN_ORDER: readonly QuizStep[] = [...QUIZ_QUESTION_STEPS, 9, 10, 11, 14]

const SCAN_INSERTS: readonly { step: QuizStep; afterStep: QuizStep }[] = [
  { step: 16, afterStep: 13 },
  { step: 17, afterStep: 6 },
  { step: 18, afterStep: 12 },
]

const SCAN_SCREEN_ORDER: readonly QuizStep[] = ORGANIC_SCREEN_ORDER.flatMap((step) => {
  const insert = SCAN_INSERTS.find((entry) => entry.afterStep === step)
  return insert ? [step, insert.step] : [step]
})

export type QuizHistoryScreen = {
  step: QuizStep
  leadCaptureSubStep?: LeadCaptureSubStep
}

function expandHistoryScreens(
  order: readonly QuizStep[],
  mode: LeadCaptureMode,
): readonly QuizHistoryScreen[] {
  // Lead capture is one store step but three browser-history entries, so system
  // Back maps to one visible quiz screen at a time. A partner quiz never shows
  // the identity screens, so they must not consume history entries either.
  const expanded: QuizHistoryScreen[] = order.flatMap((step) =>
    step === LEAD_CAPTURE_STEP
      ? LEAD_CAPTURE_SUB_STEPS.map((leadCaptureSubStep) => ({ step, leadCaptureSubStep }))
      : [{ step }],
  )

  if (mode !== "partner") return expanded
  return expanded.filter(
    (entry) =>
      entry.step !== LEAD_CAPTURE_STEP ||
      entry.leadCaptureSubStep === undefined ||
      entry.leadCaptureSubStep === "consent",
  )
}

const HISTORY_SCREEN_ORDERS = {
  organic: {
    regular: expandHistoryScreens(ORGANIC_SCREEN_ORDER, "regular"),
    partner: expandHistoryScreens(ORGANIC_SCREEN_ORDER, "partner"),
  },
  scan: {
    regular: expandHistoryScreens(SCAN_SCREEN_ORDER, "regular"),
    partner: expandHistoryScreens(SCAN_SCREEN_ORDER, "partner"),
  },
} as const

function isScanPackage(packageKey: string | null): boolean {
  return packageKey === SCAN_FUNNEL_PACKAGE_KEY
}

/** Every screen the given package runs, in order. Unknown keys behave organically. */
export function getQuizScreenOrder(packageKey: string | null): readonly QuizStep[] {
  return isScanPackage(packageKey) ? SCAN_SCREEN_ORDER : ORGANIC_SCREEN_ORDER
}

/** Projection: the order `goNext` / `goBack` walk. */
export function getQuizStepOrder(packageKey: string | null): readonly QuizStep[] {
  return getQuizScreenOrder(packageKey)
}

/** Projection: the order the shell derives its forward/back transition from. */
export function getQuizMotionOrder(packageKey: string | null): readonly QuizStep[] {
  return getQuizScreenOrder(packageKey)
}

/** Projection: one entry per browser-history entry (lead capture expanded). */
export function getQuizHistoryScreenOrder(
  packageKey: string | null,
  mode: LeadCaptureMode,
): readonly QuizHistoryScreen[] {
  const orders = isScanPackage(packageKey)
    ? HISTORY_SCREEN_ORDERS.scan
    : HISTORY_SCREEN_ORDERS.organic
  return mode === "partner" ? orders.partner : orders.regular
}

/** Projection: the answered questions, in order. Inserts are not questions. */
export function getQuizQuestionStepOrder(packageKey: string | null): readonly QuizStep[] {
  return getQuizScreenOrder(packageKey).filter(isQuizQuestionStep)
}

export function isQuizQuestionStep(step: QuizStep): boolean {
  return QUIZ_QUESTION_STEPS.includes(step as (typeof QUIZ_QUESTION_STEPS)[number])
}

export function isQuizInsertStep(step: QuizStep): boolean {
  return SCAN_INSERTS.some((entry) => entry.step === step)
}

/**
 * Which question's progress an insert screen shows: an insert adds no question,
 * so bar and counter stay on the state of the question right before it.
 */
export function getQuizProgressStep(step: QuizStep, packageKey: string | null): QuizStep {
  if (!isQuizInsertStep(step)) return step

  const packageOrder = getQuizScreenOrder(packageKey)
  // An insert can be asked about from a package that does not run it (a draft
  // or a changed cookie); its anchor question is then read from the order that
  // does contain it.
  const order = packageOrder.includes(step) ? packageOrder : SCAN_SCREEN_ORDER
  for (let index = order.indexOf(step) - 1; index >= 0; index--) {
    const candidate = order[index]
    if (isQuizQuestionStep(candidate)) return candidate
  }
  return step
}

/**
 * Maps a step that the current package does not run onto the nearest preceding
 * question, so a restored draft or a changed funnel cookie can never skip one.
 */
export function normalizeQuizStepForPackage(step: QuizStep, packageKey: string | null): QuizStep {
  return getQuizStepOrder(packageKey).includes(step) ? step : getQuizProgressStep(step, packageKey)
}

/**
 * `quiz_step_viewed` describes the question funnel and routes to Customer.io.
 * Inserts report through their own event instead.
 */
export function shouldTrackQuizStepViewed(step: QuizStep): boolean {
  return !isQuizInsertStep(step)
}
