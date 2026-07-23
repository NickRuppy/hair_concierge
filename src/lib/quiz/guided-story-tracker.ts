import type { RhythmSummary } from "@/lib/tracking/rhythm"

import type { QuizGuidedStoryPreview } from "./guided-story-preview"
import type { OfferPreviewCategory, OfferPreviewProductCard } from "./offer-preview-types"

export type GuidedStoryTrackerScenarioId = "foundation" | "treatment" | "finish"

export interface GuidedStoryTrackerScenario {
  id: GuidedStoryTrackerScenarioId
  title: string
  contextLabel: string
}

export interface GuidedStoryTrackerProduct {
  category: string
  name: string
}

export interface GuidedStoryTrackerWeekDay {
  date: string
  hasEntry: boolean
  isSelected: boolean
}

export interface GuidedStoryTrackerProof {
  scenario: GuidedStoryTrackerScenario
  products: GuidedStoryTrackerProduct[]
  week: GuidedStoryTrackerWeekDay[]
  rhythm: RhythmSummary
  today: string
  selectedDate: string
  entryProductCountLabel: string
  disclaimer: string
}

type GuidedStoryTrackerInput = Pick<QuizGuidedStoryPreview, "needs" | "products">

const TODAY = "2026-07-20"
const DAY_MS = 24 * 60 * 60 * 1000

const SCENARIOS: Record<GuidedStoryTrackerScenarioId, GuidedStoryTrackerScenario> = {
  foundation: {
    id: "foundation",
    title: "Basiswäsche",
    contextLabel: "Vergleichbare Routine: Shampoo und Conditioner",
  },
  treatment: {
    id: "treatment",
    title: "Intensive Pflege",
    contextLabel: "Vergleichbare Routine: gezielter Pflegeschritt",
  },
  finish: {
    id: "finish",
    title: "Finish & Struktur",
    contextLabel: "Vergleichbare Routine: Finish nach der Wäsche",
  },
}

const TREATMENT_CATEGORIES = new Set<OfferPreviewCategory>([
  "bondbuilder",
  "protein_mask",
  "moisture_mask",
])

const FINISH_CATEGORIES = new Set<OfferPreviewCategory>(["leave_in", "oil"])

