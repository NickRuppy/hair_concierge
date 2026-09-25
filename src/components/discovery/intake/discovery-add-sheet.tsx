"use client"

import { Check, ChevronLeft } from "lucide-react"
import { useRef, useState, type ReactNode } from "react"

import type { ScanRetailerResult } from "@/app/api/scan/search-retailer/route"
import type { ScanSearchResult } from "@/app/api/scan/search/route"
import { REFINEMENT_CATEGORY_OPTIONS } from "@/components/personal-plan-refinement/refinement-options"
import { Scanner, type ScanDecodedIdentifier, type ScannerRuntime } from "@/components/scan/scanner"
import { ScanSearchSheet, ScanSearchSheetHeader } from "@/components/scan/scan-search-sheet"
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
import { MOTION_MS } from "@/lib/motion"
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
import {
  BeforeCommit,
  DiscoveryPackshot,
  frozenCopyOf,
  jumpToTop,
  motionMs,
  nextFrozenLayerId,
  PendingSpinner,
  prefersReducedMotion,
  SlideStage,
  useDelayedPending,
  useSettledTap,
  type FrozenLayer,
} from "./discovery-motion"
import type { DiscoveryIntakeItemView } from "./types"
import { BACK_BUTTON, CORAL_BUTTON, OUTLINE_BUTTON } from "./ui-classes"

/**
 * The ONE persistent add sheet (batch 7, C2/C5): the shared scan search is its first step;
 * after a pick the same open sheet pins the product as a header and asks — in place of the
 * results — the usage question (only when the classifier asks), then „Wie oft nutzt du es?".
 * The typed path („Selbst eintragen") and the barcode scanner live in the same sheet.
 *
 * Presentational: every answer goes up to the checklist, which owns the `AddFlow`.
 *
 * Batch 8 (plan `plans/discovery-b8-motion-days/plan.md` Part B items 8, 10): one stable sheet
 * height for the whole flow; the pinned product header sits above the sliding step area, so it
 * stays put from usage to frequency; search ↔ steps slide like the steps do (the leaving side
 * is always a frozen copy). Nothing dims while a save runs — only the tapped option shows a
 * spinner, after 300 ms.
 */

export const TYPED_ENTRY_LABEL = "Nicht dabei? Selbst eintragen"
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
/** Marks the sheet panel, so the search ↔ steps slide can find the search content. */
const SHEET_MARKER = "discovery-add-sheet"
/** One stable height for the whole add flow (search, scanner, every step). */
const SHEET_CLASS = `${SHEET_MARKER} h-[88dvh]`

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
  pending = false,
  onClick,
}: {
  label: string
  on: boolean
  hint?: string | null
  /** Its save has been running > 300 ms: a spinner in place of the check. */
  pending?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-busy={pending || undefined}
      onClick={onClick}
      className={cn(OPTION, on ? OPTION_ON : OPTION_OFF)}
    >
      <span className="flex-1">{label}</span>
      {on && hint ? (
        <span className="whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[var(--brand-plum)]">
          {hint}
        </span>
      ) : null}
      {on && pending ? (
        <PendingSpinner className="h-5 w-5" />
      ) : on ? (
        <Check className="h-5 w-5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
      ) : null}
    </button>
  )
}

