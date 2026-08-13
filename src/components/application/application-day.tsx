import type { ApplicationDayView } from "./application-types"
import Link from "next/link"
import { ProductApplicationBlock } from "./product-application-block"
import { ProductlessStep } from "./productless-step"
import { UnresolvedProductBlock } from "./unresolved-product-block"

export function ApplicationDay({ day }: { day: ApplicationDayView }) {
  return (
    <article
      aria-labelledby="application-day-title"
      className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6"
    >
      <Link
        href="/anwendung"
        className="mb-4 inline-flex min-h-[44px] items-center rounded-md px-2 text-sm font-semibold text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Alle Tage
      </Link>
      <header className="border-b border-border pb-4">
        <h1 id="application-day-title" className="type-h1 text-[var(--text-heading)]">
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
          An einem Pausentag ist keine Anwendung nötig.
        </p>
      )}
    </article>
  )
}
