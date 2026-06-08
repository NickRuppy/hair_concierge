"use client"

import { useCallback, useEffect, useRef } from "react"
import { buildQuizResultNarrative } from "@/lib/quiz/result-narrative"
import { useQuizStore } from "@/lib/quiz/store"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { QuizResultOfferPage } from "./quiz-result-offer-page"

interface ResultArtifactEmailTriggerState {
  leadId: string | null
  previouslyTriggeredLeadId: string | null
}

const RESULT_ARTIFACT_EMAIL_MAX_ATTEMPTS = 3

export function shouldTriggerResultArtifactEmail({
  leadId,
  previouslyTriggeredLeadId,
}: ResultArtifactEmailTriggerState): boolean {
  if (!leadId) return false
  if (previouslyTriggeredLeadId === leadId) return false

  return true
}

export function QuizResults() {
  const { lead, answers, leadId } = useQuizStore()
  const checkoutAnalyticsCapturedRef = useRef(false)
  const resultArtifactEmailLeadRef = useRef<string | null>(null)
  const narrative = buildQuizResultNarrative(answers)

  const captureQuizCompleted = useCallback(() => {
    if (checkoutAnalyticsCapturedRef.current) return
    checkoutAnalyticsCapturedRef.current = true

    trackAppEvent("quiz_completed", {
      thickness: answers.thickness,
      hairTexture: answers.structure,
      leadId: leadId ?? undefined,
      scalpCondition: answers.scalp_condition,
      scalpType: answers.scalp_type,
    })
  }, [answers.scalp_condition, answers.scalp_type, answers.structure, answers.thickness, leadId])

  useEffect(() => {
    captureQuizCompleted()
  }, [captureQuizCompleted])

  useEffect(() => {
    if (!leadId) return
    if (
      !shouldTriggerResultArtifactEmail({
        leadId,
        previouslyTriggeredLeadId: resultArtifactEmailLeadRef.current,
      })
    ) {
      return
    }

    let cancelled = false
    let timeoutId: number | null = null
    let attempt = 0

    function triggerResultArtifactEmail() {
      attempt += 1

      void fetch("/api/quiz/result-artifact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
        keepalive: true,
      })
        .then((response) => {
          if (cancelled) return
          if (!response.ok) throw new Error("result artifact trigger failed")
          resultArtifactEmailLeadRef.current = leadId
        })
        .catch(() => {
          if (cancelled || attempt >= RESULT_ARTIFACT_EMAIL_MAX_ATTEMPTS) return

          timeoutId = window.setTimeout(triggerResultArtifactEmail, attempt * 1000)
        })
    }

    triggerResultArtifactEmail()

    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [leadId])

  return (
    <QuizResultOfferPage
      name={lead.name}
      narrative={narrative}
      leadId={leadId}
      onCheckoutOpen={captureQuizCompleted}
    />
  )
}
