"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  allowsMultipleProductsForRole,
  CATEGORY_ROLE_POLICIES,
} from "@/lib/personal-plan/products/authorities"
import type {
  Stage3AuthorityEvaluation,
  Stage3AuthoritySemanticIntent,
} from "@/lib/personal-plan/products/authority/contracts"
import {
  noOpStage3Analytics,
  type Stage3AnalyticsPort,
} from "@/lib/personal-plan/products/stage3-analytics"
import type { PlanProductRole } from "@/lib/personal-plan/types"
import {
  deriveStage3DecisionSubjects,
  type PersonalPlanCategory,
  type Stage3CapturedProduct,
  type Stage3CategoryRequirement,
  type Stage3EntryContext,
  type Stage3InventoryAuthorityV1,
  type Stage3InventoryDispositionV1,
  type Stage3NeedMaterialDelta,
  type Stage3ProductDraft,
} from "@/lib/personal-plan/products/contracts"
import { createStage3Draft } from "@/lib/personal-plan/products/state-machine"
import {
  Stage3ProductsGatewayError,
  type Stage3CompleteResponse,
  type Stage3DraftResponse,
  type Stage3IntakeClientPort,
  type Stage3MutationResponse,
  type Stage3ProductsGateway,
  type Stage3ProductsMutation,
} from "@/lib/personal-plan/products/gateway"
import {
  createHttpStage3ProductsGateway,
  parseStage3RevisionConflict,
  stage3GatewayErrorFromResponse,
} from "@/lib/personal-plan/products/http-gateway"
import {
  clearPendingStage3Recovery as clearPendingStage3RecoveryEntry,
  classifyPendingStage3RecoveryError,
  createBrowserPendingStage3RecoveryStorage,
  PendingStage3RecoveryRetryLimitedError,
  pendingIntentToAuthorityIntents,
  readPendingStage3Recovery,
  recordPendingStage3RecoveryResend,
  writePendingStage3Recovery,
  type PendingStage3RecoveryIntent,
  type PendingStage3RecoveryScope,
  type PendingStage3RecoveryStorage,
} from "@/lib/personal-plan/products/pending-recovery"
import { classifyStage3DesiredState } from "@/lib/personal-plan/products/recovery-desired-state"
import {
  clearStage3ReviewDraft,
  readStage3ReviewDraft,
  writeStage3ReviewDraft,
  type Stage3ReviewDraft,
  type Stage3ReviewDraftChoice,
} from "@/lib/personal-plan/products/review-draft"
import { reportPersonalPlanTransitionTiming } from "@/lib/personal-plan/transition-performance"
import type { Stage3Bootstrap } from "@/lib/personal-plan/products/stage2-entry-adapter"
import type { Stage3FitComparison } from "@/lib/personal-plan/products/fit-comparison"
import {
  PRODUCT_FREQUENCIES,
  PRODUCT_FREQUENCY_LABELS,
  productFrequencyShortLabel,
  type ProductFrequency,
} from "@/lib/vocabulary/frequencies"

import {
  IntakeFallbackBoundary,
  ProductCaptureScreen,
  ProductKindReviewScreen,
  SemanticRoleAssignment,
  STAGE3_PRODUCT_SEARCH_EMPTY_MESSAGE,
  Stage3Shell,
  Stage3SystemState,
  type Stage3CatalogCandidate,
  type Stage3ProductKindOption,
} from "."
import {
  ProductFitComparison,
  type ProductFitComparisonAction,
  type ProductFitComparisonSelection,
} from "./product-fit-comparison"
import {
  authorityDecisionIntent,
  hasUnresolvedDecisionSubjects,
  unresolvedDecisionSubjects,
} from "./stage3-decision-controller"
import { CATEGORY_COPY, ROLE_COPY } from "./stage3-product-copy"
import {
  completeCandidateIdentity,
  useStage3CategoryCaptureController,
  type LocalCatalogCapture,
} from "./use-stage3-category-capture-controller"

type FlowPhase =
  | "product_kinds"
  | "capture"
  | "roles"
  | "need_revision_review"
  | "decisions"
  | "handoff"

function flowPhaseForDraft(draft: Stage3ProductDraft): FlowPhase {
  if (draft.pass === "need_revision_review") return "need_revision_review"
  if (draft.pass === "ready_for_routine" || draft.status === "completed") return "handoff"
  return draft.pass === "product_capture" && draft.categoryCursor ? "capture" : "decisions"
}

type Stage3DecisionReviewBundle = {
  authorityEvaluation: Stage3AuthorityEvaluation
  fitComparison: Stage3FitComparison
}

type Stage3DecisionReviewBundles = ReadonlyMap<string, Stage3DecisionReviewBundle>

type Stage3LocalReviewChoice = Stage3ReviewDraftChoice

function decisionReviewBundlesBySubject(
  evaluations: readonly Stage3AuthorityEvaluation[],
  comparisons: readonly Stage3FitComparison[],
): Stage3DecisionReviewBundles {
  const comparisonsBySubject = new Map(
    comparisons.map((comparison) => [comparison.subjectKey, comparison]),
  )
  return new Map(
    evaluations.flatMap((authorityEvaluation) => {
      const fitComparison = comparisonsBySubject.get(authorityEvaluation.subjectKey)
      return fitComparison && fitComparison.category === authorityEvaluation.category
        ? [[authorityEvaluation.subjectKey, { authorityEvaluation, fitComparison }] as const]
        : []
    }),
  )
}

type Stage3UiGateway = Stage3ProductsGateway & {
  evaluateDecisions?: (input: { draftId: string }) => Promise<Stage3AuthorityEvaluation[]>
  resolveNeedRevision?: (input: {
    draftId: string
    expectedRevision: number
    action: "accept" | "reject"
    expectedProposalFingerprint: string
  }) => Promise<Stage3MutationResponse>
  acknowledgeInventoryDisposition?: (input: {
    draftId: string
    expectedRevision: number
    dispositionKey: string
  }) => Promise<Stage3MutationResponse>
  resolveDecision?: (input: {
    draftId: string
    expectedRevision: number
    intent: Stage3AuthoritySemanticIntent
  }) => Promise<Stage3MutationResponse>
  resolveDecisions?: (input: {
    draftId: string
    expectedRevision: number
    intents: Stage3AuthoritySemanticIntent[]
  }) => Promise<Stage3MutationResponse>
  reviewDecisionBundles?: (input: { draftId: string }) => Promise<Stage3DecisionReviewBundle[]>
}

export type Stage3AuthorityDraftResponse = Stage3DraftResponse & {
  authorityEvaluations?: Stage3AuthorityEvaluation[]
  fitComparisons?: Stage3FitComparison[]
}

export type Stage3RoutineHandoff = Pick<
  Extract<Stage3CompleteResponse, { status: "ready_for_routine" }>,
  "personalPlanId" | "refinedVersionId" | "productPortfolioVersionId" | "routineProposalId" | "next"
>

export function shouldLoadStage3DraftOnMount(bootstrap?: Stage3Bootstrap): boolean {
  return !bootstrap
}

type SystemIssue = {
  kind: "error" | "conflict"
  title: string
  message: string
  actionLabel?: string
  retry: () => void
}

const DEFAULT_REQUIREMENTS: Stage3CategoryRequirement[] = [
  requirement("conditioner", ["conditioner_rinse_out"], "Pflege nach jeder Wäsche"),
  requirement(
    "oil",
    ["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"],
    "Schutz und Finish für deine Längen",
  ),
  requirement("scalp_care", ["scalp_comfort"], "Beruhigende Pflege für deine Kopfhaut"),
  requirement("heat_protectant", ["pre_heat_protection"], "Schutz bei Styling mit Hitze", [
    "direct_contact_heat",
  ]),
]

const FREQUENCIES: Array<{ value: ProductFrequency; label: string; shortLabel: string }> =
  PRODUCT_FREQUENCIES.map((value) => ({
    value,
    label: PRODUCT_FREQUENCY_LABELS[value],
    shortLabel: productFrequencyShortLabel(value),
  }))

const PRODUCT_KIND_OPTIONS: Stage3ProductKindOption[] = (
  Object.entries(CATEGORY_COPY) as Array<
    [PersonalPlanCategory, (typeof CATEGORY_COPY)[PersonalPlanCategory]]
  >
).map(([value, copy]) => ({
  value,
  label: copy.label,
  description: copy.need,
}))

export function updateStage3RoleAssignments(
  current: Record<string, string[]>,
  capturedProductId: string,
  role: string,
  checked: boolean,
  exclusive: boolean,
): Record<string, string[]> {
  const next = Object.fromEntries(
    Object.entries(current).map(([productId, roles]) => [productId, [...roles]]),
  )
  if (checked) {
    if (exclusive) {
      for (const productId of Object.keys(next))
        next[productId] = (next[productId] ?? []).filter((candidate) => candidate !== role)
    }
    next[capturedProductId] = Array.from(new Set([...(next[capturedProductId] ?? []), role]))
  } else {
    next[capturedProductId] = (next[capturedProductId] ?? []).filter(
      (candidate) => candidate !== role,
    )
  }
  return next
}

