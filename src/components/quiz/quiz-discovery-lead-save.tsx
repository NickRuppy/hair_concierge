"use client"

import { ArrowRight, Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { useDelayedLoader } from "@/lib/motion-loader"

/**
 * The consultation handoff introduces the remaining products and routine. Background work:
 *
 * - the enrollment check (`/api/beratung/quiz-context`, started on the last question),
 * - the profile save (`/api/quiz/lead` with `marketingConsent: false`; discovery leads
 *   never enter a marketing pipeline, so the marketing question is not asked).
 *
 * The save still has to happen — the checklist's profile projection is built from exactly
 * this lead — so a failure is never skipped over: it replaces the button with a retry.
 * „Produkte ergänzen" waits for the save; only if that wait passes 300 ms does the
 * button show a spinner (its label and width stay). No fixed waits, no analysis beat.
 *
 * `saved` also covers the one way back onto this step: Back from the checklist with a lead
 * for these exact answers already stored — nothing is posted again, Weiter goes straight on.
 */

export const DISCOVERY_LEAD_SAVE_COPY = {
  heading: "Als Nächstes: deine Produkte.",
  continue: "Produkte ergänzen",
  retry: "Erneut versuchen",
} as const

export function QuizDiscoveryLeadSave({
  canSave,
  error,
  onContinue,
  onRetry,
  onSave,
  saved,
}: {
  /** The enrollment check of THIS mount confirmed her — only then may the lead be posted. */
  canSave: boolean
  /** A failed check or save; the button is replaced by a retry. */
  error: string
  /** Navigate on. Called once, only when `saved`. */
  onContinue: () => void
  onRetry: () => void
  onSave: () => void
  /** A lead for exactly these answers is stored. */
  saved: boolean
}) {
  const startedRef = useRef(false)
  const continuedRef = useRef(false)
  const [continueRequested, setContinueRequested] = useState(false)
  const pending = continueRequested && !error
  const spinnerVisible = useDelayedLoader(pending)

  useEffect(() => {
    // Once per visit to this step: re-renders (and a Strict-Mode effect replay,
    // which keeps refs) must not post the lead twice. A retry is the only other
    // caller of `onSave`, and it is the participant's own tap.
    if (!canSave || saved || startedRef.current) return
    startedRef.current = true
    onSave()
  }, [canSave, onSave, saved])

  useEffect(() => {
    if (!continueRequested || !saved || error || continuedRef.current) return
    continuedRef.current = true
    onContinue()
  }, [continueRequested, error, onContinue, saved])

  return (
    <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col text-center">
      <div className="flex flex-1 items-center justify-center px-4 pb-16 pt-9">
        <h2 className="max-w-[20rem] text-balance font-header text-[2rem] font-medium leading-tight text-[var(--brand-plum-darkest)]">
          {DISCOVERY_LEAD_SAVE_COPY.heading}
        </h2>
      </div>
      <div className="w-full px-4 sm:px-0" role={error ? "alert" : undefined}>
        {error ? (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}
        <button
          aria-busy={pending || undefined}
          aria-disabled={pending || undefined}
          className="relative flex min-h-14 w-full items-center justify-center gap-3 rounded-[14px] bg-[var(--brand-coral)] px-4 py-4 text-sm font-bold text-white transition-[background-color,transform] duration-150 hover:bg-[var(--brand-coral-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.97] motion-reduce:transition-none"
          onClick={() => {
            if (error) {
              setContinueRequested(false)
              onRetry()
              return
            }
            if (pending) return
            setContinueRequested(true)
          }}
          type="button"
        >
          {error ? DISCOVERY_LEAD_SAVE_COPY.retry : DISCOVERY_LEAD_SAVE_COPY.continue}
          {!error ? (
            <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center">
              {spinnerVisible ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-5 w-5" />
              )}
            </span>
          ) : null}
        </button>
      </div>
    </div>
  )
}
