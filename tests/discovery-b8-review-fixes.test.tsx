import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import type { ScanSearchResult } from "../src/app/api/scan/search/route"
import {
  DiscoveryAddSheet,
  DiscoveryFrequencyStep,
  trackSheetOverlay,
} from "../src/components/discovery/intake/discovery-add-sheet"
import { DiscoveryIntakeChecklist } from "../src/components/discovery/intake/discovery-intake-checklist"
import { BeforeCommit, useSettledTap } from "../src/components/discovery/intake/discovery-motion"
import {
  DiscoveryProductCard,
  DiscoveryProductsScreen,
} from "../src/components/discovery/intake/discovery-products-screen"
import { DiscoveryRoutineScreen } from "../src/components/discovery/intake/discovery-routine-screen"
import type { DiscoveryIntakeItemView } from "../src/components/discovery/intake/types"
import { MOTION_MS } from "../src/lib/motion"

/**
 * Batch 8 review fixes (Codex whole-branch review of 8b): each test reproduces the
 * interleaving the review found. Same hand-rolled dispatcher family as
 * `tests/discovery-b8-motion.test.tsx` (no jsdom in this repo); this one also records
 * effects so a test can mount and unmount a hook.
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

function isOn(tree: ReactNode, type: unknown): boolean {
  return findAll(tree, (element) => element.type === type).length > 0
}

function createHarness<T>(render: () => T) {
  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const values: unknown[] = []
  let effects: Array<() => void | (() => void)> = []
  const cleanups: Array<() => void> = []
  let cursor = 0
  const dispatcher = {
    useState<S>(initial: S | (() => S)): [S, (next: S | ((previous: S) => S)) => void] {
      const index = cursor++
      if (values.length <= index) {
        values[index] = typeof initial === "function" ? (initial as () => S)() : initial
      }
      return [
        values[index] as S,
        (next) => {
          values[index] =
            typeof next === "function" ? (next as (previous: S) => S)(values[index] as S) : next
        },
      ]
    },
    useRef<S>(initial: S): { current: S } {
      const index = cursor++
      if (values.length <= index) values[index] = { current: initial }
      return values[index] as { current: S }
    },
    useEffect(effect: () => void | (() => void)) {
      effects.push(effect)
    },
  }
  return {
    render(): T {
      cursor = 0
      effects = []
      const previous = internals.H
      internals.H = dispatcher
      try {
        return render()
      } finally {
        internals.H = previous
      }
    },
    /** Runs the last render's effects once (a mount). */
    mount() {
      for (const effect of effects) {
        const cleanup = effect()
        if (typeof cleanup === "function") cleanups.push(cleanup)
      }
    },
    unmount() {
      for (const cleanup of cleanups.splice(0)) cleanup()
    },
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
async function flush() {
  for (let index = 0; index < 5; index += 1) await settle()
}

type Recorded = { url: string; method: string | undefined; body: unknown }
type Reply = { status: number; body: unknown }

function mockFetch(
  t: { after: (fn: () => void) => void },
  respond: (request: Recorded) => Reply | Promise<Reply>,
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
    const { status, body } = await respond(request)
    return { ok: status < 400, status, json: async () => body } as unknown as Response
  }) as typeof fetch
  return requests
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
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

function checklist(items: DiscoveryIntakeItemView[]) {
  return createHarness(() =>
    DiscoveryIntakeChecklist({
      initialItems: items,
      initialSubmitted: false,
      retailerSearchEnabled: false,
    }),
  )
}

const products = (tree: ReactNode) => find(tree, DiscoveryProductsScreen)
const sheet = (tree: ReactNode) => find(tree, DiscoveryAddSheet)
const ids = (tree: ReactNode) =>
  (products(tree).props.items as DiscoveryIntakeItemView[]).map((item) => item.id)

const MASK: ScanSearchResult = {
  id: "20000000-0000-4000-8000-000000000009",
  name: "Plex Care Maske",
  brand: "Balea",
  category: "mask",
  categoryLabel: "Maske",
  imageUrl: null,
  productLine: null,
}

/** Products → search → pick the mask → its frequency step (no usage question for a mask). */
function toMaskFrequency(harness: ReturnType<typeof checklist>) {
  let tree = harness.render()
  products(tree).props.onSearch("mask")
  tree = harness.render()
  sheet(tree).props.handlers.onPickCatalog(MASK)
  return harness.render()
}

// --- 1. „Weiter" advances only on a settled success --------------------------------------

