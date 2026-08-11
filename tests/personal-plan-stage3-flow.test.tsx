import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"

import { Button } from "../src/components/ui/button"
import {
  IntakeFallbackBoundary,
  ProductCaptureScreen,
  ProductDecisionScreen,
  SemanticRoleAssignment,
  Stage3Shell,
  Stage3SystemState,
  Stage3Transition,
  type Stage3DecisionAction,
} from "../src/components/personal-plan-products"
import {
  Stage3ProductsFlow,
  type Stage3RoutineHandoff,
  updateStage3RoleAssignments,
} from "../src/components/personal-plan-products/stage3-products-flow"
import { customerIoDestination } from "../src/lib/analytics/destinations/customerio"
import { metaDestination } from "../src/lib/analytics/destinations/meta"
import { postHogDestination } from "../src/lib/analytics/destinations/posthog"
import { CATEGORY_ROLE_POLICIES } from "../src/lib/personal-plan/products/authorities"
import type {
  Stage3AuthorityEvaluation,
  Stage3AuthoritySemanticIntent,
} from "../src/lib/personal-plan/products/authority/contracts"
import {
  deriveStage3DecisionSubjects,
  type Stage3AuthoritySnapshotV1,
  type Stage3EntryContext,
  type Stage3ProductDecision,
  type Stage3ProductDraft,
} from "../src/lib/personal-plan/products/contracts"
import { createFixtureStage3Gateway } from "../src/lib/personal-plan/products/fixture-gateway"
import type {
  Stage3MutationResponse,
  Stage3ProductsGateway,
} from "../src/lib/personal-plan/products/gateway"
import type { Stage3Bootstrap } from "../src/lib/personal-plan/products/stage2-entry-adapter"
import { createStage3Draft } from "../src/lib/personal-plan/products/state-machine"

type ClientStateHarness = {
  render: () => Promise<ReactElement | null>
}

function createAuthorityTestGateway(
  options: {
    evaluate?: (
      draft: Stage3ProductDraft,
      subject: ReturnType<typeof deriveStage3DecisionSubjects>[number],
    ) => Stage3AuthorityEvaluation
    onIntent?: (intent: Stage3AuthoritySemanticIntent) => void
  } = {},
): Stage3ProductsGateway & {
  evaluateDecisions(input: { draftId: string }): Promise<Stage3AuthorityEvaluation[]>
  resolveDecision(input: {
    draftId: string
    expectedRevision: number
    intent: Stage3AuthoritySemanticIntent
  }): Promise<Stage3MutationResponse>
} {
  const base = createFixtureStage3Gateway({ searchDelayMs: 0 })
  let latestDraft: Stage3ProductDraft | null = null

  return {
    ...base,
    async loadOrCreate(input) {
      const response = await base.loadOrCreate(input)
      latestDraft = response.draft
      return response
    },
    async mutate(input) {
      const response = await base.mutate(input)
      latestDraft = response.status === "saved" ? response.draft : response.latestDraft
      return response
    },
    async complete(input) {
      const response = await base.complete(input)
      latestDraft = response.status === "conflict" ? response.latestDraft : response.draft
      return response
    },
    async evaluateDecisions() {
      assert.ok(latestDraft)
      return deriveStage3DecisionSubjects(latestDraft).map((subject) =>
        (options.evaluate ?? testAuthorityEvaluation)(latestDraft!, subject),
      )
    },
    async resolveDecision(input) {
      assert.ok(latestDraft)
      const subject = deriveStage3DecisionSubjects(latestDraft).find(
        (candidate) => candidate.decisionKey === input.intent.subjectKey,
      )
      assert.ok(subject)
      const evaluation = (options.evaluate ?? testAuthorityEvaluation)(latestDraft, subject)
      assert.ok(evaluation.allowedActions.includes(input.intent.action as never))
      options.onIntent?.(input.intent)
      const decision = testAuthorityDecision(subject, evaluation, input.intent)
      const response = await base.mutate({
        draftId: input.draftId,
        expectedRevision: input.expectedRevision,
        mutation: { type: "record_decision", decision },
      })
      latestDraft = response.status === "saved" ? response.draft : response.latestDraft
      return response
    },
  }
}

function testAuthorityEvaluation(
  draft: Stage3ProductDraft,
  subject: ReturnType<typeof deriveStage3DecisionSubjects>[number],
): Stage3AuthorityEvaluation {
  const product = subject.capturedProductId
    ? draft.products.find((candidate) => candidate.capturedProductId === subject.capturedProductId)
    : null
  if (product?.identity.kind === "pending_submission") {
    return {
      status: "pending",
      category: subject.category,
      subjectKey: subject.decisionKey,
      reason: "product_intake_pending",
      allowedActions: ["keep_pending", "leave_uncovered"],
      coverageRuleIds: [],
    }
  }
  if (!product) {
    return {
      status: "known",
      category: subject.category,
      subjectKey: subject.decisionKey,
      verdict: "unknown",
      criteria: [],
      allowedActions: ["leave_uncovered"],
      recommendation: null,
      productFactFingerprint: null,
      recommendationFactFingerprint: null,
      coverageRuleIds: [],
    }
  }
  const conditionerIndex = draft.products
    .filter((candidate) => candidate.identity.category === "conditioner")
    .findIndex((candidate) => candidate.capturedProductId === subject.capturedProductId)
  const mismatch = subject.category === "conditioner" && conditionerIndex === 1
  return {
    status: "known",
    category: subject.category,
    subjectKey: subject.decisionKey,
    verdict: mismatch ? "mismatch" : "ideal",
    criteria: [
      {
        criterionId: `test:${subject.decisionKey}`,
        label: "Bedarf",
        result: mismatch ? "fail" : "pass",
        explanation: mismatch ? "Die Passung weicht ab." : "Der Bedarf wird erfüllt.",
      },
    ],
    allowedActions: mismatch ? ["plan_recommendation", "acknowledge_override"] : ["keep_owned"],
    recommendation: mismatch
      ? {
          recommendationId: `recommend:${subject.decisionKey}`,
          productId: `recommended:${subject.decisionKey}`,
          category: subject.category,
          role: subject.role,
          displayName: "Leichter Pflege-Conditioner",
          reason: "Passt besser zum Bedarf.",
          authorityRuleId: "test.authority",
        }
      : null,
    productFactFingerprint: `facts:${subject.decisionKey}`,
    recommendationFactFingerprint: mismatch ? `facts:recommend:${subject.decisionKey}` : null,
    coverageRuleIds: [],
  }
}

function testAuthorityDecision(
  subject: ReturnType<typeof deriveStage3DecisionSubjects>[number],
  evaluation: Stage3AuthorityEvaluation,
  intent: Stage3AuthoritySemanticIntent,
): Stage3ProductDecision {
  const known = evaluation.status === "known" ? evaluation : null
  return {
    decisionKey: subject.decisionKey,
    category: subject.category,
    role: subject.role,
    capturedProductId: subject.capturedProductId,
    verdict: known?.verdict ?? "unknown",
    choiceState:
      intent.action === "keep_owned"
        ? "owned_active"
        : intent.action === "acknowledge_override"
          ? "owned_override"
          : intent.action === "plan_recommendation"
            ? "planned_purchase"
            : intent.action === "keep_pending"
              ? "pending_review"
              : "unassigned",
    criterionResults: known?.criteria ?? [],
    recommendation:
      intent.action === "plan_recommendation" ? (known?.recommendation ?? null) : null,
    limitationAcknowledged: intent.action === "acknowledge_override",
  }
}

type ReactDispatcherInternals = {
  H: unknown
}

type EffectRecord = {
  deps: unknown[] | undefined
  cleanup?: () => void
}

type HookMemoRecord<T> = {
  deps: unknown[] | undefined
  value: T
}