export function Stage3ProductsFlow({
  searchDebounceMs = 250,
  handoffRecoveryDelayMs = 4_000,
  finalizationTimeoutMs = 12_000,
  entryContext,
  bootstrap,
  draftId = "fixture-stage3-draft",
  userId = "fixture-user",
  gateway: providedGateway,
  intakeClient,
  analytics = noOpStage3Analytics,
  onBackToRefinement,
  onProductKindsCorrection,
  onOpenRoutine,
  pendingRecoveryStorage: providedPendingRecoveryStorage,
}: {
  searchDebounceMs?: number
  handoffRecoveryDelayMs?: number
  finalizationTimeoutMs?: number
  entryContext?: Stage3EntryContext
  bootstrap?: Stage3Bootstrap
  draftId?: string
  userId?: string
  gateway?: Stage3UiGateway
  intakeClient?: Stage3IntakeClientPort
  analytics?: Stage3AnalyticsPort
  onBackToRefinement?: () => void
  onProductKindsCorrection?: (categories: PersonalPlanCategory[]) => Promise<void>
  onOpenRoutine?: (handoff: Stage3RoutineHandoff) => void
  pendingRecoveryStorage?: PendingStage3RecoveryStorage
} = {}) {
  const resolvedEntryContext = bootstrap?.entryContext ?? entryContext
  const requirements =
    bootstrap?.requirements ?? resolvedEntryContext?.orderedCategories ?? DEFAULT_REQUIREMENTS
  const personalPlanId = resolvedEntryContext?.personalPlanId ?? "fixture-personal-plan"
  const refinedVersionId = resolvedEntryContext?.refinedVersionId ?? "fixture-refined-version"
  const [gateway] = useState<Stage3UiGateway>(
    () => providedGateway ?? createHttpStage3ProductsGateway(),
  )
  const [pendingRecoveryStorage] = useState<PendingStage3RecoveryStorage>(
    () => providedPendingRecoveryStorage ?? createBrowserPendingStage3RecoveryStorage(),
  )

  const canReviewProductKinds = Boolean(bootstrap?.entryContext.authoritySnapshot)
  const initialDraft = useMemo(
    () =>
      bootstrap?.draft ??
      createStage3Draft({
        draftId,
        userId,
        personalPlanId,
        refinedVersionId,
        requirements,
        authoritySnapshot: resolvedEntryContext?.authoritySnapshot,
        now: "2026-08-07T00:00:00.000Z",
      }),
    [
      bootstrap?.draft,
      draftId,
      personalPlanId,
      refinedVersionId,
      requirements,
      resolvedEntryContext?.authoritySnapshot,
      userId,
    ],
  )
  const initialOwnedCategories = useMemo(
    () => initialProductKindsFromAuthority(resolvedEntryContext),
    [resolvedEntryContext],
  )
  const [confirmedOwnedCategories, setConfirmedOwnedCategories] =
    useState<PersonalPlanCategory[]>(initialOwnedCategories)
  const [reviewedProductKinds, setReviewedProductKinds] = useState(true)
  const [reviewSelectedKinds, setReviewSelectedKinds] =
    useState<PersonalPlanCategory[]>(initialOwnedCategories)
  const [productKindStatus, setProductKindStatus] = useState<"idle" | "saving" | "error">("idle")
  const [phase, setPhase] = useState<FlowPhase>(() => flowPhaseForDraft(initialDraft))
  const [draft, setDraft] = useState<Stage3ProductDraft>(initialDraft)
  const recoveryScope = useMemo(
    () => pendingRecoveryScopeForDraft(initialDraft, personalPlanId),
    [initialDraft, personalPlanId],
  )
  const initialReviewDraft = useMemo(
    () => readStage3ReviewDraft(pendingRecoveryStorage, recoveryScope),
    [pendingRecoveryStorage, recoveryScope],
  )
  const initialReviewBundles = useMemo(
    () =>
      decisionReviewBundlesBySubject(
        bootstrap?.authorityEvaluations ?? [],
        bootstrap?.fitComparisons ?? [],
      ),
    [bootstrap?.authorityEvaluations, bootstrap?.fitComparisons],
  )
  const initialReviewPartition = useMemo(
    () =>
      initialReviewDraft?.expectedRevision === initialDraft.revision
        ? partitionStage3ReviewDraft(initialDraft, initialReviewBundles, initialReviewDraft)
        : { choices: {}, order: [], invalidKeys: [] },
    [initialDraft, initialReviewBundles, initialReviewDraft],
  )
  const [pendingRecoveryMode, setPendingRecoveryMode] = useState<"checking" | "manual" | null>(
    () => (readPendingStage3Recovery(pendingRecoveryStorage, recoveryScope) ? "checking" : null),
  )
  const [pendingRecoveryRetryAt, setPendingRecoveryRetryAt] = useState<number | null>(null)
  const [categoryIndex, setCategoryIndex] = useState(() =>
    Math.max(
      0,
      requirements.findIndex((item) => item.category === initialDraft.categoryCursor),
    ),
  )
  const [query, setQuery] = useState("")
  const [searchStatus, setSearchStatus] = useState<
    "idle" | "loading" | "ready" | "empty" | "error"
  >("idle")
  const [searchResults, setSearchResults] = useState<Stage3CatalogCandidate[]>([])
  const [searchMessage, setSearchMessage] = useState<string>()
  const [frequency, setFrequency] = useState<ProductFrequency | null>(null)
  const [pendingCandidate, setPendingCandidate] = useState<Stage3CatalogCandidate | null>(null)
  const [showFallback, setShowFallback] = useState(false)
  const [fallbackPending, setFallbackPending] = useState(false)
  const [fallbackError, setFallbackError] = useState<string>()
  const [manualProductName, setManualProductName] = useState("")
  const [roleAssignments, setRoleAssignments] = useState<Record<string, string[]>>({})
  const [decisionSubmitStatus, setDecisionSubmitStatus] = useState<
    "idle" | "saving" | "finalizing"
  >("idle")
  const [systemIssue, setSystemIssue] = useState<SystemIssue | null>(null)
  const [reviewBundles, setReviewBundles] =
    useState<Stage3DecisionReviewBundles>(initialReviewBundles)
  const [displayedAlternative, setDisplayedAlternative] = useState<{
    subjectKey: string | null
    index: number
  }>({ subjectKey: null, index: 0 })
  const [selectedRecommendation, setSelectedRecommendation] = useState<{
    subjectKey: string | null
    productId: string | null
  }>({ subjectKey: null, productId: null })
  const [reviewHistory, setReviewHistory] = useState<string[]>(() => initialReviewPartition.order)
  const [localReviewChoices, setLocalReviewChoices] = useState<
    Record<string, Stage3LocalReviewChoice>
  >(() => initialReviewPartition.choices)
  const [currentReviewSubjectKey, setCurrentReviewSubjectKey] = useState<string | null>(
    () => initialReviewPartition.invalidKeys[0] ?? null,
  )
  const [authorityStatus, setAuthorityStatus] = useState<"idle" | "loading" | "ready">(
    bootstrap ? "ready" : "idle",
  )
  const [completion, setCompletion] = useState<Extract<
    Stage3CompleteResponse,
    { status: "ready_for_routine" }
  > | null>(null)
  const [showHandoffRecovery, setShowHandoffRecovery] = useState(false)
  const [draftReadyForQueueReconciliation, setDraftReadyForQueueReconciliation] = useState(
    Boolean(bootstrap),
  )
  const searchToken = useRef(0)
  const intakeIdempotencyKey = useRef<string | null>(null)
  const completionInFlight = useRef(false)
  const decisionSubmitInFlight = useRef(false)
  const saveMutationInFlight = useRef(false)
  const bootstrapDecisionPreparationStarted = useRef(false)
  const routineOpenedAnalyticsRecorded = useRef(false)
  const viewedReviewSubjects = useRef(new Set<string>())

  const allDecisionSubjects = useMemo(() => deriveStage3DecisionSubjects(draft), [draft])
  const decisionSubjects = useMemo(() => unresolvedDecisionSubjects(draft), [draft])
  const displayedReviewSubject = useMemo(() => {
    if (phase !== "decisions") return null
    return (
      decisionSubjects.find((subject) => subject.decisionKey === currentReviewSubjectKey) ??
      decisionSubjects.find((subject) => !localReviewChoices[subject.decisionKey]) ??
      null
    )
  }, [currentReviewSubjectKey, decisionSubjects, localReviewChoices, phase])
  const displayedReviewDecisionKey = displayedReviewSubject?.decisionKey ?? null
  const displayedAlternativeIndex =
    displayedAlternative.subjectKey === displayedReviewDecisionKey ? displayedAlternative.index : 0
  const selectedRecommendationProductId =
    selectedRecommendation.subjectKey === displayedReviewDecisionKey
      ? selectedRecommendation.productId
      : null

  const currentRequirement =
    requirements[categoryIndex] ?? requirements[0] ?? DEFAULT_REQUIREMENTS[0]!
  const currentCategory = currentRequirement?.category ?? requirements[0]?.category ?? "shampoo"
  const currentCopy = CATEGORY_COPY[currentCategory]
  const activeDraft = draft
  const categoryCapture = useStage3CategoryCaptureController({
    draft: activeDraft,
    personalPlanId,
    requirements,
    currentRequirement,
    currentCategory,
    categoryIndex,
    authoritySnapshot: resolvedEntryContext?.authoritySnapshot,
    gateway,
    analytics,
    readyToReconcile: draftReadyForQueueReconciliation,
    initialSaveLabel: bootstrap ? "Gespeichert" : "Wird geladen",
    onDraftChange: setDraft,
    onOpenCaptureCategory: (nextIndex) => {
      setCategoryIndex(nextIndex)
      setPhase("capture")
    },
    onPrepareDecisionPhase: async (nextDraft) => {
      await prepareDecisionPhase(nextDraft)
    },
    onMutationError: handleMutationError,
    onConflict: handleConflict,
  })
  const currentProducts = categoryCapture.currentProducts
  const localCatalogCaptures = categoryCapture.localCatalogCaptures

  useEffect(() => {
    if (initialReviewDraft && initialReviewDraft.expectedRevision !== initialDraft.revision) {
      clearStage3ReviewDraft(pendingRecoveryStorage, recoveryScope)
    }
  }, [initialDraft.revision, initialReviewDraft, pendingRecoveryStorage, recoveryScope])

  useEffect(() => {
    const pending = readPendingStage3Recovery(pendingRecoveryStorage, recoveryScope)
    if (!pending) return
    let active = true
    void Promise.resolve().then(async () => {
      if (!active) return
      setPendingRecoveryRetryAt(null)
      setPendingRecoveryMode("checking")
      try {
        await recoverPendingIntent(pending.intent, activeDraft)
      } catch {
        if (active) setPendingRecoveryMode("manual")
      }
    })
    return () => {
      active = false
    }
    // Pending recovery is intentionally resolved before controls are re-enabled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (
      !bootstrap ||
      !reviewedProductKinds ||
      bootstrapDecisionPreparationStarted.current ||
      bootstrap.draft.pass !== "product_decisions"
    ) {
      return
    }
    bootstrapDecisionPreparationStarted.current = true
    void prepareDecisionPhase(
      bootstrap.draft,
      bootstrap.authorityEvaluations,
      bootstrap.fitComparisons,
    ).catch(() => {
      setSystemIssue({
        kind: "error",
        title: "Deine Produkte konnten nicht vorbereitet werden.",
        message: "Versuche es noch einmal.",
        retry: () => window.location.reload(),
      })
    })
    // Bootstrap data is immutable for this mounted journey; preparation must run exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrap, reviewedProductKinds])

  useEffect(() => {
    if (!shouldLoadStage3DraftOnMount(bootstrap)) return
    let active = true
    void gateway
      .loadOrCreate({
        draftId,
        userId,
        personalPlanId,
        refinedVersionId,
        requirements,
        authoritySnapshot: resolvedEntryContext?.authoritySnapshot,
      })
      .then((response) => {
        if (!active) return
        return resumeLoadedDraft(response as Stage3AuthorityDraftResponse)
      })
      .catch(() => {
        if (!active) return
        setSystemIssue({
          kind: "error",
          title: "Deine Produkte konnten nicht geladen werden.",
          message: "Versuche es noch einmal.",
          retry: () => window.location.reload(),
        })
      })
    return () => {
      active = false
    }
    // The resume helper reads the same immutable entry and gateway values listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    analytics,
    bootstrap,
    draftId,
    gateway,
    personalPlanId,
    refinedVersionId,
    requirements,
    resolvedEntryContext?.authoritySnapshot,
    userId,
  ])

  useEffect(() => {
    if (phase !== "capture") return
    if (!reviewedProductKinds) return
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      const reset = setTimeout(() => {
        setSearchStatus("idle")
        setSearchResults([])
        setSearchMessage(undefined)
      }, 0)
      return () => clearTimeout(reset)
    }

    const requestToken = ++searchToken.current
    const timeout = setTimeout(() => {
      setSearchStatus("loading")
      void gateway
        .search({
          draftId: draft.draftId,
          category: currentCategory,
          query: trimmed,
          requestToken,
        })
        .then((response) => {
          if (response.requestToken !== searchToken.current) return
          const results = response.result.candidates.map((candidate) => ({
            candidateId: candidate.candidateId,
            displayName: candidate.displayName,
            brandName: candidate.brandName ?? undefined,
            imageUrl: candidate.imageUrl ?? undefined,
            assessmentStatus: candidate.assessmentStatus ?? "ready",
            assessmentReasonCodes: candidate.assessmentReasonCodes,
          }))
          setSearchResults(results)
          setSearchStatus(results.length > 0 ? "ready" : "empty")
          setSearchMessage(results.length > 0 ? undefined : STAGE3_PRODUCT_SEARCH_EMPTY_MESSAGE)
          analytics.track("personal_plan_stage3_search_interacted", {
            interaction: "results_viewed",
            resultCountBand: results.length === 0 ? "0" : results.length <= 3 ? "1_3" : "4_8",
          })
        })
        .catch(() => {
          setSearchResults([])
          setSearchStatus("error")
          setSearchMessage("Die Suche ist gerade fehlgeschlagen. Versuche es erneut.")
        })
    }, searchDebounceMs)

    return () => clearTimeout(timeout)
  }, [
    analytics,
    currentCategory,
    draft.draftId,
    gateway,
    phase,
    query,
    reviewedProductKinds,
    searchDebounceMs,
  ])

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return
    window.scrollTo({ top: 0, behavior: "instant" })
    const heading = document.querySelector<HTMLElement>("main h1")
    if (!heading) return
    heading.tabIndex = -1
    heading.focus({ preventScroll: true })
  }, [categoryIndex, displayedReviewDecisionKey, phase])

  useEffect(() => {
    if (phase !== "handoff" || !completion) {
      const reset = setTimeout(() => setShowHandoffRecovery(false), 0)
      return () => clearTimeout(reset)
    }
    const timeout = setTimeout(() => setShowHandoffRecovery(true), handoffRecoveryDelayMs)
    return () => clearTimeout(timeout)
  }, [completion, handoffRecoveryDelayMs, phase])

  useEffect(() => {
    if (phase !== "decisions") return
    const subject = displayedReviewSubject
    if (!subject || viewedReviewSubjects.current.has(subject.decisionKey)) return
    const bundle = reviewBundles.get(subject.decisionKey)
    const evaluation = bundle?.authorityEvaluation
    if (!evaluation || !bundle) return
    const hasOwnedProduct = bundle.fitComparison.products.some(
      (product) => product.source === "current",
    )
    const assessableOwnedReview =
      hasOwnedProduct &&
      evaluation.status === "known" &&
      (evaluation.verdict === "ideal" ||
        evaluation.verdict === "supportive" ||
        evaluation.verdict === "mismatch")
    viewedReviewSubjects.current.add(subject.decisionKey)
    analytics.track("personal_plan_stage3_review_viewed", {
      category: subject.category,
      verdict: reviewVerdict(evaluation),
      alternativeState: assessableOwnedReview
        ? bundle.fitComparison.alternatives.length > 0
          ? "available"
          : bundle.fitComparison.candidateCatalogComplete
            ? "exhausted"
            : "not_applicable"
        : "not_applicable",
      position: reviewPosition(draft, subject.decisionKey),
      count: decisionSubjects.length,
    })
  }, [analytics, decisionSubjects.length, displayedReviewSubject, draft, phase, reviewBundles])

  useEffect(() => {
    if (
      phase !== "decisions" ||
      authorityStatus !== "ready" ||
      allDecisionSubjects.length !== 0 ||
      decisionSubjects.length !== 0 ||
      completionInFlight.current
    ) {
      return
    }
    void completeFlow(draft)
    // Completion is keyed to the authoritative no-decision state; completeFlow owns deduplication.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDecisionSubjects.length, authorityStatus, decisionSubjects.length, draft, phase])

  useEffect(() => {
    if (
      phase !== "decisions" ||
      authorityStatus !== "ready" ||
      decisionSubmitStatus !== "idle" ||
      pendingRecoveryMode ||
      systemIssue ||
      decisionSubjects.length === 0 ||
      !decisionSubjects.every((subject) => localReviewChoices[subject.decisionKey])
    ) {
      return
    }
    void submitReviewedDecisions()
    // A complete locally restored review should resume the same finalization triggered by the last choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authorityStatus,
    decisionSubmitStatus,
    decisionSubjects,
    localReviewChoices,
    pendingRecoveryMode,
    phase,
    systemIssue,
  ])

  const shellSaveStatus = systemIssue
    ? "error"
    : pendingRecoveryMode
      ? pendingRecoveryMode === "manual"
        ? "error"
        : "saving"
      : categoryCapture.queuedCategoryCount > 0
        ? "saving"
        : categoryCapture.saveLabel === "Auswahl gemerkt"
          ? "local"
          : categoryCapture.saveLabel === "Gespeichert"
            ? "saved"
            : categoryCapture.saveLabel === "Wird geladen"
              ? "idle"
              : "saving"

  const shell = (children: React.ReactNode, stepLabel: string, onBack?: () => void) => (
    <Stage3Shell
      title="Produkte"
      currentStepLabel={stepLabel}
      completedSteps={progressForPhase(phase, categoryIndex, requirements.length)}
      totalSteps={requirements.length + 3}
      saveState={{
        status: shellSaveStatus,
        label: pendingRecoveryMode
          ? "Speicherstatus wird geprüft"
          : systemIssue
            ? "Nicht gespeichert"
            : categoryCapture.saveLabel,
      }}
      onBack={pendingRecoveryMode ? undefined : onBack}
    >
      {children}
    </Stage3Shell>
  )

  if (pendingRecoveryMode) {
    return shell(
      pendingRecoveryMode === "checking" ? (
        <Stage3SystemState
          state="loading"
          title="Speicherstatus wird geprüft."
          message="Wir gleichen deinen letzten Schritt mit dem aktuellen Stand ab."
        />
      ) : (
        <Stage3SystemState
          state="error"
          title="Speicherstatus noch offen."
          message={
            pendingRecoveryRetryAt
              ? "Der letzte Schritt bleibt gesichert. Prüfe den Status gleich erneut."
              : "Prüfe den aktuellen Stand erneut, bevor du weiter machst."
          }
          actionLabel="Speicherstatus erneut prüfen"
          onAction={() => void retryPendingRecovery()}
        />
      ),
      "Speichern",
    )
  }

  if (systemIssue) {
    return shell(
      <Stage3SystemState
        state={systemIssue.kind}
        title={systemIssue.title}
        message={systemIssue.message}
        actionLabel={systemIssue.actionLabel ?? "Erneut versuchen"}
        onAction={systemIssue.retry}
      />,
      "Speichern",
    )
  }

  if (phase === "product_kinds" && !reviewedProductKinds) {
    return shell(
      <ProductKindReviewScreen
        options={PRODUCT_KIND_OPTIONS}
        selected={reviewSelectedKinds}
        status={productKindStatus}
        disabled={productKindStatus === "saving"}
        onToggle={toggleReviewedProductKind}
        onContinue={() => void confirmReviewedProductKinds()}
        onBack={onBackToRefinement}
      />,
      "Produktarten",
    )
  }

  if (categoryCapture.categoryFinalizeStatus === "saving") {
    return shell(
      <Stage3CategoryFinalizing
        categoryLabel={currentCopy.label}
        products={categoryCapture.finalizingCategoryProducts}
        isGap={categoryCapture.categoryFinalizeAction === "gap"}
      />,
      currentCopy.label,
    )
  }

  if (decisionSubmitStatus === "saving") {
    return shell(
      <Stage3SystemState
        state="loading"
        title="Deine Entscheidung wird gespeichert."
        message="Deine Auswahl wird sicher übernommen. Danach geht es direkt mit dem nächsten offenen Schritt weiter."
      />,
      "Speichern",
    )
  }

  if (decisionSubmitStatus === "finalizing") {
    return shell(
      <Stage3SystemState
        state="loading"
        title="Dein Plan wird vorbereitet."
        message="Wir speichern deine Entscheidungen und öffnen danach direkt deine Routine."
      />,
      "Abschluss",
    )
  }

  if (phase === "capture") {
    if (showFallback) {
      return shell(
        <IntakeFallbackBoundary
          categoryLabel={currentCopy.label}
          status={fallbackPending ? "pending" : fallbackError ? "error" : "idle"}
          message={fallbackPending ? "Produkt wird für die Prüfung gespeichert." : fallbackError}
          frequencyOptions={FREQUENCIES}
          selectedFrequency={frequency}
          productName={manualProductName}
          onProductNameChange={(value) => {
            setManualProductName(value)
            setFallbackError(undefined)
          }}
          onFrequencyChange={(value) => {
            setFrequency(value as ProductFrequency)
            setFallbackError(undefined)
          }}
          onOpen={() => void capturePendingProduct()}
          onRetry={() => void capturePendingProduct()}
          onCancel={() => setShowFallback(false)}
        />,
        currentCopy.label,
        () => setShowFallback(false),
      )
    }

    const captureScreen = (
      <ProductCaptureScreen
        categoryLabel={currentCopy.label}
        needSummary={currentRequirement?.needSummary ?? currentCopy.need}
        query={query}
        searchStatus={searchStatus}
        searchResults={searchResults}
        capturedProducts={[
          ...currentProducts.map((product) => ({
            capturedProductId: product.capturedProductId,
            displayName: product.identity.displayName,
            frequencyLabel:
              FREQUENCIES.find((option) => option.value === product.frequencyRange)?.label ??
              product.frequencyRange,
            sourceLabel: product.source === "catalog_search" ? "Gefunden" : "Manuell hinzugefügt",
            statusLabel:
              product.identity.kind === "pending_submission" ? "Analyse läuft" : undefined,
            imageUrl: product.identity.imageUrl ?? undefined,
          })),
          ...localCatalogCaptures.map(({ candidate, frequencyRange }) => ({
            capturedProductId: `local:${candidate.candidateId}`,
            displayName: completeCandidateIdentity(candidate),
            frequencyLabel:
              FREQUENCIES.find((option) => option.value === frequencyRange)?.label ??
              frequencyRange,
            sourceLabel: "Ausgewählt",
            imageUrl: candidate.imageUrl,
          })),
        ]}
        frequencyOptions={FREQUENCIES}
        selectedFrequency={frequency}
        selectedCandidateId={pendingCandidate?.candidateId}
        frequencyProductName={pendingCandidate?.displayName}
        showFrequency={pendingCandidate !== null}
        showAddAnotherProduct={
          currentProducts.length + localCatalogCaptures.length > 0 ||
          Boolean(pendingCandidate && frequency)
        }
        canContinue={
          currentProducts.length + localCatalogCaptures.length > 0 ||
          Boolean(pendingCandidate && frequency)
        }
        intakeAvailable={
          searchStatus === "ready" || searchStatus === "empty" || searchStatus === "error"
        }
        searchMessage={searchMessage}
        onQueryChange={(value) => {
          setQuery(value)
          setPendingCandidate(null)
          setFrequency(null)
          setManualProductName("")
        }}
        onSelectCandidate={(candidateId) => selectCandidate(candidateId)}
        onFrequencyChange={(value) => {
          setFrequency(value as ProductFrequency)
        }}
        disabled={false}
        onAddAnotherProduct={() => {
          commitPendingCatalogCandidate()
          setQuery("")
          setSearchStatus("idle")
          setSearchResults([])
          setPendingCandidate(null)
          setFrequency(null)
        }}
        onRemoveProduct={(capturedProductId) => removeWorkingProduct(capturedProductId)}
        onOpenFallbackIntake={() => {
          intakeIdempotencyKey.current ??= createStableIdempotencyKey()
          setFallbackError(undefined)
          setShowFallback(true)
          analytics.track("personal_plan_stage3_fallback_opened", { stepKey: "product_search" })
        }}
        onChangeProductKinds={
          canReviewProductKinds
            ? () => {
                setReviewSelectedKinds(confirmedOwnedCategories)
                setProductKindStatus("idle")
                setReviewedProductKinds(false)
                setPhase("product_kinds")
              }
            : undefined
        }
        onChooseOtherProduct={() => {
          setPendingCandidate(null)
          setFrequency(null)
        }}
        onContinue={() => void continueCapture()}
        onBack={
          categoryIndex === 0
            ? onBackToRefinement
            : () => void reopenPreviousCategory(currentCategory)
        }
      />
    )

    return shell(
      <>
        {captureScreen}
        {searchStatus === "error" ? (
          <Button
            type="button"
            variant="outline"
            className="mt-3 w-full"
            onClick={() => setQuery((value) => `${value} `)}
          >
            Suche erneut versuchen
          </Button>
        ) : null}
      </>,
      currentCopy.label,
    )
  }

  if (phase === "roles") {
    return shell(
      <SemanticRoleAssignment
        categoryLabel={currentCopy.label}
        category={currentCategory}
        products={categoryCapture.workingCategoryCaptures().map((product) => ({
          capturedProductId: product.key,
          displayName: product.displayName,
        }))}
        roles={currentRequirement.requiredRoles.map((role) => ({ role, ...ROLE_COPY[role] }))}
        assignments={roleAssignments}
        onToggleRole={toggleRole}
        onContinue={() => void saveRolesAndContinue()}
        onBack={() => setPhase("capture")}
      />,
      `${currentCopy.label} zuordnen`,
    )
  }

  if (phase === "need_revision_review") {
    const authority = draft.inventoryAuthority
    if (!authority || authority.status !== "pending" || !authority.proposalFingerprint) {
      return shell(
        <Stage3SystemState
          state="conflict"
          title="Dein Bedarfsplan wurde aktualisiert."
          message="Lade den aktuellen Stand, bevor du die Produktprüfung fortsetzt."
          actionLabel="Aktuellen Stand laden"
          onAction={() => window.location.reload()}
        />,
        "Bedarfsplan",
      )
    }
    return shell(
      <Stage3NeedRevisionCheckpoint
        authority={authority}
        disabled={decisionSubmitStatus !== "idle" || Boolean(pendingRecoveryMode)}
        onAccept={() => void chooseNeedRevision("accept", authority)}
        onReject={() => void chooseNeedRevision("reject", authority)}
      />,
      "Bedarfsplan",
      onBackToRefinement,
    )
  }

  if (phase === "decisions") {
    const nextSubject = displayedReviewSubject
    if (!nextSubject) {
      if (decisionSubjects.length > 0) {
        return shell(
          <Stage3SystemState
            state="loading"
            title="Dein Plan wird vorbereitet."
            message="Wir speichern deine Entscheidungen und öffnen danach direkt deine Routine."
          />,
          "Abschluss",
        )
      }
      return shell(
        <Stage3SystemState
          state="loading"
          title="Deine Auswahl wird vorbereitet."
          message="Einen Moment bitte."
        />,
        "Abschluss",
      )
    }
    if (authorityStatus !== "ready") {
      return shell(
        <Stage3SystemState
          state="loading"
          title="Passung wird geprüft."
          message="Einen Moment bitte."
        />,
        CATEGORY_COPY[nextSubject.category].label,
      )
    }
    if (nextSubject.subjectKind === "inventory_disposition") {
      const disposition = draft.inventoryDispositions?.find(
        (candidate) => candidate.dispositionKey === nextSubject.decisionKey,
      )
      const product = nextSubject.capturedProductId
        ? draft.products.find(
            (candidate) => candidate.capturedProductId === nextSubject.capturedProductId,
          )
        : undefined
      if (disposition && product) {
        return shell(
          <Stage3InventoryDispositionReview
            disposition={disposition}
            product={product}
            disabled={decisionSubmitStatus !== "idle" || Boolean(pendingRecoveryMode)}
            onAcknowledge={() => void acknowledgeInventoryDisposition(disposition.dispositionKey)}
            onBack={() => void backFromReview(nextSubject)}
          />,
          CATEGORY_COPY[nextSubject.category].label,
        )
      }
    }
    const reviewBundle = reviewBundles.get(nextSubject.decisionKey)
    if (!reviewBundle) {
      return shell(
        <Stage3SystemState
          state="error"
          title="Passung wird aktualisiert."
          message="Bitte prüfe den aktuellen Stand erneut."
          actionLabel="Erneut prüfen"
          onAction={() => void reloadDecisionBundle(draft)}
        />,
        CATEGORY_COPY[nextSubject.category].label,
      )
    }
    return shell(
      <ProductFitComparison
        comparison={reviewBundle.fitComparison}
        evaluation={reviewBundle.authorityEvaluation}
        reviewPosition={reviewPosition(draft, nextSubject.decisionKey)}
        reviewTotal={decisionSubjects.length}
        categoryLabel={CATEGORY_COPY[nextSubject.category].label}
        roleLabel={ROLE_COPY[nextSubject.role].label}
        displayedAlternativeIndex={displayedAlternativeIndex}
        onDisplayedAlternativeChange={(index) =>
          setDisplayedAlternative({ subjectKey: nextSubject.decisionKey, index })
        }
        selectedRecommendationProductId={selectedRecommendationProductId}
        onSelectedRecommendationChange={(productId) =>
          setSelectedRecommendation({ subjectKey: nextSubject.decisionKey, productId })
        }
        disabled={decisionSubmitStatus !== "idle" || Boolean(pendingRecoveryMode)}
        onRetry={() => void reloadDecisionBundle(draft)}
        onAction={(action, selectedCandidate) =>
          void chooseFitDecision(nextSubject.decisionKey, action, selectedCandidate)
        }
        onBack={() => void backFromReview(nextSubject)}
      />,
      CATEGORY_COPY[nextSubject.category].label,
    )
  }

  return shell(
    showHandoffRecovery && completion ? (
      <Stage3SystemState
        state="saved"
        title="Deine Routine ist bereit."
        message="Falls sie sich nicht automatisch geöffnet hat, kannst du es hier erneut versuchen."
        actionLabel="Routine öffnen"
        onAction={() => openRoutine(completion)}
      />
    ) : (
      <Stage3SystemState
        state="loading"
        title="Dein Plan wird vorbereitet."
        message="Wir öffnen danach direkt deine Routine."
      />
    ),
    "Bereit für deine Routine",
  )

  async function resumeLoadedDraft(response: Stage3AuthorityDraftResponse) {
    const loadedDraft = response.draft
    if (
      loadedDraft.personalPlanId !== personalPlanId ||
      loadedDraft.refinedVersionId !== refinedVersionId
    ) {
      throw new Error("stage3_refined_version_mismatch")
    }
    const reviewDraftToRestore =
      initialReviewDraft?.expectedRevision === loadedDraft.revision ? initialReviewDraft : null
    if (initialReviewDraft && !reviewDraftToRestore) {
      setLocalReviewChoices({})
      setReviewHistory([])
      clearStage3ReviewDraft(pendingRecoveryStorage, recoveryScope)
    }
    setDraft(loadedDraft)
    setDisplayedAlternative({ subjectKey: null, index: 0 })
    categoryCapture.setSaveLabel("Gespeichert")
    setDraftReadyForQueueReconciliation(true)

    if (loadedDraft.pass === "need_revision_review") {
      setPhase("need_revision_review")
      setAuthorityStatus("ready")
      analytics.track("personal_plan_stage3_flow_viewed", {
        pass: "need_revision_review",
        stepKey: "need_revision_review",
      })
      return
    }

    if (loadedDraft.pass === "ready_for_routine" || loadedDraft.status === "completed") {
      await completeFlow(loadedDraft)
      return
    }

    if (loadedDraft.pass === "product_decisions") {
      const reviews = await prepareDecisionPhase(
        loadedDraft,
        response.authorityEvaluations,
        response.fitComparisons,
      )
      restoreStage3ReviewDraft(loadedDraft, reviews, reviewDraftToRestore)
      analytics.track("personal_plan_stage3_flow_viewed", {
        pass: "product_decisions",
        stepKey: "fit_decision",
      })
      return
    }

    const cursorIndex = requirements.findIndex(
      (requirement) => requirement.category === loadedDraft.categoryCursor,
    )
    if (cursorIndex >= 0) setCategoryIndex(cursorIndex)
    if (!loadedDraft.categoryCursor) {
      const reviews = await prepareDecisionPhase(
        loadedDraft,
        response.authorityEvaluations,
        response.fitComparisons,
      )
      restoreStage3ReviewDraft(loadedDraft, reviews, reviewDraftToRestore)
      return
    }
    if (reviewDraftToRestore) {
      setLocalReviewChoices({})
      setReviewHistory([])
      clearStage3ReviewDraft(pendingRecoveryStorage, recoveryScope)
    }
    setPhase("capture")
    analytics.track("personal_plan_stage3_flow_viewed", {
      pass: "product_capture",
      stepKey: "product_search",
    })
  }

  function toggleReviewedProductKind(category: PersonalPlanCategory, checked: boolean) {
    setProductKindStatus("idle")
    setReviewSelectedKinds((current) => {
      const selected = new Set(current)
      if (checked) selected.add(category)
      else selected.delete(category)
      return PRODUCT_KIND_OPTIONS.map((option) => option.value).filter((value) =>
        selected.has(value),
      )
    })
  }

  async function confirmReviewedProductKinds() {
    if (productKindStatus === "saving") return
    const normalized = normalizeProductKinds(reviewSelectedKinds)
    const initial = normalizeProductKinds(initialOwnedCategories)
    if (sameProductKinds(normalized, initial)) {
      setConfirmedOwnedCategories(normalized)
      setReviewedProductKinds(true)
      setPhase(flowPhaseForDraft(initialDraft))
      return
    }
    if (!onProductKindsCorrection) {
      setProductKindStatus("error")
      setSystemIssue({
        kind: "error",
        title: "Produktarten konnten nicht aktualisiert werden.",
        message: "Gehe zur Verfeinerung zurück und passe die Produktarten dort an.",
        retry: onBackToRefinement ?? (() => window.location.reload()),
      })
      return
    }
    setProductKindStatus("saving")
    try {
      await onProductKindsCorrection(normalized)
    } catch (error) {
      setProductKindStatus("error")
      handleProductKindCorrectionError(error, () => void confirmReviewedProductKinds())
    }
  }

  async function loadDecisionReviewBundles(
    sourceDraft: Stage3ProductDraft,
    preloaded?: Stage3AuthorityEvaluation[],
    preloadedComparisons?: Stage3FitComparison[],
  ): Promise<Stage3DecisionReviewBundles> {
    if (!requiresFitReviewBundles(sourceDraft)) {
      const bundles = new Map()
      setReviewBundles(bundles)
      setDisplayedAlternative({ subjectKey: null, index: 0 })
      setAuthorityStatus("ready")
      return bundles
    }
    setAuthorityStatus("loading")
    let evaluations = preloaded
    let comparisons = preloadedComparisons ?? []
    if (!evaluations) {
      if (gateway.reviewDecisionBundles) {
        const bundles = await gateway.reviewDecisionBundles({ draftId: sourceDraft.draftId })
        evaluations = bundles.map((bundle) => bundle.authorityEvaluation)
        comparisons = bundles.map((bundle) => bundle.fitComparison)
      } else if (gateway.evaluateDecisions) {
        evaluations = await gateway.evaluateDecisions({ draftId: sourceDraft.draftId })
      } else {
        const response = await fetch(
          `/api/personal-plan/stage-3?${new URLSearchParams({ personalPlanId, refinedVersionId })}`,
          { method: "GET", cache: "no-store" },
        )
        const body = (await response
          .json()
          .catch(() => null)) as Stage3AuthorityDraftResponse | null
        if (!response.ok || !body || body.draft.draftId !== sourceDraft.draftId) {
          throw new Stage3ProductsGatewayError("temporarily_unavailable")
        }
        evaluations = body.authorityEvaluations
        comparisons = body.fitComparisons ?? []
      }
    }
    if (!evaluations) throw new Stage3ProductsGatewayError("temporarily_unavailable")
    const bundles = decisionReviewBundlesBySubject(evaluations, comparisons)
    setReviewBundles(bundles)
    setDisplayedAlternative({ subjectKey: null, index: 0 })
    setAuthorityStatus("ready")
    return bundles
  }

  async function reloadDecisionBundle(sourceDraft: Stage3ProductDraft) {
    const canonical = await loadCanonicalStage3Draft(sourceDraft)
    await loadDecisionReviewBundles(
      canonical.draft,
      canonical.authorityEvaluations,
      canonical.fitComparisons,
    )
    setPhase("decisions")
  }

  async function prepareDecisionPhase(
    sourceDraft: Stage3ProductDraft,
    preloaded?: Stage3AuthorityEvaluation[],
    preloadedComparisons?: Stage3FitComparison[],
  ) {
    if (sourceDraft.pass === "need_revision_review") {
      setAuthorityStatus("ready")
      setPhase("need_revision_review")
      return new Map() as Stage3DecisionReviewBundles
    }
    const bundles = await loadDecisionReviewBundles(sourceDraft, preloaded, preloadedComparisons)
    setPhase("decisions")
    return bundles
  }

  async function resolveNeedRevision(input: {
    draftId: string
    expectedRevision: number
    action: "accept" | "reject"
    expectedProposalFingerprint: string
  }): Promise<Stage3MutationResponse> {
    if (gateway.resolveNeedRevision) return gateway.resolveNeedRevision(input)
    const response = await fetch("/api/personal-plan/stage-3", {
      method: "PATCH",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId: input.draftId,
        expectedRevision: input.expectedRevision,
        action: input.action,
        expectedProposalFingerprint: input.expectedProposalFingerprint,
      }),
      cache: "no-store",
    })
    const body = (await response.json().catch(() => null)) as unknown
    const conflict = response.status === 409 ? parseStage3RevisionConflict(body) : null
    if (conflict) return conflict
    if (!response.ok) throw stage3GatewayErrorFromResponse(response, body)
    if (!body || typeof body !== "object" || !("status" in body)) {
      throw new Stage3ProductsGatewayError("temporarily_unavailable")
    }
    return body as Stage3MutationResponse
  }

  async function resolveInventoryDisposition(input: {
    draftId: string
    expectedRevision: number
    dispositionKey: string
  }): Promise<Stage3MutationResponse> {
    if (gateway.acknowledgeInventoryDisposition) {
      return gateway.acknowledgeInventoryDisposition(input)
    }
    const response = await fetch("/api/personal-plan/stage-3", {
      method: "PATCH",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId: input.draftId,
        expectedRevision: input.expectedRevision,
        action: "acknowledge_inventory_disposition",
        dispositionKey: input.dispositionKey,
      }),
      cache: "no-store",
    })
    const body = (await response.json().catch(() => null)) as unknown
    const conflict = response.status === 409 ? parseStage3RevisionConflict(body) : null
    if (conflict) return conflict
    if (!response.ok) throw stage3GatewayErrorFromResponse(response, body)
    if (!body || typeof body !== "object" || !("status" in body)) {
      throw new Stage3ProductsGatewayError("temporarily_unavailable")
    }
    return body as Stage3MutationResponse
  }

  async function resolveAuthorityDecision(input: {
    draftId: string
    expectedRevision: number
    intent: Stage3AuthoritySemanticIntent
  }): Promise<Stage3MutationResponse> {
    const startedAt = performance.now()
    let timingReported = false
    try {
      if (gateway.resolveDecision) {
        const result = await gateway.resolveDecision(input)
        reportPersonalPlanTransitionTiming({
          layer: "client",
          operation: "stage3_individual_decision",
          outcome: result.status,
          durationMs: performance.now() - startedAt,
        })
        timingReported = true
        return result
      }
      const response = await fetch("/api/personal-plan/stage-3", {
        method: "PATCH",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(input),
        cache: "no-store",
      })
      const body = (await response.json().catch(() => null)) as unknown
      reportPersonalPlanTransitionTiming({
        layer: "client",
        operation: "stage3_individual_decision",
        outcome: response.ok ? "success" : "http_error",
        durationMs: performance.now() - startedAt,
        status: response.status,
      })
      timingReported = true
      const conflict = response.status === 409 ? parseStage3RevisionConflict(body) : null
      if (conflict) return conflict
      if (!response.ok) {
        throw stage3GatewayErrorFromResponse(response, body)
      }
      if (!body || typeof body !== "object" || !("status" in body)) {
        throw new Stage3ProductsGatewayError("temporarily_unavailable")
      }
      return body as Stage3MutationResponse
    } catch (error) {
      if (!timingReported) {
        reportPersonalPlanTransitionTiming({
          layer: "client",
          operation: "stage3_individual_decision",
          outcome: "failed",
          durationMs: performance.now() - startedAt,
        })
      }
      throw error
    }
  }

  async function resolveAuthorityDecisions(input: {
    draftId: string
    expectedRevision: number
    intents: Stage3AuthoritySemanticIntent[]
  }): Promise<Stage3MutationResponse> {
    const startedAt = performance.now()
    let timingReported = false
    try {
      if (gateway.resolveDecisions) {
        const result = await gateway.resolveDecisions(input)
        reportPersonalPlanTransitionTiming({
          layer: "client",
          operation: "stage3_grouped_decisions",
          outcome: result.status,
          durationMs: performance.now() - startedAt,
        })
        timingReported = true
        return result
      }
      if (gateway.resolveDecision) {
        let expectedRevision = input.expectedRevision
        let result: Stage3MutationResponse | null = null
        for (const intent of input.intents) {
          result = await gateway.resolveDecision({
            draftId: input.draftId,
            expectedRevision,
            intent,
          })
          if (result.status === "conflict") return result
          expectedRevision = result.draft.revision
        }
        if (result) {
          reportPersonalPlanTransitionTiming({
            layer: "client",
            operation: "stage3_grouped_decisions",
            outcome: result.status,
            durationMs: performance.now() - startedAt,
          })
          timingReported = true
          return result
        }
        throw new Stage3ProductsGatewayError("temporarily_unavailable")
      }
      const response = await fetch("/api/personal-plan/stage-3", {
        method: "PATCH",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(input),
        cache: "no-store",
      })
      const body = (await response.json().catch(() => null)) as unknown
      reportPersonalPlanTransitionTiming({
        layer: "client",
        operation: "stage3_grouped_decisions",
        outcome: response.ok ? "success" : "http_error",
        durationMs: performance.now() - startedAt,
        status: response.status,
      })
      timingReported = true
      const conflict = response.status === 409 ? parseStage3RevisionConflict(body) : null
      if (conflict) return conflict
      if (!response.ok) {
        throw stage3GatewayErrorFromResponse(response, body)
      }
      if (!body || typeof body !== "object" || !("status" in body)) {
        throw new Stage3ProductsGatewayError("temporarily_unavailable")
      }
      return body as Stage3MutationResponse
    } catch (error) {
      if (!timingReported) {
        reportPersonalPlanTransitionTiming({
          layer: "client",
          operation: "stage3_grouped_decisions",
          outcome: "failed",
          durationMs: performance.now() - startedAt,
        })
      }
      throw error
    }
  }

  function openRoutine(ready: Extract<Stage3CompleteResponse, { status: "ready_for_routine" }>) {
    if (
      ready.next.stage !== 4 ||
      ready.next.href !== "/routine" ||
      !ready.personalPlanId ||
      !ready.refinedVersionId ||
      !ready.productPortfolioVersionId
    ) {
      handleMutationError(new Error("stage3_routine_handoff_invalid"))
      return
    }
    const handoff: Stage3RoutineHandoff = {
      personalPlanId: ready.personalPlanId,
      refinedVersionId: ready.refinedVersionId,
      productPortfolioVersionId: ready.productPortfolioVersionId,
      routineProposalId: ready.routineProposalId,
      next: ready.next,
    }
    if (!routineOpenedAnalyticsRecorded.current) {
      routineOpenedAnalyticsRecorded.current = true
      analytics.track("personal_plan_stage3_routine_opened", {})
    }
    if (onOpenRoutine) onOpenRoutine(handoff)
    else if (typeof window !== "undefined") window.location.replace(ready.next.href)
  }

  function selectCandidate(candidateId: string) {
    const candidatePosition = searchResults.findIndex(
      (candidate) => candidate.candidateId === candidateId,
    )
    const candidate = searchResults[candidatePosition]
    if (!candidate) return
    const inheritedFrequency =
      currentCategory === "shampoo" && currentProducts.length === 0
        ? resolvedEntryContext?.authoritySnapshot?.productLoadContext?.shampooFrequency
        : null
    setPendingCandidate(candidate)
    setFrequency(
      candidate.assessmentStatus !== "pending_analysis" &&
        inheritedFrequency &&
        inheritedFrequency !== "does_not_wash"
        ? inheritedFrequency
        : null,
    )
    analytics.track("personal_plan_stage3_search_interacted", {
      interaction: "candidate_selected",
      resultCountBand: searchResults.length <= 3 ? "1_3" : "4_8",
      selectedCandidatePosition: Math.min(8, candidatePosition + 1) as
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6
        | 7
        | 8,
    })
  }

  function commitPendingCatalogCandidate(): LocalCatalogCapture | null {
    return categoryCapture.commitLocalCatalogCapture(pendingCandidate, frequency)
  }

  async function capturePendingProduct() {
    const recognizableName = manualProductName.trim()
    if (recognizableName.length < 2) {
      setFallbackError("Gib einen erkennbaren Produktnamen ein.")
      return
    }
    if (!frequency) {
      setFallbackError("Wähle zuerst aus, wie oft du dieses Produkt nutzt.")
      return
    }
    setFallbackPending(true)
    setFallbackError(undefined)
    if (intakeClient) {
      try {
        const response = await intakeClient.submit({
          draftId: activeDraft.draftId,
          expectedRevision: activeDraft.revision,
          idempotencyKey:
            intakeIdempotencyKey.current ??
            (intakeIdempotencyKey.current = createStableIdempotencyKey()),
          input: {
            intake_method: "manual",
            brand_text: "Unbekannte Marke",
            product_name_text: recognizableName,
            frequency_range: frequency,
          },
        })
        intakeIdempotencyKey.current = null
        setDraft(response.draft)
        categoryCapture.synchronizeRevision(response.draft.revision)
        setFallbackPending(false)
        setShowFallback(false)
        setManualProductName("")
        return
      } catch (error) {
        if (
          error instanceof Stage3ProductsGatewayError &&
          (error.code === "rolled_back" || error.code === "idempotency_key_reused")
        ) {
          intakeIdempotencyKey.current = null
        }
        setFallbackPending(false)
        setFallbackError("Das Produkt konnte nicht gespeichert werden. Versuche es noch einmal.")
        return
      }
    }
    await saveMutation(
      {
        type: "capture_pending_submission",
        submissionId: `fixture-submission-${currentCategory}`,
        displayName: recognizableName,
        category: currentCategory,
        reviewStatus: "pending_review",
        frequencyRange: frequency,
      },
      () => {
        setFallbackPending(false)
        setShowFallback(false)
        setManualProductName("")
      },
    )
  }

  async function continueCapture() {
    if (pendingCandidate?.assessmentStatus === "pending_analysis") {
      await waitForPendingAnalysis()
      return
    }
    const committed = commitPendingCatalogCandidate()
    const localCaptures = committed
      ? [
          ...localCatalogCaptures.filter(
            (item) => item.candidate.candidateId !== committed.candidate.candidateId,
          ),
          committed,
        ]
      : localCatalogCaptures
    const working = categoryCapture.workingCategoryCaptures(localCaptures)
    if (working.length === 0) {
      setSearchStatus("empty")
      setSearchMessage(
        "Wähle ein Produkt aus dem Katalog oder füge es manuell hinzu. Wenn diese Produktart nicht stimmt, gehe zurück zu deinen Produktarten.",
      )
      return
    }
    const initialAssignments = Object.fromEntries(
      working.map((product) => [
        product.key,
        activeDraft.roleAssignments.find(
          (assignment) => assignment.capturedProductId === product.key,
        )?.roles ?? [],
      ]),
    )
    const suggestedAssignments = suggestRoleAssignments(initialAssignments, working)
    setRoleAssignments(suggestedAssignments)
    if (canAutoAssignRoles(suggestedAssignments, working)) {
      await saveRolesAndContinue(suggestedAssignments, working)
      return
    }
    setPhase("roles")
    analytics.track("personal_plan_stage3_flow_viewed", {
      pass: "product_capture",
      stepKey: "role_assignment",
    })
  }

  function toggleRole(capturedProductId: string, role: string, checked: boolean) {
    setRoleAssignments((current) =>
      updateStage3RoleAssignments(
        current,
        capturedProductId,
        role,
        checked,
        currentCategory !== "conditioner",
      ),
    )
  }

  async function saveRolesAndContinue(
    assignments = roleAssignments,
    working = categoryCapture.workingCategoryCaptures(),
  ) {
    const covered = new Set(Object.values(assignments).flat())
    const missing = currentRequirement.requiredRoles.filter((role) => !covered.has(role))
    resetCategoryInteractionState()
    await categoryCapture.enqueueCategoryReplacement({
      working,
      assignments,
      uncoveredRoles: missing.map((role) => ({
        category: currentCategory,
        role,
        reason: "not_ready_to_decide" as const,
      })),
    })
  }

  function suggestRoleAssignments(
    current: Record<string, string[]>,
    working = categoryCapture.workingCategoryCaptures(),
  ) {
    if (currentRequirement.requiredRoles.length === 1) {
      const role = currentRequirement.requiredRoles[0]!
      if (allowsMultipleProductsForRole(currentCategory, role)) {
        return Object.fromEntries(working.map((product) => [product.key, [role]]))
      }
    }
    if (working.length !== 1) return current
    const productId = working[0].key
    if (currentRequirement.requiredRoles.length === 1) {
      return { ...current, [productId]: [...currentRequirement.requiredRoles] }
    }
    if (currentCategory !== "oil") return current
    const purposeRoles: Partial<Record<string, PlanProductRole>> = {
      prewash_lengths: "pre_wash_fibre_treatment",
      damp_leave_on: "leave_on_fibre_conditioning",
      dry_finish: "dry_finish",
    }
    const inherited =
      resolvedEntryContext?.authoritySnapshot?.productLoadContext?.oilPurposes
        .map((purpose) => purposeRoles[purpose])
        .filter((role): role is PlanProductRole => Boolean(role)) ?? []
    const allowed = inherited.filter((role) => currentRequirement.requiredRoles.includes(role))
    return allowed.length > 0 ? { ...current, [productId]: allowed } : current
  }

  function canAutoAssignRoles(
    assignments: Record<string, string[]>,
    working = categoryCapture.workingCategoryCaptures(),
  ) {
    if (currentRequirement.requiredRoles.length === 1) {
      const role = currentRequirement.requiredRoles[0]!
      if (working.length === 0) return false
      if (working.length === 1) return assignments[working[0]!.key]?.includes(role) ?? false
      return (
        allowsMultipleProductsForRole(currentCategory, role) &&
        working.every((product) => assignments[product.key]?.includes(role))
      )
    }
    if (working.length !== 1) return false
    if (currentCategory !== "oil") return false
    return (assignments[working[0].key]?.length ?? 0) > 0
  }

  async function waitForPendingAnalysis() {
    if (!pendingCandidate || !frequency) {
      setSearchMessage("Wähle zuerst aus, wie oft du dieses Produkt nutzt.")
      return
    }
    const pendingCapture: LocalCatalogCapture = {
      candidate: pendingCandidate,
      frequencyRange: frequency,
    }
    const localCaptures = [
      ...localCatalogCaptures.filter(
        (item) => item.candidate.candidateId !== pendingCandidate.candidateId,
      ),
      pendingCapture,
    ]
    resetCategoryInteractionState()
    await categoryCapture.enqueueCategoryReplacement({
      working: categoryCapture.workingCategoryCaptures(localCaptures),
      assignments: {},
      uncoveredRoles: currentRequirement.requiredRoles.map((role) => ({
        category: currentCategory,
        role,
        reason: "not_ready_to_decide",
      })),
    })
  }

  function resetCategoryInteractionState() {
    setQuery("")
    setSearchResults([])
    setSearchStatus("idle")
    setPendingCandidate(null)
    setFrequency(null)
    setManualProductName("")
    categoryCapture.resetLocalCategoryState()
    setRoleAssignments({})
  }

  function clearPendingStage3Recovery(sourceDraft: Stage3ProductDraft) {
    clearPendingStage3RecoveryEntry(
      pendingRecoveryStorage,
      pendingRecoveryScopeForDraft(sourceDraft, personalPlanId),
    )
  }

  async function retryPendingRecovery() {
    if (pendingRecoveryRetryAt && pendingRecoveryRetryAt > Date.now()) {
      setPendingRecoveryMode("manual")
      return
    }
    const pending = readPendingStage3Recovery(pendingRecoveryStorage, recoveryScope)
    if (!pending) {
      setPendingRecoveryMode(null)
      return
    }
    setPendingRecoveryRetryAt(null)
    setPendingRecoveryMode("checking")
    try {
      await recoverPendingIntent(pending.intent, activeDraft)
    } catch (error) {
      if (error instanceof PendingStage3RecoveryRetryLimitedError) {
        setPendingRecoveryRetryAt(error.retryAt)
      }
      setPendingRecoveryMode("manual")
    }
  }

  async function handlePendingRecoveryError(error: unknown, sourceDraft: Stage3ProductDraft) {
    if (error instanceof Stage3ProductsGatewayError) {
      const disposition = classifyPendingStage3RecoveryError(error.code)
      if (disposition !== "reconcile_unknown_outcome") {
        clearPendingStage3Recovery(sourceDraft)
        setPendingRecoveryMode(null)
        if (disposition === "reopen_incomplete_decision") {
          setPhase("decisions")
          return
        }
        presentTerminalRecoveryError(error, disposition)
        return
      }
    }
    const pending = readPendingStage3Recovery(
      pendingRecoveryStorage,
      pendingRecoveryScopeForDraft(sourceDraft, personalPlanId),
    )
    if (!pending) {
      handleMutationError(error)
      return
    }
    setPendingRecoveryMode("checking")
    if (error instanceof Stage3ProductsGatewayError && error.code === "rate_limited") {
      analytics.track("personal_plan_stage3_recovery_outcome", {
        operation: recoveryAnalyticsOperation(pending.intent),
        outcome: "rate_limit_wait",
      })
      await delay((error.retryAfterSeconds ?? 1) * 1_000)
    }
    try {
      await recoverPendingIntent(pending.intent, sourceDraft)
    } catch (error) {
      if (error instanceof PendingStage3RecoveryRetryLimitedError) {
        setPendingRecoveryRetryAt(error.retryAt)
      }
      analytics.track("personal_plan_stage3_recovery_outcome", {
        operation: recoveryAnalyticsOperation(pending.intent),
        outcome: "manual_check_required",
        failurePhase: "response",
      })
      setPendingRecoveryMode("manual")
    }
  }

  function presentTerminalRecoveryError(
    error: Stage3ProductsGatewayError,
    disposition: Exclude<
      ReturnType<typeof classifyPendingStage3RecoveryError>,
      "reconcile_unknown_outcome" | "reopen_incomplete_decision"
    >,
  ) {
    if (disposition === "reauthenticate") {
      setSystemIssue({
        kind: "error",
        title: "Deine Sitzung ist abgelaufen.",
        message: "Melde dich erneut an, bevor du deine Auswahl fortsetzt.",
        actionLabel: "Erneut anmelden",
        retry: () => {
          window.location.href = "/auth"
        },
      })
      return
    }
    if (
      disposition === "reload_authority" ||
      disposition === "reload_checkpoint" ||
      disposition === "reconfirm_current_choice"
    ) {
      setSystemIssue({
        kind: "conflict",
        title:
          disposition === "reconfirm_current_choice"
            ? "Die passenden Optionen wurden aktualisiert."
            : "Dein Plan wurde aktualisiert.",
        message:
          disposition === "reconfirm_current_choice"
            ? "Lade den aktuellen Vergleich und wähle erneut."
            : "Wir laden den aktuellen Stand, bevor du weitermachst.",
        actionLabel: "Aktuellen Stand laden",
        retry: () => window.location.reload(),
      })
      return
    }
    handleMutationError(error)
  }

  async function recoverPendingIntent(
    intent: PendingStage3RecoveryIntent,
    sourceDraft: Stage3ProductDraft,
  ) {
    const canonical = await loadCanonicalStage3Draft(sourceDraft)
    const canonicalDraft = canonical.draft
    const operation = recoveryAnalyticsOperation(intent)
    if (intent.operation === "completion") {
      if (canonicalDraft.status === "completed") {
        setPendingRecoveryRetryAt(null)
        analytics.track("personal_plan_stage3_recovery_outcome", {
          operation,
          outcome: "canonical_satisfied",
        })
        await resendPendingCompletion(intent, canonicalDraft, { receiptOnly: true })
        return
      }
      await resendPendingCompletion(intent, canonicalDraft)
      return
    }
    const desiredState = classifyRecoveredDesiredState(canonicalDraft, intent)
    if (desiredState === "satisfied" || desiredState === "completed") {
      clearPendingStage3Recovery(canonicalDraft)
      setPendingRecoveryRetryAt(null)
      setPendingRecoveryMode(null)
      analytics.track("personal_plan_stage3_recovery_outcome", {
        operation,
        outcome: "canonical_satisfied",
      })
      await continueAfterRecoveredIntent(intent, canonical)
      return
    }
    if (desiredState === "different") {
      clearPendingStage3Recovery(canonicalDraft)
      setPendingRecoveryRetryAt(null)
      setPendingRecoveryMode(null)
      analytics.track("personal_plan_stage3_recovery_outcome", {
        operation,
        outcome: "canonical_conflict",
      })
      await continueAfterRecoveredIntent(intent, canonical)
      return
    }
    if (canonicalDraft.revision > intent.expectedRevision) {
      if (intent.operation === "decision" || intent.operation === "decision_batch") {
        const reviews = await loadDecisionReviewBundles(
          canonicalDraft,
          canonical.authorityEvaluations,
          canonical.fitComparisons,
        )
        if (!pendingDecisionIntentsStillAllowed(canonicalDraft, reviews, intent)) {
          clearPendingStage3Recovery(canonicalDraft)
          setPendingRecoveryMode(null)
          analytics.track("personal_plan_stage3_recovery_outcome", {
            operation,
            outcome: "authority_changed",
          })
          await reconcileReviewedChoicesAfterConflict(canonicalDraft, reviews)
          return
        }
      }
      analytics.track("personal_plan_stage3_recovery_outcome", {
        operation,
        outcome: "authority_changed",
      })
    }
    await resendPendingIntent(intent, canonicalDraft)
  }

  async function loadCanonicalStage3Draft(sourceDraft: Stage3ProductDraft) {
    const response = (await gateway.loadOrCreate({
      draftId: sourceDraft.draftId,
      userId: sourceDraft.userId,
      personalPlanId,
      refinedVersionId,
      requirements,
      authoritySnapshot: resolvedEntryContext?.authoritySnapshot,
    })) as Stage3AuthorityDraftResponse
    if (
      response.draft.personalPlanId !== personalPlanId ||
      response.draft.refinedVersionId !== refinedVersionId
    ) {
      throw new Stage3ProductsGatewayError("stale_refined_source")
    }
    setDraft(response.draft)
    setDisplayedAlternative({ subjectKey: null, index: 0 })
    categoryCapture.synchronizeRevision(response.draft.revision)
    categoryCapture.setSaveLabel("Gespeichert")
    return response
  }

  async function resendPendingIntent(
    intent: PendingStage3RecoveryIntent,
    canonicalDraft: Stage3ProductDraft,
  ) {
    if (intent.operation === "decision" || intent.operation === "decision_batch") {
      const unresolvedKeys = new Set(
        unresolvedDecisionSubjects(canonicalDraft).map((subject) => subject.decisionKey),
      )
      const intents = pendingIntentToAuthorityIntents(intent).filter((item) =>
        unresolvedKeys.has(item.subjectKey),
      )
      if (intents.length === 0) {
        clearPendingStage3Recovery(canonicalDraft)
        setPendingRecoveryMode(null)
        await continueAfterRecoveredIntent(intent, {
          status: canonicalDraft.status,
          draft: canonicalDraft,
          requirements,
        })
        return
      }
      const nextIntent: PendingStage3RecoveryIntent =
        intent.operation === "decision"
          ? {
              ...intent,
              expectedRevision: canonicalDraft.revision,
              createdAt: Date.now(),
            }
          : {
              ...intent,
              intents: intents.map((item) => ({
                subjectKey: item.subjectKey,
                action: item.action,
                ...(item.selectedCandidateId
                  ? { selectedCandidateId: item.selectedCandidateId }
                  : {}),
                ...(item.selectedCandidateFactFingerprint
                  ? {
                      selectedCandidateFactFingerprint: item.selectedCandidateFactFingerprint,
                    }
                  : {}),
              })),
              expectedRevision: canonicalDraft.revision,
              createdAt: Date.now(),
            }
      const scope = pendingRecoveryScopeForDraft(canonicalDraft, personalPlanId)
      recordPendingStage3RecoveryResend(pendingRecoveryStorage, scope)
      writePendingStage3Recovery(pendingRecoveryStorage, scope, nextIntent)
      const response =
        intents.length === 1
          ? await resolveAuthorityDecision({
              draftId: canonicalDraft.draftId,
              expectedRevision: canonicalDraft.revision,
              intent: intents[0]!,
            })
          : await resolveAuthorityDecisions({
              draftId: canonicalDraft.draftId,
              expectedRevision: canonicalDraft.revision,
              intents,
            })
      if (response.status === "conflict") {
        clearPendingStage3Recovery(canonicalDraft)
        handleConflict(response.latestDraft)
        return
      }
      const canonical = await loadCanonicalStage3Draft(response.draft)
      await loadDecisionReviewBundles(
        canonical.draft,
        canonical.authorityEvaluations,
        canonical.fitComparisons,
      )
      clearPendingStage3Recovery(canonical.draft)
      setPendingRecoveryMode(null)
      setCurrentReviewSubjectKey(
        unresolvedDecisionSubjects(canonical.draft)[0]?.decisionKey ?? null,
      )
      analytics.track("personal_plan_stage3_recovery_outcome", {
        operation: recoveryAnalyticsOperation(intent),
        outcome: "resend_succeeded",
      })
      if (hasUnresolvedDecisionSubjects(canonical.draft)) setPhase("decisions")
      else void completeFlow(canonical.draft)
      return
    }
    if (intent.operation === "inventory_disposition") {
      const scope = pendingRecoveryScopeForDraft(canonicalDraft, personalPlanId)
      recordPendingStage3RecoveryResend(pendingRecoveryStorage, scope)
      writePendingStage3Recovery(pendingRecoveryStorage, scope, {
        ...intent,
        expectedRevision: canonicalDraft.revision,
        createdAt: Date.now(),
      })
      const response = await resolveInventoryDisposition({
        draftId: canonicalDraft.draftId,
        expectedRevision: canonicalDraft.revision,
        dispositionKey: intent.dispositionKey,
      })
      if (response.status === "conflict") {
        clearPendingStage3Recovery(canonicalDraft)
        handleConflict(response.latestDraft)
        return
      }
      const canonical = await loadCanonicalStage3Draft(response.draft)
      clearPendingStage3Recovery(canonical.draft)
      setPendingRecoveryMode(null)
      analytics.track("personal_plan_stage3_recovery_outcome", {
        operation: "inventory_disposition",
        outcome: "resend_succeeded",
      })
      await continueAfterRecoveredIntent(intent, canonical)
      return
    }
    if (intent.operation === "mutation") {
      const scope = pendingRecoveryScopeForDraft(canonicalDraft, personalPlanId)
      recordPendingStage3RecoveryResend(pendingRecoveryStorage, scope)
      writePendingStage3Recovery(pendingRecoveryStorage, scope, {
        ...intent,
        expectedRevision: canonicalDraft.revision,
        createdAt: Date.now(),
      })
      const response = await gateway.mutate({
        draftId: canonicalDraft.draftId,
        expectedRevision: canonicalDraft.revision,
        mutation: { type: "reopen_capture_category", category: intent.subjectKey },
      })
      if (response.status === "conflict") {
        clearPendingStage3Recovery(canonicalDraft)
        handleConflict(response.latestDraft)
        return
      }
      clearPendingStage3Recovery(response.draft)
      setPendingRecoveryMode(null)
      applyReopenedDraft(response.draft, intent.subjectKey)
      analytics.track("personal_plan_stage3_recovery_outcome", {
        operation: "reopen",
        outcome: "resend_succeeded",
      })
      return
    }
    await resendPendingCompletion(intent, canonicalDraft)
  }

  async function resendPendingCompletion(
    intent: Extract<PendingStage3RecoveryIntent, { operation: "completion" }>,
    canonicalDraft: Stage3ProductDraft,
    options: { receiptOnly?: boolean } = {},
  ) {
    const scope = pendingRecoveryScopeForDraft(canonicalDraft, personalPlanId)
    if (options.receiptOnly) {
      if (!gateway.loadCompletionReceipt) {
        throw new Stage3ProductsGatewayError("temporarily_unavailable")
      }
      const response = await gateway.loadCompletionReceipt({ draftId: canonicalDraft.draftId })
      clearPendingStage3Recovery(response.draft)
      setPendingRecoveryMode(null)
      setDraft(response.draft)
      setCompletion(response)
      setPhase("handoff")
      analytics.track("personal_plan_stage3_recovery_outcome", {
        operation: "completion",
        outcome: "resend_succeeded",
      })
      openRoutine(response)
      return
    }
    if (!options.receiptOnly) {
      recordPendingStage3RecoveryResend(pendingRecoveryStorage, scope)
      writePendingStage3Recovery(pendingRecoveryStorage, scope, {
        ...intent,
        expectedRevision: canonicalDraft.revision,
        createdAt: Date.now(),
      })
    }
    const response = await gateway.complete({
      draftId: canonicalDraft.draftId,
      expectedRevision: canonicalDraft.revision,
    })
    if (response.status === "conflict") {
      clearPendingStage3Recovery(canonicalDraft)
      handleConflict(response.latestDraft)
      return
    }
    if (response.status === "not_ready") {
      clearPendingStage3Recovery(canonicalDraft)
      setPendingRecoveryMode(null)
      setPhase("decisions")
      return
    }
    clearPendingStage3Recovery(response.draft)
    setPendingRecoveryMode(null)
    setDraft(response.draft)
    setCompletion(response)
    setPhase("handoff")
    analytics.track("personal_plan_stage3_recovery_outcome", {
      operation: "completion",
      outcome: "resend_succeeded",
    })
    openRoutine(response)
  }

  async function continueAfterRecoveredIntent(
    intent: PendingStage3RecoveryIntent,
    response: Stage3AuthorityDraftResponse,
  ) {
    if (intent.operation === "mutation") {
      applyReopenedDraft(response.draft, intent.subjectKey)
      return
    }
    if (intent.operation === "decision" || intent.operation === "decision_batch") {
      if (hasUnresolvedDecisionSubjects(response.draft)) {
        await loadDecisionReviewBundles(
          response.draft,
          response.authorityEvaluations,
          response.fitComparisons,
        )
        setPhase("decisions")
      } else {
        void completeFlow(response.draft)
      }
      return
    }
    if (intent.operation === "inventory_disposition") {
      if (hasUnresolvedDecisionSubjects(response.draft)) {
        const reviews = await loadDecisionReviewBundles(
          response.draft,
          response.authorityEvaluations,
          response.fitComparisons,
        )
        restoreStage3ReviewDraft(
          response.draft,
          reviews,
          readStage3ReviewDraft(pendingRecoveryStorage, recoveryScope),
        )
        setPhase("decisions")
      } else {
        void completeFlow(response.draft)
      }
    }
  }

  function classifyRecoveredDesiredState(
    canonicalDraft: Stage3ProductDraft,
    intent: PendingStage3RecoveryIntent,
  ) {
    if (intent.operation === "decision" || intent.operation === "decision_batch") {
      return classifyStage3DesiredState(canonicalDraft, pendingIntentToAuthorityIntents(intent))
    }
    if (intent.operation === "mutation") {
      return classifyStage3DesiredState(canonicalDraft, {
        type: "reopen_capture_category",
        category: intent.subjectKey,
      })
    }
    if (intent.operation === "inventory_disposition") {
      const disposition = canonicalDraft.inventoryDispositions?.find(
        (candidate) => candidate.dispositionKey === intent.dispositionKey,
      )
      if (!disposition) return "different"
      return disposition.acknowledged ? "satisfied" : "missing"
    }
    return canonicalDraft.status === "completed" ? "completed" : "missing"
  }

  function pendingDecisionIntentsStillAllowed(
    canonicalDraft: Stage3ProductDraft,
    reviews: Stage3DecisionReviewBundles,
    intent: Extract<PendingStage3RecoveryIntent, { operation: "decision" | "decision_batch" }>,
  ) {
    const unresolvedKeys = new Set(
      unresolvedDecisionSubjects(canonicalDraft).map((subject) => subject.decisionKey),
    )
    return pendingIntentToAuthorityIntents(intent).every(
      (item) => unresolvedKeys.has(item.subjectKey) && decisionIntentStillAllowed(reviews, item),
    )
  }

  function applyReopenedDraft(nextDraft: Stage3ProductDraft, category: PersonalPlanCategory) {
    const cursorIndex = requirements.findIndex(
      (requirement) => requirement.category === nextDraft.categoryCursor,
    )
    if (cursorIndex < 0 || nextDraft.categoryCursor !== category) {
      handleMutationError(new Error("stage3_category_cursor_invalid"))
      return
    }
    setDraft(nextDraft)
    categoryCapture.synchronizeRevision(nextDraft.revision)
    categoryCapture.setSaveLabel("Gespeichert")
    setReviewBundles(new Map())
    setReviewHistory([])
    setLocalReviewChoices({})
    clearStage3ReviewDraft(pendingRecoveryStorage, recoveryScope)
    setCurrentReviewSubjectKey(null)
    setDisplayedAlternative({ subjectKey: null, index: 0 })
    setAuthorityStatus("idle")
    setCategoryIndex(cursorIndex)
    setQuery("")
    setSearchResults([])
    setSearchStatus("idle")
    setPhase("capture")
  }

  async function chooseFitDecision(
    decisionKey: string,
    action: ProductFitComparisonAction,
    selection?: ProductFitComparisonSelection,
  ) {
    const subject = deriveStage3DecisionSubjects(activeDraft).find(
      (candidate) => candidate.decisionKey === decisionKey,
    )
    const reviewBundle = reviewBundles.get(decisionKey)
    const evaluation = reviewBundle?.authorityEvaluation
    const comparison = reviewBundle?.fitComparison
    const isCurrentReplacement =
      action === "select_replacement" &&
      !!selection &&
      !!comparison?.alternatives.some(
        (candidate) =>
          candidate.productId === selection.productId &&
          candidate.factFingerprint === selection.factFingerprint,
      )
    const isAllowedAction =
      action === "select_replacement"
        ? isCurrentReplacement
        : evaluation?.allowedActions.some((allowedAction) => allowedAction === action)
    if (!subject || !evaluation || !isAllowedAction) {
      handleMutationError(new Error("stage3_authority_action_unavailable"))
      return
    }
    let intent: Stage3AuthoritySemanticIntent
    try {
      intent = authorityDecisionIntent(
        decisionKey,
        action,
        selection?.productId,
        selection?.factFingerprint,
      )
    } catch (error) {
      handleMutationError(error)
      return
    }
    analytics.track("personal_plan_stage3_review_action", {
      category: subject.category,
      verdict: reviewVerdict(evaluation),
      action,
      position: reviewPosition(activeDraft, decisionKey),
      count: deriveStage3DecisionSubjects(activeDraft).length,
    })
    rememberLocalReviewChoice(decisionKey, { kind: "decision", intent })
  }

  async function chooseNeedRevision(
    action: "accept" | "reject",
    authority: Stage3InventoryAuthorityV1,
  ) {
    if (!authority.proposalFingerprint || !beginDecisionSubmission()) return
    analytics.track("personal_plan_stage3_review_action", {
      category: null,
      verdict: "need_revision_review",
      action: action === "accept" ? "accept_need_revision" : "reject_need_revision",
      position: 1,
      count: 1,
    })
    try {
      const response = await resolveNeedRevision({
        draftId: activeDraft.draftId,
        expectedRevision: activeDraft.revision,
        action,
        expectedProposalFingerprint: authority.proposalFingerprint,
      })
      if (response.status === "conflict") {
        finishDecisionSubmission()
        return handleConflict(response.latestDraft)
      }
      const canonical = await loadCanonicalStage3Draft(response.draft)
      categoryCapture.setSaveLabel("Gespeichert")
      analytics.track("personal_plan_stage3_save_outcome", { outcome: "saved" })
      finishDecisionSubmission()
      await prepareDecisionPhase(
        canonical.draft,
        canonical.authorityEvaluations,
        canonical.fitComparisons,
      )
    } catch (error) {
      finishDecisionSubmission()
      handleNeedRevisionError(error)
    }
  }

  async function acknowledgeInventoryDisposition(dispositionKey: string) {
    analytics.track("personal_plan_stage3_review_action", {
      category: null,
      verdict: "inventory_disposition",
      action: "leave_uncovered",
      position: reviewPosition(activeDraft, dispositionKey),
      count: deriveStage3DecisionSubjects(activeDraft).length,
    })
    rememberLocalReviewChoice(dispositionKey, {
      kind: "inventory_disposition",
      dispositionKey,
    })
  }

  async function backFromReview(subject: ReturnType<typeof deriveStage3DecisionSubjects>[number]) {
    if (decisionSubmitInFlight.current || pendingRecoveryMode) return
    analytics.track("personal_plan_stage3_review_back", {
      category: subject.category,
      destination: reviewHistory.length > 0 ? "previous_review" : "product_capture",
      position: reviewPosition(draft, subject.decisionKey),
      count: deriveStage3DecisionSubjects(draft).length,
    })
    if (reviewHistory.length > 0) {
      const currentIndex = reviewHistory.indexOf(subject.decisionKey)
      const previousKey =
        currentIndex > 0
          ? reviewHistory[currentIndex - 1]
          : currentIndex < 0
            ? reviewHistory[reviewHistory.length - 1]
            : undefined
      const previousSubject = deriveStage3DecisionSubjects(draft).find(
        (candidate) => candidate.decisionKey === previousKey,
      )
      if (previousKey && previousSubject) {
        setCurrentReviewSubjectKey(previousKey)
        return
      }
    }
    await reopenCategory(subject.category)
  }

  function rememberLocalReviewChoice(decisionKey: string, choice: Stage3LocalReviewChoice) {
    const nextChoices = { ...localReviewChoices, [decisionKey]: choice }
    const nextOrder = [
      ...reviewHistory.filter((candidate) => candidate !== decisionKey),
      decisionKey,
    ]
    setLocalReviewChoices(nextChoices)
    setReviewHistory(nextOrder)
    persistLocalReviewDraft(nextChoices, nextOrder)
    const nextSubject = decisionSubjects.find(
      (subject) => subject.decisionKey !== decisionKey && !localReviewChoices[subject.decisionKey],
    )
    setCurrentReviewSubjectKey(nextSubject?.decisionKey ?? null)
    categoryCapture.setSaveLabel("Auswahl gemerkt")
  }

  function persistLocalReviewDraft(
    choices: Record<string, Stage3LocalReviewChoice>,
    order: string[],
  ) {
    if (order.length === 0) {
      clearStage3ReviewDraft(pendingRecoveryStorage, recoveryScope)
      return
    }
    writeStage3ReviewDraft(pendingRecoveryStorage, recoveryScope, {
      expectedRevision: activeDraft.revision,
      choices,
      order,
      updatedAt: Date.now(),
    })
  }

  function restoreStage3ReviewDraft(
    sourceDraft: Stage3ProductDraft,
    reviews: Stage3DecisionReviewBundles,
    reviewDraft: Stage3ReviewDraft | null,
  ) {
    if (!reviewDraft) return
    const restored = partitionStage3ReviewDraft(sourceDraft, reviews, reviewDraft)
    setLocalReviewChoices(restored.choices)
    setReviewHistory(restored.order)
    setCurrentReviewSubjectKey(restored.invalidKeys[0] ?? null)
    if (restored.order.length === 0) {
      clearStage3ReviewDraft(pendingRecoveryStorage, recoveryScope)
      return
    }
    writeStage3ReviewDraft(pendingRecoveryStorage, recoveryScope, {
      expectedRevision: sourceDraft.revision,
      choices: restored.choices,
      order: restored.order,
      updatedAt: Date.now(),
    })
  }

  async function reconcileReviewedChoicesAfterConflict(
    latestDraft: Stage3ProductDraft,
    preloadedReviews?: Stage3DecisionReviewBundles,
  ) {
    setDraft(latestDraft)
    categoryCapture.synchronizeRevision(latestDraft.revision)
    const reviews = preloadedReviews ?? (await loadDecisionReviewBundles(latestDraft))
    const unresolvedKeys = new Set(
      unresolvedDecisionSubjects(latestDraft).map((subject) => subject.decisionKey),
    )
    const retainedChoices: Record<string, Stage3LocalReviewChoice> = {}
    const invalidKeys: string[] = []

    for (const decisionKey of reviewHistory) {
      const choice = localReviewChoices[decisionKey]
      if (!choice) continue
      if (choice.kind === "decision") {
        if (!unresolvedKeys.has(decisionKey)) continue
        if (decisionIntentStillAllowed(reviews, choice.intent))
          retainedChoices[decisionKey] = choice
        else invalidKeys.push(decisionKey)
        continue
      }
      const disposition = latestDraft.inventoryDispositions?.find(
        (candidate) => candidate.dispositionKey === choice.dispositionKey,
      )
      if (disposition?.acknowledged) continue
      if (disposition) retainedChoices[decisionKey] = choice
      else invalidKeys.push(decisionKey)
    }

    const retainedOrder = reviewHistory.filter((key) => retainedChoices[key])
    setLocalReviewChoices(retainedChoices)
    setReviewHistory(retainedOrder)
    if (retainedOrder.length > 0) {
      writeStage3ReviewDraft(pendingRecoveryStorage, recoveryScope, {
        expectedRevision: latestDraft.revision,
        choices: retainedChoices,
        order: retainedOrder,
        updatedAt: Date.now(),
      })
    } else {
      clearStage3ReviewDraft(pendingRecoveryStorage, recoveryScope)
    }
    setCurrentReviewSubjectKey(
      invalidKeys[0] ??
        unresolvedDecisionSubjects(latestDraft).find(
          (subject) => !retainedChoices[subject.decisionKey],
        )?.decisionKey ??
        null,
    )
    analytics.track("personal_plan_stage3_save_outcome", { outcome: "conflict" })
    setSystemIssue({
      kind: "conflict",
      title: "Die passenden Optionen wurden aktualisiert.",
      message:
        invalidKeys.length > 0
          ? `${invalidKeys.length === 1 ? "Eine Auswahl passt" : `${invalidKeys.length} Auswahlen passen`} nicht mehr zum aktuellen Stand. Deine übrigen Entscheidungen bleiben gemerkt.`
          : "Wir haben den aktuellen Stand geladen. Deine weiterhin passenden Entscheidungen bleiben gemerkt.",
      actionLabel: "Auswahl prüfen",
      retry: () => {
        setSystemIssue(null)
        setPhase("decisions")
      },
    })
  }

  async function submitReviewedDecisions() {
    if (decisionSubmitInFlight.current) return
    const orderedChoices = decisionSubjects.flatMap((subject) => {
      const choice = localReviewChoices[subject.decisionKey]
      return choice ? [choice] : []
    })
    if (orderedChoices.length !== decisionSubjects.length) return
    decisionSubmitInFlight.current = true
    setDecisionSubmitStatus("finalizing")
    const decisionIntents = orderedChoices.flatMap((choice) =>
      choice.kind === "decision" ? [choice.intent] : [],
    )
    const dispositionKeys = orderedChoices.flatMap((choice) =>
      choice.kind === "inventory_disposition" ? [choice.dispositionKey] : [],
    )
    let canonicalDraft = activeDraft
    try {
      if (decisionIntents.length > 0) {
        writePendingStage3Recovery(
          pendingRecoveryStorage,
          pendingRecoveryScopeForDraft(activeDraft, personalPlanId),
          {
            operation: "decision_batch",
            intents: decisionIntents.map((intent) => ({
              subjectKey: intent.subjectKey,
              action: intent.action,
              ...(intent.selectedCandidateId
                ? { selectedCandidateId: intent.selectedCandidateId }
                : {}),
              ...(intent.selectedCandidateFactFingerprint
                ? {
                    selectedCandidateFactFingerprint: intent.selectedCandidateFactFingerprint,
                  }
                : {}),
            })),
            expectedRevision: canonicalDraft.revision,
            createdAt: Date.now(),
          },
        )
        const response = await withStage3FinalizationTimeout(
          resolveAuthorityDecisions({
            draftId: canonicalDraft.draftId,
            expectedRevision: canonicalDraft.revision,
            intents: decisionIntents,
          }),
          finalizationTimeoutMs,
        )
        if (response.status === "conflict") {
          clearPendingStage3Recovery(activeDraft)
          try {
            await reconcileReviewedChoicesAfterConflict(response.latestDraft)
          } finally {
            finishDecisionSubmission()
          }
          return
        }
        canonicalDraft = response.draft
        clearPendingStage3Recovery(canonicalDraft)
      }
      for (const dispositionKey of dispositionKeys) {
        writePendingStage3Recovery(
          pendingRecoveryStorage,
          pendingRecoveryScopeForDraft(canonicalDraft, personalPlanId),
          {
            operation: "inventory_disposition",
            dispositionKey,
            expectedRevision: canonicalDraft.revision,
            createdAt: Date.now(),
          },
        )
        const response = await withStage3FinalizationTimeout(
          resolveInventoryDisposition({
            draftId: canonicalDraft.draftId,
            expectedRevision: canonicalDraft.revision,
            dispositionKey,
          }),
          finalizationTimeoutMs,
        )
        if (response.status === "conflict") {
          clearPendingStage3Recovery(canonicalDraft)
          try {
            await reconcileReviewedChoicesAfterConflict(response.latestDraft)
          } finally {
            finishDecisionSubmission()
          }
          return
        }
        canonicalDraft = response.draft
        clearPendingStage3Recovery(canonicalDraft)
      }
      setDraft(canonicalDraft)
      categoryCapture.synchronizeRevision(canonicalDraft.revision)
      categoryCapture.setSaveLabel("Gespeichert")
      analytics.track("personal_plan_stage3_save_outcome", { outcome: "saved" })
      setLocalReviewChoices({})
      setReviewHistory([])
      clearStage3ReviewDraft(pendingRecoveryStorage, recoveryScope)
      await completeFlow(canonicalDraft)
    } catch (error) {
      if (error instanceof Stage3FinalizationTimeoutError) {
        finishDecisionSubmission()
        setPendingRecoveryMode("manual")
        return
      }
      if (
        error instanceof Stage3ProductsGatewayError &&
        (error.code === "stage3_replacement_candidate_invalid" ||
          error.code === "stale_authority_snapshot")
      ) {
        clearPendingStage3Recovery(canonicalDraft)
        try {
          const canonical = await loadCanonicalStage3Draft(canonicalDraft)
          const reviews = await loadDecisionReviewBundles(
            canonical.draft,
            canonical.authorityEvaluations,
            canonical.fitComparisons,
          )
          await reconcileReviewedChoicesAfterConflict(canonical.draft, reviews)
        } catch (reconciliationError) {
          await handlePendingRecoveryError(reconciliationError, canonicalDraft)
        } finally {
          finishDecisionSubmission()
        }
        return
      }
      finishDecisionSubmission()
      await handlePendingRecoveryError(error, canonicalDraft)
    }
  }

  function beginDecisionSubmission() {
    if (decisionSubmitInFlight.current) return false
    decisionSubmitInFlight.current = true
    setDecisionSubmitStatus("saving")
    categoryCapture.setSaveLabel("Wird gespeichert")
    return true
  }

  function finishDecisionSubmission() {
    decisionSubmitInFlight.current = false
    setDecisionSubmitStatus("idle")
  }

  function removeWorkingProduct(capturedProductId: string) {
    categoryCapture.removeWorkingProduct(capturedProductId)
  }

  async function reopenCategory(category: PersonalPlanCategory) {
    if (saveMutationInFlight.current) return
    saveMutationInFlight.current = true
    categoryCapture.setSaveLabel("Wird gespeichert")
    writePendingStage3Recovery(
      pendingRecoveryStorage,
      pendingRecoveryScopeForDraft(activeDraft, personalPlanId),
      {
        operation: "mutation",
        action: "reopen_capture_category",
        subjectKey: category,
        expectedRevision: activeDraft.revision,
        createdAt: Date.now(),
      },
    )
    try {
      const response = await gateway.mutate({
        draftId: activeDraft.draftId,
        expectedRevision: activeDraft.revision,
        mutation: { type: "reopen_capture_category", category },
      })
      if (response.status === "conflict") {
        clearPendingStage3Recovery(activeDraft)
        return handleConflict(response.latestDraft)
      }
      clearPendingStage3Recovery(activeDraft)
      analytics.track("personal_plan_stage3_save_outcome", { outcome: "saved" })
      applyReopenedDraft(response.draft, category)
    } catch (error) {
      await handlePendingRecoveryError(error, activeDraft)
    } finally {
      saveMutationInFlight.current = false
    }
  }

  async function reopenPreviousCategory(category: PersonalPlanCategory) {
    const currentIndex = requirements.findIndex((item) => item.category === category)
    const previous = requirements
      .slice(0, currentIndex)
      .reverse()
      .find(
        (item) =>
          confirmedOwnedCategories.includes(item.category) ||
          activeDraft.products.some((product) => product.identity.category === item.category),
      )
    if (previous) await reopenCategory(previous.category)
    else onBackToRefinement?.()
  }

  async function completeFlow(sourceDraft: Stage3ProductDraft) {
    if (completion || completionInFlight.current) return
    completionInFlight.current = true
    try {
      await categoryCapture.drainQueuedCategories()
      writePendingStage3Recovery(
        pendingRecoveryStorage,
        pendingRecoveryScopeForDraft(sourceDraft, personalPlanId),
        {
          operation: "completion",
          expectedRevision: sourceDraft.revision,
          createdAt: Date.now(),
        },
      )
      const response = await withStage3FinalizationTimeout(
        gateway.complete({
          draftId: sourceDraft.draftId,
          expectedRevision: sourceDraft.revision,
        }),
        finalizationTimeoutMs,
      )
      if (response.status === "conflict") {
        completionInFlight.current = false
        finishDecisionSubmission()
        clearPendingStage3Recovery(sourceDraft)
        return handleConflict(response.latestDraft)
      }
      if (response.status === "not_ready") {
        completionInFlight.current = false
        finishDecisionSubmission()
        clearPendingStage3Recovery(sourceDraft)
        setSystemIssue({
          kind: "error",
          title: "Deine Auswahl ist noch nicht vollständig.",
          message: "Prüfe die letzte Entscheidung.",
          retry: () => {
            setSystemIssue(null)
            setPhase("decisions")
          },
        })
        return
      }
      clearPendingStage3Recovery(sourceDraft)
      setDraft(response.draft)
      categoryCapture.clearCompletedDraftQueue(sourceDraft, response.draft)
      setCompletion(response)
      finishDecisionSubmission()
      setPhase("handoff")
      const hasPending = response.portfolio.pendingProducts.length > 0
      const hasGap = response.portfolio.uncoveredRoles.length > 0
      analytics.track("personal_plan_stage3_handoff", {
        outcome: hasPending
          ? "ready_with_pending"
          : hasGap
            ? "ready_with_gap"
            : "ready_for_routine",
      })
      analytics.track("personal_plan_stage3_review_completed", {
        count: deriveStage3DecisionSubjects(response.draft).length,
      })
      openRoutine(response)
    } catch (error) {
      completionInFlight.current = false
      finishDecisionSubmission()
      if (error instanceof Stage3FinalizationTimeoutError) {
        setPendingRecoveryMode("manual")
        return
      }
      await handlePendingRecoveryError(error, sourceDraft)
    }
  }

  async function saveMutation(
    mutation: Stage3ProductsMutation,
    afterSave?: (nextDraft: Stage3ProductDraft) => void,
    sourceDraft: Stage3ProductDraft = activeDraft,
  ) {
    if (saveMutationInFlight.current) return
    saveMutationInFlight.current = true
    categoryCapture.setSaveLabel("Wird gespeichert")
    try {
      const response = await gateway.mutate({
        draftId: sourceDraft.draftId,
        expectedRevision: sourceDraft.revision,
        mutation,
      })
      if (response.status === "conflict") return handleConflict(response.latestDraft)
      setDraft(response.draft)
      categoryCapture.synchronizeRevision(response.draft.revision)
      categoryCapture.setSaveLabel("Gespeichert")
      analytics.track("personal_plan_stage3_save_outcome", { outcome: "saved" })
      afterSave?.(response.draft)
    } catch (error) {
      handleMutationError(error)
    } finally {
      saveMutationInFlight.current = false
    }
  }

  function handleConflict(latestDraft: Stage3ProductDraft) {
    setDraft(latestDraft)
    analytics.track("personal_plan_stage3_save_outcome", { outcome: "conflict" })
    setSystemIssue({
      kind: "conflict",
      title: "Deine Auswahl wurde zwischenzeitlich aktualisiert.",
      message: "Wir haben den neuesten Stand geladen. Versuche deine letzte Auswahl erneut.",
      actionLabel: "Weiter prüfen",
      retry: () => {
        setSystemIssue(null)
        setPhase(flowPhaseForDraft(latestDraft))
      },
    })
  }

  function handleMutationError(error: unknown) {
    if (error instanceof Stage3ProductsGatewayError && error.code === "stale_refined_source") {
      setSystemIssue({
        kind: "conflict",
        title: "Deine Verfeinerung wurde aktualisiert.",
        message: "Wir laden den aktuellen Stand, bevor du weitere Produkte speicherst.",
        actionLabel: "Aktuellen Stand laden",
        retry: () => window.location.reload(),
      })
      return
    }
    if (isCategoryCaptureRetryLimitedError(error)) {
      setSystemIssue({
        kind: "error",
        title: "Speicherstatus noch offen.",
        message: "Der letzte Produkt-Schritt bleibt gesichert. Prüfe den Status gleich erneut.",
        actionLabel: "Speicherstatus erneut prüfen",
        retry: () => {
          if (Date.now() >= error.retryAt) window.location.reload()
        },
      })
      return
    }
    const message = "Die Auswahl konnte nicht gespeichert werden."
    setSystemIssue({
      kind: "error",
      title: "Speichern fehlgeschlagen.",
      message,
      retry: () => {
        setSystemIssue(null)
      },
    })
  }

  function handleProductKindCorrectionError(error: unknown, retry: () => void) {
    const code =
      error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code
        : "save_failed"
    setSystemIssue({
      kind: code === "revision_conflict" ? "conflict" : "error",
      title:
        code === "completion_failed_after_save" || code === "bootstrap_failed_after_completion"
          ? "Produktarten gespeichert. Übergabe fehlgeschlagen."
          : code === "revision_conflict"
            ? "Deine Verfeinerung wurde zwischenzeitlich aktualisiert."
            : "Produktarten konnten nicht aktualisiert werden.",
      message:
        code === "completion_failed_after_save"
          ? "Du musst die Produktarten nicht noch einmal speichern. Versuche nur die Übergabe erneut."
          : code === "bootstrap_failed_after_completion"
            ? "Du musst die Produktarten nicht noch einmal speichern. Lade nur den Produkt-Schritt erneut."
            : code === "revision_conflict"
              ? "Wir laden den neuesten Stand, bevor du weiter machst."
              : "Versuche es noch einmal.",
      retry,
    })
  }

  function handleNeedRevisionError(error: unknown) {
    if (error instanceof Stage3ProductsGatewayError) {
      if (
        error.code === "stale_refined_source" ||
        error.code === "stale_authority_snapshot" ||
        error.code === "revision_conflict"
      ) {
        setSystemIssue({
          kind: "conflict",
          title: "Dein Bedarfsplan wurde aktualisiert.",
          message: "Lade den aktuellen Stand, bevor du die Produktprüfung fortsetzt.",
          actionLabel: "Aktuellen Stand laden",
          retry: () => window.location.reload(),
        })
        return
      }
      if (error.code === "unauthorized") {
        setSystemIssue({
          kind: "error",
          title: "Deine Sitzung ist abgelaufen.",
          message: "Melde dich erneut an, bevor du deine Produktprüfung fortsetzt.",
          actionLabel: "Erneut anmelden",
          retry: () => {
            window.location.href = "/auth"
          },
        })
        return
      }
    }
    setSystemIssue({
      kind: "error",
      title: "Speicherstatus noch offen.",
      message: "Prüfe den aktuellen Stand erneut, bevor du weiter machst.",
      actionLabel: "Speicherstatus erneut prüfen",
      retry: () => window.location.reload(),
    })
  }
}

