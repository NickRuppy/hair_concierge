export type PersonalPlanStageDestination = "/plan-start" | "/routine" | "/anwendung"

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

type StageNavigationIntent = {
  version: 1
  destination: PersonalPlanStageDestination
  createdAt: number
}

const STORAGE_KEY = "chaarlie:personal-plan:stage-navigation:v1"
export const PERSONAL_PLAN_STAGE_NAVIGATION_TTL_MS = 15_000

export function writePersonalPlanStageNavigationIntent(
  storage: StorageLike,
  destination: PersonalPlanStageDestination,
  now = Date.now(),
): boolean {
  try {
    const intent: StageNavigationIntent = { version: 1, destination, createdAt: now }
    storage.setItem(STORAGE_KEY, JSON.stringify(intent))
    return true
  } catch {
    return false
  }
}

export function consumePersonalPlanStageNavigationIntent(
  storage: StorageLike,
  destination: PersonalPlanStageDestination,
  now = Date.now(),
): boolean {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return false
    storage.removeItem(STORAGE_KEY)
    const parsed = JSON.parse(raw) as Partial<StageNavigationIntent>
    return (
      parsed.version === 1 &&
      parsed.destination === destination &&
      typeof parsed.createdAt === "number" &&
      parsed.createdAt <= now &&
      now - parsed.createdAt <= PERSONAL_PLAN_STAGE_NAVIGATION_TTL_MS
    )
  } catch {
    return false
  }
}

export function markPersonalPlanStageNavigation(destination: PersonalPlanStageDestination) {
  if (typeof window === "undefined") return false
  return writePersonalPlanStageNavigationIntent(window.sessionStorage, destination)
}

export function consumePersonalPlanStageNavigation(destination: PersonalPlanStageDestination) {
  if (typeof window === "undefined") return false
  return consumePersonalPlanStageNavigationIntent(window.sessionStorage, destination)
}
