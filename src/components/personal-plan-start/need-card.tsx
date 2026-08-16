"use client"

import Image from "next/image"
import { ChevronRight, Clock3 } from "lucide-react"
import { useState } from "react"

import type { Stage1Category } from "@/lib/personal-plan/types"
import { cn } from "@/lib/utils"

import { ProductDetailSheet } from "./product-detail-sheet"

export type NeedCardTone = "basis" | "optional"

/** The concrete catalog pick that leads the card once previews are loaded. */
export type NeedCardProduct = {
  name: string
  priceLabel: string | null
  netContentLabel: string | null
  availabilityLabel: string
  /** Only set when the purchase link is available and safe. */
  productUrl: string | null
}

/** Honest state for a category without a qualifying product recommendation. */
export const NEED_CARD_FALLBACK_NOTE = "Produktempfehlung folgt nach dem Feinschliff"

export type NeedCardViewModel = {
  id: string
  tone: NeedCardTone
  categoryLabel: string
  statusLabel: "Basis" | "Optional" | "Pausiert"
  targetType: string
  purpose: string
  pills: string[]
  frequency: string
  imageUrl: string | null
  imageAlt?: string
  paused?: boolean
  product?: NeedCardProduct | null
  fallbackNote?: string | null
  detailBlocks: Array<{
    title: string
    body: string
  }>
}

const CATEGORY_CARD_STYLES = {
  shampoo: { shellClassName: "border-[#E2D4B8] bg-[#F5F0E5]", dotClassName: "bg-[#A77D31]" },
  conditioner: { shellClassName: "border-[#CFDEE3] bg-[#EDF3F5]", dotClassName: "bg-[#4C8EA8]" },
  leave_in: { shellClassName: "border-[#CEDFD5] bg-[#EDF4F0]", dotClassName: "bg-[#56866B]" },
  heat_protectant: {
    shellClassName: "border-[#E5D6C8] bg-[#F5F0EA]",
    dotClassName: "bg-[#B76A3E]",
  },
  oil: { shellClassName: "border-[#E2D0D4] bg-[#F5EDEF]", dotClassName: "bg-[#A85F70]" },
  mask: { shellClassName: "border-[#DCD3E5] bg-[#F1EEF5]", dotClassName: "bg-[#7D67A8]" },
  scalp_care: { shellClassName: "border-[#CADEDB] bg-[#EBF3F2]", dotClassName: "bg-[#2F817A]" },
  dry_shampoo: {
    shellClassName: "border-[#DCE2C6] bg-[#F1F3E9]",
    dotClassName: "bg-[#7D913F]",
  },
  bondbuilder: { shellClassName: "border-[#E2D1DF] bg-[#F4EDF3]", dotClassName: "bg-[#985D8F]" },
  deep_cleansing_shampoo: {
    shellClassName: "border-[#E2DBC0] bg-[#F5F2E5]",
    dotClassName: "bg-[#998323]",
  },
} satisfies Record<Stage1Category, { shellClassName: string; dotClassName: string }>

const NEUTRAL_CARD_STYLE = {
  shellClassName: "border-[rgba(31,26,20,0.07)] bg-white",
  dotClassName: "bg-[#6B50A0]",
}

