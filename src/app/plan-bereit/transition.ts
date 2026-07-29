export const PERSONAL_PLAN_READY_MESSAGES = [
  "Heute startest du mit deinem persönlichen Haarplan.",
  "In einer Woche kennst du deine Routine ganz genau.",
  "In vier Wochen sieht dein Haar sichtbar schöner und gesünder aus.",
] as const

export const PERSONAL_PLAN_READY_MESSAGE_MS = 2_200
export const PERSONAL_PLAN_READY_MIN_STORY_MS = 6_600
export const PERSONAL_PLAN_READY_POLL_INTERVAL_MS = 1_500
export const PERSONAL_PLAN_READY_POLL_LIMIT = 20

export function personalPlanStoryIndexAt(elapsedMs: number) {
  return Math.min(
    PERSONAL_PLAN_READY_MESSAGES.length - 1,
    Math.floor(Math.max(0, elapsedMs) / PERSONAL_PLAN_READY_MESSAGE_MS),
  )
}
