"use client"

import { Sparkles } from "lucide-react"
import { useEffect, useState } from "react"

import type { GuidedStoryChatExchange } from "@/lib/quiz/guided-story-chat"

export const GUIDED_STORY_CHAT_REVEAL_DELAY_MS = 650

export function GuidedStoryChatDemo({ exchange }: { exchange: GuidedStoryChatExchange }) {
  const [answerVisible, setAnswerVisible] = useState(false)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const timer = window.setTimeout(
      () => setAnswerVisible(true),
      prefersReducedMotion ? 0 : GUIDED_STORY_CHAT_REVEAL_DELAY_MS,
    )
    return () => window.clearTimeout(timer)
  }, [exchange.id])

  return (
    <article
      aria-label="Vorab berechnete Chat-Demonstration"
      className="overflow-hidden rounded-[22px] border border-border bg-[#f8f5f1] shadow-[0_22px_62px_-42px_rgba(var(--brand-plum-rgb),0.58)]"
      data-guided-story-chat={exchange.id}
    >
      <header className="flex items-center gap-3 border-b border-border bg-white px-4 py-3.5">
        <span className="grid size-9 place-items-center rounded-full bg-[var(--brand-plum)] text-white">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <span>
          <strong className="block text-[14px] text-[var(--brand-plum-darkest)]">Chaarlie</strong>
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-[#2D9F5E]" aria-hidden="true" />
            kennt dein Profil und deine Routine
          </span>
        </span>
      </header>

      <div className="min-h-[250px] space-y-4 px-4 py-5">
        <div className="ml-auto max-w-[86%] rounded-[16px_16px_4px_16px] bg-[var(--brand-plum)] px-4 py-3 text-[13px] leading-[1.55] text-white">
          {exchange.question}
        </div>

        <div aria-live="polite" aria-atomic="true" className="min-h-[94px]">
          {answerVisible ? (
            <div
              className="max-w-[92%] rounded-[16px_16px_16px_4px] border border-border bg-white px-4 py-3 text-[13px] leading-[1.6] text-[var(--brand-plum-darkest)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
              data-guided-story-chat-answer
            >
              {exchange.answer}
            </div>
          ) : (
            <div
              aria-label="Chaarlie schreibt"
              className="inline-flex gap-1 rounded-[16px_16px_16px_4px] border border-border bg-white px-4 py-4"
              data-guided-story-chat-typing
            >
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-[var(--brand-plum-light)] motion-safe:animate-pulse"
                  style={{ animationDelay: `${dot * 120}ms` }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