export function Stage3NeedRevisionCheckpoint({
  authority,
  disabled,
  onAccept,
  onReject,
}: {
  authority: Stage3InventoryAuthorityV1
  disabled?: boolean
  onAccept: () => void
  onReject: () => void
}) {
  const changeCount = authority.materialDelta.length

  return (
    <section className="min-w-0 pb-32" aria-labelledby="stage3-need-revision-title">
      <header className="mb-6">
        <p className="mb-2 text-sm font-semibold text-[var(--brand-plum)]">Dein Bedarfsplan</p>
        <h1
          id="stage3-need-revision-title"
          className="font-header text-3xl leading-tight text-foreground"
        >
          {changeCount === 1
            ? "Deine Produkte verändern einen Punkt."
            : `Deine Produkte verändern ${changeCount} Punkte.`}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Wir haben deine verwendeten Produkte und ihre Häufigkeit geprüft. Diese Ergänzung war
          vorher noch nicht sicher.
        </p>
      </header>

      <article className="rounded-2xl border border-[var(--brand-plum)]/25 bg-[var(--brand-lilac)]/60 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-background text-xl text-[var(--brand-plum)]">
            ↻
          </div>
          <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-[var(--brand-plum)]">
            Neu · Optional
          </span>
        </div>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          {changeCount === 1 ? "Das ändert sich" : "Diese Punkte ändern sich"}
        </h2>
        <ul className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
          {authority.materialDelta.map((delta, index) => (
            <li key={`${delta.kind}:${delta.category}:${index}`}>{materialDeltaSummary(delta)}</li>
          ))}
        </ul>
        <div className="mt-4 rounded-xl border border-border bg-background p-4">
          <p className="text-sm font-semibold text-foreground">Warum jetzt?</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Deine erfassten Produkte liefern ein neues Signal für den finalen Bedarfsplan. Erst nach
            deiner Entscheidung prüfen wir konkrete Produkte.
          </p>
        </div>
      </article>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Wenn du ablehnst, bleibt dein bisheriger Bedarfsplan erhalten.
      </p>

      <div className="fixed inset-x-0 bottom-0 z-20 grid gap-2 border-t border-border bg-background/95 px-5 py-3 backdrop-blur md:absolute md:inset-x-auto md:bottom-4 md:left-10 md:right-10 md:rounded-2xl md:border">
        <Button
          type="button"
          variant="funnelCta"
          className="w-full"
          disabled={disabled}
          onClick={onAccept}
        >
          Ergänzung übernehmen
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={disabled}
          onClick={onReject}
        >
          Bedarfsplan beibehalten
        </Button>
      </div>
    </section>
  )
}

