import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
  IntakeFallbackBoundary,
  ProductCaptureScreen,
  ProductKindReviewScreen,
  SemanticRoleAssignment,
  Stage3Shell,
  Stage3SystemState,
  Stage3Transition,
} from "../src/components/personal-plan-products"
import {
  Stage3InventoryDispositionReview,
  Stage3CategoryFinalizing,
  Stage3NeedRevisionCheckpoint,
  Stage3ProductsFlow,
  type Stage3RoutineHandoff,
  updateStage3RoleAssignments,
} from "../src/components/personal-plan-products/stage3-products-flow"
import { ProductFitComparison } from "../src/components/personal-plan-products/product-fit-comparison"
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
  type PersonalPlanCategory,
  type Stage3AuthoritySnapshotV1,
  type Stage3EntryContext,
  type Stage3ProductDecision,
  type Stage3ProductDraft,
} from "../src/lib/personal-plan/products/contracts"
import { createFixtureStage3Gateway } from "../src/lib/personal-plan/products/fixture-gateway"
import {
  Stage3ProductsGatewayError,
  type Stage3MutationResponse,
  type Stage3ProductsGateway,
  type Stage3SearchResponse,
} from "../src/lib/personal-plan/products/gateway"
import type { Stage3Bootstrap } from "../src/lib/personal-plan/products/stage2-entry-adapter"
import {
  createMemoryPendingStage3RecoveryStorage,
  readPendingStage3Recovery,
} from "../src/lib/personal-plan/products/pending-recovery"
import {
  readStage3ReviewDraft,
  writeStage3ReviewDraft,
} from "../src/lib/personal-plan/products/review-draft"
import type {
  Stage3FitComparison,
  Stage3SelectedComparisonCandidate,
} from "../src/lib/personal-plan/products/fit-comparison"
import type { Stage3AnalyticsPort } from "../src/lib/personal-plan/products/stage3-analytics"
import { createStage3Draft } from "../src/lib/personal-plan/products/state-machine"

type ClientStateHarness = {
  render: () => Promise<ReactElement | null>
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function searchResponse(input: {
  requestToken: number
  query: string
  candidateId: string
  totalCapped: boolean
  category?: PersonalPlanCategory
}): Stage3SearchResponse {
  const category = input.category ?? "oil"
  return {
    status: "ready",
    requestToken: input.requestToken,
    result: {
      category,
      query: input.query,
      candidates: [
        {
          candidateId: input.candidateId,
          productId: input.candidateId,
          displayName: input.candidateId,
          brandName: "Race Fixture",
          category,
          confidence: "exact",
          assessmentStatus: "ready",
          assessmentReasonCodes: [],
        },
      ],
      totalCapped: input.totalCapped,
    },
  }
}

function oilSearchEntryContext(id: string): Stage3EntryContext {
  return {
    schemaVersion: 1,
    personalPlanId: `plan-${id}`,
    refinedVersionId: `refined-${id}`,
    orderedCategories: [
      {
        category: "oil",
        requiredRoles: ["dry_finish"],
        needSummary: "Pflege für Längen und Spitzen",
        authorityVersion: CATEGORY_ROLE_POLICIES.oil.authorityVersion,
      },
    ],
    inventoryPrompts: [{ category: "oil", allowsMultiple: true, allowsExplicitNone: true }],
  }
}

test("the journey header labels local review choices without claiming a server save", () => {
  const html = renderToStaticMarkup(
    <Stage3Shell
      title="Produkte"
      currentStepLabel="Prüfen"
      completedSteps={2}
      totalSteps={5}
      saveState={{ status: "local", label: "Auswahl gemerkt" }}
    >
      <div>Review</div>
    </Stage3Shell>,
  )

  assert.match(html, /Auswahl gemerkt/)
  assert.doesNotMatch(html, />Gespeichert</)
})

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
  reviewDecisionBundles(input: { draftId: string }): Promise<
    Array<{
      authorityEvaluation: Stage3AuthorityEvaluation
      fitComparison: Stage3FitComparison
    }>
  >
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
      return { ...response, fitComparisons: testFitComparisons(response.draft) }
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
      assert.ok(
        input.intent.action === "select_replacement" ||
          evaluation.allowedActions.includes(input.intent.action as never),
      )
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

function testFitComparisons(draft: Stage3ProductDraft): Stage3FitComparison[] {
  return deriveStage3DecisionSubjects(draft).map((subject) => {
    const source = subject.capturedProductId
      ? (draft.products.find(
          (product) => product.capturedProductId === subject.capturedProductId,
        ) ?? null)
      : null
    const alternatives: Stage3SelectedComparisonCandidate[] = [
      {
        productId: `recommended:${subject.decisionKey}`,
        category: subject.category,
        role: subject.role,
        verdict: "ideal",
        criteria: [],
        recommendation: {
          recommendationId: `recommend:${subject.decisionKey}`,
          productId: `recommended:${subject.decisionKey}`,
          category: subject.category,
          role: subject.role,
          displayName: "Verifizierte Alternative",
          reason: "Passt zum Bedarf.",
          authorityRuleId: "test.authority",
        },
        factFingerprint: `facts:recommend:${subject.decisionKey}`,
      },
    ]
    return {
      schemaVersion: 1,
      mode: "compact",
      category: subject.category,
      role: subject.role,
      subjectKey: subject.decisionKey,
      sourceIdentity: source?.identity ?? null,
      products: [
        ...(source?.identity.kind === "catalog_product"
          ? [
              {
                productId: source.identity.productId,
                displayName: source.identity.displayName,
                category: subject.category,
                role: subject.role,
                source: "current" as const,
              },
            ]
          : []),
        ...alternatives.map((candidate) => ({
          productId: candidate.productId,
          displayName: candidate.recommendation.displayName,
          category: subject.category,
          role: subject.role,
          source: "alternative" as const,
        })),
      ],
      alternatives,
      dimensions: [],
      reason: "specialist_category",
    }
  })
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
          : intent.action === "plan_recommendation" || intent.action === "select_replacement"
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

async function chooseDecision(
  harness: ClientStateHarness,
  kind: "keep" | "override" | "replacement" | "pending" | "skip",
) {
  const tree = await renderSettled(harness)
  const screen = findByType<React.ComponentProps<typeof ProductFitComparison>>(
    tree,
    ProductFitComparison,
  )
  assert.ok(screen)
  const actionByKind = {
    keep: "keep_owned",
    override: "acknowledge_override",
    replacement: "select_replacement",
    pending: "keep_pending",
    skip: "leave_uncovered",
  } as const
  const action = actionByKind[kind]
  assert.ok(action, `missing ${kind} action`)
  const selected = screen.props.comparison.alternatives[screen.props.displayedAlternativeIndex]
  await screen.props.onAction(
    action,
    action === "select_replacement" && selected
      ? { productId: selected.productId, factFingerprint: selected.factFingerprint }
      : undefined,
  )
  await renderSettled(harness)
}

async function waitForReviewedChoicesToSubmit(harness: ClientStateHarness) {
  await renderSettled(harness)
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
  assert.match(routeSource, /<PersonalPlanStage3LabClient scenario=\{scenario\} \/>/)
  assert.match(clientSource, /developmentStage3Analytics/)
  assert.match(clientSource, /createFixtureStage3Gateway/)
  assert.match(clientSource, /createFixtureUncoveredConditionerEntryContext/)
  assert.match(clientSource, /FIXTURE_STAGE3_SCENARIOS\.uncoveredConditioner/)
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
  assert.match(source, /authorityDecisionIntent\(/)
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
  capture?.props.onOpenFallbackIntake()
  tree = await renderSettled(harness)
  assert.ok(findByType(tree, IntakeFallbackBoundary))
})

test("catalog search carries the accepted capped state and clears it for newer uncapped or short queries", async () => {
  const gateway = createAuthorityTestGateway()
  gateway.search = async (input) => ({
    status: "ready",
    requestToken: input.requestToken,
    result: {
      category: input.category,
      query: input.query,
      candidates: [
        {
          candidateId: "ogx-oil",
          productId: "ogx-oil",
          displayName: "Argan Oil of Morocco Penetrating Oil",
          brandName: "OGX",
          category: input.category,
          confidence: "exact",
          assessmentStatus: "ready",
          assessmentReasonCodes: [],
        },
      ],
      totalCapped: input.query === "ogx",
    },
  })
  const entryContext = oilSearchEntryContext("search-cap")
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({ entryContext, gateway, searchDebounceMs: 0 }),
  )

  let tree = await renderSettled(harness)
  let capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  capture?.props.onQueryChange("ogx")
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.searchStatus, "ready")
  assert.equal(capture?.props.searchTotalCapped, true)

  capture?.props.onQueryChange("ogx oil")
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.searchStatus, "ready")
  assert.equal(capture?.props.searchTotalCapped, false)

  capture?.props.onQueryChange("o")
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.searchStatus, "idle")
  assert.equal(capture?.props.searchTotalCapped, false)
})

test("a broad search resolving after a short query cannot restore stale results or capping", async () => {
  const oldSearch = deferred<Stage3SearchResponse>()
  let oldRequestToken: number | undefined
  const gateway = createAuthorityTestGateway()
  gateway.search = async (input) => {
    oldRequestToken = input.requestToken
    return oldSearch.promise
  }
  const entryContext = oilSearchEntryContext("search-short-race")
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({ entryContext, gateway, searchDebounceMs: 0 }),
  )

  let tree = await renderSettled(harness)
  let capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  capture?.props.onQueryChange("broad oil")
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.searchStatus, "loading")

  capture?.props.onQueryChange("o")
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.searchStatus, "idle")
  assert.ok(oldRequestToken)

  oldSearch.resolve(
    searchResponse({
      requestToken: oldRequestToken,
      query: "broad oil",
      candidateId: "stale-oil",
      totalCapped: true,
    }),
  )
  await Promise.resolve()
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.searchStatus, "idle")
  assert.deepEqual(capture?.props.searchResults, [])
  assert.equal(capture?.props.searchTotalCapped, false)
})

test("an older rejected search cannot overwrite a newer successful result", async () => {
  const oldSearch = deferred<Stage3SearchResponse>()
  const newerSearch = deferred<Stage3SearchResponse>()
  let newerRequestToken: number | undefined
  const gateway = createAuthorityTestGateway()
  gateway.search = async (input) => {
    if (input.query === "old oil") return oldSearch.promise
    newerRequestToken = input.requestToken
    return newerSearch.promise
  }
  const entryContext = oilSearchEntryContext("search-rejection-race")
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({ entryContext, gateway, searchDebounceMs: 0 }),
  )

  let tree = await renderSettled(harness)
  let capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  capture?.props.onQueryChange("old oil")
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  capture?.props.onQueryChange("new oil")
  await renderSettled(harness)
  assert.ok(newerRequestToken)

  newerSearch.resolve(
    searchResponse({
      requestToken: newerRequestToken,
      query: "new oil",
      candidateId: "newer-oil",
      totalCapped: true,
    }),
  )
  await Promise.resolve()
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.searchStatus, "ready")
  assert.equal(capture?.props.searchResults[0]?.candidateId, "newer-oil")
  assert.equal(capture?.props.searchTotalCapped, true)

  oldSearch.reject(new Error("late old search failure"))
  await Promise.resolve()
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.searchStatus, "ready")
  assert.equal(capture?.props.searchResults[0]?.candidateId, "newer-oil")
  assert.equal(capture?.props.searchTotalCapped, true)
})

