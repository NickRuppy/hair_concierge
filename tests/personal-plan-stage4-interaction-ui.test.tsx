import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { RoutineEditor } from "../src/components/routine/personal-plan/routine-editor"
import {
  RoutineProposalSheetBody,
  type RoutineProposalSheetDeltaEntry,
} from "../src/components/routine/personal-plan/routine-proposal-sheet"
import {
  classifyProposalReload,
  friendlyError,
  refreshRouteAfterRoutineAcceptance,
  routineEntrySyncTiming,
  routineProposalDeltaEntries,
} from "../src/components/routine/personal-plan/personal-plan-routine-client"
import { RoutineProductDetail } from "../src/components/routine/personal-plan/routine-product-detail"
import type { RoutinePayloadV1 } from "../src/lib/personal-plan/routine/contracts"
import type { RoutineEditOperation } from "../src/lib/personal-plan/routine-candidate-compiler"

type AnyElement = ReactElement<Record<string, any>>

type ReactDispatcherInternals = {
  H: unknown
}

function withClientHooks<T>(render: () => T): { value: T; rerender: () => T } {
  const reactInternals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const previousDispatcher = reactInternals.H
  const hookValues: unknown[] = []
  let cursor = 0

  function depsChanged(previousDeps: unknown[] | undefined, nextDeps: unknown[] | undefined) {
    return (
      !previousDeps ||
      !nextDeps ||
      previousDeps.length !== nextDeps.length ||
      nextDeps.some((dependency, index) => dependency !== previousDeps[index])
    )
  }

  const dispatcher = {
    useCallback<Callback extends (...args: never[]) => unknown>(
      callback: Callback,
      deps?: unknown[],
    ): Callback {
      return this.useMemo(() => callback, deps)
    },
    useEffect() {
      cursor += 1
    },
    useLayoutEffect() {
      cursor += 1
    },
    useMemo<Value>(factory: () => Value, deps?: unknown[]): Value {
      const stateIndex = cursor
      cursor += 1
      const previous = hookValues[stateIndex] as { deps?: unknown[]; value: Value } | undefined
      if (previous && !depsChanged(previous.deps, deps)) return previous.value
      const value = factory()
      hookValues[stateIndex] = { deps, value }
      return value
    },
    useRef<Value>(initialValue: Value): { current: Value } {
      const stateIndex = cursor
      cursor += 1
      if (!hookValues[stateIndex]) hookValues[stateIndex] = { current: initialValue }
      return hookValues[stateIndex] as { current: Value }
    },
    useState<Value>(
      initialState: Value | (() => Value),
    ): [Value, (nextState: Value | ((previous: Value) => Value)) => void] {
      const stateIndex = cursor
      cursor += 1
      if (hookValues.length <= stateIndex) {
        hookValues[stateIndex] =
          typeof initialState === "function" ? (initialState as () => Value)() : initialState
      }
      return [
        hookValues[stateIndex] as Value,
        (nextState) => {
          hookValues[stateIndex] =
            typeof nextState === "function"
              ? (nextState as (previous: Value) => Value)(hookValues[stateIndex] as Value)
              : nextState
        },
      ]
    },
  }

  function run() {
    cursor = 0
    reactInternals.H = dispatcher
    try {
      return render()
    } finally {
      reactInternals.H = previousDispatcher
    }
  }

  return { value: run(), rerender: run }
}

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

function findByText(node: ReactNode, text: string): AnyElement {
  const match = findAll(node, (element) => textContent(element) === text)[0]
  assert.ok(match, `Expected element with text "${text}"`)
  return match
}

function item(overrides: Partial<RoutinePayloadV1["items"][number]> = {}) {
  return {
    itemKey: "item:shampoo:cleanse:owned",
    assignmentKey: "assignment:shampoo:cleanse:owned",
    category: "shampoo",
    role: "cleanse",
    purposeKey: "cleanse",
    roleOrder: 0,
    state: {
      systemAssessment: "basis",
      inclusion: "included",
      availability: "owned",
      fitDecision: "standard",
    },
    product: {
      kind: "owned",
      capturedProductId: "captured-shampoo",
      productId: "product-shampoo",
      displayName: "Sanftes Shampoo",
    },
    cadence: { recommended: null, userOverride: null, displayKey: "daily" },
    sourceDecisionKeys: [],
    authorityRuleIds: [],
    executable: true,
    ...overrides,
  } as RoutinePayloadV1["items"][number]
}

