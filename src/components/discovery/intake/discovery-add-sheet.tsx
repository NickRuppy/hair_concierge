"use client"

import { Check, ChevronLeft } from "lucide-react"
import { useState, type ReactNode } from "react"

import type { ScanRetailerResult } from "@/app/api/scan/search-retailer/route"
import type { ScanSearchResult } from "@/app/api/scan/search/route"
import { REFINEMENT_CATEGORY_OPTIONS } from "@/components/personal-plan-refinement/refinement-options"
import { Scanner, type ScanDecodedIdentifier, type ScannerRuntime } from "@/components/scan/scanner"
import { ScanSearchSheet } from "@/components/scan/scan-search-sheet"
import { BottomSheetTitle } from "@/components/ui/bottom-sheet"
import { Icon } from "@/components/ui/icon"
import {
  DISCOVERY_UNKNOWN_TYPE_LABEL,
  DISCOVERY_WHAT_IS_IT_PROMPT,
  type DiscoverySprayOption,
  type DiscoveryUsageOption,
} from "@/lib/discovery/classify"
import {
  DISCOVERY_FREQUENCY_LABELS,
  DISCOVERY_FREQUENCY_OPTIONS,
  DISCOVERY_FREQUENCY_SUGGESTION_HINT,
  DISCOVERY_UNKNOWN_FREQUENCY,
  type DiscoveryItemFrequency,
} from "@/lib/discovery/frequency"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { cn } from "@/lib/utils"

import {
  canGoBack,
  categoryLabel,
  currentStep,
  draftCapsule,
  type AddFlow,
  type AddStep,
  type DiscoveryProductSubject,
} from "./add-flow"
import { DiscoveryPackshot, SlideStage, useSettledTap } from "./discovery-motion"
import type { DiscoveryIntakeItemView } from "./types"
import { BACK_BUTTON, CORAL_BUTTON, OUTLINE_BUTTON } from "./ui-classes"

/**
 * The ONE persistent add sheet (batch 7, C2/C5): the shared scan search is its first step;
 * after a pick the same open sheet pins the product as a header and asks — in place of the
 * results — the usage question (only when the classifier asks), then „Wie oft nutzt du es?".
 * The typed path („Selbst eintragen") and the barcode scanner live in the same sheet.
 *
 * Presentational: every answer goes up to the checklist, which owns the `AddFlow`.
 */

export const TYPED_ENTRY_LABEL = "Selbst eintragen"
export const NAME_PROMPT = "Wie heißt es?"
export const FREQUENCY_PROMPT = "Wie oft nutzt du es?"
const BRAND_PLACEHOLDER = "Marke"
const NAME_PLACEHOLDER = "Produktname"
const CONTINUE_LABEL = "Weiter"
const REMOVE_LABEL = "Entfernen"
const BACK_LABEL = "Zurück"
const SCAN_TITLE = "Barcode scannen"
const BRAND_MAX = 200
const NAME_MAX = 240

/** The ten categories of „Was ist das?", in the checklist's shelf order. */
const TYPE_CHOICES: readonly PersonalPlanCategory[] = [
  "shampoo",
  "conditioner",
  "leave_in",
  "mask",
  "oil",
  "heat_protectant",
  "dry_shampoo",
  "deep_cleansing_shampoo",
  "bondbuilder",
  "scalp_care",
]

const TYPE_ICONS = Object.fromEntries(
  REFINEMENT_CATEGORY_OPTIONS.map((option) => [option.value, option.icon]),
) as Record<PersonalPlanCategory, (typeof REFINEMENT_CATEGORY_OPTIONS)[number]["icon"]>

const QUESTION =
  "mb-4 mt-1.5 font-header text-2xl font-medium leading-tight text-[var(--brand-plum-darkest)]"

const OPTION =
  "flex min-h-[58px] w-full items-center gap-3 rounded-2xl border px-4 text-left text-base font-semibold transition active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2 disabled:opacity-60"
const OPTION_OFF = "border-border bg-white text-[var(--brand-plum-darkest)]"
const OPTION_ON = "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]"
const QUIET_OPTION =
  "flex min-h-[50px] w-full items-center justify-center rounded-2xl text-base font-semibold text-[var(--text-sub)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] disabled:opacity-60"

export type DiscoveryAddSheetHandlers = {
  onOpenChange: (open: boolean) => void
  onPickCatalog: (result: ScanSearchResult) => void
  onPickRetailer: (result: ScanRetailerResult) => void
  onStartTyped: () => void
  onSubmitName: (typed: { brandText: string; productNameText: string }) => void
  onType: (productType: PersonalPlanCategory | null) => void
  onUsage: (option: DiscoveryUsageOption) => void
  onSpray: (option: DiscoverySprayOption) => void
  onFrequency: (frequency: DiscoveryItemFrequency) => void
  onBack: () => void
  onRemove: (item: DiscoveryIntakeItemView) => void
  onDecoded: (identifier: ScanDecodedIdentifier) => boolean
  onCameraUnavailable: () => void
}