test("leaving the capture context invalidates an in-flight search before returning", async () => {
  const requirements: Stage3EntryContext["orderedCategories"] = [
    {
      category: "shampoo",
      requiredRoles: ["shampoo_everyday"],
      needSummary: "Sanfte Reinigung",
      authorityVersion: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
    },
  ]
  const authoritySnapshot: Stage3AuthoritySnapshotV1 = {
    schemaVersion: 1,
    refinedNeedVersionId: "refined-search-context-race",
    refinedInputHash: "hash-search-context-race",
    categoryDecisions: [],
    coverage: [],
    orderedCategories: ["shampoo"],
    authorityVersions: Object.fromEntries(
      requirements.map(({ category, authorityVersion }) => [category, authorityVersion]),
    ) as Stage3AuthoritySnapshotV1["authorityVersions"],
    productLoadContext: {
      schemaVersion: 1,
      scalpOiliness: "balanced",
      deepCleansingScalpPause: false,
      hasLowVolumeOrWeighedDown: false,
      shampooFrequency: "weekly_2x",
      oilPurposes: [],
      ownedCategories: ["shampoo"],
    },
  }
  const draft = createStage3Draft({
    draftId: "draft-search-context-race",
    userId: "user-search-context-race",
    personalPlanId: "plan-search-context-race",
    refinedVersionId: "refined-search-context-race",
    requirements,
    authoritySnapshot,
    now: "2026-08-15T00:00:00.000Z",
  })
  const bootstrap: Stage3Bootstrap = {
    entryContext: {
      schemaVersion: 1,
      personalPlanId: draft.personalPlanId,
      refinedVersionId: draft.refinedVersionId,
      orderedCategories: requirements,
      inventoryPrompts: [{ category: "shampoo", allowsMultiple: true, allowsExplicitNone: true }],
      authoritySnapshot,
    },
    draft,
    requirements,
    authorityEvaluations: [],
  }
  const oldSearch = deferred<Stage3SearchResponse>()
  const nextSearch = deferred<Stage3SearchResponse>()
  let oldRequestToken: number | undefined
  let searchCallCount = 0
  let searchDebounceMs = 0
  const gateway = createAuthorityTestGateway()
  gateway.search = async (input) => {
    searchCallCount += 1
    if (searchCallCount === 1) {
      oldRequestToken = input.requestToken
      return oldSearch.promise
    }
    return nextSearch.promise
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({ bootstrap, gateway, searchDebounceMs }),
  )

  let tree = await renderSettled(harness)
  let capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  capture?.props.onQueryChange("race shampoo")
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.searchStatus, "loading")
  ;(
    capture?.props as React.ComponentProps<typeof ProductCaptureScreen> & {
      onChangeProductKinds?: () => void
    }
  ).onChangeProductKinds?.()

  tree = await renderSettled(harness)
  const review = findByType<React.ComponentProps<typeof ProductKindReviewScreen>>(
    tree,
    ProductKindReviewScreen,
  )
  assert.ok(review)
  assert.ok(oldRequestToken)
  oldSearch.resolve(
    searchResponse({
      requestToken: oldRequestToken,
      query: "race shampoo",
      candidateId: "stale-shampoo",
      totalCapped: true,
      category: "shampoo",
    }),
  )
  await Promise.resolve()
  await renderSettled(harness)

  searchDebounceMs = 100
  review.props.onContinue()
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.searchStatus, "loading")
  assert.deepEqual(capture?.props.searchResults, [])
  assert.equal(capture?.props.searchTotalCapped, false)
})

test("waiting for catalog analysis preserves the selected product and cadence", async () => {
  let replacement:
    | Extract<
        Parameters<Stage3ProductsGateway["mutate"]>[0]["mutation"],
        { type: "replace_capture_category" }
      >
    | undefined
  const gateway = createAuthorityTestGateway()
  const originalMutate = gateway.mutate.bind(gateway)
  gateway.search = async (input) => ({
    status: "ready",
    requestToken: input.requestToken,
    result: {
      category: input.category,
      query: input.query,
      candidates: [
        {
          candidateId: "ogx-pending-analysis",
          productId: "ogx-pending-analysis",
          displayName: "Renewing + Argan Oil of Morocco Shampoo",
          brandName: "OGX",
          category: "shampoo",
          confidence: "exact",
          assessmentStatus: "pending_analysis",
          assessmentReasonCodes: ["missing_required_spec"],
        },
      ],
      totalCapped: false,
    },
  })
  gateway.mutate = async (input) => {
    if (input.mutation.type === "replace_capture_category") replacement = input.mutation
    return originalMutate(input)
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-catalog-pending-analysis",
    refinedVersionId: "refined-catalog-pending-analysis",
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
  capture?.props.onQueryChange("ogx")
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  capture?.props.onSelectCandidate("ogx-pending-analysis")
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.canContinue, false)
  capture?.props.onFrequencyChange("weekly_2x")
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  capture?.props.onContinue()
  await renderSettled(harness)

  assert.deepEqual(replacement?.candidates, [
    {
      kind: "catalog",
      candidateId: "ogx-pending-analysis",
      frequencyRange: "weekly_2x",
      roles: [],
    },
  ])
  assert.deepEqual(replacement?.uncoveredRoles, [
    { category: "shampoo", role: "shampoo_everyday", reason: "not_ready_to_decide" },
  ])
})

test("material inventory authority opens a Bedarfsplan checkpoint before product fit review", async () => {
  const requirements: Stage3EntryContext["orderedCategories"] = [
    {
      category: "oil",
      requiredRoles: ["dry_finish"],
      needSummary: "Finish für deine Längen",
      authorityVersion: CATEGORY_ROLE_POLICIES.oil.authorityVersion,
    },
  ]
  const pendingDraft: Stage3ProductDraft = {
    ...createStage3Draft({
      draftId: "draft-need-revision-checkpoint",
      userId: "user-need-revision-checkpoint",
      personalPlanId: "plan-need-revision-checkpoint",
      refinedVersionId: "refined-need-revision-checkpoint",
      requirements,
      now: "2026-08-13T00:00:00.000Z",
    }),
    pass: "need_revision_review",
    categoryCursor: null,
    inventoryAuthority: {
      schemaVersion: 1,
      stage2RefinedNeedVersionId: "refined-need-revision-checkpoint",
      inventorySnapshotFingerprint: "a".repeat(64),
      status: "pending",
      proposalFingerprint: "b".repeat(64),
      proposedInputHash: "proposed-input-hash",
      proposedOutputSnapshot: null,
      materialDelta: [
        {
          kind: "category_added",
          category: "deep_cleansing_shampoo",
          before: null,
          after: "optional",
        },
      ],
      resolvedFingerprint: null,
    },
    inventoryDispositions: [],
  }
  const acceptedDraft: Stage3ProductDraft = {
    ...pendingDraft,
    pass: "product_decisions",
    revision: 1,
    inventoryAuthority: {
      ...pendingDraft.inventoryAuthority!,
      status: "accepted",
      resolvedFingerprint: "b".repeat(64),
    },
  }
  const actions: string[] = []
  let latestDraft = pendingDraft
  const gateway = {
    ...createAuthorityTestGateway(),
    loadOrCreate: async () => ({
      status: "active" as const,
      draft: latestDraft,
      requirements,
    }),
    resolveNeedRevision: async (input: {
      action: "accept" | "reject"
    }): Promise<Stage3MutationResponse> => {
      actions.push(input.action)
      latestDraft = acceptedDraft
      return { status: "saved", draft: acceptedDraft }
    },
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({
      entryContext: {
        schemaVersion: 1,
        personalPlanId: pendingDraft.personalPlanId,
        refinedVersionId: pendingDraft.refinedVersionId,
        orderedCategories: requirements,
        inventoryPrompts: [{ category: "oil", allowsMultiple: true, allowsExplicitNone: true }],
      },
      gateway,
      searchDebounceMs: 0,
    }),
  )

  let tree = await renderSettled(harness)
  const checkpoint = findByType<React.ComponentProps<typeof Stage3NeedRevisionCheckpoint>>(
    tree,
    Stage3NeedRevisionCheckpoint,
  )
  assert.ok(checkpoint, textContent(tree))
  assert.equal(findByType(tree, ProductFitComparison), null)
  const checkpointHtml = renderToStaticMarkup(
    <Stage3NeedRevisionCheckpoint
      authority={checkpoint.props.authority}
      onAccept={() => {}}
      onReject={() => {}}
    />,
  )
  assert.match(checkpointHtml, /Deine Produkte verändern einen Punkt/)
  assert.match(checkpointHtml, /Tiefenreinigung/)
  assert.match(checkpointHtml, /Ergänzung übernehmen/)
  assert.match(checkpointHtml, /Bedarfsplan beibehalten/)

  checkpoint.props.onAccept()
  tree = await renderSettled(harness)
  assert.deepEqual(actions, ["accept"])
  assert.equal(findByType(tree, Stage3NeedRevisionCheckpoint), null)
})

test("inventory-only products render acknowledgement-only and never enter fit comparison", async () => {
  const requirements: Stage3EntryContext["orderedCategories"] = [
    {
      category: "dry_shampoo",
      requiredRoles: [],
      needSummary: "Aktuell verwendetes Trockenshampoo erfassen",
      authorityVersion: CATEGORY_ROLE_POLICIES.dry_shampoo.authorityVersion,
    },
  ]
  const dispositionKey = "inventory:dry_shampoo:dry-shampoo-owned"
  const baseDraft: Stage3ProductDraft = {
    ...createStage3Draft({
      draftId: "draft-inventory-disposition-ui",
      userId: "user-inventory-disposition-ui",
      personalPlanId: "plan-inventory-disposition-ui",
      refinedVersionId: "refined-inventory-disposition-ui",
      requirements,
      now: "2026-08-13T00:00:00.000Z",
    }),
    pass: "product_decisions",
    categoryCursor: null,
    products: [
      {
        capturedProductId: "dry-shampoo-owned",
        userProductId: "user-product-dry-shampoo-owned",
        identity: {
          kind: "catalog_product",
          productId: "catalog-dry-shampoo-owned",
          displayName: "Batiste Blush Trockenshampoo",
          category: "dry_shampoo",
          imageUrl: "https://example.test/batiste.webp",
        },
        frequencyRange: "weekly_1x",
        ownership: "owned",
        source: "existing_inventory",
      },
    ],
    inventoryAuthority: {
      schemaVersion: 1,
      stage2RefinedNeedVersionId: "refined-inventory-disposition-ui",
      inventorySnapshotFingerprint: "c".repeat(64),
      status: "rejected",
      proposalFingerprint: "d".repeat(64),
      proposedInputHash: null,
      proposedOutputSnapshot: null,
      materialDelta: [],
      resolvedFingerprint: "d".repeat(64),
    },
    inventoryDispositions: [
      {
        schemaVersion: 1,
        dispositionKey,
        capturedProductId: "dry-shampoo-owned",
        category: "dry_shampoo",
        planStatus: "not_used",
        reason: "category_not_in_final_plan",
        acknowledged: false,
        authorityFingerprint: "d".repeat(64),
      },
    ],
  }
  const acknowledgedDraft: Stage3ProductDraft = {
    ...baseDraft,
    revision: 1,
    inventoryDispositions: baseDraft.inventoryDispositions!.map((disposition) => ({
      ...disposition,
      acknowledged: true,
    })),
  }
  const acknowledgements: string[] = []
  let completeCalls = 0
  let latestDraft = baseDraft
  const gateway = {
    ...createAuthorityTestGateway(),
    loadOrCreate: async () => ({
      status: "active" as const,
      draft: latestDraft,
      requirements,
    }),
    acknowledgeInventoryDisposition: async (input: {
      dispositionKey: string
    }): Promise<Stage3MutationResponse> => {
      acknowledgements.push(input.dispositionKey)
      latestDraft = acknowledgedDraft
      return { status: "saved", draft: acknowledgedDraft }
    },
    complete: async () => {
      completeCalls += 1
      return { status: "not_ready" as const, draft: acknowledgedDraft }
    },
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({
      entryContext: {
        schemaVersion: 1,
        personalPlanId: baseDraft.personalPlanId,
        refinedVersionId: baseDraft.refinedVersionId,
        orderedCategories: requirements,
        inventoryPrompts: [
          { category: "dry_shampoo", allowsMultiple: true, allowsExplicitNone: true },
        ],
      },
      gateway,
      searchDebounceMs: 0,
    }),
  )

  let tree = await renderSettled(harness)
  const disposition = findByType<React.ComponentProps<typeof Stage3InventoryDispositionReview>>(
    tree,
    Stage3InventoryDispositionReview,
  )
  assert.ok(disposition, textContent(tree))
  assert.equal(findByType(tree, ProductFitComparison), null)
  const dispositionHtml = renderToStaticMarkup(
    <Stage3InventoryDispositionReview
      disposition={disposition.props.disposition}
      product={disposition.props.product}
      onAcknowledge={() => {}}
      onBack={() => {}}
    />,
  )
  assert.match(dispositionHtml, /Batiste Blush Trockenshampoo/)
  assert.match(dispositionHtml, /Nicht Teil deiner Routine/)
  assert.match(dispositionHtml, /Bleibt unter .Meine Produkte. gespeichert/)
  assert.match(dispositionHtml, /Verstanden, weiter/)
  assert.doesNotMatch(dispositionHtml, /Alternative|Ersatz|übernehmen/)

  disposition.props.onAcknowledge()
  tree = await renderSettled(harness)
  assert.deepEqual(acknowledgements, [dispositionKey])
  assert.equal(findByType(tree, Stage3InventoryDispositionReview), null)
  assert.equal(completeCalls, 1)
})

