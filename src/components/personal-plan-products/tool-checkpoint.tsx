"use client"

import { ToolThumb } from "@/components/personal-plan-tools/tool-thumb"
import { Button } from "@/components/ui/button"
import type { ToolFamily } from "@/lib/personal-plan/tools/contracts"
import type { ToolCardTier, ToolCardViewModel } from "@/lib/personal-plan/tools/presentation"
import { cn } from "@/lib/utils"

/**
 * The Stage-3 Tool checkpoint („Dein Produkt-Check"), shown after the
 * care-product decisions.
 *
 * Variante D2 — pure Idealplan analog (Nick sign-off 2026-08-25). The section
 * mirrors the Idealplan's structure: two tier blocks with a counter each, and a
 * pastel family-tinted card per need. It deliberately shows NO ownership status:
 * this page answers „was gehört zu deiner Routine", and „was hast du davon
 * schon" is answered where it is actually collected and used — the Feinschliff
 * and the Routine steps. There is nothing to select here, so the screen keeps
 * one full-width sticky action, no inline micro-CTA, no price, no cadence and no
 * comparison dimensions.
 */

export const TOOL_CHECKPOINT_KICKER = "Dein Produkt-Check"
export const TOOL_CHECKPOINT_TITLE = "Deine Tools"
export const TOOL_CHECKPOINT_LEAD =
  "Diese Tools gehören zu deiner Routine. Was du davon schon hast, siehst du gleich in deiner Routine."
export const TOOL_CHECKPOINT_CTA = "Weiter zu deiner Routine"
export const TOOL_CHECKPOINT_BASIS_SECTION = "Von uns klar empfohlen"
export const TOOL_CHECKPOINT_OPTIONAL_SECTION = "Zusätzlich sinnvoll"
export const TOOL_CHECKPOINT_OPTIONAL_CHIP = "Optional"

export function toolCheckpointCountLabel(count: number): string {
  return `${count} ${count === 1 ? "Tool" : "Tools"}`
}

/**
 * One pastel shell plus its accent dot per Tool family, in the Idealplan
 * category-card idiom (`CATEGORY_CARD_STYLES` in `need-card.tsx`): a soft tinted
 * background, a slightly deeper border and a saturated dot next to the uppercase
 * family label. The four families the signed-off mockup shows use its exact
 * values; the remaining four reuse the Idealplan's existing category hues so the
 * eight read as one palette.
 */
export const TOOL_FAMILY_CARD_STYLES = {
  airflow: { shell: "border-[#DFE9F2] bg-[#EEF3F8]", dot: "bg-[#6D9CC4]", label: "text-[#3D6A92]" },
  heated_styling: {
    shell: "border-[#E5D6C8] bg-[#F5F0EA]",
    dot: "bg-[#C8845A]",
    label: "text-[#9A5330]",
  },
  heatless_styling: {
    shell: "border-[#E2D0D4] bg-[#F5EDEF]",
    dot: "bg-[#C08494]",
    label: "text-[#8C4A5C]",
  },
  brushes_combs: {
    shell: "border-[#EEE7D8] bg-[#F7F3EA]",
    dot: "bg-[#C9A24A]",
    label: "text-[#8A6D2F]",
  },
  securing_sectioning: {
    shell: "border-[#DCE2C6] bg-[#F1F3E9]",
    dot: "bg-[#9FB268]",
    label: "text-[#67793A]",
  },
  wash_application: {
    shell: "border-[#CADEDB] bg-[#EBF3F2]",
    dot: "bg-[#5FA39C]",
    label: "text-[#2B6F69]",
  },
  night_protection: {
    shell: "border-[#E6DCF2] bg-[#F3EEF8]",
    dot: "bg-[#9B7FD1]",
    label: "text-[#6A4FA3]",
  },
  drying_textiles: {
    shell: "border-[#DCEBE0] bg-[#EEF5EF]",
    dot: "bg-[#6FAE8C]",
    label: "text-[#3E7D5B]",
  },
} as const satisfies Record<ToolFamily, { shell: string; dot: string; label: string }>

