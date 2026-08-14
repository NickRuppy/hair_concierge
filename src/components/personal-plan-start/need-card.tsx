"use client"

import Image from "next/image"
import { ChevronDown, Clock3 } from "lucide-react"
import { useId, useState } from "react"

import type { Stage1Category } from "@/lib/personal-plan/types"
import { cn } from "@/lib/utils"

export type NeedCardTone = "basis" | "optional"

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
  initiallyOpen?: boolean
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
  const [open, setOpen] = useState(Boolean(card.initiallyOpen))
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const fallbackId = useId()
  const panelId = `need-card-${card.id || fallbackId}-detail`
  const hasImage = Boolean(card.imageUrl) && failedImageUrl !== card.imageUrl
  const categoryStyle = CATEGORY_CARD_STYLES[card.id as Stage1Category] ?? NEUTRAL_CARD_STYLE

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
          "grid w-full cursor-pointer items-center gap-3 bg-transparent p-3 text-left text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-[-3px]",
          hasImage ? "grid-cols-[66px_minmax(0,1fr)_16px]" : "grid-cols-[minmax(0,1fr)_16px]",
          "max-[360px]:gap-2 max-[360px]:p-2.5",
        )}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {hasImage ? (
          <span
            className={cn(
              "relative grid h-[82px] w-[66px] shrink-0 place-items-center overflow-hidden rounded-[14px] bg-[#f3efe8] shadow-[inset_0_0_0_1px_rgba(31,26,20,0.04)]",
              "max-[360px]:h-[76px] max-[360px]:w-[58px]",
            )}
          >
            <Image
              src={card.imageUrl!}
              alt={
                card.imageAlt ??
                `Beispielbild für ${card.categoryLabel}; kein ausgewähltes Produkt.`
              }
              width={56}
              height={78}
              unoptimized
              className="h-[94%] w-[78%] object-contain"
              onError={() => setFailedImageUrl(card.imageUrl)}
            />
            <span className="absolute bottom-1 left-1 rounded-full bg-[#291a43]/80 px-1.5 py-0.5 text-[7px] font-extrabold uppercase tracking-[0.08em] text-white">
              Beispiel
            </span>
          </span>
        ) : null}

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
          <strong className="mt-1 block text-[13.5px] leading-[1.18] text-[#291a43]">
            {card.targetType}
          </strong>
          <span className="mt-0.5 line-clamp-2 block text-[9.8px] leading-[1.32] text-[#5f5954]">
            {card.purpose}
          </span>
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

        <ChevronDown
          className={cn(
            "h-4 w-4 text-[rgba(31,26,20,0.38)] transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="mx-2.5 mb-2.5 rounded-[14px] border border-[rgba(107,80,160,0.12)] bg-white/75 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
      >
        <div className="mb-2 px-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#291a43]">
          Was dein Haar braucht
        </div>
        <div className="space-y-1.5">
          {card.detailBlocks.map((block, index) => (
            <section key={`${block.title}-${index}`} className="rounded-[11px] bg-[#f8f5f2] p-2.5">
              <h3 className="text-[10.5px] font-bold leading-snug text-[#291a43]">{block.title}</h3>
              <p className="mt-1 text-[10.3px] leading-[1.42] text-[#625d58]">{block.body}</p>
            </section>
          ))}
        </div>
      </div>
    </article>
  )
}
