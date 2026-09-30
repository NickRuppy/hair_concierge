import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"

import QuizPage from "../src/app/quiz/page"
import { QuizQuestion } from "../src/components/quiz/quiz-question"
import { QUIZ_DRAFT_STORAGE_KEY } from "../src/lib/quiz/draft"
import { useQuizStore } from "../src/lib/quiz/store"

/**
 * Batch 8 review (P2): `/quiz` shows question 1 while it checks the saved draft, but that
 * screen must not take an answer until the check has reconciled — a fast tap would skip
 * the restore and overwrite the saved draft. Harness: hand-rolled hook dispatcher (no
 * jsdom), real zustand store, a fake `window` with localStorage.
 */

type AnyElement = ReactElement<Record<string, any>>
type Record_ = { deps?: unknown[]; cleanup?: () => void }

function findAll(node: ReactNode, predicate: (element: AnyElement) => boolean): AnyElement[] {
  if (!React.isValidElement(node)) return []
  const element = node as AnyElement
  const children = React.Children.toArray(
    (element as ReactElement<{ children?: ReactNode }>).props.children,
  )
  return [
    ...(predicate(element) ? [element] : []),
    ...children.flatMap((child) => findAll(child, predicate)),
  ]
}

function harness() {
  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown }
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const values: unknown[] = []
  let cursor = 0
  let pending: Array<() => void> = []
  const dispatcher = {
    useEffect(effect: () => void | (() => void), deps?: unknown[]) {
      const index = cursor++
      const previous = values[index] as Record_ | undefined
      if (previous?.deps && deps && deps.every((dep, i) => dep === previous.deps?.[i])) return
      previous?.cleanup?.()
      const record: Record_ = { deps }
      values[index] = record
      pending.push(() => {
        const cleanup = effect()
        if (typeof cleanup === "function") record.cleanup = cleanup
      })
    },
    useRef<T>(initial: T) {
      const index = cursor++
      if (!values[index]) values[index] = { current: initial }
      return values[index] as { current: T }
    },
    useState<T>(initial: T): [T, (next: T | ((previous: T) => T)) => void] {
      const index = cursor++
      if (values.length <= index) values[index] = initial
      return [
        values[index] as T,
        (next) =>
          (values[index] =
            typeof next === "function" ? (next as (p: T) => T)(values[index] as T) : next),
      ]
    },
    useSyncExternalStore<T>(_subscribe: unknown, getSnapshot: () => T): T {
      return getSnapshot()
    },
    useDebugValue() {},
    useCallback<T>(callback: T) {
      cursor += 1
      return callback
    },
  }
  return () => {
    cursor = 0
    pending = []
    const previous = internals.H
    internals.H = dispatcher
    try {
      const tree = QuizPage() as ReactElement
      for (const run of pending) run()
      return tree
    } finally {
      internals.H = previous
    }
  }
}

function withBrowser(t: test.TestContext, draft: unknown) {
  const store = new Map<string, string>()
  if (draft) store.set(QUIZ_DRAFT_STORAGE_KEY, JSON.stringify(draft))
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
  const original = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage,
      sessionStorage: storage,
      location: { search: "", pathname: "/quiz" },
      history: {
        state: null as unknown,
        replaceState(state: unknown) {
          this.state = state
        },
        pushState(state: unknown) {
          this.state = state
        },
      },
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    },
  })
  useQuizStore.setState({ step: 2, answers: {}, funnelPackageKey: null })
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "window", original)
    else delete (globalThis as { window?: unknown }).window
    useQuizStore.setState({ step: 2, answers: {} })
  })
  return store
}

const gate = (tree: ReactNode) =>
  findAll(tree, (element) => element.props["data-quiz-draft-gate"] !== undefined)[0]

test("question 1 shows at once but is inert until the draft check has reconciled", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  withBrowser(t, null)
  const render = harness()
  let tree = render()
  assert.equal(findAll(tree, (element) => element.type === QuizQuestion).length, 1)
  assert.equal(gate(tree).props.inert, true, "no answer while the draft is being checked")
  assert.doesNotMatch(String(gate(tree).props.className), /opacity/, "no dimming")

  t.mock.timers.tick(0)
  for (let i = 0; i < 4; i += 1) await Promise.resolve()
  tree = render()
  assert.equal(gate(tree).props.inert, false, "interactive once reconciled")
})

test("a saved draft is restored, never overwritten by the question-1 screen", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const saved = {
    version: 2,
    savedAt: Date.now(),
    step: 5,
    answers: { structure: "wavy", thickness: "fine", density: "medium", hair_length: "long" },
    funnelPackageKey: null,
  }
  const storage = withBrowser(t, saved)
  const render = harness()
  const tree = render()
  assert.equal(gate(tree).props.inert, true)
  t.mock.timers.tick(0)
  for (let i = 0; i < 4; i += 1) await Promise.resolve()
  render()
  assert.equal(useQuizStore.getState().step, 5, "the saved progress wins")
  assert.equal(useQuizStore.getState().answers.structure, "wavy")
  assert.equal(JSON.parse(storage.get(QUIZ_DRAFT_STORAGE_KEY)!).step, 5, "draft kept")
})
