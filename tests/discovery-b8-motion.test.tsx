import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import type { ScanSearchResult } from "../src/app/api/scan/search/route"
import {
  isProvisionalItem,
  productSubject,
  provisionalIntakeItem,
  itemSubject,
} from "../src/components/discovery/intake/add-flow"
import { DiscoveryAddSheet } from "../src/components/discovery/intake/discovery-add-sheet"
import { DiscoveryHeatScreen } from "../src/components/discovery/intake/discovery-heat-flow"
import { DiscoveryIntakeChecklist } from "../src/components/discovery/intake/discovery-intake-checklist"
import {
  BeforeCommit,
  FrozenLayerHost,
  SlideStage,
  freezeSnapshot,
  type FreezableElement,
} from "../src/components/discovery/intake/discovery-motion"
import {
  DiscoveryProductCard,
  DiscoveryProductsScreen,
} from "../src/components/discovery/intake/discovery-products-screen"
import {
  DiscoveryRoutineScreen,
  EMPTY_DAY_LABEL,
} from "../src/components/discovery/intake/discovery-routine-screen"
import { heatStepKey } from "../src/components/discovery/intake/heat-flow"
import type { DiscoveryIntakeItemView } from "../src/components/discovery/intake/types"
import type { DiscoveryHeatStylingV1 } from "../src/lib/discovery/heat-styling"
import { MOTION_MS } from "../src/lib/motion"