test("an unconfirmed inventory acknowledgement leaves a durable recovery action", async () => {
  const requirements: Stage3EntryContext["orderedCategories"] = [
    {
      category: "dry_shampoo",
      requiredRoles: [],
      needSummary: "Aktuell verwendetes Trockenshampoo erfassen",
      authorityVersion: CATEGORY_ROLE_POLICIES.dry_shampoo.authorityVersion,
    },
  ]
  const dispositionKey = "inventory:dry_shampoo:timeout-product"
  const draft: Stage3ProductDraft = {
    ...createStage3Draft({
      draftId: "draft-inventory-disposition-timeout",
      userId: "user-inventory-disposition-timeout",
      personalPlanId: "plan-inventory-disposition-timeout",
      refinedVersionId: "refined-inventory-disposition-timeout",
      requirements,
      now: "2026-08-14T00:00:00.000Z",
    }),
    pass: "product_decisions",
    categoryCursor: null,
    products: [
      {
        capturedProductId: "timeout-product",
        userProductId: "user-timeout-product",
        identity: {
          kind: "catalog_product",
          productId: "catalog-timeout-product",
          displayName: "Trockenshampoo",
          category: "dry_shampoo",
        },
        frequencyRange: "weekly_1x",
        ownership: "owned",
        source: "existing_inventory",
      },
    ],
    inventoryDispositions: [
      {
        schemaVersion: 1,
        dispositionKey,
        capturedProductId: "timeout-product",
        category: "dry_shampoo",
        planStatus: "not_used",
        reason: "category_not_in_final_plan",
        acknowledged: false,
        authorityFingerprint: "e".repeat(64),
      },
    ],
  }
  let releaseAcknowledgement!: () => void
  const pendingAcknowledgement = new Promise<void>((resolve) => {
    releaseAcknowledgement = resolve
  })
  const acknowledgedDraft: Stage3ProductDraft = {
    ...draft,
    revision: draft.revision + 1,
    inventoryDispositions: draft.inventoryDispositions?.map((disposition) => ({
      ...disposition,
      acknowledged: true,
    })),
  }
  let latestDraft = draft
  let acknowledgementCalls = 0
  const gateway = {
    ...createAuthorityTestGateway(),
    loadOrCreate: async () => ({
      status: "active" as const,
      draft: latestDraft,
      requirements,
      authorityEvaluations: [],
      fitComparisons: [],
    }),
    acknowledgeInventoryDisposition: async (): Promise<Stage3MutationResponse> => {
      acknowledgementCalls += 1
      if (acknowledgementCalls === 1) {
        await pendingAcknowledgement
        throw new Error("released after timeout")
      }
      latestDraft = acknowledgedDraft
      return { status: "saved", draft: acknowledgedDraft }
    },
    complete: async () => ({ status: "not_ready" as const, draft: latestDraft }),
  }
  const storage = createMemoryPendingStage3RecoveryStorage()
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({
      bootstrap: {
        entryContext: {
          schemaVersion: 1,
          personalPlanId: draft.personalPlanId,
          refinedVersionId: draft.refinedVersionId,
          orderedCategories: requirements,
          inventoryPrompts: [
            { category: "dry_shampoo", allowsMultiple: true, allowsExplicitNone: true },
          ],
        },
        draft,
        requirements,
        authorityEvaluations: [],
        fitComparisons: [],
      },
      gateway,
      pendingRecoveryStorage: storage,
      finalizationTimeoutMs: 5,
    }),
  )

  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof Stage3InventoryDispositionReview>>(
    tree,
    Stage3InventoryDispositionReview,
  )?.props.onAcknowledge()
  tree = await renderSettled(harness)

  await new Promise((resolve) => setTimeout(resolve, 10))
  tree = await renderSettled(harness)
  assert.equal(
    findByType<React.ComponentProps<typeof Stage3SystemState>>(tree, Stage3SystemState)?.props
      .title,
    "Speicherstatus noch offen.",
  )
  const pending = readPendingStage3Recovery(storage, {
    ownerId: draft.userId,
    personalPlanId: draft.personalPlanId,
    draftId: draft.draftId,
  })
  assert.equal(pending?.intent.operation, "inventory_disposition")
  assert.equal(
    pending?.intent.operation === "inventory_disposition"
      ? pending.intent.dispositionKey
      : undefined,
    dispositionKey,
  )
  assert.equal(pending?.intent.expectedRevision, draft.revision)
  assert.equal(typeof pending?.intent.createdAt, "number")

  await renderSettled(
    createClientStateHarness(() =>
      Stage3ProductsFlow({
        bootstrap: {
          entryContext: {
            schemaVersion: 1,
            personalPlanId: draft.personalPlanId,
            refinedVersionId: draft.refinedVersionId,
            orderedCategories: requirements,
            inventoryPrompts: [
              { category: "dry_shampoo", allowsMultiple: true, allowsExplicitNone: true },
            ],
          },
          draft,
          requirements,
          authorityEvaluations: [],
          fitComparisons: [],
        },
        gateway,
        pendingRecoveryStorage: storage,
      }),
    ),
  )
  assert.equal(acknowledgementCalls, 2)
  assert.equal(
    readPendingStage3Recovery(storage, {
      ownerId: draft.userId,
      personalPlanId: draft.personalPlanId,
      draftId: draft.draftId,
    }),
    null,
  )

  releaseAcknowledgement()
})

test("bootstrap Stage 3 opens capture directly and keeps product-kind correction available", async () => {
  const requirements: Stage3EntryContext["orderedCategories"] = [
    {
      category: "shampoo",
      requiredRoles: ["shampoo_everyday"],
      needSummary: "Sanfte Reinigung",
      authorityVersion: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
    },
  ]
  const authoritySnapshot: Stage3AuthoritySnapshotV1 = {
    schemaVersion: 1,
    refinedNeedVersionId: "refined-kind-review",
    refinedInputHash: "hash-kind-review",
    categoryDecisions: [],
    coverage: [],
    orderedCategories: ["shampoo"],
    authorityVersions: Object.fromEntries(
      requirements.map(({ category, authorityVersion }) => [category, authorityVersion]),
    ) as Stage3AuthoritySnapshotV1["authorityVersions"],
    productLoadContext: {
      schemaVersion: 1,
      scalpOiliness: "balanced",
      deepCleansingScalpPause: false,
      hasLowVolumeOrWeighedDown: false,
      shampooFrequency: "weekly_2x",
      oilPurposes: [],
      ownedCategories: ["shampoo"],
    },
  }
  const draft = createStage3Draft({
    draftId: "draft-kind-review",
    userId: "user-kind-review",
    personalPlanId: "plan-kind-review",
    refinedVersionId: "refined-kind-review",
    requirements,
    authoritySnapshot,
    now: "2026-08-11T00:00:00.000Z",
  })
  const bootstrap: Stage3Bootstrap = {
    entryContext: {
      schemaVersion: 1,
      personalPlanId: draft.personalPlanId,
      refinedVersionId: draft.refinedVersionId,
      orderedCategories: requirements,
      inventoryPrompts: [{ category: "shampoo", allowsMultiple: true, allowsExplicitNone: true }],
      authoritySnapshot,
    },
    draft,
    requirements,
    authorityEvaluations: [],
  }
  let correctionCalls = 0
  let mutateCalls = 0
  const gateway = createAuthorityTestGateway()
  gateway.mutate = async () => {
    mutateCalls += 1
    throw new Error("unchanged inventory must not save Stage 3 before capture")
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({
      bootstrap,
      gateway,
      onProductKindsCorrection: async () => {
        correctionCalls += 1
      },
    }),
  )

  let tree = await renderSettled(harness)
  assert.equal(findByType(tree, ProductKindReviewScreen), null)
  const capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.categoryLabel, "Shampoo")
  ;(
    capture?.props as React.ComponentProps<typeof ProductCaptureScreen> & {
      onChangeProductKinds?: () => void
    }
  ).onChangeProductKinds?.()

  tree = await renderSettled(harness)
  const review = findByType<React.ComponentProps<typeof ProductKindReviewScreen>>(
    tree,
    ProductKindReviewScreen,
  )
  assert.deepEqual(review?.props.selected, ["shampoo"])
  await review?.props.onContinue()

  tree = await renderSettled(harness)
  assert.equal(correctionCalls, 0)
  assert.equal(mutateCalls, 0)
  assert.equal(
    findByType<React.ComponentProps<typeof ProductCaptureScreen>>(tree, ProductCaptureScreen)?.props
      .categoryLabel,
    "Shampoo",
  )
})

