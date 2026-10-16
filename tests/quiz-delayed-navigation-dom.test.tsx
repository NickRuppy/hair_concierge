import "./helpers/dom"

import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import React, { StrictMode } from "react"

import { QuizBrowserHistoryProvider } from "../src/components/quiz/quiz-browser-history"
import { QuizQuestion } from "../src/components/quiz/quiz-question"
import { QuizScalpQuestion } from "../src/components/quiz/quiz-scalp-question"
import { saveQuizDraft } from "../src/lib/quiz/draft"
import { MOTION_MS } from "../src/lib/motion"
import { getQuestionByStep } from "../src/lib/quiz/questions"
import { useQuizStore } from "../src/lib/quiz/store"

// Keep React, the store, components and browser-history provider real. Only the
// settle-delay transport is controlled, and cancelled callbacks can still be delivered.
const nativeTimeout = globalThis.setTimeout
const nativeWindowTimeout = window.setTimeout
const nativeClear = globalThis.clearTimeout
const nativeWindowClear = window.clearTimeout
let scheduled: Array<() => void> = []

function QuizJourney() {
  const step = useQuizStore((s) => s.step)
  const question = getQuestionByStep(step)
  return (
    <>
      <output data-testid="position">{step}</output>
      {step === 6 ? (
        <QuizScalpQuestion key={step} />
      ) : question ? (
        <QuizQuestion key={step} question={question} />
      ) : null}
    </>
  )
}

function mount() {
  return render(
    <StrictMode>
      <QuizBrowserHistoryProvider>
        <QuizJourney />
      </QuizBrowserHistoryProvider>
    </StrictMode>,
  )
}

beforeEach(() => {
  scheduled = []
  window.history.replaceState({ legacyQuizDepth: 0 }, "", "/quiz")
  window.localStorage.clear()
  useQuizStore.getState().reset()
  useQuizStore.getState().setFunnelPackageKey(null)
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })
  HTMLElement.prototype.scrollIntoView = () => {}
  const capture = ((callback: () => void, delay?: number, ...args: unknown[]) => {
    if (delay === MOTION_MS.settle) {
      scheduled.push(callback)
      return 100000 + scheduled.length
    }
    return nativeTimeout(callback, delay, ...args)
  }) as typeof globalThis.setTimeout
  globalThis.setTimeout = capture
  window.setTimeout = capture as unknown as typeof window.setTimeout
  globalThis.clearTimeout = ((id) => {
    if (Number(id) < 100000) nativeClear(id)
  }) as typeof globalThis.clearTimeout
  window.clearTimeout = globalThis.clearTimeout as unknown as typeof window.clearTimeout
})

afterEach(() => {
  cleanup()
  globalThis.setTimeout = nativeTimeout
  globalThis.clearTimeout = nativeClear
  window.setTimeout = nativeWindowTimeout
  window.clearTimeout = nativeWindowClear
})

function selectFirst() {
  const question = getQuestionByStep(useQuizStore.getState().step)!
  fireEvent.click(screen.getByRole("button", { name: question.options[0].label }))
  assert.equal(scheduled.length, 1)
}

function deliver(index = 0) {
  act(() => scheduled[index]())
}

test("single selection commits immediately and advances once after its settle delay", () => {
  mount()
  selectFirst()
  assert.equal(screen.getByTestId("position").textContent, "2")
  assert.equal(useQuizStore.getState().answers.structure, getQuestionByStep(2)!.options[0].value)
  deliver()
  assert.equal(screen.getByTestId("position").textContent, "3")
  deliver()
  assert.equal(screen.getByTestId("position").textContent, "3")
})

test("Back before a delayed selection settles cannot resurrect the departed question", () => {
  useQuizStore.getState().setStep(3)
  mount()
  selectFirst()
  fireEvent.click(screen.getByRole("button", { name: "Zurück" }))
  assert.equal(screen.getByTestId("position").textContent, "2")
  const depth = window.history.state.legacyQuizDepth
  deliver()
  assert.equal(screen.getByTestId("position").textContent, "2")
  assert.equal(window.history.state.legacyQuizDepth, depth)
})

for (const supersession of ["reset", "restore", "reentry", "package"] as const) {
  test(`${supersession} rejects the old callback even on the same numeric screen`, () => {
    mount()
    selectFirst()
    act(() => {
      const store = useQuizStore.getState()
      if (supersession === "reset") store.reset()
      if (supersession === "restore") {
        saveQuizDraft({ step: 2, answers: { structure: "curly" } })
        store.restoreDraft()
      }
      if (supersession === "reentry") {
        store.goNext()
        store.goBack()
      }
      if (supersession === "package") store.setFunnelPackageKey("scan_v1")
    })
    const current = useQuizStore.getState().step
    deliver()
    assert.equal(screen.getByTestId("position").textContent, String(current))
  })
}

test("scalp Back cancels the no-issue advance while staying inside step six", () => {
  useQuizStore.getState().setStep(6)
  useQuizStore.getState().setAnswer("scalp_type", "ausgeglichen")
  mount()
  fireEvent.click(screen.getByRole("button", { name: "Nein" }))
  assert.equal(scheduled.length, 1)
  assert.equal(useQuizStore.getState().answers.has_scalp_issue, false)
  fireEvent.click(screen.getByRole("button", { name: "Zurück" }))
  assert.equal(useQuizStore.getState().answers.scalp_type, undefined)
  const depth = window.history.state.legacyQuizDepth
  deliver()
  assert.equal(screen.getByTestId("position").textContent, "6")
  assert.equal(window.history.state.legacyQuizDepth, depth)
})

test("an unmounted quiz cannot navigate the next mounted journey", () => {
  const first = mount()
  selectFirst()
  first.unmount()
  mount()
  deliver()
  assert.equal(screen.getByTestId("position").textContent, "2")
})

test("two selections in the same React batch retain the first accepted answer", () => {
  mount()
  const question = getQuestionByStep(2)!
  act(() => {
    fireEvent.click(screen.getByRole("button", { name: question.options[0].label }))
    fireEvent.click(screen.getByRole("button", { name: question.options[1].label }))
  })
  assert.equal(scheduled.length, 1)
  assert.equal(useQuizStore.getState().answers.structure, question.options[0].value)
  deliver()
  assert.equal(screen.getByTestId("position").textContent, "3")
})

test("a disposed scalp disclosure cannot push an in-place browser history entry", () => {
  useQuizStore.getState().setStep(6)
  const mounted = mount()
  fireEvent.click(screen.getByRole("button", { name: "Ausgeglichen" }))
  assert.equal(scheduled.length, 1)
  const depth = window.history.state.legacyQuizDepth
  mounted.unmount()
  deliver()
  assert.equal(window.history.state.legacyQuizDepth, depth)
})
