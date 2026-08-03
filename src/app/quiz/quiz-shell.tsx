"use client"

import { useQuizStore } from "@/lib/quiz/store"
import { QuizBrandPanel } from "@/components/quiz/quiz-brand-panel"
import { QuizInfoStrip } from "@/components/quiz/quiz-info-strip"
import { QuizProgressTransitionProvider } from "@/components/quiz/quiz-progress-bar"
import { AppRouteProviders } from "@/providers/route-providers"
import { getQuizQuestionNumber, QUIZ_TOTAL_QUESTIONS } from "@/lib/quiz/questions"
import type { QuizStep } from "@/lib/quiz/types"
import { useEffect, useRef, useState } from "react"

const QUIZ_MOTION_ORDER: readonly QuizStep[] = [2, 3, 13, 15, 4, 5, 7, 6, 8, 12, 9, 10, 11, 14]
const LEAD_CAPTURE_MOTION_ORDER = ["name", "email", "consent"]
const SCREEN_EXIT_MS = 200

type QuizOutgoingLayer = {
  direction: "forward" | "back"
  html: string
  id: number
}

function getTransitionDirection(previousStep: QuizStep, nextStep: QuizStep) {
  const previousIndex = QUIZ_MOTION_ORDER.indexOf(previousStep)
  const nextIndex = QUIZ_MOTION_ORDER.indexOf(nextStep)

  if (previousIndex === -1 || nextIndex === -1) return "forward"
  return nextIndex < previousIndex ? "back" : "forward"
}

function getLeadCaptureTransitionDirection(previous: string, next: string) {
  return LEAD_CAPTURE_MOTION_ORDER.indexOf(next) < LEAD_CAPTURE_MOTION_ORDER.indexOf(previous)
    ? "back"
    : "forward"
}

function getProgressCurrent(step: QuizStep) {
  return getQuizQuestionNumber(step) ?? QUIZ_TOTAL_QUESTIONS
}

