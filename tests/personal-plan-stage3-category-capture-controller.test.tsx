import assert from "node:assert/strict"
import test from "node:test"
import React from "react"

import {
  commandFromDraft,
  createStage3CategoryCaptureScope,
  orderQueuedCategoryCaptures,
  useStage3CategoryCaptureController,
} from "../src/components/personal-plan-products/use-stage3-category-capture-controller"
import { noOpStage3Analytics } from "../src/lib/personal-plan/products/stage3-analytics"
import { CATEGORY_ROLE_POLICIES } from "../src/lib/personal-plan/products/authorities"
import {
  createCategoryCaptureQueue,
  createMemoryCategoryCaptureQueueStorage,
  type CategoryCaptureCommand,
} from "../src/lib/personal-plan/products/category-capture-queue"
import {
  PERSONAL_PLAN_PRODUCT_CATEGORIES,
  type Stage3AuthoritySnapshotV1,
  type PersonalPlanCategory,
  type Stage3CategoryRequirement,
  type Stage3ProductDraft,
} from "../src/lib/personal-plan/products/contracts"
import type { Stage3MutationResponse } from "../src/lib/personal-plan/products/gateway"
import { createStage3Draft } from "../src/lib/personal-plan/products/state-machine"

type ReactDispatcherInternals = {
  H: unknown
}

type HookStateHarness = {
  render: () => Promise<void>
}

function createHookStateHarness(renderHook: () => void): HookStateHarness {
  const reactInternals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const previousDispatcher = reactInternals.H
  const hookValues: unknown[] = []
  let cursor = 0
  let pendingEffects: Array<() => void | Promise<void>> = []

  function depsChanged(previous: unknown[] | undefined, next: unknown[] | undefined): boolean {
    return (
      !previous ||
      !next ||
      previous.length !== next.length ||
      next.some((dep, index) => dep !== previous[index])
    )
  }

  const dispatcher = {
    useEffect(effect: () => void | Promise<void>, deps?: unknown[]) {
      const stateIndex = cursor
      cursor += 1
      const previous = hookValues[stateIndex] as { deps: unknown[] | undefined } | undefined
      if (depsChanged(previous?.deps, deps)) {
        hookValues[stateIndex] = { deps }
        pendingEffects.push(effect)
      }
    },
    useMemo<T>(factory: () => T, deps?: unknown[]): T {
      const stateIndex = cursor
      cursor += 1
      const previous = hookValues[stateIndex] as
        | { deps: unknown[] | undefined; value: T }
        | undefined
      if (previous && !depsChanged(previous.deps, deps)) return previous.value
      const value = factory()
      hookValues[stateIndex] = { deps, value }
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
        renderHook()
        const effects = pendingEffects
        pendingEffects = []
        for (const effect of effects) await effect()
        await Promise.resolve()
      } finally {
        reactInternals.H = previousDispatcher
      }
    },
  }
}

const requirements: Stage3CategoryRequirement[] = [
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
]

function draft(overrides: Partial<Stage3ProductDraft> = {}): Stage3ProductDraft {
  return {
    ...createStage3Draft({
      draftId: "draft-controller",
      userId: "owner-controller",
      personalPlanId: "plan-controller",
      refinedVersionId: "refined-controller",
      requirements,
      now: "2026-08-11T00:00:00.000Z",
    }),
    ...overrides,
  }
}

function command(category: PersonalPlanCategory = "shampoo"): CategoryCaptureCommand {
  return {
    category,
    candidates: [
      {
        kind: "catalog",
        candidateId: "fixture-shampoo-a",
        frequencyRange: "weekly_2x",
        roles: category === "shampoo" ? ["shampoo_everyday"] : ["conditioner_rinse_out"],
      },
    ],
    uncoveredRoles: [],
    expectedRevision: 1,
  }
}

test("category capture scope preserves owner identity and authority fingerprint", () => {
  const sourceDraft = draft({ revision: 7 })
  const scope = createStage3CategoryCaptureScope({
    draft: sourceDraft,
    personalPlanId: sourceDraft.personalPlanId,
    category: "shampoo",
    currentRequirement: requirements[0]!,
    authoritySnapshot: {
      schemaVersion: 1,
      refinedNeedVersionId: "refined-authority",
      refinedInputHash: "hash-authority",
      categoryDecisions: [],
      coverage: [],
      orderedCategories: ["shampoo"],
      authorityVersions: Object.fromEntries(
        PERSONAL_PLAN_PRODUCT_CATEGORIES.map((category) => [
          category,
          CATEGORY_ROLE_POLICIES[category].authorityVersion,
        ]),
      ) as Stage3AuthoritySnapshotV1["authorityVersions"],
    },
  })

  assert.equal(scope.ownerId, "owner-controller")
  assert.equal(scope.personalPlanId, "plan-controller")
  assert.equal(scope.draftId, "draft-controller")
  assert.equal(scope.refinedNeedVersionId, "refined-authority")
  assert.equal(scope.refinedInputHash, "hash-authority")
  assert.equal(scope.categoryAuthorityVersion, requirements[0]!.authorityVersion)
})