function payload(items: RoutinePayloadV1["items"]): RoutinePayloadV1 {
  return {
    schemaVersion: 1,
    planId: "11111111-1111-4111-8111-111111111111",
    versionId: "routine-v1",
    parentVersionId: null,
    source: {
      refinedVersionId: "22222222-2222-4222-8222-222222222222",
      productPortfolioVersionId: "portfolio-v1",
      sourceFingerprint: "a".repeat(64),
      compilerVersion: "v1",
      authorityVersions: {},
    },
    intent: { schemaVersion: 1, categories: [] },
    sections: [
      {
        key: "basis",
        itemKeys: items
          .filter((entry) => entry.state.systemAssessment === "basis")
          .map((entry) => entry.itemKey),
      },
      {
        key: "optional",
        itemKeys: items
          .filter((entry) => entry.state.systemAssessment !== "basis")
          .map((entry) => entry.itemKey),
      },
    ],
    items,
    createdAt: "2026-08-08T00:00:00.000Z",
  }
}

test("global editor renders the complete Routine and submits a local operation batch", () => {
  const operations: RoutineEditOperation[][] = []
  const routine = payload([
    item(),
    item({
      itemKey: "item:oil:dry_finish:planned",
      assignmentKey: "assignment:oil:dry_finish:planned",
      category: "oil",
      role: "dry_finish",
      purposeKey: "dry_finish",
      state: {
        systemAssessment: "optional",
        inclusion: "included",
        availability: "planned",
        fitDecision: "standard",
      },
      product: {
        kind: "planned",
        plannedPurchaseId: "planned-oil",
        productId: "product-oil",
        displayName: "Leichtes Haaröl",
      },
      executable: false,
    }),
  ])
  let tree = withClientHooks(() =>
    RoutineEditor({
      routine,
      productOptions: {
        "assignment:shampoo:cleanse:owned": [
          {
            label: "Mildes Ersatzshampoo",
            productRef: { kind: "planned", plannedPurchaseId: "planned-new", productId: "p-new" },
          },
        ],
      },
      supportedCadences: ["daily", "weekly_2x"],
      supportedRolesByCategory: { shampoo: ["cleanse"], oil: ["dry_finish"] },
      onSubmitOperations: (batch) => {
        operations.push([...batch])
      },
    }),
  )
  assert.match(renderToStaticMarkup(tree.value), /Aktive Routine bleibt unverändert/)
  assert.match(renderToStaticMarkup(tree.value), /Deine Basis/)
  assert.match(renderToStaticMarkup(tree.value), /Optional/)

  const select = findAll(tree.value, (element) => element.type === "select")[0]
  assert.ok(select)
  select.props.onChange({ target: { value: "planned:planned-new:p-new" } })
  tree.value = tree.rerender()
  findByText(tree.value, "Änderungen prüfen").props.onClick()

  assert.equal(operations.length, 1)
  assert.deepEqual(operations[0], [
    {
      kind: "assignment_replace",
      assignmentKey: "assignment:shampoo:cleanse:owned",
      productRef: { kind: "planned", plannedPurchaseId: "planned-new", productId: "p-new" },
    },
  ])
})

test("global editor blocks invalid controls and asks before discarding dirty edits", () => {
  let canceled = 0
  const routine = payload([item()])
  let tree = withClientHooks(() =>
    RoutineEditor({
      routine,
      productOptions: {},
      supportedCadences: ["weekly_2x"],
      supportedRolesByCategory: { shampoo: [] },
      onCancel: () => {
        canceled += 1
      },
      onSubmitOperations: () => undefined,
    }),
  )

  assert.match(
    renderToStaticMarkup(tree.value),
    /Keine gültige Rolle für diese Kategorie verfügbar/,
  )
  const checkbox = findAll(
    tree.value,
    (element) => element.type === "input" && element.props.type === "checkbox",
  )[0]
  assert.ok(checkbox)
  checkbox.props.onChange({ target: { checked: false } })
  tree.value = tree.rerender()
  findByText(tree.value, "Abbrechen").props.onClick()
  tree.value = tree.rerender()

  assert.equal(canceled, 0)
  assert.match(renderToStaticMarkup(tree.value), /Lokale Änderungen verwerfen/)
  findByText(tree.value, "Verwerfen").props.onClick()
  assert.equal(canceled, 1)
})

test("global editor starts at the recommendation and can clear a cadence override", () => {
  const operations: RoutineEditOperation[][] = []
  const routine = payload([
    item({
      cadence: { recommended: null, userOverride: null, displayKey: "daily" },
    }),
  ])
  let tree = withClientHooks(() =>
    RoutineEditor({
      routine,
      productOptions: {},
      supportedCadences: ["weekly_2x"],
      supportedRolesByCategory: { shampoo: ["cleanse"] },
      onSubmitOperations: (batch) => {
        operations.push([...batch])
      },
    }),
  )

  const cadenceSelect = findAll(tree.value, (element) => element.type === "select")[2]
  assert.ok(cadenceSelect)
  assert.equal(cadenceSelect.props.value, "")
  assert.match(renderToStaticMarkup(tree.value), /Keine Abweichung – Empfehlung verwenden/)

  cadenceSelect.props.onChange({ target: { value: "weekly_2x" } })
  tree.value = tree.rerender()
  findAll(tree.value, (element) => element.type === "select")[2].props.onChange({
    target: { value: "" },
  })
  tree.value = tree.rerender()
  findByText(tree.value, "Änderungen prüfen").props.onClick()

  assert.deepEqual(operations, [
    [
      {
        kind: "cadence_override",
        assignmentKey: "assignment:shampoo:cleanse:owned",
        cadenceOverride: null,
      },
    ],
  ])
})

