"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { trackAppEvent } from "@/lib/analytics/track-app-event"
import {
  PERSONAL_PLAN_RESULT_REVEAL_TOTAL_MS,
  buildPersonalPlanResultRevealCompletion,
  buildPersonalPlanResultRevealMessages,
  claimPersonalPlanResultRevealCompletion,
  type PersonalPlanResultRevealCompletionTrigger,
  schedulePersonalPlanResultReveal,
} from "@/lib/quiz/personal-plan-result-reveal"
import { requestPersonalPlanResultArtifactEmail } from "@/lib/personal-plan-quiz/result-email-client"

export function PersonalPlanResultReveal({ dateKey, leadId }: { dateKey: string; leadId: string }) {
  const router = useRouter()
  const messages = useMemo(() => buildPersonalPlanResultRevealMessages(dateKey), [dateKey])
  const [storyIndex, setStoryIndex] = useState(0)
  const [navigating, setNavigating] = useState(false)
  const trackedStepsRef = useRef(new Set<number>())
  const completedRef = useRef(false)
  const revealStartedAtRef = useRef<number | null>(null)
  const resultPath = `/result/${leadId}?entry=quiz_completion`

  useEffect(() => {
    void requestPersonalPlanResultArtifactEmail(leadId).catch((error) => {
      console.warn("[personal-plan-result-artifact] request failed", error)
    })
  }, [leadId])

  const openResult = useCallback(
    (completionTrigger: PersonalPlanResultRevealCompletionTrigger, visibleStep: number) => {
      if (!claimPersonalPlanResultRevealCompletion(completedRef)) return
      const completedAt = performance.now()
      setNavigating(true)
      trackAppEvent(
        "personal_plan_result_reveal_completed",
        buildPersonalPlanResultRevealCompletion({
          completionTrigger,
          elapsedMs: completedAt - (revealStartedAtRef.current ?? completedAt),
          leadId,
          scheduledDurationMs: PERSONAL_PLAN_RESULT_REVEAL_TOTAL_MS,
          stepCount: messages.length,
          visibleStep,
        }),
      )
      window.requestAnimationFrame(() => router.replace(resultPath))
    },
    [leadId, messages.length, resultPath, router],
  )

  useEffect(() => {
    if (trackedStepsRef.current.has(storyIndex)) return
    trackedStepsRef.current.add(storyIndex)
    revealStartedAtRef.current ??= performance.now()
    trackAppEvent("personal_plan_result_reveal_step_viewed", {
      daysFromStart: messages[storyIndex].daysFromStart,
      leadId,
      stepIndex: storyIndex + 1,
    })
  }, [leadId, messages, storyIndex])

  useEffect(() => {
    return schedulePersonalPlanResultReveal({
      messageCount: messages.length,
      onComplete: () => openResult("timer", messages.length),
      onStep: setStoryIndex,
      timer: {
        cancel: (handle) => window.clearTimeout(handle),
        schedule: (callback, delayMs) => window.setTimeout(callback, delayMs),
      },
    })
  }, [messages, openResult])

  return (
    <main className="relative grid min-h-[100svh] overflow-x-hidden bg-[#fcfaf7] px-6 py-6 text-[var(--brand-plum-darkest)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(var(--brand-plum-rgb),0.09),transparent_42%)]"
      />
      <button
        className="absolute right-5 top-5 z-10 rounded-full px-3 py-2 text-sm font-semibold text-[rgba(var(--brand-plum-rgb),0.70)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)]"
        onClick={() => openResult("skip_button", storyIndex + 1)}
        type="button"
      >
        Überspringen
      </button>
      <section
        aria-atomic="true"
        aria-live="polite"
        className="relative mx-auto flex w-full max-w-[34rem] items-center justify-center text-center"
      >
        <h1
          className="font-serif text-[2.65rem] leading-[1.06] tracking-[-0.04em] sm:text-6xl"
          key={navigating ? "navigating" : storyIndex}
        >
          {navigating ? (
            "Deine Auswertung wird geöffnet …"
          ) : (
            <>
              {messages[storyIndex].before}
              <span className="reveal-highlight">{messages[storyIndex].highlight}</span>
              {messages[storyIndex].after}
            </>
          )}
        </h1>
      </section>
      <style jsx>{`
        h1 {
          animation: personal-plan-result-reveal 600ms ease-out both;
        }

        .reveal-highlight {
          background: linear-gradient(
            to bottom,
            transparent 72%,
            rgba(var(--brand-coral-rgb), 0.16) 72%
          );
          color: var(--brand-coral-deep);
          display: inline;
          white-space: nowrap;
        }

        @keyframes personal-plan-result-reveal {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          h1 {
            animation: none;
          }
        }
      `}</style>
    </main>
  )
}