/** „Wie oft nutzt du es?" — one tap saves; the suggestion is plum with its hint. */
export function DiscoveryFrequencyStep({
  step,
  busy,
  rejections = 0,
  onFrequency,
}: {
  step: Extract<AddStep, { kind: "frequency" }>
  busy: boolean
  /** How often a save from this sheet failed — each failure shows the saved answer again. */
  rejections?: number
  onFrequency: (frequency: DiscoveryItemFrequency) => void
}) {
  const [tapped, tap] = useSettledTap<DiscoveryItemFrequency>(rejections)
  const marked = tapped ?? step.current ?? step.suggestion
  // `busy` here = her edit's PATCH is running; the tapped option stays plum meanwhile.
  const pending = useDelayedPending(busy && tapped !== null)
  const choose = (value: DiscoveryItemFrequency) => {
    if (!busy) tap(value, () => onFrequency(value))
  }
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
              pending={pending && marked === value}
              onClick={() => choose(value)}
            />
          ),
        )}
        <button
          type="button"
          aria-pressed={marked === DISCOVERY_UNKNOWN_FREQUENCY}
          aria-busy={(pending && marked === DISCOVERY_UNKNOWN_FREQUENCY) || undefined}
          onClick={() => choose(DISCOVERY_UNKNOWN_FREQUENCY)}
          className={cn(
            QUIET_OPTION,
            "relative",
            marked === DISCOVERY_UNKNOWN_FREQUENCY &&
              "bg-[#f1ece7] text-[var(--brand-plum-darkest)]",
          )}
        >
          {DISCOVERY_FREQUENCY_LABELS.unknown}
          {pending && marked === DISCOVERY_UNKNOWN_FREQUENCY ? (
            <PendingSpinner className="absolute right-4" />
          ) : null}
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
            onClick={() => {
              if (!busy) tap(option.key, () => onChoose(option.key))
            }}
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
            onClick={() => {
              if (!busy) tap(key, () => onType(key))
            }}
            className={cn(
              "flex min-h-[54px] items-center gap-2.5 rounded-[15px] border px-3 text-left text-[15px] font-semibold transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)]",
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
          onClick={() => {
            if (!busy) tap("unknown", () => onType(null))
          }}
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
        <button type="submit" disabled={!ready} className={cn(CORAL_BUTTON, "mt-4")}>
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
  rejections = 0,
  handlers,
  scannerRuntime,
}: {
  flow: AddFlow
  busy: boolean
  rejections?: number
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
      return (
        <DiscoveryFrequencyStep
          step={step}
          busy={busy}
          rejections={rejections}
          onFrequency={handlers.onFrequency}
        />
      )
  }
}

function stepCategory(flow: AddFlow): PersonalPlanCategory | null {
  const draft = flow.draft
  if (!draft) return null
  if (draft.usage) return draft.usage.category
  return draft.productType && draft.productType !== "styling" ? draft.productType : null
}

/** The sheet panel's scrolling content (where the search and the steps live). */
function sheetContentElement(): HTMLElement | null {
  const panel = document.querySelector<HTMLElement>(`[data-bottom-sheet-panel].${SHEET_MARKER}`)
  if (!panel) return null
  for (const child of Array.from(panel.children)) {
    if (child instanceof HTMLElement && child.classList.contains("overflow-y-auto")) return child
  }
  return null
}

type SheetCapture =
  | { kind: "to-steps"; layer: FrozenLayer; content: HTMLElement }
  | { kind: "to-search"; node: HTMLElement; offsetY: number; content: HTMLElement }

/**
 * Back from the first step to the search: the ScanSearchSheet owns the search, so the frozen
 * step is laid over the content by hand and slides away to the right while the search comes
 * in from the left — the steps' own back animation.
 */
/** The back-to-search overlay still on screen, if any — only ever one. */
let clearActiveOverlay: (() => void) | null = null

/** Registers the overlay's removal; a previous one is removed first. */
export function trackSheetOverlay(remove: () => void) {
  clearSheetOverlay()
  clearActiveOverlay = remove
}

/** Removes the overlay now — its timeout, or the next transition, whichever comes first. */
export function clearSheetOverlay() {
  const remove = clearActiveOverlay
  clearActiveOverlay = null
  remove?.()
}

function playBackToSearch(capture: Extract<SheetCapture, { kind: "to-search" }>) {
  const { content, node, offsetY } = capture
  const panel = content.parentElement
  if (!panel) return
  const style = window.getComputedStyle(content)
  const overlay = document.createElement("div")
  overlay.className = "discovery-sheet-overlay discovery-step-out-back"
  overlay.setAttribute("aria-hidden", "true")
  overlay.inert = true
  overlay.style.top = `${content.offsetTop}px`
  overlay.style.height = `${content.clientHeight}px`
  overlay.style.paddingLeft = style.paddingLeft
  overlay.style.paddingRight = style.paddingRight
  node.style.transform = `translateY(${-offsetY}px)`
  overlay.appendChild(node)
  panel.appendChild(overlay)
  jumpToTop(content)
  const entering = Array.from(content.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  )
  for (const child of entering) child.classList.add("discovery-step-in-back")
  let timeout: ReturnType<typeof setTimeout> | null = null
  const remove = () => {
    if (timeout !== null) clearTimeout(timeout)
    overlay.remove()
    for (const child of entering) child.classList.remove("discovery-step-in-back")
    if (clearActiveOverlay === remove) clearActiveOverlay = null
  }
  trackSheetOverlay(remove)
  timeout = setTimeout(remove, motionMs(Math.max(MOTION_MS.stepIn, MOTION_MS.stepOut)) + 40)
}

