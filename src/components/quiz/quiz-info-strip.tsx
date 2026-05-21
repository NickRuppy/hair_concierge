"use client"

import { X, Info } from "lucide-react"

type Props = {
  onDismiss: () => void
}

export function QuizInfoStrip({ onDismiss }: Props) {
  return (
    <div
      role="note"
      className="mb-5 flex items-start gap-2.5 rounded-[10px] border border-[var(--brand-plum-light)]/50 bg-[var(--brand-plum-ice)] px-3.5 py-2.5 text-[13px] leading-snug text-[var(--brand-plum-darkest)]"
    >
      <Info
        aria-hidden="true"
        className="mt-px h-[18px] w-[18px] shrink-0 text-[var(--brand-plum)]"
      />
      <p className="flex-1">
        <strong className="font-semibold">
          Lass uns deine Haare verstehen — Schritt für Schritt.
        </strong>{" "}
        9 schnelle Fragen zur Basis, dann gehts an deine Routine und Produkte.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Hinweis schließen"
        className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-[var(--brand-plum-darkest)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  )
}
