import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { DiscoveryIntakeChecklist } from "../src/components/discovery/intake/discovery-intake-checklist"
import type { DiscoveryIntakeItemView } from "../src/components/discovery/intake/types"
import {
  DISCOVERY_INTAKE_CATEGORIES,
  type DiscoveryIntakeCategory,
} from "../src/lib/discovery/intake"

/**
 * The checklist's one CTA: „Fertig – abschicken" as soon as one category is answered.
 * Nothing is mandatory; what the participant leaves untouched stays untouched (no tick,
 * no stored row) and the caption under the CTA says the call covers it.
 */

const SUBMIT = "Fertig – abschicken"
const CAPTION = "Was fehlt, klären wir im Call."

function view(
  category: DiscoveryIntakeCategory,
  source: DiscoveryIntakeItemView["source"] = "catalog_search",
): DiscoveryIntakeItemView {
  const none = source === "none"
  return {
    id: `view-${category}-${source}`,
    category,
    source,
    brandText: none ? null : "Balea",
    productNameText: none ? null : `Balea ${category}`,
    barcodeIdentifier: null,
  }
}

function overview(items: DiscoveryIntakeItemView[]) {
  return renderToStaticMarkup(
    <DiscoveryIntakeChecklist
      initialItems={items}
      initialSubmitted={false}
      retailerSearchEnabled={false}
    />,
  )
}

test("nothing answered: no CTA, no caption, and no counter implying ten required answers", () => {
  const html = overview([])
  assert.match(html, /Trag ein, was du benutzt\./)
  assert.doesNotMatch(html, new RegExp(SUBMIT))
  assert.doesNotMatch(html, new RegExp(CAPTION))
  assert.doesNotMatch(html, /von 10/)
  assert.doesNotMatch(html, /role="progressbar"/)
})

test("one answer is enough: the CTA appears, with the caption while anything is open", () => {
  const html = overview([view("shampoo")])
  assert.match(html, new RegExp(`>${SUBMIT}<`))
  assert.match(html, new RegExp(CAPTION))
  // The bulk shortcut is gone.
  assert.doesNotMatch(html, /Mehr benutze ich nicht/)
  // Only the answered row carries a tick; the nine untouched rows stay untouched.
  assert.equal((html.match(/lucide-check/g) ?? []).length, 1)
})

test("an explicit „benutze ich nicht“ counts as an answer too", () => {
  const html = overview([view("mask", "none")])
  assert.match(html, new RegExp(`>${SUBMIT}<`))
  assert.match(html, /benutze ich nicht/)
})

test("with every category answered the caption has nothing left to promise", () => {
  const html = overview(DISCOVERY_INTAKE_CATEGORIES.map((category) => view(category)))
  assert.match(html, new RegExp(`>${SUBMIT}<`))
  assert.doesNotMatch(html, new RegExp(CAPTION))
})

// A hand-rolled `useState` dispatcher (no jsdom in this repo — same family as
// `tests/discovery-search-sheet-props.test.tsx`): the checklist is called directly, its
// element tree walked, and its handlers invoked as a tap would.

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

function button(tree: ReactNode, label: string): AnyElement | undefined {
  return findAll(tree, (element) => element.type === "button" && textOf(element) === label)[0]
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

test("two answers → „Fertig – abschicken“ → one submit request, and the thank-you screen", async (t) => {
  const requests: Array<{ url: string; method: string | undefined }> = []
  const original = globalThis.fetch
  t.after(() => {
    globalThis.fetch = original
  })
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), method: init?.method })
    return {
      ok: true,
      status: 200,
      json: async () => ({ state: "submitted", submittedAt: "2026-09-23T10:00:00.000Z" }),
    } as unknown as Response
  }) as typeof fetch

  const harness = createHarness(() =>
    DiscoveryIntakeChecklist({
      initialItems: [view("shampoo"), view("oil", "none")],
      initialSubmitted: false,
      retailerSearchEnabled: false,
    }),
  )

  let tree = harness.render()
  const submit = button(tree, SUBMIT)
  assert.ok(submit, "the CTA is on screen")
  submit.props.onClick()
  await settle()
  tree = harness.render()

  // Only the submit — nothing is written for the eight untouched categories.
  assert.deepEqual(requests, [{ url: "/api/beratung/intake/submit", method: "POST" }])
  assert.match(textOf(tree), /Danke!/)
})

test("a failed submit keeps the checklist and says so", async (t) => {
  const original = globalThis.fetch
  t.after(() => {
    globalThis.fetch = original
  })
  globalThis.fetch = (async () =>
    ({
      ok: false,
      status: 503,
      json: async () => ({ code: "unavailable" }),
    }) as unknown as Response) as typeof fetch

  const harness = createHarness(() =>
    DiscoveryIntakeChecklist({
      initialItems: [view("shampoo")],
      initialSubmitted: false,
      retailerSearchEnabled: false,
    }),
  )
  let tree = harness.render()
  button(tree, SUBMIT)!.props.onClick()
  await settle()
  tree = harness.render()

  assert.match(textOf(tree), /Das Absenden hat nicht geklappt\. Versuch es nochmal\./)
  assert.ok(button(tree, SUBMIT), "still offered, so she can simply tap again")
})
