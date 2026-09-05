import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"

import { Scanner } from "../src/components/scan/scanner"
import type { UseScannerLoopArgs } from "../src/components/scan/use-scanner-loop"
import {
  SCAN_CONFIRM_LABEL,
  SCAN_HINT_DEFAULT,
  SCAN_HINT_MORE_LIGHT,
  SCAN_HINT_SPOTTED,
} from "../src/lib/scan/guidance"
import type { NormalizedBox } from "../src/lib/scan/scanner-session"

/**
 * The viewfinder's four visual states (plan 2026-09-05, Task 2). `Scanner` is a
 * "use client" component and this repo has no jsdom/testing-library, so the component
 * function is called directly under a hand-rolled hook dispatcher and the returned
 * element tree is walked — same harness family as `tests/scan-flow-ui.test.tsx`.
 *
 * The camera/detection hook is injected through the `__loop` seam rather than mocked:
 * every state under test is produced by a hook callback (`onDetectionState`,
 * `onConfirm`), and the real hook would need a camera, a detector and a live video
 * element to reach any of them.
 */

// The confirm window is scheduled through `window`; nothing else browser-ish is touched.
Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis })

// --- element-tree helpers ---------------------------------------------------

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

function withAttribute(node: ReactNode, attribute: string): AnyElement[] {
  return findAll(node, (element) => element.props[attribute] !== undefined)
}

function classNames(node: ReactNode): string[] {
  return findAll(node, (element) => typeof element.props.className === "string").map(
    (element) => element.props.className as string,
  )
}

function hasClass(node: ReactNode, className: string): boolean {
  return classNames(node).some((value) => value.split(/\s+/).includes(className))
}

/** The pill is the only `aria-live` region in the viewfinder. */
function pill(node: ReactNode): AnyElement {
  const match = findAll(node, (element) => element.props["aria-live"] === "polite")[0]
  assert.ok(match, "Expected the hint pill")
  return match
}

function detectionAttribute(node: ReactNode): string {
  const root = withAttribute(node, "data-scan-detection")[0]
  assert.ok(root, "Expected the viewfinder root")
  return root.props["data-scan-detection"] as string
}

// --- hook harness -----------------------------------------------------------

type ReactDispatcherInternals = { H: unknown }
type EffectRecord = { deps: unknown[] | undefined; cleanup?: () => void }
type MemoRecord<T> = { deps: unknown[] | undefined; value: T }

function createHookHarness(render: () => ReactElement | null): {
  render: () => ReactElement | null
} {
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
    useCallback<T extends (...args: never[]) => unknown>(callback: T, deps?: unknown[]): T {
      return this.useMemo(() => callback, deps)
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
    render() {
      cursor = 0
      pendingEffects = []
      reactInternals.H = dispatcher
      try {
        const tree = render()
        const effects = pendingEffects
        pendingEffects = []
        for (const { index, effect } of effects) {
          const cleanup = effect()
          if (typeof cleanup === "function") {
            ;(hookValues[index] as EffectRecord).cleanup = cleanup
          }
        }
        return tree
      } finally {
        reactInternals.H = previousDispatcher
      }
    },
  }
}

// --- mounting ---------------------------------------------------------------

const BOX: NormalizedBox = { x: 0.25, y: 0.4, width: 0.5, height: 0.2 }

type ScannerHarness = {
  tree: ReactElement | null
  loop: UseScannerLoopArgs
  setPaused: (paused: boolean) => void
  render: () => ReactElement | null
}

function mountScanner(): ScannerHarness {
  let captured: UseScannerLoopArgs | null = null
  let detectionPaused = false

  const harness = createHookHarness(() =>
    Scanner({
      active: true,
      detectionPaused,
      onDecoded: () => true,
      onUnavailable: () => {},
      onTimeout: () => {},
      onStalled: () => {},
      __loop: (args) => {
        captured = args
      },
    }),
  )

  const scanner: ScannerHarness = {
    tree: harness.render(),
    get loop() {
      assert.ok(captured, "Expected useScannerLoop to have been called")
      return captured
    },
    setPaused(paused) {
      detectionPaused = paused
    },
    render() {
      scanner.tree = harness.render()
      return scanner.tree
    },
  }
  return scanner
}

// --- the four states --------------------------------------------------------

test("Scanner: searching shows the pulsing dot, the breathing corners and the idle hint", () => {
  const scanner = mountScanner()

  assert.equal(detectionAttribute(scanner.tree), "searching")
  assert.equal(textContent(pill(scanner.tree)), SCAN_HINT_DEFAULT)
  assert.equal(withAttribute(scanner.tree, "data-scan-pill-dot").length, 1)
  assert.equal(withAttribute(scanner.tree, "data-scan-outline").length, 0)
  // One breathing class per corner marker.
  assert.equal(
    classNames(scanner.tree).filter((value) => value.split(/\s+/).includes("animate-scan-breathe"))
      .length,
    4,
  )
})

