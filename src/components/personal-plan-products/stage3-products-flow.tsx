"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { CATEGORY_AUTHORITY_STUBS } from "@/lib/personal-plan/products/authorities"
import {
  deriveStage3DecisionSubjects,
  type PersonalPlanCategory,
  type ProposedProductPortfolio,
  type Stage3CategoryRequirement,
  type Stage3ProductDecision,
  type Stage3ProductDraft,
  type Stage3SemanticRole,
} from "@/lib/personal-plan/products/contracts"
import { createStage3Draft } from "@/lib/personal-plan/products/state-machine"
import {
  createFixtureStage3Gateway,
  FixtureGatewaySimulatedError,
  type FixtureCompleteResponse,
  type FixtureMutation,
  type FixtureStage3Gateway,
} from "@/lib/personal-plan/products/fixture-gateway"
import type { ProductFrequency } from "@/lib/vocabulary/frequencies"

import {
  IntakeFallbackBoundary,
  ProductCaptureScreen,
  ProductDecisionScreen,
  SemanticRoleAssignment,
  Stage3Shell,
  Stage3SystemState,
  Stage3Transition,
  type Stage3CatalogCandidate,
  type Stage3DecisionAction,
  type Stage3ProductDecisionProjection,
} from "."

type FlowPhase =
  | "capture_orientation"
  | "capture"
  | "roles"
  | "fit_orientation"
  | "decisions"
  | "routine_ready"
  | "handoff"

type SystemIssue = {
  kind: "error" | "conflict"
  title: string
  message: string
  retry: () => void
}

const REQUIREMENTS: Stage3CategoryRequirement[] = [
  requirement("conditioner", "Pflege nach jeder Wäsche"),
  requirement("oil", "Schutz und Finish für deine Längen"),
  requirement("scalp_care", "Beruhigende Pflege für deine Kopfhaut"),
  requirement("heat_protectant", "Schutz bei Styling mit Hitze"),
]

const CATEGORY_COPY: Record<
  PersonalPlanCategory,
  { label: string; need: string }
