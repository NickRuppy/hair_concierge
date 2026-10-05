"use client"

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react"
import Link from "next/link"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Invite into the Personal Plan for paid members without one (Nick, 2026-10-05:
 * option 1 — banner on Chat and Profil only). Eligibility is decided on the server
 * (`loadPersonalPlanInvite`) and handed down through this context, so the banner can
 * sit inside each page's own layout without threading a prop through it.
 */
const PlanInviteContext = createContext(false)

export function PlanInviteProvider({ show, children }: { show: boolean; children: ReactNode }) {
  return <PlanInviteContext.Provider value={show}>{children}</PlanInviteContext.Provider>
}

// Dismissal lasts for the visit (browser session), not forever: the member sees the
// invite again on their next visit until the plan exists.
const DISMISSED_KEY = "chaarlie:plan-invite-dismissed"
const listeners = new Set<() => void>()
let dismissedInMemory = false

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function readDismissed(): boolean {
  if (dismissedInMemory) return true
  try {
    return window.sessionStorage.getItem(DISMISSED_KEY) === "1"
  } catch {
    return false
  }
}

function dismiss() {
  dismissedInMemory = true
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, "1")
  } catch {
    // Storage unavailable (private mode): the in-memory flag still hides it for this tab.
  }
  listeners.forEach((listener) => listener())
}

export function PlanInviteBanner({ className }: { className?: string }) {
  const show = useContext(PlanInviteContext)
  // Server snapshot = dismissed, so a member who closed it never sees it flash back
  // during hydration; an undismissed banner appears right after hydration.
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true)
  if (!show || dismissed) return null

  return (
    <aside
      aria-labelledby="plan-invite-heading"
      data-plan-invite-banner="true"
      className={cn(
        "flex items-start gap-3 rounded-[16px] border border-[var(--brand-plum-light)] bg-[var(--brand-plum-ice)] p-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p
          id="plan-invite-heading"
          className="text-[15px] font-semibold text-[var(--brand-plum-darkest)]"
        >
          Neu: Dein persönlicher Haarplan
        </p>
        <p className="mt-0.5 text-sm text-[var(--brand-plum-dark)]">
          Für dich freigeschaltet. In wenigen Minuten fertig.
        </p>
        <Link
          href="/plan-bereit"
          className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--brand-coral-dark)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-coral-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum-dark)] focus-visible:ring-offset-2"
        >
          Plan erstellen
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hinweis schließen"
        className="-mr-2 -mt-2 inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-[var(--brand-plum-dark)] transition-colors hover:bg-[var(--brand-plum-light)]/40"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </aside>
  )
}
