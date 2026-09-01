"use client"

export type Stage3PreparationRecoveryKind =
  | "checkpoint_changed"
  | "transient"
  | "contract_violation"

const COPY = {
  checkpoint_changed: {
    title: "Dein Feinschliff wurde aktualisiert.",
    body: "Deine Antworten sind gespeichert.",
    recoverLabel: "Aktuellen Stand laden",
  },
  transient: {
    title: "Die Produktauswahl ist gerade nicht verfügbar.",
    body: "Deine Antworten sind gespeichert.",
    recoverLabel: "Erneut versuchen",
  },
  contract_violation: {
    title: "Die Produktauswahl kann gerade nicht geöffnet werden.",
    body: "Deine Antworten sind gespeichert.",
    recoverLabel: null,
  },
} as const

export function Stage3PreparationRecoveryPanel({
  kind,
  diagnosticQueued,
  onRecover,
  onExit,
  exitLabel,
}: {
  kind: Stage3PreparationRecoveryKind
  diagnosticQueued: boolean
  onRecover?: () => void
  onExit?: () => void
  exitLabel: string
}) {
  const copy = COPY[kind]
  const body =
    kind === "contract_violation" && diagnosticQueued
      ? `${copy.body} Wir haben das Problem registriert.`
      : copy.body

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-71px)] w-full max-w-[600px] flex-col justify-center px-6 py-10 text-center">
      <div role="alert" aria-live="assertive" className="mx-auto max-w-[420px]">
        <h1 className="font-serif text-[30px] font-medium leading-tight text-[var(--brand-plum-darkest,#2a1845)]">
          {copy.title}
        </h1>
        <p className="mt-3 text-base leading-6 text-[var(--text-sub,#6a6560)]">{body}</p>
      </div>
      {onRecover || onExit ? (
        <div className="mx-auto mt-7 flex w-full max-w-[320px] flex-col gap-2">
          {copy.recoverLabel && onRecover ? (
            <button
              type="button"
              onClick={onRecover}
              className="min-h-12 rounded-full bg-[var(--brand-plum,#6B50A0)] px-5 text-sm font-extrabold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copy.recoverLabel}
            </button>
          ) : null}
          {onExit ? (
            <button
              type="button"
              onClick={onExit}
              className={`${copy.recoverLabel ? "bg-transparent text-[var(--brand-plum,#6B50A0)]" : "bg-[var(--brand-plum,#6B50A0)] text-white"} min-h-12 rounded-full px-5 text-sm font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
            >
              {exitLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </main>
  )
}
