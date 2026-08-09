export const PERSONAL_PLAN_READY_MESSAGES = [
  "Deine Zahlung ist bestätigt.",
  "Dein persönlicher Haarplan ist vorbereitet.",
  "Sieh dir jetzt zuerst deinen Bedarfsplan an.",
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
