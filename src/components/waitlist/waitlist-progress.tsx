/**
 * Fortschrittsbalken über den Warteliste-Schritten, übernommen aus dem
 * Info-Operator-Funnel (/umfrage, /ty-event). Zweck ist nicht die exakte
 * Messung, sondern das Signal "du bist mittendrin, hör hier nicht auf".
 */
export function WaitlistProgress({ label, percent }: { label: string; percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent))

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--brand-plum)]">
          {label}
        </span>
        <span className="font-mono text-[11px] font-medium text-muted-foreground">{clamped} %</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--brand-plum)]/15"
      >
        <div
          className="h-full rounded-full bg-[var(--brand-coral)] transition-[width]"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
