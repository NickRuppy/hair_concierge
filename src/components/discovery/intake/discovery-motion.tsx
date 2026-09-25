"use client"

import { Package } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"

import { Icon, type IconName } from "@/components/ui/icon"
import { REFINEMENT_CATEGORY_OPTIONS } from "@/components/personal-plan-refinement/refinement-options"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { cn } from "@/lib/utils"

/**
 * Motion and small visuals of the participant flow (batch 7, prototype round 6): the 280 ms
 * cross-slide between steps and screens (`cubic-bezier(0.32,0.72,0,1)`), the drawn-in check
 * and the packshot tile. Every animation is a CSS class in `globals.css` (`discovery-*`),
 * switched off under `prefers-reduced-motion`.
 */

export const DISCOVERY_SLIDE_MS = 280
/** How long a tapped option shows its plum state before the flow moves on. */
export const DISCOVERY_TAP_SETTLE_MS = 220

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

type Leaving = { key: string; node: ReactNode; direction: 1 | -1 }

/**
 * Cross-slides from the previous child to the new one whenever `stepKey` changes: forward,
 * the new step comes in from the right over the old one; back, the old one leaves to the
 * right. The leaving copy is inert and gone after the slide. `animate={false}` (a camera
 * step, reduced motion) swaps instantly.
 */
export function SlideStage({
  stepKey,
  direction,
  animate = true,
  className,
  children,
}: {
  stepKey: string
  direction: 1 | -1
  animate?: boolean
  className?: string
  children: ReactNode
}) {
  // The last children of each key, kept from render to render (React's „information from
  // previous renders" pattern): when the key changes, the previous key's LATEST children
  // become the leaving copy.
  const [record, setRecord] = useState<{
    key: string
    node: ReactNode
    leaving: Leaving | null
  }>({ key: stepKey, node: children, leaving: null })
  if (record.key !== stepKey) {
    setRecord({
      key: stepKey,
      node: children,
      leaving:
        animate && !prefersReducedMotion()
          ? { key: record.key, node: record.node, direction }
          : null,
    })
  } else if (record.node !== children) {
    setRecord({ ...record, node: children })
  }
  const leaving = record.key === stepKey ? record.leaving : null

  useEffect(() => {
    if (!leaving) return
    const timeout = window.setTimeout(
      () => setRecord((current) => ({ ...current, leaving: null })),
      DISCOVERY_SLIDE_MS + 40,
    )
    return () => window.clearTimeout(timeout)
  }, [leaving])

  const forward = (leaving?.direction ?? direction) === 1
  return (
    <div className={cn("relative overflow-x-clip", className)}>
      {leaving ? (
        <div
          key={`leaving-${leaving.key}`}
          aria-hidden="true"
          inert
          className={cn(
            "pointer-events-none absolute inset-0",
            forward ? "discovery-slide-out-forward z-0" : "discovery-slide-out-back z-10",
          )}
        >
          {leaving.node}
        </div>
      ) : null}
      <div
        key={stepKey}
        className={cn(
          "relative",
          leaving
            ? forward
              ? "discovery-slide-in-forward z-10"
              : "discovery-slide-in-back z-0"
            : null,
        )}
      >
        {children}
      </div>
    </div>
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
 * settles is ignored.
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
      setTapped(null)
      commit()
    }, delay)
  }
  return [tapped, tap]
}
