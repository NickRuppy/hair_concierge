import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { Button } from "../src/components/ui/button"
import { BottomSheet, BottomSheetContent } from "../src/components/ui/bottom-sheet"
import { MOTION_MS } from "../src/lib/motion"
import { QuizConcernsQuestion } from "../src/components/quiz/quiz-concerns-question"
import {
  MAIN_PROBLEM_SHEET_TITLE,
  QuizMainProblemSheet,
  QuizMainProblemSheetBody,
} from "../src/components/quiz/quiz-main-problem-sheet"
import { QuizOptionCard } from "../src/components/quiz/quiz-option-card"
import { useQuizStore } from "../src/lib/quiz/store"

/**
 * F1 main-problem sheet on the standard `/quiz` concerns step (plan Rev. 3 §1.1):
 * ≥ 2 concerns → Weiter opens the sheet listing only her selected concerns and one tap
 * stores `primary_concern` and advances; exactly one → no sheet; a back-edit that
 * deselects the pick clears it.
 *
 * No jsdom in this repo: the step is called directly under a hand-rolled hook dispatcher
 * (same family as `tests/discovery-quiz-lead-save.test.tsx`), its element tree walked and
 * its handlers invoked as a tap would. The zustand store is the real one.
 */

type AnyElement = ReactElement<Record<string, any>>
type ReactDispatcherInternals = { H: unknown }

function childrenOf(node: ReactNode): ReactNode[] {
  if (!React.isValidElement(node)) return []
  return React.Children.toArray((node as ReactElement<{ children?: ReactNode }>).props.children)
}

function findAll(node: ReactNode, predicate: (element: AnyElement) => boolean): AnyElement[] {
  if (!React.isValidElement(node)) return []
  const element = node as AnyElement
  return [
    ...(predicate(element) ? [element] : []),
    ...childrenOf(element).flatMap((child) => findAll(child, predicate)),
  ]
}

function createHarness(render: () => ReactElement | null) {
  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const values: unknown[] = []
  let cursor = 0
  const browserHistory = {
    pushInPlaceEntry: () => {},
    registerBackHandler: () => () => {},
    requestBack: () => {},
  }
  const dispatcher = {
    useCallback<T>(callback: T): T {
      cursor += 1
      return callback
    },
    useMemo<T>(factory: () => T): T {
      cursor += 1
      return factory()
    },
    useContext() {
      return browserHistory
    },
    useDebugValue() {},
    useEffect() {
      cursor += 1
    },
    useRef<T>(initial: T): { current: T } {
      const index = cursor++
      if (!values[index]) values[index] = { current: initial }
      return values[index] as { current: T }
    },
    useState<T>(initial: T | (() => T)): [T, (next: T | ((previous: T) => T)) => void] {
      const index = cursor++
      if (values.length <= index) {
        values[index] = typeof initial === "function" ? (initial as () => T)() : initial
      }
      return [
        values[index] as T,
        (next) => {
          values[index] =
            typeof next === "function" ? (next as (previous: T) => T)(values[index] as T) : next
        },
      ]
    },
    useSyncExternalStore<T>(_subscribe: unknown, getSnapshot: () => T): T {
      return getSnapshot()
    },
  }
  return {
    render(): ReactElement | null {
      cursor = 0
      const previous = internals.H
      internals.H = dispatcher
      try {
        return render()
      } finally {
        internals.H = previous
      }
    },
  }
}

function startConcernsStep(answers: Record<string, unknown> = {}) {
  useQuizStore.setState({
    step: 8,
    answers: { structure: "wavy", ...answers },
    funnelPackageKey: null,
  })
  return createHarness(() => QuizConcernsQuestion())
}

function tapConcern(tree: ReactNode, label: RegExp) {
  const card = findAll(tree, (el) => el.type === QuizOptionCard && label.test(el.props.label))[0]
  assert.ok(card, `concern card ${label} missing`)
  card.props.onClick()
}

function tapWeiter(tree: ReactNode) {
  const cta = findAll(tree, (el) => el.type === Button && el.props.variant === "cta")[0]
  assert.ok(cta, "Weiter missing")
  cta.props.onClick()
}

function sheetOf(tree: ReactNode): AnyElement {
  const sheet = findAll(tree, (el) => el.type === QuizMainProblemSheet)[0]
  assert.ok(sheet, "main-problem sheet missing")
  return sheet
}

