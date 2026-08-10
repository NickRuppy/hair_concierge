import { Sparkles } from "lucide-react"

import type { ApplicationProductStepView } from "./application-types"

export function ProductApplicationBlock({
  step,
  position,
}: {
  step: ApplicationProductStepView
  position: number
}) {
  const provisional = step.status === "provisional"

  return (
    <li className="grid grid-cols-[34px_minmax(0,1fr)] gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-plum)] text-sm font-semibold text-white">
        {position}
      </span>
      <article
        className={`rounded-md border p-4 shadow-[0_18px_42px_-34px_rgba(var(--brand-plum-rgb),0.78)] ${
          provisional
            ? "border-amber-300 bg-amber-50"
            : "border-[var(--brand-plum-light)] bg-[var(--brand-plum-ice)]"
        }`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-white text-[var(--brand-plum)]">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="type-caption flex flex-wrap items-center gap-2 text-[var(--text-caption)]">
              {step.categoryLabelDe}
              {provisional ? (
                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                  Vorläufig
                </span>
              ) : null}
            </p>
            <h2 className="type-h3 break-words text-[var(--text-heading)]">{step.productName}</h2>
            <p className="type-body-sm mt-1 text-[var(--text-sub)]">{step.purposeDe}</p>
            {provisional ? (
              <p className="type-body-sm mt-2 text-amber-900">
                {step.provisionalReason === "application_review"
                  ? "Diese Anwendung nutzt vorläufig die geprüfte Kategorie-Anleitung."
                  : "Das Produkt ist noch nicht bestätigt; seine Anwendung ist bereits bekannt."}
              </p>
            ) : null}
          </div>
        </div>

        <ol className="mt-4 space-y-3">
          {step.actions.map((action, index) => (
            <li key={action.actionKey} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2">
              <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-semibold text-[var(--brand-plum)]">
                {index + 1}
              </span>
              <p className="type-body-sm text-[var(--text-body)]">{action.copyDe}</p>
            </li>
          ))}
        </ol>

        {step.coverageNoteDe && (
          <p className="type-body-sm mt-4 rounded-md border border-[var(--brand-plum-light)] bg-white/70 px-3 py-2 text-[var(--text-sub)]">
            {step.coverageNoteDe}
          </p>
        )}
      </article>
    </li>
  )
}
