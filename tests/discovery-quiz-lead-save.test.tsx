import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { Loader2 } from "lucide-react"

import { QuizAnalysisView } from "../src/components/quiz/quiz-analysis"
import { QuizConsentSheet } from "../src/components/quiz/quiz-consent-sheet"
import {
  DISCOVERY_LEAD_SAVE_COPY,
  QuizDiscoveryLeadSave,
} from "../src/components/quiz/quiz-discovery-lead-save"
import { QuizLeadCapture } from "../src/components/quiz/quiz-lead-capture"
import { Input } from "../src/components/ui/input"
import {
  prefetchDiscoveryQuizContext,
  resetDiscoveryQuizContextPrefetchForTests,
} from "../src/lib/quiz/discovery-context-prefetch"
import { getQuizFunnelCopy } from "../src/lib/quiz/funnel-copy"
import { useQuizStore } from "../src/lib/quiz/store"
import type { LeadCaptureMode, QuizAnswers } from "../src/lib/quiz/types"

/**
 * Field-test fix: a discovery participant is no longer asked the marketing
 * question. Her lead is saved with `marketingConsent: false` the moment the step
 * is reached — the save itself is never skipped, because the checklist's profile
 * projection is built from it.
 *
 * Batch 8 (plan item 2): „Geschafft" shows the moment the lead step opens; the
 * enrollment check and the save run behind it, the button waits for the save
 * (spinner only after 300 ms), and there is no analysis beat, no fixed wait, no
 * billing-access or result-artifact call for her.
 *
 * Regular and partner capture must not move at all, so their copy is pinned here.
 *
 * No jsdom in this repo: components are called directly under a hand-rolled hook
 * dispatcher (same family as `tests/scan-flow-ui.test.tsx`), their element trees
 * walked, and their handlers invoked as a tap would. Child components are never
 * invoked, so the lead step's tree shows WHICH child it hands WHAT.
 */

type AnyElement = ReactElement<Record<string, any>>
type ReactDispatcherInternals = { H: unknown }
type EffectRecord = { deps: unknown[] | undefined; cleanup?: () => void }

function childrenOf(node: ReactNode): ReactNode[] {
  if (!React.isValidElement(node)) return []
  return React.Children.toArray((node as ReactElement<{ children?: ReactNode }>).props.children)
}

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  return childrenOf(node).map(textOf).join("")
}

function findAll(node: ReactNode, predicate: (element: AnyElement) => boolean): AnyElement[] {
  if (!React.isValidElement(node)) return []
  const element = node as AnyElement
  return [
    ...(predicate(element) ? [element] : []),
    ...childrenOf(element).flatMap((child) => findAll(child, predicate)),
  ]
}

function ofType(tree: ReactNode, type: unknown): AnyElement[] {
  return findAll(tree, (element) => element.type === type)
}

/**
 * `contexts` answers `useContext` by CALL ORDER within one render. The lead step
 * reads exactly four: `useAuth`, `useQuizFunnelPackageKey`, `useQuizBrowserBack`, `useRouter`.
 */
