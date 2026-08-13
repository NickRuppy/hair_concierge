"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { CATEGORY_ROLE_POLICIES } from "@/lib/personal-plan/products/authorities"
import {
  categoryCaptureCommandsEqual,
  createBrowserCategoryCaptureQueueStorage,
  createCategoryCaptureQueue,
  type CategoryCaptureCommand,
  type CategoryCaptureQueue,
  type CategoryCaptureQueueScope,
} from "@/lib/personal-plan/products/category-capture-queue"
import type {
  PersonalPlanCategory,
  Stage3CategoryCaptureCandidate,
  Stage3CategoryRequirement,
  Stage3EntryContext,
  Stage3ProductDraft,
} from "@/lib/personal-plan/products/contracts"
import {
  Stage3ProductsGatewayError,
  type Stage3ProductsGateway,
} from "@/lib/personal-plan/products/gateway"
import type { Stage3AnalyticsPort } from "@/lib/personal-plan/products/stage3-analytics"
import type { PlanProductRole } from "@/lib/personal-plan/types"
import type { ProductFrequency } from "@/lib/vocabulary/frequencies"

import type { Stage3CatalogCandidate } from "."

export type LocalCatalogCapture = {
  candidate: Stage3CatalogCandidate
  frequencyRange: ProductFrequency
}

export type WorkingCategoryCapture = {
  key: string
  displayName: string
  candidate: Stage3CategoryCaptureCandidate
}

type Stage3CategoryCaptureControllerOptions = {
  draft: Stage3ProductDraft
  personalPlanId: string
  requirements: Stage3CategoryRequirement[]
  currentRequirement: Stage3CategoryRequirement
  currentCategory: PersonalPlanCategory
  categoryIndex: number
  authoritySnapshot?: Stage3EntryContext["authoritySnapshot"]
  gateway: Pick<Stage3ProductsGateway, "loadOrCreate" | "mutate">
  analytics: Stage3AnalyticsPort
  readyToReconcile: boolean
  queue?: CategoryCaptureQueue
  initialSaveLabel?: string
  onDraftChange: (draft: Stage3ProductDraft) => void
  onOpenCaptureCategory: (categoryIndex: number) => void
  onPrepareDecisionPhase: (draft: Stage3ProductDraft) => Promise<void>
  onMutationError: (error: unknown) => void
  onConflict: (latestDraft: Stage3ProductDraft) => void
}