function createClientStateHarness(renderComponent: () => ReactElement | null): ClientStateHarness {
  const reactInternals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const previousDispatcher = reactInternals.H
  const hookValues: unknown[] = []
  let cursor = 0
  let pendingEffects: Array<() => void | (() => void) | Promise<void | (() => void)>> = []

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
    useEffect(effect: () => void | (() => void) | Promise<void | (() => void)>, deps?: unknown[]) {
      const stateIndex = cursor
      cursor += 1
      const previous = hookValues[stateIndex] as EffectRecord | undefined
      if (depsChanged(previous?.deps, deps)) {
        previous?.cleanup?.()
        hookValues[stateIndex] = { deps } satisfies EffectRecord
        pendingEffects.push(effect)
      }
    },
    useLayoutEffect(
      effect: () => void | (() => void) | Promise<void | (() => void)>,
      deps?: unknown[],
    ) {
      this.useEffect(effect, deps)
    },
    useMemo<T>(factory: () => T, deps?: unknown[]): T {
      const stateIndex = cursor
      cursor += 1
      const previous = hookValues[stateIndex] as HookMemoRecord<T> | undefined
      if (previous && !depsChanged(previous.deps, deps)) return previous.value
      const value = factory()
      hookValues[stateIndex] = { deps, value } satisfies HookMemoRecord<T>
      return value
    },
    useRef<T>(initialValue: T): { current: T } {
      const stateIndex = cursor
      cursor += 1
      if (!hookValues[stateIndex]) hookValues[stateIndex] = { current: initialValue }
      return hookValues[stateIndex] as { current: T }
    },
    useState<T>(initialState: T | (() => T)): [T, (nextState: T | ((previous: T) => T)) => void] {
      const stateIndex = cursor
      cursor += 1

      if (hookValues.length <= stateIndex) {
        hookValues[stateIndex] =
          typeof initialState === "function" ? (initialState as () => T)() : initialState
      }

      return [
        hookValues[stateIndex] as T,
        (nextState) => {
          hookValues[stateIndex] =
            typeof nextState === "function"
              ? (nextState as (previous: T) => T)(hookValues[stateIndex] as T)
              : nextState
        },
      ]
    },
  }

  return {
    async render() {
      cursor = 0
      pendingEffects = []
      reactInternals.H = dispatcher
      try {
        const tree = renderComponent()
        const effects = pendingEffects
        pendingEffects = []
        for (const effect of effects) {
          const cleanup = await effect()
          if (typeof cleanup === "function") {
            const effectIndex = hookValues.findIndex((value) => {
              const record = value as EffectRecord | undefined
              return record?.cleanup === undefined && record?.deps !== undefined
            })
            if (effectIndex >= 0) {
              ;(hookValues[effectIndex] as EffectRecord).cleanup = cleanup
            }
          }
        }
        await Promise.resolve()
        return tree
      } finally {
        reactInternals.H = previousDispatcher
      }
    },
  }
}

function childrenOf(node: ReactNode): ReactNode[] {
  if (!React.isValidElement(node)) return []
  const element = node as ReactElement<{ children?: ReactNode }>
  return React.Children.toArray(element.props.children)
}

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  return childrenOf(node)
    .map((child) => textContent(child))
    .join("")
}

function findByType<P>(node: ReactNode, type: ReactElement<P>["type"]): ReactElement<P> | null {
  if (!React.isValidElement(node)) return null
  const element = node as ReactElement<P & { children?: ReactNode }>
  if (element.type === type) return element as ReactElement<P>
  for (const child of childrenOf(element)) {
    const match = findByType<P>(child, type)
    if (match) return match
  }
  return null
}

async function renderSettled(harness: ClientStateHarness): Promise<ReactElement | null> {
  await harness.render()
  await new Promise<void>((resolve) => setTimeout(resolve, 5))
  await harness.render()
  await new Promise<void>((resolve) => setTimeout(resolve, 5))
  return harness.render()
}

async function captureCatalogProduct(
  harness: ClientStateHarness,
  categoryLabel: string,
  query: string,
  resultIndex = 0,
) {
  let tree = await renderSettled(harness)
  let screen = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(screen?.props.categoryLabel, categoryLabel)
  screen.props.onQueryChange(query)
  tree = await renderSettled(harness)
  screen = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(tree, ProductCaptureScreen)
  assert.equal(screen?.props.searchStatus, "ready")
  assert.ok(screen.props.searchResults.length > resultIndex)
  await screen.props.onSelectCandidate(screen.props.searchResults[resultIndex]!.candidateId)
  tree = await renderSettled(harness)
  screen = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(tree, ProductCaptureScreen)
  assert.equal(screen?.props.showFrequency, true)
  screen.props.onFrequencyChange("weekly_2x")
}

async function assignEveryRoleToFirstProduct(harness: ClientStateHarness) {
  let tree = await renderSettled(harness)
  const roleScreen = findByType<React.ComponentProps<typeof SemanticRoleAssignment>>(
    tree,
    SemanticRoleAssignment,
  )
  if (!roleScreen) return
  const firstProduct = roleScreen.props.products[0]!
  for (const role of roleScreen.props.roles) {
    roleScreen.props.onToggleRole(firstProduct.capturedProductId, role.role, true)
  }
  tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof SemanticRoleAssignment>>(
    tree,
    SemanticRoleAssignment,
  )!.props.onContinue()
}

async function chooseDecision(harness: ClientStateHarness, kind: Stage3DecisionAction["kind"]) {
  const tree = await renderSettled(harness)
  const screen = findByType<React.ComponentProps<typeof ProductDecisionScreen>>(
    tree,
    ProductDecisionScreen,
  )
  assert.ok(screen)
  const decision = screen.props.decisions[0]!
  const action =
    decision.actions.find((candidate) => candidate.kind === kind) ?? decision.actions[0]
  assert.ok(action, `missing ${kind} action for ${decision.decisionKey}`)
  await screen.props.onChooseAction(decision.decisionKey, action)
}

test("stage 3 lab route is guarded and composed from the interactive flow", () => {
  const routeSource = readFileSync(
    new URL("../src/app/labs/personal-plan/stage-3/page.tsx", import.meta.url),
    "utf8",
  )
  const clientSource = readFileSync(
    new URL("../src/app/labs/personal-plan/stage-3/lab-client.tsx", import.meta.url),
    "utf8",
  )

  assert.match(routeSource, /CI: process\.env\.CI/)
  assert.match(
    routeSource,
    /CI_PERSONAL_PLAN_STAGE3_LAB_ENABLED: process\.env\.CI_PERSONAL_PLAN_STAGE3_LAB_ENABLED/,
  )
  assert.match(routeSource, /NODE_ENV: process\.env\.NODE_ENV/)
  assert.match(routeSource, /VERCEL_ENV: process\.env\.VERCEL_ENV/)
  assert.match(routeSource, /notFound\(\)/)
  assert.match(routeSource, /<PersonalPlanStage3LabClient \/>/)
  assert.match(clientSource, /developmentStage3Analytics/)
  assert.match(clientSource, /createFixtureStage3Gateway/)
  assert.match(clientSource, /gateway=\{gateway\}/)
  assert.match(clientSource, /searchDebounceMs=\{0\}/)
})