export function Stage3ToolCheckpoint({
  cards,
  onContinue,
  continueDisabled = false,
}: {
  cards: readonly ToolCardViewModel[]
  onContinue: () => void
  continueDisabled?: boolean
}) {
  const basisCards = cards.filter((card) => card.tier === "basis")
  const optionalCards = cards.filter((card) => card.tier === "optional")

  return (
    <section
      className="personal-plan-cookie-clearance flex min-h-dvh flex-col bg-[var(--background)]"
      data-stage3-tool-checkpoint
    >
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-3 pb-[7rem] pt-6 sm:max-w-[560px] sm:px-5">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#6B50A0]">
          {TOOL_CHECKPOINT_KICKER}
        </div>
        <h1
          className="font-header mt-1 text-[23px] leading-[1.14] text-[#291a43] outline-none sm:text-[28px]"
          data-personal-plan-transition-focus
          tabIndex={-1}
        >
          {TOOL_CHECKPOINT_TITLE}
        </h1>
        <p className="mt-2 max-w-[34rem] text-[13px] leading-relaxed text-[#706a65]">
          {TOOL_CHECKPOINT_LEAD}
        </p>

        <ToolCheckpointTierBlock
          tier="basis"
          title={TOOL_CHECKPOINT_BASIS_SECTION}
          cards={basisCards}
        />
        <ToolCheckpointTierBlock
          tier="optional"
          title={TOOL_CHECKPOINT_OPTIONAL_SECTION}
          cards={optionalCards}
        />
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

/** One Idealplan-style tier block: heading, right-aligned counter, its cards. */
function ToolCheckpointTierBlock({
  tier,
  title,
  cards,
}: {
  tier: ToolCardTier
  title: string
  cards: readonly ToolCardViewModel[]
}) {
  if (cards.length === 0) return null

  return (
    <section className="mt-5" aria-label={title} data-stage3-tool-tier={tier}>
      <div className="mb-2.5 flex items-baseline justify-between px-0.5">
        <strong className="text-[14px] text-[#291a43]">{title}</strong>
        <span className="text-[9.5px] font-extrabold uppercase tracking-[0.10em] text-[#6B50A0]">
          {toolCheckpointCountLabel(cards.length)}
        </span>
      </div>
      <ul className="space-y-3" data-stage3-tool-list={tier}>
        {cards.map((card) => (
          <ToolCheckpointCard key={card.id} card={card} />
        ))}
      </ul>
    </section>
  )
}

function ToolCheckpointCard({ card }: { card: ToolCardViewModel }) {
  const style = TOOL_FAMILY_CARD_STYLES[card.family]

  return (
    <li
      data-stage3-tool-card={card.id}
      className={cn("flex items-start gap-3 rounded-[18px] border px-3 py-3", style.shell)}
    >
      <ToolThumb
        src={card.imageUrl}
        alt={card.imageAlt}
        size={56}
        className="h-14 w-14 rounded-[14px] border border-[rgba(31,26,20,0.05)]"
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "flex items-start gap-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.10em]",
            style.label,
          )}
        >
          <span
            aria-hidden="true"
            className={cn("mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full", style.dot)}
          />
          <span className="min-w-0">{card.familyLabel}</span>
          {card.tier === "optional" ? (
            <span className="ml-auto shrink-0 rounded-full border border-[#ece6df] bg-white px-2 py-0.5 text-[8.5px] font-extrabold uppercase tracking-[0.08em] text-[#7c7488]">
              {TOOL_CHECKPOINT_OPTIONAL_CHIP}
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-[15px] font-bold leading-snug text-[#291a43]">
          {card.stage3.title}
        </span>
        {/*
          The technique line replaces the purpose where the technique IS the
          recommendation, so the card never says the same thing twice.
        */}
        <span className="mt-0.5 block text-[12px] leading-snug text-[#706a65]">
          {card.stage3.note ?? card.purpose}
        </span>
        {card.stage3.alternatives ? (
          <span className="mt-1 block text-[11.5px] leading-snug text-[#706a65]">
            {card.stage3.alternatives}
          </span>
        ) : null}
      </span>
    </li>
  )
}
