"use client"

import { useEffect, useState } from "react"

type AttentionResponse = {
  hasPendingProposal?: unknown
}

const ROUTINE_ATTENTION_REFRESH_EVENT = "personal-plan:routine-attention-refresh"

export function knownRoutineAttentionFromEvent(event?: Event): boolean | null {
  const detail = (event as (Event & { detail?: unknown }) | undefined)?.detail
  if (!detail || typeof detail !== "object") return null
  const hasPendingProposal = (detail as { hasPendingProposal?: unknown }).hasPendingProposal
  return typeof hasPendingProposal === "boolean" ? hasPendingProposal : null
}

export function requestRoutineAttentionRefresh(hasPendingProposal?: boolean) {
  window.dispatchEvent(
    typeof hasPendingProposal === "boolean"
      ? new CustomEvent(ROUTINE_ATTENTION_REFRESH_EVENT, {
          detail: { hasPendingProposal },
        })
      : new Event(ROUTINE_ATTENTION_REFRESH_EVENT),
  )
}

export function useRoutineAttention(
  enabled: boolean,
  initialHasPendingProposal?: boolean,
): boolean {
  const [hasPendingProposal, setHasPendingProposal] = useState(initialHasPendingProposal === true)

  useEffect(() => {
    if (!enabled) return

    const controller = new AbortController()

    async function loadAttention(event?: Event) {
      const knownState = knownRoutineAttentionFromEvent(event)
      if (knownState !== null) {
        if (!controller.signal.aborted) setHasPendingProposal(knownState)
        return
      }
      try {
        const response = await fetch("/api/personal-plan/routine/attention", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        })
        if (!response.ok) {
          if (!controller.signal.aborted) setHasPendingProposal(false)
          return
        }

        const payload = (await response.json()) as AttentionResponse
        if (!controller.signal.aborted) {
          setHasPendingProposal(payload.hasPendingProposal === true)
        }
      } catch {
        if (!controller.signal.aborted) setHasPendingProposal(false)
      }
    }

    if (typeof initialHasPendingProposal !== "boolean") void loadAttention()
    window.addEventListener(ROUTINE_ATTENTION_REFRESH_EVENT, loadAttention)
    return () => {
      controller.abort()
      window.removeEventListener(ROUTINE_ATTENTION_REFRESH_EVENT, loadAttention)
    }
  }, [enabled, initialHasPendingProposal])

  return hasPendingProposal
}

export function RoutineAttentionIndicator({ hasPendingProposal }: { hasPendingProposal: boolean }) {
  if (!hasPendingProposal) return null

  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5" aria-live="polite">
      <span className="sr-only">Routine hat Änderungen zur Prüfung</span>
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background"
      />
    </span>
  )
}
