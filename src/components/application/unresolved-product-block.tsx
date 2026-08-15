import { CircleHelp } from "lucide-react"

import type { ApplicationUnresolvedProductStepView } from "./application-types"

export function UnresolvedProductBlock({
  step,
  position,
}: {
  step: ApplicationUnresolvedProductStepView
  position: number
}) {
  // A demoted confirmed product is not an open product decision, so it must not
  // read as "noch offen".
  const catalogUnavailable = step.reason === "catalog_unavailable"
  const titleDe = catalogUnavailable
    ? "Produkt gerade nicht verfügbar"
    : (step.productName ?? "Produkt noch offen")
  const bodyDe = catalogUnavailable
    ? "Dein gewähltes Produkt ist im Katalog gerade nicht verfügbar. Deine Routine bleibt gespeichert."
    : step.productName
      ? "Die Anwendung für dieses Produkt wird noch geprüft. Sobald die fehlenden Details bestätigt sind, ergänzen wir sie an dieser Stelle."
      : "Für diese Kategorie fehlen noch ein bestätigtes Produkt und geprüfte Anwendungsdetails."
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
            <h2 className="type-h3 break-words text-[var(--text-heading)]">{titleDe}</h2>
            <p className="type-body-sm mt-1 text-[var(--text-sub)]">{bodyDe}</p>
          </div>
        </div>
      </article>
    </li>
  )
}
