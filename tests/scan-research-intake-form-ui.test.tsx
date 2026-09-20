import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { CATEGORY_COPY } from "../src/components/personal-plan-products/stage3-product-copy"
import { ScanResearchIntakeForm } from "../src/components/scan/scan-search-sheet"

/**
 * `ScanResearchIntakeForm` (Task 5) is a "use client" component with `useState`/`useRef`
 * — this repo has no jsdom/testing-library, so interaction tests call the component
 * function directly under a hand-rolled hook dispatcher and walk the returned element
 * tree (same harness as tests/scan-unknown-flow-ui.test.tsx, which tests
 * `ScanUnknownFlow` the identical way).
 */

type AnyElement = ReactElement<Record<string, any>>

type ReactDispatcherInternals = { H: unknown }

function withClientHooks<T>(render: () => T): { value: T; rerender: () => T } {
  const reactInternals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const previousDispatcher = reactInternals.H
  const hookValues: unknown[] = []
  let cursor = 0

  const dispatcher = {
    useState<Value>(
      initialState: Value | (() => Value),
    ): [Value, (nextState: Value | ((previous: Value) => Value)) => void] {
      const stateIndex = cursor
      cursor += 1
      if (hookValues.length <= stateIndex) {
        hookValues[stateIndex] =
          typeof initialState === "function" ? (initialState as () => Value)() : initialState
      }
      return [
        hookValues[stateIndex] as Value,
        (nextState) => {
          hookValues[stateIndex] =
            typeof nextState === "function"
              ? (nextState as (previous: Value) => Value)(hookValues[stateIndex] as Value)
              : nextState
        },
      ]
    },
    useRef<T>(initialValue: T): { current: T } {
      const index = cursor
      cursor += 1
      if (!hookValues[index]) hookValues[index] = { current: initialValue }
      return hookValues[index] as { current: T }
    },
  }

  function run() {
    cursor = 0
    reactInternals.H = dispatcher
    try {
      return render()
    } finally {
      reactInternals.H = previousDispatcher
    }
  }

  return { value: run(), rerender: run }
}

function childrenOf(node: ReactNode): ReactNode[] {
  if (!React.isValidElement(node)) return []
  return React.Children.toArray((node as ReactElement<{ children?: ReactNode }>).props.children)
}

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  return childrenOf(node)
    .map((child) => textContent(child))
    .join("")
}

function findAll(node: ReactNode, predicate: (element: AnyElement) => boolean): AnyElement[] {
  if (!React.isValidElement(node)) return []
  const element = node as AnyElement
  const matches = predicate(element) ? [element] : []
  return [...matches, ...childrenOf(element).flatMap((child) => findAll(child, predicate))]
}

function categoryButton(tree: ReactNode, label: string): AnyElement {
  const match = findAll(
    tree,
    (element) => element.type === "button" && textContent(element) === label,
  )[0]
  assert.ok(match, `Expected a category button labeled "${label}"`)
  return match
}

function renderForm(props: {
  brandText?: string
  productNameText?: string
  submitting?: boolean
  error?: string | null
  onBrandTextChange?: (value: string) => void
  onProductNameTextChange?: (value: string) => void
  onBack?: () => void
  onSubmit: (category: string) => void
}) {
  return withClientHooks(() =>
    ScanResearchIntakeForm({
      brandText: props.brandText ?? "",
      productNameText: props.productNameText ?? "",
      onBrandTextChange: props.onBrandTextChange ?? (() => undefined),
      onProductNameTextChange: props.onProductNameTextChange ?? (() => undefined),
      submitting: props.submitting ?? false,
      error: props.error ?? null,
      onBack: props.onBack ?? (() => undefined),
      onSubmit: props.onSubmit as never,
    }),
  )
}

test("ScanResearchIntakeForm: renders the signed-off heading copy, Marke/Produktname fields, and the category helper", () => {
  const tree = renderForm({ brandText: "", productNameText: "", onSubmit: () => undefined })
  const markup = renderToStaticMarkup(tree.value)
  assert.match(markup, /Marke/)
  assert.match(markup, /Produktname/)
  assert.match(markup, /Was ist es\?/)
  assert.match(markup, /Tippe die Kategorie an – das reicht uns schon\./)
  assert.match(markup, /Zurück/)
})

test("ScanResearchIntakeForm: a category tap is blocked while Marke is empty, even with a filled Produktname", () => {
  const calls: string[] = []
  const tree = renderForm({
    brandText: "",
    productNameText: "Ciment Thermique",
    onSubmit: (category) => calls.push(category),
  })
  categoryButton(tree.value, CATEGORY_COPY.shampoo.label).props.onClick()
  assert.deepEqual(calls, [])
})

test("ScanResearchIntakeForm: a category tap is blocked while Produktname is empty, even with a filled Marke", () => {
  const calls: string[] = []
  const tree = renderForm({
    brandText: "Kérastase",
    productNameText: "",
    onSubmit: (category) => calls.push(category),
  })
  categoryButton(tree.value, CATEGORY_COPY.shampoo.label).props.onClick()
  assert.deepEqual(calls, [])
})

