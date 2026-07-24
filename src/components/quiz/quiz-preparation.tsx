"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { HairPortraitArtwork } from "@/components/quiz/hair-portrait"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { buildQuizResultPath } from "@/lib/quiz/result-navigation"
import { useQuizStore } from "@/lib/quiz/store"
import type { LeadCaptureSubStep } from "@/lib/quiz/types"
import { isSubscriptionActive } from "@/lib/stripe/gating"
import { useAuth } from "@/providers/auth-provider"

import { QuizAnalysis } from "./quiz-analysis"

interface PreparationAccessState {
  authLoading: boolean
  checkedAccessKey: string | null
  leadId: string | null
  profileHasAccess: boolean
  userId: string | null
}

export const PREPARATION_ACCESS_TIMEOUT_MS = 5_000

export function schedulePreparationAccessCheck({
  fetchAccess,
  onSettled,
  timeoutMs = PREPARATION_ACCESS_TIMEOUT_MS,
}: {
  fetchAccess: (signal: AbortSignal) => Promise<unknown>
  onSettled: () => void
  timeoutMs?: number
}) {
  const controller = new AbortController()
  let cancelled = false
  let settled = false

  const finish = () => {
    if (cancelled || settled) return
    settled = true
    clearTimeout(timeout)
    onSettled()
  }
  const timeout = setTimeout(() => {
    controller.abort()
    finish()
  }, timeoutMs)

  try {
    void fetchAccess(controller.signal)
      .catch(() => {})
      .finally(finish)
  } catch {
    finish()
  }

  return () => {
    cancelled = true
    clearTimeout(timeout)
    controller.abort()
  }
}

export function getPreparationAccessCheckKey({
  authLoading,
  leadId,
  profileHasAccess,
  userId,
}: Omit<PreparationAccessState, "checkedAccessKey">): string | null {
  if (!leadId || authLoading || !userId || profileHasAccess) return null
  return `${userId}:${leadId}`
}

export function isPreparationReady(state: PreparationAccessState): boolean {
  if (!state.leadId || state.authLoading) return false

  const accessCheckKey = getPreparationAccessCheckKey(state)
  return accessCheckKey === null || accessCheckKey === state.checkedAccessKey
}

export function shouldTriggerPreparationResultArtifact({
  accessSettled,
  leadId,
  previouslyTriggeredLeadId,
}: {
  accessSettled: boolean
  leadId: string | null
  previouslyTriggeredLeadId: string | null
}): boolean {
  return Boolean(leadId && accessSettled && leadId !== previouslyTriggeredLeadId)
}

export function getPreparationRecoverySubStep(name: string): LeadCaptureSubStep {
  return name.trim() ? "email" : "name"
}

export function getPreparationResultPath({
  leadId,
  mode,
  returnTo,
}: {
  leadId: string | null
  mode: string | null
  returnTo: string | null
}): string | null {
  if (!leadId) return null
  return buildQuizResultPath({ leadId, mode, returnTo })
}

export function QuizPreparation() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, profile, loading: authLoading } = useAuth()
  const { answers, lead, leadId, setLeadCaptureSubStep, setStep } = useQuizStore()
  const [checkedAccessKey, setCheckedAccessKey] = useState<string | null>(null)
  const quizCompletedLeadRef = useRef<string | null>(null)
  const resultArtifactLeadRef = useRef<string | null>(null)
  const prefetchedResultPathRef = useRef<string | null>(null)
  const profileHasAccess = isSubscriptionActive(profile)
  const accessCheckKey = getPreparationAccessCheckKey({
    authLoading,
    leadId,
    profileHasAccess,
    userId: user?.id ?? null,
  })
  const accessSettled = isPreparationReady({
    authLoading,
    checkedAccessKey,
    leadId,
    profileHasAccess,
    userId: user?.id ?? null,
  })
  const resultPath = useMemo(
    () =>
      getPreparationResultPath({
        leadId,
        mode: searchParams.get("mode"),
        returnTo: searchParams.get("returnTo"),
      }),
    [leadId, searchParams],
  )

  useEffect(() => {
    if (!leadId || quizCompletedLeadRef.current === leadId) return

    quizCompletedLeadRef.current = leadId
    trackAppEvent("quiz_completed", {
      thickness: answers.thickness,
      hairLength: answers.hair_length,
      hairTexture: answers.structure,
      leadId,
      scalpCondition: answers.scalp_condition,
      scalpType: answers.scalp_type,
    })
  }, [
    answers.hair_length,
    answers.scalp_condition,
    answers.scalp_type,
    answers.structure,
    answers.thickness,
    leadId,
  ])

  useEffect(() => {
    if (!accessCheckKey) return

    return schedulePreparationAccessCheck({
      fetchAccess: (signal) =>
        fetch("/api/billing/access", {
          headers: { Accept: "application/json" },
          signal,
        }),
      onSettled: () => setCheckedAccessKey(accessCheckKey),
    })
  }, [accessCheckKey])

  useEffect(() => {
    if (
      !shouldTriggerPreparationResultArtifact({
        accessSettled,
        leadId,
        previouslyTriggeredLeadId: resultArtifactLeadRef.current,
      })
    ) {
      return
    }

    resultArtifactLeadRef.current = leadId
    void fetch("/api/quiz/result-artifact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
      keepalive: true,
    }).catch(() => {})
  }, [accessSettled, leadId])

  useEffect(() => {
    if (!resultPath || prefetchedResultPathRef.current === resultPath) return

    prefetchedResultPathRef.current = resultPath
    router.prefetch(resultPath)
  }, [resultPath, router])

  if (!leadId) {
    return (
      <div className="mx-auto flex min-h-[420px] w-full max-w-[520px] flex-col items-center justify-center px-2 text-center">
        <p className="font-header text-[28px] leading-tight text-[var(--brand-plum-darkest)]">
          Lass uns deine Angaben kurz vervollständigen.
        </p>
        <p className="mt-3 max-w-[36ch] text-[15px] leading-relaxed text-muted-foreground">
          Deine Antworten sind gespeichert. Ergänze bitte noch deine Kontaktdaten, damit wir deine
          Haaranalyse öffnen können.
        </p>
        <button
          className="quiz-btn-primary mt-7 min-h-14 w-full max-w-sm rounded-xl px-5 py-3 text-base font-bold"
          onClick={() => {
            setLeadCaptureSubStep(getPreparationRecoverySubStep(lead.name))
            setStep(9)
          }}
          type="button"
        >
          Angaben vervollständigen
        </button>
      </div>
    )
  }

  return (
    <QuizAnalysis
      name={lead.name}
      onReveal={() => {
        if (resultPath) router.push(resultPath)
      }}
      portrait={<HairPortraitArtwork className="w-[170px]" rawAnswers={answers} />}
      ready={Boolean(resultPath && accessSettled)}
    />
  )
}
