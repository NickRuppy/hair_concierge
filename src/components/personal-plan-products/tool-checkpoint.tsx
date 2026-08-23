"use client"

import Image from "next/image"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { ToolCardViewModel } from "@/lib/personal-plan/tools/presentation"
import { cn } from "@/lib/utils"

/**
 * The Stage-3 Tool checkpoint, shown after the care-product decisions.
 *
 * Phase 1 has no approved exact Tool content, so there is nothing for the user
 * to select: a reported Tool leads with `Nutze deins`, and a missing route stays
 * a useful generic product type with an honest catalog gap. The screen reuses the
 * Stage-3 whole-card grammar and one full-width sticky action; it deliberately
 * has no inline micro-CTA, no price, no cadence and no comparison dimensions.
 */

export const TOOL_CHECKPOINT_TITLE = "Deine Tools"
export const TOOL_CHECKPOINT_LEAD =
  "Was du schon hast, nutzen wir. Für offene Routen sagen wir dir ehrlich, dass ein konkretes Produkt noch fehlt."
export const TOOL_CHECKPOINT_CTA = "Weiter zu deiner Routine"
export const TOOL_CHECKPOINT_GAP_NOTE =
  "Wir empfehlen hier noch kein konkretes Produkt. Sobald ein geprüftes dazukommt, siehst du es in deinem Plan."

export function Stage3ToolCheckpoint({
  cards,
  onContinue,
  continueDisabled = false,
}: {
  cards: readonly ToolCardViewModel[]
  onContinue: () => void
  continueDisabled?: boolean
}) {
  const hasGap = cards.some((card) => card.state === "catalog_gap")

  return (
    <section
      className="personal-plan-cookie-clearance flex min-h-dvh flex-col bg-[var(--background)]"
      data-stage3-tool-checkpoint
    >
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-3 pb-[7rem] pt-6 sm:max-w-[560px] sm:px-5">
        <h1
          className="font-header text-[23px] leading-[1.14] text-[#291a43] outline-none sm:text-[28px]"
          data-personal-plan-transition-focus
          tabIndex={-1}
        >
          {TOOL_CHECKPOINT_TITLE}
        </h1>
        <p className="mt-2 max-w-[34rem] text-[13px] leading-relaxed text-[#706a65]">
          {TOOL_CHECKPOINT_LEAD}
        </p>

        <ul className="mt-5 space-y-3" data-stage3-tool-list>
          {cards.map((card) => (
            <ToolCheckpointCard key={card.id} card={card} />
          ))}
        </ul>

        {hasGap ? (
          <p className="mt-4 text-[11.5px] leading-relaxed text-[#706a65]">
            {TOOL_CHECKPOINT_GAP_NOTE}
          </p>
        ) : null}
      </main>

      <nav
        aria-label="Tools bestätigen"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[#ece6df] bg-[#fdfbf9]/95 px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] backdrop-blur"
      >
        <div className="mx-auto flex max-w-[430px] items-center sm:max-w-[560px]">
          <Button
            type="button"
            variant="funnelCta"
            onClick={onContinue}
            disabled={continueDisabled}
            className="h-auto min-h-14 w-full min-w-0 whitespace-normal px-5 py-3 text-center leading-tight"
          >
            {TOOL_CHECKPOINT_CTA}
          </Button>
        </div>
      </nav>
    </section>
  )
}

function ToolCheckpointCard({ card }: { card: ToolCardViewModel }) {
  const [imageFailed, setImageFailed] = useState(false)
  const owned = card.state === "use_yours"

  return (
    <li
      data-stage3-tool-card={card.id}
      data-stage3-tool-state={card.state}
      className={cn(
        "flex items-start gap-3 rounded-2xl border bg-white px-3 py-3",
        owned
          ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)]"
          : "border-[rgba(31,26,20,0.07)]",
      )}
    >
      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f6f2ee]">
        {imageFailed ? (
          <span aria-hidden="true" className="h-6 w-6 rounded-full bg-[#ded5cb]" />
        ) : (
          <Image
            src={card.imageUrl}
            alt={card.imageAlt}
            width={56}
            height={56}
            className="h-full w-full object-contain p-1.5"
            onError={() => setImageFailed(true)}
            unoptimized
          />
        )}
      </span>
      {/* The state sits under the purpose so long German labels never squeeze
          the product type at 320–390px. */}
      <span className="min-w-0 flex-1">
        <span className="block text-[9.5px] font-extrabold uppercase tracking-[0.10em] text-[#6e6863]">
          {card.familyLabel}
        </span>
        <span className="block text-[14px] font-semibold leading-snug text-[#291a43]">
          {card.typeLabel}
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-[#706a65]">
          {card.purpose}
        </span>
        {card.noteDe ? (
          <span className="mt-0.5 block text-[11.5px] leading-snug text-[#706a65]">
            {card.noteDe}
          </span>
        ) : null}
        <span
          className={cn(
            "mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
            owned ? "bg-[var(--brand-plum)] text-white" : "bg-[#f1edf7] text-[#6B50A0]",
          )}
        >
          {/*
            Always the card's own state label. Collapsing every non-owned card to
            "Konkretes Produkt folgt" would turn "we do not know whether you own
            one" into "you are missing one" — inventing an answer the user never
            gave.
          */}
          {card.stateLabel}
        </span>
      </span>
    </li>
  )
}
