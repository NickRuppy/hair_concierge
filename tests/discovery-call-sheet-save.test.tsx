import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"

import {
  DiscoveryRunsheetBrief,
  RUNSHEET_GENERATE_COPY,
  RunsheetGenerateBar,
  addRunsheetCommitment,
  applyGeneratedRunsheetBrief,
  runsheetBriefPatch,
  runsheetExpectedBriefState,
  runsheetGenerateError,
  runsheetReplaceWarning,
  type RunsheetBriefState,
} from "../src/components/discovery/cockpit/runsheet-brief"
import {
  DiscoveryRunsheetFollowUp,
  runsheetFollowUpPatch,
} from "../src/components/discovery/cockpit/runsheet-follow-up"
import {
  RUNSHEET_SAVE_COPY,
  RunsheetSaveBar,
  discoveryCallSheetWriteOutcome,
} from "../src/components/discovery/cockpit/runsheet-save"
import type {
  DiscoveryCallSheet,
  DiscoveryCallSheetBriefSections,
} from "../src/lib/discovery/call-sheet"

/**
 * The runsheet's two save handlers (consult-runsheet T5): what each island PATCHes, and how
 * it re-syncs after the refresh.
 *
 * No jsdom in this repo: the islands are called directly under a hand-rolled hook dispatcher
 * (the `tests/discovery-quiz-lead-save.test.tsx` family), their element trees walked, and
 * their handlers invoked as a tap would. Child components are never invoked, so the save bar
 * shows up as the element the island hands its props to.
 */

type AnyElement = ReactElement<Record<string, any>>
type ReactDispatcherInternals = { H: unknown }

function childrenOf(node: ReactNode): ReactNode[] {
  if (!React.isValidElement(node)) return []
  return React.Children.toArray((node as ReactElement<{ children?: ReactNode }>).props.children)
}

function findAll(node: ReactNode, predicate: (element: AnyElement) => boolean): AnyElement[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, predicate))
  if (!React.isValidElement(node)) return []
  const element = node as AnyElement
  const props = element.props as Record<string, unknown>
  // Slots (ReactNode props) are walked too.
  const slots = Object.entries(props)
    .filter(([key, value]) => key !== "children" && React.isValidElement(value))
    .map(([, value]) => value as ReactNode)
  return [
    ...(predicate(element) ? [element] : []),
    ...childrenOf(element).flatMap((child) => findAll(child, predicate)),
    ...slots.flatMap((slot) => findAll(slot, predicate)),
  ]
}

function byId(tree: ReactNode, id: string): AnyElement {
  const [element] = findAll(tree, (candidate) => candidate.props.id === id)
  assert.ok(element, `no element #${id}`)
  return element!
}

function saveBar(tree: ReactNode): AnyElement {
  const [bar] = findAll(tree, (element) => element.type === RunsheetSaveBar)
  assert.ok(bar, "no save bar")
  return bar!
}

