"use client"

import { ChevronLeft, ChevronRight, Wind } from "lucide-react"
import { preload } from "react-dom"

import {
  ADDITIONAL_HEAT_TOOL_OPTIONS,
  DRYING_ROUTE_OPTIONS,
  HEAT_PROTECTION_OPTIONS,
  RefinementOptions,
} from "@/components/personal-plan-refinement/refinement-options"
import { QuizOptionCard } from "@/components/quiz/quiz-option-card"
import {
  DISCOVERY_FREQUENCY_LABELS,
  DISCOVERY_HEAT_FREQUENCY_OPTIONS,
} from "@/lib/discovery/frequency"
import { composeDiscoveryRoutineDays } from "@/lib/discovery/routine-days"
import { createStage2HeatEventId } from "@/lib/personal-plan/refinement/heat-events"
import type {
  AdditionalHeatTool,
  DryingRoute,
  HeatProtectionConsistency,
  Stage2HeatEventSource,
} from "@/lib/personal-plan/refinement/types"
import type { ProductFrequency } from "@/lib/vocabulary/frequencies"
import { cn } from "@/lib/utils"

import { isProductItem } from "./add-flow"
import {
  DrawCheck,
  PendingSpinner,
  SlideStage,
  useDelayedPending,
  useSettledTap,
} from "./discovery-motion"
import {
  heatDraftSources,
  heatStepKey,
  heatSummaryLabel,
  HEAT_SOURCE_IMAGES,
  HEAT_SOURCE_QUESTION_OBJECT,
  isHeatStepAnswered,
  type DiscoveryHeatDraft,
  type DiscoveryHeatStep,
} from "./heat-flow"
import type { DiscoveryIntakeItemView } from "./types"
import { BACK_BUTTON, CORAL_BUTTON, CTA_BAR } from "./ui-classes"

/**
 * „Hitze & Styling" (batch 7, plan Rev. 3 §2.1 items 5–6; prototype round 6): one question
 * per screen with production Feinschliff options, icons and tool photos, a progress bar and
 * a back chevron — ending on „Alles bereit für unser Gespräch", the final page with its three
 * check rows and the coral „Abschicken".
 *
 * Batch 8: the questions slide as frozen steps; a one-tap answer moves on after the settle
 * while its save runs behind; the bottom button stays mounted and fades instead of popping;
 * the tool photos are preloaded so none pops in mid-slide.
 */

export const DRYING_PROMPT = "Wie trocknet dein Haar meistens?"
export const TOOLS_PROMPT = "Nutzt du weitere Hitze-Tools?"
export const PROTECTION_PROMPT = "Nutzt du dabei Hitzeschutz?"
export const NO_DRYING_LABEL = "Keiner dieser Wege"
export const NO_TOOLS_LABEL = "Keine weiteren Tools"
export const FINAL_TITLE = "Alles bereit für unser Gespräch"
export const SUBMIT_LABEL = "Abschicken"
export const DONE_TITLE = "Danke! Bis bald im Gespräch."
const NEXT_LABEL = "Weiter"
const BACK_LABEL = "Zurück"

export function heatFrequencyPrompt(source: Stage2HeatEventSource): string {
  return `Wie oft nutzt du ${HEAT_SOURCE_QUESTION_OBJECT[source]}?`
}

const STEP_TITLE =
  "mb-5 font-header text-[28px] font-medium leading-[1.15] text-[var(--brand-plum-darkest)]"

