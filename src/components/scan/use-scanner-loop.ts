"use client"

import { useCallback, useEffect, useRef, type RefObject } from "react"

import { nextScanHint, type ScanHint, type ScanTelemetry } from "@/lib/scan/guidance"
import { validateEanInput } from "@/lib/scan/identifier-lookup"
import {
  advanceLoopClock,
  bumpLoopGeneration,
  createScanLoopController,
  isDetectionCurrent,
  isLoopPaused,
  nextLoopAction,
  setPauseReason,
  type PauseReason,
} from "@/lib/scan/scanner-loop"
import {
  applyRawDetection,
  createScanSessionState,
  noteEmptyDetection,
  restartScanSessionState,
  type ScanSessionState,
} from "@/lib/scan/scanner-session"

// Type-only import: erased at build time, so this does NOT pull the zxing-wasm ponyfill
// into the initial bundle. The runtime module is loaded via a dynamic `import()` in
// `defaultDetectorFactory`, only after camera permission has been granted.
import type { DetectedBarcode } from "barcode-detector/ponyfill"

export type { PauseReason }

export type ScanUnavailableReason = "no_camera" | "denied" | "insecure"

/** The slice of `BarcodeDetector` the loop uses — narrow so tests can stand in for it. */
export type ScanBarcodeDetector = {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>
}

/**
 * Seams for driving the loop without a real camera (Playwright, harnesses). Both default
 * to the production implementations, so `<Scanner />` with no `runtime` behaves exactly
 * as it always has.
 */
export type ScannerRuntime = {
  /** Defaults to `getUserMedia({ video: { facingMode: "environment" }, audio: false })`. */
  mediaSource?: () => Promise<MediaStream>
  /** Defaults to the lazy `barcode-detector/ponyfill` import + same-origin wasm override. */
  detectorFactory?: () => Promise<ScanBarcodeDetector>
}

export type UseScannerLoopArgs = {
  /** Parent controls the camera lifecycle: nothing is acquired or decoded while false. */
  active: boolean
  /** Bump to start a fresh scan attempt on the same, still-running camera. */
  sessionEpoch: number
  /** Pause the detection loop (not the camera) while a sheet covers the viewfinder. */
  detectionPaused: boolean
  runtime?: ScannerRuntime
  videoRef: RefObject<HTMLVideoElement | null>
  onDecoded: (value: string) => void
  onUnavailable: (reason: ScanUnavailableReason) => void
  /** Fires once per attempt after 3s of *active* scanning without a stable read. */
  onTimeout: () => void
  /** The stream died and could not be re-acquired — the viewfinder is dead (F8). */
  onStalled: () => void
  onHint: (hint: ScanHint) => void
  /** A stable decode was accepted; the component shows the green confirm state. */
  onConfirm: () => void
  /**
   * A fresh scan attempt started (mount, or an `sessionEpoch` bump). The component
   * resets its pill back to the default hint and drops any confirm state. Owned by the
   * hook because the hook is what actually restarts the session.
   */
  onAttemptStart: () => void
}

// EAN-only per the resolve API's identifier scope (Task 5).
const DETECTOR_FORMATS = ["ean_13", "ean_8"] as const

const DETECTION_FRAME_INTERVAL = 3 // run detection on ~every 3rd frame callback
const ROTATION_RETRY_INTERVAL = 5 // every ~5th detection attempt with no raw hit, try rotated
const LUMA_SAMPLE_INTERVAL_MS = 500 // ~2x/second
const LUMA_SAMPLE_SIZE = 16

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

function defaultMediaSource(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false,
  })
}

async function defaultDetectorFactory(): Promise<ScanBarcodeDetector> {
  // Lazy-loaded only after permission is granted (bundle-size boundary — see report).
  const ponyfill = await import("barcode-detector/ponyfill")
  if (!zxingWasmOverrideConfigured) {
    ponyfill.setZXingModuleOverrides({ locateFile: () => ZXING_READER_WASM_PATH })
    zxingWasmOverrideConfigured = true
  }
  return new ponyfill.BarcodeDetector({ formats: [...DETECTOR_FORMATS] })
}

