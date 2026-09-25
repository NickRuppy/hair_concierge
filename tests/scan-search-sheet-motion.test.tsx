import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"

import { ScanSearchSheet } from "../src/components/scan/scan-search-sheet"
import { Skeleton } from "../src/components/ui/skeleton"
import { BottomSheetContent } from "../src/components/ui/bottom-sheet"
import type { ScanSearchResult } from "../src/app/api/scan/search/route"
import type { ScanRetailerResult } from "../src/app/api/scan/search-retailer/route"
import { MOTION_MS } from "../src/lib/motion"

/**
 * Batch 8b: the "search blinks per keystroke" motion fixes on the SHARED
 * `ScanSearchSheet` — old rows stay on screen through a reload, skeletons only show for
 * a genuinely first load and only once `MOTION_MS.loaderDelay` (300ms) of real fetching
 * has elapsed, the dm lane keeps its own rows through its own reload, `resultsFooter`
 * stays mounted for the rest of the sheet session once it has shown, and the new
 * `stepHeader` prop keeps the header slot from going blank while `stepContent` is up.
 *
 * Same hand-rolled hook-dispatcher harness as `tests/discovery-search-sheet-props.test.tsx`
 * / `tests/scan-flow-ui.test.tsx` (no jsdom in this repo) — the component function is
 * called directly and the returned element tree is walked. This file additionally uses
 * `node:test`'s mock timers so the 250ms/500ms debounces and the 300ms loader delay are
 * asserted deterministically instead of racing real wall-clock waits.
 *
 * The component's own debounce/min-length constants aren't exported; they are mirrored
 * here (matching the header comment + constants in scan-search-sheet.tsx) the same way
 * `tests/scan-flow-ui.test.tsx` mirrors them (its `AUTO_DM_WAIT_MS`).
 */

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 250
const RETAILER_AUTO_MIN_QUERY_LENGTH = 3
const RETAILER_DEBOUNCE_MS = 500
const LOADER_DELAY_MS = MOTION_MS.loaderDelay // 300

Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis })

// --- element-tree helpers (copied from the sibling ScanSearchSheet suites) -------------

type AnyElement = ReactElement<Record<string, any>>

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

function isSkeleton(element: AnyElement): boolean {
  return element.type === Skeleton
}

// --- hook harness (same pattern as discovery-search-sheet-props.test.tsx, but the
// "let async work settle" step flushes MICROTASKS only — no real setTimeout — so it
// composes with node:test's mock timers instead of racing them) -----------------------

type ReactDispatcherInternals = { H: unknown }
type EffectRecord = { deps: unknown[] | undefined; cleanup?: () => void }

function createHarness(renderComponent: () => ReactElement | null) {
  const reactInternals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const previousDispatcher = reactInternals.H
  const hookValues: unknown[] = []
  let cursor = 0
  let pendingEffects: Array<{ index: number; effect: () => void | (() => void) }> = []

  function depsChanged(previous: unknown[] | undefined, next: unknown[] | undefined): boolean {
    return (
      !previous ||
      !next ||
      previous.length !== next.length ||
      next.some((dep, index) => dep !== previous[index])
    )
  }

  const dispatcher = {
    useCallback<T extends (...args: never[]) => unknown>(callback: T): T {
      return callback
    },
    useEffect(effect: () => void | (() => void), deps?: unknown[]) {
      const index = cursor
      cursor += 1
      const previous = hookValues[index] as EffectRecord | undefined
      if (!depsChanged(previous?.deps, deps)) return
      previous?.cleanup?.()
      hookValues[index] = { deps } satisfies EffectRecord
      pendingEffects.push({ index, effect })
    },
    useRef<T>(initialValue: T): { current: T } {
      const index = cursor
      cursor += 1
      if (!hookValues[index]) hookValues[index] = { current: initialValue }
      return hookValues[index] as { current: T }
    },
    useState<T>(initialState: T | (() => T)): [T, (next: T | ((previous: T) => T)) => void] {
      const index = cursor
      cursor += 1
      if (hookValues.length <= index) {
        hookValues[index] =
          typeof initialState === "function" ? (initialState as () => T)() : initialState
      }
      return [
        hookValues[index] as T,
        (next) => {
          hookValues[index] =
            typeof next === "function" ? (next as (previous: T) => T)(hookValues[index] as T) : next
        },
      ]
    },
  }

  async function flushMicrotasks() {
    // Enough round trips for a `fetch(...)` mock's own `await`s (the call itself, then
    // `response.json()`) to resolve and write their state before the next render reads it.
    for (let i = 0; i < 6; i += 1) await Promise.resolve()
  }

  async function doRender(): Promise<ReactElement | null> {
    cursor = 0
    pendingEffects = []
    reactInternals.H = dispatcher
    try {
      const tree = renderComponent()
      const effects = pendingEffects
      pendingEffects = []
      for (const { index, effect } of effects) {
        const cleanup = effect()
        if (typeof cleanup === "function") (hookValues[index] as EffectRecord).cleanup = cleanup
      }
      await flushMicrotasks()
      return tree
    } finally {
      reactInternals.H = previousDispatcher
    }
  }

  const view = {
    tree: null as ReactElement | null,
    async settle(): Promise<ReactElement | null> {
      // A single `doRender()` captures the tree BEFORE its own microtask flush lets any
      // just-resolved fetch write its state — so state a caller resolved right before
      // calling `settle()` only becomes visible on a SECOND pass. Same two-render
      // convention as `mountSearchSheet` in tests/scan-flow-ui.test.tsx.
      await doRender()
      view.tree = await doRender()
      return view.tree
    },
  }
  return view
}