export function Stage3InventoryDispositionReview({
  disposition,
  product,
  disabled,
  onAcknowledge,
  onBack,
}: {
  disposition: Stage3InventoryDispositionV1
  product: Stage3CapturedProduct
  disabled?: boolean
  onAcknowledge: () => void
  onBack: () => void
}) {
  return (
    <section className="min-w-0 pb-28" aria-labelledby="stage3-inventory-disposition-title">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onBack}
          disabled={disabled}
          aria-label="Zurück zu meinen Produkten"
          className="shrink-0 rounded-full"
        >
          ←
        </Button>
        <p className="text-right text-sm font-medium text-muted-foreground">Produkte prüfen</p>
      </div>

      <header className="mb-5">
        <p className="mb-2 text-sm font-semibold text-[var(--brand-plum)]">Dein Produkt</p>
        <h1
          id="stage3-inventory-disposition-title"
          className="font-header text-3xl leading-tight text-foreground"
        >
          Dieses Produkt bleibt erfasst.
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {disposition.reason === "category_not_in_final_plan"
            ? "Diese Produktart gehört aktuell nicht zu den Basis- oder Optional-Kategorien deines finalen Bedarfsplans."
            : "Dieses Produkt ist aktuell keiner Aufgabe in deinem finalen Bedarfsplan zugeordnet."}
        </p>
      </header>

      <article className="rounded-2xl border border-border bg-card p-5">
        <div className="flex min-w-0 gap-4">
          <ProductIdentityImage product={product} />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {CATEGORY_COPY[disposition.category].label}
            </p>
            <h2 className="mt-1 break-words text-lg font-semibold text-foreground">
              {product.identity.displayName}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Von dir als regelmäßig verwendet erfasst.
            </p>
          </div>
        </div>

        <div className="mt-5 border-l-4 border-[var(--brand-plum)] bg-[var(--brand-blush)]/60 p-4">
          <p className="font-semibold text-foreground">Nicht Teil deiner Routine</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {inventoryDispositionReason(disposition.reason)}
          </p>
        </div>

        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[var(--status-ok-text)]">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--status-ok-bg)]"
          >
            ✓
          </span>
          Bleibt unter „Meine Produkte“ gespeichert
        </p>
      </article>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Wenn sich dein Bedarfsplan später ändert, wird das Produkt neu geprüft.
      </p>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-5 py-3 backdrop-blur md:absolute md:inset-x-auto md:bottom-4 md:left-10 md:right-10 md:rounded-2xl md:border">
        <Button
          type="button"
          variant="funnelCta"
          className="w-full"
          disabled={disabled}
          onClick={onAcknowledge}
        >
          Verstanden, weiter
        </Button>
      </div>
    </section>
  )
}

