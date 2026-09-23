import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { QuizAnalysisView } from "../src/components/quiz/quiz-analysis"
import { QuizConsentSheet } from "../src/components/quiz/quiz-consent-sheet"
import {
  DISCOVERY_LEAD_SAVE_COPY,
  QuizDiscoveryLeadSave,
} from "../src/components/quiz/quiz-discovery-lead-save"
import { QuizLeadCapture } from "../src/components/quiz/quiz-lead-capture"
import { getQuizFunnelCopy } from "../src/lib/quiz/funnel-copy"
import { useQuizStore } from "../src/lib/quiz/store"
import type { LeadCaptureMode, QuizAnswers } from "../src/lib/quiz/types"

/**
 * Field-test fix: a discovery participant is no longer asked the marketing
 * question. Her lead is saved with `marketingConsent: false` the moment the step
 * is reached — the save itself is never skipped, because the checklist's profile
 * projection is built from it — and the commitment screen after it names the
 * checklist instead of teasing an analysis.
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
 * reads exactly three: `useAuth`, `useQuizFunnelPackageKey`, `useQuizBrowserBack`.
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

// --- The lead-save step on its own ---------------------------------------------

function leadSave(props: Partial<Parameters<typeof QuizDiscoveryLeadSave>[0]>) {
  return {
    alreadySaved: false,
    error: "",
    onContinue: () => {},
    onSave: () => {},
    saving: false,
    ...props,
  }
}

test("the step saves the lead exactly once, however often it re-renders", () => {
  let saves = 0
  const harness = createHarness(() =>
    // A fresh `onSave` per render, exactly like the lead step's inline arrow.
    QuizDiscoveryLeadSave(leadSave({ onSave: () => (saves += 1), saving: saves > 0 })),
  )
  harness.render()
  harness.render()
  harness.replayEffects()
  harness.render()
  assert.equal(saves, 1)
})

test("while saving it shows only a quiet status — no consent question, no buttons", () => {
  const html = renderToStaticMarkup(<QuizDiscoveryLeadSave {...leadSave({ saving: true })} />)
  assert.match(html, /role="status"/)
  assert.match(html, /Dein Haarprofil wird gespeichert …/)
  assert.doesNotMatch(html, /<button/)
  assert.doesNotMatch(html, /Dürfen wir|Haarpflege-Tipps|Auswertung|Analyse/)
})

test("a failed save stays on screen with a retry that saves again", () => {
  let saves = 0
  const props = leadSave({
    error: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
    onSave: () => (saves += 1),
  })
  const html = renderToStaticMarkup(<QuizDiscoveryLeadSave {...props} />)
  assert.match(html, /role="alert"/)
  assert.match(html, /Etwas ist schiefgelaufen\. Bitte versuche es erneut\./)
  assert.match(html, />Erneut versuchen</)

  const harness = createHarness(() => QuizDiscoveryLeadSave(props))
  const tree = harness.render()
  assert.equal(saves, 1, "the arrival save")
  const retry = findAll(tree, (element) => textOf(element) === DISCOVERY_LEAD_SAVE_COPY.retry)
  retry.at(-1)!.props.onClick()
  assert.equal(saves, 2, "the participant's own retry")
})

test("Back onto a step whose lead is already saved does not post again", () => {
  let saves = 0
  let continued = 0
  const harness = createHarness(() =>
    QuizDiscoveryLeadSave(
      leadSave({
        alreadySaved: true,
        onSave: () => (saves += 1),
        onContinue: () => (continued += 1),
      }),
    ),
  )
  const tree = harness.render()
  assert.equal(saves, 0)
  assert.match(textOf(tree), /Dein Haarprofil ist gespeichert\./)
  findAll(tree, (element) => textOf(element) === "Weiter")
    .at(-1)!
    .props.onClick()
  assert.equal(continued, 1)
})

// --- The lead step, wired ------------------------------------------------------

const discoveryUser = {
  id: "20000000-0000-4000-8000-000000000002",
  app_metadata: { discovery_enrollment_id: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e" },
}

const answers = { structure: "wavy", thickness: "fine" } as unknown as QuizAnswers

function leadStep(mode: LeadCaptureMode, user: unknown = discoveryUser) {
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
  // The lead step's own effects (context lookup, focus) are not what is under test:
  // the store is set to the state that lookup would have produced.
  return createHarness(() => QuizLeadCapture(), {
    contexts: [{ user, loading: false }, null, history],
    runEffects: false,
  })
}

function withBrowser(t: { after: (fn: () => void) => void }) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
  const originalFetch = globalThis.fetch
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { search: "", assign: () => {} }, scrollTo: () => {} },
  })
  t.after(() => {
    globalThis.fetch = originalFetch
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow)
    else delete (globalThis as { window?: unknown }).window
    useQuizStore.getState().reset()
  })
  const requests: Array<{ url: string; body: Record<string, unknown> }> = []
  let respond: () => { ok: boolean; status: number; body: unknown } = () => ({
    ok: true,
    status: 200,
    body: { leadId: "lead-1" },
  })
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === "/api/quiz/lead") {
      requests.push({ url, body: JSON.parse(String(init?.body)) })
    }
    const answer = respond()
    return { ok: answer.ok, status: answer.status, json: async () => answer.body } as Response
  }) as typeof fetch
  return {
    requests,
    respondWith(next: typeof respond) {
      respond = next
    },
  }
}

test("discovery: no consent UI, and the one lead request carries marketingConsent:false", async (t) => {
  const browser = withBrowser(t)
  const harness = leadStep("discovery")
  const tree = harness.render()

  assert.equal(ofType(tree, QuizConsentSheet).length, 0, "the consent sheet is not rendered")
  assert.doesNotMatch(textOf(tree), /Dein persönlicher Pflegeplan ist bereit!/)
  const saveStep = ofType(tree, QuizDiscoveryLeadSave)
  assert.equal(saveStep.length, 1)
  assert.equal(saveStep[0].props.alreadySaved, false)

  // What the step's arrival effect calls.
  saveStep[0].props.onSave()
  await settle()

  assert.equal(browser.requests.length, 1)
  assert.equal(browser.requests[0].body.marketingConsent, false)
  assert.equal(browser.requests[0].body.email, "lea@example.test")
  assert.equal(useQuizStore.getState().leadId, "lead-1")
  assert.equal(useQuizStore.getState().step, 10, "on to the commitment screen")
})

test("discovery: a failed save surfaces the error for the retry, and the retry posts again", async (t) => {
  const browser = withBrowser(t)
  browser.respondWith(() => ({ ok: false, status: 503, body: { error: "down" } }))
  const harness = leadStep("discovery")

  ofType(harness.render(), QuizDiscoveryLeadSave)[0].props.onSave()
  await settle()
  let saveStep = ofType(harness.render(), QuizDiscoveryLeadSave)[0]
  assert.equal(saveStep.props.saving, false)
  assert.equal(saveStep.props.error, "Etwas ist schiefgelaufen. Bitte versuche es erneut.")
  assert.equal(useQuizStore.getState().leadId, null, "never skipped over")
  assert.equal(useQuizStore.getState().step, 9)

  browser.respondWith(() => ({ ok: true, status: 200, body: { leadId: "lead-2" } }))
  saveStep.props.onSave()
  await settle()
  assert.equal(browser.requests.length, 2)
  assert.equal(browser.requests[1].body.marketingConsent, false)
  assert.equal(useQuizStore.getState().leadId, "lead-2")

  // Back onto the step with the same answers: recognised as saved, not re-posted.
  useQuizStore.setState({ step: 9 })
  saveStep = ofType(harness.render(), QuizDiscoveryLeadSave)[0]
  assert.equal(saveStep.props.alreadySaved, true)

  // A changed answer is a new profile, so it is saved again.
  useQuizStore.setState({ answers: { ...answers, thickness: "coarse" } as QuizAnswers })
  saveStep = ofType(harness.render(), QuizDiscoveryLeadSave)[0]
  assert.equal(saveStep.props.alreadySaved, false)
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

// --- The commitment screen -----------------------------------------------------

test("discovery commitment names the checklist — one CTA, no analysis teaser", () => {
  const html = renderToStaticMarkup(
    <QuizAnalysisView
      commitPending={false}
      discoveryParticipant
      name="Lea"
      onCommit={() => {}}
      phase="commit"
    />,
  )
  assert.match(html, /Geschafft — dein Haarprofil steht\./)
  assert.match(html, /Jetzt noch deine Produkte\. Dauert 5 Minuten\./)
  assert.match(html, />Weiter zu deinen Produkten</)
  assert.equal((html.match(/<button/g) ?? []).length, 1)
  assert.doesNotMatch(html, /Analyse|Auswertung|neugierig|bereit für den nächsten Schritt/)
})

test("discovery loading beat keeps the machinery but not the analysis wording", () => {
  const html = renderToStaticMarkup(
    <QuizAnalysisView
      commitPending
      discoveryParticipant
      name="Lea"
      onCommit={() => {}}
      phase="loading"
    />,
  )
  assert.match(html, /Einen Moment, Lea\./)
  assert.match(html, /Gleich geht’s zu deinen Produkten\./)
  assert.match(html, /quiz-shimmer-bar/)
  assert.doesNotMatch(html, /Analyse|Auswertung/)
})

test("the discovery CTA commits exactly like the regular one", () => {
  const choices: string[] = []
  const harness = createHarness(() =>
    QuizAnalysisView({
      commitPending: false,
      discoveryParticipant: true,
      name: "Lea",
      onCommit: (choice) => choices.push(choice),
      phase: "commit",
    }),
  )
  const tree = harness.render()
  findAll(tree, (element) => element.type === "button")[0].props.onClick()
  assert.deepEqual(choices, ["ja"])
})

test("without the flag the commitment screen is byte-identical to the regular one", () => {
  const props = { commitPending: false, name: "Lena", onCommit: () => {}, phase: "commit" as const }
  assert.equal(
    renderToStaticMarkup(<QuizAnalysisView {...props} discoveryParticipant={false} />),
    renderToStaticMarkup(<QuizAnalysisView {...props} />),
  )
  const html = renderToStaticMarkup(<QuizAnalysisView {...props} />)
  assert.match(html, /Lena, bereit für den nächsten Schritt mit deinem Haar\?/)
  assert.match(html, />Ja, zeig mir meine Analyse</)
  assert.match(html, />Ich bin neugierig</)
})