test("production Stage 3 flow contains no fixture authority or client-authored decision construction", () => {
  const source = readFileSync(
    new URL("../src/components/personal-plan-products/stage3-products-flow.tsx", import.meta.url),
    "utf8",
  )

  assert.doesNotMatch(source, /fixture-gateway|createFixtureStage3Gateway/)
  assert.doesNotMatch(source, /function makeDecision|type:\s*["']record_decision["']/)
  assert.match(source, /type:\s*["']resolve_decision["']/)
  assert.match(source, /window\.location\.replace\(ready\.next\.href\)/)
})

test("an unfinished Stage 3 draft resumes at the server-owned category cursor", async () => {
  const orderedCategories: Stage3EntryContext["orderedCategories"] = [
    {
      category: "conditioner",
      requiredRoles: ["conditioner_rinse_out"],
      needSummary: "Pflege",
      authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
    },
    {
      category: "oil",
      requiredRoles: ["dry_finish"],
      needSummary: "Finish",
      authorityVersion: CATEGORY_ROLE_POLICIES.oil.authorityVersion,
    },
  ]
  const resumedDraft = {
    ...createStage3Draft({
      draftId: "draft-resume-cursor",
      userId: "user-resume-cursor",
      personalPlanId: "plan-resume-cursor",
      refinedVersionId: "refined-successor",
      requirements: orderedCategories,
      now: "2026-08-08T00:00:00.000Z",
    }),
    revision: 4,
    completedCaptureCategories: ["conditioner" as const],
    categoryCursor: "oil",
  }
  const gateway = createAuthorityTestGateway()
  gateway.loadOrCreate = async () => ({
    status: "active",
    draft: resumedDraft,
    requirements: orderedCategories,
  })
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({
      entryContext: {
        schemaVersion: 1,
        personalPlanId: "plan-resume-cursor",
        refinedVersionId: "refined-successor",
        orderedCategories,
        inventoryPrompts: orderedCategories.map(({ category }) => ({
          category,
          allowsMultiple: CATEGORY_ROLE_POLICIES[category].allowsMultiple,
          allowsExplicitNone: true,
        })),
      },
      gateway,
    }),
  )

  const tree = await renderSettled(harness)
  assert.equal(findByType(tree, Stage3Transition), null)
  assert.equal(
    findByType<React.ComponentProps<typeof ProductCaptureScreen>>(tree, ProductCaptureScreen)?.props
      .categoryLabel,
    "Öl",
  )
})

test("catalog search errors keep manual intake available without claiming no product is owned", async () => {
  const gateway = createAuthorityTestGateway()
  gateway.search = async () => {
    throw new Error("catalog unavailable")
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-search-recovery",
    refinedVersionId: "refined-search-recovery",
    orderedCategories: [
      {
        category: "shampoo",
        requiredRoles: ["shampoo_everyday"],
        needSummary: "Sanfte Reinigung",
        authorityVersion: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
      },
    ],
    inventoryPrompts: [{ category: "shampoo", allowsMultiple: true, allowsExplicitNone: true }],
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({ entryContext, gateway, searchDebounceMs: 0 }),
  )

  let tree = await renderSettled(harness)
  let capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.intakeAvailable, false, "manual intake stays search-led while idle")
  capture?.props.onQueryChange("mein shampoo")
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.searchStatus, "error")
  assert.equal(capture?.props.intakeAvailable, true)
  assert.equal(typeof capture?.props.onExplicitNone, "function")
  capture?.props.onOpenFallbackIntake()
  tree = await renderSettled(harness)
  assert.ok(findByType(tree, IntakeFallbackBoundary))
})

test("a revision conflict waits for a user retry and resubmits once with the canonical revision", async () => {
  const requirements: Stage3EntryContext["orderedCategories"] = [
    {
      category: "conditioner",
      requiredRoles: ["conditioner_rinse_out"],
      needSummary: "Pflege nach jeder Wäsche",
      authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
    },
  ]
  const initialDraft = createStage3Draft({
    draftId: "draft-conflict-retry",
    userId: "user-conflict-retry",
    personalPlanId: "plan-conflict-retry",
    refinedVersionId: "refined-conflict-retry",
    requirements,
    now: "2026-08-11T00:00:00.000Z",
  })
  const canonicalDraft = { ...initialDraft, revision: 1 }
  const gateway = createFixtureStage3Gateway({ searchDelayMs: 0 })
  const expectedRevisions: number[] = []
  gateway.loadOrCreate = async () => ({ status: "active", draft: initialDraft, requirements })
  gateway.mutate = async (input) => {
    expectedRevisions.push(input.expectedRevision)
    if (expectedRevisions.length === 1) return { status: "conflict", latestDraft: canonicalDraft }
    return { status: "saved", draft: { ...canonicalDraft, revision: 2 } }
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({
      entryContext: {
        schemaVersion: 1,
        personalPlanId: initialDraft.personalPlanId,
        refinedVersionId: initialDraft.refinedVersionId,
        orderedCategories: requirements,
        inventoryPrompts: [
          { category: "conditioner", allowsMultiple: true, allowsExplicitNone: true },
        ],
      },
      gateway,
      searchDebounceMs: 0,
    }),
  )

  let tree = await renderSettled(harness)
  let capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.ok(capture)
  capture.props.onQueryChange("condition")
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.ok(capture?.props.searchResults[0])
  await capture.props.onSelectCandidate(capture.props.searchResults[0]!.candidateId)
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  capture?.props.onFrequencyChange("weekly_2x")

  tree = await renderSettled(harness)
  const conflict = findByType<React.ComponentProps<typeof Stage3SystemState>>(
    tree,
    Stage3SystemState,
  )
  assert.equal(conflict?.props.state, "conflict")
  assert.deepEqual(expectedRevisions, [0])
  assert.ok(conflict)
  const retry = conflict.props.onAction
  assert.ok(retry)
  retry()
  await renderSettled(harness)

  assert.deepEqual(expectedRevisions, [0, 1])
})

test("an authority decision retry uses the canonical revision only after the user retries", async () => {
  const requirements: Stage3EntryContext["orderedCategories"] = [
    {
      category: "conditioner",
      requiredRoles: ["conditioner_rinse_out"],
      needSummary: "Pflege nach jeder Wäsche",
      authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
    },
  ]
  const initialDraft: Stage3ProductDraft = {
    ...createStage3Draft({
      draftId: "draft-authority-conflict-retry",
      userId: "user-authority-conflict-retry",
      personalPlanId: "plan-authority-conflict-retry",
      refinedVersionId: "refined-authority-conflict-retry",
      requirements,
      now: "2026-08-11T00:00:00.000Z",
    }),
    pass: "product_decisions",
    categoryCursor: null,
    products: [
      {
        capturedProductId: "capture-authority-conflict-retry",
        userProductId: "product-authority-conflict-retry",
        identity: {
          kind: "catalog_product",
          productId: "catalog-authority-conflict-retry",
          displayName: "Pflege-Conditioner",
          category: "conditioner",
        },
        frequencyRange: "weekly_2x",
        ownership: "owned",
        source: "catalog_search",
      },
    ],
    roleAssignments: [
      {
        capturedProductId: "capture-authority-conflict-retry",
        category: "conditioner",
        roles: ["conditioner_rinse_out"],
      },
    ],
  }
  const subject = deriveStage3DecisionSubjects(initialDraft)[0]!
  const evaluation = testAuthorityEvaluation(initialDraft, subject)
  const canonicalDraft = { ...initialDraft, revision: 1 }
  const expectedRevisions: number[] = []
  const base = createFixtureStage3Gateway({ searchDelayMs: 0 })
  const gateway = {
    ...base,
    evaluateDecisions: async () => [evaluation],
    resolveDecision: async (input: {
      draftId: string
      expectedRevision: number
      intent: Stage3AuthoritySemanticIntent
    }): Promise<Stage3MutationResponse> => {
      expectedRevisions.push(input.expectedRevision)
      if (expectedRevisions.length === 1) return { status: "conflict", latestDraft: canonicalDraft }
      return {
        status: "saved",
        draft: {
          ...canonicalDraft,
          revision: 2,
          decisions: [testAuthorityDecision(subject, evaluation, input.intent)],
        },
      }
    },
    complete: async () => ({ status: "not_ready" as const, draft: canonicalDraft }),
  }
  const bootstrap: Stage3Bootstrap = {
    entryContext: {
      schemaVersion: 1,
      personalPlanId: initialDraft.personalPlanId,
      refinedVersionId: initialDraft.refinedVersionId,
      orderedCategories: requirements,
      inventoryPrompts: [
        { category: "conditioner", allowsMultiple: true, allowsExplicitNone: true },
      ],
    },
    draft: initialDraft,
    requirements,
    authorityEvaluations: [evaluation],
  }
  const harness = createClientStateHarness(() => Stage3ProductsFlow({ bootstrap, gateway }))

  let tree = await renderSettled(harness)
  const decisionScreen = findByType<React.ComponentProps<typeof ProductDecisionScreen>>(
    tree,
    ProductDecisionScreen,
  )
  assert.ok(decisionScreen)
  const action = decisionScreen.props.decisions[0]!.actions.find(({ kind }) => kind === "keep")
  assert.ok(action)
  await decisionScreen.props.onChooseAction(subject.decisionKey, action)
  tree = await renderSettled(harness)
  const conflict = findByType<React.ComponentProps<typeof Stage3SystemState>>(
    tree,
    Stage3SystemState,
  )
  assert.equal(conflict?.props.state, "conflict")
  assert.deepEqual(expectedRevisions, [0])
  const retry = conflict?.props.onAction
  assert.ok(retry)
  retry()
  await renderSettled(harness)

  assert.deepEqual(expectedRevisions, [0, 1])
})

test("a supplied bootstrap skips duplicate loading and Back uses its resolved entry context", async () => {
  const requirements: Stage3EntryContext["orderedCategories"] = [
    {
      category: "shampoo",
      requiredRoles: ["shampoo_everyday"],
      needSummary: "Sanfte Reinigung",
      authorityVersion: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
    },
    {
      category: "conditioner",
      requiredRoles: ["conditioner_rinse_out"],
      needSummary: "Pflege",
      authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
    },
    {
      category: "oil",
      requiredRoles: ["dry_finish"],
      needSummary: "Finish",
      authorityVersion: CATEGORY_ROLE_POLICIES.oil.authorityVersion,
    },
  ]
  const authoritySnapshot: Stage3AuthoritySnapshotV1 = {
    schemaVersion: 1 as const,
    refinedNeedVersionId: "refined-bootstrap-back",
    refinedInputHash: "hash-bootstrap-back",
    categoryDecisions: [],
    coverage: [],
    orderedCategories: requirements.map(({ category }) => category),
    authorityVersions: Object.fromEntries(
      requirements.map(({ category, authorityVersion }) => [category, authorityVersion]),
    ) as Stage3AuthoritySnapshotV1["authorityVersions"],
    productLoadContext: {
      schemaVersion: 1 as const,
      scalpOiliness: "balanced" as const,
      deepCleansingScalpPause: false,
      hasLowVolumeOrWeighedDown: false,
      shampooFrequency: "weekly_2x" as const,
      oilPurposes: ["dry_finish" as const],
      ownedCategories: ["shampoo" as const],
    },
  }
  const bootstrapDraft: Stage3ProductDraft = {
    ...createStage3Draft({
      draftId: "draft-bootstrap-back",
      userId: "user-bootstrap-back",
      personalPlanId: "plan-bootstrap-back",
      refinedVersionId: "refined-bootstrap-back",
      requirements,
      authoritySnapshot,
      now: "2026-08-09T00:00:00.000Z",
    }),
    completedCaptureCategories: ["shampoo", "conditioner"],
    categoryCursor: "oil",
  }
  const bootstrap: Stage3Bootstrap = {
    entryContext: {
      schemaVersion: 1,
      personalPlanId: bootstrapDraft.personalPlanId,
      refinedVersionId: bootstrapDraft.refinedVersionId,
      orderedCategories: requirements,
      inventoryPrompts: requirements.map(({ category }) => ({
        category,
        allowsMultiple: true,
        allowsExplicitNone: true,
      })),
      authoritySnapshot,
    },
    draft: bootstrapDraft,
    requirements,
    authorityEvaluations: [],
  }
  const reopened: string[] = []
  let loadCalls = 0
  const gateway = createAuthorityTestGateway()
  gateway.loadOrCreate = async () => {
    loadCalls += 1
    throw new Error("bootstrap must skip duplicate Stage 3 loading")
  }
  gateway.mutate = async (input) => {
    assert.equal(input.mutation.type, "reopen_capture_category")
    if (input.mutation.type !== "reopen_capture_category") throw new Error("unexpected mutation")
    reopened.push(input.mutation.category)
    return {
      status: "saved",
      draft: {
        ...bootstrapDraft,
        revision: bootstrapDraft.revision + 1,
        categoryCursor: input.mutation.category,
      },
    }
  }
  const harness = createClientStateHarness(() => Stage3ProductsFlow({ bootstrap, gateway }))

  let tree = await renderSettled(harness)
  const capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.categoryLabel, "Öl")
  assert.equal(loadCalls, 0)
  await capture?.props.onBack?.()
  tree = await renderSettled(harness)

  assert.deepEqual(reopened, ["shampoo"])
  assert.equal(
    findByType<React.ComponentProps<typeof ProductCaptureScreen>>(tree, ProductCaptureScreen)?.props
      .categoryLabel,
    "Shampoo",
  )
})

