"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { buildQuizResultNarrative } from "@/lib/quiz/result-narrative"
import { QUIZ_RESULT_CTA } from "@/lib/quiz/result-cta"
import { useQuizStore } from "@/lib/quiz/store"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { isSubscriptionActive } from "@/lib/stripe/gating"
import { useAuth } from "@/providers/auth-provider"
import { QuizResultsView } from "./quiz-results-view"

interface ResultArtifactEmailTriggerState {
  leadId: string | null
  isCheckingAccess: boolean
  previouslyTriggeredLeadId: string | null
  canGoStraightToRoutine: boolean
}

export function shouldTriggerResultArtifactEmail({
  leadId,
  isCheckingAccess,
  previouslyTriggeredLeadId,
}: ResultArtifactEmailTriggerState): boolean {
  if (!leadId) return false
  if (isCheckingAccess) return false
  if (previouslyTriggeredLeadId === leadId) return false

  return true
}

interface QuizResultRedirectState {
  leadId: string | null
  authLoading: boolean
  isCheckingSignedInSubscription: boolean
  canGoStraightToRoutine: boolean
}

export function getQuizResultRedirectPath({
  leadId,
  authLoading,
  isCheckingSignedInSubscription,
  canGoStraightToRoutine,
}: QuizResultRedirectState): string | null {
  if (!leadId) return null
  if (authLoading || isCheckingSignedInSubscription) return null
  if (canGoStraightToRoutine) return null

  return `/result/${encodeURIComponent(leadId)}?entry=quiz_completion`
}

function LegacyQuizResultLoading({ name }: { name: string }) {
  const normalizedName = name.trim()

  return (
    <div
      aria-live="polite"
      className="mx-auto flex min-h-[420px] w-full max-w-[520px] flex-col items-center justify-center px-5 text-center"
      role="status"
    >
      <Loader2
        aria-hidden="true"
        className="h-7 w-7 animate-spin text-[var(--brand-plum)] motion-reduce:animate-none"
      />
      <p className="mt-4 font-header text-[26px] text-[var(--brand-plum-darkest)]">
        {normalizedName
          ? `${normalizedName}, deine Haaranalyse wird geöffnet.`
          : "Deine Haaranalyse wird geöffnet."}
      </p>
    </div>
  )
}

export function QuizResults() {
  // Legacy-only compatibility for an explicitly restored step 11. The normal
  // completion flow stays on step 10 and navigates directly to /result/[leadId].
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const { lead, answers, leadId, goNext } = useQuizStore()
  const [serverAccessCheck, setServerAccessCheck] = useState<{
    key: string
    hasAccess: boolean
  } | null>(null)
  const checkoutAnalyticsCapturedRef = useRef(false)
  const resultArtifactEmailLeadRef = useRef<string | null>(null)
  const resultRedirectRef = useRef<string | null>(null)
  const narrative = buildQuizResultNarrative(answers)
  const profileHasAccess = isSubscriptionActive(profile)
  const serverAccessKey =
    user && leadId && !loading && !profileHasAccess ? `${user.id}:${leadId}` : null
  const serverHasAccess = Boolean(
    serverAccessKey && serverAccessCheck?.key === serverAccessKey && serverAccessCheck.hasAccess,
  )
  const isCheckingServerAccess = Boolean(
    serverAccessKey && serverAccessCheck?.key !== serverAccessKey,
  )
  const canGoStraightToRoutine = Boolean(user && leadId && (profileHasAccess || serverHasAccess))
  const isCheckingSignedInSubscription = Boolean(
    user && leadId && (loading || isCheckingServerAccess),
  )
  const resultRedirectPath = getQuizResultRedirectPath({
    leadId,
    authLoading: loading,
    isCheckingSignedInSubscription,
    canGoStraightToRoutine,
  })
  const cta = QUIZ_RESULT_CTA

  const captureQuizCompleted = useCallback(() => {
    if (checkoutAnalyticsCapturedRef.current) return
    checkoutAnalyticsCapturedRef.current = true

    trackAppEvent("quiz_completed", {
      thickness: answers.thickness,
      hairLength: answers.hair_length,
      hairTexture: answers.structure,
      leadId: leadId ?? undefined,
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
    captureQuizCompleted()
  }, [captureQuizCompleted])

  useEffect(() => {
    if (!serverAccessKey) return

    let cancelled = false

    void fetch("/api/billing/access", {
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) return { hasAccess: false }
        return (await response.json()) as { hasAccess?: unknown }
      })
      .then((body) => {
        if (!cancelled) {
          setServerAccessCheck({
            key: serverAccessKey,
            hasAccess: body.hasAccess === true,
          })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setServerAccessCheck({
            key: serverAccessKey,
            hasAccess: false,
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [serverAccessKey])

  useEffect(() => {
    if (
      !shouldTriggerResultArtifactEmail({
        leadId,
        isCheckingAccess: loading || isCheckingSignedInSubscription,
        previouslyTriggeredLeadId: resultArtifactEmailLeadRef.current,
        canGoStraightToRoutine,
      })
    ) {
      return
    }

    resultArtifactEmailLeadRef.current = leadId
    void fetch("/api/quiz/result-artifact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
      keepalive: true,
    }).catch(() => {})
  }, [canGoStraightToRoutine, isCheckingSignedInSubscription, leadId, loading])

  useEffect(() => {
    if (!resultRedirectPath || resultRedirectRef.current === resultRedirectPath) return

    resultRedirectRef.current = resultRedirectPath
    router.replace(resultRedirectPath)
  }, [resultRedirectPath, router])

  const handleStart = () => {
    captureQuizCompleted()

    if (user && leadId) {
      // The step-11 compatibility surface, only reachable once
      // `canGoStraightToRoutine` holds — i.e. a PAID cohort. It used to push
      // the retired onboarding route; `/routine` is the frontier-agnostic
      // destination, since the middleware's frontier redirect lands each paid
      // cohort on the surface they have actually reached (ruling 27.08.2026).
      router.push("/routine")
      return
    }

    goNext()
  }

  if (!canGoStraightToRoutine) {
    if (loading || isCheckingSignedInSubscription) {
      return <LegacyQuizResultLoading name={lead.name} />
    }

    if (!leadId) {
      return (
        <div className="mx-auto flex min-h-[420px] w-full max-w-[520px] flex-col items-center justify-center px-5 text-center">
          <p className="font-header text-[24px] font-medium text-[var(--brand-plum-darkest)]">
            Dein Ergebnis konnte nicht geöffnet werden
          </p>
          <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
            Lade die Seite bitte neu und versuche es noch einmal.
          </p>
          <button
            className="mt-6 min-h-[48px] rounded-[12px] bg-[var(--brand-coral)] px-6 py-3 text-[13px] font-bold text-white"
            onClick={() => window.location.reload()}
            type="button"
          >
            Ergebnis neu laden
          </button>
        </div>
      )
    }

    return <LegacyQuizResultLoading name={lead.name} />
  }

  return (
    <QuizResultsView
      name={lead.name}
      narrative={{ ...narrative, cta }}
      primaryAction={{ label: cta.label, onClick: handleStart }}
      secondaryAction={null}
    />
  )
}
