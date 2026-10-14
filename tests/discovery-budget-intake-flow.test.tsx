import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { BudgetQuestion } from "../src/components/budget/budget-question"
import { DiscoveryBudgetScreen } from "../src/components/discovery/intake/discovery-budget-screen"
import { DiscoveryHeatScreen } from "../src/components/discovery/intake/discovery-heat-flow"
import { DiscoveryIntakeChecklist } from "../src/components/discovery/intake/discovery-intake-checklist"
import { DiscoveryProductsScreen } from "../src/components/discovery/intake/discovery-products-screen"
import { DiscoveryRoutineScreen } from "../src/components/discovery/intake/discovery-routine-screen"
import type { DiscoveryIntakeItemView } from "../src/components/discovery/intake/types"
import type { ShoppingBudget } from "../src/lib/user-facts/schema"

/**
 * Profi-tier Task 8, participant flow: with the shopping-budget flag on, „Deine Produkte" →
 * „Weiter" → budget → „Deine Routine" → „Hitze & Styling"; a saved budget skips the screen; flag
 * off is today's flow exactly. Driven like taps would be (hand-rolled `useState` dispatcher, as
 * `tests/discovery-participant-flow.test.tsx`): the checklist is called directly, its element
 * tree walked and the handlers it hands its children invoked.
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

function find(tree: ReactNode, type: unknown): AnyElement {
  const found = findAll(tree, (element) => element.type === type)[0]
  assert.ok(found, `${(type as { name?: string }).name ?? "element"} on screen`)
  return found
}

function absent(tree: ReactNode, type: unknown) {
  assert.equal(findAll(tree, (element) => element.type === type).length, 0)
}

function createHarness(render: () => ReactElement) {
  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const values: unknown[] = []
  let cursor = 0
  const dispatcher = {
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
  }
  return {
    render(): ReactElement {
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

function view(overrides: Partial<DiscoveryIntakeItemView> = {}): DiscoveryIntakeItemView {
  return {
    id: "item-1",
    category: "shampoo",
    source: "catalog_search",
    brandText: "Balea",
    productNameText: "Aqua Hyaluron Shampoo",
    barcodeIdentifier: null,
    productType: "shampoo",
    frequency: "weekly_3_4x",
    ...overrides,
  }
}

const CAPPED: ShoppingBudget = { kind: "capped", limitEur: 15, allowExceptions: true }

function checklist(props: { budgetEnabled?: boolean; initialBudget?: ShoppingBudget | null }) {
  return createHarness(() =>
    DiscoveryIntakeChecklist({
      initialItems: [view()],
      initialSubmitted: false,
      retailerSearchEnabled: false,
      ...props,
    }),
  )
}

/** Records every fetch: the budget screen must write nowhere but the member route. */
function recordFetch(t: { after: (fn: () => void) => void }) {
  const requests: Array<{ url: string; method: string | undefined; body: unknown }> = []
  const original = globalThis.fetch
  t.after(() => {
    globalThis.fetch = original
  })
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      url: String(input),
      method: init?.method,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    })
    return { ok: true, status: 200, json: async () => ({}) } as unknown as Response
  }) as typeof fetch
  return requests
}

function screenName(tree: ReactNode): "products" | "budget" | "routine" | "heat" {
  if (findAll(tree, (element) => element.type === DiscoveryBudgetScreen).length) return "budget"
  if (findAll(tree, (element) => element.type === DiscoveryRoutineScreen).length) return "routine"
  if (findAll(tree, (element) => element.type === DiscoveryHeatScreen).length) return "heat"
  find(tree, DiscoveryProductsScreen)
  return "products"
}

test("flag on, no saved budget: products → budget → routine → heat; back goes the same way", (t) => {
  const requests = recordFetch(t)
  const harness = checklist({ budgetEnabled: true, initialBudget: null })
  let tree = harness.render()
  assert.equal(screenName(tree), "products")

  find(tree, DiscoveryProductsScreen).props.onContinue()
  tree = harness.render()
  assert.equal(screenName(tree), "budget")
  absent(tree, DiscoveryRoutineScreen)

  // Back from the budget: her products.
  find(tree, DiscoveryBudgetScreen).props.onBack()
  tree = harness.render()
  assert.equal(screenName(tree), "products")

  // Again forward; confirming the budget moves on to „Deine Routine".
  find(tree, DiscoveryProductsScreen).props.onContinue()
  tree = harness.render()
  find(tree, DiscoveryBudgetScreen).props.onSaved(CAPPED)
  tree = harness.render()
  assert.equal(screenName(tree), "routine")

  // Back from the routine: the budget again (she just came from it).
  find(tree, DiscoveryRoutineScreen).props.onBack()
  tree = harness.render()
  assert.equal(screenName(tree), "budget")

  find(tree, DiscoveryBudgetScreen).props.onSaved(CAPPED)
  tree = harness.render()
  find(tree, DiscoveryRoutineScreen).props.onConfirm()
  tree = harness.render()
  assert.equal(screenName(tree), "heat")

  // Moving through the screens writes nothing: the budget lives in the facts, not the intake.
  assert.deepEqual(requests, [])
})