test("corrected product kinds delegate to Stage 2 and do not continue from the stale bootstrap", async () => {
  const requirements: Stage3EntryContext["orderedCategories"] = [
    {
      category: "shampoo",
      requiredRoles: ["shampoo_everyday"],
      needSummary: "Sanfte Reinigung",
      authorityVersion: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
    },
  ]
  const authoritySnapshot: Stage3AuthoritySnapshotV1 = {
    schemaVersion: 1,
    refinedNeedVersionId: "refined-kind-correction-old",
    refinedInputHash: "hash-kind-correction-old",
    categoryDecisions: [],
    coverage: [],
    orderedCategories: ["shampoo"],
    authorityVersions: Object.fromEntries(
      requirements.map(({ category, authorityVersion }) => [category, authorityVersion]),
    ) as Stage3AuthoritySnapshotV1["authorityVersions"],
    productLoadContext: {
      schemaVersion: 1,
      scalpOiliness: "balanced",
      deepCleansingScalpPause: false,
      hasLowVolumeOrWeighedDown: false,
      shampooFrequency: "weekly_2x",
      oilPurposes: [],
      ownedCategories: ["shampoo"],
    },
  }
  const draft = createStage3Draft({
    draftId: "draft-kind-correction-old",
    userId: "user-kind-correction",
    personalPlanId: "plan-kind-correction",
    refinedVersionId: "refined-kind-correction-old",
    requirements,
    authoritySnapshot,
    now: "2026-08-11T00:00:00.000Z",
  })
  const bootstrap: Stage3Bootstrap = {
    entryContext: {
      schemaVersion: 1,
      personalPlanId: draft.personalPlanId,
      refinedVersionId: draft.refinedVersionId,
      orderedCategories: requirements,
      inventoryPrompts: [{ category: "shampoo", allowsMultiple: true, allowsExplicitNone: true }],
      authoritySnapshot,
    },
    draft,
    requirements,
    authorityEvaluations: [],
  }
  const delegated: PersonalPlanCategory[][] = []
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({
      bootstrap,
      gateway: createAuthorityTestGateway(),
      onProductKindsCorrection: async (categories) => {
        delegated.push(categories)
      },
    }),
  )

  let tree = await renderSettled(harness)
  const capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.categoryLabel, "Shampoo")
  ;(
    capture?.props as React.ComponentProps<typeof ProductCaptureScreen> & {
      onChangeProductKinds?: () => void
    }
  ).onChangeProductKinds?.()
  tree = await renderSettled(harness)
  let review = findByType<React.ComponentProps<typeof ProductKindReviewScreen>>(
    tree,
    ProductKindReviewScreen,
  )
  review?.props.onToggle("conditioner", true)
  tree = await renderSettled(harness)
  review = findByType<React.ComponentProps<typeof ProductKindReviewScreen>>(
    tree,
    ProductKindReviewScreen,
  )
  await review?.props.onContinue()
  tree = await renderSettled(harness)

  assert.deepEqual(delegated, [["shampoo", "conditioner"]])
  assert.equal(findByType(tree, ProductCaptureScreen), null)
  assert.equal(
    findByType<React.ComponentProps<typeof ProductKindReviewScreen>>(tree, ProductKindReviewScreen)
      ?.props.status,
    "saving",
  )
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
      ownedCategories: ["shampoo" as const, "oil" as const],
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
  assert.equal(findByType(tree, ProductKindReviewScreen), null)
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
  await captureCatalogProduct(harness, "Shampoo", "shampoo", 1)
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
  const decision = findByType<React.ComponentProps<typeof ProductFitComparison>>(
    tree,
    ProductFitComparison,
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
  const firstCapture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(firstCapture?.props.showAddAnotherProduct, true)
  firstCapture?.props.onAddAnotherProduct()
  await captureCatalogProduct(harness, "Shampoo", "shampoo", 1)
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
    findByType<React.ComponentProps<typeof ProductFitComparison>>(tree, ProductFitComparison),
  )
  assert.deepEqual(recordedMutationTypes.slice(-1), ["replace_capture_category"])
})

