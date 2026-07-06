import type { CSSProperties } from "react"

import type { SliderStop } from "@/components/ui/slider"
import type { CareBalanceFrequencyDelta } from "@/lib/recommendation-engine/types"
import type { RoutineUiCard } from "@/lib/routines/types"
import {
  normalizeProductFrequency,
  PRODUCT_FREQUENCIES,
  PRODUCT_FREQUENCY_LABELS,
  type ProductFrequency,
} from "@/lib/vocabulary/frequencies"

export type RoutineCardAction = "chevron" | "swap" | "more" | "trash" | "chat"

export type RoutineCardVisual = {
  cardClassName: string
  cardStyle?: CSSProperties
  dotClassName: string | null
  action: RoutineCardAction
  actionLabel: string | null
}

export type FrequencyControlModel = {
  stops: SliderStop[]
  value: ProductFrequency | null
  valuePercent: number | null
  currentLabel: string
  preferredLabel: string | null
  deltaLabel: string
  markerLabel: "C"
  band: { leftPercent: number; widthPercent: number } | null
  preferred: { leftPercent: number } | null
}

const PENDING_CARD_BACKGROUND: CSSProperties = {
  background:
    "repeating-linear-gradient(135deg, rgba(232,188,100,0.05) 0, rgba(232,188,100,0.05) 6px, transparent 6px, transparent 14px), rgba(232,188,100,0.10)",
}

const YELLOW_CARD_CLASSES = "border-[rgba(200,160,40,0.22)] bg-[rgba(220,180,60,0.12)]"

const CARD_VISUALS: Record<RoutineUiCard["kind"], RoutineCardVisual> = {
  verified_matches: {
    cardClassName: "border-[rgba(110,170,110,0.22)] bg-[rgba(110,170,110,0.10)]",
    dotClassName: "bg-[#6FAA70]",
    action: "chevron",
    actionLabel: null,
  },
  verified_swap: {
    cardClassName: YELLOW_CARD_CLASSES,
    dotClassName: "bg-[#C8A038]",
    action: "swap",
    actionLabel: "Tausch",
  },
  verified_unnecessary: {
    cardClassName: YELLOW_CARD_CLASSES,
    dotClassName: "bg-[#C8A038]",
    action: "trash",
    actionLabel: "Entfernen?",
  },
  verified_more_freq: {
    cardClassName: "border-[rgba(200,100,80,0.22)] bg-[rgba(200,100,80,0.09)]",
    dotClassName: "bg-[#C86850]",
    action: "more",
    actionLabel: "Häufiger",
  },
  pending: {
    cardClassName: "border-[rgba(232,188,100,0.35)] border-l-[3px] border-l-[#E8BC64] pl-[12px]",
    cardStyle: PENDING_CARD_BACKGROUND,
    dotClassName: null,
    action: "chevron",
    actionLabel: null,
  },
  suggestion: {
    cardClassName:
      "border-transparent bg-[rgba(110,105,95,0.10)] shadow-[inset_0_2px_5px_rgba(31,26,20,0.10),inset_0_-1px_1px_rgba(255,255,255,0.55),inset_0_0_0_1px_rgba(31,26,20,0.04)]",
    dotClassName: "bg-[#6B50A0]",
    action: "chat",
    actionLabel: "Chat",
  },
}

const NEUTRAL_CARD_VISUAL: RoutineCardVisual = {
  cardClassName: "border-border bg-card",
  dotClassName: null,
  action: "chevron",
  actionLabel: null,
}

const CARD_STATUS_DESCRIPTIONS: Record<RoutineUiCard["kind"], string> = {
  verified_matches: "Dieses Produkt ist in deiner Routine sinnvoll eingeordnet.",
  verified_swap: "Chaarlie würde hier eher eine passendere Alternative prüfen.",
  verified_unnecessary: "Dieses Produkt wirkt für dein Profil gerade nicht zwingend.",
  verified_more_freq: "Das Produkt passt, könnte aber öfter sinnvoll sein.",
  pending: "Wir prüfen noch, welches Produkt genau gemeint ist.",
  suggestion: "Diese Kategorie könnte deine Routine ergänzen.",
}

export function routineCardStatusDescription(card: Pick<RoutineUiCard, "kind">): string {
  return CARD_STATUS_DESCRIPTIONS[card.kind]
}

export function getRoutineCardVisual(card: RoutineUiCard): RoutineCardVisual {
  // Legacy text-only rows carry no verified Chaarlie signal: neutral card,
  // no traffic-light dot, no action icon.
  if (card.isLegacyTextOnly) return NEUTRAL_CARD_VISUAL
  return CARD_VISUALS[card.kind]
}

