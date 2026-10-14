import { LockKeyhole } from "lucide-react"

import type { OfferPreviewCategory, QuizOfferPreview } from "@/lib/quiz/offer-preview-types"

export const OFFER_PREVIEW_CATEGORY_TITLES: Record<OfferPreviewCategory, string> = {
  shampoo: "Shampoo",
  conditioner: "Conditioner",
  protein_mask: "Protein-Maske",
  moisture_mask: "Feuchtigkeitsmaske",
  leave_in: "Leave-in",
  oil: "Haaröl",
  bondbuilder: "Bondbuilder",
}

export function OfferPreviewRoutine({ preview }: { preview: QuizOfferPreview }) {
  const foundationProducts = preview.products.filter((product) => !product.suggested)
  const lockedProduct = preview.products.find((product) => product.suggested)

  return (
    <section className="pt-4">
      <div data-offer-section="mini_routine">
        <div className="space-y-3">
          {foundationProducts.map((product) => (
            <article
              key={product.key}
              className="relative flex min-h-[132px] gap-4 overflow-hidden rounded-[18px] border border-border bg-white p-4 shadow-[0_8px_30px_-26px_rgba(var(--brand-plum-rgb),0.5)]"
            >
              <div className="grid h-[100px] w-[82px] shrink-0 place-items-center overflow-hidden rounded-[12px] bg-[var(--brand-plum-ice)] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- catalog images are hosted in the project's Supabase bucket. */}
                <img
                  alt={product.name}
                  className="h-full w-full object-contain"
                  loading="lazy"
                  src={product.imageUrl}
                />
              </div>
              <div className="min-w-0 flex-1 py-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.09em] text-[var(--brand-plum)]">
                    {product.categoryLabel}
                  </p>
                </div>
                <h3 className="mt-1.5 text-[15px] font-bold leading-snug text-[var(--brand-plum-darkest)]">
                  {product.name}
                </h3>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                  {product.note}
                </p>
                <p className="mt-2 text-[11px] font-semibold text-[var(--brand-plum)]">
                  {product.cadence.label}
                  {product.cadence.qualifier ? ` · ${product.cadence.qualifier}` : ""}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-3" data-offer-section="locked_routine">
        <article className="relative min-h-[132px] overflow-hidden rounded-[18px] border border-[rgba(var(--brand-coral-rgb),0.38)] bg-white p-4 shadow-[0_8px_30px_-26px_rgba(var(--brand-plum-rgb),0.5)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.09em] text-[var(--brand-plum)]">
                {lockedProduct ? "Dein nächster Pflegeschritt" : "Dein vollständiger Plan"}
              </p>
              <h3 className="mt-1.5 text-[17px] font-bold leading-snug text-[var(--brand-plum-darkest)]">
                {lockedProduct
                  ? OFFER_PREVIEW_CATEGORY_TITLES[lockedProduct.category]
                  : "Deine weiteren Pflegeschritte"}
              </h3>
            </div>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--brand-coral-light)] text-[var(--brand-coral-dark)]">
              <LockKeyhole className="size-4" aria-hidden="true" />
            </span>
          </div>
          <div
            aria-hidden="true"
            className="relative mt-4 h-[52px] overflow-hidden rounded-[10px] bg-[var(--brand-plum-ice)]/70"
          >
            <div className="space-y-2 p-3 opacity-65 blur-[5px]">
              <div className="h-3 w-4/5 rounded-full bg-[var(--brand-plum-light)]" />
              <div className="h-3 w-3/5 rounded-full bg-[var(--brand-plum-light)]" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/45" />
          </div>
        </article>
        {[0, 1].map((index) => (
          <article
            key={index}
            aria-hidden="true"
            data-testid="locked-routine-placeholder"
            className="relative grid min-h-[128px] grid-cols-[82px_1fr_auto] items-center gap-3.5 overflow-hidden rounded-[18px] border border-border bg-white p-4 opacity-[0.78] shadow-[0_8px_30px_-26px_rgba(var(--brand-plum-rgb),0.5)]"
          >
            <div className="h-[96px] w-[82px] rounded-[12px] bg-[var(--brand-plum-ice)]" />
            <div className="min-w-0 space-y-3 blur-[6px]">
              <div className="h-2.5 w-20 rounded-full bg-[var(--brand-plum-light)]" />
              <div className="h-4 w-4/5 rounded-full bg-[var(--brand-plum-light)]" />
              <div className="flex gap-1.5">
                {[0, 1, 2, 3].map((dot) => (
                  <span key={dot} className="size-1.5 rounded-full bg-[var(--brand-coral-light)]" />
                ))}
              </div>
            </div>
            <span className="grid size-8 place-items-center rounded-full border border-[var(--brand-plum-light)] bg-white/80 text-[var(--brand-plum)] blur-[2px]">
              <LockKeyhole className="size-3.5" />
            </span>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 to-white/55" />
          </article>
        ))}
      </div>
    </section>
  )
}