export function DiscoveryAddSheet({
  open,
  session = 0,
  flow,
  busy,
  rejections = 0,
  error,
  retailerSearchEnabled,
  scannerRuntime,
  handlers,
}: {
  open: boolean
  /** Which opening of the sheet this is — a new opening never slides from the last one. */
  session?: number
  flow: AddFlow | null
  busy: boolean
  /** Failed saves so far — the frequency step then shows the saved answer again. */
  rejections?: number
  error: string | null
  retailerSearchEnabled: boolean
  scannerRuntime?: ScannerRuntime
  handlers: DiscoveryAddSheetHandlers
}) {
  const stepsRef = useRef<HTMLDivElement>(null)
  // The frozen search, handed to the steps as they slide in — for this opening only.
  const [searchLeaving, setSearchLeaving] = useState<{
    session: number
    layer: FrozenLayer
  } | null>(null)
  const step = flow ? currentStep(flow) : null
  const inSearch = step?.kind === "search"
  const pinned = flow?.draft && step && step.kind !== "name" && step.kind !== "scan"
  // `<session>:search`, `<session>:steps:<step>` or `closed` — every step change is one, so a
  // leftover back overlay goes away on the very next transition.
  const watch =
    open && flow && step
      ? inSearch
        ? `${session}:search`
        : `${session}:steps:${flow.steps.length}:${step.kind}`
      : "closed"

  function capture(previous: string, next: string): SheetCapture | null {
    clearSheetOverlay()
    const mode = (key: string) => key.split(":").slice(0, 2).join(":")
    // Only search ↔ steps inside one open sheet slides here (step → step is the SlideStage's
    // job); opening or closing never does.
    if (previous === "closed" || next === "closed" || mode(previous) === mode(next)) return null
    if (previous.split(":")[0] !== next.split(":")[0] || prefersReducedMotion()) return null
    const content = sheetContentElement()
    if (!content) return null
    if (next.includes(":steps")) {
      // The search is leaving: freeze what she sees of it.
      const node = document.createElement("div")
      for (const child of Array.from(content.children)) {
        if (child instanceof HTMLElement) node.appendChild(frozenCopyOf(child))
      }
      return {
        kind: "to-steps",
        layer: { id: nextFrozenLayerId(), node, direction: 1, offsetY: content.scrollTop },
        content,
      }
    }
    const steps = stepsRef.current
    if (!steps) return null
    return { kind: "to-search", node: frozenCopyOf(steps), offsetY: content.scrollTop, content }
  }

  function onCaptured(captured: SheetCapture) {
    if (captured.kind === "to-steps") {
      jumpToTop(captured.content)
      setSearchLeaving({ session, layer: captured.layer })
    } else {
      setSearchLeaving(null)
      playBackToSearch(captured)
    }
  }

  let stepContent: ReactNode = null
  if (flow && step && !inSearch) {
    stepContent = (
      <div ref={stepsRef} key={session}>
        <SlideStage
          stepKey="steps"
          direction={1}
          enterFrom={searchLeaving?.session === session ? searchLeaving.layer : null}
          surfaceClassName="bg-background"
        >
          {pinned && flow.draft ? (
            <DiscoveryPinnedHeader
              subject={flow.draft.subject}
              capsule={draftCapsule(flow.draft)}
              category={stepCategory(flow)}
              onBack={canGoBack(flow) ? handlers.onBack : null}
            />
          ) : null}
          <SlideStage
            stepKey={`${flow.steps.length}:${step.kind}`}
            direction={flow.direction}
            animate={step.kind !== "scan"}
            surfaceClassName="bg-background"
          >
            <DiscoveryAddStepBody
              flow={flow}
              busy={busy}
              rejections={rejections}
              handlers={handlers}
              scannerRuntime={scannerRuntime}
            />
            {flow.mode === "edit" && flow.draft?.target.kind === "change" ? (
              <button
                type="button"
                onClick={() => {
                  const target = flow.draft?.target
                  if (!busy && target?.kind === "change") handlers.onRemove(target.item)
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
        </SlideStage>
      </div>
    )
  }

  return (
    <BeforeCommit watch={watch} capture={capture} onCaptured={onCaptured}>
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
        sheetClassName={SHEET_CLASS}
        stepContent={stepContent}
        // The header slot stays (same box, invisible) while the steps show, so neither the
        // search → steps slide nor the pinned product header jumps up by a header height.
        stepHeader={<ScanSearchSheetHeader reason="manual" placeholder />}
        resultsFooter={
          <button
            type="button"
            onClick={handlers.onStartTyped}
            className={cn(OUTLINE_BUTTON, "mt-4")}
          >
            {TYPED_ENTRY_LABEL}
          </button>
        }
      />
    </BeforeCommit>
  )
}
