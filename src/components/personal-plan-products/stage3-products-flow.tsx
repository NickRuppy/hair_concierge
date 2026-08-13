"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { CATEGORY_ROLE_POLICIES } from "@/lib/personal-plan/products/authorities"
import type {
  Stage3AuthorityEvaluation,
  Stage3AuthoritySemanticIntent,
} from "@/lib/personal-plan/products/authority/contracts"
import { STAGE3_AUTHORITY_DECISION_BATCH_LIMIT } from "@/lib/personal-plan/products/authority/contracts"
import {
  noOpStage3Analytics,
  type Stage3AnalyticsPort,
} from "@/lib/personal-plan/products/stage3-analytics"
import type { PlanProductRole } from "@/lib/personal-plan/types"
import {
  deriveStage3DecisionSubjects,
  type PersonalPlanCategory,
  type Stage3CategoryRequirement,
  type Stage3EntryContext,
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
import { reportPersonalPlanTransitionTiming } from "@/lib/personal-plan/transition-performance"
import type { Stage3Bootstrap } from "@/lib/personal-plan/products/stage2-entry-adapter"
import {
  PRODUCT_FREQUENCIES,
  PRODUCT_FREQUENCY_LABELS,
  productFrequencyShortLabel,
  type ProductFrequency,
} from "@/lib/vocabulary/frequencies"

import {
  IntakeFallbackBoundary,
  ProductCaptureScreen,
  ProductDecisionScreen,
  ProductKindReviewScreen,
  SemanticRoleAssignment,
  STAGE3_PRODUCT_SEARCH_EMPTY_MESSAGE,
  Stage3Shell,
  Stage3SystemState,
  type Stage3CatalogCandidate,
  type Stage3DecisionAction,
  type Stage3ProductKindOption,
} from "."
import {
  automaticAuthorityOutcomes,
  automaticOutcomeIntents,
  authorityDecisionIntent,
  clearFitDecisions,
  hasUnresolvedDecisionSubjects,
  unresolvedDecisionSubjects,
  type Stage3AutomaticOutcome,
  type Stage3ClearFit,
} from "./stage3-decision-controller"
import {
  authorityEvaluationProjection,
  CATEGORY_COPY,
  ROLE_COPY,
  semanticActionFor,
} from "./stage3-decision-projection"
import {
  completeCandidateIdentity,
  useStage3CategoryCaptureController,
  type LocalCatalogCapture,
} from "./use-stage3-category-capture-controller"

type FlowPhase = "product_kinds" | "capture" | "roles" | "decisions" | "handoff"

type Stage3UiGateway = Stage3ProductsGateway & {
  evaluateDecisions?: (input: { draftId: string }) => Promise<Stage3AuthorityEvaluation[]>
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
}

export type Stage3AuthorityDraftResponse = Stage3DraftResponse & {
  authorityEvaluations?: Stage3AuthorityEvaluation[]
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
  const [phase, setPhase] = useState<FlowPhase>(() =>
    initialDraft.pass === "product_capture" && initialDraft.categoryCursor
      ? "capture"
      : "decisions",
  )
  const [draft, setDraft] = useState<Stage3ProductDraft>(initialDraft)
  const recoveryScope = useMemo(
    () => pendingRecoveryScopeForDraft(initialDraft, personalPlanId),
    [initialDraft, personalPlanId],
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
  const [decisionSubmitStatus, setDecisionSubmitStatus] = useState<"idle" | "saving">("idle")
  const [systemIssue, setSystemIssue] = useState<SystemIssue | null>(null)
  const [authorityEvaluations, setAuthorityEvaluations] = useState<Stage3AuthorityEvaluation[]>(
    bootstrap?.authorityEvaluations ?? [],
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
    onPrepareDecisionPhase: prepareDecisionPhase,
    onMutationError: handleMutationError,
    onConflict: handleConflict,
  })
  const currentProducts = categoryCapture.currentProducts
  const localCatalogCaptures = categoryCapture.localCatalogCaptures

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
    void prepareDecisionPhase(bootstrap.draft, bootstrap.authorityEvaluations).catch(() => {
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
      setSearchStatus("idle")
      setSearchResults([])
      setSearchMessage(undefined)
      return
    }

    const requestToken = ++searchToken.current
    setSearchStatus("loading")
    const timeout = setTimeout(() => {
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
  }, [categoryIndex, phase])

  useEffect(() => {
    if (phase !== "handoff" || !completion) {
      setShowHandoffRecovery(false)
      return
    }
    const timeout = setTimeout(() => setShowHandoffRecovery(true), handoffRecoveryDelayMs)
    return () => clearTimeout(timeout)
  }, [completion, handoffRecoveryDelayMs, phase])

  const shellSaveStatus = systemIssue
    ? "error"
    : pendingRecoveryMode
      ? pendingRecoveryMode === "manual"
        ? "error"
        : "saving"
      : categoryCapture.queuedCategoryCount > 0
        ? "saving"
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
      <Stage3SystemState
        state="loading"
        title={
          categoryCapture.categoryFinalizeAction === "gap"
            ? "Alles klar – dafür hast du noch kein Produkt."
            : "Produkte werden gespeichert."
        }
        message={
          categoryCapture.categoryFinalizeAction === "gap"
            ? "Wird gespeichert"
            : "Deine Auswahl wird sicher übernommen."
        }
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

  if (phase === "decisions") {
    const unresolvedSubjects = unresolvedDecisionSubjects(draft)
    const nextSubject = unresolvedSubjects[0]
    if (!nextSubject) {
      if (!completionInFlight.current) {
        void completeFlow(draft)
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
    const evaluation = authorityEvaluations.find(
      (candidate) => candidate.subjectKey === nextSubject.decisionKey,
    )
    if (authorityStatus !== "ready" || !evaluation) {
      return shell(
        <Stage3SystemState
          state="loading"
          title="Passung wird geprüft."
          message="Einen Moment bitte."
        />,
        CATEGORY_COPY[nextSubject.category].label,
      )
    }
    if (nextSubject.category === "oil") {
      const oilDecisions = unresolvedSubjects
        .filter((subject) => subject.category === "oil")
        .map((subject) => ({
          subject,
          evaluation: authorityEvaluations.find(
            (candidate) => candidate.subjectKey === subject.decisionKey,
          ),
        }))
        .filter(
          (
            item,
          ): item is {
            subject: (typeof unresolvedSubjects)[number]
            evaluation: Stage3AuthorityEvaluation
          } => Boolean(item.evaluation),
        )

      return shell(
        <>
          <ProductDecisionScreen
            decisions={oilDecisions.map(({ subject, evaluation: oilEvaluation }) =>
              authorityEvaluationProjection(
                draft,
                subject,
                oilEvaluation,
                requirements.find((item) => item.category === subject.category)?.needSummary,
              ),
            )}
            consolidated
            onChooseAction={(decisionKey, action) => void chooseDecision(decisionKey, action)}
            onBack={() => void reopenCategory("oil")}
          />
          {oilDecisions.some(
            ({ evaluation: oilEvaluation }) => oilEvaluation.status === "unsupported",
          ) ? (
            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-[var(--text-sub)]">
                Wir können diese Passung gerade nicht abschließen. Deine bisherigen Angaben bleiben
                gespeichert.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full"
                onClick={onBackToRefinement ?? (() => window.location.reload())}
              >
                {onBackToRefinement ? "Zur Verfeinerung" : "Neu laden"}
              </Button>
            </div>
          ) : null}
        </>,
        CATEGORY_COPY.oil.label,
      )
    }
    const clearFits = clearFitDecisions(draft, authorityEvaluations)
    if (clearFits.length > 1) {
      return shell(
        <ProductDecisionScreen
          decisions={clearFits.map(({ subject, evaluation: clearEvaluation }) =>
            authorityEvaluationProjection(
              draft,
              subject,
              clearEvaluation,
              requirements.find((item) => item.category === subject.category)?.needSummary,
            ),
          )}
          groupClearFits
          onAcceptClearFits={() => void acceptClearFits(clearFits)}
          onChooseAction={(decisionKey, action) => void chooseDecision(decisionKey, action)}
          onBack={() => void reopenCategory(clearFits[0].subject.category)}
        />,
        "Passende Produkte",
      )
    }
    return shell(
      <>
        <ProductDecisionScreen
          decisions={[
            authorityEvaluationProjection(
              draft,
              nextSubject,
              evaluation,
              requirements.find((item) => item.category === nextSubject.category)?.needSummary,
            ),
          ]}
          onChooseAction={(decisionKey, action) => void chooseDecision(decisionKey, action)}
          onBack={() => void reopenCategory(nextSubject.category)}
        />
        {evaluation.status === "unsupported" ? (
          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-[var(--text-sub)]">
              Wir können diese Passung gerade nicht abschließen. Deine bisherigen Angaben bleiben
              gespeichert.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full"
              onClick={onBackToRefinement ?? (() => window.location.reload())}
            >
              {onBackToRefinement ? "Zur Verfeinerung" : "Neu laden"}
            </Button>
          </div>
        ) : null}
      </>,
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
        title="Routine wird vorbereitet."
        message="Einen Moment bitte."
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
    setDraft(loadedDraft)
    categoryCapture.setSaveLabel("Gespeichert")
    setDraftReadyForQueueReconciliation(true)

    if (loadedDraft.pass === "ready_for_routine" || loadedDraft.status === "completed") {
      await completeFlow(loadedDraft)
      return
    }

    if (loadedDraft.pass === "product_decisions") {
      await prepareDecisionPhase(loadedDraft, response.authorityEvaluations)
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
      await prepareDecisionPhase(loadedDraft, response.authorityEvaluations)
      return
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
      setPhase(
        initialDraft.pass === "product_capture" && initialDraft.categoryCursor
          ? "capture"
          : "decisions",
      )
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

  async function loadAuthorityEvaluations(
    sourceDraft: Stage3ProductDraft,
    preloaded?: Stage3AuthorityEvaluation[],
  ): Promise<Stage3AuthorityEvaluation[]> {
    setAuthorityStatus("loading")
    let evaluations = preloaded
    if (!evaluations) {
      if (gateway.evaluateDecisions) {
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
      }
    }
    if (!evaluations) throw new Stage3ProductsGatewayError("temporarily_unavailable")
    setAuthorityEvaluations(evaluations)
    setAuthorityStatus("ready")
    return evaluations
  }

  async function prepareDecisionPhase(
    sourceDraft: Stage3ProductDraft,
    preloaded?: Stage3AuthorityEvaluation[],
  ) {
    const evaluations = await loadAuthorityEvaluations(sourceDraft, preloaded)
    const automaticOutcomes = automaticAuthorityOutcomes(sourceDraft, evaluations)

    if (automaticOutcomes.length > 0) {
      await acceptAutomaticOutcomes(sourceDraft, automaticOutcomes)
      return
    }
    setPhase("decisions")
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
    if (working.length !== 1) return false
    if (currentRequirement.requiredRoles.length === 1) return true
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
        const evaluations = await loadAuthorityEvaluations(
          canonicalDraft,
          canonical.authorityEvaluations,
        )
        if (!pendingDecisionIntentsStillAllowed(canonicalDraft, evaluations, intent)) {
          clearPendingStage3Recovery(canonicalDraft)
          setPendingRecoveryMode(null)
          analytics.track("personal_plan_stage3_recovery_outcome", {
            operation,
            outcome: "authority_changed",
          })
          setPhase("decisions")
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
      clearPendingStage3Recovery(response.draft)
      setPendingRecoveryMode(null)
      setDraft(response.draft)
      categoryCapture.synchronizeRevision(response.draft.revision)
      categoryCapture.setSaveLabel("Gespeichert")
      analytics.track("personal_plan_stage3_recovery_outcome", {
        operation: recoveryAnalyticsOperation(intent),
        outcome: "resend_succeeded",
      })
      if (hasUnresolvedDecisionSubjects(response.draft)) setPhase("decisions")
      else void completeFlow(response.draft)
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
        await loadAuthorityEvaluations(response.draft, response.authorityEvaluations)
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
    return canonicalDraft.status === "completed" ? "completed" : "missing"
  }

  function pendingDecisionIntentsStillAllowed(
    canonicalDraft: Stage3ProductDraft,
    evaluations: Stage3AuthorityEvaluation[],
    intent: Extract<PendingStage3RecoveryIntent, { operation: "decision" | "decision_batch" }>,
  ) {
    const unresolvedKeys = new Set(
      unresolvedDecisionSubjects(canonicalDraft).map((subject) => subject.decisionKey),
    )
    return pendingIntentToAuthorityIntents(intent).every((item) => {
      if (!unresolvedKeys.has(item.subjectKey)) return false
      const evaluation = evaluations.find((candidate) => candidate.subjectKey === item.subjectKey)
      if (!evaluation?.allowedActions.includes(item.action as never)) return false
      if (item.action !== "plan_recommendation" || !item.selectedCandidateId) return true
      return (
        evaluation.status === "known" &&
        evaluation.recommendation?.productId === item.selectedCandidateId
      )
    })
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
    setAuthorityEvaluations([])
    setAuthorityStatus("idle")
    setCategoryIndex(cursorIndex)
    setQuery("")
    setSearchResults([])
    setSearchStatus("idle")
    setPhase("capture")
  }

  async function chooseDecision(
    decisionKey: string,
    action: Stage3DecisionAction,
    sourceDraft: Stage3ProductDraft = activeDraft,
  ) {
    const subject = deriveStage3DecisionSubjects(sourceDraft).find(
      (candidate) => candidate.decisionKey === decisionKey,
    )
    if (!subject) return
    if (!beginDecisionSubmission()) return
    if (action.kind === "choose_other") {
      try {
        await reopenCategory(subject.category)
      } finally {
        finishDecisionSubmission()
      }
      return
    }
    const evaluation = authorityEvaluations.find(
      (candidate) => candidate.subjectKey === decisionKey,
    )
    const semanticAction = semanticActionFor(action)
    if (
      !evaluation ||
      !semanticAction ||
      !evaluation.allowedActions.includes(semanticAction as never)
    ) {
      handleMutationError(new Error("stage3_authority_action_unavailable"))
      finishDecisionSubmission()
      return
    }
    const intent = authorityDecisionIntent(
      decisionKey,
      semanticAction,
      evaluation.status === "known" && evaluation.recommendation
        ? evaluation.recommendation.productId
        : undefined,
    )
    writePendingStage3Recovery(
      pendingRecoveryStorage,
      pendingRecoveryScopeForDraft(sourceDraft, personalPlanId),
      {
        operation: "decision",
        subjectKey: intent.subjectKey,
        action: intent.action,
        ...(intent.selectedCandidateId ? { selectedCandidateId: intent.selectedCandidateId } : {}),
        ...(intent.selectedCandidateFactFingerprint
          ? { selectedCandidateFactFingerprint: intent.selectedCandidateFactFingerprint }
          : {}),
        expectedRevision: sourceDraft.revision,
        createdAt: Date.now(),
      },
    )
    try {
      const response = await resolveAuthorityDecision({
        draftId: sourceDraft.draftId,
        expectedRevision: sourceDraft.revision,
        intent,
      })
      if (response.status === "conflict") {
        finishDecisionSubmission()
        clearPendingStage3Recovery(sourceDraft)
        return handleConflict(response.latestDraft)
      }
      const nextDraft = response.draft
      clearPendingStage3Recovery(sourceDraft)
      setDraft(nextDraft)
      categoryCapture.setSaveLabel("Gespeichert")
      analytics.track("personal_plan_stage3_save_outcome", { outcome: "saved" })
      analytics.track("personal_plan_stage3_decision_selected", {
        decisionType:
          action.kind === "pending"
            ? "pending_review"
            : action.kind === "skip"
              ? "uncovered"
              : action.kind,
        stepKey: "fit_decision",
      })
      const remaining = hasUnresolvedDecisionSubjects(nextDraft)
      if (!remaining) void completeFlow(nextDraft)
      finishDecisionSubmission()
    } catch (error) {
      finishDecisionSubmission()
      await handlePendingRecoveryError(error, sourceDraft)
    }
  }

  async function acceptClearFits(clearFits: Stage3ClearFit[]) {
    if (!beginDecisionSubmission()) return
    let nextDraft = activeDraft
    try {
      for (
        let offset = 0;
        offset < clearFits.length;
        offset += STAGE3_AUTHORITY_DECISION_BATCH_LIMIT
      ) {
        const intents = clearFits
          .slice(offset, offset + STAGE3_AUTHORITY_DECISION_BATCH_LIMIT)
          .map(({ subject }) => ({
            type: "resolve_decision" as const,
            subjectKey: subject.decisionKey,
            action: "keep_owned" as const,
          }))
        writePendingStage3Recovery(
          pendingRecoveryStorage,
          pendingRecoveryScopeForDraft(nextDraft, personalPlanId),
          {
            operation: "decision_batch",
            intents: intents.map((intent) => ({
              subjectKey: intent.subjectKey,
              action: intent.action,
            })),
            expectedRevision: nextDraft.revision,
            createdAt: Date.now(),
          },
        )
        const response = await resolveAuthorityDecisions({
          draftId: nextDraft.draftId,
          expectedRevision: nextDraft.revision,
          intents,
        })
        if (response.status === "conflict") {
          finishDecisionSubmission()
          clearPendingStage3Recovery(nextDraft)
          return handleConflict(response.latestDraft)
        }
        clearPendingStage3Recovery(nextDraft)
        nextDraft = response.draft
        setDraft(nextDraft)
      }
      categoryCapture.setSaveLabel("Gespeichert")
      analytics.track("personal_plan_stage3_save_outcome", { outcome: "saved" })
      const remaining = hasUnresolvedDecisionSubjects(nextDraft)
      if (!remaining) void completeFlow(nextDraft)
      finishDecisionSubmission()
    } catch (error) {
      finishDecisionSubmission()
      await handlePendingRecoveryError(error, nextDraft)
    }
  }

  async function acceptAutomaticOutcomes(
    sourceDraft: Stage3ProductDraft,
    outcomes: Stage3AutomaticOutcome[],
  ) {
    if (!beginDecisionSubmission()) return
    let nextDraft = sourceDraft
    try {
      for (
        let offset = 0;
        offset < outcomes.length;
        offset += STAGE3_AUTHORITY_DECISION_BATCH_LIMIT
      ) {
        const batch = outcomes.slice(offset, offset + STAGE3_AUTHORITY_DECISION_BATCH_LIMIT)
        const intents = automaticOutcomeIntents(batch)
        categoryCapture.setSaveLabel(
          `${Math.min(offset + batch.length, outcomes.length)} von ${outcomes.length} gespeichert`,
        )
        writePendingStage3Recovery(
          pendingRecoveryStorage,
          pendingRecoveryScopeForDraft(nextDraft, personalPlanId),
          {
            operation: "decision_batch",
            intents: intents.map((intent) => ({
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
            expectedRevision: nextDraft.revision,
            createdAt: Date.now(),
          },
        )
        const response = await resolveAuthorityDecisions({
          draftId: nextDraft.draftId,
          expectedRevision: nextDraft.revision,
          intents,
        })
        if (response.status === "conflict") {
          finishDecisionSubmission()
          clearPendingStage3Recovery(nextDraft)
          return handleConflict(response.latestDraft)
        }
        clearPendingStage3Recovery(nextDraft)
        nextDraft = response.draft
        setDraft(nextDraft)
      }
      categoryCapture.setSaveLabel("Gespeichert")
      analytics.track("personal_plan_stage3_save_outcome", { outcome: "saved" })
      const remaining = hasUnresolvedDecisionSubjects(nextDraft)
      finishDecisionSubmission()
      if (remaining) setPhase("decisions")
      else void completeFlow(nextDraft)
    } catch (error) {
      finishDecisionSubmission()
      await handlePendingRecoveryError(error, nextDraft)
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
      const response = await gateway.complete({
        draftId: sourceDraft.draftId,
        expectedRevision: sourceDraft.revision,
      })
      if (response.status === "conflict") {
        completionInFlight.current = false
        clearPendingStage3Recovery(sourceDraft)
        return handleConflict(response.latestDraft)
      }
      if (response.status === "not_ready") {
        completionInFlight.current = false
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
      openRoutine(response)
    } catch (error) {
      completionInFlight.current = false
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
        setPhase(latestDraft.pass === "product_capture" ? "capture" : "decisions")
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
): "reopen" | "decision" | "decision_batch" | "completion" {
  if (intent.operation === "mutation") return "reopen"
  return intent.operation
}

function isCategoryCaptureRetryLimitedError(error: unknown): error is Error & { retryAt: number } {
  return (
    error instanceof Error &&
    error.name === "CategoryCaptureRetryLimitedError" &&
    "retryAt" in error &&
    typeof error.retryAt === "number"
  )
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function createStableIdempotencyKey(): string {
  return crypto.randomUUID()
}