export function QuizShell({ children }: { children: React.ReactNode }) {
  const step = useQuizStore((s) => s.step)
  const leadCaptureSubStep = useQuizStore((s) => s.leadCaptureSubStep)
  const standardScrollRef = useRef<HTMLDivElement>(null)
  const resultScrollRef = useRef<HTMLDivElement>(null)
  const activeLayerRef = useRef<HTMLDivElement>(null)
  const outgoingLayerIdRef = useRef(0)
  const [transitionDirection, setTransitionDirection] = useState<"forward" | "back">("forward")
  const [outgoingLayer, setOutgoingLayer] = useState<QuizOutgoingLayer | null>(null)
  const [progressTransition, setProgressTransition] = useState<{
    fromCurrent: number
    id: number
  } | null>(null)
  const previousTransitionKeyRef = useRef(`${step}:${leadCaptureSubStep}`)
  // Info strip is only shown on the first question (step 2). The dismiss
  // state lives here (not in the strip) so it persists across step changes
  // within the same session — the layout doesn't unmount when the user
  // advances through questions.
  const [infoStripDismissed, setInfoStripDismissed] = useState(false)

  useEffect(() => {
    return useQuizStore.subscribe((nextState, previousState) => {
      const previousKey = `${previousState.step}:${previousState.leadCaptureSubStep}`
      const nextKey = `${nextState.step}:${nextState.leadCaptureSubStep}`
      if (previousKey === nextKey) return

      const direction =
        nextState.step === previousState.step
          ? getLeadCaptureTransitionDirection(
              previousState.leadCaptureSubStep,
              nextState.leadCaptureSubStep,
            )
          : getTransitionDirection(previousState.step, nextState.step)
      setTransitionDirection(direction)

      outgoingLayerIdRef.current += 1
      const transitionId = outgoingLayerIdRef.current
      setProgressTransition({
        fromCurrent: getProgressCurrent(previousState.step),
        id: transitionId,
      })

      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      const outgoingHtml = activeLayerRef.current?.innerHTML
      if (!outgoingHtml || prefersReducedMotion) {
        setOutgoingLayer(null)
        return
      }

      const snapshot = document.createElement("div")
      snapshot.innerHTML = outgoingHtml
      // Re-parsing the trusted, already-rendered DOM creates fresh elements and
      // would restart their entrance animations. Freeze nested animations so
      // the inert snapshot preserves the exact visible state while it exits.
      snapshot.querySelectorAll<HTMLElement>("*").forEach((element) => {
        element.style.setProperty("animation", "none", "important")
      })
      snapshot
        .querySelectorAll<HTMLElement>("[id]")
        .forEach((element) => element.removeAttribute("id"))
      snapshot
        .querySelectorAll<HTMLElement>(
          "[for], [name], [aria-labelledby], [aria-describedby], [autofocus]",
        )
        .forEach((element) => {
          element.removeAttribute("for")
          element.removeAttribute("name")
          element.removeAttribute("aria-labelledby")
          element.removeAttribute("aria-describedby")
          element.removeAttribute("autofocus")
        })

      setOutgoingLayer({ direction, html: snapshot.innerHTML, id: transitionId })
    })
  }, [])

  useEffect(() => {
    if (!outgoingLayer) return
    const timer = window.setTimeout(() => {
      setOutgoingLayer((current) => (current?.id === outgoingLayer.id ? null : current))
    }, SCREEN_EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [outgoingLayer])

  useEffect(() => {
    const transitionKey = `${step}:${leadCaptureSubStep}`
    if (previousTransitionKeyRef.current === transitionKey) return

    previousTransitionKeyRef.current = transitionKey

    const resetStepScroll = () => {
      const container = step === 11 ? resultScrollRef.current : standardScrollRef.current
      container?.scrollTo({ top: 0 })
      window.scrollTo({ top: 0 })
      return container
    }

    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      resetStepScroll()
      secondFrame = window.requestAnimationFrame(() => {
        const container = resetStepScroll()
        // The lead-capture substeps manage their own input focus via autoFocus.
        // Moving focus back to the heading here would override the editable
        // email field after a deliverability rejection.
        if (step === 9) return
        const heading = container?.querySelector<HTMLElement>("h1, h2")
        if (heading) {
          if (!heading.hasAttribute("tabindex")) {
            heading.setAttribute("tabindex", "-1")
          }
          heading.focus({ preventScroll: true })
        }
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [leadCaptureSubStep, step])

  // Results page (step 11): full-width centered layout, no brand panel
  if (step === 11) {
    return (
      <AppRouteProviders>
        <div ref={resultScrollRef} className="min-h-[100dvh] overflow-y-auto bg-background">
          <div className="mx-auto max-w-[960px] px-5 py-8 md:px-10 md:py-12">{children}</div>
        </div>
      </AppRouteProviders>
    )
  }

  return (
    <AppRouteProviders>
      <div className="flex min-h-[100dvh] bg-background">
        {/* Left panel — brand / contextual (hidden on mobile) */}
        <div className="sticky top-0 hidden h-screen w-1/2 items-center justify-center overflow-hidden md:flex">
          <QuizBrandPanel />
        </div>

        {/* Right panel — quiz content (full-width on mobile) */}
        <div ref={standardScrollRef} className="w-full overflow-y-auto md:w-1/2">
          <div className="mx-auto max-w-[540px] px-5 py-8 md:px-10 md:py-12">
            {step === 2 && !infoStripDismissed && (
              <QuizInfoStrip onDismiss={() => setInfoStripDismissed(true)} />
            )}
            <div className="relative grid w-full" data-personal-plan-transition-root>
              <div
                ref={activeLayerRef}
                className={`col-start-1 row-start-1 w-full${outgoingLayer ? " personal-plan-screen-enter" : ""}`}
                data-personal-plan-transition-direction={
                  outgoingLayer ? transitionDirection : undefined
                }
                data-personal-plan-transition-layer="active"
              >
                <QuizProgressTransitionProvider transition={progressTransition}>
                  {children}
                </QuizProgressTransitionProvider>
              </div>
              {outgoingLayer ? (
                <div
                  aria-hidden="true"
                  className="personal-plan-screen-exit pointer-events-none absolute inset-x-0 top-0 w-full select-none"
                  data-personal-plan-transition-direction={outgoingLayer.direction}
                  data-personal-plan-transition-layer="outgoing"
                  dangerouslySetInnerHTML={{ __html: outgoingLayer.html }}
                  inert
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </AppRouteProviders>
  )
}
