export type RoutineRefinementNudgeProps = {
  onDismiss: () => void
  onRefine: () => void
}

/**
 * The dismissible "Dein Plan basiert noch auf Annahmen." banner shown on the
 * Routine page while the active Routine came from a direct accept and has
 * not yet been through a real Feinschliff. Visibility and the snooze window
 * are computed by the pure logic in `./nudge`; this component only renders
 * once the caller has decided it should be visible.
 */
export function RoutineRefinementNudge({ onDismiss, onRefine }: RoutineRefinementNudgeProps) {
  return (
    <div className="relative flex flex-col gap-2 rounded-[14px] border border-[rgba(107,80,160,0.18)] bg-[var(--brand-plum-ice)] px-4 py-3">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Hinweis schließen"
        className="absolute right-2.5 top-2 text-sm font-bold text-[var(--brand-plum)] transition hover:text-[var(--brand-plum-dark)]"
      >
        ✕
      </button>
      <p className="pr-5 text-[13px] leading-relaxed text-[var(--brand-plum-dark)]">
        <strong className="font-bold">Dein Plan basiert noch auf Annahmen.</strong> Der Feinschliff
        passt ihn in ca. 2 Minuten an deinen Alltag und deine Produkte an.
      </p>
      <button
        type="button"
        onClick={onRefine}
        className="self-start rounded-full bg-[var(--brand-plum)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--brand-plum-dark)]"
      >
        Jetzt verfeinern
      </button>
    </div>
  )
}