export function Stage3CategoryFinalizing({
  categoryLabel,
  products,
  isGap,
}: {
  categoryLabel: string
  products: Array<{ key: string; displayName: string }>
  isGap: boolean
}) {
  return (
    <section className="min-w-0 pb-28" aria-labelledby="stage3-category-finalizing-title">
      <header className="mb-5">
        <p className="mb-2 text-sm font-semibold text-[var(--brand-plum)]">{categoryLabel}</p>
        <h1
          id="stage3-category-finalizing-title"
          className="font-header text-3xl leading-tight text-foreground"
        >
          {isGap ? "Dafür hast du noch kein Produkt." : "Deine Produkte sind ausgewählt."}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Wir speichern diese Auswahl im Hintergrund. Danach prüfst du direkt die Passung.
        </p>
      </header>

      {products.length > 0 ? (
        <div className="grid gap-3">
          {products.map((product) => (
            <article key={product.key} className="rounded-2xl border border-border bg-card p-4">
              <p className="font-semibold text-foreground">{product.displayName}</p>
              <p className="mt-1 text-sm text-muted-foreground">Für deinen Plan ausgewählt</p>
            </article>
          ))}
        </div>
      ) : null}

      <p className="mt-5 text-sm font-semibold text-[var(--brand-plum)]" role="status">
        Wird gespeichert …
      </p>
    </section>
  )
}

