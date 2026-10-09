import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"

import { ScanSearchSheet } from "../src/components/scan/scan-search-sheet"
import { BottomSheetContent } from "../src/components/ui/bottom-sheet"
import type { ScanSearchResult } from "../src/app/api/scan/search/route"
import type { ScanRetailerResult } from "../src/app/api/scan/search-retailer/route"

/**
 * The two ADDITIVE props the discovery checklist needs from the shared search
 * sheet: `onSelectProductResult` and `onSelectRetailerResultRow`, each carrying
 * the whole row instead of only its id.
 *
 * "Additive" is the load-bearing word, so the assertions are as much about what
 * did NOT change: both id-only callbacks still fire, with the same values, on the
 * same tap. The existing sheet and flow suites are untouched and stay green —
 * they are the other half of this proof.
 *
 * Same hand-rolled hook dispatcher as `tests/scan-flow-ui.test.tsx` (no
 * jsdom/testing-library in this repo): the component function is called directly
 * and the returned element tree is walked.
 */

Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis })

type AnyElement = ReactElement<Record<string, any>>
type ReactDispatcherInternals = { H: unknown }
type EffectRecord = { deps: unknown[] | undefined; cleanup?: () => void }

function childrenOf(node: ReactNode): ReactNode[] {
  if (!React.isValidElement(node)) return []
  return React.Children.toArray((node as ReactElement<{ children?: ReactNode }>).props.children)
}

function findAll(node: ReactNode, predicate: (element: AnyElement) => boolean): AnyElement[] {
  if (!React.isValidElement(node)) return []
  const element = node as AnyElement
  const matches = predicate(element) ? [element] : []
  return [...matches, ...childrenOf(element).flatMap((child) => findAll(child, predicate))]
}

function createHarness(render: () => ReactElement | null) {
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

  return {
    async render(): Promise<ReactElement | null> {
      cursor = 0
      pendingEffects = []
      reactInternals.H = dispatcher
      try {
        const tree = render()
        const effects = pendingEffects
        pendingEffects = []
        for (const { index, effect } of effects) {
          const cleanup = effect()
          if (typeof cleanup === "function") (hookValues[index] as EffectRecord).cleanup = cleanup
        }
        // Let the search lanes' fetch promises settle and write their state
        // before the tree is handed back.
        await new Promise((resolve) => setTimeout(resolve, 0))
        return tree
      } finally {
        reactInternals.H = previousDispatcher
      }
    },
  }
}

const catalogResult: ScanSearchResult = {
  id: "20000000-0000-4000-8000-000000000009",
  name: "Elvital Hyaluron Pure Shampoo",
  brand: "L'Oréal Elvital",
  category: "shampoo",
  categoryLabel: "Shampoo",
  imageUrl: null,
}

const retailerResult: ScanRetailerResult = {
  gtin: "4066447107524",
  name: "Balea Professional Repair Shampoo",
  brand: "Balea",
  categoryLabel: "Shampoo",
}

function stubFetch() {
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    const body = url.includes("search-retailer")
      ? { catalog: [], retailer: [retailerResult], retailerOutcome: "ok" }
      : { results: [catalogResult], truncated: false }
    return { ok: true, json: async () => body } as unknown as Response
  }) as unknown as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

type Taps = {
  productIds: string[]
  productResults: ScanSearchResult[]
  retailerGtins: string[]
  retailerRows: ScanRetailerResult[]
}

async function openSheetWithResults(taps: Taps) {
  const harness = createHarness(() =>
    ScanSearchSheet({
      open: true,
      reason: "manual",
      onOpenChange: () => undefined,
      onSelectProduct: (productId: string) => taps.productIds.push(productId),
      onSelectProductResult: (result: ScanSearchResult) => taps.productResults.push(result),
      onSelectRetailerResult: (gtin: string) => taps.retailerGtins.push(gtin),
      onSelectRetailerResultRow: (result: ScanRetailerResult) => taps.retailerRows.push(result),
      retailerSearchEnabled: true,
    }),
  )

  await harness.render()
  // Type a query, then submit it — submitting fires both lanes without waiting
  // for the typing debounce.
  const field = findAll(await harness.render(), (element) => element.props.type === "search")[0]
  assert.ok(field, "expected the search field")
  field.props.onChange({ target: { value: "elvital" } })

  const tree = await harness.render()
  const submit = findAll(tree, (element) => element.props["aria-label"] === "Suchen")[0]
  assert.ok(submit, "expected the Suchen button")
  submit.props.onClick()

  // One render to let both lanes' responses land, one more to read the tree they
  // produced.
  await harness.render()
  return harness.render()
}

test("a catalog row tap reports BOTH the id and the whole result", async () => {
  const restore = stubFetch()
  const taps: Taps = { productIds: [], productResults: [], retailerGtins: [], retailerRows: [] }
  try {
    const tree = await openSheetWithResults(taps)
    const rows = findAll(
      tree,
      (element) => element.type === "button" && typeof element.props.onClick === "function",
    )
    const catalogRow = rows.find((row) =>
      JSON.stringify(row.props).includes("Elvital Hyaluron Pure Shampoo"),
    )
    assert.ok(catalogRow, "expected the catalog result row")
    catalogRow.props.onClick()
  } finally {
    restore()
  }

  // The existing contract is untouched…
  assert.deepEqual(taps.productIds, [catalogResult.id])
  // …and the new prop carries what the checklist stores as brand/name text.
  assert.deepEqual(taps.productResults, [catalogResult])
})