type Harness = ReturnType<typeof createHarness>

function queryInputProps(tree: ReactNode): Record<string, any> {
  const field = findAll(tree, (element) => element.props.type === "search")[0]
  assert.ok(field, "expected the search field")
  return field.props
}

async function typeQuery(view: Harness, value: string) {
  queryInputProps(view.tree).onChange({ target: { value } })
  return view.settle()
}

function submitButton(tree: ReactNode): AnyElement {
  const match = findAll(
    tree,
    (element) => element.type === "button" && element.props["aria-label"] === "Suchen",
  )[0]
  assert.ok(match, "expected the Suchen button")
  return match
}

// --- fixtures + a gated fetch stub (one deferred response per query, per lane) ---------

function catalogResult(overrides: Partial<ScanSearchResult> = {}): ScanSearchResult {
  return {
    id: overrides.id ?? "20000000-0000-4000-8000-000000000001",
    name: overrides.name ?? "Ruhig Shampoo",
    brand: overrides.brand ?? "Ruhig",
    category: "shampoo",
    categoryLabel: "Shampoo",
    imageUrl: null,
    ...overrides,
  }
}

function retailerResult(overrides: Partial<ScanRetailerResult> = {}): ScanRetailerResult {
  return {
    gtin: overrides.gtin ?? "4000000000017",
    name: overrides.name ?? "dm Ruhig Spülung",
    brand: overrides.brand ?? "Ruhig",
    categoryLabel: "Spülung",
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function queryOf(url: string): string {
  return new URL(url, "http://test").searchParams.get("q") ?? ""
}

/**
 * Every catalog/dm request for a given query is gated behind its own deferred promise —
 * nothing answers until the test explicitly resolves it. `gates.catalog`/`gates.dm` are
 * created lazily per query text so a single stub covers a whole test.
 */
function createGatedFetch() {
  const catalog = new Map<string, ReturnType<typeof deferred<{ results: ScanSearchResult[] }>>>()
  const dm = new Map<
    string,
    ReturnType<
      typeof deferred<{
        catalog: ScanSearchResult[]
        retailer: ScanRetailerResult[]
        retailerOutcome: "ok" | "unavailable" | "disabled"
      }>
    >
  >()

  function catalogGate(q: string) {
    let gate = catalog.get(q)
    if (!gate) {
      gate = deferred()
      catalog.set(q, gate)
    }
    return gate
  }
  function dmGate(q: string) {
    let gate = dm.get(q)
    if (!gate) {
      gate = deferred()
      dm.set(q, gate)
    }
    return gate
  }

  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input)
    const q = queryOf(url)
    if (url.startsWith("/api/scan/search-retailer")) {
      const body = await dmGate(q).promise
      return { ok: true, json: async () => body } as unknown as Response
    }
    const body = await catalogGate(q).promise
    return { ok: true, json: async () => body } as unknown as Response
  }) as typeof fetch

  return { fetchImpl, catalogGate, dmGate }
}