test("fix 1: „Weiter“ during a POST that fails stays on the products, with the sheet and its error", async (t) => {
  const reply = deferred<Reply>()
  mockFetch(t, () => reply.promise)
  const harness = checklist([view()])
  let tree = toMaskFrequency(harness)
  sheet(tree).props.handlers.onFrequency("weekly_1x")
  tree = harness.render()
  products(tree).props.onContinue()
  reply.resolve({ status: 503, body: { code: "unavailable" } })
  await flush()
  tree = harness.render()
  assert.equal(isOn(tree, DiscoveryRoutineScreen), false, "no advance on a failed add")
  assert.equal(sheet(tree).props.open, true)
  assert.equal(sheet(tree).props.error, "Das hat gerade nicht geklappt. Versuch es nochmal.")
  assert.deepEqual(ids(tree), ["item-1"])
})

test("fix 1: „Weiter“ during a POST answered „already submitted“ lands on done and stays there", async (t) => {
  const reply = deferred<Reply>()
  mockFetch(t, () => reply.promise)
  const harness = checklist([view()])
  let tree = toMaskFrequency(harness)
  sheet(tree).props.handlers.onFrequency("weekly_1x")
  tree = harness.render()
  products(tree).props.onContinue()
  reply.resolve({ status: 409, body: { code: "already_submitted" } })
  await flush()
  tree = harness.render()
  assert.equal(isOn(tree, DiscoveryRoutineScreen), false)
  assert.match(renderToStaticMarkup(tree), /Danke! Bis bald im Gespräch\./)
})

test("fix 1: after the wait „Weiter“ reads the CURRENT items, not the ones from its tap", async (t) => {
  const reply = deferred<Reply>()
  mockFetch(t, () => reply.promise)
  // A draft without a frequency would open „Wie oft?" — but she removes it while „Weiter" waits.
  const legacy = view({ id: "legacy", frequency: undefined, productNameText: "Alt" })
  const harness = checklist([view(), legacy])
  let tree = harness.render()
  products(tree).props.onRemove("legacy")
  tree = harness.render()
  products(tree).props.onContinue()
  reply.resolve({ status: 204, body: null })
  await flush()
  tree = harness.render()
  assert.equal(isOn(tree, DiscoveryRoutineScreen), true, "on to the routine")
  assert.equal(sheet(tree).props.open, false, "no „Wie oft?“ for a removed draft")
})

// --- 2. One add per sheet opening; a settle never outlives its step ------------------------

test("fix 2: a second frequency commit in the same opening does not add the product twice", async (t) => {
  const requests = mockFetch(t, () => new Promise<Reply>(() => {}))
  const harness = checklist([view()])
  const tree = toMaskFrequency(harness)
  const handlers = sheet(tree).props.handlers
  handlers.onFrequency("weekly_1x")
  handlers.onFrequency("weekly_2x")
  await settle()
  assert.equal(requests.length, 1)
  assert.equal(ids(harness.render()).length, 2, "one provisional card")
})

test("fix 2: a late commit from an earlier sheet opening is ignored", async (t) => {
  const requests = mockFetch(t, () => new Promise<Reply>(() => {}))
  const harness = checklist([view()])
  let tree = toMaskFrequency(harness)
  const stale = sheet(tree).props.handlers
  stale.onOpenChange(false)
  tree = harness.render()
  products(tree).props.onSearch(null)
  harness.render()
  stale.onFrequency("weekly_1x")
  await settle()
  assert.equal(requests.length, 0)
})

test("fix 2: a tap whose step goes away within the settle never commits", async () => {
  let commits = 0
  const hook = createHarness(() => useSettledTap<string>())
  hook.render()
  hook.mount()
  const [, tap] = hook.render()
  tap("weekly_1x", () => {
    commits += 1
  })
  hook.unmount() // Back within the settle: the step leaves.
  await wait(MOTION_MS.settle + 40)
  assert.equal(commits, 0)
})

// --- 3. Concurrent remove failures keep the capture order ---------------------------------

test("fix 3: two failed removes come back in their original order", async (t) => {
  const replies = new Map<string, ReturnType<typeof deferred<Reply>>>()
  mockFetch(t, (request) => {
    const reply = deferred<Reply>()
    replies.set(request.url.split("/").at(-1)!, reply)
    return reply.promise
  })
  const harness = checklist([view({ id: "a" }), view({ id: "b" }), view({ id: "c" })])
  let tree = harness.render()
  products(tree).props.onRemove("b")
  await wait(MOTION_MS.list + 20)
  tree = harness.render()
  products(tree).props.onRemove("c")
  await wait(MOTION_MS.list + 20)
  tree = harness.render()
  assert.deepEqual(ids(tree), ["a"])

  replies.get("b")!.resolve({ status: 503, body: { code: "unavailable" } })
  await flush()
  replies.get("c")!.resolve({ status: 503, body: { code: "unavailable" } })
  await flush()
  assert.deepEqual(ids(harness.render()), ["a", "b", "c"])
})

