"use client"

import { Package } from "lucide-react"
import { Component, useEffect, useRef, useState, type ReactNode } from "react"

import { Icon, type IconName } from "@/components/ui/icon"
import { REFINEMENT_CATEGORY_OPTIONS } from "@/components/personal-plan-refinement/refinement-options"
import { MOTION_MS } from "@/lib/motion"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { cn } from "@/lib/utils"

/**
 * Motion and small visuals of the participant flow (batch 7, prototype round 6; batch 8 motion
 * spec `plans/discovery-b8-motion-days/plan.md` Part B, tokens in `@/lib/motion`): the
 * cross-slide between steps and screens, the settle after a one-tap answer, the delayed
 * pending indicator, the drawn-in check and the packshot tile. Every animation is a CSS class
 * in `globals.css` (`discovery-*`), switched off under `prefers-reduced-motion`.
 */

/** How long a tapped option shows its plum state before the flow moves on. */
export const DISCOVERY_TAP_SETTLE_MS = MOTION_MS.settle

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

/** A duration from the motion spec, 0 under reduced motion. */
export function motionMs(ms: number): number {
  return prefersReducedMotion() ? 0 : ms
}

// --- The frozen leaving layer ------------------------------------------------------------------

/**
 * The DOM surface `freezeSnapshot` touches — `HTMLElement` satisfies it; the tests hand in a
 * small fake tree (no jsdom in this repo).
 */
export type FreezableElement = {
  readonly tagName: string
  readonly children: ArrayLike<FreezableElement>
  readonly style: { setProperty(name: string, value: string, priority?: string): void }
  removeAttribute(name: string): void
  setAttribute(name: string, value: string): void
  getAnimations?: () => ReadonlyArray<{
    currentTime: unknown
    effect?: { getTiming(): { delay?: number } } | null
  }>
  value?: string
}

/** Attributes a detached copy must not carry: duplicate ids, labels, focus, autoplay. */
const SNAPSHOT_STRIPPED_ATTRIBUTES = [
  "id",
  "for",
  "name",
  "autofocus",
  "autoplay",
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
] as const

/**
 * Freezes `clone` (a deep `cloneNode` of `source`) at exactly what `source` shows right now —
 * the quiz's frozen-snapshot technique (`src/app/quiz/quiz-shell.tsx`), refined: a fresh copy
 * would restart every entrance animation, so an animation still in effect on the source is
 * pinned at its current frame (negative delay, paused) and every other one is switched off;
 * transitions never run. Typed field values survive; ids and labels go (the live copy owns
 * them). A camera `<video>` copies as an empty box — the camera never starts again.
 */
export function freezeSnapshot(source: FreezableElement, clone: FreezableElement): void {
  const sourceAnimation = source.getAnimations?.()[0]
  const time = sourceAnimation?.currentTime
  if (typeof time === "number") {
    const delay = sourceAnimation?.effect?.getTiming().delay ?? 0
    clone.style.setProperty("animation-delay", `${delay - time}ms`, "important")
    clone.style.setProperty("animation-play-state", "paused", "important")
  } else {
    clone.style.setProperty("animation", "none", "important")
  }
  clone.style.setProperty("transition", "none", "important")
  for (const attribute of SNAPSHOT_STRIPPED_ATTRIBUTES) clone.removeAttribute(attribute)
  if (source.tagName === "INPUT" && typeof source.value === "string") {
    clone.setAttribute("value", source.value)
  }
  const count = Math.min(source.children.length, clone.children.length)
  for (let index = 0; index < count; index += 1) {
    freezeSnapshot(source.children[index], clone.children[index])
  }
}

/** A deep, frozen copy of `element`'s current look. */
export function frozenCopyOf(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement
  // `HTMLElement` is a `FreezableElement` in every way the walk uses; `children` is typed as
  // plain `Element`s by the DOM lib.
  freezeSnapshot(element as unknown as FreezableElement, clone as unknown as FreezableElement)
  return clone
}

/**
 * The element whose scroll position a step lives in: inside a bottom sheet its scrolling
 * content (the page underneath is locked and never touched), everywhere else the page.
 */