export function NeedCard({ card }: { card: NeedCardViewModel }) {
  const [open, setOpen] = useState(false)
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const hasImage = Boolean(card.imageUrl) && failedImageUrl !== card.imageUrl
  const categoryStyle = CATEGORY_CARD_STYLES[card.id as Stage1Category] ?? NEUTRAL_CARD_STYLE
  const product = card.product ?? null
  const subline = product ? [card.targetType, product.priceLabel].filter(Boolean).join(" · ") : null

  return (
    <article
      className={cn(
        "overflow-hidden rounded-[19px] border shadow-[0_3px_11px_rgba(43,26,67,0.035)]",
        categoryStyle.shellClassName,
      )}
      data-plan-start-card={card.id}
      data-plan-start-card-tone={card.tone}
      data-plan-start-card-paused={card.paused ? "true" : "false"}
      data-plan-start-card-preview={hasImage ? "example" : "absent"}
    >
      <button
        type="button"
        className={cn(
          "grid w-full grid-cols-[66px_minmax(0,1fr)_16px] cursor-pointer items-center gap-3 bg-transparent p-3 text-left text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-[-3px]",
          "max-[360px]:gap-2 max-[360px]:p-2.5",
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span
          aria-hidden={hasImage ? undefined : true}
          data-plan-start-card-image-slot={hasImage ? "loaded" : "reserved"}
          className={cn(
            "relative grid h-[82px] w-[66px] shrink-0 place-items-center overflow-hidden rounded-[14px] bg-[#f3efe8] shadow-[inset_0_0_0_1px_rgba(31,26,20,0.04)]",
            "max-[360px]:h-[76px] max-[360px]:w-[58px]",
          )}
        >
          {hasImage ? (
            <Image
              src={card.imageUrl!}
              alt={card.imageAlt ?? `Produktbild: ${card.categoryLabel}`}
              fill
              sizes="66px"
              unoptimized
              className="object-contain p-1.5"
              onError={() => setFailedImageUrl(card.imageUrl)}
            />
          ) : null}
        </span>

        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-1.5 text-[8.5px] font-extrabold uppercase tracking-[0.11em] text-[#6B50A0]">
            <span
              aria-hidden="true"
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", categoryStyle.dotClassName)}
            />
            <span className="truncate">{card.categoryLabel}</span>
            {card.statusLabel !== "Basis" ? (
              <span
                className={cn(
                  "shrink-0 rounded-full bg-[rgba(107,80,160,0.14)] px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#6B50A0]",
                  card.paused && "bg-[rgba(200,160,40,0.18)] text-[#7f5d0c]",
                )}
              >
                {card.statusLabel}
              </span>
            ) : null}
          </span>
          <strong className="mt-1 line-clamp-2 block text-[13.5px] leading-[1.18] text-[#291a43]">
            {product ? product.name : card.targetType}
          </strong>
          {subline ? (
            <span className="mt-0.5 block truncate text-[10px] font-semibold text-[#6a5f8a]">
              {subline}
            </span>
          ) : null}
          <span className="mt-0.5 line-clamp-2 block text-[9.8px] leading-[1.32] text-[#5f5954]">
            {card.purpose}
          </span>
          {!product && card.fallbackNote ? (
            <span className="mt-0.5 block text-[9.5px] leading-[1.32] text-[#7d7770]">
              {card.fallbackNote}
            </span>
          ) : null}
          {card.pills.length ? (
            <span className="mt-1.5 flex flex-nowrap gap-1 overflow-hidden">
              {card.pills.slice(0, 2).map((pill) => (
                <span
                  key={pill}
                  className="max-w-[112px] truncate rounded-full border border-[rgba(107,80,160,0.15)] bg-white/70 px-1.5 py-0.5 text-[7.8px] font-bold text-[#62507e] max-[360px]:max-w-[88px]"
                >
                  {pill}
                </span>
              ))}
            </span>
          ) : null}
          <span className="mt-1.5 flex items-center gap-1.5 border-t border-[rgba(67,55,48,0.08)] pt-1.5 text-[8.8px] font-bold text-[#665e58]">
            <span
              className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full bg-[rgba(107,80,160,0.11)] text-[#6B50A0]"
              aria-hidden="true"
            >
              <Clock3 className="h-2.5 w-2.5" />
            </span>
            <span className="truncate">{card.frequency}</span>
          </span>
        </span>

        <ChevronRight className="h-4 w-4 text-[rgba(31,26,20,0.38)]" aria-hidden="true" />
      </button>

      <ProductDetailSheet card={card} open={open} onOpenChange={setOpen} />
    </article>
  )
}
