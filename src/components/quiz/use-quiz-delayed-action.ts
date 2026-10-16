"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useQuizStore } from "@/lib/quiz/store"

/** Owns one settling selection. Cancellation saves work; admission protects navigation. */
export function useQuizDelayedAction() {
  const [pending, setPending] = useState(false)
  const active = useRef(false)
  const sequence = useRef(0)
  const operation = useRef<{ id: number; timer: number } | null>(null)

  const cancel = useCallback(() => {
    sequence.current += 1
    if (operation.current) window.clearTimeout(operation.current.timer)
    operation.current = null
    if (active.current) setPending(false)
  }, [])

  useEffect(() => {
    active.current = true
    const unsubscribe = useQuizStore.subscribe((next, previous) => {
      if (next.navigationRevision !== previous.navigationRevision) cancel()
    })
    return () => {
      active.current = false
      unsubscribe()
      cancel()
    }
  }, [cancel])

  const schedule = useCallback((callback: () => void, delay: number) => {
    // Synchronous latch: two clicks in one React batch still admit only the first.
    if (!active.current || operation.current) return false
    const source = useQuizStore.getState()
    const id = ++sequence.current
    const timer = window.setTimeout(() => {
      const current = useQuizStore.getState()
      if (
        !active.current ||
        operation.current?.id !== id ||
        current.navigationRevision !== source.navigationRevision ||
        current.step !== source.step ||
        current.leadCaptureSubStep !== source.leadCaptureSubStep
      )
        return
      operation.current = null
      setPending(false)
      callback()
    }, delay)
    operation.current = { id, timer }
    setPending(true)
    return true
  }, [])

  const isPending = useCallback(() => operation.current !== null, [])

  return { pending, schedule, cancel, isPending }
}
