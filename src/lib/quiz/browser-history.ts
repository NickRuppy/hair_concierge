import { QUIZ_QUESTION_STEPS } from "./questions"
import type { LeadCaptureMode, LeadCaptureSubStep, QuizStep } from "./types"

export const LEGACY_QUIZ_HISTORY_DEPTH_KEY = "legacyQuizDepth"

type BrowserHistoryLike = {
  state: unknown
  pushState: (state: unknown, unused: string, url?: string | URL | null) => void
  replaceState: (state: unknown, unused: string, url?: string | URL | null) => void
}

type BrowserWindowLike = {
  history: BrowserHistoryLike
  location: { href: string }
}

const REGULAR_QUIZ_SCREEN_ORDER: ReadonlyArray<{
  step: QuizStep
  leadCaptureSubStep?: LeadCaptureSubStep
}> = [
  ...QUIZ_QUESTION_STEPS.map((step) => ({ step })),
  { step: 9, leadCaptureSubStep: "name" },
  { step: 9, leadCaptureSubStep: "email" },
  { step: 9, leadCaptureSubStep: "consent" },
  { step: 10 },
  { step: 11 },
  { step: 14 },
]

const PARTNER_QUIZ_SCREEN_ORDER = REGULAR_QUIZ_SCREEN_ORDER.filter(
  (entry) =>
    entry.step !== 9 ||
    entry.leadCaptureSubStep === undefined ||
    entry.leadCaptureSubStep === "consent",
)

function asStateRecord(state: unknown): Record<string, unknown> {
  return state && typeof state === "object" && !Array.isArray(state)
    ? { ...(state as Record<string, unknown>) }
    : {}
}

export function getLegacyQuizScreenPosition(
  step: QuizStep,
  leadCaptureSubStep: LeadCaptureSubStep,
  leadCaptureMode: LeadCaptureMode = "regular",
): number {
  const screenOrder =
    leadCaptureMode === "partner" ? PARTNER_QUIZ_SCREEN_ORDER : REGULAR_QUIZ_SCREEN_ORDER
  const index = screenOrder.findIndex(
    (entry) =>
      entry.step === step && (step !== 9 || entry.leadCaptureSubStep === leadCaptureSubStep),
  )
  return index === -1 ? 0 : index
}

export function getLegacyQuizBrowserHistoryDepth(state: unknown): number | null {
  if (!state || typeof state !== "object" || Array.isArray(state)) return null
  const depth = (state as Record<string, unknown>)[LEGACY_QUIZ_HISTORY_DEPTH_KEY]
  return typeof depth === "number" && Number.isInteger(depth) && depth >= 0 ? depth : null
}

export function ensureLegacyQuizBrowserHistoryState(win: BrowserWindowLike = window): number {
  const currentDepth = getLegacyQuizBrowserHistoryDepth(win.history.state)
  if (currentDepth !== null) return currentDepth

  win.history.replaceState(
    { ...asStateRecord(win.history.state), [LEGACY_QUIZ_HISTORY_DEPTH_KEY]: 0 },
    "",
    win.location.href,
  )
  return 0
}

export function pushLegacyQuizBrowserHistoryState(win: BrowserWindowLike = window): number {
  const nextDepth = ensureLegacyQuizBrowserHistoryState(win) + 1
  win.history.pushState(
    { ...asStateRecord(win.history.state), [LEGACY_QUIZ_HISTORY_DEPTH_KEY]: nextDepth },
    "",
    win.location.href,
  )
  return nextDepth
}

export function seedLegacyQuizBrowserHistoryToDepth(
  targetDepth: number,
  win: BrowserWindowLike = window,
): number {
  const normalizedTarget = Math.max(0, Math.floor(targetDepth))
  let depth = ensureLegacyQuizBrowserHistoryState(win)
  while (depth < normalizedTarget) {
    depth = pushLegacyQuizBrowserHistoryState(win)
  }
  return depth
}

export function shouldHandleLegacyQuizPopState(state: unknown): boolean {
  return getLegacyQuizBrowserHistoryDepth(state) !== null
}