test("every capture category exposes a safe Back action", async () => {
  const gateway = createAuthorityTestGateway()
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-capture-back",
    refinedVersionId: "refined-capture-back",
    orderedCategories: [
      {
        category: "shampoo",
        requiredRoles: ["shampoo_everyday"],
        needSummary: "Sanfte Reinigung",
        authorityVersion: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
      },
      {
        category: "conditioner",
        requiredRoles: ["conditioner_rinse_out"],
        needSummary: "Pflege",
        authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
      },
    ],
    inventoryPrompts: [
      { category: "shampoo", allowsMultiple: true, allowsExplicitNone: true },
      { category: "conditioner", allowsMultiple: true, allowsExplicitNone: true },
    ],
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({
      entryContext,
      gateway,
      searchDebounceMs: 0,
      onBackToRefinement: () => {},
    }),
  )

  let tree = await renderSettled(harness)
  await captureCatalogProduct(harness, "Shampoo", "shampoo")
  tree = await renderSettled(harness)
  const firstCapture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(typeof firstCapture?.props.onBack, "function")
  firstCapture?.props.onContinue()
  await assignEveryRoleToFirstProduct(harness)

  tree = await renderSettled(harness)
  const laterCapture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(laterCapture?.props.categoryLabel, "Conditioner")
  assert.equal(typeof laterCapture?.props.onBack, "function")
})

test("editing from a server decision reopens that category through the persisted cursor", async () => {
  const gateway = createAuthorityTestGateway()
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-reopen-decision",
    refinedVersionId: "refined-reopen-decision",
    orderedCategories: [
      {
        category: "shampoo",
        requiredRoles: ["shampoo_everyday"],
        needSummary: "Sanfte Reinigung",
        authorityVersion: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
      },
    ],
    inventoryPrompts: [{ category: "shampoo", allowsMultiple: true, allowsExplicitNone: true }],
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({ entryContext, gateway, searchDebounceMs: 0 }),
  )

  let tree = await renderSettled(harness)
  await captureCatalogProduct(harness, "Shampoo", "shampoo")
  tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  await assignEveryRoleToFirstProduct(harness)
  tree = await renderSettled(harness)
  const decision = findByType<React.ComponentProps<typeof ProductDecisionScreen>>(
    tree,
    ProductDecisionScreen,
  )
  assert.ok(decision)
  decision.props.onBack()

  tree = await renderSettled(harness)
  assert.equal(
    findByType<React.ComponentProps<typeof ProductCaptureScreen>>(tree, ProductCaptureScreen)?.props
      .categoryLabel,
    "Shampoo",
  )
})

test("two-product Shampoo submits one complete category assignment replacement", async () => {
  const recordedMutationTypes: string[] = []
  const gateway = createAuthorityTestGateway()
  const originalMutate = gateway.mutate.bind(gateway)
  gateway.mutate = async (input) => {
    recordedMutationTypes.push(input.mutation.type)
    return originalMutate(input)
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-shampoo-atomic-roles",
    refinedVersionId: "refined-shampoo-atomic-roles",
    orderedCategories: [
      {
        category: "shampoo",
        requiredRoles: ["shampoo_everyday"],
        needSummary: "Sanfte Reinigung",
        authorityVersion: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
      },
    ],
    inventoryPrompts: [{ category: "shampoo", allowsMultiple: true, allowsExplicitNone: true }],
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({ entryContext, gateway, searchDebounceMs: 0 }),
  )

  let tree = await renderSettled(harness)
  await captureCatalogProduct(harness, "Shampoo", "shampoo")
  tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onAddAnotherProduct()
  await captureCatalogProduct(harness, "Shampoo", "shampoo")
  tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  tree = await renderSettled(harness)
  const roleScreen = findByType<React.ComponentProps<typeof SemanticRoleAssignment>>(
    tree,
    SemanticRoleAssignment,
  )
  assert.ok(roleScreen)
  roleScreen.props.onToggleRole(
    roleScreen.props.products[0]!.capturedProductId,
    "shampoo_everyday",
    true,
  )
  tree = await renderSettled(harness)
  await findByType<React.ComponentProps<typeof SemanticRoleAssignment>>(
    tree,
    SemanticRoleAssignment,
  )?.props.onContinue()
  tree = await renderSettled(harness)

  assert.ok(
    findByType<React.ComponentProps<typeof ProductDecisionScreen>>(tree, ProductDecisionScreen),
  )
  assert.deepEqual(recordedMutationTypes.slice(-1), ["finalize_capture_category"])
})