function createHarness(render: () => ReactElement | null, router: unknown) {
  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const values: unknown[] = []
  let cursor = 0

  const dispatcher = {
    useContext() {
      return router
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
  }

  return function renderOnce(): ReactElement | null {
    const previous = internals.H
    internals.H = dispatcher
    try {
      // A render that sets state re-renders, as React does for „adjust state while rendering".
      let tree: ReactElement | null = null
      for (let pass = 0; pass < 3; pass += 1) {
        cursor = 0
        const before = JSON.stringify(values)
        tree = render()
        if (JSON.stringify(values) === before) break
      }
      return tree
    } finally {
      internals.H = previous
    }
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

type FetchCall = { url: string; method: string; body: unknown }

function stubFetch(respond: (call: FetchCall) => { status: number; body: unknown }) {
  const calls: FetchCall[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const call = { url, method: init.method ?? "GET", body: JSON.parse(String(init.body)) }
    calls.push(call)
    const { status, body } = respond(call)
    return new Response(JSON.stringify(body), { status })
  }) as typeof fetch
  return { calls, restore: () => (globalThis.fetch = original) }
}

function fakeRouter() {
  let refreshes = 0
  return {
    router: { refresh: () => (refreshes += 1) },
    refreshes: () => refreshes,
  }
}

const ENROLLMENT = "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e"

// Stored order = the model's impact ranking (Umgang first); the island DISPLAYS Produkte
// before Umgang, so the display/save order differs from this array.
// `zielLuecken` is the pre-v4 field: never shown or edited, but it must survive a save.
const sections: DiscoveryCallSheetBriefSections = {
  mechanik: "Trockene Längen entstehen meist durch Hitze und Reibung.",
  diagnose: "Feines Haar.",
  hebel: [
    { title: "Schaden stoppen", note: "Hitzeschutz", points: 2, bucket: "umgang" },
    { title: "Mildes Shampoo", note: "Sanftwerk statt Glanzwerk", points: 1, bucket: "produkt" },
  ],
  swapReasons: { "decision:shampoo:shampoo_everyday:gap": "Zu reichhaltig." },
  zielLuecken: ["Kein Hitzeschutz"],
  callFragen: ["Wie oft glättest du?"],
  erwartungen: ["Erste Wirkung nach 4 Wochen"],
}

const recipeHabits = [
  { id: "recipe:dryness:nicht-taeglich-waschen", label: "Nicht täglich waschen" },
  { id: "recipe:dryness:hitzeschutz-immer", label: "Hitzeschutz immer" },
]

function briefProps(overrides: Record<string, unknown> = {}) {
  return {
    enrollmentId: ENROLLMENT,
    initialBaseline: 4,
    initialSections: sections,
    initialBriefMeta: {
      generatedAt: "2026-09-27T10:00:00.000Z",
      sourceHash: "abc123",
      generatedBy: "agent",
      savedAt: "2026-09-27T10:00:00.000Z",
    },
    initialCommitments: [],
    recipeHabits,
    checklist: [],
    askTopics: [],
    ...overrides,
  } as Parameters<typeof DiscoveryRunsheetBrief>[0]
}

// --- the brief ---------------------------------------------------------------------------

test("brief save: PATCHes score, the edited brief (Mechanik, bucketed Hebel, stored zielLuecken carried through), and the commitments", async () => {
  const { router, refreshes } = fakeRouter()
  const props = briefProps()
  const render = createHarness(() => DiscoveryRunsheetBrief(props), router)
  const fetchStub = stubFetch(() => ({ status: 200, body: { callSheet: {} } }))
  try {
    let tree = render()
    assert.equal(saveBar(tree).props.dirty, false, "nothing to save before an edit")

    byId(tree, "runsheet-baseline-score").props.onChange({ target: { value: "5" } })
    tree = render()
    byId(tree, "runsheet-hebel-s0-0-points").props.onChange({ target: { value: "1,5" } })
    tree = render()
    byId(tree, "runsheet-habit-recipe--dryness--hitzeschutz-immer").props.onChange({
      target: { checked: true },
    })
    tree = render()
    assert.equal(saveBar(tree).props.dirty, true)

    saveBar(tree).props.onSave()
    await settle()

    assert.equal(fetchStub.calls.length, 1)
    const [call] = fetchStub.calls
    assert.equal(call!.url, `/api/admin/beratung/${ENROLLMENT}/call-sheet`)
    assert.equal(call!.method, "PATCH")
    assert.deepEqual(call!.body, {
      baseline_score: 5,
      consult_brief: {
        sections: {
          ...sections,
          // Display order (Produkte, then Umgang), with each row's bucket; zielLuecken
          // comes through the spread untouched.
          hebel: [
            {
              title: "Mildes Shampoo",
              note: "Sanftwerk statt Glanzwerk",
              points: 1,
              bucket: "produkt",
            },
            { title: "Schaden stoppen", note: "Hitzeschutz", points: 1.5, bucket: "umgang" },
          ],
        },
        generated_at: "2026-09-27T10:00:00.000Z",
        generated_by: "manual",
        source_hash: "abc123",
      },
      habit_commitments: [
        {
          id: "recipe:dryness:nicht-taeglich-waschen",
          label: "Nicht täglich waschen",
          committed: false,
        },
        { id: "recipe:dryness:hitzeschutz-immer", label: "Hitzeschutz immer", committed: true },
      ],
    })

    tree = render()
    assert.equal(saveBar(tree).props.dirty, false)
    assert.equal(saveBar(tree).props.status, "saved")
    assert.equal(refreshes(), 1)
  } finally {
    fetchStub.restore()
  }
})

test("brief re-sync: new server props re-seed a clean island, never one with unsaved edits", () => {
  const { router } = fakeRouter()
  let props = briefProps()
  const render = createHarness(() => DiscoveryRunsheetBrief(props), router)
  let tree = render()

  // Clean: a newer stored brief (e.g. after a refresh) shows up.
  props = briefProps({ initialSections: { ...sections, diagnose: "Neu gespeichert." } })
  tree = render()
  assert.equal(byId(tree, "runsheet-diagnose").props.value, "Neu gespeichert.")
  assert.equal(saveBar(tree).props.dirty, false)

  // Dirty: a refresh (e.g. from a decision write) must not wipe what is not saved yet.
  byId(tree, "runsheet-diagnose").props.onChange({ target: { value: "Getippt, ungespeichert." } })
  tree = render()
  props = briefProps({ initialSections: { ...sections, diagnose: "Anderer Stand." } })
  tree = render()
  assert.equal(byId(tree, "runsheet-diagnose").props.value, "Getippt, ungespeichert.")
  assert.equal(saveBar(tree).props.dirty, true)
})

test("brief save: an invalid score is refused in the island — nothing is sent", async () => {
  const { router } = fakeRouter()
  const render = createHarness(() => DiscoveryRunsheetBrief(briefProps()), router)
  const fetchStub = stubFetch(() => ({ status: 200, body: { callSheet: {} } }))
  try {
    let tree = render()
    byId(tree, "runsheet-baseline-score").props.onChange({ target: { value: "11" } })
    tree = render()
    saveBar(tree).props.onSave()
    await settle()
    tree = render()
    assert.equal(fetchStub.calls.length, 0)
    assert.equal(saveBar(tree).props.status, "error")
    assert.match(saveBar(tree).props.message, /ganze Zahl von 1 bis 10/)
  } finally {
    fetchStub.restore()
  }
})

test("brief save: a refused write stays unsaved with the German error line", async () => {
  const { router, refreshes } = fakeRouter()
  const render = createHarness(() => DiscoveryRunsheetBrief(briefProps()), router)
  const fetchStub = stubFetch(() => ({ status: 503, body: { code: "unavailable" } }))
  try {
    let tree = render()
    byId(tree, "runsheet-diagnose").props.onChange({ target: { value: "Neu." } })
    tree = render()
    saveBar(tree).props.onSave()
    await settle()
    tree = render()
    assert.equal(saveBar(tree).props.status, "error")
    assert.equal(saveBar(tree).props.message, RUNSHEET_SAVE_COPY.failed)
    assert.equal(saveBar(tree).props.dirty, true)
    assert.equal(refreshes(), 0)
  } finally {
    fetchStub.restore()
  }
})

test("hebel rows keep their DOM ids when a row above is removed", () => {
  const { router } = fakeRouter()
  const props = briefProps({
    initialSections: {
      ...sections,
      hebel: [
        { title: "Eins", note: "", points: 1, bucket: "produkt" },
        { title: "Zwei", note: "", points: 2, bucket: "produkt" },
      ],
    },
  })
  const render = createHarness(() => DiscoveryRunsheetBrief(props), router)
  let tree = render()
  assert.equal(byId(tree, "runsheet-hebel-s0-1-title").props.value, "Zwei")
  const [removeFirst] = findAll(
    tree,
    (element) => element.type === "button" && element.props.children === "Entfernen",
  )
  removeFirst!.props.onClick()
  tree = render()
  assert.equal(byId(tree, "runsheet-hebel-s0-1-title").props.value, "Zwei")
  assert.equal(
    findAll(tree, (element) => element.props.id === "runsheet-hebel-s0-0-title").length,
    0,
  )
})

test("brief patch: empty score clears it, German decimals parse, bad points are refused", () => {
  const state: RunsheetBriefState = {
    baselineText: " ",
    mechanik: "M",
    diagnose: "x",
    hebel: [{ uid: "a", title: "T", note: "N", points: "0,5", bucket: "umgang" }],
    lists: { callFragen: [], erwartungen: [] },
    commitments: [],
  }
  const meta = { sections, generatedAt: null, sourceHash: null }
  const built = runsheetBriefPatch(state, meta)
  assert.ok("patch" in built)
  assert.equal(built.patch.baseline_score, null)
  assert.deepEqual(built.patch.consult_brief!.sections.hebel, [
    { title: "T", note: "N", points: 0.5, bucket: "umgang" },
  ])
  assert.equal(built.patch.consult_brief!.sections.mechanik, "M")
  // zielLuecken is not edited any more: the stored lines ride along via the spread.
  assert.deepEqual(built.patch.consult_brief!.sections.zielLuecken, ["Kein Hitzeschutz"])
  assert.equal(built.patch.consult_brief!.generated_by, "manual")

  const bad = runsheetBriefPatch(
    { ...state, hebel: [{ ...state.hebel[0]!, points: "viel" }] },
    meta,
  )
  assert.ok("invalid" in bad)
})

test("a manual commitment is identified by its wording; the same wording again ticks it", () => {
  const once = addRunsheetCommitment([], "  Seidenkissen ")
  assert.deepEqual(once, [{ id: "manual:seidenkissen", label: "Seidenkissen", committed: true }])
  const unticked = [{ ...once[0]!, committed: false }]
  assert.deepEqual(addRunsheetCommitment(unticked, "seidenkissen"), once)
  // A recipe habit of the same wording is ticked, not duplicated.
  const recipe = [
    { id: "recipe:dryness:hitzeschutz-immer", label: "Hitzeschutz immer", committed: false },
  ]
  assert.deepEqual(addRunsheetCommitment(recipe, "Hitzeschutz immer"), [
    { ...recipe[0]!, committed: true },
  ])
})

// --- generating the brief (consult-agent T4) ------------------------------------------------

function generateBar(tree: ReactNode): AnyElement {
  const [bar] = findAll(tree, (element) => element.type === RunsheetGenerateBar)
  assert.ok(bar, "no generate bar")
  return bar!
}

const GENERATED_AT = "2026-09-28T08:00:00.000Z"
const generatedSections: DiscoveryCallSheetBriefSections = {
  ...sections,
  mechanik: "Generierte Mechanik.",
  diagnose: "Generierte Diagnose.",
  hebel: [{ title: "Generierter Hebel", note: "Neu", points: 1, bucket: "produkt" }],
  // Code-owned since v4: a generation always stores no gaps.
  zielLuecken: [],
}

function generatedSheet(overrides: Partial<DiscoveryCallSheet> = {}): DiscoveryCallSheet {
  return {
    baselineScore: 4,
    rescores: [],
    touchpoints: [],
    consultBrief: {
      sections: generatedSections,
      generated_at: GENERATED_AT,
      generated_by: "agent",
      source_hash: "fresh-hash",
      saved_at: "2026-09-28T08:00:00.000Z",
      previous: {
        sections,
        generated_at: "2026-09-27T10:00:00.000Z",
        generated_by: "agent",
        source_hash: "abc123",
      },
    },
    habitCommitments: [],
    complexity: null,
    feedback: null,
    ...overrides,
  }
}

const generated = () => ({
  status: 200,
  body: { callSheet: generatedSheet(), sourceHash: "fresh-hash" },
})

const GENERATE_URL = `/api/admin/beratung/${ENROLLMENT}/consult-brief`

test("generate: POSTs expected_state of the loaded brief and takes the new brief as synced state", async () => {
  const { router, refreshes } = fakeRouter()
  const render = createHarness(() => DiscoveryRunsheetBrief(briefProps()), router)
  const fetchStub = stubFetch(generated)
  try {
    let tree = render()
    assert.equal(generateBar(tree).props.label, RUNSHEET_GENERATE_COPY.regenerate)
    generateBar(tree).props.onGenerate()
    tree = render()
    assert.equal(generateBar(tree).props.ui.phase, "pending")
    await settle()

    assert.equal(fetchStub.calls.length, 1)
    assert.equal(fetchStub.calls[0]!.url, GENERATE_URL)
    assert.equal(fetchStub.calls[0]!.method, "POST")
    assert.deepEqual(fetchStub.calls[0]!.body, {
      expected_state: {
        source_hash: "abc123",
        generated_at: "2026-09-27T10:00:00.000Z",
        saved_at: "2026-09-27T10:00:00.000Z",
      },
    })

    tree = render()
    assert.equal(byId(tree, "runsheet-mechanik").props.value, "Generierte Mechanik.")
    assert.equal(byId(tree, "runsheet-diagnose").props.value, "Generierte Diagnose.")
    assert.equal(byId(tree, "runsheet-hebel-g0-0-title").props.value, "Generierter Hebel")
    assert.equal(saveBar(tree).props.dirty, false)
    assert.deepEqual(generateBar(tree).props.ui, {
      phase: "done",
      text: RUNSHEET_GENERATE_COPY.done,
    })
    assert.equal(refreshes(), 1)

    // The refresh brings the same brief as props: nothing changes, nothing turns dirty.
    // A later manual save carries the generated meta (the stale check keeps working).
    byId(tree, "runsheet-diagnose").props.onChange({ target: { value: "Nachgeschärft." } })
    tree = render()
    const saveStub = stubFetch(() => ({ status: 200, body: { callSheet: {} } }))
    try {
      saveBar(tree).props.onSave()
      await settle()
      const brief = (saveStub.calls[0]!.body as { consult_brief: Record<string, unknown> })
        .consult_brief
      assert.equal(brief.generated_at, GENERATED_AT)
      assert.equal(brief.source_hash, "fresh-hash")
      assert.equal(brief.generated_by, "manual")
      assert.deepEqual((brief.sections as DiscoveryCallSheetBriefSections).hebel, [
        { title: "Generierter Hebel", note: "Neu", points: 1, bucket: "produkt" },
      ])
      assert.equal(
        (brief.sections as DiscoveryCallSheetBriefSections).mechanik,
        "Generierte Mechanik.",
      )
      assert.ok(!("previous" in brief), "a manual save never sends the revision")
    } finally {
      saveStub.restore()
    }
  } finally {
    fetchStub.restore()
  }
})

test("generate: the refresh after it re-syncs to the same brief — no flicker, nothing dirty", async () => {
  const { router } = fakeRouter()
  let props = briefProps({ currentSourceHash: "fresh-hash" })
  const render = createHarness(() => DiscoveryRunsheetBrief(props), router)
  const fetchStub = stubFetch(generated)
  try {
    let tree = render()
    generateBar(tree).props.onGenerate()
    await settle()
    tree = render()
    props = briefProps({
      initialSections: generatedSections,
      initialBriefMeta: {
        generatedAt: GENERATED_AT,
        sourceHash: "fresh-hash",
        generatedBy: "agent",
        savedAt: "2026-09-28T08:00:00.000Z",
      },
      currentSourceHash: "fresh-hash",
    })
    tree = render()
    assert.equal(byId(tree, "runsheet-diagnose").props.value, "Generierte Diagnose.")
    assert.equal(byId(tree, "runsheet-hebel-g0-0-title").props.value, "Generierter Hebel")
    assert.equal(saveBar(tree).props.dirty, false)
    assert.equal(generateBar(tree).props.stale, false)
  } finally {
    fetchStub.restore()
  }
})

test("generate: a legacy enrollment without a brief says „Brief erstellen“ and expects none", async () => {
  const { router } = fakeRouter()
  const props = briefProps({
    initialBaseline: null,
    initialSections: {
      mechanik: "",
      diagnose: "",
      hebel: [],
      swapReasons: {},
      zielLuecken: [],
      callFragen: [],
      erwartungen: [],
    },
    initialBriefMeta: { generatedAt: null, sourceHash: null, generatedBy: null, savedAt: null },
  })
  const render = createHarness(() => DiscoveryRunsheetBrief(props), router)
  const fetchStub = stubFetch(generated)
  try {
    let tree = render()
    assert.equal(generateBar(tree).props.label, RUNSHEET_GENERATE_COPY.create)
    assert.equal(generateBar(tree).props.stale, false)
    generateBar(tree).props.onGenerate()
    await settle()
    assert.deepEqual(fetchStub.calls[0]!.body, { expected_state: null })
    tree = render()
    assert.equal(byId(tree, "runsheet-diagnose").props.value, "Generierte Diagnose.")
    assert.equal(generateBar(tree).props.label, RUNSHEET_GENERATE_COPY.regenerate)
  } finally {
    fetchStub.restore()
  }
})

test("generate: 409 asks before overwriting, then retries with force and the same expected_state", async () => {
  const { router, refreshes } = fakeRouter()
  const render = createHarness(() => DiscoveryRunsheetBrief(briefProps()), router)
  const fetchStub = stubFetch((call) =>
    (call.body as { force?: boolean }).force
      ? generated()
      : {
          status: 409,
          body: {
            code: "brief_conflict",
            message: "Der Brief wurde inzwischen geändert.",
            current: { source_hash: "other", generated_at: "x", generated_by: "agent" },
          },
        },
  )
  try {
    let tree = render()
    generateBar(tree).props.onGenerate()
    await settle()
    tree = render()
    assert.deepEqual(generateBar(tree).props.ui, { phase: "confirm_conflict" })
    // Nothing replaced while she decides.
    assert.equal(byId(tree, "runsheet-diagnose").props.value, "Feines Haar.")

    generateBar(tree).props.onConfirm()
    await settle()
    assert.equal(fetchStub.calls.length, 2)
    assert.deepEqual(fetchStub.calls[1]!.body, {
      expected_state: {
        source_hash: "abc123",
        generated_at: "2026-09-27T10:00:00.000Z",
        saved_at: "2026-09-27T10:00:00.000Z",
      },
      force: true,
    })
    tree = render()
    assert.equal(byId(tree, "runsheet-diagnose").props.value, "Generierte Diagnose.")
    assert.equal(refreshes(), 1)
  } finally {
    fetchStub.restore()
  }
})

test("generate: cancelling the 409 sends nothing more and refreshes to show the newer brief", async () => {
  const { router, refreshes } = fakeRouter()
  const render = createHarness(() => DiscoveryRunsheetBrief(briefProps()), router)
  const fetchStub = stubFetch(() => ({ status: 409, body: { code: "brief_conflict" } }))
  try {
    let tree = render()
    generateBar(tree).props.onGenerate()
    await settle()
    tree = render()
    generateBar(tree).props.onCancel()
    tree = render()
    assert.equal(fetchStub.calls.length, 1)
    assert.deepEqual(generateBar(tree).props.ui, { phase: "idle" })
    assert.equal(refreshes(), 1)
  } finally {
    fetchStub.restore()
  }
})

test("generate (R15): a hand-edited brief asks before any request; cancel sends nothing", async () => {
  const { router } = fakeRouter()
  const props = briefProps({
    initialBriefMeta: {
      generatedAt: "2026-09-27T10:00:00.000Z",
      sourceHash: "abc123",
      generatedBy: "manual",
      savedAt: "2026-09-27T10:00:00.000Z",
    },
  })
  const render = createHarness(() => DiscoveryRunsheetBrief(props), router)
  const fetchStub = stubFetch(generated)
  try {
    let tree = render()
    generateBar(tree).props.onGenerate()
    await settle()
    tree = render()
    assert.equal(fetchStub.calls.length, 0)
    assert.deepEqual(generateBar(tree).props.ui, {
      phase: "confirm_replace",
      text: `${RUNSHEET_GENERATE_COPY.replaceManual} ${RUNSHEET_GENERATE_COPY.keptAsRevision}`,
    })
    generateBar(tree).props.onCancel()
    tree = render()
    assert.equal(fetchStub.calls.length, 0)

    generateBar(tree).props.onGenerate()
    tree = render()
    generateBar(tree).props.onConfirm()
    await settle()
    assert.equal(fetchStub.calls.length, 1)
    tree = render()
    assert.equal(byId(tree, "runsheet-diagnose").props.value, "Generierte Diagnose.")
  } finally {
    fetchStub.restore()
  }
})

test("generate (R15): unsaved Diagnose edits ask first; score/Gewohnheiten edits do not and survive", async () => {
  const { router } = fakeRouter()
  const render = createHarness(() => DiscoveryRunsheetBrief(briefProps()), router)
  const fetchStub = stubFetch(generated)
  try {
    let tree = render()
    // Score only: no warning, the request goes out, and the typed score stays (unsaved).
    byId(tree, "runsheet-baseline-score").props.onChange({ target: { value: "6" } })
    tree = render()
    generateBar(tree).props.onGenerate()
    await settle()
    assert.equal(fetchStub.calls.length, 1)
    tree = render()
    assert.equal(byId(tree, "runsheet-baseline-score").props.value, "6")
    assert.equal(byId(tree, "runsheet-diagnose").props.value, "Generierte Diagnose.")
    assert.equal(saveBar(tree).props.dirty, true, "the score edit is still unsaved")

    // Diagnose edited: warn first.
    byId(tree, "runsheet-diagnose").props.onChange({ target: { value: "Getippt." } })
    tree = render()
    generateBar(tree).props.onGenerate()
    tree = render()
    assert.equal(fetchStub.calls.length, 1)
    assert.deepEqual(generateBar(tree).props.ui, {
      phase: "confirm_replace",
      text: `${RUNSHEET_GENERATE_COPY.replaceDirty} ${RUNSHEET_GENERATE_COPY.keptAsRevision}`,
    })
  } finally {
    fetchStub.restore()
  }
})

test("generate: Diagnose typed while the request ran is kept (unsaved), never overwritten", async () => {
  const { router } = fakeRouter()
  const render = createHarness(() => DiscoveryRunsheetBrief(briefProps()), router)
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => (release = resolve))
  const original = globalThis.fetch
  globalThis.fetch = (async () => {
    await gate
    return new Response(JSON.stringify(generated().body), { status: 200 })
  }) as typeof fetch
  try {
    let tree = render()
    generateBar(tree).props.onGenerate()
    tree = render()
    byId(tree, "runsheet-diagnose").props.onChange({ target: { value: "Während getippt." } })
    tree = render()
    release()
    await settle()
    await settle()
    tree = render()
    assert.equal(byId(tree, "runsheet-diagnose").props.value, "Während getippt.")
    assert.equal(saveBar(tree).props.dirty, true)
    assert.deepEqual(generateBar(tree).props.ui, {
      phase: "done",
      text: RUNSHEET_GENERATE_COPY.doneKeptEdits,
    })
  } finally {
    globalThis.fetch = original
  }
})

test("generate: „Speichern“ is paused while the request runs; it works again after success and after an error", async () => {
  for (const outcome of ["success", "error"] as const) {
    const { router } = fakeRouter()
    const render = createHarness(() => DiscoveryRunsheetBrief(briefProps()), router)
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    const calls: Array<{ url: string; method: string }> = []
    const original = globalThis.fetch
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method ?? "GET" })
      if (url === GENERATE_URL) {
        await gate
        return outcome === "success"
          ? new Response(JSON.stringify(generated().body), { status: 200 })
          : new Response(JSON.stringify({ code: "brief_generation_failed" }), { status: 502 })
      }
      return new Response(JSON.stringify({ callSheet: {} }), { status: 200 })
    }) as typeof fetch
    try {
      let tree = render()
      byId(tree, "runsheet-baseline-score").props.onChange({ target: { value: "6" } })
      tree = render()
      generateBar(tree).props.onGenerate()
      tree = render()
      assert.equal(saveBar(tree).props.pausedHint, RUNSHEET_GENERATE_COPY.savePaused)
      assert.equal(saveBar(tree).props.dirty, true)
      saveBar(tree).props.onSave()
      await settle()
      assert.deepEqual(
        calls.map((call) => call.method),
        ["POST"],
        `${outcome}: no PATCH while generating`,
      )

      release()
      await settle()
      await settle()
      tree = render()
      assert.equal(saveBar(tree).props.pausedHint, null, `${outcome}: save unpaused`)
      saveBar(tree).props.onSave()
      await settle()
      assert.deepEqual(
        calls.map((call) => call.method),
        ["POST", "PATCH"],
        `${outcome}: saving works again`,
      )
    } finally {
      globalThis.fetch = original
    }
  }
})

