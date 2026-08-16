import type { ApplicationDayView } from "./application-types"
import { ProductApplicationBlock } from "./product-application-block"
import { ProductlessStep } from "./productless-step"
import { UnresolvedProductBlock } from "./unresolved-product-block"

export function ApplicationDay({ day }: { day: ApplicationDayView }) {
  return (
    <article
      aria-labelledby="application-day-title"
      className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6"
    >
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
          An einem Pausentag ist keine Anwendung nötig.
        </p>
      )}
    </article>
  )
}