function stubFetch(fetchImpl: typeof fetch) {
  const original = globalThis.fetch
  globalThis.fetch = fetchImpl
  return () => {
    globalThis.fetch = original
  }
}

function mountSheet(overrides: Partial<Parameters<typeof ScanSearchSheet>[0]> = {}): Harness {
  return createHarness(() =>
    ScanSearchSheet({
      open: true,
      reason: "manual",
      onOpenChange: () => undefined,
      onSelectProduct: () => undefined,
      ...overrides,
    }),
  )
}

// --- (a) old rows stay up through the debounce AND through the next fetch --------------

test("typing a new query keeps old rows visible during the debounce and during the fetch", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const { fetchImpl, catalogGate } = createGatedFetch()
  const restore = stubFetch(fetchImpl)
  try {
    const first = catalogResult({ id: "row-first", name: "Erstes Shampoo" })
    const second = catalogResult({ id: "row-second", name: "Zweites Shampoo" })
    const view = mountSheet()
    await view.settle()

    await typeQuery(view, "erst")
    t.mock.timers.tick(DEBOUNCE_MS)
    catalogGate("erst").resolve({ results: [first] })
    await view.settle()
    assert.ok(textContent(view.tree).includes(first.name), "first query's row is on screen")

    // A new keystroke: nothing may change yet — the debounce hasn't even started counting
    // down to a new fetch, so the OLD rows are still exactly what's on screen.
    await typeQuery(view, "zwei")
    assert.ok(textContent(view.tree).includes(first.name), "old row survives the keystroke")
    assert.equal(findAll(view.tree, isSkeleton).length, 0, "no skeleton during the debounce")

    // Debounce elapses: the new fetch starts, but it's gated — still old rows, no skeleton
    // (rows are already on screen, so this can never be a "first load").
    t.mock.timers.tick(DEBOUNCE_MS)
    await view.settle()
    assert.ok(textContent(view.tree).includes(first.name), "old row survives while refetching")
    assert.equal(findAll(view.tree, isSkeleton).length, 0, "reload with old rows never skeletons")

    // Even past the loader delay, still the stale row — nothing timer-driven forces a
    // skeleton onto a reload that already has rows.
    t.mock.timers.tick(LOADER_DELAY_MS)
    await view.settle()
    assert.ok(textContent(view.tree).includes(first.name))
    assert.equal(findAll(view.tree, isSkeleton).length, 0)

    // The second query's answer lands: it replaces the first query's row.
    catalogGate("zwei").resolve({ results: [second] })
    await view.settle()
    assert.ok(textContent(view.tree).includes(second.name))
    assert.equal(textContent(view.tree).includes(first.name), false, "stale row is gone")
  } finally {
    restore()
    t.mock.timers.reset()
  }
})

// --- (b) skeleton timing: never under 300ms, only for a genuine first load -------------

test("no skeleton when the fetch answers in <300ms; a first load only skeletons after 300ms in flight", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const { fetchImpl, catalogGate } = createGatedFetch()
  const restore = stubFetch(fetchImpl)
  try {
    // Case 1: the fetch answers before the loader delay elapses — no skeleton, ever.
    const fastResult = catalogResult({ id: "row-fast", name: "Schnelles Shampoo" })
    const fast = mountSheet()
    await fast.settle()
    await typeQuery(fast, "fix")
    t.mock.timers.tick(DEBOUNCE_MS)
    await fast.settle()
    assert.equal(findAll(fast.tree, isSkeleton).length, 0, "nothing yet — still under 300ms")
    catalogGate("fix").resolve({ results: [fastResult] })
    await fast.settle()
    assert.ok(textContent(fast.tree).includes(fastResult.name))
    assert.equal(
      findAll(fast.tree, isSkeleton).length,
      0,
      "answered before 300ms: never a skeleton",
    )
    // Advancing time after the fact must not retroactively show one.
    t.mock.timers.tick(LOADER_DELAY_MS)
    await fast.settle()
    assert.equal(findAll(fast.tree, isSkeleton).length, 0)

    // Case 2: the fetch is still in flight once 300ms have passed — first load, so the
    // skeleton is due; it clears the moment the (still gated) fetch finally answers.
    const slowResult = catalogResult({ id: "row-slow", name: "Langsames Shampoo" })
    const slow = mountSheet()
    await slow.settle()
    await typeQuery(slow, "lang")
    t.mock.timers.tick(DEBOUNCE_MS)
    await slow.settle()
    assert.equal(findAll(slow.tree, isSkeleton).length, 0, "under 300ms of being in flight")
    t.mock.timers.tick(LOADER_DELAY_MS)
    await slow.settle()
    assert.ok(
      findAll(slow.tree, isSkeleton).length > 0,
      "300ms in flight with nothing on screen yet",
    )
    catalogGate("lang").resolve({ results: [slowResult] })
    await slow.settle()
    assert.equal(findAll(slow.tree, isSkeleton).length, 0, "skeleton clears once the rows land")
    assert.ok(textContent(slow.tree).includes(slowResult.name))
  } finally {
    restore()
    t.mock.timers.reset()
  }
})