export function useStage3CategoryCaptureController({
  draft,
  personalPlanId,
  requirements,
  currentRequirement,
  currentCategory,
  categoryIndex,
  authoritySnapshot,
  gateway,
  analytics,
  readyToReconcile,
  queue,
  initialSaveLabel = "Wird geladen",
  onDraftChange,
  onOpenCaptureCategory,
  onPrepareDecisionPhase,
  onMutationError,
  onConflict,
}: Stage3CategoryCaptureControllerOptions) {
  const categoryQueueRef = useRef<CategoryCaptureQueue | null>(queue ?? null)
  if (!categoryQueueRef.current) {
    categoryQueueRef.current = createCategoryCaptureQueue({
      storage: createBrowserCategoryCaptureQueueStorage(),
    })
  }
  const categoryQueue = categoryQueueRef.current
  const [saveLabel, setSaveLabel] = useState(initialSaveLabel)
  const [categoryFinalizeStatus, setCategoryFinalizeStatus] = useState<"idle" | "saving">("idle")
  const [categoryFinalizeAction, setCategoryFinalizeAction] = useState<"roles" | "gap" | null>(null)
  const [localCatalogCaptures, setLocalCatalogCaptures] = useState<LocalCatalogCapture[]>([])
  const [removedCapturedProductIds, setRemovedCapturedProductIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [queuedCategoryCount, setQueuedCategoryCount] = useState(0)
  const queuedCategoriesInFlight = useRef(new Set<PersonalPlanCategory>())
  const queueReconciliationStarted = useRef(false)

  const currentProducts = useMemo(
    () =>
      draft.products.filter(
        (product) =>
          product.identity.category === currentCategory &&
          !removedCapturedProductIds.has(product.capturedProductId),
      ),
    [currentCategory, draft.products, removedCapturedProductIds],
  )

  useEffect(() => {
    if (queueReconciliationStarted.current || !readyToReconcile) return
    const pending = categoryQueue.listForDraft({
      ownerId: draft.userId,
      personalPlanId,
      draftId: draft.draftId,
    })
    queueReconciliationStarted.current = true
    if (pending.length === 0) return
    void reconcileQueuedCategories(draft, pending).catch((error) => {
      onMutationError(error)
    })
    // Reconciliation must run once against the first authoritative loaded draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryQueue, draft.draftId, draft.userId, personalPlanId, readyToReconcile])

  function commitLocalCatalogCapture(
    candidate: Stage3CatalogCandidate | null,
    frequencyRange: ProductFrequency | null,
  ): LocalCatalogCapture | null {
    if (!candidate || candidate.assessmentStatus === "pending_analysis" || !frequencyRange) {
      return null
    }
    const capture = { candidate, frequencyRange }
    setLocalCatalogCaptures((current) => [
      ...current.filter((item) => item.candidate.candidateId !== candidate.candidateId),
      capture,
    ])
    return capture
  }

  function removeWorkingProduct(capturedProductId: string) {
    if (capturedProductId.startsWith("local:")) {
      const candidateId = capturedProductId.slice("local:".length)
      setLocalCatalogCaptures((current) =>
        current.filter((item) => item.candidate.candidateId !== candidateId),
      )
      return
    }
    setRemovedCapturedProductIds((current) => new Set([...current, capturedProductId]))
  }

  function workingCategoryCaptures(localCaptures = localCatalogCaptures): WorkingCategoryCapture[] {
    return [
      ...currentProducts.map((product): WorkingCategoryCapture => ({
        key: product.capturedProductId,
        displayName: product.identity.displayName,
        candidate:
          product.identity.kind === "catalog_product"
            ? {
                kind: "catalog",
                candidateId: product.identity.productId,
                frequencyRange: product.frequencyRange,
                roles: [],
              }
            : {
                kind: "pending",
                userProductId: product.userProductId,
                submissionId: product.identity.submissionId,
                frequencyRange: product.frequencyRange,
                roles: [],
              },
      })),
      ...localCaptures.map(({ candidate, frequencyRange }): WorkingCategoryCapture => ({
        key: `local:${candidate.candidateId}`,
        displayName: completeCandidateIdentity(candidate),
        candidate: {
          kind: "catalog",
          candidateId: candidate.candidateId,
          frequencyRange,
          roles: [],
        },
      })),
    ]
  }

  async function reconcileQueuedCategories(
    loadedDraft: Stage3ProductDraft,
    pending: Array<{ scope: CategoryCaptureQueueScope; command: CategoryCaptureCommand }>,
  ) {
    let canonical = loadedDraft
    categoryQueue.synchronizeRevision(canonical.revision)
    const ordered = orderQueuedCategoryCaptures(requirements, pending)
    setSaveLabel("Letzte Auswahl wird wiederhergestellt")
    for (const item of ordered) {
      if (canonical.completedCaptureCategories.includes(item.scope.category)) {
        const persisted = commandFromDraft(canonical, item.scope, item.command.expectedRevision)
        if (!categoryCaptureCommandsEqual(item.scope, persisted, item.command)) {
          throw new Error("stage3_cached_category_mismatch")
        }
        categoryQueue.acknowledge(item.scope)
        continue
      }
      if (canonical.categoryCursor !== item.scope.category) {
        throw new Error("stage3_cached_category_cursor_mismatch")
      }
      const result = await categoryQueue.enqueue(
        item.scope,
        { ...item.command, expectedRevision: canonical.revision },
        async (command) => {
          const response = await gateway.mutate({
            draftId: canonical.draftId,
            expectedRevision: command.expectedRevision,
            mutation: {
              type: "replace_capture_category",
              category: item.scope.category,
              refinedNeedVersionId: item.scope.refinedNeedVersionId,
              refinedInputHash: item.scope.refinedInputHash,
              categoryAuthorityVersion: item.scope.categoryAuthorityVersion,
              candidates: command.candidates,
              uncoveredRoles: command.uncoveredRoles,
            },
          })
          if (response.status === "conflict") {
            throw Object.assign(new Error("stage3_revision_conflict"), {
              latestDraft: response.latestDraft,
            })
          }
          return { response, acknowledgedRevision: response.draft.revision }
        },
      )
      canonical = result.response.draft
      onDraftChange(canonical)
    }
    setSaveLabel("Gespeichert")
    if (canonical.pass === "product_capture" && canonical.categoryCursor) {
      const nextIndex = requirements.findIndex(
        (requirement) => requirement.category === canonical.categoryCursor,
      )
      if (nextIndex < 0) throw new Error("stage3_category_cursor_invalid")
      onOpenCaptureCategory(nextIndex)
    } else {
      await onPrepareDecisionPhase(canonical)
    }
  }

  async function enqueueCategoryReplacement(input: {
    working: WorkingCategoryCapture[]
    assignments: Record<string, string[]>
    uncoveredRoles: CategoryCaptureCommand["uncoveredRoles"]
    expectedRevision?: number
  }) {
    const category = currentCategory
    if (queuedCategoriesInFlight.current.has(category)) return
    queuedCategoriesInFlight.current.add(category)
    const scope = createStage3CategoryCaptureScope({
      draft,
      personalPlanId,
      category,
      currentRequirement,
      authoritySnapshot,
    })
    const command: CategoryCaptureCommand = {
      category,
      candidates: input.working.map(({ key, candidate }) => ({
        ...candidate,
        roles: (input.assignments[key] ?? []) as PlanProductRole[],
      })),
      uncoveredRoles: input.uncoveredRoles,
      expectedRevision: input.expectedRevision ?? draft.revision,
    }
    const optimisticCompletedCategories = new Set([...draft.completedCaptureCategories, category])
    const nextCategoryIndex = requirements.findIndex(
      (requirement, index) =>
        index > categoryIndex && !optimisticCompletedCategories.has(requirement.category),
    )
    const isLastCategory = nextCategoryIndex < 0
    setQueuedCategoryCount((count) => count + 1)
    setSaveLabel("Wird im Hintergrund gespeichert")
    resetLocalCategoryState()
    if (isLastCategory) {
      setCategoryFinalizeStatus("saving")
      setCategoryFinalizeAction(input.working.length > 0 ? "roles" : "gap")
    } else {
      onOpenCaptureCategory(nextCategoryIndex)
    }

    try {
      const result = await enqueuePersistedCategoryCapture(scope, command)
      onDraftChange(result.response.draft)
      queuedCategoriesInFlight.current.delete(category)
      setQueuedCategoryCount((count) => Math.max(0, count - 1))
      setSaveLabel("Gespeichert")
      analytics.track("personal_plan_stage3_save_outcome", { outcome: "saved" })
      if (
        !isLastCategory &&
        result.response.draft.pass === "product_capture" &&
        result.response.draft.categoryCursor
      ) {
        const canonicalNextIndex = requirements.findIndex(
          (requirement) => requirement.category === result.response.draft.categoryCursor,
        )
        if (canonicalNextIndex < 0) throw new Error("stage3_category_cursor_invalid")
        if (canonicalNextIndex !== nextCategoryIndex) onOpenCaptureCategory(canonicalNextIndex)
      }
      if (isLastCategory) {
        await categoryQueue.drain()
        await onPrepareDecisionPhase(result.response.draft)
        finishCategoryFinalization()
      }
    } catch (error) {
      queuedCategoriesInFlight.current.delete(category)
      setQueuedCategoryCount((count) => Math.max(0, count - 1))
      finishCategoryFinalization()
      if (error instanceof Stage3ProductsGatewayError && error.code === "stale_refined_source") {
        onMutationError(error)
        return
      }
      const latestDraft = (error as Error & { latestDraft?: Stage3ProductDraft }).latestDraft
      if (latestDraft) {
        categoryQueue.synchronizeRevision(latestDraft.revision)
        onDraftChange(latestDraft)
        try {
          await reconcileCanonicalCategoryReplacement({
            canonical: latestDraft,
            scope,
            isLastCategory,
            nextCategoryIndex,
          })
        } catch (recoveryError) {
          onMutationError(recoveryError)
        }
      } else {
        try {
          await recoverUncertainCategoryReplacement({
            scope,
            isLastCategory,
            nextCategoryIndex,
          })
        } catch (recoveryError) {
          const recoveredConflict = (recoveryError as Error & { latestDraft?: Stage3ProductDraft })
            .latestDraft
          if (recoveredConflict) {
            categoryQueue.synchronizeRevision(recoveredConflict.revision)
            categoryQueue.acknowledge(scope)
            onDraftChange(recoveredConflict)
            onConflict(recoveredConflict)
          } else {
            onMutationError(recoveryError)
          }
        }
      }
    }
  }

  async function enqueuePersistedCategoryCapture(
    scope: CategoryCaptureQueueScope,
    command: CategoryCaptureCommand,
  ) {
    return categoryQueue.enqueue(scope, command, async (queuedCommand) => {
      const response = await gateway.mutate({
        draftId: scope.draftId,
        expectedRevision: queuedCommand.expectedRevision,
        mutation: {
          type: "replace_capture_category",
          category: scope.category,
          refinedNeedVersionId: scope.refinedNeedVersionId,
          refinedInputHash: scope.refinedInputHash,
          categoryAuthorityVersion: scope.categoryAuthorityVersion,
          candidates: queuedCommand.candidates,
          uncoveredRoles: queuedCommand.uncoveredRoles,
        },
      })
      if (response.status === "conflict") {
        const conflict = new Error("stage3_revision_conflict") as Error & {
          latestDraft?: Stage3ProductDraft
        }
        conflict.latestDraft = response.latestDraft
        throw conflict
      }
      return { response, acknowledgedRevision: response.draft.revision }
    })
  }

  async function recoverUncertainCategoryReplacement({
    scope,
    isLastCategory,
    nextCategoryIndex,
  }: {
    scope: CategoryCaptureQueueScope
    isLastCategory: boolean
    nextCategoryIndex: number
  }) {
    const response = await gateway.loadOrCreate({
      draftId: draft.draftId,
      userId: draft.userId,
      personalPlanId,
      refinedVersionId: draft.refinedVersionId,
      requirements,
      authoritySnapshot,
    })
    const canonical = response.draft
    categoryQueue.synchronizeRevision(canonical.revision)
    onDraftChange(canonical)
    await reconcileCanonicalCategoryReplacement({
      canonical,
      scope,
      isLastCategory,
      nextCategoryIndex,
    })
  }

  async function reconcileCanonicalCategoryReplacement({
    canonical,
    scope,
    isLastCategory,
    nextCategoryIndex,
  }: {
    canonical: Stage3ProductDraft
    scope: CategoryCaptureQueueScope
    isLastCategory: boolean
    nextCategoryIndex: number
  }) {
    const persisted = categoryQueue.load(scope)
    if (!persisted) {
      onConflict(canonical)
      return
    }
    const desired = { ...persisted, expectedRevision: canonical.revision }
    const canonicalCategory = commandFromDraft(canonical, scope, canonical.revision)
    if (canonical.completedCaptureCategories.includes(scope.category)) {
      if (!categoryCaptureCommandsEqual(scope, canonicalCategory, desired)) {
        categoryQueue.acknowledge(scope)
        onConflict(canonical)
        return
      }
      categoryQueue.acknowledge(scope)
      setSaveLabel("Gespeichert")
      if (isLastCategory) {
        await onPrepareDecisionPhase(canonical)
        finishCategoryFinalization()
      }
      return
    }
    if (canonical.categoryCursor !== scope.category) {
      categoryQueue.acknowledge(scope)
      onConflict(canonical)
      return
    }
    const result = await enqueuePersistedCategoryCapture(scope, desired)
    onDraftChange(result.response.draft)
    setSaveLabel("Gespeichert")
    analytics.track("personal_plan_stage3_save_outcome", { outcome: "saved" })
    if (isLastCategory) {
      await categoryQueue.drain()
      await onPrepareDecisionPhase(result.response.draft)
      finishCategoryFinalization()
    } else if (
      result.response.draft.pass === "product_capture" &&
      result.response.draft.categoryCursor
    ) {
      const canonicalNextIndex = requirements.findIndex(
        (requirement) => requirement.category === result.response.draft.categoryCursor,
      )
      if (canonicalNextIndex < 0) throw new Error("stage3_category_cursor_invalid")
      if (canonicalNextIndex !== nextCategoryIndex) onOpenCaptureCategory(canonicalNextIndex)
    }
  }

  function resetLocalCategoryState() {
    setLocalCatalogCaptures([])
    setRemovedCapturedProductIds(new Set())
  }

  function finishCategoryFinalization() {
    setCategoryFinalizeStatus("idle")
    setCategoryFinalizeAction(null)
  }

  function synchronizeRevision(revision: number) {
    categoryQueue.synchronizeRevision(revision)
  }

  function clearCompletedDraftQueue(
    sourceDraft: Stage3ProductDraft,
    completedDraft: Stage3ProductDraft,
  ) {
    const snapshot = authoritySnapshot ?? completedDraft.authoritySnapshot
    categoryQueue.clearOnCompletion({
      ownerId: sourceDraft.userId,
      personalPlanId,
      draftId: completedDraft.draftId,
      category: requirements[0]?.category ?? "shampoo",
      refinedNeedVersionId: snapshot?.refinedNeedVersionId ?? completedDraft.refinedVersionId,
      refinedInputHash: snapshot?.refinedInputHash ?? `fixture:${completedDraft.refinedVersionId}`,
      categoryAuthorityVersion:
        requirements[0]?.authorityVersion ?? CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
    })
  }

  return {
    categoryFinalizeAction,
    categoryFinalizeStatus,
    commitLocalCatalogCapture,
    currentProducts,
    localCatalogCaptures,
    queuedCategoryCount,
    saveLabel,
    setSaveLabel,
    workingCategoryCaptures,
    enqueueCategoryReplacement,
    reconcileQueuedCategories,
    removeWorkingProduct,
    resetLocalCategoryState,
    synchronizeRevision,
    drainQueuedCategories: () => categoryQueue.drain(),
    clearCompletedDraftQueue,
  }
}

export function createStage3CategoryCaptureScope({
  draft,
  personalPlanId,
  category,
  currentRequirement,
  authoritySnapshot,
}: {
  draft: Stage3ProductDraft
  personalPlanId: string
  category: PersonalPlanCategory
  currentRequirement: Stage3CategoryRequirement
  authoritySnapshot?: Stage3EntryContext["authoritySnapshot"]
}): CategoryCaptureQueueScope {
  return {
    ownerId: draft.userId,
    personalPlanId,
    draftId: draft.draftId,
    category,
    refinedNeedVersionId: authoritySnapshot?.refinedNeedVersionId ?? draft.refinedVersionId,
    refinedInputHash: authoritySnapshot?.refinedInputHash ?? `fixture:${draft.refinedVersionId}`,
    categoryAuthorityVersion: currentRequirement.authorityVersion,
  }
}

export function commandFromDraft(
  sourceDraft: Stage3ProductDraft,
  scope: CategoryCaptureQueueScope,
  expectedRevision: number,
): CategoryCaptureCommand {
  return {
    category: scope.category,
    candidates: sourceDraft.products
      .filter((product) => product.identity.category === scope.category)
      .map((product) => ({
        ...(product.identity.kind === "catalog_product"
          ? { kind: "catalog" as const, candidateId: product.identity.productId }
          : {
              kind: "pending" as const,
              userProductId: product.userProductId,
              submissionId: product.identity.submissionId,
            }),
        frequencyRange: product.frequencyRange,
        roles:
          sourceDraft.roleAssignments.find(
            (assignment) => assignment.capturedProductId === product.capturedProductId,
          )?.roles ?? [],
      })),
    uncoveredRoles: sourceDraft.uncoveredRoles.filter((role) => role.category === scope.category),
    expectedRevision,
  }
}

export function orderQueuedCategoryCaptures<
  T extends { scope: { category: PersonalPlanCategory } },
>(requirements: Stage3CategoryRequirement[], pending: T[]): T[] {
  return [...pending].sort(
    (left, right) =>
      requirements.findIndex((item) => item.category === left.scope.category) -
      requirements.findIndex((item) => item.category === right.scope.category),
  )
}

export function completeCandidateIdentity(candidate: Stage3CatalogCandidate) {
  const title = candidate.displayName.trim()
  const brand = candidate.brandName?.trim()
  if (!brand || title.toLocaleLowerCase().startsWith(brand.toLocaleLowerCase())) return title
  return `${brand} ${title}`
}
