import React, { type ReactElement } from "react"

/**
 * A minimal "mounted component" harness for the node test runner.
 *
 * This repo has no jsdom and no `react-dom/client`, so `tests/*.test.tsx` call the
 * component function under a hand-rolled dispatcher (see
 * `tests/scanner-funnel-arrival.test.tsx`). That harness deliberately skips effects
 * — it asserts the first committed frame only. This one is its longer-lived
 * sibling: it runs effects after every render pass and re-renders synchronously on
 * `setState`, so a test can observe what a component does *after* an async
 * resolution (a bootstrap, a poll response) lands.
 *
 * It is not React: no batching, no concurrency, no children. The returned `tree` is
 * the element the component returned in the latest pass; render it with
 * `renderToStaticMarkup` when the assertion is about what its children see.
 */

type HookSlot = {
  value?: unknown
  deps?: readonly unknown[]
  cleanup?: (() => void) | void
}

type ReactDispatcherInternals = { H: unknown }

const reactInternals = (
  React as unknown as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
  }
).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE

export type MountedComponent = {
  /** The element returned by the most recent render pass. */
  readonly tree: ReactElement | null
  /** How many render passes have run — a cheap way to assert "no extra render". */
  readonly renderCount: number
  /** Runs every effect cleanup and stops further re-renders. */
  unmount(): void
}

export function mountComponent(renderComponent: () => ReactElement | null): MountedComponent {
  const slots: HookSlot[] = []
  let cursor = 0
  let scheduledEffects: Array<() => void> = []
  let tree: ReactElement | null = null
  let renderCount = 0
  let mounted = true

  function slotAt(index: number): HookSlot {
    if (slots.length <= index) slots[index] = {}
    return slots[index]
  }

  function depsChanged(
    previous: readonly unknown[] | undefined,
    next: readonly unknown[] | undefined,
  ) {
    if (!previous || !next) return true
    return (
      previous.length !== next.length ||
      next.some((value, index) => !Object.is(value, previous[index]))
    )
  }

  const dispatcher = {
    useState<T>(initialState: T | (() => T)): [T, (next: T | ((current: T) => T)) => void] {
      const slot = slotAt(cursor)
      cursor += 1
      if (!("value" in slot)) {
        slot.value = typeof initialState === "function" ? (initialState as () => T)() : initialState
      }
      return [
        slot.value as T,
        (next) => {
          const value =
            typeof next === "function" ? (next as (current: T) => T)(slot.value as T) : next
          if (Object.is(value, slot.value)) return
          slot.value = value
          if (mounted) renderPass()
        },
      ]
    },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      const slot = slotAt(cursor)
      cursor += 1
      const previous = slot.deps
      const changed = depsChanged(previous, deps) || !("deps" in slot)
      slot.deps = deps
      if (!changed) return
      scheduledEffects.push(() => {
        slot.cleanup?.()
        slot.cleanup = effect()
      })
    },
    useRef<T>(initialValue: T) {
      const slot = slotAt(cursor)
      cursor += 1
      if (!("value" in slot)) slot.value = { current: initialValue }
      return slot.value as { current: T }
    },
    useMemo<T>(factory: () => T, deps?: readonly unknown[]) {
      const slot = slotAt(cursor)
      cursor += 1
      if (!("value" in slot) || depsChanged(slot.deps, deps)) slot.value = factory()
      slot.deps = deps
      return slot.value as T
    },
    useCallback<T>(callback: T, deps?: readonly unknown[]) {
      return dispatcher.useMemo(() => callback, deps)
    },
  }

  function renderPass() {
    cursor = 0
    scheduledEffects = []
    const previousDispatcher = reactInternals.H
    reactInternals.H = dispatcher
    try {
      tree = renderComponent()
    } finally {
      reactInternals.H = previousDispatcher
    }
    renderCount += 1
    const effects = scheduledEffects
    scheduledEffects = []
    for (const runEffect of effects) runEffect()
  }

  renderPass()

  return {
    get tree() {
      return tree
    },
    get renderCount() {
      return renderCount
    },
    unmount() {
      mounted = false
      for (const slot of slots) slot.cleanup?.()
    },
  }
}

/** Lets every already-queued microtask (and `setTimeout(0)`) run before asserting. */
export async function flushAsync(turns = 3) {
  for (let turn = 0; turn < turns; turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}