export function DiscoveryPinnedHeader({
  subject,
  capsule,
  category,
  onBack,
}: {
  subject: DiscoveryProductSubject
  capsule: string | null
  category: PersonalPlanCategory | null
  onBack: (() => void) | null
}) {
  return (
    <div className="sticky top-0 z-[5] -mx-4 mb-2 flex min-h-[76px] items-center gap-3 border-b border-border bg-background px-4 pr-12 sm:-mx-5 sm:px-5">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={BACK_LABEL}
          className="-ml-3 -mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--brand-plum)] active:bg-[var(--brand-plum-ice)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)]"
        >
          <ChevronLeft className="h-[22px] w-[22px]" aria-hidden="true" />
        </button>
      ) : null}
      <DiscoveryPackshot
        imageUrl={subject.imageUrl}
        category={category}
        iconSize={20}
        className="h-[54px] w-11 rounded-[10px]"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        {subject.brandLine ? (
          <span className="truncate text-xs font-medium text-[var(--text-sub)]">
            {subject.brandLine}
          </span>
        ) : null}
        <span className="line-clamp-2 text-[14.5px] font-bold leading-tight text-[var(--brand-plum-darkest)]">
          {subject.name}
        </span>
      </span>
      {capsule ? (
        <span
          key={capsule}
          className="discovery-pop shrink-0 whitespace-nowrap rounded-full bg-[var(--brand-plum-ice)] px-2.5 py-1 text-xs font-semibold text-[var(--brand-plum)]"
        >
          {capsule}
        </span>
      ) : null}
    </div>
  )
}

function OptionRow({
  label,
  on,
  hint,
  disabled,
  onClick,
}: {
  label: string
  on: boolean
  hint?: string | null
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(OPTION, on ? OPTION_ON : OPTION_OFF)}
    >
      <span className="flex-1">{label}</span>
      {on && hint ? (
        <span className="whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[var(--brand-plum)]">
          {hint}
        </span>
      ) : null}
      {on ? <Check className="h-5 w-5 shrink-0" strokeWidth={2.2} aria-hidden="true" /> : null}
    </button>
  )
}

/** „Wie oft nutzt du es?" — one tap saves; the suggestion is plum with its hint. */
export function DiscoveryFrequencyStep({
  step,
  busy,
  onFrequency,
}: {
  step: Extract<AddStep, { kind: "frequency" }>
  busy: boolean
  onFrequency: (frequency: DiscoveryItemFrequency) => void
}) {
  const [tapped, tap] = useSettledTap<DiscoveryItemFrequency>()
  const marked = tapped ?? step.current ?? step.suggestion
  return (
    <>
      <BottomSheetTitle className={QUESTION}>{FREQUENCY_PROMPT}</BottomSheetTitle>
      <div className="flex flex-col gap-2">
        {DISCOVERY_FREQUENCY_OPTIONS.filter((value) => value !== DISCOVERY_UNKNOWN_FREQUENCY).map(
          (value) => (
            <OptionRow
              key={value}
              label={DISCOVERY_FREQUENCY_LABELS[value]}
              on={marked === value}
              hint={
                !tapped && !step.current && step.suggestion === value
                  ? DISCOVERY_FREQUENCY_SUGGESTION_HINT
                  : null
              }
              disabled={busy}
              onClick={() => tap(value, () => onFrequency(value))}
            />
          ),
        )}
        <button
          type="button"
          aria-pressed={marked === DISCOVERY_UNKNOWN_FREQUENCY}
          disabled={busy}
          onClick={() =>
            tap(DISCOVERY_UNKNOWN_FREQUENCY, () => onFrequency(DISCOVERY_UNKNOWN_FREQUENCY))
          }
          className={cn(
            QUIET_OPTION,
            marked === DISCOVERY_UNKNOWN_FREQUENCY &&
              "bg-[#f1ece7] text-[var(--brand-plum-darkest)]",
          )}
        >
          {DISCOVERY_FREQUENCY_LABELS.unknown}
        </button>
      </div>
    </>
  )
}