test("save bar: a paused hint disables the button and names why", () => {
  const bar = RunsheetSaveBar({
    id: "x",
    scope: "s",
    dirty: true,
    status: "idle",
    message: null,
    locked: false,
    pausedHint: "Brief wird erstellt …",
    onSave: () => {},
  })
  const [button] = findAll(bar, (element) => element.type === "button")
  assert.equal(button!.props.disabled, true)
  const [line] = findAll(bar, (element) => element.props.role === "status")
  assert.equal(line!.props.children, "Brief wird erstellt …")
})

test("generate: refusals show the German line and keep every edit and the stored brief", async () => {
  const { router, refreshes } = fakeRouter()
  const cases: Array<{ status: number; body: unknown; expected: string }> = [
    {
      status: 422,
      body: {
        code: "brief_lint_failed",
        message: "Der erstellte Brief verstößt gegen die Leitplanken und wurde verworfen.",
        findings: [],
      },
      expected: "Der erstellte Brief verstößt gegen die Leitplanken und wurde verworfen.",
    },
    { status: 503, body: { code: "unavailable" }, expected: RUNSHEET_GENERATE_COPY.failed },
    {
      status: 503,
      body: { code: "no_usable_source" },
      expected: RUNSHEET_GENERATE_COPY.noSource,
    },
  ]
  for (const entry of cases) {
    const render = createHarness(() => DiscoveryRunsheetBrief(briefProps()), router)
    const fetchStub = stubFetch(() => ({ status: entry.status, body: entry.body }))
    try {
      let tree = render()
      byId(tree, "runsheet-baseline-score").props.onChange({ target: { value: "7" } })
      tree = render()
      generateBar(tree).props.onGenerate()
      await settle()
      tree = render()
      assert.deepEqual(generateBar(tree).props.ui, { phase: "error", text: entry.expected })
      assert.equal(byId(tree, "runsheet-diagnose").props.value, "Feines Haar.")
      assert.equal(byId(tree, "runsheet-baseline-score").props.value, "7")
      assert.equal(saveBar(tree).props.dirty, true)
      // A retry still expects the brief it loaded.
      generateBar(tree).props.onGenerate()
      await settle()
      assert.deepEqual(fetchStub.calls[1]!.body, fetchStub.calls[0]!.body)
    } finally {
      fetchStub.restore()
    }
  }
  assert.equal(refreshes(), 0)

  // The network itself fails.
  const original = globalThis.fetch
  globalThis.fetch = (async () => {
    throw new Error("offline")
  }) as typeof fetch
  try {
    const render = createHarness(() => DiscoveryRunsheetBrief(briefProps()), router)
    let tree = render()
    generateBar(tree).props.onGenerate()
    await settle()
    tree = render()
    assert.deepEqual(generateBar(tree).props.ui, {
      phase: "error",
      text: RUNSHEET_GENERATE_COPY.failed,
    })
  } finally {
    globalThis.fetch = original
  }
})