test("submitting an unchecked role deliberately records an open not-ready gap", async () => {
  let finalization:
    | Extract<
        Parameters<Stage3ProductsGateway["mutate"]>[0]["mutation"],
        { type: "finalize_capture_category" }
      >
    | undefined
  const gateway = createAuthorityTestGateway()
  const originalMutate = gateway.mutate.bind(gateway)
  gateway.mutate = async (input) => {
    if (input.mutation.type === "finalize_capture_category") finalization = input.mutation
    return originalMutate(input)
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-open-role-gap",
    refinedVersionId: "refined-open-role-gap",
    orderedCategories: [
      {
        category: "shampoo",
        requiredRoles: ["shampoo_everyday", "shampoo_dandruff"],
        needSummary: "Sanfte Reinigung und Schuppenpflege",
        authorityVersion: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
      },
    ],
    inventoryPrompts: [{ category: "shampoo", allowsMultiple: true, allowsExplicitNone: true }],
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({ entryContext, gateway, searchDebounceMs: 0 }),
  )

  await captureCatalogProduct(harness, "Shampoo", "shampoo")
  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onAddAnotherProduct()
  await captureCatalogProduct(harness, "Shampoo", "shampoo")
  tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  tree = await renderSettled(harness)
  let roles = findByType<React.ComponentProps<typeof SemanticRoleAssignment>>(
    tree,
    SemanticRoleAssignment,
  )
  assert.ok(roles)
  roles.props.onToggleRole(roles.props.products[0]!.capturedProductId, "shampoo_everyday", true)
  tree = await renderSettled(harness)
  roles = findByType<React.ComponentProps<typeof SemanticRoleAssignment>>(
    tree,
    SemanticRoleAssignment,
  )
  await roles?.props.onContinue()

  assert.deepEqual(finalization?.uncoveredRoles, [
    { category: "shampoo", role: "shampoo_dandruff", reason: "not_ready_to_decide" },
  ])
})

test("role finalization shows saving immediately and suppresses duplicate actions", async () => {
  let finalizationCalls = 0
  let blockMutations = false
  let release: () => void = () => {}
  const blocker = new Promise<void>((resolve) => {
    release = resolve
  })
  const gateway = createAuthorityTestGateway()
  const originalMutate = gateway.mutate.bind(gateway)
  gateway.mutate = async (input) => {
    if (blockMutations) {
      finalizationCalls += 1
      await blocker
    }
    return originalMutate(input)
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-role-saving",
    refinedVersionId: "refined-role-saving",
    orderedCategories: [
      {
        category: "shampoo",
        requiredRoles: ["shampoo_everyday"],
        needSummary: "Sanfte Reinigung",
        authorityVersion: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
      },
    ],
    inventoryPrompts: [{ category: "shampoo", allowsMultiple: true, allowsExplicitNone: true }],
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({ entryContext, gateway, searchDebounceMs: 0 }),
  )

  await renderSettled(harness)
  await captureCatalogProduct(harness, "Shampoo", "shampoo")
  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onAddAnotherProduct()
  await captureCatalogProduct(harness, "Shampoo", "shampoo")
  tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  tree = await renderSettled(harness)
  const roles = findByType<React.ComponentProps<typeof SemanticRoleAssignment>>(
    tree,
    SemanticRoleAssignment,
  )
  assert.ok(roles)
  roles.props.onToggleRole(roles.props.products[0]!.capturedProductId, "shampoo_everyday", true)
  tree = await renderSettled(harness)
  const readyRoles = findByType<React.ComponentProps<typeof SemanticRoleAssignment>>(
    tree,
    SemanticRoleAssignment,
  )
  assert.ok(readyRoles)
  blockMutations = true
  readyRoles.props.onContinue()
  readyRoles.props.onContinue()

  tree = await harness.render()
  const saving = findByType<React.ComponentProps<typeof Stage3SystemState>>(tree, Stage3SystemState)
  assert.equal(finalizationCalls, 1)
  assert.equal(saving?.props.state, "loading")
  assert.match(saving?.props.title ?? "", /gespeichert/i)
  release()
  await renderSettled(harness)
})

test("no-product capture finalizes every gap with one mutation", async () => {
  const recordedMutationTypes: string[] = []
  const gateway = createAuthorityTestGateway()
  const originalMutate = gateway.mutate.bind(gateway)
  gateway.mutate = async (input) => {
    recordedMutationTypes.push(input.mutation.type)
    return originalMutate(input)
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-no-product-atomic",
    refinedVersionId: "refined-no-product-atomic",
    orderedCategories: [
      {
        category: "heat_protectant",
        requiredRoles: ["pre_heat_protection"],
        qualifyingRoutes: ["direct_contact_heat"],
        needSummary: "Schutz vor Hitze",
        authorityVersion: CATEGORY_ROLE_POLICIES.heat_protectant.authorityVersion,
      },
    ],
    inventoryPrompts: [
      { category: "heat_protectant", allowsMultiple: true, allowsExplicitNone: true },
    ],
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({ entryContext, gateway, searchDebounceMs: 0 }),
  )

  const tree = await renderSettled(harness)
  const capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.ok(capture?.props.onExplicitNone)
  await capture.props.onExplicitNone()

  assert.deepEqual(recordedMutationTypes, ["finalize_capture_category"])
})

test("no-product finalization shows saving immediately and suppresses duplicate actions", async () => {
  let finalizationCalls = 0
  let release: () => void = () => {}
  const blocker = new Promise<void>((resolve) => {
    release = resolve
  })
  const gateway = createAuthorityTestGateway()
  const originalMutate = gateway.mutate.bind(gateway)
  gateway.mutate = async (input) => {
    finalizationCalls += 1
    await blocker
    return originalMutate(input)
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-no-product-saving",
    refinedVersionId: "refined-no-product-saving",
    orderedCategories: [
      {
        category: "heat_protectant",
        requiredRoles: ["pre_heat_protection"],
        qualifyingRoutes: ["direct_contact_heat"],
        needSummary: "Schutz vor Hitze",
        authorityVersion: CATEGORY_ROLE_POLICIES.heat_protectant.authorityVersion,
      },
    ],
    inventoryPrompts: [
      { category: "heat_protectant", allowsMultiple: true, allowsExplicitNone: true },
    ],
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({ entryContext, gateway, searchDebounceMs: 0 }),
  )

  let tree = await renderSettled(harness)
  const capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.ok(capture?.props.onExplicitNone)
  capture.props.onExplicitNone()
  capture.props.onExplicitNone()

  tree = await harness.render()
  const saving = findByType<React.ComponentProps<typeof Stage3SystemState>>(tree, Stage3SystemState)
  assert.equal(finalizationCalls, 1)
  assert.equal(saving?.props.state, "loading")
  release()
  await renderSettled(harness)
})

test("unsupported authority offers a non-decision recovery exit to refinement", async () => {
  let refinementExits = 0
  const gateway = createAuthorityTestGateway({
    evaluate: (_draft, subject) => ({
      status: "unsupported",
      category: subject.category,
      subjectKey: subject.decisionKey,
      reason: "authority_target_unavailable",
      allowedActions: [],
      coverageRuleIds: [],
    }),
  })
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-unsupported-recovery",
    refinedVersionId: "refined-unsupported-recovery",
    orderedCategories: [
      {
        category: "shampoo",
        requiredRoles: ["shampoo_everyday"],
        needSummary: "Sanfte Reinigung",
        authorityVersion: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
      },
    ],
    inventoryPrompts: [{ category: "shampoo", allowsMultiple: true, allowsExplicitNone: true }],
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({
      entryContext,
      gateway,
      searchDebounceMs: 0,
      onBackToRefinement: () => {
        refinementExits += 1
      },
    }),
  )

  let tree = await renderSettled(harness)
  await captureCatalogProduct(harness, "Shampoo", "shampoo")
  tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  await assignEveryRoleToFirstProduct(harness)
  tree = await renderSettled(harness)

  const decision = findByType<React.ComponentProps<typeof ProductDecisionScreen>>(
    tree,
    ProductDecisionScreen,
  )
  assert.equal(decision?.props.decisions[0]?.actions.length, 0)
  const recovery = findByType<React.ComponentProps<typeof Button>>(tree, Button)
  assert.equal(textContent(recovery), "Zur Verfeinerung")
  recovery?.props.onClick?.(undefined as never)
  assert.equal(refinementExits, 1)
})

test("the production-default Stage 3 flow keeps vendor analytics inert", async () => {
  const destinations = [postHogDestination, customerIoDestination, metaDestination] as const
  const originalTracks = destinations.map((destination) => destination.track)
  const calls: unknown[][] = []

  try {
    for (const destination of destinations) {
      destination.track = ((...args: unknown[]) => {
        calls.push(args)
        return true
      }) as typeof destination.track
    }

    const gateway = createAuthorityTestGateway()
    const harness = createClientStateHarness(() =>
      Stage3ProductsFlow({ searchDebounceMs: 0, gateway }),
    )
    let tree = await renderSettled(harness)
    assert.ok(findByType(tree, ProductCaptureScreen))
  } finally {
    for (const [index, destination] of destinations.entries()) {
      destination.track = originalTracks[index] as typeof destination.track
    }
  }

  assert.deepEqual(calls, [])
})

