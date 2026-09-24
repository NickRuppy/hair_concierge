"use client"

import { ScanProductThumb } from "@/components/scan/scan-product-thumb"
import { BottomSheet, BottomSheetContent, BottomSheetTitle } from "@/components/ui/bottom-sheet"
import {
  DISCOVERY_UNKNOWN_TYPE_LABEL,
  DISCOVERY_WHAT_IS_IT_PROMPT,
  type DiscoveryUsageOption,
} from "@/lib/discovery/classify"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { cn } from "@/lib/utils"

import {
  categoryLabel,
  DISCOVERY_CATEGORY_ORDER,
  type DiscoveryFlowSheet,
  type DiscoveryFlowSubject,
} from "./usage-flow"

/**
 * The one sheet both questions live in, at add time and on a pill tap alike (R5, R9):
 * „Was ist das?" (ten categories + „Weiß ich nicht") and the usage question of the
 * product's type. Every option is the final tap — no confirm button; the plum option is
 * the detected (or current) answer, so confirming it is one tap.
 */

const OPTION_BASE =
  "flex min-h-[48px] w-full items-center rounded-[14px] border px-3.5 py-2.5 text-left text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2 disabled:opacity-60"
const OPTION_OFF = "border-border bg-white text-[var(--brand-plum-darkest)]"
const OPTION_ON =
  "border-[1.5px] border-[var(--brand-plum)] bg-[var(--brand-plum-ice)] text-[var(--brand-plum-dark)]"

function optionClass(on: boolean) {
  return cn(OPTION_BASE, on ? OPTION_ON : OPTION_OFF)
}

export function DiscoverySheetSubject({ subject }: { subject: DiscoveryFlowSubject }) {
  return (
    <div className="mb-4 flex items-center gap-3 pr-10">
      <ScanProductThumb imageUrl={subject.imageUrl} label={subject.title} size={44} />
      <span className="line-clamp-2 min-w-0 flex-1 text-[15px] font-semibold leading-snug text-[var(--brand-plum-darkest)]">
        {subject.title}
      </span>
    </div>
  )
}

export function DiscoveryWhatIsItChoices({
  current,
  busy,
  onChoose,
}: {
  current: PersonalPlanCategory | "unknown" | null
  busy: boolean
  onChoose: (productType: PersonalPlanCategory | null) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {DISCOVERY_CATEGORY_ORDER.map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={current === key}
          disabled={busy}
          onClick={() => onChoose(key)}
          className={optionClass(current === key)}
        >
          {categoryLabel(key)}
        </button>
      ))}
      <button
        type="button"
        aria-pressed={current === "unknown"}
        disabled={busy}
        onClick={() => onChoose(null)}
        className={cn(optionClass(current === "unknown"), "col-span-2 justify-center")}
      >
        {DISCOVERY_UNKNOWN_TYPE_LABEL}
      </button>
    </div>
  )
}

export function DiscoveryUsageChoices({
  options,
  highlighted,
  busy,
  onChoose,
}: {
  options: readonly DiscoveryUsageOption[]
  highlighted: string | null
  busy: boolean
  onChoose: (option: DiscoveryUsageOption) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={highlighted === option.key}
          disabled={busy}
          onClick={() => onChoose(option)}
          className={optionClass(highlighted === option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** The prompt a sheet asks. */
export function sheetPrompt(sheet: DiscoveryFlowSheet): string {
  return sheet.kind === "what_is_it" ? DISCOVERY_WHAT_IS_IT_PROMPT : sheet.question.prompt
}

/** The sheet body without the modal shell — what the markup tests render. */
export function DiscoveryChoiceSheetBody({
  sheet,
  busy,
  error,
  onChooseType,
  onChooseUsage,
}: {
  sheet: DiscoveryFlowSheet
  busy: boolean
  error: string | null
  onChooseType: (productType: PersonalPlanCategory | null) => void
  onChooseUsage: (option: DiscoveryUsageOption) => void
}) {
  return (
    <div>
      <DiscoverySheetSubject subject={sheet.target.subject} />
      <BottomSheetTitle className="mb-4 font-header text-[22px] font-medium leading-tight text-[var(--brand-plum-darkest)]">
        {sheetPrompt(sheet)}
      </BottomSheetTitle>
      {sheet.kind === "what_is_it" ? (
        <DiscoveryWhatIsItChoices current={sheet.current} busy={busy} onChoose={onChooseType} />
      ) : (
        <DiscoveryUsageChoices
          options={sheet.question.options}
          highlighted={sheet.highlighted}
          busy={busy}
          onChoose={onChooseUsage}
        />
      )}
      {error ? (
        <p role="alert" className="mt-3 text-center text-sm text-[var(--brand-coral-dark)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function DiscoveryChoiceSheet({
  sheet,
  busy,
  error,
  onChooseType,
  onChooseUsage,
  onClose,
}: {
  sheet: DiscoveryFlowSheet | null
  busy: boolean
  error: string | null
  onChooseType: (productType: PersonalPlanCategory | null) => void
  onChooseUsage: (option: DiscoveryUsageOption) => void
  onClose: () => void
}) {
  return (
    <BottomSheet
      open={sheet !== null}
      onOpenChange={(open) => {
        // Never mid-write: the answer is on its way, the sheet closes when it lands.
        if (!open && !busy) onClose()
      }}
    >
      <BottomSheetContent className="max-h-[85vh]" contentClassName="px-5 pb-7 pt-1">
        {sheet ? (
          <DiscoveryChoiceSheetBody
            sheet={sheet}
            busy={busy}
            error={error}
            onChooseType={onChooseType}
            onChooseUsage={onChooseUsage}
          />
        ) : null}
      </BottomSheetContent>
    </BottomSheet>
  )
}
