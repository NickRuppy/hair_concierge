import { advanceActiveClock, shouldFireTimeout, type ScanSessionState } from "./scanner-session"

/**
 * Why the detection loop is not running right now. Tracked as a *set* rather than the
 * two booleans the component used to carry, so the reasons can never clear each other:
 * closing a sheet in a hidden tab must not restart the loop, and a tab coming back to
 * the foreground behind an open sheet must not either.
 */
export type PauseReason = "hidden" | "sheet"

/**
 * Everything `useScannerLoop` needs to decide what the frame loop should do next, with
 * no DOM in it. The hook owns the actual `requestVideoFrameCallback` handle; this object
 * owns the *decisions*, which is what makes them testable (findings F2, F3, F10).
 */
export type ScanLoopController = {
  /** The camera started successfully and teardown has not run. */
  running: boolean
  pauseReasons: Set<PauseReason>
  /** A frame callback is outstanding. Kept in lockstep with the hook's handle ref. */
  frameScheduled: boolean
  /**
   * Bumped on every pause change, epoch restart and teardown. A detection cycle captures
   * this before `await detect()` and drops its results on arrival if it no longer
   * matches — otherwise a decode from a frame captured before the sheet opened lands
   * afterwards and fires a scan the user never aimed (F3).
   */
  generation: number
  /** Timestamp of the last tick that actually ran, or `null` while there is no anchor. */
  lastTickAt: number | null
}

/**
 * Largest gap a single tick may contribute to the active clock. Frame callbacks stop
 * firing during throttling, a slow `detect()` or a device wake-up, so an uncapped delta
 * would let one 30s stall spend the whole 3s search-fallback budget at once.
 */
export const MAX_TICK_DELTA_MS = 250

export function createScanLoopController(): ScanLoopController {
  return {
    running: false,
    pauseReasons: new Set<PauseReason>(),
    frameScheduled: false,
    generation: 1,
    lastTickAt: null,
  }
}

/** No frames should be running: the camera is not live, or something covers/hides it. */
export function isLoopPaused(controller: ScanLoopController): boolean {
  return !controller.running || controller.pauseReasons.size > 0
}

/**
 * The single scheduling decision. `syncLoop()` is the only caller, which is what enforces
 * "at most one outstanding frame": every place that used to call `scheduleFrame()`
 * directly (the pause effect, the visibility handler, the post-detection continuation)
 * now asks this instead, and a redundant ask is a no-op rather than a second frame (F10).
 */
export function nextLoopAction(controller: ScanLoopController): "schedule" | "cancel" | "noop" {
  if (isLoopPaused(controller)) return controller.frameScheduled ? "cancel" : "noop"
  return controller.frameScheduled ? "noop" : "schedule"
}

/**
 * Add or remove one pause reason. Returns whether the set actually changed; a real change
 * also invalidates in-flight detections and drops the clock anchor, so the resumed loop
 * measures from its first new tick instead of across the pause.
 */
export function setPauseReason(
  controller: ScanLoopController,
  reason: PauseReason,
  paused: boolean,
): boolean {
  const changed = paused
    ? !controller.pauseReasons.has(reason)
    : controller.pauseReasons.has(reason)
  if (!changed) return false
  if (paused) controller.pauseReasons.add(reason)
  else controller.pauseReasons.delete(reason)
  bumpLoopGeneration(controller)
  controller.lastTickAt = null
  return true
}

export function bumpLoopGeneration(controller: ScanLoopController): number {
  controller.generation += 1
  return controller.generation
}

/**
 * Whether results from a detection cycle started at `generation` may still be applied.
 * A paused loop is never current: the results describe a frame from before the pause.
 */
export function isDetectionCurrent(controller: ScanLoopController, generation: number): boolean {
  return controller.generation === generation && !isLoopPaused(controller)
}

/**
 * One tick's worth of the active clock, plus the search fallback's one-shot check.
 *
 * The clock deliberately measures only the time the loop actually ran: browsing the
 * Merkliste for 30s must not pop the search sheet on the first resumed tick (F2).
 */
export function advanceLoopClock(
  controller: ScanLoopController,
  session: ScanSessionState,
  now: number,
): { timedOut: boolean } {
  if (isLoopPaused(controller)) {
    controller.lastTickAt = null
    return { timedOut: false }
  }
  const previous = controller.lastTickAt
  controller.lastTickAt = now
  if (previous !== null) advanceActiveClock(session, Math.min(now - previous, MAX_TICK_DELTA_MS))
  return { timedOut: shouldFireTimeout(session) }
}

/**
 * How long a foreground track `mute` is tolerated before the stream is treated as gone.
 *
 * A mute is NOT proof the camera died: iOS fires it for an incoming call or an app
 * switcher pass and follows with `unmute` when the page gets the camera back. Worse, a
 * `getUserMedia` issued inside that window fails with `NotReadableError` — so recovering
 * immediately would turn a self-healing blip into a permanently stalled viewfinder.
 */
export const MUTE_GRACE_MS = 3000

/** What made `recover()` run. Only `ended` is proof, by itself, that the stream is gone. */
export type RecoverTrigger = "ended" | "mute" | "visibility" | "pageshow"

/** A stream, as far as liveness is concerned. Structural so tests need no DOM. */
export type VideoStreamLike = {
  getVideoTracks(): ReadonlyArray<{ readyState: string }>
}

/**
 * Whether the stream we already hold is provably unusable. A muted track is still alive
 * (it can unmute); only an `ended` readyState — or having no video track at all — is
 * terminal.
 */
export function isVideoStreamDead(stream: VideoStreamLike | null): boolean {
  if (!stream) return true
  const tracks = stream.getVideoTracks()
  return tracks.length === 0 || tracks.every((track) => track.readyState === "ended")
}

/**
 * What a failed re-acquire means. `stall` latches the dead-camera state and calls
 * `onStalled()`; `keep` holds on to the old stream, its listeners and the loop, because
 * the failure may just be the transient window that caused the mute in the first place.
 */
export function recoveryFailureAction(args: {
  trigger: RecoverTrigger
  previousStreamDead: boolean
}): "stall" | "keep" {
  return args.trigger === "ended" || args.previousStreamDead ? "stall" : "keep"
}

/**
 * Which shared slots a `releaseStream(stream)` may clear: only the ones that still point
 * at that exact stream.
 *
 * Stream ownership is per closure, never "whatever is in the ref". A stale effect
 * instance parked on `await video.play()` can wake up after a newer instance already
 * acquired and attached its own stream; clearing the ref or `video.srcObject`
 * unconditionally would stop the *new* camera with no `ended` event and no way back.
 */
export function streamReleasePlan<T>(
  slots: { current: T | null; videoSource: unknown },
  stream: T,
): { clearCurrent: boolean; clearVideoSource: boolean } {
  return {
    clearCurrent: slots.current === stream,
    clearVideoSource: slots.videoSource === stream,
  }
}
