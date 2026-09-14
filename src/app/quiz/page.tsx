"use client"

import { useEffect, useRef, useState } from "react"
import { notFound } from "next/navigation"
import { useQuizStore } from "@/lib/quiz/store"
import { loadQuizDraft } from "@/lib/quiz/draft"
import { consumeModeratorOrganicFreshStart } from "@/lib/quiz/moderator-fresh-start"
import { getQuestionByStep } from "@/lib/quiz/questions"
import { QuizQuestion } from "@/components/quiz/quiz-question"
import { QuizScalpQuestion } from "@/components/quiz/quiz-scalp-question"
import { QuizConcernsQuestion } from "@/components/quiz/quiz-concerns-question"
import { QuizLeadCapture } from "@/components/quiz/quiz-lead-capture"
import { QuizPreparation } from "@/components/quiz/quiz-preparation"
import { QuizResults } from "@/components/quiz/quiz-results"
import { QuizGoals } from "@/components/quiz/quiz-goals"
import { QuizWelcome } from "@/components/quiz/quiz-welcome"
import { ScanInsertHome } from "@/components/quiz/scan-inserts/scan-insert-home"
import { ScanInsertProblem } from "@/components/quiz/scan-inserts/scan-insert-problem"
import { ScanInsertSolution } from "@/components/quiz/scan-inserts/scan-insert-solution"
import { Button } from "@/components/ui/button"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import {
  getLegacyQuizScreenPosition,
  seedLegacyQuizBrowserHistoryToDepth,
} from "@/lib/quiz/browser-history"
import {
  getQuizProgressStep,
  normalizeQuizStepForPackage,
  shouldTrackQuizStepViewed,
} from "@/lib/quiz/screen-order"
import {
  deriveMigrationQuizPrefillState,
  fallbackMigrationQuizContextPayload,
  isMigrationQuizRecoverySearch,
  MIGRATION_LEAD_CAPTURE_NEXT_HREF,
  MIGRATION_QUIZ_CONTEXT_ENDPOINT,
  parseMigrationQuizContextPayload,
  type MigrationQuizContextPayload,
} from "@/lib/quiz/migration-prefill-init"

const STEP_NAMES: Record<number, string> = {
  2: "hair_texture",
  3: "hair_thickness",
  13: "hair_density",
  15: "hair_length",
  4: "surface_test",
  5: "pull_test",
  6: "scalp",
  7: "chemical_treatment",
  8: "concerns",
  9: "lead_capture",
  10: "analysis",
  11: "results",
  12: "goals",
  14: "auth_transition",
  16: "scan_insert_problem",
  17: "scan_insert_solution",
  18: "scan_insert_home",
}

