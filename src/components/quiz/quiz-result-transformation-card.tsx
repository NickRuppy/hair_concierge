// src/components/quiz/quiz-result-transformation-card.tsx
import { Fragment } from "react"
import type { QuizResultNarrativeRow } from "@/lib/quiz/result-narrative"

interface QuizResultTransformationCardProps {
  rows: readonly QuizResultNarrativeRow[]
}

export function QuizResultTransformationCard({ rows }: QuizResultTransformationCardProps) {
  return (
    <article
      aria-label="Transformation"
      className="relative overflow-hidden rounded-[22px] border border-black/6 bg-white shadow-[0_18px_40px_-28px_rgba(var(--brand-plum-rgb),0.3)] animate-fade-in-up"
    >
      {/* Background panels — each spans the full card height behind the grid */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 z-0 w-1/2 bg-[linear-gradient(180deg,var(--brand-coral-light)_0%,#FBDDE0_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 z-0 w-1/2 bg-[linear-gradient(180deg,#E8F4ED_0%,#D2EBDB_100%)]"
      />

      {/* Paired grid — Heute/Ziel cells in the same row share grid-row height */}
      <div className="relative z-[1] grid grid-cols-2">
        {/* Header row — single-line label, same height both sides. Tighter padding because the stamp is below them. */}
        <div className="px-4 pt-[20px] pb-[18px] pr-[14px] sm:px-5 sm:pr-[14px]">
          <h4 className="font-mono text-[10.5px] font-semibold uppercase leading-[1.2] tracking-[0.16em] text-[var(--brand-coral-dark)]">
            Heute
          </h4>
        </div>
        <div className="px-4 pt-[20px] pb-[18px] pl-[14px] sm:px-5 sm:pl-[14px]">
          <h4 className="font-mono text-[10.5px] font-semibold uppercase leading-[1.2] tracking-[0.16em] text-[#2D8A57]">
            In 4 Wochen
          </h4>
        </div>

        {/* One Fragment per row, emitting two sibling grid cells (heute / ziel).
            Both cells flex-center so the shorter side sits on the centerline of the taller side.
            42 px inner padding clears the stamp composition. */}
        {rows.map((row, index) => {
          const isFirst = index === 0
          const isLast = index === rows.length - 1
          const topPad = isFirst ? "pt-[14px]" : "pt-[10px]"
          const bottomPad = isLast ? "pb-[22px]" : "pb-[10px]"
          return (
            <Fragment key={row.label}>
              <div
                className={`flex min-h-[80px] items-center px-4 pr-[42px] sm:px-5 sm:pr-[42px] ${topPad} ${bottomPad}`}
              >
                <span className="font-header text-[16px] italic leading-[1.3] text-[#6B3439] opacity-95 sm:text-[17px]">
                  {row.before}
                </span>
              </div>
              <div
                className={`flex min-h-[80px] items-center px-4 pl-[42px] sm:px-5 sm:pl-[42px] ${topPad} ${bottomPad}`}
              >
                <span className="font-header text-[16px] font-medium italic leading-[1.3] text-[#1F4D33] sm:text-[17px]">
                  {row.after}
                </span>
              </div>
            </Fragment>
          )
        })}
      </div>

      {/* Brand stamp — vertical composition: small "mit / Chaarlie" pill above a big arrow circle */}
      <div
        aria-label="Mit Chaarlie"
        className="absolute left-1/2 top-1/2 z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[5px]"
      >
        <div className="flex flex-col items-center gap-px rounded-[22px] bg-white/90 px-[10px] py-[5px] shadow-[0_3px_10px_-6px_rgba(45,138,87,0.35)]">
          <span className="font-mono text-[8.5px] font-semibold uppercase leading-[1.15] tracking-[0.14em] text-[#2D8A57]">
            mit
          </span>
          <span className="font-mono text-[8.5px] font-semibold uppercase leading-[1.15] tracking-[0.14em] text-[#2D8A57]">
            Chaarlie
          </span>
        </div>
        <div
          className="grid size-[38px] place-items-center rounded-full bg-white text-[19px] font-bold leading-none text-[#2D8A57] shadow-[0_8px_20px_-12px_rgba(45,138,87,0.5),0_0_0_4px_rgba(255,255,255,0.9)]"
          aria-hidden="true"
        >
          →
        </div>
      </div>
    </article>
  )
}
