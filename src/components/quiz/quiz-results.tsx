"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { buildQuizResultNarrative } from "@/lib/quiz/result-narrative"
import { getQuizResultCta } from "@/lib/quiz/result-cta"
import { buildQuizShareConfig } from "@/lib/quiz/share"
import { useQuizStore } from "@/lib/quiz/store"
import { useAuth } from "@/providers/auth-provider"
import { posthog } from "@/providers/posthog-provider"
import { useToast } from "@/providers/toast-provider"
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
  const { user } = useAuth()
  const { toast } = useToast()
  const { lead, answers, leadId, shareQuote, goNext } = useQuizStore()
  const narrative = buildQuizResultNarrative(answers)
  const returnTo = searchParams.get("returnTo")
  const isRetakeMode = searchParams.get("mode") === "retake"
  const canGoStraightToRoutine = Boolean(user && leadId)
  const cta = getQuizResultCta({ canGoStraightToRoutine })

  const handleStart = () => {
    posthog.capture("quiz_completed", {
      structure: answers.structure,
      thickness: answers.thickness,
      scalp_type: answers.scalp_type,
      scalp_condition: answers.scalp_condition,
    })

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
      toast({
        title: "Link kopiert",
        description: "Du kannst dein Ergebnis jetzt direkt teilen.",
      })
    } catch {
      window.open(share.url, "_blank", "noopener,noreferrer")
      posthog.capture("quiz_result_share_clicked", { leadId, method: "open_result" })
      toast({
        title: "Ergebnis geöffnet",
        description: "Teile den Link direkt aus deinem Browser.",
      })
    }
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
