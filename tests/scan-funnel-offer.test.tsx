import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { OrganicPlanOffer } from "../src/components/organic-plan-offer/organic-plan-offer"
import { renderOfferVariant } from "../src/funnels/offers/registry"
import { ScanHeroDemo, ScanHeroDemoView } from "../src/components/scan-regal-offer/scan-hero-demo"
import { ScanRegalOffer } from "../src/components/scan-regal-offer/scan-regal-offer"
import type { FunnelOfferVariantProps } from "../src/funnels/types"
import { resolveOfferSectionIndex } from "../src/lib/analytics/offer-section-order"
import { buildQuizResultNarrative } from "../src/lib/quiz/result-narrative"
import { getScanInsertExample } from "../src/lib/quiz/scan-insert-examples"
import type { QuizAnswers } from "../src/lib/quiz/types"

/** Escapes a string for safe use inside `new RegExp(...)`. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const quizAnswers: QuizAnswers = {
  structure: "wavy",
  thickness: "normal",
  density: "medium",
  hair_length: "long",
  scalp_type: "fettig",
  has_scalp_issue: false,
  fingertest: "leicht_uneben",
  pulltest: "stretches_stays",
  concerns: ["frizz", "dryness"],
  treatment: [],
  goals: ["moisture", "shine"],
}

const commercialProps: FunnelOfferVariantProps = {
  entryContext: "quiz_completion",
  leadId: "lead-scan",
  name: "Lena Beispiel",
  narrative: buildQuizResultNarrative(quizAnswers),
  offerVariant: "scan-regal-v1",
  pricingSlot: <div data-testid="scan-pricing-slot">Pricing</div>,
  quizAnswers,
}

/** The order the sections actually appear in the rendered document. */
const EXPECTED_SECTION_ORDER = [
  "hero",
  "before_after",
  "scan_criteria",
  "product_tour",
  "pricing",
  "scan_coverage",
  "highlights",
  "method",
  "survey",
  "testimonials",
  "guarantee",
  "faq",
  "final_cta",
] as const

function renderScanOffer(props: FunnelOfferVariantProps = commercialProps) {
  const element = renderOfferVariant("scan-regal-v1", props)
  assert.ok(element, "the scan-regal-v1 variant is registered")
  return renderToStaticMarkup(element)
}

function renderedSectionIds(html: string) {
  return Array.from(html.matchAll(/data-offer-section="([a-z_]+)"/g)).map((match) => match[1])
}

test("the scanner offer renders through the registry with its approved hero", () => {
  const html = renderScanOffer()

  assert.match(html, /Dein Haarprofil ist fertig/)
  assert.match(html, /Nie wieder raten vorm Regal\./)
  // The profile sentence is derived from the answers, not a fixed string.
  assert.match(html, /Welliges, mittelstarkes Haar mit mittlerer Dichte\./)
  assert.match(
    html,
    /So prüft der Scanner Produkte für dein Profil – bei den gängigen Produkten von dm und\s+Rossmann\./,
  )
  assert.match(html, /%2Fimages%2Ffunnels%2Fscan%2Ftour-scanner\.png/)
  assert.match(html, /%2Fimages%2Ffunnels%2Fscan%2Fpackshot-ogx\.png/)
  assert.doesNotMatch(html, /Urteil/i)
})

test("the scanner offer keeps the approved section order and renders pricing exactly once", () => {
  const html = renderScanOffer()

  assert.deepEqual(renderedSectionIds(html), [...EXPECTED_SECTION_ORDER])
  assert.equal((html.match(/data-testid="scan-pricing-slot"/g) ?? []).length, 1)
  // The section owns the eyebrow and heading; the slot owns cards and CTA.
  assert.match(html, /Freischalten/)
  assert.match(html, /Scanner und Plan freischalten\./)
  // The pricing slot prints its own guarantee fine print; the section must not duplicate it.
  assert.doesNotMatch(html, /Details in den Bedingungen/)
})

test("the tracked section order matches what the page renders", () => {
  for (const [index, sectionId] of EXPECTED_SECTION_ORDER.entries()) {
    assert.equal(resolveOfferSectionIndex("scan-regal-v1", sectionId), index)
  }
})