function UsageStep({
  prompt,
  options,
  highlighted,
  busy,
  onChoose,
}: {
  prompt: string
  options: ReadonlyArray<{ key: string; label: string }>
  highlighted: string | null
  busy: boolean
  onChoose: (key: string) => void
}) {
  const [tapped, tap] = useSettledTap<string>()
  const marked = tapped ?? highlighted
  return (
    <>
      <BottomSheetTitle className={QUESTION}>{prompt}</BottomSheetTitle>
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <OptionRow
            key={option.key}
            label={option.label}
            on={marked === option.key}
            disabled={busy}
            onClick={() => tap(option.key, () => onChoose(option.key))}
          />
        ))}
      </div>
    </>
  )
}

function TypeStep({
  current,
  busy,
  onType,
}: {
  current: PersonalPlanCategory | "unknown" | null
  busy: boolean
  onType: (productType: PersonalPlanCategory | null) => void
}) {
  const [tapped, tap] = useSettledTap<PersonalPlanCategory | "unknown">()
  const marked = tapped ?? current
  return (
    <>
      <BottomSheetTitle className={QUESTION}>{DISCOVERY_WHAT_IS_IT_PROMPT}</BottomSheetTitle>
      <div className="grid grid-cols-2 gap-2">
        {TYPE_CHOICES.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={marked === key}
            disabled={busy}
            onClick={() => tap(key, () => onType(key))}
            className={cn(
              "flex min-h-[54px] items-center gap-2.5 rounded-[15px] border px-3 text-left text-[15px] font-semibold transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] disabled:opacity-60",
              marked === key ? OPTION_ON : OPTION_OFF,
            )}
          >
            <Icon
              name={TYPE_ICONS[key]}
              size={20}
              className="shrink-0 text-[var(--brand-plum)] opacity-70"
            />
            <span className="min-w-0 break-words hyphens-auto">{categoryLabel(key)}</span>
          </button>
        ))}
        <button
          type="button"
          aria-pressed={marked === "unknown"}
          disabled={busy}
          onClick={() => tap("unknown", () => onType(null))}
          className={cn(
            QUIET_OPTION,
            "col-span-2",
            marked === "unknown" && "bg-[#f1ece7] text-[var(--brand-plum-darkest)]",
          )}
        >
          {DISCOVERY_UNKNOWN_TYPE_LABEL}
        </button>
      </div>
    </>
  )
}

/** „Wie heißt es?" — brand and name, both needed for her research. */
export function DiscoveryNameStep({
  busy,
  onBack,
  onSubmit,
}: {
  busy: boolean
  onBack: () => void
  onSubmit: (typed: { brandText: string; productNameText: string }) => void
}) {
  const [brandText, setBrandText] = useState("")
  const [productNameText, setProductNameText] = useState("")
  const brand = brandText.trim()
  const name = productNameText.trim()
  const ready = brand.length > 0 && name.length > 0
  const field =
    "h-[54px] w-full rounded-[15px] border border-border bg-white px-4 text-base text-[var(--brand-plum-darkest)] outline-none transition placeholder:text-[#9a918a] focus:border-[var(--brand-plum)] focus:shadow-[0_0_0_4px_rgba(107,80,160,0.10)]"
  return (
    <>
      <div className="-ml-3 flex h-12 items-center">
        <button type="button" onClick={onBack} aria-label={BACK_LABEL} className={BACK_BUTTON}>
          <ChevronLeft className="h-[22px] w-[22px]" aria-hidden="true" />
        </button>
      </div>
      <BottomSheetTitle className={QUESTION}>{NAME_PROMPT}</BottomSheetTitle>
      <form
        className="flex flex-col gap-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          if (ready && !busy) onSubmit({ brandText: brand, productNameText: name })
        }}
      >
        <input
          type="text"
          value={brandText}
          onChange={(event) => setBrandText(event.target.value)}
          maxLength={BRAND_MAX}
          placeholder={BRAND_PLACEHOLDER}
          aria-label={BRAND_PLACEHOLDER}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="next"
          className={field}
        />
        <input
          type="text"
          value={productNameText}
          onChange={(event) => setProductNameText(event.target.value)}
          maxLength={NAME_MAX}
          placeholder={NAME_PLACEHOLDER}
          aria-label={NAME_PLACEHOLDER}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          className={field}
        />
        <button type="submit" disabled={!ready || busy} className={cn(CORAL_BUTTON, "mt-4")}>
          {CONTINUE_LABEL}
        </button>
      </form>
    </>
  )
}