test("two concerns: Weiter opens the sheet with only her selected concerns", () => {
  const harness = startConcernsStep()
  let tree = harness.render()
  assert.equal(sheetOf(tree).props.open, false)

  tapConcern(tree, /Wenig Glanz/)
  tree = harness.render()
  tapConcern(tree, /bricht/)
  tree = harness.render()
  tapWeiter(tree)
  tree = harness.render()

  const sheet = sheetOf(tree)
  assert.equal(sheet.props.open, true)
  assert.deepEqual(
    sheet.props.options.map((option: { value: string }) => option.value),
    ["low_shine", "breakage"],
  )
  assert.equal(sheet.props.options[0].label, "Wenig Glanz")
  // Nothing advanced yet: the pick is the answer.
  assert.equal(useQuizStore.getState().step, 8)
  assert.equal(useQuizStore.getState().answers.concerns, undefined)
})

test("one tap on the sheet stores the pick and advances", () => {
  const harness = startConcernsStep()
  let tree = harness.render()
  tapConcern(tree, /Wenig Glanz/)
  tree = harness.render()
  tapConcern(tree, /bricht/)
  tree = harness.render()
  tapWeiter(tree)
  tree = harness.render()
  sheetOf(tree).props.onPick("breakage")

  const state = useQuizStore.getState()
  assert.deepEqual(state.answers.concerns, ["low_shine", "breakage"])
  assert.equal(state.answers.primary_concern, "breakage")
  assert.notEqual(state.step, 8)
})

test("dismissing the sheet keeps her on the step with nothing stored", () => {
  const harness = startConcernsStep()
  let tree = harness.render()
  tapConcern(tree, /Wenig Glanz/)
  tree = harness.render()
  tapConcern(tree, /bricht/)
  tree = harness.render()
  tapWeiter(tree)
  tree = harness.render()
  sheetOf(tree).props.onClose()
  tree = harness.render()

  assert.equal(sheetOf(tree).props.open, false)
  assert.equal(useQuizStore.getState().step, 8)
  assert.equal(useQuizStore.getState().answers.primary_concern, undefined)
})

test("exactly one concern: no sheet, it advances and stores no extra pick", () => {
  const harness = startConcernsStep()
  let tree = harness.render()
  tapConcern(tree, /Wenig Glanz/)
  tree = harness.render()
  tapWeiter(tree)
  tree = harness.render()

  assert.equal(sheetOf(tree).props.open, false)
  const state = useQuizStore.getState()
  assert.notEqual(state.step, 8)
  assert.deepEqual(state.answers.concerns, ["low_shine"])
  assert.equal(state.answers.primary_concern, undefined)
})

test("back-edit: deselecting the pick clears it and the sheet asks again", () => {
  const harness = startConcernsStep({
    concerns: ["low_shine", "breakage", "tangling"],
    primary_concern: "breakage",
  })
  let tree = harness.render()
  tapConcern(tree, /bricht/) // deselect her pick
  tree = harness.render()
  tapWeiter(tree)
  tree = harness.render()

  const sheet = sheetOf(tree)
  assert.equal(sheet.props.open, true)
  assert.equal(sheet.props.selected, undefined)
  assert.deepEqual(
    sheet.props.options.map((option: { value: string }) => option.value),
    ["low_shine", "tangling"],
  )
})

test("back-edit keeping the pick highlights it, so confirming is one tap", () => {
  const harness = startConcernsStep({
    concerns: ["low_shine", "breakage", "tangling"],
    primary_concern: "breakage",
  })
  let tree = harness.render()
  tapConcern(tree, /Verknoten/)
  tree = harness.render()
  tapWeiter(tree)
  tree = harness.render()
  assert.equal(sheetOf(tree).props.selected, "breakage")
})

test("back-edit down to one concern stores no stale pick", () => {
  const harness = startConcernsStep({
    concerns: ["low_shine", "breakage"],
    primary_concern: "breakage",
  })
  let tree = harness.render()
  tapConcern(tree, /bricht/)
  tree = harness.render()
  tapWeiter(tree)
  const state = useQuizStore.getState()
  assert.deepEqual(state.answers.concerns, ["low_shine"])
  assert.equal(state.answers.primary_concern, undefined)
})

test("the store drops a pick the new concern selection no longer contains", () => {
  useQuizStore.setState({
    answers: { concerns: ["low_shine", "breakage"], primary_concern: "breakage" },
  })
  useQuizStore.getState().setAnswer("concerns", ["low_shine", "tangling"])
  assert.equal(useQuizStore.getState().answers.primary_concern, undefined)

  useQuizStore.setState({
    answers: { concerns: ["low_shine", "breakage"], primary_concern: "breakage" },
  })
  useQuizStore.getState().setAnswer("concerns", ["breakage", "tangling"])
  assert.equal(useQuizStore.getState().answers.primary_concern, "breakage")
})