test("routine client never renders raw server error tokens", () => {
  assert.equal(
    friendlyError("unauthorized", "Änderungen konnten nicht geprüft werden."),
    "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
  )
  assert.equal(
    friendlyError("internal_error", "Änderungen konnten nicht geprüft werden."),
    "Änderungen konnten nicht geprüft werden.",
  )
})

test("Routine entry never blocks actions and defers reconciliation behind a pending proposal", () => {
  assert.equal(routineEntrySyncTiming({ enabled: false, hasPendingProposal: false }), "disabled")
  assert.equal(routineEntrySyncTiming({ enabled: true, hasPendingProposal: false }), "after_render")
  assert.equal(
    routineEntrySyncTiming({ enabled: true, hasPendingProposal: true }),
    "after_proposal_resolution",
  )
})

test("proposal sheet body separates initial confirmation from successor review callbacks", () => {
  const events: string[] = []
  const delta: RoutineProposalSheetDeltaEntry[] = [
    {
      changeKey: "direct-1",
      label: "Shampoo ersetzt",
      description: "Von Sanftes Shampoo zu Mildes Ersatzshampoo.",
    },
  ]
  const initialHtml = renderToStaticMarkup(
    <RoutineProposalSheetBody
      variant="initial"
      directChanges={delta}
      consequentialChanges={[]}
      unchangedItemCount={3}
      onAccept={() => events.push("accept")}
      onBackToEditor={() => events.push("edit")}
    />,
  )

  assert.match(initialHtml, /Routine bestätigen/)
  assert.doesNotMatch(initialHtml, /Ablehnen/)

  const tree = RoutineProposalSheetBody({
    variant: "successor",
    directChanges: delta,
    consequentialChanges: [
      {
        changeKey: "consequence-1",
        label: "Öl angepasst",
        description: "Doppelte Glättung entfällt.",
      },
    ],
    unchangedItemCount: 2,
    retrying: true,
    onAccept: () => events.push("accept"),
    onReject: () => events.push("reject"),
    onDismissForVisit: () => events.push("later"),
    onBackToEditor: () => events.push("edit"),
    onDiscardCandidate: () => events.push("discard"),
  })
  const html = renderToStaticMarkup(tree)
  assert.match(html, /Von dir geändert/)
  assert.match(html, /Dadurch außerdem angepasst/)
  assert.match(html, /2 Bausteine bleiben unverändert/)
  assert.match(html, /Erneut versuchen/)

  findByText(tree, "Später").props.onClick()
  findByText(tree, "Erneut versuchen").props.onClick()
  findByText(tree, "Ablehnen").props.onClick()
  assert.deepEqual(events, ["later", "accept", "reject"])
})

test("proposal acceptance reload distinguishes lost response, same pending, and supersession", () => {
  const candidate = payload([item()])
  const pendingView = {
    status: "proposal" as const,
    personalPlanId: "plan-1",
    planRevision: 1,
    sourceRevision: 1,
    activeVersion: null,
    pendingProposal: {
      id: "proposal-1",
      candidateVersionId: candidate.versionId,
      sourceRevision: 1,
      delta: { schemaVersion: 1 as const, direct: [], consequential: [], unchangedItemCount: 1 },
      candidate,
    },
  }
  const acceptedView = {
    ...pendingView,
    status: "active" as const,
    activeVersion: { id: candidate.versionId, payload: candidate },
    pendingProposal: null,
  }
  const successorView = {
    ...acceptedView,
    pendingProposal: { ...pendingView.pendingProposal, id: "proposal-2" },
  }

  assert.equal(classifyProposalReload(pendingView, "proposal-1"), "same_pending")
  assert.equal(classifyProposalReload(acceptedView, "proposal-1"), "resolved")
  assert.equal(classifyProposalReload(successorView, "proposal-1"), "superseded")
})

test("every Routine acceptance refreshes server-owned navigation and portfolio presentation", () => {
  let refreshes = 0
  const refresh = () => refreshes++

  refreshRouteAfterRoutineAcceptance({
    action: "accept",
    refresh,
  })
  refreshRouteAfterRoutineAcceptance({
    action: "reject",
    refresh,
  })
  refreshRouteAfterRoutineAcceptance({
    action: "accept",
    refresh,
  })

  assert.equal(refreshes, 2)
})

