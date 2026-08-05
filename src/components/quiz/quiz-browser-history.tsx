"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react"

import {
  ensureLegacyQuizBrowserHistoryState,
  getLegacyQuizBrowserHistoryDepth,
  getLegacyQuizScreenPosition,
  pushLegacyQuizBrowserHistoryState,
  shouldHandleLegacyQuizPopState,
} from "@/lib/quiz/browser-history"
import { useQuizStore } from "@/lib/quiz/store"

type QuizBrowserHistoryContextValue = {
  pushInPlaceEntry: () => void
  registerBackHandler: (handler: () => void) => () => void
  requestBack: () => void
}

const QuizBrowserHistoryContext = createContext<QuizBrowserHistoryContextValue | null>(null)

export function QuizBrowserHistoryProvider({ children }: { children: ReactNode }) {
  const step = useQuizStore((state) => state.step)
  const leadCaptureSubStep = useQuizStore((state) => state.leadCaptureSubStep)
  const goBack = useQuizStore((state) => state.goBack)
  const setLeadCaptureSubStep = useQuizStore((state) => state.setLeadCaptureSubStep)
  const currentPosition = getLegacyQuizScreenPosition(step, leadCaptureSubStep)
  const previousPositionRef = useRef(currentPosition)
  const currentDepthRef = useRef(0)
  const customBackHandlerRef = useRef<(() => void) | null>(null)
  const defaultBackHandlerRef = useRef<() => void>(() => {})

  const defaultBackHandler = useCallback(() => {
    if (step === 9 && leadCaptureSubStep === "consent") {
      setLeadCaptureSubStep("email")
      return
    }
    if (step === 9 && leadCaptureSubStep === "email") {
      setLeadCaptureSubStep("name")
      return
    }
    goBack()
  }, [goBack, leadCaptureSubStep, setLeadCaptureSubStep, step])

  useEffect(() => {
    defaultBackHandlerRef.current = defaultBackHandler
  }, [defaultBackHandler])

  useEffect(() => {
    currentDepthRef.current = ensureLegacyQuizBrowserHistoryState()

    const onPopState = (event: PopStateEvent) => {
      if (!shouldHandleLegacyQuizPopState(event.state)) return
      const nextDepth = getLegacyQuizBrowserHistoryDepth(event.state)
      if (nextDepth === null) return
      if (nextDepth > currentDepthRef.current) {
        // The regular quiz only guarantees Back semantics. Bounce a browser
        // Forward attempt back to the screen that still matches the store so
        // history depth and rendered quiz state cannot drift apart.
        window.history.back()
        return
      }
      const movingBack = nextDepth < currentDepthRef.current
      currentDepthRef.current = nextDepth
      if (!movingBack) return
      ;(customBackHandlerRef.current ?? defaultBackHandlerRef.current)()
    }

    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  useEffect(() => {
    if (currentPosition > previousPositionRef.current) {
      currentDepthRef.current = pushLegacyQuizBrowserHistoryState()
    }
    previousPositionRef.current = currentPosition
  }, [currentPosition])

  const registerBackHandler = useCallback((handler: () => void) => {
    customBackHandlerRef.current = handler
    return () => {
      if (customBackHandlerRef.current === handler) customBackHandlerRef.current = null
    }
  }, [])

  const pushInPlaceEntry = useCallback(() => {
    currentDepthRef.current = pushLegacyQuizBrowserHistoryState()
  }, [])

  const requestBack = useCallback(() => {
    const depth = getLegacyQuizBrowserHistoryDepth(window.history.state)
    if (depth !== null && depth > 0) {
      window.history.back()
      return
    }
    ;(customBackHandlerRef.current ?? defaultBackHandlerRef.current)()
  }, [])

  const value = useMemo(
    () => ({ pushInPlaceEntry, registerBackHandler, requestBack }),
    [pushInPlaceEntry, registerBackHandler, requestBack],
  )

  return (
    <QuizBrowserHistoryContext.Provider value={value}>
      {children}
    </QuizBrowserHistoryContext.Provider>
  )
}

export function useQuizBrowserBack(handler?: () => void) {
  const context = useContext(QuizBrowserHistoryContext)
  if (!context) throw new Error("useQuizBrowserBack must be used inside QuizBrowserHistoryProvider")

  useEffect(() => {
    if (!handler) return
    return context.registerBackHandler(handler)
  }, [context, handler])

  return context.requestBack
}

export function useQuizBrowserHistoryEntry() {
  const context = useContext(QuizBrowserHistoryContext)
  if (!context) {
    throw new Error("useQuizBrowserHistoryEntry must be used inside QuizBrowserHistoryProvider")
  }
  return context.pushInPlaceEntry
}