function shiftDate(dateIso: string, days: number): string {
  return new Date(Date.parse(`${dateIso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

function categoryLabel(product: OfferPreviewProductCard): string {
  if (product.category === "bondbuilder") return "Bond-Pflege"
  if (product.category === "protein_mask") return "Protein-Maske"
  if (product.category === "moisture_mask") return "Feuchtigkeitsmaske"
  if (product.category === "leave_in") {
    return product.categoryLabel.toLowerCase().includes("curl") ? "Locken-Leave-in" : "Leave-in"
  }
  if (product.category === "oil") return "Haaröl"
  return product.categoryLabel.split("·")[0]?.trim() || product.category
}

function selectScenario(products: readonly OfferPreviewProductCard[]): GuidedStoryTrackerScenario {
  if (products.some((product) => TREATMENT_CATEGORIES.has(product.category))) {
    return SCENARIOS.treatment
  }
  if (products.some((product) => FINISH_CATEGORIES.has(product.category))) {
    return SCENARIOS.finish
  }
  return SCENARIOS.foundation
}

function productRow(product: OfferPreviewProductCard): GuidedStoryTrackerProduct {
  return {
    category: categoryLabel(product),
    name: product.name,
  }
}

function fallbackFoundationProducts(): GuidedStoryTrackerProduct[] {
  return [
    { category: "Shampoo", name: "Shampoo-Beispiel" },
    { category: "Conditioner", name: "Conditioner-Beispiel" },
  ]
}

function buildProducts(
  scenario: GuidedStoryTrackerScenario,
  products: readonly OfferPreviewProductCard[],
): GuidedStoryTrackerProduct[] {
  const shampoo = products.find((product) => product.category === "shampoo")
  const conditioner = products.find((product) => product.category === "conditioner")
  const extra = products.find(
    (product) => product.category !== "shampoo" && product.category !== "conditioner",
  )

  if (!shampoo || !conditioner) return fallbackFoundationProducts()
  const foundation = [productRow(shampoo), productRow(conditioner)]
  if (!extra || scenario.id === "foundation") return foundation

  const extraRow = productRow(extra)
  return scenario.id === "treatment" ? [extraRow, ...foundation] : [...foundation, extraRow]
}

interface RhythmConfig {
  periodWeeks: number
  washes: number
  minWashes: number
  maxWashes: number
  preferredWashes: number
  loggedIndexes: number[]
}

function rhythmConfig(cadenceLabel: string): RhythmConfig {
  if (cadenceLabel.includes("3-4")) {
    return {
      periodWeeks: 1,
      washes: 3,
      minWashes: 3,
      maxWashes: 4,
      preferredWashes: 3.5,
      loggedIndexes: [1, 4, 7],
    }
  }
  if (cadenceLabel.includes("5-6")) {
    return {
      periodWeeks: 1,
      washes: 5,
      minWashes: 5,
      maxWashes: 6,
      preferredWashes: 5.5,
      loggedIndexes: [0, 2, 4, 6, 7],
    }
  }
  if (cadenceLabel.includes("Täglich")) {
    return {
      periodWeeks: 1,
      washes: 7,
      minWashes: 7,
      maxWashes: 7,
      preferredWashes: 7,
      loggedIndexes: [0, 1, 2, 3, 4, 5, 7],
    }
  }
  if (cadenceLabel.includes("1x/Woche")) {
    return {
      periodWeeks: 1,
      washes: 1,
      minWashes: 1,
      maxWashes: 1,
      preferredWashes: 1,
      loggedIndexes: [7],
    }
  }
  if (cadenceLabel.includes("2 Wochen")) {
    return {
      periodWeeks: 2,
      washes: 1,
      minWashes: 1,
      maxWashes: 1,
      preferredWashes: 1,
      loggedIndexes: [7],
    }
  }

  return {
    periodWeeks: 1,
    washes: 2,
    minWashes: 2,
    maxWashes: 2,
    preferredWashes: 2,
    loggedIndexes: [4, 7],
  }
}

function buildWeek(loggedIndexes: readonly number[]): GuidedStoryTrackerWeekDay[] {
  const logged = new Set(loggedIndexes)
  return Array.from({ length: 8 }, (_, index) => {
    const date = shiftDate(TODAY, index - 7)
    return {
      date,
      hasEntry: logged.has(index),
      isSelected: date === TODAY,
    }
  })
}

function buildRhythm(cadenceLabel: string): { summary: RhythmSummary; loggedIndexes: number[] } {
  const config = rhythmConfig(cadenceLabel)
  const progress = Math.min(1, config.washes / config.preferredWashes)

  return {
    loggedIndexes: config.loggedIndexes,
    summary: {
      kind: "progress",
      targetLabel: cadenceLabel,
      periodStart: shiftDate(TODAY, -(config.periodWeeks * 7 - 1)),
      periodEnd: TODAY,
      periodWeeks: config.periodWeeks,
      washes: config.washes,
      minWashes: config.minWashes,
      maxWashes: config.maxWashes,
      preferredWashes: config.preferredWashes,
      progress,
      status: "in_range",
      encouragement:
        "Diese vergleichbare Beispielroutine liegt im Startbereich aus deinen Quiz-Antworten.",
      completedWeeklyStreak: null,
    },
  }
}

function productCountLabel(count: number): string {
  return `${count} ${count === 1 ? "Produkt" : "Produkte"}`
}

export function buildGuidedStoryTrackerProof(
  input: GuidedStoryTrackerInput,
): GuidedStoryTrackerProof {
  const scenario = selectScenario(input.products)
  const products = buildProducts(scenario, input.products)
  const rhythm = buildRhythm(input.needs.shampoo.cadence.label)

  return {
    scenario,
    products,
    week: buildWeek(rhythm.loggedIndexes),
    rhythm: rhythm.summary,
    today: TODAY,
    selectedDate: TODAY,
    entryProductCountLabel: productCountLabel(products.length),
    disclaimer:
      "Statisches Beispiel: eine vergleichbare Beispielroutine mit einer manuell eingetragenen Haarwäsche, kein echter Tagebuchverlauf und keine automatische Auswertung deiner Nutzung.",
  }
}