function ensureCanvas(ref: { current: HTMLCanvasElement | null }): HTMLCanvasElement {
  if (!ref.current) ref.current = document.createElement("canvas")
  return ref.current
}

/** The current frame turned 90°, for the periodic retry on vertically-held barcodes. */
function getRotatedFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): HTMLCanvasElement | null {
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) return null
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

/** Mean luma of a 16×16 downscale of the current frame, or null if it can't be read. */
function sampleMeanLuma(video: HTMLVideoElement, canvas: HTMLCanvasElement): number | null {
  canvas.width = LUMA_SAMPLE_SIZE
  canvas.height = LUMA_SAMPLE_SIZE
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, LUMA_SAMPLE_SIZE, LUMA_SAMPLE_SIZE)
  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, LUMA_SAMPLE_SIZE, LUMA_SAMPLE_SIZE).data
  } catch {
    // Tainted canvas: keep the previous reading rather than claiming darkness.
    return null
  }
  let sum = 0
  const pixelCount = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  return pixelCount > 0 ? sum / pixelCount : null
}

function updateLumaIfDue(
  session: ScanSessionState,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  now: number,
): void {
  if (video.readyState < 2) return
  if (now - session.lastLumaSampleTime < LUMA_SAMPLE_INTERVAL_MS) return
  session.lastLumaSampleTime = now
  const luma = sampleMeanLuma(video, canvas)
  if (luma !== null) session.meanLuma = luma
}

function updateHint(
  session: ScanSessionState,
  now: number,
  onHint: (hint: ScanHint) => void,
): void {
  const telemetry: ScanTelemetry = {
    msSinceStart: now - session.startTime,
    msSinceLastDetection: now - session.lastDetectionTime,
    lastBoundingBoxRatio: session.lastBoundingBoxRatio,
    meanLuma: session.meanLuma,
    rawDetectionsWithoutStableRead: session.rawDetectionsWithoutStableRead,
  }
  const next = nextScanHint(telemetry, {
    currentHint: session.hint,
    msSinceLastHintChange: now - session.hintChangedAt,
  })
  if (next === null) return
  session.hint = next
  session.hintChangedAt = now
  onHint(next)
}

/**
 * The camera + detection lifecycle behind `<Scanner />`, with exactly one owner for the
 * frame loop.
 *
 * Everything that used to schedule frames from four different places now goes through
 * `syncLoop()`, which is the only function in the app allowed to call
 * `requestVideoFrameCallback` / `requestAnimationFrame`. Whether a frame may be
 * outstanding at all is decided by the pure controller in `@/lib/scan/scanner-loop`
 * (tested in `tests/scan-scanner-loop.test.ts`), and whether a decode counts is decided
 * by the pure state machine in `@/lib/scan/scanner-session`. What is left here is the
 * browser wiring: the stream, the listeners, and the recovery paths.
 */
