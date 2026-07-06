"use client"

import Image from "next/image"
import {
  ArrowLeftRight,
  ArrowUp,
  ChevronRight,
  Hourglass,
  MessageCircle,
  Trash2,
  X,
} from "lucide-react"

import type { RoutineUiCard } from "@/lib/routines/types"
import { cn } from "@/lib/utils"
import {
  getRoutineCardVisual,
  routineCardFrequencyLine,
  routineCardTitle,
  type RoutineCardVisual,
} from "./routine-card-model"

type RoutineCardProps = {
  card: RoutineUiCard
  busy?: boolean
  onTap: (card: RoutineUiCard) => void
  onDismissSuggestion: (card: RoutineUiCard) => void
}

function CardTile({ card }: { card: RoutineUiCard }) {
  const baseClassName =
    "flex h-[100px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] shadow-[inset_0_0_0_1px_rgba(31,26,20,0.04)]"

  if (card.kind === "pending") {
    return (
      <div
        className={baseClassName}
        style={{ background: "linear-gradient(155deg,#F5EBD2,#E6D4A8)" }}
      >
        <Hourglass className="h-8 w-8 text-[#8a6a30]" aria-hidden="true" />
      </div>
    )
  }

  if (card.kind === "suggestion") {
    return (
      <div className={cn(baseClassName, "bg-[#F2EEFA] opacity-70 saturate-[0.7]")}>
        <span aria-hidden="true" className="font-serif text-3xl font-medium text-[#6B50A0]/25">
          {card.categoryLabel.charAt(0)}
        </span>
      </div>
    )
  }

  const imageUrl = card.product?.image_url ?? null

  return (
    <div className={cn(baseClassName, "bg-[#F2EEFA]")}>
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          width={53}
          height={80}
          unoptimized
          className="h-[80%] w-[60%] object-contain"
        />
      ) : (
        <span aria-hidden="true" className="font-serif text-3xl font-medium text-[#6B50A0]/25">
          {card.categoryLabel.charAt(0)}
        </span>
      )}
    </div>
  )
}

function CardAction({ visual }: { visual: RoutineCardVisual }) {
  if (visual.action === "chevron") {
    return <ChevronRight className="h-4 w-4 text-[rgba(31,26,20,0.32)]" aria-hidden="true" />
  }

  const icon =
    visual.action === "swap" ? (
      <ArrowLeftRight className="h-[15px] w-[15px] text-[#C8A038]" aria-hidden="true" />
    ) : visual.action === "more" ? (
      <ArrowUp className="h-[15px] w-[15px] text-[#C86850]" aria-hidden="true" />
    ) : visual.action === "trash" ? (
      <Trash2 className="h-[15px] w-[15px] text-[#C8A038]" aria-hidden="true" />
    ) : (
      <MessageCircle className="h-[15px] w-[15px] text-[#6B50A0]" aria-hidden="true" />
    )

  const ringClassName =
    visual.action === "swap" || visual.action === "trash"
      ? "border-[rgba(200,160,40,0.35)]"
      : visual.action === "more"
        ? "border-[rgba(200,100,80,0.35)]"
        : "border-[rgba(107,80,160,0.35)]"

  return (
    <div className="flex flex-col items-center gap-[3px]" aria-hidden="true">
      <span
        className={cn(
          "inline-flex h-[30px] w-[30px] items-center justify-center rounded-full border bg-white/70",
          ringClassName,
        )}
      >
        {icon}
      </span>
      {visual.actionLabel && (
        <span className="text-[8.5px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
          {visual.actionLabel}
        </span>
      )}
    </div>
  )
}

export function RoutineCard({ card, busy, onTap, onDismissSuggestion }: RoutineCardProps) {
  const visual = getRoutineCardVisual(card)
  const frequencyLine = routineCardFrequencyLine(card)

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`${card.categoryLabel}: ${routineCardTitle(card)}`}
      onClick={() => {
        if (!busy) onTap(card)
      }}
      onKeyDown={(event) => {
        if (busy) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onTap(card)
        }
      }}
      className={cn(
        "relative grid min-w-0 cursor-pointer grid-cols-[88px_1fr_auto] items-center gap-3.5 rounded-[20px] border p-3.5 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        visual.cardClassName,
        busy && "pointer-events-none opacity-70",
      )}
      style={visual.cardStyle}
    >
      {card.kind === "suggestion" && (
        <button
          type="button"
          aria-label="Vorschlag ausblenden"
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation()
            onDismissSuggestion(card)
          }}
          className="absolute right-1.5 top-1.5 z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-[rgba(31,26,20,0.08)] bg-white/60 text-[rgba(31,26,20,0.45)]"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}

      <CardTile card={card} />

      <div className="flex min-w-0 flex-col gap-[5px]">
        <div className="flex min-w-0 items-center gap-1.5">
          {visual.dotClassName && (
            <span
              aria-hidden="true"
              className={cn("h-2 w-2 shrink-0 rounded-full", visual.dotClassName)}
            />
          )}
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B50A0]">
            {card.kind === "suggestion"
              ? `${card.categoryLabel} · Vorgeschlagen`
              : card.categoryLabel}
          </span>
          {card.kind === "pending" && (
            <span className="inline-flex shrink-0 items-center gap-[5px] rounded-full bg-[rgba(232,188,100,0.30)] px-2 py-[2px] text-[9px] font-semibold uppercase tracking-[0.10em] text-[#6e5318]">
              <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-[#C89538]" />
              In Prüfung
            </span>
          )}
        </div>

        <p
          className={cn(
            "text-[15px] font-semibold leading-[1.22] text-[var(--text-heading)]",
            card.kind === "pending" && "text-[rgba(31,26,20,0.7)]",
            card.kind === "suggestion" && "text-sm font-normal text-[rgba(31,26,20,0.82)]",
          )}
        >
          {routineCardTitle(card)}
        </p>

        {frequencyLine && <p className="text-[11px] text-muted-foreground">{frequencyLine}</p>}
      </div>

      <CardAction visual={visual} />
    </article>
  )
}