export function scrollParentOf(element: HTMLElement): HTMLElement {
  const panel =
    typeof element.closest === "function" ? element.closest("[data-bottom-sheet-panel]") : null
  if (panel) {
    for (
      let parent = element.parentElement;
      parent && parent !== panel;
      parent = parent.parentElement
    ) {
      const overflowY = window.getComputedStyle(parent).overflowY
      if (overflowY === "auto" || overflowY === "scroll") return parent
    }
    return panel as HTMLElement
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement
}

/**
 * Straight to the top, never animated: the page's `scroll-behavior: smooth` would otherwise
 * glide the new step up under the pinned copy.
 */
export function jumpToTop(scroller: HTMLElement) {
  if (typeof scroller.scrollTo === "function") scroller.scrollTo({ top: 0, behavior: "instant" })
  else scroller.scrollTop = 0
}

export type FrozenLayer = {
  id: number
  /** The frozen DOM copy; appended into the leaving layer, never rendered by React. */
  node: HTMLElement
  direction: 1 | -1
  /** How far its scroll container was scrolled — the copy stays exactly where it was seen. */
  offsetY: number
}

let frozenLayerIds = 0
export function nextFrozenLayerId(): number {
  frozenLayerIds += 1
  return frozenLayerIds
}

/**
 * Runs `capture` in React's commit phase BEFORE the DOM changes (`getSnapshotBeforeUpdate`)
 * whenever `watch` changes, and hands its result to `onCaptured` right after the commit, still
 * before the browser paints. This is how the leaving step is read while it still shows the
 * tapped answer.
 */
export class BeforeCommit<S> extends Component<{
  watch: string
  capture: (previous: string, next: string) => S | null
  onCaptured: (snapshot: S) => void
  children: ReactNode
}> {
  getSnapshotBeforeUpdate(previous: Readonly<{ watch: string }>): { value: S } | null {
    if (previous.watch === this.props.watch) return null
    const value = this.props.capture(previous.watch, this.props.watch)
    return value === null ? null : { value }
  }

  componentDidUpdate(_props: unknown, _state: unknown, snapshot: { value: S } | null) {
    if (snapshot) this.props.onCaptured(snapshot.value)
  }

  render() {
    return this.props.children
  }
}

export type SlideVariant = "step" | "screen"

const SLIDE_CLASSES: Record<SlideVariant, { in: [string, string]; out: [string, string] }> = {
  step: {
    in: ["discovery-step-in-forward", "discovery-step-in-back"],
    out: ["discovery-step-out-forward", "discovery-step-out-back"],
  },
  screen: {
    in: ["discovery-screen-in-forward", "discovery-screen-in-back"],
    out: ["discovery-screen-out-forward", "discovery-screen-out-back"],
  },
}

export function slideDurationMs(variant: SlideVariant): number {
  return variant === "screen" ? MOTION_MS.screen : Math.max(MOTION_MS.stepIn, MOTION_MS.stepOut)
}

/**
 * The leaving layer: an empty host React never renders children into — the frozen copy is
 * attached by hand, so nothing in it mounts, runs an effect or starts a camera.
 */
export function FrozenLayerHost({
  layer,
  variant,
  surfaceClassName,
}: {
  layer: FrozenLayer
  variant: SlideVariant
  surfaceClassName?: string
}) {
  const forward = layer.direction === 1
  return (
    <div
      aria-hidden="true"
      inert
      data-discovery-frozen-layer=""
      ref={(element) => {
        if (element && element.firstChild !== layer.node) element.replaceChildren(layer.node)
      }}
      style={{ top: -layer.offsetY }}
      className={cn(
        "pointer-events-none absolute inset-x-0 select-none",
        surfaceClassName,
        forward ? `${SLIDE_CLASSES[variant].out[0]} z-0` : `${SLIDE_CLASSES[variant].out[1]} z-10`,
      )}
    />
  )
}

type StageCapture = { layer: FrozenLayer | null; scroller: HTMLElement | null }

/**
 * Cross-slides from the previous step to the new one whenever `stepKey` changes: forward, the
 * new step comes in from the right over the old one; back, the old one leaves to the right.
 *
 * The leaving step is a FROZEN SNAPSHOT of its DOM taken just before the change
 * (`freezeSnapshot`): no re-mount, no replayed fade-ins, the tapped option still plum, the
 * camera not restarted. It stays pinned where she saw it while the step's scroll container
 * (sheet content or page) jumps to the top for the new step. Both layers are opaque
 * (`surfaceClassName`) so nothing ghosts through. `animate={false}` (a camera step) and
 * reduced motion swap instantly. `enterFrom` hands in a frozen layer captured elsewhere (the
 * search leaving for the first step of the add sheet).
 */
export function SlideStage({
  stepKey,
  direction,
  animate = true,
  variant = "step",
  surfaceClassName,
  enterFrom = null,
  className,
  children,
}: {
  stepKey: string
  direction: 1 | -1
  animate?: boolean
  variant?: SlideVariant
  surfaceClassName?: string
  enterFrom?: FrozenLayer | null
  className?: string
  children: ReactNode
}) {
  const activeRef = useRef<HTMLDivElement>(null)
  const [leaving, setLeaving] = useState<FrozenLayer | null>(null)
  const [adoptedId, setAdoptedId] = useState<number | null>(null)
  if (enterFrom && enterFrom.id !== adoptedId) {
    setAdoptedId(enterFrom.id)
    setLeaving(enterFrom)
  }

  useEffect(() => {
    if (!leaving) return
    const timeout = window.setTimeout(
      () => setLeaving((current) => (current?.id === leaving.id ? null : current)),
      slideDurationMs(variant) + 40,
    )
    return () => window.clearTimeout(timeout)
  }, [leaving, variant])

  function capture(): StageCapture | null {
    const active = activeRef.current
    if (!active) return null
    const scroller = scrollParentOf(active)
    const offsetY = scroller.scrollTop
    if (!animate || prefersReducedMotion()) return { layer: null, scroller }
    return {
      layer: { id: nextFrozenLayerId(), node: frozenCopyOf(active), direction, offsetY },
      scroller,
    }
  }

  function onCaptured({ layer, scroller }: StageCapture) {
    if (scroller) jumpToTop(scroller)
    setLeaving(layer)
  }

  const forward = (leaving?.direction ?? direction) === 1
  return (
    <div className={cn("discovery-stage relative overflow-x-clip", className)}>
      {leaving ? (
        <FrozenLayerHost
          key={`leaving-${leaving.id}`}
          layer={leaving}
          variant={variant}
          surfaceClassName={surfaceClassName}
        />
      ) : null}
      <BeforeCommit watch={stepKey} capture={capture} onCaptured={onCaptured}>
        <div
          key={stepKey}
          ref={activeRef}
          className={cn(
            "relative",
            surfaceClassName,
            leaving
              ? forward
                ? `${SLIDE_CLASSES[variant].in[0]} z-10`
                : `${SLIDE_CLASSES[variant].in[1]} z-0`
              : null,
          )}
        >
          {children}
        </div>
      </BeforeCommit>
    </div>
  )
}

// --- Pending states ------------------------------------------------------------------------------

/**
 * Whether a pending indicator shows: never before `MOTION_MS.loaderDelay` (most saves land
 * sooner — nothing flickers), and once shown at least `MOTION_MS.loaderMinimum`.
 */
export function useDelayedPending(active: boolean): boolean {
  const [visible, setVisible] = useState(false)
  const shownAt = useRef(0)
  useEffect(() => {
    if (active) {
      if (visible) return
      const timeout = window.setTimeout(() => {
        shownAt.current = Date.now()
        setVisible(true)
      }, MOTION_MS.loaderDelay)
      return () => window.clearTimeout(timeout)
    }
    if (!visible) return
    const rest = Math.max(0, MOTION_MS.loaderMinimum - (Date.now() - shownAt.current))
    const timeout = window.setTimeout(() => setVisible(false), rest)
    return () => window.clearTimeout(timeout)
  }, [active, visible])
  return visible
}

/** The small inline spinner of a pending control — the control keeps its label and width. */
export function PendingSpinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0 animate-spin", className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity={0.25} strokeWidth={2.4} />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </svg>
  )
}