function createHarness(
  render: () => ReactElement | null,
  { contexts = [] as unknown[], runEffects = true } = {},
) {
  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const values: unknown[] = []
  let cursor = 0
  let contextCursor = 0
  let pending: Array<{ index: number; effect: () => void | (() => void) }> = []

  const changed = (previous: unknown[] | undefined, next: unknown[] | undefined) =>
    !previous ||
    !next ||
    previous.length !== next.length ||
    next.some((dep, index) => dep !== previous[index])

  const dispatcher = {
    useCallback<T>(callback: T): T {
      cursor += 1
      return callback
    },
    useContext() {
      return contexts[contextCursor++]
    },
    useDebugValue() {},
    useEffect(effect: () => void | (() => void), deps?: unknown[]) {
      const index = cursor++
      const previous = values[index] as EffectRecord | undefined
      if (!changed(previous?.deps, deps)) return
      previous?.cleanup?.()
      values[index] = { deps } satisfies EffectRecord
      pending.push({ index, effect })
    },
    useRef<T>(initial: T): { current: T } {
      const index = cursor++
      if (!values[index]) values[index] = { current: initial }
      return values[index] as { current: T }
    },
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
    useSyncExternalStore<T>(_subscribe: unknown, getSnapshot: () => T): T {
      return getSnapshot()
    },
  }

  return {
    render(): ReactElement | null {
      cursor = 0
      contextCursor = 0
      pending = []
      const previous = internals.H
      internals.H = dispatcher
      try {
        const tree = render()
        const effects = pending
        pending = []
        if (runEffects) {
          for (const { index, effect } of effects) {
            const cleanup = effect()
            if (typeof cleanup === "function") (values[index] as EffectRecord).cleanup = cleanup
          }
        }
        return tree
      } finally {
        internals.H = previous
      }
    },
    /** Strict-Mode style: every effect's cleanup now; the next render re-runs them. */
    replayEffects() {
      for (const value of values) {
        const record = value as EffectRecord | undefined
        if (record && "deps" in record) record.cleanup?.()
      }
    },
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

// --- The „Geschafft" ending on its own -------------------------------------------

function ending(props: Partial<Parameters<typeof QuizDiscoveryLeadSave>[0]>) {
  return {
    canSave: true,
    error: "",
    onContinue: () => {},
    onRetry: () => {},
    onSave: () => {},
    saved: false,
    ...props,
  }
}

function continueButton(tree: ReactNode) {
  return findAll(tree, (element) => textOf(element).startsWith(DISCOVERY_LEAD_SAVE_COPY.continue))
    .filter((element) => element.type === "button")
    .at(-1)!
}

test("„Geschafft“ at once: one CTA, no name form, no analysis beat, no fixed wait", () => {
  const html = renderToStaticMarkup(<QuizDiscoveryLeadSave {...ending({ canSave: false })} />)
  assert.match(html, /Geschafft — dein Haarprofil steht\./)
  assert.match(html, /Jetzt noch deine Produkte\. Dauert 5 Minuten\./)
  assert.match(html, />Weiter zu deinen Produkten</)
  assert.equal((html.match(/<button/g) ?? []).length, 1)
  assert.doesNotMatch(
    html,
    /Wie heißt du|<input|Einen Moment|Bereit\.|wird gespeichert|Analyse|Auswertung|quiz-shimmer-bar/,
  )
})

test("the save waits for the enrollment check, then posts exactly once", () => {
  let saves = 0
  let canSave = false
  const harness = createHarness(() =>
    // A fresh `onSave` per render, exactly like the lead step's inline arrow.
    QuizDiscoveryLeadSave(ending({ canSave, onSave: () => (saves += 1) })),
  )
  harness.render()
  assert.equal(saves, 0, "no post before the check confirmed her")
  canSave = true
  harness.render()
  harness.render()
  harness.replayEffects()
  harness.render()
  assert.equal(saves, 1)
})

test("an already saved lead is not posted again, and Weiter goes straight on", () => {
  let saves = 0
  let continued = 0
  const harness = createHarness(() =>
    QuizDiscoveryLeadSave(
      ending({ saved: true, onSave: () => (saves += 1), onContinue: () => (continued += 1) }),
    ),
  )
  const tree = harness.render()
  assert.equal(saves, 0)
  continueButton(tree).props.onClick()
  harness.render()
  harness.render()
  assert.equal(continued, 1, "exactly once")
})

test("Weiter before the save answered waits; a spinner only after 300 ms; on once saved", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] })
  let saved = false
  let continued = 0
  const harness = createHarness(() =>
    QuizDiscoveryLeadSave(ending({ saved, onContinue: () => (continued += 1) })),
  )
  let tree = harness.render()
  continueButton(tree).props.onClick()
  tree = harness.render()
  assert.equal(continued, 0, "nothing to continue to yet")
  assert.equal(continueButton(tree).props["aria-busy"], true)
  assert.equal(ofType(tree, Loader2).length, 0, "no spinner before 300 ms")
  assert.match(textOf(continueButton(tree)), /^Weiter zu deinen Produkten$/, "label kept")

  t.mock.timers.tick(299)
  tree = harness.render()
  assert.equal(ofType(tree, Loader2).length, 0)
  t.mock.timers.tick(1)
  tree = harness.render()
  assert.equal(ofType(tree, Loader2).length, 1, "spinner after 300 ms")
  assert.match(textOf(continueButton(tree)), /^Weiter zu deinen Produkten$/, "label still kept")

  saved = true
  harness.render()
  assert.equal(continued, 1, "on the moment the save answered")
})