/**
 * Batch 8 (plan `plans/discovery-b8-motion-days/plan.md`): the default routine days on the
 * screen, the frozen leaving layer, optimistic writes with rollback, and no page dimming.
 * Same hand-rolled dispatcher family as `tests/discovery-participant-flow.test.tsx` (no
 * jsdom in this repo) — here it also knows `useRef` and `useEffect` (never run).
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

function createHarness(render: () => ReactElement) {
  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const values: unknown[] = []
  let cursor = 0
  const dispatcher = {
    useState<T>(initial: T | (() => T)): [T, (next: T | ((previous: T) => T)) => void] {
      const index = cursor++
      if (values.length <= index) {
        values[index] = typeof initial === "function" ? (initial as () => T)() : initial
      }
      return [
        values[index] as T,
        (next) => {
          values[index] =
            typeof next === "function" ? (next as (previous: T) => T)(values[index] as T) : next
        },
      ]
    },
    useRef<T>(initial: T): { current: T } {
      const index = cursor++
      if (values.length <= index) values[index] = { current: initial }
      return values[index] as { current: T }
    },
    useEffect() {},
  }
  return {
    values,
    render(): ReactElement {
      cursor = 0
      const previous = internals.H
      internals.H = dispatcher
      try {
        return render()
      } finally {
        internals.H = previous
      }
    },
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

function checklist(
  items: DiscoveryIntakeItemView[],
  initialHeatStyling: DiscoveryHeatStylingV1 | null = null,
) {
  return createHarness(() =>
    DiscoveryIntakeChecklist({
      initialItems: items,
      initialSubmitted: false,
      initialHeatStyling,
      retailerSearchEnabled: false,
    }),
  )
}

const products = (tree: ReactNode) => find(tree, DiscoveryProductsScreen)
const ids = (tree: ReactNode) =>
  (products(tree).props.items as DiscoveryIntakeItemView[]).map((item) => item.id)

// --- Part A on the screen ------------------------------------------------------------------

test("„Deine Routine“ always shows Waschtag and Tag ohne Wäsche; an empty one says „Nichts eingetragen“", () => {
  const empty = renderToStaticMarkup(
    <DiscoveryRoutineScreen items={[]} onEdit={() => {}} onBack={() => {}} onConfirm={() => {}} />,
  )
  const titles = [...empty.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((match) => match[1])
  assert.deepEqual(titles, ["Waschtag", "Tag ohne Wäsche"])
  assert.equal(empty.split(`>${EMPTY_DAY_LABEL}<`).length - 1, 2)
  assert.doesNotMatch(empty, /nicht jede Wäsche/i)
  assert.doesNotMatch(empty, /Zwischendurch/)

  const leaveInDaily = renderToStaticMarkup(
    <DiscoveryRoutineScreen
      items={[
        view({ frequency: "weekly_2x" }),
        view({
          id: "li",
          category: "leave_in",
          productType: "leave_in",
          productNameText: "Leave-in Spray",
          frequency: "daily_1x",
        }),
      ]}
      onEdit={() => {}}
      onBack={() => {}}
      onConfirm={() => {}}
    />,
  )
  // Waschtag with its cadence pill; Tag ohne Wäsche without one, both with the leave-in.
  assert.match(leaveInDaily, /Waschtag<\/h2><span[^>]*>2× pro Woche</)
  assert.match(leaveInDaily, /Tag ohne Wäsche<\/h2><\/div>/)
  assert.equal(leaveInDaily.split('aria-label="Balea Leave-in Spray bearbeiten"').length - 1, 2)
  assert.equal(leaveInDaily.split(`>${EMPTY_DAY_LABEL}<`).length - 1, 0)
})

// --- The frozen leaving layer --------------------------------------------------------------

type FakeAnimation = { currentTime: number; effect: { getTiming(): { delay: number } } }

class FakeElement implements FreezableElement {
  attributes = new Map<string, string>()
  styles = new Map<string, string>()
  children: FakeElement[] = []
  parentElement: FakeElement | null = null
  value?: string
  animations: FakeAnimation[] = []
  style = {
    setProperty: (name: string, value: string) => {
      this.styles.set(name, value)
    },
  }
  constructor(
    readonly tagName: string,
    attributes: Record<string, string> = {},
    children: FakeElement[] = [],
  ) {
    for (const [name, value] of Object.entries(attributes)) this.attributes.set(name, value)
    for (const child of children) this.append(child)
  }
  append(child: FakeElement) {
    child.parentElement = this
    this.children.push(child)
  }
  removeAttribute(name: string) {
    this.attributes.delete(name)
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }
  getAnimations() {
    return this.animations
  }
  cloneNode(): FakeElement {
    // Like the DOM: attributes and structure copy; running animations, styles set by hand
    // and a field's typed value do not.
    const copy = new FakeElement(tagName(this), Object.fromEntries(this.attributes))
    for (const child of this.children) copy.append(child.cloneNode())
    return copy
  }
}
function tagName(element: FakeElement) {
  return element.tagName
}

function tappedStep() {
  const tapped = new FakeElement("BUTTON", { "aria-pressed": "true", class: "plum" })
  tapped.animations = [{ currentTime: 80, effect: { getTiming: () => ({ delay: 0 }) } }]
  const other = new FakeElement("BUTTON", { "aria-pressed": "false", id: "option-2" })
  const typed = new FakeElement("INPUT", { name: "brand", autofocus: "" })
  typed.value = "Balea"
  const video = new FakeElement("VIDEO", { autoplay: "" })
  return new FakeElement("DIV", {}, [tapped, other, typed, video])
}

test("freezeSnapshot: the copy keeps the tapped answer and every frame where it was, and never replays", () => {
  const source = tappedStep()
  const clone = source.cloneNode()
  freezeSnapshot(source, clone)
  const [tapped, other, typed, video] = clone.children
  assert.equal(tapped.attributes.get("aria-pressed"), "true", "her answer stays plum")
  assert.equal(tapped.styles.get("animation-delay"), "-80ms", "a running animation is pinned")
  assert.equal(tapped.styles.get("animation-play-state"), "paused")
  assert.equal(other.styles.get("animation"), "none", "nothing restarts")
  for (const element of [clone, tapped, other, typed, video]) {
    assert.equal(element.styles.get("transition"), "none")
  }
  assert.equal(other.attributes.has("id"), false, "no duplicate ids")
  assert.equal(typed.attributes.get("value"), "Balea", "a typed value survives")
  assert.equal(typed.attributes.has("autofocus"), false)
  assert.equal(video.attributes.has("autoplay"), false, "the camera copy never plays")
})

function installFakeDom(t: { after: (fn: () => void) => void }, scroller: { scrollTop: number }) {
  const globals = globalThis as unknown as Record<string, unknown>
  const previous = { window: globals.window, document: globals.document }
  const body = new FakeElement("BODY")
  globals.document = { body, documentElement: new FakeElement("HTML"), scrollingElement: scroller }
  globals.window = { getComputedStyle: () => ({ overflowY: "visible" }) }
  t.after(() => {
    globals.window = previous.window
    globals.document = previous.document
  })
  return body
}

let probeRenders = 0
function Probe({ name }: { name: string }) {
  probeRenders += 1
  return <span data-probe={name} />
}

test("SlideStage: the leaving step is a frozen DOM copy — not re-mounted, pinned at its scroll, the page back on top", (t) => {
  const scroller = { scrollTop: 420 }
  const body = installFakeDom(t, scroller)
  let stepKey = "usage"
  let child: ReactNode = <Probe name="usage" />
  const stage = createHarness(() =>
    SlideStage({
      stepKey,
      direction: 1,
      variant: "screen",
      surfaceClassName: "bg-x",
      children: child,
    }),
  )

  // First render: the stage's ref is the first hook slot; hand it the live step's DOM.
  stage.render()
  const live = tappedStep()
  body.append(live)
  ;(stage.values[0] as { current: unknown }).current = live

  stepKey = "frequency"
  child = <Probe name="frequency" />
  let tree = stage.render()
  const commit = find(tree, BeforeCommit)
  assert.equal(commit.props.watch, "frequency")

  // React's commit: before the DOM changes the old step is copied, after it the layer is set.
  const captured = commit.props.capture("usage", "frequency")
  assert.ok(captured.layer, "a leaving layer")
  assert.notEqual(captured.layer.node, live, "a copy, not the live node")
  assert.equal(captured.layer.node.children[0].attributes.get("aria-pressed"), "true")
  assert.equal(captured.layer.offsetY, 420, "pinned where she saw it")
  commit.props.onCaptured(captured)
  assert.equal(scroller.scrollTop, 0, "the new screen starts at the top")

  probeRenders = 0
  tree = stage.render()
  const host = find(tree, FrozenLayerHost)
  assert.equal(host.props.layer, captured.layer)
  // The old step exists only as that DOM copy: React renders nothing for it, so no
  // component of the old step mounts again, runs an effect or replays its animation.
  const hostHtml = renderToStaticMarkup(host)
  assert.match(hostHtml, /^<div aria-hidden="true" inert="" data-discovery-frozen-layer=""/)
  assert.doesNotMatch(hostHtml, /data-probe/)
  assert.match(hostHtml, /style="top:-420px"/)
  assert.match(hostHtml, /discovery-screen-out-forward/)
  assert.match(hostHtml, /bg-x/, "opaque surface")
  const html = renderToStaticMarkup(tree)
  assert.deepEqual(
    [...html.matchAll(/data-probe="([^"]+)"/g)].map((match) => match[1]),
    ["frequency"],
    "only the new step is rendered by React",
  )
  assert.equal(probeRenders, 1)
  assert.match(html, /discovery-screen-in-forward/)
})

test("SlideStage: a camera step (animate=false) or reduced motion swaps without a copy but still scrolls up", (t) => {
  const scroller = { scrollTop: 90 }
  const body = installFakeDom(t, scroller)
  let stepKey = "scan"
  const stage = createHarness(() =>
    SlideStage({ stepKey, direction: 1, animate: false, children: <Probe name={stepKey} /> }),
  )
  stage.render()
  const live = tappedStep()
  body.append(live)
  ;(stage.values[0] as { current: unknown }).current = live
  stepKey = "usage"
  const tree = stage.render()
  const commit = find(tree, BeforeCommit)
  const captured = commit.props.capture("scan", "usage")
  assert.equal(captured.layer, null, "no copy of the camera")
  commit.props.onCaptured(captured)
  assert.equal(scroller.scrollTop, 0)
  assert.doesNotMatch(renderToStaticMarkup(stage.render()), /data-discovery-frozen-layer/)
})

test("BeforeCommit captures only when its key changes, before the DOM does", () => {
  const seen: string[] = []
  const boundary = new BeforeCommit({
    watch: "b",
    capture: (previous: string, next: string) => `${previous}→${next}`,
    onCaptured: (snapshot: string) => seen.push(snapshot),
    children: null,
  })
  assert.equal(boundary.getSnapshotBeforeUpdate({ watch: "b" }), null)
  const snapshot = boundary.getSnapshotBeforeUpdate({ watch: "a" })
  assert.deepEqual(snapshot, { value: "a→b" })
  boundary.componentDidUpdate({}, {}, snapshot)
  assert.deepEqual(seen, ["a→b"])
})

// --- Optimistic writes ---------------------------------------------------------------------

const CATALOG_MASK: ScanSearchResult = {
  id: "20000000-0000-4000-8000-000000000009",
  name: "Balea Professional Plex Care Maske",
  brand: "Balea",
  category: "mask",
  categoryLabel: "Maske",
  imageUrl: "https://catalog.example/maske.webp",
  productLine: "Professional",
}

test("the provisional card reads exactly like the pinned header she just saw", () => {
  const subject = productSubject({
    brand: CATALOG_MASK.brand,
    line: CATALOG_MASK.productLine,
    name: CATALOG_MASK.name,
    imageUrl: CATALOG_MASK.imageUrl,
  })
  const card = provisionalIntakeItem(
    "provisional:7",
    {
      capture: {
        source: "catalog_search",
        productId: CATALOG_MASK.id,
        brandText: "Balea",
        productNameText: CATALOG_MASK.name,
      },
      productType: "mask",
      usage: { category: "mask", role: null },
      frequency: "weekly_1x",
    },
    subject,
  )
  assert.deepEqual(itemSubject(card), subject)
  assert.equal(card.category, "mask")
  assert.equal(card.frequency, "weekly_1x")
  assert.equal(isProvisionalItem(card), true)
  assert.equal(isProvisionalItem(view()), false)

  // While its POST runs she cannot edit or remove it (taps do nothing, nothing is dimmed).
  let taps = 0
  const html = renderToStaticMarkup(
    <DiscoveryProductCard
      item={card}
      landed
      onEdit={() => taps++}
      onFrequency={() => taps++}
      onRemove={() => taps++}
    />,
  )
  assert.doesNotMatch(html, /\sdisabled=""/)
})

test("remove: the card fades and collapses at once while the DELETE runs, then it is gone", async (t) => {
  const reply = deferred<Reply>()
  const requests = mockFetch(t, () => reply.promise)
  const harness = checklist([view(), view({ id: "item-2", productNameText: "Spülung" })])
  let tree = harness.render()
  products(tree).props.onRemove("item-1")
  tree = harness.render()
  assert.deepEqual(products(tree).props.removingIds, ["item-1"], "collapsing immediately")
  assert.deepEqual(ids(tree), ["item-1", "item-2"], "still in the list while it collapses")
  assert.equal(requests[0]?.method, "DELETE")
  assert.match(
    renderToStaticMarkup(
      <DiscoveryProductCard
        item={view()}
        landed={false}
        removing
        onEdit={() => {}}
        onFrequency={() => {}}
        onRemove={() => {}}
      />,
    ),
    /discovery-collapse/,
  )

  await wait(MOTION_MS.list + 20)
  tree = harness.render()
  assert.deepEqual(ids(tree), ["item-2"], "gone after the collapse, before the server answered")
  reply.resolve({ status: 204, body: null })
  await settle()
  tree = harness.render()
  assert.deepEqual(ids(tree), ["item-2"])
  assert.equal(products(tree).props.removeFailedId, null)
})

test("remove failed after the collapse: the card comes back where it was, with a line", async (t) => {
  const reply = deferred<Reply>()
  mockFetch(t, () => reply.promise)
  const harness = checklist([view(), view({ id: "item-2" }), view({ id: "item-3" })])
  let tree = harness.render()
  products(tree).props.onRemove("item-2")
  await wait(MOTION_MS.list + 20)
  tree = harness.render()
  assert.deepEqual(ids(tree), ["item-1", "item-3"])

  reply.resolve({ status: 503, body: { code: "unavailable" } })
  await settle()
  await settle()
  tree = harness.render()
  assert.deepEqual(ids(tree), ["item-1", "item-2", "item-3"], "restored in place")
  assert.equal(products(tree).props.removeFailedId, "item-2")
  assert.deepEqual(products(tree).props.removingIds, [])
  assert.match(
    renderToStaticMarkup(
      <DiscoveryProductCard
        item={view({ id: "item-2" })}
        landed={false}
        removeFailed
        onEdit={() => {}}
        onFrequency={() => {}}
        onRemove={() => {}}
      />,
    ),
    /role="alert"[^>]*>Entfernen hat nicht geklappt\.</,
  )
})

test("remove failed before the collapse ended: the card simply stays", async (t) => {
  mockFetch(t, () => ({ status: 503, body: { code: "unavailable" } }))
  const harness = checklist([view()])
  let tree = harness.render()
  products(tree).props.onRemove("item-1")
  await settle()
  await wait(MOTION_MS.list + 20)
  tree = harness.render()
  assert.deepEqual(ids(tree), ["item-1"])
  assert.deepEqual(products(tree).props.removingIds, [])
  assert.equal(products(tree).props.removeFailedId, "item-1")
})

test("„Entfernen“ in the sheet: the sheet closes first, the card collapses after it", async (t) => {
  mockFetch(t, () => ({ status: 204, body: null }))
  const harness = checklist([view()])
  let tree = harness.render()
  products(tree).props.onEdit(view())
  tree = harness.render()
  find(tree, DiscoveryAddSheet).props.handlers.onRemove(view())
  tree = harness.render()
  assert.equal(find(tree, DiscoveryAddSheet).props.open, false)
  assert.deepEqual(products(tree).props.removingIds, [], "not while the sheet is still closing")
  await wait(MOTION_MS.sheetOut + 20)
  tree = harness.render()
  assert.deepEqual(products(tree).props.removingIds, ["item-1"])
  await wait(MOTION_MS.list + 20)
  tree = harness.render()
  assert.deepEqual(ids(tree), [])
})

test("an added card lands at once; „Weiter“ waits for its POST before the routine", async (t) => {
  const reply = deferred<Reply>()
  mockFetch(t, () => reply.promise)
  const harness = checklist([view()])
  let tree = harness.render()
  products(tree).props.onSearch("mask")
  tree = harness.render()
  find(tree, DiscoveryAddSheet).props.handlers.onPickCatalog(CATALOG_MASK)
  tree = harness.render()
  find(tree, DiscoveryAddSheet).props.handlers.onFrequency("weekly_1x")
  tree = harness.render()
  const provisionalId = ids(tree)[1]
  assert.match(provisionalId, /^provisional:/)

  products(tree).props.onContinue()
  tree = harness.render()
  assert.equal(products(tree).props.continuing, true, "„Weiter“ waits")
  find(tree, DiscoveryProductsScreen)

  reply.resolve({
    status: 201,
    body: { item: view({ id: "item-mask", category: "mask", productType: "mask" }) },
  })
  await settle()
  await settle()
  await settle()
  tree = harness.render()
  const routine = find(tree, DiscoveryRoutineScreen)
  assert.deepEqual(
    (routine.props.items as DiscoveryIntakeItemView[]).map((item) => item.id),
    ["item-1", "item-mask"],
  )

  // The landing marker is cleared once it played — coming back never replays it.
  await wait(MOTION_MS.sheetOut + MOTION_MS.list + 120)
  routine.props.onBack()
  tree = harness.render()
  assert.equal(products(tree).props.landedKey, null)
})

test("heat: the last answer moves on at once while its PUT runs; „Abschicken“ waits for it", async (t) => {
  const put = deferred<Reply>()
  const requests = mockFetch(t, (request) =>
    request.url.endsWith("/heat-styling")
      ? put.promise
      : { status: 200, body: { state: "submitted", submittedAt: "x", confirmedNone: [] } },
  )
  const harness = checklist([view()], {
    dryingRoutes: ["air_dry"],
    additionalHeatTools: [],
    heatEvents: {},
  })
  let tree = harness.render()
  products(tree).props.onContinue()
  tree = harness.render()
  find(tree, DiscoveryRoutineScreen).props.onConfirm()
  tree = harness.render()
  find(tree, DiscoveryHeatScreen).props.onNext()
  tree = harness.render()
  find(tree, DiscoveryHeatScreen).props.onNext()
  tree = harness.render()
  const screen = find(tree, DiscoveryHeatScreen)
  assert.equal(heatStepKey(screen.props.steps[screen.props.index]), "summary", "no waiting")
  await settle()
  assert.deepEqual(
    requests.map((request) => request.method),
    ["PUT"],
  )

  screen.props.onSubmit()
  tree = harness.render()
  assert.equal(find(tree, DiscoveryHeatScreen).props.submitting, true)
  await settle()
  assert.equal(requests.length, 1, "the submit waits for the heat save")

  put.resolve({ status: 200, body: { heatStyling: {} } })
  await wait(10)
  tree = harness.render()
  assert.deepEqual(
    requests.map((request) => request.url),
    ["/api/beratung/intake/heat-styling", "/api/beratung/intake/submit"],
  )
  assert.match(renderToStaticMarkup(tree), /Danke! Bis bald im Gespräch\./)
})

test("heat: a background save that failed is saved again by „Abschicken“ before submitting", async (t) => {
  let puts = 0
  const requests = mockFetch(t, (request) => {
    if (request.url.endsWith("/heat-styling")) {
      puts += 1
      return puts === 1
        ? { status: 503, body: { code: "unavailable" } }
        : { status: 200, body: { heatStyling: request.body } }
    }
    return { status: 200, body: { state: "submitted", submittedAt: "x", confirmedNone: [] } }
  })
  const harness = checklist([view()], {
    dryingRoutes: ["air_dry"],
    additionalHeatTools: [],
    heatEvents: {},
  })
  let tree = harness.render()
  products(tree).props.onContinue()
  tree = harness.render()
  find(tree, DiscoveryRoutineScreen).props.onConfirm()
  tree = harness.render()
  find(tree, DiscoveryHeatScreen).props.onNext()
  tree = harness.render()
  find(tree, DiscoveryHeatScreen).props.onNext()
  await settle()
  tree = harness.render()
  assert.equal(find(tree, DiscoveryHeatScreen).props.error, null, "no alarm on the final page")
  find(tree, DiscoveryHeatScreen).props.onSubmit()
  await wait(10)
  tree = harness.render()
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "PUT /api/beratung/intake/heat-styling",
      "PUT /api/beratung/intake/heat-styling",
      "POST /api/beratung/intake/submit",
    ],
  )
  assert.match(renderToStaticMarkup(tree), /Danke! Bis bald im Gespräch\./)
})

// --- No page dimming -----------------------------------------------------------------------

test("no page dimming: with an add and a remove in flight nothing on the products page is disabled", async (t) => {
  mockFetch(t, () => new Promise<Reply>(() => {}))
  const harness = checklist([view(), view({ id: "item-2" })])
  let tree = harness.render()
  products(tree).props.onRemove("item-2")
  products(tree).props.onSearch(null)
  tree = harness.render()
  find(tree, DiscoveryAddSheet).props.handlers.onPickCatalog(CATALOG_MASK)
  tree = harness.render()
  find(tree, DiscoveryAddSheet).props.handlers.onFrequency("weekly_1x")
  tree = harness.render()
  const html = renderToStaticMarkup(tree)
  assert.doesNotMatch(html, /\sdisabled=""/, "no control is disabled while saves run")
  assert.doesNotMatch(html, /aria-busy/, "and nothing shows a pending state before it waits")
  assert.equal("busy" in products(tree).props, false, "the page has no busy switch at all")
})
