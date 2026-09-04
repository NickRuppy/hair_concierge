"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  SCAN_CONFIRM_LABEL,
  SCAN_HINT_DEFAULT,
  nextScanHint,
  type ScanHint,
  type ScanTelemetry,
} from "@/lib/scan/guidance"
import { validateEanInput } from "@/lib/scan/identifier-lookup"
import { createScanSessionState, restartScanSessionState } from "@/lib/scan/scanner-session"
import { cn } from "@/lib/utils"

// Type-only import: erased at build time, so this does NOT pull the zxing-wasm ponyfill
// into the initial bundle. The runtime module is loaded via a dynamic `import()` inside
// the effect below, only after camera permission has been granted.
import type { BarcodeDetector, DetectedBarcode } from "barcode-detector/ponyfill"

export type ScanUnavailableReason = "no_camera" | "denied" | "insecure"

export type ScanDecodedIdentifier = { type: "ean"; value: string }

type ScannerProps = {
  /** Parent controls camera lifecycle: mount/permission/detection only run while true. */
  active: boolean
  /**
   * Bump to start a fresh scan attempt on the same, still-running camera: the parent does
   * this every time the flow returns to scanning (see `ScanFlow`'s `returnToScanning`).
   * Without it a page that has resolved one product keeps that session's `lastFiredValue`
   * / `hasDecoded` / `timeoutFired` guards forever and the next scan never fires.
   */
  sessionEpoch?: number
  /**
   * Pause the DETECTION LOOP (not the camera) while a sheet covers the viewfinder. The
   * stream stays live so reopening the scanner is instant; only the per-frame decode work
   * stops, and it resumes the moment the sheet closes.
   */
  detectionPaused?: boolean
  onDecoded: (identifier: ScanDecodedIdentifier) => void
  onUnavailable: (reason: ScanUnavailableReason) => void
  /** Fires once, ~3s after start, if no stable read has happened yet. Scanner keeps running. */
  onTimeout: () => void
}

// EAN-only per the resolve API's identifier scope (Task 5).
const DETECTOR_FORMATS = ["ean_13", "ean_8"] as const

const DETECTION_FRAME_INTERVAL = 3 // run detection on ~every 3rd frame callback
const ROTATION_RETRY_INTERVAL = 5 // every ~5th detection attempt with no raw hit, try rotated
const STABLE_READ_REQUIRED_MATCHES = 2
const SCAN_TIMEOUT_MS = 3000
const LUMA_SAMPLE_INTERVAL_MS = 500 // ~2x/second
const LUMA_SAMPLE_SIZE = 16
// Decode-confirm moment (Variante A): corners + pill turn green for this long before the
// sheet slides up. Mirrors `SCAN_CONFIRM_DELAY_MS` in scan-flow.tsx — the flow delays the
// sheet by the same amount so the confirmation is actually visible.
const CONFIRM_DURATION_MS = 400

// Self-hosted zxing-wasm reader binary. `barcode-detector`'s default `locateFile`
// fetches this from https://fastly.jsdelivr.net/npm/zxing-wasm@<version>/... at runtime —
// we override it so no request ever leaves our origin. MUST stay pinned to the exact
// zxing-wasm version `barcode-detector` depends on (currently zxing-wasm@3.1.3, via
// barcode-detector@3.2.2 — see package.json). The file was copied verbatim from
// `node_modules/zxing-wasm/dist/reader/zxing_reader.wasm` (sha256
// 2ebda08a93eea3efcd8399cda6b276e6a0b1de4fec60b4d8988a047de4c6d1ba, matching the
// package's own exported `ZXING_WASM_SHA256`) into `public/wasm/`. When either package
// bumps its zxing-wasm version: re-copy the file, keep the version in the filename (so a
// stale cached copy can never be served from a URL that also serves the new one), and
// update this constant.
const ZXING_READER_WASM_PATH = "/wasm/zxing_reader-3.1.3.wasm"

// Module-scope, not per-session: the override only needs to be registered once for the
// page's lifetime (zxing-wasm caches it internally), so repeated scan sessions on the
// same page load don't need to redo this.
let zxingWasmOverrideConfigured = false

