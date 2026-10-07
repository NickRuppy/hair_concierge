"use client"

import { SCAN_REVEAL_EMPTY_NOTICE } from "@/lib/scan/verdict-labels"
import type { ScanAlternativePresentation } from "@/lib/scan/types"
import {
  isMaskedScanVerdict,
  scanRevealCta,
  type ScanVerdictResult,
} from "@/lib/scan/verdict-access"

import { ScanMaskedAlternatives } from "./scan-masked-alternatives"
import { ScanAlternativesList, ScanVerdictSections } from "./scan-verdict-sections"

/**
 * The scan verdict body (UI spec §2). Same anatomy in every verdict: product header,
 * state-coloured banner, bars, "Warum"-block, alternatives (or what already covers the
 * job), quiet re-scan link. Every sentence about the user comes from the payload —
 * this file only owns fixed section chrome.
 *
 * Everything up to the alternatives lives in `scan-verdict-sections.tsx` (shared with the
 * discovery-call cockpit). `ScanVerdictSections` returns a fragment, so those sections stay
 * DIRECT children of the `flex flex-col gap-4` column below and keep their own gap slots.
 * What is left here is what only the scan sheet has: which of the three alternative shapes
 * to render, and the re-scan link.
 */

export function ScanResultCard({
  result,
  revealedAlternatives = null,
  revealAnimates = true,
  revealPending = false,
  revealUnavailable = false,
  onRescan,
  onOpenAlternative,
  onBuyAlternative,
  onReveal = () => {},
  onPremiumAlternatives = () => {},
}: {
  result: ScanVerdictResult
  /**
   * Free tier only (T9): the full alternatives the one-lifetime reveal handed back for
   * THIS product. Always `null` for a premium or flag-off verdict, whose alternatives
   * were never masked in the first place.
   */
  revealedAlternatives?: ScanAlternativePresentation[] | null
  /**
   * Whether `revealedAlternatives` should play the 1.2s unblur (fix round 1, F2). `true`
   * for an explicit CTA tap; `false` for the background same-product re-serve (a rescan or
   * a reload replaying a credit already spent on this exact product) — nothing is being
   * "revealed" to the user there, so the card should simply already look sharp.
   */
  revealAnimates?: boolean
  revealPending?: boolean
  revealUnavailable?: boolean
  onRescan: () => void
  onOpenAlternative: (productId: string) => void
  /** An alternative's "Kaufen ↗" is a buy click too — same event as the footer's. */
  onBuyAlternative: (productId: string) => void
  onReveal?: () => void
  onPremiumAlternatives?: () => void
}) {
  /**
   * Three mutually exclusive shapes for the alternatives block. The LAST one is today's
   * path, reached by every premium and every flag-off verdict (their response carries no
   * masking marker at all), and it renders exactly as before this task.
   */
  let alternativesBlock: React.ReactNode = null
  if (result.kind === "in_catalog" && isMaskedScanVerdict(result)) {
    if (revealedAlternatives) {
      if (revealedAlternatives.length > 0) {
        // The reveal succeeded: the SAME card the premium tier gets. `revealAnimates`
        // decides whether it arrives out of the masked card's blur (globals.css, 1.2s,
        // inert under reduced motion) — an explicit tap — or already sharp — the
        // background same-product re-serve (fix round 1, F2).
        const alternativesList = (
          <ScanAlternativesList
            alternatives={revealedAlternatives}
            onOpen={onOpenAlternative}
            onBuy={onBuyAlternative}
          />
        )
        alternativesBlock = revealAnimates ? (
          <div className="scan-reveal-unblur" data-scan-revealed-alternatives="">
            {alternativesList}
          </div>
        ) : (
          <div data-scan-revealed-alternatives="">{alternativesList}</div>
        )
      } else {
        // Not reachable via today's `revealAlternatives()` (it never dispatches
        // `reveal_succeeded` with an empty list — see `reveal_failed reason:"empty"`), but
        // an empty list must not silently erase the whole block for whoever calls the
        // reducer next (fix round 1, F4).
        alternativesBlock = (
          <p data-scan-reveal-empty="" className="text-[13px] leading-6 text-muted-foreground">
            {SCAN_REVEAL_EMPTY_NOTICE}
          </p>
        )
      }
    } else if (result.alternatives.length > 0) {
      alternativesBlock = (
        <ScanMaskedAlternatives
          alternatives={result.alternatives}
          cta={scanRevealCta({
            freeRevealAvailable: result.freeRevealAvailable,
            revealUnavailable,
          })}
          revealPending={revealPending}
          onReveal={onReveal}
          onPremium={onPremiumAlternatives}
        />
      )
    }
  } else if (result.kind === "in_catalog" && result.alternatives.length > 0) {
    alternativesBlock = (
      <ScanAlternativesList
        alternatives={result.alternatives}
        onOpen={onOpenAlternative}
        onBuy={onBuyAlternative}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ScanVerdictSections result={result} />

      {alternativesBlock}

      <button
        type="button"
        onClick={onRescan}
        className="min-h-[44px] self-center text-sm font-semibold text-[var(--brand-plum)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
      >
        Nochmal scannen
      </button>
    </div>
  )
}