test("a failed check or save replaces the button with a retry", () => {
  let retries = 0
  const props = ending({ error: "Etwas ist schiefgelaufen.", onRetry: () => (retries += 1) })
  const html = renderToStaticMarkup(<QuizDiscoveryLeadSave {...props} />)
  assert.match(html, /role="alert"/)
  assert.match(html, /Etwas ist schiefgelaufen\./)
  assert.doesNotMatch(html, /Weiter zu deinen Produkten/)

  const tree = createHarness(() => QuizDiscoveryLeadSave(props)).render()
  findAll(tree, (element) => textOf(element) === DISCOVERY_LEAD_SAVE_COPY.retry)
    .at(-1)!
    .props.onClick()
  assert.equal(retries, 1)
})

// --- The lead step, wired ------------------------------------------------------

const discoveryUser = {
  id: "20000000-0000-4000-8000-000000000002",
  app_metadata: { discovery_enrollment_id: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e" },
}

const answers = { structure: "wavy", thickness: "fine" } as unknown as QuizAnswers

function leadStep(
  mode: LeadCaptureMode,
  user: unknown = discoveryUser,
  { runEffects = mode === "discovery" } = {},
) {
  useQuizStore.setState({
    step: 9,
    leadCaptureMode: mode,
    leadCaptureSubStep: "consent",
    lead: { name: "Lea", email: "lea@example.test", marketingConsent: false },
    answers,
    leadId: null,
    funnelPackageKey: null,
  })
  const history = {
    pushInPlaceEntry: () => {},
    registerBackHandler: () => () => {},
    requestBack: () => {},
  }
  // Discovery runs the step's real effects, so the enrollment re-check against
  // `/api/beratung/quiz-context` is part of what is under test. Regular and partner
  // keep the store as set: their context lookup is not what these tests pin.
  return createHarness(() => QuizLeadCapture(), {
    contexts: [{ user, loading: false }, null, history, router],
    runEffects,
  })
}

const router = {
  pushes: [] as string[],
  prefetches: [] as string[],
  push(href: string) {
    router.pushes.push(href)
  },
  prefetch(href: string) {
    router.prefetches.push(href)
  },
}

/** First render (effects start the context check), let it answer, render again. */
async function arrive(harness: ReturnType<typeof leadStep>) {
  harness.render()
  await settle()
  return harness.render()
}

function withBrowser(t: { after: (fn: () => void) => void }) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
  const originalFetch = globalThis.fetch
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { search: "", assign: () => {} }, scrollTo: () => {} },
  })
  router.pushes = []
  router.prefetches = []
  resetDiscoveryQuizContextPrefetchForTests()
  t.after(() => {
    globalThis.fetch = originalFetch
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow)
    else delete (globalThis as { window?: unknown }).window
    useQuizStore.getState().reset()
  })
  const requests: Array<{ url: string; body: Record<string, unknown> }> = []
  const calls: string[] = []
  type Answer = { ok: boolean; status: number; body: unknown }
  let respond: () => Answer = () => ({ ok: true, status: 200, body: { leadId: "lead-1" } })
  let context: () => Promise<Answer> = async () => ({
    ok: true,
    status: 200,
    body: { status: "participant", name: "Lea", email: "lea@example.test" },
  })
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push(url)
    const answer =
      url === "/api/beratung/quiz-context"
        ? await context()
        : (() => {
            if (url === "/api/quiz/lead") {
              requests.push({ url, body: JSON.parse(String(init?.body)) })
            }
            return respond()
          })()
    return { ok: answer.ok, status: answer.status, json: async () => answer.body } as Response
  }) as typeof fetch
  return {
    calls,
    requests,
    respondWith(next: typeof respond) {
      respond = next
    },
    contextWith(next: typeof context) {
      context = next
    },
  }
}

function endingOf(tree: ReactNode) {
  const found = ofType(tree, QuizDiscoveryLeadSave)
  assert.equal(found.length, 1, "the „Geschafft“ ending is on screen")
  return found[0]
}