test("stale hint: shown when the stored hash differs from the page's, hidden when it could not read", async () => {
  const { router } = fakeRouter()
  const tree = (currentSourceHash: string | null, overrides: Record<string, unknown> = {}) =>
    createHarness(
      () => DiscoveryRunsheetBrief(briefProps({ currentSourceHash, ...overrides })),
      router,
    )()
  assert.equal(generateBar(tree("abc123")).props.stale, false)
  assert.equal(generateBar(tree("changed")).props.stale, true)
  assert.equal(generateBar(tree(null)).props.stale, false, "degraded read: no hint")
  assert.equal(
    generateBar(
      tree("changed", {
        initialBriefMeta: { generatedAt: null, sourceHash: null, generatedBy: null, savedAt: null },
      }),
    ).props.stale,
    false,
    "no brief: nothing to be stale",
  )

  // After a generation its own hash stands in until the refresh.
  const render = createHarness(
    () => DiscoveryRunsheetBrief(briefProps({ currentSourceHash: "changed" })),
    router,
  )
  const fetchStub = stubFetch(() => ({
    status: 200,
    body: {
      callSheet: generatedSheet({
        consultBrief: { ...generatedSheet().consultBrief!, source_hash: "changed" },
      }),
      sourceHash: "changed",
    },
  }))
  try {
    let current = render()
    assert.equal(generateBar(current).props.stale, true)
    generateBar(current).props.onGenerate()
    await settle()
    current = render()
    assert.equal(generateBar(current).props.stale, false)
  } finally {
    fetchStub.restore()
  }
})

