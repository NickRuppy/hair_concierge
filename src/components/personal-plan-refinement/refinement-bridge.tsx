"use client"

import { Icon } from "@/components/ui/icon"

export function RefinementBridge({
  refinedVersionId,
  nextHref,
  onBack,
}: {
  refinedVersionId: string
  nextHref: "/plan-start/produkte"
  onBack?: () => void
}) {
  return (
    <div className="min-h-dvh bg-[var(--background,#fdfbf9)] text-[var(--text-main,#3a3835)]">
      <main
        className="mx-auto flex min-h-dvh w-full max-w-[540px] flex-col justify-center px-5 py-8"
        data-refined-version-id={refinedVersionId}
      >
        <div className="mb-6 grid grid-cols-5 gap-1" aria-label="Personal-Plan-Stufen">
          {["Bedarf", "Verfeinerung", "Produkte", "Routine", "Anwendung"].map((label, index) => (
            <span
              key={label}
              className={`text-center text-[9px] font-bold ${index <= 2 ? "text-[var(--brand-plum)]" : "text-[var(--text-muted,#736f69)]"}`}
            >
              <span
                className={`mx-auto mb-1 block h-2.5 w-2.5 rounded-full ${index < 2 ? "bg-[var(--brand-plum)]" : index === 2 ? "border-2 border-[var(--brand-coral,#d4616a)]" : "border border-[var(--border,#e7e0d9)]"}`}
              />
              {label}
            </span>
          ))}
        </div>
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--brand-plum)]">
          Nächster Schritt · Produkte erfassen
        </p>
        <div className="rounded-[22px] border border-[rgba(var(--brand-plum-rgb),0.14)] bg-gradient-to-br from-[#f3edf8] to-[#fff8f3] px-5 py-7 text-center shadow-[0_14px_40px_-34px_rgba(42,24,69,0.65)]">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[18px] bg-white text-[var(--brand-plum)] shadow-[0_9px_24px_rgba(59,38,80,0.1)]">
            <Icon name="arrow-right" size={24} />
          </span>
          <h1 className="font-serif text-[30px] font-medium leading-tight tracking-normal text-[var(--brand-plum-darkest,#2a1845)]">
            Jetzt schauen wir uns deine Produkte an.
          </h1>
          <p className="mx-auto mt-3 max-w-[360px] text-sm leading-6 text-[var(--text-sub,#6a6560)]">
            Deine Antworten sind gespeichert. Ab hier beginnt die konkrete Produkterfassung ohne
            weiteren Frageblock.
          </p>
        </div>
        <p className="mt-4 rounded-xl bg-[#f5f2ee] px-3 py-2.5 text-xs leading-5 text-[var(--text-sub,#6a6560)]">
          <span className="font-bold text-[#4f8058]">✓</span> Deine Antworten sind gespeichert. Die
          Produkterfassung kann mit diesem Stand beginnen.
        </p>
        <div className="mt-6 flex gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="min-h-[52px] rounded-xl px-3 text-sm font-bold text-[var(--brand-plum)] transition hover:bg-[var(--brand-plum-ice)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-plum-rgb),0.35)]"
            >
              Zur letzten Frage
            </button>
          ) : null}
          <button
            type="button"
            data-stage2-next-href={nextHref}
            className="inline-flex min-h-[52px] flex-1 items-center justify-center rounded-xl bg-[var(--brand-coral,#d4616a)] px-4 text-sm font-bold text-white shadow-[0_10px_25px_rgba(212,97,106,0.18)] transition hover:bg-[var(--brand-coral-dark,#c0555d)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-plum-rgb),0.35)]"
          >
            Produkte erfassen&nbsp; →
          </button>
        </div>
      </main>
    </div>
  )
}