function ProductIdentityImage({ product }: { product: Stage3CapturedProduct }) {
  const imageUrl = product.identity.imageUrl
  if (imageUrl) {
    return (
      // Product images may come from owner-submitted catalog sources that are not configured
      // as Next image hosts, so the review keeps this bounded thumbnail unoptimized.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className="h-20 w-20 shrink-0 rounded-2xl border border-border object-cover"
      />
    )
  }
  return (
    <div
      aria-label={`${product.identity.displayName}: Bild nicht verfügbar`}
      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground"
    >
      Produkt
    </div>
  )
}

function materialDeltaSummary(delta: Stage3NeedMaterialDelta) {
  const categoryLabel = CATEGORY_COPY[delta.category].label
  if (delta.kind === "category_added") {
    return `${categoryLabel} wird als neuer Punkt ergänzt.`
  }
  if (delta.kind === "category_removed") {
    return `${categoryLabel} fällt aus dem finalen Bedarfsplan heraus.`
  }
  if (delta.kind === "category_order_changed") {
    return `${categoryLabel} verschiebt sich in der Reihenfolge.`
  }
  if (delta.kind === "need_tier_changed") {
    return `${categoryLabel} wechselt in seiner Priorität.`
  }
  if (delta.kind === "roles_changed") {
    return `${categoryLabel} bekommt eine andere Aufgabe.`
  }
  if (delta.kind === "frequency_changed") {
    return `${categoryLabel} bekommt eine andere Häufigkeit.`
  }
  return `${categoryLabel} wird in der Anwendung anders eingeordnet.`
}