// --- 4. The back-to-search overlay never outlives the next transition ----------------------

test("fix 4: the next sheet transition removes a back-to-search overlay still on screen", () => {
  let removed = 0
  trackSheetOverlay(() => {
    removed += 1
  })
  const harness = createHarness(() =>
    DiscoveryAddSheet({
      open: true,
      session: 1,
      flow: null,
      busy: false,
      error: null,
      retailerSearchEnabled: false,
      handlers: {} as never,
    }),
  )
  const boundary = find(harness.render(), BeforeCommit)
  // A step → step change inside the open sheet (nothing to slide at sheet level).
  assert.equal(boundary.props.capture("1:steps:2:usage", "1:steps:3:frequency"), null)
  assert.equal(removed, 1)
})

// --- 5. A failed save puts the saved answer back ------------------------------------------

test("fix 5: after a failed frequency save the step shows the saved answer again", () => {
  let rejections = 0
  const step = createHarness(() =>
    DiscoveryFrequencyStep({
      step: { kind: "frequency", current: "weekly_2x", suggestion: null },
      busy: false,
      rejections,
      onFrequency: () => {},
    }),
  )
  const marked = (tree: ReactNode) =>
    findAll(tree, (element) => element.props.on === true).map((element) => element.props.label)
  let tree = step.render()
  assert.deepEqual(marked(tree), ["2× pro Woche"])
  findAll(tree, (element) => element.props.label === "Täglich")[0].props.onClick()
  tree = step.render()
  assert.deepEqual(marked(tree), ["Täglich"], "her tap shows while it saves")
  rejections = 1
  tree = step.render()
  assert.deepEqual(marked(tree), ["2× pro Woche"], "the server kept the old value")
})

test("fix 5: the checklist counts a failed PATCH so the sheet can reset, error kept", async (t) => {
  mockFetch(t, () => ({ status: 503, body: { code: "unavailable" } }))
  const harness = checklist([view()])
  let tree = harness.render()
  products(tree).props.onFrequency(view())
  tree = harness.render()
  assert.equal(sheet(tree).props.rejections, 0)
  sheet(tree).props.handlers.onFrequency("daily_1x")
  await flush()
  tree = harness.render()
  assert.equal(sheet(tree).props.rejections, 1)
  assert.equal(sheet(tree).props.error, "Das hat gerade nicht geklappt. Versuch es nochmal.")
  assert.equal(sheet(tree).props.open, true, "she can retry")
})

// --- 6. A provisional card's controls are unavailable, not silent -------------------------

test("fix 6: a card still on its way exposes no working controls — unavailable, not dimmed", () => {
  const html = renderToStaticMarkup(
    <DiscoveryProductCard
      item={view({ id: "provisional:1", frequency: undefined })}
      landed
      onEdit={() => {}}
      onFrequency={() => {}}
      onRemove={() => {}}
    />,
  )
  const buttons = [...html.matchAll(/<button[^>]*>/g)].map((match) => match[0])
  assert.equal(buttons.length, 3, "edit, „Wie oft?“, remove")
  for (const button of buttons) {
    assert.match(button, /aria-disabled="true"/)
    assert.match(button, /tabindex="-1"/)
    assert.doesNotMatch(button, /\sdisabled=""/)
    assert.doesNotMatch(button, /opacity-/, "nothing dims")
  }

  const settled = renderToStaticMarkup(
    <DiscoveryProductCard
      item={view()}
      landed={false}
      onEdit={() => {}}
      onFrequency={() => {}}
      onRemove={() => {}}
    />,
  )
  assert.doesNotMatch(settled, /aria-disabled|tabindex="-1"/)
})

test("fix 1 (confirm pass): a sheet opened while „Weiter“ waits keeps her on the products", async (t) => {
  const reply = deferred<Reply>()
  mockFetch(t, () => reply.promise)
  const harness = checklist([view()])
  let tree = toMaskFrequency(harness)
  sheet(tree).props.handlers.onFrequency("weekly_1x")
  tree = harness.render()
  products(tree).props.onContinue()
  // While „Weiter" waits she opens a second add sheet …
  products(tree).props.onSearch(null)
  tree = harness.render()
  assert.equal(sheet(tree).props.open, true)
  // … and the first add succeeds before that sheet saved anything.
  reply.resolve({
    status: 201,
    body: { item: view({ id: "item-mask", category: "mask", productType: "mask" }) },
  })
  await flush()
  tree = harness.render()
  assert.equal(isOn(tree, DiscoveryRoutineScreen), false, "no advance under an open sheet")
  assert.equal(sheet(tree).props.open, true, "her new sheet stays")
  assert.deepEqual(ids(tree), ["item-1", "item-mask"])
})