test("ScanResearchIntakeForm: a category tap submits exactly the tapped category once both fields are filled", () => {
  const calls: string[] = []
  const tree = renderForm({
    brandText: "Kérastase",
    productNameText: "Ciment Thermique",
    onSubmit: (category) => calls.push(category),
  })
  categoryButton(tree.value, CATEGORY_COPY.conditioner.label).props.onClick()
  assert.deepEqual(calls, ["conditioner"])
})

test("ScanResearchIntakeForm: whitespace-only text still counts as empty (blocks submit)", () => {
  const calls: string[] = []
  const tree = renderForm({
    brandText: "   ",
    productNameText: "   ",
    onSubmit: (category) => calls.push(category),
  })
  categoryButton(tree.value, CATEGORY_COPY.shampoo.label).props.onClick()
  assert.deepEqual(calls, [])
})

test("ScanResearchIntakeForm: edits call onBrandTextChange/onProductNameTextChange with the raw typed value", () => {
  const brandCalls: string[] = []
  const nameCalls: string[] = []
  const tree = renderForm({
    onBrandTextChange: (value) => brandCalls.push(value),
    onProductNameTextChange: (value) => nameCalls.push(value),
    onSubmit: () => undefined,
  })
  const inputs = findAll(tree.value, (element) => element.type === "input")
  assert.equal(inputs.length, 2)
  inputs[0].props.onChange({ target: { value: "Kérastase" } })
  inputs[1].props.onChange({ target: { value: "Ciment Thermique" } })
  assert.deepEqual(brandCalls, ["Kérastase"])
  assert.deepEqual(nameCalls, ["Ciment Thermique"])
})

test("ScanResearchIntakeForm: shows the five primary categories only, with a 'Mehr …' expander for the rest", () => {
  const tree = renderForm({ onSubmit: () => undefined })
  for (const key of ["shampoo", "conditioner", "leave_in", "mask", "oil"] as const) {
    categoryButton(tree.value, CATEGORY_COPY[key].label)
  }
  assert.equal(
    findAll(
      tree.value,
      (element) =>
        element.type === "button" && textContent(element) === CATEGORY_COPY.heat_protectant.label,
    ).length,
    0,
  )
  categoryButton(tree.value, "Mehr …").props.onClick()
  tree.value = tree.rerender()
  for (const key of [
    "heat_protectant",
    "scalp_care",
    "dry_shampoo",
    "bondbuilder",
    "deep_cleansing_shampoo",
  ] as const) {
    categoryButton(tree.value, CATEGORY_COPY[key].label)
  }
})

test("ScanResearchIntakeForm: the tapped card alone shows the submitting label while others and the back affordance disable", () => {
  const parentState = { submitting: false }
  const tree = withClientHooks(() =>
    ScanResearchIntakeForm({
      brandText: "Kérastase",
      productNameText: "Ciment Thermique",
      onBrandTextChange: () => undefined,
      onProductNameTextChange: () => undefined,
      submitting: parentState.submitting,
      error: null,
      onBack: () => undefined,
      onSubmit: () => undefined,
    }),
  )
  categoryButton(tree.value, CATEGORY_COPY.mask.label).props.onClick()
  parentState.submitting = true
  tree.value = tree.rerender()

  const submittingCards = findAll(
    tree.value,
    (element) => element.type === "button" && textContent(element) === "Wird eingereicht",
  )
  assert.equal(submittingCards.length, 1)
  assert.doesNotMatch(renderToStaticMarkup(tree.value), new RegExp(CATEGORY_COPY.mask.label))
  categoryButton(tree.value, CATEGORY_COPY.shampoo.label)

  const back = findAll(
    tree.value,
    (element) => element.type === "button" && textContent(element) === "Zurück",
  )[0]
  assert.equal(back.props.disabled, true)
})

test("ScanResearchIntakeForm: a second tap while submitting does not resubmit", () => {
  const calls: string[] = []
  const tree = renderForm({
    brandText: "Kérastase",
    productNameText: "Ciment Thermique",
    submitting: true,
    onSubmit: (category) => calls.push(category),
  })
  categoryButton(tree.value, CATEGORY_COPY.shampoo.label).props.onClick()
  categoryButton(tree.value, CATEGORY_COPY.shampoo.label).props.onClick()
  assert.deepEqual(calls, [])
})

test("ScanResearchIntakeForm: onBack fires exactly on the back affordance", () => {
  const calls: number[] = []
  const tree = renderForm({ onBack: () => calls.push(1), onSubmit: () => undefined })
  const back = findAll(
    tree.value,
    (element) => element.type === "button" && textContent(element) === "Zurück",
  )[0]
  assert.ok(back)
  back.props.onClick()
  assert.deepEqual(calls, [1])
})

test("ScanResearchIntakeForm: renders the standard error copy inside an alert role", () => {
  const tree = renderForm({
    error: "Hat nicht geklappt – versuch's nochmal.",
    onSubmit: () => undefined,
  })
  const markup = renderToStaticMarkup(tree.value)
  assert.match(markup, /role="alert"/)
  assert.match(markup, /Hat nicht geklappt – versuch&#x27;s nochmal\./)
})

test("ScanResearchIntakeForm: no error renders no alert", () => {
  const tree = renderForm({ error: null, onSubmit: () => undefined })
  assert.doesNotMatch(renderToStaticMarkup(tree.value), /role="alert"/)
})
