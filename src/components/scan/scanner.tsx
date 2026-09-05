"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { SCAN_CONFIRM_LABEL, SCAN_HINT_DEFAULT, type ScanHint } from "@/lib/scan/guidance"
import { cn } from "@/lib/utils"

import { useScannerLoop, type ScanUnavailableReason, type ScannerRuntime } from "./use-scanner-loop"

export type { ScanUnavailableReason, ScannerRuntime }

export type ScanDecodedIdentifier = { type: "ean"; value: string }

type ScannerProps = {
  /** Parent controls camera lifecycle: mount/permission/detection only run while true. */
  active: boolean
  /**
   * Bump to start a fresh scan attempt on the same, still-running camera: the parent does
   * this every time the flow returns to scanning (see `ScanFlow`'s `returnToScanning`).
   */
  sessionEpoch?: number
  /**
   * Pause the DETECTION LOOP (not the camera) while a sheet covers the viewfinder. The
   * stream stays live so reopening the scanner is instant.
   */
  detectionPaused?: boolean
  /** Test seam for the camera + detector; production leaves it undefined. */
  runtime?: ScannerRuntime
  onDecoded: (identifier: ScanDecodedIdentifier) => void
  onUnavailable: (reason: ScanUnavailableReason) => void
  /** Fires once after 3s of active scanning without a stable read. Scanner keeps running. */
  onTimeout: () => void
  /** The camera stream died and could not be re-acquired — the viewfinder is frozen. */
  onStalled: () => void
}

// Decode-confirm moment (Variante A): corners + pill turn green for this long before the
// sheet slides up. Mirrors `SCAN_CONFIRM_DELAY_MS` in scan-flow.tsx — the flow delays the
// sheet by the same amount so the confirmation is actually visible.
const CONFIRM_DURATION_MS = 400

/**
 * The viewfinder. All camera and detection lifecycle lives in `useScannerLoop`; what is
 * left here is presentation: the hint pill, the green decode-confirm moment, and the
 * corner markers.
 */
export function Scanner({
  active,
  sessionEpoch = 0,
  detectionPaused = false,
  runtime,
  onDecoded,
  onUnavailable,
  onTimeout,
  onStalled,
}: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [hint, setHint] = useState<ScanHint>(SCAN_HINT_DEFAULT)
  const [confirmActive, setConfirmActive] = useState(false)
  // The confirm-off timeout is owned here so an epoch reset or a newer decode cancels the
  // stale callback — otherwise a previous scan's timer clears the new confirm early.
  const confirmTimerRef = useRef<number | null>(null)
  const clearConfirmTimer = useCallback(() => {
    if (confirmTimerRef.current !== null) window.clearTimeout(confirmTimerRef.current)
    confirmTimerRef.current = null
  }, [])

  const handleConfirm = useCallback(() => {
    clearConfirmTimer()
    setConfirmActive(true)
    confirmTimerRef.current = window.setTimeout(() => {
      confirmTimerRef.current = null
      setConfirmActive(false)
    }, CONFIRM_DURATION_MS)
  }, [clearConfirmTimer])

  // Every new scan attempt starts from the default pill and no confirm state. Driven by
  // the hook (which owns the session restart) rather than an effect on `sessionEpoch`.
  const handleAttemptStart = useCallback(() => {
    setHint(SCAN_HINT_DEFAULT)
    clearConfirmTimer()
    setConfirmActive(false)
  }, [clearConfirmTimer])

  const handleDecoded = useCallback(
    (value: string) => {
      onDecoded({ type: "ean", value })
    },
    [onDecoded],
  )

  useScannerLoop({
    active,
    sessionEpoch,
    detectionPaused,
    runtime,
    videoRef,
    onDecoded: handleDecoded,
    onUnavailable,
    onTimeout,
    onStalled,
    onHint: setHint,
    onConfirm: handleConfirm,
    onAttemptStart: handleAttemptStart,
  })

  // Unmount only: never leave a confirm timer pointing at a dead component.
  useEffect(() => clearConfirmTimer, [clearConfirmTimer])

  if (!active) return null

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />

      {/* Viewfinder corner markers — green + pulse during the decode-confirm moment */}
      <div
        className={cn(
          "pointer-events-none absolute inset-6 sm:inset-10",
          confirmActive && "motion-safe:animate-pulse",
        )}
        aria-hidden
      >
        {(
          [
            "left-0 top-0 rounded-tl-lg border-l-2 border-t-2",
            "right-0 top-0 rounded-tr-lg border-r-2 border-t-2",
            "bottom-0 left-0 rounded-bl-lg border-b-2 border-l-2",
            "bottom-0 right-0 rounded-br-lg border-b-2 border-r-2",
          ] as const
        ).map((corner) => (
          <span
            key={corner}
            className={cn(
              "absolute h-8 w-8 transition-colors",
              corner,
              confirmActive ? "border-[var(--status-ok-text)]" : "border-white/90",
            )}
          />
        ))}
      </div>

      {/* Hint pill / decode-confirm pill */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-6">
        <span
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium text-white backdrop-blur-sm",
            confirmActive ? "bg-[var(--status-ok-text)] font-semibold" : "bg-black/70",
          )}
          aria-live="polite"
        >
          {confirmActive ? `✓ ${SCAN_CONFIRM_LABEL}` : hint}
        </span>
      </div>
    </div>
  )
}