export default function QuizPage() {
  const step = useQuizStore((s) => s.step)
  const funnelPackageKey = useQuizStore((s) => s.funnelPackageKey)
  const restoreDraft = useQuizStore((s) => s.restoreDraft)
  const [draftStatus, setDraftStatus] = useState<"checking" | "ready" | "unavailable">("checking")
  const [migrationRecoveryAttempt, setMigrationRecoveryAttempt] = useState(0)
  const quizStartedRef = useRef(false)
  const lastTrackedStepRef = useRef<number | null>(null)

  useEffect(() => {
    let active = true
    const updateDraftStatus = (status: "checking" | "ready" | "unavailable") => {
      if (active) setDraftStatus(status)
    }
    const timer = window.setTimeout(() => {
      void initializeQuiz(updateDraftStatus)
    }, 0)

    async function initializeQuiz(
      setSafeDraftStatus: (status: "checking" | "ready" | "unavailable") => void,
    ) {
      // Only the server-issued recovery destination can initialize migration
      // answers. An ordinary quiz must not wait on this lookup or reuse a stale
      // migration cookie left by an interrupted recovery.
      const migrationRecoveryIntent = isMigrationQuizRecoverySearch(window.location.search)
      if (migrationRecoveryIntent) {
        const migrationPayload = await fetchMigrationQuizContextPayload(true)
        if (!active) return
        const latestState = useQuizStore.getState()
        const migrationState = deriveMigrationQuizPrefillState({
          currentStep: latestState.step,
          currentAnswers: latestState.answers,
          payload: migrationPayload,
          funnelPackageKey: latestState.funnelPackageKey,
        })
        if (migrationState.status === "recover") {
          window.location.assign(MIGRATION_LEAD_CAPTURE_NEXT_HREF)
          return
        }
        if (migrationState.status === "unavailable") {
          setSafeDraftStatus("unavailable")
          return
        }
        if (migrationState.status === "prefill") {
          const restoredPosition = getLegacyQuizScreenPosition(
            migrationState.step,
            "name",
            "regular",
            latestState.funnelPackageKey,
          )
          seedLegacyQuizBrowserHistoryToDepth(Math.max(0, restoredPosition - 1))
          useQuizStore.setState({
            step: migrationState.step,
            answers: migrationState.answers,
            leadCaptureSubStep: "name",
            lead: { name: "", email: "", marketingConsent: false },
            leadId: null,
          })
        }
        setSafeDraftStatus("ready")
        return
      }

      const state = useQuizStore.getState()
      if (state.step !== 2 || Object.keys(state.answers).length > 0) {
        setSafeDraftStatus("ready")
        return
      }

      const freshModeratorStart = consumeModeratorOrganicFreshStart()
      const draft = freshModeratorStart ? null : loadQuizDraft()
      if (draft) {
        // A draft can hold a screen the running funnel package does not have
        // (a scan insert restored without attribution). `restoreDraft` resumes
        // on the normalized screen, so history has to be seeded for that one.
        const restoredStep = normalizeQuizStepForPackage(draft.step, state.funnelPackageKey)
        const restoredPosition = getLegacyQuizScreenPosition(
          restoredStep,
          "name",
          "regular",
          state.funnelPackageKey,
        )
        // The store transition below adds the final entry. Seed the earlier
        // screens first so browser/system Back maps to one quiz screen at a time.
        seedLegacyQuizBrowserHistoryToDepth(Math.max(0, restoredPosition - 1))
        restoreDraft()
      }
      setSafeDraftStatus("ready")
    }

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [restoreDraft, migrationRecoveryAttempt])

  function retryMigrationRecoveryCheck() {
    setDraftStatus("checking")
    setMigrationRecoveryAttempt((attempt) => attempt + 1)
  }

  useEffect(() => {
    if (draftStatus !== "ready") return
    if (lastTrackedStepRef.current === step) return
    lastTrackedStepRef.current = step

    const stepName = STEP_NAMES[step] || `step_${step}`

    if (!quizStartedRef.current) {
      quizStartedRef.current = true
      // A funnel insert is no question. Should a session open on one (a restored
      // draft), the start event reports the question the insert sits behind, so
      // the funnel's first step stays comparable across packages.
      const startStep = getQuizProgressStep(step, funnelPackageKey)
      trackAppEvent("quiz_started", {
        stepName: STEP_NAMES[startStep] || `step_${startStep}`,
        stepNumber: startStep,
      })
    }

    // Funnel inserts are not quiz questions and must not enter the per-step
    // funnel event that routes to Customer.io; they report their own event.
    if (shouldTrackQuizStepViewed(step)) {
      trackAppEvent("quiz_step_viewed", {
        stepName,
        stepNumber: step, // deprecated: use stepName after Phase 4 resequencing
      })
    }
  }, [draftStatus, funnelPackageKey, step])

  if (draftStatus === "checking") {
    return null
  }
  if (draftStatus === "unavailable") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mx-auto max-w-xl rounded-2xl border border-border bg-background p-5 shadow-sm"
      >
        <p className="mb-4 text-base text-muted-foreground">
          Deine Angaben konnten gerade nicht geladen werden.
        </p>
        <Button type="button" onClick={retryMigrationRecoveryCheck}>
          Erneut versuchen
        </Button>
      </div>
    )
  }

  // Step 6: custom scalp progressive disclosure
  if (step === 6) return <QuizScalpQuestion />
  if (step === 8) return <QuizConcernsQuestion />

  // Standard quiz question cards
  const question = getQuestionByStep(step)
  if (question) return <QuizQuestion key={question.step} question={question} />

  switch (step) {
    case 9:
      return <QuizLeadCapture />
    case 10:
      return <QuizPreparation />
    case 11:
      // Legacy compatibility only. New completions navigate from step 10
      // directly to the canonical result route.
      return <QuizResults />
    case 12:
      return <QuizGoals />
    case 14:
      return <QuizWelcome />
    case 16:
      return <ScanInsertProblem />
    case 17:
      return <ScanInsertSolution />
    case 18:
      return <ScanInsertHome />
    default:
      // Unknown step — shouldn't happen with a healthy store. Surface a 404
      // rather than silently rendering a placeholder (would hide bugs).
      notFound()
  }
}

async function fetchMigrationQuizContextPayload(
  migrationRecoveryIntent: boolean,
): Promise<MigrationQuizContextPayload> {
  try {
    const response = await fetch(MIGRATION_QUIZ_CONTEXT_ENDPOINT, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    if (!response.ok) return fallbackMigrationQuizContextPayload(migrationRecoveryIntent)
    return parseMigrationQuizContextPayload(await response.json().catch(() => null))
  } catch {
    return fallbackMigrationQuizContextPayload(migrationRecoveryIntent)
  }
}
