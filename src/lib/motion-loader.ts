"use client"

import { useEffect, useRef, useState } from "react"

import { MOTION_MS } from "./motion"

/**
 * The loader rule of the motion spec (batch 8, plans/discovery-b8-motion-days/plan.md):
 * nothing that waits shows a loader, skeleton or „speichert …" label before
 * `MOTION_MS.loaderDelay`; once a loader is visible it stays at least
 * `MOTION_MS.loaderMinimum`, so a wait that ends just after the delay never blinks.
 *
 * `createDelayedLoader` is the timer logic on its own (fake-timer testable);
 * `useDelayedLoader` is the React wrapper every screen uses.
 */

type Timers = {
  setTimeout: (callback: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
}

const defaultTimers: Timers = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export function createDelayedLoader({
  onChange,
  delayMs = MOTION_MS.loaderDelay,
  minimumMs = MOTION_MS.loaderMinimum,
  timers = defaultTimers,
  now = () => Date.now(),
}: {
  onChange: (visible: boolean) => void
  delayMs?: number
  minimumMs?: number
  timers?: Timers
  now?: () => number
}) {
  let active = false
  let visible = false
  let shownAt = 0
  let timer: unknown = null

  const clear = () => {
    if (timer !== null) timers.clearTimeout(timer)
    timer = null
  }
  const show = (next: boolean) => {
    if (visible === next) return
    visible = next
    if (next) shownAt = now()
    onChange(next)
  }

  return {
    /** Report whether the wait is still running. */
    set(nextActive: boolean) {
      if (nextActive === active) return
      active = nextActive
      clear()
      if (active) {
        if (visible) return
        timer = timers.setTimeout(() => {
          timer = null
          if (active) show(true)
        }, delayMs)
        return
      }
      if (!visible) return
      const remaining = minimumMs - (now() - shownAt)
      if (remaining <= 0) {
        show(false)
        return
      }
      timer = timers.setTimeout(() => {
        timer = null
        if (!active) show(false)
      }, remaining)
    },
    dispose() {
      clear()
    },
  }
}

/** `true` while the loader for `active` should be on screen (see the rule above). */
export function useDelayedLoader(active: boolean): boolean {
  const [visible, setVisible] = useState(false)
  const loaderRef = useRef<ReturnType<typeof createDelayedLoader> | null>(null)

  useEffect(() => {
    const loader = createDelayedLoader({ onChange: setVisible })
    loaderRef.current = loader
    return () => {
      loader.dispose()
      loaderRef.current = null
    }
  }, [])

  useEffect(() => {
    loaderRef.current?.set(active)
  }, [active])

  return visible
}