> = {
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

const ROLE_COPY: Record<Stage3SemanticRole, { label: string; description: string }> = {
  shampoo_primary: { label: "Hauptreinigung", description: "Für deine regelmäßige Haarwäsche" },
  shampoo_alternating: { label: "Abwechselnde Reinigung", description: "Als gezielte Ergänzung" },
  prewash_lengths: { label: "Pre-Wash für die Längen", description: "Vor der Haarwäsche" },
  damp_leave_on: { label: "Pflege im feuchten Haar", description: "Nach der Haarwäsche" },
  dry_finish: { label: "Glanz und Finish", description: "Im trockenen Haar" },
  scalp: { label: "Pflege der Kopfhaut", description: "Direkt auf der Kopfhaut" },
  scalp_care_soothing: { label: "Kopfhaut beruhigen", description: "Für ein ruhigeres Hautgefühl" },
  scalp_care_flake_control: { label: "Schuppen kontrollieren", description: "Bei sichtbaren Schuppen" },
  heat_protection_hot_tools: { label: "Schutz vor Stylinghitze", description: "Vor Glätteisen oder Lockenstab" },
  heat_protection_blow_dry: { label: "Schutz beim Föhnen", description: "Vor warmer Föhnluft" },
  category_primary: { label: "Geplante Hauptpflege", description: "Für den vorgesehenen Routineplatz" },
  category_coverage: { label: "Pflege nach der Wäsche", description: "Mehrere passende Conditioner dürfen bleiben" },
}

const FREQUENCIES: Array<{ value: ProductFrequency; label: string }> = [
  { value: "daily_1x", label: "Täglich" },
  { value: "weekly_5_6x", label: "5–6x/Woche" },
  { value: "weekly_3_4x", label: "3–4x/Woche" },
  { value: "weekly_2x", label: "2x/Woche" },
  { value: "weekly_1x", label: "1x/Woche" },
  { value: "biweekly_1x", label: "Alle 2 Wochen" },
  { value: "monthly_1x", label: "Monatlich" },
  { value: "less_than_monthly", label: "Seltener" },
]

export function Stage3ProductsFlow({ searchDebounceMs = 250 }: { searchDebounceMs?: number } = {}) {
  const gatewayRef = useRef<FixtureStage3Gateway | null>(null)
  if (!gatewayRef.current) gatewayRef.current = createFixtureStage3Gateway({ searchDelayMs: 0 })
  const gateway = gatewayRef.current

  const [phase, setPhase] = useState<FlowPhase>("capture_orientation")
  const [draft, setDraft] = useState<Stage3ProductDraft>(() =>
    createStage3Draft({
      draftId: "fixture-stage3-draft",
      userId: "fixture-user",
      personalPlanId: "fixture-personal-plan",
      refinedVersionId: "fixture-refined-version",
      requirements: REQUIREMENTS,
      now: "2026-08-07T00:00:00.000Z",
    }),
  )
  const [categoryIndex, setCategoryIndex] = useState(0)
  const [query, setQuery] = useState("")
  const [searchStatus, setSearchStatus] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle")
  const [searchResults, setSearchResults] = useState<Stage3CatalogCandidate[]>([])
  const [searchMessage, setSearchMessage] = useState<string>()
  const [frequency, setFrequency] = useState<ProductFrequency | null>(null)
  const [pendingCandidate, setPendingCandidate] = useState<Stage3CatalogCandidate | null>(null)
  const [showFallback, setShowFallback] = useState(false)
  const [fallbackPending, setFallbackPending] = useState(false)
  const [roleAssignments, setRoleAssignments] = useState<Record<string, string[]>>({})
  const [roleErrors, setRoleErrors] = useState<string[]>([])
  const [saveLabel, setSaveLabel] = useState("Wird geladen")
  const [systemIssue, setSystemIssue] = useState<SystemIssue | null>(null)
  const [completion, setCompletion] = useState<Extract<FixtureCompleteResponse, { status: "ready_for_routine" }> | null>(null)
  const searchToken = useRef(0)

  const currentRequirement = REQUIREMENTS[categoryIndex]
  const currentCategory = currentRequirement?.category ?? REQUIREMENTS[0].category
  const currentCopy = CATEGORY_COPY[currentCategory]
  const currentProducts = useMemo(
    () => draft?.products.filter((product) => product.identity.category === currentCategory) ?? [],
    [currentCategory, draft],
  )

  useEffect(() => {
    let active = true
    void gateway
      .loadOrCreate({
        draftId: "fixture-stage3-draft",
        userId: "fixture-user",
        personalPlanId: "fixture-personal-plan",
        refinedVersionId: "fixture-refined-version",
        requirements: REQUIREMENTS,
      })
      .then((response) => {
        if (!active) return
        setDraft(response.draft)
        setSaveLabel("Gespeichert")
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
    trackAppEvent("personal_plan_stage3_flow_viewed", {
      pass: "product_capture",
      stepKey: "capture_orientation",
    })
    return () => {
      active = false
    }
  }, [gateway])

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
          if (response.status === "ignored") return
          const results = response.result.candidates.map((candidate) => ({
            candidateId: candidate.candidateId,
            displayName: candidate.displayName,
            brandName: candidate.brandName ?? undefined,
            confidenceLabel: candidate.confidence === "exact" ? "Sicherer Treffer" : "Wahrscheinlicher Treffer",
          }))
          setSearchResults(results)
          setSearchStatus(results.length > 0 ? "ready" : "empty")
          setSearchMessage(results.length > 0 ? undefined : "Kein sicherer Treffer gefunden.")
          trackAppEvent("personal_plan_stage3_search_interacted", {
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
  }, [currentCategory, gateway, phase, query, searchDebounceMs])

  const activeDraft = draft

  const shell = (children: React.ReactNode, stepLabel: string, onBack?: () => void) => (
    <Stage3Shell
      title="Produkte"
      currentStepLabel={stepLabel}
      completedSteps={progressForPhase(phase, categoryIndex)}
      totalSteps={REQUIREMENTS.length + 3}
      saveState={{ status: systemIssue ? systemIssue.kind : "saved", label: systemIssue ? "Nicht gespeichert" : saveLabel }}
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

  if (phase === "capture_orientation") {
    return shell(
      <Stage3Transition
        context="product_capture"
        onContinue={() => {
          setPhase("capture")
          trackAppEvent("personal_plan_stage3_flow_viewed", { pass: "product_capture", stepKey: "product_search" })
        }}
      />,
      "Deine Produkte",
    )
  }

  if (phase === "capture") {
    if (showFallback) {
      return shell(
        <IntakeFallbackBoundary
          categoryLabel={currentCopy.label}
          status={fallbackPending ? "pending" : "idle"}
          message={fallbackPending ? "Produkt wird für die Prüfung gespeichert." : undefined}
          onOpen={() => void capturePendingProduct()}
          onCancel={() => setShowFallback(false)}
        />,
        currentCopy.label,
        () => setShowFallback(false),
      )
    }

    const captureScreen = (
      <ProductCaptureScreen
        categoryLabel={currentCopy.label}
        needSummary={currentCopy.need}
        query={query}
        searchStatus={searchStatus}
        searchResults={searchResults}
        capturedProducts={currentProducts.map((product) => ({
          capturedProductId: product.capturedProductId,
          displayName: product.identity.displayName,
          frequencyLabel: FREQUENCIES.find((option) => option.value === product.frequencyRange)?.label ?? product.frequencyRange,
          sourceLabel: product.source === "catalog_search" ? "Gefunden" : "Manuell hinzugefügt",
          statusLabel: product.identity.kind === "pending_submission" ? "Noch in Prüfung · gespeichert" : undefined,
        }))}
        frequencyOptions={FREQUENCIES}
        selectedFrequency={frequency}
        frequencyProductName={pendingCandidate?.displayName}
        showFrequency={pendingCandidate !== null}
        showAddAnotherProduct={currentProducts.length > 0}
        canContinue={currentProducts.length > 0}
        intakeAvailable
        searchMessage={searchMessage}
        onQueryChange={(value) => {
          setQuery(value)
          setPendingCandidate(null)
          setFrequency(null)
        }}
        onSelectCandidate={(candidateId) => selectCandidate(candidateId)}
        onFrequencyChange={(value) => {
          const selectedFrequency = value as ProductFrequency
          setFrequency(selectedFrequency)
          if (pendingCandidate) void captureCandidate(pendingCandidate.candidateId, selectedFrequency)
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
          setShowFallback(true)
          trackAppEvent("personal_plan_stage3_fallback_opened", { stepKey: "product_search" })
        }}
        onExplicitNone={currentProducts.length === 0 ? () => void markCurrentRoleGap() : undefined}
        onContinue={() => void continueCapture()}
        onBack={() => setPhase(categoryIndex === 0 ? "capture_orientation" : "capture")}
      />
    )

    return shell(
      <>
        {captureScreen}
        {searchStatus === "error" ? (
          <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => setQuery((value) => `${value} `)}>
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
        products={currentProducts.map((product) => ({ capturedProductId: product.capturedProductId, displayName: product.identity.displayName }))}
        roles={currentRequirement.requiredRoles.map((role) => ({ role, ...ROLE_COPY[role] }))}
        assignments={roleAssignments}
        errors={roleErrors}
        onToggleRole={toggleRole}
        onContinue={() => void saveRolesAndContinue()}
        onBack={() => setPhase("capture")}
      />,
      `${currentCopy.label} zuordnen`,
    )
  }

  if (phase === "fit_orientation") {
    return shell(
      <Stage3Transition
        context="fit_check"
        onBack={() => setPhase("capture")}
        onContinue={() => {
          setPhase("decisions")
          trackAppEvent("personal_plan_stage3_flow_viewed", { pass: "product_decisions", stepKey: "fit_decision" })
        }}
      />,
      "Passung prüfen",
    )
  }

  if (phase === "decisions") {
    const nextSubject = deriveStage3DecisionSubjects(draft).find(
      (subject) => !draft.decisions.some((decision) => decision.decisionKey === subject.decisionKey),
    )
    if (!nextSubject) {
      void completeFlow(draft)
      return shell(
        <Stage3SystemState state="loading" title="Deine Auswahl wird vorbereitet." message="Einen Moment bitte." />,
        "Abschluss",
      )
    }
    return shell(
      <ProductDecisionScreen
        decisions={[decisionProjection(draft, nextSubject)]}
        onChooseAction={(decisionKey, action) => void chooseDecision(decisionKey, action)}
        onBack={() => setPhase("fit_orientation")}
      />,
      CATEGORY_COPY[nextSubject.category].label,
    )
  }

  if (phase === "routine_ready") {
    return shell(
      <Stage3Transition context="routine_ready" onContinue={() => setPhase("handoff")} />,
      "Routine vorbereiten",
    )
  }

  return shell(
    completion ? <PortfolioHandoff completion={completion} /> : <Stage3SystemState state="loading" title="Routine wird vorbereitet." message="Einen Moment bitte." />,
    "Bereit für deine Routine",
  )

  function selectCandidate(candidateId: string) {
    const candidatePosition = searchResults.findIndex((candidate) => candidate.candidateId === candidateId)
    const candidate = searchResults[candidatePosition]
    if (!candidate) return
    setPendingCandidate(candidate)
    setFrequency(null)
    trackAppEvent("personal_plan_stage3_search_interacted", {
      interaction: "candidate_selected",
      resultCountBand: searchResults.length <= 3 ? "1_3" : "4_8",
      selectedCandidatePosition: Math.min(8, candidatePosition + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
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
    setFallbackPending(true)
    await saveMutation(
      {
        type: "capture_pending_submission",
        submissionId: `fixture-submission-${currentCategory}`,
        displayName: `${currentCopy.label} – manuell hinzugefügt`,
        category: currentCategory,
        reviewStatus: "pending_review",
        frequencyRange: frequency ?? "weekly_2x",
      },
      () => {
        setFallbackPending(false)
        setShowFallback(false)
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
        activeDraft.roleAssignments.find((assignment) => assignment.capturedProductId === product.capturedProductId)?.roles ?? [],
      ]),
    )
    setRoleAssignments(initialAssignments)
    setRoleErrors([])
    setPhase("roles")
    trackAppEvent("personal_plan_stage3_flow_viewed", { pass: "product_capture", stepKey: "role_assignment" })
  }

  function toggleRole(capturedProductId: string, role: string, checked: boolean) {
    setRoleAssignments((current) => {
      const next = { ...current }
      if (checked) {
        if (currentCategory !== "conditioner") {
          for (const productId of Object.keys(next)) next[productId] = (next[productId] ?? []).filter((candidate) => candidate !== role)
        }
        next[capturedProductId] = Array.from(new Set([...(next[capturedProductId] ?? []), role]))
      } else {
        next[capturedProductId] = (next[capturedProductId] ?? []).filter((candidate) => candidate !== role)
      }
      return next
    })
  }

  async function saveRolesAndContinue() {
    const covered = new Set(Object.values(roleAssignments).flat())
    const missing = currentRequirement.requiredRoles.filter((role) => !covered.has(role))
    if (missing.length > 0) {
      setRoleErrors(["Ordne jede benötigte Aufgabe einem Produkt zu."])
      return
    }

    let nextDraft = activeDraft
    try {
      for (const product of currentProducts) {
        const response = await gateway.mutate({
          draftId: nextDraft.draftId,
          expectedRevision: nextDraft.revision,
          mutation: {
            type: "assign_roles",
            capturedProductId: product.capturedProductId,
            category: currentCategory,
            roles: (roleAssignments[product.capturedProductId] ?? []) as Stage3SemanticRole[],
          },
        })
        if (response.status === "conflict") return handleConflict(response.latestDraft, saveRolesAndContinue)
        nextDraft = response.draft
      }
      const completed = await gateway.mutate({
        draftId: nextDraft.draftId,
        expectedRevision: nextDraft.revision,
        mutation: { type: "complete_capture_category", category: currentCategory },
      })
      if (completed.status === "conflict") return handleConflict(completed.latestDraft, saveRolesAndContinue)
      setDraft(completed.draft)
      setSaveLabel("Gespeichert")
      advanceCategoryOrFit()
    } catch (error) {
      handleMutationError(error, saveRolesAndContinue)
    }
  }

  async function markCurrentRoleGap() {
    let nextDraft = activeDraft
    try {
      for (const role of currentRequirement.requiredRoles) {
        const response = await gateway.mutate({
          draftId: nextDraft.draftId,
          expectedRevision: nextDraft.revision,
          mutation: { type: "mark_role_uncovered", uncoveredRole: { category: currentCategory, role, reason: "no_product_owned" } },
        })
        if (response.status === "conflict") return handleConflict(response.latestDraft, markCurrentRoleGap)
        nextDraft = response.draft
      }
      const completed = await gateway.mutate({
        draftId: nextDraft.draftId,
        expectedRevision: nextDraft.revision,
        mutation: { type: "complete_capture_category", category: currentCategory },
      })
      if (completed.status === "conflict") return handleConflict(completed.latestDraft, markCurrentRoleGap)
      setDraft(completed.draft)
      advanceCategoryOrFit()
    } catch (error) {
      handleMutationError(error, markCurrentRoleGap)
    }
  }

  function advanceCategoryOrFit() {
    setQuery("")
    setSearchResults([])
    setSearchStatus("idle")
    setPendingCandidate(null)
    setFrequency(null)
    setRoleAssignments({})
    if (categoryIndex < REQUIREMENTS.length - 1) {
      setCategoryIndex((index) => index + 1)
      setPhase("capture")
    } else {
      setPhase("fit_orientation")
    }
  }

  async function chooseDecision(decisionKey: string, action: Stage3DecisionAction) {
    const subject = deriveStage3DecisionSubjects(activeDraft).find((candidate) => candidate.decisionKey === decisionKey)
    if (!subject) return
    if (action.kind === "choose_other") {
      await saveMutation(
        { type: "reopen_capture_category", category: subject.category },
        () => {
          setCategoryIndex(REQUIREMENTS.findIndex((entry) => entry.category === subject.category))
          setQuery("")
          setSearchResults([])
          setSearchStatus("idle")
          setPhase("capture")
        },
      )
      return
    }
    const decision = makeDecision(subject, action)
    await saveMutation({ type: "record_decision", decision }, (nextDraft) => {
      trackAppEvent("personal_plan_stage3_decision_selected", {
        decisionType:
          action.kind === "pending"
            ? "pending_review"
            : action.kind === "skip"
              ? "uncovered"
              : action.kind === "choose_other"
                ? "uncovered"
                : action.kind,
        stepKey: "fit_decision",
      })
      const remaining = deriveStage3DecisionSubjects(nextDraft).some(
        (candidate) => !nextDraft.decisions.some((entry) => entry.decisionKey === candidate.decisionKey),
      )
      if (!remaining) void completeFlow(nextDraft)
    })
  }

  async function removeProduct(capturedProductId: string) {
    await saveMutation({ type: "remove_captured_product", capturedProductId })
  }

  async function completeFlow(sourceDraft: Stage3ProductDraft) {
    if (completion) return
    try {
      const response = await gateway.complete({ draftId: sourceDraft.draftId, expectedRevision: sourceDraft.revision })
      if (response.status === "conflict") return handleConflict(response.latestDraft, () => void completeFlow(response.latestDraft))
      if (response.status === "not_ready") {
        setSystemIssue({ kind: "error", title: "Deine Auswahl ist noch nicht vollständig.", message: "Prüfe die letzte Entscheidung.", retry: () => { setSystemIssue(null); setPhase("decisions") } })
        return
      }
      setDraft(response.draft)
      setCompletion(response)
      setPhase("routine_ready")
      const hasPending = response.portfolio.pendingProducts.length > 0
      const hasGap = response.portfolio.uncoveredRoles.length > 0
      trackAppEvent("personal_plan_stage3_handoff", { outcome: hasPending ? "ready_with_pending" : hasGap ? "ready_with_gap" : "ready_for_routine" })
    } catch (error) {
      handleMutationError(error, () => void completeFlow(sourceDraft))
    }
  }

  async function saveMutation(
    mutation: FixtureMutation,
    afterSave?: (nextDraft: Stage3ProductDraft) => void,
  ) {
    setSaveLabel("Wird gespeichert")
    try {
      const response = await gateway.mutate({ draftId: activeDraft.draftId, expectedRevision: activeDraft.revision, mutation })
      if (response.status === "conflict") return handleConflict(response.latestDraft, () => void saveMutation(mutation, afterSave))
      setDraft(response.draft)
      setSaveLabel("Gespeichert")
      trackAppEvent("personal_plan_stage3_save_outcome", { outcome: "saved" })
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
      retry: () => { setSystemIssue(null); trackAppEvent("personal_plan_stage3_save_outcome", { outcome: "conflict" }); retry() },
    })
  }

  function handleMutationError(error: unknown, retry: () => void) {
    const message = error instanceof FixtureGatewaySimulatedError ? "Die Testverbindung wurde kurz unterbrochen. Es wurde nichts verändert." : "Die Auswahl konnte nicht gespeichert werden."
    setSystemIssue({
      kind: "error",
      title: "Speichern fehlgeschlagen.",
      message,
      retry: () => { setSystemIssue(null); trackAppEvent("personal_plan_stage3_save_outcome", { outcome: "retry" }); retry() },
    })
  }
}

function requirement(category: PersonalPlanCategory, needSummary: string): Stage3CategoryRequirement {
  const authority = CATEGORY_AUTHORITY_STUBS[category]
  return {
    category,
    requiredRoles: [...authority.requiredRoles],
    needSummary,
    authorityVersion: authority.authorityVersion,
  }
}

function progressForPhase(phase: FlowPhase, categoryIndex: number) {
  if (phase === "capture_orientation") return 0
  if (phase === "capture" || phase === "roles") return categoryIndex + 1
  if (phase === "fit_orientation" || phase === "decisions") return REQUIREMENTS.length + 1
  if (phase === "routine_ready") return REQUIREMENTS.length + 2
  return REQUIREMENTS.length + 3
}

function decisionProjection(
  draft: Stage3ProductDraft,
  subject: ReturnType<typeof deriveStage3DecisionSubjects>[number],
): Stage3ProductDecisionProjection {
  const product = subject.capturedProductId
    ? draft.products.find((candidate) => candidate.capturedProductId === subject.capturedProductId)
    : undefined
  const conditionerIndex = draft.products
    .filter((candidate) => candidate.identity.category === "conditioner")
    .findIndex((candidate) => candidate.capturedProductId === subject.capturedProductId)
  const mismatch = subject.category === "conditioner" && conditionerIndex === 1
  const pending = product?.identity.kind === "pending_submission"

  if (!product) {
    return {
      kind: "gap",
      decisionKey: subject.decisionKey,
      categoryLabel: CATEGORY_COPY[subject.category].label,
      needSummary: CATEGORY_COPY[subject.category].need,
      verdictLabel: "Offene Lücke",
      rationale: "Du nutzt dafür aktuell kein Produkt. Die Lücke bleibt im Plan sichtbar.",
      actions: [{ kind: "skip", label: "Lücke im Plan markieren" }],
    }
  }

  if (pending) {
    return {
      kind: "pending",
      decisionKey: subject.decisionKey,
      categoryLabel: CATEGORY_COPY[subject.category].label,
      needSummary: CATEGORY_COPY[subject.category].need,
      verdictLabel: "Noch in Prüfung",
      rationale: "Wir bewerten dieses Produkt erst, wenn die Identität sicher bestätigt ist.",
      ownedProductName: product.identity.displayName,
      actions: [{ kind: "pending", label: "Prüfung später fortsetzen", productName: product.identity.displayName }],
    }
  }

  if (mismatch) {
    return {
      kind: "mismatch",
      decisionKey: subject.decisionKey,
      categoryLabel: CATEGORY_COPY[subject.category].label,
      needSummary: CATEGORY_COPY[subject.category].need,
      verdictLabel: "Wechseln empfohlen",
      rationale: "Eine leichtere Pflege passt in diesem Beispiel besser zu deinem Bedarf.",
      ownedProductName: product.identity.displayName,
      criteria: [
        { label: "Pflegewirkung", result: "Zu schwer", tone: "negative", explanation: "Damit die Längen gepflegt bleiben, ohne beschwert zu wirken." },
        { label: "Alltagstauglichkeit", result: "Nur bedingt", tone: "warning", explanation: "Das Produkt sollte zu deiner regelmäßigen Wäsche passen." },
        { label: "Bedarf", result: "Alternative passt besser", tone: "positive", explanation: "Die Empfehlung deckt den konkreten Pflegebedarf ab." },
      ],
      recommendation: { productName: "Leichter Pflege-Conditioner", priceLabel: "ca. 18 €", availabilityLabel: "Verfügbar", sellerLabel: "Beispielhändler" },
      actions: [
        { kind: "plan_purchase", label: "Leichter Pflege-Conditioner einplanen", productName: "Leichter Pflege-Conditioner" },
        { kind: "override", label: `${product.identity.displayName} behalten`, productName: product.identity.displayName },
        { kind: "choose_other", label: "Anderes Produkt wählen" },
      ],
    }
  }

  return {
    kind: "fit",
    decisionKey: subject.decisionKey,
    categoryLabel: CATEGORY_COPY[subject.category].label,
    needSummary: CATEGORY_COPY[subject.category].need,
    verdictLabel: "Passt sehr gut",
    rationale: "Deine Wahl erfüllt den vorgesehenen Bedarf. Das ist ein guter Baustein für deine Routine.",
    ownedProductName: product.identity.displayName,
    criteria: [{ label: "Dein Bedarf", result: "Erfüllt", tone: "positive" }],
    actions: [{ kind: "keep", label: `${product.identity.displayName} weiterverwenden`, productName: product.identity.displayName }],
  }
}

function makeDecision(
  subject: ReturnType<typeof deriveStage3DecisionSubjects>[number],
  action: Stage3DecisionAction,
): Stage3ProductDecision {
  const recommendation = action.kind === "plan_purchase"
    ? {
        recommendationId: `fixture-recommendation-${subject.category}-${subject.role}`,
        category: subject.category,
        role: subject.role,
        displayName: "Leichter Pflege-Conditioner",
        reason: "Passt im Fixture besser zum Bedarf.",
        authorityRuleId: "fixture-authority-rule",
      }
    : null

  return {
    decisionKey: subject.decisionKey,
    category: subject.category,
    role: subject.role,
    capturedProductId: subject.capturedProductId,
    verdict: action.kind === "plan_purchase" || action.kind === "override" ? "mismatch" : action.kind === "keep" ? "ideal" : "unknown",
    choiceState: action.kind === "keep" ? "owned_active" : action.kind === "override" ? "owned_override" : action.kind === "plan_purchase" ? "planned_purchase" : action.kind === "pending" ? "pending_review" : "unassigned",
    criterionResults: action.kind === "keep"
      ? [{ criterionId: "fixture-fit", label: "Bedarf", result: "pass", explanation: "Der Bedarf wird im Fixture erfüllt." }]
      : [],
    recommendation,
    limitationAcknowledged: action.kind === "override",
  }
}

export function PortfolioHandoff({
  completion,
}: {
  completion: Extract<FixtureCompleteResponse, { status: "ready_for_routine" }>
}) {
  const portfolio: ProposedProductPortfolio = completion.portfolio
  return (
    <section className="pt-6">
      <p className="mb-3 text-sm font-semibold text-[var(--brand-plum)]">Bereit für deine Routine</p>
      <h1 className="font-header text-3xl leading-tight text-foreground">Deine Produkte sind vorbereitet.</h1>
      <p className="mt-3 text-sm text-[var(--text-sub)]">Offene Punkte bleiben sichtbar, bis du sie später bestätigst.</p>
      <dl className="mt-6 grid gap-2 rounded-xl border border-border bg-card p-4 text-sm">
        <SummaryRow label="Aktive Produkte" value={portfolio.ownedProducts.length} />
        <SummaryRow label="Geplante Käufe" value={portfolio.plannedPurchases.length} />
        <SummaryRow label="In Prüfung" value={portfolio.pendingProducts.length} />
        <SummaryRow label="Offene Lücken" value={portfolio.uncoveredRoles.length} />
      </dl>
      <p className="mt-5 text-xs text-muted-foreground">Portfolio {completion.productPortfolioVersionId}</p>
      <p className="mt-1 text-xs text-muted-foreground">Routine-Entwurf {completion.routineProposalId}</p>
    </section>
  )
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[var(--text-sub)]">{label}</dt>
      <dd className="font-semibold text-foreground">{value}</dd>
    </div>
  )
}
