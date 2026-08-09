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
  Stage3SystemState,
  Stage3Transition,
  type Stage3DecisionAction,
} from "../src/components/personal-plan-products"
import {
  PortfolioHandoff,
  Stage3ProductsFlow,
  type Stage3RoutineHandoff,
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
  type Stage3EntryContext,
  type Stage3ProductDecision,
  type Stage3ProductDraft,
} from "../src/lib/personal-plan/products/contracts"
import { createFixtureStage3Gateway } from "../src/lib/personal-plan/products/fixture-gateway"
import type {
  Stage3MutationResponse,
  Stage3ProductsGateway,
} from "../src/lib/personal-plan/products/gateway"
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
  assert.ok(roleScreen)
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

  assert.match(routeSource, /isPersonalPlanStage3LabEnabled\(process\.env\)/)
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

test("only the first capture category exposes a Back action", async () => {
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
    Stage3ProductsFlow({ entryContext, gateway, searchDebounceMs: 0 }),
  )

  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof Stage3Transition>>(
    tree,
    Stage3Transition,
  )?.props.onContinue()
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
  assert.equal(laterCapture?.props.onBack, undefined)
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
  findByType<React.ComponentProps<typeof Stage3Transition>>(
    tree,
    Stage3Transition,
  )?.props.onContinue()
  await captureCatalogProduct(harness, "Shampoo", "shampoo")
  tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  await assignEveryRoleToFirstProduct(harness)
  tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof Stage3Transition>>(
    tree,
    Stage3Transition,
  )?.props.onContinue()
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
  findByType<React.ComponentProps<typeof Stage3Transition>>(
    tree,
    Stage3Transition,
  )?.props.onContinue()
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

  assert.equal(
    findByType<React.ComponentProps<typeof Stage3Transition>>(tree, Stage3Transition)?.props
      .context,
    "fit_check",
  )
  assert.deepEqual(recordedMutationTypes.slice(-2), [
    "replace_category_role_assignments",
    "complete_capture_category",
  ])
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
  findByType<React.ComponentProps<typeof Stage3Transition>>(
    tree,
    Stage3Transition,
  )?.props.onContinue()
  await captureCatalogProduct(harness, "Shampoo", "shampoo")
  tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  await assignEveryRoleToFirstProduct(harness)
  tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof Stage3Transition>>(
    tree,
    Stage3Transition,
  )?.props.onContinue()
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
    const transition = findByType<React.ComponentProps<typeof Stage3Transition>>(
      tree,
      Stage3Transition,
    )
    transition?.props.onContinue()
    tree = await renderSettled(harness)
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
  const transition = findByType<React.ComponentProps<typeof Stage3Transition>>(
    tree,
    Stage3Transition,
  )
  assert.equal(transition?.props.context, "product_capture")
  transition?.props.onContinue()

  tree = await renderSettled(harness)
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
  findByType<React.ComponentProps<typeof Stage3Transition>>(
    tree,
    Stage3Transition,
  )?.props.onContinue()
  tree = await renderSettled(harness)
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
  findByType<React.ComponentProps<typeof Stage3Transition>>(
    tree,
    Stage3Transition,
  )?.props.onContinue()
  tree = await renderSettled(harness)
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
  tree = await renderSettled(harness)
  fallback = findByType<React.ComponentProps<typeof IntakeFallbackBoundary>>(
    tree,
    IntakeFallbackBoundary,
  )
  fallback?.props.onOpen()
  await new Promise((resolve) => setImmediate(resolve))

  assert.deepEqual(submittedFrequencies, ["weekly_1x"])
})

test("pending UI actions send distinct keep and leave-uncovered semantic intents", async () => {
  const intents: Stage3AuthoritySemanticIntent[] = []
  const gateway = createAuthorityTestGateway({ onIntent: (intent) => intents.push(intent) })
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-pending-skip",
    refinedVersionId: "refined-pending-skip",
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
  findByType<React.ComponentProps<typeof Stage3Transition>>(
    tree,
    Stage3Transition,
  )?.props.onContinue()
  tree = await renderSettled(harness)
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
  findByType<React.ComponentProps<typeof Stage3Transition>>(
    tree,
    Stage3Transition,
  )?.props.onContinue()
  await chooseDecision(harness, "skip")

  assert.deepEqual(
    intents.map((intent) => intent.action),
    ["leave_uncovered"],
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

  let transition = findByType<React.ComponentProps<typeof Stage3Transition>>(tree, Stage3Transition)
  assert.equal(transition?.props.context, "product_capture")
  transition.props.onContinue()

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

  tree = await renderSettled(harness)
  transition = findByType<React.ComponentProps<typeof Stage3Transition>>(tree, Stage3Transition)
  assert.equal(transition?.props.context, "fit_check")
  transition.props.onContinue()

  await chooseDecision(harness, "keep")
  await chooseDecision(harness, "plan_purchase")
  await chooseDecision(harness, "keep")
  await chooseDecision(harness, "keep")
  await chooseDecision(harness, "keep")
  await chooseDecision(harness, "pending")
  await chooseDecision(harness, "skip")

  tree = await renderSettled(harness)
  assert.equal(
    findByType<React.ComponentProps<typeof Stage3SystemState>>(tree, Stage3SystemState),
    null,
  )
  const handoff = findByType<React.ComponentProps<typeof PortfolioHandoff>>(tree, PortfolioHandoff)
  assert.ok(handoff)
  const handoffText = textContent(PortfolioHandoff(handoff.props))
  assert.match(handoffText, /Routine öffnen/)
  assert.doesNotMatch(handoffText, /fixture-portfolio-|fixture-routine-proposal-/)
  assert.equal(handoff.props.completion.portfolio.ownedProducts.length, 4)
  assert.equal(handoff.props.completion.portfolio.plannedPurchases.length, 1)
  assert.equal(handoff.props.completion.portfolio.pendingProducts.length, 1)
  assert.equal(handoff.props.completion.portfolio.uncoveredRoles.length, 3)
  assert.doesNotMatch(handoffText, /\b(?:Pass|Teil\s+\d|Stage|Stufe)\b/i)
  handoff.props.onOpenRoutine?.()
  assert.equal(handoffs.length, 1)
  assert.equal(handoffs[0]?.next.href, "/routine")
  assert.match(handoffs[0]?.productPortfolioVersionId ?? "", /^fixture-portfolio-/)
  assert.equal(
    intents.some((intent) => intent.action === "keep_pending"),
    true,
  )
})
