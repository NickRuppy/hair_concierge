import { QUIZ_DRAFT_STORAGE_KEY } from "@/lib/quiz/draft"
import {
  PERSONAL_PLAN_QUIZ_DRAFT_STORAGE_KEY,
  PERSONAL_PLAN_PREPARED_PLAN_STORAGE_KEY,
} from "./draft"

export type QuizDraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

/** A verified moderator start gets fresh storage, without reading legacy draft keys. */
export function scopeQuizDraftStorage(
  storage: QuizDraftStorage,
  scope?: string | null,
): QuizDraftStorage {
  if (!scope) return storage
  const keyFor = (key: string) => `chaarlie:moderator:${scope}:${key}`
  return {
    getItem: (key) => storage.getItem(keyFor(key)),
    setItem: (key, value) => storage.setItem(keyFor(key), value),
    removeItem: (key) => storage.removeItem(keyFor(key)),
  }
}

export function clearUnscopedQuizDraftStorage(storage: QuizDraftStorage): void {
  for (const key of [
    QUIZ_DRAFT_STORAGE_KEY,
    PERSONAL_PLAN_QUIZ_DRAFT_STORAGE_KEY,
    PERSONAL_PLAN_PREPARED_PLAN_STORAGE_KEY,
  ]) {
    try {
      storage.removeItem(key)
    } catch {
      /* Storage can be blocked; the fresh scope still cannot restore it. */
    }
  }
}