function inventoryDispositionReason(reason: Stage3InventoryDispositionV1["reason"]) {
  return reason === "category_not_in_final_plan"
    ? "Diese Produktart ist gerade kein Schritt in deinem finalen Bedarfsplan."
    : "Dieses Produkt ist keiner finalen Planrolle zugeordnet."
}

function requirement(
  category: PersonalPlanCategory,
  requiredRoles: PlanProductRole[],
  needSummary: string,
  qualifyingRoutes?: Stage3CategoryRequirement["qualifyingRoutes"],
): Stage3CategoryRequirement {
  const authority = CATEGORY_ROLE_POLICIES[category]
  if (requiredRoles.some((role) => !authority.allowedRoles.includes(role as never))) {
    throw new Error(`Fixture role is not allowed for category ${category}`)
  }
  return {
    category,
    requiredRoles,
    ...(qualifyingRoutes ? { qualifyingRoutes } : {}),
    needSummary,
    authorityVersion: authority.authorityVersion,
  }
}

function progressForPhase(phase: FlowPhase, categoryIndex: number, requirementCount: number) {
  if (phase === "product_kinds") return 0
  if (phase === "capture" || phase === "roles") return categoryIndex + 1
  if (phase === "decisions") return requirementCount + 1
  return requirementCount + 3
}

