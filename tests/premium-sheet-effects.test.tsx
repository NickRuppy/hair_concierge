import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"

import { BottomSheetContent } from "@/components/ui/bottom-sheet"
import { PremiumSheet } from "@/components/premium-sheet/premium-sheet"
import { PREMIUM_SHEET_PURCHASE_COPY } from "@/lib/premium-sheet/purchase-copy"
import type { PremiumSheetContext } from "@/lib/premium-sheet/context"

/**
 * The EFFECT half of the Premium sheet (freemium-scanner-first T14, fix round 1 F8).
 *
 * `tests/premium-sheet-component.test.tsx` renders the sheet under a harness whose
 * `useEffect` is a deliberate no-op — good enough for the plan rows and the escape, but it
 * left the entire "verified → visibly unlocked" half of the journey untested, which is
 * exactly where F1, F2 and F3 lived. This harness RUNS effects (same family as
 * `tests/scan-flow-ui.test.tsx`), with a fake router, a fake toast context, a fake
 * `sessionStorage` and a routed `fetch`, so the three lanes the review found broken are
 * driven for real:
 *
 *   1. a verified completion tells the opener, refreshes, toasts and closes;
 *   2. a redirect (PayPal) return that lands `pending` reopens the sheet;
 *   3. a redirect return that FAILS reopens it with the retry.
 */

type AnyElement = ReactElement<Record<string, any>>

function childrenOf(node: ReactNode): ReactNode[] {
  if (!React.isValidElement(node)) return []
  return React.Children.toArray((node as ReactElement<{ children?: ReactNode }>).props.children)
}

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (!React.isValidElement(node)) return ""
  return childrenOf(node)
    .map((child) => textContent(child))
    .join("")
}

function findAll(node: ReactNode, predicate: (element: AnyElement) => boolean): AnyElement[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, predicate))
  if (!React.isValidElement(node)) return []
  const element = node as AnyElement
  const matches = predicate(element) ? [element] : []
  return [...matches, ...childrenOf(element).flatMap((child) => findAll(child, predicate))]
}

function sheetParts(tree: ReactNode): ReactNode[] {
  const content = findAll(tree, (element) => element.type === BottomSheetContent)[0]
  assert.ok(content, "expected a BottomSheetContent")
  return [content.props.children, content.props.header, content.props.footer] as ReactNode[]
}

function byData(tree: ReactNode, attribute: string): AnyElement[] {
  return sheetParts(tree).flatMap((part) =>
    findAll(part, (element) => element.props[attribute] !== undefined),
  )
}

// --- environment ------------------------------------------------------------

type MemoryStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function memoryStorage(seed: Record<string, string> = {}): MemoryStorage {
  const values = new Map(Object.entries(seed))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  }
}

const SESSION_ID = "cs_test_return_1"
const REMEMBERED: PremiumSheetContext = { feature: "merkliste", source: "scan:verdict" }

function installWindow(search: string, storage: MemoryStorage) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { search }, sessionStorage: storage },
  })
}

// --- hook harness (runs effects) --------------------------------------------

type ReactDispatcherInternals = { H: unknown }
type EffectRecord = { deps: unknown[] | undefined; cleanup?: () => void }
type MemoRecord<T> = { deps: unknown[] | undefined; value: T }

function depsChanged(previous: unknown[] | undefined, next: unknown[] | undefined): boolean {
  return (
    !previous ||
    !next ||
    previous.length !== next.length ||
    next.some((dep, index) => dep !== previous[index])
  )
}