test("„Noch was ergänzen“ on the routine always returns to her products, even right after the budget", () => {
  const harness = checklist({ budgetEnabled: true, initialBudget: null })
  let tree = harness.render()
  find(tree, DiscoveryProductsScreen).props.onContinue()
  tree = harness.render()
  find(tree, DiscoveryBudgetScreen).props.onSaved(CAPPED)
  tree = harness.render()
  assert.equal(screenName(tree), "routine")
  find(tree, DiscoveryRoutineScreen).props.onAddMore()
  tree = harness.render()
  assert.equal(screenName(tree), "products")
})

test("flag on, budget already saved: „Weiter“ goes straight to the routine and back returns to her products", () => {
  const harness = checklist({ budgetEnabled: true, initialBudget: CAPPED })
  let tree = harness.render()
  find(tree, DiscoveryProductsScreen).props.onContinue()
  tree = harness.render()
  assert.equal(screenName(tree), "routine")
  absent(tree, DiscoveryBudgetScreen)

  find(tree, DiscoveryRoutineScreen).props.onBack()
  tree = harness.render()
  assert.equal(screenName(tree), "products")
})

test("a budget saved in this session is not asked twice", () => {
  const harness = checklist({ budgetEnabled: true, initialBudget: null })
  let tree = harness.render()
  find(tree, DiscoveryProductsScreen).props.onContinue()
  tree = harness.render()
  find(tree, DiscoveryBudgetScreen).props.onSaved(CAPPED)
  tree = harness.render()
  // Back to her products via the routine → budget → products path, then forward again.
  find(tree, DiscoveryRoutineScreen).props.onBack()
  tree = harness.render()
  find(tree, DiscoveryBudgetScreen).props.onBack()
  tree = harness.render()
  find(tree, DiscoveryProductsScreen).props.onContinue()
  tree = harness.render()
  assert.equal(screenName(tree), "routine")
  find(tree, DiscoveryRoutineScreen).props.onBack()
  tree = harness.render()
  assert.equal(screenName(tree), "products", "skipped budget: back returns to her products")
})

test("flag off: today's flow, no budget screen even without a saved budget", () => {
  for (const props of [{}, { budgetEnabled: false, initialBudget: null }]) {
    const harness = checklist(props)
    let tree = harness.render()
    find(tree, DiscoveryProductsScreen).props.onContinue()
    tree = harness.render()
    assert.equal(screenName(tree), "routine")
    absent(tree, DiscoveryBudgetScreen)

    find(tree, DiscoveryRoutineScreen).props.onBack()
    tree = harness.render()
    assert.equal(screenName(tree), "products")
  }
})

test("the budget screen: consultation copy, coral selection, the intake back arrow, no eyebrow", () => {
  const html = renderToStaticMarkup(<DiscoveryBudgetScreen onBack={() => {}} onSaved={() => {}} />)
  assert.match(html, /<h2[^>]*>Was darf ein Pflegeprodukt ungefähr kosten\?<\/h2>/)
  assert.match(html, /Preis pro Packung – gilt für jedes Produkt deiner Routine\./)
  for (const label of ["Bis 5 €", "Bis 15 €", "Keine feste Preisgrenze"]) {
    assert.ok(html.includes(label), label)
  }
  assert.match(html, /aria-label="Zurück"/)
  // Consultation look: the intake's coral CTA, coral option borders, no „Dein Budget" eyebrow.
  assert.match(html, /data-budget-question-tone="consultation"/)
  assert.ok(html.includes("--brand-coral"))
  assert.ok(!html.includes("Dein Budget"))
  assert.ok(!html.includes("uppercase"))
})

test("BudgetQuestion's default (plan) output is unchanged by the tone prop", () => {
  const html = renderToStaticMarkup(<BudgetQuestion onSaved={() => {}} />)
  const explicit = renderToStaticMarkup(<BudgetQuestion tone="plan" onSaved={() => {}} />)
  // `useId` differs per render; compare with ids normalised.
  const normalise = (markup: string) => markup.replace(/_R_[a-z0-9]+_|«[^»]*»|:r[0-9a-z]+:/g, "ID")
  assert.equal(normalise(explicit), normalise(html))
  assert.match(html, /Dein Budget/)
  assert.ok(!html.includes("data-budget-question-tone"))
  assert.ok(!html.includes("border-[#ecd3d5]"))
})
