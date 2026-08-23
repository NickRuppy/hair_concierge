"use client"

import Image from "next/image"
import { useState } from "react"

import type { ToolBlockViewModel, ToolCardViewModel } from "@/lib/personal-plan/tools/presentation"

/**
 * The compact tier-local `Deine Tools` block that follows this Idealplan page's
 * care-product cards.
 *
 * It deliberately does NOT reuse the exact care-product card anatomy: no price,
 * no cadence row, no availability line and no catalog disclaimer. A durable Tool
 * is not a consumable, and the block must never imply the user owns or has to
 * buy one.
 */
export function ToolBlock({ block }: { block: ToolBlockViewModel }) {
  return (
    <section className="mt-6" data-plan-start-tool-block aria-label={block.title}>
      <div className="mb-2 flex items-baseline justify-between px-0.5">
        <strong className="text-[13px] text-[#291a43]">{block.title}</strong>
      </div>
      <p className="mb-2 max-w-[34rem] px-0.5 text-[10.5px] leading-relaxed text-[#706a65] sm:text-xs">
        {block.lead}
      </p>
      <ul className="space-y-2" data-plan-start-tool-list>
        {block.cards.map((card) => (
          <ToolRow key={card.id} card={card} />
        ))}
      </ul>
    </section>
  )
}

function ToolRow({ card }: { card: ToolCardViewModel }) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <li
      className="flex items-start gap-3 rounded-2xl border border-[rgba(31,26,20,0.07)] bg-white px-3 py-2.5"
      data-plan-start-tool-card={card.id}
      data-plan-start-tool-state={card.state}
    >
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f6f2ee]">
        {imageFailed ? (
          <span aria-hidden="true" className="h-5 w-5 rounded-full bg-[#ded5cb]" />
        ) : (
          <Image
            src={card.imageUrl}
            alt={card.imageAlt}
            width={48}
            height={48}
            className="h-full w-full object-contain p-1.5"
            onError={() => setImageFailed(true)}
            unoptimized
          />
        )}
      </span>
      {/*
        The state stays on its own line under the purpose. Long German labels
        like "Bestand im Feinschliff prüfen" would otherwise squeeze the product
        type into an unreadable column at 320–390px.
      */}
      <span className="min-w-0 flex-1">
        <span className="block text-[9.5px] font-extrabold uppercase tracking-[0.10em] text-[#6e6863]">
          {card.familyLabel}
        </span>
        <span className="block text-[13px] font-semibold leading-snug text-[#291a43]">
          {card.typeLabel}
        </span>
        <span className="block text-[11px] leading-snug text-[#706a65]">{card.purpose}</span>
        {card.noteDe ? (
          <span className="mt-0.5 block text-[11px] leading-snug text-[#706a65]">
            {card.noteDe}
          </span>
        ) : null}
        <span className="mt-1.5 inline-block rounded-full bg-[#f1edf7] px-2 py-0.5 text-[10px] font-semibold text-[#6B50A0]">
          {card.stateLabel}
        </span>
      </span>
    </li>
  )
}
