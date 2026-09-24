import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"

import type { ScanSearchResult } from "../src/app/api/scan/search/route"
import { DiscoveryChoiceSheet } from "../src/components/discovery/intake/discovery-choice-sheet"
import { DiscoveryIntakeChecklist } from "../src/components/discovery/intake/discovery-intake-checklist"
import { DiscoveryIntakeReview } from "../src/components/discovery/intake/discovery-intake-review"
import { DiscoveryProductList } from "../src/components/discovery/intake/discovery-product-list"
import type { DiscoveryIntakeItemView } from "../src/components/discovery/intake/types"
import { ScanSearchSheet } from "../src/components/scan/scan-search-sheet"

/**
 * The flat checklist driven like a tap would: add → one POST with type + usage, pill →
 * one PATCH, „Fertig“ → „Passt das so?“ → „Stimmt so – abschicken“ → one submit carrying
 * `{confirmNoneForMissing: true}` → „Danke!“.
 *
 * A hand-rolled `useState` dispatcher (no jsdom in this repo — same family as
 * `tests/discovery-search-sheet-props.test.tsx`): the checklist is called directly, its
 * element tree walked, and the handlers it hands its children invoked.
 */

type AnyElement = ReactElement<Record<string, any>>
type ReactDispatcherInternals = { H: unknown }

function childrenOf(node: ReactNode): ReactNode[] {
  if (!React.isValidElement(node)) return []
  return React.Children.toArray((node as ReactElement<{ children?: ReactNode }>).props.children)
}

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  return childrenOf(node).map(textOf).join("")
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
  assert.ok(found, "element on screen")
  return found
}

function tappable(tree: ReactNode, label: string): AnyElement | undefined {
  return findAll(
    tree,
    (element) => typeof element.props.onClick === "function" && textOf(element) === label,
  )[0]
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

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

type Recorded = { url: string; method: string | undefined; body: unknown }

function mockFetch(
  t: { after: (fn: () => void) => void },
  respond: (request: Recorded) => { status: number; body: unknown },
): Recorded[] {
  const requests: Recorded[] = []
  const original = globalThis.fetch
  t.after(() => {
    globalThis.fetch = original
  })
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = {
      url: String(input),
      method: init?.method,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    }
    requests.push(request)
    const { status, body } = respond(request)
    return { ok: status < 400, status, json: async () => body } as unknown as Response
  }) as typeof fetch
  return requests
}

function view(overrides: Partial<DiscoveryIntakeItemView> = {}): DiscoveryIntakeItemView {
  return {
    id: "item-1",
    category: "conditioner",
    source: "catalog_search",
    brandText: "Balea",
    productNameText: "Spülung",
    barcodeIdentifier: null,
    productType: "conditioner",
    ...overrides,
  }
}

function checklist(items: DiscoveryIntakeItemView[]) {
  return createHarness(() =>
    DiscoveryIntakeChecklist({
      initialItems: items,
      initialSubmitted: false,
      retailerSearchEnabled: false,
    }),
  )
}

const CATALOG_RESULT: ScanSearchResult = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Intensiv-Kur",
  brand: "Balea",
  category: "mask",
  categoryLabel: "Maske",
  imageUrl: "https://catalog.example/kur.jpg",
  productLine: "Professional Oil Repair",
}

test("a search pick asks the usage, and the one tap sends ONE add with type + usage", async (t) => {
  const stored = view({ id: "item-9", category: "mask", productType: "mask" })
  const requests = mockFetch(t, () => ({ status: 201, body: { item: stored } }))
  const harness = checklist([])

  let tree = harness.render()
  find(tree, ScanSearchSheet).props.onSelectProductResult(CATALOG_RESULT)
  await settle()
  tree = harness.render()
  assert.equal(requests.length, 0, "nothing is written before the usage answer")

  const sheet = find(tree, DiscoveryChoiceSheet).props.sheet
  assert.equal(sheet.kind, "usage")
  assert.equal(sheet.highlighted, "mask")
  const confirm = sheet.question.options.find((option: { key: string }) => option.key === "mask")
  find(tree, DiscoveryChoiceSheet).props.onChooseUsage(confirm)
  await settle()
  tree = harness.render()

  assert.deepEqual(requests, [
    {
      url: "/api/beratung/intake/items",
      method: "POST",
      body: {
        capture: {
          source: "catalog_search",
          productId: CATALOG_RESULT.id,
          brandText: "Balea",
          productNameText: "Intensiv-Kur",
        },
        productType: "mask",
        usage: { category: "mask", role: null },
      },
    },
  ])
  assert.equal(find(tree, DiscoveryChoiceSheet).props.sheet, null, "the sheet closes")
  assert.deepEqual(
    find(tree, DiscoveryProductList).props.items.map((item: DiscoveryIntakeItemView) => item.id),
    ["item-9"],
  )
  assert.ok(tappable(tree, "Fertig"), "one product is enough for „Fertig“")
})

