"use client"

import * as React from "react"

export const ROUTINE_PLAN_UPDATED_TOAST_DURATION_MS = 5000

export type RoutinePlanUpdatedToastProps = {
  onDismiss: () => void
  durationMs?: number
}

/**
 * The "✓ Plan aktualisiert" toast (Task 2.6, mockup screen 3, signed off).
 *
 * A quiet, non-blocking chip at the top of the Routine content — it never
 * competes with the refinement banner (`RoutineRefinementBanner`), which can
 * render on the same page at the same time. Auto-dismisses after
 * `durationMs`; the caller also unmounts it on navigation away from
 * `/routine`, and never re-arms it on remount without a fresh signal (see
 * `personal-plan-routine-client.tsx`).
 */
export function RoutinePlanUpdatedToast({
  onDismiss,
  durationMs = ROUTINE_PLAN_UPDATED_TOAST_DURATION_MS,
}: RoutinePlanUpdatedToastProps) {
  React.useEffect(() => {
    const timer = window.setTimeout(onDismiss, durationMs)
    return () => window.clearTimeout(timer)
  }, [onDismiss, durationMs])

  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-[12px] bg-[var(--status-ok-bg)] px-3.5 py-2.5 text-[13.5px] font-bold text-[var(--status-ok-text)]"
    >
      <span aria-hidden="true">✓</span>
      Plan aktualisiert
    </div>
  )
}
