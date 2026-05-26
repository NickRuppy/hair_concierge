"use client"

import { useEffect } from "react"
import { buildQuizResultNarrative } from "@/lib/quiz/result-narrative"
import { buildQuizShareConfig } from "@/lib/quiz/share"
import type { QuizAnswers } from "@/lib/quiz/types"
import { trackCustomerIoEvent } from "@/lib/customerio-tracking"
import { posthog } from "@/providers/posthog-provider"
import { useToast } from "@/providers/toast-provider"
import { QuizResultsView } from "@/components/quiz/quiz-results-view"

interface ResultPageClientProps {
  leadId: string
  name: string
  quizAnswers: QuizAnswers
  shareQuote: string | null
}

export function ResultPageClient({ leadId, name, quizAnswers, shareQuote }: ResultPageClientProps) {
  const { toast } = useToast()
  const narrative = buildQuizResultNarrative(quizAnswers)

  useEffect(() => {
    posthog.capture("result_page_viewed", { leadId })
    trackCustomerIoEvent("result_page_viewed", { lead_id: leadId })
  }, [leadId])

  const handleShare = async () => {
    const share = buildQuizShareConfig({
      leadId,
      name,
      shareQuote,
      origin: window.location.origin,
      isMobile:
        window.matchMedia("(max-width: 767px)").matches ||
        /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
      canNativeShare: typeof navigator !== "undefined" && typeof navigator.share === "function",
    })

    if (!share) return

    if (share.mode === "native" && navigator.share) {
      posthog.capture("result_shared", { method: "native", leadId })
      trackCustomerIoEvent("result_shared", { lead_id: leadId, method: "native" })
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
      posthog.capture("result_shared", { method: "copy_link", leadId })
      trackCustomerIoEvent("result_shared", { lead_id: leadId, method: "copy_link" })
      toast({
        title: "Link kopiert",
        description: "Du kannst das Ergebnis jetzt direkt teilen.",
      })
    } catch {
      window.open(share.url, "_blank", "noopener,noreferrer")
      posthog.capture("result_shared", { method: "open_result", leadId })
      trackCustomerIoEvent("result_shared", { lead_id: leadId, method: "open_result" })
      toast({
        title: "Ergebnis geöffnet",
        description: "Teile den Link direkt aus deinem Browser.",
      })
    }
  }

  return (
    <QuizResultsView
      name={name}
      narrative={{
        ...narrative,
        cta: {
          lead: "Finde heraus, was dein Haar braucht",
          label: "QUIZ STARTEN",
          subline: "Mach das Quiz in 2 Minuten für dein eigenes Ergebnis.",
        },
      }}
      primaryAction={{ label: "QUIZ STARTEN", href: "/quiz" }}
      secondaryAction={{ label: "ERGEBNIS TEILEN", onClick: handleShare }}
    />
  )
}