test("sheet body: the ruled question, one card per option, the current pick highlighted", () => {
  const html = renderToStaticMarkup(
    <QuizMainProblemSheetBody
      options={[
        { value: "low_shine", label: "Wenig Glanz" },
        { value: "breakage", label: "Mein Haar bricht in den Längen ab" },
      ]}
      selected="breakage"
      onPick={() => {}}
    />,
  )
  assert.equal(
    MAIN_PROBLEM_SHEET_TITLE,
    "Wenn du dich auf eins konzentrieren müsstest – was stört dich am meisten?",
  )
  assert.ok(html.includes(MAIN_PROBLEM_SHEET_TITLE))
  assert.equal(html.match(/<button/g)?.length, 2)
  assert.match(html, /Wenig Glanz/)
  assert.match(html, /aria-pressed="true"[^>]*>[\s\S]*?Mein Haar bricht/)
})

// --- Batch 8 motion: settle → close → advance after close --------------------------

function createEffectHarness(render: () => ReactElement | null) {
  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const values: unknown[] = []
  let cursor = 0
  let pending: Array<() => void | (() => void)> = []
  const dispatcher = {
    useContext: () => undefined,
    useEffect(effect: () => void | (() => void), deps?: unknown[]) {
      const index = cursor++
      const previous = values[index] as { deps?: unknown[]; cleanup?: () => void } | undefined
      const changed = !previous?.deps || !deps || deps.some((dep, i) => dep !== previous.deps?.[i])
      if (!changed) return
      previous?.cleanup?.()
      const record: { deps?: unknown[]; cleanup?: () => void } = { deps }
      values[index] = record
      pending.push(() => {
        const cleanup = effect()
        if (typeof cleanup === "function") record.cleanup = cleanup
      })
    },
    useRef<T>(initial: T): { current: T } {
      const index = cursor++
      if (!values[index]) values[index] = { current: initial }
      return values[index] as { current: T }
    },
    useState<T>(initial: T): [T, (next: T) => void] {
      const index = cursor++
      if (values.length <= index) values[index] = initial
      return [values[index] as T, (next) => (values[index] = next)]
    },
  }
  return () => {
    cursor = 0
    pending = []
    const previous = internals.H
    internals.H = dispatcher
    try {
      const tree = render()
      for (const run of pending) run()
      return tree
    } finally {
      internals.H = previous
    }
  }
}

function sheetParts(tree: ReactNode) {
  const sheet = findAll(tree, (el) => el.type === BottomSheet)[0]
  const content = findAll(tree, (el) => el.type === BottomSheetContent)[0]
  const body = findAll(tree, (el) => el.type === QuizMainProblemSheetBody)[0]
  assert.ok(sheet && content && body)
  return { sheet, content, body }
}

test("a pick shows its selected state for the settle time, closes, then advances after close", (t) => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis })
  t.after(() => delete (globalThis as { window?: unknown }).window)
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const picks: string[] = []
  const render = createEffectHarness(() =>
    QuizMainProblemSheet({
      open: true,
      options: [
        { value: "low_shine", label: "Wenig Glanz" },
        { value: "breakage", label: "Bruch" },
      ],
      selected: undefined,
      onPick: (value) => picks.push(value),
      onClose: () => {},
    }),
  )

  let parts = sheetParts(render())
  parts.body.props.onPick("breakage")
  parts = sheetParts(render())
  assert.equal(parts.body.props.selected, "breakage", "the tapped card is selected at once")
  assert.equal(parts.sheet.props.open, true, "still open during the settle")
  assert.deepEqual(picks, [])

  t.mock.timers.tick(MOTION_MS.settle - 1)
  parts = sheetParts(render())
  assert.equal(parts.sheet.props.open, true)
  t.mock.timers.tick(1)
  parts = sheetParts(render())
  assert.equal(parts.sheet.props.open, false, "closes after the settle")
  assert.deepEqual(picks, [], "nothing advances while the sheet is closing")

  // A second tap while closing is ignored.
  parts.body.props.onPick("low_shine")
  parts.content.props.onClosed()
  assert.deepEqual(picks, ["breakage"], "advance only after the sheet finished closing")
})

test("closing without a pick advances nothing", () => {
  const picks: string[] = []
  const render = createEffectHarness(() =>
    QuizMainProblemSheet({
      open: false,
      options: [{ value: "low_shine", label: "Wenig Glanz" }],
      selected: undefined,
      onPick: (value) => picks.push(value),
      onClose: () => {},
    }),
  )
  sheetParts(render()).content.props.onClosed()
  assert.deepEqual(picks, [])
})
