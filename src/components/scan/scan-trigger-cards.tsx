"use client"

import Link from "next/link"

import type { ScanProactiveTriggerId } from "@/lib/scan/triggers/trigger-rules"

/**
 * The two NEW trigger surfaces T10 adds to the scan result sheet (the other 6 triggers
 * reuse T9's existing surfaces — the reveal CTA, the Premium alternatives CTA, the Merken
 * lock, and the honest unknown-product flow — unchanged). Both are additive cards rendered
 * below `ScanResultCard`, never inside it, so T9's tested composition stays untouched.
 *
 * Copy is short, telegram-style placeholder German (final polish is a later task, T13).
 */

const PROACTIVE_TRIGGER_COPY: Record<
  ScanProactiveTriggerId,
  { title: string; body: string; cta: string }
> = {
  kategorien_luecke: {
    title: "Lücke in deiner Routine",
    body: "Dir fehlt noch ein Leave-in.",
    cta: "Zur Routine",
  },
  passt_gut_moment: {
    title: "Starke Basis",
    body: "Vervollständige deine Routine.",
    cta: "Routine ansehen",
  },
  frust_serie: {
    title: "Zweimal passt's nicht",
    body: "Eine geprüfte Routine erspart dir das Rätselraten.",
    cta: "Routine ansehen",
  },
  wiederkehrer: {
    title: "Wieder da?",
    body: "Deine Routine wartet noch auf dich.",
    cta: "Routine ansehen",
  },
}

/**
 * The winning proactive pitch (5-8), fatigue-limited to one per session (`scan-flow.tsx`
 * decides which id, if any, is currently shown). `kategorien_luecke` is the one journey-
 * ruled exception: it links straight into the gated Routine page instead of opening the
 * Premium sheet — `onOpenSheet` is simply never called for it.
 */
export function ScanProactiveTriggerCard({
  id,
  onOpenSheet,
}: {
  id: ScanProactiveTriggerId
  onOpenSheet: () => void
}) {
  const copy = PROACTIVE_TRIGGER_COPY[id]
  return (
    <section
      data-scan-trigger-card={id}
      className="rounded-[14px] border border-[var(--brand-plum)] bg-[var(--brand-plum-ice)] px-4 py-3.5"
    >
      <p className="text-[13px] font-bold text-[var(--brand-plum-dark)]">{copy.title}</p>
      <p className="mt-1 text-[13px] leading-5 text-foreground">{copy.body}</p>
      {id === "kategorien_luecke" ? (
        <Link
          href="/routine"
          data-scan-trigger-cta=""
          className="mt-2 inline-block min-h-[32px] text-[13px] font-semibold text-[var(--brand-plum)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
        >
          {copy.cta}
        </Link>
      ) : (
        <button
          type="button"
          data-scan-trigger-cta=""
          onClick={onOpenSheet}
          className="mt-2 min-h-[32px] text-[13px] font-semibold text-[var(--brand-plum)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
        >
          {copy.cta}
        </button>
      )}
    </section>
  )
}

/**
 * User-initiated gate 2 (Zwei Scans, gleiche Kategorie) — always available, never
 * fatigue-limited, so it can appear alongside a proactive card in the same verdict.
 */
export function ScanCategoryRepeatCard({ onOpenSheet }: { onOpenSheet: () => void }) {
  return (
    <section
      data-scan-trigger-card="zwei_scans_gleiche_kategorie"
      className="rounded-[14px] border border-border bg-card px-4 py-3.5"
    >
      <p className="text-[13px] font-bold text-foreground">2. Scan, gleiche Kategorie</p>
      <button
        type="button"
        data-scan-trigger-cta=""
        onClick={onOpenSheet}
        className="mt-1.5 min-h-[32px] text-[13px] font-semibold text-[var(--brand-plum)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
      >
        Alle Optionen ansehen
      </button>
    </section>
  )
}
