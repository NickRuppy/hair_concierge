import type { MouseEvent } from "react"
import Link from "next/link"

import type { ApplicationDayView } from "./application-types"
import { ProductApplicationBlock } from "./product-application-block"
import { ProductlessStep } from "./productless-step"
import { UnresolvedProductBlock } from "./unresolved-product-block"

export function ApplicationDay({
  day,
  overviewHref,
  onOpenOverview,
}: {
  day: ApplicationDayView
  /** Fix round 1 (I-2): the quiet in-page Back the day view lost when the journey header retired. */
  overviewHref: string
  onOpenOverview?: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  return (
    <article
      aria-labelledby="application-day-title"
      className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6"
    >
      <Link
        href={overviewHref}
        onClick={onOpenOverview}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--text-caption)] hover:underline"
      >
        ← Anwendung
      </Link>
      <header className="border-b border-border pb-4">
        <h1
          id="application-day-title"
          className="type-h1 text-[var(--text-heading)]"
          data-personal-plan-transition-focus
          tabIndex={-1}
        >
          {day.labelDe}
        </h1>
        <p className="type-body mt-2 text-[var(--text-sub)]">{day.summaryDe}</p>
        {day.cadenceDe && (
          <p className="type-body-sm mt-3 text-[var(--text-caption)]">{day.cadenceDe}</p>
        )}
      </header>

      {day.steps.length > 0 ? (
        <ol className="mt-5 space-y-4">
          {day.steps.map((step, index) =>
            step.kind === "product" ? (
              <ProductApplicationBlock
                key={step.applicationInstanceKey}
                step={step}
                position={index + 1}
              />
            ) : step.kind === "unresolved_product" ? (
              <UnresolvedProductBlock
                key={step.applicationInstanceKey}
                step={step}
                position={index + 1}
              />
            ) : (
              <ProductlessStep key={step.stepKey} step={step} position={index + 1} />
            ),
          )}
        </ol>
      ) : (
        <p className="type-body mt-6 rounded-md border border-border bg-card p-4 text-[var(--text-body)]">
          {/* Only the Pausentag legitimately compiles without steps; any other day
              reaching this state is outside the compiler contract and must not be
              mislabeled as a rest day. */}
          {day.dayType === "rest_day"
            ? "An einem Pausentag ist keine Anwendung nötig."
            : "Für diesen Tag liegt gerade keine Anleitung vor."}
        </p>
      )}
    </article>
  )
}
