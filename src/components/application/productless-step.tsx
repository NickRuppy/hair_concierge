import { MoveDown } from "lucide-react"

import type { ApplicationTransitionStepView } from "./application-types"

export function ProductlessStep({
  step,
  position,
}: {
  step: ApplicationTransitionStepView
  position: number
}) {
  return (
    <li className="grid grid-cols-[34px_minmax(0,1fr)] gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-[var(--brand-plum-light)] bg-background text-sm font-semibold text-[var(--text-caption)]">
        {position}
      </span>
      <div className="rounded-md border border-dashed border-[var(--brand-plum-light)] bg-card px-4 py-3">
        <p className="type-body-sm flex items-start gap-2 text-[var(--text-sub)]">
          <MoveDown
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-plum)]"
            aria-hidden="true"
          />
          <span>{step.copyDe}</span>
        </p>
      </div>
    </li>
  )
}