/** "3-4x/Woche" → "3-4×/Woche" for display. */
function displayFrequencyLabel(frequency: ProductFrequency): string {
  return PRODUCT_FREQUENCY_LABELS[frequency].replace("x/", "×/")
}

export function formatRoutineFrequency(frequency: string | null | undefined): string {
  const normalized = normalizeProductFrequency(frequency)
  return normalized ? displayFrequencyLabel(normalized) : "Nicht gesetzt"
}

export function routineCardTitle(card: RoutineUiCard): string {
  if (card.kind === "suggestion") {
    return card.isTopProposal
      ? `Top-Vorschlag: ${card.categoryLabel}`
      : "Würde deine Routine sinnvoll ergänzen."
  }
  return card.productName ?? "Produkt ohne eindeutigen Namen"
}

export function routineCardFrequencyLine(card: RoutineUiCard): string | null {
  if (card.kind === "suggestion") {
    const preferred = normalizeProductFrequency(card.frequencyTarget?.preferredFrequency)
    return preferred ? `Vorschlag: ${displayFrequencyLabel(preferred)}` : null
  }

  const current =
    normalizeProductFrequency(card.usageRow?.frequency_range) ??
    normalizeProductFrequency(card.currentFrequency)

  if (card.kind === "pending") {
    const label = current ? displayFrequencyLabel(current) : "Frequenz offen"
    return `${label} · von dir angelegt`
  }

  return current ? displayFrequencyLabel(current) : null
}

const FREQUENCY_STOPS: SliderStop[] = PRODUCT_FREQUENCIES.map((value) => ({
  value,
  label: PRODUCT_FREQUENCY_LABELS[value],
}))

function frequencyIndex(frequency: ProductFrequency | null): number | null {
  if (!frequency) return null
  const index = PRODUCT_FREQUENCIES.indexOf(frequency)
  return index >= 0 ? index : null
}

export function percentForFrequencyIndex(index: number): number {
  return (index / (PRODUCT_FREQUENCIES.length - 1)) * 100
}

function percentForFrequency(frequency: ProductFrequency | null): number | null {
  const index = frequencyIndex(frequency)
  if (index === null) return null
  return percentForFrequencyIndex(index)
}

function frequencyDeltaLabel(delta: CareBalanceFrequencyDelta): string {
  switch (delta) {
    case "missing":
      return "Noch nicht gesetzt"
    case "below":
      return "Unter Chaarlies Zielbereich"
    case "in_range":
      return "Im Zielbereich"
    case "above":
      return "Über Chaarlies Zielbereich"
    default:
      return "Nicht eindeutig bewertet"
  }
}

export function buildFrequencyControlModel(
  card: RoutineUiCard,
  options?: { showTarget?: boolean },
): FrequencyControlModel {
  const showTarget = options?.showTarget ?? true
  const currentFrequency = normalizeProductFrequency(card.currentFrequency)
  const preferredFrequency = showTarget
    ? normalizeProductFrequency(card.frequencyTarget?.preferredFrequency)
    : null
  const minFrequency = showTarget
    ? normalizeProductFrequency(card.frequencyTarget?.minFrequency)
    : null
  const maxFrequency = showTarget
    ? normalizeProductFrequency(card.frequencyTarget?.maxFrequency)
    : null
  const value = currentFrequency ?? preferredFrequency
  const minPercent = percentForFrequency(minFrequency)
  const maxPercent = percentForFrequency(maxFrequency)
  const preferredPercent = percentForFrequency(preferredFrequency)

  return {
    stops: FREQUENCY_STOPS,
    value,
    valuePercent: percentForFrequency(value),
    currentLabel: currentFrequency ? displayFrequencyLabel(currentFrequency) : "Nicht gesetzt",
    preferredLabel: preferredFrequency ? displayFrequencyLabel(preferredFrequency) : null,
    deltaLabel:
      showTarget && card.frequencyTarget
        ? frequencyDeltaLabel(card.frequencyTarget.delta)
        : "Deine Wahl",
    markerLabel: "C",
    band:
      minPercent !== null && maxPercent !== null
        ? {
            leftPercent: Math.min(minPercent, maxPercent),
            widthPercent: Math.abs(maxPercent - minPercent),
          }
        : null,
    preferred: preferredPercent !== null ? { leftPercent: preferredPercent } : null,
  }
}
