"use client"

import { useEffect, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"

import { PREMIUM_SHEET_PURCHASE_COPY } from "@/lib/premium-sheet/purchase-copy"

/**
 * „Alles freigeschaltet" — the journey's step-9 confirmation (freemium-scanner-first T14).
 *
 * Rendered by `PremiumSheet` itself rather than through `ToastProvider`, for one reason:
 * the toast has to OUTLIVE the sheet's close. It appears at the moment the sheet starts
 * animating out, on a surface that is simultaneously re-rendering from gated example to
 * real content, and the app shell does not mount a global toast provider on every gate
 * (`useToast` silently no-ops without one). A portal owned by the still-mounted sheet is
 * the one place that is guaranteed to be alive at that moment.
 *
 * Styling matches `src/providers/toast-provider.tsx` so the two never look like different
 * products, including its `data-modal-layer-exempt` marker.
 */
const subscribeToClientReady = () => () => {}
const getClientReadySnapshot = () => true
const getServerReadySnapshot = () => false

export function PremiumSheetUnlockToast({
  visible,
  routineReady,
  onDismiss,
  durationMs = 5000,
}: {
  visible: boolean
  /** When false the toast says the Routine is still being built, instead of implying it. */
  routineReady: boolean
  onDismiss: () => void
  durationMs?: number
}) {
  // Same client-ready probe `src/providers/toast-provider.tsx` uses — a portal cannot be
  // created during SSR, and the repo's lint rules forbid a setState-in-effect mount flag.
  const mounted = useSyncExternalStore(
    subscribeToClientReady,
    getClientReadySnapshot,
    getServerReadySnapshot,
  )

  useEffect(() => {
    if (!visible) return
    const timeout = setTimeout(onDismiss, durationMs)
    return () => clearTimeout(timeout)
  }, [visible, onDismiss, durationMs])

  if (!mounted || !visible) return null

  return createPortal(
    <div
      data-modal-layer-exempt
      data-premium-sheet-unlock-toast="true"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[130] flex flex-col gap-2"
    >
      <div
        role="status"
        className="animate-in slide-in-from-bottom-5 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground shadow-lg"
      >
        <p className="text-sm font-semibold">{PREMIUM_SHEET_PURCHASE_COPY.unlockToast}</p>
        {routineReady ? null : (
          <p className="text-sm opacity-80">
            {PREMIUM_SHEET_PURCHASE_COPY.unlockToastRoutinePending}
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}
