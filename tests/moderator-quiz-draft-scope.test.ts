import assert from "node:assert/strict"
import test from "node:test"
import {
  scopeQuizDraftStorage,
  clearUnscopedQuizDraftStorage,
} from "../src/lib/personal-plan-quiz/draft-scope"

test("fresh moderator draft scope cannot restore legacy or another start's answers", () => {
  const values = new Map<string, string>([["draft", "legacy answers"]])
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v)
    },
    removeItem: (k: string) => {
      values.delete(k)
    },
  }
  const first = scopeQuizDraftStorage(storage, "first")
  const second = scopeQuizDraftStorage(storage, "second")
  assert.equal(first.getItem("draft"), null)
  first.setItem("draft", "new answers")
  assert.equal(scopeQuizDraftStorage(storage, "first").getItem("draft"), "new answers")
  assert.equal(second.getItem("draft"), null)
  second.removeItem("draft")
  assert.equal(first.getItem("draft"), "new answers")
  assert.equal(scopeQuizDraftStorage(storage).getItem("draft"), "legacy answers")
})

test("authenticated moderator entry clears only known unscoped quiz data", () => {
  const values = new Map([
    ["chaarlie:quiz-draft:v1", "legacy"],
    ["chaarlie:personal-plan-quiz-draft:v4", "old personal plan"],
    ["chaarlie:personal-plan-quiz-prepared:v1", "old claim"],
    ["other-app-preference", "keep"],
    ["chaarlie:moderator:fresh:chaarlie:personal-plan-quiz-draft:v4", "fresh answers"],
  ])
  clearUnscopedQuizDraftStorage({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  })
  assert.deepEqual(
    [...values.keys()],
    ["other-app-preference", "chaarlie:moderator:fresh:chaarlie:personal-plan-quiz-draft:v4"],
  )
})