test("submitting an unchecked role deliberately records an open not-ready gap", async () => {
  let finalization:
    | Extract<
        Parameters<Stage3ProductsGateway["mutate"]>[0]["mutation"],
        { type: "replace_capture_category" }
      >
    | undefined
  const gateway = createAuthorityTestGateway()
  const originalMutate = gateway.mutate.bind(gateway)
  gateway.mutate = async (input) => {
    if (input.mutation.type === "replace_capture_category") finalization = input.mutation
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

  await captureCatalogProduct(harness, "Shampoo", "shampoo", 1)
  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onAddAnotherProduct()
  await captureCatalogProduct(harness, "Shampoo", "shampoo", 1)
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

test("multiple Conditioners auto-assign to their sole multi-product role", async () => {
  let finalization:
    | Extract<
        Parameters<Stage3ProductsGateway["mutate"]>[0]["mutation"],
        { type: "replace_capture_category" }
      >
    | undefined
  const gateway = createAuthorityTestGateway()
  const originalMutate = gateway.mutate.bind(gateway)
  gateway.mutate = async (input) => {
    if (input.mutation.type === "replace_capture_category") finalization = input.mutation
    return originalMutate(input)
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-conditioner-auto-role",
    refinedVersionId: "refined-conditioner-auto-role",
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

  assert.equal(findByType(tree, SemanticRoleAssignment), null)
  assert.equal(finalization?.candidates.length, 2)
  assert.ok(
    finalization?.candidates.every(
      (candidate) => candidate.roles.length === 1 && candidate.roles[0] === "conditioner_rinse_out",
    ),
  )
})

test("an uncovered role saves the explicitly selected third strict recommendation", async () => {
  const requirements: Stage3EntryContext["orderedCategories"] = [
    {
      category: "conditioner",
      requiredRoles: ["conditioner_rinse_out"],
      needSummary: "Pflege nach der Wäsche",
      authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
    },
  ]
  const initialDraft: Stage3ProductDraft = {
    ...createStage3Draft({
      draftId: "draft-uncovered-third-recommendation",
      userId: "user-uncovered-third-recommendation",
      personalPlanId: "plan-uncovered-third-recommendation",
      refinedVersionId: "refined-uncovered-third-recommendation",
      requirements,
      now: "2026-08-13T00:00:00.000Z",
    }),
    pass: "product_decisions",
    categoryCursor: null,
    completedCaptureCategories: ["conditioner"],
    uncoveredRoles: [
      {
        category: "conditioner",
        role: "conditioner_rinse_out",
        reason: "no_product_owned",
      },
    ],
  }
  const subject = deriveStage3DecisionSubjects(initialDraft)[0]!
  const candidates: Stage3SelectedComparisonCandidate[] = [1, 2, 3].map((position) => ({
    productId: `catalog-strict-conditioner-${position}`,
    category: "conditioner",
    role: "conditioner_rinse_out",
    verdict: "ideal",
    criteria: [],
    recommendation: {
      recommendationId: `recommendation-strict-conditioner-${position}`,
      productId: `catalog-strict-conditioner-${position}`,
      category: "conditioner",
      role: "conditioner_rinse_out",
      displayName: `Strenger Conditioner ${position}`,
      reason: "Erfüllt alle bestätigten Ziele.",
      authorityRuleId: "test.strict_conditioner",
    },
    factFingerprint: `facts:strict-conditioner-${position}`,
  }))
  const evaluation: Stage3AuthorityEvaluation = {
    status: "known",
    category: "conditioner",
    subjectKey: subject.decisionKey,
    verdict: "unknown",
    criteria: [],
    allowedActions: ["leave_uncovered"],
    recommendation: null,
    productFactFingerprint: null,
    recommendationFactFingerprint: null,
    coverageRuleIds: [],
  }
  const comparison: Stage3FitComparison = {
    schemaVersion: 1,
    mode: "compact",
    category: "conditioner",
    role: "conditioner_rinse_out",
    subjectKey: subject.decisionKey,
    sourceIdentity: null,
    products: candidates.map((candidate) => ({
      productId: candidate.productId,
      displayName: candidate.recommendation.displayName,
      category: candidate.category,
      role: candidate.role,
      source: "alternative" as const,
    })),
    alternatives: candidates,
    dimensions: [],
    evidenceRows: [],
    reason: "specialist_category",
  }
  const emittedIntents: Stage3AuthoritySemanticIntent[] = []
  let canonicalDraft = initialDraft
  const gateway = {
    ...createAuthorityTestGateway(),
    loadOrCreate: async () => ({
      status: "active" as const,
      draft: canonicalDraft,
      requirements,
      authorityEvaluations: [],
      fitComparisons: [],
    }),
    reviewDecisionBundles: async () => [],
    resolveDecision: async (input: {
      intent: Stage3AuthoritySemanticIntent
    }): Promise<Stage3MutationResponse> => {
      emittedIntents.push(input.intent)
      const selected = candidates.find(
        (candidate) => candidate.productId === input.intent.selectedCandidateId,
      )
      assert.ok(selected)
      assert.equal(input.intent.action, "select_replacement")
      assert.equal(input.intent.selectedCandidateFactFingerprint, selected.factFingerprint)
      canonicalDraft = {
        ...initialDraft,
        revision: 1,
        decisions: [
          {
            ...testAuthorityDecision(subject, evaluation, input.intent),
            choiceState: "planned_purchase",
            recommendation: selected.recommendation,
            authorityEvidence: {
              schemaVersion: 1,
              subjectKey: subject.decisionKey,
              refinedNeedVersionId: initialDraft.refinedVersionId,
              refinedInputHash: "test-refined-input",
              authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
              productFactFingerprint: null,
              recommendationFactFingerprint: selected.factFingerprint,
              coverageRuleIds: [],
            },
          },
        ],
      }
      return { status: "saved", draft: canonicalDraft }
    },
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
    fitComparisons: [comparison],
  }
  const harness = createClientStateHarness(() => Stage3ProductsFlow({ bootstrap, gateway }))

  let tree = await renderSettled(harness)
  let review = findByType<React.ComponentProps<typeof ProductFitComparison>>(
    tree,
    ProductFitComparison,
  )
  assert.ok(review)
  review.props.onDisplayedAlternativeChange(2)
  tree = await renderSettled(harness)
  review = findByType<React.ComponentProps<typeof ProductFitComparison>>(tree, ProductFitComparison)
  assert.equal(review?.props.displayedAlternativeIndex, 2)
  review?.props.onSelectedRecommendationChange?.(candidates[2]!.productId)
  tree = await renderSettled(harness)
  review = findByType<React.ComponentProps<typeof ProductFitComparison>>(tree, ProductFitComparison)
  await review?.props.onAction("select_replacement", {
    productId: candidates[2]!.productId,
    factFingerprint: candidates[2]!.factFingerprint,
  })
  await waitForReviewedChoicesToSubmit(harness)

  assert.deepEqual(emittedIntents, [
    {
      type: "resolve_decision",
      subjectKey: subject.decisionKey,
      action: "select_replacement",
      selectedCandidateId: candidates[2]!.productId,
      selectedCandidateFactFingerprint: candidates[2]!.factFingerprint,
    },
  ])
  assert.equal(canonicalDraft.decisions[0]?.choiceState, "planned_purchase")
  assert.deepEqual(canonicalDraft.decisions[0]?.recommendation, candidates[2]!.recommendation)
  assert.equal(
    canonicalDraft.decisions[0]?.authorityEvidence?.recommendationFactFingerprint,
    candidates[2]!.factFingerprint,
  )
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
  await captureCatalogProduct(harness, "Shampoo", "shampoo", 1)
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
  const saving = findByType<React.ComponentProps<typeof Stage3CategoryFinalizing>>(
    tree,
    Stage3CategoryFinalizing,
  )
  assert.equal(finalizationCalls, 1)
  assert.ok(saving)
  assert.equal(findByType(tree, Stage3SystemState), null)
  assert.equal(saving.props.products.length, 2)
  release()
  await renderSettled(harness)
})

test("uncertain decision save confirms canonical state before showing manual recovery", async () => {
  let resolveCalls = 0
  const gateway = createAuthorityTestGateway()
  const originalResolveDecision = gateway.resolveDecision.bind(gateway)
  gateway.resolveDecision = async (input) => {
    resolveCalls += 1
    await originalResolveDecision(input)
    throw new Stage3ProductsGatewayError("temporarily_unavailable")
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-decision-canonical-satisfied",
    refinedVersionId: "refined-decision-canonical-satisfied",
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

  await captureCatalogProduct(harness, "Shampoo", "shampoo")
  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  await assignEveryRoleToFirstProduct(harness)
  await chooseDecision(harness, "keep")
  tree = await renderSettled(harness)

  assert.equal(resolveCalls, 1)
  assert.doesNotMatch(textContent(tree), /Speichern fehlgeschlagen|Speicherstatus noch offen/)
})

test("completed canonical recovery opens Routine from receipt without replaying completion", async () => {
  let completeCalls = 0
  let receiptCalls = 0
  const gateway = createAuthorityTestGateway()
  const originalComplete = gateway.complete.bind(gateway)
  const originalReceipt = gateway.loadCompletionReceipt?.bind(gateway)
  assert.ok(originalReceipt)
  gateway.complete = async (input) => {
    completeCalls += 1
    await originalComplete(input)
    throw new Stage3ProductsGatewayError("temporarily_unavailable", undefined, 503)
  }
  gateway.loadCompletionReceipt = async (input) => {
    receiptCalls += 1
    return originalReceipt(input)
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-completion-receipt-recovery",
    refinedVersionId: "refined-completion-receipt-recovery",
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
  const handoffs: Stage3RoutineHandoff[] = []
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({
      entryContext,
      gateway,
      searchDebounceMs: 0,
      onOpenRoutine: (handoff) => handoffs.push(handoff),
    }),
  )

  await captureCatalogProduct(harness, "Shampoo", "shampoo")
  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  await assignEveryRoleToFirstProduct(harness)
  await chooseDecision(harness, "keep")
  tree = await renderSettled(harness)

  assert.equal(completeCalls, 1)
  assert.equal(receiptCalls, 1)
  assert.equal(handoffs.length, 1)
  assert.doesNotMatch(textContent(tree), /Speichern fehlgeschlagen|Speicherstatus noch offen/)
})

test("terminal stage-not-ready decision errors reload the checkpoint without canonical resend", async () => {
  let resolveCalls = 0
  let canonicalLoads = 0
  const gateway = createAuthorityTestGateway()
  const originalLoadOrCreate = gateway.loadOrCreate.bind(gateway)
  gateway.loadOrCreate = async (input) => {
    canonicalLoads += 1
    return originalLoadOrCreate(input)
  }
  gateway.resolveDecision = async () => {
    resolveCalls += 1
    throw new Stage3ProductsGatewayError("stage_not_ready", undefined, 409)
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-decision-stage-not-ready",
    refinedVersionId: "refined-decision-stage-not-ready",
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

  await captureCatalogProduct(harness, "Shampoo", "shampoo")
  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  await assignEveryRoleToFirstProduct(harness)
  const loadsBeforeDecision = canonicalLoads
  await chooseDecision(harness, "keep")
  tree = await renderSettled(harness)

  const recovery = findByType<React.ComponentProps<typeof Stage3SystemState>>(
    tree,
    Stage3SystemState,
  )
  assert.equal(resolveCalls, 1)
  assert.equal(canonicalLoads, loadsBeforeDecision)
  assert.equal(recovery?.props.actionLabel, "Aktuellen Stand laden")
})

test("rate-limited decision save waits, checks canonical state, and resends once when missing", async () => {
  let resolveCalls = 0
  const gateway = createAuthorityTestGateway()
  const originalResolveDecision = gateway.resolveDecision.bind(gateway)
  gateway.resolveDecision = async (input) => {
    resolveCalls += 1
    if (resolveCalls === 1) {
      throw new Stage3ProductsGatewayError("rate_limited", undefined, 429, 1)
    }
    return originalResolveDecision(input)
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-decision-rate-limited",
    refinedVersionId: "refined-decision-rate-limited",
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

  await captureCatalogProduct(harness, "Shampoo", "shampoo")
  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  await assignEveryRoleToFirstProduct(harness)
  await chooseDecision(harness, "keep")
  await new Promise<void>((resolve) => setTimeout(resolve, 1_050))
  tree = await renderSettled(harness)

  assert.equal(resolveCalls, 2)
  assert.doesNotMatch(textContent(tree), /Speichern fehlgeschlagen/)
})

test("replacement recovery requires the exact candidate fingerprint from the canonical bundle", async () => {
  let resolveCalls = 0
  let releaseCanonicalReload!: () => void
  let markCanonicalReloadStarted!: () => void
  const canonicalReloadStarted = new Promise<void>((resolve) => {
    markCanonicalReloadStarted = resolve
  })
  const canonicalReloadPending = new Promise<void>((resolve) => {
    releaseCanonicalReload = resolve
  })
  let rejectFirstBatch!: () => void
  const firstBatchPending = new Promise<void>((_resolve, reject) => {
    rejectFirstBatch = () =>
      reject(new Stage3ProductsGatewayError("stage3_replacement_candidate_invalid"))
  })
  const gateway = createAuthorityTestGateway()
  const originalLoadOrCreate = gateway.loadOrCreate.bind(gateway)
  const originalReviewDecisionBundles = gateway.reviewDecisionBundles?.bind(gateway)
  assert.ok(originalReviewDecisionBundles)
  gateway.loadOrCreate = async (input) => {
    const response = await originalLoadOrCreate(input)
    if (resolveCalls === 0) return response
    markCanonicalReloadStarted()
    await canonicalReloadPending
    return {
      ...response,
      draft: { ...response.draft, revision: response.draft.revision + 1 },
    }
  }
  gateway.reviewDecisionBundles = async (input) => {
    const bundles = await originalReviewDecisionBundles(input)
    if (resolveCalls === 0) return bundles
    return bundles.map((bundle) => ({
      ...bundle,
      fitComparison: {
        ...bundle.fitComparison,
        alternatives: bundle.fitComparison.alternatives.map((candidate) => ({
          ...candidate,
          factFingerprint: `changed:${candidate.factFingerprint}`,
        })),
      },
    }))
  }
  gateway.resolveDecision = async () => {
    resolveCalls += 1
    if (resolveCalls === 1) await firstBatchPending
    throw new Stage3ProductsGatewayError("stage3_replacement_candidate_invalid")
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-replacement-candidate-refresh",
    refinedVersionId: "refined-replacement-candidate-refresh",
    orderedCategories: [
      {
        category: "conditioner",
        requiredRoles: ["conditioner_rinse_out"],
        needSummary: "Ausgewogene Pflege",
        authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
      },
    ],
    inventoryPrompts: [{ category: "conditioner", allowsMultiple: true, allowsExplicitNone: true }],
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({ entryContext, gateway, searchDebounceMs: 0 }),
  )

  await captureCatalogProduct(harness, "Conditioner", "conditioner")
  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  await assignEveryRoleToFirstProduct(harness)
  await chooseDecision(harness, "replacement")
  await harness.render()
  rejectFirstBatch()
  await canonicalReloadStarted
  await harness.render()
  assert.equal(resolveCalls, 1, "canonical reconciliation must suppress automatic resubmission")
  releaseCanonicalReload()
  tree = await renderSettled(harness)

  assert.equal(resolveCalls, 1)
  const updatedOptions = findByType<React.ComponentProps<typeof Stage3SystemState>>(
    tree,
    Stage3SystemState,
  )
  assert.equal(updatedOptions?.props.state, "conflict")
  assert.equal(updatedOptions?.props.title, "Die passenden Optionen wurden aktualisiert.")
  assert.match(updatedOptions?.props.message ?? "", /passt nicht mehr/i)
  updatedOptions?.props.onAction?.()
  tree = await renderSettled(harness)
  assert.ok(findByType(tree, ProductFitComparison), "the changed candidate requires confirmation")
})

test("a successful recovery resend restores and completes the reviewed decision batch", async () => {
  let resolveCalls = 0
  let reviewBundleLoads = 0
  const gateway = createAuthorityTestGateway()
  const originalResolveDecision = gateway.resolveDecision.bind(gateway)
  const originalReviewDecisionBundles = gateway.reviewDecisionBundles.bind(gateway)
  gateway.resolveDecision = async (input) => {
    resolveCalls += 1
    if (resolveCalls === 1) {
      throw new Stage3ProductsGatewayError("rate_limited", undefined, 429, 1)
    }
    return originalResolveDecision(input)
  }
  gateway.reviewDecisionBundles = async (input) => {
    reviewBundleLoads += 1
    return originalReviewDecisionBundles(input)
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-recovery-next-review",
    refinedVersionId: "refined-recovery-next-review",
    orderedCategories: [
      {
        category: "oil",
        requiredRoles: ["leave_on_fibre_conditioning", "dry_finish"],
        needSummary: "Pflege und Finish für deine Längen",
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
  const firstReview = findByType<React.ComponentProps<typeof ProductFitComparison>>(
    tree,
    ProductFitComparison,
  )
  assert.ok(firstReview)
  const firstDecisionKey = firstReview.props.comparison.subjectKey
  firstReview.props.onDisplayedAlternativeChange(2)
  tree = await renderSettled(harness)
  const focusedFirstReview = findByType<React.ComponentProps<typeof ProductFitComparison>>(
    tree,
    ProductFitComparison,
  )
  assert.equal(focusedFirstReview?.props.displayedAlternativeIndex, 2)
  await focusedFirstReview?.props.onAction("keep_owned")
  tree = await renderSettled(harness)
  const nextReview = findByType<React.ComponentProps<typeof ProductFitComparison>>(
    tree,
    ProductFitComparison,
  )
  assert.ok(nextReview)
  assert.notEqual(nextReview.props.comparison.subjectKey, firstDecisionKey)
  await nextReview.props.onAction("keep_owned")
  await waitForReviewedChoicesToSubmit(harness)
  await new Promise<void>((resolve) => setTimeout(resolve, 1_050))
  tree = await renderSettled(harness)

  assert.equal(resolveCalls, 3)
  assert.ok(reviewBundleLoads >= 2, "recovery reloads authority after the successful resend")
  assert.equal(findByType(tree, ProductFitComparison), null)
})

test("replacement recovery resends once at the canonical revision when the fingerprint is unchanged", async () => {
  const expectedRevisions: number[] = []
  let canonicalDraft: Stage3ProductDraft | null = null
  const gateway = createAuthorityTestGateway()
  const originalLoadOrCreate = gateway.loadOrCreate.bind(gateway)
  gateway.loadOrCreate = async (input) => {
    const response = await originalLoadOrCreate(input)
    if (expectedRevisions.length === 0) return response
    canonicalDraft = { ...response.draft, revision: response.draft.revision + 1 }
    return { ...response, draft: canonicalDraft }
  }
  gateway.resolveDecision = async (input) => {
    expectedRevisions.push(input.expectedRevision)
    if (expectedRevisions.length === 1) {
      throw new Stage3ProductsGatewayError("rate_limited", undefined, 429, 1)
    }
    assert.ok(canonicalDraft)
    return { status: "conflict", latestDraft: canonicalDraft }
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-replacement-candidate-resend",
    refinedVersionId: "refined-replacement-candidate-resend",
    orderedCategories: [
      {
        category: "conditioner",
        requiredRoles: ["conditioner_rinse_out"],
        needSummary: "Ausgewogene Pflege",
        authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
      },
    ],
    inventoryPrompts: [{ category: "conditioner", allowsMultiple: true, allowsExplicitNone: true }],
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({ entryContext, gateway, searchDebounceMs: 0 }),
  )

  await captureCatalogProduct(harness, "Conditioner", "conditioner")
  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  await assignEveryRoleToFirstProduct(harness)
  await chooseDecision(harness, "replacement")
  await new Promise<void>((resolve) => setTimeout(resolve, 1_050))
  await renderSettled(harness)

  assert.equal(expectedRevisions.length, 2)
  assert.equal(expectedRevisions[1], expectedRevisions[0]! + 1)
})

test("uncertain decision save does not resend when canonical state has a different choice", async () => {
  let resolveCalls = 0
  const gateway = createAuthorityTestGateway()
  const originalLoadOrCreate = gateway.loadOrCreate.bind(gateway)
  let canonicalDifferentDraft: Stage3ProductDraft | null = null
  gateway.loadOrCreate = async (input) => {
    if (canonicalDifferentDraft) {
      return {
        status: canonicalDifferentDraft.status,
        draft: canonicalDifferentDraft,
        requirements: input.requirements,
      }
    }
    return originalLoadOrCreate(input)
  }
  gateway.resolveDecision = async (input) => {
    resolveCalls += 1
    const capturedProductId = input.intent.subjectKey.split(":").slice(3).join(":")
    const response = await gateway.mutate({
      draftId: input.draftId,
      expectedRevision: input.expectedRevision,
      mutation: {
        type: "record_decision",
        decision: {
          decisionKey: input.intent.subjectKey,
          category: "shampoo",
          role: "shampoo_everyday",
          capturedProductId: capturedProductId === "gap" ? null : capturedProductId,
          verdict: "unknown",
          choiceState: "unassigned",
          criterionResults: [],
          recommendation: null,
          limitationAcknowledged: false,
        },
      },
    })
    if (response.status === "saved") canonicalDifferentDraft = response.draft
    throw new Stage3ProductsGatewayError("temporarily_unavailable")
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-decision-canonical-different",
    refinedVersionId: "refined-decision-canonical-different",
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

  await captureCatalogProduct(harness, "Shampoo", "shampoo")
  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  await assignEveryRoleToFirstProduct(harness)
  await chooseDecision(harness, "keep")
  tree = await renderSettled(harness)

  assert.equal(resolveCalls, 1)
  assert.doesNotMatch(textContent(tree), /Speicherstatus noch offen/)
})

test("global inventory review keeps server-authored no-owned gaps local without client mutation", async () => {
  const recordedMutationTypes: string[] = []
  const gateway = createAuthorityTestGateway()
  const originalMutate = gateway.mutate.bind(gateway)
  gateway.mutate = async (input) => {
    recordedMutationTypes.push(input.mutation.type)
    return originalMutate(input)
  }
  const requirements: Stage3EntryContext["orderedCategories"] = [
    {
      category: "heat_protectant",
      requiredRoles: ["pre_heat_protection"],
      qualifyingRoutes: ["direct_contact_heat"],
      needSummary: "Schutz vor Hitze",
      authorityVersion: CATEGORY_ROLE_POLICIES.heat_protectant.authorityVersion,
    },
  ]
  const authoritySnapshot: Stage3AuthoritySnapshotV1 = {
    schemaVersion: 1,
    refinedNeedVersionId: "refined-no-product-atomic",
    refinedInputHash: "hash-no-product-atomic",
    categoryDecisions: [],
    coverage: [],
    orderedCategories: ["heat_protectant"],
    authorityVersions: Object.fromEntries(
      requirements.map(({ category, authorityVersion }) => [category, authorityVersion]),
    ) as Stage3AuthoritySnapshotV1["authorityVersions"],
    productLoadContext: {
      schemaVersion: 1,
      scalpOiliness: "balanced",
      deepCleansingScalpPause: false,
      hasLowVolumeOrWeighedDown: false,
      shampooFrequency: "weekly_2x",
      oilPurposes: [],
      ownedCategories: [],
    },
  }
  const draft = createStage3Draft({
    draftId: "draft-no-product-atomic",
    userId: "user-no-product-atomic",
    personalPlanId: "plan-no-product-atomic",
    refinedVersionId: "refined-no-product-atomic",
    requirements,
    authoritySnapshot,
    now: "2026-08-11T00:00:00.000Z",
  })
  const bootstrap: Stage3Bootstrap = {
    entryContext: {
      schemaVersion: 1,
      personalPlanId: draft.personalPlanId,
      refinedVersionId: draft.refinedVersionId,
      orderedCategories: requirements,
      inventoryPrompts: [
        { category: "heat_protectant", allowsMultiple: true, allowsExplicitNone: true },
      ],
      authoritySnapshot,
    },
    draft,
    requirements,
    authorityEvaluations: [],
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({ bootstrap, gateway, searchDebounceMs: 0 }),
  )

  let tree = await renderSettled(harness)
  assert.equal(findByType(tree, ProductKindReviewScreen), null)
  assert.deepEqual(recordedMutationTypes, [])
  assert.equal(findByType(tree, ProductCaptureScreen), null)
})

test("global no-owned-category review suppresses duplicate confirmation while staying on server state", async () => {
  let correctionCalls = 0
  const gateway = createAuthorityTestGateway()
  const originalMutate = gateway.mutate.bind(gateway)
  gateway.mutate = async (input) => {
    return originalMutate(input)
  }
  const requirements: Stage3EntryContext["orderedCategories"] = [
    {
      category: "heat_protectant",
      requiredRoles: ["pre_heat_protection"],
      qualifyingRoutes: ["direct_contact_heat"],
      needSummary: "Schutz vor Hitze",
      authorityVersion: CATEGORY_ROLE_POLICIES.heat_protectant.authorityVersion,
    },
  ]
  const authoritySnapshot: Stage3AuthoritySnapshotV1 = {
    schemaVersion: 1,
    refinedNeedVersionId: "refined-no-product-saving",
    refinedInputHash: "hash-no-product-saving",
    categoryDecisions: [],
    coverage: [],
    orderedCategories: ["heat_protectant"],
    authorityVersions: Object.fromEntries(
      requirements.map(({ category, authorityVersion }) => [category, authorityVersion]),
    ) as Stage3AuthoritySnapshotV1["authorityVersions"],
    productLoadContext: {
      schemaVersion: 1,
      scalpOiliness: "balanced",
      deepCleansingScalpPause: false,
      hasLowVolumeOrWeighedDown: false,
      shampooFrequency: "weekly_2x",
      oilPurposes: [],
      ownedCategories: [],
    },
  }
  const draft = createStage3Draft({
    draftId: "draft-no-product-saving",
    userId: "user-no-product-saving",
    personalPlanId: "plan-no-product-saving",
    refinedVersionId: "refined-no-product-saving",
    requirements,
    authoritySnapshot,
    now: "2026-08-11T00:00:00.000Z",
  })
  const bootstrap: Stage3Bootstrap = {
    entryContext: {
      schemaVersion: 1,
      personalPlanId: draft.personalPlanId,
      refinedVersionId: draft.refinedVersionId,
      orderedCategories: requirements,
      inventoryPrompts: [
        { category: "heat_protectant", allowsMultiple: true, allowsExplicitNone: true },
      ],
      authoritySnapshot,
    },
    draft,
    requirements,
    authorityEvaluations: [],
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({
      bootstrap,
      gateway,
      searchDebounceMs: 0,
      onProductKindsCorrection: async () => {
        correctionCalls += 1
      },
    }),
  )

  let tree = await renderSettled(harness)
  const review = findByType<React.ComponentProps<typeof ProductKindReviewScreen>>(
    tree,
    ProductKindReviewScreen,
  )
  review?.props.onContinue()
  review?.props.onContinue()

  tree = await renderSettled(harness)
  assert.equal(correctionCalls, 0)
  assert.equal(findByType(tree, ProductCaptureScreen), null)
})

test("catalog selection and frequency stay editable until one explicit category save", async () => {
  let mutationCalls = 0
  let release: () => void = () => {}
  const blocker = new Promise<void>((resolve) => {
    release = resolve
  })
  const gateway = createAuthorityTestGateway()
  const originalMutate = gateway.mutate.bind(gateway)
  gateway.mutate = async (input) => {
    mutationCalls += 1
    await blocker
    return originalMutate(input)
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-catalog-capture-single-flight",
    refinedVersionId: "refined-catalog-capture-single-flight",
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
  capture?.props.onQueryChange("shampoo")
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.searchStatus, "ready")
  capture?.props.onSelectCandidate(capture.props.searchResults[0]!.candidateId)
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.showFrequency, true)

  capture?.props.onFrequencyChange("weekly_2x")
  capture?.props.onFrequencyChange("weekly_1x")
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(mutationCalls, 0)
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.disabled, false)
  assert.equal(capture?.props.selectedFrequency, "weekly_1x")
  capture?.props.onContinue()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(mutationCalls, 1)
  release()
  await renderSettled(harness)
})

test("an authority decision conflict installs the canonical draft without replaying", async () => {
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
    reviewDecisionBundles: async () => [
      {
        authorityEvaluation: evaluation,
        fitComparison: testFitComparisons(canonicalDraft)[0]!,
      },
    ],
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
    fitComparisons: testFitComparisons(initialDraft),
  }
  const harness = createClientStateHarness(() => Stage3ProductsFlow({ bootstrap, gateway }))

  let tree = await renderSettled(harness)
  const decisionScreen = findByType<React.ComponentProps<typeof ProductFitComparison>>(
    tree,
    ProductFitComparison,
  )
  assert.ok(decisionScreen)
  await decisionScreen.props.onAction("keep_owned")
  await waitForReviewedChoicesToSubmit(harness)
  tree = await renderSettled(harness)
  const conflict = findByType<React.ComponentProps<typeof Stage3SystemState>>(
    tree,
    Stage3SystemState,
  )
  assert.equal(conflict?.props.state, "conflict")
  assert.equal(conflict?.props.actionLabel, "Auswahl prüfen")
  assert.deepEqual(expectedRevisions, [0])
  conflict?.props.onAction?.()
  tree = await renderSettled(harness)

  assert.deepEqual(expectedRevisions, [0, 1])
  assert.equal(findByType(tree, ProductFitComparison), null)
})

test("a generic product mutation conflict adopts the latest draft without captured retry", async () => {
  const revisions: number[] = []
  const gateway = createAuthorityTestGateway()
  const originalMutate = gateway.mutate.bind(gateway)
  gateway.mutate = async (input) => {
    revisions.push(input.expectedRevision)
    if (revisions.length === 1) {
      const saved = await originalMutate(input)
      assert.equal(saved.status, "saved")
      return {
        status: "conflict",
        latestDraft: {
          ...saved.draft,
          pass: "need_revision_review",
          categoryCursor: null,
          inventoryAuthority: {
            schemaVersion: 1,
            stage2RefinedNeedVersionId: saved.draft.refinedVersionId,
            inventorySnapshotFingerprint: "a".repeat(64),
            status: "pending",
            proposalFingerprint: "b".repeat(64),
            proposedInputHash: "c".repeat(64),
            proposedOutputSnapshot: null,
            materialDelta: [
              {
                kind: "category_added",
                category: "deep_cleansing_shampoo",
                before: null,
                after: "optional",
              },
            ],
            resolvedFingerprint: null,
          },
          inventoryDispositions: [],
        },
      }
    }
    return originalMutate(input)
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-catalog-capture-conflict",
    refinedVersionId: "refined-catalog-capture-conflict",
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
  capture?.props.onQueryChange("shampoo")
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  assert.equal(capture?.props.searchStatus, "ready")
  capture?.props.onSelectCandidate(capture.props.searchResults[0]!.candidateId)
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  capture?.props.onFrequencyChange("weekly_2x")
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  capture?.props.onContinue()
  await new Promise((resolve) => setImmediate(resolve))

  tree = await renderSettled(harness)
  const recovery = findByType<React.ComponentProps<typeof Stage3SystemState>>(
    tree,
    Stage3SystemState,
  )
  assert.equal(revisions[0], 0)
  assert.equal(recovery?.props.state, "conflict")
  assert.equal(recovery?.props.actionLabel, "Weiter prüfen")

  recovery?.props.onAction?.()
  tree = await renderSettled(harness)

  assert.deepEqual(revisions, [0])
  assert.ok(findByType(tree, Stage3NeedRevisionCheckpoint))
})

test("a stale refined source offers a current-state reload instead of retrying the obsolete mutation", async () => {
  let mutationCalls = 0
  const gateway = createAuthorityTestGateway()
  gateway.mutate = async () => {
    mutationCalls += 1
    throw new Stage3ProductsGatewayError("stale_refined_source")
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-stale-source",
    refinedVersionId: "refined-stale-source",
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
  capture?.props.onQueryChange("shampoo")
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  capture?.props.onSelectCandidate(capture.props.searchResults[0]!.candidateId)
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  capture?.props.onFrequencyChange("weekly_2x")
  tree = await renderSettled(harness)
  capture = findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )
  capture?.props.onContinue()
  await new Promise((resolve) => setImmediate(resolve))

  tree = await renderSettled(harness)
  const recovery = findByType<React.ComponentProps<typeof Stage3SystemState>>(
    tree,
    Stage3SystemState,
  )
  assert.equal(mutationCalls, 1)
  assert.equal(recovery?.props.state, "conflict")
  assert.equal(recovery?.props.actionLabel, "Aktuellen Stand laden")
  assert.match(recovery?.props.message ?? "", /aktuellen Stand/)
})

test("direct authority decision requests preserve stale refined-source recovery", async () => {
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
      draftId: "draft-direct-stale-decision",
      userId: "user-direct-stale-decision",
      personalPlanId: "plan-direct-stale-decision",
      refinedVersionId: "refined-direct-stale-decision",
      requirements,
      now: "2026-08-11T00:00:00.000Z",
    }),
    pass: "product_decisions",
    categoryCursor: null,
    products: [
      {
        capturedProductId: "capture-direct-stale-decision",
        userProductId: "product-direct-stale-decision",
        identity: {
          kind: "catalog_product",
          productId: "catalog-direct-stale-decision",
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
        capturedProductId: "capture-direct-stale-decision",
        category: "conditioner",
        roles: ["conditioner_rinse_out"],
      },
    ],
  }
  const subject = deriveStage3DecisionSubjects(initialDraft)[0]!
  const evaluation = testAuthorityEvaluation(initialDraft, subject)
  const fixtureGateway = createFixtureStage3Gateway({ searchDelayMs: 0 })
  const gateway = { ...fixtureGateway, resolveDecision: undefined }
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
    fitComparisons: testFitComparisons(initialDraft),
  }
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "stale_refined_source" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    })
  try {
    const harness = createClientStateHarness(() => Stage3ProductsFlow({ bootstrap, gateway }))
    let tree = await renderSettled(harness)
    const decisionScreen = findByType<React.ComponentProps<typeof ProductFitComparison>>(
      tree,
      ProductFitComparison,
    )
    assert.ok(decisionScreen)
    await decisionScreen.props.onAction("keep_owned")
    await waitForReviewedChoicesToSubmit(harness)
    tree = await renderSettled(harness)

    const recovery = findByType<React.ComponentProps<typeof Stage3SystemState>>(
      tree,
      Stage3SystemState,
    )
    assert.equal(recovery?.props.state, "conflict")
    assert.equal(recovery?.props.actionLabel, "Aktuellen Stand laden")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("a decision conflict installs the latest committed draft as the receipt", async () => {
  const revisions: number[] = []
  const gateway = createAuthorityTestGateway()
  const originalResolveDecision = gateway.resolveDecision.bind(gateway)
  gateway.resolveDecision = async (input) => {
    revisions.push(input.expectedRevision)
    if (revisions.length === 1) {
      const saved = await originalResolveDecision(input)
      assert.equal(saved.status, "saved")
      return { status: "conflict", latestDraft: saved.draft }
    }
    return originalResolveDecision(input)
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-decision-conflict",
    refinedVersionId: "refined-decision-conflict",
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

  await captureCatalogProduct(harness, "Shampoo", "shampoo")
  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  await assignEveryRoleToFirstProduct(harness)
  tree = await renderSettled(harness)
  const decision = findByType<React.ComponentProps<typeof ProductFitComparison>>(
    tree,
    ProductFitComparison,
  )
  assert.ok(decision)
  await decision.props.onAction("keep_owned")
  await waitForReviewedChoicesToSubmit(harness)

  tree = await renderSettled(harness)
  const recovery = findByType<React.ComponentProps<typeof Stage3SystemState>>(
    tree,
    Stage3SystemState,
  )
  assert.equal(recovery?.props.state, "conflict")
  assert.equal(recovery?.props.actionLabel, "Auswahl prüfen")
  recovery?.props.onAction?.()
  await new Promise((resolve) => setImmediate(resolve))

  assert.deepEqual(revisions, [1])
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

  const decision = findByType<React.ComponentProps<typeof ProductFitComparison>>(
    tree,
    ProductFitComparison,
  )
  assert.ok(decision)
  decision.props.onBack()
  assert.equal(refinementExits, 0)
  tree = await renderSettled(harness)
  assert.ok(findByType(tree, ProductCaptureScreen))
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
    const tree = await renderSettled(harness)
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
  const tree = await renderSettled(harness)
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

test("waiting for analysis advances a pending product without framing it as exclusion", async () => {
  for (const actionKind of ["pending"] as const) {
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
      findByType<React.ComponentProps<typeof ProductFitComparison>>(tree, ProductFitComparison),
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
      ["keep_pending"],
    )
  }
})

test("a final pending decision starts one batch and suppresses a duplicate intent", async () => {
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
  const decisionScreen = findByType<React.ComponentProps<typeof ProductFitComparison>>(
    tree,
    ProductFitComparison,
  )
  assert.ok(decisionScreen)
  decisionScreen.props.onAction("keep_pending")
  decisionScreen.props.onAction("keep_pending")

  assert.equal(resolveCalls, 0)
  tree = await harness.render()
  assert.equal(resolveCalls, 1)
  assert.equal(
    findByType<React.ComponentProps<typeof Stage3SystemState>>(tree, Stage3SystemState)?.props
      .title,
    "Dein Plan wird vorbereitet.",
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

test("a final clear-fit acceptance starts one batch under the preparation screen", async () => {
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
  let singleCalls = 0
  gateway.resolveDecision = async (input) => {
    singleCalls += 1
    await firstDecisionPending
    return originalResolveDecision(input)
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
  )?.props.onContinue()
  tree = await renderSettled(harness)
  assert.equal(findByType(tree, SemanticRoleAssignment), null)
  const review = findByType<React.ComponentProps<typeof ProductFitComparison>>(
    tree,
    ProductFitComparison,
  )
  assert.ok(review)
  review.props.onAction("keep_owned")
  review.props.onAction("keep_owned")

  assert.equal(singleCalls, 0, "finalization starts from the rendered final state")
  tree = await harness.render()
  assert.equal(singleCalls, 1)
  assert.equal(
    findByType<React.ComponentProps<typeof Stage3SystemState>>(tree, Stage3SystemState)?.props
      .title,
    "Dein Plan wird vorbereitet.",
  )

  releaseFirstDecision()
  await new Promise((resolve) => setImmediate(resolve))
  await renderSettled(harness)
  assert.equal(singleCalls, 1)
})

test("the last product choice submits one decision batch under one preparation screen", async () => {
  const gateway = createAuthorityTestGateway({
    evaluate(draft, subject) {
      const evaluation = testAuthorityEvaluation(draft, subject)
      assert.equal(evaluation.status, "known")
      return {
        ...evaluation,
        status: "known",
        verdict: "ideal",
        allowedActions: ["keep_owned"],
        recommendation: null,
        recommendationFactFingerprint: null,
      }
    },
  })
  const resolveOne = gateway.resolveDecision.bind(gateway)
  let releaseBatch!: () => void
  const batchPending = new Promise<void>((resolve) => {
    releaseBatch = resolve
  })
  let batchCalls = 0
  gateway.resolveDecisions = async (input) => {
    batchCalls += 1
    await batchPending
    let expectedRevision = input.expectedRevision
    let result: Stage3MutationResponse | null = null
    for (const intent of input.intents) {
      result = await resolveOne({ draftId: input.draftId, expectedRevision, intent })
      if (result.status === "conflict") return result
      expectedRevision = result.draft.revision
    }
    assert.ok(result)
    return result
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-final-decision-batch",
    refinedVersionId: "refined-final-decision-batch",
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
  )?.props.onContinue()
  tree = await renderSettled(harness)
  const review = findByType<React.ComponentProps<typeof ProductFitComparison>>(
    tree,
    ProductFitComparison,
  )
  assert.ok(review)
  review.props.onAction("keep_owned")

  tree = await harness.render()
  assert.equal(batchCalls, 1)
  const preparing = findByType<React.ComponentProps<typeof Stage3SystemState>>(
    tree,
    Stage3SystemState,
  )
  assert.equal(preparing?.props.state, "loading")
  assert.equal(preparing?.props.title, "Dein Plan wird vorbereitet.")

  releaseBatch()
  await renderSettled(harness)
  assert.equal(batchCalls, 1)
})

test("an unconfirmed final request leaves the loader for a durable recovery action", async () => {
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
  let releaseBatch!: () => void
  const batchPending = new Promise<void>((resolve) => {
    releaseBatch = resolve
  })
  gateway.resolveDecisions = async () => {
    await batchPending
    throw new Error("released after timeout")
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-final-timeout",
    refinedVersionId: "refined-final-timeout",
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
    Stage3ProductsFlow({
      entryContext,
      gateway,
      searchDebounceMs: 0,
      finalizationTimeoutMs: 5,
    }),
  )

  await captureCatalogProduct(harness, "Conditioner", "condition", 0)
  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductFitComparison>>(
    tree,
    ProductFitComparison,
  )?.props.onAction("keep_owned")
  tree = await renderSettled(harness)

  await new Promise((resolve) => setTimeout(resolve, 10))
  tree = await renderSettled(harness)
  const recovery = findByType<React.ComponentProps<typeof Stage3SystemState>>(
    tree,
    Stage3SystemState,
  )
  assert.equal(recovery?.props.state, "error")
  assert.equal(recovery?.props.title, "Speicherstatus noch offen.")
  assert.equal(recovery?.props.actionLabel, "Speicherstatus erneut prüfen")

  releaseBatch()
})

test("an ordinary reload restores local review choices for the same canonical revision", async () => {
  const requirements: Stage3EntryContext["orderedCategories"] = [
    {
      category: "conditioner",
      requiredRoles: ["conditioner_rinse_out"],
      needSummary: "Pflege nach der Wäsche",
      authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
    },
  ]
  const draft: Stage3ProductDraft = {
    ...createStage3Draft({
      draftId: "draft-local-review-reload",
      userId: "user-local-review-reload",
      personalPlanId: "plan-local-review-reload",
      refinedVersionId: "refined-local-review-reload",
      requirements,
      now: "2026-08-14T00:00:00.000Z",
    }),
    pass: "product_decisions",
    categoryCursor: null,
    products: [
      {
        capturedProductId: "capture-local-review-reload",
        userProductId: "product-local-review-reload",
        identity: {
          kind: "catalog_product",
          productId: "catalog-local-review-reload",
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
        capturedProductId: "capture-local-review-reload",
        category: "conditioner",
        roles: ["conditioner_rinse_out"],
      },
    ],
  }
  const subject = deriveStage3DecisionSubjects(draft)[0]!
  const evaluation = testAuthorityEvaluation(draft, subject)
  const storage = createMemoryPendingStage3RecoveryStorage()
  writeStage3ReviewDraft(
    storage,
    { ownerId: draft.userId, personalPlanId: draft.personalPlanId, draftId: draft.draftId },
    {
      expectedRevision: draft.revision,
      choices: {
        [subject.decisionKey]: {
          kind: "decision",
          intent: {
            type: "resolve_decision",
            subjectKey: subject.decisionKey,
            action: "keep_owned",
          },
        },
      },
      order: [subject.decisionKey],
      updatedAt: Date.now(),
    },
  )
  const bootstrap: Stage3Bootstrap = {
    entryContext: {
      schemaVersion: 1,
      personalPlanId: draft.personalPlanId,
      refinedVersionId: draft.refinedVersionId,
      orderedCategories: requirements,
      inventoryPrompts: [
        { category: "conditioner", allowsMultiple: true, allowsExplicitNone: true },
      ],
    },
    draft,
    requirements,
    authorityEvaluations: [evaluation],
    fitComparisons: testFitComparisons(draft),
  }
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({
      bootstrap,
      gateway: createAuthorityTestGateway(),
      pendingRecoveryStorage: storage,
    }),
  )

  const tree = await renderSettled(harness)
  assert.equal(findByType(tree, ProductFitComparison), null)

  writeStage3ReviewDraft(
    storage,
    { ownerId: draft.userId, personalPlanId: draft.personalPlanId, draftId: draft.draftId },
    {
      expectedRevision: draft.revision,
      choices: {
        [subject.decisionKey]: {
          kind: "decision",
          intent: {
            type: "resolve_decision",
            subjectKey: subject.decisionKey,
            action: "select_replacement",
            selectedCandidateId: "stale-candidate",
            selectedCandidateFactFingerprint: "stale-fingerprint",
          },
        },
      },
      order: [subject.decisionKey],
      updatedAt: Date.now(),
    },
  )
  const staleTree = await renderSettled(
    createClientStateHarness(() =>
      Stage3ProductsFlow({
        bootstrap,
        gateway: createAuthorityTestGateway(),
        pendingRecoveryStorage: storage,
      }),
    ),
  )
  assert.ok(
    findByType(staleTree, ProductFitComparison),
    "a stale replacement fingerprint must return to the affected review",
  )

  if (evaluation.status !== "known") throw new Error("expected a known authority evaluation")
  const changedRecommendation = {
    ...evaluation,
    status: "known" as const,
    verdict: "mismatch" as const,
    allowedActions: ["plan_recommendation" as const],
    recommendation: {
      recommendationId: "recommendation-after-reload",
      productId: "product-after-reload",
      category: subject.category,
      role: subject.role,
      displayName: "Neue Empfehlung",
      reason: "Die aktuelle Empfehlung hat sich geändert.",
      authorityRuleId: "test.authority",
    },
    recommendationFactFingerprint: "facts:recommendation-after-reload",
  }
  writeStage3ReviewDraft(
    storage,
    { ownerId: draft.userId, personalPlanId: draft.personalPlanId, draftId: draft.draftId },
    {
      expectedRevision: draft.revision,
      choices: {
        [subject.decisionKey]: {
          kind: "decision",
          intent: {
            type: "resolve_decision",
            subjectKey: subject.decisionKey,
            action: "plan_recommendation",
          },
        },
      },
      order: [subject.decisionKey],
      updatedAt: Date.now(),
    },
  )
  const changedRecommendationTree = await renderSettled(
    createClientStateHarness(() =>
      Stage3ProductsFlow({
        bootstrap: {
          ...bootstrap,
          authorityEvaluations: [changedRecommendation],
        },
        gateway: createAuthorityTestGateway(),
        pendingRecoveryStorage: storage,
      }),
    ),
  )
  assert.ok(
    findByType(changedRecommendationTree, ProductFitComparison),
    "a recommendation choice without its reviewed product identity must be reviewed again",
  )
})

test("Oil roles remain individual decisions", async () => {
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

  const review = findByType<React.ComponentProps<typeof ProductFitComparison>>(
    tree,
    ProductFitComparison,
  )
  assert.ok(review)
  assert.equal(review.props.comparison.category, "oil")
  assert.deepEqual(
    {
      categoryLabel: review.props.categoryLabel,
      roleLabel: review.props.roleLabel,
      reviewPosition: review.props.reviewPosition,
      reviewTotal: review.props.reviewTotal,
    },
    {
      categoryLabel: "Öl",
      roleLabel: "Vor der Haarwäsche",
      reviewPosition: 1,
      reviewTotal: 3,
    },
  )
  assert.deepEqual(intents, [])
})

test("a canonical conflict never re-presents subjects that are already resolved", async () => {
  const requirements: Stage3EntryContext["orderedCategories"] = [
    {
      category: "oil",
      requiredRoles: ["leave_on_fibre_conditioning", "dry_finish"],
      needSummary: "Pflege und Finish für deine Längen",
      authorityVersion: CATEGORY_ROLE_POLICIES.oil.authorityVersion,
    },
  ]
  const draft: Stage3ProductDraft = {
    ...createStage3Draft({
      draftId: "draft-mixed-conflict",
      userId: "user-mixed-conflict",
      personalPlanId: "plan-mixed-conflict",
      refinedVersionId: "refined-mixed-conflict",
      requirements,
      now: "2026-08-14T00:00:00.000Z",
    }),
    pass: "product_decisions",
    categoryCursor: null,
    products: [
      {
        capturedProductId: "capture-mixed-conflict",
        userProductId: "product-mixed-conflict",
        identity: {
          kind: "catalog_product",
          productId: "catalog-mixed-conflict",
          displayName: "Pflegeöl",
          category: "oil",
        },
        frequencyRange: "weekly_2x",
        ownership: "owned",
        source: "catalog_search",
      },
    ],
    roleAssignments: [
      {
        capturedProductId: "capture-mixed-conflict",
        category: "oil",
        roles: ["leave_on_fibre_conditioning", "dry_finish"],
      },
    ],
  }
  const subjects = deriveStage3DecisionSubjects(draft)
  const evaluations = subjects.map((subject) => testAuthorityEvaluation(draft, subject))
  const canonicalDraft: Stage3ProductDraft = {
    ...draft,
    revision: 1,
    decisions: [
      testAuthorityDecision(subjects[0]!, evaluations[0]!, {
        type: "resolve_decision",
        subjectKey: subjects[0]!.decisionKey,
        action: "keep_owned",
      }),
    ],
  }
  const bootstrap: Stage3Bootstrap = {
    entryContext: {
      schemaVersion: 1,
      personalPlanId: canonicalDraft.personalPlanId,
      refinedVersionId: canonicalDraft.refinedVersionId,
      orderedCategories: requirements,
      inventoryPrompts: [{ category: "oil", allowsMultiple: true, allowsExplicitNone: true }],
    },
    draft: canonicalDraft,
    requirements,
    authorityEvaluations: evaluations,
    fitComparisons: testFitComparisons(canonicalDraft),
  }

  const tree = await renderSettled(
    createClientStateHarness(() =>
      Stage3ProductsFlow({ bootstrap, gateway: createAuthorityTestGateway() }),
    ),
  )
  const review = findByType<React.ComponentProps<typeof ProductFitComparison>>(
    tree,
    ProductFitComparison,
  )
  assert.equal(review?.props.comparison.subjectKey, subjects[1]!.decisionKey)
  assert.equal(review?.props.reviewTotal, 1)
})

test("Back from a later review edits the previous local decision without reopening capture", async () => {
  const reviewEvents: string[] = []
  const analytics = {
    track(eventName: string) {
      if (eventName.includes("review_")) reviewEvents.push(eventName)
    },
  } as Stage3AnalyticsPort
  const gateway = createAuthorityTestGateway()
  const originalMutate = gateway.mutate.bind(gateway)
  const reopenedCategories: PersonalPlanCategory[] = []
  gateway.mutate = async (input) => {
    if (input.mutation.type === "reopen_capture_category") {
      reopenedCategories.push(input.mutation.category)
    }
    return originalMutate(input)
  }
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-review-back-correction",
    refinedVersionId: "refined-review-back-correction",
    orderedCategories: [
      {
        category: "oil",
        requiredRoles: ["leave_on_fibre_conditioning", "dry_finish"],
        needSummary: "Pflege und Finish für deine Längen",
        authorityVersion: CATEGORY_ROLE_POLICIES.oil.authorityVersion,
      },
    ],
    inventoryPrompts: [{ category: "oil", allowsMultiple: true, allowsExplicitNone: true }],
  }
  const storage = createMemoryPendingStage3RecoveryStorage()
  const harness = createClientStateHarness(() =>
    Stage3ProductsFlow({
      entryContext,
      gateway,
      searchDebounceMs: 0,
      analytics,
      pendingRecoveryStorage: storage,
    }),
  )

  await captureCatalogProduct(harness, "Öl", "oil")
  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  await assignEveryRoleToFirstProduct(harness)

  tree = await renderSettled(harness)
  const firstReview = findByType<React.ComponentProps<typeof ProductFitComparison>>(
    tree,
    ProductFitComparison,
  )
  assert.ok(firstReview, textContent(tree))
  const firstDecisionKey = firstReview.props.comparison.subjectKey
  await firstReview.props.onAction("keep_owned")

  tree = await renderSettled(harness)
  const secondReview = findByType<React.ComponentProps<typeof ProductFitComparison>>(
    tree,
    ProductFitComparison,
  )
  assert.ok(secondReview)
  assert.notEqual(secondReview.props.comparison.subjectKey, firstDecisionKey)
  await secondReview.props.onBack()
  tree = await renderSettled(harness)

  assert.deepEqual(reopenedCategories, [])
  assert.ok(reviewEvents.includes("personal_plan_stage3_review_viewed"))
  assert.ok(reviewEvents.includes("personal_plan_stage3_review_action"))
  assert.ok(reviewEvents.includes("personal_plan_stage3_review_back"))
  assert.equal(
    findByType<React.ComponentProps<typeof ProductFitComparison>>(tree, ProductFitComparison)?.props
      .comparison.subjectKey,
    firstDecisionKey,
  )
  assert.equal(findByType(tree, ProductCaptureScreen), null)
  assert.equal(
    readStage3ReviewDraft(storage, {
      ownerId: "fixture-user",
      personalPlanId: entryContext.personalPlanId,
      draftId: "fixture-stage3-draft",
    })?.choices[firstDecisionKey]?.kind,
    "decision",
    "Back must retain the previous local choice while reopening it for editing",
  )
})

test("multiple individual reviews progress to one direct Routine handoff", async () => {
  const events: string[] = []
  const analytics = {
    track(eventName: string) {
      events.push(eventName)
    },
  } as Stage3AnalyticsPort
  const handoffs: Stage3RoutineHandoff[] = []
  const gateway = createAuthorityTestGateway()
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "plan-multiple-review-handoff",
    refinedVersionId: "refined-multiple-review-handoff",
    orderedCategories: [
      {
        category: "oil",
        requiredRoles: ["leave_on_fibre_conditioning", "dry_finish"],
        needSummary: "Pflege und Finish für deine Längen",
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
      analytics,
    }),
  )

  await captureCatalogProduct(harness, "Öl", "oil")
  let tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  await assignEveryRoleToFirstProduct(harness)

  for (let index = 0; index < 2; index += 1) {
    tree = await renderSettled(harness)
    const review = findByType<React.ComponentProps<typeof ProductFitComparison>>(
      tree,
      ProductFitComparison,
    )
    assert.ok(review)
    review.props.onAction("keep_owned")
    tree = await renderSettled(harness)
  }
  await waitForReviewedChoicesToSubmit(harness)
  await new Promise((resolve) => setImmediate(resolve))
  await renderSettled(harness)

  assert.equal(handoffs.length, 1)
  assert.ok(events.includes("personal_plan_stage3_review_completed"))
  assert.ok(events.includes("personal_plan_stage3_routine_opened"))
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

test("Oil clear fits remain explicit rather than auto-resolving", async () => {
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

  const screen = findByType<React.ComponentProps<typeof ProductFitComparison>>(
    tree,
    ProductFitComparison,
  )
  assert.ok(screen)
  assert.equal(screen.props.comparison.category, "oil")
  assert.deepEqual(intents, [])
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
  assert.equal(findByType(tree, SemanticRoleAssignment), null)

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
  capture?.props.onOpenFallbackIntake()
  tree = await renderSettled(harness)
  const heatFallback = findByType<React.ComponentProps<typeof IntakeFallbackBoundary>>(
    tree,
    IntakeFallbackBoundary,
  )
  heatFallback?.props.onFrequencyChange("weekly_1x")
  heatFallback?.props.onProductNameChange?.("Hitzeschutz Spray")
  tree = await renderSettled(harness)
  await findByType<React.ComponentProps<typeof IntakeFallbackBoundary>>(
    tree,
    IntakeFallbackBoundary,
  )?.props.onOpen()
  tree = await renderSettled(harness)
  findByType<React.ComponentProps<typeof ProductCaptureScreen>>(
    tree,
    ProductCaptureScreen,
  )?.props.onContinue()
  await assignEveryRoleToFirstProduct(harness)

  tree = await renderSettled(harness)
  const review = findByType<React.ComponentProps<typeof ProductFitComparison>>(
    tree,
    ProductFitComparison,
  )
  assert.ok(review)
  assert.equal(review.props.comparison.subjectKey.length > 0, true)
  assert.deepEqual(intents, [])
  assert.deepEqual(handoffs, [])
})
