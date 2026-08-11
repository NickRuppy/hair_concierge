"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { CATEGORY_ROLE_POLICIES } from "@/lib/personal-plan/products/authorities"
import type {
  Stage3AuthorityActionKind,
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
import { createHttpStage3ProductsGateway } from "@/lib/personal-plan/products/http-gateway"
import { reportPersonalPlanTransitionTiming } from "@/lib/personal-plan/transition-performance"
import type { Stage3Bootstrap } from "@/lib/personal-plan/products/stage2-entry-adapter"
import {
  PRODUCT_FREQUENCY_COMMON_FIRST_OPTIONS,
  type ProductFrequency,
} from "@/lib/vocabulary/frequencies"

import {
  IntakeFallbackBoundary,
  ProductCaptureScreen,
  ProductDecisionScreen,
  SemanticRoleAssignment,
  STAGE3_PRODUCT_SEARCH_EMPTY_MESSAGE,
  Stage3Shell,
  Stage3SystemState,
  type Stage3CatalogCandidate,
  type Stage3DecisionAction,
  type Stage3ProductDecisionProjection,
} from "."

type FlowPhase = "capture" | "roles" | "decisions" | "handoff"

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

const CATEGORY_COPY: Record<PersonalPlanCategory, { label: string; need: string }> = {
  shampoo: { label: "Shampoo", need: "Reinigung passend zu deiner Kopfhaut" },
  conditioner: { label: "Conditioner", need: "Pflege nach jeder Wäsche" },
  leave_in: { label: "Leave-in", need: "Pflege, die im Haar bleibt" },
  heat_protectant: { label: "Hitzeschutz", need: "Schutz bei Styling mit Hitze" },
  oil: { label: "Öl", need: "Schutz und Finish für deine Längen" },
  mask: { label: "Maske", need: "Zusätzliche intensive Pflege" },
  scalp_care: { label: "Kopfhautprodukt", need: "Beruhigende Pflege für deine Kopfhaut" },
  dry_shampoo: { label: "Trockenshampoo", need: "Frische zwischen den Haarwäschen" },
  bondbuilder: { label: "Bondbuilder", need: "Unterstützung für beanspruchtes Haar" },
  deep_cleansing_shampoo: {
    label: "Tiefenreinigung",
    need: "Gezielte Entfernung von Rückständen",
  },
}

const ROLE_COPY: Record<PlanProductRole, { label: string; description: string }> = {
  shampoo_everyday: { label: "Hauptreinigung", description: "Für deine regelmäßige Haarwäsche" },
  shampoo_dandruff: { label: "Gezielte Reinigung", description: "Als gezielte Ergänzung" },
  conditioner_rinse_out: { label: "Pflege nach der Wäsche", description: "Zum Ausspülen" },
  post_wash_leave_in: { label: "Pflege im feuchten Haar", description: "Nach der Haarwäsche" },
  pre_heat_application: { label: "Vor dem Styling", description: "Vor Wärme im Haar" },
  intensive_conditioning_mask: { label: "Intensivpflege", description: "Als auswaschbare Pflege" },
  pre_wash_fibre_treatment: {
    label: "Vor der Haarwäsche",
    description: "Als Pflege vor dem Waschen",
  },
  leave_on_fibre_conditioning: {
    label: "Im feuchten Haar",
    description: "Nach dem Waschen im feuchten Haar",
  },
  dry_finish: { label: "Im trockenen Haar", description: "Für Glanz und Finish" },
  residue_reset: { label: "Rückstände lösen", description: "Bei Bedarf" },
  mineral_reset: { label: "Mineralrückstände lösen", description: "Bei Bedarf" },
  root_refresh_bridge: { label: "Ansatz auffrischen", description: "Zwischen Haarwäschen" },
  pre_heat_protection: { label: "Schutz vor Stylinghitze", description: "Vor Hitze" },
  specialized_bond_treatment: { label: "Bondpflege", description: "Nach Herstellerangabe" },
  scalp_comfort: { label: "Kopfhaut beruhigen", description: "Für ein ruhigeres Hautgefühl" },
  scalp_flake_oil_adjunct: {
    label: "Schuppen kontrollieren",
    description: "Bei sichtbaren Schuppen",
  },
  density_claim_tonic: { label: "Kopfhaut-Tonic", description: "Mit begrenzter Evidenz" },
  scalp_exfoliant: { label: "Kopfhaut klären", description: "Bei Bedarf" },
}

const FREQUENCIES: Array<{ value: ProductFrequency; label: string }> = [
  ...PRODUCT_FREQUENCY_COMMON_FIRST_OPTIONS,
]

export function automaticOilAuthorityAction(
  subject: ReturnType<typeof deriveStage3DecisionSubjects>[number],
  evaluation: Stage3AuthorityEvaluation,
): Stage3AuthorityActionKind | null {
  if (subject.category !== "oil" || evaluation.allowedActions.length !== 1) return null
  const action = evaluation.allowedActions[0]
  if (action === "keep_owned" && evaluation.status === "known" && evaluation.verdict === "ideal") {
    return action
  }
  if (action === "keep_pending" && evaluation.status === "pending") return action
  if (action === "leave_uncovered" && subject.subjectKind === "uncovered_role") return action
  return null
}

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
  onOpenRoutine,
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
  onOpenRoutine?: (handoff: Stage3RoutineHandoff) => void
} = {}) {
  const resolvedEntryContext = bootstrap?.entryContext ?? entryContext
  const requirements =
    bootstrap?.requirements ?? resolvedEntryContext?.orderedCategories ?? DEFAULT_REQUIREMENTS
  const personalPlanId = resolvedEntryContext?.personalPlanId ?? "fixture-personal-plan"
  const refinedVersionId = resolvedEntryContext?.refinedVersionId ?? "fixture-refined-version"
  const gatewayRef = useRef<Stage3UiGateway | null>(null)
  if (!gatewayRef.current) {
    gatewayRef.current = providedGateway ?? createHttpStage3ProductsGateway()
  }
  const gateway = gatewayRef.current

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
  const [phase, setPhase] = useState<FlowPhase>(() =>
    initialDraft.pass === "product_capture" && initialDraft.categoryCursor
      ? "capture"
      : "decisions",
  )
  const [draft, setDraft] = useState<Stage3ProductDraft>(initialDraft)
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
  const [saveLabel, setSaveLabel] = useState(bootstrap ? "Gespeichert" : "Wird geladen")
  const [categoryFinalizeStatus, setCategoryFinalizeStatus] = useState<"idle" | "saving">("idle")
  const [categoryFinalizeAction, setCategoryFinalizeAction] = useState<"roles" | "gap" | null>(null)
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
  const searchToken = useRef(0)
  const intakeIdempotencyKey = useRef<string | null>(null)
  const completionInFlight = useRef(false)
  const categoryFinalizeInFlight = useRef(false)
  const decisionSubmitInFlight = useRef(false)
  const bootstrapDecisionPreparationStarted = useRef(false)

  const currentRequirement = requirements[categoryIndex]
  const currentCategory = currentRequirement?.category ?? requirements[0]?.category ?? "shampoo"
  const currentCopy = CATEGORY_COPY[currentCategory]
  const currentProducts = useMemo(
    () => draft?.products.filter((product) => product.identity.category === currentCategory) ?? [],
    [currentCategory, draft],
  )

  useEffect(() => {
    if (
      !bootstrap ||
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
  }, [bootstrap])

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
        .search({ category: currentCategory, query: trimmed, requestToken })
        .then((response) => {
          if (response.requestToken !== searchToken.current) return
          const results = response.result.candidates.map((candidate) => ({
            candidateId: candidate.candidateId,
            displayName: candidate.displayName,
            brandName: candidate.brandName ?? undefined,
            imageUrl: candidate.imageUrl ?? undefined,
            confidenceLabel:
              candidate.confidence === "exact"
                ? "Eindeutiger Treffer"
                : "Wahrscheinlich dein Produkt",
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
  }, [analytics, currentCategory, gateway, phase, query, searchDebounceMs])

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

  const activeDraft = draft
  const shellSaveStatus = systemIssue
    ? "error"
    : saveLabel === "Gespeichert"
      ? "saved"
      : saveLabel === "Wird geladen"
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
        label: systemIssue ? "Nicht gespeichert" : saveLabel,
      }}
      onBack={onBack}
    >
      {children}
    </Stage3Shell>
  )

  if (systemIssue) {
    return shell(
      <Stage3SystemState
        state={systemIssue.kind}
        title={systemIssue.title}
        message={systemIssue.message}
        actionLabel="Erneut versuchen"
        onAction={systemIssue.retry}
      />,
      "Speichern",
    )
  }

  if (categoryFinalizeStatus === "saving") {
    return shell(
      <Stage3SystemState
        state="loading"
        title={
          categoryFinalizeAction === "gap"
            ? "Alles klar – dafür hast du noch kein Produkt."
            : "Produkte werden gespeichert."
        }
        message={
          categoryFinalizeAction === "gap"
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
        capturedProducts={currentProducts.map((product) => ({
          capturedProductId: product.capturedProductId,
          displayName: product.identity.displayName,
          frequencyLabel:
            FREQUENCIES.find((option) => option.value === product.frequencyRange)?.label ??
            product.frequencyRange,
          sourceLabel: product.source === "catalog_search" ? "Gefunden" : "Manuell hinzugefügt",
          statusLabel:
            product.identity.kind === "pending_submission"
              ? "Noch in Prüfung · gespeichert"
              : undefined,
          imageUrl: product.identity.imageUrl ?? undefined,
        }))}
        frequencyOptions={FREQUENCIES}
        selectedFrequency={frequency}
        frequencyProductName={pendingCandidate?.displayName}
        showFrequency={pendingCandidate !== null}
        showAddAnotherProduct={currentProducts.length > 0}
        canContinue={currentProducts.length > 0}
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
          const selectedFrequency = value as ProductFrequency
          setFrequency(selectedFrequency)
          if (pendingCandidate)
            void captureCandidate(pendingCandidate.candidateId, selectedFrequency)
        }}
        onAddAnotherProduct={() => {
          setQuery("")
          setSearchStatus("idle")
          setSearchResults([])
          setPendingCandidate(null)
          setFrequency(null)
        }}
        onRemoveProduct={(capturedProductId) => void removeProduct(capturedProductId)}
        onOpenFallbackIntake={() => {
          intakeIdempotencyKey.current ??= createStableIdempotencyKey()
          setFallbackError(undefined)
          setShowFallback(true)
          analytics.track("personal_plan_stage3_fallback_opened", { stepKey: "product_search" })
        }}
        onExplicitNone={currentProducts.length === 0 ? () => void markCurrentRoleGap() : undefined}
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
        products={currentProducts.map((product) => ({
          capturedProductId: product.capturedProductId,
          displayName: product.identity.displayName,
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
    const unresolvedSubjects = deriveStage3DecisionSubjects(draft).filter(
      (subject) =>
        !draft.decisions.some((decision) => decision.decisionKey === subject.decisionKey),
    )
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
    const clearFits = unresolvedSubjects
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
          evaluation: Extract<Stage3AuthorityEvaluation, { status: "known" }>
        } =>
          item.evaluation?.status === "known" &&
          item.evaluation.verdict === "ideal" &&
          item.evaluation.allowedActions.includes("keep_owned"),
      )
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
    setSaveLabel("Gespeichert")

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
    const automaticOutcomes = deriveStage3DecisionSubjects(sourceDraft)
      .filter(
        (subject) =>
          !sourceDraft.decisions.some((decision) => decision.decisionKey === subject.decisionKey),
      )
      .flatMap((subject) => {
        const evaluation = evaluations.find(
          (candidate) => candidate.subjectKey === subject.decisionKey,
        )
        const action = evaluation ? automaticOilAuthorityAction(subject, evaluation) : null
        return evaluation && action ? [{ subject, action }] : []
      })

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
      const body = (await response.json().catch(() => null)) as
        | Stage3MutationResponse
        | { latestDraft?: Stage3ProductDraft }
        | null
      reportPersonalPlanTransitionTiming({
        layer: "client",
        operation: "stage3_individual_decision",
        outcome: response.ok ? "success" : "http_error",
        durationMs: performance.now() - startedAt,
        status: response.status,
      })
      timingReported = true
      if (response.status === 409 && body && "latestDraft" in body && body.latestDraft) {
        return { status: "conflict", latestDraft: body.latestDraft }
      }
      if (!response.ok || !body || !("status" in body)) {
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
      const body = (await response.json().catch(() => null)) as
        | Stage3MutationResponse
        | { latestDraft?: Stage3ProductDraft }
        | null
      reportPersonalPlanTransitionTiming({
        layer: "client",
        operation: "stage3_grouped_decisions",
        outcome: response.ok ? "success" : "http_error",
        durationMs: performance.now() - startedAt,
        status: response.status,
      })
      timingReported = true
      if (response.status === 409 && body && "latestDraft" in body && body.latestDraft) {
        return { status: "conflict", latestDraft: body.latestDraft }
      }
      if (!response.ok || !body || !("status" in body)) {
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
      !ready.productPortfolioVersionId ||
      !ready.routineProposalId
    ) {
      handleMutationError(new Error("stage3_routine_handoff_invalid"), () => openRoutine(ready))
      return
    }
    const handoff: Stage3RoutineHandoff = {
      personalPlanId: ready.personalPlanId,
      refinedVersionId: ready.refinedVersionId,
      productPortfolioVersionId: ready.productPortfolioVersionId,
      routineProposalId: ready.routineProposalId,
      next: ready.next,
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
    if (inheritedFrequency && inheritedFrequency !== "does_not_wash") {
      void captureCandidate(candidate.candidateId, inheritedFrequency)
    } else {
      setPendingCandidate(candidate)
      setFrequency(null)
    }
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

  async function captureCandidate(candidateId: string, selectedFrequency: ProductFrequency) {
    await saveMutation(
      { type: "capture_catalog_candidate", candidateId, frequencyRange: selectedFrequency },
      () => {
        setQuery("")
        setSearchStatus("idle")
        setSearchResults([])
        setPendingCandidate(null)
        setFrequency(null)
      },
    )
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
    if (currentProducts.length === 0) {
      setSearchStatus("empty")
      setSearchMessage("Wähle ein Produkt oder bestätige, dass du keines nutzt.")
      return
    }
    const initialAssignments = Object.fromEntries(
      currentProducts.map((product) => [
        product.capturedProductId,
        activeDraft.roleAssignments.find(
          (assignment) => assignment.capturedProductId === product.capturedProductId,
        )?.roles ?? [],
      ]),
    )
    const suggestedAssignments = suggestRoleAssignments(initialAssignments)
    setRoleAssignments(suggestedAssignments)
    if (canAutoAssignRoles(suggestedAssignments)) {
      await saveRolesAndContinue(suggestedAssignments)
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

  async function saveRolesAndContinue(assignments = roleAssignments) {
    const covered = new Set(Object.values(assignments).flat())
    const missing = currentRequirement.requiredRoles.filter((role) => !covered.has(role))
    await finalizeCurrentCapture(
      {
        assignments: currentProducts.flatMap((product) => {
          const roles = (assignments[product.capturedProductId] ?? []) as PlanProductRole[]
          return roles.length > 0
            ? [{ capturedProductId: product.capturedProductId, category: currentCategory, roles }]
            : []
        }),
        uncoveredRoles: missing.map((role) => ({
          category: currentCategory,
          role,
          reason: "not_ready_to_decide" as const,
        })),
      },
      activeDraft,
      "roles",
    )
  }

  function suggestRoleAssignments(current: Record<string, string[]>) {
    if (currentProducts.length !== 1) return current
    const productId = currentProducts[0].capturedProductId
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

  function canAutoAssignRoles(assignments: Record<string, string[]>) {
    if (currentProducts.length !== 1) return false
    if (currentRequirement.requiredRoles.length === 1) return true
    if (currentCategory !== "oil") return false
    return (assignments[currentProducts[0].capturedProductId]?.length ?? 0) > 0
  }

  async function markCurrentRoleGap() {
    await finalizeCurrentCapture(
      {
        assignments: [],
        uncoveredRoles: currentRequirement.requiredRoles.map((role) => ({
          category: currentCategory,
          role,
          reason: "no_product_owned" as const,
        })),
      },
      activeDraft,
      "gap",
    )
  }

  async function finalizeCurrentCapture(
    capture: Pick<
      Extract<Stage3ProductsMutation, { type: "finalize_capture_category" }>,
      "assignments" | "uncoveredRoles"
    >,
    sourceDraft = activeDraft,
    action: "roles" | "gap" = "roles",
  ) {
    if (categoryFinalizeInFlight.current) return
    categoryFinalizeInFlight.current = true
    setCategoryFinalizeStatus("saving")
    setCategoryFinalizeAction(action)
    setSaveLabel(action === "roles" ? "Produkte werden gespeichert" : "Wird gespeichert")

    let response: Stage3MutationResponse
    try {
      response = await gateway.mutate({
        draftId: sourceDraft.draftId,
        expectedRevision: sourceDraft.revision,
        mutation: {
          type: "finalize_capture_category",
          category: currentCategory,
          ...capture,
        },
      })
    } catch (error) {
      finishCategoryFinalization()
      handleMutationError(error, () => void finalizeCurrentCapture(capture, sourceDraft, action))
      return
    }

    if (response.status === "conflict") {
      finishCategoryFinalization()
      handleConflict(
        response.latestDraft,
        () => void finalizeCurrentCapture(capture, response.latestDraft, action),
      )
      return
    }

    setDraft(response.draft)
    setSaveLabel("Gespeichert")
    analytics.track("personal_plan_stage3_save_outcome", { outcome: "saved" })
    try {
      await advanceFromServerCursor(response.draft)
      finishCategoryFinalization()
    } catch (error) {
      finishCategoryFinalization()
      handleMutationError(error, () => void advanceFromServerCursor(response.draft))
    }
  }

  function finishCategoryFinalization() {
    categoryFinalizeInFlight.current = false
    setCategoryFinalizeStatus("idle")
    setCategoryFinalizeAction(null)
  }

  async function advanceFromServerCursor(nextDraft: Stage3ProductDraft) {
    setQuery("")
    setSearchResults([])
    setSearchStatus("idle")
    setPendingCandidate(null)
    setFrequency(null)
    setManualProductName("")
    setRoleAssignments({})
    if (nextDraft.pass === "product_capture" && nextDraft.categoryCursor) {
      const nextIndex = requirements.findIndex(
        (requirement) => requirement.category === nextDraft.categoryCursor,
      )
      if (nextIndex < 0) throw new Error("stage3_category_cursor_invalid")
      setCategoryIndex(nextIndex)
      setPhase("capture")
    } else {
      await prepareDecisionPhase(nextDraft)
    }
  }

  async function chooseDecision(decisionKey: string, action: Stage3DecisionAction) {
    const subject = deriveStage3DecisionSubjects(activeDraft).find(
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
      handleMutationError(
        new Error("stage3_authority_action_unavailable"),
        () => void chooseDecision(decisionKey, action),
      )
      finishDecisionSubmission()
      return
    }
    const intent: Stage3AuthoritySemanticIntent = {
      type: "resolve_decision",
      subjectKey: decisionKey,
      action: semanticAction,
      ...(semanticAction === "plan_recommendation" &&
      evaluation.status === "known" &&
      evaluation.recommendation
        ? { selectedCandidateId: evaluation.recommendation.productId }
        : {}),
    }
    try {
      const response = await resolveAuthorityDecision({
        draftId: activeDraft.draftId,
        expectedRevision: activeDraft.revision,
        intent,
      })
      if (response.status === "conflict") {
        finishDecisionSubmission()
        return handleConflict(response.latestDraft, () => void chooseDecision(decisionKey, action))
      }
      const nextDraft = response.draft
      setDraft(nextDraft)
      setSaveLabel("Gespeichert")
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
      const remaining = deriveStage3DecisionSubjects(nextDraft).some(
        (candidate) =>
          !nextDraft.decisions.some((entry) => entry.decisionKey === candidate.decisionKey),
      )
      if (!remaining) void completeFlow(nextDraft)
      finishDecisionSubmission()
    } catch (error) {
      finishDecisionSubmission()
      handleMutationError(error, () => void chooseDecision(decisionKey, action))
    }
  }

  async function acceptClearFits(
    clearFits: Array<{
      subject: ReturnType<typeof deriveStage3DecisionSubjects>[number]
      evaluation: Extract<Stage3AuthorityEvaluation, { status: "known" }>
    }>,
  ) {
    if (!beginDecisionSubmission()) return
    let nextDraft = activeDraft
    try {
      for (
        let offset = 0;
        offset < clearFits.length;
        offset += STAGE3_AUTHORITY_DECISION_BATCH_LIMIT
      ) {
        const response = await resolveAuthorityDecisions({
          draftId: nextDraft.draftId,
          expectedRevision: nextDraft.revision,
          intents: clearFits
            .slice(offset, offset + STAGE3_AUTHORITY_DECISION_BATCH_LIMIT)
            .map(({ subject }) => ({
              type: "resolve_decision",
              subjectKey: subject.decisionKey,
              action: "keep_owned",
            })),
        })
        if (response.status === "conflict") {
          finishDecisionSubmission()
          return handleConflict(response.latestDraft, () => setPhase("decisions"))
        }
        nextDraft = response.draft
        setDraft(nextDraft)
      }
      setSaveLabel("Gespeichert")
      analytics.track("personal_plan_stage3_save_outcome", { outcome: "saved" })
      const remaining = deriveStage3DecisionSubjects(nextDraft).some(
        (subject) =>
          !nextDraft.decisions.some((decision) => decision.decisionKey === subject.decisionKey),
      )
      if (!remaining) void completeFlow(nextDraft)
      finishDecisionSubmission()
    } catch (error) {
      finishDecisionSubmission()
      handleMutationError(error, () => setPhase("decisions"))
    }
  }

  async function acceptAutomaticOutcomes(
    sourceDraft: Stage3ProductDraft,
    outcomes: Array<{
      subject: ReturnType<typeof deriveStage3DecisionSubjects>[number]
      action: Stage3AuthorityActionKind
    }>,
  ) {
    if (!beginDecisionSubmission()) return
    let nextDraft = sourceDraft
    try {
      for (const [index, { subject, action }] of outcomes.entries()) {
        setSaveLabel(`${index + 1} von ${outcomes.length} gespeichert`)
        const response = await resolveAuthorityDecision({
          draftId: nextDraft.draftId,
          expectedRevision: nextDraft.revision,
          intent: { type: "resolve_decision", subjectKey: subject.decisionKey, action },
        })
        if (response.status === "conflict") {
          finishDecisionSubmission()
          return handleConflict(
            response.latestDraft,
            () => void prepareDecisionPhase(response.latestDraft),
          )
        }
        nextDraft = response.draft
        setDraft(nextDraft)
      }
      setSaveLabel("Gespeichert")
      analytics.track("personal_plan_stage3_save_outcome", { outcome: "saved" })
      const remaining = deriveStage3DecisionSubjects(nextDraft).some(
        (subject) =>
          !nextDraft.decisions.some((decision) => decision.decisionKey === subject.decisionKey),
      )
      finishDecisionSubmission()
      if (remaining) setPhase("decisions")
      else void completeFlow(nextDraft)
    } catch (error) {
      finishDecisionSubmission()
      handleMutationError(error, () => void prepareDecisionPhase(nextDraft))
    }
  }

  function beginDecisionSubmission() {
    if (decisionSubmitInFlight.current) return false
    decisionSubmitInFlight.current = true
    setDecisionSubmitStatus("saving")
    setSaveLabel("Wird gespeichert")
    return true
  }

  function finishDecisionSubmission() {
    decisionSubmitInFlight.current = false
    setDecisionSubmitStatus("idle")
  }

  async function removeProduct(capturedProductId: string) {
    await saveMutation({ type: "remove_captured_product", capturedProductId })
  }

  async function reopenCategory(category: PersonalPlanCategory) {
    await saveMutation({ type: "reopen_capture_category", category }, (nextDraft) => {
      const cursorIndex = requirements.findIndex(
        (requirement) => requirement.category === nextDraft.categoryCursor,
      )
      if (cursorIndex < 0) {
        handleMutationError(
          new Error("stage3_category_cursor_invalid"),
          () => void reopenCategory(category),
        )
        return
      }
      setAuthorityEvaluations([])
      setAuthorityStatus("idle")
      setCategoryIndex(cursorIndex)
      setQuery("")
      setSearchResults([])
      setSearchStatus("idle")
      setPhase("capture")
    })
  }

  async function reopenPreviousCategory(category: PersonalPlanCategory) {
    const currentIndex = requirements.findIndex((item) => item.category === category)
    const knownOwned = resolvedEntryContext?.authoritySnapshot?.productLoadContext?.ownedCategories
    const previous = requirements
      .slice(0, currentIndex)
      .reverse()
      .find(
        (item) =>
          !knownOwned ||
          knownOwned.includes(item.category) ||
          activeDraft.products.some((product) => product.identity.category === item.category),
      )
    if (previous) await reopenCategory(previous.category)
    else onBackToRefinement?.()
  }

  async function completeFlow(sourceDraft: Stage3ProductDraft) {
    if (completion || completionInFlight.current) return
    completionInFlight.current = true
    try {
      const response = await gateway.complete({
        draftId: sourceDraft.draftId,
        expectedRevision: sourceDraft.revision,
      })
      if (response.status === "conflict") {
        completionInFlight.current = false
        return handleConflict(response.latestDraft, () => void completeFlow(response.latestDraft))
      }
      if (response.status === "not_ready") {
        completionInFlight.current = false
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
      setDraft(response.draft)
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
      handleMutationError(error, () => void completeFlow(sourceDraft))
    }
  }

  async function saveMutation(
    mutation: Stage3ProductsMutation,
    afterSave?: (nextDraft: Stage3ProductDraft) => void,
  ) {
    setSaveLabel("Wird gespeichert")
    try {
      const response = await gateway.mutate({
        draftId: activeDraft.draftId,
        expectedRevision: activeDraft.revision,
        mutation,
      })
      if (response.status === "conflict")
        return handleConflict(response.latestDraft, () => void saveMutation(mutation, afterSave))
      setDraft(response.draft)
      setSaveLabel("Gespeichert")
      analytics.track("personal_plan_stage3_save_outcome", { outcome: "saved" })
      afterSave?.(response.draft)
    } catch (error) {
      handleMutationError(error, () => void saveMutation(mutation, afterSave))
    }
  }

  function handleConflict(latestDraft: Stage3ProductDraft, retry: () => void) {
    setDraft(latestDraft)
    setSystemIssue({
      kind: "conflict",
      title: "Deine Auswahl wurde zwischenzeitlich aktualisiert.",
      message: "Wir haben den neuesten Stand geladen. Versuche deine letzte Auswahl erneut.",
      retry: () => {
        setSystemIssue(null)
        analytics.track("personal_plan_stage3_save_outcome", { outcome: "conflict" })
        retry()
      },
    })
  }

  function handleMutationError(_error: unknown, retry: () => void) {
    const message = "Die Auswahl konnte nicht gespeichert werden."
    setSystemIssue({
      kind: "error",
      title: "Speichern fehlgeschlagen.",
      message,
      retry: () => {
        setSystemIssue(null)
        analytics.track("personal_plan_stage3_save_outcome", { outcome: "retry" })
        retry()
      },
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
  if (phase === "capture" || phase === "roles") return categoryIndex + 1
  if (phase === "decisions") return requirementCount + 1
  return requirementCount + 3
}

export function authorityEvaluationProjection(
  draft: Stage3ProductDraft,
  subject: ReturnType<typeof deriveStage3DecisionSubjects>[number],
  evaluation: Stage3AuthorityEvaluation,
  needSummary = CATEGORY_COPY[subject.category].need,
): Stage3ProductDecisionProjection {
  if (evaluation.subjectKey !== subject.decisionKey || evaluation.category !== subject.category) {
    throw new Error("stage3_authority_projection_mismatch")
  }
  const product = subject.capturedProductId
    ? draft.products.find((candidate) => candidate.capturedProductId === subject.capturedProductId)
    : undefined
  const base = {
    decisionKey: subject.decisionKey,
    categoryLabel: CATEGORY_COPY[subject.category].label,
    ...(subject.category === "oil" ? { roleLabel: ROLE_COPY[subject.role].label } : {}),
    needSummary,
    ...(product ? { ownedProductName: product.identity.displayName } : {}),
  }

  if (evaluation.status === "pending") {
    return {
      ...base,
      kind: "pending",
      verdictLabel: "Noch in Prüfung",
      rationale: "Wir prüfen das Produkt, bevor wir seine Passung bewerten.",
      actions: projectAuthorityActions(evaluation, product?.identity.displayName),
    }
  }
  if (evaluation.status === "unknown") {
    return {
      ...base,
      kind: "gap",
      verdictLabel: "Noch nicht beurteilbar",
      rationale: "Für eine verlässliche Bewertung fehlen noch bestätigte Produktinformationen.",
      criteria: evaluation.criteria.map(projectCriterion),
      actions: projectAuthorityActions(evaluation, product?.identity.displayName),
    }
  }
  if (evaluation.status === "unsupported") {
    return {
      ...base,
      kind: "gap",
      verdictLabel: "Prüfung nicht verfügbar",
      rationale: "Diese Passung können wir aktuell noch nicht verlässlich prüfen.",
      actions: [],
    }
  }
  const kind =
    evaluation.verdict === "mismatch"
      ? "mismatch"
      : evaluation.verdict === "unknown"
        ? "gap"
        : "fit"
  return {
    ...base,
    kind,
    verdictLabel:
      evaluation.verdict === "ideal"
        ? "Passt sehr gut"
        : evaluation.verdict === "supportive"
          ? "Passt mit Einschränkung"
          : evaluation.verdict === "mismatch"
            ? "Passt nicht zu deinem Bedarf"
            : "Noch nicht beurteilbar",
    rationale:
      evaluation.verdict === "ideal"
        ? "Das Produkt erfüllt den vorgesehenen Bedarf. Das ist ein guter Baustein für deine Routine."
        : evaluation.verdict === "supportive"
          ? "Das Produkt unterstützt deinen Bedarf mit einer dokumentierten Einschränkung."
          : evaluation.verdict === "mismatch"
            ? "Die bestätigten Produkteigenschaften passen nicht zu diesem Bedarf."
            : "Eine verlässliche Bewertung ist noch nicht möglich.",
    criteria: evaluation.criteria.map(projectCriterion),
    ...(evaluation.recommendation
      ? { recommendation: { productName: evaluation.recommendation.displayName } }
      : {}),
    actions: projectAuthorityActions(
      evaluation,
      product?.identity.displayName,
      evaluation.recommendation?.displayName,
    ),
  }
}

function projectCriterion(
  criterion: Extract<
    Stage3AuthorityEvaluation,
    { status: "known" | "unknown" }
  >["criteria"][number],
) {
  return {
    label: criterion.label,
    result:
      criterion.result === "pass"
        ? "Erfüllt"
        : criterion.result === "caution"
          ? "Teilweise"
          : criterion.result === "fail"
            ? "Nicht erfüllt"
            : "Noch offen",
    tone:
      criterion.result === "pass"
        ? ("positive" as const)
        : criterion.result === "fail"
          ? ("negative" as const)
          : ("warning" as const),
    explanation: criterion.explanation,
  }
}

function projectAuthorityActions(
  evaluation: Stage3AuthorityEvaluation,
  productName?: string,
  recommendationName?: string,
): Stage3DecisionAction[] {
  return evaluation.allowedActions.map((action) => {
    switch (action) {
      case "keep_owned":
        return { kind: "keep", label: `${productName ?? "Produkt"} weiterverwenden`, productName }
      case "acknowledge_override":
        return {
          kind: "override",
          label: `${productName ?? "Produkt"} trotzdem behalten`,
          productName,
        }
      case "plan_recommendation":
        return {
          kind: "plan_purchase",
          label: `${recommendationName ?? "Empfehlung"} einplanen`,
          productName: recommendationName,
        }
      case "keep_pending":
        return { kind: "pending", label: "Prüfung später fortsetzen", productName }
      case "leave_uncovered":
        return {
          kind: "skip",
          label: productName ? "Nicht in die Routine übernehmen" : "Lücke im Plan markieren",
          productName,
        }
    }
  })
}

function semanticActionFor(
  action: Stage3DecisionAction,
): Stage3AuthoritySemanticIntent["action"] | null {
  switch (action.kind) {
    case "keep":
      return "keep_owned"
    case "override":
      return "acknowledge_override"
    case "plan_purchase":
      return "plan_recommendation"
    case "pending":
      return "keep_pending"
    case "skip":
      return "leave_uncovered"
    case "choose_other":
      return null
  }
}

function createStableIdempotencyKey(): string {
  return crypto.randomUUID()
}
