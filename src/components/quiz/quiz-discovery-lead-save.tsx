"use client"

import { Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { useDelayedLoader } from "@/lib/motion-loader"

/**
 * The end of the quiz for a discovery participant: „Geschafft" the moment the lead step
 * opens (batch 8, plan item 2). Everything that still has to happen runs behind it —
 *
 * - the enrollment check (`/api/beratung/quiz-context`, started on the last question),
 * - the profile save (`/api/quiz/lead` with `marketingConsent: false`; discovery leads
 *   never enter a marketing pipeline, so the marketing question is not asked).
 *
 * The save still has to happen — the checklist's profile projection is built from exactly
 * this lead — so a failure is never skipped over: it replaces the button with a retry.
 * „Weiter zu deinen Produkten" waits for the save; only if that wait passes 300 ms does the
 * button show a spinner (its label and width stay). No fixed waits, no analysis beat.
 *
 * `saved` also covers the one way back onto this step: Back from the checklist with a lead
 * for these exact answers already stored — nothing is posted again, Weiter goes straight on.
 */

export const DISCOVERY_LEAD_SAVE_COPY = {
  heading: "Geschafft — dein Haarprofil steht.",
  subline: "Jetzt noch deine Produkte. Dauert 5 Minuten.",
  continue: "Weiter zu deinen Produkten",
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
    <div className="mx-auto flex w-full max-w-[26rem] flex-col items-center py-10 text-center sm:py-16">
      <h2 className="text-balance font-header text-[2rem] font-medium leading-tight text-[var(--brand-plum-darkest)] sm:text-[2.4rem]">
        {DISCOVERY_LEAD_SAVE_COPY.heading}
      </h2>
      <p className="mt-3 text-[15px] leading-6 text-[var(--text-sub)]">
        {DISCOVERY_LEAD_SAVE_COPY.subline}
      </p>
      {error ? (
        <div className="mt-9 flex w-full flex-col items-center" role="alert">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {error}
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              setContinueRequested(false)
              onRetry()
            }}
            type="button"
          >
            {DISCOVERY_LEAD_SAVE_COPY.retry}
          </Button>
        </div>
      ) : (
        <button
          aria-busy={pending || undefined}
          aria-disabled={pending || undefined}
          className="quiz-btn-primary relative mt-9 min-h-12 w-full rounded-[14px] px-5 py-3 text-base font-bold"
          onClick={() => {
            if (pending) return
            setContinueRequested(true)
          }}
          type="button"
        >
          {DISCOVERY_LEAD_SAVE_COPY.continue}
          {spinnerVisible ? (
            <Loader2
              aria-hidden="true"
              className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin"
            />
          ) : null}
        </button>
      )}
    </div>
  )
}