// --- (c) a reload with old rows already shown never skeletons, however long it takes ---

test("no skeleton on a reload when old rows are already shown, even past 300ms in flight", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const { fetchImpl, catalogGate } = createGatedFetch()
  const restore = stubFetch(fetchImpl)
  try {
    const first = catalogResult({ id: "row-a", name: "Bestandshampoo" })
    const view = mountSheet()
    await view.settle()
    await typeQuery(view, "best")
    t.mock.timers.tick(DEBOUNCE_MS)
    catalogGate("best").resolve({ results: [first] })
    await view.settle()
    assert.ok(textContent(view.tree).includes(first.name))

    await typeQuery(view, "bestand")
    t.mock.timers.tick(DEBOUNCE_MS)
    await view.settle()
    t.mock.timers.tick(LOADER_DELAY_MS * 3)
    await view.settle()
    assert.equal(
      findAll(view.tree, isSkeleton).length,
      0,
      "old rows are on screen for the whole reload — never a skeleton, however long it runs",
    )
    assert.ok(textContent(view.tree).includes(first.name), "the stale row is still the one shown")
  } finally {
    restore()
    t.mock.timers.reset()
  }
})

// --- (d) the dm lane keeps its own rows through its own reload -------------------------

test("dm rows persist while a new dm request runs and are replaced once it answers", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const { fetchImpl, catalogGate, dmGate } = createGatedFetch()
  const restore = stubFetch(fetchImpl)
  try {
    const dmFirst = retailerResult({ gtin: "1", name: "dm Erste Spülung" })
    const dmSecond = retailerResult({ gtin: "2", name: "dm Zweite Spülung" })
    const view = mountSheet({ retailerSearchEnabled: true })
    await view.settle()

    // First query: catalog answers empty (keeps this test focused on the dm lane), dm
    // answers with one row after its own typing-pause debounce.
    await typeQuery(view, "aqua")
    t.mock.timers.tick(DEBOUNCE_MS)
    catalogGate("aqua").resolve({ results: [] })
    await view.settle()
    t.mock.timers.tick(RETAILER_DEBOUNCE_MS - DEBOUNCE_MS)
    await view.settle()
    dmGate("aqua").resolve({ catalog: [], retailer: [dmFirst], retailerOutcome: "ok" })
    await view.settle()
    assert.ok(textContent(view.tree).includes(dmFirst.name), "the dm lane's first row is up")

    // A refined query still long enough to re-run the dm lane: its OLD row must stay up
    // through the new debounce and the new (gated) fetch — no clearing on request start.
    await typeQuery(view, "aqua revive")
    catalogGate("aqua revive").resolve({ results: [] })
    assert.ok(
      textContent(view.tree).includes(dmFirst.name),
      "the dm row survives the keystroke that starts a new dm request",
    )
    t.mock.timers.tick(RETAILER_DEBOUNCE_MS)
    await view.settle()
    assert.ok(
      textContent(view.tree).includes(dmFirst.name),
      "the dm row is still up while its own reload is in flight",
    )
    assert.equal(
      findAll(view.tree, isSkeleton).length,
      0,
      "a dm reload with rows already on screen never shows the dm skeleton",
    )

    // The reload answers: the old dm row is replaced by the new one.
    dmGate("aqua revive").resolve({ catalog: [], retailer: [dmSecond], retailerOutcome: "ok" })
    await view.settle()
    assert.ok(textContent(view.tree).includes(dmSecond.name))
    assert.equal(textContent(view.tree).includes(dmFirst.name), false, "the stale dm row is gone")
  } finally {
    restore()
    t.mock.timers.reset()
  }
})

