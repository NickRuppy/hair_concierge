import { CircleHelp } from "lucide-react"

import type { ApplicationUnresolvedProductStepView } from "./application-types"

export function UnresolvedProductBlock({
  step,
  position,
}: {
  step: ApplicationUnresolvedProductStepView
  position: number
}) {
  return (
    <li className="grid grid-cols-[34px_minmax(0,1fr)] gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold text-[var(--text-sub)]">
        {position}
      </span>
      <article className="rounded-md border border-dashed border-border bg-card p-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-muted text-[var(--text-sub)]">
            <CircleHelp className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="type-caption text-[var(--text-caption)]">{step.categoryLabelDe}</p>
            <h2 className="type-h3 break-words text-[var(--text-heading)]">
              {step.productName ?? "Produkt noch offen"}
            </h2>
            <p className="type-body-sm mt-1 text-[var(--text-sub)]">
              {step.productName
                ? "Die Anwendung für dieses Produkt wird noch geprüft. Sobald die fehlenden Details bestätigt sind, ergänzen wir sie an dieser Stelle."
                : "Für diese Kategorie fehlen noch ein bestätigtes Produkt und geprüfte Anwendungsdetails."}
            </p>
          </div>
        </div>
      </article>
    </li>
  )
}