function HeatVisual({ source }: { source: Stage2HeatEventSource }) {
  return (
    <div className="mb-4 mt-0.5 h-[92px] w-[92px] overflow-hidden rounded-[22px] bg-[var(--brand-plum-ice)] shadow-[0_10px_28px_-20px_rgba(107,80,160,0.6)]">
      {/* The production tool photos (`public/images/tools`). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={HEAT_SOURCE_IMAGES[source]} alt="" className="h-full w-full object-cover" />
    </div>
  )
}

function SingleTapList<K extends string>({
  options,
  value,
  onPick,
}: {
  options: ReadonlyArray<{
    value: K
    label: string
    icon?: (typeof HEAT_PROTECTION_OPTIONS)[number]["icon"]
  }>
  value: K | undefined
  onPick: (value: K) => void
}) {
  const [tapped, tap] = useSettledTap<K>()
  const marked = tapped ?? value
  return (
    <div className="grid grid-cols-1 gap-2.5">
      {options.map((option) => (
        <QuizOptionCard
          key={option.value}
          icon={option.icon}
          label={option.label}
          active={marked === option.value}
          onClick={() => tap(option.value, () => onPick(option.value))}
        />
      ))}
    </div>
  )
}

const HEAT_FREQUENCY_CHOICES = DISCOVERY_HEAT_FREQUENCY_OPTIONS.map((value) => ({
  value,
  label: DISCOVERY_FREQUENCY_LABELS[value],
}))

// --- Final page ------------------------------------------------------------------------------

function Ornament() {
  return (
    <svg
      viewBox="0 0 76 62"
      width="76"
      height="62"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="discovery-ornament"
    >
      <path
        d="M11 6h30a9 9 0 0 1 9 9v13a9 9 0 0 1-9 9H25l-9 8v-8h-5a9 9 0 0 1-9-9V15a9 9 0 0 1 9-9z"
        stroke="#c8b8e0"
        strokeWidth="1.6"
      />
      <path
        d="M35 24h29a9 9 0 0 1 9 9v11a9 9 0 0 1-9 9h-4v7l-8-7H35a9 9 0 0 1-9-9V33a9 9 0 0 1 9-9z"
        fill="#f2eefa"
        stroke="#6b50a0"
        strokeWidth="1.6"
      />
      <circle cx="41.5" cy="38.5" r="1.9" fill="#6b50a0" />
      <circle cx="49.5" cy="38.5" r="1.9" fill="#6b50a0" />
      <circle cx="57.5" cy="38.5" r="1.9" fill="#6b50a0" />
      <path d="M64 6v6M61 9h6" stroke="#c8b8e0" strokeWidth="1.5" />
    </svg>
  )
}

type Avatar = { key: string; imageUrl: string | null; packshot?: boolean; icon?: "wind" }

function Avatars({ avatars }: { avatars: Avatar[] }) {
  if (avatars.length === 0) return null
  const shown = avatars.slice(0, 4)
  const more = avatars.length - shown.length
  const circle =
    "relative -ml-2 grid h-7 w-7 place-items-center overflow-hidden rounded-full shadow-[0_0_0_2px_#fff]"
  return (
    <span className="flex shrink-0 pl-2" aria-hidden="true">
      {shown.map((avatar) =>
        avatar.imageUrl ? (
          <span key={avatar.key} className={cn(circle, "bg-[#f3f0e8]")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatar.imageUrl}
              alt=""
              className={cn(
                "absolute inset-0 h-full w-full object-cover",
                avatar.packshot && "scale-[1.7]",
              )}
            />
          </span>
        ) : (
          <span
            key={avatar.key}
            className={cn(circle, "bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]")}
          >
            {avatar.icon === "wind" ? <Wind className="h-3.5 w-3.5" aria-hidden="true" /> : null}
          </span>
        ),
      )}
      {more > 0 ? (
        <span
          className={cn(
            circle,
            "bg-[var(--brand-plum-ice)] text-[11px] font-bold text-[var(--brand-plum)]",
          )}
        >
          +{more}
        </span>
      ) : null}
    </span>
  )
}

export type DiscoveryFinalRow = {
  key: "quiz" | "products" | "heat"
  label: string
  /** One line each. */
  details: string[]
  avatars: Avatar[]
}

/** The final page's three rows: Fragebogen · Deine Produkte · Hitze & Styling. */
export function discoveryFinalRows(
  items: readonly DiscoveryIntakeItemView[],
  heat: DiscoveryHeatDraft,
): DiscoveryFinalRow[] {
  const products = items.filter(isProductItem)
  const washDay = composeDiscoveryRoutineDays(products).find((day) => day.kind === "wash_day")
  const count = products.length === 1 ? "1 Produkt" : `${products.length} Produkte`
  const sources = heatDraftSources(heat)
  return [
    { key: "quiz", label: "Fragebogen", details: ["Erledigt"], avatars: [] },
    {
      key: "products",
      label: "Deine Produkte",
      details: washDay?.cadenceLabel ? [count, `Waschtag ${washDay.cadenceLabel}`] : [count],
      avatars: products.map((item) => ({
        key: item.id,
        imageUrl: item.imageUrl ?? null,
        packshot: true,
      })),
    },
    {
      key: "heat",
      label: "Hitze & Styling",
      details: [heatSummaryLabel(heat)],
      avatars:
        sources.length > 0
          ? sources.map((source) => ({ key: source, imageUrl: HEAT_SOURCE_IMAGES[source] }))
          : heat.dryingRoutes?.includes("air_dry")
            ? [{ key: "air_dry", imageUrl: null, icon: "wind" as const }]
            : [],
    },
  ]
}

export function DiscoveryFinalPage({
  items,
  heat,
  onEditProducts,
  onEditHeat,
}: {
  items: readonly DiscoveryIntakeItemView[]
  heat: DiscoveryHeatDraft
  onEditProducts: () => void
  onEditHeat: () => void
}) {
  const rows = discoveryFinalRows(items, heat)
  return (
    <div className="px-4 pb-8 pt-11">
      <div className="flex flex-col items-center pb-6 pt-2 text-center">
        <Ornament />
        <h1 className="discovery-fade-up mt-4 max-w-[290px] font-header text-[32px] font-medium leading-[1.12] tracking-[-0.015em] text-[var(--brand-plum-darkest)] [text-wrap:balance]">
          {FINAL_TITLE}
        </h1>
      </div>
      <div className="rounded-[20px] border border-border bg-white px-4 py-0.5 shadow-[0_1px_2px_rgba(42,24,69,0.04),0_14px_34px_-14px_rgba(42,24,69,0.12)]">
        {rows.map((row, index) => {
          const delay = 260 + index * 110
          const onClick =
            row.key === "products" ? onEditProducts : row.key === "heat" ? onEditHeat : null
          const content = (
            <>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]">
                <DrawCheck size={18} delayMs={delay + 180} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="text-base font-semibold leading-tight text-[var(--brand-plum-darkest)]">
                  {row.label}
                </span>
                {row.details.map((line) => (
                  <span key={line} className="text-sm leading-snug text-[var(--text-sub)]">
                    {line}
                  </span>
                ))}
              </span>
              <Avatars avatars={row.avatars} />
              {onClick ? (
                <ChevronRight
                  className="-ml-1 h-[18px] w-[18px] shrink-0 text-[var(--brand-plum-light)]"
                  aria-hidden="true"
                />
              ) : null}
            </>
          )
          const rowClass = cn(
            "discovery-fade-up flex min-h-20 w-full items-center gap-3.5 py-4 text-left",
            index > 0 && "border-t border-border",
          )
          return onClick ? (
            <button
              key={row.key}
              type="button"
              onClick={onClick}
              style={{ animationDelay: `${delay}ms` }}
              className={cn(
                rowClass,
                "transition-opacity active:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)]",
              )}
            >
              {content}
            </button>
          ) : (
            <div key={row.key} style={{ animationDelay: `${delay}ms` }} className={rowClass}>
              {content}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- The flow ------------------------------------------------------------------------------

export function DiscoveryHeatStepBody({
  step,
  draft,
  onDrying,
  onTools,
  onFrequency,
  onProtection,
}: {
  step: DiscoveryHeatStep
  draft: DiscoveryHeatDraft
  onDrying: (routes: DryingRoute[]) => void
  onTools: (tools: AdditionalHeatTool[]) => void
  onFrequency: (source: Stage2HeatEventSource, frequency: ProductFrequency) => void
  onProtection: (source: Stage2HeatEventSource, protection: HeatProtectionConsistency) => void
}) {
  switch (step.kind) {
    case "drying":
      return (
        <>
          <h1 className={STEP_TITLE}>{DRYING_PROMPT}</h1>
          <RefinementOptions
            options={DRYING_ROUTE_OPTIONS}
            value={draft.dryingRoutes}
            multi
            allowNone
            noneLabel={NO_DRYING_LABEL}
            noneDescription=""
            onChange={(next) => onDrying(next as DryingRoute[])}
          />
        </>
      )
    case "tools":
      return (
        <>
          <h1 className={STEP_TITLE}>{TOOLS_PROMPT}</h1>
          <RefinementOptions
            options={ADDITIONAL_HEAT_TOOL_OPTIONS}
            value={draft.additionalHeatTools}
            multi
            allowNone
            layout="grid"
            noneLabel={NO_TOOLS_LABEL}
            noneDescription=""
            onChange={(next) => onTools(next as AdditionalHeatTool[])}
          />
        </>
      )
    case "frequency":
      return (
        <>
          <HeatVisual source={step.source} />
          <h1 className={STEP_TITLE}>{heatFrequencyPrompt(step.source)}</h1>
          <SingleTapList
            options={HEAT_FREQUENCY_CHOICES}
            value={draft.heatEvents[createStage2HeatEventId(step.source)]?.frequency}
            onPick={(frequency) => onFrequency(step.source, frequency)}
          />
        </>
      )
    case "protection":
      return (
        <>
          <HeatVisual source={step.source} />
          <h1 className={STEP_TITLE}>{PROTECTION_PROMPT}</h1>
          <SingleTapList
            options={HEAT_PROTECTION_OPTIONS}
            value={draft.heatEvents[createStage2HeatEventId(step.source)]?.protectionConsistency}
            onPick={(protection) => onProtection(step.source, protection)}
          />
        </>
      )
    case "summary":
      return null
  }
}

export function DiscoveryHeatScreen({
  steps,
  index,
  direction,
  draft,
  items,
  submitting,
  error,
  onBack,
  onNext,
  onDrying,
  onTools,
  onFrequency,
  onProtection,
  onSubmit,
  onEditProducts,
  onEditHeat,
}: {
  steps: DiscoveryHeatStep[]
  index: number
  direction: 1 | -1
  draft: DiscoveryHeatDraft
  items: readonly DiscoveryIntakeItemView[]
  /** „Abschicken" is on its way (it first waits for any save still running). */
  submitting: boolean
  error: string | null
  onBack: () => void
  onNext: () => void
  onDrying: (routes: DryingRoute[]) => void
  onTools: (tools: AdditionalHeatTool[]) => void
  onFrequency: (source: Stage2HeatEventSource, frequency: ProductFrequency) => void
  onProtection: (source: Stage2HeatEventSource, protection: HeatProtectionConsistency) => void
  onSubmit: () => void
  onEditProducts: () => void
  onEditHeat: () => void
}) {
  // The tool photos come a step or two later — fetched now, they never pop in mid-slide.
  for (const src of Object.values(HEAT_SOURCE_IMAGES)) preload(src, { as: "image" })
  const submitPending = useDelayedPending(submitting)
  const step = steps[Math.min(index, steps.length - 1)]
  const multi = step.kind === "drying" || step.kind === "tools"
  const summary = step.kind === "summary"
  // Always mounted: on a one-tap question it fades out instead of popping away.
  const buttonShown = multi || summary
  const progress = ((Math.min(index, steps.length - 1) + 1) / steps.length) * 100
  return (
    <main className="flex min-h-dvh flex-col bg-[#faf8f6]">
      <div className="sticky top-0 z-20 flex h-[54px] items-center gap-2.5 bg-[#faf8f6] pl-1 pr-4 pt-1.5">
        <button type="button" onClick={onBack} aria-label={BACK_LABEL} className={BACK_BUTTON}>
          <ChevronLeft className="h-[22px] w-[22px]" aria-hidden="true" />
        </button>
        <div
          className="h-1 flex-1 overflow-hidden rounded-sm bg-[#ebe4f3]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <i
            className="block h-full rounded-sm bg-[var(--brand-plum)] transition-[width] duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <SlideStage
        stepKey={heatStepKey(step)}
        direction={direction}
        surfaceClassName="bg-[#faf8f6]"
        className="flex-1"
      >
        {summary ? (
          <DiscoveryFinalPage
            items={items}
            heat={draft}
            onEditProducts={onEditProducts}
            onEditHeat={onEditHeat}
          />
        ) : (
          <div className="px-4 pb-8 pt-3.5">
            <DiscoveryHeatStepBody
              step={step}
              draft={draft}
              onDrying={onDrying}
              onTools={onTools}
              onFrequency={onFrequency}
              onProtection={onProtection}
            />
          </div>
        )}
      </SlideStage>
      {error ? (
        <p role="alert" className="px-4 pb-2 text-center text-sm text-[var(--brand-coral-dark)]">
          {error}
        </p>
      ) : null}
      <div
        aria-hidden={buttonShown ? undefined : true}
        inert={!buttonShown}
        className={cn(
          CTA_BAR,
          "transition-opacity duration-[var(--motion-step-in)] ease-[var(--motion-ease-enter)]",
          !buttonShown && "pointer-events-none opacity-0",
        )}
      >
        <button
          type="button"
          onClick={summary ? onSubmit : onNext}
          disabled={!summary && !isHeatStepAnswered(draft, step)}
          aria-busy={(summary && submitting) || undefined}
          className={cn(CORAL_BUTTON, "relative")}
        >
          {summary ? SUBMIT_LABEL : NEXT_LABEL}
          {summary && submitPending ? <PendingSpinner className="absolute right-6" /> : null}
        </button>
      </div>
    </main>
  )
}

/** „Danke! Bis bald im Gespräch." — also where a returning, already-submitted participant lands. */
export function DiscoveryIntakeThanks() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#faf8f6] px-7 pb-[max(60px,env(safe-area-inset-bottom))] pt-6 text-center">
      <span className="discovery-pop grid h-24 w-24 place-items-center rounded-full bg-[var(--brand-plum-ice)] text-[var(--brand-plum)] shadow-[0_0_0_10px_rgba(242,238,250,0.5)]">
        <DrawCheck size={44} delayMs={420} />
      </span>
      <h1 className="discovery-fade-up max-w-[300px] font-header text-[32px] font-medium leading-[1.1] tracking-[-0.015em] text-[var(--brand-plum-darkest)] [animation-delay:500ms] [text-wrap:balance]">
        {DONE_TITLE}
      </h1>
    </main>
  )
}