// --- (e) resultsFooter stays mounted across a reload once it has shown -----------------

test("resultsFooter stays mounted across a reload once the catalog lane has answered once", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const { fetchImpl, catalogGate } = createGatedFetch()
  const restore = stubFetch(fetchImpl)
  try {
    const first = catalogResult({ id: "row-f1", name: "Fußzeile Shampoo" })
    const second = catalogResult({ id: "row-f2", name: "Fußzeile Zwei Shampoo" })
    const view = mountSheet({
      resultsFooter: <button data-footer="typed">Selbst eintragen</button>,
    })
    await view.settle()

    const footerCount = () =>
      findAll(view.tree, (element) => element.props["data-footer"] === "typed").length

    await typeQuery(view, "fuss")
    t.mock.timers.tick(DEBOUNCE_MS)
    await view.settle()
    assert.equal(footerCount(), 0, "not shown before the lane has ever answered")
    catalogGate("fuss").resolve({ results: [first] })
    await view.settle()
    assert.equal(footerCount(), 1, "shown once the lane answers")

    // A reload of a refined query: the footer must stay mounted through the WHOLE reload,
    // not just reappear once the new answer lands.
    await typeQuery(view, "fussz")
    t.mock.timers.tick(DEBOUNCE_MS)
    await view.settle()
    assert.equal(footerCount(), 1, "still mounted while the reload is in flight")

    catalogGate("fussz").resolve({ results: [second] })
    await view.settle()
    assert.equal(footerCount(), 1, "still mounted once the reload settles")
    assert.ok(textContent(view.tree).includes(second.name))

    // Clearing the query below the 2-char minimum is the one thing that resets it.
    await typeQuery(view, "f")
    assert.equal(footerCount(), 0, "reset once the query drops below the minimum")
  } finally {
    restore()
    t.mock.timers.reset()
  }
})

// --- (f) stepHeader renders in the header slot while stepContent is up -----------------

test("stepHeader renders in the header slot while stepContent is set; omitting it keeps the old (blank) behaviour", async () => {
  const restore = stubFetch((async () => ({
    ok: true,
    json: async () => ({ results: [] }),
  })) as unknown as typeof fetch)
  try {
    let stepContent: ReactNode = null
    let stepHeader: ReactNode = undefined
    const view = mountSheet({
      get stepContent() {
        return stepContent
      },
      get stepHeader() {
        return stepHeader
      },
    } as Partial<Parameters<typeof ScanSearchSheet>[0]>)
    await view.settle()

    const headerOf = (tree: ReactNode) =>
      findAll(tree, (element) => element.type === BottomSheetContent)[0]?.props.header

    // Baseline: no stepContent yet, so the plain search header shows (not stepHeader).
    assert.ok(headerOf(view.tree), "the default search header renders")

    stepContent = <div data-step="frequency">Wie oft nutzt du es?</div>
    stepHeader = <div data-step-header="frequency">Wie oft nutzt du es?</div>
    await view.settle()
    // `header` is a sibling PROP of `BottomSheetContent`, not one of its `children` — the
    // tree-walking `findAll` above only descends through `children`, so the header slot's
    // own element is checked by direct prop identity instead (same technique the sibling
    // suite's "batch 7: `stepContent` replaces header…" test uses).
    assert.equal(headerOf(view.tree), stepHeader, "stepHeader fills the header slot")

    // Without a stepHeader, the header slot goes back to rendering nothing — the
    // pre-existing, backward-compatible behaviour for every caller that doesn't pass it.
    stepHeader = undefined
    await view.settle()
    assert.equal(headerOf(view.tree), undefined, "no stepHeader: the header slot stays blank")
    assert.equal(
      findAll(view.tree, (element) => element.props["data-step"] === "frequency").length,
      1,
      "stepContent itself is unaffected",
    )
  } finally {
    restore()
  }
})
