"use client"

import type { ReactNode } from "react"
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

export type PersonalPlanTransitionDirection = "forward" | "reverse"
export type PersonalPlanTransitionVariant = "depth"

type RetainedView = {
  key: string
  children: ReactNode
  direction: PersonalPlanTransitionDirection
  sequence: number
}

const TRANSITION_DURATION_MS: Record<PersonalPlanTransitionVariant, number> = {
  depth: 360,
}

const PersonalPlanTransitionLayerContext = createContext<"current" | "outgoing">("current")

export function usePersonalPlanTransitionLayer() {
  return useContext(PersonalPlanTransitionLayerContext)
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

export function PersonalPlanViewTransition({
  viewKey,
  direction,
  variant,
  children,
  focusSelector = "[data-personal-plan-transition-focus]",
  focusOnInitialMount = false,
}: {
  viewKey: string
  direction: PersonalPlanTransitionDirection
  variant: PersonalPlanTransitionVariant
  children: ReactNode
  focusSelector?: string
  focusOnInitialMount?: boolean
}) {
  const currentViewRef = useRef({ key: viewKey, children })
  const rootRef = useRef<HTMLDivElement>(null)
  const [retainedView, setRetainedView] = useState<RetainedView | null>(null)
  const sequenceRef = useRef(0)
  const scrollPositionsRef = useRef(new Map<string, number>())
  const readTransition = useEffectEvent(() => ({ children, direction, focusSelector, variant }))

  useLayoutEffect(() => {
    if (!focusOnInitialMount) return
    const frame = window.requestAnimationFrame(() => {
      rootRef.current?.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusOnInitialMount, focusSelector])

  useLayoutEffect(() => {
    const transition = readTransition()
    const previous = currentViewRef.current
    currentViewRef.current = { key: viewKey, children: transition.children }
    if (previous.key === viewKey) return

    scrollPositionsRef.current.set(previous.key, window.scrollY)
    window.scrollTo({
      top: scrollPositionsRef.current.get(viewKey) ?? 0,
      // `auto` inherits the document's smooth-scroll CSS. History restoration must
      // happen before the incoming view is focused, so request an immediate jump.
      behavior: "instant",
    })

    const sequence = sequenceRef.current + 1
    sequenceRef.current = sequence
    const reducedMotion = prefersReducedMotion()
    if (!reducedMotion) {
      setRetainedView({
        key: previous.key,
        children: previous.children,
        direction: transition.direction,
        sequence,
      })
    } else {
      setRetainedView(null)
    }

    const focusDelay = reducedMotion ? 0 : TRANSITION_DURATION_MS[transition.variant]
    const timer = window.setTimeout(() => {
      setRetainedView((current) => (current?.sequence === sequence ? null : current))
      const focusTarget =
        rootRef.current?.querySelector<HTMLElement>(
          `.personal-plan-view-transition-incoming ${transition.focusSelector}`,
        ) ?? rootRef.current?.querySelector<HTMLElement>(transition.focusSelector)
      focusTarget?.focus({ preventScroll: true })
    }, focusDelay)

    return () => window.clearTimeout(timer)
  }, [viewKey])

  useEffect(() => {
    if (currentViewRef.current.key === viewKey) {
      currentViewRef.current = { key: viewKey, children }
    }
  }, [children, viewKey])

  const isAnimating = retainedView !== null

  return (
    <div
      ref={rootRef}
      className="personal-plan-view-transition"
      data-personal-plan-view-transition={variant}
      data-personal-plan-transition-direction={direction}
      data-personal-plan-transition-active={isAnimating ? "true" : "false"}
    >
      {retainedView ? (
        <div
          key={`outgoing:${retainedView.key}:${retainedView.sequence}`}
          className="personal-plan-view-transition-layer personal-plan-view-transition-outgoing"
          data-transition-direction={retainedView.direction}
          aria-hidden="true"
          inert
        >
          <PersonalPlanTransitionLayerContext.Provider value="outgoing">
            {retainedView.children}
          </PersonalPlanTransitionLayerContext.Provider>
        </div>
      ) : null}
      <div
        key="incoming"
        className={
          isAnimating
            ? "personal-plan-view-transition-layer personal-plan-view-transition-incoming"
            : "personal-plan-view-transition-layer"
        }
        data-transition-direction={direction}
      >
        <PersonalPlanTransitionLayerContext.Provider value="current">
          {children}
        </PersonalPlanTransitionLayerContext.Provider>
      </div>
    </div>
  )
}
