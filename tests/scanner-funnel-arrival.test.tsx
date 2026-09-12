import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"

import { readFileSync } from "node:fs"

import { PlanBereitArrival } from "../src/app/plan-bereit/plan-ready-arrival"
import { PersonalPlanReadyClient } from "../src/app/plan-bereit/personal-plan-ready-client"
import { ScanWelcomeHint, resetScanWelcomeHintForTests } from "../src/app/scan/scan-page-client"
import { ScanPageClient } from "../src/app/scan/scan-page-client"

/**
 * Same hand-rolled harness family as `tests/gated-preview-component.test.tsx`: this
 * repo has no jsdom/testing-library, so the component function is called under a
 * minimal dispatcher and the returned element tree is walked. Effects are not run —
 * every assertion here is about the first committed frame's copy and destination.
 */

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

type ReactDispatcherInternals = { H: unknown }

function renderWithHooks(
  renderComponent: () => ReactElement | null,
  syncStoreSnapshot?: () => unknown,
): ReactElement | null {
  const reactInternals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const hookValues: unknown[] = []
  let cursor = 0

  const dispatcher = {
    useState<T>(initialState: T | (() => T)): [T, (next: T) => void] {
      const index = cursor
      cursor += 1
      if (hookValues.length <= index) {
        hookValues[index] =
          typeof initialState === "function" ? (initialState as () => T)() : initialState
      }
      return [
        hookValues[index] as T,
        (next: T) => {
          hookValues[index] = next
        },
      ]
    },
    useEffect() {},
    useRef<T>(initial: T) {
      const index = cursor
      cursor += 1
      if (hookValues.length <= index) hookValues[index] = { current: initial }
      return hookValues[index]
    },
    useSyncExternalStore(_subscribe: unknown, getSnapshot: () => unknown) {
      return (syncStoreSnapshot ?? getSnapshot)()
    },
    // `ScanPageClient` reads the app router through context; the tree never navigates
    // in these assertions, so a stub keeps `useRouter()` from throwing its invariant.
    useContext() {
      return { push() {} }
    },
  }

  cursor = 0
  const previousDispatcher = reactInternals.H
  reactInternals.H = dispatcher
  try {
    return renderComponent()
  } finally {
    reactInternals.H = previousDispatcher
  }
}

function renderArrival(props: Parameters<typeof PlanBereitArrival>[0]) {
  return renderWithHooks(() => PlanBereitArrival(props))
}

function headlines(tree: ReactNode) {
  return findAll(tree, (element) => element.type === "h1").map((element) => textContent(element))
}

function ctaLabels(tree: ReactNode) {
  return findAll(tree, (element) => {
    const className = element.props.className
    return typeof className === "string" && className.includes("plan-opening-cta-js")
  }).map((element) => textContent(element))
}

function highlights(tree: ReactNode) {
  return findAll(tree, (element) => element.type === "li").map((element) => textContent(element))
}

// --- plan-bereit arrival ----------------------------------------------------

test("the default arrival keeps the plan destination, headlines, CTA and surfaces", () => {
  const tree = renderArrival({ actionHref: "/plan-start", phase: "ready", interactive: true })

  assert.deepEqual(headlines(tree), ["Dein Plan wird geöffnet.", "Dein Plan ist fertig."])
  assert.deepEqual(ctaLabels(tree), ["Plan ansehen"])
  assert.deepEqual(highlights(tree), [
    "Deine RoutineSchritt für Schritt.",
    "Deine AnwendungSo setzt du's um.",
    "Dein ChatFragen? Immer offen.",
  ])
})

test("the scan variant swaps both headlines, the CTA and the three surfaces", () => {
  const tree = renderArrival({
    actionHref: "/scan?welcome=scan",
    phase: "ready",
    interactive: true,
    variant: "scan",
  })

  assert.deepEqual(headlines(tree), [
    "Wir richten deinen Scanner ein.",
    "Dein Scanner ist startklar.",
  ])
  assert.deepEqual(ctaLabels(tree), ["Scanner öffnen"])
  assert.deepEqual(highlights(tree), [
    "Dein ScannerBarcode scannen, Ergebnis sehen.",
    "Dein PlanWartet daneben.",
    "Dein ChatFragen? Immer offen.",
  ])
})

test("the scan variant keeps the shared frame — payment line, lead-in and slow hint", () => {
  const scan = renderArrival({ actionHref: "/scan?welcome=scan", variant: "scan" })
  const plan = renderArrival({ actionHref: "/plan-start" })

  for (const shared of [
    "Zahlung bestätigt",
    "Und das wartet dahinter:",
    "Wir verbinden deinen Plan mit deinem Konto – einen Moment.",
  ]) {
    assert.ok(textContent(scan).includes(shared), `scan keeps: ${shared}`)
    assert.ok(textContent(plan).includes(shared), `plan keeps: ${shared}`)
  }
})