function createEffectHarness(renderComponent: () => ReactElement | null, contextValue: unknown) {
  const reactInternals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const previousDispatcher = reactInternals.H
  const hookValues: unknown[] = []
  let cursor = 0
  let pendingEffects: Array<{ index: number; effect: () => void | (() => void) }> = []

  const dispatcher = {
    useCallback<T extends (...args: never[]) => unknown>(callback: T, deps?: unknown[]): T {
      return this.useMemo(() => callback, deps)
    },
    /**
     * `useRouter` and `useToast` both read a context. One merged fake serves both — the
     * contexts themselves are module-private, so identity switching is not available here.
     */
    useContext<T>(): T {
      return contextValue as T
    },
    /** `usePathname` reads its context through `use`, not `useContext`. */
    use(): unknown {
      return "/scan"
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
    useLayoutEffect(effect: () => void | (() => void), deps?: unknown[]) {
      this.useEffect(effect, deps)
    },
    useMemo<T>(factory: () => T, deps?: unknown[]): T {
      const index = cursor
      cursor += 1
      const previous = hookValues[index] as MemoRecord<T> | undefined
      if (previous && !depsChanged(previous.deps, deps)) return previous.value
      const value = factory()
      hookValues[index] = { deps, value } satisfies MemoRecord<T>
      return value
    },
    useReducer<S, A>(reducer: (state: S, action: A) => S, initialState: S): [S, (a: A) => void] {
      const index = cursor
      cursor += 1
      if (hookValues.length <= index) hookValues[index] = initialState
      return [
        hookValues[index] as S,
        (action) => {
          hookValues[index] = reducer(hookValues[index] as S, action)
        },
      ]
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
        const tree = renderComponent()
        const effects = pendingEffects
        pendingEffects = []
        for (const { index, effect } of effects) {
          const cleanup = effect()
          if (typeof cleanup === "function") {
            ;(hookValues[index] as EffectRecord).cleanup = cleanup
          }
        }
        await Promise.resolve()
        return tree
      } finally {
        reactInternals.H = previousDispatcher
      }
    },
  }
}

type SheetHarness = {
  tree: ReactElement | null
  calls: string[]
  toasts: { title: string; description?: string }[]
  opened: (PremiumSheetContext | null)[]
  open: boolean
  settle: () => Promise<void>
}

/**
 * Mounts the sheet with a routed `fetch`. `settle()` re-renders twice around a macrotask
 * so a dispatch made from an awaited callback lands in the tree it returns.
 */
async function mountSheet(options: {
  completion: () => Response
  search?: string
  storage?: MemoryStorage
  open?: boolean
  context?: PremiumSheetContext | null
}): Promise<SheetHarness> {
  const storage = options.storage ?? memoryStorage()
  installWindow(options.search ?? "", storage)
  const calls: string[] = []
  const toasts: { title: string; description?: string }[] = []
  const opened: (PremiumSheetContext | null)[] = []
  const completionRequests: string[] = []

  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    completionRequests.push(String(url))
    assert.equal(url, "/api/freemium/purchase/complete")
    assert.match(String(init?.body), new RegExp(SESSION_ID))
    return options.completion()
  }) as never

  const state = {
    open: options.open ?? false,
    context: options.context === undefined ? null : options.context,
  }
  const harness = createEffectHarness(
    () =>
      PremiumSheet({
        open: state.open,
        context: state.context,
        onClose: () => {
          calls.push("close")
          state.open = false
        },
        onUnlocked: () => calls.push("unlocked"),
        onRequestOpen: (context) => {
          calls.push("requestOpen")
          opened.push(context)
          state.open = true
          state.context = context ?? state.context
        },
      }),
    {
      // Router half.
      refresh: () => calls.push("refresh"),
      replace: (href: string) => calls.push(`replace:${href}`),
      push: () => calls.push("push"),
      // Toast half — the app-wide provider every sheet surface has in its route layout.
      toasts: [],
      dismiss: () => {},
      toast: (entry: { title: string; description?: string }) => {
        calls.push("toast")
        toasts.push(entry)
      },
    },
  )

  const result: SheetHarness = {
    tree: null,
    calls,
    toasts,
    opened,
    get open() {
      return state.open
    },
    async settle() {
      await harness.render()
      await new Promise((resolve) => setTimeout(resolve, 0))
      result.tree = await harness.render()
    },
  }
  // Three cycles: the return dispatch, the verification fetch, and the render that acts on
  // its outcome (unlock, or the reopen request).
  await result.settle()
  await result.settle()
  await result.settle()
  return result
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

// --- the three lanes --------------------------------------------------------

test("F1/F3: a verified return unlocks the opener, refreshes, toasts and closes", async () => {
  const sheet = await mountSheet({
    completion: () => json({ status: "complete", routineReady: true }),
    search: `?freemium_checkout=${SESSION_ID}`,
    open: true,
    context: REMEMBERED,
  })

  // Exactly one of each, after three render cycles: openers pass inline callbacks, so this
  // effect's deps change on every render and the refresh causes one — an unguarded unlock
  // would be a refresh loop raising a toast per turn.
  // The opener is told BEFORE the refresh: the surfaces that hold their own tier state
  // (the scanner's Merken bookmark) cannot learn it from a re-served server prop.
  assert.deepEqual(
    sheet.calls.filter((call) => call !== "replace:/scan"),
    ["unlocked", "refresh", "toast", "close"],
  )
  assert.deepEqual(sheet.toasts, [{ title: PREMIUM_SHEET_PURCHASE_COPY.unlockToast }])
  assert.equal(sheet.open, false)
})