test("a pill tap PATCHes only the usage and swaps the card in place", async (t) => {
  const changed = view({ category: "leave_in" })
  const requests = mockFetch(t, () => ({ status: 200, body: { item: changed } }))
  const harness = checklist([view()])

  let tree = harness.render()
  find(tree, DiscoveryProductList).props.onChange(view())
  tree = harness.render()
  const sheet = find(tree, DiscoveryChoiceSheet).props.sheet
  assert.equal(sheet.highlighted, "conditioner")
  find(tree, DiscoveryChoiceSheet).props.onChooseUsage(
    sheet.question.options.find((option: { key: string }) => option.key === "leave_in"),
  )
  await settle()
  tree = harness.render()

  assert.deepEqual(requests, [
    {
      url: "/api/beratung/intake/items/item-1",
      method: "PATCH",
      body: { usage: { category: "leave_in", role: null } },
    },
  ])
  assert.equal(find(tree, DiscoveryProductList).props.items[0].category, "leave_in")
})

test("„Fertig“ → „Passt das so?“ → „Stimmt so – abschicken“: one confirming submit, then „Danke!“", async (t) => {
  const requests = mockFetch(t, () => ({
    status: 200,
    body: {
      state: "submitted",
      submittedAt: "2026-09-24T10:00:00.000Z",
      confirmedNone: ["shampoo"],
    },
  }))
  const harness = checklist([view()])

  let tree = harness.render()
  tappable(tree, "Fertig")!.props.onClick()
  tree = harness.render()
  const review = find(tree, DiscoveryIntakeReview)
  assert.deepEqual(
    review.props.items.map((item: DiscoveryIntakeItemView) => item.id),
    ["item-1"],
  )
  assert.equal(requests.length, 0, "the review writes nothing by itself")

  review.props.onSubmit()
  await settle()
  tree = harness.render()

  assert.deepEqual(requests, [
    {
      url: "/api/beratung/intake/submit",
      method: "POST",
      body: { confirmNoneForMissing: true },
    },
  ])
  assert.equal(findAll(tree, (element) => element.type === DiscoveryIntakeReview).length, 0)
  assert.equal(
    (tree.type as { name?: string }).name,
    "DiscoveryIntakeThanks",
    "the thank-you screen",
  )
})

test("„Noch was ergänzen“ goes back to the list without writing", (t) => {
  const requests = mockFetch(t, () => ({ status: 500, body: {} }))
  const harness = checklist([view()])
  let tree = harness.render()
  tappable(tree, "Fertig")!.props.onClick()
  tree = harness.render()
  find(tree, DiscoveryIntakeReview).props.onBack()
  tree = harness.render()
  assert.ok(find(tree, DiscoveryProductList))
  assert.equal(requests.length, 0)
})

test("a failed submit keeps the review and says so", async (t) => {
  mockFetch(t, () => ({ status: 503, body: { code: "unavailable" } }))
  const harness = checklist([view()])
  let tree = harness.render()
  tappable(tree, "Fertig")!.props.onClick()
  tree = harness.render()
  find(tree, DiscoveryIntakeReview).props.onSubmit()
  await settle()
  tree = harness.render()

  const review = find(tree, DiscoveryIntakeReview)
  assert.equal(review.props.error, "Das Absenden hat nicht geklappt. Versuch es nochmal.")
  assert.equal(review.props.submitting, false, "so she can simply tap again")
})

test("an intake submitted elsewhere lands on „Danke!“ instead of an error", async (t) => {
  mockFetch(t, () => ({ status: 409, body: { code: "already_submitted" } }))
  const harness = checklist([view()])
  let tree = harness.render()
  tappable(tree, "Fertig")!.props.onClick()
  tree = harness.render()
  find(tree, DiscoveryIntakeReview).props.onSubmit()
  await settle()
  tree = harness.render()
  assert.equal((tree.type as { name?: string }).name, "DiscoveryIntakeThanks")
})