test("generate: locked while the call sheet is unread", () => {
  const { router } = fakeRouter()
  const tree = createHarness(
    () => DiscoveryRunsheetBrief(briefProps({ saveLocked: true })),
    router,
  )()
  assert.equal(generateBar(tree).props.disabled, true)
})

test("generate helpers: expected state, R15 warning, error lines, apply", () => {
  assert.equal(
    runsheetExpectedBriefState({
      generatedAt: null,
      sourceHash: null,
      generatedBy: null,
      savedAt: null,
    }),
    null,
  )
  // A hand-written brief never generated still exists: it is expected, not „none".
  assert.deepEqual(
    runsheetExpectedBriefState({
      generatedAt: null,
      sourceHash: null,
      generatedBy: "manual",
      savedAt: null,
    }),
    { source_hash: null, generated_at: null, saved_at: null },
  )
  const agent = { generatedAt: "t", sourceHash: "h", generatedBy: "agent" as const, savedAt: "s" }
  assert.equal(runsheetReplaceWarning(agent, false), null)
  assert.equal(
    runsheetReplaceWarning(
      { generatedAt: null, sourceHash: null, generatedBy: null, savedAt: null },
      true,
    ),
    RUNSHEET_GENERATE_COPY.replaceDirty,
  )
  assert.equal(runsheetGenerateError(null), RUNSHEET_GENERATE_COPY.failed)
  assert.equal(runsheetGenerateError({ code: "not_found" }), RUNSHEET_GENERATE_COPY.notFound)
  assert.equal(runsheetGenerateError({ code: "x", message: "Eigene Meldung." }), "Eigene Meldung.")

  const state: RunsheetBriefState = {
    baselineText: "5",
    mechanik: "alte Mechanik",
    diagnose: "alt",
    hebel: [],
    lists: { callFragen: [], erwartungen: [] },
    commitments: [{ id: "h", label: "H", committed: true }],
  }
  const next: RunsheetBriefState = {
    baselineText: "4",
    mechanik: "neue Mechanik",
    diagnose: "neu",
    hebel: [{ uid: "g0-0", title: "T", note: "", points: "1", bucket: "produkt" }],
    lists: { callFragen: [{ uid: "g0-f-0", text: "Frage?" }], erwartungen: [] },
    commitments: [],
  }
  // The brief's content (Mechanik, Diagnose, Hebel, lists) is replaced; score and
  // commitments stay.
  assert.deepEqual(applyGeneratedRunsheetBrief(state, next), {
    ...state,
    mechanik: "neue Mechanik",
    diagnose: "neu",
    hebel: next.hebel,
    lists: next.lists,
  })
})

