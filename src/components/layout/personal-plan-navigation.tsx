"use client"

import { ListChecks, MessageCircle, Rows3, ScanLine, UserRound } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  RoutineAttentionIndicator,
  useRoutineAttention,
} from "@/components/routine/personal-plan/routine-attention-indicator"
import type { PersonalPlanNavSurface } from "@/lib/personal-plan/lifecycle/repository"
import type { PersonalPlanNavigationItem } from "@/lib/personal-plan/navigation-access"

const EMPTY_UNVISITED_NAV_SURFACES: ReadonlySet<PersonalPlanNavSurface> = new Set()

/**
 * Decorative "never visited this tab" dot (Task 2.9, decision 14) — no
 * tooltip, no copy, no live-region announcement, unlike
 * `RoutineAttentionIndicator`'s pending-proposal dot: this one is purely
 * visual so `aria-hidden` is correct here, not a shortcut.
 */
function NavUnvisitedDot() {
  return (
    <span
      aria-hidden="true"
      data-nav-unvisited-dot="true"
      className="absolute -right-0.5 -top-0.5 block h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background"
    />
  )
}

const ICONS = {
  chat: MessageCircle,
  routine: ListChecks,
  scan: ScanLine,
  application: Rows3,
  profile: UserRound,
} as const

/**
 * `unvisitedNavSurfaces` reflects the server read from BEFORE this render's
 * visit-marking write (that write is deferred via `after()` and lands after
 * the response, per `schedulePersonalPlanNavSurfaceVisit`). So on a
 * surface's very first visit, the surface being rendered right now is still
 * in `unvisitedNavSurfaces` — without this, the dot would flash on the tab
 * the user is currently looking at. Render-side fix, not a persistence fix:
 * `active` (the current pathname's own item) is always excluded from the
 * dot regardless of what `unvisitedNavSurfaces` says. The persisted write
 * logic is untouched — the very next navigation reads the now-updated
 * state from the server and the dot is simply gone.
 */
export function PersonalPlanNavigationView({
  items,
  pathname,
  hasPendingRoutineProposal = false,
  unvisitedNavSurfaces = EMPTY_UNVISITED_NAV_SURFACES,
}: {
  items: readonly PersonalPlanNavigationItem[]
  pathname: string
  hasPendingRoutineProposal?: boolean
  unvisitedNavSurfaces?: ReadonlySet<PersonalPlanNavSurface>
}) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/chat" className="flex items-center gap-2" aria-label="Chaarlie Chat">
            <span className="flex items-center gap-[3px]" aria-hidden="true">
              <span className="h-3.5 w-[3px] rounded-sm bg-primary" />
              <span className="h-3.5 w-[3px] rounded-sm bg-primary/60" />
              <span className="h-3.5 w-[3px] rounded-sm bg-primary/30" />
            </span>
            <span className="font-header text-2xl tracking-wide text-[var(--text-heading)]">
              chaarlie
            </span>
          </Link>
          <nav aria-label="Personal-Plan-Navigation" className="hidden items-center gap-1 md:flex">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative rounded-[10px] px-3 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-[var(--brand-plum-ice)] text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {item.label}
                  {item.key === "routine" ? (
                    <RoutineAttentionIndicator hasPendingProposal={hasPendingRoutineProposal} />
                  ) : unvisitedNavSurfaces.has(item.key) && !active ? (
                    <NavUnvisitedDot />
                  ) : null}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      <nav
        aria-label="Personal-Plan-Navigation (mobil)"
        className="fixed inset-x-0 bottom-0 z-50 grid min-h-[calc(4.5rem+env(safe-area-inset-bottom))] border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_-26px_rgba(var(--brand-plum-rgb),0.55)] backdrop-blur supports-[backdrop-filter]:bg-background/90 md:hidden"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const Icon = ICONS[item.key]
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-w-0 flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] font-semibold transition-colors ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <span className="relative">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.key === "routine" ? (
                  <RoutineAttentionIndicator hasPendingProposal={hasPendingRoutineProposal} />
                ) : unvisitedNavSurfaces.has(item.key) && !active ? (
                  <NavUnvisitedDot />
                ) : null}
              </span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}

export function PersonalPlanNavigation({
  items,
  initialHasPendingRoutineProposal,
  unvisitedNavSurfaces = EMPTY_UNVISITED_NAV_SURFACES,
}: {
  items: readonly PersonalPlanNavigationItem[]
  initialHasPendingRoutineProposal: boolean
  unvisitedNavSurfaces?: ReadonlySet<PersonalPlanNavSurface>
}) {
  const pathname = usePathname() ?? ""
  const hasPendingRoutineProposal = useRoutineAttention(
    items.some((item) => item.key === "routine"),
    initialHasPendingRoutineProposal,
  )
  return (
    <PersonalPlanNavigationView
      items={items}
      pathname={pathname}
      hasPendingRoutineProposal={hasPendingRoutineProposal}
      unvisitedNavSurfaces={unvisitedNavSurfaces}
    />
  )
}
