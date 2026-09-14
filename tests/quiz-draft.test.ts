import assert from "node:assert/strict"
import test from "node:test"

import type { QuizAnswers } from "../src/lib/quiz/types"
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
      goals: ["shine"] as "shine"[],
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

  assert.equal(stored.version, 2)
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

test("quiz store applies verified partner identity and consent mode atomically", async () => {
  const storage = new MemoryStorage()
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: storage },
    configurable: true,
  })

  const { useQuizStore } = await import("../src/lib/quiz/store")
  useQuizStore.getState().reset()
  useQuizStore.getState().setPartnerLeadIdentity({
    name: "Lea Sommer",
    email: "lea@example.test",
  })

  const state = useQuizStore.getState()
  assert.equal(state.leadCaptureMode, "partner")
  assert.equal(state.leadCaptureSubStep, "consent")
  assert.deepEqual(state.lead, {
    name: "Lea Sommer",
    email: "lea@example.test",
    marketingConsent: false,
  })

  state.reset()
  assert.equal(useQuizStore.getState().leadCaptureMode, "regular")
  assert.equal(useQuizStore.getState().leadCaptureSubStep, "name")
  Reflect.deleteProperty(globalThis, "window")
})

test("quiz drafts record the funnel package the progress belongs to", () => {
  const storage = new MemoryStorage()

  saveQuizDraft(
    {
      step: 16,
      answers: { structure: "wavy", thickness: "fine", density: "medium" },
      funnelPackageKey: "scan_v1",
    },
    storage,
  )

  const raw = storage.getItem(QUIZ_DRAFT_STORAGE_KEY)
  assert.ok(raw)
  const stored = JSON.parse(raw)
  assert.equal(stored.version, 2)
  assert.equal(stored.step, 16)
  assert.equal(stored.funnelPackageKey, "scan_v1")

  const draft = loadQuizDraft(storage)
  assert.equal(draft?.step, 16)
  assert.equal(draft?.funnelPackageKey, "scan_v1")
})

test("an organic quiz draft carries no funnel package", () => {
  const storage = new MemoryStorage()

  saveQuizDraft({ step: 3, answers: { structure: "wavy" } }, storage)

  assert.equal(loadQuizDraft(storage)?.funnelPackageKey, null)
})

test("legacy version 1 quiz drafts still restore", () => {
  const storage = new MemoryStorage()

  storage.setItem(
    QUIZ_DRAFT_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      step: 4,
      answers: { structure: "wavy", thickness: "normal", hair_length: "medium" },
    }),
  )

  const draft = loadQuizDraft(storage)
  assert.equal(draft?.step, 4)
  assert.equal(draft?.funnelPackageKey, null)
  assert.deepEqual(draft?.answers, {
    structure: "wavy",
    thickness: "normal",
    hair_length: "medium",
  })
})

test("insert drafts without a hair length still resume at the hair length question", () => {
  for (const step of [17, 18]) {
    const storage = new MemoryStorage()

    storage.setItem(
      QUIZ_DRAFT_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        savedAt: Date.now(),
        step,
        answers: { structure: "wavy", thickness: "normal", density: "medium" },
        funnelPackageKey: "scan_v1",
      }),
    )

    assert.equal(loadQuizDraft(storage)?.step, 15)
  }
})

async function restoreDraftWithPackageKey(storage: MemoryStorage, funnelPackageKey: string | null) {
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: storage },
    configurable: true,
  })
  try {
    const { useQuizStore } = await import("../src/lib/quiz/store")
    // `reset` clears the stored draft, so the fixture is written back before
    // the quiz restores it.
    const storedDraft = storage.getItem(QUIZ_DRAFT_STORAGE_KEY)
    useQuizStore.getState().reset()
    if (storedDraft) storage.setItem(QUIZ_DRAFT_STORAGE_KEY, storedDraft)
    useQuizStore.getState().setFunnelPackageKey(funnelPackageKey)
    assert.equal(useQuizStore.getState().restoreDraft(), true)
    return useQuizStore.getState()
  } finally {
    Reflect.deleteProperty(globalThis, "window")
  }
}

const SCAN_DRAFT_ANSWERS = {
  structure: "wavy",
  thickness: "normal",
  density: "medium",
  hair_length: "medium",
  fingertest: "leicht_uneben",
  pulltest: "stretches_bounces",
  treatment: ["natur"],
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
} satisfies QuizAnswers

test("a scan draft on an insert restores to the insert inside the scan package", async () => {
  const storage = new MemoryStorage()
  saveQuizDraft(
    {
      step: 16,
      answers: { structure: "wavy", thickness: "normal", density: "medium" },
      funnelPackageKey: "scan_v1",
    },
    storage,
  )

  const state = await restoreDraftWithPackageKey(storage, "scan_v1")

  assert.equal(state.step, 16)
  assert.equal(state.funnelPackageKey, "scan_v1")
})

test("a scan draft on an insert restores to the preceding question when the quiz is organic", async () => {
  const storage = new MemoryStorage()
  saveQuizDraft({ step: 17, answers: SCAN_DRAFT_ANSWERS, funnelPackageKey: "scan_v1" }, storage)

  const state = await restoreDraftWithPackageKey(storage, null)

  assert.equal(state.step, 6)
  assert.equal(state.funnelPackageKey, null)
  assert.equal(state.answers.scalp_type, "ausgeglichen")
})

test("an organic draft keeps its step when the quiz runs the scan package", async () => {
  const storage = new MemoryStorage()
  saveQuizDraft({ step: 8, answers: SCAN_DRAFT_ANSWERS }, storage)

  const state = await restoreDraftWithPackageKey(storage, "scan_v1")

  assert.equal(state.step, 8)
  assert.equal(state.funnelPackageKey, "scan_v1")
})

test("a legacy draft restores its answers under the current funnel package", async () => {
  const storage = new MemoryStorage()
  storage.setItem(
    QUIZ_DRAFT_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      step: 12,
      answers: SCAN_DRAFT_ANSWERS,
    }),
  )

  const state = await restoreDraftWithPackageKey(storage, "scan_v1")

  assert.equal(state.step, 12)
  assert.equal(state.funnelPackageKey, "scan_v1")
  assert.equal(state.answers.structure, "wavy")
})
