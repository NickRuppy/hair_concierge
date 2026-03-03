"use client"

import { useEffect, useCallback, useState } from "react"
import Link from "next/link"
import type { CardData } from "@/lib/quiz/result-card-data"
import { Button } from "@/components/ui/button"
import { posthog } from "@/providers/posthog-provider"

interface ResultPageClientProps {
  leadId: string
  name: string
  cardData: CardData
  shareQuote: string | null
  aiInsight: string | null
}

export function ResultPageClient({
  leadId,
  name,
  cardData,
  shareQuote,
  aiInsight,
}: ResultPageClientProps) {
  const [canShare, setCanShare] = useState(false)
  const [resultUrl, setResultUrl] = useState("")

  useEffect(() => {
    posthog.capture("result_page_viewed", { leadId })
    setResultUrl(`${window.location.origin}/result/${leadId}`)
    setCanShare(typeof navigator !== "undefined" && !!navigator.share)
  }, [leadId])

  const handleDownload = useCallback(async () => {
    posthog.capture("result_shared", { method: "download", leadId })
    try {
      const res = await fetch(`/api/og/result/${leadId}`)
      const blob = await res.blob()
      const fileName = `haar-diagnose-${name.toLowerCase().replace(/\s+/g, "-")}.png`

      // On mobile: use native share with file (opens share sheet → save to photos / Instagram)
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], fileName, { type: "image/png" })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `${name}s Haar-Diagnose`,
          })
          return
        }
      }

      // Desktop fallback: trigger download
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // Last resort: open image in new tab
      window.open(`/api/og/result/${leadId}`, "_blank")
    }
  }, [leadId, name])

  const handleNativeShare = useCallback(async () => {
    posthog.capture("result_shared", { method: "native", leadId })
    if (navigator.share) {
      await navigator.share({
        title: `${name}s Haar-Diagnose — TomBot`,
        text: shareQuote || "Schau dir meine Haar-Diagnose an!",
        url: resultUrl,
      }).catch(() => {})
    }
  }, [leadId, name, shareQuote, resultUrl])

  const whatsappUrl = resultUrl
    ? `https://wa.me/?text=${encodeURIComponent(`Schau dir meine Haar-Diagnose an: ${resultUrl}`)}`
    : "#"

  return (
    <div className="min-h-screen bg-[#231F20] text-white">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Brand mark */}
        <div className="flex items-center gap-2 mb-8">
          <div className="flex gap-[3px]">
            <div className="w-[3px] h-5 bg-[#F5C518] rounded-full" />
            <div className="w-[3px] h-5 bg-[#F5C518]/60 rounded-full" />
            <div className="w-[3px] h-5 bg-[#F5C518]/30 rounded-full" />
          </div>
          <span className="font-header text-sm text-white/50 tracking-widest">
            TOM BOT
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-header text-3xl sm:text-4xl text-white mb-2">
          {name.toUpperCase()}, DEINE HAAR-DIAGNOSE
        </h1>
        <p className="text-base text-white/60 mb-2">{cardData.summaryLine}</p>
        <p className="text-sm text-white/40 mb-6">
          Basierend auf dem Haar-Quiz von TomBot
        </p>

        {/* Profile cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 items-start">
          {cardData.cards.map((card) => (
            <div
              key={card.title}
              className="bg-white/[0.04] border border-white/[0.08] border-l-2 border-l-[#F5C518] rounded-xl p-4"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5">
                  {card.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#F5C518] uppercase tracking-wide mb-1">
                    {card.title}
                  </p>
                  <p className="text-sm text-white/80 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tom's quote */}
        {shareQuote && (
          <div className="border-2 border-[#F5C518]/30 rounded-xl p-5 mb-8">
            <p className="text-xs font-semibold text-[#F5C518] uppercase tracking-wide mb-2">
              TOM SAGT
            </p>
            <p className="text-base text-white/90 leading-relaxed italic">
              &ldquo;{shareQuote}&rdquo;
            </p>
          </div>
        )}

        {/* AI Insight */}
        {aiInsight && (
          <div className="bg-white/[0.04] border border-[#F5C518]/20 rounded-xl p-5 mb-8">
            <p className="text-xs font-semibold text-[#F5C518] uppercase tracking-wide mb-2">
              WAS BISHER WAHRSCHEINLICH SCHIEF LIEF
            </p>
            <p className="text-sm text-white/80 leading-relaxed">
              {aiInsight}
            </p>
          </div>
        )}

        {/* Share section */}
        <div className="border-t border-white/10 pt-8 mb-8">
          <p className="text-sm text-white/50 mb-4 text-center">
            Teile deine Diagnose
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleDownload}
              variant="unstyled"
              className="quiz-btn-primary flex-1 h-12 text-sm font-bold tracking-wide rounded-xl"
            >
              ALS BILD SPEICHERN
            </Button>

            {canShare && (
              <Button
                onClick={handleNativeShare}
                variant="outline"
                className="flex-1 h-12 text-sm font-bold tracking-wide rounded-xl border-white/20 text-white hover:bg-white/10"
              >
                TEILEN
              </Button>
            )}

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                posthog.capture("result_shared", {
                  method: "whatsapp",
                  leadId,
                })
              }
              className="flex-1 h-12 inline-flex items-center justify-center text-sm font-bold tracking-wide rounded-xl border border-white/20 text-white hover:bg-white/10 transition-colors"
            >
              WHATSAPP
            </a>
          </div>
          <p className="text-xs text-white/30 text-center mt-3">
            Speichere das Bild und poste es in deiner Instagram Story!
          </p>
        </div>

        {/* CTA for viewers */}
        <div className="text-center">
          <p className="text-lg text-white/60 mb-4">
            Was sagt Tom zu DEINEM Haar?
          </p>
          <Link href="/quiz">
            <Button
              variant="unstyled"
              className="quiz-btn-primary w-full sm:max-w-md h-14 text-base font-bold tracking-wide rounded-xl"
            >
              QUIZ STARTEN
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