export function Scanner({
  active,
  sessionEpoch = 0,
  detectionPaused = false,
  onDecoded,
  onUnavailable,
  onTimeout,
}: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const lumaCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const rotationCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetector | null>(null)
  const frameHandleRef = useRef<number | null>(null)
  const frameKindRef = useRef<"rvfc" | "raf" | null>(null)

  // All per-session mutable state lives in one object, reset in one place at the start
  // of every session (see `createScanSessionState`) — see task-7-report.md fix round 1
  // for the bug class this closes (stale `paused`/`lastFiredValue`/etc. across a
  // close→reopen or a background/visibility cycle).
  const sessionRef = useRef(createScanSessionState())
  // Latest prop value, so a session that starts while a sheet is already open begins paused.
  const detectionPausedRef = useRef(detectionPaused)
  detectionPausedRef.current = detectionPaused
  // Set by the camera effect; the pause effect below drives the same loop without owning it.
  const loopControlRef = useRef<{ schedule: () => void; cancel: () => void } | null>(null)

  const [hint, setHint] = useState<ScanHint>(SCAN_HINT_DEFAULT)
  const [confirmActive, setConfirmActive] = useState(false)
  // The confirm-off timeout is owned here so an epoch reset or a newer decode cancels
  // the stale callback — otherwise a previous scan's timer clears the new confirm early.
  const confirmTimerRef = useRef<number | null>(null)
  const clearConfirmTimer = useCallback(() => {
    if (confirmTimerRef.current !== null) window.clearTimeout(confirmTimerRef.current)
    confirmTimerRef.current = null
  }, [])

  // Latest-callback refs so the detection loop (set up once per `active` toggle) never
  // closes over a stale prop.
  const onDecodedRef = useRef(onDecoded)
  const onUnavailableRef = useRef(onUnavailable)
  const onTimeoutRef = useRef(onTimeout)
  useEffect(() => {
    onDecodedRef.current = onDecoded
  }, [onDecoded])
  useEffect(() => {
    onUnavailableRef.current = onUnavailable
  }, [onUnavailable])
  useEffect(() => {
    onTimeoutRef.current = onTimeout
  }, [onTimeout])

  useEffect(() => {
    if (!active) return
    let cancelled = false

    // Session start: one reset point for every mutable field a prior session could have
    // left in a non-default state (paused, dedupe/debounce counters, hint, telemetry).
    sessionRef.current = createScanSessionState()
    sessionRef.current.sheetPaused = detectionPausedRef.current
    setHint(SCAN_HINT_DEFAULT)
    setConfirmActive(false)

    const session = sessionRef.current

    function scheduleFrame() {
      const video = videoRef.current
      if (!video || cancelled || session.paused || session.sheetPaused) return
      if (typeof video.requestVideoFrameCallback === "function") {
        frameKindRef.current = "rvfc"
        frameHandleRef.current = video.requestVideoFrameCallback(() => tick())
      } else {
        frameKindRef.current = "raf"
        frameHandleRef.current = requestAnimationFrame(() => tick())
      }
    }

    function cancelFrame() {
      const video = videoRef.current
      if (frameHandleRef.current == null) return
      if (frameKindRef.current === "rvfc" && video?.cancelVideoFrameCallback) {
        video.cancelVideoFrameCallback(frameHandleRef.current)
      } else if (frameKindRef.current === "raf") {
        cancelAnimationFrame(frameHandleRef.current)
      }
      frameHandleRef.current = null
    }

    function getRotatedFrame(video: HTMLVideoElement): HTMLCanvasElement | null {
      const w = video.videoWidth
      const h = video.videoHeight
      if (!w || !h) return null
      let canvas = rotationCanvasRef.current
      if (!canvas) {
        canvas = document.createElement("canvas")
        rotationCanvasRef.current = canvas
      }
      canvas.width = h
      canvas.height = w
      const ctx = canvas.getContext("2d")
      if (!ctx) return null
      ctx.save()
      ctx.translate(h / 2, w / 2)
      ctx.rotate(Math.PI / 2)
      ctx.drawImage(video, -w / 2, -h / 2, w, h)
      ctx.restore()
      return canvas
    }

    function fireStableDecode(value: string) {
      session.hasDecoded = true
      session.rawDetectionsWithoutStableRead = 0
      session.lastRawValue = null
      session.consecutiveMatch = 0
      clearConfirmTimer()
      setConfirmActive(true)
      confirmTimerRef.current = window.setTimeout(() => {
        confirmTimerRef.current = null
        setConfirmActive(false)
      }, CONFIRM_DURATION_MS)
      onDecodedRef.current({ type: "ean", value })
    }

    function handleRawDetections(results: DetectedBarcode[], video: HTMLVideoElement) {
      const now = performance.now()
      session.lastDetectionTime = now

      const primary = results[0]
      const frameArea = video.videoWidth * video.videoHeight
      session.lastBoundingBoxRatio =
        frameArea > 0 ? (primary.boundingBox.width * primary.boundingBox.height) / frameArea : null

      const rawValue = primary.rawValue
      if (rawValue === session.lastRawValue) {
        session.consecutiveMatch += 1
      } else {
        session.lastRawValue = rawValue
        session.consecutiveMatch = 1
      }

      session.rawDetectionsWithoutStableRead += 1

      if (session.consecutiveMatch >= STABLE_READ_REQUIRED_MATCHES) {
        const validated = validateEanInput(rawValue)
        if (validated.ok && session.lastFiredValue !== validated.value) {
          session.lastFiredValue = validated.value
          fireStableDecode(validated.value)
        }
        // Reset the streak either way: an invalid-checksum read still needs to re-earn
        // two fresh consecutive matches before we try validating again (cheap, avoids
        // revalidating a stationary bad read every single frame).
        session.consecutiveMatch = 0
      }
    }

    async function ensureLocalWasmOverride() {
      if (zxingWasmOverrideConfigured) return
      const { setZXingModuleOverrides } = await import("barcode-detector/ponyfill")
      setZXingModuleOverrides({ locateFile: () => ZXING_READER_WASM_PATH })
      zxingWasmOverrideConfigured = true
    }

    async function runDetectionCycle() {
      const video = videoRef.current
      const detector = detectorRef.current
      if (!video || !detector || session.detecting) return
      session.detecting = true
      try {
        let results: DetectedBarcode[] = []
        try {
          results = await detector.detect(video)
        } catch {
          results = []
        }

        session.detectionAttempts += 1
        const noRawHit = results.length === 0
        if (noRawHit && session.detectionAttempts % ROTATION_RETRY_INTERVAL === 0) {
          const rotated = getRotatedFrame(video)
          if (rotated) {
            try {
              const rotatedResults = await detector.detect(rotated)
              if (rotatedResults.length > 0) results = rotatedResults
            } catch {
              // Rotation retry is best-effort; ignore failures.
            }
          }
        }

        // Re-check after the await points: teardown (unmount / `active` -> false) can
        // land while `detect()` is in flight, and a late resolution must not mutate a
        // torn-down session's state or fire callbacks into a session that no longer exists.
        if (cancelled) return
        if (results.length > 0) handleRawDetections(results, video)
      } finally {
        session.detecting = false
      }
    }

    function updateLumaIfDue(now: number) {
      const video = videoRef.current
      const canvas = lumaCanvasRef.current
      if (!video || !canvas || video.readyState < 2) return
      if (now - session.lastLumaSampleTime < LUMA_SAMPLE_INTERVAL_MS) return
      session.lastLumaSampleTime = now
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) return
      ctx.drawImage(video, 0, 0, LUMA_SAMPLE_SIZE, LUMA_SAMPLE_SIZE)
      let data: Uint8ClampedArray
      try {
        data = ctx.getImageData(0, 0, LUMA_SAMPLE_SIZE, LUMA_SAMPLE_SIZE).data
      } catch {
        return
      }
      let sum = 0
      const pixelCount = data.length / 4
      for (let i = 0; i < data.length; i += 4) {
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      }
      session.meanLuma = pixelCount > 0 ? sum / pixelCount : null
    }

    function updateHint(now: number) {
      const telemetry: ScanTelemetry = {
        msSinceStart: now - session.startTime,
        msSinceLastDetection: now - session.lastDetectionTime,
        lastBoundingBoxRatio: session.lastBoundingBoxRatio,
        meanLuma: session.meanLuma,
        rawDetectionsWithoutStableRead: session.rawDetectionsWithoutStableRead,
      }
      const result = nextScanHint(telemetry, {
        currentHint: session.hint,
        msSinceLastHintChange: now - session.hintChangedAt,
      })
      if (result !== null) {
        session.hint = result
        session.hintChangedAt = now
        setHint(result)
      }
    }

    function checkTimeout(now: number) {
      if (session.timeoutFired || session.hasDecoded) return
      if (now - session.startTime >= SCAN_TIMEOUT_MS) {
        session.timeoutFired = true
        onTimeoutRef.current()
      }
    }

    function tick() {
      if (cancelled || session.paused || session.sheetPaused) return
      const now = performance.now()
      session.frameCounter += 1
      const dueForDetection = session.frameCounter % DETECTION_FRAME_INTERVAL === 0

      const afterDetection = () => {
        if (cancelled) return
        updateLumaIfDue(now)
        updateHint(now)
        checkTimeout(now)
        scheduleFrame()
      }

      if (dueForDetection) {
        void runDetectionCycle().then(afterDetection)
      } else {
        afterDetection()
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        session.paused = true
        cancelFrame()
      } else if (session.paused) {
        session.paused = false
        // `scheduleFrame` re-checks `sheetPaused` itself, so a sheet open across the
        // background/foreground cycle keeps the loop stopped.
        scheduleFrame()
      }
    }

    async function start() {
      if (typeof window === "undefined") return
      if (!window.isSecureContext) {
        onUnavailableRef.current("insecure")
        return
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        onUnavailableRef.current("no_camera")
        return
      }

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        })
      } catch (err) {
        if (cancelled) return
        const name = err instanceof DOMException ? err.name : ""
        if (name === "NotAllowedError" || name === "SecurityError") {
          onUnavailableRef.current("denied")
        } else {
          onUnavailableRef.current("no_camera")
        }
        return
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream

      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      video.srcObject = stream
      try {
        await video.play()
      } catch {
        // Autoplay can be blocked without a user gesture; playsInline+muted covers the
        // common iOS case, and detection just starts once play() eventually resolves.
      }
      if (cancelled) return

      // Lazy-load the WASM-backed ponyfill only after permission is granted (bundle-size
      // boundary — see report). Registering the same-origin wasm override before the
      // first `detect()` call ensures zxing-wasm never falls back to fetching from jsDelivr.
      await ensureLocalWasmOverride()
      if (cancelled) return
      const { BarcodeDetector: BarcodeDetectorCtor } = await import("barcode-detector/ponyfill")
      if (cancelled) return
      detectorRef.current = new BarcodeDetectorCtor({ formats: [...DETECTOR_FORMATS] })

      const now = performance.now()
      session.startTime = now
      session.lastDetectionTime = now
      session.hintChangedAt = now

      document.addEventListener("visibilitychange", handleVisibilityChange)
      loopControlRef.current = { schedule: scheduleFrame, cancel: cancelFrame }
      scheduleFrame()
    }

    void start()

    return () => {
      cancelled = true
      loopControlRef.current = null
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      cancelFrame()
      const stream = streamRef.current
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      detectorRef.current = null
    }
  }, [active])

  /**
   * Sheet open/close. Only the detection loop is affected — `getUserMedia` and the video
   * element are untouched, so nothing has to be re-acquired on resume. Independent of the
   * `visibilitychange` pause: each reason owns its own flag, so closing a sheet in a
   * hidden tab does not restart the loop.
   */
  useEffect(() => {
    if (!active) return
    const session = sessionRef.current
    session.sheetPaused = detectionPaused
    if (detectionPaused) {
      loopControlRef.current?.cancel()
    } else if (!session.paused) {
      loopControlRef.current?.schedule()
    }
  }, [active, detectionPaused])

  /**
   * Session restart without a camera restart. The camera-acquisition effect further above
   * owns the camera and keys only on `active` — which stays `true` for the whole `/scan`
   * visit, because the sheet slides up *over* a still-running camera so "Nochmal scannen"
   * is instant. That leaves the session guards (`lastFiredValue`, `hasDecoded`,
   * `timeoutFired`) set for the rest of the page's life, so this second effect resets
   * them in place on every epoch bump.
   * Remounting the Scanner instead would re-run `getUserMedia` and blank the viewfinder
   * on every re-scan.
   */
  useEffect(() => {
    if (!active) return
    restartScanSessionState(sessionRef.current, performance.now())
    setHint(SCAN_HINT_DEFAULT)
    clearConfirmTimer()
    setConfirmActive(false)
    return clearConfirmTimer
  }, [active, sessionEpoch, clearConfirmTimer])

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

      {/* Off-screen luma sampling target, never shown */}
      <canvas
        ref={lumaCanvasRef}
        width={LUMA_SAMPLE_SIZE}
        height={LUMA_SAMPLE_SIZE}
        className="hidden"
        aria-hidden
      />
    </div>
  )
}