/** A check that draws itself in (final page, done page). */
export function DrawCheck({ size, delayMs = 0 }: { size: number; delayMs?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        className="discovery-draw"
        pathLength={1}
        style={{ animationDelay: `${delayMs}ms` }}
        d="M5 12.5l4.5 4.5L19 7.5"
      />
    </svg>
  )
}

const CATEGORY_ICONS = Object.fromEntries(
  REFINEMENT_CATEGORY_OPTIONS.map((option) => [option.value, option.icon]),
) as Record<PersonalPlanCategory, IconName>

/**
 * The packshot tile: the catalog image, covered; without one (or when it fails) the
 * production category icon on plum ice.
 */
export function DiscoveryPackshot({
  imageUrl,
  category,
  className,
  iconSize = 26,
}: {
  imageUrl: string | null | undefined
  category: PersonalPlanCategory | null
  className?: string
  iconSize?: number
}) {
  const [failed, setFailed] = useState<string | null>(null)
  const showImage = Boolean(imageUrl) && failed !== imageUrl
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl",
        showImage ? "bg-[#f3f0e8]" : "bg-[var(--brand-plum-ice)]",
        className,
      )}
    >
      {showImage ? (
        // Catalog images come from owner-submitted hosts that are not all Next image hosts.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl!}
          alt=""
          decoding="async"
          onError={() => setFailed(imageUrl!)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : category ? (
        <Icon
          name={CATEGORY_ICONS[category]}
          size={iconSize}
          className="text-[var(--brand-plum)] opacity-50"
        />
      ) : (
        <Package
          width={iconSize}
          height={iconSize}
          strokeWidth={1.6}
          aria-hidden="true"
          className="text-[var(--brand-plum)] opacity-50"
        />
      )}
    </span>
  )
}

/**
 * A single-tap option list's settle: the tapped key turns plum at once, the answer follows
 * after `DISCOVERY_TAP_SETTLE_MS` (immediately under reduced motion). A second tap while one
 * settles is ignored. The tapped key STAYS marked after the answer went out — the leaving
 * step, a closing sheet or a running save keep showing her choice; a new tap moves it.
 */
export function useSettledTap<K extends string>(): [
  K | null,
  (key: K, commit: () => void) => void,
] {
  const [tapped, setTapped] = useState<K | null>(null)
  const pending = useRef(false)
  function tap(key: K, commit: () => void) {
    if (pending.current) return
    pending.current = true
    setTapped(key)
    const delay = prefersReducedMotion() ? 0 : DISCOVERY_TAP_SETTLE_MS
    window.setTimeout(() => {
      pending.current = false
      commit()
    }, delay)
  }
  return [tapped, tap]
}