test("proposal sheet blocks duplicate requests only while a request is running", () => {
  const tree = RoutineProposalSheetBody({
    variant: "initial",
    directChanges: [],
    consequentialChanges: [],
    unchangedItemCount: 1,
    submitting: true,
    retrying: true,
    onAccept: () => undefined,
  })

  const submit = findAll(
    tree,
    (element) => textContent(element) === "Wird gespeichert …" && element.props.disabled === true,
  )[0]
  assert.ok(submit)
})

test("proposal deltas render frozen consumer labels instead of internal item keys", () => {
  const activeItem = item({
    itemKey: "item:shampoo:everyday",
    purposeKey: "shampoo_everyday",
    product: {
      kind: "owned",
      capturedProductId: "captured-shampoo",
      productId: "product-shampoo",
      displayName: "Sanftes Shampoo",
    },
  })
  const active = {
    ...payload([activeItem]),
    intent: {
      schemaVersion: 1 as const,
      categories: [
        {
          category: "shampoo" as const,
          inclusion: "included" as const,
          inclusionSource: "stage3" as const,
          assignments: [],
        },
      ],
    },
  }
  const candidateItem = item({
    ...activeItem,
    state: { ...activeItem.state, inclusion: "excluded" },
  })
  const candidate = {
    ...payload([candidateItem]),
    intent: {
      schemaVersion: 1 as const,
      categories: active.intent.categories.map((category) => ({
        ...category,
        inclusion: "excluded" as const,
      })),
    },
  }

  assert.deepEqual(
    routineProposalDeltaEntries(
      [
        { kind: "changed", itemKey: "category:shampoo" },
        { kind: "changed", itemKey: "item:shampoo:everyday" },
      ],
      active,
      candidate,
    ),
    [
      {
        changeKey: "category:shampoo:0",
        label: "Shampoo",
        description: "Kategorie nicht mehr verwenden",
      },
      {
        changeKey: "item:shampoo:everyday:1",
        label: "Regelmäßige Reinigung",
        description: "Sanftes Shampoo · nicht mehr in Verwendung",
      },
    ],
  )
  assert.deepEqual(
    routineProposalDeltaEntries(
      [{ kind: "added", itemKey: "item:shampoo:everyday" }],
      null,
      active,
    ),
    [
      {
        changeKey: "item:shampoo:everyday:0",
        label: "Regelmäßige Reinigung",
        description: "Sanftes Shampoo · hinzugefügt",
      },
    ],
  )
})

test("product detail keeps fit frozen while commerce and explicit actions stay caller-owned", () => {
  const events: string[] = []
  const planned = item({
    state: {
      systemAssessment: "basis",
      inclusion: "included",
      availability: "planned",
      fitDecision: "standard",
    },
    product: {
      kind: "planned",
      plannedPurchaseId: "planned-shampoo",
      productId: "product-shampoo",
      displayName: "Sanftes Shampoo",
    },
    executable: false,
  })
  const tree = RoutineProductDetail({
    item: planned,
    commerce: {
      availabilityLabel: "Lieferbar",
      affiliateDisclosure: "Affiliate-Link: Chaarlie kann eine Provision erhalten.",
      freshnessLabel: "Preis vor 3 Stunden aktualisiert",
      priceLabel: "12,95 EUR",
      productUrl: "https://example.test/shampoo",
    },
    fitStatusLabel: "Guter Fit aus deiner Produktauswahl",
    frozenFitSummary: "Diese Einschätzung stammt aus deiner bestätigten Produktauswahl.",
    onOpenProduct: () => events.push("open"),
    onMarkPurchased: () => events.push("owned"),
  })
  const html = renderToStaticMarkup(tree)
  assert.match(html, /Guter Fit aus deiner Produktauswahl/)
  assert.match(html, /Preis vor 3 Stunden aktualisiert/)
  assert.match(html, /Affiliate-Link/)

  findByText(tree, "Zum Produkt").props.onClick()
  findByText(tree, "Ich habe es schon gekauft").props.onClick()
  assert.deepEqual(events, ["open", "owned"])

  const ownedHtml = renderToStaticMarkup(
    <RoutineProductDetail
      item={item()}
      commerce={{ availabilityLabel: "In deiner Routine", freshnessLabel: "Gerade geladen" }}
      fitStatusLabel="Aktiv"
      frozenFitSummary="Bestätigte Auswahl."
      onOpenProduct={() => undefined}
      onMarkPurchased={() => events.push("should-not-render")}
    />,
  )
  assert.doesNotMatch(ownedHtml, /Ich habe es schon gekauft/)
  assert.doesNotMatch(ownedHtml, /nicht übergeben/)
})