export function useScannerLoop({
  active,
  sessionEpoch,
  detectionPaused,
  runtime,
  videoRef,
  onDecoded,
  onUnavailable,
  onTimeout,
  onStalled,
  onHint,
  onConfirm,
  onAttemptStart,
}: UseScannerLoopArgs): void {
  const sessionRef = useRef(createScanSessionState())
  const controllerRef = useRef(createScanLoopController())
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<ScanBarcodeDetector | null>(null)
  const frameHandleRef = useRef<number | null>(null)
  const frameKindRef = useRef<"rvfc" | "raf" | null>(null)
  const lumaCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const rotationCanvasRef = useRef<HTMLCanvasElement | null>(null)
  // `syncLoop` schedules the tick, and the tick re-syncs the loop. The indirection keeps
  // that from becoming a `useCallback` cycle.
  const tickRef = useRef<() => void>(() => {})

  // Latest props, so the long-lived camera effect never closes over a stale callback.
  const latestRef = useRef({
    runtime,
    onDecoded,
    onUnavailable,
    onTimeout,
    onStalled,
    onHint,
    onConfirm,
    onAttemptStart,
  })
  useEffect(() => {
    latestRef.current = {
      runtime,
      onDecoded,
      onUnavailable,
      onTimeout,
      onStalled,
      onHint,
      onConfirm,
      onAttemptStart,
    }
  }, [runtime, onDecoded, onUnavailable, onTimeout, onStalled, onHint, onConfirm, onAttemptStart])

  /**
   * The one place frames are scheduled or cancelled. Idempotent by construction: it acts
   * on `nextLoopAction`, so calling it twice never leaves two frames outstanding and
   * calling it while paused never resurrects the loop (F10).
   */
  const syncLoop = useCallback(() => {
    const controller = controllerRef.current
    const action = nextLoopAction(controller)
    if (action === "noop") return

    const video = videoRef.current
    if (action === "cancel") {
      const handle = frameHandleRef.current
      if (handle !== null) {
        if (frameKindRef.current === "rvfc" && video?.cancelVideoFrameCallback) {
          video.cancelVideoFrameCallback(handle)
        } else if (frameKindRef.current === "raf") {
          cancelAnimationFrame(handle)
        }
      }
      frameHandleRef.current = null
      frameKindRef.current = null
      controller.frameScheduled = false
      return
    }

    if (!video) return
    const runFrame = () => {
      // The handle is consumed the moment the callback fires, so the tick's own
      // `syncLoop()` continuation schedules the next one instead of being a no-op.
      frameHandleRef.current = null
      frameKindRef.current = null
      controllerRef.current.frameScheduled = false
      tickRef.current()
    }
    if (typeof video.requestVideoFrameCallback === "function") {
      frameKindRef.current = "rvfc"
      frameHandleRef.current = video.requestVideoFrameCallback(() => runFrame())
    } else {
      frameKindRef.current = "raf"
      frameHandleRef.current = requestAnimationFrame(() => runFrame())
    }
    controller.frameScheduled = true
  }, [videoRef])

  /**
   * One `detect()` pass. `generation` is captured before the await; if the loop paused,
   * restarted or tore down while the detector was working, the results are dropped whole
   * — no session mutation, no callbacks — because they describe a frame from a scanning
   * moment the user has already left (F3).
   */
  const runDetectionCycle = useCallback(
    async (generation: number) => {
      const video = videoRef.current
      const detector = detectorRef.current
      const session = sessionRef.current
      if (!video || !detector || session.detecting) return
      session.detecting = true
      try {
        let results: DetectedBarcode[] = []
        try {
          results = await detector.detect(video)
        } catch {
          results = []
        }
        if (!isDetectionCurrent(controllerRef.current, generation)) return

        session.detectionAttempts += 1
        if (results.length === 0 && session.detectionAttempts % ROTATION_RETRY_INTERVAL === 0) {
          const rotated = getRotatedFrame(video, ensureCanvas(rotationCanvasRef))
          if (rotated) {
            try {
              const rotatedResults = await detector.detect(rotated)
              if (rotatedResults.length > 0) results = rotatedResults
            } catch {
              // Rotation retry is best-effort; ignore failures.
            }
          }
        }
        if (!isDetectionCurrent(controllerRef.current, generation)) return

        if (results.length === 0) {
          // Counts towards the D6 re-arm: three empty attempts mean the barcode really
          // left the frame, which is what releases a blocked value.
          noteEmptyDetection(session)
          return
        }

        const primary = results[0]
        const frameArea = video.videoWidth * video.videoHeight
        const { fire } = applyRawDetection(
          session,
          {
            rawValue: primary.rawValue,
            boundingBoxRatio:
              frameArea > 0
                ? (primary.boundingBox.width * primary.boundingBox.height) / frameArea
                : null,
            now: performance.now(),
          },
          validateEanInput,
        )
        if (fire !== null) {
          latestRef.current.onConfirm()
          latestRef.current.onDecoded(fire)
        }
      } finally {
        session.detecting = false
      }
    },
    [videoRef],
  )

  const tick = useCallback(() => {
    const controller = controllerRef.current
    if (isLoopPaused(controller)) return
    const session = sessionRef.current
    const generation = controller.generation
    session.frameCounter += 1

    const finish = () => {
      const video = videoRef.current
      // A continuation that lost its generation (pause, epoch restart, teardown) stops
      // here: whoever bumped the generation owns re-syncing the loop.
      if (!video || !isDetectionCurrent(controllerRef.current, generation)) return
      // Read `now` AFTER the awaited detection — the old loop reused a pre-await
      // timestamp, so a slow decode under-reported both the hint window and the clock.
      const now = performance.now()
      updateLumaIfDue(session, video, ensureCanvas(lumaCanvasRef), now)
      updateHint(session, now, latestRef.current.onHint)
      if (advanceLoopClock(controllerRef.current, session, now).timedOut) {
        latestRef.current.onTimeout()
      }
      syncLoop()
    }

    if (session.frameCounter % DETECTION_FRAME_INTERVAL === 0) {
      void runDetectionCycle(generation).then(finish)
    } else {
      finish()
    }
  }, [runDetectionCycle, syncLoop, videoRef])

  useEffect(() => {
    tickRef.current = tick
  }, [tick])

  useEffect(() => {
    if (!active) return
    const controller = controllerRef.current

    let cancelled = false
    let recovering = false
    let stalled = false
    let trackMuted = false
    let pageListenersAttached = false
    let watchedTracks: MediaStreamTrack[] = []

    // Session start: one reset point for every mutable field a prior session could have
    // left in a non-default state (dedupe/debounce counters, hint, telemetry).
    sessionRef.current = createScanSessionState()
    controller.running = false
    controller.lastTickAt = null
    bumpLoopGeneration(controller)
    setPauseReason(controller, "hidden", document.visibilityState === "hidden")

    function stopLoop() {
      controller.running = false
      bumpLoopGeneration(controller)
      syncLoop()
    }

    function handleTrackEnded() {
      void recover()
    }

    function handleTrackMuted() {
      trackMuted = true
      // A track that mutes while the page is in front has really stopped delivering
      // frames (another app grabbed the camera, permission revoked): re-acquire now. A
      // mute while hidden is ordinary backgrounding — that one is handled on the way back
      // in `handleVisibilityChange`.
      if (document.visibilityState === "visible") void recover()
    }

    function handleTrackUnmuted() {
      trackMuted = false
    }

    function watchTracks(stream: MediaStream) {
      watchedTracks = stream.getVideoTracks()
      for (const track of watchedTracks) {
        track.addEventListener("ended", handleTrackEnded)
        track.addEventListener("mute", handleTrackMuted)
        track.addEventListener("unmute", handleTrackUnmuted)
      }
    }

    function releaseStream() {
      for (const track of watchedTracks) {
        track.removeEventListener("ended", handleTrackEnded)
        track.removeEventListener("mute", handleTrackMuted)
        track.removeEventListener("unmute", handleTrackUnmuted)
      }
      watchedTracks = []
      trackMuted = false
      const stream = streamRef.current
      streamRef.current = null
      stream?.getTracks().forEach((track) => track.stop())
      const video = videoRef.current
      if (video?.srcObject) video.srcObject = null
    }

    function resumePlayback() {
      const video = videoRef.current
      if (!video) return
      // F8(a): a `play()` rejected at start (autoplay blocked before any user gesture,
      // or the tab was never in front) gets its retry here. `play()` on an already
      // playing element resolves immediately, so this is safe on every resume (F8c).
      void video.play().catch(() => {})
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        setPauseReason(controller, "hidden", true)
        syncLoop()
        return
      }
      setPauseReason(controller, "hidden", false)
      if (trackMuted) {
        // Backgrounding muted the track and it never came back: the stream is gone.
        void recover()
        return
      }
      resumePlayback()
      syncLoop()
    }

    function handlePageShow(event: PageTransitionEvent) {
      // A bfcache restore hands back a page whose MediaStream tracks are already dead.
      if (event.persisted) {
        void recover()
        return
      }
      resumePlayback()
      syncLoop()
    }

    function attachPageListeners() {
      if (pageListenersAttached) return
      pageListenersAttached = true
      document.addEventListener("visibilitychange", handleVisibilityChange)
      window.addEventListener("pageshow", handlePageShow)
    }

    async function acquire(reportUnavailable: boolean): Promise<boolean> {
      if (typeof window === "undefined") return false
      const { runtime: currentRuntime } = latestRef.current
      if (!window.isSecureContext) {
        if (reportUnavailable) latestRef.current.onUnavailable("insecure")
        return false
      }
      const mediaSource = currentRuntime?.mediaSource
      if (!mediaSource && !navigator.mediaDevices?.getUserMedia) {
        if (reportUnavailable) latestRef.current.onUnavailable("no_camera")
        return false
      }

      let stream: MediaStream
      try {
        stream = await (mediaSource ?? defaultMediaSource)()
      } catch (err) {
        if (cancelled) return false
        if (reportUnavailable) {
          const name = err instanceof DOMException ? err.name : ""
          const denied = name === "NotAllowedError" || name === "SecurityError"
          latestRef.current.onUnavailable(denied ? "denied" : "no_camera")
        }
        return false
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return false
      }

      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach((track) => track.stop())
        return false
      }
      streamRef.current = stream
      watchTracks(stream)
      video.srcObject = stream
      try {
        await video.play()
      } catch {
        // Autoplay can be blocked without a user gesture; playsInline+muted covers the
        // common iOS case, and `resumePlayback` retries on the next resume (F8a).
      }
      // From here on the stream is ours, so every bail-out has to hand it back: teardown
      // may have run while an await was pending, and its `releaseStream()` saw nothing.
      if (cancelled) {
        releaseStream()
        return false
      }

      // Kept across a re-acquire: the detector is stateless and re-creating it would
      // re-enter the wasm module for nothing.
      if (!detectorRef.current) {
        let detector: ScanBarcodeDetector
        try {
          detector = await (currentRuntime?.detectorFactory ?? defaultDetectorFactory)()
        } catch {
          releaseStream()
          if (cancelled) return false
          // The camera works but nothing can decode: same dead end for the user as no
          // camera at all, so the flow falls back to the search sheet.
          if (reportUnavailable) latestRef.current.onUnavailable("no_camera")
          return false
        }
        if (cancelled) {
          releaseStream()
          return false
        }
        detectorRef.current = detector
      }
      return true
    }

    function beginLoop() {
      const session = sessionRef.current
      const now = performance.now()
      session.startTime = now
      session.lastDetectionTime = now
      session.hintChangedAt = now
      controller.lastTickAt = null
      controller.running = true
      bumpLoopGeneration(controller)
      attachPageListeners()
      syncLoop()
    }

    /**
     * F8: the stream died (track ended/muted, bfcache restore). Tear it down and try to
     * get a new one exactly once per stall; a failure is terminal for this camera cycle
     * and surfaces as `onStalled` so the flow can offer a retry instead of showing a
     * frozen viewfinder forever. The session is deliberately NOT reset — the same scan
     * attempt continues, keeping the D6 block that stops a re-scan of the last product.
     */
    async function recover() {
      if (cancelled || recovering || stalled) return
      recovering = true
      try {
        stopLoop()
        releaseStream()
        const acquired = await acquire(false)
        if (cancelled) return
        if (!acquired) {
          stalled = true
          latestRef.current.onStalled()
          return
        }
        beginLoop()
      } finally {
        recovering = false
      }
    }

    async function start() {
      const acquired = await acquire(true)
      if (cancelled || !acquired) return
      beginLoop()
    }

    void start()

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("pageshow", handlePageShow)
      pageListenersAttached = false
      stopLoop()
      releaseStream()
      detectorRef.current = null
      controller.pauseReasons.clear()
      controller.lastTickAt = null
    }
  }, [active, syncLoop, videoRef])

  /**
   * Sheet open/close. Only the detection loop is affected — the stream and the video
   * element are untouched, so nothing has to be re-acquired on resume.
   */
  useEffect(() => {
    if (!active) return
    setPauseReason(controllerRef.current, "sheet", detectionPaused)
    syncLoop()
  }, [active, detectionPaused, syncLoop])

  /**
   * Session restart without a camera restart. The camera effect keys only on `active`,
   * which stays true for the whole `/scan` visit (the sheet slides up *over* a running
   * camera so "Nochmal scannen" is instant), so the scan-attempt guards are reset in
   * place here on every epoch bump.
   */
  useEffect(() => {
    if (!active) return
    const controller = controllerRef.current
    restartScanSessionState(sessionRef.current, performance.now())
    bumpLoopGeneration(controller)
    controller.lastTickAt = null
    latestRef.current.onAttemptStart()
    syncLoop()
  }, [active, sessionEpoch, syncLoop])
}