function initialProductKindsFromAuthority(
  entryContext: Stage3EntryContext | undefined,
): PersonalPlanCategory[] {
  const owned = entryContext?.authoritySnapshot?.productLoadContext?.ownedCategories
  if (!owned) return []
  return normalizeProductKinds(owned)
}

function normalizeProductKinds(
  categories: readonly PersonalPlanCategory[],
): PersonalPlanCategory[] {
  const selected = new Set(categories)
  return PRODUCT_KIND_OPTIONS.map((option) => option.value).filter((category) =>
    selected.has(category),
  )
}

function sameProductKinds(
  left: readonly PersonalPlanCategory[],
  right: readonly PersonalPlanCategory[],
) {
  const normalizedLeft = normalizeProductKinds(left)
  const normalizedRight = normalizeProductKinds(right)
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((category, index) => category === normalizedRight[index])
  )
}

function pendingRecoveryScopeForDraft(
  draft: Stage3ProductDraft,
  personalPlanId: string,
): PendingStage3RecoveryScope {
  return {
    ownerId: draft.userId,
    personalPlanId,
    draftId: draft.draftId,
  }
}

function recoveryAnalyticsOperation(
  intent: PendingStage3RecoveryIntent,
): "reopen" | "decision" | "decision_batch" | "inventory_disposition" | "completion" {
  if (intent.operation === "mutation") return "reopen"
  return intent.operation
}

function reviewPosition(sourceDraft: Stage3ProductDraft, subjectKey: string) {
  return Math.max(
    1,
    deriveStage3DecisionSubjects(sourceDraft).findIndex(
      (subject) => subject.decisionKey === subjectKey,
    ) + 1,
  )
}

function reviewVerdict(evaluation: Stage3AuthorityEvaluation) {
  return evaluation.status === "known" ? evaluation.verdict : evaluation.status
}

function requiresFitReviewBundles(draft: Stage3ProductDraft) {
  return deriveStage3DecisionSubjects(draft).some(
    (subject) => subject.subjectKind !== "inventory_disposition",
  )
}

function partitionStage3ReviewDraft(
  sourceDraft: Stage3ProductDraft,
  reviews: Stage3DecisionReviewBundles,
  reviewDraft: Stage3ReviewDraft,
): {
  choices: Record<string, Stage3LocalReviewChoice>
  order: string[]
  invalidKeys: string[]
} {
  const unresolvedKeys = new Set(
    unresolvedDecisionSubjects(sourceDraft).map((subject) => subject.decisionKey),
  )
  const choices: Record<string, Stage3LocalReviewChoice> = {}
  const invalidKeys: string[] = []
  for (const decisionKey of reviewDraft.order) {
    const choice = reviewDraft.choices[decisionKey]
    if (!choice) continue
    if (choice.kind === "decision") {
      if (unresolvedKeys.has(decisionKey) && decisionIntentStillAllowed(reviews, choice.intent)) {
        choices[decisionKey] = choice
      } else if (unresolvedKeys.has(decisionKey)) {
        invalidKeys.push(decisionKey)
      }
      continue
    }
    const disposition = sourceDraft.inventoryDispositions?.find(
      (candidate) => candidate.dispositionKey === choice.dispositionKey,
    )
    if (disposition && !disposition.acknowledged) choices[decisionKey] = choice
    else if (unresolvedKeys.has(decisionKey)) invalidKeys.push(decisionKey)
  }
  return {
    choices,
    order: reviewDraft.order.filter((decisionKey) => choices[decisionKey]),
    invalidKeys,
  }
}

function decisionIntentStillAllowed(
  reviews: Stage3DecisionReviewBundles,
  intent: Stage3AuthoritySemanticIntent,
) {
  const review = reviews.get(intent.subjectKey)
  const evaluation = review?.authorityEvaluation
  if (intent.action === "select_replacement") {
    return Boolean(
      review?.fitComparison.alternatives.some(
        (candidate) =>
          candidate.productId === intent.selectedCandidateId &&
          candidate.factFingerprint === intent.selectedCandidateFactFingerprint,
      ),
    )
  }
  if (!evaluation?.allowedActions.some((allowedAction) => allowedAction === intent.action)) {
    return false
  }
  if (intent.action !== "plan_recommendation") return true
  if (!intent.selectedCandidateId) return false
  return (
    evaluation.status === "known" &&
    evaluation.recommendation?.productId === intent.selectedCandidateId
  )
}

function isCategoryCaptureRetryLimitedError(error: unknown): error is Error & { retryAt: number } {
  return (
    error instanceof Error &&
    error.name === "CategoryCaptureRetryLimitedError" &&
    "retryAt" in error &&
    typeof error.retryAt === "number"
  )
}

class Stage3FinalizationTimeoutError extends Error {
  constructor() {
    super("stage3_finalization_timeout")
    this.name = "Stage3FinalizationTimeoutError"
  }
}

function withStage3FinalizationTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Stage3FinalizationTimeoutError()), timeoutMs)
    void promise.then(
      (value) => {
        clearTimeout(timeout)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timeout)
        reject(error)
      },
    )
  })
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function createStableIdempotencyKey(): string {
  return crypto.randomUUID()
}
