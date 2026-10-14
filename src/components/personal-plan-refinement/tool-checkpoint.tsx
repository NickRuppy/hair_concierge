"use client"

import { ToolThumb } from "@/components/personal-plan-tools/tool-thumb"
import { Button } from "@/components/ui/button"
import type { ToolFamily } from "@/lib/personal-plan/tools/contracts"
import type { ToolCheckpointGroup } from "@/lib/personal-plan/tools/checkpoint"
import { cn } from "@/lib/utils"

/**
 * The Tool-Checkpoint „Das hast du schon" (plan `plans/2026-10-09-hair-tools-port.md` Task 10,
 * mockup `plans/mockups/2026-10-09-hair-tools-port/index.html` screen 4).
 *
 * Shown ONCE, when the tools module hands back to the host, before the Routine: the member sees
 * what she just reported owning, family by family in wash-day order, and moves on. It is not a
 * Stage-3 step any more (the old recommendation-style checkpoint there is retired). Nothing to
 * select here: one full-width coral action, one quiet way back into the tools.
 */

export const TOOL_CHECKPOINT_KICKER = "Deine Tools"
export const TOOL_CHECKPOINT_TITLE = "Das hast du schon"
export const TOOL_CHECKPOINT_LEAD = "Damit planen wir ab jetzt deine Routine."
export const TOOL_CHECKPOINT_CTA = "Weiter zu deiner Routine"
export const TOOL_CHECKPOINT_ADD_TOOLS_PREFIX = "Etwas fehlt?"
export const TOOL_CHECKPOINT_ADD_TOOLS_LINK = "Tools ergänzen"
/** Explicit module entry: an edit visit with the answers pre-filled. */
export const TOOL_CHECKPOINT_ADD_TOOLS_HREF = "/plan-start?refine=tools"
/** Every family answered „Nichts davon" — the screen still says something true. */
export const TOOL_CHECKPOINT_EMPTY = "Keine Tools angegeben. Du kannst sie jederzeit ergänzen."

/**
 * One pastel shell plus its accent dot per Tool family, in the Plan category-card idiom —
 * the same values the mockup's family groups use.
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

export function ToolCheckpoint({
  groups,
  onContinue,
  onAddTools,
}: {
  groups: readonly ToolCheckpointGroup[]
  onContinue: () => void
  onAddTools: () => void
}) {
  return (
    <section
      className="personal-plan-cookie-clearance flex min-h-dvh flex-col bg-[var(--background)]"
      data-tool-checkpoint
    >
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-3 pb-[7.5rem] pt-6 sm:max-w-[560px] sm:px-5">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--brand-plum)]">
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

        {groups.length > 0 ? (
          <ul className="mt-3 space-y-3" aria-label={TOOL_CHECKPOINT_KICKER}>
            {groups.map((group) => (
              <ToolCheckpointGroupCard key={group.family} group={group} />
            ))}
          </ul>
        ) : (
          <p
            className="mt-4 rounded-[18px] border border-[#ece6df] bg-white px-4 py-3 text-[14px] leading-snug text-[#706a65]"
            data-tool-checkpoint-empty
          >
            {TOOL_CHECKPOINT_EMPTY}
          </p>
        )}

        <button
          type="button"
          onClick={onAddTools}
          className="mx-auto mt-6 min-h-11 px-3 text-center text-[13px] font-semibold text-[var(--brand-plum)]"
          data-tool-checkpoint-add-tools
        >
          {TOOL_CHECKPOINT_ADD_TOOLS_PREFIX}{" "}
          <span className="underline underline-offset-2">{TOOL_CHECKPOINT_ADD_TOOLS_LINK}</span>
        </button>
      </main>

      <nav
        aria-label="Weiter"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[#ece6df] bg-[#fdfbf9]/95 px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] backdrop-blur"
      >
        <div className="mx-auto flex max-w-[430px] items-center sm:max-w-[560px]">
          <Button
            type="button"
            variant="funnelCta"
            onClick={onContinue}
            className="h-auto min-h-14 w-full min-w-0 whitespace-normal px-5 py-3 text-center leading-tight"
            data-tool-checkpoint-continue
          >
            {TOOL_CHECKPOINT_CTA}
          </Button>
        </div>
      </nav>
    </section>
  )
}

function ToolCheckpointGroupCard({ group }: { group: ToolCheckpointGroup }) {
  const style = TOOL_FAMILY_CARD_STYLES[group.family]
  return (
    <li
      className={cn("rounded-[18px] border p-3", style.shell)}
      data-tool-checkpoint-group={group.family}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.10em]",
          style.label,
        )}
      >
        <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", style.dot)} />
        <span className="min-w-0">{group.label}</span>
      </div>
      <ul className="mt-1 space-y-2.5 pt-1.5" aria-label={group.label}>
        {group.items.map((item) => (
          <li
            key={item.form}
            className="flex items-center gap-3"
            data-tool-checkpoint-item={item.form}
          >
            <ToolThumb
              src={item.imageSrc}
              alt={item.imageAlt}
              size={44}
              className="h-11 w-11 rounded-[12px] border border-[rgba(31,26,20,0.05)]"
            />
            <span className="min-w-0 text-[15px] font-bold leading-snug text-[#291a43]">
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </li>
  )
}