test("discovery, first visit: „Geschafft“ from the very first render — never the name form", async (t) => {
  withBrowser(t)
  const harness = leadStep("discovery")
  // First visit: the store has not been switched to discovery yet.
  useQuizStore.setState({ leadCaptureMode: "regular", leadCaptureSubStep: "name" })
  const first = harness.render()
  assert.equal(endingOf(first).props.canSave, false, "the check has not answered yet")
  assert.doesNotMatch(textOf(first), /Wie heißt du\?/)
  assert.equal(ofType(first, Input).length, 0, "no autofocused name input")
  assert.equal(ofType(first, QuizConsentSheet).length, 0)

  await settle()
  const confirmed = harness.render()
  assert.equal(endingOf(confirmed).props.canSave, true)
  assert.equal(useQuizStore.getState().leadCaptureMode, "discovery")
})

test("discovery: the one lead request carries marketingConsent:false; Weiter goes to the checklist", async (t) => {
  const browser = withBrowser(t)
  const harness = leadStep("discovery")
  let tree = await arrive(harness)

  assert.equal(ofType(tree, QuizConsentSheet).length, 0, "the consent sheet is not rendered")
  assert.doesNotMatch(textOf(tree), /Dein persönlicher Pflegeplan ist bereit!/)
  assert.equal(endingOf(tree).props.saved, false)
  assert.ok(router.prefetches.includes("/beratung/produkte"), "the checklist is prefetched")

  // What the ending's arrival effect calls.
  endingOf(tree).props.onSave()
  await settle()

  assert.equal(browser.requests.length, 1)
  assert.equal(browser.requests[0].body.marketingConsent, false)
  assert.equal(browser.requests[0].body.email, "lea@example.test")
  assert.equal(useQuizStore.getState().leadId, "lead-1")
  assert.equal(useQuizStore.getState().step, 9, "no analysis step — she stays on „Geschafft“")

  tree = harness.render()
  assert.equal(endingOf(tree).props.saved, true)
  endingOf(tree).props.onContinue()
  assert.deepEqual(router.pushes, ["/beratung/produkte?lead=lead-1"])
  assert.ok(!browser.calls.includes("/api/billing/access"), "no billing access check")
  assert.ok(!browser.calls.includes("/api/quiz/result-artifact"), "no result artifact")
})

test("discovery: a failed save surfaces the error for the retry, and the retry posts again", async (t) => {
  const browser = withBrowser(t)
  browser.respondWith(() => ({ ok: false, status: 503, body: { error: "down" } }))
  const harness = leadStep("discovery")

  endingOf(await arrive(harness)).props.onSave()
  await settle()
  let saveStep = endingOf(harness.render())
  assert.equal(saveStep.props.error, "Etwas ist schiefgelaufen. Bitte versuche es erneut.")
  assert.equal(useQuizStore.getState().leadId, null, "never skipped over")
  assert.equal(useQuizStore.getState().step, 9)

  browser.respondWith(() => ({ ok: true, status: 200, body: { leadId: "lead-2" } }))
  saveStep.props.onRetry()
  await settle()
  assert.equal(browser.requests.length, 2)
  assert.equal(browser.requests[1].body.marketingConsent, false)
  assert.equal(useQuizStore.getState().leadId, "lead-2")

  // Back onto the step with the same answers: recognised as saved, not re-posted.
  saveStep = endingOf(harness.render())
  assert.equal(saveStep.props.saved, true)
  assert.equal(saveStep.props.error, "")

  // A changed answer is a new profile, so it is saved again.
  useQuizStore.setState({ answers: { ...answers, thickness: "coarse" } as QuizAnswers })
  saveStep = endingOf(harness.render())
  assert.equal(saveStep.props.saved, false)
})

test("discovery: a second visit re-checks the enrollment before the save may run", async (t) => {
  // The store kept `discovery` / `consent` from the first visit; this is a NEW mount
  // whose context check has not answered yet. „Geschafft“ shows, but the save (whose
  // effect would post the lead) is not allowed until the check answered in THIS mount.
  const browser = withBrowser(t)
  let answer: (value: { ok: boolean; status: number; body: unknown }) => void = () => {}
  browser.contextWith(() => new Promise((resolve) => (answer = resolve)))
  const harness = leadStep("discovery")

  let tree = harness.render()
  assert.equal(useQuizStore.getState().leadCaptureMode, "discovery", "retained from visit one")
  assert.equal(endingOf(tree).props.canSave, false)
  await settle()
  tree = harness.render()
  assert.equal(endingOf(tree).props.canSave, false, "still waiting for the check")
  assert.equal(browser.requests.length, 0, "no lead posted before the check")

  answer({
    ok: true,
    status: 200,
    body: { status: "participant", name: "Lea", email: "lea@example.test" },
  })
  await settle()
  tree = harness.render()
  assert.equal(endingOf(tree).props.canSave, true, "confirmed in THIS mount")
})

