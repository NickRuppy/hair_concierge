import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { observeOnceVisible } from "../src/lib/analytics/observe-once-visible"

const pricingSource = readFileSync(
  new URL("../src/components/quiz/result-offer-pricing.tsx", import.meta.url),
  "utf8",
)

test("visibility-based pricing tracking preserves funnel attribution metadata", () => {
  assert.match(pricingSource, /const funnelEventId = createFunnelEventId\(\)/)
  assert.match(pricingSource, /offerTracking \?\? getCurrentFunnelContext\(\)/)
  assert.match(pricingSource, /funnelSessionId: context\?\.funnelSessionId/)
  assert.match(pricingSource, /funnelPackageKey: context\?\.funnelPackageKey/)
})

test("pricing visibility waits for intersection and fires exactly once", () => {
  const observerState: { callback?: IntersectionObserverCallback } = {}
  let disconnected = 0
  let observed = 0
  let tracked = 0

  class FakeObserver {
    constructor(next: IntersectionObserverCallback) {
      observerState.callback = next
    }
    observe() {
      observed += 1
    }
    disconnect() {
      disconnected += 1
    }
  }

  const cleanup = observeOnceVisible(
    {} as Element,
    () => {
      tracked += 1
    },
    FakeObserver,
  )

  assert.equal(observed, 1)
  assert.equal(tracked, 0)
  observerState.callback?.(
    [{ isIntersecting: false } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  )
  assert.equal(tracked, 0)
  observerState.callback?.(
    [{ isIntersecting: true } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  )
  observerState.callback?.(
    [{ isIntersecting: true } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  )
  assert.equal(tracked, 1)
  assert.ok(disconnected >= 1)
  cleanup()
})

test("pricing visibility falls back to one immediate event without IntersectionObserver", () => {
  let tracked = 0
  observeOnceVisible(
    {} as Element,
    () => {
      tracked += 1
    },
    undefined,
  )
  assert.equal(tracked, 1)
})