test("F1: a degraded provisioning still unlocks, and the toast says the Routine is coming", async () => {
  const sheet = await mountSheet({
    completion: () => json({ status: "complete", routineReady: false }),
    search: `?freemium_checkout=${SESSION_ID}`,
    open: true,
    context: REMEMBERED,
  })

  assert.deepEqual(sheet.toasts, [
    {
      title: PREMIUM_SHEET_PURCHASE_COPY.unlockToast,
      description: PREMIUM_SHEET_PURCHASE_COPY.unlockToastRoutinePending,
    },
  ])
  assert.ok(sheet.calls.includes("unlocked"))
})

test("F3: the sheet raises no toast of its own — the surviving provider owns it", async () => {
  // The refresh replaces the gated subtree this component lives in, so a portal owned by
  // the sheet would be unmounted a few hundred ms into a 5s toast.
  const sheet = await mountSheet({
    completion: () => json({ status: "complete", routineReady: true }),
    search: `?freemium_checkout=${SESSION_ID}`,
    open: true,
    context: REMEMBERED,
  })
  assert.equal(
    findAll(sheet.tree, (element) => element.props["data-premium-sheet-unlock-toast"] !== undefined)
      .length,
    0,
  )
})

test("F2: a redirect return that is still settling reopens the sheet on its pending state", async () => {
  const sheet = await mountSheet({
    completion: () => json({ status: "pending" }),
    search: `?freemium_checkout=${SESSION_ID}`,
    storage: memoryStorage({
      "chaarlie.premium-sheet.checkout-context": JSON.stringify(REMEMBERED),
    }),
    // The buyer comes back on a FRESH page load: nothing is open.
    open: false,
    context: null,
  })

  assert.ok(sheet.calls.includes("requestOpen"), "a closed sheet renders nothing at all")
  // Reopened on the gate the purchase started from, not the surface's default.
  assert.deepEqual(sheet.opened, [REMEMBERED])
  assert.equal(sheet.open, true)
  assert.equal(byData(sheet.tree, "data-premium-sheet-purchase-phase").length, 1)
  assert.equal(
    textContent(byData(sheet.tree, "data-premium-sheet-purchase-phase")[0]).includes(
      PREMIUM_SHEET_PURCHASE_COPY.pendingTitle,
    ),
    true,
  )
  assert.equal(sheet.toasts.length, 0, "nothing is unlocked while the payment is unsettled")
})

test("F2: a redirect return that fails verification reopens the sheet with the retry", async () => {
  const sheet = await mountSheet({
    completion: () => json({ status: "failed", reason: "checkout_subscription_expired" }),
    search: `?freemium_checkout=${SESSION_ID}`,
    open: false,
    context: null,
  })

  assert.ok(sheet.calls.includes("requestOpen"))
  assert.equal(sheet.open, true)
  const alert = byData(sheet.tree, "data-premium-sheet-purchase-phase")[0]
  assert.ok(alert, "the failure must be visible, not dispatched into a closed sheet")
  assert.equal(alert.props["data-premium-sheet-purchase-phase"], "failed")
  assert.equal(textContent(alert), PREMIUM_SHEET_PURCHASE_COPY.verificationFailed)
  // The free session is untouched: the plan rows are back, behind one retry.
  assert.equal(byData(sheet.tree, "data-premium-sheet-plans").length, 1)
  assert.equal(
    textContent(byData(sheet.tree, "data-premium-sheet-cta")[0]),
    PREMIUM_SHEET_PURCHASE_COPY.retry,
  )
  assert.equal(sheet.calls.includes("unlocked"), false)
})

test("F2: nothing happens without a return parameter — the ordinary mount is unchanged", async () => {
  const sheet = await mountSheet({
    completion: () => {
      throw new Error("no completion request may be made")
    },
    search: "",
    open: true,
    context: REMEMBERED,
  })

  assert.deepEqual(sheet.calls, [])
  assert.equal(byData(sheet.tree, "data-premium-sheet-plans").length, 1)
})