// --- the brief's lists + server stamp + R14 (consult-agent final review) -------------------

test("brief lists: Call-Fragen and Erwartungen render editable; the Ziel-Lücken list is gone (v4)", () => {
  const { router } = fakeRouter()
  const tree = createHarness(() => DiscoveryRunsheetBrief(briefProps()), router)()
  assert.equal(
    findAll(tree, (element) => String(element.props.id ?? "").startsWith("runsheet-zielLuecken"))
      .length,
    0,
  )
  assert.equal(byId(tree, "runsheet-callFragen-s0-f-0").props.value, "Wie oft glättest du?")
  assert.equal(byId(tree, "runsheet-erwartungen-s0-e-0").props.value, "Erste Wirkung nach 4 Wochen")
})

test("brief lists: edits mark the brief dirty (R15) and the save round-trips them", async () => {
  const { router } = fakeRouter()
  const render = createHarness(() => DiscoveryRunsheetBrief(briefProps()), router)
  const fetchStub = stubFetch(() => ({ status: 200, body: { callSheet: {} } }))
  try {
    let tree = render()
    byId(tree, "runsheet-callFragen-s0-f-0").props.onChange({
      target: { value: "Wie oft glättest du pro Woche?" },
    })
    tree = render()
    byId(tree, "runsheet-erwartungen-add").props.onClick()
    tree = render()
    byId(tree, "runsheet-erwartungen-n0").props.onChange({
      target: { value: "Bei stärkerem Haarausfall ärztlich abklären lassen." },
    })
    tree = render()
    assert.equal(saveBar(tree).props.dirty, true)

    // A list edit is a brief edit: generating asks first.
    generateBar(tree).props.onGenerate()
    tree = render()
    assert.equal(generateBar(tree).props.ui.phase, "confirm_replace")
    generateBar(tree).props.onCancel()
    tree = render()

    saveBar(tree).props.onSave()
    await settle()
    const brief = (
      fetchStub.calls[0]!.body as { consult_brief: { sections: Record<string, unknown> } }
    ).consult_brief
    // Stored pre-v4 gaps survive a manual save untouched (spread, not edited).
    assert.deepEqual(brief.sections.zielLuecken, ["Kein Hitzeschutz"])
    assert.deepEqual(brief.sections.callFragen, ["Wie oft glättest du pro Woche?"])
    assert.deepEqual(brief.sections.erwartungen, [
      "Erste Wirkung nach 4 Wochen",
      "Bei stärkerem Haarausfall ärztlich abklären lassen.",
    ])
    assert.deepEqual(brief.sections.swapReasons, sections.swapReasons, "swap reasons carried")
    tree = render()
    assert.equal(saveBar(tree).props.dirty, false)
  } finally {
    fetchStub.restore()
  }
})

