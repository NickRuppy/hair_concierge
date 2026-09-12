import assert from "node:assert/strict"
import test from "node:test"
import { QUIZ_DRAFT_STORAGE_KEY, saveQuizDraft } from "../src/lib/quiz/draft"
import { useQuizStore } from "../src/lib/quiz/store"

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

function withBrowser<T>(run: (storage: MemoryStorage) => T): T {
  const storage = new MemoryStorage()
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: storage },
    configurable: true,
  })
  try {
    return run(storage)
  } finally {
    Reflect.deleteProperty(globalThis, "window")
  }
}

test("an organic quiz store carries no funnel package", () => {
  useQuizStore.getState().reset()
  useQuizStore.getState().setFunnelPackageKey(null)

  assert.equal(useQuizStore.getState().funnelPackageKey, null)
})

test("the server-resolved package key is authoritative in both directions", () => {
  useQuizStore.getState().setFunnelPackageKey("scan_v1")
  assert.equal(useQuizStore.getState().funnelPackageKey, "scan_v1")

  useQuizStore.getState().setFunnelPackageKey("default_organic")
  assert.equal(useQuizStore.getState().funnelPackageKey, "default_organic")

  useQuizStore.getState().setFunnelPackageKey(null)
  assert.equal(useQuizStore.getState().funnelPackageKey, null)
})

test("the browser bootstrap may only fill a package key the cookie did not deliver", () => {
  useQuizStore.getState().setFunnelPackageKey("scan_v1")
  useQuizStore.getState().fillFunnelPackageKeyIfMissing("default_organic")
  assert.equal(useQuizStore.getState().funnelPackageKey, "scan_v1")

  useQuizStore.getState().setFunnelPackageKey(null)
  useQuizStore.getState().fillFunnelPackageKeyIfMissing("scan_v1")
  assert.equal(useQuizStore.getState().funnelPackageKey, "scan_v1")

  useQuizStore.getState().setFunnelPackageKey(null)
  useQuizStore.getState().fillFunnelPackageKeyIfMissing(null)
  assert.equal(useQuizStore.getState().funnelPackageKey, null)
})

test("restoring a browser draft keeps the funnel package of the running session", () => {
  withBrowser((storage) => {
    saveQuizDraft({ step: 3, answers: { structure: "wavy" } }, storage)
    assert.notEqual(storage.getItem(QUIZ_DRAFT_STORAGE_KEY), null)

    useQuizStore.getState().setFunnelPackageKey("scan_v1")
    assert.equal(useQuizStore.getState().restoreDraft(), true)

    const state = useQuizStore.getState()
    assert.equal(state.funnelPackageKey, "scan_v1")
    assert.equal(state.step, 3)
    assert.deepEqual(state.answers, { structure: "wavy" })
  })
})

test("a moderator fresh start clears quiz progress but keeps the funnel package", () => {
  withBrowser(() => {
    useQuizStore.getState().setFunnelPackageKey("scan_v1")
    useQuizStore.getState().setAnswer("structure", "coily")
    useQuizStore.getState().setLeadField("name", "Lea")

    useQuizStore.getState().reset()

    const state = useQuizStore.getState()
    assert.equal(state.funnelPackageKey, "scan_v1")
    assert.equal(state.step, 2)
    assert.deepEqual(state.answers, {})
    assert.equal(state.lead.name, "")
  })
})