/** One step of the sheet, below the pinned header — what the tests render. */
export function DiscoveryAddStepBody({
  flow,
  busy,
  handlers,
  scannerRuntime,
}: {
  flow: AddFlow
  busy: boolean
  handlers: Pick<
    DiscoveryAddSheetHandlers,
    | "onType"
    | "onUsage"
    | "onSpray"
    | "onFrequency"
    | "onBack"
    | "onSubmitName"
    | "onDecoded"
    | "onCameraUnavailable"
  >
  scannerRuntime?: ScannerRuntime
}): ReactNode {
  const step = currentStep(flow)
  switch (step.kind) {
    case "search":
      return null
    case "scan":
      return (
        <div className="pt-1">
          <BottomSheetTitle className="sr-only">{SCAN_TITLE}</BottomSheetTitle>
          <Scanner
            active
            runtime={scannerRuntime}
            detectionPaused={busy}
            onDecoded={handlers.onDecoded}
            onUnavailable={handlers.onCameraUnavailable}
            onTimeout={() => undefined}
            onStalled={handlers.onCameraUnavailable}
          />
        </div>
      )
    case "name":
      return (
        <DiscoveryNameStep busy={busy} onBack={handlers.onBack} onSubmit={handlers.onSubmitName} />
      )
    case "type":
      return <TypeStep current={step.current} busy={busy} onType={handlers.onType} />
    case "usage":
      return (
        <UsageStep
          prompt={step.question.prompt}
          options={step.question.options}
          highlighted={step.highlighted}
          busy={busy}
          onChoose={(key) => {
            const option = step.question.options.find((candidate) => candidate.key === key)
            if (option) handlers.onUsage(option)
          }}
        />
      )
    case "spray":
      return (
        <UsageStep
          prompt={step.question.prompt}
          options={step.question.options}
          highlighted={step.highlighted}
          busy={busy}
          onChoose={(key) => {
            const option = step.question.options.find((candidate) => candidate.key === key)
            if (option) handlers.onSpray(option)
          }}
        />
      )
    case "frequency":
      return <DiscoveryFrequencyStep step={step} busy={busy} onFrequency={handlers.onFrequency} />
  }
}

function stepCategory(flow: AddFlow): PersonalPlanCategory | null {
  const draft = flow.draft
  if (!draft) return null
  if (draft.usage) return draft.usage.category
  return draft.productType && draft.productType !== "styling" ? draft.productType : null
}

export function DiscoveryAddSheet({
  open,
  flow,
  busy,
  error,
  retailerSearchEnabled,
  scannerRuntime,
  handlers,
}: {
  open: boolean
  flow: AddFlow | null
  busy: boolean
  error: string | null
  retailerSearchEnabled: boolean
  scannerRuntime?: ScannerRuntime
  handlers: DiscoveryAddSheetHandlers
}) {
  const step = flow ? currentStep(flow) : null
  const inSearch = step?.kind === "search"
  const pinned = flow?.draft && step && step.kind !== "name" && step.kind !== "scan"

  let stepContent: ReactNode = null
  if (flow && step && !inSearch) {
    stepContent = (
      <SlideStage
        stepKey={`${flow.steps.length}:${step.kind}`}
        direction={flow.direction}
        animate={step.kind !== "scan"}
      >
        {pinned && flow.draft ? (
          <DiscoveryPinnedHeader
            subject={flow.draft.subject}
            capsule={draftCapsule(flow.draft)}
            category={stepCategory(flow)}
            onBack={canGoBack(flow) ? handlers.onBack : null}
          />
        ) : null}
        <DiscoveryAddStepBody
          flow={flow}
          busy={busy}
          handlers={handlers}
          scannerRuntime={scannerRuntime}
        />
        {flow.mode === "edit" && flow.draft?.target.kind === "change" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const target = flow.draft?.target
              if (target?.kind === "change") handlers.onRemove(target.item)
            }}
            className={cn(QUIET_OPTION, "mt-2.5 active:bg-[#f1ece7]")}
          >
            {REMOVE_LABEL}
          </button>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 text-center text-sm text-[var(--brand-coral-dark)]">
            {error}
          </p>
        ) : null}
      </SlideStage>
    )
  }

  return (
    <ScanSearchSheet
      open={open}
      reason="manual"
      onOpenChange={handlers.onOpenChange}
      onSelectProduct={() => undefined}
      onSelectProductResult={handlers.onPickCatalog}
      onSelectRetailerResultRow={handlers.onPickRetailer}
      submitting={busy}
      retailerSearchEnabled={retailerSearchEnabled}
      autoFocusSearch={inSearch}
      sheetClassName={inSearch || step?.kind === "scan" ? "h-[88dvh]" : undefined}
      stepContent={stepContent}
      resultsFooter={
        <button
          type="button"
          onClick={handlers.onStartTyped}
          disabled={busy}
          className={cn(OUTLINE_BUTTON, "mt-4")}
        >
          {TYPED_ENTRY_LABEL}
        </button>
      }
    />
  )
}