test("discovery: the check started on the last question is used, not repeated", async (t) => {
  const browser = withBrowser(t)
  prefetchDiscoveryQuizContext(`discovery:${discoveryUser.id}`)
  assert.equal(browser.calls.filter((url) => url === "/api/beratung/quiz-context").length, 1)
  const tree = await arrive(leadStep("discovery"))
  assert.equal(endingOf(tree).props.canSave, true)
  assert.equal(
    browser.calls.filter((url) => url === "/api/beratung/quiz-context").length,
    1,
    "the lead step consumed the prefetched answer",
  )
})

test("discovery: a failed enrollment re-check never saves, and its retry checks again", async (t) => {
  const browser = withBrowser(t)
  browser.contextWith(async () => ({ ok: false, status: 503, body: null }))
  const harness = leadStep("discovery")
  const tree = await arrive(harness)

  const ending = endingOf(tree)
  assert.equal(ending.props.canSave, false)
  assert.equal(ending.props.error, "Deine Angaben konnten gerade nicht geladen werden.")
  assert.equal(browser.requests.length, 0)

  browser.contextWith(async () => ({
    ok: true,
    status: 200,
    body: { status: "participant", name: "Lea", email: "lea@example.test" },
  }))
  ending.props.onRetry()
  harness.render()
  await settle()
  assert.equal(endingOf(harness.render()).props.canSave, true)
})

for (const mode of ["regular", "partner"] as const) {
  test(`${mode}: the consent step is unchanged — banner and open consent sheet, no auto-save`, async (t) => {
    const browser = withBrowser(t)
    const harness = leadStep(mode, mode === "partner" ? { id: "partner-user" } : null)
    const tree = harness.render()

    assert.equal(ofType(tree, QuizDiscoveryLeadSave).length, 0)
    const sheet = ofType(tree, QuizConsentSheet)
    assert.equal(sheet.length, 1)
    assert.equal(sheet[0].props.open, true)
    assert.match(textOf(tree), /Dein persönlicher Pflegeplan ist bereit!/)
    await settle()
    assert.equal(browser.requests.length, 0, "nothing is saved until the question is answered")
  })
}

test("the consent sheet's copy is pinned", () => {
  const html = renderToStaticMarkup(<QuizConsentSheet open saving={false} onConsent={() => {}} />)
  assert.match(html, /Dürfen wir dir Haarpflege-Tipps schicken\?/)
  assert.match(
    html,
    /Deine Auswertung bekommst du in jedem Fall\. Mit Ja erlaubst du zusätzliche Tipps,\s+Produkt-News und Angebote per E-Mail\./,
  )
  assert.match(html, />Ja, weiter zu meiner Auswertung</)
  assert.match(html, />Nein, nur meine Auswertung schicken</)
  assert.equal(
    getQuizFunnelCopy(null).leadCaptureHeadline,
    "Dein persönlicher Pflegeplan ist bereit!",
  )
})

// --- The regular commitment screen ---------------------------------------------

test("the regular funnel keeps its commitment screen and analysis beat", () => {
  const props = { commitPending: false, name: "Lena", onCommit: () => {}, phase: "commit" as const }
  const html = renderToStaticMarkup(<QuizAnalysisView {...props} />)
  assert.match(html, /Lena, bereit für den nächsten Schritt mit deinem Haar\?/)
  assert.match(html, />Ja, zeig mir meine Analyse</)
  assert.match(html, />Ich bin neugierig</)
  assert.doesNotMatch(html, /Geschafft/)

  const loading = renderToStaticMarkup(
    <QuizAnalysisView commitPending name="Lena" onCommit={() => {}} phase="loading" />,
  )
  assert.match(loading, /Einen Moment, Lena\./)
  assert.match(loading, /quiz-shimmer-bar/)
})
