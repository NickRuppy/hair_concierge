// src/components/quiz/quiz-result-lever-rows.tsx
import type { QuizResultNeedsProduct } from "@/lib/quiz/result-narrative"

interface QuizResultLeverRowsProps {
  products: readonly [QuizResultNeedsProduct, QuizResultNeedsProduct]
}

export function QuizResultLeverRows({ products }: QuizResultLeverRowsProps) {
  const [primary, secondary] = products

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span
          aria-label="Primärer Hebel"
          className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[var(--brand-coral-light)] text-[14px] font-bold text-[var(--brand-coral-dark)]"
        >
          ★
        </span>
        <div>
          <h3 className="font-header text-[17px] font-medium leading-[1.25] text-[var(--brand-plum-darkest)]">
            {primary.name}
          </h3>
          <p className="mt-1 text-[13.5px] leading-[1.5] text-muted-foreground">
            {primary.description}
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <span
          aria-label="Sekundärer Hebel"
          className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[var(--brand-plum-ice)] text-[14px] font-bold text-[var(--brand-plum)]"
        >
          +
        </span>
        <div>
          <h3 className="font-header text-[17px] font-medium leading-[1.25] text-[var(--brand-plum-darkest)]">
            {secondary.name}
          </h3>
          <p className="mt-1 text-[13.5px] leading-[1.5] text-muted-foreground">
            {secondary.description}
          </p>
        </div>
      </div>
    </div>
  )
}