test("saved_at: after a manual save the next generation expects the server's new stamp", async () => {
  const { router } = fakeRouter()
  const render = createHarness(() => DiscoveryRunsheetBrief(briefProps()), router)
  const fetchStub = stubFetch((call) =>
    call.method === "PATCH"
      ? {
          status: 200,
          body: {
            callSheet: generatedSheet({
              consultBrief: {
                ...generatedSheet().consultBrief!,
                saved_at: "2026-09-28T09:30:00.000Z",
              },
            }),
          },
        }
      : generated(),
  )
  try {
    let tree = render()
    byId(tree, "runsheet-baseline-score").props.onChange({ target: { value: "6" } })
    tree = render()
    saveBar(tree).props.onSave()
    await settle()
    tree = render()
    // The saved brief is now hand-edited: R15 asks first.
    generateBar(tree).props.onGenerate()
    tree = render()
    generateBar(tree).props.onConfirm()
    await settle()
    const post = fetchStub.calls.find((call) => call.method === "POST")!
    assert.deepEqual(post.body, {
      expected_state: {
        source_hash: "abc123",
        generated_at: "2026-09-27T10:00:00.000Z",
        saved_at: "2026-09-28T09:30:00.000Z",
      },
    })
  } finally {
    fetchStub.restore()
  }
})

test("R14: a draft intake cannot generate — the button is disabled with the reason", async () => {
  const { router } = fakeRouter()
  const render = createHarness(
    () => DiscoveryRunsheetBrief(briefProps({ generateBlockedHint: RUNSHEET_GENERATE_COPY.draft })),
    router,
  )
  const fetchStub = stubFetch(generated)
  try {
    let tree = render()
    assert.equal(generateBar(tree).props.disabled, true)
    assert.equal(generateBar(tree).props.blockedHint, RUNSHEET_GENERATE_COPY.draft)
    generateBar(tree).props.onGenerate()
    await settle()
    tree = render()
    assert.equal(fetchStub.calls.length, 0)
    assert.deepEqual(generateBar(tree).props.ui, { phase: "idle" })
  } finally {
    fetchStub.restore()
  }
})

// --- Phase 5 -----------------------------------------------------------------------------