test("the scanner offer carries the criteria, the tour, coverage and the proof blocks", () => {
  const html = renderScanOffer()

  assert.match(html, /Darauf achtet der Scanner bei dir\./)
  assert.match(html, /Abgeleitet aus deinen 10 Antworten\./)
  // `scalp_type: "fettig"` must reach the chips as a clarifying cleansing target.
  assert.match(html, /Reinigung: klärend/)
  assert.match(html, /Haardicke: mittel/)
  assert.match(html, /Hitzeschutz/)
  assert.match(html, /Repair-Pflege/)
  // The chips are plain spans, so the caption must not promise a tap here.
  assert.match(html, /Im Scanner lässt sich jede Zeile antippen und erklärt sich\./)
  assert.doesNotMatch(html, /Jede Zeile im Ergebnis lässt sich antippen/)

  assert.match(html, /Scanner, Plan und Chat – in einer App\./)
  assert.match(html, /Alles im Chaarlie-Abo\./)
  assert.doesNotMatch(html, /Echte Screenshots/)
  for (const title of ["Produkt-Scanner", "Dein Plan", "Anwendung", "Frag Chaarlie"]) {
    assert.match(html, new RegExp(escapeRegExp(title)), title)
  }

  assert.match(html, /Die gängigen Produkte von dm und Rossmann\./)
  assert.match(
    html,
    /Unbekanntes Produkt\? Ein Tipp genügt – wir prüfen es und melden uns im Chat, sobald das\s+Ergebnis da ist\./,
  )

  assert.match(html, /Dein Ergebnis basiert auf echter Haar-Diagnostik:/)
  assert.match(html, /Über 1\.000 Produkte/)
  assert.match(html, /Entwickelt gemeinsam mit Friseurmeistern\./)
  assert.match(html, /Über 4\.000 Frauen haben uns geantwortet\./)
  assert.match(html, /Sarah · Nie wieder googeln vorm Regal/)
  assert.match(html, /Welche Produkte kennt der Scanner\?/)

  assert.match(html, /Dein Scanner wartet\./)
  assert.match(html, /Scann als Erstes, was bei dir im Bad steht\./)
  assert.match(html, /Jetzt freischalten/)
})

test("both offer CTAs carry the tracking attributes the provider listens for", () => {
  const html = renderScanOffer()

  assert.match(
    html,
    /data-offer-cta="sticky_header"[^>]*data-offer-destination="pricing"[^>]*data-offer-source-section="hero"/,
  )
  assert.match(
    html,
    /data-offer-cta="final"[^>]*data-offer-destination="pricing"[^>]*data-offer-source-section="final_cta"/,
  )
  assert.equal((html.match(/data-offer-faq="scan-regal-\d"/g) ?? []).length, 5)
})

// § 5 DDG plus the consumer information: the page the purchase starts on must
// carry the same unified legal footer the landing does (PR #519).
test("the scanner offer carries the unified legal footer", () => {
  const html = renderScanOffer()

  assert.equal((html.match(/<footer/g) ?? []).length, 1)
  for (const label of ["Impressum", "Datenschutz", "AGB", "Widerruf", "Kontakt"]) {
    assert.match(html, new RegExp(`>${label}</a>`), label)
  }
})

test("the sticky header CTA keeps the 44 px touch target", () => {
  const html = renderScanOffer()
  const stickyCta = html.match(/<a[^>]*data-offer-cta="sticky_header"[^>]*>/)

  assert.ok(stickyCta, "the sticky header CTA is rendered")
  assert.match(stickyCta[0], /min-h-11/)
  assert.doesNotMatch(stickyCta[0], /\bpy-2\b/)
})

test("non-commercial activation contexts fall back to the organic offer", () => {
  for (const props of [
    { ...commercialProps, regularFieldTest: { accessDurationHours: 168 } },
    {
      ...commercialProps,
      partnerAccess: { activationApiPath: "/api/partner-access/activate" as const },
    },
  ]) {
    const html = renderScanOffer(props)
    assert.match(html, /Dein Haarplan ist bereit\./)
    assert.doesNotMatch(html, /Nie wieder raten vorm Regal\./)
    assert.doesNotMatch(html, /data-offer-section="scan_criteria"/)
  }
})

