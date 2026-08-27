"use client"

import Image from "next/image"

import { BottomSheet, BottomSheetContent, BottomSheetTitle } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import type { NeedCardViewModel } from "./plan-start-cards"

/** Shown once a concrete product leads the card: the refinement can still improve it. */
export const PRODUCT_REFINEMENT_HINT =
  "Wenn du deine Produkte ergänzt, prüfen wir, ob es eine bessere Wahl für dich gibt."

export function ProductDetailSheet({
  card,
  open,
  onOpenChange,
}: {
  card: NeedCardViewModel
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent
        className="max-h-[86vh] bg-[#fdfbf9]"
        data-plan-start-detail-sheet={card.id}
      >
        <ProductDetailSheetBody card={card} />
      </BottomSheetContent>
    </BottomSheet>
  )
}

/**
 * Presentational sheet body. Kept separate from the sheet chrome so it can be
 * rendered (and asserted on) without a mounted portal.
 */
export function ProductDetailSheetBody({ card }: { card: NeedCardViewModel }) {
  const product = card.product ?? null

  return (
    <div className="pb-2">
      <p className="pr-10 text-[12px] font-semibold text-[#6B50A0]">
        {product ? `${card.categoryLabel} · ${card.targetType}` : card.categoryLabel}
      </p>
      <BottomSheetTitle className="font-header mt-0.5 text-[20px] leading-[1.15] tracking-[-0.01em] text-[#291a43]">
        {product ? product.name : card.targetType}
      </BottomSheetTitle>

      {product ? (
        <div className="mt-3 grid grid-cols-[84px_minmax(0,1fr)] items-start gap-3.5">
          <span className="relative grid h-[110px] w-[84px] place-items-center overflow-hidden rounded-[14px] bg-[#f3efe8] shadow-[inset_0_0_0_1px_rgba(31,26,20,0.04)]">
            {card.imageUrl ? (
              <Image
                src={card.imageUrl}
                alt={card.imageAlt ?? `Produktbild: ${product.name}`}
                fill
                sizes="84px"
                unoptimized
                className="object-contain p-2"
              />
            ) : null}
          </span>
          <span className="flex min-w-0 flex-col gap-[3px] text-[12.5px]">
            {product.priceLabel ? (
              <span className="text-[17px] font-extrabold text-[#291a43]">
                {product.priceLabel}
              </span>
            ) : null}
            {product.netContentLabel ? (
              <span className="text-[#6a6560]">{product.netContentLabel}</span>
            ) : null}
            {product.availabilityLabel ? (
              <span
                data-availability-tone={
                  product.purchaseLinkStatus === "available" ? "available" : "muted"
                }
                className={
                  product.purchaseLinkStatus === "available"
                    ? "text-[12px] font-semibold text-[#356b45]"
                    : "text-[12px] font-semibold text-[#6a6560]"
                }
              >
                {product.availabilityLabel}
              </span>
            ) : null}
          </span>
        </div>
      ) : null}

      <div className="mt-3 space-y-2.5">
        {card.detailBlocks.map((block, index) => (
          <section
            key={`${block.title}-${index}`}
            className="rounded-[11px] border border-[#e8e4df] bg-[#f8f5f2] px-3 py-2.5"
          >
            <h3 className="text-[11px] font-bold text-[#291a43]">{block.title}</h3>
            <p className="mt-0.5 text-[11px] leading-[1.45] text-[#625d58]">{block.body}</p>
          </section>
        ))}
      </div>

      {product ? (
        <p className="mt-3 rounded-[9px] bg-[rgba(107,80,160,0.08)] px-2.5 py-[7px] text-[10.5px] leading-snug text-[#6a5f8a]">
          {PRODUCT_REFINEMENT_HINT}
        </p>
      ) : card.fallbackNote ? (
        <p className="mt-3 rounded-[9px] bg-[rgba(107,80,160,0.08)] px-2.5 py-[7px] text-[10.5px] leading-snug text-[#6a5f8a]">
          {card.fallbackNote}
        </p>
      ) : null}

      {product?.productUrl ? (
        <Button
          type="button"
          variant="funnelCta"
          className="mt-3 h-auto w-full py-3.5 text-[14px]"
          onClick={() => window.open(product.productUrl!, "_blank", "noopener,noreferrer")}
        >
          Zum Produkt
        </Button>
      ) : null}
    </div>
  )
}