test("the scan CTA points at the scanner and the default at plan-start", () => {
  for (const [variant, href] of [
    ["plan", "/plan-start"],
    ["scan", "/scan?welcome=scan"],
  ] as const) {
    const tree = renderArrival({ actionHref: href, phase: "ready", interactive: true, variant })
    const links = findAll(tree, (element) => element.props.href === href)
    assert.ok(links.length >= 1, `${variant} renders a link to ${href}`)
  }
})

// --- /scan welcome hint -----------------------------------------------------

test("the scan welcome hint carries the arrival copy and its dismiss control", () => {
  resetScanWelcomeHintForTests()
  const tree = renderWithHooks(
    () => ScanWelcomeHint(),
    () => false,
  )

  assert.ok(tree, "hint renders while undismissed")
  assert.ok(
    textContent(tree).includes("Dein Scanner ist startklar. Dein Plan wartet daneben."),
    "hint copy",
  )
  const buttons = findAll(tree, (element) => element.type === "button")
  assert.equal(buttons.length, 1)
  assert.equal(textContent(buttons[0]), "Verstanden")
})

test("a dismissed session renders no hint at all", () => {
  resetScanWelcomeHintForTests()
  assert.equal(
    renderWithHooks(
      () => ScanWelcomeHint(),
      () => true,
    ),
    null,
  )
})

test("the scan page renders the hint only when the welcome query asked for it", () => {
  resetScanWelcomeHintForTests()
  for (const welcomeHint of [true, false]) {
    const tree = renderWithHooks(
      () =>
        ScanPageClient({
          tier: "premium" as const,
          merklisteEnabled: true,
          welcomeHint,
        }),
      () => false,
    )
    const hints = findAll(tree, (element) => element.type === ScanWelcomeHint)
    assert.equal(hints.length, welcomeHint ? 1 : 0, `welcomeHint=${welcomeHint}`)
  }
})

// --- plan-bereit ready state ------------------------------------------------

function renderReadyClient(funnelPackageKey: string | null) {
  const tree = renderWithHooks(() =>
    PersonalPlanReadyClient({
      leadId: "lead-1",
      funnelPackageKey,
      initialReadiness: {
        status: "ready",
        leadId: "lead-1",
        quizSourceKind: "legacy",
        sourceVersion: null,
        missingFacts: [],
        initialAction: "none",
      },
    }),
  )
  const arrivals = findAll(tree, (element) => element.type === PlanBereitArrival)
  assert.equal(arrivals.length, 1, `one arrival frame for package ${funnelPackageKey}`)
  return arrivals[0].props
}

test("the ready state sends a scan_v1 buyer to the scanner with scanner copy", () => {
  const props = renderReadyClient("scan_v1")

  assert.equal(props.actionHref, "/scan?welcome=scan")
  assert.equal(props.variant, "scan")
  // /scan is not a Personal-Plan stage route, so no stage-navigation marker is set.
  assert.equal(props.onAction, undefined)
})

test("every other package keeps the plan destination, copy and stage marker", () => {
  for (const packageKey of [null, "organic", "personal_plan_v1"]) {
    const props = renderReadyClient(packageKey)

    assert.equal(props.actionHref, "/plan-start", `package ${packageKey}`)
    assert.equal(props.variant, "plan", `package ${packageKey}`)
    assert.equal(typeof props.onAction, "function", `package ${packageKey}`)
  }
})

test("the package key reaches the ready client from the server, never from the client", () => {
  const pageSource = readFileSync(
    new URL("../src/app/plan-bereit/page.tsx", import.meta.url),
    "utf8",
  )
  const clientSource = readFileSync(
    new URL("../src/app/plan-bereit/personal-plan-ready-client.tsx", import.meta.url),
    "utf8",
  )

  assert.match(pageSource, /resolveFunnelContextForLead\(leadId\)/)
  // Every render site of the ready client carries the package, not just the ready one:
  // a waiting or error screen can reach `ready` through the poll without a new render.
  const renderSites = pageSource.match(/<PersonalPlanReadyClient/g) ?? []
  const packageProps = pageSource.match(/funnelPackageKey=\{/g) ?? []
  assert.ok(renderSites.length >= 4, `expected every render site, found ${renderSites.length}`)
  assert.equal(packageProps.length, renderSites.length)
  // The client receives the package as a prop; it never imports the server lookup.
  assert.doesNotMatch(clientSource, /from "@\/lib\/funnel\/server"/)
  assert.doesNotMatch(clientSource, /resolveFunnelContextForLead\(/)
})