test("the hero demo's finished frame is what renders without a clock", () => {
  const card = getScanInsertExample(16, quizAnswers)
  const html = renderToStaticMarkup(<ScanHeroDemoView card={card} phase="result" />)

  assert.match(html, /data-scan-hero-demo-phase="result"/)
  assert.match(html, /✓ Barcode erkannt/)
  assert.doesNotMatch(html, /data-scan-hero-demo-line/)
  assert.match(html, new RegExp(escapeRegExp(card.headline)))
  assert.match(html, new RegExp(escapeRegExp(card.deviation)))
  for (const row of card.rows) {
    assert.match(html, new RegExp(escapeRegExp(`${row.label}: ${row.productValue}`)), row.label)
  }
})

/*
 * `ScanHeroDemo` is a "use client" component: this repo has no jsdom/testing-library, so
 * (same harness family as `tests/scan-flow-ui.test.tsx` and
 * `tests/premium-sheet-effects.test.tsx`) its `useState`/`useEffect` are driven by a
 * hand-rolled dispatcher, and `window.setTimeout`/`setInterval` are faked so the replay
 * (1800ms / 2500ms / 7500ms in production) can be driven deterministically without a clock.
 */

type ReactDispatcherInternals = { H: unknown }
type EffectRecord = { deps: unknown[] | undefined; cleanup?: () => void }

function depsChanged(previous: unknown[] | undefined, next: unknown[] | undefined): boolean {
  return (
    !previous ||
    !next ||
    previous.length !== next.length ||
    next.some((dep, index) => dep !== previous[index])
  )
}

/** Drives only the two hooks `ScanHeroDemo` uses: `useState` and a mount-only `useEffect`. */
function createStateEffectHarness(renderComponent: () => ReactElement<any>) {
  const reactInternals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const previousDispatcher = reactInternals.H
  const hookValues: unknown[] = []
  let cursor = 0

  const dispatcher = {
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
    useEffect(effect: () => void | (() => void), deps?: unknown[]) {
      const index = cursor
      cursor += 1
      const previous = hookValues[index] as EffectRecord | undefined
      if (!depsChanged(previous?.deps, deps)) return
      previous?.cleanup?.()
      hookValues[index] = { deps } satisfies EffectRecord
      const cleanup = effect()
      hookValues[index] = { deps, cleanup: cleanup ?? undefined } satisfies EffectRecord
    },
  }

  return {
    /** Re-renders from the current hook state (a no-op re-render never re-runs the effect). */
    render(): ReactElement<any> {
      cursor = 0
      reactInternals.H = dispatcher
      try {
        return renderComponent()
      } finally {
        reactInternals.H = previousDispatcher
      }
    },
    /** Runs the mount effect's cleanup function, exactly like an unmount would. */
    unmount() {
      for (const value of hookValues) {
        ;(value as EffectRecord | undefined)?.cleanup?.()
      }
    },
  }
}

type FakeTimer = { id: number; delayMs: number; callback: () => void }

function createFakeTimers() {
  let nextId = 1
  const timeouts = new Map<number, FakeTimer>()
  let interval: FakeTimer | null = null
  const fakeWindow = {
    matchMedia: (query: string) => ({ matches: false, media: query }) as unknown as MediaQueryList,
    setTimeout: (callback: () => void, delayMs?: number) => {
      const id = nextId++
      timeouts.set(id, { id, delayMs: delayMs ?? 0, callback })
      return id
    },
    clearTimeout: (id: number) => void timeouts.delete(id),
    setInterval: (callback: () => void, delayMs?: number) => {
      const id = nextId++
      interval = { id, delayMs: delayMs ?? 0, callback }
      return id
    },
    clearInterval: (id: number) => {
      if (interval?.id === id) interval = null
    },
  }
  return {
    window: fakeWindow,
    timeouts,
    get interval() {
      return interval
    },
    /** Fires and consumes the earliest still-pending timeout, like a real clock would. */
    fireNextTimeout() {
      const next = [...timeouts.values()].sort((a, b) => a.id - b.id)[0]
      assert.ok(next, "expected a pending timeout")
      timeouts.delete(next.id)
      next.callback()
    },
  }
}

function mountHeroDemo(reducedMotion: boolean) {
  const fakeTimers = createFakeTimers()
  fakeTimers.window.matchMedia = (query: string) =>
    ({ matches: reducedMotion, media: query }) as unknown as MediaQueryList
  const previousWindow = (globalThis as { window?: unknown }).window
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeTimers.window })

  const harness = createStateEffectHarness(() => ScanHeroDemo({ quizAnswers }))
  const initialTree = harness.render()

  return {
    fakeTimers,
    initialTree,
    render: () => harness.render(),
    unmount: () => harness.unmount(),
    restoreWindow: () => {
      if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window
      else
        Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow })
    },
  }
}