test("command projection from a draft remains identifier-only and role-complete", () => {
  const sourceDraft = draft({
    products: [
      {
        capturedProductId: "captured-shampoo",
        userProductId: "user-product-shampoo",
        identity: {
          kind: "catalog_product",
          productId: "catalog-shampoo",
          displayName: "Display identity must not enter queue commands",
          category: "shampoo",
        },
        frequencyRange: "weekly_3_4x",
        ownership: "owned",
        source: "catalog_search",
      },
    ],
    roleAssignments: [
      {
        capturedProductId: "captured-shampoo",
        category: "shampoo",
        roles: ["shampoo_everyday"],
      },
    ],
    uncoveredRoles: [
      { category: "conditioner", role: "conditioner_rinse_out", reason: "not_ready_to_decide" },
    ],
  })
  const scope = createStage3CategoryCaptureScope({
    draft: sourceDraft,
    personalPlanId: sourceDraft.personalPlanId,
    category: "shampoo",
    currentRequirement: requirements[0]!,
  })

  assert.deepEqual(commandFromDraft(sourceDraft, scope, 9), {
    category: "shampoo",
    candidates: [
      {
        kind: "catalog",
        candidateId: "catalog-shampoo",
        frequencyRange: "weekly_3_4x",
        roles: ["shampoo_everyday"],
      },
    ],
    uncoveredRoles: [],
    expectedRevision: 9,
  })
})

test("queued category replay follows the stage requirement order", () => {
  const ordered = orderQueuedCategoryCaptures(requirements, [
    { scope: { category: "conditioner" as const }, command: command("conditioner") },
    { scope: { category: "shampoo" as const }, command: command("shampoo") },
  ])

  assert.deepEqual(
    ordered.map((item) => item.scope.category),
    ["shampoo", "conditioner"],
  )
})

test("hook enqueue uses one replacement command, advances optimistically, and clears storage", async () => {
  const requirementsWithSkippedCategory: Stage3CategoryRequirement[] = [
    requirements[0]!,
    {
      category: "leave_in",
      requiredRoles: ["post_wash_leave_in"],
      needSummary: "Bereits ohne Produkt abgeschlossen",
      authorityVersion: CATEGORY_ROLE_POLICIES.leave_in.authorityVersion,
    },
    requirements[1]!,
  ]
  let sourceDraft: Stage3ProductDraft = {
    ...createStage3Draft({
      draftId: "draft-controller",
      userId: "owner-controller",
      personalPlanId: "plan-controller",
      refinedVersionId: "refined-controller",
      requirements: requirementsWithSkippedCategory,
      now: "2026-08-11T00:00:00.000Z",
    }),
    completedCaptureCategories: ["leave_in" as const],
  }
  let controller: ReturnType<typeof useStage3CategoryCaptureController> | undefined
  const storage = createMemoryCategoryCaptureQueueStorage()
  const queue = createCategoryCaptureQueue({ storage, now: () => 1_000 })
  const openedCategories: number[] = []
  const mutations: Array<Parameters<(typeof gateway)["mutate"]>[0]> = []
  const gateway = {
    async mutate(input: {
      draftId: string
      expectedRevision: number
      mutation: {
        type: "replace_capture_category"
        category: PersonalPlanCategory
        refinedNeedVersionId: string
        refinedInputHash: string
        categoryAuthorityVersion: string
        candidates: CategoryCaptureCommand["candidates"]
        uncoveredRoles: CategoryCaptureCommand["uncoveredRoles"]
      }
    }): Promise<Stage3MutationResponse> {
      mutations.push(input)
      sourceDraft = {
        ...sourceDraft,
        revision: input.expectedRevision + 1,
        completedCaptureCategories: ["leave_in", input.mutation.category],
        categoryCursor: "conditioner",
      }
      return { status: "saved", draft: sourceDraft }
    },
  }
  const harness = createHookStateHarness(() => {
    controller = useStage3CategoryCaptureController({
      draft: sourceDraft,
      personalPlanId: sourceDraft.personalPlanId,
      requirements: requirementsWithSkippedCategory,
      currentRequirement: requirements[0]!,
      currentCategory: "shampoo",
      categoryIndex: 0,
      gateway,
      analytics: noOpStage3Analytics,
      readyToReconcile: false,
      queue,
      onDraftChange: (nextDraft) => {
        sourceDraft = nextDraft
      },
      onOpenCaptureCategory: (categoryIndex) => {
        openedCategories.push(categoryIndex)
      },
      onPrepareDecisionPhase: async () => {},
      onMutationError: (error) => {
        throw error
      },
      onConflict: () => {
        throw new Error("unexpected conflict")
      },
    })
  })

  await harness.render()
  assert.ok(controller)
  const scope = createStage3CategoryCaptureScope({
    draft: sourceDraft,
    personalPlanId: sourceDraft.personalPlanId,
    category: "shampoo",
    currentRequirement: requirements[0]!,
  })

  await controller.enqueueCategoryReplacement({
    working: [
      {
        key: "local:fixture-shampoo-a",
        displayName: "Shampoo A",
        candidate: {
          kind: "catalog",
          candidateId: "fixture-shampoo-a",
          frequencyRange: "weekly_2x",
          roles: [],
        },
      },
    ],
    assignments: { "local:fixture-shampoo-a": ["shampoo_everyday"] },
    uncoveredRoles: [],
  })
  await harness.render()

  assert.equal(mutations.length, 1)
  assert.equal(mutations[0]?.mutation.type, "replace_capture_category")
  assert.equal(mutations[0]?.expectedRevision, 0)
  assert.deepEqual(mutations[0]?.mutation.candidates, command().candidates)
  assert.deepEqual(openedCategories, [2])
  assert.equal(queue.load(scope), null)
  assert.equal(sourceDraft.revision, 1)
})
