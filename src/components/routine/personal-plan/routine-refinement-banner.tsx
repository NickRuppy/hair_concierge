import type { Stage2Module } from "@/lib/personal-plan/refinement/types"

export type RoutineRefinementBannerViewModel = {
  module: Stage2Module
  completedSteps: number
  totalSteps: number
}

export type RoutineRefinementBannerProps = RoutineRefinementBannerViewModel & {
  onDismiss: () => void
  onRefine: () => void
}

/**
 * Copy and CTA duration per module (mockup v3, signed off 25.08.2026):
 * `products` is the first ask; `habits` is the second one once `products` is
 * done. The banner never re-derives progress or module state itself — both
 * come straight from the refinement-status API (Task 1.7) via the caller.
 */
const MODULE_BANNER_COPY: Record<Stage2Module, { title: string; ctaMinutes: number }> = {
  products: { title: "Mach deinen Plan genauer.", ctaMinutes: 2 },
  habits: { title: "Noch ein Schritt: deine Gewohnheiten.", ctaMinutes: 3 },
}

/**
 * The Routine-page refinement banner (Task 2.3). Replaces the old 24h
 * "Dein Plan basiert noch auf Annahmen." nudge entirely. It always renders
 * directly above the routine blocks — the mockup's quieter below-the-blocks
 * slot for `habits` lost the field test on 26.08.2026 (it scrolled out of
 * view and was never seen). Only the copy still differs per module.
 */
export function RoutineRefinementBanner({
  module,
  completedSteps,
  totalSteps,
  onDismiss,
  onRefine,
}: RoutineRefinementBannerProps) {
  const copy = MODULE_BANNER_COPY[module]
  const progressPercent =
    totalSteps > 0 ? Math.max(0, Math.min(100, (completedSteps / totalSteps) * 100)) : 0

  return (
    <div className="relative rounded-[16px] border border-[#ddd2ef] bg-[var(--brand-plum-ice)] px-4 py-3.5">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Hinweis schließen"
        className="absolute right-3 top-2.5 text-[15px] font-bold text-[#a394c2] transition hover:text-[var(--brand-plum-dark)]"
      >
        ✕
      </button>
      <div className="flex items-baseline justify-between gap-2.5 pr-5">
        <span className="text-[15.5px] font-extrabold text-[var(--brand-plum-darkest)]">
          {copy.title}
        </span>
        <span className="whitespace-nowrap text-xs font-bold text-[var(--brand-plum)] [font-variant-numeric:tabular-nums]">
          {completedSteps} von {totalSteps}
        </span>
      </div>
      <div className="my-2.5 h-1.5 overflow-hidden rounded-full bg-[#e6dff2]">
        <div
          className="h-full rounded-full bg-[var(--brand-plum)]"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <button
        type="button"
        onClick={onRefine}
        className="inline-block rounded-full bg-[var(--brand-coral)] px-[18px] py-2.5 text-[13.5px] font-extrabold text-white transition hover:bg-[var(--brand-coral-dark)]"
      >
        Weiter · {copy.ctaMinutes} Min.
      </button>
    </div>
  )
}