test("the hero demo mounts on the finished frame, then replays scanning → detected → result", () => {
  const demo = mountHeroDemo(false)
  try {
    // The initial render — before the mount effect has run — is the finished frame, so SSR
    // paints the same still frame a reduced-motion visitor keeps forever.
    assert.equal(demo.initialTree.props.phase, "result")

    // The mount effect ran during that same `render()` call (matching React's commit timing)
    // and immediately started the replay.
    assert.equal(demo.fakeTimers.timeouts.size, 2)
    assert.ok(demo.fakeTimers.interval, "a replay loop must be scheduled")
    assert.equal(demo.render().props.phase, "scanning")

    const delaysMs = [...demo.fakeTimers.timeouts.values()].map((timer) => timer.delayMs).sort()
    assert.deepEqual(delaysMs, [1800, 2500])

    demo.fakeTimers.fireNextTimeout()
    assert.equal(demo.render().props.phase, "detected")
    assert.equal(demo.fakeTimers.timeouts.size, 1, "only the result timeout is still pending")

    demo.fakeTimers.fireNextTimeout()
    assert.equal(demo.render().props.phase, "result")
    assert.equal(demo.fakeTimers.timeouts.size, 0)
    assert.ok(demo.fakeTimers.interval, "the loop itself keeps running")

    // The loop replays: firing it clears any (already-consumed) pending pair and starts over.
    demo.fakeTimers.interval!.callback()
    assert.equal(demo.render().props.phase, "scanning")
    assert.equal(demo.fakeTimers.timeouts.size, 2, "a fresh pair is scheduled, not stacked")
  } finally {
    demo.unmount()
    demo.restoreWindow()
  }
})

test("the hero demo bails out under reduced motion — no timer is ever scheduled", () => {
  const demo = mountHeroDemo(true)
  try {
    assert.equal(demo.initialTree.props.phase, "result")
    assert.equal(demo.fakeTimers.timeouts.size, 0)
    assert.equal(demo.fakeTimers.interval, null)
    // No post-mount update happens at all for this visitor.
    assert.equal(demo.render().props.phase, "result")
  } finally {
    demo.unmount()
    demo.restoreWindow()
  }
})

test("unmounting the hero demo clears both the loop and any pending timeouts", () => {
  const demo = mountHeroDemo(false)
  try {
    assert.ok(demo.fakeTimers.interval)
    assert.equal(demo.fakeTimers.timeouts.size, 2)
    demo.unmount()
    assert.equal(demo.fakeTimers.interval, null, "the replay loop must be cleared")
    assert.equal(demo.fakeTimers.timeouts.size, 0, "both pending timeouts must be cleared")
  } finally {
    demo.restoreWindow()
  }
})

test("the delegation to the organic offer maps its own offerVariant, not the scanner's", () => {
  // `resolveOfferSectionIndex` (used by `OfferTrackingProvider` for engagement tracking) is
  // keyed off `offerVariant` — see `SCAN_REGAL_SECTION_ORDER` vs `ORGANIC_PLAN_SECTION_ORDER`
  // in `src/lib/analytics/offer-section-order.ts`. If `scan-regal-v1` leaked through into the
  // delegated organic render, its tracking would resolve section indices against the
  // scanner's own order instead of the organic offer's. `ScanRegalOffer` calls no hook before
  // its early return, so it can be called directly as a plain function to inspect the
  // element it hands to `OrganicPlanOffer`, without a hook harness.
  for (const props of [
    { ...commercialProps, regularFieldTest: { accessDurationHours: 168 } },
    {
      ...commercialProps,
      partnerAccess: { activationApiPath: "/api/partner-access/activate" as const },
    },
  ] satisfies FunnelOfferVariantProps[]) {
    const element = ScanRegalOffer(props)
    assert.ok(React.isValidElement(element))
    assert.equal((element as ReactElement).type, OrganicPlanOffer)
    assert.equal(
      (element as ReactElement<{ offerVariant: string }>).props.offerVariant,
      "organic-plan-v1",
    )
  }
})
