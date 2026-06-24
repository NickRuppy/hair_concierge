import assert from "node:assert/strict"
import test from "node:test"

import {
  QUIZ_DRAFT_STORAGE_KEY,
  QUIZ_DRAFT_TTL_MS,
  clearQuizDraft,
  loadQuizDraft,
  saveQuizDraft,
} from "../src/lib/quiz/draft"

class MemoryStorage implements Storage {
  private data = new Map<string, string>()

  get length() {
    return this.data.size
  }

  clear() {
    this.data.clear()
  }

  getItem(key: string) {
    return this.data.get(key) ?? null
  }

  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null
  }

  removeItem(key: string) {
    this.data.delete(key)
  }

  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
}

test("quiz draft stores only restorable quiz answers and progress", () => {
  const storage = new MemoryStorage()
  const quizStateWithLeadFields = {
    step: 12 as const,
    answers: {
      structure: "wavy",
      hair_length: "medium" as const,
      goals: ["shine"],
    },
    lead: {
      name: "Lea",
      email: "lea@example.com",
      marketingConsent: true,
    },
    leadId: "550e8400-e29b-41d4-a716-446655440000",
  }

  saveQuizDraft(quizStateWithLeadFields, storage)

  const raw = storage.getItem(QUIZ_DRAFT_STORAGE_KEY)
  assert.ok(raw)
  const stored = JSON.parse(raw)

  assert.equal(stored.version, 1)
  assert.equal(stored.step, 12)
  assert.deepEqual(stored.answers, {
    structure: "wavy",
    hair_length: "medium",
    goals: ["shine"],
  })
  assert.equal(JSON.stringify(stored).includes("lea@example.com"), false)
  assert.equal(JSON.stringify(stored).includes("Lea"), false)
  assert.equal(JSON.stringify(stored).includes("550e8400"), false)
})

test("quiz draft resumes post-lead quiz states from lead capture instead of storing PII", () => {
  const storage = new MemoryStorage()
  const quizStateWithLeadFields = {
    step: 10 as const,
    answers: { structure: "curly", hair_length: "medium" as const },
    lead: { name: "Mia", email: "mia@example.com", marketingConsent: false },
    leadId: "550e8400-e29b-41d4-a716-446655440000",
  }

  saveQuizDraft(quizStateWithLeadFields, storage)

  const draft = loadQuizDraft(storage)

  assert.equal(draft?.step, 9)
  assert.deepEqual(draft?.answers, { structure: "curly", hair_length: "medium" })
})

test("stored post-lead quiz draft steps resume from lead capture", () => {
  for (const step of [10, 11, 14]) {
    const storage = new MemoryStorage()

    storage.setItem(
      QUIZ_DRAFT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        step,
        answers: { structure: "wavy", hair_length: "medium" },
      }),
    )

    const draft = loadQuizDraft(storage)

    assert.equal(draft?.step, 9)
    assert.deepEqual(draft?.answers, { structure: "wavy", hair_length: "medium" })
  }
})

test("stored quiz drafts can resume at the hair length question", () => {
  const storage = new MemoryStorage()

  storage.setItem(
    QUIZ_DRAFT_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      step: 15,
      answers: {
        structure: "wavy",
        thickness: "normal",
        density: "medium",
      },
    }),
  )

  const draft = loadQuizDraft(storage)

  assert.equal(draft?.step, 15)
  assert.deepEqual(draft?.answers, {
    structure: "wavy",
    thickness: "normal",
    density: "medium",
  })
})

test("legacy quiz drafts after density resume at hair length when hair length is missing", () => {
  for (const step of [4, 5, 6, 7, 8, 9, 10, 11, 12, 14]) {
    const storage = new MemoryStorage()

    storage.setItem(
      QUIZ_DRAFT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        step,
        answers: {
          structure: "wavy",
          thickness: "normal",
          density: "medium",
        },
      }),
    )

    const draft = loadQuizDraft(storage)

    assert.equal(draft?.step, 15)
  }
})

test("quiz drafts after hair length keep their original step when hair length is present", () => {
  const storage = new MemoryStorage()

  storage.setItem(
    QUIZ_DRAFT_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      step: 4,
      answers: {
        structure: "wavy",
        thickness: "normal",
        density: "medium",
        hair_length: "medium",
      },
    }),
  )

  const draft = loadQuizDraft(storage)

  assert.equal(draft?.step, 4)
  assert.equal(draft?.answers.hair_length, "medium")
})

test("stored quiz draft answers are normalized before restore", () => {
  const storage = new MemoryStorage()

  storage.setItem(
    QUIZ_DRAFT_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      step: 12,
      answers: {
        structure: "wavy",
        hair_length: "medium",
        goals: "volume",
        concerns: ["frizz", "unknown"],
        treatment: ["natur", "gefaerbt"],
        unexpected: "ignore me",
      },
    }),
  )

  const draft = loadQuizDraft(storage)

  assert.equal(draft?.step, 12)
  assert.deepEqual(draft?.answers, {
    structure: "wavy",
    hair_length: "medium",
    concerns: ["frizz"],
    treatment: ["gefaerbt"],
  })
})

test("expired quiz drafts are ignored and removed", () => {
  const storage = new MemoryStorage()

  storage.setItem(
    QUIZ_DRAFT_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      savedAt: Date.now() - QUIZ_DRAFT_TTL_MS - 1,
      step: 7,
      answers: { treatment: ["natur"] },
    }),
  )

  assert.equal(loadQuizDraft(storage), null)
  assert.equal(storage.getItem(QUIZ_DRAFT_STORAGE_KEY), null)
})

test("invalid quiz draft steps are ignored and removed", () => {
  const storage = new MemoryStorage()

  storage.setItem(
    QUIZ_DRAFT_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      step: 999,
      answers: { structure: "wavy" },
    }),
  )

  assert.equal(loadQuizDraft(storage), null)
  assert.equal(storage.getItem(QUIZ_DRAFT_STORAGE_KEY), null)
})

test("clearing a quiz draft removes the browser entry", () => {
  const storage = new MemoryStorage()
  saveQuizDraft({ step: 2, answers: { structure: "straight" } }, storage)

  clearQuizDraft(storage)

  assert.equal(storage.getItem(QUIZ_DRAFT_STORAGE_KEY), null)
})

test("quiz store saves the completed page draft when advancing", async () => {
  const storage = new MemoryStorage()
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: storage },
    configurable: true,
  })

  const { useQuizStore } = await import("../src/lib/quiz/store")
  useQuizStore.getState().reset()
  useQuizStore.getState().setAnswer("structure", "wavy")
  useQuizStore.getState().setLeadField("name", "Lea")
  useQuizStore.getState().setLeadField("email", "lea@example.com")

  useQuizStore.getState().goNext()

  const draft = loadQuizDraft(storage)
  assert.equal(draft?.step, 3)
  assert.deepEqual(draft?.answers, { structure: "wavy" })

  const raw = storage.getItem(QUIZ_DRAFT_STORAGE_KEY) ?? ""
  assert.equal(raw.includes("lea@example.com"), false)
  assert.equal(raw.includes("Lea"), false)

  Reflect.deleteProperty(globalThis, "window")
})