test("follow-up save: PATCHes only feedback and touchpoints", async () => {
  const { router, refreshes } = fakeRouter()
  const props = {
    enrollmentId: ENROLLMENT,
    initialFeedback: null,
    initialTouchpoints: [],
  }
  const render = createHarness(() => DiscoveryRunsheetFollowUp(props), router)
  const fetchStub = stubFetch(() => ({ status: 200, body: { callSheet: {} } }))
  try {
    let tree = render()
    assert.equal(saveBar(tree).props.dirty, false)
    byId(tree, "runsheet-feedback").props.onChange({ target: { value: "Sehr hilfreich." } })
    tree = render()
    byId(tree, "runsheet-touchpoint-rescore_call").props.onClick()
    tree = render()
    saveBar(tree).props.onSave()
    await settle()

    const [call] = fetchStub.calls
    assert.equal(call!.method, "PATCH")
    assert.deepEqual(Object.keys(call!.body as object).sort(), ["feedback", "touchpoints"])
    const body = call!.body as { feedback: string; touchpoints: Array<Record<string, unknown>> }
    assert.equal(body.feedback, "Sehr hilfreich.")
    assert.equal(body.touchpoints.length, 1)
    assert.equal(body.touchpoints[0]!.kind, "rescore_call")
    assert.match(String(body.touchpoints[0]!.due_on), /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(body.touchpoints[0]!.done_at, null)

    tree = render()
    assert.equal(saveBar(tree).props.dirty, false)
    assert.equal(refreshes(), 1)
  } finally {
    fetchStub.restore()
  }
})

test("follow-up patch: an empty feedback is stored as none", () => {
  assert.deepEqual(runsheetFollowUpPatch({ feedback: "  ", touchpoints: [] }), {
    feedback: null,
    touchpoints: [],
  })
})

test("write outcome: stored, invalid body, gone, anything else", () => {
  assert.deepEqual(discoveryCallSheetWriteOutcome(true, { callSheet: {} }), { error: null })
  assert.equal(
    discoveryCallSheetWriteOutcome(false, { code: "invalid_body" }).error,
    RUNSHEET_SAVE_COPY.invalid,
  )
  assert.equal(
    discoveryCallSheetWriteOutcome(false, { code: "not_found" }).error,
    RUNSHEET_SAVE_COPY.notFound,
  )
  assert.equal(discoveryCallSheetWriteOutcome(false, null).error, RUNSHEET_SAVE_COPY.failed)
  assert.equal(discoveryCallSheetWriteOutcome(true, null).error, RUNSHEET_SAVE_COPY.failed)
})

// --- v4: Mechanik + Maßnahmen buckets ------------------------------------------------------

test("mechanik: shown above the Diagnose, an edit marks the brief dirty and is saved", async () => {
  const { router } = fakeRouter()
  const render = createHarness(() => DiscoveryRunsheetBrief(briefProps()), router)
  const fetchStub = stubFetch(() => ({ status: 200, body: { callSheet: {} } }))
  try {
    let tree = render()
    assert.equal(
      byId(tree, "runsheet-mechanik").props.value,
      "Trockene Längen entstehen meist durch Hitze und Reibung.",
    )
    assert.equal(saveBar(tree).props.dirty, false)
    byId(tree, "runsheet-mechanik").props.onChange({ target: { value: "Neue Mechanik." } })
    tree = render()
    assert.equal(saveBar(tree).props.dirty, true)
    // A Mechanik edit is a brief edit: generating asks first (R15).
    generateBar(tree).props.onGenerate()
    tree = render()
    assert.equal(generateBar(tree).props.ui.phase, "confirm_replace")
    generateBar(tree).props.onCancel()
    tree = render()
    saveBar(tree).props.onSave()
    await settle()
    const brief = (
      fetchStub.calls[0]!.body as { consult_brief: { sections: Record<string, unknown> } }
    ).consult_brief
    assert.equal(brief.sections.mechanik, "Neue Mechanik.")
    assert.equal(brief.sections.diagnose, "Feines Haar.")
  } finally {
    fetchStub.restore()
  }
})

test("Maßnahmen: two bucket-specific add buttons replace the single one", () => {
  const { router } = fakeRouter()
  const tree = createHarness(() => DiscoveryRunsheetBrief(briefProps()), router)()
  assert.equal(byId(tree, "runsheet-hebel-add-produkt").props.children, "Produkt-Hebel hinzufügen")
  assert.equal(byId(tree, "runsheet-hebel-add-umgang").props.children, "Umgang-Hebel hinzufügen")
  assert.equal(findAll(tree, (element) => element.props.id === "runsheet-hebel-add").length, 0)
})

test("Maßnahmen: a Produkt add lands before the Umgang rows, an Umgang add at the end; buckets are saved", async () => {
  const { router } = fakeRouter()
  const render = createHarness(() => DiscoveryRunsheetBrief(briefProps()), router)
  const fetchStub = stubFetch(() => ({ status: 200, body: { callSheet: {} } }))
  try {
    let tree = render()
    byId(tree, "runsheet-hebel-add-umgang").props.onClick()
    tree = render()
    byId(tree, "runsheet-hebel-add-produkt").props.onClick()
    tree = render()
    // uids are handed out in click order: the Umgang add is n0, the Produkt add n1.
    byId(tree, "runsheet-hebel-n0-title").props.onChange({ target: { value: "Kopfmassage" } })
    tree = render()
    byId(tree, "runsheet-hebel-n1-title").props.onChange({ target: { value: "Leave-in" } })
    tree = render()
    saveBar(tree).props.onSave()
    await settle()
    const brief = (
      fetchStub.calls[0]!.body as {
        consult_brief: { sections: { hebel: Array<{ title: string; bucket: string | null }> } }
      }
    ).consult_brief
    assert.deepEqual(
      brief.sections.hebel.map((row) => [row.title, row.bucket]),
      [
        ["Mildes Shampoo", "produkt"],
        ["Leave-in", "produkt"],
        ["Schaden stoppen", "umgang"],
        ["Kopfmassage", "umgang"],
      ],
    )
  } finally {
    fetchStub.restore()
  }
})

test("Maßnahmen: legacy rows without a bucket stay bucket-less, first in the list, and save as null", async () => {
  const { router } = fakeRouter()
  const props = briefProps({
    initialSections: {
      ...sections,
      hebel: [
        { title: "Neu", note: "", points: 1, bucket: "produkt" },
        { title: "Alt", note: "", points: 0.5, bucket: null },
      ],
    },
  })
  const render = createHarness(() => DiscoveryRunsheetBrief(props), router)
  const fetchStub = stubFetch(() => ({ status: 200, body: { callSheet: {} } }))
  try {
    let tree = render()
    byId(tree, "runsheet-mechanik").props.onChange({ target: { value: "Ergänzt." } })
    tree = render()
    saveBar(tree).props.onSave()
    await settle()
    const brief = (
      fetchStub.calls[0]!.body as {
        consult_brief: { sections: { hebel: Array<{ title: string; bucket: string | null }> } }
      }
    ).consult_brief
    assert.deepEqual(
      brief.sections.hebel.map((row) => [row.title, row.bucket]),
      [
        ["Alt", null],
        ["Neu", "produkt"],
      ],
    )
  } finally {
    fetchStub.restore()
  }
})
