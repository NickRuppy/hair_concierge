import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"

import { QuizFunnelPackageProvider } from "../src/components/quiz/quiz-funnel-package-provider"
import { QuizInfoStrip } from "../src/components/quiz/quiz-info-strip"
import { flushAsync, mountComponent } from "./helpers/react-hook-mount"
import { resolveQuizFunnelPackageKey } from "../src/lib/quiz/funnel-package-context"
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

test("the provider never mutates the shared store during a server render", () => {
  useQuizStore.getState().setFunnelPackageKey(null)

  const html = renderToStaticMarkup(
    <QuizFunnelPackageProvider funnelPackageKey="scan_v1">
      <span>Quiz</span>
    </QuizFunnelPackageProvider>,
  )

  assert.equal(html, "<span>Quiz</span>")
  assert.equal(useQuizStore.getState().funnelPackageKey, null)
})

test("the provider applies the package key before the first child renders", () => {
  withBrowser(() => {
    useQuizStore.getState().setFunnelPackageKey(null)
    const seen: (string | null)[] = []

    function Child() {
      seen.push(useQuizStore.getState().funnelPackageKey)
      return <span>Quiz</span>
    }

    renderToStaticMarkup(
      <QuizFunnelPackageProvider funnelPackageKey="scan_v1">
        <Child />
      </QuizFunnelPackageProvider>,
    )

    assert.deepEqual(seen, ["scan_v1"])
    assert.equal(useQuizStore.getState().funnelPackageKey, "scan_v1")
  })
})

test("the quiz reads the package key out of the signed funnel cookie", async () => {
  assert.equal(
    await resolveQuizFunnelPackageKey("signed-cookie", async () => ({
      visitorId: "10000000-0000-4000-8000-000000000001",
      sessionId: "20000000-0000-4000-8000-000000000002",
      packageKey: "scan_v1",
      issuedAt: Date.now(),
    })),
    "scan_v1",
  )
  assert.equal(await resolveQuizFunnelPackageKey(undefined, async () => null), null)
  assert.equal(await resolveQuizFunnelPackageKey("tampered", async () => null), null)
})

test("both quiz layouts initialize the store from the signed cookie", () => {
  for (const path of ["src/app/quiz/layout.tsx", "src/app/test/quiz/session/layout.tsx"]) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
    assert.match(source, /resolveQuizFunnelPackageKey\(/, path)
    assert.match(source, /FUNNEL_SESSION_COOKIE/, path)
    assert.match(source, /<QuizFunnelPackageProvider funnelPackageKey=\{funnelPackageKey\}>/, path)
  }
})

test("a scan draft resumes on the insert it was saved on", () => {
  for (const step of [17, 18] as const) {
    withBrowser((storage) => {
      saveQuizDraft(
        {
          step,
          answers: { structure: "wavy", thickness: "fine", hair_length: "medium" },
          funnelPackageKey: "scan_v1",
        },
        storage,
      )

      useQuizStore.getState().setFunnelPackageKey("scan_v1")
      assert.equal(useQuizStore.getState().restoreDraft(), true)
      assert.equal(useQuizStore.getState().step, step, `reload on insert ${step}`)
    })
  }
})

test("the same draft resumes organically on the question the insert sits behind", () => {
  const expected: [17 | 18, number][] = [
    [17, 6],
    [18, 12],
  ]
  for (const [step, question] of expected) {
    withBrowser((storage) => {
      saveQuizDraft(
        {
          step,
          answers: { structure: "wavy", thickness: "fine", hair_length: "medium" },
          funnelPackageKey: "scan_v1",
        },
        storage,
      )

      useQuizStore.getState().setFunnelPackageKey(null)
      assert.equal(useQuizStore.getState().restoreDraft(), true)
      assert.equal(useQuizStore.getState().step, question, `organic reload of insert ${step}`)
    })
  }
})

// --- the bootstrap fallback reaches context consumers, not only the store ----

const DEFAULT_INFO_STRIP_BODY =
  "10 schnelle Fragen zur Basis, dann geht’s an deine Routine und Produkte."
const SCAN_INFO_STRIP_BODY = "10 schnelle Fragen zur Basis, dann prüft der Scanner deine Produkte."

test("a server-rendered package reaches the consumer copy without any bootstrap", () => {
  useQuizStore.getState().setFunnelPackageKey(null)

  const html = renderToStaticMarkup(
    <QuizFunnelPackageProvider funnelPackageKey="scan_v1">
      <QuizInfoStrip onDismiss={() => {}} />
    </QuizFunnelPackageProvider>,
  )

  assert.ok(html.includes(SCAN_INFO_STRIP_BODY), "SSR renders the server value")
  assert.equal(useQuizStore.getState().funnelPackageKey, null, "and never touches the store")
})

test("the bootstrap fallback publishes the effective package to the context too", async () => {
  // The regression: the bootstrap filled the store, but the context kept the null
  // the server render carried — so the quiz inserts appeared with organic copy.
  let releaseBootstrap = () => {}
  const bootstrapped = new Promise<void>((resolve) => {
    releaseBootstrap = resolve
  })
  const originalFetch = globalThis.fetch
  const storage = new MemoryStorage()
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: storage },
    configurable: true,
  })
  globalThis.fetch = (async () => {
    await bootstrapped
    return {
      ok: true,
      json: async () => ({
        funnelSessionId: "20000000-0000-4000-8000-000000000002",
        funnelPackageKey: "scan_v1",
      }),
    }
  }) as never

  try {
    useQuizStore.getState().setFunnelPackageKey(null)
    const mounted = mountComponent(() =>
      QuizFunnelPackageProvider({
        funnelPackageKey: null,
        children: <QuizInfoStrip onDismiss={() => {}} />,
      }),
    )

    const beforeBootstrap = renderToStaticMarkup(mounted.tree)
    assert.ok(beforeBootstrap.includes(DEFAULT_INFO_STRIP_BODY), "first paint is hydration-safe")

    releaseBootstrap()
    await flushAsync()

    const afterBootstrap = renderToStaticMarkup(mounted.tree)
    assert.ok(afterBootstrap.includes(SCAN_INFO_STRIP_BODY), "context switched with the store")
    assert.equal(useQuizStore.getState().funnelPackageKey, "scan_v1")
    mounted.unmount()
  } finally {
    globalThis.fetch = originalFetch
    Reflect.deleteProperty(globalThis, "window")
    useQuizStore.getState().setFunnelPackageKey(null)
  }
})