test("Scanner: a situational hint replaces the idle text while the dot stays", () => {
  const scanner = mountScanner()

  scanner.loop.onHint(SCAN_HINT_MORE_LIGHT)
  scanner.render()

  assert.equal(textContent(pill(scanner.tree)), SCAN_HINT_MORE_LIGHT)
  assert.equal(withAttribute(scanner.tree, "data-scan-pill-dot").length, 1)
})

test("Scanner: a spotted barcode gets the amber outline and the hold-still pill", () => {
  const scanner = mountScanner()

  scanner.loop.onDetectionState({ kind: "spotted", box: BOX })
  scanner.render()

  assert.equal(detectionAttribute(scanner.tree), "spotted")
  const outline = withAttribute(scanner.tree, "data-scan-outline")
  assert.equal(outline.length, 1)
  assert.equal(outline[0].props["data-scan-outline"], "spotted")
  assert.match(outline[0].props.className as string, /border-\[#e0a13a\]/)

  assert.equal(textContent(pill(scanner.tree)), SCAN_HINT_SPOTTED)
  assert.match(pill(scanner.tree).props.className as string, /bg-\[#b97a17\]/)
  // The dot and the breathing corners belong to "still looking", not to "found it".
  assert.equal(withAttribute(scanner.tree, "data-scan-pill-dot").length, 0)
  assert.equal(hasClass(scanner.tree, "animate-scan-breathe"), false)
})

test("Scanner: an accepted decode turns the outline green and the pill plum", () => {
  const scanner = mountScanner()

  scanner.loop.onDetectionState({ kind: "read", box: BOX })
  scanner.loop.onConfirm()
  scanner.render()

  assert.equal(detectionAttribute(scanner.tree), "read")
  const outline = withAttribute(scanner.tree, "data-scan-outline")
  assert.equal(outline.length, 1)
  assert.equal(outline[0].props["data-scan-outline"], "read")
  assert.match(outline[0].props.className as string, /border-\[var\(--status-ok-text\)\]/)

  assert.equal(textContent(pill(scanner.tree)), `✓ ${SCAN_CONFIRM_LABEL}`)
  assert.match(pill(scanner.tree).props.className as string, /bg-\[var\(--brand-plum\)\]/)
  assert.equal(withAttribute(scanner.tree, "data-scan-pill-dot").length, 0)
})

test("Scanner: the confirm window keeps the read look while the barcode is spotted again", () => {
  const scanner = mountScanner()

  scanner.loop.onDetectionState({ kind: "read", box: BOX })
  scanner.loop.onConfirm()
  // The bottle has not moved, so the loop keeps reporting raw hits behind the confirm.
  scanner.loop.onDetectionState({ kind: "spotted", box: BOX })
  scanner.render()

  assert.equal(detectionAttribute(scanner.tree), "read")
  assert.equal(textContent(pill(scanner.tree)), `✓ ${SCAN_CONFIRM_LABEL}`)
})

test("Scanner: a sheet over the viewfinder freezes the dot and the breathing corners", () => {
  const scanner = mountScanner()

  scanner.setPaused(true)
  scanner.render()

  assert.equal(detectionAttribute(scanner.tree), "searching")
  assert.equal(withAttribute(scanner.tree, "data-scan-pill-dot").length, 0)
  assert.equal(hasClass(scanner.tree, "animate-scan-breathe"), false)
  assert.equal(hasClass(scanner.tree, "animate-scan-dot"), false)
  // The pill still says what it says; only the motion stops.
  assert.equal(textContent(pill(scanner.tree)), SCAN_HINT_DEFAULT)
})

test("Scanner: a new scan attempt drops the confirm state back to the idle pill", () => {
  const scanner = mountScanner()

  scanner.loop.onDetectionState({ kind: "read", box: BOX })
  scanner.loop.onConfirm()
  scanner.render()
  assert.equal(detectionAttribute(scanner.tree), "read")

  // What the hook does on an epoch bump: restart, then the fresh attempt's state.
  scanner.loop.onAttemptStart()
  scanner.loop.onDetectionState({ kind: "searching" })
  scanner.render()

  assert.equal(detectionAttribute(scanner.tree), "searching")
  assert.equal(textContent(pill(scanner.tree)), SCAN_HINT_DEFAULT)
  assert.equal(withAttribute(scanner.tree, "data-scan-outline").length, 0)
})
