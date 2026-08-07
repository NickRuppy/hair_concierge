import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"

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
} from "../src/components/personal-plan-products/stage3-products-flow"
import { CATEGORY_AUTHORITY_STUBS } from "../src/lib/personal-plan/products/authorities"
import type { Stage3EntryContext } from "../src/lib/personal-plan/products/contracts"

type ClientStateHarness = {
  render: () => Promise<ReactElement | null>
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
  const action = decision.actions.find((candidate) => candidate.kind === kind)
  assert.ok(action, `missing ${kind} action for ${decision.decisionKey}`)
  await screen.props.onChooseAction(decision.decisionKey, action)
}

test("stage 3 lab route is guarded and composed from the interactive flow", () => {
  const source = readFileSync(
    new URL("../src/app/labs/personal-plan/stage-3/page.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /isPersonalPlanStage3LabEnabled\(process\.env\)/)
  assert.match(source, /notFound\(\)/)
  assert.match(source, /<Stage3ProductsFlow \/>/)
})

test("integrated Stage 3 consumes the supplied refined entry context instead of fixture requirements", async () => {
  const entryContext: Stage3EntryContext = {
    schemaVersion: 1,
    personalPlanId: "fixture-personal-plan-integrated",
    refinedVersionId: "fixture-refined-integrated-r12",
    orderedCategories: [
      {
        category: "shampoo",
        requiredRoles: [...CATEGORY_AUTHORITY_STUBS.shampoo.requiredRoles],
        needSummary: "Sanfte Reinigung für deine empfindliche Kopfhaut.",
        authorityVersion: CATEGORY_AUTHORITY_STUBS.shampoo.authorityVersion,
      },
    ],
    inventoryPrompts: [
      {
        category: "shampoo",
        allowsMultiple: CATEGORY_AUTHORITY_STUBS.shampoo.allowsMultiple,
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

test("interactive lab flow captures products first, assigns roles, decides fit, and displays a typed handoff", async () => {
  const harness = createClientStateHarness(() => Stage3ProductsFlow({ searchDebounceMs: 0 }))
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
    roleScreen.props.onToggleRole(product.capturedProductId, "category_coverage", true)
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
  await fallback.props.onOpen()
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
  await chooseDecision(harness, "keep")
  await chooseDecision(harness, "pending")
  await chooseDecision(harness, "skip")

  tree = await renderSettled(harness)
  transition = findByType<React.ComponentProps<typeof Stage3Transition>>(tree, Stage3Transition)
  assert.equal(transition?.props.context, "routine_ready")
  transition.props.onContinue()
  tree = await renderSettled(harness)
  assert.equal(
    findByType<React.ComponentProps<typeof Stage3SystemState>>(tree, Stage3SystemState),
    null,
  )
  const handoff = findByType<React.ComponentProps<typeof PortfolioHandoff>>(tree, PortfolioHandoff)
  assert.ok(handoff)
  const handoffText = textContent(PortfolioHandoff(handoff.props))
  assert.match(handoffText, /Portfolio fixture-portfolio-/)
  assert.match(handoffText, /Routine-Entwurf fixture-routine-proposal-/)
  assert.equal(handoff.props.completion.portfolio.ownedProducts.length, 5)
  assert.equal(handoff.props.completion.portfolio.plannedPurchases.length, 1)
  assert.equal(handoff.props.completion.portfolio.pendingProducts.length, 1)
  assert.equal(handoff.props.completion.portfolio.uncoveredRoles.length, 3)
  assert.doesNotMatch(handoffText, /\b(?:Pass|Teil\s+\d|Stage|Stufe)\b/i)
})
