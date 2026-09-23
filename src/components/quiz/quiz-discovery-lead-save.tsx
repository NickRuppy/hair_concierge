"use client"

import { Loader2 } from "lucide-react"
import { useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"

/**
 * What a discovery participant sees where everyone else gets the consent sheet.
 *
 * Discovery leads never enter a marketing pipeline (`/api/quiz/lead` stores them
 * outside the dedupe pool, Customer.io and Meta), so the marketing question is
 * not asked: the lead is saved with `marketingConsent: false` the moment this
 * step is reached. The save still has to happen — the checklist's profile
 * projection is built from exactly this lead — so a failure is never skipped
 * over: it stays on screen with a retry.
 *
 * `alreadySaved` covers the one way back onto this step: Back from the next
 * screen, with a lead for these exact answers already stored. Saving again would
 * bounce the participant forward and mint a duplicate lead each time, so the
 * step waits for a tap instead.
 */

export const DISCOVERY_LEAD_SAVE_COPY = {
  saving: "Dein Haarprofil wird gespeichert …",
  retry: "Erneut versuchen",
  saved: "Dein Haarprofil ist gespeichert.",
  continue: "Weiter",
} as const

export function QuizDiscoveryLeadSave({
  alreadySaved,
  error,
  onContinue,
  onSave,
  saving,
}: {
  alreadySaved: boolean
  error: string
  onContinue: () => void
  onSave: () => void
  saving: boolean
}) {
  const startedRef = useRef(false)

  useEffect(() => {
    // Once per visit to this step: re-renders (and a Strict-Mode effect replay,
    // which keeps refs) must not post the lead twice. A retry is the only other
    // caller of `onSave`, and it is the participant's own tap.
    if (alreadySaved || startedRef.current) return
    startedRef.current = true
    onSave()
  }, [alreadySaved, onSave])

  if (error && !saving) {
    return (
      <div className="mt-10 flex flex-col items-center text-center">
        <p
          className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
          role="alert"
        >
          {error}
        </p>
        <Button className="mt-4" onClick={onSave} type="button">
          {DISCOVERY_LEAD_SAVE_COPY.retry}
        </Button>
      </div>
    )
  }

  if (alreadySaved && !saving) {
    return (
      <div className="mt-10 flex flex-col items-center text-center">
        <p className="text-base text-[var(--text-sub)]">{DISCOVERY_LEAD_SAVE_COPY.saved}</p>
        <Button
          className="quiz-btn-primary mt-6 h-14 w-full rounded-xl text-base font-bold tracking-wide"
          onClick={onContinue}
          type="button"
          variant="unstyled"
        >
          {DISCOVERY_LEAD_SAVE_COPY.continue}
        </Button>
      </div>
    )
  }

  return (
    <p
      className="mt-10 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground"
      role="status"
    >
      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
      {DISCOVERY_LEAD_SAVE_COPY.saving}
    </p>
  )
}
