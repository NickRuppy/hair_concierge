import { JSDOM } from "jsdom"

/**
 * A jsdom document for DOM interaction tests under the plain node:test runner.
 *
 * Import this module FIRST in a `tests/*.test.tsx` file — before React DOM or
 * @testing-library — so the globals exist when those libraries load. node:test runs every
 * test file in its own process, so the globals never leak into the other suites.
 *
 * It installs `window`, `document`, `navigator` and every other window property Node does
 * not already have (HTMLElement, Node, getComputedStyle, …). Node's own timers, fetch and
 * microtasks stay in place, so `mock.timers` and a stubbed `globalThis.fetch` work as usual.
 * No jest: @testing-library's auto-cleanup does not run — call `cleanup()` after each test.
 */

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
})

const globals = globalThis as Record<string, unknown>
const view = dom.window as unknown as Record<string, unknown>

for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (key in globalThis) continue
  Object.defineProperty(globalThis, key, {
    configurable: true,
    get: () => view[key],
  })
}
// Node 22 ships its own `navigator` getter; the page's navigator (with a mockable
// clipboard) must win.
for (const [key, value] of [
  ["window", dom.window],
  ["document", dom.window.document],
  ["navigator", dom.window.navigator],
] as const) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}
// Tells React that updates inside `act()` are expected (no "not wrapped in act" warnings).
globals.IS_REACT_ACT_ENVIRONMENT = true

export const domWindow = dom.window

/** Replaces `navigator.clipboard` for one test; returns the recorded writes. */
export function mockClipboard(writeText: (text: string) => Promise<void>): string[] {
  const writes: string[] = []
  Object.defineProperty(dom.window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text: string) => {
        writes.push(text)
        return writeText(text)
      },
    },
  })
  return writes
}