test("integrated Stage 3 consumes the supplied refined entry context instead of fixture requirements", async () => {
  const gateway = createAuthorityTestGateway()
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "fixture-personal-plan-integrated",
    refinedVersionId: "fixture-refined-integrated-r12",
    orderedCategories: [
      {
        category: "shampoo",
        requiredRoles: ["shampoo_everyday"],
        needSummary: "Sanfte Reinigung für deine empfindliche Kopfhaut.",
        authorityVersion: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
      },
    ],
    inventoryPrompts: [
      {
        category: "shampoo",
        allowsMultiple: CATEGORY_ROLE_POLICIES.shampoo.allowsMultiple,
        allowsExplicitNone: true,
      },
    ],
  }

  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({
      entryContext,
      draftId: "fixture-stage3-integrated",
      userId: "fixture-user-integrated",
      searchDebounceMs: 0,
      gateway,
    }),
  )
  let tree = await renderSettled(harness)
  const capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.categoryLabel, "Shampoo")
  assert.equal(capture?.props.needSummary, entryContext.orderedCategories[0]?.needSummary)
})

test("production intake retries retain one idempotency identity after a transport failure", async () => {
  const gateway = createAuthorityTestGateway()
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-intake-retry",
    refinedVersionId: "refined-intake-retry",
    orderedCategories: [
      {
        category: "shampoo",
        requiredRoles: ["shampoo_everyday"],
        needSummary: "Sanfte Reinigung",
        authorityVersion: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
      },
    ],
    inventoryPrompts: [{ category: "shampoo", allowsMultiple: true, allowsExplicitNone: true }],
  }
  const keys: string[] = []
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({
      entryContext,
      draftId: "fixture-stage3-intake-retry",
      userId: "fixture-user-intake-retry",
      searchDebounceMs: 0,
      gateway,
      intakeClient: {
        submit: async (input) => {
          keys.push(input.idempotencyKey)
          throw new Error("transport")
        },
      },
    }),
  )

  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onOpenFallbackIntake()
  tree = await renderSettled(harness)
  let fallback = findByType<React.ComponentProps<typeof IntakeFallbackBoundary>>(
    tree,
    IntakeFallbackBoundary,
  )
  fallback?.props.onFrequencyChange("weekly_1x")
  fallback?.props.onProductNameChange?.("Test Shampoo")
  tree = await renderSettled(harness)
  fallback = findByType<React.ComponentProps<typeof IntakeFallbackBoundary>>(
    tree,
    IntakeFallbackBoundary,
  )
  fallback?.props.onOpen()
  await new Promise((resolve) => setImmediate(resolve))
  tree = await renderSettled(harness)
  fallback = findByType<React.ComponentProps<typeof IntakeFallbackBoundary>>(
    tree,
    IntakeFallbackBoundary,
  )
  fallback?.props.onRetry?.()
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(keys.length, 2)
  assert.equal(keys[0], keys[1])
})

test("fallback intake requires and persists the user's selected product frequency", async () => {
  const submittedFrequencies: string[] = []
  const gateway = createAuthorityTestGateway()
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({
      searchDebounceMs: 0,
      gateway,
      intakeClient: {
        submit: async ({ input }) => {
          submittedFrequencies.push(input.frequency_range)
          throw new Error("synthetic transport failure")
        },
      },
    }),
  )

  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onOpenFallbackIntake()
  tree = await renderSettled(harness)
  let fallback = findByType<React.ComponentProps<typeof IntakeFallbackBoundary>>(
    tree,
    IntakeFallbackBoundary,
  )

  fallback?.props.onOpen()
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(submittedFrequencies, [])

  tree = await renderSettled(harness)
  fallback = findByType<React.ComponentProps<typeof IntakeFallbackBoundary>>(
    tree,
    IntakeFallbackBoundary,
  )
  fallback?.props.onFrequencyChange("weekly_1x")
  fallback?.props.onProductNameChange?.("Test Shampoo")
  tree = await renderSettled(harness)
  fallback = findByType<React.ComponentProps<typeof IntakeFallbackBoundary>>(
    tree,
    IntakeFallbackBoundary,
  )
  fallback?.props.onOpen()
  await new Promise((resolve) => setImmediate(resolve))

  assert.deepEqual(submittedFrequencies, ["weekly_1x"])
})

test("either final pending-product action advances beyond the decision card", async () => {
  for (const actionKind of ["pending", "skip"] as const) {
    const intents: Stage3AuthoritySemanticIntent[] = []
    const gateway = createAuthorityTestGateway({ onIntent: (intent) => intents.push(intent) })
    const entryContext: Stage3EntryContext = {
      schemaVersion: 1,
      personalPlanId: `plan-pending-${actionKind}`,
      refinedVersionId: `refined-pending-${actionKind}`,
      orderedCategories: [
        {
          category: "scalp_care",
          requiredRoles: ["scalp_comfort"],
          needSummary: "Kopfhaut beruhigen",
          authorityVersion: CATEGORY_ROLE_POLICIES.scalp_care.authorityVersion,
        },
      ],
      inventoryPrompts: [
        { category: "scalp_care", allowsMultiple: true, allowsExplicitNone: true },
      ],
    }
    const handoffs: Stage3RoutineHandoff[] = []
    const harness = createClientStateHarness(() =>
      Stage3ProductsFlow({
        entryContext,
        gateway,
        searchDebounceMs: 0,
        handoffRecoveryDelayMs: 0,
        onOpenRoutine: (handoff) => handoffs.push(handoff),
      }),
    )

    let tree = await renderSettled(harness)
    findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
      tree,
      ProductCaptureScreen,
    )?.props.onOpenFallbackIntake()
    tree = await renderSettled(harness)
    let fallback = findByType<React.ComponentProps<typeof IntakeFallbackBoundary>>(
      tree,
      IntakeFallbackBoundary,
    )
    fallback?.props.onFrequencyChange("weekly_1x")
    fallback?.props.onProductNameChange?.("Kopfhaut-Tonic")
    tree = await renderSettled(harness)
    fallback = findByType<React.ComponentProps<typeof IntakeFallbackBoundary>>(
      tree,
      IntakeFallbackBoundary,
    )
    await fallback?.props.onOpen()
    tree = await renderSettled(harness)
    findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
      tree,
      ProductCaptureScreen,
    )?.props.onContinue()
    await assignEveryRoleToFirstProduct(harness)
    tree = await renderSettled(harness)
    await chooseDecision(harness, actionKind)
    tree = await renderSettled(harness)

    assert.equal(
      findByType<React.ComponentProps<typeof ProductDecisionScreen>>(tree, ProductDecisionScreen),
      null,
      `${actionKind} should advance past the final pending decision`,
    )
    assert.equal(handoffs.length, 1)
    const recovery = findByType<React.ComponentProps<typeof Stage3SystemState>>(
      tree,
      Stage3SystemState,
    )
    assert.equal(recovery?.props.actionLabel, "Routine öffnen")
    recovery?.props.onAction?.()
    assert.equal(handoffs.length, 2, "the delayed recovery retries the direct handoff")
    assert.deepEqual(
      intents.map((intent) => intent.action),
      [actionKind === "pending" ? "keep_pending" : "leave_uncovered"],
    )
  }
})

