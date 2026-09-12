"use client"

import { useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"

import { ScanFlow } from "@/components/scan/scan-flow"
import type { EntitlementTier } from "@/lib/entitlements"
import { scanAnalytics } from "@/lib/scan/scan-analytics"

/**
 * Thin client boundary between the Server Component `page.tsx` and `ScanFlow`. `ScanFlow`
 * itself defaults its `analytics` prop to `noOpScanAnalytics` (so a bare `<ScanFlow />`
 * anywhere — Storybook, a future test harness — stays silent by default, matching how
 * `Stage3ProductsFlow` defaults to `noOpStage3Analytics`). `page.tsx` can't hand the real
 * consent-aware port down itself: it's a Server Component, and a port object with methods
 * can't cross the RSC boundary as a prop. This file exists solely to supply the real one
 * from inside client-side JS, the same way `plan-start-flow.tsx` passes
 * `stage3BaselineAnalytics` to `Stage3ProductsFlow`.
 *
 * `tier`/`merklisteEnabled` (fix round 1, F1; T16) are plain serializable values, so
 * `page.tsx` — the Server Component — hands them straight through; only the analytics PORT
 * and the router (T16's `navigate` DI seam, so `ScanFlow` never calls `useRouter()` itself
 * — see that prop's doc comment) needed this client boundary.
 */
/**
 * Honest notice for the one case where a free magic link deliberately did NOT
 * adopt the quiz it carried: the account that clicked it already had its own
 * hair profile, so `/auth/confirm` skipped the binding rather than overwrite it
 * (T18 fix round 1, review finding W1b). Without a line here the user would just
 * find themselves logged in with none of the answers they had expected.
 */
const BIND_SKIPPED_NOTICE =
  "Du bist mit deinem bestehenden Konto angemeldet. Deine gespeicherte Haaranalyse bleibt unverändert – die neue wurde nicht übernommen."

/**
 * The arrival line a `scan_v1` buyer sees once, right after /plan-bereit hands them
 * over (`/scan?welcome=scan`). It is a greeting, not a state of the scanner, so it
 * lives beside `ScanFlow` and never touches its state machine. Dismissed for the rest
 * of the session via `sessionStorage`, and hidden on the first render of a session
 * that already dismissed it — a storage failure simply shows it again.
 */
const SCAN_WELCOME_HINT = "Dein Scanner ist startklar. Dein Plan wartet daneben."
const SCAN_WELCOME_HINT_DISMISS = "Verstanden"
const SCAN_WELCOME_HINT_STORAGE_KEY = "chaarlie.scan.welcome-hint-dismissed"

// One session-scoped flag shared by the store below. `useSyncExternalStore` is what
// lets the client read `sessionStorage` on its very first render without a
// setState-in-effect cascade: the server snapshot is "already dismissed" (renders
// nothing), and React re-renders with the real value right after hydration.
let welcomeHintDismissed: boolean | null = null
const welcomeHintListeners = new Set<() => void>()

function readWelcomeHintDismissed(): boolean {
  if (welcomeHintDismissed === null) {
    try {
      welcomeHintDismissed = window.sessionStorage.getItem(SCAN_WELCOME_HINT_STORAGE_KEY) === "true"
    } catch {
      // A blocked session store only means the hint may greet them once more.
      welcomeHintDismissed = false
    }
  }
  return welcomeHintDismissed
}

function subscribeToWelcomeHint(listener: () => void) {
  welcomeHintListeners.add(listener)
  return () => {
    welcomeHintListeners.delete(listener)
  }
}

/** Test seam: drops the cached session flag so each case starts from a clean store. */
export function resetScanWelcomeHintForTests() {
  welcomeHintDismissed = null
}

function dismissWelcomeHint() {
  welcomeHintDismissed = true
  try {
    window.sessionStorage.setItem(SCAN_WELCOME_HINT_STORAGE_KEY, "true")
  } catch {
    // See above: losing the marker costs one extra greeting, nothing more.
  }
  for (const listener of welcomeHintListeners) listener()
}

export function ScanWelcomeHint() {
  const dismissed = useSyncExternalStore(
    subscribeToWelcomeHint,
    readWelcomeHintDismissed,
    () => true,
  )

  if (dismissed) return null
  return (
    <div
      className="mx-auto flex max-w-[36rem] items-center justify-between gap-3 px-5 pt-4"
      data-scan-welcome-hint
      role="status"
    >
      <p className="text-sm leading-6 text-[var(--text-sub)]">{SCAN_WELCOME_HINT}</p>
      <button
        type="button"
        className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground"
        onClick={dismissWelcomeHint}
      >
        {SCAN_WELCOME_HINT_DISMISS}
      </button>
    </div>
  )
}

export function ScanPageClient({
  tier,
  merklisteEnabled,
  bindSkippedNotice = false,
  welcomeHint = false,
}: {
  tier: EntitlementTier
  merklisteEnabled: boolean
  bindSkippedNotice?: boolean
  /** Set by `?welcome=scan`, the hand-over from /plan-bereit for a scan_v1 buyer. */
  welcomeHint?: boolean
}) {
  const router = useRouter()
  return (
    <>
      {welcomeHint ? <ScanWelcomeHint /> : null}
      {bindSkippedNotice ? (
        <p
          className="mx-auto max-w-[36rem] px-5 pt-4 text-sm leading-6 text-[var(--text-sub)]"
          data-scan-bind-skipped-notice
          role="status"
        >
          {BIND_SKIPPED_NOTICE}
        </p>
      ) : null}
      <ScanFlow
        analytics={scanAnalytics}
        tier={tier}
        merklisteEnabled={merklisteEnabled}
        navigate={router.push}
      />
    </>
  )
}
