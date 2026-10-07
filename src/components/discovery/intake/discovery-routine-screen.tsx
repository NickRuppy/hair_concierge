"use client"

import { ChevronLeft } from "lucide-react"

import { composeDiscoveryRoutineDays, type DiscoveryRoutineDay } from "@/lib/discovery/routine-days"
import { DISCOVERY_FREQUENCY_LABELS } from "@/lib/discovery/frequency"
import { cn } from "@/lib/utils"

import { itemDisplayName, itemSubject, routineItemCaption } from "./add-flow"
import { DiscoveryPackshot } from "./discovery-motion"
import type { DiscoveryIntakeItemView } from "./types"
import { BACK_BUTTON, CORAL_BUTTON, CTA_BAR, OUTLINE_BUTTON, SCREEN_TITLE } from "./ui-classes"

/**
 * „Deine Routine" (batch 7, C6; replaces „Passt das so?"): her products composed back to her
 * as day cards (`composeDiscoveryRoutineDays`) — Waschtag with her shampoo's rhythm,
 * Tag ohne Wäsche, Intensiv-Pflegetag, Styling, Weitere. Waschtag and Tag ohne Wäsche always
 * show (batch 8); an empty one says „Nichts eingetragen". A product tap opens its edit sheet.
 * Coral „Stimmt so" → Hitze & Styling; outline „Noch was ergänzen" → back to her products.
 */

export const ROUTINE_TITLE = "Deine Routine"
export const CONFIRM_LABEL = "Stimmt so"
export const ADD_MORE_LABEL = "Noch was ergänzen"
export const EMPTY_DAY_LABEL = "Nichts eingetragen"
const BACK_LABEL = "Zurück"

function DayCard({
  day,
  onEdit,
}: {
  day: DiscoveryRoutineDay<DiscoveryIntakeItemView>
  onEdit: (item: DiscoveryIntakeItemView) => void
}) {
  return (
    <section className="mb-3 rounded-[22px] border border-border bg-white px-4 pb-3.5 pt-4 shadow-[0_1px_2px_rgba(42,24,69,0.04),0_8px_24px_rgba(42,24,69,0.04)]">
      <div className="mb-3.5 flex min-h-7 items-center justify-between gap-2.5">
        <h2 className="font-header text-[21px] font-medium leading-tight text-[var(--brand-plum-darkest)]">
          {day.title}
        </h2>
        {day.cadenceLabel ? (
          <span className="whitespace-nowrap rounded-full bg-[var(--brand-plum-ice)] px-2.5 py-[5px] text-[12.5px] font-semibold text-[var(--brand-plum)]">
            {day.cadenceLabel}
          </span>
        ) : null}
      </div>
      {day.items.length === 0 ? (
        <p className="pb-0.5 text-[14px] text-[var(--text-sub)]">{EMPTY_DAY_LABEL}</p>
      ) : (
        <ul className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {day.items.map((item) => {
            const subject = itemSubject(item)
            return (
              <li key={item.id} className="w-24 shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  aria-label={`${itemDisplayName(item)} bearbeiten`}
                  className="flex w-full flex-col gap-0.5 rounded-[14px] text-left transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)]"
                >
                  <DiscoveryPackshot
                    imageUrl={item.imageUrl}
                    category={item.category}
                    className="mb-1.5 h-[108px] w-24 rounded-[14px]"
                  />
                  <span className="line-clamp-2 break-words text-[12.5px] font-bold leading-[1.28] text-[var(--brand-plum-darkest)] hyphens-auto">
                    {subject.name}
                  </span>
                  <span className="truncate text-[11.5px] text-[var(--text-sub)]">
                    {routineItemCaption(item)}
                  </span>
                  {item.frequency ? (
                    <span className="text-[11.5px] font-semibold leading-snug text-[var(--brand-plum)]">
                      {DISCOVERY_FREQUENCY_LABELS[item.frequency]}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function DiscoveryRoutineScreen({
  items,
  onEdit,
  onBack,
  onConfirm,
}: {
  items: DiscoveryIntakeItemView[]
  onEdit: (item: DiscoveryIntakeItemView) => void
  onBack: () => void
  onConfirm: () => void
}) {
  const days = composeDiscoveryRoutineDays(items)
  return (
    <main className="flex min-h-dvh flex-col bg-[#faf8f6]">
      <div className="flex-1 px-4 pb-8 pt-1.5">
        <div className="-ml-3 mb-1.5 flex h-11 items-center">
          <button type="button" onClick={onBack} aria-label={BACK_LABEL} className={BACK_BUTTON}>
            <ChevronLeft className="h-[22px] w-[22px]" aria-hidden="true" />
          </button>
        </div>
        <h1 className={cn("mb-3.5", SCREEN_TITLE)}>{ROUTINE_TITLE}</h1>
        {days.map((day) => (
          <DayCard key={day.kind} day={day} onEdit={onEdit} />
        ))}
      </div>
      <div className={CTA_BAR}>
        <button type="button" onClick={onConfirm} className={CORAL_BUTTON}>
          {CONFIRM_LABEL}
        </button>
        <button type="button" onClick={onBack} className={OUTLINE_BUTTON}>
          {ADD_MORE_LABEL}
        </button>
      </div>
    </main>
  )
}
