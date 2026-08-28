"use client"

import {
  Component,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

export type PersonalPlanTransitionDirection = "forward" | "reverse"
export type PersonalPlanTransitionVariant = "quiz"

type RetainedView = {
  key: string
  children: ReactNode
  direction: PersonalPlanTransitionDirection
  sequence: number
}

type ScrollRestorationTarget = Pick<History, "scrollRestoration">

const scrollRestorationOwners = new WeakMap<
  ScrollRestorationTarget,
  { count: number; previous: History["scrollRestoration"] }
>()

export function acquireManualScrollRestoration(target: ScrollRestorationTarget) {
  const existing = scrollRestorationOwners.get(target)
  if (existing) {
    existing.count += 1
  } else {
    scrollRestorationOwners.set(target, {
      count: 1,
      previous: target.scrollRestoration,
    })
    target.scrollRestoration = "manual"
  }

  let released = false
  return () => {
    if (released) return
    released = true
    const ownership = scrollRestorationOwners.get(target)
    if (!ownership) return
    ownership.count -= 1
    if (ownership.count > 0) return
    target.scrollRestoration = ownership.previous
    scrollRestorationOwners.delete(target)
  }
}

class OutgoingScrollSnapshot extends Component<{
  viewKey: string
  capture: (viewKey: string) => void
  children: ReactNode
}> {
  getSnapshotBeforeUpdate(previous: Readonly<{ viewKey: string }>) {
    if (previous.viewKey !== this.props.viewKey) {
      this.props.capture(previous.viewKey)
    }
    return null
  }

  componentDidUpdate() {
    // React requires this lifecycle when getSnapshotBeforeUpdate is present.
  }

  render() {
    return this.props.children
  }
}

const TRANSITION_DURATION_MS: Record<PersonalPlanTransitionVariant, number> = {
  quiz: 200,
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
  const captureOutgoingScroll = useCallback((outgoingViewKey: string) => {
    scrollPositionsRef.current.set(outgoingViewKey, window.scrollY)
  }, [])

  useLayoutEffect(() => acquireManualScrollRestoration(window.history), [])

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
    <OutgoingScrollSnapshot viewKey={viewKey} capture={captureOutgoingScroll}>
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
    </OutgoingScrollSnapshot>
  )
}
