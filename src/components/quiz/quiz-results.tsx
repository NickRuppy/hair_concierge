"use client"

import { useCallback, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { buildQuizResultNarrative } from "@/lib/quiz/result-narrative"
import { getQuizResultCta } from "@/lib/quiz/result-cta"
import { buildQuizShareConfig } from "@/lib/quiz/share"
import { useQuizStore } from "@/lib/quiz/store"
import { trackCustomerIoEvent } from "@/lib/customerio-tracking"
import { trackMetaQuizCompleted } from "@/lib/meta-pixel"
import { isSubscriptionActive } from "@/lib/stripe/gating"
import { useAuth } from "@/providers/auth-provider"
import { posthog } from "@/providers/posthog-provider"
import { useToast } from "@/providers/toast-provider"
import { QuizResultOfferPage } from "./quiz-result-offer-page"
import { QuizResultsView } from "./quiz-results-view"

function getSafeReturnToPath(value: string | null): string | null {
  if (!value) return null

  const trimmed = value.trim()

  if (!trimmed.startsWith("/")) return null
  if (trimmed.startsWith("//")) return null
  if (trimmed.includes("\\")) return null
  if (/\s/.test(trimmed)) return null
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return null

  return trimmed
}

export function QuizResults() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, profile, loading } = useAuth()
  const { toast } = useToast()
  const { lead, answers, leadId, shareQuote, goNext } = useQuizStore()
  const checkoutAnalyticsCapturedRef = useRef(false)
  const narrative = buildQuizResultNarrative(answers)
  const returnTo = searchParams.get("returnTo")
  const isRetakeMode = searchParams.get("mode") === "retake"
  const canGoStraightToRoutine = Boolean(user && leadId && isSubscriptionActive(profile))
  const isCheckingSignedInSubscription = Boolean(user && leadId && (loading || profile === null))
  const cta = getQuizResultCta({ canGoStraightToRoutine })

  const captureQuizCompleted = useCallback(() => {
    if (checkoutAnalyticsCapturedRef.current) return
    checkoutAnalyticsCapturedRef.current = true

    posthog.capture("quiz_completed", {
      structure: answers.structure,
      thickness: answers.thickness,
      scalp_type: answers.scalp_type,
      scalp_condition: answers.scalp_condition,
    })
    trackCustomerIoEvent("quiz_completed", {
      hair_texture: answers.structure,
      lead_id: leadId ?? undefined,
      scalp_condition: answers.scalp_condition,
      scalp_type: answers.scalp_type,
      thickness: answers.thickness,
    })
    trackMetaQuizCompleted()
  }, [answers.scalp_condition, answers.scalp_type, answers.structure, answers.thickness, leadId])

  useEffect(() => {
    captureQuizCompleted()
  }, [captureQuizCompleted])

  const handleStart = () => {
    captureQuizCompleted()

    if (user && leadId) {
      const nextUrl = new URL("/onboarding", window.location.origin)
      nextUrl.searchParams.set("lead", leadId)

      if (isRetakeMode) {
        nextUrl.searchParams.set("returnTo", getSafeReturnToPath(returnTo) ?? "/profile")
      }

      router.push(`${nextUrl.pathname}${nextUrl.search}`)
      return
    }

    goNext()
  }

  const handleShare = async () => {
    const share = buildQuizShareConfig({
      leadId,
      name: lead.name,
      shareQuote,
      origin: window.location.origin,
      isMobile:
        window.matchMedia("(max-width: 767px)").matches ||
        /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
      canNativeShare: typeof navigator !== "undefined" && typeof navigator.share === "function",
    })

    if (!share) return

    if (share.mode === "native" && navigator.share) {
      posthog.capture("quiz_result_share_clicked", { leadId, method: "native" })
      trackCustomerIoEvent("result_shared", { lead_id: leadId ?? undefined, method: "native" })
      await navigator
        .share({
          title: share.title,
          text: share.text,
          url: share.url,
        })
        .catch(() => {})
      return
    }

    try {
      await navigator.clipboard.writeText(share.url)
      posthog.capture("quiz_result_share_clicked", { leadId, method: "copy_link" })
      trackCustomerIoEvent("result_shared", { lead_id: leadId ?? undefined, method: "copy_link" })
      toast({
        title: "Link kopiert",
        description: "Du kannst dein Ergebnis jetzt direkt teilen.",
      })
    } catch {
      window.open(share.url, "_blank", "noopener,noreferrer")
      posthog.capture("quiz_result_share_clicked", { leadId, method: "open_result" })
      trackCustomerIoEvent("result_shared", { lead_id: leadId ?? undefined, method: "open_result" })
      toast({
        title: "Ergebnis geöffnet",
        description: "Teile den Link direkt aus deinem Browser.",
      })
    }
  }

  if (!canGoStraightToRoutine) {
    if (isCheckingSignedInSubscription) {
      return (
        <div className="mx-auto flex min-h-[420px] w-full max-w-[520px] flex-col items-center justify-center px-5 text-center">
          <div className="mb-4 size-10 animate-spin rounded-full border-2 border-[var(--brand-plum-ice)] border-t-[var(--brand-plum)]" />
          <p className="font-header text-[24px] font-medium text-[var(--brand-plum-darkest)]">
            Wir prüfen deinen Zugang
          </p>
          <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
            Einen Moment bitte. Danach zeigen wir dir direkt den richtigen nächsten Schritt.
          </p>
        </div>
      )
    }

    return (
      <QuizResultOfferPage
        name={lead.name}
        narrative={narrative}
        leadId={leadId}
        onCheckoutOpen={captureQuizCompleted}
      />
    )
  }

  return (
    <QuizResultsView
      name={lead.name}
      narrative={{ ...narrative, cta }}
      primaryAction={{ label: cta.label, onClick: handleStart }}
      secondaryAction={leadId ? { label: "ERGEBNIS TEILEN", onClick: handleShare } : null}
    />
  )
}