test("pending decision shows saving synchronously and suppresses a second immediate intent", async () => {
  const intents: Stage3AuthoritySemanticIntent[] = []
  const gateway = createAuthorityTestGateway({ onIntent: (intent) => intents.push(intent) })
  const originalResolveDecision = gateway.resolveDecision.bind(gateway)
  let releaseFirstDecision!: () => void
  const firstDecisionPending = new Promise<void>((resolve) => {
    releaseFirstDecision = resolve
  })
  let resolveCalls = 0
  gateway.resolveDecision = async (input) => {
    resolveCalls += 1
    await firstDecisionPending
    return originalResolveDecision(input)
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-pending-double-submit",
    refinedVersionId: "refined-pending-double-submit",
    orderedCategories: [
      {
        category: "scalp_care",
        requiredRoles: ["scalp_comfort"],
        needSummary: "Kopfhaut beruhigen",
        authorityVersion: CATEGORY_ROLE_POLICIES.scalp_care.authorityVersion,
      },
    ],
    inventoryPrompts: [{ category: "scalp_care", allowsMultiple: true, allowsExplicitNone: true }],
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({ entryContext, gateway, searchDebounceMs: 0 }),
  )

  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onOpenFallbackIntake()
  tree = await renderSettled(harness)
  let fallback = findByType<React.ComponentProps<typeof IntakeFallbackBoundary>>(
    tree,
    IntakeFallbackBoundary,
  )
  fallback?.props.onFrequencyChange("weekly_1x")
  fallback?.props.onProductNameChange?.("Kopfhaut-Tonic")
  tree = await renderSettled(harness)
  fallback = findByType<React.ComponentProps<typeof IntakeFallbackBoundary>>(
    tree,
    IntakeFallbackBoundary,
  )
  fallback?.props.onOpen()
  tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  await assignEveryRoleToFirstProduct(harness)
  tree = await renderSettled(harness)
  const decisionScreen = findByType<React.ComponentProps<typeof ProductDecisionScreen>>(
    tree,
    ProductDecisionScreen,
  )
  assert.ok(decisionScreen)
  const decision = decisionScreen.props.decisions[0]!
  const pendingAction = decision.actions.find((action) => action.kind === "pending")
  assert.ok(pendingAction)

  decisionScreen.props.onChooseAction(decision.decisionKey, pendingAction)
  decisionScreen.props.onChooseAction(decision.decisionKey, pendingAction)

  assert.equal(resolveCalls, 1)
  tree = await harness.render()
  assert.equal(
    findByType<React.ComponentProps<typeof Stage3Shell>>(tree, Stage3Shell)?.props.saveState.status,
    "saving",
  )
  assert.equal(
    findByType<React.ComponentProps<typeof Stage3SystemState>>(tree, Stage3SystemState)?.props
      .state,
    "loading",
  )
  assert.match(
    findByType<React.ComponentProps<typeof Stage3SystemState>>(tree, Stage3SystemState)?.props
      .message ?? "",
    /nächsten offenen Schritt/i,
  )

  releaseFirstDecision()
  await new Promise((resolve) => setImmediate(resolve))
  await renderSettled(harness)
  assert.equal(resolveCalls, 1)
  assert.deepEqual(
    intents.map((intent) => intent.action),
    ["keep_pending"],
  )
})

test("grouped clear-fit acceptance shows saving and suppresses a second immediate batch", async () => {
  const gateway = createAuthorityTestGateway({
    evaluate(draft, subject) {
      const evaluation = testAuthorityEvaluation(draft, subject)
      assert.equal(evaluation.status, "known")
      return {
        ...evaluation,
        verdict: "ideal",
        allowedActions: ["keep_owned"],
        recommendation: null,
        recommendationFactFingerprint: null,
      }
    },
  })
  const originalResolveDecision = gateway.resolveDecision.bind(gateway)
  let releaseFirstDecision!: () => void
  const firstDecisionPending = new Promise<void>((resolve) => {
    releaseFirstDecision = resolve
  })
  let batchCalls = 0
  let singleCalls = 0
  gateway.resolveDecision = async (input) => {
    singleCalls += 1
    return originalResolveDecision(input)
  }
  const batchGateway = gateway as typeof gateway & {
    resolveDecisions(input: {
      draftId: string
      expectedRevision: number
      intents: Stage3AuthoritySemanticIntent[]
    }): Promise<Stage3MutationResponse>
  }
  batchGateway.resolveDecisions = async (input) => {
    batchCalls += 1
    await firstDecisionPending
    let nextRevision = input.expectedRevision
    let response: Stage3MutationResponse | null = null
    for (const intent of input.intents) {
      response = await originalResolveDecision({ ...input, expectedRevision: nextRevision, intent })
      if (response.status === "conflict") return response
      nextRevision = response.draft.revision
    }
    assert.ok(response)
    return response
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-clear-fit-double-submit",
    refinedVersionId: "refined-clear-fit-double-submit",
    orderedCategories: [
      {
        category: "conditioner",
        requiredRoles: ["conditioner_rinse_out"],
        needSummary: "Pflege nach der Wäsche",
        authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
      },
    ],
    inventoryPrompts: [{ category: "conditioner", allowsMultiple: true, allowsExplicitNone: true }],
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({ entryContext, gateway, searchDebounceMs: 0 }),
  )

  await captureCatalogProduct(harness, "Conditioner", "condition", 0)
  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onAddAnotherProduct()
  await captureCatalogProduct(harness, "Conditioner", "condition", 1)
  tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  tree = await renderSettled(harness)
  let roles = findByType<React.ComponentProps<typeof SemanticRoleAssignment>>(
    tree,
    SemanticRoleAssignment,
  )
  assert.ok(roles)
  for (const product of roles.props.products) {
    roles.props.onToggleRole(product.capturedProductId, "conditioner_rinse_out", true)
  }
  tree = await renderSettled(harness)
  roles = findByType<React.ComponentProps<typeof SemanticRoleAssignment>>(
    tree,
    SemanticRoleAssignment,
  )
  roles?.props.onContinue()
  tree = await renderSettled(harness)
  const grouped = findByType<React.ComponentProps<typeof ProductDecisionScreen>>(
    tree,
    ProductDecisionScreen,
  )
  assert.equal(grouped?.props.groupClearFits, true)
  assert.equal(grouped?.props.decisions.length, 2)
  assert.ok(grouped.props.onAcceptClearFits)

  grouped.props.onAcceptClearFits()
  grouped.props.onAcceptClearFits()

  assert.equal(batchCalls, 1)
  assert.equal(singleCalls, 0)
  tree = await harness.render()
  assert.equal(
    findByType<React.ComponentProps<typeof Stage3Shell>>(tree, Stage3Shell)?.props.saveState.status,
    "saving",
  )
  assert.equal(
    findByType<React.ComponentProps<typeof Stage3SystemState>>(tree, Stage3SystemState)?.props
      .state,
    "loading",
  )

  releaseFirstDecision()
  await new Promise((resolve) => setImmediate(resolve))
  await renderSettled(harness)
  assert.equal(batchCalls, 1)
  assert.equal(singleCalls, 0)
})

test("Oil resolves checked use and unchecked gaps without replaying decision cards", async () => {
  const intents: Stage3AuthoritySemanticIntent[] = []
  const handoffs: Stage3RoutineHandoff[] = []
  const gateway = createAuthorityTestGateway({ onIntent: (intent) => intents.push(intent) })
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-oil-checkbox-first",
    refinedVersionId: "refined-oil-checkbox-first",
    orderedCategories: [
      {
        category: "oil",
        requiredRoles: ["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"],
        needSummary: "Schutz und Finish für deine Längen",
        authorityVersion: CATEGORY_ROLE_POLICIES.oil.authorityVersion,
      },
    ],
    inventoryPrompts: [{ category: "oil", allowsMultiple: true, allowsExplicitNone: true }],
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({
      entryContext,
      gateway,
      searchDebounceMs: 0,
      onOpenRoutine: (handoff) => handoffs.push(handoff),
    }),
  )

  await captureCatalogProduct(harness, "Öl", "oil")
  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  tree = await renderSettled(harness)
  const roles = findByType<React.ComponentProps<typeof SemanticRoleAssignment>>(
    tree,
    SemanticRoleAssignment,
  )
  assert.ok(roles)
  roles.props.onToggleRole(roles.props.products[0]!.capturedProductId, "dry_finish", true)
  tree = await renderSettled(harness)
  await findByType<React.ComponentProps<typeof SemanticRoleAssignment>>(
    tree,
    SemanticRoleAssignment,
  )?.props.onContinue()
  tree = await renderSettled(harness)

  assert.equal(
    findByType<React.ComponentProps<typeof ProductDecisionScreen>>(tree, ProductDecisionScreen),
    null,
  )
  assert.deepEqual(
    intents.map((intent) => intent.action),
    ["leave_uncovered", "leave_uncovered", "keep_owned"],
  )
  assert.equal(handoffs.length, 1)
})