test("a dm row tap reports BOTH the gtin and the whole row", async () => {
  const restore = stubFetch()
  const taps: Taps = { productIds: [], productResults: [], retailerGtins: [], retailerRows: [] }
  try {
    const tree = await openSheetWithResults(taps)
    const rows = findAll(
      tree,
      (element) => element.type === "button" && typeof element.props.onClick === "function",
    )
    const retailerRow = rows.find((row) =>
      JSON.stringify(row.props).includes("Balea Professional Repair Shampoo"),
    )
    assert.ok(retailerRow, "expected the dm result row")
    retailerRow.props.onClick()
  } finally {
    restore()
  }

  assert.deepEqual(taps.retailerGtins, [retailerResult.gtin])
  assert.deepEqual(taps.retailerRows, [retailerResult])
})

test("without the new props the sheet behaves exactly as before", async () => {
  const restore = stubFetch()
  const productIds: string[] = []
  try {
    const harness = createHarness(() =>
      ScanSearchSheet({
        open: true,
        reason: "manual",
        onOpenChange: () => undefined,
        onSelectProduct: (productId: string) => productIds.push(productId),
      }),
    )
    await harness.render()
    const field = findAll(await harness.render(), (element) => element.props.type === "search")[0]
    field.props.onChange({ target: { value: "elvital" } })
    const tree = await harness.render()
    findAll(tree, (element) => element.props["aria-label"] === "Suchen")[0].props.onClick()

    await harness.render()
    const rendered = await harness.render()
    const catalogRow = findAll(
      rendered,
      (element) => element.type === "button" && typeof element.props.onClick === "function",
    ).find((row) => JSON.stringify(row.props).includes("Elvital Hyaluron Pure Shampoo"))
    assert.ok(catalogRow, "expected the catalog result row")
    // No `onSelectProductResult` passed: the optional call is a no-op, not a throw.
    catalogRow.props.onClick()
  } finally {
    restore()
  }
  assert.deepEqual(productIds, [catalogResult.id])
})

// --- Batch 7: the discovery add sheet's steps inside the SAME open sheet ---------------------

test("batch 7: `stepContent` replaces header and search in the open sheet; the query survives", async () => {
  const restore = stubFetch()
  let stepContent: ReactNode = null
  try {
    const harness = createHarness(() =>
      ScanSearchSheet({
        open: true,
        reason: "manual",
        onOpenChange: () => undefined,
        onSelectProduct: () => undefined,
        stepContent,
      }),
    )
    await harness.render()
    const field = findAll(await harness.render(), (element) => element.props.type === "search")[0]
    field.props.onChange({ target: { value: "elvital" } })
    await harness.render()

    stepContent = <div data-step="frequency">Wie oft nutzt du es?</div>
    const stepped = await harness.render()
    const content = findAll(stepped, (element) => element.type === BottomSheetContent)[0]
    assert.equal(content.props.header, undefined, "no search header while a step is up")
    assert.equal(findAll(stepped, (element) => element.props.type === "search").length, 0)
    assert.equal(
      findAll(stepped, (element) => element.props["data-step"] === "frequency").length,
      1,
    )

    stepContent = null
    const back = await harness.render()
    const again = findAll(back, (element) => element.props.type === "search")[0]
    assert.equal(again.props.value, "elvital", "back to the search finds her query")
  } finally {
    restore()
  }
})

test("batch 7: `resultsFooter` shows once the catalog lane answered, never before", async () => {
  const restore = stubFetch()
  try {
    const harness = createHarness(() =>
      ScanSearchSheet({
        open: true,
        reason: "manual",
        onOpenChange: () => undefined,
        onSelectProduct: () => undefined,
        autoFocusSearch: true,
        sheetClassName: "h-[88dvh]",
        resultsFooter: <button data-footer="typed">Selbst eintragen</button>,
      }),
    )
    const idle = await harness.render()
    assert.equal(findAll(idle, (element) => element.props["data-footer"] === "typed").length, 0)
    const content = findAll(idle, (element) => element.type === BottomSheetContent)[0]
    assert.ok(content.props.initialFocusRef, "the search field takes the focus")
    assert.match(content.props.className, /h-\[88dvh\]/)

    const field = findAll(idle, (element) => element.props.type === "search")[0]
    field.props.onChange({ target: { value: "elvital" } })
    const tree = await harness.render()
    findAll(tree, (element) => element.props["aria-label"] === "Suchen")[0].props.onClick()
    await harness.render()
    const answered = await harness.render()
    assert.equal(findAll(answered, (element) => element.props["data-footer"] === "typed").length, 1)
  } finally {
    restore()
  }
})

test("batch 7: with the dm lane on, the footer sits BELOW the dm section and never hides it", async () => {
  const restore = stubFetch()
  try {
    const harness = createHarness(() =>
      ScanSearchSheet({
        open: true,
        reason: "manual",
        onOpenChange: () => undefined,
        onSelectProduct: () => undefined,
        retailerSearchEnabled: true,
        resultsFooter: <button data-footer="typed">Nicht dabei? Selbst eintragen</button>,
      }),
    )
    const idle = await harness.render()
    findAll(idle, (element) => element.props.type === "search")[0].props.onChange({
      target: { value: "elvital" },
    })
    const typed = await harness.render()
    findAll(typed, (element) => element.props["aria-label"] === "Suchen")[0].props.onClick()
    await harness.render()
    const answered = await harness.render()
    const flat = findAll(answered, () => true)
    const dmRow = flat.findIndex((element) =>
      JSON.stringify(element.props).includes("Balea Professional Repair Shampoo"),
    )
    const footer = flat.findIndex((element) => element.props["data-footer"] === "typed")
    assert.ok(dmRow >= 0, "the dm section still renders its rows")
    assert.ok(footer > dmRow, "the footer comes after the dm rows")
  } finally {
    restore()
  }
})