test("bootstrapped Oil decisions auto-resolve sole safe actions before review", async () => {
  const requirements: Stage3EntryContext["orderedCategories"] = [
    {
      category: "oil",
      requiredRoles: ["dry_finish"],
      needSummary: "Finish für die Längen",
      authorityVersion: CATEGORY_ROLE_POLICIES.oil.authorityVersion,
    },
  ]
  const initialDraft = createStage3Draft({
    draftId: "draft-oil-bootstrap-auto",
    userId: "user-oil-bootstrap-auto",
    personalPlanId: "plan-oil-bootstrap-auto",
    refinedVersionId: "refined-oil-bootstrap-auto",
    requirements,
    now: "2026-08-10T00:00:00.000Z",
  })
  let latestDraft: Stage3ProductDraft = {
    ...initialDraft,
    revision: 1,
    pass: "product_decisions",
    categoryCursor: null,
    uncoveredRoles: [{ category: "oil", role: "dry_finish", reason: "no_product_owned" }],
  }
  const subject = deriveStage3DecisionSubjects(latestDraft)[0]!
  const evaluation = testAuthorityEvaluation(latestDraft, subject)
  const intents: Stage3AuthoritySemanticIntent[] = []
  const base = createFixtureStage3Gateway({ searchDelayMs: 0 })
  const gateway = {
    ...base,
    async resolveDecision(input: {
      draftId: string
      expectedRevision: number
      intent: Stage3AuthoritySemanticIntent
    }): Promise<Stage3MutationResponse> {
      intents.push(input.intent)
      const decision = testAuthorityDecision(subject, evaluation, input.intent)
      latestDraft = {
        ...latestDraft,
        revision: latestDraft.revision + 1,
        decisions: [...latestDraft.decisions, decision],
      }
      return { status: "saved", draft: latestDraft }
    },
    async complete() {
      return { status: "not_ready" as const, draft: latestDraft }
    },
  }
  const bootstrap: Stage3Bootstrap = {
    entryContext: {
      schemaVersion: 1,
      personalPlanId: latestDraft.personalPlanId,
      refinedVersionId: latestDraft.refinedVersionId,
      orderedCategories: requirements,
      inventoryPrompts: [{ category: "oil", allowsMultiple: true, allowsExplicitNone: true }],
    },
    draft: latestDraft,
    requirements,
    authorityEvaluations: [evaluation],
  }
  const harness = createClientStateHarness(() => Stage3ProductsFlow({ bootstrap, gateway }))

  const tree = await renderSettled(harness)

  assert.deepEqual(
    intents.map((intent) => intent.action),
    ["leave_uncovered"],
  )
  assert.equal(
    findByType<React.ComponentProps<typeof ProductDecisionScreen>>(tree, ProductDecisionScreen),
    null,
  )
})

test("assigning an Oil use to another product moves the exclusive checkbox", () => {
  const assignments = updateStage3RoleAssignments(
    { "oil-1": ["dry_finish", "pre_wash_fibre_treatment"], "oil-2": [] },
    "oil-2",
    "dry_finish",
    true,
    true,
  )

  assert.deepEqual(assignments, {
    "oil-1": ["pre_wash_fibre_treatment"],
    "oil-2": ["dry_finish"],
  })
})

test("Oil consolidates genuine role choices while auto-resolving the safe role", async () => {
  const intents: Stage3AuthoritySemanticIntent[] = []
  const gateway = createAuthorityTestGateway({
    onIntent: (intent) => intents.push(intent),
    evaluate(draft, subject) {
      const evaluation = testAuthorityEvaluation(draft, subject)
      if (subject.role === "dry_finish") return evaluation
      assert.equal(evaluation.status, "known")
      return {
        ...evaluation,
        verdict: "mismatch",
        allowedActions: ["plan_recommendation", "acknowledge_override"],
        recommendation: {
          recommendationId: `recommend:${subject.decisionKey}`,
          productId: `recommended:${subject.decisionKey}`,
          category: "oil",
          role: subject.role,
          displayName: "Passenderes Öl",
          reason: "Passt besser zur Verwendung.",
          authorityRuleId: "test.authority",
        },
        recommendationFactFingerprint: `facts:recommend:${subject.decisionKey}`,
      }
    },
  })
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-oil-consolidated-choices",
    refinedVersionId: "refined-oil-consolidated-choices",
    orderedCategories: [
      {
        category: "oil",
        requiredRoles: ["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"],
        needSummary: "Schutz und Finish für deine Längen",
        authorityVersion: CATEGORY_ROLE_POLICIES.oil.authorityVersion,
      },
    ],
    inventoryPrompts: [{ category: "oil", allowsMultiple: true, allowsExplicitNone: true }],
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({ entryContext, gateway, searchDebounceMs: 0 }),
  )

  await captureCatalogProduct(harness, "Öl", "oil")
  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  await assignEveryRoleToFirstProduct(harness)
  tree = await renderSettled(harness)

  const screen = findByType<React.ComponentProps<typeof ProductDecisionScreen>>(
    tree,
    ProductDecisionScreen,
  )
  assert.ok(screen)
  assert.equal(screen.props.consolidated, true)
  assert.deepEqual(
    screen.props.decisions.map((decision) => decision.roleLabel),
    ["Vor der Haarwäsche", "Im feuchten Haar"],
  )
  assert.deepEqual(
    intents.map((intent) => intent.action),
    ["keep_owned"],
  )
})

test("interactive lab flow captures products first, assigns roles, decides fit, and displays a typed handoff", async () => {
  const intents: Stage3AuthoritySemanticIntent[] = []
  const gateway = createAuthorityTestGateway({ onIntent: (intent) => intents.push(intent) })
  const handoffs: Stage3RoutineHandoff[] = []
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({
      searchDebounceMs: 0,
      gateway,
      onOpenRoutine: (handoff) => handoffs.push(handoff),
    }),
  )
  let tree = await renderSettled(harness)

  await captureCatalogProduct(harness, "Conditioner", "condition", 0)
  tree = await renderSettled(harness)
  let capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  capture?.props.onAddAnotherProduct()
  await captureCatalogProduct(harness, "Conditioner", "condition", 1)
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  capture?.props.onContinue()
  tree = await renderSettled(harness)
  let roleScreen = findByType<React.ComponentProps<typeof SemanticRoleAssignment>>(
    tree,
    SemanticRoleAssignment,
  )
  assert.equal(roleScreen?.props.category, "conditioner")
  for (const product of roleScreen.props.products) {
    roleScreen.props.onToggleRole(product.capturedProductId, "conditioner_rinse_out", true)
  }
  tree = await renderSettled(harness)
  roleScreen = findByType<React.ComponentProps<typeof SemanticRoleAssignment>>(
    tree,
    SemanticRoleAssignment,
  )
  roleScreen?.props.onContinue()

  await captureCatalogProduct(harness, "Öl", "oil")
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  capture?.props.onContinue()
  await assignEveryRoleToFirstProduct(harness)

  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.categoryLabel, "Kopfhautprodukt")
  capture.props.onQueryChange("unbekanntes tonic")
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.searchStatus, "empty")
  capture.props.onOpenFallbackIntake()
  tree = await renderSettled(harness)
  const fallback = findByType<React.ComponentProps<typeof IntakeFallbackBoundary>>(
    tree,
    IntakeFallbackBoundary,
  )
  assert.equal(fallback?.props.status, "idle")
  fallback?.props.onFrequencyChange("weekly_1x")
  fallback?.props.onProductNameChange?.("Kopfhaut-Tonic")
  tree = await renderSettled(harness)
  const readyFallback = findByType<React.ComponentProps<typeof IntakeFallbackBoundary>>(
    tree,
    IntakeFallbackBoundary,
  )
  await readyFallback?.props.onOpen()
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  capture?.props.onContinue()
  await assignEveryRoleToFirstProduct(harness)

  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.categoryLabel, "Hitzeschutz")
  capture.props.onQueryChange("kein treffer")
  tree = await renderSettled(harness)
  assert.equal(
    findByType<React.ComponentProps<typeof ProductCaptureScreen>>(tree, ProductCaptureScreen)?.props
      .searchStatus,
    "empty",
  )
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.ok(capture?.props.onExplicitNone)
  await capture.props.onExplicitNone()

  await chooseDecision(harness, "keep")
  await chooseDecision(harness, "plan_purchase")
  await chooseDecision(harness, "pending")
  await chooseDecision(harness, "skip")

  tree = await renderSettled(harness)
  assert.equal(handoffs.length, 1)
  assert.equal(handoffs[0]?.next.href, "/routine")
  assert.match(handoffs[0]?.productPortfolioVersionId ?? "", /^fixture-portfolio-/)
  assert.equal(
    intents.some((intent) => intent.action === "keep_pending"),
    true,
  )
})
